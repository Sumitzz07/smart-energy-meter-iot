# Smart Energy Meter — Physical Hardware Integration Guide (Relay 1 Configuration)

This document provides complete instructions for wiring, flashing, commissioning, and operating the **ESP32-WROOM-32**, **PZEM-004T V3**, **16×2 I2C LCD**, and **Relay 1 Load Contactor** with the live Smart Energy Meter web platform.

---

## 1. System Block Diagram (Relay 1 Only)

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                              HIGH-VOLTAGE AC MAINS (230V AC)                               │
│                                                                                            │
│   230V AC Live (L) ────┬───[ Relay 1 COM ── NO ]───┬───( Pass Through CT )───► [ AC Load L]│
│   (From Socket)        │                           │                                       │
│                        │                           │                                       │
│                [ PZEM Voltage L ]                  │                                       │
│                        │                           │                                       │
│   230V AC Neutral (N) ─┴───[ PZEM Voltage N ]──────┴─────────────────────────► [ AC Load N]│
│                                                                                            │
│   Earth (PE) ────────────────────────────────────────────────────────────────► [ AC Load PE]
└────────────────────────────────────────────────────────────────────────────────────────────┘
                                   │                                 │
                   Optical Isolation Barrier          Induction Current (CT Coil)
                                   │                                 │
┌──────────────────────────────────▼─────────────────────────────────▼───────────────────────┐
│                             PZEM-004T V3 ENERGY METER BOARD                                │
│   Measures: Voltage (V), Current (A), Power (W), Energy (kWh), Frequency (Hz), PF          │
│   TTL UART Output: 9600 Baud (5V/3.3V compatible)                                          │
└──────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                               │ UART (RX2 / TX2)
                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                              ESP32 DEVKIT CONTROLLER (3.3V)                                │
│                                                                                            │
│  • GPIO16 (RX2) ◄─── PZEM TX                        • GPIO21 (SDA) ◄──► 16x2 LCD I2C (SDA) │
│  • GPIO17 (TX2) ────► PZEM RX                        • GPIO22 (SCL) ────► 16x2 LCD I2C (SCL)│
│                                                                                            │
│  • GPIO23       ────► Relay 1 IN (Main Load Contactor)                                     │
│  • GPIO25       ────► Buzzer (+) (Audible Fault Alarm)                                     │
│  • GPIO2        ────► Status LED                                                           │
│                                                                                            │
│  [FUTURE GSM EXPANSION HEADER RESERVED]:                                                   │
│  • GPIO32 (RX3) ◄─── SIM800L TX                                                            │
│  • GPIO33 (TX3) ────► SIM800L RX                                                            │
└───────────────────────────────┬────────────────────────────────────────────────────────────┘
                                │ Wi-Fi (Current) / GSM HTTPS (Future)
                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE CLOUD & NEXT.JS WEB DASHBOARD                           │
│   • Realtime Telemetry • Over/Under Voltage Trip • Fleet Health • Remote Tariff Settings   │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Master Pin-to-Pin Connection Table (Relay 1 Only)

### Low-Voltage DC & Control Wiring (Completely Safe — 5V / 3.3V)

| # | Component | Component Pin | ESP32 DevKit Pin | Wire Color | Purpose |
|---|:---|:---|:---|:---|:---|
| **1** | **5V DC Supply** | `+5V (VCC)` | **`VIN / 5V`** | 🔴 Red | 5V Power distribution rail |
| **2** | **5V DC Supply** | `GND (0V)` | **`GND`** | ⚫ Black | System Common Ground |
| **3** | **PZEM-004T V3** | `5V (VCC)` | **`VIN / 5V`** | 🔴 Red | 5V Power for PZEM optical isolators |
| **4** | **PZEM-004T V3** | `GND` | **`GND`** | ⚫ Black | Ground reference |
| **5** | **PZEM-004T V3** | `TX` | **`GPIO16` (RX2)** | 🟡 Yellow | Data from PZEM $\rightarrow$ ESP32 |
| **6** | **PZEM-004T V3** | `RX` | **`GPIO17` (TX2)** | 🟢 Green | Commands from ESP32 $\rightarrow$ PZEM |
| **7** | **16×2 LCD I2C** | `VCC` | **`VIN / 5V`** | 🔴 Red | 5V Power for LCD & backlight |
| **8** | **16×2 LCD I2C** | `GND` | **`GND`** | ⚫ Black | LCD Ground |
| **9** | **16×2 LCD I2C** | `SDA` | **`GPIO21`** | 🔵 Blue | I2C Serial Data line |
| **10**| **16×2 LCD I2C** | `SCL` | **`GPIO22`** | ⚪ White | I2C Serial Clock line |
| **11**| **Relay Module** | `VCC` | **`VIN / 5V`** | 🔴 Red | 5V Relay coil power |
| **12**| **Relay Module** | `GND` | **`GND`** | ⚫ Black | Relay Ground |
| **13**| **Relay Module** | **`IN1` (Relay 1)** | **`GPIO23`** | 🟠 Orange | **Main Load Contactor Control** (Active-LOW) |
| **14**| **Buzzer** | `+ (Positive)` | **`GPIO25`** | 🔔 Red/Yellow | Audible Alarm (`HIGH` = Beep on fault) |
| **15**| **Buzzer** | `- (Negative)` | **`GND`** | ⚫ Black | Buzzer Ground |

---

### High-Voltage AC Mains & Load Wiring (230V AC — Dangerous!)

| # | From | Terminal Label | To | Terminal Label | Wire Gauge / Color | Function |
|---|:---|:---|:---|:---|:---|:---|
| **1** | **230V AC Mains Live** | **Phase Line (L)** | **MCB / Fuse (10A)** | **Input Terminal** | 🟤 Brown / 🔴 Red (1.5 mm²) | Main incoming Live protection line |
| **2** | **MCB / Fuse Output** | **Protected Phase** | **PZEM-004T V3** | **`L` (Voltage Sense)** | 🟤 Brown (0.75 mm²) | Voltage sensing for PZEM internal meter |
| **3** | **MCB / Fuse Output** | **Protected Phase** | **Relay Module** | **`COM` (Relay 1)** | 🟤 Brown / 🔴 Red (1.5 mm²) | Switched main power to contactor |
| **4** | **Relay Module** | **`NO` (Relay 1)** | **AC Load** | **Live Terminal (`L`)** | 🟤 Brown (1.5 mm²) | **Passes through CT clamp** to power load |
| **5** | **230V AC Mains Neutral**| **Neutral Line (N)** | **PZEM-004T V3** | **`N` (Voltage Sense)** | 🔵 Blue / ⚫ Black (0.75 mm²) | Neutral reference for voltage measurement |
| **6** | **230V AC Mains Neutral**| **Neutral Line (N)** | **AC Load** | **Neutral Terminal (`N`)** | 🔵 Blue / ⚫ Black (1.5 mm²) | Load neutral return line |
| **7** | **230V AC Mains Earth** | **Earth (PE)** | **AC Load** | **Earth / Chassis (`PE`)**| 🟢/🟡 Green-Yellow (1.5 mm²) | Protective safety grounding |
| **8** | **Current Transformer** | **Black Wire** | **PZEM-004T V3** | **CT Screw Terminal 1** | Wire from CT | Current sense induction loop |
| **9** | **Current Transformer** | **Red / White Wire** | **PZEM-004T V3** | **CT Screw Terminal 2** | Wire from CT | Current sense induction loop |

> [!WARNING]
> **CT CLAMP SINGLE-CONDUCTOR RULE**:
> Pass **ONLY the single Live wire** going from Relay 1 `NO` to the load through the CT coil. Never pass both Live and Neutral through the CT coil together.

---

## 2.1 Relay Contact Terminal Architecture & Fail-Safe Protection (COM vs NO vs NC)

### A. The 3 Relay Terminals
The AC side of the electromechanical relay module (e.g., Songle SRD-05VDC-SL-C) features 3 heavy-duty screw terminals:
1. **`COM` (Common)**: The central moving armature contact. Connect incoming AC Live (from fuse/MCB) here.
2. **`NO` (Normally Open)**: Disconnected from `COM` when the relay coil is unpowered (air gap). Connected to `COM` ONLY when the coil is energized by the ESP32. **This is the ONLY correct terminal for load protection!**
3. **`NC` (Normally Closed)**: Electrically shorted to `COM` by an internal mechanical spring whenever the coil is unpowered (de-energized). Opens only when the coil is energized.

```
          [ DE-ENERGIZED (Fault State / Coil OFF) ]
                ┌─────────── NC  <--- Connected by internal spring!
                │
  COM ──────────┘ (moving contact)
                
                . . . . . . NO   <--- Air gap (Open circuit)


          [ ENERGIZED (Normal Safe State / Coil ON) ]
                . . . . . . NC   <--- Air gap (Open circuit)
                
  COM ──────────┐ (moving contact)
                │
                └─────────── NO  <--- Pulled by electromagnet! Connected!
```

### B. Logic Table for Active-LOW Relay Module
| System State | ESP32 GPIO23 Level | Optocoupler | Relay Coil | Onboard Relay LED | COM $\leftrightarrow$ NO Contact | COM $\leftrightarrow$ NC Contact | Connected Load (if wired to NO) |
|---|:---|:---|:---|:---|:---|:---|:---|
| **Booting / Power-Up** | `HIGH` (3.3V) | OFF | De-energized | **OFF** | **OPEN** | CLOSED | **ISOLATED (Safe)** |
| **Normal Mains Safe** | `LOW` (0V) | ON | **ENERGIZED** | **ON (Lit)** | **CLOSED (Conducting)** | OPEN | **ENERGIZED (Active)** |
| **Fault Trip (OV / UV / OP)** | `HIGH` (3.3V) | OFF | **DE-ENERGIZED** | **OFF (Dark)** | **OPEN (Air gap)** | **CLOSED** | **ISOLATED (Protected)** |
| **ESP32 Power Loss / Offline** | Floating/0V unpowered | OFF | **DE-ENERGIZED** | **OFF (Dark)** | **OPEN (Air gap)** | **CLOSED** | **ISOLATED (Fail-Safe)** |

### C. Root Cause: Why the Bulb Continues Glowing When the LED Turns OFF
When a fault (such as `OVER_VOLTAGE`) occurs:
1. The ESP32 correctly identifies the threshold breach and transitions to `STATE_TRIP`.
2. The ESP32 drives GPIO 23 `HIGH` (`RELAY_OFF`).
3. The optocoupler turns off, coil de-energizes, and the onboard relay LED turns **OFF**.
4. **If the bulb is wired across `COM` and `NC`**:
   - De-energizing the coil releases the armature spring, snapping COM directly onto **`NC`**!
   - Mains Live flows continuously through the `NC` contact to the bulb, keeping it powered!
5. **Alternative Failure Mode — Contact Welding / Fusing**:
   - If wired to `NO`, high inrush current or contact arcing from an inductive/capacitive load may have physically fused the silver alloy contact tips together. Even though the coil de-energizes, the contacts remain welded shut.
6. **Relay Bypass**:
   - The load live wire is connected directly to the incoming live distribution block, bypassing the relay terminals entirely.

> [!CAUTION]
> Software alone cannot physically break an electrical connection if the physical wire is screwed into the `NC` terminal or if the contacts are welded together. The physical wire must be corrected.

---

## 2.2 Safe Low-Voltage Multimeter Continuity Test Procedure (ZERO AC Mains Power!)

Perform this test to verify the relay contacts and wiring without ever exposing yourself to live 230V AC mains.

### Test Equipment & Preparation:
- Digital Multimeter set to **Continuity mode (Beep / Diode symbol)** or **Resistance ($\Omega$) mode**.
- ESP32 connected via USB cable to your laptop/PC (5V low voltage only).
- **CRITICAL SAFETY STEP**: **UNPLUG THE 230V AC MAINS PLUG FROM THE WALL SOCKET COMPLETELY.** Verify with a non-contact voltage tester that zero AC voltage is present.

### Step-by-Step Continuity Test:
1. **Unpowered Relay Module Test (Zero power to ESP32 and Relay)**:
   - Place multimeter Black probe on `COM` screw terminal.
   - Touch Red probe to `NO` screw terminal: Multimeter must read **`O.L` (Open Loop / Infinite resistance, NO beep)**.
   - Touch Red probe to `NC` screw terminal: Multimeter must **BEEP and read $< 0.5\,\Omega$**.
   - *If `COM` and `NO` beep while completely unpowered, the contacts are mechanically welded and the relay module must be replaced.*
2. **Powered Safe State Test (ESP32 running in Normal State)**:
   - Connect ESP32 to USB. Open Arduino Serial Monitor (`115200` baud).
   - Type command `ON` or let auto protection run under valid safe telemetry.
   - The relay LED on the module turns **ON** and an audible "click" is heard.
   - Measure `COM` to `NO`: Multimeter must **BEEP and read $< 0.5\,\Omega$** (Closed circuit).
   - Measure `COM` to `NC`: Multimeter must read **`O.L` (Open circuit, NO beep)**.
3. **Trip State Test (ESP32 commanded OFF)**:
   - In Serial Monitor, type `OFF`.
   - The relay LED turns **OFF** and an audible "click" is heard.
   - Measure `COM` to `NO`: Multimeter must immediately read **`O.L` (Open circuit, NO beep)**!
   - *This confirms that a load wired across COM and NO will be 100% physically isolated when the relay trips.*

---

## 2.3 Physical Correction & Rewiring Checklist

1. **Disconnect all power**: Pull the AC mains power plug from the socket.
2. **Inspect the Relay 1 screw terminal block**:
   - Verify which terminal the load wire is connected to.
   - **Correct connection**:
     - One wire from Mains Live $\rightarrow$ **`COM`**.
     - One wire from **`NO`** $\rightarrow$ Passes through PZEM CT coil $\rightarrow$ Connects to Load Live (`L`).
     - Terminal **`NC`** must be left **COMPLETELY EMPTY / UNCONNECTED**.
3. **Check Current Transformer (CT)**:
   - Ensure the single Live wire passing from `NO` to the load passes through the center of the CT ring.
   - When the relay trips (`OFF`), the CT measures `0.000 A`, which validates physical disconnection on the dashboard.

---

## 3. Flash Instructions (PlatformIO / Arduino IDE)

### Option A: Using PlatformIO (VSCode)
1. Open the project root in VSCode with PlatformIO installed.
2. Open `firmware/include/config.h` and edit:
   ```cpp
   #define WIFI_SSID_DEFAULT     "YOUR_WIFI_SSID"
   #define WIFI_PASS_DEFAULT     "YOUR_WIFI_PASSWORD"
   ```
3. Connect ESP32 via USB and click **Upload** (or run `pio run --target upload` in `firmware/`).

### Option B: Using Arduino IDE
1. Open Arduino IDE.
2. Install required libraries via **Tools $\rightarrow$ Manage Libraries**:
   - `PZEM-004T v30` by Jakub Mandula
   - `ArduinoJson` by Benoit Blanchon (v7.x)
   - `LiquidCrystal_I2C` by Frank de Brabander
3. Open `firmware/arduino/esp32_smart_meter/esp32_smart_meter.ino`.
4. Update `WIFI_SSID` and `WIFI_PASSWORD`.
5. Select Board: **ESP32 Dev Module** and Port, then click **Upload**.

---

## 4. Hardware Verification & Commissioning (Relay 1 Focus)

| # | Test Name | Verification Procedure | Expected Result |
|---|:---|:---|:---|
| **1** | **ESP32 Boot** | Power on via 5V DC supply | Serial monitor displays startup banner at 115200 baud |
| **2** | **Wi-Fi Connection** | Provide valid SSID and password | Connects within 5s, prints local IP, LED turns solid ON |
| **3** | **PZEM UART Comm** | Connect GPIO16 (RX) to PZEM TX & GPIO17 (TX) to PZEM RX | No Modbus timeout errors in serial monitor |
| **4** | **Real Measurements** | Connect 230V AC socket to PZEM L/N | Voltage reads $\sim 230\text{ V}$, frequency reads $\sim 50\text{ Hz}$ |
| **5** | **Supabase Ingestion**| Observe serial log during upload tick | `HTTP 201 Created` on `/rest/v1/energy_readings` |
| **6** | **Dashboard Live View**| Open `http://localhost:3000` | Telemetry cards update in real time with exact physical meter readings |
| **7** | **Device Status** | Check header badge on dashboard | Displays `🟢 Wi-Fi Online` (or `Hardware Live`) with active second ticker |
| **8** | **Relay 1 Control** | Verify Relay 1 click on boot after safe voltage reading | Relay 1 contactor energizes (`COM` connects to `NO`) |
| **9** | **Normal Condition** | Voltage within $180\text{V} - 260\text{V}$ range | Relay 1 stays CLOSED (`ON`), Load remains powered |
| **10**| **Over-Voltage Trip** | Lower Over-Voltage threshold in Settings below mains voltage | Relay 1 trips `OFF` immediately ($\le 50\text{ms}$), buzzer sounds |
| **11**| **Under-Voltage Trip**| Raise Under-Voltage threshold in Settings above mains voltage | Relay 1 trips `OFF` immediately, buzzer sounds |
| **12**| **Over-Power Trip** | Connect high load or lower power limit | Relay 1 trips `OFF` immediately on threshold breach |
| **13**| **Continuous Fault** | Maintain fault condition for 60 seconds | Relay 1 stays strictly `OFF`; no duplicate alerts flood Supabase |
| **14**| **Fault Recovery** | Restore normal threshold in Settings | Readings stay safe for 5s hold timer $\rightarrow$ Relay 1 recloses (`ON`) |
| **15**| **Live OV Setting Sync**| Change Over-Voltage from $260\text{V} \rightarrow 240\text{V}$ on web | ESP32 fetches new threshold on next 10s sync tick |
| **16**| **Live UV Setting Sync**| Change Under-Voltage from $180\text{V} \rightarrow 200\text{V}$ on web | ESP32 fetches new threshold without reboot |
| **17**| **Live Power Limit Sync**| Change Power Limit from $2000\text{W} \rightarrow 1500\text{W}$ on web | ESP32 applies new power limit immediately |
| **18**| **Live Tariff Sync** | Change Tariff rate from $₹6.0 \rightarrow ₹7.5/\text{kWh}$ on web | Realtime cost calculations update instantly |
| **19**| **Wi-Fi Loss Watchdog**| Turn off Wi-Fi router | LCD indicates `[OFFL]`, Relay 1 protection continues autonomously |
| **20**| **Wi-Fi Restoration** | Turn router back on | ESP32 reconnects automatically within 10s and resumes cloud uploads |
| **21**| **Simulator Independence**| Run `npm run dev` in `simulator/` | Simulator works independently with `connection_type="simulation"` |
