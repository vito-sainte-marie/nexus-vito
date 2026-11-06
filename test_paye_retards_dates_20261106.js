#!/usr/bin/env node
// NEXUS PAYE — retards datés pour la comptabilité (Guardian, demande de Frédéric du 05/11/2026).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('./nexus-paye-moteur.js');
const M = global.NexusPayeMoteur;
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

const fiche = { items: [
  { typeItem: 'retard', statut: 'valide', date: '2026-11-12', quantiteMinutes: 10 },
  { typeItem: 'retard', statut: 'valide', date: '2026-11-04', quantiteMinutes: 15 },
  { typeItem: 'retard', statut: 'a_verifier', date: '2026-11-20', quantiteMinutes: 30 },
] };
let n = 0;
const t = (nom, fn) => { fn(); n += 1; console.log(`  ✓ ${nom}`); };

t('moteur : seuls les retards retenus sont datés, triés par date, total identique', () => {
  const r = M.variablesComptables(fiche).retards;
  assert.deepStrictEqual(r.detail, [{ date: '2026-11-04', minutes: 15 }, { date: '2026-11-12', minutes: 10 }]);
  assert.strictEqual(r.minutes, 25);
  assert.strictEqual(r.occurrences, 2);
  assert.strictEqual(r.enAttente, 1);
});
t('moteur : sans retard, détail vide', () => {
  assert.deepStrictEqual(M.variablesComptables({ items: [] }).retards.detail, []);
});
t('PDF : « 25 min sur 2 jours (04/11 : 15 min ; 12/11 : 10 min) »', () => {
  const s = lire('nexus-paye-dossier-pdf.js');
  assert.ok(s.includes("v.retards.detail.map(r => `${String(r.date).slice(8, 10)}/${String(r.date).slice(5, 7)} : ${minutes(r.minutes)}`).join(' ; ')"));
  require('./nexus-paye-dossier-pdf.js');
  const l = global.NexusPayeDossierPdf.lignesVariables(M.variablesComptables(fiche)).find(x => x.variable === 'Retards');
  assert.strictEqual(l.valeur, '25 min sur 2 jours (04/11 : 15 min ; 12/11 : 10 min)');
  assert.strictEqual(global.NexusPayeDossierPdf.lignesVariables(M.variablesComptables({ items: [] })).find(x => x.variable === 'Retards').valeur, '—');
});
t('fiche : « Pour le comptable » porte les mêmes dates', () => {
  const h = lire('NEXUS-Paye-v1.html');
  assert.ok(h.includes("retards retenus ${v.retards.minutes} min${dr.length?` (${ECHAPPE(dr.join(' ; '))})`:''}"));
  assert.ok(h.includes("`${r.date.slice(8,10)}/${r.date.slice(5,7)} : ${r.minutes} min`"));
});
console.log(`${n} contrôles passent.`);
