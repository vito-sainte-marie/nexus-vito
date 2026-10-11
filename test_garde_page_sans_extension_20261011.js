// ============================================================================
// UNE PAGE SERVIE SANS `.html` RESTE LA MÊME PAGE (11/10/2026)
//
// Ce que cette épreuve garde. Cloudflare Pages retire l'extension :
// `/NEXUS-Prise-De-Poste-v1.html` répond 308 vers `/NEXUS-Prise-De-Poste-v1`.
// Sur l'alias Test de #99 (aa0a9d8, base 6a59137), un caissier sans service
// ouvert bouclait sans fin sur
// `/NEXUS-Prise-De-Poste-v1?retour=NEXUS-Prise-De-Poste-v1%3Fretour%3D…`
// (plus de 1 400 requêtes) : les deux gardes de `nexusRequireAuth` lisaient
// `pathname.split('/').pop()`, cherchaient `NEXUS-Prise-De-Poste-v1` dans des
// listes écrites `…-v1.html`, ne l'y trouvaient pas, et classaient l'écran
// de séquence en 'operationnel' — le défaut — puis le renvoyaient vers
// lui-même. Le défaut du 04/09 (nexus-page.js), revenu par 4304dbb.
//
// Comment. Le bloc de règle, les deux gardes et nexus-page.js sont EXTRAITS
// des fichiers réels et exécutés dans un contexte vm, avec une `location`
// sans extension. Les gardes lisent la page elles-mêmes : c'est leur câblage
// qui est éprouvé, pas seulement la règle.
// ============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const RACINE = __dirname;
const AUTH = fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8');
const PAGE_SRC = fs.readFileSync(path.join(RACINE, 'nexus-page.js'), 'utf8');

function extraire(nom) {
  let debut = AUTH.indexOf(`async function ${nom}(`);
  if (debut === -1) debut = AUTH.indexOf(`function ${nom}(`);
  assert.ok(debut !== -1, `fonction ${nom} introuvable dans nexus-auth.js`);
  const i = AUTH.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (AUTH[j] === '{') profondeur++;
    else if (AUTH[j] === '}') profondeur--;
    j++;
  }
  return AUTH.slice(debut, j);
}

function bloc(debut, fin) {
  const d = AUTH.indexOf(debut), f = AUTH.indexOf(fin);
  assert.ok(d !== -1 && f > d, `bloc ${debut} introuvable dans nexus-auth.js`);
  return AUTH.slice(d, f);
}
const REGLE = bloc('/* NEXUS-ACCES-REGLE:DEBUT', '/* NEXUS-ACCES-REGLE:FIN */');
const FUSEAU = bloc('/* NEXUS-FUSEAU-METIER:DEBUT */', '/* NEXUS-FUSEAU-METIER:FIN */');

// Le contexte d'une page servie à `pathname` : `window.location` ET le vrai
// NexusPage, chargé comme le navigateur le charge avant nexus-auth.js.
function contexte(pathname, extra) {
  const location = { pathname };
  const c = { window: { location } };
  vm.runInNewContext(PAGE_SRC, c);
  return Object.assign({ console, window: { location }, NexusPage: c.window.NexusPage }, extra);
}

function regle(pathname) {
  const ctx = contexte(pathname);
  vm.runInNewContext(REGLE +
    '\nthis.nexusCategorieAcces = nexusCategorieAcces;' +
    '\nthis.LISTES = { sequence: NEXUS_PAGES_SEQUENCE_OBLIGATOIRE, consultation: NEXUS_PAGES_CONSULTATION,' +
    ' operationnel: NEXUS_PAGES_OPERATIONNELLES, publique: NEXUS_PAGES_PUBLIQUES };', ctx);
  return ctx;
}

// Porte 1 — prise de poste. Les deux lectures sont des témoins : on juge la
// décision de la porte, pas la base.
async function prisePosteManquante(pathname, employee, service) {
  const ctx = contexte(pathname, { __lectures: [] });
  vm.runInNewContext([
    REGLE,
    'async function nexusServiceCourant(e){ __lectures.push("shifts"); return ' + JSON.stringify(service) + '; }',
    'async function nexusDepartPointeAujourdhui(e){ __lectures.push("pointages"); return false; }',
    extraire('nexusEstManager'),
    extraire('nexusPriseDePosteManquante'),
    'this.__test = nexusPriseDePosteManquante;',
  ].join('\n\n'), ctx);
  return { bloque: await ctx.__test(employee), lectures: ctx.__lectures };
}

// Porte 2 — pointage d'arrivée, avec un faux client qui sert aussi `sites`
// (fuseau de l'appareil : voir test_acces_hors_service_20260916.js).
const FUSEAU_APPAREIL = Intl.DateTimeFormat().resolvedOptions().timeZone;
async function pointageManquant(pathname, employee) {
  function chain(table) {
    return {
      select: () => chain(table), eq: () => chain(table),
      maybeSingle: async () => {
        if (table === 'station_config') return { data: { pointage_actif: true } };
        if (table === 'sites') return { data: { timezone: FUSEAU_APPAREIL }, error: null };
        return { data: null, error: null };
      },
    };
  }
  const ctx = contexte(pathname, {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    __lectures: [],
  });
  ctx.nexusClient = { from: (t) => { ctx.__lectures.push(t); return chain(t); } };
  vm.runInNewContext([REGLE, FUSEAU, extraire('nexusEstManager'),
    extraire('nexusPointageArriveeManquant'), 'this.__test = nexusPointageArriveeManquant;'].join('\n\n'), ctx);
  return { bloque: await ctx.__test(employee), lectures: ctx.__lectures };
}

// Employé Test A : caissier, aucun service ouvert.
const CAISSIER = { id: 'a1', site_id: 's1', role: 'employe', consultation_externe: false };
const AUCUN_SERVICE = { aucun: true };

let passes = 0;
function ok(nom) { passes++; console.log('OK — ' + nom); }

(async () => {
  // ── 1. Le défaut constaté : la séquence ne se garde pas elle-même ───────
  for (const p of ['/NEXUS-Prise-De-Poste-v1', '/NEXUS-Pointage-v1']) {
    const a = await prisePosteManquante(p, CAISSIER, AUCUN_SERVICE);
    assert.strictEqual(a.bloque, false,
      `${p} (sans .html) renvoie vers la prise de poste : boucle de redirection`);
    assert.deepStrictEqual(a.lectures, [], `${p} : la règle doit trancher avant toute lecture`);
    const b = await pointageManquant(p, CAISSIER);
    assert.strictEqual(b.bloque, false,
      `${p} (sans .html) renvoie vers le pointage : boucle de redirection`);
    assert.deepStrictEqual(b.lectures, [], `${p} : la règle doit trancher avant toute lecture`);
  }
  ok('un caissier hors service n\'est pas renvoyé de la séquence vers elle-même, sans extension');

  // ── 2. Dissocier n'est pas désarmer : le terrain reste gardé ────────────
  for (const p of ['/NEXUS-Missions-v1', '/NEXUS-Missions-v1.html', '/sous/chemin/NEXUS-FDJ-v1']) {
    const a = await prisePosteManquante(p, CAISSIER, AUCUN_SERVICE);
    assert.strictEqual(a.bloque, true, `${p} : écran opérationnel ouvert hors service`);
  }
  ok('un écran opérationnel servi sans extension exige toujours un service');

  // ── 3. Une consultation reste une consultation sans extension ───────────
  for (const p of ['/NEXUS-Mon-Evolution-v1', '/NEXUS-App-v1']) {
    const a = await prisePosteManquante(p, CAISSIER, AUCUN_SERVICE);
    assert.strictEqual(a.bloque, false, `${p} : consultation bloquée hors service`);
    const b = await pointageManquant(p, CAISSIER);
    assert.strictEqual(b.bloque, false, `${p} : consultation renvoyée au pointage`);
  }
  ok('une consultation servie sans extension ne demande ni service ni pointage');

  // ── 4. La classification ne dépend pas de l'hébergeur, liste par liste ──
  const r = regle('/');
  const attendu = { sequence: 'sequence', consultation: 'consultation',
                    operationnel: 'operationnel', publique: 'publique' };
  for (const [liste, noms] of Object.entries(r.LISTES)) {
    for (const nom of Array.from(noms)) {
      const id = nom.replace(/\.html$/i, '');
      for (const forme of [nom, id, '/' + id, 'https://x.pages.dev/' + id + '?retour=a#b']) {
        assert.strictEqual(r.nexusCategorieAcces(forme), attendu[liste],
          `${forme} classé ${r.nexusCategorieAcces(forme)}, attendu ${attendu[liste]} (${liste})`);
      }
    }
  }
  ok('chaque écran des quatre listes garde sa catégorie avec ou sans extension');

  // ── 5. L'oubli ferme toujours, et le bloc ne lit pas `location` ─────────
  const c = { window: {} };
  vm.runInNewContext(PAGE_SRC, c);
  const pur = { console, NexusPage: c.window.NexusPage };
  vm.runInNewContext(REGLE + '\nthis.f = nexusCategorieAcces;', pur);
  for (const v of [undefined, null, '', 'NEXUS-Ecran-Inconnu-v9']) {
    assert.strictEqual(pur.f(v), 'operationnel', `${String(v)} : un écran inconnu doit rester opérationnel`);
  }
  ok('un écran inconnu reste opérationnel, et la règle ne lit jamais location');

  console.log(`\n${passes}/5 — garde de séquence indépendante de l'extension.`);
})().catch((e) => { console.error('✗ ' + e.message); console.error(new Error(e.message)); process.exit(1); });
