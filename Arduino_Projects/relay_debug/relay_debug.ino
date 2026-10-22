void setup() {
  Serial.begin(115200);
  pinMode(26, OUTPUT);
  Serial.println("\n--- RELAY ISOLATION TEST ---");
  Serial.println("GPIO 26 will toggle every 3 seconds.");
}

void loop() {
  Serial.println("\n[STATE 1] GPIO 26 -> HIGH");
  digitalWrite(26, HIGH);
  delay(3000);

  Serial.println("[STATE 2] GPIO 26 -> LOW");
  digitalWrite(26, LOW);
  delay(3000);
}
