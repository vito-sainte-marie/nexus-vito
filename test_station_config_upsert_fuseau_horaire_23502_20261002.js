// Anomalie terrain Production — « Enregistrer les prix du mois » (Carburants)
// échouait avec HTTP 400 / PostgREST 23502 sur `station_config?on_conflict=site`
// (reproduction confirmée par Safari Web Inspector, issue #28).
//
// CAUSE RACINE (prouvée ici statiquement, à partir des vrais fichiers du
// dépôt — jamais une hypothèse) : `station_config.fuseau_horaire` est
// NOT NULL SANS DÉFAUT depuis `20260905131500_fuseau_horaire_par_site.sql`
// (qui a fait DROP DEFAULT sans le DROP NOT NULL compagnon), et plus aucun
// appelant ne l'écrit depuis la même date. `INSERT ... ON CONFLICT (site) DO
// UPDATE` valide la ligne proposée — colonnes absentes comprises, remplies
// par leur défaut ou NULL — AVANT de vérifier s'il y a conflit : la colonne
// devient NULL, et PostgreSQL refuse (23502), que la ligne existe déjà pour
// ce site ou non. Les 15 upserts `station_config` du dépôt omettaient tous
// cette colonne — aucun n'était épargné.
//
// Ce test NE SE CONNECTE À AUCUNE BASE (aucun accès Supabase depuis ce
// canal) : il reproduit le défaut en relisant le contrat réel — le même
// parseur DDL rejoue les migrations, le même extracteur de clés lit les
// vrais appels `.upsert()` du dépôt. Preuve comportementale SQL portable
// (à exécuter avec un accès réel) : voir
// outils/epreuve-station-config-upsert-fuseau-horaire-23502-20261002.sql.

'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const MIGRATIONS_DIR = path.join(RACINE, 'supabase', 'migrations');
const MIGRATION_CORRECTIF = '20261002000000_station_config_fuseau_horaire_nullable.sql';

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

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
// défaut), hors clé primaire (toujours fournie, c'est la cible du conflit).
function colonnesDangereuses(cols) {
  return [...cols.entries()]
    .filter(([nom, info]) => info.notNull && !info.hasDefault && nom !== 'site')
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
      // Exclut les harnais de test (test_*.js) : ce ne sont jamais des
      // appelants applicatifs, et plusieurs — dont ce fichier-ci — CITENT le
      // motif recherché dans leur propre code source (le texte même de cette
      // regex), ce qui les ferait matcher à tort sur eux-mêmes.
      if (/^test_/.test(entree.name)) continue;
      if (!/\.(html|js)$/.test(entree.name)) continue;
      const src = fs.readFileSync(chemin, 'utf8');
      if (/from\(\s*['"]station_config['"]\s*\)\s*\.\s*upsert\s*\(/.test(src)) resultat.push(chemin);
    }
  })(racine);
  return resultat;
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Preuve de la cause racine : reproduction de l'ancien contrat
// ═══════════════════════════════════════════════════════════════════════

verifier('ancien contrat (sans le correctif) : fuseau_horaire est NOT NULL sans défaut', () => {
  const ancien = colonnesStationConfig(MIGRATIONS_DIR, [MIGRATION_CORRECTIF]);
  const info = ancien.get('fuseau_horaire');
  assert.ok(info, 'fuseau_horaire doit exister dans le schéma rejoué');
  assert.strictEqual(info.notNull, true, 'fuseau_horaire doit être NOT NULL sous l’ancien contrat');
  assert.strictEqual(info.hasDefault, false, 'fuseau_horaire ne doit plus avoir de défaut (20260905131500)');
});

verifier('ancien contrat : fuseau_horaire figure bien parmi les colonnes dangereuses', () => {
  const ancien = colonnesStationConfig(MIGRATIONS_DIR, [MIGRATION_CORRECTIF]);
  assert.ok(colonnesDangereuses(ancien).includes('fuseau_horaire'));
});

verifier('ancien contrat : le payload réel de "Enregistrer les prix du mois" (App) omet fuseau_horaire → 23502 reproduit', () => {
  const ancien = colonnesStationConfig(MIGRATIONS_DIR, [MIGRATION_CORRECTIF]);
  const dangereuses = colonnesDangereuses(ancien);
  const src = fs.readFileSync(path.join(RACINE, 'NEXUS-App-v1.html'), 'utf8');
  const appels = appelsUpsertStationConfig(src);
  const appelPrix = appels.find((a) => a.cles.includes('prix_carburants'));
  assert.ok(appelPrix, 'Appel upsert prix_carburants introuvable dans NEXUS-App-v1.html');
  const manquantes = dangereuses.filter((d) => !appelPrix.cles.includes(d));
  assert.ok(
    manquantes.includes('fuseau_horaire'),
    'Sous l’ancien contrat, fuseau_horaire doit manquer du payload réel — c’est exactement le 23502 observé en Production : ' + JSON.stringify(appelPrix)
  );
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Preuve de la disparition du défaut : état réel du dépôt, correctif inclus
// ═══════════════════════════════════════════════════════════════════════

verifier('correctif présent : la migration 20261002000000 existe et modifie bien fuseau_horaire', () => {
  const chemin = path.join(MIGRATIONS_DIR, MIGRATION_CORRECTIF);
  assert.ok(fs.existsSync(chemin), 'Migration correctif absente : ' + MIGRATION_CORRECTIF);
  const src = fs.readFileSync(chemin, 'utf8');
  assert.ok(/alter\s+column\s+fuseau_horaire\s+drop\s+not\s+null/i.test(src),
    'La migration correctif doit faire DROP NOT NULL sur fuseau_horaire');
});

verifier('nouveau contrat : fuseau_horaire est désormais nullable', () => {
  const actuel = colonnesStationConfig(MIGRATIONS_DIR, []);
  const info = actuel.get('fuseau_horaire');
  assert.ok(info);
  assert.strictEqual(info.notNull, false, 'fuseau_horaire doit être nullable avec le correctif');
});

verifier('nouveau contrat : aucun défaut n’est réintroduit sur fuseau_horaire (pas de substitution silencieuse)', () => {
  const actuel = colonnesStationConfig(MIGRATIONS_DIR, []);
  assert.strictEqual(actuel.get('fuseau_horaire').hasDefault, false,
    'Le correctif ne doit pas réintroduire de DEFAULT — c’était la substitution silencieuse que 20260905131500 supprimait délibérément');
});

verifier('nouveau contrat : AUCUN upsert station_config du dépôt n’omet une colonne dangereuse (15+ appels, découverts, pas supposés)', () => {
  const actuel = colonnesStationConfig(MIGRATIONS_DIR, []);
  const dangereuses = colonnesDangereuses(actuel);
  assert.deepStrictEqual(dangereuses, ['horaires'], 'Jeu de colonnes dangereuses inattendu : ' + JSON.stringify(dangereuses));

  const fichiers = fichiersAvecUpsertStationConfig(RACINE);
  assert.ok(fichiers.length >= 2, 'Au moins NEXUS-App-v1.html et NEXUS-Parametres-Station-v1.html attendus');

  let totalAppels = 0;
  const echecs = [];
  for (const fichier of fichiers) {
    const src = fs.readFileSync(fichier, 'utf8');
    const appels = appelsUpsertStationConfig(src);
    totalAppels += appels.length;
    for (const appel of appels) {
      const manquantes = dangereuses.filter((d) => !appel.cles.includes(d));
      if (manquantes.length) {
        echecs.push(path.relative(RACINE, fichier) + ':' + appel.ligne + ' — manque ' + manquantes.join(','));
      }
    }
  }
  assert.ok(totalAppels >= 15, 'Au moins les 15 appels connus doivent être retrouvés, trouvé ' + totalAppels);
  assert.deepStrictEqual(echecs, [], 'Appels encore défaillants :\n' + echecs.join('\n'));
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Contre-épreuve du détecteur lui-même : une assertion qui ne peut jamais
//    échouer ne prouve rien (règle QA du dépôt). On vérifie que le même
//    mécanisme détecterait bien une régression, sur un cas synthétique.
// ═══════════════════════════════════════════════════════════════════════

verifier('contre-épreuve : le détecteur mord bien sur un appel synthétique qui réintroduit le défaut', () => {
  const dangereuses = ['horaires', 'fuseau_horaire'];
  const appelCasse = { cles: ['site', 'prix_carburants', 'horaires', 'updated_at'] }; // fuseau_horaire absent
  const manquantes = dangereuses.filter((d) => !appelCasse.cles.includes(d));
  assert.deepStrictEqual(manquantes, ['fuseau_horaire']);

  const appelCorrige = { cles: ['site', 'prix_carburants', 'horaires', 'fuseau_horaire', 'updated_at'] };
  const manquantes2 = dangereuses.filter((d) => !appelCorrige.cles.includes(d));
  assert.deepStrictEqual(manquantes2, []);
});

verifier('contre-épreuve : le parseur DDL détecte bien un DROP NOT NULL sur un schéma inventé', () => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nexus-test-ddl-'));
  try {
    fs.writeFileSync(path.join(dir, '20260101000000_base.sql'),
      'create table if not exists "public"."station_config" (\n' +
      '  "site" "text" NOT NULL,\n' +
      '  "truc" "text" NOT NULL\n' +
      ');\n'
    );
    const avant = colonnesStationConfig(dir, []);
    assert.strictEqual(avant.get('truc').notNull, true);

    fs.writeFileSync(path.join(dir, '20260102000000_fix.sql'),
      'alter table public.station_config alter column truc drop not null;\n'
    );
    const apres = colonnesStationConfig(dir, []);
    assert.strictEqual(apres.get('truc').notNull, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\n${passes} vérification(s) passée(s).`);
