#!/bin/bash

echo "⬇️ Pulling latest..."
git pull

echo "📦 Installing packages..."
npm install

echo "🏗️ Building app..."
npm run build

echo "📱 Syncing Capacitor..."
npx cap sync ios

echo "🚀 Opening Xcode..."
npx cap open ios
