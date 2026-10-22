// ============================================================================
// buzzer_manager.cpp — Buzzer Driver Implementation
// ============================================================================
#include "buzzer_manager.h"

BuzzerManager::BuzzerManager() {
  beepsRemaining = 0;
  lastToggleTime = 0;
  isBuzzerHigh = false;
}

void BuzzerManager::init() {
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
}

void BuzzerManager::triggerFaultAlarm(int count) {
  beepsRemaining = count * 2; // On/Off cycles
  lastToggleTime = millis();
  isBuzzerHigh = true;
  digitalWrite(PIN_BUZZER, HIGH);
}

void BuzzerManager::update() {
  if (beepsRemaining <= 0) {
    if (isBuzzerHigh) {
      isBuzzerHigh = false;
      digitalWrite(PIN_BUZZER, LOW);
    }
    return;
  }

  unsigned long now = millis();
  if (now - lastToggleTime >= 120) { // 120ms on/off pulse
    lastToggleTime = now;
    isBuzzerHigh = !isBuzzerHigh;
    digitalWrite(PIN_BUZZER, isBuzzerHigh ? HIGH : LOW);
    beepsRemaining--;
  }
}

void BuzzerManager::stop() {
  beepsRemaining = 0;
  isBuzzerHigh = false;
  digitalWrite(PIN_BUZZER, LOW);
}
