// Génère les icônes PWA/Android de Kreatly à partir d'un SVG (triangle
// "play" blanc sur fond orange charte #FF6B35), via sharp.
//
//   node scripts/generate-icons.mjs
//
// Sorties dans public/ : icon-192.png, icon-512.png,
// icon-maskable-512.png, apple-touch-icon.png
//
// L'icône "any" = carré arrondi (look propre dans le navigateur).
// L'icône "maskable" = plein cadre, glyphe dans la zone sûre (Android
// applique sa propre forme de masque).

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

const ORANGE = "#FF6B35";

// Triangle "play" blanc, centré optiquement, coins adoucis (stroke rond).
// Coordonnées dans une grille 24×24 (comme les icônes Lucide).
const play = (strokeW) => `
    <path d="M9 6.5 L18.5 12 L9 17.5 Z" fill="#ffffff" stroke="#ffffff" stroke-width="${strokeW}" stroke-linejoin="round" stroke-linecap="round"/>`;

// Icône standard : carré arrondi orange + triangle centré (~50% du cadre).
const anySvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="${ORANGE}"/>
  <g transform="translate(128,128) scale(10.6667)">${play(2)}</g>
</svg>`;

// Icône maskable : plein cadre orange + triangle plus petit (zone sûre ~45%).
const maskableSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="${ORANGE}"/>
  <g transform="translate(154,154) scale(8.5)">${play(2)}</g>
</svg>`;

async function render(svg, size, outName) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(PUBLIC, outName));
  console.log("✓", outName, `${size}x${size}`);
}

await render(anySvg, 192, "icon-192.png");
await render(anySvg, 512, "icon-512.png");
await render(maskableSvg, 512, "icon-maskable-512.png");
await render(anySvg, 180, "apple-touch-icon.png");
console.log("Icônes générées dans public/.");
