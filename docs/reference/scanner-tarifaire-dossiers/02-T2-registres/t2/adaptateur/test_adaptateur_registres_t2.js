// Tests de l'adaptateur registres → contexte T1. node test_adaptateur_registres_t2.js
const assert = require('assert'), path = require('path');
globalThis.window = globalThis;
require(path.join(__dirname, '..', '..', 't1', 'nexus-produits-mesure.js'));
const T = require(path.join(__dirname, '..', '..', 't1', 'nexus-politique-tarifaire.js'));
const A = require('./nexus-politique-tarifaire-registres.js');
let n = 0; const ok = (nom, f) => { f(); n++; console.log('  ✓ ' + nom); };
const S = 'site-a';

ok('rattachements par rayon et par référence', () => {
  const c = A.contexteDepuisRegistres({ rattachements: [{ site: S, portee: 'rayon', rayon: 'Sodas, toniques', famille_code: 'sodas_autres' },
    { site: S, portee: 'reference', code_barres: '2292084000054', famille_code: 'sodas_2l' }] });
  assert.deepStrictEqual(c.familles.parRayon, { 'Sodas, toniques': 'sodas_autres' });
  assert.deepStrictEqual(c.familles.parReference, [{ code_barres: '2292084000054', famille: 'sodas_2l', motif: null }]);
  assert.deepStrictEqual(c.familles.parMotif, [], 'aucune expression régulière venue des registres');
});
ok('seuils par niveau, statuts conservés tels quels', () => {
  const c = A.contexteDepuisRegistres({ seuils: [
    { id: 's1', site: S, niveau: 'famille', cible_niveau: 'confiserie', minimum: null, statut_minimum: null, cible: '0.50', statut_cible: 'valide' },
    { id: 's2', site: S, niveau: 'rayon', cible_niveau: 'Jus', minimum: '0.41', statut_minimum: 'indicatif', cible: '0.49', statut_cible: 'a_l_etude' },
    { id: 's3', site: S, niveau: 'defaut', cible_niveau: 'defaut', minimum: '0.41', statut_minimum: 'hypothese', cible: '0.48', statut_cible: 'hypothese' }] });
  assert.deepStrictEqual(c.seuils.confiserie, { minimum: null, cible: 0.5, statutMinimum: null, statutCible: 'valide', seuil_id: 's1' });
  assert.strictEqual(c.seuilsRayon.Jus.statutMinimum, 'indicatif'); assert.strictEqual(c.seuilDefaut.statutMinimum, 'hypothese');
});
ok('réglages A6 et généraux traduits vers le moteur', () => {
  const c = A.contexteDepuisRegistres({ reglages: [{ site: S, parametre: 'a6_montant_minimal', valeur: '5' }, { site: S, parametre: 'palier_ttc', valeur: '0.10' }] });
  assert.deepStrictEqual(c.reglages, { a6: { montantMinimal: 5 }, palierTtc: 0.1 });
  const l = T.analyser([{ article: 'X', categorie: 'R', quantite: 1, prix_vente: 1, prix_achat: 0.9, tva: 0 }], [], Object.assign(c, { seuils: { F: { minimum: 0.41, statutMinimum: 'valide' } }, familles: { parRayon: { R: 'F' } } })).lignes[0];
  assert.strictEqual(Math.round(l.simulation.minimum.ttc * 100) % 10, 0, 'palier de 0,10 € appliqué');
});
ok('prix décidé : dernière saisie déclarée et dernière preuve, jamais déduites', () => {
  const c = A.contexteDepuisRegistres({ prixDecides: [{ id: 'p1', site: S, article: 'Sprite 2l - 6P', nature: 'changement', prix_ttc: '4.80', decide_le: '2026-11-16' }],
    applications: [{ site: S, prix_decide_id: 'p1', evenement: 'saisie_declaree', date_effet: '2026-11-18' }, { site: S, prix_decide_id: 'p1', evenement: 'saisie_declaree', date_effet: '2026-11-20' },
      { site: S, prix_decide_id: 'p1', evenement: 'preuve_application', preuve_type: 'ticket', date_effet: '2026-11-21' }] });
  assert.deepStrictEqual(c.prixDecides[0], { article: 'Sprite 2l - 6P', prix_ttc: 4.8, nature: 'changement', decide_le: '2026-11-16', saisie_declaree_le: '2026-11-20', preuve_application: { type: 'ticket', date: '2026-11-21' } });
  const sans = A.contexteDepuisRegistres({ prixDecides: [{ id: 'p2', site: S, article: 'Y', nature: 'changement', prix_ttc: 1 }] });
  assert.strictEqual(sans.prixDecides[0].saisie_declaree_le, null); assert.strictEqual(sans.prixDecides[0].preuve_application, null);
});
ok('exceptions effectives : produits_appel repris comme exception validée, source conservée', () => {
  const c = A.contexteDepuisRegistres({ exceptions: [{ site: S, article: 'Glacons Vito 5 kg', type: 'produit_appel', statut: 'validee', motif: 'enregistré dans produits_appel le 14/07/2026', source: 'produits_appel' },
    { site: S, article: 'Bonbon Menthise 250G - 29P', type: 'produit_appel', statut: 'candidate', motif: 'à confirmer', source: 'tarif_exceptions' }] });
  assert.strictEqual(c.exceptions[0].source, 'produits_appel'); assert.strictEqual(c.exceptions[1].statut, 'candidate');
});
ok('contrôles réglementaires et régimes', () => {
  const c = A.contexteDepuisRegistres({ controles: [{ site: S, portee: 'rayon', rayon: 'PUFFS', etat: 'controle_ouvert', raison: 'x' }],
    regimes: [{ site: S, article: 'Feuille de Tabac FINE LEAF 15g - 15P', regime: 'a_qualifier', raison: 'non établi' }] });
  assert.deepStrictEqual(c.reglementaire[0], { rayon: 'PUFFS', etat: 'controle_ouvert', type_element: null, raison: 'x' });
  assert.strictEqual(c.regimes[0].regime, 'a_qualifier');
});
ok('refus de mélanger les registres de deux sites', () => {
  assert.throws(() => A.contexteDepuisRegistres({ familles: [{ site: 'site-a', famille_code: 'a', libelle: 'A' }], seuils: [{ site: 'site-b', niveau: 'defaut', cible_niveau: 'defaut', minimum: 0.4, statut_minimum: 'hypothese' }] }), /plusieurs sites/);
});
ok('registres vides : contexte neutre, moteur sans seuil validé', () => {
  const c = A.contexteDepuisRegistres({});
  const l = T.analyser([{ article: 'X', categorie: 'R', quantite: 5, prix_vente: 2, prix_achat: 1, tva: 2.1 }], [], c).lignes[0];
  assert.strictEqual(l.statut, 'sans_seuil_valide');
});
console.log(`\n${n} tests réussis`);
