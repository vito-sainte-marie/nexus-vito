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

// ------------------------------------------------------------------
// R11 — le gabarit `%s` n'est pas une signature (04/10/2026). Reproduction
// sur le fichier RÉEL `20260916221100` : sa boucle
// `foreach v_sig in array v_signatures` révoque par
// `execute format('revoke all on function %s from anon', v_sig)`. La garde
// lisait `%s` comme une fonction, avec les « rôles » `anon'` et `v_sig)`, et
// les deux fonctions réelles restaient invisibles.
// Mutation visée : « ignorer `%s` ». Elle ferait disparaître l'entrée
// fantôme ET les deux fonctions : c'est la seconde moitié qui la refuse.
// ------------------------------------------------------------------
{
  const dossier = path.join(__dirname, 'supabase', 'migrations');
  const nom = fs.readdirSync(dossier).find(f => f.startsWith('20260916221100'));
  assert.ok(nom, 'la migration 20260916221100 doit exister');
  const r = juger({ [nom]: fs.readFileSync(path.join(dossier, nom), 'utf8') }, { dette: 2 });
  const d = bac({ [nom]: fs.readFileSync(path.join(dossier, nom), 'utf8') });
  let p;
  try { p = relever(d); } finally { fs.rmSync(d, { recursive: true, force: true }); }
  assert.ok(![...p.keys()].some(k => /%/.test(k)), 'aucune signature ne doit contenir `%` : ' + [...p.keys()].join(' | '));
  for (const sig of ['public.fdj_saisir_caisse_manager(uuid,numeric,text,numeric,text,text,text)',
                     'public.fdj_demandes_correction_du_quart(uuid)']) {
    const f = p.get(sig);
    assert.ok(f, 'la fonction réelle doit être relevée par la boucle : ' + sig);
    assert.ok(f.revoques.has('public') && f.revoques.has('anon'), 'public et anon sont révoqués par la boucle : ' + sig);
    assert.deepStrictEqual(statuer(f).map(m => m.role), ['authenticated'],
      'authenticated reste NON statué (accordé, jamais déclaré) : ' + sig);
  }
  assert.ok(r.ok && r.detteMesuree === 2 && r.nonResolus.length === 0,
    'deux entrées de dette, aucun gabarit non résolu : ' + r.message);
  ok('R11 — 20260916221100 : `%s` disparaît, ses 2 fonctions réelles sont jugées (authenticated non statué)');
}

// ------------------------------------------------------------------
// R12 — un gabarit qu'aucun tableau lisible n'alimente est REFUSÉ, quelle
// que soit l'estampille : ne pas savoir lire n'est pas « rien à dire ».
// ------------------------------------------------------------------
{
  const boucle = (decl) => FONCTION + `do $$ declare v_sig text;${decl}
begin foreach v_sig in array v_signatures loop
  execute format('revoke all on function %s from public', v_sig);
  execute format('revoke all on function %s from anon', v_sig);
  execute format('revoke all on function %s from authenticated', v_sig);
end loop; end; $$;\n`;
  const lisible = juger({ [AVANT]: boucle(" v_signatures text[] := array['public.ma_fonction()'];") });
  assert.ok(lisible.ok && lisible.nonResolus.length === 0, 'boucle lisible et complète : ' + lisible.message);

  // Mutation : le tableau vient d'ailleurs (paramètre, requête) — illisible.
  const opaque = juger({ [AVANT]: boucle('') });
  assert.strictEqual(opaque.ok, false, 'un gabarit non résolu doit rougir même sous le seuil');
  assert.deepStrictEqual(opaque.codes, ['REVOKE_DYNAMIQUE_NON_RESOLU']);
  assert.ok(opaque.message.includes(AVANT), 'le refus nomme la migration : ' + opaque.message);

  // Mutation : un `%s` hors `execute format` (la forme statique) — jamais une signature.
  const nu = juger({ [AVANT]: "revoke all on function %s from anon, authenticated;\n" });
  assert.deepStrictEqual(nu.codes, ['REVOKE_DYNAMIQUE_NON_RESOLU']);
  ok('R12 — gabarit non résolu (boucle opaque ou `%s` nu) : REVOKE_DYNAMIQUE_NON_RESOLU, jamais écarté');
}

// ------------------------------------------------------------------
// R13 — la résolution ne MASQUE aucune absence réelle. Au-delà du seuil, une
// boucle qui oublie `authenticated` est refusée comme sa forme statique.
// ------------------------------------------------------------------
{
  const boucle = (roles) => FONCTION + `do $$ declare v_sig text; v_signatures text[] := array['public.ma_fonction()'];
begin foreach v_sig in array v_signatures loop
${roles.map(r => `  execute format('revoke all on function %s from ${r}', v_sig);`).join('\n')}
end loop; end; $$;\n`;
  const complet = juger({ [APRES]: boucle(['public', 'anon', 'authenticated']) });
  assert.ok(complet.ok, 'boucle complète au-delà du seuil : ' + complet.message);

  const oubli = juger({ [APRES]: boucle(['public', 'anon']) });
  assert.strictEqual(oubli.ok, false, 'une boucle qui oublie authenticated doit être refusée');
  assert.deepStrictEqual(oubli.codes, ['REVOKE_INCOMPLET']);
  assert.ok(/public\.ma_fonction\(\)/.test(oubli.message), 'le refus nomme la fonction réelle : ' + oubli.message);
  ok('R13 — boucle sans authenticated après le seuil : REVOKE_INCOMPLET sur la fonction réelle');
}

// ------------------------------------------------------------------
// R14 — le dépôt réel : plus aucune signature `%`, aucun gabarit non résolu,
// et les boucles qui révoquent authenticated (220600 bloc 2, 221000 bloc 2)
// statuent leurs fonctions.
// ------------------------------------------------------------------
{
  const p = relever(path.join(__dirname, 'supabase', 'migrations'));
  assert.deepStrictEqual([...p.keys()].filter(k => /%/.test(k)), []);
  assert.deepStrictEqual(p.nonResolus, []);
  for (const sig of ['public.fdj_calculer_caisse(uuid,numeric,numeric)', 'public.fdj_cle_idempotence(text,text)']) {
    assert.ok(p.get(sig), 'relevée : ' + sig);
    assert.deepStrictEqual(statuer(p.get(sig)), [], 'statuée par sa boucle : ' + sig);
  }
  ok('R14 — dépôt réel : 0 signature `%`, 0 gabarit non résolu, boucles fermantes statuées');
}

console.log(`\n${n} tests passés.`);
