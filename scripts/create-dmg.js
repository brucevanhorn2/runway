#!/usr/bin/env node

const createDMG = require('electron-installer-dmg');
const path = require('path');
const fs = require('fs');
const { version } = require('../package.json');

const appPath = path.join(__dirname, '..', 'release', 'mac-arm64', 'Runway.app');
const outPath = path.join(__dirname, '..', 'release', `Runway-${version}-arm64`);

// Check if app exists
if (!fs.existsSync(appPath)) {
  console.error('❌ App not found at:', appPath);
  console.error('Run: npx electron-builder --mac --dir first');
  process.exit(1);
}

console.log('Creating DMG with custom background...');

const options = {
  appPath: appPath,
  name: `Runway-${version}-arm64`,
  out: path.join(__dirname, '..', 'release'),
  overwrite: true,
  background: path.join(__dirname, '..', 'build', 'dmg-background.png'),
  icon: path.join(__dirname, '..', 'build', 'icon.png'),
  iconSize: 100,
  contents: [
    { x: 140, y: 230, type: 'file', path: appPath },
    { x: 460, y: 230, type: 'link', path: '/Applications' }
  ],
  window: {
    size: {
      width: 600,
      height: 450
    }
  },
  format: 'UDZO'
};

createDMG(options)
  .then(() => {
    console.log('✅ DMG created successfully:', outPath + '.dmg');
  })
  .catch((err) => {
    console.error('❌ Error creating DMG:', err);
    process.exit(1);
  });
