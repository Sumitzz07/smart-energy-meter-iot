// ============================================================================
// Relay 1 Standalone Diagnostic Test Sketch for ESP32 DevKit
// ============================================================================
// Pin Connections:
//   ESP32 GPIO26   --> Relay Module IN1
//   ESP32 GND      --> Relay Module GND
//   ESP32 VIN (5V) --> Relay Module VCC
// ============================================================================

#include <Arduino.h>

#define RELAY_PIN 26  // ESP32 GPIO26 connected to Relay IN1

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==================================================");
  Serial.println("         ESP32 RELAY 1 DIAGNOSTIC TEST            ");
  Serial.println("==================================================");
  Serial.println("Relay Module Logic: ACTIVE-LOW (LOW = ON, HIGH = OFF)");
  Serial.println("Testing Relay switching every 3 seconds...\n");

  pinMode(RELAY_PIN, OUTPUT);

  // Start with Relay in safe state (OFF)
  digitalWrite(RELAY_PIN, HIGH);
  Serial.println("[STATUS] Initial state: Relay 1 OFF (Contacts Open)");
  delay(2000);
}

void loop() {
  // 1. Turn Relay ON (Active-LOW: Set pin to LOW)
  Serial.println("--------------------------------------------------");
  Serial.println("[COMMAND] Setting GPIO26 -> LOW");
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("[STATE]   >>> RELAY 1: ON (CLOSED / LOAD ENERGIZED) <<<");
  Serial.println("[CHECK]   Relay LED should be LIT + Audible CLICK heard");
  delay(3000);

  // 2. Turn Relay OFF (Active-LOW: Set pin to HIGH)
  Serial.println("--------------------------------------------------");
  Serial.println("[COMMAND] Setting GPIO26 -> HIGH");
  digitalWrite(RELAY_PIN, HIGH);
  Serial.println("[STATE]   >>> RELAY 1: OFF (OPEN / LOAD DISCONNECTED) <<<");
  Serial.println("[CHECK]   Relay LED should be OFF + Audible CLICK heard");
  delay(3000);
}
