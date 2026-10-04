'use strict';
// Épreuve du lot sécurité anon5
// (supabase/migrations/20261004130000_revoquer_anon_quatre_fonctions_hors_fdj.sql).
//
// CE QUE CETTE ÉPREUVE DOIT PROUVER. Quatre fonctions hors FDJ étaient
// exécutables par `anon` en Production (lecture seule du 04/10/2026), dont
// `_generate_inventory_review_core`, qui ne contrôle rien et rend les agrégats
// d'inventaire de n'importe quel site. La migration les ferme. L'épreuve fige :
//   - core fermée à anon ET à authenticated, ouverte au seul service_role ;
//   - les trois RPC fermées à anon, gardées pour authenticated AVEC un
//     marqueur d'intention motivé ;
//   - nexus_identifiant_de_connexion INTOUCHÉE : l'écran de connexion
//     l'appelle avant toute authentification ;
//   - la migration est strictement additive (revoke/grant seulement) ;
//   - aucun écran n'appelle core, et chaque RPC gardée a bien un appelant.
//
// POURQUOI DES MUTATIONS. Une épreuve verte ne prouve rien tant qu'on ne l'a
// pas vue rougir. Chaque contrôle est rejoué sur une mutation minimale du vrai
// fichier, isolée (une mutation par copie), qui doit être refusée par son code.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const garde = require('./outils/garde-revoke-fonction-roles-nommes.js');

const MIGRATION = path.join(__dirname, 'supabase/migrations/20261004130000_revoquer_anon_quatre_fonctions_hors_fdj.sql');
const SQL = fs.readFileSync(MIGRATION, 'utf8');

const CORE = 'public._generate_inventory_review_core(text,date,date,text)';
const RPC = {
  'public.generate_inventory_review(text,date,date,text)': 'generate_inventory_review',
  'public.inventaire_enregistrer_transfert_localise(text,uuid,uuid,uuid,uuid,numeric,text,numeric,numeric,text)': 'inventaire_enregistrer_transfert_localise',
  'public.stats_fondateur()': 'stats_fondateur',
};
const LOGIN = 'nexus_identifiant_de_connexion';

let n = 0;
function ok(quoi) { n++; console.log('  ✅ ' + quoi); }

const norm = s => s.replace(/"/g, '').replace(/\s+/g, '').toLowerCase();

// Relève, dans un texte de migration, les rôles révoqués et accordés par
// fonction, les instructions qui ne sont ni revoke ni grant, et les marqueurs.
function lire(sql) {
  const code = garde.sansCommentaires(sql);
  const parFonction = new Map();
  const f = sig => {
    if (!parFonction.has(sig)) parFonction.set(sig, { revoques: new Set(), accordes: new Set() });
    return parFonction.get(sig);
  };
  const autres = [];
  for (const instr of code.split(';').map(s => s.trim()).filter(Boolean)) {
    let m = /^revoke\s+(?:all|execute)\s+on\s+function\s+([\s\S]+?\))\s+from\s+([\s\S]+)$/i.exec(instr);
    if (m) { m[2].split(',').forEach(r => f(norm(m[1])).revoques.add(norm(r))); continue; }
    m = /^grant\s+execute\s+on\s+function\s+([\s\S]+?\))\s+to\s+([\s\S]+)$/i.exec(instr);
    if (m) { m[2].split(',').forEach(r => f(norm(m[1])).accordes.add(norm(r))); continue; }
    autres.push(instr.replace(/\s+/g, ' ').slice(0, 80));
  }
  const intentions = new Map();
  for (const m of sql.matchAll(/--\s*nexus-acl-intention\s*:\s*(.+?)\s+(garde|ferme)\s+(anon|authenticated)\s*(?:\(([^)]*)\))?/gi)) {
    intentions.set(norm(m[1]), { verbe: m[2].toLowerCase(), role: m[3].toLowerCase(), motif: (m[4] || '').trim() });
  }
  return { parFonction, autres, intentions, code };
}

// Rend la liste des codes de refus ; vide = conforme.
function examiner(sql) {
  const { parFonction, autres, intentions, code } = lire(sql);
  const refus = [];
  const c = parFonction.get(norm(CORE));
  if (!c || !['public', 'anon', 'authenticated'].every(r => c.revoques.has(r))) refus.push('CORE_NON_FERMEE');
  if (!c || [...c.accordes].some(r => r !== 'service_role') || !c.accordes.has('service_role')) refus.push('CORE_ACL_CIBLE');
  for (const sig of Object.keys(RPC)) {
    const e = parFonction.get(norm(sig));
    if (!e || !e.revoques.has('public') || !e.revoques.has('anon')) refus.push('ANON_NON_FERME:' + RPC[sig]);
    if (!e || e.revoques.has('authenticated')) refus.push('AUTHENTICATED_RETIRE:' + RPC[sig]);
    if (!e || e.accordes.has('anon') || e.accordes.has('public')) refus.push('ANON_REOUVERT:' + RPC[sig]);
    if (!e || !e.accordes.has('authenticated') || !e.accordes.has('service_role')) refus.push('ACL_CIBLE:' + RPC[sig]);
    const i = intentions.get(norm(sig));
    if (!i || i.verbe !== 'garde' || i.role !== 'authenticated' || !i.motif) refus.push('MARQUEUR:' + RPC[sig]);
  }
  if (new RegExp(LOGIN, 'i').test(code)) refus.push('LOGIN_TOUCHE');
  if (autres.length) refus.push('NON_ADDITIVE');
  return refus;
}

console.log('\nLot sécurité anon5 : quatre fonctions hors FDJ fermées à anon\n');

// A1 — le vrai fichier est conforme.
assert.deepStrictEqual(examiner(SQL), [], 'la migration réelle doit être conforme');
ok('A1 — migration réelle : core fermée, trois RPC fermées à anon et gardées, login intouchée, additive');

// A2 à A9 — chaque mutation minimale du vrai fichier est refusée par son code.
const MUTATIONS = [
  ['A2 — core encore ouverte à authenticated', s => s.replace(/revoke all on function public\._generate_inventory_review_core\(text, date, date, text\) from authenticated;\n/, ''), 'CORE_NON_FERMEE'],
  ['A3 — core accordée à authenticated', s => s + '\ngrant execute on function public._generate_inventory_review_core(text, date, date, text) to authenticated;\n', 'CORE_ACL_CIBLE'],
  ['A4 — stats_fondateur laissée à anon', s => s.replace(/revoke all on function public\.stats_fondateur\(\) from anon;\n/, ''), 'ANON_NON_FERME:stats_fondateur'],
  ['A5 — generate_inventory_review retirée à authenticated', s => s + '\nrevoke all on function public.generate_inventory_review(text, date, date, text) from authenticated;\n', 'AUTHENTICATED_RETIRE:generate_inventory_review'],
  ['A6 — transfert ré-accordé à anon', s => s + '\ngrant execute on function public.inventaire_enregistrer_transfert_localise(text, uuid, uuid, uuid, uuid, numeric, text, numeric, numeric, text) to anon;\n', 'ANON_REOUVERT:inventaire_enregistrer_transfert_localise'],
  ['A7 — marqueur sans motif', s => s.replace(/(nexus-acl-intention: public\.stats_fondateur\(\) garde authenticated) \([^)]*\)/, '$1'), 'MARQUEUR:stats_fondateur'],
  ['A8 — la connexion fermée à anon', s => s + '\nrevoke all on function public.nexus_identifiant_de_connexion(text) from anon;\n', 'LOGIN_TOUCHE'],
  ['A9 — une instruction non additive', s => s + '\ndrop function public.stats_fondateur();\n', 'NON_ADDITIVE'],
];
for (const [quoi, muter, code] of MUTATIONS) {
  const mute = muter(SQL);
  assert.notStrictEqual(mute, SQL, quoi + ' : la mutation n’a rien changé (ancre perdue)');
  const refus = examiner(mute);
  assert.ok(refus.includes(code), quoi + ' : attendu ' + code + ', obtenu ' + JSON.stringify(refus));
  ok(quoi + ' : refusé ' + code);
}

// A10 — la garde revoke du dépôt statue les quatre fonctions.
const r = garde.controler({});
assert.deepStrictEqual(r.codes, [], 'la garde revoke doit être conforme : ' + JSON.stringify(r.codes));
for (const sig of [CORE, ...Object.keys(RPC)]) {
  assert.ok(!r.dette.some(d => d.signature === sig), sig + ' ne doit plus figurer dans la dette');
}
ok('A10 — garde revoke conforme, les quatre signatures hors de la dette (' + r.detteMesuree + ')');

// A11 — appelants servis : aucun écran n'appelle core ; chaque RPC gardée
// pour authenticated a au moins un appelant ; la connexion appelle toujours
// nexus_identifiant_de_connexion.
function appelants(nom) {
  try {
    return execFileSync('git', ['grep', '-lE', "rpc[(][[:space:]]*['\"]" + nom + "['\"]", '--', '*.js', '*.html'], { cwd: __dirname, encoding: 'utf8' })
      .split('\n').filter(f => f && !/^test_/.test(f));
  } catch (e) { if (e.status === 1) return []; throw e; }
}
assert.deepStrictEqual(appelants('_generate_inventory_review_core'), [], 'aucun écran ne doit appeler core');
for (const nom of Object.values(RPC)) assert.ok(appelants(nom).length > 0, nom + ' doit avoir un appelant servi');
assert.ok(appelants(LOGIN).includes('NEXUS-Login-v1.html'), 'NEXUS-Login-v1.html doit appeler ' + LOGIN);
ok('A11 — core sans appelant servi ; ' + Object.values(RPC).map(x => x + ' : ' + appelants(x).join(', ')).join(' ; '));

console.log('\n' + n + ' tests passés.');
