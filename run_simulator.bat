@echo off
title Smart Energy Meter - Simulator
cd /d "%~dp0simulator"

echo ========================================================
echo       Smart Energy Meter - Simulator Launcher
echo ========================================================
echo.
echo Select simulation mode:
echo   [1] Normal Simulation (Default ~230V, ~2A)
echo   [2] Over-Voltage Fault Test (>250V trip)
echo   [3] Under-Voltage Fault Test (<180V trip)
echo   [4] Over-Power Fault Test (>2000W trip)
echo   [5] Sensor Comm Failure Test
echo   [6] Offline Dry-Run (Terminal only, no Supabase needed)
echo.
set /p choice="Enter option [1-6] (Default is 1): "

if "%choice%"=="2" goto overvoltage
if "%choice%"=="3" goto undervoltage
if "%choice%"=="4" goto overpower
if "%choice%"=="5" goto fault
if "%choice%"=="6" goto dryrun
goto normal

:normal
echo Starting Normal Simulation...
npx tsx src/index.ts --mode normal
pause
exit

:overvoltage
echo Starting Over-Voltage Fault Simulation...
npx tsx src/index.ts --mode over_voltage
pause
exit

:undervoltage
echo Starting Under-Voltage Fault Simulation...
npx tsx src/index.ts --mode under_voltage
pause
exit

:overpower
echo Starting Over-Power Fault Simulation...
npx tsx src/index.ts --mode over_power
pause
exit

:fault
echo Starting Sensor Comm Failure Simulation...
npx tsx src/index.ts --mode comm_failure
pause
exit

:dryrun
echo Starting Offline Dry-Run (No Supabase required)...
npx tsx src/index.ts --dry-run
pause
exit
