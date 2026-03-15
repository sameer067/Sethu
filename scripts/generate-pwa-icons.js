/**
 * Run with: node scripts/generate-pwa-icons.js
 * Creates placeholder PWA icons so the app can be installed. Replace with proper icons for production.
 */

const fs = require("fs");
const path = require("path");

// Minimal 1x1 transparent PNG (base64)
const minimalPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const publicDir = path.join(__dirname, "..", "public");
[192, 512].forEach((size) => {
  fs.writeFileSync(path.join(publicDir, `icon-${size}.png`), minimalPng);
});
console.log("Placeholder PWA icons written. Replace with proper 192x192 and 512x512 icons for production.");
