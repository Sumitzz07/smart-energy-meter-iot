// ============================================================================
// pzem_manager.cpp — PZEM-004T V3 Modbus Driver Implementation
// ============================================================================
#include "pzem_manager.h"

PZEMManager::PZEMManager() : pzem(Serial2, PIN_PZEM_RX, PIN_PZEM_TX) {
  lastReadings.voltage = 0.0f;
  lastReadings.currentAmps = 0.0f;
  lastReadings.power = 0.0f;
  lastReadings.energyKwh = 0.0f;
  lastReadings.frequency = 0.0f;
  lastReadings.powerFactor = 0.0f;
  lastReadings.cost = 0.0f;
  lastReadings.isPzemValid = false;
}

void PZEMManager::init() {
  // Serial2 handles PZEM communication over GPIO16/GPIO17
  Serial.println("[PZEM] Initializing Hardware Serial2 (UART2) on GPIO16 (RX) / GPIO17 (TX)...");
}

bool PZEMManager::readSensor(float tariffRate) {
  float v = pzem.voltage();
  float i = pzem.current();
  float p = pzem.power();
  float e = pzem.energy();
  float f = pzem.frequency();
  float pf = pzem.pf();

  if (!isnan(v) && v > 0) {
    lastReadings.voltage     = v;
    lastReadings.currentAmps = isnan(i)  ? 0.0f : i;
    lastReadings.power       = isnan(p)  ? 0.0f : p;
    lastReadings.energyKwh   = isnan(e)  ? 0.0f : e;
    lastReadings.frequency   = isnan(f)  ? 50.0f : f;
    lastReadings.powerFactor = isnan(pf) ? 1.0f : pf;
    lastReadings.cost        = lastReadings.energyKwh * tariffRate;
    lastReadings.isPzemValid = true;
    return true;
  } else {
    lastReadings.isPzemValid = false;
    return false;
  }
}

const SensorReadings& PZEMManager::getReadings() const {
  return lastReadings;
}

void PZEMManager::resetEnergy() {
  pzem.resetEnergy();
  Serial.println("[PZEM] Accumulated energy registers reset to 0.0000 kWh.");
}
