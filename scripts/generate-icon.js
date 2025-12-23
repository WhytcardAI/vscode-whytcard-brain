/**
 * Generate icon.png from brain.svg for VS Code Marketplace
 * Run: node scripts/generate-icon.js
 * Requires: npm install sharp (dev dependency)
 */

const fs = require("fs");
const path = require("path");

const mediaDir = path.join(__dirname, "..", "media");
const svgPath = path.join(mediaDir, "brain.svg");
const pngPath = path.join(mediaDir, "icon.png");

// Read SVG and create a proper 128x128 icon with background
const svgContent = fs.readFileSync(svgPath, "utf8");

// Create a styled SVG with background for the icon
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="16" fill="url(#bg)"/>
  <g transform="translate(24, 24) scale(3.33)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
    <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
    <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
    <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
    <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
    <path d="M6 18a4 4 0 0 1-1.967-.516"/>
    <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
  </g>
</svg>`;

// Try to use sharp if available, otherwise save SVG for manual conversion
try {
  const sharp = require("sharp");
  sharp(Buffer.from(iconSvg))
    .resize(128, 128)
    .png()
    .toFile(pngPath)
    .then(() => console.log("✓ Generated icon.png (128x128)"))
    .catch((err) => {
      console.error("Sharp error:", err);
      saveSvgFallback();
    });
} catch (e) {
  saveSvgFallback();
}

function saveSvgFallback() {
  // Save as SVG for manual conversion
  const iconSvgPath = path.join(mediaDir, "icon.svg");
  fs.writeFileSync(iconSvgPath, iconSvg);
  console.log(
    "⚠ Sharp not installed. Saved icon.svg - convert manually to icon.png (128x128)",
  );
  console.log("  Install sharp: npm install --save-dev sharp");
  console.log("  Then run: node scripts/generate-icon.js");
}
