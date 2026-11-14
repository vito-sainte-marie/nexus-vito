// Campagne V2, lot C2 : épreuves du moteur de suivi des ventes et du schéma.
const assert = require('assert');
const fs = require('fs');
const V = require('./nexus-campagne-ventes.js');

const pt = (batch, fin, importe, art, q, ca) => ({ batch_id: batch, article: art, date_fin: fin, importe_le: importe, quantite: q, ca_ht: ca });

// Deux imports cumulés : le dernier fait foi, jamais la somme.
const points = [
  pt('b1', '2026-11-15', '2026-11-16T08:00', 'COLA', 40, 80), pt('b2', '2026-11-20', '2026-11-21T08:00', 'COLA', 100, 200),
];
let c = V.pointCourant(points, []);
assert.strictEqual(c.batch_id, 'b2', 'le dernier import valide fait foi');
assert.strictEqual(c.lignes.reduce((s, l) => s + l.quantite, 0), 100, 'jamais la somme de deux imports (140)');

// Import annulé : absent du suivi, présent dans l'historique.
c = V.pointCourant(points, [{ batch_id: 'b2', motif: 'mauvais fichier' }]);
assert.strictEqual(c.batch_id, 'b1', 'un import annulé laisse le précédent faire foi');
const h = V.historique(points, [{ batch_id: 'b2', motif: 'mauvais fichier' }]);
assert.strictEqual(h.length, 2, 'l\'historique garde tous les imports');
assert.strictEqual(h[0].annule, true);
assert.strictEqual(h[0].motif, 'mauvais fichier');
assert.strictEqual(V.pointCourant(points, [{ batch_id: 'b1' }, { batch_id: 'b2' }]), null, 'tout annulé : aucun point');
assert.strictEqual(V.pointCourant([], []), null);

// Un remplacement abandonné (aucun point écrit) laisse l'ancien import valide.
assert.strictEqual(V.pointCourant([points[0]], []).batch_id, 'b1', 'remplacement échoué : l\'ancien reste valide');

// Dates refusées.
const ctx = { aujourdhui: '2026-11-22', campagneDebut: '2026-11-12', campagneFin: '2026-11-30', dernierImportFin: '2026-11-15' };
assert.strictEqual(V.verifierDateFin('2026-11-21', ctx), null, 'la veille est acceptée');
assert.ok(/veille/.test(V.verifierDateFin('2026-11-22', ctx)), 'le jour même est refusé');
assert.ok(/fin de la promotion/.test(V.verifierDateFin('2026-12-02', { ...ctx, aujourdhui: '2026-12-10' })), 'au-delà de la fin de promotion');
assert.ok(/précède le dernier import/.test(V.verifierDateFin('2026-11-14', ctx)), 'avant le dernier import valide');
assert.ok(/début/.test(V.verifierDateFin('2026-11-10', { ...ctx, dernierImportFin: null })), 'avant le début');
assert.ok(/manquante/.test(V.verifierDateFin('', ctx)));

// Effort restant aux bornes.
assert.deepStrictEqual(V.effortRestant(100, 40, 6), { etat: 'en_cours', parJour: 10, reste: 60 });
assert.strictEqual(V.effortRestant(100, 41, 6).parJour, 10, 'arrondi au plafond (59/6)');
assert.strictEqual(V.effortRestant(100, 100, 6).etat, 'atteint', 'seuil atteint');
assert.strictEqual(V.effortRestant(100, 130, 6).parJour, 0, 'seuil dépassé : jamais négatif');
assert.strictEqual(V.effortRestant(100, 40, 1).parJour, 60, 'dernier jour');
assert.strictEqual(V.effortRestant(100, 40, 0).etat, 'termine', 'plus aucun jour');
assert.strictEqual(V.effortRestant(100, 40, 0).parJour, null, 'pas de division par zéro');
assert.strictEqual(V.joursRestants('2026-11-30', '2026-11-30'), 0);
assert.strictEqual(V.joursRestants('2026-11-20', '2026-11-30'), 10);

// Moteurs et à revoir (80 %).
assert.strictEqual(V.classer(80, 10, 10), 'moteur', 'exactement 80 %');
assert.strictEqual(V.classer(79, 10, 10), 'a_revoir');
assert.strictEqual(V.classer(5, 0, 10), 'non_mesurable', 'sans objectif validé');

// Article absent du fichier : 0 et signalé ; objectif validé inchangé.
const objectifs = [{ article: 'COLA', seuil_unites: 200, objectif_valide_jour: 10, pa_promo_ht: 1.5 }, { article: 'BIERE', seuil_unites: 50, objectif_valide_jour: 5, pa_promo_ht: null }];
const avant = JSON.stringify(objectifs);
const point = { batch_id: 'b2', date_fin: '2026-11-20', lignes: [pt('b2', '2026-11-20', 'x', 'COLA', 100, 200), { ...pt('b2', '2026-11-20', 'x', 'BIERE', 0, 0), absent_du_fichier: true }] };
const s = V.suivre({ point, objectifs, campagneDebut: '2026-11-12', campagneFin: '2026-11-30' });
assert.strictEqual(JSON.stringify(objectifs), avant, 'un import ne modifie jamais un objectif validé');
assert.strictEqual(s.jours_ecoules, 9);
assert.strictEqual(s.jours_restants, 10);
const biere = s.lignes.find(l => l.article === 'BIERE');
assert.strictEqual(biere.vendu, 0);
assert.strictEqual(biere.absent_du_fichier, true, 'article absent signalé');
assert.strictEqual(biere.marge_ht, null, 'marge non mesurable sans PA promo');
assert.strictEqual(s.lignes.find(l => l.article === 'COLA').marge_ht, 50, 'marge HT = 200 - 100 x 1,5');
assert.strictEqual(V.suivre({ point: null, objectifs, campagneDebut: '2026-11-12', campagneFin: '2026-11-30' }).vide, true);

// Schéma : lecture seule, vue en security_invoker, aucune écriture dans products.
const sql = fs.readFileSync(fs.readdirSync('supabase/migrations').filter(f => /campagne_ventes_points/.test(f)).map(f => 'supabase/migrations/' + f)[0], 'utf8');
assert.ok(/create or replace view campagne_ventes_point_courant with \(security_invoker = true\)/.test(sql), 'vue en security_invoker');
assert.ok(/security invoker/.test(sql), 'RPC en security invoker');
assert.ok(!/(insert into|update|delete from)\s+products/i.test(sql), 'products n\'est jamais écrite');
assert.ok(/revoke all on campagne_ventes_point_courant from anon/.test(sql), 'vue fermée à anon');
assert.ok(/revoke update, delete, truncate, references, trigger on campagne_ventes_points from authenticated/.test(sql));
assert.ok(/unique \(batch_id, article\)/.test(sql));
assert.ok(/p_date_fin > \(current_date - 1\)/.test(sql), 'la RPC refuse au-delà de la veille');

console.log('OK test_campagne_c2_ventes_20261114');

// Câblage : carte, lexique, redirection d'Import v1, page de suivi.
{
  const lire = f => fs.readFileSync(f, 'utf8');
  const carte = lire('NEXUS-Campagne-v2.html'), ventes = lire('NEXUS-Campagne-v2-Ventes.html'), imp = lire('NEXUS-Import-v1.html');
  const lex = lire('nexus-vocabulaire.js');
  assert.ok(/data-actualiser=/.test(carte) && /NEXUS-Campagne-v2-Ventes\.html\?campagne=/.test(carte), 'la carte ouvre Actualiser mes ventes');
  ['ventesPage', "actualiser: 'Actualiser mes ventes'", 'derniereActu', 'aucuneActu', 'prochaineActualiser'].forEach(k => assert.ok(lex.includes(k), 'lexique : ' + k));
  assert.ok(/<a [^>]*id="phasePendant"[^>]*href="NEXUS-Campagne-v2-Ventes\.html/.test(imp), 'Import v1 : Pendant la promo renvoie vers Actualiser mes ventes');
  assert.ok(!/publierBatch/.test(ventes), 'la page de suivi n\'utilise jamais publierBatch (products)');
  assert.ok(/campagne_ventes_publier/.test(ventes), 'publication par la seule RPC dédiée');
  assert.ok(!/from\('products'\)\.(insert|update|delete|upsert)/.test(ventes), 'aucune écriture dans products');
  [carte, ventes].forEach(p => assert.ok(/nexus-vocabulaire\.js\?v=20261114-1900/.test(p), 'version du lexique'));
  assert.ok(!/—/.test(lex.slice(lex.indexOf('ventesPage'), lex.indexOf('ventesPage') + 3000)), 'aucun tiret cadratin dans le bloc ventesPage');
  console.log('OK câblage C2');
}

// La garde ne prend pas un `revoke ... truncate` pour un TRUNCATE, mais voit un vrai.
{
  const G = require('./outils/garde-ordre-migration-code.js');
  const ex = G.extraireObjets || (G.default && G.default.extraireObjets);
  if (ex) {
    const r1 = ex('revoke update, delete, truncate on t from authenticated;');
    const r2 = ex('truncate table t;');
    const d = r => JSON.stringify(r.destructifs || r.destructif || r);
    assert.ok(!/truncate/.test(d(r1)), 'revoke truncate : pas destructif');
    assert.ok(/truncate/.test(d(r2)), 'vrai truncate : destructif');
  }
  console.log('OK garde revoke truncate');
}
