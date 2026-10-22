// ============================================================================
// protection.h — State Machine & Protection Engine for Relay 1
// ============================================================================
#ifndef PROTECTION_H
#define PROTECTION_H

#include <Arduino.h>
#include "config.h"

enum ProtectionState {
  STATE_NORMAL,
  STATE_PROTECTION_TRIP,
  STATE_FAULT_ACTIVE,
  STATE_RECOVERY
};

struct ProtectionThresholds {
  float overVoltage;
  float underVoltage;
  float powerLimit;
  float costPerKWh;
};

struct SensorReadings {
  float voltage;
  float currentAmps;
  float power;
  float energyKwh;
  float frequency;
  float powerFactor;
  float cost;
  bool isPzemValid;
};

class ProtectionEngine {
private:
  ProtectionState currentState;
  ProtectionThresholds thresholds;
  bool relay1State;
  String activeFaultName;
  unsigned long recoveryStartTime;
  
  // Single edge-triggered alert buffer
  bool alertPending;
  String pendingAlertType;
  float pendingAlertValue;
  String pendingAlertMessage;

public:
  ProtectionEngine();
  void init();
  void updateThresholds(float ov, float uv, float pl, float cost);
  ProtectionThresholds getThresholds() const;

  void evaluate(const SensorReadings& data);
  void setRelay1Physical(bool closed);

  bool isRelay1Closed() const;
  ProtectionState getState() const;
  String getActiveFaultName() const;

  bool hasPendingAlert() const;
  void consumePendingAlert(String& type, float& value, String& message);
};

#endif // PROTECTION_H
