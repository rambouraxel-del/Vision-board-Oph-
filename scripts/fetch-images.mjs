#!/usr/bin/env node
/**
 * Récupère les photographies de départ sur Wikimedia Commons, vérifie leur licence,
 * les optimise pour le mobile et enregistre les crédits.
 *
 *   node scripts/fetch-images.mjs               → télécharge les images choisies (« pick ») du manifeste
 *   node scripts/fetch-images.mjs --candidates  → prépare des planches de candidats (dossier candidates/)
 *                                                  pour les entrées sans « pick »
 *
 * Seules les licences libres compatibles sont acceptées : CC0, domaine public, CC BY, CC BY-SA.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'scripts/images.manifest.json');
const OUT_DIR = path.join(ROOT, 'public/images');
const CREDITS = path.join(ROOT, 'src/data/credits.json');
const CAND_DIR = path.join(ROOT, 'candidates');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'UniversOphelie/1.0 (https://github.com/rambouraxel-del/Vision-board-Oph-; vision board personnel)';

const args = new Set(process.argv.slice(2));
const CANDIDATES = args.has('--candidates');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`API Commons indisponible : ${url}`);
}

async function download(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(`Téléchargement impossible : ${url}`);
}

const strip = (html = '') =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Licence acceptée ? Retourne le libellé normalisé ou null. */
function acceptedLicense(meta) {
  const short = strip(meta.LicenseShortName?.value ?? '');
  const lic = (meta.License?.value ?? '').toLowerCase();
  if (meta.NonFree?.value === 'true') return null;
  if (/^cc0/i.test(short) || lic === 'cc0') return short || 'CC0';
  if (/public domain|^pd/i.test(short) || lic.startsWith('pd')) return short || 'Domaine public';
  if (/^cc[ -]by(-sa)?[ -]\d/i.test(short) || /^cc-by(-sa)?-\d/.test(lic)) return short;
  return null;
}

function toCandidate(page) {
  const info = page.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  const license = acceptedLicense(meta);
  if (!license) return null;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(info.mime)) return null;
  if (info.width < 900 || info.height < 600) return null;
  const restrictions = strip(meta.Restrictions?.value ?? '');
  return {
    title: page.title,
    thumb: info.thumburl,
    width: info.width,
    height: info.height,
    author: strip(meta.Artist?.value ?? '') || strip(meta.Credit?.value ?? '') || 'Auteur inconnu',
    license,
    licenseUrl: meta.LicenseUrl?.value ?? '',
    source: info.descriptionurl,
    attributionRequired: meta.AttributionRequired?.value !== 'false',
    restrictions,
  };
}

const IIPROP = { prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1400' };

async function byTitle(title) {
  const data = await api({ action: 'query', titles: title, ...IIPROP });
  const page = data.query?.pages?.[0];
  if (!page || page.missing) throw new Error(`Fichier introuvable : ${title}`);
  const c = toCandidate(page);
  if (!c) throw new Error(`Licence ou format non accepté : ${title}`);
  return c;
}

async function search(query, limit = 30) {
  const data = await api({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    ...IIPROP,
  });
  const pages = (data.query?.pages ?? []).sort((a, b) => a.index - b.index);
  return pages.map(toCandidate).filter(Boolean);
}

async function candidatesFor(entry) {
  const seen = new Set();
  const out = [];
  const queries = entry.queries ?? [entry.query];
  const all = queries.flatMap((q) => [`${q} incategory:Quality_images`, q]);
  for (const q of all) {
    for (const c of await search(q, 12)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(c);
    }
    await sleep(300);
  }
  return out.slice(0, 16);
}

async function contactSheet(key, cands) {
  const W = 360;
  const H = 270;
  const cols = 4;
  const rows = Math.ceil(cands.length / cols);
  const tiles = [];
  for (let i = 0; i < cands.length; i++) {
    try {
      const buf = await download(cands[i].thumb);
      const img = await sharp(buf).resize(W, H, { fit: 'cover' }).jpeg().toBuffer();
      const label = Buffer.from(
        `<svg width="${W}" height="${H}"><rect x="0" y="0" width="56" height="40" fill="black" opacity="0.7"/><text x="10" y="30" font-size="28" fill="white" font-family="sans-serif">${i}</text></svg>`,
      );
      if (!cands[i].thumb) continue;
      tiles.push({ input: await sharp(img).composite([{ input: label }]).toBuffer(), left: (i % cols) * W, top: Math.floor(i / cols) * H });
    } catch (e) {
      console.warn(`  vignette ${i} ignorée : ${e.message}`);
    }
    await sleep(150);
  }
  await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: '#ffffff' } })
    .composite(tiles)
    .jpeg({ quality: 70 })
    .toFile(path.join(CAND_DIR, `${key}.jpg`));
  await fs.writeFile(
    path.join(CAND_DIR, `${key}.json`),
    JSON.stringify(cands.map((c, i) => ({ i, title: c.title, license: c.license, author: c.author, restrictions: c.restrictions })), null, 2),
  );
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function main() {
  const manifest = await readJson(MANIFEST, {});
  const keys = Object.keys(manifest).filter((k) => !ONLY || ONLY.includes(k));

  if (CANDIDATES) {
    await fs.mkdir(CAND_DIR, { recursive: true });
    for (const key of keys) {
      const entry = manifest[key];
      if (entry.pick && !ONLY) continue;
      console.log(`Candidats pour ${key}…`);
      const cands = await candidatesFor(entry);
      if (!cands.length) {
        console.warn(`  aucun candidat libre pour « ${entry.query} »`);
        continue;
      }
      await contactSheet(key, cands);
    }
    return;
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const credits = await readJson(CREDITS, []);
  const byKey = new Map(credits.map((c) => [c.key, c]));
  const failures = [];

  for (const key of keys) {
    const entry = manifest[key];
    if (!entry.pick) {
      console.log(`${key} : aucune image choisie, ignoré`);
      continue;
    }
    const existing = byKey.get(key);
    const large = path.join(OUT_DIR, `${key}.webp`);
    const small = path.join(OUT_DIR, `${key}-s.webp`);
    const haveFiles = await fs.access(large).then(() => fs.access(small)).then(() => true, () => false);
    if (existing && existing.title === entry.pick && haveFiles) continue;
    try {
      console.log(`${key} ← ${entry.pick}`);
      const c = await byTitle(entry.pick);
      const buf = await download(c.thumb);
      const base = sharp(buf).rotate();
      const crop = entry.crop; // facultatif : { left, top, width, height } en proportions
      let pipeline = base;
      if (crop) {
        const m = await sharp(buf).rotate().metadata();
        pipeline = base.extract({
          left: Math.round(crop.left * m.width),
          top: Math.round(crop.top * m.height),
          width: Math.round(crop.width * m.width),
          height: Math.round(crop.height * m.height),
        });
      }
      const normalized = await pipeline.toBuffer();
      await sharp(normalized).resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toFile(large);
      await sharp(normalized).resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 68 }).toFile(small);
      byKey.set(key, {
        key,
        title: c.title,
        author: c.author,
        license: c.license,
        licenseUrl: c.licenseUrl,
        source: c.source,
      });
      await sleep(400);
    } catch (e) {
      failures.push(`${key} : ${e.message}`);
      console.error(`  échec : ${e.message}`);
    }
  }

  // Retire les crédits des images qui ne sont plus dans le manifeste
  for (const k of [...byKey.keys()]) {
    if (!manifest[k]?.pick) {
      byKey.delete(k);
      await fs.rm(path.join(OUT_DIR, `${k}.webp`), { force: true });
      await fs.rm(path.join(OUT_DIR, `${k}-s.webp`), { force: true });
    }
  }
  const sorted = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  await fs.writeFile(CREDITS, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`${sorted.length} images créditées.`);
  if (failures.length) {
    console.error('Échecs :\n' + failures.join('\n'));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
