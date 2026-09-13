// Renders every icon and splash image from the two source files in assets/:
//   assets/LOGO.png        1254x1254 transparent; train emblem on top, wordmark below
//   assets/Splshscreen.png 1024x1536 photo used as the splash screen
// Run after replacing either file: npm run icons
//
// Outputs (all under public/):
//   favicon.png, icons/icon-192.png, icons/icon-512.png       emblem on a white rounded square
//   icons/maskable-512.png                                    emblem inside the 80% safe zone, full-bleed white
//   icons/apple-touch-icon.png                                180px, full-bleed white (iOS rounds it)
//   splash/splash.webp                                        in-app splash overlay (index.html)
//   splash/ios/<w>x<h>.png                                    apple-touch-startup-image per device
// It also prints the <link rel="apple-touch-startup-image"> block for index.html.
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const LOGO = 'assets/LOGO.png';
const SPLASH = 'assets/Splshscreen.png';
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// Emblem = the logo above the wordmark. Rows 0-792 hold the arc, train and
// tracks; the text begins at row ~811 (measured; re-check after replacing LOGO.png).
const EMBLEM_BOTTOM = 800;

// Two stages: sharp runs trim before extract inside one pipeline.
const logoMeta = await sharp(LOGO).metadata();
const topHalf = await sharp(LOGO)
  .extract({ left: 0, top: 0, width: logoMeta.width, height: EMBLEM_BOTTOM })
  .png()
  .toBuffer();
const emblem = await sharp(topHalf).trim({ threshold: 10 }).png().toBuffer();

/**
 * Emblem centred on a white square, scaled to `scale` of the side.
 * `radius` (0..0.5) rounds the white background's corners; 0 = full bleed.
 */
async function icon(size, scale, radius, file) {
  const art = await sharp(emblem)
    .resize(Math.round(size * scale), Math.round(size * scale), {
      fit: 'inside',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const rx = Math.round(size * radius);
  const background = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${rx}" fill="#ffffff"/></svg>`,
  );
  await sharp(background)
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toFile(file);
  console.log('wrote', file);
}

// Portrait iOS devices, CSS px + device pixel ratio. Each needs its own PNG;
// Safari picks the one whose media query matches.
const DEVICES = [
  // iPhone
  { w: 375, h: 667, dpr: 2 }, // SE (2nd/3rd gen), 8
  { w: 375, h: 812, dpr: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 390, h: 844, dpr: 3 }, // 12, 13, 14
  { w: 393, h: 852, dpr: 3 }, // 14 Pro, 15, 15 Pro, 16
  { w: 402, h: 874, dpr: 3 }, // 16 Pro, 17
  { w: 414, h: 896, dpr: 2 }, // XR, 11
  { w: 414, h: 896, dpr: 3 }, // XS Max, 11 Pro Max
  { w: 428, h: 926, dpr: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 430, h: 932, dpr: 3 }, // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { w: 440, h: 956, dpr: 3 }, // 16 Pro Max, 17 Pro Max
  // iPad
  { w: 810, h: 1080, dpr: 2 }, // iPad 10.2"
  { w: 820, h: 1180, dpr: 2 }, // iPad 10.9", Air
  { w: 834, h: 1194, dpr: 2 }, // iPad Pro 11"
  { w: 1024, h: 1366, dpr: 2 }, // iPad Pro 12.9"
];

const splashMeta = await sharp(SPLASH).metadata();
const SPLASH_ASPECT = splashMeta.height / splashMeta.width; // 1.5

async function startupImage({ w, h, dpr }) {
  const file = `public/splash/ios/${w}x${h}@${dpr}x.png`;
  const W = w * dpr;
  const H = h * dpr;
  let image;
  if (h / w > SPLASH_ASPECT * 1.1) {
    // Tall phones: a straight cover-crop clips the wordmark. Show the whole
    // photo at full width over a blurred, cover-scaled copy of itself.
    const foreground = await sharp(SPLASH).resize(W, null).png().toBuffer();
    image = sharp(SPLASH)
      .resize(W, H, { fit: 'cover', position: 'centre' })
      .blur(40)
      .composite([{ input: foreground, gravity: 'centre' }]);
  } else {
    image = sharp(SPLASH).resize(W, H, { fit: 'cover', position: 'centre' });
  }
  await image.png({ palette: true, quality: 80 }).toFile(file);
  console.log('wrote', file);
  return `    <link rel="apple-touch-startup-image" href="/splash/ios/${w}x${h}@${dpr}x.png" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`;
}

await mkdir('public/icons', { recursive: true });
await mkdir('public/splash/ios', { recursive: true });

await Promise.all([
  icon(64, 0.84, 0.19, 'public/favicon.png'),
  icon(192, 0.84, 0.19, 'public/icons/icon-192.png'),
  icon(512, 0.84, 0.19, 'public/icons/icon-512.png'),
  icon(512, 0.66, 0, 'public/icons/maskable-512.png'),
  icon(180, 0.84, 0, 'public/icons/apple-touch-icon.png'),
  sharp(SPLASH)
    .webp({ quality: 80 })
    .toFile('public/splash/splash.webp')
    .then(() => console.log('wrote public/splash/splash.webp')),
]);

const links = [];
for (const device of DEVICES) links.push(await startupImage(device));

console.log('\nPaste into index.html <head>:\n' + links.join('\n'));
