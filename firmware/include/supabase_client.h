// ============================================================================
// supabase_client.h — Supabase HTTPS REST API Client (Anon Key Access)
// ============================================================================
#ifndef SUPABASE_CLIENT_H
#define SUPABASE_CLIENT_H

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include "config.h"
#include "protection.h"

class SupabaseClient {
private:
  String baseUrl;
  String anonKey;
  String deviceId;
  WiFiClientSecure secureClient;

public:
  SupabaseClient();
  void init(const String& url, const String& key, const String& devId);

  bool sendReading(const SensorReadings& data, const String& protectionStatus, const String& isoTimestamp);
  bool updateDeviceStatus(bool wifiOk, bool pzemOk, bool relay1Closed, const String& isoTimestamp);
  bool sendAlert(const String& alertType, float value, const String& message, bool relay1Closed, const String& isoTimestamp);
  bool fetchSettings(float& ov, float& uv, float& pl, float& cost);
};

#endif // SUPABASE_CLIENT_H
