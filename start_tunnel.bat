@echo off
REM Start Expo using tunnel (works across networks/VPNs)
cd /d "%~dp0"
call npm run start:tunnel
