// Scanner tarifaire S1 : module pur, seuils, contrôles A/B/C, prix réglementés, synthèse, aucune écriture.
const assert = require('assert'), fs = require('fs'), path = require('path');
globalThis.window = globalThis;
require('./nexus-conseiller.js'); const C = globalThis.NexusConseiller; require('./nexus-marge.js'); require('./nexus-produits-mesure.js'); const S = require('./nexus-scanner-tarifaire.js');
const T = C.SEUILS_SCANNER_TARIFAIRE;
const ctx = { periode: { debut: '2026-10-05', fin: '2026-11-09' }, natures: [], justifications: [] };
const L = (article, pa, pv, q, o) => Object.assign({ article, categorie: 'Épicerie', code_barres: 'cb-' + article, prix_achat: pa, prix_vente: pv, quantite: q }, o || {});

// Seuils : bornes exactes
assert.ok(T && T.variationPa && T.impactEuros, 'SEUILS_SCANNER_TARIFAIRE exporté');
assert.strictEqual(S.niveauVariation(0.0999, T), 'ordinaire');
assert.strictEqual(S.niveauVariation(0.10, T), 'notable');
assert.strictEqual(S.niveauVariation(0.20, T), 'importante');
assert.strictEqual(S.niveauVariation(0.50, T), 'suspecte');
assert.strictEqual(S.niveauVariation(0.55, T), 'suspecte', 'niveau calculé sur la valeur absolue');
assert.strictEqual(S.niveauImpact(4.99, T), 'information');
assert.strictEqual(S.niveauImpact(5, T), 'a_examiner');
assert.strictEqual(S.niveauImpact(20, T), 'prioritaire');
console.log('OK  seuils et bornes');

const prec = [L('MENTHE', 1.39, 2.35, 10), L('HARIBO', 0.5, 1, 5), L('COCA', 1, 2, 10), L('MARLBORO', 10, 11, 10), L('SANS PA', 1, 2, 3), L('ACOMPTE', 1, 1, 470), L('FORFAIT', 1, 1, 5)];
const cur = [L('MENTHE', 2.94, 2.35, 6), L('HARIBO', 0.6, 1, 100), L('COCA', 1.5, 2, 20), L('MARLBORO', 11, 11, 10, { categorie: 'Tabac' }), L('NOUVEAU', 1, 2, 4), L('SANS PA', null, 2, 3), L('ACOMPTE', 1, 1, 470), L('FORFAIT', 1, 1, 5)];
const r = S.controler(cur, prec, ctx);
const get = a => r.lignes.find(l => l.article === a);
assert.ok(!get('ACOMPTE'), 'ACOMPTE : exclu par la règle NEXUS (article de caisse hors catalogue), via le module de mesure');
assert.ok(get('FORFAIT'), 'FORFAIT n\'est pas exclu');
assert.ok(!get('FORFAIT').perte, 'PA égal au PV : pas une vente à perte');
assert.ok(get('FORFAIT').a_verifier && get('FORFAIT').a_verifier.raisons.includes('pv_egal_pa'), 'PA = PV : donnée à vérifier');
assert.ok(!get('FORFAIT').suspect, 'PA = PV : pas de message de coût suspect');
assert.ok(r.resume.a_verifier.pv_egal_pa >= 1);
// Une déclaration produit sur ACOMPTE l'emporte sur la règle
const rp = S.controler(cur, prec, Object.assign({}, ctx, { natures: [{ article: 'ACOMPTE', nature: 'produit_commercial', actif: true, date_debut: '2000-01-01' }] }));
assert.ok(rp.lignes.some(l => l.article === 'ACOMPTE'), 'déclaration produit : prioritaire sur la règle');
// Identité modifiée : à vérifier, sans message de coût suspect
const rid = S.controler([L('20261001 HARIBO', 0.51, 1, 10, { code_barres: 'cb-H' })], [L('HARIBO', 0.5, 1, 10, { code_barres: 'cb-H' })], ctx);
const hid = rid.lignes[0];
assert.ok(hid.a_verifier && hid.a_verifier.raisons.includes('identite_libelle_change'), 'identité à vérifier');
assert.strictEqual(hid.a_verifier.ancien_libelle, 'HARIBO');
assert.ok(!hid.suspect && !hid.cout_a_verifier, 'identité seule : ni coût suspect ni « coût à vérifier »');
assert.strictEqual(rid.resume.suspect.nb, 0);
assert.strictEqual(rid.resume.a_verifier.identite, 1);
assert.strictEqual(r.jours, 36);
assert.strictEqual(get('NOUVEAU').variation, null, 'absente de la période précédente : aucun pourcentage');
assert.strictEqual(get('SANS PA').variation, null);
assert.ok(get('SANS PA').donnees_manquantes, 'PA nul = donnée manquante');
console.log('OK  ACOMPTE exclu par règle NEXUS, PA = PV à vérifier, absente, PA nul');

// A : vente à perte
const m = get('MENTHE');
assert.ok(m.perte && !m.perte.justifiee && Math.abs(m.perte.montant - 3.54) < 0.005, 'perte Menthe 3,54 €');
assert.strictEqual(m.niveau_variation, 'suspecte');
assert.ok(m.cout_a_verifier);
// B : hausse non répercutée, impact = écart de PA × quantité ; ramené à 30 jours
assert.ok(Math.abs(m.hausse.impact - 9.30) < 0.005, 'impact Menthe 9,30 €');
assert.ok(Math.abs(get('COCA').hausse.impact - 10) < 0.005);
assert.ok(Math.abs(get('COCA').hausse.impact30 - 10 / 36 * 30) < 0.01);
assert.ok(!get('NOUVEAU').hausse, 'pas de hausse sans PA précédent');
// pas de hausse non répercutée quand le PV a bougé
const r2 = S.controler([L('X', 2, 3, 5)], [L('X', 1, 2, 5)], ctx);
assert.ok(!r2.lignes[0].hausse, 'PV changé : pas « non répercutée »');
console.log('OK  contrôles A et B');

// Justification : la perte reste affichée
const rj = S.controler(cur, prec, Object.assign({}, ctx, { justifications: [{ article: 'MENTHE', periode_debut: '2026-10-05', periode_fin: '2026-11-09', motif: 'destockage_date', valide_le: '2026-11-10' }] }));
const mj = rj.lignes.find(l => l.article === 'MENTHE');
assert.ok(mj.perte, 'la justification n\'efface jamais la perte');
console.log('OK  perte justifiée toujours affichée');

// Prix réglementés : section distincte, aucune suggestion de prix
const tab = get('MARLBORO');
assert.notStrictEqual(tab.prix_type, 'libre');
assert.strictEqual(tab.suggestion_prix, null);
assert.ok(r.lignes.every(l => l.suggestion_prix === null), 'jamais de suggestion de prix en S1');
assert.ok(S.PRIX_TYPES.contractuel !== undefined || Object.values(S.PRIX_TYPES).includes('contractuel'), 'valeur contractuel prévue');
const A = S.affichage(r);
assert.ok(A.reglementes.premieres.some(l => l.article === 'MARLBORO') || A.reglementes.total >= 1);
assert.ok(!A.hausses.premieres.some(l => l.article === 'MARLBORO'), 'tabac absent des prix libres');
// ordre : pertes injustifiées d'abord
assert.strictEqual(A.pertes[0].article, 'MENTHE');
console.log('OK  prix réglementés séparés, aucune suggestion');

// Top 10 + repli « moins de 1 € »
const pre = [], cu = [];
for (let i = 0; i < 25; i++) { pre.push(L('P' + i, 1, 3, 10)); cu.push(L('P' + i, 1 + (i < 12 ? 0.5 : 0.01), 3, 10)); }
const rg = S.controler(cu, pre, ctx), Ag = S.affichage(rg);
assert.strictEqual(Ag.hausses.premieres.length, 10);
assert.strictEqual(Ag.hausses.petites.nb, 13, 'références à moins de 1 €');
assert.ok(Ag.hausses.premieres.every((l, i, a) => !i || a[i - 1].hausse.impact >= l.hausse.impact), 'tri décroissant');
console.log('OK  top 10 et ligne repliée');

// Synthèse : une référence comptée une seule fois
assert.strictEqual(r.resume.global.nb, new Set(r.lignes.filter(l => l.perte || l.hausse || l.suspect).map(l => l.article)).size);
assert.ok(Math.abs(r.resume.global.montant - r.lignes.reduce((s, l) => s + l.montant_global, 0)) < 0.01);
console.log('OK  synthèse sans double compte');

// Texte de fiche imposé
assert.strictEqual(S.texteFiche(m), 'Le coût d\'achat a plus que doublé (1,39 € → 2,94 €, +111,5 %) et le produit se vend à perte. Vérifier le prix fournisseur, le conditionnement et le PMP Decenium HT avant de modifier le prix de vente.');
// Vocabulaire interdit
const src = fs.readFileSync(path.join(__dirname, 'nexus-scanner-tarifaire.js'), 'utf8') + fs.readFileSync(path.join(__dirname, 'NEXUS-Produits-v1.html'), 'utf8').split('Scanner tarifaire S1')[1];
assert.ok(!/argent à récupérer|marge récupérable|communiqué/i.test(src), 'vocabulaire interdit');
assert.strictEqual(S.TEXTES.reglemente.pied, 'Aucune suggestion de prix pour ces références');
console.log('OK  textes imposés');

// Lecture seule : aucun accès réseau ni écriture
const mod = fs.readFileSync(path.join(__dirname, 'nexus-scanner-tarifaire.js'), 'utf8');
assert.ok(!/nexusClient|fetch\(|XMLHttpRequest|\.insert\(|\.update\(|\.upsert\(|\.rpc\(/.test(mod), 'module pur, sans réseau');
console.log('OK  module pur');
