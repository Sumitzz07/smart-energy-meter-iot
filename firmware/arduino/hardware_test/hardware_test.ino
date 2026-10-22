/*
 * ============================================================================
 * ESP32 Smart Energy Monitor - Hardware Diagnostic & Verification Sketch
 * ============================================================================
 * 
 * Pin Mapping:
 * - Buzzer:       GPIO 25 (Active HIGH)
 * - Relay IN1:    GPIO 26 (Active LOW)
 * - I2C LCD SDA:  GPIO 21
 * - I2C LCD SCL:  GPIO 22
 * - PZEM-004T RX: GPIO 16 (ESP32 RX2 <-> PZEM TX)
 * - PZEM-004T TX: GPIO 17 (ESP32 TX2 <-> PZEM RX)
 * 
 * Serial Monitor Baud Rate: 115200
 * ============================================================================
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <PZEM004Tv30.h>

// --- PIN DEFINITIONS ---
#define PIN_BUZZER     25
#define PIN_RELAY_IN1  26
#define PIN_PZEM_RX    16  // ESP32 RX2 connects to PZEM TX
#define PIN_PZEM_TX    17  // ESP32 TX2 connects to PZEM RX
#define PIN_I2C_SDA    21
#define PIN_I2C_SCL    22

// --- RELAY LOGIC (Active-LOW modules) ---
#define RELAY_ON   LOW
#define RELAY_OFF  HIGH

// --- OBJECT INITIALIZATION ---
// Default I2C address is 0x27 (or 0x3F for some boards). 16 columns, 2 rows.
LiquidCrystal_I2C lcd(0x27, 16, 2);

// HardwareSerial Serial2 on ESP32 (pins 16, 17)
PZEM004Tv30 pzem(Serial2, PIN_PZEM_RX, PIN_PZEM_TX);

// Global Variables
bool relayState = false;
unsigned long lastUpdate = 0;
bool lcdFound = false;

// Function Prototypes
void scanI2CDevices();
void testBuzzer();
void testRelay();
void testPZEM();
void handleSerialCommands();

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==================================================");
  Serial.println("     ESP32 COMPONENT VERIFICATION & TEST TOOL     ");
  Serial.println("==================================================");

  // 1. Initialize Outputs
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_RELAY_IN1, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_RELAY_IN1, RELAY_OFF);

  // 2. Initialize I2C Bus & Scan
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  scanI2CDevices();

  // 3. Initialize LCD
  if (lcdFound) {
    lcd.init();
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("ESP32 TEST MODE");
    lcd.setCursor(0, 1);
    lcd.print("Testing Pins...");
  } else {
    Serial.println("[WARN] LCD not initialized (Address mismatch or wiring issue).");
  }

  delay(1500);

  // 4. Test Buzzer
  testBuzzer();

  // 5. Test Relay
  testRelay();

  // 6. Test PZEM Connection
  testPZEM();

  Serial.println("\n==================================================");
  Serial.println("Self-test completed! Entering Live Monitor loop.");
  Serial.println("Available Serial Commands (type in Serial Monitor):");
  Serial.println("  'r' -> Toggle Relay ON/OFF");
  Serial.println("  'b' -> Sound Buzzer");
  Serial.println("  'z' -> Reset PZEM Energy Counter");
  Serial.println("==================================================\n");

  if (lcdFound) {
    lcd.clear();
  }
}

void loop() {
  handleSerialCommands();

  // Update readings every 1.5 seconds
  if (millis() - lastUpdate >= 1500) {
    lastUpdate = millis();

    float voltage   = pzem.voltage();
    float current   = pzem.current();
    float power     = pzem.power();
    float energy    = pzem.energy();
    float frequency = pzem.frequency();
    float pf        = pzem.pf();

    // Print to Serial
    Serial.println("-------------- LIVE SENSOR READINGS --------------");
    if (isnan(voltage)) {
      Serial.println("[PZEM ERROR] Reading failed. Check 230V AC mains / 5V DC supply / RX-TX wiring.");
    } else {
      Serial.printf("Voltage:     %.1f V\n", voltage);
      Serial.printf("Current:     %.3f A\n", current);
      Serial.printf("Active Power:%.1f W\n", power);
      Serial.printf("Energy:      %.3f kWh\n", energy);
      Serial.printf("Frequency:   %.1f Hz\n", frequency);
      Serial.printf("Power Factor:%.2f\n", pf);
      Serial.printf("Relay State: %s\n", relayState ? "LOAD ON" : "LOAD OFF");
    }
    Serial.println("--------------------------------------------------");

    // Update 16x2 LCD
    if (lcdFound) {
      if (isnan(voltage)) {
        lcd.setCursor(0, 0);
        lcd.print("PZEM Comm Error ");
        lcd.setCursor(0, 1);
        lcd.print("Check AC/5V/UART");
      } else {
        // Line 1: Voltage & Current
        char line1[17];
        snprintf(line1, sizeof(line1), "V:%4.1fV I:%4.2fA", voltage, current);
        lcd.setCursor(0, 0);
        lcd.print(line1);

        // Line 2: Power & Relay status
        char line2[17];
        snprintf(line2, sizeof(line2), "P:%4.0fW RLY:%s", power, relayState ? "ON " : "OFF");
        lcd.setCursor(0, 1);
        lcd.print(line2);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// HARDWARE TEST FUNCTIONS
// -----------------------------------------------------------------------------

void scanI2CDevices() {
  Serial.println("\n[TEST 1] Scanning I2C Bus (SDA: GPIO21, SCL: GPIO22)...");
  byte count = 0;

  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) {
      Serial.printf(" -> Found I2C device at address 0x%02X\n", address);
      if (address == 0x27 || address == 0x3F) {
        lcdFound = true;
      }
      count++;
    }
  }

  if (count == 0) {
    Serial.println(" [FAIL] No I2C devices found! Check LCD SDA/SCL & 5V/GND wiring.");
  } else {
    Serial.println(" [PASS] I2C Device detected.");
  }
}

void testBuzzer() {
  Serial.println("\n[TEST 2] Testing Buzzer on GPIO25 (2 quick beeps)...");
  for (int i = 0; i < 2; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(100);
    digitalWrite(PIN_BUZZER, LOW);
    delay(100);
  }
  Serial.println(" [PASS] Buzzer test complete.");
}

void testRelay() {
  Serial.println("\n[TEST 3] Testing Relay on GPIO26...");
  
  Serial.println(" -> Switching Relay ON (You should hear a CLICK & LED on)");
  digitalWrite(PIN_RELAY_IN1, RELAY_ON);
  relayState = true;
  delay(1500);

  Serial.println(" -> Switching Relay OFF (You should hear a second CLICK & LED off)");
  digitalWrite(PIN_RELAY_IN1, RELAY_OFF);
  relayState = false;
  delay(1000);
  
  Serial.println(" [PASS] Relay test complete.");
}

void testPZEM() {
  Serial.println("\n[TEST 4] Testing PZEM-004T V3.0 Handshake (RX:16, TX:17)...");
  float v = pzem.voltage();
  
  if (isnan(v)) {
    Serial.println(" [FAIL / STANDBY] Could not read from PZEM.");
    Serial.println("   * Is 230V AC Mains connected to L & N terminals on PZEM? (PZEM requires AC power to respond).");
    Serial.println("   * Did you cross RX/TX? (PZEM TX -> ESP32 GPIO16, PZEM RX -> ESP32 GPIO17).");
    Serial.println("   * Is the 5V DC supply active on PZEM VCC & GND?");
  } else {
    Serial.printf(" [PASS] PZEM Communication OK! Measured AC Voltage = %.1f V\n", v);
  }
}

void handleSerialCommands() {
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    
    if (cmd == 'r' || cmd == 'R') {
      relayState = !relayState;
      digitalWrite(PIN_RELAY_IN1, relayState ? RELAY_ON : RELAY_OFF);
      Serial.printf("\n[USER ACTION] Relay toggled to: %s\n", relayState ? "ON (Closed/Energized)" : "OFF (Open/De-energized)");
      
      // Short beep confirmation
      digitalWrite(PIN_BUZZER, HIGH);
      delay(40);
      digitalWrite(PIN_BUZZER, LOW);
    } 
    else if (cmd == 'b' || cmd == 'B') {
      Serial.println("\n[USER ACTION] Buzzer triggered.");
      digitalWrite(PIN_BUZZER, HIGH);
      delay(200);
      digitalWrite(PIN_BUZZER, LOW);
    }
    else if (cmd == 'z' || cmd == 'Z') {
      Serial.println("\n[USER ACTION] Resetting PZEM energy counter to 0...");
      pzem.resetEnergy();
      Serial.println(" Energy counter reset done.");
    }
  }
}
