@echo off
title Smart Energy Meter - Web Dashboard
cd /d "%~dp0dashboard"

echo ========================================================
echo       Starting Smart Energy Meter Web Dashboard...
echo ========================================================
echo.
echo Dashboard will be available at: http://localhost:3000
echo.
npm run dev
pause
