// Génère les icônes PWA/Android de Mohtawa à partir d'un SVG (glyphe
// "sparkles" blanc sur fond orange charte #FF6B35), via sharp.
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

// Glyphe Lucide "sparkles" : grande étoile remplie + 2 petits éclats.
const sparkles = (stroke) => `
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" fill="#ffffff" stroke="#ffffff" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="M20 3v4" stroke="#ffffff" stroke-width="${stroke}" stroke-linecap="round" fill="none"/>
    <path d="M22 5h-4" stroke="#ffffff" stroke-width="${stroke}" stroke-linecap="round" fill="none"/>
    <path d="M4 17v2" stroke="#ffffff" stroke-width="${stroke}" stroke-linecap="round" fill="none"/>
    <path d="M5 18H3" stroke="#ffffff" stroke-width="${stroke}" stroke-linecap="round" fill="none"/>`;

// Icône standard : carré arrondi orange + glyphe centré (~50% du cadre).
const anySvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="${ORANGE}"/>
  <g transform="translate(128,128) scale(10.6667)">${sparkles(1.5)}</g>
</svg>`;

// Icône maskable : plein cadre orange + glyphe plus petit (zone sûre ~45%).
const maskableSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="${ORANGE}"/>
  <g transform="translate(154,154) scale(8.5)">${sparkles(1.5)}</g>
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
