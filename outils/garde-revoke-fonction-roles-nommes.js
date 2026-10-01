#!/usr/bin/env node
'use strict';
// ---------------------------------------------------------------------------
// UN `revoke ... from public` NE FERME NI `anon` NI `authenticated`
//
// POURQUOI CETTE GARDE EXISTE. Supabase installe sur le schéma `public` un
// `alter default privileges ... grant execute on functions to anon,
// authenticated, service_role`. Les droits de ces trois rôles sont donc des
// GRANTS NOMMÉS, jamais l'entrée du pseudo-rôle PUBLIC. Un
// `revoke all on function f() from public` laisse l'ACL inchangée, octet pour
// octet — mesuré le 01/10/2026 sur un banc `supabase/postgres:17.6.1.175`.
//
// LA PROSE N'A PAS SUFFI. La leçon est écrite dans le dépôt depuis le
// 16/09/2026 (`20260916210000`, « après trois occurrences du même motif »).
// Le 19/09 `20260919103000` a commis la quatrième, et la lecture Production du
// 01/10/2026 l'a constatée : `anon=X`, `authenticated=X` sur
// `nexus_garde_regularisation_reception`. Une leçon qu'aucune machine ne
// mesure n'est pas une leçon, c'est un souvenir.
//
// CE QUE LA GARDE EXIGE — ET CE QU'ELLE N'EXIGE PAS. Elle n'exige PAS de
// révoquer : plusieurs fonctions doivent légitimement rester exécutables par
// `authenticated` (une RPC appelée par l'application connectée, par exemple
// `mes_ecarts_caisse()`). Le défaut n'est pas le grant, c'est le SILENCE sur
// l'intention. Toute migration qui révoque sur une fonction doit donc, pour
// `anon` comme pour `authenticated`, soit le nommer dans un `revoke`, soit
// déclarer qu'elle le laisse ouvert, avec un motif :
//
//   -- nexus-acl-intention: public.ma_fonction(args) garde authenticated (RPC
//   --   appelée par l'écran X)
//
// Un marqueur sans motif est refusé : une dérogation qui ne dit pas pourquoi
// n'est pas arbitrable.
//
// LA DETTE HISTORIQUE EST COMPTÉE, PAS TOLÉRÉE AU CAS PAR CAS. Un contrôle
// positionnel rendrait le nombre de dérogations non borné. Les migrations
// antérieures à SEUIL sont donc inventoriées et leur nombre est GELÉ : s'il
// bouge dans un sens ou dans l'autre, l'épreuve rougit et la constante doit
// être remesurée et datée. Une dette qui diminue en silence est aussi
// invisible qu'une dette qui grandit.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const RACINE = process.env.NEXUS_DEPOT || path.resolve(__dirname, '..');
const DOSSIER_DEFAUT = path.join('supabase', 'migrations');

// Toute migration dont l'estampille est >= SEUIL doit être conforme. Les
// antérieures forment la dette inventoriée ci-dessous.
const SEUIL = '20261001000000';

// Mesuré le 01/10/2026 sur `supabase/migrations` : 27 fonctions visées par au
// moins un `revoke`, dont 18 où `anon` et/ou `authenticated` n'est jamais
// nommé — 7 ne nomment que `public`, 11 nomment `anon` et oublient
// `authenticated`. Ce nombre est une mesure datée, pas une propriété du dépôt.
const DETTE_GELEE = 18;

const ROLES_A_STATUER = ['anon', 'authenticated'];

// Noms d'options reconnus. Leçon du 01/10/2026 : une option mal nommée était
// ignorée en silence et la garde rendait un verdict plausible sur une autre
// question que celle posée. Un appel hors contrat ne doit produire AUCUN
// verdict, vert ou rouge.
const OPTIONS_RECONNUES = new Set(['depot', 'dossier', 'seuil', 'dette']);

// `revoke <privilèges> on function <signature> from <rôles>;`
const REVOKE = /revoke\s+(?:all\s+privileges|all|execute)\s+on\s+function\s+([\s\S]+?)\s+from\s+([^;]+);/gi;
// `-- nexus-acl-intention: <signature> garde <rôle> (<motif>)`
const INTENTION = /--\s*nexus-acl-intention\s*:\s*(.+?)\s+(garde|ferme)\s+(anon|authenticated)\s*(\(([^)]*)\))?/gi;

// Le texte d'une migration parle de SQL ET de prose. Les commentaires `--`
// citent volontiers l'instruction qu'ils expliquent : les lire comme du code
// ferait inventer des violations. Les marqueurs d'intention, eux, vivent
// justement dans les commentaires et sont lus séparément.
function sansCommentaires(sql) {
  return sql.split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
}

function normaliserSignature(sig) {
  return sig.replace(/"/g, '').replace(/\s+/g, '').toLowerCase();
}

function estampille(nom) {
  const m = /^(\d{14})_/.exec(nom);
  return m ? m[1] : null;
}

// Relève, pour un dossier de migrations, ce que chaque fonction a reçu : les
// rôles nommés dans un revoke, et les intentions déclarées. Rendu par
// fonction ET par migration, parce qu'un refus doit nommer le fichier qui le
// cause.
function relever(dossier) {
  const fichiers = fs.readdirSync(dossier).filter(f => f.endsWith('.sql')).sort();
  const parFonction = new Map();
  for (const nom of fichiers) {
    const brut = fs.readFileSync(path.join(dossier, nom), 'utf8');
    const code = sansCommentaires(brut);
    let m;
    REVOKE.lastIndex = 0;
    while ((m = REVOKE.exec(code))) {
      const sig = normaliserSignature(m[1]);
      const roles = m[2].split(',').map(r => normaliserSignature(r)).filter(Boolean);
      if (!parFonction.has(sig)) parFonction.set(sig, { signature: sig, revoques: new Set(), intentions: new Map(), migrations: [] });
      const f = parFonction.get(sig);
      roles.forEach(r => f.revoques.add(r));
      if (!f.migrations.includes(nom)) f.migrations.push(nom);
    }
    INTENTION.lastIndex = 0;
    while ((m = INTENTION.exec(brut))) {
      const sig = normaliserSignature(m[1]);
      if (!parFonction.has(sig)) parFonction.set(sig, { signature: sig, revoques: new Set(), intentions: new Map(), migrations: [] });
      const f = parFonction.get(sig);
      f.intentions.set(m[3].toLowerCase(), { verbe: m[2].toLowerCase(), motif: (m[5] || '').trim(), migration: nom });
      if (!f.migrations.includes(nom)) f.migrations.push(nom);
    }
  }
  return parFonction;
}

// Pour une fonction, dit si son sort est STATUÉ pour chacun des deux rôles, et
// sinon pourquoi. « Statué » = révoqué nommément, ou déclaré ouvert AVEC motif.
function statuer(f) {
  const manques = [];
  for (const role of ROLES_A_STATUER) {
    if (f.revoques.has(role)) continue;
    const i = f.intentions.get(role);
    if (!i) { manques.push({ role, code: 'NON_STATUE' }); continue; }
    if (i.verbe === 'ferme' && !f.revoques.has(role)) {
      manques.push({ role, code: 'FERME_ANNONCE_NON_FAIT', migration: i.migration });
      continue;
    }
    if (!i.motif) { manques.push({ role, code: 'DEROGATION_SANS_MOTIF', migration: i.migration }); continue; }
  }
  return manques;
}

function controler(options = {}) {
  const inconnues = Object.keys(options).filter(k => !OPTIONS_RECONNUES.has(k));
  if (inconnues.length) {
    throw new Error('garde-revoke-fonction-roles-nommes : option(s) non reconnue(s) : '
      + inconnues.join(', ') + '. Attendu : ' + [...OPTIONS_RECONNUES].join(', ')
      + '. Refus d’émettre un verdict sur un appel mal nommé.');
  }
  const racine = options.depot || RACINE;
  const dossier = options.dossier || path.join(racine, DOSSIER_DEFAUT);
  const seuil = options.seuil || SEUIL;
  const detteAttendue = options.dette === undefined ? DETTE_GELEE : options.dette;

  const parFonction = relever(dossier);
  const refus = [];
  const dette = [];
  for (const f of [...parFonction.values()].sort((a, b) => a.signature.localeCompare(b.signature))) {
    const manques = statuer(f);
    if (!manques.length) continue;
    // La migration la plus récente qui touche cette fonction décide du régime :
    // c'est elle qui aurait pu statuer et ne l'a pas fait.
    const derniere = f.migrations.slice().sort().pop();
    const est = estampille(derniere);
    if (est && est >= seuil) refus.push({ signature: f.signature, migration: derniere, manques });
    else dette.push({ signature: f.signature, migration: derniere, manques });
  }

  const codes = [];
  if (refus.length) codes.push('REVOKE_INCOMPLET');
  if (dette.length !== detteAttendue) codes.push('DETTE_NON_CONFORME_A_LA_MESURE');

  return {
    ok: codes.length === 0,
    codes,
    seuil,
    dossier,
    fonctionsVisees: parFonction.size,
    refus,
    dette,
    detteAttendue,
    detteMesuree: dette.length,
    message: rendre({ codes, seuil, parFonction, refus, dette, detteAttendue }),
  };
}

function rendre({ codes, seuil, parFonction, refus, dette, detteAttendue }) {
  const l = [];
  l.push('── Garde : un revoke sur fonction nomme anon ET authenticated ──');
  l.push('  dossier mesuré   : ' + parFonction.size + ' fonction(s) visée(s) par un revoke');
  l.push('  seuil            : estampille >= ' + seuil + ' doit être conforme');
  l.push('  dette historique : ' + dette.length + ' attendue(s) ' + detteAttendue);
  if (refus.length) {
    l.push('');
    l.push('  REFUS :');
    for (const r of refus) {
      for (const m of r.manques) {
        l.push('    [' + m.code + '] ' + r.migration);
        l.push('      ' + r.signature + ' — rôle « ' + m.role + ' » : ' + motifDe(m.code, m.role));
      }
    }
  }
  if (codes.includes('DETTE_NON_CONFORME_A_LA_MESURE')) {
    l.push('');
    l.push('  [DETTE_NON_CONFORME_A_LA_MESURE] la dette historique vaut ' + dette.length
      + ', la constante dit ' + detteAttendue + '. Une dette qui bouge — dans un sens'
      + ' comme dans l’autre — doit être remesurée et datée, pas suivie de mémoire.');
  }
  l.push('');
  l.push(codes.length ? '── REFUSÉ : ' + codes.join(', ') + ' ──' : '── CONFORME ──');
  return l.join('\n');
}

function motifDe(code, role) {
  switch (code) {
    case 'NON_STATUE':
      return 'ni révoqué nommément, ni déclaré ouvert. `revoke ... from public` ne le '
        + 'retire pas : Supabase le lui accorde par un grant nommé.';
    case 'DEROGATION_SANS_MOTIF':
      return 'déclaré gardé par un marqueur `nexus-acl-intention` sans motif entre '
        + 'parenthèses. Une dérogation qui ne dit pas pourquoi n’est pas arbitrable.';
    case 'FERME_ANNONCE_NON_FAIT':
      return 'annoncé « ferme ' + role + ' » par un marqueur, mais aucun `revoke` ne le '
        + 'nomme. Un marqueur n’est pas une instruction SQL.';
    default: return '';
  }
}

if (require.main === module) {
  let r;
  try {
    r = controler({ depot: process.argv[2] || undefined });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  console.log(r.message);
  process.exit(r.ok ? 0 : 1);
}

module.exports = { controler, relever, statuer, sansCommentaires, SEUIL, DETTE_GELEE, ROLES_A_STATUER };
