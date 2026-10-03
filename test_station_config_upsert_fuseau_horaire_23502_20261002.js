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

// ── Le parseur DDL/upsert vit désormais dans outils/schema-station-config.js.
// MESURÉ le 03/10/2026 : ces 149 lignes étaient dupliquées à l'identique dans
// l'épreuve sœur `test_station_config_horaires_nullable_et_site_pk_20261003.js`.
// Deux copies d'un instrument, c'est deux instruments : celui qu'on corrige et
// celui qu'on oublie. L'extraction a d'ailleurs révélé deux défauts que la
// duplication masquait — un `site` codé en dur là où `COLONNE_CLE_PRIMAIRE`
// était due, et un `assert` utilisé sans être requis (il était en portée
// ambiante tant que le code vivait dans un fichier `test_*`).
const {
  colonnesStationConfig,
  colonnesDangereuses,
  appelsUpsertStationConfig,
  fichiersAvecUpsertStationConfig,
} = require('./outils/schema-station-config.js');

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

  // `dangereuses` n'est ici que le MATÉRIAU de la boucle qui suit — aucune
  // assertion ne porte sur sa composition, et c'est délibéré.
  //
  // La version précédente figeait le jeu complet à `['horaires']` : un
  // instantané du 02/10, périmé dès que `20261003120000` a rendu `horaires`
  // nullable. Une épreuve qui fige l'état d'un voisin rougit à la correction
  // du voisin, et accuse alors le correctif.
  //
  // J'ai d'abord écrit à la place un `assert.ok(!dangereuses.includes(
  // 'fuseau_horaire'))`. MESURÉ le 03/10/2026 par mutation (une migration
  // rendant la colonne à nouveau `NOT NULL`) : c'est l'assertion
  // « fuseau_horaire doit être nullable avec le correctif », douze lignes plus
  // haut, qui rougit la première. L'assertion était donc **impliquée** par sa
  // voisine, donc infalsifiable, donc sans valeur — règle QA du dépôt rappelée
  // au §3 ci-dessous. Retirée plutôt que gardée pour la forme.
  //
  // La composition du jeu est tenue en UN seul endroit, l'épreuve sœur
  // `test_station_config_horaires_nullable_et_site_pk_20261003.js`, qui
  // l'affirme des deux côtés : `[]` aujourd'hui, `['horaires','fuseau_horaire']`
  // quand on retire les deux correctifs.
  //
  // La boucle, elle, est un cliquet : vide aujourd'hui puisque plus aucune
  // colonne n'est dangereuse, elle mord au premier `NOT NULL` sans défaut
  // réintroduit. Que le mécanisme morde est prouvé par la contre-épreuve du §3,
  // pas supposé.

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
