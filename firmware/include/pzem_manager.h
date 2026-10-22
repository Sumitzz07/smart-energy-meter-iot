// ============================================================================
// pzem_manager.h — PZEM-004T V3 Modbus UART Interface
// ============================================================================
#ifndef PZEM_MANAGER_H
#define PZEM_MANAGER_H

#include <Arduino.h>
#include <PZEM004Tv30.h>
#include "config.h"
#include "protection.h"

class PZEMManager {
private:
  PZEM004Tv30 pzem;
  SensorReadings lastReadings;

public:
  PZEMManager();
  void init();
  bool readSensor(float tariffRate);
  const SensorReadings& getReadings() const;
  void resetEnergy();
};

#endif // PZEM_MANAGER_H
