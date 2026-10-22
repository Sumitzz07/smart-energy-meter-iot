// ============================================================================
// display_manager.cpp — 16x2 I2C LCD Driver Implementation
// ============================================================================
#include "display_manager.h"

DisplayManager::DisplayManager() : lcd(LCD_I2C_ADDR_PRIMARY, 16, 2) {
  isLcdDetected = false;
  activePageIndex = 0;
  lastPageSwitchTime = 0;
}

void DisplayManager::init() {
  Wire.begin(PIN_LCD_SDA, PIN_LCD_SCL);

  // Probe primary address (0x27)
  Wire.beginTransmission(LCD_I2C_ADDR_PRIMARY);
  if (Wire.endTransmission() == 0) {
    lcd = LiquidCrystal_I2C(LCD_I2C_ADDR_PRIMARY, 16, 2);
    lcd.init();
    lcd.backlight();
    isLcdDetected = true;
    showBootMessage();
    Serial.println("[LCD] 16x2 I2C LCD detected at address 0x27.");
    return;
  }

  // Probe secondary address (0x3F)
  Wire.beginTransmission(LCD_I2C_ADDR_SECONDARY);
  if (Wire.endTransmission() == 0) {
    lcd = LiquidCrystal_I2C(LCD_I2C_ADDR_SECONDARY, 16, 2);
    lcd.init();
    lcd.backlight();
    isLcdDetected = true;
    showBootMessage();
    Serial.println("[LCD] 16x2 I2C LCD detected at address 0x3F.");
    return;
  }

  Serial.println("[LCD] No I2C LCD device detected. Operating in headless mode.");
}

void DisplayManager::showBootMessage() {
  if (!isLcdDetected) return;
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Smart Energy");
  lcd.setCursor(0, 1);
  lcd.print("Meter Booting...");
}

void DisplayManager::update(const SensorReadings& data, bool relay1Closed, const String& faultName, bool wifiOk) {
  if (!isLcdDetected) return;

  // Cycle display page every INTERVAL_LCD_PAGE_MS (3 seconds)
  if (millis() - lastPageSwitchTime >= INTERVAL_LCD_PAGE_MS) {
    lastPageSwitchTime = millis();
    activePageIndex = (activePageIndex + 1) % 2;
  }

  lcd.clear();

  // 1. Critical Trip Fault Overlay (Highest Priority)
  if (faultName != "normal") {
    lcd.setCursor(0, 0);
    if (faultName == "over_voltage")       lcd.print("! OVER VOLTAGE !");
    else if (faultName == "under_voltage") lcd.print("! UNDER VOLTAGE!");
    else if (faultName == "over_power")    lcd.print("! OVER POWER !  ");
    else if (faultName == "sensor_failure")lcd.print("! PZEM COMM ERR!");
    else                                   lcd.print("! TRIP ALARM !  ");

    lcd.setCursor(0, 1);
    char line2[17];
    snprintf(line2, sizeof(line2), "RLY:OFF %5.1fV", data.voltage);
    lcd.print(line2);
    return;
  }

  // 2. Normal Telemetry Pages
  if (activePageIndex == 0) {
    // Page 0: Voltage, Power, Current, Relay
    char line1[17];
    snprintf(line1, sizeof(line1), "%5.1fV  %5.0fW", data.voltage, data.power);
    lcd.setCursor(0, 0);
    lcd.print(line1);

    char line2[17];
    snprintf(line2, sizeof(line2), "%5.2fA  R:%s", data.currentAmps, relay1Closed ? "ON " : "OFF");
    lcd.setCursor(0, 1);
    lcd.print(line2);
  } else {
    // Page 1: Energy, Frequency, PF, Wi-Fi Link
    char line1[17];
    snprintf(line1, sizeof(line1), "E:%5.2fk  %4.1fHz", data.energyKwh, data.frequency);
    lcd.setCursor(0, 0);
    lcd.print(line1);

    char line2[17];
    snprintf(line2, sizeof(line2), "PF:%4.2f [%s]", data.powerFactor, wifiOk ? "WIFI" : "OFFL");
    lcd.setCursor(0, 1);
    lcd.print(line2);
  }
}
