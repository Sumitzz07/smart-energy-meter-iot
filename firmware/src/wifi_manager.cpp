// ============================================================================
// wifi_manager.cpp — Wi-Fi Network & NTP Manager Implementation
// ============================================================================
#include "wifi_manager.h"

WiFiManager::WiFiManager() {
  ssid = WIFI_SSID_DEFAULT;
  password = WIFI_PASSWORD_DEFAULT;
  lastReconnectAttempt = 0;
  isTimeSynced = false;
}

void WiFiManager::init(const String& wifiSsid, const String& wifiPassword) {
  ssid = wifiSsid;
  password = wifiPassword;

  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  Serial.printf("\n[WIFI] Initializing Station connection to SSID: %s\n", ssid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 25) {
    delay(400);
    Serial.print(".");
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    Serial.printf("\n[WIFI] Connected! Assigned IP: %s (RSSI: %d dBm)\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    initNTP();
  } else {
    digitalWrite(PIN_STATUS_LED, LOW);
    Serial.println("\n[WIFI] Initial connection attempt timed out. Reconnect watchdog active.");
  }
}

void WiFiManager::checkConnection() {
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    return;
  }

  digitalWrite(PIN_STATUS_LED, LOW);
  unsigned long now = millis();

  // Non-blocking reconnect attempt every 10 seconds
  if (now - lastReconnectAttempt >= 10000) {
    lastReconnectAttempt = now;
    Serial.printf("[WIFI] Reconnecting to %s...\n", ssid.c_str());
    WiFi.disconnect();
    WiFi.reconnect();
  }
}

bool WiFiManager::isConnected() const {
  return (WiFi.status() == WL_CONNECTED);
}

String WiFiManager::getLocalIP() const {
  return WiFi.localIP().toString();
}

int WiFiManager::getRSSI() const {
  return WiFi.RSSI();
}

void WiFiManager::initNTP() {
  Serial.println("[NTP] Synchronizing Real-Time Clock with pool.ntp.org...");
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 5000)) {
    isTimeSynced = true;
    char timeStr[64];
    strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S UTC", &timeinfo);
    Serial.printf("[NTP] Synchronization successful: %s\n", timeStr);
  } else {
    Serial.println("[NTP] Sync timed out. Background sync will continue.");
  }
}

String WiFiManager::getISOTimestamp() const {
  time_t now = time(nullptr);
  struct tm* t = gmtime(&now);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", t);
  return String(buf);
}
