// ═══════════════════════════════════════════════════════════════════════════
// NEXUS — Lecture statique du contrat de `public.station_config`
// ═══════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE MODULE EXISTE : ce parseur a d'abord vécu dans une épreuve du
// rail `handoff-continuite-20260920`. Quand une deuxième épreuve a eu besoin
// du même rejeu, le dupliquer aurait créé deux vérités divergentes sur la même
// table. Une règle de schéma n'appartient pas à l'épreuve qui l'a découverte.
// Porté seul sur `production` le 03/10/2026, à l'identique hors ce paragraphe,
// pour test_station_config_horaires_proprietaire_unique_20261003.js ; les
// épreuves du rail qui l'utilisent aussi n'y sont pas (encore) montées.
//
// CE MODULE NE SE CONNECTE À AUCUNE BASE. Il lit les fichiers du dépôt. Les
// faits de comportement qu'il encode (ci-dessous) ont été mesurés ailleurs, sur
// une vraie base ; ils ne sont jamais déduits ici.
//
// LE MÉCANISME MESURÉ (nexus-test le 02/10/2026, puis conteneur jetable
// PostgreSQL 17 le 03/10/2026) : `INSERT ... ON CONFLICT (site) DO UPDATE`
// construit et VALIDE la ligne proposée — colonnes absentes remplies par leur
// défaut, ou NULL faute de défaut — AVANT de chercher le conflit. Une colonne
// `NOT NULL` sans défaut et sans écrivain rend donc la table NON UPSERTABLE,
// **même quand la ligne existe déjà pour ce site** (mesuré : pré-insertion
// `INSERT 0 1`, puis le même `23502` sur l'upsert).
//
// LE CAS PARTICULIER DE LA CLÉ PRIMAIRE : `site` est `NOT NULL` sans défaut
// elle aussi, et un prédicat `attnotnull and not atthasdef` la classe donc
// « colonne dangereuse » — c'est un FAUX POSITIF, reproduit volontairement en
// conteneur le 03/10/2026 (le prédicat rend `site | t | f` ET
// `horaires | t | f`, indistinguables). `site` est
// `station_config_pkey PRIMARY KEY ("site")` : son NOT NULL est celui de la
// clé primaire, et PostgreSQL REFUSE physiquement de le retirer
// (« column "site" is in a primary key »). Pour la distinguer il faut joindre
// `pg_constraint` sur `contype = 'p'`. Côté statique, c'est ce que fait la
// constante COLONNE_CLE_PRIMAIRE ci-dessous — nommée une seule fois, avec sa
// raison, pour qu'aucune épreuve ne la réexclue « parce que ça marchait ».

'use strict';

const fs = require('fs');
const path = require('path');
// `assert` n'est pas décoratif ici : `appelsUpsertStationConfig` l'utilise pour
// refuser un appel upsert sans objet littéral. MESURÉ le 03/10/2026 : tant que ce
// parseur vivait DANS un fichier `test_*`, `assert` était déjà en portée et le
// manque ne se voyait pas. Sorti en module, il levait un `ReferenceError` au
// PREMIER appel — c'est-à-dire au moment même où il aurait dû mesurer.
const assert = require('assert');

// La cible du `onConflict` de tous les upserts de cette table. Toujours
// fournie par l'appelant : une identité se fournit, elle ne se devine pas.
const COLONNE_CLE_PRIMAIRE = 'site';

// ── Découpe une liste séparée par une virgule, en respectant la profondeur
// des parenthèses et le contenu des chaînes — sinon `default jsonb_build_
// object('a', 1, 'b', 2)` se découperait n'importe où.
function decouperNiveauSuperieur(s, sep) {
  const parts = [];
  let profondeur = 0, courant = '', dansChaine = false, guillemet = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (dansChaine) {
      courant += c;
      if (c === guillemet) dansChaine = false;
      continue;
    }
    if (c === "'" || c === '"') { dansChaine = true; guillemet = c; courant += c; continue; }
    if (c === '(') { profondeur++; courant += c; continue; }
    if (c === ')') { profondeur--; courant += c; continue; }
    if (c === sep && profondeur === 0) { parts.push(courant); courant = ''; continue; }
    courant += c;
  }
  if (courant.trim() !== '') parts.push(courant);
  return parts;
}

// ── Colonnes déclarées par un CREATE TABLE (schéma de départ).
function colonnesDepuisCreateTable(src, table) {
  const cols = new Map();
  const re = new RegExp(
    'create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:["\']?public["\']?\\.)?["\']?' + table + '["\']?\\s*\\(([\\s\\S]*?)\\);',
    'i'
  );
  const m = src.match(re);
  if (!m) return cols;
  const lignes = decouperNiveauSuperieur(m[1], ',').map((c) => c.trim()).filter(Boolean);
  for (const ligne of lignes) {
    const mm = ligne.match(/^["']?(\w+)["']?\s+(.+)$/i);
    if (!mm) continue;
    const [, nom, reste] = mm;
    if (/^(primary|unique|check|constraint|foreign)$/i.test(nom)) continue;
    cols.set(nom, { notNull: /not\s+null/i.test(reste), hasDefault: /\bdefault\b/i.test(reste) });
  }
  return cols;
}

// ── Rejoue TOUTES les migrations (triées par nom = par date) pour obtenir
// l'état FINAL de chaque colonne de `station_config` : NOT NULL ? défaut ?
// `exclure` permet de rejouer « sans le correctif » pour reproduire l'ancien
// contrat.
function colonnesStationConfig(migrationsDir, exclure) {
  const exclusion = exclure || [];
  const fichiers = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && !exclusion.includes(f))
    .sort();
  const cols = new Map();
  for (const f of fichiers) {
    const src = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    for (const [nom, info] of colonnesDepuisCreateTable(src, 'station_config')) {
      cols.set(nom, info);
    }
    const reAlter = /alter\s+table\s+(?:["']?public["']?\.)?["']?station_config["']?\s+([\s\S]*?);/gi;
    let m;
    while ((m = reAlter.exec(src))) {
      const clauses = decouperNiveauSuperieur(m[1], ',').map((c) => c.trim()).filter(Boolean);
      for (const clause of clauses) {
        let mm = clause.match(/^add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)\s+([\w.]+)([\s\S]*)$/i);
        if (mm) {
          const [, nom, , reste] = mm;
          cols.set(nom, { notNull: /not\s+null/i.test(reste), hasDefault: /\bdefault\b/i.test(reste) });
          continue;
        }
        mm = clause.match(/^alter\s+column\s+(\w+)\s+(.+)$/i);
        if (mm) {
          const [, nom, action] = mm;
          const existant = cols.get(nom) || { notNull: false, hasDefault: false };
          if (/^drop\s+default/i.test(action)) existant.hasDefault = false;
          else if (/^set\s+default/i.test(action)) existant.hasDefault = true;
          else if (/^drop\s+not\s+null/i.test(action)) existant.notNull = false;
          else if (/^set\s+not\s+null/i.test(action)) existant.notNull = true;
          cols.set(nom, existant);
        }
      }
    }
  }
  return cols;
}

// ── Colonnes qui FONT SAUTER tout upsert qui les omettrait (NOT NULL, sans
// défaut), hors clé primaire — voir COLONNE_CLE_PRIMAIRE et son entête : son
// NOT NULL est celui de `station_config_pkey`, PostgreSQL refuse de le retirer,
// et elle est toujours fournie puisqu'elle est la cible du conflit.
function colonnesDangereuses(cols) {
  return [...cols.entries()]
    .filter(([nom, info]) => info.notNull && !info.hasDefault && nom !== COLONNE_CLE_PRIMAIRE)
    .map(([nom]) => nom);
}

// ── Trouve tous les appels `.from('station_config').upsert({...})` d'un
// fichier et extrait les clés de premier niveau du payload (forme `cle:
// valeur` ET forme raccourcie `cle` seule, ex. `{ site, horaires }`).
function appelsUpsertStationConfig(src) {
  const appels = [];
  const re = /from\(\s*['"]station_config['"]\s*\)\s*\.\s*upsert\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const debut = src.indexOf('{', m.index);
    assert.ok(debut !== -1, 'Appel upsert sans objet littéral trouvé');
    let profondeur = 0, i = debut, dansChaine = false, guillemet = '';
    for (; i < src.length; i++) {
      const c = src[i];
      if (dansChaine) { if (c === guillemet && src[i - 1] !== '\\') dansChaine = false; continue; }
      if (c === "'" || c === '"' || c === '`') { dansChaine = true; guillemet = c; continue; }
      if (c === '{') profondeur++;
      else if (c === '}') { profondeur--; if (profondeur === 0) break; }
    }
    const objetSrc = src.slice(debut + 1, i);
    const ligne = src.slice(0, m.index).split('\n').length;
    const cles = decouperNiveauSuperieur(objetSrc, ',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const mm = p.match(/^(\w+)\s*:/) || p.match(/^(\w+)$/);
        return mm ? mm[1] : null;
      })
      .filter(Boolean);
    appels.push({ ligne, cles });
  }
  return appels;
}

// ── Liste, sur tout le dépôt (hors .git/node_modules), les fichiers qui
// contiennent au moins un appel `.from('station_config').upsert(`. Déduit du
// contenu réel, jamais une liste écrite à la main — sinon un futur appel
// ajouté ailleurs échapperait silencieusement à cette épreuve.
function fichiersAvecUpsertStationConfig(racine) {
  const resultat = [];
  (function parcourir(dir) {
    for (const entree of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entree.name === '.git' || entree.name === 'node_modules') continue;
      const chemin = path.join(dir, entree.name);
      if (entree.isDirectory()) { parcourir(chemin); continue; }
      // Exclut les harnais de test (test_*.js) ET ce module lui-même : ce ne
      // sont jamais des appelants applicatifs, et ils CITENT le motif recherché
      // dans leur propre code source (le texte même de la regex ci-dessous), ce
      // qui les ferait matcher à tort sur eux-mêmes.
      //
      // L'exclusion de `__filename` n'est pas décorative : MESURÉ le 03/10/2026,
      // dès que ce parseur a quitté le fichier `test_*` qui l'hébergeait pour
      // devenir un module de `outils/`, le marcheur s'est trouvé lui-même et a
      // rapporté deux « appels » à liste de clés vide. Sous un jeu de colonnes
      // dangereuses vide — l'état actuel — cela ne rougit même pas : la garde
      // serait restée verte en mesurant du faux.
      if (/^test_/.test(entree.name)) continue;
      if (path.resolve(chemin) === path.resolve(__filename)) continue;
      if (!/\.(html|js)$/.test(entree.name)) continue;
      const src = fs.readFileSync(chemin, 'utf8');
      if (/from\(\s*['"]station_config['"]\s*\)\s*\.\s*upsert\s*\(/.test(src)) resultat.push(chemin);
    }
  })(racine);
  return resultat;
}

module.exports = {
  COLONNE_CLE_PRIMAIRE,
  decouperNiveauSuperieur,
  colonnesDepuisCreateTable,
  colonnesStationConfig,
  colonnesDangereuses,
  appelsUpsertStationConfig,
  fichiersAvecUpsertStationConfig,
};
