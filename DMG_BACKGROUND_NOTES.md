# DMG Background Configuration

## ⚠️ Known Issue

**electron-builder has a known bug with DMG backgrounds on macOS Ventura (13.0+) and Sonoma (14.0+)**

The background image configuration is correct in package.json, but electron-builder 26.x doesn't properly apply backgrounds due to Apple's changes in how DMG .DS_Store files work.

## Workaround Solution

Use the **create-dmg** tool to manually create a DMG with your background:

### Step 1: Install create-dmg
```bash
npm install --save-dev create-dmg
```

### Step 2: Create a script `scripts/build-dmg.sh`:
```bash
#!/bin/bash

# Build the app first
npm run build
npx electron-builder --mac --dir

# Create DMG with background
npx create-dmg \
  --overwrite \
  --window-size 600 450 \
  --icon-size 100 \
  --icon "Runway.app" 140 230 \
  --app-drop-link 460 230 \
  --background "build/dmg-background.png" \
  "release/Runway-$(node -p "require('./package.json').version")-arm64.dmg" \
  "dist/mac-arm64/Runway.app"
```

### Step 3: Make it executable and run:
```bash
chmod +x scripts/build-dmg.sh
./scripts/build-dmg.sh
```

## Alternative: Use appdmg

Another option is to use `appdmg`:

```bash
npm install --save-dev appdmg
```

Create `build/appdmg.json`:
```json
{
  "title": "Install Runway",
  "background": "dmg-background.png",
  "icon-size": 100,
  "contents": [
    { "x": 140, "y": 230, "type": "file", "path": "../dist/mac-arm64/Runway.app" },
    { "x": 460, "y": 230, "type": "link", "path": "/Applications" }
  ],
  "window": {
    "size": {
      "width": 600,
      "height": 450
    }
  }
}
```

Then run:
```bash
appdmg build/appdmg.json release/Runway.dmg
```

## Current Configuration (in package.json)

The DMG settings are configured but won't work until electron-builder fixes the bug:

- Background: `build/dmg-background.png` (600x400)
- Icon size: 100px
- App icon: x=140, y=230
- Applications folder: x=460, y=230
- Window: 600x450

## Files Available

- `build/dmg-background.png` - Original 600x400 PNG
- `build/dmg-background@2x.png` - Retina 1200x800 PNG
- `build/dmg-background.tiff` - TIFF version
- `build/dmg-background-multi.tiff` - Multi-resolution TIFF

## Why This Happens

Apple changed how Finder reads .DS_Store files in DMGs starting with macOS Ventura. electron-builder uses an older method that no longer works reliably. The `create-dmg` and `appdmg` packages use updated methods that work with current macOS versions.

## References

- [electron-builder issue #6606](https://github.com/electron-userland/electron-builder/issues/6606)
- [electron-builder issue #7704](https://github.com/electron-userland/electron-builder/issues/7704)
- [create-dmg package](https://github.com/sindresorhus/create-dmg)

