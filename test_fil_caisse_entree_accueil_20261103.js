// Épreuve — 03/11/2026, lot INVENTAIRE-CAISSE-RENFORT-20261102, L1 incrément 3 (entrée du fil « Ma caisse » depuis l'Accueil, deux étapes).
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
const FERME = 'NEXUS-Inventaire-v1.html?fil=caisse&etape=3&plan=3';
const A_FAIRE = { ouvertureFaite: false, clotureFaite: false, fermetureDue: false };

cas('pilote caissière en service, comptage à faire → étape 2 (plan 2, inscription sans objet)', () => {
  assert.strictEqual(C.lienEntree(true, 'caissiere', true, A_FAIRE), ENTREE);
});
cas('comptage fait + fermeture due → étape 3 seule ; deux étapes si les deux restent à faire', () => {
  assert.strictEqual(C.lienEntree(true, 'caissiere', true, { ouvertureFaite: true, clotureFaite: false, fermetureDue: true }), FERME);
  assert.strictEqual(C.lienEntree(true, 'caissiere', true, { ouvertureFaite: false, clotureFaite: false, fermetureDue: true }), 'NEXUS-Inventaire-v1.html?fil=caisse&etape=2&plan=2.3');
});
cas('comptage fait et fermeture pas encore due, ou clôture faite → aucune adresse', () => {
  assert.strictEqual(C.lienEntree(true, 'caissiere', true, { ouvertureFaite: true, fermetureDue: false }), null);
  assert.strictEqual(C.lienEntree(true, 'caissiere', true, { ouvertureFaite: true, clotureFaite: true, fermetureDue: true }), null);
});
cas('non-pilote (ou pilote non strict) → aucune adresse', () => {
  for (const p of [false, undefined, null, 'true', 1]) assert.strictEqual(C.lienEntree(p, 'caissiere', true, A_FAIRE), null);
});
cas('autre rôle → aucune adresse', () => {
  for (const r of ['pompiste', 'renfort', 'manager', 'polyvalent', undefined, null]) assert.strictEqual(C.lienEntree(true, r, true, A_FAIRE), null);
});
cas('hors service → aucune adresse', () => {
  for (const sv of [false, undefined, 'true']) assert.strictEqual(C.lienEntree(true, 'caissiere', sv, A_FAIRE), null);
});
cas('fermetureDue : 45 min avant la fin, jamais sans heure de fin', () => {
  assert.strictEqual(C.fermetureDue(1320, 1274), false);
  assert.strictEqual(C.fermetureDue(1320, 1275), true);
  assert.strictEqual(C.fermetureDue(null, 1300), false);
  assert.strictEqual(C.fermetureDue(1320, undefined), false);
});
cas('faitsInventaire : jugés sur le quart du service, jamais une simulation', () => {
  const row = (q, over) => ({ a_valide_ouverture: true, inventaire_quarts: Object.assign({ date: '2026-11-03', quart: q, statut: 'ouvert', cloture_le: null, is_simulation: false }, over) });
  assert.deepStrictEqual(C.faitsInventaire([row('matin')], '2026-11-03', 'matin'), { ouvertureFaite: true, clotureFaite: false });
  assert.deepStrictEqual(C.faitsInventaire([row('soir')], '2026-11-03', 'matin'), { ouvertureFaite: false, clotureFaite: false });
  assert.deepStrictEqual(C.faitsInventaire([row('matin', { cloture_le: 'x' })], '2026-11-03', 'matin'), { ouvertureFaite: false, clotureFaite: true });
  assert.deepStrictEqual(C.faitsInventaire([row('matin', { is_simulation: true })], '2026-11-03', 'matin'), { ouvertureFaite: false, clotureFaite: false });
  assert.deepStrictEqual(C.faitsInventaire([row('matin', { date: '2026-11-02' })], '2026-11-03', 'matin'), { ouvertureFaite: false, clotureFaite: false });
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
  assert.ok(HTML.includes("const filCaisseLien = NexusFilCaisse.lienEntree(piloteCaisse, roleDuJour, enService && inventaireApplicable, { ouvertureFaite: inventaireOuvertureFaite, clotureFaite: inventaireFait || !!clotureServeurSansComptage, fermetureDue: fermetureCaisseDue });"));
  assert.ok(HTML.includes("if (piloteCaisse && fuseauStation && NexusFilCaisse.quartConcerneParFermeture(quartDuJour)) {"), 'horaires lus seulement pour un pilote');
  assert.ok(/ctx\.inventaireOuvertureFaite && ctx\.filCaisseLien\) \{\s*return \{[^}]*lien: ctx\.filCaisseLien/.test(HTML), 'carte fermeture');
  assert.ok(/lien: ctx\.filLien \|\| ctx\.filCaisseLien \|\| 'NEXUS-Inventaire-v1\.html'/.test(HTML));
  assert.ok(/filLien, filCaisseLien,/.test(HTML));
});
console.log(ok + ' vérifications OK');
