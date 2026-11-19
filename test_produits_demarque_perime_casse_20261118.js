'use strict';
// Avenant A6 : libellé daté (JJ-MM-AAAA suivi d'un mot) = démarque, périmé ou casse. Règle NEXUS, jamais écrite en base.
const assert = require('assert');
const PM = require('./nexus-produits-mesure.js');

// 1. nature dérivée, sans déclaration écrite
['12-11-2026 YOGOURT NATURE', '12/11/26 : CASSE BOUTEILLE', '01.10.2026 PERIME'].forEach(l => {
  const n = PM.natureDe([], { article: l }, true);
  assert.strictEqual(n.nature, 'demarque_perime_casse', l);
  assert.strictEqual(n.regle, true);
  assert.strictEqual(n.declare_par, 'règle NEXUS');
  assert.strictEqual(n.declare_le, null);
  assert.strictEqual(n.id, null);
  assert.ok(/règle du pilote, 18\/11\/2026/.test(n.commentaire));
});
assert.strictEqual(PM.NATURES.demarque_perime_casse, 'Démarque : périmé ou casse');

// 2. ACOMPTE inchangé
const a = PM.natureDe([], { article: '30-10-2026 ACOMPTE' }, true);
assert.strictEqual(a.nature, 'operation_caisse');
assert.strictEqual(PM.natureDe([], { article: '12-02-2026 ACOMPTE - DEMARREUR CLIO' }, true).nature, 'operation_caisse');

// 3. la déclaration d'un responsable garde la priorité
const d = PM.natureDe([{ article: '12-11-2026 YOGOURT NATURE', nature: 'produit_commercial', actif: true, date_debut: '2000-01-01' }], { article: '12-11-2026 YOGOURT NATURE' }, true);
assert.strictEqual(d.nature, 'produit_commercial');
assert.ok(!d.regle);

// 4. date au milieu, date seule, rien après la date : pas attrapé
['YOGOURT 12-11-2026', '12-11-2026', '12-11-2026 ', 'COCA COLA', '', null].forEach(l => {
  assert.strictEqual(PM.natureDe([], { article: l }, true), null, 'non attrapé : ' + l);
});

// 5. le moteur ne produit aucune anomalie S1-S7 sur une ligne de cette nature (vente à perte comprise)
const P = require('./nexus-politique-tarifaire.js');
const AR = require('./nexus-politique-tarifaire-registres.js');
const reg = { familles: [{ site: 's', famille_code: 'Alpha', libelle: 'Famille Alpha' }], rattachements: [{ site: 's', portee: 'rayon', rayon: 'Rayon Alpha', famille_code: 'Alpha' }], seuils: [{ site: 's', id: 1, niveau: 'famille', cible_niveau: 'Alpha', minimum: 0.4, cible: 0.5, statut_minimum: 'valide', statut_cible: 'valide' }] };
const ctx = Object.assign(AR.contexteDepuisRegistres(reg, { periode: { debut: '2030-03-01', fin: '2030-03-30' } }), { natureDe: row => PM.natureDe([], row, true) });
const row = (article) => ({ article, categorie: 'Rayon Alpha', quantite: 5, prix_vente: 0.03, prix_achat: 1.57, tva: 20, code_barres: '' });
const lignes = P.analyser([row('12-11-2026 YOGOURT NATURE'), row('YOGOURT NATURE')], [], ctx).lignes || [];
const dat = lignes.filter(l => /^12-11/.test(l.article))[0], norm = lignes.filter(l => l.article === 'YOGOURT NATURE')[0];
assert.ok(dat, 'ligne datée analysée');
assert.strictEqual(dat.nature && dat.nature.nature, 'demarque_perime_casse');
assert.deepStrictEqual(dat.anomalies || [], [], 'aucune anomalie sur la démarque');
assert.ok(norm && norm.alertes.some(a => a.code === 'A3'), 'la ligne non datée garde son alerte de vente à perte');
console.log('OK  démarque périmé ou casse (A6)');
