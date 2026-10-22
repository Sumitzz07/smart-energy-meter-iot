// ============================================================================
// Smart Energy Meter — Main ESP32 Physical Hardware Controller
// ============================================================================
// Features:
//   - Real PZEM-004T V3 Modbus UART telemetry (V, I, P, E, F, PF)
//   - Active-LOW Relay 1 main load protection
//   - Fault Protection State Machine (Over/Under Voltage, Over-Power, Sensor Fault)
//   - 16x2 I2C LCD local telemetry & fault alert screens
//   - Audible buzzer fault beeper
//   - Dynamic remote settings sync from Supabase meter_settings
//   - Direct cloud REST ingestion to Supabase (Anon Key)
//   - Full multi-device support (esp32-meter-001, etc.)
// ============================================================================

#include <Arduino.h>
#include "config.h"
#include "protection.h"
#include "pzem_manager.h"
#include "wifi_manager.h"
#include "supabase_client.h"
#include "display_manager.h"
#include "buzzer_manager.h"

// ----------------------------------------------------------------------------
// GLOBAL SUBSYSTEM CONTROLLERS
// ----------------------------------------------------------------------------
ProtectionEngine protection;
PZEMManager      pzem;
WiFiManager      wifi;
SupabaseClient   supabase;
DisplayManager   display;
BuzzerManager    buzzer;

// Timers
unsigned long lastSensorReadTime = 0;
unsigned long lastDisplayUpdateTime = 0;
unsigned long lastTelemetryUploadTime = 0;
unsigned long lastSettingsSyncTime = 0;

// ----------------------------------------------------------------------------
// SETUP
// ----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n==================================================");
  Serial.println("   SMART ENERGY METER — ESP32 PHYSICAL HARDWARE   ");
  Serial.println("==================================================");

  // 1. Initialize Hardware Pins & Protection State Machine
  protection.init();
  pzem.init();
  buzzer.init();
  display.init();

  // 2. Initialize Wi-Fi Connection & NTP Real-Time Clock
  wifi.init(WIFI_SSID_DEFAULT, WIFI_PASSWORD_DEFAULT);

  // 3. Initialize Supabase REST Client
  supabase.init(SUPABASE_URL_DEFAULT, SUPABASE_ANON_KEY, DEVICE_ID_DEFAULT);

  // 4. Perform Initial Remote Settings Synchronization
  float ov = 0, uv = 0, pl = 0, cost = 0;
  if (supabase.fetchSettings(ov, uv, pl, cost)) {
    protection.updateThresholds(ov, uv, pl, cost);
    Serial.printf("[INIT] Cloud Thresholds Synchronized: OV=%.1fV, UV=%.1fV, PL=%.1fW, Tariff=Rs%.2f/kWh\n",
                  ov, uv, pl, cost);
  } else {
    Serial.println("[INIT] Using default local protection thresholds.");
  }

  Serial.println("[SYSTEM] Initialization complete. Starting non-blocking telemetry loop.");
}

// ----------------------------------------------------------------------------
// MAIN NON-BLOCKING EXECUTION LOOP
// ----------------------------------------------------------------------------
void loop() {
  // 1. Maintain Wi-Fi Connection Watchdog
  wifi.checkConnection();

  // 2. Update Buzzer Beep State
  buzzer.update();

  unsigned long currentMillis = millis();

  // 3. Read PZEM-004T Sensor Registers every 800ms
  if (currentMillis - lastSensorReadTime >= INTERVAL_SENSOR_READ_MS) {
    lastSensorReadTime = currentMillis;

    // Read real sensor values (with current tariff applied to energy)
    pzem.readSensor(protection.getThresholds().costPerKWh);
    const SensorReadings& data = pzem.getReadings();

    // Evaluate Protection State Machine
    protection.evaluate(data);

    // If an instantaneous trip occurred, trigger buzzer and upload alert to cloud immediately!
    if (protection.hasPendingAlert()) {
      String aType, aMsg;
      float aVal;
      protection.consumePendingAlert(aType, aVal, aMsg);
      buzzer.triggerFaultAlarm(3); // 3 audible warning beeps

      String isoTimestamp = wifi.getISOTimestamp();
      supabase.sendAlert(aType, aVal, aMsg, protection.isRelay1Closed(), isoTimestamp);
    }
  }

  // 4. Update 16x2 I2C LCD Display every 500ms
  if (currentMillis - lastDisplayUpdateTime >= INTERVAL_LCD_UPDATE_MS) {
    lastDisplayUpdateTime = currentMillis;
    display.update(
      pzem.getReadings(),
      protection.isRelay1Closed(),
      protection.getActiveFaultName(),
      wifi.isConnected()
    );
  }

  // 5. Upload Telemetry Snapshot & Heartbeat to Supabase every 5 seconds
  if (currentMillis - lastTelemetryUploadTime >= INTERVAL_TELEMETRY_MS) {
    lastTelemetryUploadTime = currentMillis;
    String isoTimestamp = wifi.getISOTimestamp();
    const SensorReadings& data = pzem.getReadings();

    // Upload reading if sensor data is valid
    if (data.isPzemValid) {
      bool success = supabase.sendReading(data, protection.getActiveFaultName(), isoTimestamp);
      if (success) {
        Serial.printf("[TELEMETRY] %s | V=%5.1fV I=%5.3fA P=%5.1fW E=%6.4fkWh F=%4.1fHz PF=%4.2f [%s] Relay1:%s\n",
                      isoTimestamp.c_str(), data.voltage, data.currentAmps, data.power,
                      data.energyKwh, data.frequency, data.powerFactor,
                      protection.getActiveFaultName().c_str(),
                      protection.isRelay1Closed() ? "ON" : "OFF");
      }
    }

    // Always update authoritative physical device status & heartbeat
    supabase.updateDeviceStatus(
      wifi.isConnected(),
      data.isPzemValid,
      protection.isRelay1Closed(),
      isoTimestamp
    );
  }

  // 6. Fetch Latest Threshold Settings from Supabase every 10 seconds
  if (currentMillis - lastSettingsSyncTime >= INTERVAL_SETTINGS_SYNC_MS) {
    lastSettingsSyncTime = currentMillis;
    float ov = 0, uv = 0, pl = 0, cost = 0;
    if (supabase.fetchSettings(ov, uv, pl, cost)) {
      protection.updateThresholds(ov, uv, pl, cost);
    }
  }

  delay(10);
}
