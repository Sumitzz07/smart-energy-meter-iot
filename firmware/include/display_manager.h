// ============================================================================
// display_manager.h — 16x2 I2C LCD Display Manager
// ============================================================================
#ifndef DISPLAY_MANAGER_H
#define DISPLAY_MANAGER_H

#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "config.h"
#include "protection.h"

class DisplayManager {
private:
  LiquidCrystal_I2C lcd;
  bool isLcdDetected;
  int activePageIndex;
  unsigned long lastPageSwitchTime;

public:
  DisplayManager();
  void init();
  void update(const SensorReadings& data, bool relay1Closed, const String& faultName, bool wifiOk);
  void showBootMessage();
};

#endif // DISPLAY_MANAGER_H
