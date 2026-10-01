'use strict';
// Épreuve de la garde RPC-ORPHELINE (outils/garde-rpc-orpheline.js).
//
// La preuve la plus forte qu'une épreuve puisse apporter ici n'est pas un
// dépôt jetable : c'est de rejouer la garde contre le commit RÉEL qui a cassé
// la connexion en Production — `5dcdaaa5`, tête de la branche candidate de
// #65 — et vérifier qu'elle refuse, pour la bonne raison, pour le bon nom.
// Si ce commit disparaissait un jour de l'historique local, ce seul bloc
// échouerait : c'est voulu, pas fragile — une garde dont la preuve de
// référence peut se perdre sans le dire ne prouve rien.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const garde = require('./outils/garde-rpc-orpheline.js');
const { controler, fichiersFront, fonctionsDefinies, appelsRpc } = garde;

let n = 0;
function ok(quoi) { n++; console.log('  ✅ ' + quoi); }

const DEPOT_REEL = __dirname;
const SHA_CANDIDAT_65 = '5dcdaaa55f5804f88594c91c272439cf77a123b0';

function git(depot, args) {
  return execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// ------------------------------------------------------------------
// A. Contre le dépôt RÉEL — le commit qui a réellement cassé la Production.
// ------------------------------------------------------------------
{
  let sha;
  try { sha = git(DEPOT_REEL, ['cat-file', '-e', SHA_CANDIDAT_65]) || 'present'; }
  catch (e) { sha = null; }
  assert.ok(sha !== null, 'le commit de référence ' + SHA_CANDIDAT_65 + ' doit exister localement pour cette épreuve');
  ok('A0 — le commit réel du candidat #65 est bien accessible dans ce dépôt');

  const r = controler({ candidate: SHA_CANDIDAT_65, depot: DEPOT_REEL });
  assert.strictEqual(r.ok, false, 'le candidat #65 doit être REFUSÉ : ' + r.message);
  assert.strictEqual(r.code, 'RPC_SANS_MIGRATION', 'code de refus exact : ' + r.code);
  assert.strictEqual(r.orphelins.length, 1, 'exactement un orphelin attendu, trouvé ' + r.orphelins.length);
  assert.strictEqual(r.orphelins[0].nom, 'nexus_identifiant_de_connexion', 'le bon nom est désigné');
  assert.ok(r.orphelins[0].fichiers.includes('NEXUS-Login-v1.html'), 'le bon fichier appelant est désigné');
  ok('A1 — rejoué sur le commit réel 5dcdaaa5, la garde refuse RPC_SANS_MIGRATION sur nexus_identifiant_de_connexion, appelée par NEXUS-Login-v1.html');
}

// ------------------------------------------------------------------
// B. Contre le dépôt RÉEL — HEAD est-il lui-même couvert ?
//    (La migration existe sur ce rail, simplement pas encore en Production —
//    c'est le sujet d'un autre axe, pas de celui-ci.)
// ------------------------------------------------------------------
{
  const r = controler({ candidate: 'HEAD', depot: DEPOT_REEL });
  assert.strictEqual(r.ok, true, 'HEAD doit être couvert : ' + r.message);
  assert.strictEqual(r.code, 'RPC_COUVERTES');
  ok('B1 — HEAD (ce rail) est auto-cohérent : chaque appel RPC du front est couvert par une migration du même arbre');
}

// ------------------------------------------------------------------
// C. Dépôt jetable — extraction, formes de définition, mutation négative.
// ------------------------------------------------------------------
function depotJetable() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-garde-rpc-'));
  git(d, ['init', '-q', '-b', 'banc']);
  git(d, ['config', 'user.email', 'banc@nexus.test']);
  git(d, ['config', 'user.name', 'Banc NEXUS']);
  git(d, ['config', 'commit.gpgsign', 'false']);
  fs.mkdirSync(path.join(d, 'supabase', 'migrations'), { recursive: true });

  fs.writeFileSync(path.join(d, 'supabase/migrations/20260101000000_baseline.sql'),
    'CREATE OR REPLACE FUNCTION "public"."je_suis_createur"() RETURNS boolean LANGUAGE sql AS $$ select true $$;\n');
  fs.writeFileSync(path.join(d, 'supabase/migrations/20260501000000_fonction_manuscrite.sql'),
    'create or replace function public.calculer_total(p_site text) returns numeric language sql as $$ select 1 $$;\n');
  fs.writeFileSync(path.join(d, 'NEXUS-Ecran-v1.html'),
    '<script>\n'
    + '  await supabase.rpc("je_suis_createur");\n'
    + '  await supabase.rpc(\'calculer_total\', { p_site });\n'
    + '  await supabase.rpc(nomDynamique, { x: 1 });\n'
    + '</script>\n');
  fs.writeFileSync(path.join(d, 'nexus-outil.js'),
    'module.exports.appelle = (c) => c.rpc("fonction_absente", {});\n');
  // Ne doit JAMAIS être scanné : exclu du périmètre front (fichier de test).
  fs.writeFileSync(path.join(d, 'test_fichier_hors_perimetre.js'),
    'c.rpc("devrait_etre_ignoree_ici", {});\n');
  git(d, ['add', '-A']); git(d, ['commit', '-q', '-m', 'état couvert, un orphelin, un dynamique']);
  return d;
}

const D = depotJetable();

{
  const front = fichiersFront('banc', D);
  assert.ok(front.includes('NEXUS-Ecran-v1.html') && front.includes('nexus-outil.js'),
    'les deux fichiers front attendus sont vus : ' + front.join(','));
  assert.ok(!front.includes('test_fichier_hors_perimetre.js'),
    'un fichier test_*.js, jamais déployé sur Pages, est exclu du périmètre');
  ok('C1 — le périmètre front exclut les fichiers test_*.js, jamais publiés sur Pages');
}

{
  const migs = garde.fichiersMigrations('banc', D);
  const defs = fonctionsDefinies('banc', migs, D);
  assert.ok(defs.has('je_suis_createur'), 'forme "public"."nom" vue');
  assert.ok(defs.has('calculer_total'), 'forme public.nom (sans guillemets) vue');
  ok('C2 — les deux formes réelles de ce dépôt (schéma entre guillemets et schéma nu) sont extraites');
}

{
  const front = fichiersFront('banc', D);
  const { appels, dynamiques } = appelsRpc('banc', front, D);
  assert.ok(appels.has('je_suis_createur') && appels.has('calculer_total') && appels.has('fonction_absente'),
    'les trois appels littéraux sont vus : ' + [...appels.keys()].join(','));
  assert.strictEqual(dynamiques.length, 1, 'un seul appel à nom dynamique attendu, vu ' + dynamiques.length);
  assert.strictEqual(dynamiques[0].expression, 'nomDynamique');
  ok('C3 — les appels à nom littéral sont tous vus, l’appel à nom dynamique est signalé à part (ni ignoré, ni compté comme orphelin)');
}

{
  const r = controler({ candidate: 'banc', depot: D });
  assert.strictEqual(r.ok, false, 'le banc doit être refusé : ' + r.message);
  assert.strictEqual(r.code, 'RPC_SANS_MIGRATION');
  assert.strictEqual(r.orphelins.length, 1);
  assert.strictEqual(r.orphelins[0].nom, 'fonction_absente');
  assert.ok(r.orphelins[0].fichiers.includes('nexus-outil.js'));
  assert.strictEqual(r.dynamiques.length, 1, 'l’avertissement dynamique est transmis jusqu’au verdict, sans bloquer à sa place');
  ok('C4 — un seul vrai orphelin (fonction_absente) est refusé ; l’appel dynamique ne devient ni un refus ni un silence');
}

// Mutation négative : ajouter la migration manquante doit faire passer le
// banc au vert — et UNIQUEMENT ça, rien d'autre ne doit changer.
{
  fs.writeFileSync(path.join(D, 'supabase/migrations/20261001000000_ajoute_fonction_absente.sql'),
    'create or replace function public.fonction_absente() returns void language sql as $$ select $$;\n');
  git(D, ['add', '-A']); git(D, ['commit', '-q', '-m', 'ajoute la migration manquante']);
  const apres = controler({ candidate: 'banc', depot: D });
  assert.strictEqual(apres.ok, true, 'après ajout de la migration, le banc doit passer : ' + apres.message);
  assert.strictEqual(apres.code, 'RPC_COUVERTES');
  ok('C5 — mutation négative : ajouter la seule migration manquante fait passer le banc de REFUS à OK, rien d’autre ne change');
}

// Contre-témoin : une migration de pure prose (aucun DDL) n'invente aucune
// fonction — sinon la garde serait verte « pour la mauvaise raison ».
{
  const migs = garde.fichiersMigrations('banc', D);
  const defs = fonctionsDefinies('banc', migs, D);
  assert.ok(!defs.has('rien_de_tel'), 'aucune fonction inventée hors DDL réel');
  ok('C6 — contre-témoin : aucune fonction n’est inventée là où il n’y a pas de CREATE FUNCTION');
}

// ------------------------------------------------------------------
// D. Innocuité — même preuve que la garde-sœur : ni réseau, ni secret.
// ------------------------------------------------------------------
{
  const src = fs.readFileSync(path.join(__dirname, 'outils', 'garde-rpc-orpheline.js'), 'utf8');
  for (const motif of ['PGPASSWORD', 'psql', 'service_role', 'SUPABASE_', 'DB_URL', 'https://']) {
    assert.ok(!src.includes(motif), 'la garde ne doit jamais citer ' + motif);
  }
  assert.ok(!/require\(['"](https|net|tls)['"]\)/.test(src), 'aucun module réseau requis');
  ok('D1 — la garde ne nomme aucun secret, n’a aucun accès réseau (lecture de sa propre source)');
}

console.log('\n' + n + '/' + n + ' — garde RPC-ORPHELINE éprouvée, dont le rejeu sur le commit réel ayant cassé la Production.');
