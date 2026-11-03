// Épreuve — 03/11/2026, lot INVENTAIRE-CAISSE-RENFORT-20261102, L1 incrément 3a (entrée du fil « Ma caisse » depuis l'Accueil).
// Exigences (decision-4) : refus par défaut ; adresse seulement pour pilote + caissière du jour en service + comptage à faire ;
// non-pilote, autre rôle, hors service ou comptage fait → l'Accueil garde son lien. Lecture seule de parametres_inventaire, aucune écriture.
// SRC_MUTE / PAGE_MUTE : sources mutées pour la preuve de mutation.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const F = path.resolve(process.env.SRC_MUTE || path.join(__dirname, 'nexus-fil-caisse.js'));
const m = { exports: {} };
new Function('module', 'self', fs.readFileSync(F, 'utf8'))(m, undefined);
const C = m.exports;
let ok = 0;
const cas = (nom, f) => { f(); ok++; console.log('  ✓ ' + nom); };
const ENTREE = 'NEXUS-Inventaire-v1.html?fil=caisse&etape=2&plan=2';

cas('pilote caissière en service, comptage à faire → étape 2', () => {
  assert.strictEqual(C.lienAccueil(true, 'caissiere', true, true), ENTREE);
});
cas('non-pilote (ou pilote non strict) → aucune adresse', () => {
  for (const p of [false, undefined, null, 'true', 1]) assert.strictEqual(C.lienAccueil(p, 'caissiere', true, true), null);
});
cas('autre rôle → aucune adresse', () => {
  for (const r of ['pompiste', 'renfort', 'manager', 'polyvalent', undefined, null]) assert.strictEqual(C.lienAccueil(true, r, true, true), null);
});
cas('hors service ou comptage non à faire → aucune adresse', () => {
  for (const [s, c] of [[false, true], [true, false], [undefined, true], [true, undefined], ['true', true], [true, 'true']]) assert.strictEqual(C.lienAccueil(true, 'caissiere', s, c), null);
});

const HTML = fs.readFileSync(path.join(__dirname, process.env.PAGE_MUTE || 'NEXUS-App-v1.html'), 'utf8');
cas('Accueil : modules chargés, lecture seule du pilote, rôle caissière exigé avant la lecture', () => {
  assert.ok(/<script src="nexus-pilotes-inventaire\.js/.test(HTML));
  assert.ok(/<script src="nexus-fil-caisse\.js/.test(HTML));
  assert.ok(/const piloteCaisse = \(enService && roleDuJour === NexusFilCaisse\.ROLE\) \? await chargerPiloteCaisse\(employee\.site_id, employee\.id\) : false;/.test(HTML));
  const f = HTML.slice(HTML.indexOf('async function chargerPiloteCaisse'), HTML.indexOf('// Horaires de la station (station_config.horaires)'));
  assert.ok(/\.from\('station_config'\)\.select\('parametres_inventaire'\)\.eq\('site', siteId\)/.test(f), 'lecture filtrée par site');
  assert.ok(!/\.(insert|update|upsert|delete|rpc)\(/.test(f), 'aucune écriture');
  assert.ok(/if \(error\)[^\n]*return false;/.test(f), 'erreur = pas pilote');
});
cas('Accueil : la carte utilise filCaisseLien sans écraser le lien pompiste', () => {
  assert.ok(/const filCaisseLien = NexusFilCaisse\.lienAccueil\(piloteCaisse, roleDuJour, enService, inventaireApplicable && !inventaireFait && !inventaireOuvertureFaite\);/.test(HTML));
  assert.ok(/lien: ctx\.filLien \|\| ctx\.filCaisseLien \|\| 'NEXUS-Inventaire-v1\.html'/.test(HTML));
  assert.ok(/filLien, filCaisseLien,/.test(HTML));
});
console.log(ok + ' vérifications OK');
