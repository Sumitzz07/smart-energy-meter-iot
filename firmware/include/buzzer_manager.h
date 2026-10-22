// ============================================================================
// buzzer_manager.h — Non-Blocking Audible Alarm & Buzzer Controller
// ============================================================================
#ifndef BUZZER_MANAGER_H
#define BUZZER_MANAGER_H

#include <Arduino.h>
#include "config.h"

class BuzzerManager {
private:
  int beepsRemaining;
  unsigned long lastToggleTime;
  bool isBuzzerHigh;

public:
  BuzzerManager();
  void init();
  void triggerFaultAlarm(int count = 3);
  void update();
  void stop();
};

#endif // BUZZER_MANAGER_H
