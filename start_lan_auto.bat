@echo off
REM Detect Wi-Fi IPv4 and bind Expo to it for LAN mode
setlocal ENABLEDELAYEDEXPANSION

for /f "tokens=1,2 delims=:" %%A in ('ipconfig ^| findstr /R /C:"Wireless LAN adapter Wi-Fi" /C:"IPv4 Address"') do (
    if /I "%%A"=="   IPv4 Address. . . . . . . . . . . :" (
        set ip=%%B
    )
)

if not defined ip (
    echo Could not detect Wi-Fi IPv4. Falling back to tunnel.
    call npm run start:tunnel
    goto :eof
)

REM Trim spaces
for /f "tokens=*" %%I in ("%ip%") do set ip=%%I

echo Using Wi-Fi IPv4 %ip%
set EXPO_DEV_SERVER_HOST=%ip%:8081
call npm run start:lan
