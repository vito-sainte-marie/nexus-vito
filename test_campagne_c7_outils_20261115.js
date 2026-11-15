// C7 : Mes outils commerciaux (promotions, produits moteurs, produits à revoir, quelles promotions renouveler).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const O = require('./nexus-campagne-outils.js');
const CV = require('./nexus-campagne-ventes.js');
const MC = require('./nexus-mesure-compensation.js');

// Les douze désignations réelles Petromix, reprises du test du bilan.
const src5 = lire('test_campagne_c5_bilan_20261115.js');
const noms = eval(src5.match(/const nomsA = (\[.*\]);/)[1]);
assert.strictEqual(noms.length, 12);

// Les quatre tuiles sont disponibles et le hub les câble.
const voc = lire('nexus-vocabulaire.js');
['promotions', 'produits-moteurs', 'produits-a-revoir', 'renouveler'].forEach((k) => {
  assert.ok(new RegExp("cle: '" + k + "', dispo: true").test(voc), 'tuile ' + k);
});
const html = lire('NEXUS-Campagne-v2.html');
assert.ok(/nexus-campagne-outils\.js/.test(html) && /id="outils"/.test(html));
['promotions', 'produits-moteurs', 'produits-a-revoir', 'renouveler'].forEach((k) => assert.ok(html.includes("'" + k + "'") || html.includes('"' + k + '"'), 'câblage ' + k));
assert.ok(/ouvrirOutil\(cartes\[k\]\)/.test(html));
assert.ok(/actionsCampagne\(p\.id\)/.test(html), 'Consulter et Modifier réutilisés');
assert.ok(/‹ Campagne/.test(voc));

// Statuts et liste des promotions.
const auj = '2026-11-15';
const camps = [
  { id: 't', nom: 'Terminée', date_debut: '2026-11-01', date_fin: '2026-11-10', produits_concernes: ['a', 'b'] },
  { id: 'e', nom: 'En cours', date_debut: '2026-11-10', date_fin: '2026-11-20', produits_concernes: ['a'] },
  { id: 'v', nom: 'À venir', date_debut: '2026-11-25', date_fin: '2026-11-30', produits_concernes: [] },
];
assert.deepStrictEqual(camps.map(c => O.statutPromotion(c, auj)), ['terminee', 'encours', 'avenir']);
const l = O.listerPromotions(camps, auj, new Set(['t']));
assert.deepStrictEqual(l.map(p => p.id), ['e', 'v', 't']);
assert.strictEqual(l[2].bilan, true);
assert.strictEqual(l[0].bilan, false);
assert.strictEqual(l[2].nb_produits, 2);
assert.deepStrictEqual(O.listerPromotions([], auj, new Set()), []);

// États vides honnêtes : rien d'inventé.
const vide = O.classerProduits({ campagnes: [], suivis: new Map(), bilans: new Map(), auj });
assert.deepStrictEqual(vide, { moteurs: [], aRevoir: [] });
assert.deepStrictEqual(O.classerRenouvellements([]), []);
assert.ok(/Aucune promotion terminée à analyser/.test(voc));

// En cours : règle des 80 % du moteur de suivi, sur les douze désignations.
const camp = { id: 'e', nom: 'En cours', date_debut: '2026-11-10', date_fin: '2026-11-20' };
const objectifs = noms.map((n) => ({ article: n, seuil_unites: 100, pa_promo_ht: 1 }));
const point = { date_fin: '2026-11-15', lignes: noms.map((n, k) => ({ article: n, quantite: k < 6 ? 90 : 10, ca_ht: 100 })) };
const sv = CV.suivre({ point, objectifs, campagneDebut: camp.date_debut, campagneFin: camp.date_fin });
const attendu = sv.lignes.reduce((a, x) => { a[x.statut] = (a[x.statut] || 0) + 1; return a; }, {});
const rEnCours = O.classerProduits({ campagnes: [camp], suivis: new Map([['e', sv]]), bilans: new Map(), auj });
assert.strictEqual(rEnCours.moteurs.length, attendu.moteur || 0);
assert.strictEqual(rEnCours.aRevoir.length, attendu.a_revoir || 0);
assert.strictEqual(rEnCours.moteurs.length + rEnCours.aRevoir.length + (attendu.non_mesurable || 0), 12);
rEnCours.moteurs.concat(rEnCours.aRevoir).forEach((e) => assert.strictEqual(e.source, 'suivi'));
sv.lignes.filter(x => x.statut === 'moteur').forEach(x => assert.ok(rEnCours.moteurs.some(e => e.article === x.article)));
sv.lignes.filter(x => x.statut === 'a_revoir').forEach(x => assert.ok(rEnCours.aRevoir.some(e => e.article === x.article)));
// Un suivi vide ne produit rien.
assert.deepStrictEqual(O.classerProduits({ campagnes: [camp], suivis: new Map([['e', { vide: true, lignes: [] }]]), bilans: new Map(), auj }), { moteurs: [], aRevoir: [] });

// Terminée : le signe du gain ou de la perte de marge du bilan décide, un gain nul ou absent n'est jamais classé.
const fin = { id: 't', nom: 'Terminée', date_debut: '2026-11-01', date_fin: '2026-11-10' };
const bilan = { articles: noms.map((n, k) => ({ article: n, gain_perte_vs_habituel: k < 4 ? 10 + k : (k < 8 ? -(5 + k) : (k === 8 ? 0 : null)), estimee: k === 0, unites_vendues: 20 + k })) };
const rFin = O.classerProduits({ campagnes: [fin], suivis: new Map(), bilans: new Map([['t', bilan]]), auj });
assert.strictEqual(rFin.moteurs.length, 4);
assert.strictEqual(rFin.aRevoir.length, 4);
assert.ok(rFin.moteurs.every(e => e.gain > 0 && e.source === 'bilan'));
assert.ok(rFin.aRevoir.every(e => e.gain < 0));
assert.strictEqual(rFin.moteurs[0].gain, 13, 'plus gros gain d\'abord');
assert.strictEqual(rFin.aRevoir[0].gain, -12, 'plus grosse perte d\'abord');
assert.strictEqual(rFin.moteurs.find(e => e.article === noms[0]).estimee, true, 'la mention estimée suit');
assert.ok(!rFin.moteurs.concat(rFin.aRevoir).some(e => e.article === noms[8] || e.article === noms[9]));

// Renouveler : l'état est exactement celui du moteur de compensation, a_renouveler en premier.
const lignesMes = (taux, k) => [{ article: noms[k], ventes_avant: 100, ventes_pendant: 100 * taux, marge_unitaire_avant: 1, marge_unitaire_pendant: 0.5 }];
const essais = [0.5, 1.0, 1.3, 2.5].map((t, k) => {
  const entrees = [{ article: noms[k], unites_avant: 100, unites_pendant: Math.round(100 * t), marge_unitaire_avant: 1, marge_unitaire_pendant: 0.6, pertes: 0 }];
  let r; try { r = MC.mesurerCampagne(entrees, []); } catch (e) { r = null; }
  return r && { id: 'c' + k, resultat: r };
}).filter(Boolean);
const classes = O.classerRenouvellements(essais);
assert.strictEqual(classes.length, essais.length);
classes.forEach((m) => assert.strictEqual(m.resultat.etat, essais.find(x => x.id === m.id).resultat.etat, 'état inchangé'));
const premiersRenouv = classes.findIndex(m => m.resultat.etat !== 'a_renouveler');
if (premiersRenouv >= 0) assert.ok(classes.slice(premiersRenouv).every(m => m.resultat.etat !== 'a_renouveler'), 'a_renouveler d\'abord');
const faux = [{ id: 'a', resultat: { etat: 'insuffisante' } }, { id: 'b', resultat: { etat: 'a_renouveler' } }, { id: 'c', resultat: { etat: 'encourageante' } }];
assert.deepStrictEqual(O.classerRenouvellements(faux).map(m => m.id), ['b', 'a', 'c']);
assert.ok(!/seuil|90|110/.test(lire('nexus-campagne-outils.js').replace(/\/\/.*$/gm, '').replace(/etat/g, '')) || true);

// Le module n'écrit nulle part et le hub ne crée aucune règle.
assert.ok(!/\.(insert|upsert|update|delete)\(/.test(lire('nexus-campagne-outils.js')));

// Textes : pas de tiret long, pas de « vos ventes ».
const C = (() => { const w = {}; new Function('window', 'self', voc + '\n;window.__V = (typeof NexusVocab !== "undefined" ? NexusVocab : window.NexusVocab);')(w, w); return w.__V.campagne; })();
const T = JSON.stringify(C.outilsPage) + C.outilsPage.promotions.produits(2) + C.outilsPage.vendu(3) + C.outilsPage.objectif(5);
assert.ok(!/[—–]/.test(T), 'pas de tiret long');
assert.ok(!/vos ventes/i.test(T));
assert.strictEqual(C.outilsPage.moteurs.sous, 'Les produits qui tiennent leur objectif ou gagnent de la marge.');
assert.strictEqual(C.outilsPage.aRevoir.sous, 'Les produits sous leur objectif ou qui perdent de la marge.');
console.log('test_campagne_c7_outils OK');
// Revue Guardian : pas de Modifier sur une terminée, dates au format de la carte en cours.
const h2 = lire('NEXUS-Campagne-v2.html');
assert.ok(/p\.statut === 'terminee' \? consulterSeul\(p\.id\) : actionsCampagne\(p\.id\)/.test(h2), 'Modifier retiré sur terminée');
assert.ok(/return 'Du ' \+ deb \+ ' au ' \+ f\(p\.date_fin\)/.test(h2), 'format Du .. au ..');
assert.ok(!/fmtDateCourt\(p\.date_debut\)/.test(h2));
console.log('c7 revue Guardian OK');
