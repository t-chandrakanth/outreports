// Regenerates public/favicon.svg and the PWA PNG icons from one template.
// Run after changing BRAND: node scripts/render-icons.mjs
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const BRAND = '#2C7A7B'; // Chakra teal.600 = theme primary.main

// "OUT" name-board on a 64-unit canvas.
const board = `
  <rect x="8" y="14" width="48" height="2.5" fill="#ffffff" opacity="0.9"/>
  <rect x="8" y="47.5" width="48" height="2.5" fill="#ffffff" opacity="0.9"/>
  <text x="32" y="40.5" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="800" letter-spacing="1" fill="#ffffff" text-anchor="middle">OUT</text>`;

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}\n</svg>\n`;

const rounded = svg(`\n  <rect width="64" height="64" rx="12" fill="${BRAND}"/>${board}`);
const square = svg(`\n  <rect width="64" height="64" fill="${BRAND}"/>${board}`);
// Maskable: full-bleed background, artwork shrunk into the 80% safe zone.
const maskable = svg(
  `\n  <rect width="64" height="64" fill="${BRAND}"/>\n  <g transform="translate(32 32) scale(0.75) translate(-32 -32)">${board}\n  </g>`,
);

const png = (source, size, file) =>
  sharp(Buffer.from(source), { density: (72 * size) / 64 }).resize(size, size).png().toFile(file);

await writeFile('public/favicon.svg', rounded);
await Promise.all([
  png(rounded, 192, 'public/icons/icon-192.png'),
  png(rounded, 512, 'public/icons/icon-512.png'),
  png(maskable, 512, 'public/icons/maskable-512.png'),
  png(square, 180, 'public/icons/apple-touch-icon.png'), // iOS applies its own mask
]);
console.log('icons rendered in', BRAND);
