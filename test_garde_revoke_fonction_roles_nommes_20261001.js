'use strict';
// Épreuve de la garde REVOKE-FONCTION-RÔLES-NOMMÉS
// (outils/garde-revoke-fonction-roles-nommes.js).
//
// CE QUE CETTE ÉPREUVE DOIT PROUVER. La garde naît d'un défaut qui s'est
// produit QUATRE fois : `revoke all on function f() from public` ne retire ni
// `anon` ni `authenticated`, parce que Supabase leur accorde EXECUTE par un
// grant nommé (`alter default privileges`). La quatrième occurrence a été
// CONSTATÉE en Production le 01/10/2026, alors que la leçon était déjà écrite
// en prose dans `20260916210000` depuis le 16/09. La prose n'arrête pas une
// récurrence.
//
// POURQUOI CHAQUE CONTRÔLE EST UN COUPLE. Une garde verte ne prouve rien : le
// 08/09/2026 quatre gardes étaient vertes et inutiles. Chaque cas est donc
// écrit deux fois — la forme correcte, qui doit passer, et la MUTATION
// MINIMALE de cette même forme, qui doit être refusée avec son code exact. Si
// la garde cessait de mordre, ce sont les secondes moitiés qui rougiraient.
//
// LES MUTATIONS SONT ISOLÉES. Chaque cas construit son propre dossier de
// migrations jetable. Deux mutations concurrentes dans le même bac ne mesurent
// rien : l'une restaure ce que l'autre a cassé, et le vert ressemble alors au
// vrai défaut (leçon du 23/09/2026).

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const garde = require('./outils/garde-revoke-fonction-roles-nommes.js');
const { controler, relever, statuer, sansCommentaires, SEUIL, DETTE_GELEE } = garde;

let n = 0;
function ok(quoi) { n++; console.log('  ✅ ' + quoi); }

// Un dossier de migrations jetable, avec les seuls fichiers que le cas décrit.
// `dette: 0` : un bac neuf n'a pas de dette historique, et la constante gelée
// du dépôt réel n'a rien à dire ici.
function bac(fichiers) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-revoke-'));
  for (const [nom, sql] of Object.entries(fichiers)) fs.writeFileSync(path.join(d, nom), sql);
  return d;
}
function juger(fichiers, options = {}) {
  const d = bac(fichiers);
  try { return controler({ dossier: d, dette: 0, ...options }); }
  finally { fs.rmSync(d, { recursive: true, force: true }); }
}

const APRES = '20261001120000_cas.sql';   // >= SEUIL : doit être conforme
const AVANT = '20260901120000_cas.sql';   // <  SEUIL : dette inventoriée

const FONCTION = `
create or replace function public.ma_fonction()
returns trigger language plpgsql security definer set search_path = public
as $$ begin return new; end; $$;
`;

console.log('\nGarde : un revoke sur fonction nomme anon ET authenticated\n');

// ------------------------------------------------------------------
// R1 — la forme exacte du défaut constaté quatre fois.
// ------------------------------------------------------------------
{
  const bon = juger({ [APRES]: FONCTION + 'revoke all on function public.ma_fonction() from public, anon, authenticated;\n' });
  assert.ok(bon.ok, 'nommer les deux rôles doit passer : ' + bon.message);

  const mut = juger({ [APRES]: FONCTION + 'revoke all on function public.ma_fonction() from public;\n' });
  assert.strictEqual(mut.ok, false, '`from public` seul doit être refusé');
  assert.deepStrictEqual(mut.codes, ['REVOKE_INCOMPLET']);
  const roles = mut.refus[0].manques.map(m => m.role + ':' + m.code).sort();
  assert.deepStrictEqual(roles, ['anon:NON_STATUE', 'authenticated:NON_STATUE'],
    'les deux rôles doivent être cités comme non statués : ' + JSON.stringify(mut.refus));
  ok('R1 — `revoke ... from public` seul est refusé, et les DEUX rôles sont nommés dans le refus');
}

// ------------------------------------------------------------------
// R2 — la moitié du travail. C'est la forme la plus dangereuse : elle a l'air
// d'avoir compris la leçon. 11 des 18 dettes du dépôt sont exactement celle-là.
// ------------------------------------------------------------------
{
  const mut = juger({ [APRES]: FONCTION + 'revoke all on function public.ma_fonction() from public, anon;\n' });
  assert.strictEqual(mut.ok, false, '`anon` sans `authenticated` doit être refusé');
  assert.deepStrictEqual(mut.refus[0].manques.map(m => m.role), ['authenticated'],
    'seul `authenticated` doit manquer, `anon` est statué');
  assert.ok(/authenticated/.test(mut.message) && !/« anon »/.test(mut.message),
    'le message doit reprocher `authenticated` et pas `anon` : ' + mut.message);
  ok('R2 — nommer `anon` et oublier `authenticated` est refusé (le défaut à moitié corrigé)');
}

// ------------------------------------------------------------------
// R3 — la garde n'exige pas de révoquer. Elle exige de le DIRE. Certaines
// fonctions doivent légitimement rester exécutables par `authenticated`.
// ------------------------------------------------------------------
{
  const bon = juger({ [APRES]: FONCTION
    + 'revoke all on function public.ma_fonction() from public, anon;\n'
    + '-- nexus-acl-intention: public.ma_fonction() garde authenticated (RPC appelee par l ecran Mes ecarts)\n' });
  assert.ok(bon.ok, 'une dérogation motivée doit passer : ' + bon.message);

  const mut = juger({ [APRES]: FONCTION
    + 'revoke all on function public.ma_fonction() from public, anon;\n'
    + '-- nexus-acl-intention: public.ma_fonction() garde authenticated\n' });
  assert.strictEqual(mut.ok, false, 'une dérogation sans motif doit être refusée');
  assert.deepStrictEqual(mut.refus[0].manques.map(m => m.code), ['DEROGATION_SANS_MOTIF']);
  ok('R3 — garder un rôle est permis AVEC motif, refusé sans motif');
}

// ------------------------------------------------------------------
// R4 — un marqueur n'est pas une instruction SQL. Annoncer « ferme » sans
// révoquer est le pire des deux mondes : la trace dit fermé, l'ACL dit ouvert.
// ------------------------------------------------------------------
{
  const mut = juger({ [APRES]: FONCTION
    + 'revoke all on function public.ma_fonction() from public, anon;\n'
    + '-- nexus-acl-intention: public.ma_fonction() ferme authenticated\n' });
  assert.strictEqual(mut.ok, false, '« ferme » annoncé sans revoke doit être refusé');
  assert.deepStrictEqual(mut.refus[0].manques.map(m => m.code), ['FERME_ANNONCE_NON_FAIT']);
  assert.ok(/n’est pas une instruction SQL/.test(mut.message), 'le motif doit l’expliquer : ' + mut.message);
  ok('R4 — annoncer « ferme » sans `revoke` est refusé : un commentaire ne retire pas un droit');
}

// ------------------------------------------------------------------
// R5 — une migration cite volontiers l'instruction qu'elle explique. Lire la
// prose comme du code ferait inventer des violations ; et une migration qui
// RACONTE `from public` sans en exécuter aucun ne vise aucune fonction.
// ------------------------------------------------------------------
{
  const prose = '-- `revoke all on function public.ma_fonction() from public` ne suffit pas :\n'
    + '--   il ne retire que l entree du pseudo-role PUBLIC, jamais un grant nomme.\n' + FONCTION;
  const r = juger({ [APRES]: prose });
  assert.strictEqual(r.fonctionsVisees, 0, 'un revoke en commentaire ne vise aucune fonction : ' + r.message);
  assert.ok(r.ok, 'de la prose seule ne doit pas être refusée : ' + r.message);
  assert.ok(!/revoke/i.test(sansCommentaires(prose)), 'sansCommentaires doit avoir retiré le revoke cité');

  // La mutation : la même ligne, décommentée. Elle devient du code, et mord.
  const mut = juger({ [APRES]: FONCTION + 'revoke all on function public.ma_fonction() from public;\n' });
  assert.strictEqual(mut.ok, false, 'décommentée, la même ligne doit être refusée');
  ok('R5 — un `revoke` cité en commentaire n’est pas du code ; décommenté, il est jugé');
}

// ------------------------------------------------------------------
// R6 — le seuil. Sans lui, la garde refuserait 18 migrations déjà fusionnées
// et serait désarmée dans la journée. Avec lui, le passé est COMPTÉ.
// ------------------------------------------------------------------
{
  const vieux = { [AVANT]: FONCTION + 'revoke all on function public.ma_fonction() from public;\n' };
  const d = bac(vieux);
  try {
    const compte = controler({ dossier: d, dette: 1 });
    assert.ok(compte.ok, 'une migration antérieure au seuil est une dette, pas un refus : ' + compte.message);
    assert.strictEqual(compte.detteMesuree, 1);
    assert.strictEqual(compte.refus.length, 0, 'le passé ne doit pas produire de refus');

    // Mutation : la dette bouge et la constante ne le sait pas.
    const faux = controler({ dossier: d, dette: 0 });
    assert.strictEqual(faux.ok, false, 'une dette non conforme à la constante doit rougir');
    assert.deepStrictEqual(faux.codes, ['DETTE_NON_CONFORME_A_LA_MESURE']);
    ok('R6 — sous le seuil c’est une dette comptée ; si le compte bouge, la garde rougit');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

// ------------------------------------------------------------------
// R7 — le refus doit NOMMER le fichier à corriger. Un `bloquant` qui ne
// désigne rien est inarbitrable. Quand plusieurs migrations touchent la même
// fonction, c'est la plus récente qui aurait pu statuer.
// ------------------------------------------------------------------
{
  const r = juger({
    [AVANT]: FONCTION + 'revoke all on function public.ma_fonction() from public;\n',
    [APRES]: 'revoke all on function public.ma_fonction() from public;\n',
  });
  assert.strictEqual(r.ok, false, 'la migration récente aurait pu statuer');
  assert.strictEqual(r.refus[0].migration, APRES,
    'c’est la migration la plus récente qui est nommée, pas la première : ' + r.refus[0].migration);
  assert.ok(r.message.includes(APRES), 'le message doit contenir le nom du fichier : ' + r.message);
  assert.ok(/public\.ma_fonction\(\)/.test(r.message), 'le message doit contenir la signature : ' + r.message);
  ok('R7 — le refus nomme le fichier le plus récent ET la signature exacte');
}

// ------------------------------------------------------------------
// R8 — le dépôt réel. La dette est une MESURE DATÉE, pas une propriété du
// dépôt : elle est gelée pour que sa variation soit visible dans les deux sens.
// ------------------------------------------------------------------
{
  const reel = controler();
  assert.ok(reel.ok, 'le dépôt réel doit être conforme à sa dette gelée : ' + reel.message);
  assert.strictEqual(reel.detteMesuree, DETTE_GELEE,
    `la dette mesurée (${reel.detteMesuree}) doit valoir la constante gelée (${DETTE_GELEE})`);
  assert.strictEqual(reel.refus.length, 0, 'aucune migration récente ne doit être en refus');
  assert.strictEqual(reel.seuil, SEUIL);

  // La fonction qui a motivé toute la garde : son sort doit être statué.
  const f = relever(path.join(__dirname, 'supabase', 'migrations'))
    .get('public.nexus_garde_regularisation_reception()');
  assert.ok(f, 'la fonction du 19/09 doit être relevée');
  assert.deepStrictEqual(statuer(f), [],
    'anon et authenticated doivent être statués pour nexus_garde_regularisation_reception');
  assert.ok(f.revoques.has('anon') && f.revoques.has('authenticated'),
    'les deux rôles doivent être NOMMÉS dans un revoke, pas seulement déclarés');
  ok('R8 — le dépôt réel : dette = ' + DETTE_GELEE + ', et la fonction du 19/09 ferme les deux rôles par leur nom');
}

// ------------------------------------------------------------------
// R9 — un appel hors contrat ne doit produire AUCUN verdict. Leçon du
// 01/10/2026 : une option mal orthographiée était avalée en silence et la
// garde rendait un verdict plausible sur une autre question que celle posée.
// ------------------------------------------------------------------
{
  assert.throws(() => controler({ dossier_migrations: '/tmp' }), /non reconnue/,
    'une option inconnue doit lever, pas être ignorée');
  assert.throws(() => controler({ seuils: '20270101000000' }), /non reconnue/);
  ok('R9 — une option non reconnue lève : la garde refuse de juger un appel mal nommé');
}

// ------------------------------------------------------------------
// R10 — la garde ne lit que des fichiers. Ni secret, ni réseau : sinon elle
// deviendrait un chemin d'écriture déguisé et ne pourrait plus tourner en CI
// sur une branche quelconque.
// ------------------------------------------------------------------
{
  const src = fs.readFileSync(path.join(__dirname, 'outils', 'garde-revoke-fonction-roles-nommes.js'), 'utf8');
  const code = src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const interdit of ['PGPASSWORD', 'psql', 'SUPABASE_', 'DB_URL', 'https://', 'service_role']) {
    assert.ok(!code.includes(interdit), 'la garde ne doit pas contenir `' + interdit + '` hors commentaire');
  }
  assert.ok(!/require\(['"](https?|net|tls|child_process)['"]\)/.test(code),
    'la garde ne doit ouvrir ni réseau ni sous-processus');
  ok('R10 — la garde est purement `fs` : aucun secret, aucun réseau, aucun sous-processus');
}

console.log(`\n${n} tests passés.`);
