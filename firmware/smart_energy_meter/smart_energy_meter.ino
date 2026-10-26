// ============================================================================
// Smart Energy Meter — Production Firmware v2.3 (Validated NTP & IST/UTC Clock)
// Board: ESP32 DevKit
// ============================================================================
// RELAY LOGIC (Synchronized):
//   - Relay ON  (Energized)    -> Circuit/Load ON
//   - Relay OFF (De-energized) -> Circuit/Load OFF
//
// Default Thresholds: Over-Voltage=250V, Under-Voltage=180V, Power=2000W
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
// Credentials are held in secrets.h (local, untracked by Git).
// If secrets.h is not found, falls back to secrets.example.h template.
#if __has_include("secrets.h")
  #include "secrets.h"
#elif __has_include("secrets.example.h")
  #include "secrets.example.h"
#else
  #define SECRET_WIFI_SSID      "YOUR_WIFI_SSID"
  #define SECRET_WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"
  #define SECRET_SUPABASE_URL   "https://your-project.supabase.co"
  #define SECRET_SUPABASE_KEY   "your-supabase-publishable-key"
  #define SECRET_SUPABASE_HOST  "your-project.supabase.co"
  #define SECRET_DEVICE_ID      "esp32-meter-001"
#endif

const char* WIFI_SSID     = SECRET_WIFI_SSID;
const char* WIFI_PASSWORD = SECRET_WIFI_PASSWORD;
const char* SUPABASE_URL  = SECRET_SUPABASE_URL;
const char* SUPABASE_KEY  = SECRET_SUPABASE_KEY;
const char* DEVICE_ID     = SECRET_DEVICE_ID;

// Supabase hostname for DNS diagnostics
const char* SUPABASE_HOST = SECRET_SUPABASE_HOST;

// Public DNS servers to bypass router DNS resolution failures
const IPAddress PUBLIC_DNS_1(8, 8, 8, 8);  // Google Primary DNS
const IPAddress PUBLIC_DNS_2(1, 1, 1, 1);  // Cloudflare Secondary DNS

// ============================================================================
// 2. PIN ASSIGNMENTS
// ============================================================================
#define PIN_PZEM_RX     26   // PZEM TX -> ESP32 RX (GPIO 26)
#define PIN_PZEM_TX     27   // PZEM RX <- ESP32 TX (GPIO 27)
#define PIN_RELAY_1     23   // Relay IN1 (GPIO 23)
#define PIN_BUZZER      25   // Buzzer positive (GPIO 25)
#define PIN_STATUS_LED  2    // Onboard status LED (GPIO 2)
#define PIN_I2C_SDA     13   // LCD I2C SDA (GPIO 13)
#define PIN_I2C_SCL     14   // LCD I2C SCL (GPIO 14)

// ============================================================================
// 3. RELAY LOGIC (Active-LOW Relay Module)
// ============================================================================
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// ============================================================================
// 4. PROTECTION THRESHOLDS (Defaults — synced from Supabase)
// ============================================================================
float thresholdOverVoltage  = 250.0f;
float thresholdUnderVoltage = 180.0f;
float thresholdPowerLimit   = 2000.0f;
float tariffCostPerKWh      = 6.0f;

// ============================================================================
// 5. OBJECTS & STATE
// ============================================================================
HardwareSerial PzemSerial(2);
PZEM004Tv30 pzem(PzemSerial, PIN_PZEM_RX, PIN_PZEM_TX);
LiquidCrystal_I2C lcd(0x27, 16, 2);

bool lcdDetected        = false;
bool relayIsOn          = false;
bool manualOverride     = false;
bool pzemValid          = false;
bool dnsResolved        = false;
bool supabaseHealthy    = false;
int  lastSupabaseHttpCode = 0;
String activeFaultName  = "normal";

// Live Sensor Readings
float liveVoltage = 0.0f, liveCurrent = 0.0f, livePower = 0.0f;
float liveEnergy = 0.0f, liveFrequency = 0.0f, livePowerFactor = 0.0f;
float liveCost = 0.0f;

int pzemFailCount = 0;

// Protection State Machine
enum ProtState { STATE_BOOT, STATE_NORMAL, STATE_TRIP, STATE_FAULT, STATE_RECOVERY };
ProtState protectionState = STATE_BOOT;
unsigned long recoveryTimerStart = 0;

const char* stName(ProtState s) {
  switch (s) {
    case STATE_BOOT:     return "BOOT";
    case STATE_NORMAL:   return "NORMAL";
    case STATE_TRIP:     return "TRIP";
    case STATE_FAULT:    return "FAULT";
    case STATE_RECOVERY: return "RECOVERY";
    default:             return "?";
  }
}

// Buzzer State
int buzzerBeepsLeft = 0;
unsigned long lastBuzzerToggle = 0;
bool buzzerPinHigh = false;

// Non-Blocking Timers
unsigned long lastSensorRead      = 0;
unsigned long lastDisplayUpdate   = 0;
unsigned long lastTelemetryUpload = 0;
unsigned long lastSettingsSync    = 0;
unsigned long lastPzemDiagPrint   = 0;
unsigned long lastDnsCheck        = 0;
unsigned long lastNtpCheck        = 0;
unsigned long lastDiagLog         = 0;
int lcdPage = 0;

// ============================================================================
// 6. RELAY / CIRCUIT CONTROL
// ============================================================================
void setRelayState(bool turnOn) {
  relayIsOn = turnOn;
  digitalWrite(PIN_RELAY_1, turnOn ? RELAY_ON : RELAY_OFF);
}

// ============================================================================
// 7. BUZZER (Non-Blocking)
// ============================================================================
void triggerBuzzer(int beeps) {
  buzzerBeepsLeft = beeps * 2;
  lastBuzzerToggle = millis();
  buzzerPinHigh = true;
  digitalWrite(PIN_BUZZER, HIGH);
}

void updateBuzzer() {
  if (buzzerBeepsLeft <= 0) {
    if (buzzerPinHigh) { buzzerPinHigh = false; digitalWrite(PIN_BUZZER, LOW); }
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
// 8. NTP & TIME SYNCHRONIZATION (IST UTC+5:30 & Validated UTC Timestamps)
// ============================================================================
// India Standard Time (IST) is UTC+05:30.
// Offset in seconds: 5.5 hours * 3600 = 19800 seconds. No daylight saving time.
const long  GMT_OFFSET_SEC      = 19800;
const int   DAYLIGHT_OFFSET_SEC = 0;
const char* NTP_SERVER_1        = "pool.ntp.org";
const char* NTP_SERVER_2        = "time.google.com";
const char* NTP_SERVER_3        = "time.nist.gov";

bool timeSynced = false;
unsigned long lastNtpRetry = 0;

// Validates whether the RTC clock has reached a plausible modern epoch (after 2024-01-01)
bool isClockSynchronized() {
  time_t now = time(nullptr);
  // 1704067200 is 2024-01-01 00:00:00 UTC. Reject 1970 epoch or uninitialized clocks.
  return (now > 1704067200L && now < 2147483647L);
}

// Generates ISO-8601 UTC timestamp string: YYYY-MM-DDTHH:MM:SSZ
// Returns empty string if clock is not yet synchronized
String getISOTimestampUTC() {
  if (!isClockSynchronized()) {
    return "";
  }
  time_t now = time(nullptr);
  struct tm* t = gmtime(&now);
  if (!t) return "";
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", t);
  return String(buf);
}

// Generates local Indian Standard Time string: YYYY-MM-DD HH:MM:SS IST
String getLocalTimestampIST() {
  if (!isClockSynchronized()) {
    return "NOT_SYNCED";
  }
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 50)) {
    return "NOT_SYNCED";
  }
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S IST", &timeinfo);
  return String(buf);
}

void initNTP() {
  Serial.println("[TIME] Configuring NTP servers: pool.ntp.org, time.google.com, time.nist.gov");
  Serial.printf("[TIME] Local Timezone: IST (UTC+05:30, GMT offset=%ld sec, DST=%d)\n",
                GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC);

  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2, NTP_SERVER_3);

  // Non-blocking brief wait (max 1.5s) during boot
  Serial.println("[TIME] Waiting for NTP synchronization...");
  int attempts = 0;
  while (!isClockSynchronized() && attempts < 15) {
    delay(100);
    attempts++;
  }

  if (isClockSynchronized()) {
    timeSynced = true;
    Serial.println("[TIME] Synchronization successful");
    Serial.printf("[TIME] UTC: %s\n", getISOTimestampUTC().c_str());
    Serial.printf("[TIME] IST: %s\n", getLocalTimestampIST().c_str());
  } else {
    timeSynced = false;
    Serial.println("[TIME] Waiting for background NTP synchronization... (Protection loop active)");
  }
}

// Background non-blocking time monitor
void maintainTimeSync() {
  unsigned long nowMs = millis();

  if (!timeSynced) {
    if (isClockSynchronized()) {
      timeSynced = true;
      Serial.println("[TIME] Synchronization successful");
      Serial.printf("[TIME] UTC: %s\n", getISOTimestampUTC().c_str());
      Serial.printf("[TIME] IST: %s\n", getLocalTimestampIST().c_str());
    } else {
      // Re-trigger NTP config every 15 seconds if Wi-Fi is connected and sync pending
      if (WiFi.status() == WL_CONNECTED && (nowMs - lastNtpRetry >= 15000)) {
        lastNtpRetry = nowMs;
        Serial.println("[TIME] Waiting for NTP synchronization (retrying query)...");
        configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2, NTP_SERVER_3);
      }
    }
  }
}

// ============================================================================
// 9. DNS & WI-FI CONFIGURATION
// ============================================================================
bool resolveSupabaseDNS() {
  if (WiFi.status() != WL_CONNECTED) {
    dnsResolved = false;
    return false;
  }

  IPAddress resolved;
  bool ok = WiFi.hostByName(SUPABASE_HOST, resolved);

  if (ok && resolved != IPAddress(0, 0, 0, 0) && resolved != IPAddress(255, 255, 255, 255)) {
    if (!dnsResolved) {
      Serial.printf("[DNS] Resolved %s -> %s\n", SUPABASE_HOST, resolved.toString().c_str());
    }
    dnsResolved = true;
    return true;
  }

  // Fallback to public DNS if router DNS failed
  Serial.printf("[DNS] Router DNS returned invalid IP (%s). Re-applying Google DNS 8.8.8.8...\n",
                resolved.toString().c_str());
  WiFi.setDNS(PUBLIC_DNS_1, PUBLIC_DNS_2);
  delay(200);

  ok = WiFi.hostByName(SUPABASE_HOST, resolved);
  if (ok && resolved != IPAddress(0, 0, 0, 0) && resolved != IPAddress(255, 255, 255, 255)) {
    Serial.printf("[DNS] Resolved via Public DNS %s -> %s\n", SUPABASE_HOST, resolved.toString().c_str());
    dnsResolved = true;
    return true;
  }

  Serial.printf("[DNS] FAILED to resolve %s. Supabase endpoints paused.\n", SUPABASE_HOST);
  dnsResolved = false;
  return false;
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("\n[WIFI] Connecting to %s...", WIFI_SSID);
  WiFi.mode(WIFI_STA);

  WiFi.setDNS(PUBLIC_DNS_1, PUBLIC_DNS_2);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 25) {
    delay(400);
    Serial.print(".");
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    WiFi.setDNS(PUBLIC_DNS_1, PUBLIC_DNS_2);
    digitalWrite(PIN_STATUS_LED, HIGH);
    Serial.printf("\n[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WIFI] DNS 1: %s, DNS 2: %s, Gateway: %s\n",
                  WiFi.dnsIP(0).toString().c_str(),
                  WiFi.dnsIP(1).toString().c_str(),
                  WiFi.gatewayIP().toString().c_str());

    resolveSupabaseDNS();
    initNTP();
  } else {
    digitalWrite(PIN_STATUS_LED, LOW);
    Serial.println("\n[WIFI] Connection failed. Operating in offline protection mode.");
  }
}

// ============================================================================
// 10. PZEM DIAGNOSTIC TEST (Triggered via DIAG command)
// ============================================================================
void testPZEM() {
  Serial.println("\n---------- PZEM-004T DIAGNOSTIC TEST ----------");
  Serial.printf("UART Config : Serial2 @ 9600 baud, 8N1\n");
  Serial.printf("ESP32 RX Pin: GPIO %d  (connects to PZEM TX wire)\n", PIN_PZEM_RX);
  Serial.printf("ESP32 TX Pin: GPIO %d  (connects to PZEM RX wire)\n", PIN_PZEM_TX);
  Serial.printf("Serial2 RX bytes available in buffer: %d\n", PzemSerial.available());

  Serial.println("Reading PZEM registers...");
  float v = pzem.voltage();
  float i = pzem.current();
  float p = pzem.power();
  float f = pzem.frequency();
  float pf = pzem.pf();

  Serial.printf("  Voltage  : ");
  if (isnan(v)) Serial.println("NaN [NO SIGNAL]"); else Serial.printf("%.1f V [OK]\n", v);
  Serial.printf("  Current  : ");
  if (isnan(i)) Serial.println("NaN"); else Serial.printf("%.3f A\n", i);
  Serial.printf("  Power    : ");
  if (isnan(p)) Serial.println("NaN"); else Serial.printf("%.1f W\n", p);
  Serial.printf("  Frequency: ");
  if (isnan(f)) Serial.println("NaN"); else Serial.printf("%.1f Hz\n", f);
  Serial.printf("  PF       : ");
  if (isnan(pf)) Serial.println("NaN"); else Serial.printf("%.2f\n", pf);
  Serial.println("-----------------------------------------------\n");
}

// ============================================================================
// 11. LCD DISPLAY
// ============================================================================
void initLCD() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.beginTransmission(0x27);
  if (Wire.endTransmission() == 0) {
    lcd = LiquidCrystal_I2C(0x27, 16, 2);
    lcd.init(); lcd.backlight(); lcdDetected = true;
    Serial.println("[LCD] Detected at I2C address 0x27");
    return;
  }
  Wire.beginTransmission(0x3F);
  if (Wire.endTransmission() == 0) {
    lcd = LiquidCrystal_I2C(0x3F, 16, 2);
    lcd.init(); lcd.backlight(); lcdDetected = true;
    Serial.println("[LCD] Detected at I2C address 0x3F");
    return;
  }
  Serial.println("[LCD] WARNING: Not detected at 0x27 or 0x3F.");
}

void updateLCD() {
  if (!lcdDetected) return;
  lcd.clear();

  if (activeFaultName != "normal") {
    lcd.setCursor(0, 0);
    if (activeFaultName == "over_voltage")       lcd.print("! OVER VOLTAGE !");
    else if (activeFaultName == "under_voltage") lcd.print("! UNDER VOLTAGE!");
    else if (activeFaultName == "over_power")    lcd.print("! OVER POWER !  ");
    else if (activeFaultName == "sensor_failure")lcd.print("! PZEM OFFLINE !");
    else                                         lcd.print("! TRIP ALARM !  ");
    lcd.setCursor(0, 1);
    char l2[17];
    if (pzemValid) snprintf(l2, sizeof(l2), "RLY:OFF %5.1fV", liveVoltage);
    else           snprintf(l2, sizeof(l2), "RLY:OFF NO-PZEM");
    lcd.print(l2);
    return;
  }

  if (protectionState == STATE_BOOT) {
    lcd.setCursor(0, 0); lcd.print("Waiting for PZEM");
    lcd.setCursor(0, 1); lcd.print("Connect 230V AC ");
    return;
  }

  if (lcdPage == 0) {
    char l1[17], l2[17];
    snprintf(l1, sizeof(l1), "%5.1fV  %5.0fW", liveVoltage, livePower);
    snprintf(l2, sizeof(l2), "%5.2fA  R:%s", liveCurrent, relayIsOn ? "ON " : "OFF");
    lcd.setCursor(0, 0); lcd.print(l1);
    lcd.setCursor(0, 1); lcd.print(l2);
  } else {
    char l1[17], l2[17];
    snprintf(l1, sizeof(l1), "E:%5.2fk  %4.1fHz", liveEnergy, liveFrequency);
    const char* netTag = (WiFi.status() == WL_CONNECTED && timeSynced) ? "SYNC" : 
                         (WiFi.status() == WL_CONNECTED ? "WIFI" : "OFFL");
    snprintf(l2, sizeof(l2), "PF:%4.2f [%s]", livePowerFactor, netTag);
    lcd.setCursor(0, 0); lcd.print(l1);
    lcd.setCursor(0, 1); lcd.print(l2);
  }
}

// ============================================================================
// 12. SUPABASE REST API (Validated UTC Timestamps Only)
// ============================================================================
void sendReadingToCloud(const String& isoTimeUtc) {
  if (WiFi.status() != WL_CONNECTED || !dnsResolved) return;

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(8000);

  HTTPClient http;
  http.setTimeout(8000);
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/energy_readings");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Prefer", "return=minimal");

  JsonDocument doc;
  doc["device_id"]         = DEVICE_ID;
  doc["timestamp"]         = isoTimeUtc;
  doc["voltage"]           = serialized(String(liveVoltage, 1));
  doc["current_amps"]      = serialized(String(liveCurrent, 3));
  doc["power"]             = serialized(String(livePower, 1));
  doc["energy_kwh"]        = serialized(String(liveEnergy, 4));
  doc["frequency"]         = serialized(String(liveFrequency, 1));
  doc["power_factor"]      = serialized(String(livePowerFactor, 2));
  doc["cost"]              = serialized(String(liveCost, 2));
  doc["protection_status"] = activeFaultName;

  String body; serializeJson(doc, body);
  int code = http.POST(body);
  lastSupabaseHttpCode = code;

  if (code == 201 || code == 200) {
    supabaseHealthy = true;
  } else if (code > 0) {
    supabaseHealthy = false;
    Serial.printf("[CLOUD] Telemetry HTTP %d: %s\n", code, http.getString().c_str());
  } else {
    supabaseHealthy = false;
    Serial.printf("[CLOUD] Telemetry failed: code %d (%s)\n", code, http.errorToString(code).c_str());
  }
  http.end();
}

void sendHeartbeatToCloud(const String& isoTimeUtc) {
  if (WiFi.status() != WL_CONNECTED || !dnsResolved) return;

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(8000);

  HTTPClient http;
  http.setTimeout(8000);
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/device_status");
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
  doc["relay1_status"]   = relayIsOn;
  doc["relay2_status"]   = false;
  doc["last_seen"]       = isoTimeUtc;

  String body; serializeJson(doc, body);
  int code = http.POST(body);
  lastSupabaseHttpCode = code;

  if (code == 200 || code == 201) {
    supabaseHealthy = true;
  } else if (code > 0) {
    supabaseHealthy = false;
    Serial.printf("[CLOUD] Heartbeat HTTP %d: %s\n", code, http.getString().c_str());
  } else {
    supabaseHealthy = false;
    Serial.printf("[CLOUD] Heartbeat failed: code %d (%s)\n", code, http.errorToString(code).c_str());
  }
  http.end();
}

void sendAlertToCloud(const String& aType, float val, const String& msg) {
  if (WiFi.status() != WL_CONNECTED || !dnsResolved) return;

  if (!isClockSynchronized()) {
    Serial.printf("[ALERT] %s occurred, but NTP unavailable; timestamped alert upload deferred.\n", aType.c_str());
    return;
  }

  String isoTimeUtc = getISOTimestampUTC();

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(8000);

  HTTPClient http;
  http.setTimeout(8000);
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/alerts");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Prefer", "return=minimal");

  JsonDocument doc;
  doc["device_id"]    = DEVICE_ID;
  doc["timestamp"]    = isoTimeUtc;
  doc["alert_type"]   = aType;
  doc["value"]        = serialized(String(val, 2));
  doc["message"]      = msg;
  doc["relay_status"] = relayIsOn ? "on" : "off";
  doc["acknowledged"] = false;

  String body; serializeJson(doc, body);
  int code = http.POST(body);
  lastSupabaseHttpCode = code;

  if (code == 200 || code == 201) {
    supabaseHealthy = true;
    Serial.printf("[CLOUD] Alert '%s' delivered (HTTP %d)\n", aType.c_str(), code);
  } else if (code > 0) {
    supabaseHealthy = false;
    Serial.printf("[CLOUD] Alert HTTP %d: %s\n", code, http.getString().c_str());
  } else {
    supabaseHealthy = false;
    Serial.printf("[CLOUD] Alert failed: code %d (%s)\n", code, http.errorToString(code).c_str());
  }
  http.end();
}

void fetchRemoteSettings() {
  if (WiFi.status() != WL_CONNECTED || !dnsResolved) {
    Serial.printf("[SETTINGS] Skipped (WiFi:%s, DNS:%s). Using local: OVP=%.1fV UVP=%.1fV\n",
                  WiFi.status() == WL_CONNECTED ? "OK" : "OFF",
                  dnsResolved ? "OK" : "FAIL",
                  thresholdOverVoltage, thresholdUnderVoltage);
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(8000);

  HTTPClient http;
  http.setTimeout(8000);
  String url = String(SUPABASE_URL) + "/rest/v1/meter_settings?device_id=eq." + DEVICE_ID + "&select=*";
  http.begin(client, url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);

  int code = http.GET();
  lastSupabaseHttpCode = code;

  if (code == 200) {
    supabaseHealthy = true;
    String payload = http.getString();
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (!err && doc.is<JsonArray>() && doc.as<JsonArray>().size() > 0) {
      JsonObject o = doc[0];
      float r_ov  = o["over_voltage"]  | thresholdOverVoltage;
      float r_uv  = o["under_voltage"] | thresholdUnderVoltage;
      float r_pl  = o["power_limit"]   | thresholdPowerLimit;
      float r_cpk = o["cost_per_kwh"]  | tariffCostPerKWh;

      if (r_ov >= 180.0f && r_ov <= 320.0f && r_ov > r_uv)                  thresholdOverVoltage  = r_ov;
      if (r_uv >= 100.0f && r_uv <= 240.0f && r_uv < thresholdOverVoltage) thresholdUnderVoltage = r_uv;
      if (r_pl >= 100.0f && r_pl <= 15000.0f)                               thresholdPowerLimit   = r_pl;
      if (r_cpk >= 0.0f  && r_cpk <= 100.0f)                                 tariffCostPerKWh      = r_cpk;

      Serial.printf("[SETTINGS] Synced from Supabase: OVP=%.1fV, UVP=%.1fV, PWR=%.1fW, Tariff=Rs.%.2f\n",
                    thresholdOverVoltage, thresholdUnderVoltage, thresholdPowerLimit, tariffCostPerKWh);
    } else if (doc.is<JsonArray>() && doc.as<JsonArray>().size() == 0) {
      Serial.println("[SETTINGS] No settings row found for this device_id in Supabase. Using local defaults.");
    }
  } else if (code > 0) {
    supabaseHealthy = false;
    Serial.printf("[SETTINGS] HTTP %d — Response: %s\n", code, http.getString().c_str());
  } else {
    supabaseHealthy = false;
    Serial.printf("[SETTINGS] Failed: code %d (%s)\n", code, http.errorToString(code).c_str());
  }
  http.end();
}

// ============================================================================
// 13. STATUS / DIAGNOSTIC COMMAND
// ============================================================================
void printSystemStatus() {
  Serial.println("\n========== SMART ENERGY METER — FULL DIAGNOSTIC ==========");
  Serial.printf("Firmware Version    : v2.3-ntp-clock-fix\n");
  Serial.printf("Uptime              : %lu seconds\n", millis() / 1000);
  Serial.println("-------------------- Time & Clock -------------------------");
  Serial.printf("NTP Synchronized    : %s\n", timeSynced ? "YES" : "NO (Awaiting sync)");
  if (timeSynced) {
    Serial.printf("UTC Time (Cloud)    : %s\n", getISOTimestampUTC().c_str());
    Serial.printf("Local Time (India)  : %s\n", getLocalTimestampIST().c_str());
  } else {
    Serial.println("Clock Status        : [UNSYNCHRONIZED] Timestamps held; no 1970 records uploaded");
  }
  Serial.println("-------------------- Relay & Contactor Status -------------");
  Serial.printf("Commanded State     : %s\n", relayIsOn ? "CLOSED (ON)" : "OPEN (OFF)");
  Serial.printf("GPIO Pin            : GPIO%d = %s (%s)\n",
                PIN_RELAY_1,
                digitalRead(PIN_RELAY_1) == HIGH ? "HIGH" : "LOW",
                digitalRead(PIN_RELAY_1) == HIGH ? "Active-LOW Coil De-energized" : "Active-LOW Coil Energized");
  Serial.printf("Manual Override     : %s\n", manualOverride ? "YES" : "NO (AUTO)");
  Serial.printf("Protection State    : %s\n", stName(protectionState));
  Serial.printf("Active Fault        : %s\n", activeFaultName.c_str());
  if (!relayIsOn) {
    if (pzemValid && liveCurrent > 0.05f) {
      Serial.printf("Contact CT Feedback : [CRITICAL FAIL] %.3f A flowing while commanded OFF!\n", liveCurrent);
      Serial.println("                      -> Check if wire is connected to NC instead of NO, or contacts are welded.");
    } else {
      Serial.printf("Contact CT Feedback : [VERIFIED ISOLATED] %.3f A (Zero current confirmed)\n", liveCurrent);
    }
  } else {
    Serial.printf("Contact CT Feedback : [ENERGIZED] Load current: %.3f A\n", liveCurrent);
  }
  Serial.println("-------------------- PZEM-004T Sensor --------------------");
  Serial.printf("PZEM Valid          : %s\n", pzemValid ? "YES" : "NO");
  Serial.printf("Consecutive Fails   : %d\n", pzemFailCount);
  Serial.printf("UART Config         : Serial2 @ 9600 baud, RX=GPIO%d TX=GPIO%d\n", PIN_PZEM_RX, PIN_PZEM_TX);
  if (pzemValid) {
    Serial.printf("Voltage             : %.1f V\n", liveVoltage);
    Serial.printf("Current             : %.3f A\n", liveCurrent);
    Serial.printf("Power               : %.1f W\n", livePower);
    Serial.printf("Frequency           : %.1f Hz\n", liveFrequency);
    Serial.printf("Power Factor        : %.2f\n", livePowerFactor);
    Serial.printf("Energy              : %.4f kWh\n", liveEnergy);
    Serial.printf("Cost                : Rs. %.2f\n", liveCost);
  } else {
    Serial.println("Readings            : ALL NaN (PZEM not returning Modbus response)");
  }
  Serial.println("-------------------- Thresholds ---------------------------");
  Serial.printf("Over-Voltage Limit  : %.1f V  %s\n", thresholdOverVoltage,
                (pzemValid && liveVoltage > thresholdOverVoltage) ? "<< TRIPPED!" : "");
  Serial.printf("Under-Voltage Limit : %.1f V  %s\n", thresholdUnderVoltage,
                (pzemValid && liveVoltage > 10.0f && liveVoltage < thresholdUnderVoltage) ? "<< TRIPPED!" : "");
  Serial.printf("Power Limit         : %.1f W  %s\n", thresholdPowerLimit,
                (pzemValid && livePower > thresholdPowerLimit) ? "<< TRIPPED!" : "");
  Serial.printf("Tariff              : Rs. %.2f / kWh\n", tariffCostPerKWh);
  Serial.println("-------------------- Network & Cloud ----------------------");
  Serial.printf("Wi-Fi Status        : %s\n", WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("ESP32 IP Address    : %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("DNS 1 (Configured)  : %s\n", WiFi.dnsIP(0).toString().c_str());
    Serial.printf("DNS 2 (Configured)  : %s\n", WiFi.dnsIP(1).toString().c_str());
  }
  Serial.printf("Supabase DNS Resolved: %s\n", dnsResolved ? "YES (Valid Public IP)" : "NO (Failed to resolve)");
  Serial.printf("Supabase HTTP Status: %s (Last Code: %d)\n",
                supabaseHealthy ? "HEALTHY (200/201 OK)" : "UNHEALTHY / FAILING", lastSupabaseHttpCode);
  Serial.printf("LCD Display         : %s\n", lcdDetected ? "Detected" : "Not Found");
  Serial.println("===========================================================");
  Serial.println("Commands: ON | OFF | AUTO | STATUS | DIAG\n");
}

// ============================================================================
// 14. SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n==================================================");
  Serial.println("   SMART ENERGY METER  v2.4  (Relay Protection Fix)");
  Serial.println("   Relay ON = Circuit ON | Relay OFF = Circuit OFF");
  Serial.println("==================================================");

  // Pre-load output latch to RELAY_OFF (HIGH) BEFORE configuring as OUTPUT
  // This guarantees active-LOW relay never glitches/energizes during power-up!
  digitalWrite(PIN_RELAY_1, RELAY_OFF);
  pinMode(PIN_RELAY_1, OUTPUT);
  relayIsOn = false;

  digitalWrite(PIN_BUZZER, LOW);
  pinMode(PIN_BUZZER, OUTPUT);

  digitalWrite(PIN_STATUS_LED, LOW);
  pinMode(PIN_STATUS_LED, OUTPUT);
  Serial.printf("[BOOT] Relay GPIO%d pre-latched HIGH (Active-LOW OFF). Circuit safely isolated.\n", PIN_RELAY_1);

  PzemSerial.begin(9600, SERIAL_8N1, PIN_PZEM_RX, PIN_PZEM_TX);
  Serial.printf("[PZEM] Serial2 initialized: 9600 baud, RX=GPIO%d, TX=GPIO%d\n", PIN_PZEM_RX, PIN_PZEM_TX);

  initLCD();
  connectWiFi();

  // Settings sync
  fetchRemoteSettings();

  Serial.println("[SYSTEM] Init complete. Entering main loop...");
  Serial.println("[SYSTEM] Commands: ON | OFF | AUTO | STATUS | DIAG\n");
}

// ============================================================================
// 15. MAIN LOOP
// ============================================================================
void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  updateBuzzer();
  maintainTimeSync();

  unsigned long now = millis();

  // -- SERIAL COMMANDS --
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim(); cmd.toUpperCase();

    if (cmd == "ON") {
      if (!pzemValid) {
        Serial.println("[MANUAL] BLOCKED: PZEM sensor offline (V=NaN). Cannot verify mains safety.");
        Serial.println("         -> Connect 230V AC to PZEM screw terminals L/N. Type DIAG to test.");
      } else if (activeFaultName != "normal") {
        Serial.printf("[MANUAL] BLOCKED: Active fault [%s]\n", activeFaultName.c_str());
        if (activeFaultName == "over_voltage")
          Serial.printf("         Measured %.1fV > Limit %.1fV. Relay stays OFF for safety.\n", liveVoltage, thresholdOverVoltage);
        else if (activeFaultName == "under_voltage")
          Serial.printf("         Measured %.1fV < Limit %.1fV\n", liveVoltage, thresholdUnderVoltage);
        else if (activeFaultName == "over_power")
          Serial.printf("         Measured %.1fW > Limit %.1fW\n", livePower, thresholdPowerLimit);
      } else if (protectionState == STATE_RECOVERY) {
        Serial.println("[MANUAL] BLOCKED: 5-second recovery hold in progress. Wait for RECOVERED message.");
      } else {
        manualOverride = true;
        setRelayState(true);
        Serial.printf("[MANUAL] Relay ON. Circuit LIVE at %.1fV. Type 'AUTO' to resume protection.\n", liveVoltage);
      }
    } else if (cmd == "OFF") {
      manualOverride = true;
      setRelayState(false);
      Serial.println("[MANUAL] Relay OFF. Circuit DISCONNECTED. Type 'AUTO' to resume.");
    } else if (cmd == "AUTO") {
      manualOverride = false;
      Serial.println("[AUTO] Automatic protection mode resumed.");
      if (protectionState == STATE_NORMAL && activeFaultName == "normal" && pzemValid) {
        setRelayState(true);
        Serial.println("[AUTO] Conditions safe. Relay ON / Circuit LIVE.");
      } else {
        setRelayState(false);
        Serial.printf("[AUTO] Not safe (State:%s, Fault:%s, PZEM:%s). Relay OFF.\n",
                      stName(protectionState), activeFaultName.c_str(), pzemValid ? "OK" : "OFFLINE");
      }
    } else if (cmd == "STATUS") {
      printSystemStatus();
    } else if (cmd == "DIAG") {
      testPZEM();
      resolveSupabaseDNS();
      Serial.println("\n---------- TIME DIAGNOSTIC ----------");
      Serial.printf("Epoch Valid  : %s\n", isClockSynchronized() ? "YES" : "NO");
      Serial.printf("Time Synced  : %s\n", timeSynced ? "YES" : "NO");
      Serial.printf("UTC Time     : %s\n", getISOTimestampUTC().c_str());
      Serial.printf("Local (IST)  : %s\n", getLocalTimestampIST().c_str());
      Serial.println("-------------------------------------\n");
    }
  }

  // -- TASK 1: Read PZEM & Protection (every 800ms) --
  if (now - lastSensorRead >= 800) {
    lastSensorRead = now;

    float v  = pzem.voltage();
    float i  = pzem.current();
    float p  = pzem.power();
    float e  = pzem.energy();
    float f  = pzem.frequency();
    float pf = pzem.pf();

    if (!isnan(v) && v > 0.0f) {
      liveVoltage     = v;
      liveCurrent     = isnan(i)  ? 0.0f  : i;
      livePower       = isnan(p)  ? 0.0f  : p;
      liveEnergy      = isnan(e)  ? 0.0f  : e;
      liveFrequency   = isnan(f)  ? 50.0f : f;
      livePowerFactor = isnan(pf) ? 1.0f  : pf;
      liveCost        = liveEnergy * tariffCostPerKWh;
      pzemValid = true;
      pzemFailCount = 0;
    } else {
      pzemValid = false;
      pzemFailCount++;
    }

    // Fault detection
    String detectedFault = "normal";
    float  faultVal = 0.0f;
    String faultMsg = "";

    if (!pzemValid) {
      detectedFault = "sensor_failure";
      faultMsg = "PZEM-004T communication failure (NaN response).";
    } else if (liveVoltage > thresholdOverVoltage) {
      detectedFault = "over_voltage";
      faultVal = liveVoltage;
      faultMsg = "Over-voltage: " + String(liveVoltage, 1) + "V (Limit: " + String(thresholdOverVoltage, 1) + "V)";
    } else if (liveVoltage > 10.0f && liveVoltage < thresholdUnderVoltage) {
      detectedFault = "under_voltage";
      faultVal = liveVoltage;
      faultMsg = "Under-voltage: " + String(liveVoltage, 1) + "V (Limit: " + String(thresholdUnderVoltage, 1) + "V)";
    } else if (livePower > thresholdPowerLimit) {
      detectedFault = "over_power";
      faultVal = livePower;
      faultMsg = "Over-power: " + String(livePower, 1) + "W (Limit: " + String(thresholdPowerLimit, 1) + "W)";
    }

    // Protection State Machine
    switch (protectionState) {

      case STATE_BOOT:
        if (pzemValid && detectedFault == "normal") {
          protectionState = STATE_NORMAL;
          activeFaultName = "normal";
          if (!manualOverride) setRelayState(true);
          Serial.printf("[BOOT -> NORMAL] First safe reading V=%.1fV. Relay ON.\n", liveVoltage);
        } else if (pzemValid && detectedFault != "normal") {
          activeFaultName = detectedFault;
          protectionState = STATE_FAULT;
          triggerBuzzer(3);
          sendAlertToCloud(detectedFault, faultVal, faultMsg);
          Serial.printf("[BOOT -> FAULT] %s (%.1f). Relay remains OFF.\n", detectedFault.c_str(), faultVal);
        } else if (!pzemValid) {
          activeFaultName = "sensor_failure";
          if (now - lastPzemDiagPrint >= 4000) {
            lastPzemDiagPrint = now;
            Serial.printf("[PZEM] Offline (fail #%d). Waiting for valid AC reading... Type DIAG to test.\n", pzemFailCount);
          }
        }
        break;

      case STATE_NORMAL:
        if (detectedFault != "normal") {
          manualOverride = false;
          setRelayState(false);
          triggerBuzzer(3);
          protectionState = STATE_TRIP;
          activeFaultName = detectedFault;
          sendAlertToCloud(detectedFault, faultVal, faultMsg);
          Serial.printf("[TRIP] %s! (%.1f) -> Setting GPIO%d HIGH (Relay OFF). Checking contactor CT feedback...\n",
                        detectedFault.c_str(), faultVal, PIN_RELAY_1);
        } else {
          if (!relayIsOn && !manualOverride) setRelayState(true);
        }
        break;

      case STATE_TRIP:
        protectionState = STATE_FAULT;
        break;

      case STATE_FAULT:
        if (!manualOverride) setRelayState(false);
        if (detectedFault == "normal") {
          protectionState = STATE_RECOVERY;
          recoveryTimerStart = millis();
          Serial.printf("[RECOVERY] Safe reading V=%.1fV. 5-second hold started...\n", liveVoltage);
        }
        break;

      case STATE_RECOVERY:
        if (!manualOverride) setRelayState(false);
        if (detectedFault != "normal") {
          protectionState = STATE_FAULT;
          activeFaultName = detectedFault;
          Serial.printf("[RECOVERY ABORTED] Re-fault: %s (%.1f)\n", detectedFault.c_str(), faultVal);
        } else if (millis() - recoveryTimerStart >= 5000) {
          protectionState = STATE_NORMAL;
          activeFaultName = "normal";
          if (!manualOverride) setRelayState(true);
          Serial.printf("[RECOVERED] V=%.1fV stable for 5s. Relay ON.\n", liveVoltage);
          sendAlertToCloud("recovery", liveVoltage, "Mains voltage recovered to nominal range. Relay contactor re-engaged.");
        }
        break;
    }
  }

  // -- TASK 1b: Continuous Hardware & Contactor Diagnostic (every 3s) --
  if (now - lastDiagLog >= 3000) {
    lastDiagLog = now;
    bool ctCurrentFlowing = (pzemValid && liveCurrent > 0.05f);
    bool contactorFault   = (!relayIsOn && ctCurrentFlowing);
    int  pinLevel         = digitalRead(PIN_RELAY_1);

    Serial.printf("[DIAG] V=%5.1fV | I=%5.3fA | P=%6.1fW | Fault: %-14s | State: %-8s | RelayCmd: %-3s | GPIO%d: %s(%s) | CT: %s\n",
                  liveVoltage, liveCurrent, livePower,
                  activeFaultName.c_str(),
                  stName(protectionState),
                  relayIsOn ? "ON" : "OFF",
                  PIN_RELAY_1,
                  pinLevel == HIGH ? "HIGH" : "LOW",
                  pinLevel == HIGH ? "COIL_OFF" : "COIL_ON",
                  contactorFault   ? "!FAIL:CURRENT FLOWING!" :
                  (relayIsOn       ? (ctCurrentFlowing ? "LOAD_ACTIVE" : "STANDBY/ZERO") :
                                     "VERIFIED_ISOLATED")
    );

    if (contactorFault) {
      Serial.printf(">>> [CRITICAL] Contactor commanded OFF but CT measures %.3f A! Check NC vs NO terminal wiring!\n", liveCurrent);
      if (buzzerBeepsLeft <= 0) triggerBuzzer(1);
    }
  }

  // -- TASK 2: LCD (every 500ms) --
  if (now - lastDisplayUpdate >= 500) {
    lastDisplayUpdate = now;
    if ((now / 3000) % 2 != (unsigned long)lcdPage) lcdPage = (now / 3000) % 2;
    updateLCD();
  }

  // -- TASK 3: Telemetry & Diagnostics (every 5s) --
  if (now - lastTelemetryUpload >= 5000) {
    lastTelemetryUpload = now;

    if (!isClockSynchronized()) {
      Serial.printf("[TIME] NTP unavailable; timestamped upload deferred (Protection active, V=%.1fV)\n", liveVoltage);
    } else {
      String isoTimeUtc = getISOTimestampUTC();

      if (pzemValid) {
        sendReadingToCloud(isoTimeUtc);
        bool contactorFault = (!relayIsOn && liveCurrent > 0.05f);
        Serial.printf("[DATA] %s | V=%.1f I=%.3f P=%.1f | Rly:%s(GPIO%d:%s) | CT:%s | Fault:%s St:%s | Supa:%s\n",
                      isoTimeUtc.c_str(), liveVoltage, liveCurrent, livePower,
                      relayIsOn ? "ON" : "OFF",
                      PIN_RELAY_1,
                      digitalRead(PIN_RELAY_1) == HIGH ? "HIGH" : "LOW",
                      contactorFault ? "FAIL_CURRENT_DETECTED" : (relayIsOn ? "CONDUCTING" : "ISOLATED"),
                      activeFaultName.c_str(), stName(protectionState),
                      supabaseHealthy ? "OK" : (dnsResolved ? "HTTP_ERR" : "DNS_FAIL"));
      } else {
        Serial.printf("[DIAG] %s | PZEM:OFFLINE(fails:%d) | Rly:%s Fault:%s St:%s | OVP=%.0fV | Supa:%s\n",
                      isoTimeUtc.c_str(), pzemFailCount,
                      relayIsOn ? "ON" : "OFF", activeFaultName.c_str(), stName(protectionState),
                      thresholdOverVoltage,
                      supabaseHealthy ? "OK" : (dnsResolved ? "HTTP_ERR" : "DNS_FAIL"));
      }
      sendHeartbeatToCloud(isoTimeUtc);
    }
  }

  // -- TASK 4: Settings Sync (every 30s) --
  if (now - lastSettingsSync >= 30000) {
    lastSettingsSync = now;
    fetchRemoteSettings();
  }

  // -- TASK 5: Periodic DNS re-check (every 60s) --
  if (now - lastDnsCheck >= 60000) {
    lastDnsCheck = now;
    resolveSupabaseDNS();
  }

  delay(10);
}
