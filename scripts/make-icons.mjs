// Génère les icônes PNG de l'application à partir de public/icons/icon.svg
import sharp from 'sharp';
const src = 'public/icons/icon.svg';
await sharp(src).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(src).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(src).resize(180, 180).flatten({ background: '#f7efe2' }).png().toFile('public/icons/apple-touch-icon.png');
// Icône « maskable » : marge de sécurité autour du dessin
const inner = await sharp(src).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#f7efe2' } })
  .composite([{ input: inner, left: 56, top: 56 }])
  .png()
  .toFile('public/icons/maskable-512.png');
console.log('Icônes générées');
