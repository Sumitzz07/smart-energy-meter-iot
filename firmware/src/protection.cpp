// ============================================================================
// protection.cpp — Protection Engine Implementation
// ============================================================================
#include "protection.h"

ProtectionEngine::ProtectionEngine() {
  currentState = STATE_NORMAL;
  thresholds.overVoltage = 260.0f;
  thresholds.underVoltage = 180.0f;
  thresholds.powerLimit = 2000.0f;
  thresholds.costPerKWh = 6.0f;
  relay1State = false;
  activeFaultName = "normal";
  recoveryStartTime = 0;
  alertPending = false;
  pendingAlertType = "";
  pendingAlertValue = 0.0f;
  pendingAlertMessage = "";
}

void ProtectionEngine::init() {
  pinMode(PIN_RELAY_1, OUTPUT);
  // Safe power-on default: Relay 1 OPEN (OFF)
  setRelay1Physical(false);
}

void ProtectionEngine::updateThresholds(float ov, float uv, float pl, float cost) {
  if (ov > 0) thresholds.overVoltage = ov;
  if (uv > 0) thresholds.underVoltage = uv;
  if (pl > 0) thresholds.powerLimit = pl;
  if (cost >= 0) thresholds.costPerKWh = cost;
}

ProtectionThresholds ProtectionEngine::getThresholds() const {
  return thresholds;
}

void ProtectionEngine::setRelay1Physical(bool closed) {
  relay1State = closed;
  digitalWrite(PIN_RELAY_1, closed ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
}

void ProtectionEngine::evaluate(const SensorReadings& data) {
  String detectedFault = "normal";
  float faultVal = 0.0f;
  String faultMsg = "";

  // 1. Sensor Communication Validation
  if (!data.isPzemValid) {
    detectedFault = "sensor_failure";
    faultVal = 0.0f;
    faultMsg = "PZEM-004T Modbus UART read failure / sensor disconnected.";
  }
  // 2. Over-Voltage Threshold Evaluation
  else if (data.voltage > thresholds.overVoltage) {
    detectedFault = "over_voltage";
    faultVal = data.voltage;
    faultMsg = "Over-voltage threshold breach: " + String(data.voltage, 1) + "V > " + String(thresholds.overVoltage, 1) + "V";
  }
  // 3. Under-Voltage Threshold Evaluation (only active when mains AC is plugged in, > 10V)
  else if (data.voltage > 10.0f && data.voltage < thresholds.underVoltage) {
    detectedFault = "under_voltage";
    faultVal = data.voltage;
    faultMsg = "Under-voltage threshold breach: " + String(data.voltage, 1) + "V < " + String(thresholds.underVoltage, 1) + "V";
  }
  // 4. Over-Power Threshold Evaluation
  else if (data.power > thresholds.powerLimit) {
    detectedFault = "over_power";
    faultVal = data.power;
    faultMsg = "Active power limit breach: " + String(data.power, 1) + "W > " + String(thresholds.powerLimit, 1) + "W";
  }

  // State Machine Evaluation
  switch (currentState) {
    case STATE_NORMAL:
      if (detectedFault != "normal") {
        // Immediate Instantaneous Trip (<50ms)
        setRelay1Physical(false);
        currentState = STATE_PROTECTION_TRIP;
        activeFaultName = detectedFault;

        // Dispatch single edge-triggered alert
        alertPending = true;
        pendingAlertType = detectedFault;
        pendingAlertValue = faultVal;
        pendingAlertMessage = faultMsg;

        Serial.printf("[PROTECTION TRIP] %s (Val=%.1f) -> Relay 1 DISCONNECTED\n",
                      detectedFault.c_str(), faultVal);
      } else {
        // Normal continuous operation: Ensure Relay 1 is CLOSED (ON)
        if (!relay1State) {
          setRelay1Physical(true);
        }
      }
      break;

    case STATE_PROTECTION_TRIP:
      // Transition immediately to sustained fault holding state
      currentState = STATE_FAULT_ACTIVE;
      break;

    case STATE_FAULT_ACTIVE:
      // Strictly maintain Relay 1 OPEN (OFF)
      setRelay1Physical(false);

      if (detectedFault == "normal") {
        // Telemetry has returned to safe range -> Enter Recovery Hold Window
        currentState = STATE_RECOVERY;
        recoveryStartTime = millis();
        Serial.println("[PROTECTION] Safe telemetry restored. Starting 5s recovery timer...");
      }
      break;

    case STATE_RECOVERY:
      setRelay1Physical(false); // Maintain OFF during recovery verification countdown

      if (detectedFault != "normal") {
        // Re-faulted before recovery period finished
        currentState = STATE_FAULT_ACTIVE;
        activeFaultName = detectedFault;
        Serial.printf("[PROTECTION] Re-fault during recovery: %s\n", detectedFault.c_str());
      } else if (millis() - recoveryStartTime >= RECOVERY_HOLD_TIME_MS) {
        // Continuous safe readings verified -> Safely re-close Relay 1
        setRelay1Physical(true);
        currentState = STATE_NORMAL;
        activeFaultName = "normal";
        Serial.println("[PROTECTION] Safe recovery verified. Relay 1 CLOSED -> Load Powered.");
      }
      break;
  }
}

bool ProtectionEngine::isRelay1Closed() const {
  return relay1State;
}

ProtectionState ProtectionEngine::getState() const {
  return currentState;
}

String ProtectionEngine::getActiveFaultName() const {
  return activeFaultName;
}

bool ProtectionEngine::hasPendingAlert() const {
  return alertPending;
}

void ProtectionEngine::consumePendingAlert(String& type, float& value, String& message) {
  type = pendingAlertType;
  value = pendingAlertValue;
  message = pendingAlertMessage;
  alertPending = false;
}
