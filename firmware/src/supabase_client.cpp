// ============================================================================
// supabase_client.cpp — Supabase REST Client Implementation
// ============================================================================
#include "supabase_client.h"

SupabaseClient::SupabaseClient() {
  baseUrl = SUPABASE_URL_DEFAULT;
  anonKey = SUPABASE_ANON_KEY;
  deviceId = DEVICE_ID_DEFAULT;
}

void SupabaseClient::init(const String& url, const String& key, const String& devId) {
  baseUrl = url;
  anonKey = key;
  deviceId = devId;
  secureClient.setInsecure(); // Skip TLS root CA verification on IoT embedded chip
}

bool SupabaseClient::sendReading(const SensorReadings& data, const String& protectionStatus, const String& isoTimestamp) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String endpoint = baseUrl + "/rest/v1/energy_readings";
  http.begin(secureClient, endpoint);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", anonKey);
  http.addHeader("Authorization", "Bearer " + anonKey);
  http.addHeader("Prefer", "return=minimal");

  JsonDocument doc;
  doc["device_id"]         = deviceId;
  doc["timestamp"]         = isoTimestamp;
  doc["voltage"]           = serialized(String(data.voltage, 1));
  doc["current_amps"]      = serialized(String(data.currentAmps, 3));
  doc["power"]             = serialized(String(data.power, 1));
  doc["energy_kwh"]        = serialized(String(data.energyKwh, 4));
  doc["frequency"]         = serialized(String(data.frequency, 1));
  doc["power_factor"]      = serialized(String(data.powerFactor, 2));
  doc["cost"]              = serialized(String(data.cost, 2));
  doc["protection_status"] = protectionStatus;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  bool success = (httpCode >= 200 && httpCode < 300);
  if (!success) {
    Serial.printf("[SUPABASE ERROR] POST energy_readings failed with HTTP %d\n", httpCode);
  }
  http.end();
  return success;
}

bool SupabaseClient::updateDeviceStatus(bool wifiOk, bool pzemOk, bool relay1Closed, const String& isoTimestamp) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String endpoint = baseUrl + "/rest/v1/device_status";
  http.begin(secureClient, endpoint);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", anonKey);
  http.addHeader("Authorization", "Bearer " + anonKey);
  http.addHeader("Prefer", "resolution=merge-duplicates");

  JsonDocument doc;
  doc["device_id"]       = deviceId;
  doc["connection_type"] = "hardware"; // Explicitly identifies physical hardware
  doc["wifi_status"]     = wifiOk;
  doc["gsm_status"]      = false;
  doc["pzem_status"]     = pzemOk;
  doc["relay1_status"]   = relay1Closed;
  doc["relay2_status"]   = false;
  doc["last_seen"]       = isoTimestamp;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  bool success = (httpCode >= 200 && httpCode < 300);
  http.end();
  return success;
}

bool SupabaseClient::sendAlert(const String& alertType, float value, const String& message, bool relay1Closed, const String& isoTimestamp) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String endpoint = baseUrl + "/rest/v1/alerts";
  http.begin(secureClient, endpoint);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", anonKey);
  http.addHeader("Authorization", "Bearer " + anonKey);
  http.addHeader("Prefer", "return=minimal");

  JsonDocument doc;
  doc["device_id"]    = deviceId;
  doc["timestamp"]    = isoTimestamp;
  doc["alert_type"]   = alertType;
  doc["value"]        = serialized(String(value, 2));
  doc["message"]      = message;
  doc["relay_status"] = relay1Closed ? "on" : "off";
  doc["acknowledged"] = false;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  bool success = (httpCode >= 200 && httpCode < 300);
  Serial.printf("[SUPABASE ALERT] Event: %s (Val=%.1f) -> HTTP Status: %d\n", alertType.c_str(), value, httpCode);
  http.end();
  return success;
}

bool SupabaseClient::fetchSettings(float& ov, float& uv, float& pl, float& cost) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String endpoint = baseUrl + "/rest/v1/meter_settings?device_id=eq." + deviceId + "&select=*";
  http.begin(secureClient, endpoint);
  http.addHeader("apikey", anonKey);
  http.addHeader("Authorization", "Bearer " + anonKey);

  int httpCode = http.GET();
  if (httpCode == 200) {
    String payload = http.getString();
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (!err && doc.is<JsonArray>() && doc.as<JsonArray>().size() > 0) {
      JsonObject obj = doc[0];
      if (obj["over_voltage"].is<float>())  ov = obj["over_voltage"].as<float>();
      if (obj["under_voltage"].is<float>()) uv = obj["under_voltage"].as<float>();
      if (obj["power_limit"].is<float>())   pl = obj["power_limit"].as<float>();
      if (obj["cost_per_kwh"].is<float>())  cost = obj["cost_per_kwh"].as<float>();
      http.end();
      return true;
    }
  }
  http.end();
  return false;
}
