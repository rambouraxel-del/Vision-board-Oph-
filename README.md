# L’univers d’Ophélie

Vision board personnel, pensé d’abord pour le téléphone et installable sur l’écran d’accueil.

- **Mon cocon** : décoration (maisons bohèmes et provençales) et dressing (garde-robe capsule, tenues, capsules, liste d’achats).
- **Mes horizons** : vie de maîtresse (inspirations de classes, activités, objectifs, future classe) et voyages (carte du monde interactive, checklist, budget).

L’application fonctionne sans compte, sans serveur et sans clé secrète. Les données restent dans le navigateur (IndexedDB) ; un export permet de les sauvegarder ou de les transférer.

## Ouvrir l’application sur téléphone

1. Ouvrir l’adresse GitHub Pages du dépôt : **https://rambouraxel-del.github.io/Vision-board-Oph-/**
2. Installer sur l’écran d’accueil :
   - **iPhone (Safari)** : bouton Partager → « Sur l’écran d’accueil ».
   - **Android (Chrome)** : menu ⋮ → « Installer l’application » (ou « Ajouter à l’écran d’accueil »).
3. Une fois ouverte une première fois, l’interface fonctionne hors ligne. La carte du monde et la recherche de lieux demandent Internet.

## Étapes manuelles restantes (GitHub)

Le workflow `.github/workflows/deploy.yml` construit et publie l’application à chaque push sur `main` (et sur la branche de travail actuelle).

1. **Settings → Pages** : dans « Build and deployment », choisir **Source : GitHub Actions** (normalement déjà activé automatiquement par le workflow).
2. **Settings → Environments → github-pages → Deployment branches and tags** : autoriser la branche qui déploie (`main`, et/ou `claude/univers-ophelie-vision-board-ksqpwf`). Si le job « deploy » échoue en une seconde, c’est ce réglage qui bloque.
3. Après une fusion dans `main` : **Actions → Déploiement GitHub Pages → Run workflow** si le déploiement ne démarre pas tout seul.

## Sauvegarde des données

- **Réglages → Exporter une sauvegarde** : télécharge un fichier `.json` contenant tous les contenus et les photos importées.
- **Réglages → Restaurer une sauvegarde** : le fichier est vérifié avant toute modification, puis une confirmation est demandée avant de remplacer les données.
- Il n’y a pas de synchronisation automatique entre appareils : exporter sur l’un, restaurer sur l’autre.
- Les photos ajoutées par Ophélie restent dans son navigateur et ne sont jamais envoyées dans le dépôt GitHub.
- Les mises à jour de l’application ne touchent jamais aux données. Les inspirations de départ supprimées ne reviennent pas (un bouton des Réglages permet de les remettre sur demande).

## Développement

```bash
npm install
npm run dev        # serveur de développement
npm run build      # vérification TypeScript + build dans dist/
npm run preview    # prévisualiser le build
```

Architecture : TypeScript, React, Vite, IndexedDB (`idb`), Leaflet.

```
src/
  App.tsx               coquille : onglets, contrôles, panneaux
  components/Board.tsx  tableau spatial (glisser, pincer, appui long, rendu limité au visible)
  components/…          fiches, formulaires, dressing, liste, carte, réglages
  db/                   base IndexedDB, migrations, contenus de départ, sauvegardes
  data/boards.ts        zones de chaque univers
  data/credits.json     crédits des photographies (généré)
  sw-template.js        service worker (cache de l’interface uniquement)
scripts/
  images.manifest.json  photographies de départ choisies sur Wikimedia Commons
  fetch-images.mjs      téléchargement, vérification de licence, optimisation, crédits
```

### Photographies de départ

Elles proviennent de **Wikimedia Commons**, sous licences libres vérifiées automatiquement (CC0, domaine public, CC BY, CC BY-SA). Auteur, licence et lien source sont enregistrés dans `src/data/credits.json` et affichés dans l’application (sous chaque photo et dans Réglages → Crédits).

Pour changer une photo : modifier `pick` (titre exact du fichier Commons) dans `scripts/images.manifest.json` et pousser. Le workflow **Images** télécharge, optimise (WebP 1200 px et 480 px) et enregistre les fichiers dans `public/images/`. Une entrée sans `pick` produit une planche de candidats dans `candidates/`.

### Carte

Fond de carte © contributeurs OpenStreetMap (tuiles `tile.openstreetmap.org`, usage léger conforme à leur politique, aucun téléchargement massif hors ligne). Recherche de lieux facultative via Nominatim (une requête à la demande, jamais en saisie automatique).

### Évolutions du modèle de données

Incrémenter `DATA_VERSION` dans `src/db/migrations.ts` et ajouter la fonction de migration correspondante : elle s’applique aux données locales comme aux sauvegardes importées.
