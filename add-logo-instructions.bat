@echo off
echo 🧠 SKANA BRAIN LOGO SETUP GUIDE
echo ================================

echo.
echo ✅ GOOD NEWS: Your app.json is already configured for the brain logo!
echo.

echo 📋 Current Configuration:
echo - App Icon: ./assets/brain-logo.png
echo - Splash Screen: ./assets/brain-logo.png  
echo - Android Adaptive Icon: ./assets/brain-logo.png
echo.

echo 🎯 WHAT YOU NEED TO DO:
echo.
echo 1. SAVE YOUR BRAIN LOGO IMAGE:
echo    - Right-click the blue brain image
echo    - Save as: c:\Users\HP\Skana\assets\brain-logo.png
echo    - Replace the existing placeholder file
echo    - Make sure it's PNG format
echo.

echo 2. VERIFY CONFIGURATION:
echo    Run: npx expo-doctor
echo.

echo 3. REBUILD APK WITH LOGO:
echo    Run: eas build --platform android --profile preview
echo.

echo 4. MONITOR BUILD:
echo    Check: https://expo.dev/accounts/stephen3000/projects
echo.

echo 🚨 IMPORTANT: You MUST save the actual brain logo image first!
echo The current brain-logo.png is just a placeholder.
echo.

echo ⏱️ After saving the logo and rebuilding:
echo - Build takes 5-15 minutes
echo - Your app will have the brain logo as icon
echo - Professional branded APK ready for website
echo.

pause
