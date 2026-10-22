// ============================================================================
// wifi_manager.h — Wi-Fi Network Connection & NTP Time Sync Manager
// ============================================================================
#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include <time.h>
#include "config.h"

class WiFiManager {
private:
  String ssid;
  String password;
  unsigned long lastReconnectAttempt;
  bool isTimeSynced;

public:
  WiFiManager();
  void init(const String& wifiSsid, const String& wifiPassword);
  void checkConnection();
  bool isConnected() const;
  String getLocalIP() const;
  int getRSSI() const;
  
  void initNTP();
  String getISOTimestamp() const;
};

#endif // WIFI_MANAGER_H
