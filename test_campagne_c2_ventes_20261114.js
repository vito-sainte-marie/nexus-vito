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
assert.ok(/v_batch\.periode_fin is distinct from p_date_fin/.test(sql), 'la RPC refuse une date différente de celle du batch');
assert.ok(/ca_fichier/.test(sql) && /ca_estime/.test(sql), 'CA du fichier prioritaire, repli signalé');
assert.ok(/add column if not exists ca_estime/.test(sql), 'ajout idempotent du drapeau');

// Prochaine échéance (Petromix, fin 30/11) : 16/11, 23/11, puis 1er décembre.
{
  const e = d => V.prochaineEcheance({ campagneFin: '2026-11-30', dernierImportFin: d });
  assert.deepStrictEqual(e(null), { code: 'actualiser_j14', date: '2026-11-16' });
  assert.deepStrictEqual(e('2026-11-14'), { code: 'actualiser_j14', date: '2026-11-16' }, 'import du 14 : J-14 pas couvert');
  assert.deepStrictEqual(e('2026-11-15'), { code: 'actualiser_j7', date: '2026-11-23' }, 'import du 15 couvre J-14');
  assert.deepStrictEqual(e('2026-11-22'), { code: 'actualiser_fin', date: '2026-12-01' });
  assert.strictEqual(e('2026-11-30'), null, 'promotion entièrement couverte');
  const x = V.prochaineEcheance({ campagneFin: '2026-11-30', dernierImportFin: '2026-11-15', autres: [{ code: 'achats', date: '2026-11-20' }] });
  assert.strictEqual(x.code, 'achats', 'une autre échéance plus proche passe devant');
  assert.strictEqual(V.prochaineEcheance({}), null);
  const sm = V.suivre({ point: { batch_id: 'b', date_fin: '2026-11-20', lignes: [{ ...pt('b', '2026-11-20', 'x', 'COLA', 10, 20), ca_estime: true }] }, objectifs, campagneDebut: '2026-11-12', campagneFin: '2026-11-30' });
  assert.strictEqual(sm.lignes[0].marge_estimee, true, 'D8 : CA estimé signalé');
}
console.log('OK test_campagne_c2_ventes_20261114');

// Câblage : carte, lexique, redirection d'Import v1, page de suivi.
{
  const lire = f => fs.readFileSync(f, 'utf8');
  const carte = lire('NEXUS-Campagne-v2.html'), ventes = lire('NEXUS-Campagne-v2-Ventes.html'), imp = lire('NEXUS-Import-v1.html');
  const lex = lire('nexus-vocabulaire.js');
  assert.ok(/id="btnActualiser"/.test(carte) && /NEXUS-Campagne-v2-Ventes\.html\?campagne=/.test(carte), 'le bouton du haut ouvre Actualiser mes ventes');
  assert.ok(/prochaineEcheance\(/.test(carte) && /nexus-campagne-ventes\.js\?v=/.test(carte), 'la carte affiche la prochaine échéance du moteur');
  assert.ok(/ca_estime/.test(ventes) && /margeEstimee/.test(ventes), 'D8 : marge estimée signalée sur la page de suivi');
  assert.ok(/<details class="vt-prod"/.test(ventes) && !/<table class="vt-table"/.test(ventes), 'suivi compact, sans tableau à six colonnes');
  ['ventesPage', "actualiser: 'Actualiser mes ventes'", 'derniereActu', 'aucuneActu', 'prochaineActualiser'].forEach(k => assert.ok(lex.includes(k), 'lexique : ' + k));
  assert.ok(/<a [^>]*id="phasePendant"[^>]*href="NEXUS-Campagne-v2-Ventes\.html/.test(imp), 'Import v1 : Pendant la promo renvoie vers Actualiser mes ventes');
  assert.ok(!/publierBatch/.test(ventes), 'la page de suivi n\'utilise jamais publierBatch (products)');
  assert.ok(/campagne_ventes_publier/.test(ventes), 'publication par la seule RPC dédiée');
  assert.ok(!/from\('products'\)\.(insert|update|delete|upsert)/.test(ventes), 'aucune écriture dans products');
  [carte, ventes].forEach(p => assert.ok(/nexus-vocabulaire\.js/.test(p), 'version du lexique'));
  assert.ok(!/—/.test(lex.slice(lex.indexOf('ventesPage'), lex.indexOf('ventesPage') + 3000)), 'aucun tiret cadratin dans le bloc ventesPage');
  assert.ok(/marquerBatchStatut\(nexusClient, batch\.id, 'failed'/.test(ventes), 'un échec après création du batch le marque failed');
  assert.ok(/echec_publication/.test(ventes), 'l\'échec est journalisé');
  assert.ok(/let batch = null;/.test(ventes), 'le batch est visible depuis le catch');
  assert.ok(/ca_fichier/.test(ventes) && /detecterColonneCa/.test(ventes), 'colonne CA du fichier détectée');
  assert.ok(/from\('campagne_ventes_annulations'\)\.insert\(/.test(ventes), 'annulation par insertion tracée');
  assert.ok(/motifRequis/.test(ventes) && /data-annuler/.test(ventes), 'bouton et motif obligatoire');
  assert.ok(!/from\('campagne_ventes_(points|annulations)'\)\.(update|delete|upsert)/.test(ventes), 'append-only côté page');
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

// Recette Guardian 6880747094 : carte, libellés, historique, mapping, CSV.
{
  const camp = fs.readFileSync('./NEXUS-Campagne-v2.html', 'utf8');
  const ven = fs.readFileSync('./NEXUS-Campagne-v2-Ventes.html', 'utf8');
  const voc = fs.readFileSync('./nexus-vocabulaire.js', 'utf8');
  assert.ok(/location\.href = 'NEXUS-Campagne-v2-Ventes\.html\?campagne=' \+ encodeURIComponent\(b\.dataset\.suivre\)/.test(camp), 'la carte mène au suivi des ventes');
  assert.ok(!/Objectifs\.html\?campagne=' \+ encodeURIComponent\(b\.dataset\.suivre\)/.test(camp), 'la carte ne mène plus aux objectifs');
  assert.ok(/NEXUS-Campagne-v2-Objectifs\.html/.test(camp), 'la tuile Mes objectifs de vente reste');
  assert.ok(/Objectifs\.html\?campagne=' \+ encodeURIComponent\(CAMPAGNE\.id\)/.test(ven) && /voirObjectifs/.test(ven), 'lien Voir mes objectifs sur la page Ventes');
  assert.ok(/Voir mes objectifs/.test(voc));
  assert.ok(!/vos ventes/i.test(voc), 'libellé aligné : Actualiser mes ventes');
  assert.ok(/\.ec-rang\.prochaine \.val\{color:rgb\(var\(--boutique-rgb\)\)/.test(camp), 'valeur en cuivre, pas en cyan');
  assert.ok(/\.btn-lien\{[^}]*min-height:44px/.test(ven), 'boutons d\'historique stylés, 44 px');
  assert.ok(/class="btn-lien" data-confirmer/.test(ven) && /class="btn-lien" data-renoncer/.test(ven));
  assert.ok(/ligneHisto/.test(ven) && /Ventes au ' \+ vente/.test(voc), 'ligne « Ventes au … · importé le … »');
  assert.ok(/chargerMappingMemoire\(nexusClient, SITE_ID, 'ventes_catalogue'\)/.test(ven) && /detectMapping\(HEADERS, .*, MEMOIRE\)/.test(ven), 'mémoire de mapping de l\'import v1 utilisée');
  assert.ok(/select data-col/.test(ven) || /select\[data-col\]/.test(ven), 'choix de colonne si non reconnue');
  assert.ok(/raw: true/.test(ven), 'CSV lu en texte');
  const M = require('./nexus-import-moteur.js');
  assert.strictEqual(M.toNumber('1,47'), 1.47, 'virgule décimale lue comme 1,47 et non 147');
  assert.ok(/\.vt-annul\[hidden\]\{display:none/.test(ven), 'zone d\'annulation masquée tant que hidden');
  assert.ok(/<span class="vt-annul"[^>]* hidden>/.test(ven), 'zone masquée au chargement');
  assert.ok(/data-annuler[\s\S]{0,400}\.hidden = false|z\.hidden = false|hidden = false/.test(ven), 'affichée après le clic');
  assert.ok(/renoncer: 'Renoncer'/.test(voc) && /esc\(P\.renoncer\)/.test(ven), 'bouton nommé Renoncer');
  console.log('OK recette Guardian');
}
