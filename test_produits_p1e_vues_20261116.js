// P1-E : « Mes produits en promotion ». Module pur + garde-fous (aucun fichier Campagne modifié, aucune marge de promotion).
const assert = require('assert'), fs = require('fs'), path = require('path'), cp = require('child_process');
const V = require('./nexus-produits-vues.js'), O = require('./nexus-campagne-outils.js'), VT = require('./nexus-campagne-ventes.js'), M = require('./nexus-produits-mesure.js');
const nn = M.normaliserNom;
const NOMS = ['Heineken 0.0 25 cl', 'Oreo 66 g', 'Pringles Origl 175g', 'Pringles Origl 40g', 'Doublon', 'Doublon'];
const PROD = ['Heineken 0.0 25 cl', 'Oreo 66 g', 'Pringles Origl 175g', 'Inconnu 1'];
const camp = [{ id: 'c1', nom: 'PETROMIX NOVEMBRE 2026', date_debut: '2026-11-12', date_fin: '2026-11-30', produits_concernes: PROD }];
const obj = new Map([['c1', PROD.map(a => ({ article: a, version: 1, seuil_unites: 10, objectif_valide_jour: 2, pa_promo_ht: 1 }))]]);
const base = { campagnes: camp, objectifs: obj, points: new Map(), annulations: [], auj: '2026-11-15', articlesSite: NOMS, outils: O, ventes: VT, normaliserNom: nn };

// 1. PETROMIX en cours, 4 produits, sans point : aucun statut de suivi ; nom non unique ou inconnu = à rapprocher.
let r = V.promotions(base);
assert.strictEqual(r.length, 1); assert.strictEqual(r[0].statut, 'encours'); assert.strictEqual(r[0].nb_produits, 4); assert.strictEqual(r[0].point, false);
assert.ok(r[0].produits.every(x => x.statutSuivi === null));
assert.strictEqual(r[0].produits[0].fiche, 'Heineken 0.0 25 cl');
assert.strictEqual(r[0].produits[3].fiche, null); assert.strictEqual(r[0].produits[3].aRapprocher, true);
const dbl = V.promotions({ ...base, campagnes: [{ ...camp[0], produits_concernes: ['Doublon'] }], objectifs: new Map() });
assert.strictEqual(dbl[0].produits[0].aRapprocher, true, 'nom non unique : à rapprocher, sans fusion');
console.log('OK  PETROMIX en cours, sans point, rapprochement unique ou « à rapprocher »');

// 2. Fenêtre de 60 jours : terminée récente gardée, ancienne écartée.
const vieille = { id: 'c2', nom: 'Ancienne', date_debut: '2026-08-01', date_fin: '2026-09-10', produits_concernes: [] };
const recente = { id: 'c3', nom: 'Récente', date_debut: '2026-10-01', date_fin: '2026-10-20', produits_concernes: ['Oreo 66 g'] };
r = V.promotions({ ...base, campagnes: [...camp, vieille, recente] });
assert.deepStrictEqual(r.map(p => p.nom), ['PETROMIX NOVEMBRE 2026', 'Récente']);
console.log('OK  fenêtre de 60 jours');

// 3. Badge de fiche.
r = V.promotions(base);
assert.strictEqual(V.promotionDuProduit(r, 'Heineken 0.0 25 cl', NOMS, nn).nom, 'PETROMIX NOVEMBRE 2026');
assert.strictEqual(V.promotionDuProduit(r, 'Pringles Origl 175g', NOMS, nn).nom, 'PETROMIX NOVEMBRE 2026');
assert.strictEqual(V.promotionDuProduit(r, 'Pringles Origl 40g', NOMS, nn), null, 'Pringles 40g : pas de badge');
assert.strictEqual(V.promotionDuProduit(r, 'Doublon', NOMS, nn), null);
console.log('OK  badge : Heineken 0.0 et Pringles 175g oui, Pringles 40g non');

// 4. Avec un point de ventes : statut identique à celui de suivre (même entrée, même sortie que la page Ventes de Campagne).
const points = new Map([['c1', [{ batch_id: 'b1', article: 'Oreo 66 g', date_fin: '2026-11-15', importe_le: '2026-11-15T10:00:00Z', quantite: 40, ca_ht: 50, ca_estime: 0, absent_du_fichier: false }, { batch_id: 'b1', article: 'Heineken 0.0 25 cl', date_fin: '2026-11-15', importe_le: '2026-11-15T10:00:00Z', quantite: 1, ca_ht: 2, ca_estime: 0, absent_du_fichier: false }]]]);
r = V.promotions({ ...base, points });
const pt = VT.pointCourant(points.get('c1'), []);
const sv = VT.suivre({ point: pt, objectifs: obj.get('c1'), campagneDebut: '2026-11-12', campagneFin: '2026-11-30' });
assert.strictEqual(r[0].point, true);
sv.lignes.forEach(l => { const x = r[0].produits.find(p => p.article === l.article); assert.strictEqual(x.statutSuivi, l.statut); });
assert.ok(r[0].produits.some(x => x.statutSuivi));
console.log('OK  statut de suivi = sortie de suivre()');

// 5. Aucune marge de promotion dans Produits ; aucun fichier Campagne modifié.
const src = fs.readFileSync(path.join(__dirname, 'nexus-produits-vues.js'), 'utf8');
const bloc = src.slice(src.indexOf('function promotions'), src.indexOf('const API'));
assert.ok(!/marge_ht|marge_estimee/.test(bloc), 'le module ne lit aucune marge de promotion');
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Produits-v1.html'), 'utf8');
const vue = html.slice(html.indexOf("cle === 'promo'"), html.indexOf("cle === 'stocks'"));
assert.ok(vue.length > 100 && !/marge_ht|marge_estimee/.test(vue), 'la vue n\'affiche aucune marge de promotion');
// Le contrôle n'a de sens que sur le diff d'une PR (base de fusion) ; sur un push
// vers production la comparaison ne porte pas sur ce diff : on ne la fait pas.
const baseRef = process.env.GITHUB_BASE_REF || (process.env.GITHUB_ACTIONS ? '' : 'production');
try {
  if (!baseRef) throw new Error('pas de PR : diff non applicable');
  const d = cp.execSync('git diff --name-only origin/' + baseRef + '...HEAD -- "nexus-campagne*" "NEXUS-Campagne*" nexus-vocabulaire.js', { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  assert.strictEqual(d, '', 'fichier Campagne modifié : ' + d);
  console.log('OK  aucune marge de promotion, aucun fichier Campagne modifié');
} catch (e) { if (e.name === 'AssertionError') throw e; console.log('OK  aucune marge de promotion (diff git indisponible ici)'); }
