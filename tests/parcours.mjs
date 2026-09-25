import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:8080/Vision-board-Oph-/';
const SITE = process.env.SITE;
const results = [];
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
  results.push(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
};

const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'fr-FR', acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/tile\.openstreetmap|ERR_TUNNEL|ERR_CONNECTION|Failed to load resource/.test(m.text())) errors.push(m.text());
});

const tf = () => page.$eval('.board-layer', (e) => e.style.transform);
const sleep = (ms) => page.waitForTimeout(ms);
const sheetOpen = async () => (await page.$$('.sheet-root')).length;
const closeAllSheets = async () => {
  for (let i = 0; i < 6 && (await sheetOpen()); i++) {
    await page.locator('.sheet-root.is-top .sheet-close').click();
    await sleep(250);
  }
};

await page.goto(BASE);
await page.waitForSelector('.board-viewport');
await sleep(600);

// ------------------------------------------------------------ 1. Explorer les univers et revenir à une zone
const t0 = await tf();
await page.getByRole('button', { name: 'Dressing', exact: true }).click();
await sleep(700);
const t1 = await tf();
ok('1a. Raccourci de zone déplace le tableau', t0 !== t1);
// déplacement au doigt/souris sur le fond
const vp = await page.$('.board-viewport');
const box = await vp.boundingBox();
await page.mouse.move(box.x + 30, box.y + box.height - 40);
await page.mouse.down();
await page.mouse.move(box.x + 90, box.y + box.height - 90, { steps: 8 });
await page.mouse.up();
await sleep(300);
const tPan = await tf();
ok('1b. Glisser déplace le tableau', tPan !== t1);
// pincement à deux doigts (événements tactiles réels via CDP)
const cdp = await ctx.newCDPSession(page);
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const scaleOf = (t) => Number(/scale\(([\d.]+)\)/.exec(t)[1]);
const sBefore = scaleOf(await tf());
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 30, y: cy, id: 1 }, { x: cx + 30, y: cy, id: 2 }] });
for (let i = 1; i <= 8; i++) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 30 - i * 12, y: cy, id: 1 }, { x: cx + 30 + i * 12, y: cy, id: 2 }] });
}
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(300);
const sAfter = scaleOf(await tf());
ok('1c. Pincement zoome', sAfter > sBefore * 1.3, `${sBefore.toFixed(2)} → ${sAfter.toFixed(2)}`);
ok('1d. Pincement sans ouverture de fiche', (await sheetOpen()) === 0);
const tCocon = await tf();
await page.locator('.nav-horizons').click();
await sleep(500);
await page.getByRole('button', { name: 'Mes voyages', exact: true }).click();
await sleep(700);
const tHor = await tf();
await page.locator('.nav-cocon').click();
await sleep(500);
ok('1e. Retour au cocon : position et zoom restaurés', (await tf()) === tCocon);
await page.locator('.nav-horizons').click();
await sleep(500);
ok('1f. Retour aux horizons : position restaurée', (await tf()) === tHor);
// boutons de zoom et recentrage
const sZ = scaleOf(await tf());
await page.getByRole('button', { name: 'Zoomer', exact: true }).click();
await sleep(500);
ok('1g. Bouton zoom +', scaleOf(await tf()) > sZ);
await page.getByRole('button', { name: /Recentrer/ }).click();
await sleep(500);
ok('1h. Bouton recentrer', scaleOf(await tf()) < sZ);

// ------------------------------------------------------------ 2. Ajouter une photo et une note, les retrouver après rechargement
await page.locator('.nav-cocon').click();
await sleep(400);
await page.getByRole('button', { name: 'Carnet du cocon', exact: true }).click();
await sleep(600);
await page.locator('.fab').click();
await page.getByRole('button', { name: /Une note/ }).click();
await page.locator('.sheet-root.is-top').getByLabel('Texte').fill('Ma note de test avec photo');
await page.locator('.sheet-root.is-top input[type=file]').setInputFiles(`${import.meta.dirname}/test-photo.png`);
await page.waitForSelector('.photo-edit img');
await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
await page.waitForSelector('.detail-note');
ok('2a. Note enregistrée et fiche ouverte', true);
await closeAllSheets();
await page.reload();
await page.waitForSelector('.board-viewport');
await page.locator('.nav-list').click();
await page.getByRole('tab', { name: 'Notes' }).click();
const noteRow = page.locator('.row', { hasText: 'Ma note de test' });
ok('2b. Note retrouvée après rechargement', (await noteRow.count()) === 1);
await noteRow.click();
await page.waitForSelector('.detail-note .gallery img');
const src = await page.$eval('.detail-note .gallery img', (i) => i.src);
const natural = await page.$eval('.detail-note .gallery img', (i) => i.naturalWidth);
ok('2c. Photo importée retrouvée (IndexedDB)', src.startsWith('blob:') && natural > 0);
await closeAllSheets();

// ------------------------------------------------------------ 3. Déplacer une carte sans ouverture accidentelle
await page.getByRole('button', { name: 'Décoration', exact: true }).click();
await sleep(700);
const card = page.locator('[data-card="seed-deco-coin-lecture"]');
const before = await card.evaluate((e) => [e.style.left, e.style.top]);
const cb = await card.boundingBox();
await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
await page.mouse.down();
await sleep(650);
await page.mouse.move(cb.x + cb.width / 2 + 60, cb.y + cb.height / 2 + 90, { steps: 10 });
await page.mouse.up();
await sleep(400);
const after = await card.evaluate((e) => [e.style.left, e.style.top]);
ok('3a. Appui long + glisser déplace la carte', before.join() !== after.join(), `${before} → ${after}`);
ok('3b. Aucune fiche ouverte après le déplacement', (await sheetOpen()) === 0);
// mode Organiser : glisser sans appui long, toucher n'ouvre pas
await page.getByRole('button', { name: 'Organiser' }).click();
const card2 = page.locator('[data-card="seed-deco-sdb"]');
const b2 = await card2.evaluate((e) => e.style.left);
const cb2 = await card2.boundingBox();
await page.mouse.move(cb2.x + 40, cb2.y + 40);
await page.mouse.down();
await page.mouse.move(cb2.x + 110, cb2.y + 60, { steps: 6 });
await page.mouse.up();
await sleep(300);
ok('3c. Mode Organiser : glisser immédiat', (await card2.evaluate((e) => e.style.left)) !== b2);
await card2.click({ force: true });
await sleep(300);
ok('3d. Mode Organiser : toucher n’ouvre pas la fiche', (await sheetOpen()) === 0);
await page.getByRole('button', { name: 'Terminer' }).click();
await sleep(300);
await card2.click();
await sleep(300);
ok('3e. Toucher simple ouvre la fiche', (await sheetOpen()) === 1);
await closeAllSheets();
await page.reload();
await page.waitForSelector('.board-viewport');
await sleep(500);
const persisted = await page.locator('[data-card="seed-deco-coin-lecture"]').evaluate((e) => [e.style.left, e.style.top]);
ok('3f. Position conservée après rechargement', persisted.join() === after.join());

// ------------------------------------------------------------ 4. Vêtement, tenue, capsule
await page.locator('.nav-list').click();
await page.getByRole('tab', { name: 'Dressing' }).click();
await page.getByRole('button', { name: 'Ouvrir le dressing' }).click();
await page.getByRole('button', { name: '+ Vêtement' }).click();
await page.locator('.sheet-root.is-top').getByLabel('Nom').fill('Cardigan test');
await page.getByRole('radio', { name: 'Dans mon dressing' }).click();
await page.locator('.sheet-root.is-top').getByLabel('Couleur').fill('Lilas');
await page.locator('.sheet-root.is-top').getByLabel('Prix').fill('39,90');
await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
await page.waitForSelector('.detail-vetement');
ok('4a. Vêtement créé', (await page.locator('.detail-title').textContent()) === 'Cardigan test');
await page.locator('.sheet-root.is-top .sheet-close').click();
await sleep(300);
await page.getByRole('tab', { name: 'Tenues' }).click();
await page.getByRole('button', { name: '+ Créer une tenue' }).click();
await page.locator('.sheet-root.is-top').getByLabel('Titre').fill('Tenue de rentrée');
await page.locator('.sheet-root.is-top').getByLabel('Occasion').fill('Rentrée');
await page.locator('.picker-cell', { hasText: 'Cardigan test' }).click();
await page.locator('.picker-cell', { hasText: 'Jean brut' }).click();
await page.locator('.picker-cell', { hasText: 'Ballerines' }).click();
await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
await page.waitForSelector('.detail-tenue');
ok('4b. Tenue créée avec 3 vêtements', (await page.locator('.detail-tenue .outfit-cell').count()) === 3);
await page.locator('.sheet-root.is-top .sheet-close').click();
await sleep(300);
await page.getByRole('tab', { name: 'Capsules' }).click();
await page.getByRole('button', { name: '+ Créer une capsule' }).click();
await page.locator('.sheet-root.is-top').getByLabel('Titre').fill('Capsule automne');
await page.locator('.picker-cell', { hasText: 'Cardigan test' }).click();
await page.locator('.picker-cell', { hasText: 'Pull rayé' }).click();
await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
await page.waitForSelector('.detail-capsule');
ok('4c. Capsule créée', (await page.locator('.detail-capsule .outfit-cell').count()) === 2);
await page.locator('.sheet-root.is-top .sheet-close').click();
await sleep(300);
await page.getByRole('tab', { name: 'Liste d’achats' }).click();
const total = await page.locator('.total-box').textContent();
ok('4d. Liste d’achats : total et articles sans prix', /sans prix/.test(total), total.replace(/\s+/g, ' '));
await closeAllSheets();

// ------------------------------------------------------------ 5. Activité de classe et objectif coché
await page.locator('.nav-horizons').click();
await sleep(400);
await page.getByRole('button', { name: 'Ma vie de maîtresse', exact: true }).click();
await sleep(600);
await page.locator('.fab').click();
await page.getByRole('button', { name: /Une idée d’activité/ }).click();
await page.locator('.sheet-root.is-top').getByLabel('Titre').fill('Rallye lecture');
await page.locator('.sheet-root.is-top').getByLabel('Niveau scolaire').fill('CE1');
await page.locator('.sheet-root.is-top').getByLabel('Matériel nécessaire').fill('Albums, fiches');
await page.locator('.sheet-root.is-top').getByPlaceholder('Nouvelle étape').fill('Présenter les albums');
await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
await page.waitForSelector('.detail-classe');
ok('5a. Activité créée avec étape', (await page.locator('.steps li').count()) === 1);
await closeAllSheets();
await page.locator('.nav-list').click();
await page.getByRole('tab', { name: 'Maîtresse' }).click();
await page.locator('.row', { hasText: 'Préparer ma future rentrée' }).click();
await page.locator('.checklist input').first().check();
await sleep(300);
await closeAllSheets();
await page.reload();
await page.waitForSelector('.board-viewport');
await page.locator('.nav-list').click();
await page.getByRole('tab', { name: 'Maîtresse' }).click();
await page.locator('.row', { hasText: 'Préparer ma future rentrée' }).click();
ok('5b. Objectif coché conservé', await page.locator('.checklist input').first().isChecked());
ok('5c. Statut passé à « En cours »', (await page.locator('.segmented .seg.is-on').textContent()) === 'En cours');
await closeAllSheets();

// ------------------------------------------------------------ 6. Destination, checklist et budget
await page.getByRole('button', { name: 'Mes voyages', exact: true }).click();
await sleep(600);
await page.locator('.map-portal').click();
await page.waitForSelector('.leaflet-container');
ok('6a. Carte du monde ouverte (vue dédiée)', (await page.locator('.leaflet-marker-icon').count()) >= 6);
await page.getByRole('button', { name: '+ Placer un repère' }).click();
const mb = await page.locator('.map').boundingBox();
await page.mouse.click(mb.x + mb.width * 0.45, mb.y + mb.height * 0.5);
await page.waitForSelector('text=Nouvelle destination');
const lat = await page.locator('.sheet-root.is-top').getByLabel('Latitude').inputValue();
ok('6b. Repère placé : coordonnées remplies', lat !== '', `lat ${lat}`);
await page.locator('.sheet-root.is-top').getByLabel('Nom du lieu').fill('Séville');
await page.locator('.sheet-root.is-top').getByLabel('Pays').fill('Espagne');
await page.locator('.sheet-root.is-top').getByPlaceholder('ex. visiter le musée…').fill('Alcazar');
await page.locator('.field', { hasText: 'Activités et lieux' }).getByRole('button', { name: 'Ajouter' }).click();
await page.locator('.sheet-root.is-top').getByLabel('Montant prévu pour Transport').fill('100');
await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
await page.waitForSelector('.detail-destination');
await page.locator('.checklist input').first().check();
await page.locator('.sheet-root.is-top').getByLabel('Libellé de la dépense').fill('Billets');
await page.locator('.sheet-root.is-top').getByLabel('Montant', { exact: true }).fill('120');
await page.getByRole('button', { name: 'Ajouter la dépense' }).click();
await sleep(300);
const row = await page.locator('.budget-table tbody tr', { hasText: 'Transport' }).textContent();
ok('6c. Budget prévu/réel/écart', /100,00/.test(row) && /120,00/.test(row) && /\+20,00/.test(row), row);
ok('6d. Checklist cochée', await page.locator('.checklist input').first().isChecked());
await closeAllSheets();

// ------------------------------------------------------------ 7. Export puis restauration
await page.locator('.nav-settings').click();
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter une sauvegarde' }).click()]);
const backupPath = `${process.cwd()}/backup.json`;
await dl.saveAs(backupPath);
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
ok('7a. Sauvegarde exportée avec photo importée', backup.images.length >= 1 && backup.items.length > 40, `${backup.items.length} éléments, ${backup.images.length} image(s)`);
const countBefore = backup.items.length;
await page.getByRole('button', { name: 'Effacer toutes mes données' }).click();
await page.getByRole('button', { name: 'Tout effacer' }).click();
await page.getByRole('button', { name: 'Oui, effacer' }).click();
await sleep(400);
await closeAllSheets();
ok('7b. Données effacées', (await page.locator('[data-card]').count()) === 0);
// Import d'un fichier invalide : refusé sans rien modifier
fs.writeFileSync('bad.json', '{"hello":1}');
await page.locator('.nav-settings').click();
await page.locator('.sheet-root.is-top input[type=file]').setInputFiles(`${process.cwd()}/bad.json`);
await sleep(300);
ok('7c. Fichier invalide refusé', (await page.locator('.toast.is-error').count()) === 1);
await page.locator('.sheet-root.is-top input[type=file]').setInputFiles(backupPath);
await page.waitForSelector('text=Restaurer une sauvegarde');
await page.getByRole('button', { name: 'Remplacer mes données' }).click();
await page.getByRole('button', { name: 'Remplacer', exact: true }).click();
await sleep(600);
await page.reload();
await page.waitForSelector('.board-viewport');
await page.locator('.nav-list').click();
await page.getByRole('tab', { name: 'Notes' }).click();
await page.locator('.row', { hasText: 'Ma note de test' }).click();
await page.waitForSelector('.detail-note .gallery img');
const nat2 = await page.$eval('.detail-note .gallery img', (i) => i.naturalWidth);
ok('7d. Restauration : contenus et photos revenus', nat2 > 0);
await closeAllSheets();
const n = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('univers-ophelie'); r.onsuccess = () => { const t = r.result.transaction('items').objectStore('items').count(); t.onsuccess = () => res(t.result); }; }));
ok('7e. Nombre d’éléments identique', n === countBefore, `${n}/${countBefore}`);
// Suppression d'un exemple avec annulation, puis suppression définitive : jamais réinjecté
await page.locator('.nav-list').click();
await page.getByRole('tab', { name: 'Décoration' }).click();
await page.locator('.row', { hasText: 'Tissus provençaux' }).click();
await page.getByRole('button', { name: 'Supprimer' }).click();
await page.getByRole('button', { name: 'Annuler', exact: true }).click();
await sleep(300);
ok('7f. Annulation de suppression', (await page.locator('.row', { hasText: 'Tissus provençaux' }).count()) === 1);
await page.locator('.row', { hasText: 'Tissus provençaux' }).click();
await page.getByRole('button', { name: 'Supprimer' }).click();
await sleep(300);
await closeAllSheets();
await page.reload();
await page.waitForSelector('.board-viewport');
await page.locator('.nav-list').click();
await page.getByRole('tab', { name: 'Décoration' }).click();
ok('7g. Exemple supprimé non réinjecté au rechargement', (await page.locator('.row', { hasText: 'Tissus provençaux' }).count()) === 0);
await closeAllSheets();
const countAfterDelete = countBefore - 1;

// ------------------------------------------------------------ 8. Mise à jour sans perte de données
const swOk = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
ok('8a. Service worker actif', swOk);
if (SITE) {
  const swFile = `${SITE}/sw.js`;
  fs.writeFileSync(swFile, fs.readFileSync(swFile, 'utf8').replace(/const VERSION = '([^']+)'/, "const VERSION = '$1-maj'"));
  await page.reload();
  await page.waitForSelector('.board-viewport');
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  const upd = page.getByRole('button', { name: 'Mettre à jour' });
  await upd.waitFor({ timeout: 15000 });
  await Promise.all([page.waitForEvent('load'), upd.click()]);
  await page.waitForSelector('.board-viewport');
  const n2 = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('univers-ophelie'); r.onsuccess = () => { const t = r.result.transaction('items').objectStore('items').count(); t.onsuccess = () => res(t.result); }; }));
  ok('8b. Après mise à jour : données intactes', n2 === countAfterDelete, `${n2}`);
  const caches = await page.evaluate(async () => (await caches.keys()).join(','));
  ok('8c. Un seul cache d’interface après mise à jour', caches.split(',').filter((k) => k.startsWith('uo-app-')).length === 1, caches);
}
// Hors ligne : l'interface se charge depuis le cache
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('.board-viewport', { timeout: 10000 });
ok('8d. Application utilisable hors ligne', true);
await ctx.setOffline(false);

ok('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));

await browser.close();
