#!/bin/bash

# Build DMG with background image
# Uses appdmg which supports custom backgrounds and positioning

set -e

echo "Building Runway app..."
npx webpack --mode production

echo "Building mac app bundle with electron-builder..."
npx electron-builder --mac --dir

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

echo "Creating DMG with custom background and icon positioning..."
npx appdmg scripts/appdmg-config.json "release/Runway-${VERSION}-arm64.dmg"

echo "✅ DMG created successfully: release/Runway-${VERSION}-arm64.dmg"
