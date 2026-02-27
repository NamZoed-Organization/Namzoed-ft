/**
 * Generates splash screen logo PNGs for all Android density buckets.
 * Replaces ONLY the splashscreen_logo.png files — nothing else is modified.
 * Output is a rounded square (20% corner radius) with transparent background.
 *
 * Run once:
 *   npm install --save-dev sharp
 *   node scripts/generate-splash.js
 */

const sharp = require("sharp");
const path = require("path");

const LOGO = path.join(__dirname, "../icon.png");
const DRAWABLE_BASE = path.join(
  __dirname,
  "../android/app/src/main/res"
);

// imageWidth in app.json is 200dp — scale per density
const DENSITIES = [
  { folder: "drawable-mdpi",    width: 200 },
  { folder: "drawable-hdpi",    width: 300 },
  { folder: "drawable-xhdpi",   width: 400 },
  { folder: "drawable-xxhdpi",  width: 600 },
  { folder: "drawable-xxxhdpi", width: 800 },
];

async function makeRoundedSquare(inputPath, outputPath, size) {
  const radius = Math.round(size * 0.2); // 20% corner radius

  // SVG rounded rectangle used as an alpha mask
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}"/>
    </svg>`
  );

  await sharp(inputPath)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toFile(outputPath);
}

async function run() {
  for (const { folder, width } of DENSITIES) {
    const out = path.join(DRAWABLE_BASE, folder, "splashscreen_logo.png");
    await makeRoundedSquare(LOGO, out, width);
    console.log(`✓ ${folder}/splashscreen_logo.png  (${width}px)`);
  }
  console.log("\nDone. Run ./gradlew assembleRelease to build.");
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
