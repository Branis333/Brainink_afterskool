@echo off
echo 🚀 Setting up Skana Mobile App...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ Node.js and npm are installed

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Check if Expo CLI is installed globally
expo --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 📱 Installing Expo CLI globally...
    npm install -g @expo/cli
) else (
    echo ✅ Expo CLI is already installed
)

echo.
echo 🎉 Setup complete!
echo.
echo Next steps:
echo 1. Make sure you have Expo Go app installed on your phone
echo 2. Run 'npm start' to start the development server
echo 3. Scan the QR code with Expo Go app
echo.
echo Happy coding! 🚀
pause
