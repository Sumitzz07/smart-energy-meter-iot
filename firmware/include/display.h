// ============================================================================
// display.h — 16x2 I2C LCD Display Manager
// ============================================================================
#ifndef DISPLAY_H
#define DISPLAY_H

#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "config.h"
#include "protection.h"

class LCDDisplayManager {
private:
  LiquidCrystal_I2C lcd;
  bool available;
  unsigned long lastScreenSwitchTime;
  int currentScreen;

public:
  LCDDisplayManager() : lcd(LCD_I2C_ADDRESS, 16, 2), available(false), lastScreenSwitchTime(0), currentScreen(0) {}

  void init() {
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    // Test I2C communication with LCD backpack
    Wire.beginTransmission(LCD_I2C_ADDRESS);
    if (Wire.endTransmission() == 0) {
      lcd.init();
      lcd.backlight();
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Smart Energy");
      lcd.setCursor(0, 1);
      lcd.print("Meter Init...");
      available = true;
    } else {
      Serial.println("[LCD] I2C LCD not detected at 0x27. Checking alternate 0x3F...");
      Wire.beginTransmission(0x3F);
      if (Wire.endTransmission() == 0) {
        lcd = LiquidCrystal_I2C(0x3F, 16, 2);
        lcd.init();
        lcd.backlight();
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Smart Energy");
        lcd.setCursor(0, 1);
        lcd.print("Meter Init...");
        available = true;
      } else {
        Serial.println("[LCD] No I2C LCD found. Continuing headless.");
        available = false;
      }
    }
  }

  void update(const TelemetryData& t, const ProtectionConfig& cfg, bool relay1On, const String& faultType, bool wifiConnected) {
    if (!available) return;

    // Switch screen every 3 seconds if in normal mode
    if (millis() - lastScreenSwitchTime >= 3000) {
      lastScreenSwitchTime = millis();
      currentScreen = (currentScreen + 1) % 2;
    }

    lcd.clear();

    // If fault is active, override screen with critical trip banner!
    if (faultType != "normal") {
      lcd.setCursor(0, 0);
      if (faultType == "over_voltage")       lcd.print("! OVER VOLTAGE !");
      else if (faultType == "under_voltage") lcd.print("! UNDER VOLTAGE!");
      else if (faultType == "over_power")    lcd.print("! OVER POWER !  ");
      else if (faultType == "sensor_failure")lcd.print("! PZEM FAULT !  ");
      else                                   lcd.print("! TRIP ALARM !  ");

      lcd.setCursor(0, 1);
      char line2[17];
      snprintf(line2, sizeof(line2), "RLY:OFF %4.1fV", t.voltage);
      lcd.print(line2);
      return;
    }

    if (currentScreen == 0) {
      // Screen 0: Primary Measurements (Voltage, Power, Current, Energy)
      char line1[17];
      snprintf(line1, sizeof(line1), "V:%4.1fV P:%4.0fW", t.voltage, t.power);
      lcd.setCursor(0, 0);
      lcd.print(line1);

      char line2[17];
      snprintf(line2, sizeof(line2), "I:%4.2fA E:%4.2fk", t.currentAmps, t.energyKwh);
      lcd.setCursor(0, 1);
      lcd.print(line2);
    } else {
      // Screen 1: Frequency, PF, Relay State & WiFi Link
      char line1[17];
      snprintf(line1, sizeof(line1), "F:%4.1fHz PF:%4.2f", t.frequency, t.powerFactor);
      lcd.setCursor(0, 0);
      lcd.print(line1);

      char line2[17];
      snprintf(line2, sizeof(line2), "RLY:%s  [%s]", relay1On ? "ON " : "OFF", wifiConnected ? "WIFI" : "OFFL");
      lcd.setCursor(0, 1);
      lcd.print(line2);
    }
  }
};

#endif // DISPLAY_H
