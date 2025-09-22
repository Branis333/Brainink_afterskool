@echo off
echo 🚀 Skana Mobile App - Google Play Store Deployment Script
echo =======================================================

echo.
echo 📋 Pre-flight checklist:
echo [✅] Dependencies installed
echo [✅] EAS CLI ready
echo [✅] app.json configured
echo [✅] eas.json created
echo.

echo 🔐 Step 1: Login to Expo (if not already logged in)
echo Run: npx expo login
echo.

echo 🎯 Step 2: Initialize EAS project
echo Run: eas init
echo.

echo 🏗️ Step 3: Build APK for testing
echo Run: eas build --platform android --profile preview
echo.

echo 🎯 Step 4: Build production AAB for Play Store
echo Run: eas build --platform android --profile production
echo.

echo 📱 Step 5: Upload to Google Play Console
echo - Download AAB from EAS dashboard
echo - Upload to Google Play Console
echo - Complete store listing
echo.

echo ⚠️  IMPORTANT REQUIREMENTS:
echo - Google Play Console account ($25 fee)
echo - Privacy Policy (mandatory for data collection)
echo - App screenshots and graphics
echo - Content rating questionnaire
echo.

echo 📖 For detailed instructions, see: DEPLOYMENT_GUIDE.md
echo.

pause
