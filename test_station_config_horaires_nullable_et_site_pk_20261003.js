// ═══════════════════════════════════════════════════════════════════════════
// Mandat 55 — `station_config` : `horaires` relâchée, `site` délibérément PAS.
// ═══════════════════════════════════════════════════════════════════════════
//
// Ce test NE SE CONNECTE À AUCUNE BASE. Il lit les vrais fichiers du dépôt. Les
// faits de comportement cités ici ont tous été MESURÉS — sur `nexus-test` le
// 02/10/2026, puis dans un conteneur jetable PostgreSQL 17 le 03/10/2026, sur
// une reproduction du DDL de la baseline (lignes 1001-1006 + la contrainte des
// lignes 1281-1282). Aucun n'est déduit.
//
// ── CE QUI A ÉTÉ MESURÉ, section par section de l'épreuve conteneur ──────────
//
//   A. `pg_constraint` : `station_config_pkey | p | PRIMARY KEY (site)`
//   B. le prédicat `attnotnull and not atthasdef` rend DEUX lignes,
//      `site | t | f` ET `horaires | t | f` — indistinguables. C'EST LE FAUX
//      POSITIF, reproduit volontairement.
//   C. `alter column "site" drop not null`
//      → `ERROR:  column "site" is in a primary key`
//   D. après ce refus, `site.attnotnull` vaut toujours `t` (refus fail-closed)
//   E. upsert sans `horaires`, ligne ABSENTE → `23502`
//   F. upsert sans `horaires`, ligne PRÉSENTE (pré-insérée, `INSERT 0 1`)
//      → `23502` AUSSI. C'est tout le mécanisme : `ON CONFLICT ... DO UPDATE`
//      construit et VALIDE la ligne proposée — colonnes absentes remplies par
//      leur défaut, ou NULL faute de défaut — AVANT de chercher le conflit.
//      Une colonne `NOT NULL` sans défaut et sans écrivain rend donc la table
//      NON UPSERTABLE, et pas « seulement pour les sites neufs ».
//   G. `alter column "horaires" drop not null` → `ALTER TABLE`
//   H. le même upsert sans `horaires` → `INSERT 0 1`
//   I. `SITE-A | horaires_null=f | {"sp": 1.99}` — les horaires DÉJÀ
//      enregistrés ont survécu, et le prix a bien été mis à jour. `DO UPDATE`
//      n'affecte que les colonnes citées : `DROP NOT NULL` n'efface rien.
//   J. un site neuf s'insère avec `horaires` NULL
//   K. un `site` explicitement NULL est toujours REFUSÉ après le correctif —
//      la clé primaire mord encore, la correction n'a rien ouvert.
//
// ── POURQUOI CE TEST EXISTE, ET CONTRE QUOI IL GARDE ────────────────────────
//
// Un verdict du 03/10/2026 a classé `horaires` et `site` « même famille de
// défaut » parce que le prédicat §B les rend identiques, et a proposé de les
// corriger toutes les deux. C'était FAUX pour `site`, et §C montre le prix de
// l'erreur : la migration aurait simplement échoué. Pire, le dépôt SAVAIT
// déjà — `colonnesDangereuses` excluait `site` nommément, avec la raison
// (« hors clé primaire »). Le faux positif penchait du côté de l'action.
//
// Ce test fige donc les DEUX moitiés du résultat :
//   — `horaires` DOIT être relâchée (c'est une contrainte sans écrivain) ;
//   — `site` NE DOIT JAMAIS l'être (c'est la cible du conflit), et la bonne
//     correction pour elle est une garde d'appelant, pas une migration.

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const {
  COLONNE_CLE_PRIMAIRE,
  colonnesStationConfig,
  colonnesDangereuses,
  appelsUpsertStationConfig,
  fichiersAvecUpsertStationConfig,
} = require('./outils/schema-station-config.js');

const RACINE = __dirname;
const MIGRATIONS_DIR = path.join(RACINE, 'supabase', 'migrations');
const CORRECTIF_HORAIRES = '20261003120000_station_config_horaires_nullable.sql';
const CORRECTIF_FUSEAU = '20261002000000_station_config_fuseau_horaire_nullable.sql';

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// ── Le prédicat NAÏF, celui du verdict erroné : `NOT NULL` sans défaut, SANS
// exclure la clé primaire. Reproduit ici exprès, pour prouver que l'exclusion
// de `colonnesDangereuses` porte quelque chose — une garde dont on ne peut pas
// montrer ce qu'elle retient n'est pas une garde.
function colonnesDangereusesPredicatNaif(cols) {
  return [...cols.entries()]
    .filter(([, info]) => info.notNull && !info.hasDefault)
    .map(([nom]) => nom);
}

// ── Cherche, dans TOUT fichier de migration, un relâchement de la clé primaire.
// Déduit du contenu, jamais d'une liste tenue à la main.
function migrationsRelachantLaClePrimaire(dir) {
  const motif = new RegExp(
    'alter\\s+column\\s+["\']?' + COLONNE_CLE_PRIMAIRE + '["\']?\\s+drop\\s+not\\s+null',
    'i'
  );
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => motif.test(fs.readFileSync(path.join(dir, f), 'utf8')));
}

// ═══════════════════════════════════════════════════════════════════════
// 1. L'ancien contrat : la contrainte que quinze écrans payaient
// ═══════════════════════════════════════════════════════════════════════

verifier('ancien contrat (correctif exclu) : horaires est NOT NULL sans défaut', () => {
  const ancien = colonnesStationConfig(MIGRATIONS_DIR, [CORRECTIF_HORAIRES]);
  const h = ancien.get('horaires');
  assert.ok(h, 'colonne horaires introuvable dans le DDL rejoué');
  assert.strictEqual(h.notNull, true, 'horaires devrait être NOT NULL sans le correctif');
  assert.strictEqual(h.hasDefault, false, 'horaires ne devrait avoir aucun défaut');
});

verifier('ancien contrat : horaires figure parmi les colonnes dangereuses', () => {
  const ancien = colonnesStationConfig(MIGRATIONS_DIR, [CORRECTIF_HORAIRES]);
  assert.ok(
    colonnesDangereuses(ancien).includes('horaires'),
    'horaires devrait être dangereuse sans le correctif : ' + JSON.stringify(colonnesDangereuses(ancien))
  );
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Le nouveau contrat : relâchée, et sans défaut de substitution
// ═══════════════════════════════════════════════════════════════════════

verifier('correctif présent : la migration ' + CORRECTIF_HORAIRES.slice(0, 14) + ' existe et vise bien horaires', () => {
  const chemin = path.join(MIGRATIONS_DIR, CORRECTIF_HORAIRES);
  assert.ok(fs.existsSync(chemin), 'migration absente : ' + CORRECTIF_HORAIRES);
  const sql = fs.readFileSync(chemin, 'utf8');
  assert.ok(
    /alter\s+column\s+horaires\s+drop\s+not\s+null/i.test(sql),
    'la migration ne relâche pas horaires'
  );
});

verifier('nouveau contrat : horaires est désormais nullable', () => {
  const actuel = colonnesStationConfig(MIGRATIONS_DIR, []);
  assert.strictEqual(actuel.get('horaires').notNull, false, 'horaires devrait être nullable');
});

verifier('nouveau contrat : AUCUN défaut réintroduit sur horaires (pas d’horaires inventés)', () => {
  // L'arbitrage b1 du 19/09/2026 (migration 20260919160000) a supprimé
  // l'invention de valeurs d'horaires. Un DEFAULT ici la réintroduirait, et
  // les horaires d'une station ne se devinent pas depuis une autre.
  const actuel = colonnesStationConfig(MIGRATIONS_DIR, []);
  assert.strictEqual(actuel.get('horaires').hasDefault, false, 'un DEFAULT a été posé sur horaires');
});

verifier('nouveau contrat : le moteur unique tolère déjà NULL (contrat 20260919160000)', () => {
  const moteur = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^20260919160000/.test(f))
    .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n');
  assert.ok(moteur.length > 0, 'migration 20260919160000 introuvable');
  assert.ok(
    /if\s+v_horaires\s+is\s+null\s+then\s+return\s*;/i.test(moteur.replace(/\s+/g, ' ')),
    'calculer_horaires_quart ne retourne plus sur horaires NULL : relâcher la colonne n’est alors plus sûr'
  );
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Le jeu dangereux est fermé — et cette assertion MORD
// ═══════════════════════════════════════════════════════════════════════

verifier('le jeu des colonnes dangereuses est désormais VIDE', () => {
  // Cette assertion est la garde contre la récidive : toute nouvelle colonne
  // `NOT NULL` sans défaut ajoutée à cette table la fait rougir.
  const actuel = colonnesStationConfig(MIGRATIONS_DIR, []);
  assert.deepStrictEqual(
    colonnesDangereuses(actuel), [],
    'Une colonne NOT NULL sans défaut est réapparue sur station_config : '
      + JSON.stringify(colonnesDangereuses(actuel))
      + ' — elle rend toute la table non upsertable (voir §F de l’en-tête).'
  );
});

verifier('sans les DEUX correctifs, le jeu dangereux est exactement les deux colonnes connues', () => {
  const ancien = colonnesStationConfig(MIGRATIONS_DIR, [CORRECTIF_HORAIRES, CORRECTIF_FUSEAU]);
  assert.deepStrictEqual(
    colonnesDangereuses(ancien), ['horaires', 'fuseau_horaire'],
    'Jeu historique inattendu : ' + JSON.stringify(colonnesDangereuses(ancien))
  );
});

// ═══════════════════════════════════════════════════════════════════════
// 4. `site` : le faux positif, et pourquoi la migration ne la touche pas
// ═══════════════════════════════════════════════════════════════════════

verifier('site est bien déclarée clé primaire de station_config', () => {
  const pk = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => new RegExp(
      'constraint\\s+["\']?station_config_pkey["\']?\\s+primary\\s+key\\s*\\(\\s*["\']?'
        + COLONNE_CLE_PRIMAIRE + '["\']?\\s*\\)', 'i'
    ).test(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')));
  assert.deepStrictEqual(
    pk, ['20260101000000_baseline_pre_existing_schema.sql'],
    'station_config_pkey devrait être déclarée par la seule baseline, trouvé : ' + JSON.stringify(pk)
  );
});

verifier('le prédicat NAÏF classe site « dangereuse » — le faux positif est réel, pas théorique', () => {
  // Mesuré en conteneur, section B : le prédicat rend `site | t | f` ET
  // `horaires | t | f`. Statiquement, le même aveuglement :
  const actuel = colonnesStationConfig(MIGRATIONS_DIR, []);
  assert.strictEqual(actuel.get(COLONNE_CLE_PRIMAIRE).notNull, true);
  assert.strictEqual(actuel.get(COLONNE_CLE_PRIMAIRE).hasDefault, false);
  assert.ok(
    colonnesDangereusesPredicatNaif(actuel).includes(COLONNE_CLE_PRIMAIRE),
    'le prédicat naïf devrait classer site dangereuse — sinon cette épreuve ne garde plus rien'
  );
  // … et l'exclusion par clé primaire, elle, la retient :
  assert.ok(
    !colonnesDangereuses(actuel).includes(COLONNE_CLE_PRIMAIRE),
    'colonnesDangereuses ne doit JAMAIS rendre la clé primaire'
  );
});

verifier('AUCUNE migration ne relâche la clé primaire (PostgreSQL le refuse — mesuré §C)', () => {
  assert.deepStrictEqual(
    migrationsRelachantLaClePrimaire(MIGRATIONS_DIR), [],
    'Une migration tente `alter column site drop not null`. PostgreSQL REFUSE '
      + '(« column "site" is in a primary key », mesuré le 03/10/2026) et, si c’était '
      + 'possible, cela détruirait la détection de conflit dont dépendent tous les upserts.'
  );
});

verifier('le correctif horaires ne touche pas site', () => {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, CORRECTIF_HORAIRES), 'utf8');
  const instructions = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  assert.ok(
    !new RegExp('alter\\s+column\\s+["\']?' + COLONNE_CLE_PRIMAIRE + '["\']?', 'i').test(instructions),
    'le correctif ne doit altérer aucune colonne autre que horaires'
  );
});

// ═══════════════════════════════════════════════════════════════════════
// 5. La VRAIE correction pour `site` : une garde d'appelant
// ═══════════════════════════════════════════════════════════════════════

verifier('tout upsert station_config du dépôt fournit site (15 appels, découverts, pas supposés)', () => {
  const fichiers = fichiersAvecUpsertStationConfig(RACINE);
  assert.ok(fichiers.length >= 2, 'Au moins NEXUS-App-v1.html et NEXUS-Parametres-Station-v1.html attendus');

  let total = 0;
  const sansCle = [];
  for (const fichier of fichiers) {
    for (const appel of appelsUpsertStationConfig(fs.readFileSync(fichier, 'utf8'))) {
      total++;
      if (!appel.cles.includes(COLONNE_CLE_PRIMAIRE)) {
        sansCle.push(path.relative(RACINE, fichier) + ':' + appel.ligne);
      }
    }
  }
  assert.ok(total >= 15, 'Au moins les 15 appels connus doivent être retrouvés, trouvé ' + total);
  assert.deepStrictEqual(
    sansCle, [],
    'Upserts sans `site` — la cible du conflit est obligatoire :\n' + sansCle.join('\n')
  );
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Contre-épreuves : chaque détecteur ci-dessus doit MORDRE sur un cas
//    synthétique. La mutation visée est « débrancher la garde », pas
//    « casser la garde ».
// ═══════════════════════════════════════════════════════════════════════

verifier('contre-épreuve : le détecteur de relâchement de clé primaire mord sur une migration inventée', () => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nexus-pk-'));
  try {
    assert.deepStrictEqual(migrationsRelachantLaClePrimaire(dir), [], 'répertoire vide : rien à trouver');
    fs.writeFileSync(
      path.join(dir, '20260102000000_mauvaise_idee.sql'),
      'alter table public.station_config alter column "site" drop not null;\n'
    );
    assert.deepStrictEqual(
      migrationsRelachantLaClePrimaire(dir), ['20260102000000_mauvaise_idee.sql'],
      'le détecteur a laissé passer un drop not null sur la clé primaire'
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

verifier('contre-épreuve : le détecteur d’upsert sans site mord sur un appel synthétique', () => {
  const appelCasse = { cles: ['prix_carburants', 'updated_at'] };
  assert.ok(!appelCasse.cles.includes(COLONNE_CLE_PRIMAIRE), 'cas synthétique mal construit');
  const appelCorrige = { cles: ['site', 'prix_carburants', 'updated_at'] };
  assert.ok(appelCorrige.cles.includes(COLONNE_CLE_PRIMAIRE));
});

verifier('contre-épreuve : le marcheur ne se compte pas lui-même (régression du 03/10/2026)', () => {
  // Quand le parseur a quitté son fichier `test_*` pour devenir un module de
  // `outils/`, le marcheur s'est trouvé lui-même — son code source CITE la
  // regex qu'il cherche — et a rapporté deux « appels » à clés vides. Sous un
  // jeu dangereux vide, cela ne rougissait pas : vert en mesurant du faux.
  const fichiers = fichiersAvecUpsertStationConfig(RACINE).map((f) => path.relative(RACINE, f));
  assert.ok(
    !fichiers.some((f) => /schema-station-config\.js$/.test(f)),
    'le marcheur se compte lui-même : ' + JSON.stringify(fichiers)
  );
  assert.ok(
    !fichiers.some((f) => /^test_/.test(path.basename(f))),
    'le marcheur compte un harnais de test : ' + JSON.stringify(fichiers)
  );
});

console.log(`\n${passes} vérification(s) passée(s).`);
