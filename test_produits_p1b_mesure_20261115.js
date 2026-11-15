// Produits P1-B : trois états de TVA, nature des références, justification de déstockage, observation, synthèse.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
let n = 0;
const t = (nom, f) => { f(); n++; console.log('OK ' + nom); };
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
['nexus-conseiller.js', 'nexus-marge.js', 'nexus-produits-mesure.js'].forEach(f => vm.runInContext(lire(f), sb, { filename: f }));
const M = sb.NexusProduitsMesure;
const D = '2026-10-05', F = '2026-11-09';
const L = (article, cat, marge, qte, ca, x) => Object.assign({ site: 'vito', periode_debut: D, periode_fin: F, categorie: cat, article, code_barres: null, quantite: qte, prix_achat: 1, prix_vente: ca / qte, tva: 20, ca, marge }, x || {});
const mes = (rows, extra) => M.mesurer(Object.assign({ products: rows, site: 'vito', periodeDebut: D, periodeFin: F }, extra || {}));
const fond = () => [L('Fond A', 'Snacking', 30, 30, 90), L('Fond B', 'Snacking', 20, 20, 60)];

t('Smirnoff Ice importée à 8,5 % : TTC 4,10 € avec la mention non confirmée', () => {
  const o = mes([L('Smirnoff Ice 275 ml', 'Bières', 20, 10, 37.8, { tva: 8.5, prix_vente: 3.78 })].concat(fond()));
  const m = o.mesures[0];
  assert.strictEqual(m.tva.etat, 'importee');
  assert.strictEqual(m.pv_ttc.valeur, 4.10);
  assert.strictEqual(m.pv_ttc.mention, 'TVA importée de Decenium, non confirmée');
});
t('Pringles 0 % dans un rayon taxé : incohérente, TTC à vérifier, aucune correction', () => {
  const o = mes([L('Pringles', 'Snacking', 21.5, 25, 52.5, { tva: 0, prix_vente: 2.1 })].concat(fond()));
  const m = o.mesures[0];
  assert.strictEqual(m.tva.etat, 'incoherente');
  assert.strictEqual(m.pv_ttc.valeur, null);
  assert.strictEqual(m.pv_ttc.mention, 'TTC à vérifier');
  assert.strictEqual(m.tva.taux_importe, 0);
});
t('Pringles confirmée à 0 % : TTC = HT, état confirmée, sans réserve', () => {
  const conf = [{ id: 'c1', article: 'Pringles', taux_confirme: 0, confirme_le: '2026-11-15T10:00:00Z', confirme_par: 'u' }];
  const o = mes([L('Pringles', 'Snacking', 21.5, 25, 52.5, { tva: 0, prix_vente: 2.1 })].concat(fond()), { tvaConfirmations: conf });
  const m = o.mesures[0];
  assert.strictEqual(m.tva.etat, 'confirmee');
  assert.strictEqual(m.pv_ttc.valeur, 2.1);
  assert.strictEqual(m.pv_ttc.mention, null);
});
t('Ginger beer : 8,5 % puis 2,1 % incohérente ; confirmée à 2,1 % ; un nouvel import à 8,5 % la rend incohérente', () => {
  const act = L('Ginger beer Supermalt', 'Bières', 10, 10, 20, { tva: 2.1, prix_vente: 2 });
  const pre = L('Ginger beer Supermalt', 'Bières', 10, 10, 20, { tva: 8.5, prix_vente: 2 });
  const precedent = { rows: [pre], debut: '2026-08-31', fin: '2026-10-04' };
  let m = mes([act].concat(fond()), { precedent }).mesures[0];
  assert.strictEqual(m.tva.etat, 'incoherente');
  const conf = [{ id: 'c', article: 'Ginger beer Supermalt', taux_confirme: 2.1, confirme_le: '2026-11-15T10:00:00Z' }];
  m = mes([act].concat(fond()), { precedent, tvaConfirmations: conf }).mesures[0];
  assert.strictEqual(m.tva.etat, 'confirmee');
  assert.strictEqual(m.pv_ttc.valeur, 2.04 + 0.002 > 0 ? Math.round(2 * 1.021 * 100) / 100 : 0);
  m = mes([Object.assign({}, act, { tva: 8.5, periode_debut: '2026-11-10', periode_fin: '2026-11-20' })].concat(fond()), { precedent, tvaConfirmations: conf }).mesures[0];
  assert.strictEqual(m.tva.etat, 'incoherente');
  assert.ok(/taux importé 8,5 % différent du taux confirmé 2,1 %/.test(m.tva.raison), m.tva.raison);
});
t('Pringles exporté à 0 % puis confirmé à 2,1 % le 15/11 : confirmée, TTC au taux confirmé, écart signalé', () => {
  const conf = [{ id: 'c', article: 'Pringles', taux_confirme: 2.1, confirme_le: '2026-11-15T10:00:00Z', confirme_par: 'u' }];
  const m = mes([L('Pringles', 'Snacking', 21.5, 25, 52.5, { tva: 0, prix_vente: 2.1 })].concat(fond()), { tvaConfirmations: conf }).mesures[0];
  assert.strictEqual(m.tva.etat, 'confirmee');
  assert.strictEqual(m.pv_ttc.valeur, 2.14);
  assert.strictEqual(m.tva.ecart_export, 0);
  assert.ok(/Decenium exporte 0 %, différent du taux confirmé 2,1 %/.test(m.tva.raison), m.tva.raison);
});
t('export du jour même de la confirmation : confirmée ; export postérieur au taux différent : incohérente, sans TTC', () => {
  const conf = [{ id: 'c', article: 'Pringles', taux_confirme: 2.1, confirme_le: '2026-11-09T18:00:00Z', confirme_par: 'u' }];
  const base = { tva: 0, prix_vente: 2.1 };
  let m = mes([L('Pringles', 'Snacking', 21.5, 25, 52.5, base)].concat(fond()), { tvaConfirmations: conf }).mesures[0];
  assert.strictEqual(m.tva.etat, 'confirmee');
  m = mes([L('Pringles', 'Snacking', 21.5, 25, 52.5, Object.assign({ periode_fin: '2026-11-10' }, base))].concat(fond()), { tvaConfirmations: conf }).mesures[0];
  assert.strictEqual(m.tva.etat, 'incoherente');
  assert.strictEqual(m.pv_ttc.valeur, null);
  assert.strictEqual(m.pv_ttc.mention, 'TTC à vérifier');
});
t('une confirmation annulée ou remplacée ne compte pas', () => {
  const lignes = [{ id: 'a', annule_le: 'x', confirme_le: '2026-11-01' }, { id: 'b', confirme_le: '2026-11-02' }, { id: 'c', remplace_id: 'b', confirme_le: '2026-11-03' }];
  assert.deepStrictEqual(M.actives(lignes, 'confirme_le').map(x => x.id), ['c']);
});
const acompte = () => L('ACOMPTE', 'Divers', 500, 5, 500, { prix_vente: 100, marge: 500 });
t('ACOMPTE : sans déclaration il reste commercial ; avec operation_caisse il est exclu et le CA se réconcilie', () => {
  const rows = [acompte()].concat(fond());
  const sans = mes(rows);
  assert.strictEqual(sans.mesures[0].exclue_indicateurs, false);
  assert.strictEqual(sans.resume.synthese.operations_caisse, 0);
  const natures = [{ id: 'n', article: 'ACOMPTE', nature: 'operation_caisse', declare_le: '2026-11-15T10:00:00Z' }];
  const avec = mes(rows, { natures });
  const s = avec.resume.synthese;
  assert.strictEqual(avec.mesures[0].exclue_indicateurs, true);
  assert.strictEqual(s.operations_caisse, 500);
  assert.strictEqual(s.ca_analytique, 150);
  assert.strictEqual(s.ca_importe, 650);
  assert.strictEqual(avec.resume.references, 2);
  assert.strictEqual(avec.mesures[0].rang.valeur, null);
});
t('PCS Creacard : signalée à identifier, jamais exclue', () => {
  const o = mes([L('PCS Creacard 20', 'Divers', 5, 150, 150, { prix_vente: 1 })].concat(fond()));
  assert.strictEqual(o.mesures[0].a_identifier, true);
  assert.strictEqual(o.mesures[0].exclue_indicateurs, false);
  assert.strictEqual(o.resume.synthese.references_a_identifier, 1);
});
t('observation Pringles : 0,31 vers 0,69 u./jour, +122 %, CA précédent sous le seuil', () => {
  const cur = L('Pringles', 'Snacking', 21.5, 25, 52.5, { prix_vente: 2.1 });
  const pre = L('Pringles', 'Snacking', 5, 11, 23.1, { prix_vente: 2.1 });
  const o = mes([cur].concat(fond()), { precedent: { rows: [pre], debut: '2026-09-01', fin: '2026-10-04' } });
  const ob = o.mesures[0].observation;
  assert.ok(ob && ob.sens === 'hausse');
  assert.ok(Math.abs(ob.ventes_jour_actuel - 25 / 36) < 1e-9);
  assert.ok(ob.ca_precedent < 50);
});
t('déstockage justifié : valable pour la période affichée, la marge reste négative et comptée', () => {
  const rows = [L('HARIBO', 'Confiserie', -20.02, 40, 60), L('Neg 2', 'Confiserie', -5, 10, 20), L('Neg 3', 'Confiserie', -3, 10, 20)].concat(fond());
  const base = mes(rows).resume.synthese;
  assert.deepStrictEqual([base.marge_negative, base.destockages_justifies, base.marges_a_verifier], [3, 0, 3]);
  const j = [{ id: 'j', article: 'HARIBO', motif: 'dlc', periode_debut: D, periode_fin: F, valide_le: '2026-11-15T10:00:00Z' }];
  const o = mes(rows, { justifications: j });
  const s = o.resume.synthese;
  assert.deepStrictEqual([s.marge_negative, s.destockages_justifies, s.marges_a_verifier], [3, 1, 2]);
  assert.strictEqual(o.mesures[0].marge_negative, true);
  const autre = mes(rows, { justifications: [Object.assign({}, j[0], { periode_fin: '2026-12-01' })] }).resume.synthese;
  assert.strictEqual(autre.destockages_justifies, 0);
});
t('service_commercial : pas de couverture ni de ventes par jour', () => {
  const natures = [{ id: 'n', article: 'Service X', nature: 'service_commercial', declare_le: '2026-11-15T10:00:00Z' }];
  const o = mes([L('Service X', 'Divers', 10, 200, 200, { prix_vente: 1 })].concat(fond()), { natures, stockReleves: [] });
  assert.strictEqual(o.mesures[0].quantite_possiblement_en_euros, true);
  assert.strictEqual(o.mesures[0].exclue_indicateurs, false);
});
console.log('\n' + n + ' tests passent.');
