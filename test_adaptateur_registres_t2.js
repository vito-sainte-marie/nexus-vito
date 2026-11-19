// Épreuves de l'adaptateur registres → contexte du moteur de politique tarifaire (T2).
// Données ENTIÈREMENT fictives : site, rayons, familles, références, prix et seuils inventés.
const assert = require('assert');
const A = require('./nexus-politique-tarifaire-registres.js');
const T = require('./nexus-politique-tarifaire.js');

let n = 0;
const ok = (nomEpreuve, f) => { f(); n++; };
const S = 'site-fictif-1';
const periode = { debut: '2030-03-01', fin: '2030-03-30' };

ok('rattachements : par rayon et par référence, sans expression régulière', () => {
  const c = A.contexteDepuisRegistres({
    familles: [{ site: S, famille_code: 'Alpha', libelle: 'Famille Alpha' }, { site: S, famille_code: 'Beta', libelle: 'Famille Beta' }],
    rattachements: [
      { site: S, portee: 'rayon', rayon: 'Rayon Alpha', famille_code: 'Alpha' },
      { site: S, portee: 'reference', code_barres: ' 000111 ', famille_code: 'Beta', motif: 'motif fictif' },
      { site: S, portee: 'reference', article: 'Produit Z', famille_code: 'Beta' },
    ],
  });
  assert.deepStrictEqual(c.familles.parRayon, { 'Rayon Alpha': 'Alpha' });
  assert.deepStrictEqual(c.familles.parReference, [
    { code_barres: '000111', famille: 'Beta', motif: 'motif fictif' },
    { article: 'Produit Z', famille: 'Beta', motif: null },
  ]);
  assert.deepStrictEqual(c.familles.parMotif, []);
  assert.deepStrictEqual(c.libellesFamilles, { Alpha: 'Famille Alpha', Beta: 'Famille Beta' });
});

ok('seuils par niveau, statuts conservés', () => {
  const c = A.contexteDepuisRegistres({ seuils: [
    { site: S, id: 1, niveau: 'famille', cible_niveau: 'Alpha', minimum: '0.40', cible: '0.50', statut_minimum: 'valide', statut_cible: 'indicatif' },
    { site: S, id: 2, niveau: 'rayon', cible_niveau: 'Rayon Beta', minimum: 0.3, cible: null, statut_minimum: 'a_l_etude', statut_cible: null },
    { site: S, id: 3, niveau: 'defaut', cible_niveau: null, minimum: 0.2, cible: 0.25, statut_minimum: 'hypothese', statut_cible: 'hypothese' },
  ] });
  assert.deepStrictEqual(c.seuils.Alpha, { minimum: 0.4, cible: 0.5, statutMinimum: 'valide', statutCible: 'indicatif', seuil_id: 1 });
  assert.deepStrictEqual(c.seuilsRayon['Rayon Beta'], { minimum: 0.3, cible: null, statutMinimum: 'a_l_etude', statutCible: null, seuil_id: 2 });
  assert.deepStrictEqual(c.seuilDefaut, { minimum: 0.2, cible: 0.25, statutMinimum: 'hypothese', statutCible: 'hypothese', seuil_id: 3 });
});

ok('réglages généraux et A6 ; paramètre inconnu ignoré', () => {
  const c = A.contexteDepuisRegistres({ reglages: [
    { site: S, parametre: 'palier_ttc', valeur: '0.10' },
    { site: S, parametre: 'jours_reference', valeur: 28 },
    { site: S, parametre: 'a6_baisse_points', valeur: 0.03 },
    { site: S, parametre: 'a6_montant_minimal', valeur: '8' },
    { site: S, parametre: 'parametre_inconnu', valeur: 1 },
  ] });
  assert.deepStrictEqual(c.reglages, { palierTtc: 0.1, joursReference: 28, a6: { baissePoints: 0.03, montantMinimal: 8 } });
});

ok('dernière saisie déclarée et dernière preuve d\'un prix décidé', () => {
  const c = A.contexteDepuisRegistres({
    prixDecides: [{ site: S, id: 10, code_barres: '000111', prix_ttc: '2.40', nature: 'decide', decide_le: '2030-02-20' },
                  { site: S, id: 11, article: 'Produit Y', prix_ttc: 3, nature: 'decide', decide_le: '2030-02-21' }],
    applications: [
      { site: S, prix_decide_id: 10, evenement: 'saisie_declaree', date_effet: '2030-02-25' },
      { site: S, prix_decide_id: 10, evenement: 'saisie_declaree', date_effet: '2030-03-02' },
      { site: S, prix_decide_id: 10, evenement: 'preuve', preuve_type: 'ticket', date_effet: '2030-03-05' },
      { site: S, prix_decide_id: 10, evenement: 'preuve', preuve_type: 'releve', date_effet: '2030-03-09' },
    ],
  });
  const p = c.prixDecides.find(x => x.code_barres === '000111');
  assert.strictEqual(p.prix_ttc, 2.4);
  assert.strictEqual(p.saisie_declaree_le, '2030-03-02');
  assert.deepStrictEqual(p.preuve_application, { type: 'releve', date: '2030-03-09' });
  const q = c.prixDecides.find(x => x.article === 'Produit Y');
  assert.strictEqual(q.saisie_declaree_le, null);
  assert.strictEqual(q.preuve_application, null);
});

ok('exceptions effectives avec leur source et leurs conditions', () => {
  const c = A.contexteDepuisRegistres({ exceptions: [
    { site: S, code_barres: '000111', statut: 'validee', type: 'produit_appel', motif: 'motif fictif', source: 'registre_fictif', cond_prix_ttc: '1.95', cond_tolerance_cout: 0.05, cond_cout_reference: 1.2 },
    { site: S, article: 'Produit Y', statut: 'candidate', type: 'promotion', motif: null },
  ] });
  assert.deepStrictEqual(c.exceptions[0], { code_barres: '000111', statut: 'validee', type: 'produit_appel', motif: 'motif fictif', source: 'registre_fictif',
    conditions: { prix_ttc: 1.95, tolerance_cout: 0.05, cout_reference: 1.2 } });
  assert.strictEqual(c.exceptions[1].source, 'tarif_exceptions');
  assert.deepStrictEqual(c.exceptions[1].conditions, { prix_ttc: null, tolerance_cout: null, cout_reference: null });
});

ok('régimes et contrôles réglementaires', () => {
  const c = A.contexteDepuisRegistres({
    regimes: [{ site: S, code_barres: '000222', regime: 'a_qualifier', raison: 'raison fictive' }],
    controles: [{ site: S, portee: 'rayon', rayon: 'Rayon Gamma', etat: 'non_conforme', type_element: 'etiquetage', raison: 'raison fictive' },
                { site: S, portee: 'reference', article: 'Produit Z', etat: 'a_verifier', raison: 'autre raison fictive' }],
  });
  assert.deepStrictEqual(c.regimes, [{ code_barres: '000222', regime: 'a_qualifier', raison: 'raison fictive' }]);
  assert.deepStrictEqual(c.reglementaire, [
    { rayon: 'Rayon Gamma', etat: 'non_conforme', type_element: 'etiquetage', raison: 'raison fictive' },
    { article: 'Produit Z', etat: 'a_verifier', type_element: null, raison: 'autre raison fictive' },
  ]);
});

ok('refus de mélanger deux sites', () => {
  assert.throws(() => A.contexteDepuisRegistres({
    rattachements: [{ site: 'site-fictif-1', portee: 'rayon', rayon: 'R', famille_code: 'X' }],
    seuils: [{ site: 'site-fictif-2', id: 1, niveau: 'defaut' }],
  }), /plusieurs sites mélangés/);
});

ok('registres vides : aucun seuil, « sans seuil validé » dans le moteur', () => {
  const c = A.contexteDepuisRegistres({}, { periode });
  assert.deepStrictEqual(c.seuils, {});
  assert.deepStrictEqual(c.seuilsRayon, {});
  assert.strictEqual(c.seuilDefaut, null);
  assert.deepStrictEqual(c.exceptions, []);
  assert.deepStrictEqual(c.prixDecides, []);
  assert.strictEqual(c.periode, periode);
  const r = T.analyser([{ article: 'Produit A', categorie: 'Rayon Alpha', quantite: 10, prix_vente: 1.5, prix_achat: 1, tva: 20, code_barres: '' }], [], c);
  const l = r.lignes[0];
  assert.strictEqual(l.regle, null);
  assert.strictEqual(l.statut, 'sans_seuil_valide');
  assert.strictEqual(l.simulation.minimum, null);
});

ok('contexte adapté consommé par le moteur : seuil valide, proposition à valider', () => {
  const c = A.contexteDepuisRegistres({
    familles: [{ site: S, famille_code: 'Alpha', libelle: 'Famille Alpha' }],
    rattachements: [{ site: S, portee: 'rayon', rayon: 'Rayon Alpha', famille_code: 'Alpha' }],
    seuils: [{ site: S, id: 1, niveau: 'famille', cible_niveau: 'Alpha', minimum: 0.4, cible: 0.5, statut_minimum: 'valide', statut_cible: 'valide' }],
  }, { periode });
  const r = T.analyser([{ article: 'Produit A', categorie: 'Rayon Alpha', quantite: 10, prix_vente: 1.5, prix_achat: 1, tva: 20, code_barres: '' }], [], c);
  const l = r.lignes[0];
  assert.strictEqual(l.famille, 'Alpha');
  assert.strictEqual(l.statut, 'proposition_a_valider');
  assert.ok(l.simulation.minimum && l.simulation.minimum.taux >= 0.4 - 1e-4);
});

ok('l\'adaptateur ne modifie pas ses entrées', () => {
  const reg = { seuils: [{ site: S, id: 1, niveau: 'defaut', minimum: 0.2 }], reglages: [{ site: S, parametre: 'palier_ttc', valeur: 0.1 }] };
  const avant = JSON.stringify(reg);
  A.contexteDepuisRegistres(reg, { periode });
  assert.strictEqual(JSON.stringify(reg), avant);
});

ok('règle de régime injectée : transmise telle quelle au moteur, « libre » ramené à aucune réponse', () => {
  const regimeDe = row => row.article === 'Produit R' ? 'reglemente' : row.article === 'Produit L' ? 'libre' : null;
  const c = A.contexteDepuisRegistres({
    familles: [{ site: S, famille_code: 'Alpha', libelle: 'Famille Alpha' }],
    rattachements: [{ site: S, portee: 'rayon', rayon: 'Rayon Alpha', famille_code: 'Alpha' }],
    seuils: [{ site: S, id: 1, niveau: 'famille', cible_niveau: 'Alpha', minimum: 0.4, cible: 0.5, statut_minimum: 'valide', statut_cible: 'valide' }],
    regimes: [{ site: S, article: 'Produit K', regime: 'contractuel', raison: 'raison fictive' }],
  }, { periode, regimeDe });
  assert.strictEqual(typeof c.regimeDe, 'function');
  assert.strictEqual(c.regimeDe({ article: 'Produit R' }), 'reglemente');
  assert.strictEqual(c.regimeDe({ article: 'Produit L' }), null);
  const L = a => ({ article: a, categorie: 'Rayon Alpha', quantite: 10, prix_vente: 1.5, prix_achat: 1, tva: 20, code_barres: '' });
  const r = T.analyser([L('Produit R'), L('Produit K'), L('Produit L')], [], c);
  const par = a => r.lignes.find(l => l.article === a);
  assert.strictEqual(par('Produit R').regime, 'reglemente');
  assert.strictEqual(par('Produit R').simulation.minimum, null);
  assert.strictEqual(par('Produit K').regime, 'contractuel');
  assert.strictEqual(par('Produit K').simulation.minimum, null);
  assert.strictEqual(par('Produit L').statut, 'proposition_a_valider');
});
ok('sans règle injectée : aucune clé regimeDe dans le contexte', () => {
  assert.ok(!('regimeDe' in A.contexteDepuisRegistres({}, { periode })));
});

console.log('test_adaptateur_registres_t2 : ' + n + ' épreuves OK');
