const fs = require('fs');
const path = require('path');

// Minimal 1x1 PNG (valid placeholder)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const assetsDir = path.join(__dirname, '../apps/mobile/assets');
fs.mkdirSync(assetsDir, { recursive: true });

for (const name of ['icon.png', 'splash-icon.png', 'adaptive-icon.png', 'favicon.png']) {
  fs.writeFileSync(path.join(assetsDir, name), PNG);
  console.log(`Created ${name}`);
}
