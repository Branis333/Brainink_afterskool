#!/bin/bash

echo "🚀 Setting up Skana Mobile App..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if Expo CLI is installed globally
if ! command -v expo &> /dev/null; then
    echo "📱 Installing Expo CLI globally..."
    npm install -g @expo/cli
else
    echo "✅ Expo CLI is already installed"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure you have Expo Go app installed on your phone"
echo "2. Run 'npm start' to start the development server"
echo "3. Scan the QR code with Expo Go app"
echo ""
echo "Happy coding! 🚀"
