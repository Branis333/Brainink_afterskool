# Skana Mobile App

A React Native mobile application for BrainInk school system that allows teachers and principals to upload and manage student images.

## Features

🔐 **Authentication**
- Login with username/password
- User registration
- Secure token-based authentication
- Role-based access control

👥 **Role Selection**
- School selection
- Teacher/Principal role assignment
- Email verification

📸 **Image Upload**
- Camera capture
- Gallery selection
- Image preview
- Metadata management (description, tags, subjects)
- View uploaded images

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- Expo CLI
- Expo Go app on your mobile device

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Install Expo CLI globally (if not already installed):**
   ```bash
   npm install -g @expo/cli
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Run on device:**
   - Install Expo Go app on your phone
   - Scan the QR code from the terminal
   - Or run on simulator:
     ```bash
     npm run ios     # for iOS simulator
     npm run android # for Android emulator
     ```

## Project Structure

```
src/
├── context/
│   └── AuthContext.tsx      # Authentication state management
├── navigation/
│   └── AppNavigator.tsx     # Navigation configuration
└── screens/
    ├── LoginScreen.tsx      # Login and registration
    ├── RoleSelectionScreen.tsx # School and role selection
    └── ImageUploadScreen.tsx   # Image upload and management
```

## Environment Variables

The app uses the following environment variables (already configured in `.env`):

- `API_BASE_URL` - Backend API URL
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `KANA_API_BASE_URL` - KANA chatbot API URL
- `AGENT_API_BASE_URL` - Agent API URL

## API Integration

The app integrates with your existing BrainInk backend:

### Authentication Endpoints
- `POST /login` - User login
- `POST /register` - User registration
- `POST /logout` - User logout

### Image Management Endpoints
- `POST /images-management/upload` - Upload new image
- `GET /images-management/my-images` - Get uploaded images
- `GET /images-management/{image_id}` - Get specific image
- `PUT /images-management/{image_id}` - Update image metadata
- `DELETE /images-management/{image_id}` - Delete image

## Features Overview

### 1. Login Screen
- Username/password authentication
- New user registration
- Form validation
- Error handling
- Modern UI design

### 2. Role Selection Screen
- Multi-step process (School → Role → Email)
- School selection from available options
- Teacher/Principal role selection
- Email confirmation
- Progress indicator

### 3. Image Upload Screen
- Camera capture and gallery selection
- Image preview before upload
- Metadata forms (description, tags, subject)
- Upload progress indication
- View previously uploaded images
- Logout functionality

## Key Technologies

- **React Native** - Cross-platform mobile development
- **Expo** - Development platform and tools
- **TypeScript** - Type safety
- **React Navigation** - Screen navigation
- **Expo Image Picker** - Camera and gallery access
- **Expo Secure Store** - Secure token storage
- **React Context** - State management

## Development Notes

- All API calls include proper error handling
- Secure token storage using Expo SecureStore
- Form validation and user feedback
- Responsive design for different screen sizes
- TypeScript for better code quality

## Troubleshooting

1. **Dependencies not installing:**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Metro bundler issues:**
   ```bash
   npx expo start --clear
   ```

3. **Permission issues:**
   - Ensure camera and media library permissions are granted
   - Check device settings if image picker doesn't work

## Build for Production

1. **Build for Android:**
   ```bash
   npx expo build:android
   ```

2. **Build for iOS:**
   ```bash
   npx expo build:ios
   ```

## Support

For technical support or questions about the app, please contact the development team.
