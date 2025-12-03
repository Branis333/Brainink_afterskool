# Google Play Store Deployment Guide for Skana Mobile App

## 📋 Overview
This guide will walk you through deploying your **Skana Mobile App** to the Google Play Store for production. Your app is a React Native Expo application for school management with image upload functionality.

## 🚀 Pre-Deployment Checklist

### ✅ Step 1: Project Analysis Complete
- **App Type**: React Native Expo app
- **Main Features**: Authentication, Role Selection, Image Upload for schools
- **Target Platforms**: Android (Google Play Store)
- **Bundle ID**: com.brainink.skana

### ✅ Step 2: Dependencies & Setup (COMPLETED)
- [x] Dependencies installed
- [x] Expo CLI installed globally
- [x] EAS CLI installed globally
- [x] app.json configured for production
- [x] eas.json created

## 🔧 Required Configurations Before Building

### 1. Google Play Console Setup
1. **Create Google Play Console Account**
   - Go to https://play.google.com/console
   - Pay the $25 one-time registration fee
   - Complete account verification

2. **Create New App in Console**
   - App name: "Skana"
   - Package name: com.brainink.skana
   - Select "App" (not game)
   - Select "Free" (or paid if you want to charge)

### 2. App Store Listing Requirements

#### Required Assets (You need to create these):
- **App Icon**: 512x512 PNG (high-resolution)
- **Feature Graphic**: 1024x500 PNG
- **Screenshots**: 
  - Phone: at least 2 screenshots (320dp to 3840dp)
  - Tablet: at least 1 screenshot (if supporting tablets)
- **Privacy Policy URL** (required for apps handling user data)

#### App Description:
```
Skana - School Image Management System

Streamline your school's image management with Skana. This app allows teachers and principals to securely upload, organize, and manage student images with proper authentication and role-based access control.

Features:
• Secure login and authentication
• Role-based access (Teacher/Principal)
• School selection and management
• Image upload from camera or gallery
• Organized image categorization
• Subject and classroom management

Perfect for schools looking to digitize their image management workflow with security and ease of use in mind.
```

### 3. Create Expo Account and Project
```bash
# Login to Expo (you'll need to create account first)
npx expo login

# Initialize EAS project
cd "c:\Users\HP\Skana"
eas init
```

### 4. Update Project ID in app.json
After running `eas init`, update the projectId in your app.json file.

## 🏗️ Building for Production

### Step 1: Build APK for Testing
```bash
# Build APK for internal testing
eas build --platform android --profile preview
```

### Step 2: Build Production AAB
```bash
# Build Android App Bundle for Play Store
eas build --platform android --profile production
```

### Step 3: Download and Test
1. Download the APK from EAS dashboard
2. Install on test devices
3. Test all functionality thoroughly

## 📱 App Store Requirements Compliance

### Content Rating
Your app will need content rating based on:
- **Target Audience**: Likely "Everyone" or "Everyone 10+"
- **Data Collection**: User authentication, image uploads
- **Educational**: Mark as educational app

### Permissions Required
Your app uses these permissions (already configured):
- `CAMERA` - For taking photos
- `READ_EXTERNAL_STORAGE` - For accessing gallery
- `WRITE_EXTERNAL_STORAGE` - For saving images

### Privacy & Security
⚠️ **CRITICAL**: Your app collects personal data, so you need:
1. **Privacy Policy** (mandatory)
2. **Data Safety section** in Play Console
3. **Proper data encryption** (verify your backend API uses HTTPS)

## 📋 Upload to Google Play Store

### 1. Upload AAB File
1. Go to Google Play Console
2. Select your app
3. Go to "Release" → "Production"
4. Click "Create new release"
5. Upload your .aab file
6. Fill in release notes

### 2. Complete Store Listing
1. **App details**: Name, description, category
2. **Graphics**: Upload all required images
3. **Content rating**: Complete questionnaire
4. **Target audience**: Select appropriate age groups
5. **Data safety**: Declare data collection practices

### 3. Release Strategy
**Recommended approach:**
1. **Internal Testing** → Upload and test with team
2. **Closed Testing** → Test with small group of users
3. **Open Testing** → Beta testing with larger audience
4. **Production** → Full public release

## 🔍 Pre-Launch Checklist

### Technical Checks
- [ ] App builds successfully without errors
- [ ] All features work as expected
- [ ] Login/authentication works with backend
- [ ] Image upload functionality works
- [ ] App doesn't crash on different screen sizes
- [ ] Network connectivity handled properly
- [ ] Proper error handling implemented

### Store Compliance
- [ ] Privacy policy created and linked
- [ ] Content rating completed
- [ ] Data safety section filled
- [ ] All required graphics uploaded
- [ ] App description written and compelling
- [ ] Target audience selected correctly

### Backend Verification
- [ ] Backend API (https://brainink-backend.onrender.com) is stable
- [ ] API endpoints handle production load
- [ ] Database is properly secured
- [ ] User data is encrypted

## 🚨 Important Notes

1. **Privacy Policy Required**: Since your app collects user data (login, images), a privacy policy is MANDATORY
2. **HTTPS Backend**: Ensure your backend uses HTTPS (it does: https://brainink-backend.onrender.com)
3. **Image Storage**: Consider where uploaded images are stored and ensure compliance
4. **User Consent**: May need user consent for image collection in educational context
5. **COPPA Compliance**: If used by children under 13, additional requirements apply

## 📞 Next Steps

1. **Create Expo account** and run `eas init`
2. **Set up Google Play Console account**
3. **Create privacy policy** for your app
4. **Design required graphics** (icons, screenshots, feature graphic)
5. **Build and test** the APK version first
6. **Upload to Play Console** following the checklist above

## 🔗 Useful Links

- [Google Play Console](https://play.google.com/console)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Google Play Policy Center](https://play.google.com/about/developer-policy-center/)
- [Privacy Policy Generator](https://www.privacypolicytemplate.net/)

---

**Ready to start?** Run the commands below to begin the deployment process!
