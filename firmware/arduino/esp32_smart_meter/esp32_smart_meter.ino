// ============================================================================
// Smart Energy Meter — FINAL Production Firmware (ESP32 DevKit)
// ============================================================================
// RELAY WIRING: Live wire through COM → NC (Normally Closed)
//   - Normal:  Relay coil OFF (GPIO26=HIGH) → NC closed → Load POWERED
//   - Fault:   Relay coil ON  (GPIO26=LOW)  → NC opens  → Load DISCONNECTED
//   - ESP32 boot / crash: Relay energized (safe) → NC opens → Load OFF
//
// Thresholds: Over-Voltage=240V, Under-Voltage=200V
// ============================================================================
// Required Libraries (Arduino IDE -> Tools -> Manage Libraries):
//   1. "PZEM-004T v30" by Jakub Mandula (v1.1.2)
//   2. "ArduinoJson" by Benoit Blanchon (v7.x)
//   3. "LiquidCrystal_I2C" by Frank de Brabander (v1.1.4)
// ============================================================================

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <PZEM004Tv30.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>

// ============================================================================
// 1. USER CONFIGURATION & CREDENTIALS
// ============================================================================
#if __has_include("secrets.h")
  #include "secrets.h"
#elif __has_include("../../secrets.h")
  #include "../../secrets.h"
#elif __has_include("../../../secrets.h")
  #include "../../../secrets.h"
#else
  #define SECRET_WIFI_SSID      "YOUR_WIFI_SSID"
  #define SECRET_WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"
  #define SECRET_SUPABASE_URL   "https://your-project.supabase.co"
  #define SECRET_SUPABASE_KEY   "your-supabase-publishable-key"
  #define SECRET_DEVICE_ID      "esp32-meter-001"
#endif

const char* WIFI_SSID     = SECRET_WIFI_SSID;
const char* WIFI_PASSWORD = SECRET_WIFI_PASSWORD;

const char* SUPABASE_URL  = SECRET_SUPABASE_URL;
const char* SUPABASE_KEY  = SECRET_SUPABASE_KEY;
const char* DEVICE_ID     = SECRET_DEVICE_ID;

// ============================================================================
// 2. PIN ASSIGNMENTS
// ============================================================================
#define PIN_PZEM_RX     16  // ESP32 GPIO16 (RX2) ◄── PZEM TX
#define PIN_PZEM_TX     17  // ESP32 GPIO17 (TX2) ──► PZEM RX
#define PIN_RELAY_1     26  // ESP32 GPIO26 ──► Relay IN1 (Active-LOW module)
#define PIN_BUZZER      25  // ESP32 GPIO25 ──► Buzzer (+)
#define PIN_STATUS_LED  2   // Onboard Blue LED
#define PIN_I2C_SDA     21  // LCD I2C SDA
#define PIN_I2C_SCL     22  // LCD I2C SCL

// ============================================================================
// 3. RELAY NC (NORMALLY CLOSED) WIRING LOGIC
// ============================================================================
// Relay module is Active-LOW:
//   IN1 = LOW  → Relay coil ENERGIZED   → NC contact OPENS  → Load OFF
//   IN1 = HIGH → Relay coil DE-ENERGIZED → NC contact CLOSED → Load ON
//
// FAIL-SAFE: On boot, GPIO26 = LOW (relay energized, NC open, load OFF)
// until safe readings are confirmed. If ESP32 resets or crashes while
// GPIO26 is LOW, the load stays disconnected (safe).
// ============================================================================
#define RELAY_LOAD_ON   HIGH  // De-energize coil → NC closes → Load powered
#define RELAY_LOAD_OFF  LOW   // Energize coil → NC opens → Load disconnected

// ============================================================================
// 4. DEFAULT PROTECTION THRESHOLDS
// ============================================================================
float thresholdOverVoltage  = 240.0f;   // Trip if voltage > 240V
float thresholdUnderVoltage = 200.0f;   // Trip if voltage < 200V
float thresholdPowerLimit   = 2000.0f;  // Trip if power > 2000W
float tariffCostPerKWh      = 6.0f;     // ₹6.0 per kWh

// ============================================================================
// 5. OBJECTS & STATE
// ============================================================================
PZEM004Tv30 pzem(Serial2, PIN_PZEM_RX, PIN_PZEM_TX);
LiquidCrystal_I2C lcd(0x27, 16, 2);
WiFiClientSecure secureClient;

bool lcdDetected       = false;
bool relay1Closed      = false;   // true = Load ON, false = Load OFF
bool pzemValid         = false;
String activeFaultName = "normal";

// Live Sensor Readings
float liveVoltage = 0, liveCurrent = 0, livePower = 0;
float liveEnergy = 0, liveFrequency = 0, livePowerFactor = 0;
float liveCost = 0;

// Protection State Machine
enum ProtState { STATE_BOOT, STATE_NORMAL, STATE_TRIP, STATE_FAULT, STATE_RECOVERY };
ProtState protectionState = STATE_BOOT;
unsigned long recoveryTimerStart = 0;

// Buzzer State (Non-Blocking 3-Beep Pattern)
int buzzerBeepsLeft = 0;
unsigned long lastBuzzerToggle = 0;
bool buzzerPinHigh = false;

// Non-Blocking Timers
unsigned long lastSensorRead     = 0;
unsigned long lastDisplayUpdate  = 0;
unsigned long lastTelemetryUpload = 0;
unsigned long lastSettingsSync   = 0;
int lcdPage = 0;

// ============================================================================
// 6. RELAY CONTROL (Single Authority — Protection Engine ONLY)
// ============================================================================
void setRelay1(bool loadOn) {
  relay1Closed = loadOn;
  digitalWrite(PIN_RELAY_1, loadOn ? RELAY_LOAD_ON : RELAY_LOAD_OFF);
}

// ============================================================================
// 7. BUZZER CONTROL (Non-Blocking Beep Pattern)
// ============================================================================
void triggerBuzzer(int beeps) {
  buzzerBeepsLeft = beeps * 2;  // ON/OFF cycles
  lastBuzzerToggle = millis();
  buzzerPinHigh = true;
  digitalWrite(PIN_BUZZER, HIGH);
}

void updateBuzzer() {
  if (buzzerBeepsLeft <= 0) {
    if (buzzerPinHigh) {
      buzzerPinHigh = false;
      digitalWrite(PIN_BUZZER, LOW);
    }
    return;
  }
  if (millis() - lastBuzzerToggle >= 120) {
    lastBuzzerToggle = millis();
    buzzerPinHigh = !buzzerPinHigh;
    digitalWrite(PIN_BUZZER, buzzerPinHigh ? HIGH : LOW);
    buzzerBeepsLeft--;
  }
}

// ============================================================================
// 8. WI-FI CONNECTION & NTP
// ============================================================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("\n[WIFI] Connecting to %s...", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 25) {
    delay(400);
    Serial.print(".");
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    Serial.printf("\n[WIFI] Connected! IP: %s (RSSI: %d dBm)\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    digitalWrite(PIN_STATUS_LED, LOW);
    Serial.println("\n[WIFI] Connection timed out. Will retry.");
  }
}

void initNTP() {
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  struct tm timeinfo;
  getLocalTime(&timeinfo, 5000);
}

String getISOTimestamp() {
  time_t now = time(nullptr);
  struct tm* t = gmtime(&now);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", t);
  return String(buf);
}

// ============================================================================
// 9. LCD DISPLAY
// ============================================================================
void initLCD() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.beginTransmission(0x27);
  if (Wire.endTransmission() == 0) {
    lcd = LiquidCrystal_I2C(0x27, 16, 2);
    lcd.init(); lcd.backlight(); lcdDetected = true;
    Serial.println("[LCD] Detected at 0x27");
    return;
  }
  Wire.beginTransmission(0x3F);
  if (Wire.endTransmission() == 0) {
    lcd = LiquidCrystal_I2C(0x3F, 16, 2);
    lcd.init(); lcd.backlight(); lcdDetected = true;
    Serial.println("[LCD] Detected at 0x3F");
    return;
  }
  Serial.println("[LCD] Not detected. Running headless.");
}

void updateLCD() {
  if (!lcdDetected) return;
  lcd.clear();

  // Critical Fault Overlay (Highest Priority)
  if (activeFaultName != "normal") {
    lcd.setCursor(0, 0);
    if (activeFaultName == "over_voltage")       lcd.print("! OVER VOLTAGE !");
    else if (activeFaultName == "under_voltage") lcd.print("! UNDER VOLTAGE!");
    else if (activeFaultName == "over_power")    lcd.print("! OVER POWER !  ");
    else if (activeFaultName == "sensor_failure")lcd.print("! PZEM FAULT !  ");
    else                                         lcd.print("! TRIP ALARM !  ");
    lcd.setCursor(0, 1);
    char l2[17];
    snprintf(l2, sizeof(l2), "RLY:OFF %5.1fV", liveVoltage);
    lcd.print(l2);
    return;
  }

  // Boot / Waiting for first valid reading
  if (protectionState == STATE_BOOT) {
    lcd.setCursor(0, 0); lcd.print("Waiting for PZEM");
    lcd.setCursor(0, 1); lcd.print("Connect 230V AC ");
    return;
  }

  // Normal Telemetry Pages
  if (lcdPage == 0) {
    char l1[17], l2[17];
    snprintf(l1, sizeof(l1), "%5.1fV  %5.0fW", liveVoltage, livePower);
    snprintf(l2, sizeof(l2), "%5.2fA  R:%s", liveCurrent, relay1Closed ? "ON " : "OFF");
    lcd.setCursor(0, 0); lcd.print(l1);
    lcd.setCursor(0, 1); lcd.print(l2);
  } else {
    char l1[17], l2[17];
    snprintf(l1, sizeof(l1), "E:%5.2fk  %4.1fHz", liveEnergy, liveFrequency);
    snprintf(l2, sizeof(l2), "PF:%4.2f [%s]", livePowerFactor, (WiFi.status() == WL_CONNECTED) ? "WIFI" : "OFFL");
    lcd.setCursor(0, 0); lcd.print(l1);
    lcd.setCursor(0, 1); lcd.print(l2);
  }
}

// ============================================================================
// 10. SUPABASE REST API (Using Anon/Publishable Key)
// ============================================================================
void sendReadingToCloud(const String& isoTime) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(secureClient, String(SUPABASE_URL) + "/rest/v1/energy_readings");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Prefer", "return=minimal");

  JsonDocument doc;
  doc["device_id"]         = DEVICE_ID;
  doc["timestamp"]         = isoTime;
  doc["voltage"]           = serialized(String(liveVoltage, 1));
  doc["current_amps"]      = serialized(String(liveCurrent, 3));
  doc["power"]             = serialized(String(livePower, 1));
  doc["energy_kwh"]        = serialized(String(liveEnergy, 4));
  doc["frequency"]         = serialized(String(liveFrequency, 1));
  doc["power_factor"]      = serialized(String(livePowerFactor, 2));
  doc["cost"]              = serialized(String(liveCost, 2));
  doc["protection_status"] = activeFaultName;

  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}

void sendHeartbeatToCloud(const String& isoTime) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(secureClient, String(SUPABASE_URL) + "/rest/v1/device_status");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Prefer", "resolution=merge-duplicates");

  JsonDocument doc;
  doc["device_id"]       = DEVICE_ID;
  doc["connection_type"] = "hardware";
  doc["wifi_status"]     = (WiFi.status() == WL_CONNECTED);
  doc["gsm_status"]      = false;
  doc["pzem_status"]     = pzemValid;
  doc["relay1_status"]   = relay1Closed;  // Reports ACTUAL physical state
  doc["relay2_status"]   = false;
  doc["last_seen"]       = isoTime;

  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}

void sendAlertToCloud(const String& aType, float val, const String& msg, const String& isoTime) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(secureClient, String(SUPABASE_URL) + "/rest/v1/alerts");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Prefer", "return=minimal");

  JsonDocument doc;
  doc["device_id"]    = DEVICE_ID;
  doc["timestamp"]    = isoTime;
  doc["alert_type"]   = aType;
  doc["value"]        = serialized(String(val, 2));
  doc["message"]      = msg;
  doc["relay_status"] = relay1Closed ? "on" : "off";
  doc["acknowledged"] = false;

  String body;
  serializeJson(doc, body);
  int httpCode = http.POST(body);
  Serial.printf("[ALERT] %s -> HTTP %d\n", aType.c_str(), httpCode);
  http.end();
}

void fetchRemoteSettings() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(secureClient, String(SUPABASE_URL) + "/rest/v1/meter_settings?device_id=eq." + DEVICE_ID + "&select=*");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);

  int code = http.GET();
  if (code == 200) {
    String payload = http.getString();
    JsonDocument doc;
    deserializeJson(doc, payload);
    if (doc.is<JsonArray>() && doc.as<JsonArray>().size() > 0) {
      JsonObject o = doc[0];
      if (o["over_voltage"].is<float>())  thresholdOverVoltage  = o["over_voltage"].as<float>();
      if (o["under_voltage"].is<float>()) thresholdUnderVoltage = o["under_voltage"].as<float>();
      if (o["power_limit"].is<float>())   thresholdPowerLimit   = o["power_limit"].as<float>();
      if (o["cost_per_kwh"].is<float>())  tariffCostPerKWh      = o["cost_per_kwh"].as<float>();
      Serial.printf("[SETTINGS] OV=%.0fV UV=%.0fV PL=%.0fW Tariff=Rs%.1f/kWh\n",
                    thresholdOverVoltage, thresholdUnderVoltage, thresholdPowerLimit, tariffCostPerKWh);
    }
  }
  http.end();
}

// ============================================================================
// 11. SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n==================================================");
  Serial.println("   SMART ENERGY METER — ESP32 FINAL FIRMWARE      ");
  Serial.println("   Relay Wiring: COM → NC (Normally Closed)       ");
  Serial.println("   Thresholds: OV=240V UV=200V PL=2000W           ");
  Serial.println("==================================================");

  // Initialize GPIO outputs
  pinMode(PIN_RELAY_1, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_STATUS_LED, OUTPUT);

  // SAFE BOOT: Relay energized → NC opens → Load OFF
  setRelay1(false);
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_STATUS_LED, LOW);
  Serial.println("[BOOT] Relay 1 = OFF (NC open, safe boot state)");

  // LCD
  initLCD();
  if (lcdDetected) {
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("Smart Energy");
    lcd.setCursor(0, 1); lcd.print("Meter v1.0");
    delay(1500);
  }

  // Wi-Fi & NTP
  connectWiFi();
  initNTP();
  secureClient.setInsecure();

  // Fetch remote thresholds from Supabase
  fetchRemoteSettings();

  Serial.println("[SYSTEM] Init complete. Waiting for first valid PZEM reading...");
}

// ============================================================================
// 12. MAIN NON-BLOCKING LOOP
// ============================================================================
void loop() {
  // Maintain Wi-Fi
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  // Update buzzer beep pattern
  updateBuzzer();

  unsigned long now = millis();

  // ── TASK 1: Read PZEM & Evaluate Protection (every 800ms) ──
  if (now - lastSensorRead >= 800) {
    lastSensorRead = now;

    float v  = pzem.voltage();
    float i  = pzem.current();
    float p  = pzem.power();
    float e  = pzem.energy();
    float f  = pzem.frequency();
    float pf = pzem.pf();

    if (!isnan(v) && v > 0) {
      liveVoltage     = v;
      liveCurrent     = isnan(i)  ? 0.0f : i;
      livePower       = isnan(p)  ? 0.0f : p;
      liveEnergy      = isnan(e)  ? 0.0f : e;
      liveFrequency   = isnan(f)  ? 50.0f : f;
      livePowerFactor = isnan(pf) ? 1.0f : pf;
      liveCost        = liveEnergy * tariffCostPerKWh;
      pzemValid       = true;
    } else {
      pzemValid = false;
    }

    // ── Fault Detection ──
    String detectedFault = "normal";
    float faultVal = 0;
    String faultMsg = "";

    if (!pzemValid) {
      detectedFault = "sensor_failure";
      faultMsg = "PZEM-004T sensor communication failure.";
    } else if (liveVoltage > thresholdOverVoltage) {
      detectedFault = "over_voltage";
      faultVal = liveVoltage;
      faultMsg = "Over-voltage: " + String(liveVoltage, 1) + "V > " + String(thresholdOverVoltage, 0) + "V";
    } else if (liveVoltage > 10.0f && liveVoltage < thresholdUnderVoltage) {
      detectedFault = "under_voltage";
      faultVal = liveVoltage;
      faultMsg = "Under-voltage: " + String(liveVoltage, 1) + "V < " + String(thresholdUnderVoltage, 0) + "V";
    } else if (livePower > thresholdPowerLimit) {
      detectedFault = "over_power";
      faultVal = livePower;
      faultMsg = "Over-power: " + String(livePower, 1) + "W > " + String(thresholdPowerLimit, 0) + "W";
    }

    // ── Protection State Machine ──
    switch (protectionState) {

      case STATE_BOOT:
        // Wait for first valid PZEM reading before energizing load
        if (pzemValid && detectedFault == "normal") {
          setRelay1(true);  // NC closes → Load ON
          protectionState = STATE_NORMAL;
          activeFaultName = "normal";
          Serial.printf("[BOOT → NORMAL] First safe reading: %.1fV. Relay 1 ON.\n", liveVoltage);
        } else if (pzemValid && detectedFault != "normal") {
          // First reading already shows a fault — stay OFF
          activeFaultName = detectedFault;
          protectionState = STATE_FAULT;
          triggerBuzzer(3);
          sendAlertToCloud(detectedFault, faultVal, faultMsg, getISOTimestamp());
          Serial.printf("[BOOT → FAULT] %s detected. Relay stays OFF.\n", detectedFault.c_str());
        }
        // If PZEM not valid yet, stay in BOOT (relay OFF, safe)
        break;

      case STATE_NORMAL:
        if (detectedFault != "normal") {
          // ── INSTANTANEOUS TRIP ──
          setRelay1(false);  // Energize relay → NC opens → Load OFF
          triggerBuzzer(3);
          protectionState = STATE_TRIP;
          activeFaultName = detectedFault;
          // Single edge-triggered alert (no duplicates)
          sendAlertToCloud(detectedFault, faultVal, faultMsg, getISOTimestamp());
          Serial.printf("[TRIP] %s (Val=%.1f) → Relay 1 OFF\n", detectedFault.c_str(), faultVal);
        } else {
          // Confirm relay stays ON during normal
          if (!relay1Closed) setRelay1(true);
        }
        break;

      case STATE_TRIP:
        // Immediate transition to sustained fault holding
        protectionState = STATE_FAULT;
        break;

      case STATE_FAULT:
        setRelay1(false);  // Strictly maintain OFF
        if (detectedFault == "normal") {
          protectionState = STATE_RECOVERY;
          recoveryTimerStart = millis();
          Serial.println("[RECOVERY] Safe readings detected. Starting 5s hold timer...");
        }
        break;

      case STATE_RECOVERY:
        setRelay1(false);  // Maintain OFF during recovery window
        if (detectedFault != "normal") {
          // Re-faulted! Back to FAULT state
          protectionState = STATE_FAULT;
          activeFaultName = detectedFault;
          Serial.printf("[RECOVERY ABORTED] Re-fault: %s\n", detectedFault.c_str());
        } else if (millis() - recoveryTimerStart >= 5000) {
          // 5 seconds of continuous safe readings confirmed
          setRelay1(true);  // De-energize relay → NC closes → Load ON
          protectionState = STATE_NORMAL;
          activeFaultName = "normal";
          Serial.println("[RECOVERED] 5s safe window passed. Relay 1 ON → Load powered.");
        }
        break;
    }
  }

  // ── TASK 2: LCD Update (every 500ms) ──
  if (now - lastDisplayUpdate >= 500) {
    lastDisplayUpdate = now;
    if ((now / 3000) % 2 != lcdPage) lcdPage = (now / 3000) % 2;
    updateLCD();
  }

  // ── TASK 3: Supabase Telemetry & Heartbeat (every 5s) ──
  if (now - lastTelemetryUpload >= 5000) {
    lastTelemetryUpload = now;
    String isoTime = getISOTimestamp();

    if (pzemValid) {
      sendReadingToCloud(isoTime);
      Serial.printf("[DATA] %s | V=%.1fV I=%.3fA P=%.1fW E=%.4fkWh F=%.1fHz PF=%.2f [%s] R1:%s\n",
                    isoTime.c_str(), liveVoltage, liveCurrent, livePower, liveEnergy,
                    liveFrequency, livePowerFactor, activeFaultName.c_str(),
                    relay1Closed ? "ON" : "OFF");
    }

    // Heartbeat always reports actual relay state (NEVER commands the relay)
    sendHeartbeatToCloud(isoTime);
  }

  // ── TASK 4: Settings Sync from Supabase (every 10s) ──
  if (now - lastSettingsSync >= 10000) {
    lastSettingsSync = now;
    fetchRemoteSettings();
  }

  delay(10);
}
