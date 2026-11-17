// Tests du moteur de politique tarifaire T1 (lecture seule). node test_politique_tarifaire_t1_20261116.js
const assert = require('assert');
globalThis.window = globalThis;
require('./nexus-produits-mesure.js');
const T = require('./nexus-politique-tarifaire.js');
let n = 0; const ok = (nom, f) => { f(); n++; console.log('  ✓ ' + nom); };

const P = { debut: '2026-10-05', fin: '2026-11-09' };
const L = (article, o) => Object.assign({ article, code_barres: '', categorie: 'Sodas', quantite: 10, prix_vente: 2, prix_achat: 1, tva: 2.1 }, o || {});
const base = {
  periode: P,
  familles: { parRayon: { Sodas: 'Sodas', Jus: 'Jus', Glaces: 'Glaces', Vape: 'Vapotage', Pains: 'Pains' } },
  seuils: {
    Sodas: { minimum: 0.41, cible: 0.42, statutMinimum: 'valide', statutCible: 'valide' },
    Jus: { minimum: 0.41, cible: 0.49, statutMinimum: 'valide', statutCible: 'a_l_etude' },
    Glaces: { minimum: 0.40, cible: 0.42, statutMinimum: 'a_l_etude', statutCible: 'a_l_etude' },
    Hypo: { minimum: 0.39, cible: 0.48, statutMinimum: 'hypothese', statutCible: 'hypothese' },
  },
};
const stockDe = rows => rows.map(r => ({ article: r.article, pa_net_ht: r.prix_achat }));
const run = (cour, prec, ctx) => T.analyser(cour, prec, Object.assign({}, base, { stock: stockDe(cour) }, ctx || {}));
const un = (cour, prec, ctx) => run(cour, prec, ctx).lignes[0];

console.log('Arrondi au palier de 0,05 € TTC');
ok('valeurs flottantes juste sous le palier ramenées au palier', () => {
  assert.strictEqual(T.arrondiPalier(4.799999999999), 4.8);
  assert.strictEqual(T.arrondiPalier(4.8), 4.8);
  assert.strictEqual(T.arrondiPalier(4.8000000000000007), 4.8);
});
ok('toute valeur au-dessus du palier monte au palier suivant', () => {
  assert.strictEqual(T.arrondiPalier(4.801), 4.85);
  assert.strictEqual(T.arrondiPalier(0.951), 1);
  assert.strictEqual(T.arrondiPalier(4.6378), 4.65);
  assert.strictEqual(T.arrondiPalier(0.01), 0.05);
});
ok('palier réglable (0,10 €)', () => { assert.strictEqual(T.arrondiPalier(4.81, 0.10), 4.9); assert.strictEqual(T.arrondiPalier(4.9, 0.10), 4.9); });
ok('le prix arrondi atteint toujours le seuil, sur 20 000 tirages', () => {
  let x = 7;
  for (let i = 0; i < 20000; i++) {
    x = (x * 9301 + 49297) % 233280; const cout = 0.03 + (x / 233280) * 60;
    x = (x * 9301 + 49297) % 233280; const seuil = 0.2 + (x / 233280) * 0.4;
    const tva = [0, 2.1, 8.5][i % 3];
    const p = T.prixEnvisageable(cout, seuil, tva);
    assert.ok(p.taux >= seuil - 1e-4, `taux ${p.taux} < seuil ${seuil} (coût ${cout}, TVA ${tva})`);
    assert.strictEqual(Math.round(p.ttc * 100) % 5, 0, 'palier de 5 centimes');
    assert.ok(p.ttc - 0.05 < cout / (1 - seuil) * (1 + tva / 100) + 1e-9, 'pas plus d\'un palier au-dessus du prix exact');
  }
});
ok('cas réel : Royal Soda 2 L au minimum de 41 %', () => {
  const p = T.prixEnvisageable(2.67, 0.41, 2.1);
  assert.strictEqual(p.ttc, 4.65); assert.ok(p.taux >= 0.41);
});

console.log('Prix décidés : décision, saisie, cohérence, application vérifiée');
const sprite = (pv, o) => L('Sprite 2l', Object.assign({ prix_vente: pv, prix_achat: 2.68 }, o || {}));
const spriteP = L('Sprite 2l', { prix_vente: 4.11, prix_achat: 2.68 });
const dec = o => ({ prixDecides: [Object.assign({ article: 'Sprite 2l', prix_ttc: 4.80, nature: 'changement', decide_le: '2026-11-16' }, o || {})] });
ok('décidé, non saisi : état « decide », gain dans le compartiment des prix décidés', () => {
  const r = run([sprite(4.11)], [spriteP], dec());
  const l = r.lignes[0];
  assert.strictEqual(l.prixDecide.etat, 'decide'); assert.strictEqual(l.statut, 'a_surveiller');
  assert.ok(r.gains.decisionnels.prixDecides.fiable.montant > 0); assert.strictEqual(r.gains.decisionnels.minimum.fiable.references, 0, 'pas de double comptage avec le minimum');
});
ok('PV moyen égal au prix décidé : cohérence constatée, jamais « appliqué » ni « conforme »', () => {
  const l = un([sprite(4.7013)], [spriteP], dec());
  assert.strictEqual(l.prixDecide.etat, 'coherence_constatee'); assert.notStrictEqual(l.statut, 'conforme');
});
ok('preuve explicite datée : application vérifiée, conforme', () => {
  const l = un([sprite(4.7013)], [spriteP], dec({ saisie_declaree_le: '2026-10-01', preuve_application: { type: 'export_prix_decenium', date: '2026-10-02' } }));
  assert.strictEqual(l.prixDecide.etat, 'application_verifiee'); assert.strictEqual(l.statut, 'conforme');
});
ok('preuve contredite par le PV moyen d\'une période postérieure : écart constaté', () => {
  const l = un([sprite(4.11)], [spriteP], dec({ preuve_application: { type: 'ticket', date: '2026-10-01' } }));
  assert.strictEqual(l.prixDecide.etat, 'ecart_constate'); assert.strictEqual(l.statut, 'a_verifier');
});
ok('saisie déclarée après la période : saisie déclarée, aucun écart reproché', () => {
  const l = un([sprite(4.11)], [spriteP], dec({ saisie_declaree_le: '2026-11-20' }));
  assert.strictEqual(l.prixDecide.etat, 'saisie_declaree'); assert.ok(!l.alertes.some(a => a.code === 'A5'));
});
ok('saisie déclarée avant la période, PV inchangé : écart constaté', () => {
  const l = un([sprite(4.11)], [spriteP], dec({ saisie_declaree_le: '2026-10-01' }));
  assert.strictEqual(l.prixDecide.etat, 'ecart_constate'); assert.ok(l.alertes.some(a => a.code === 'A5'));
});

console.log('Périodes chevauchant un changement de tarif');
const glace = (pv) => L('Glacons Vito 5 kg', { categorie: 'Glacons', prix_vente: pv, prix_achat: 2.51 });
const glaceP = L('Glacons Vito 5 kg', { categorie: 'Glacons', prix_vente: 3.72, prix_achat: 2.5 });
ok('saisie déclarée en cours de période : période chevauchante et part estimée', () => {
  const l = un([glace(3.77)], [glaceP], { prixDecides: [{ article: 'Glacons Vito 5 kg', prix_ttc: 4.00, nature: 'changement', saisie_declaree_le: '2026-10-31' }] });
  assert.strictEqual(l.prixDecide.etat, 'saisie_declaree'); assert.strictEqual(l.prixDecide.periodeChevauchante, true);
  assert.ok(Math.abs(l.prixDecide.partEstimee - 0.25) <= 0.01, 'part ' + l.prixDecide.partEstimee);
  assert.notStrictEqual(l.prixDecide.etat, 'application_verifiee');
});
ok('prix déclaré en vigueur, PV entre ancien et nouveau prix, sans date : changement probable, A5, pas d\'A7 de prix', () => {
  const ctx = { prixDecides: [{ article: 'Glacons Vito 5 kg', prix_ttc: 4.00, nature: 'en_vigueur' }],
    exceptions: [{ article: 'Glacons Vito 5 kg', statut: 'validee', type: 'concurrence_directe', conditions: { prix_ttc: 4.00 } }] };
  const l = un([glace(3.77)], [glaceP], ctx);
  assert.strictEqual(l.prixDecide.changementProbableEnCours, true); assert.strictEqual(l.prixDecide.etat, 'decide');
  assert.ok(l.alertes.some(a => a.code === 'A5' && a.donnees.constats.some(c => /changement probable/.test(c))));
  assert.ok(!l.alertes.some(a => a.code === 'A7' && a.donnees.constats.some(c => /PV moyen/.test(c))));
});
ok('prix en vigueur non retrouvé (Floup) : écart constaté et A7 sur l\'exception', () => {
  const f = L('Glace floup -20P', { categorie: 'Glaces', quantite: 1063, prix_vente: 0.79, prix_achat: 0.53 });
  const fP = L('Glace floup -20P', { categorie: 'Glaces', quantite: 482, prix_vente: 0.93, prix_achat: 0.53 });
  const l = un([f], [fP], { prixDecides: [{ article: 'Glace floup -20P', prix_ttc: 0.95, nature: 'en_vigueur' }],
    exceptions: [{ article: 'Glace floup -20P', statut: 'validee', type: 'produit_appel', conditions: { prix_ttc: 0.95 } }] });
  assert.strictEqual(l.prixDecide.etat, 'ecart_constate'); assert.ok(l.alertes.some(a => a.code === 'A7'));
  assert.strictEqual(l.fiabilite.niveau, 'fiable', 'l\'écart de prix ne dégrade pas la fiabilité comptable');
});

console.log('Références sans historique');
ok('sans période précédente : pas d\'erreur, pas d\'A1, fiabilité à confirmer, variations nulles', () => {
  const l = un([L('Nouveau soda', { prix_vente: 2, prix_achat: 1.5 })], []);
  assert.strictEqual(l.historique, false); assert.strictEqual(l.variationCout, null); assert.strictEqual(l.tauxPrecedent, null);
  assert.ok(!l.alertes.some(a => a.code === 'A1' || a.code === 'A6'));
  assert.strictEqual(l.fiabilite.niveau, 'a_confirmer'); assert.ok(l.fiabilite.raisons.includes('sans historique sur la période précédente'));
  assert.strictEqual(l.statut, 'proposition_a_valider', 'sous le minimum validé, une proposition reste possible');
});
ok('sans historique ni stock : coût non contrôlé, A5', () => {
  const r = T.analyser([L('Nouveau soda', { prix_vente: 2, prix_achat: 1 })], [], base);
  assert.ok(r.lignes[0].alertes.some(a => a.code === 'A5' && a.donnees.constats.includes('référence absente du relevé de stock')));
});

console.log('Coût : provenance et méthode, pas de PMP présumé');
ok('le coût garde son libellé « PA HT » et une méthode non établie par défaut', () => {
  const r = run([L('A')], []);
  assert.strictEqual(r.lignes[0].cout.libelle, 'PA HT'); assert.ok(/non établie/.test(r.lignes[0].cout.methode));
  assert.strictEqual(r.synthese.cout.methodeEtablie, false);
  assert.ok(!JSON.stringify(r).toLowerCase().includes('pmp_'), 'aucun champ nommé PMP');
});
ok('une méthode prouvée est reprise telle quelle', () => {
  const r = run([L('A')], [], { cout: { methode: 'PMP (confirmé par l\'éditeur, 20/11/2026)' } });
  assert.strictEqual(r.lignes[0].cout.methode, 'PMP (confirmé par l\'éditeur, 20/11/2026)'); assert.strictEqual(r.synthese.cout.methodeEtablie, true);
});

console.log('Gains séparés, sans double comptage');
ok('chaque référence dans un seul compartiment par scénario ; scénarios non additionnables', () => {
  const cour = [L('F', { prix_vente: 2, prix_achat: 1.4 }), L('C', { prix_vente: 2, prix_achat: 1.4, quantite: 2 }), L('I', { prix_vente: 2, prix_achat: 1.4, tva: 0 }), sprite(4.11)];
  const prec = [L('F', { prix_vente: 2, prix_achat: 1.4 }), L('C', { prix_vente: 2, prix_achat: 1.4 }), L('I', { prix_vente: 2, prix_achat: 1.4, tva: 2.1 }), spriteP];
  const r = run(cour, prec, dec());
  const niv = Object.fromEntries(r.lignes.map(l => [l.article, l.fiabilite.niveau]));
  assert.deepStrictEqual(niv, { F: 'fiable', C: 'a_confirmer', I: 'insuffisante', 'Sprite 2l': 'fiable' });
  for (const [sc, cle] of [['prixDecides', 'prixDecide'], ['minimum', 'minimum'], ['cible', 'cible']]) {
    const total = r.gains.decisionnels[sc].fiable.references + r.gains.decisionnels[sc].a_confirmer.references + r.gains.preuvesTechniques[sc].references;
    assert.strictEqual(total, r.lignes.filter(l => l.simulation[cle]).length, sc);
  }
  const D = r.gains.decisionnels;
  assert.strictEqual(D.minimum.fiable.references, 1); assert.strictEqual(D.minimum.a_confirmer.references, 1);
  assert.strictEqual(D.minimum.insuffisante, undefined, 'aucune case insuffisante dans les gains décisionnels');
  assert.strictEqual(r.gains.preuvesTechniques.minimum.references, 1, 'la référence insuffisante va en preuve technique');
  assert.strictEqual(r.lignes[2].simulation.minimum.decisionnel, false); assert.strictEqual(r.lignes[2].simulation.minimum.usage, 'preuve technique');
  assert.strictEqual(D.prixDecides.fiable.references, 1); assert.strictEqual(r.lignes[3].simulation.minimum, null, 'prix décidé : pas de simulation au minimum');
  assert.strictEqual(r.gains.additionnables, false); assert.deepStrictEqual(r.gains.alternatives, ['minimum', 'cible']);
  const somme = r.lignes.filter(l => l.fiabilite.niveau === 'fiable' && l.simulation.minimum).reduce((s, l) => s + l.simulation.minimum.gain, 0);
  assert.ok(Math.abs(somme - D.minimum.fiable.montant) < 0.01);
});

console.log('Conformité réglementaire, axe indépendant');
ok('chiffres fiables et contrôle ouvert : fiable, à vérifier, sans simulation, A8', () => {
  const v = L('WPUFF STARTER', { categorie: 'Vape', prix_vente: 25.81, prix_achat: 13.7, tva: 8.5 });
  const r = run([v], [v], { seuils: Object.assign({}, base.seuils, { Vapotage: { minimum: 0.5, statutMinimum: 'valide' } }), reglementaire: [{ rayon: 'Vape', etat: 'controle_ouvert', type_element: 'dispositif complet' }] });
  const l = r.lignes[0];
  assert.strictEqual(l.fiabilite.niveau, 'fiable'); assert.strictEqual(l.conformite.etat, 'controle_ouvert');
  assert.strictEqual(l.statut, 'a_verifier'); assert.strictEqual(l.simulation.minimum, null); assert.strictEqual(l.simulation.exclusion, 'contrôle réglementaire ouvert');
  assert.ok(l.alertes.some(a => a.code === 'A8')); assert.ok(!l.fiabilite.raisons.some(x => /réglement/.test(x)));
  assert.strictEqual(r.synthese.exclusReglementaire.references, 1);
});
ok('contrôle clos conforme : la référence retrouve le circuit normal', () => {
  const v = L('WPUFF STARTER', { categorie: 'Vape', prix_vente: 25.81, prix_achat: 13.7, tva: 8.5 });
  const l = un([v], [v], { seuils: Object.assign({}, base.seuils, { Vapotage: { minimum: 0.5, statutMinimum: 'valide' } }), reglementaire: [{ rayon: 'Vape', etat: 'conforme' }] });
  assert.strictEqual(l.statut, 'proposition_a_valider'); assert.ok(l.simulation.minimum);
});

console.log('« Conforme » seulement avec une règle validée');
ok('seuils à l\'étude : sans seuil validé, même très au-dessus', () => {
  const g = L('Magnum', { categorie: 'Glaces', prix_vente: 3, prix_achat: 1 });
  const l = un([g], [g]); assert.strictEqual(l.statut, 'sans_seuil_valide'); assert.strictEqual(l.simulation.minimum, null);
});
ok('hypothèse statistique : sans seuil validé, aucune simulation', () => {
  const s = L('Schweppes', { categorie: 'Autres', prix_vente: 2, prix_achat: 1.5 });
  const l = un([s], [s], { familles: { parRayon: { Autres: 'Hypo' } } });
  assert.strictEqual(l.statut, 'sans_seuil_valide'); assert.strictEqual(l.simulation.minimum, null);
});
ok('famille sans seuil : sans seuil validé', () => {
  const p = L('Croissant', { categorie: 'Pains', prix_vente: 1.1, prix_achat: 0.54 });
  assert.strictEqual(un([p], [p]).statut, 'sans_seuil_valide');
});
ok('minimum validé, cible à l\'étude : conforme au-dessus du minimum', () => {
  const j = L('Jus', { categorie: 'Jus', prix_vente: 2, prix_achat: 1.1 });
  const l = un([j], [j]); assert.strictEqual(l.statut, 'conforme'); assert.strictEqual(l.simulation.cible, null, 'cible non validée : pas de scénario cible');
});
ok('aucune ligne n\'est conforme sans règle validée, sur un lot mélangé', () => {
  const cour = [L('a', { categorie: 'Glaces' }), L('b', { categorie: 'Pains' }), L('c', { categorie: 'Inconnu' }), L('d', { categorie: 'Sodas' })];
  const r = run(cour, cour);
  for (const l of r.lignes) if (l.statut === 'conforme') assert.ok(l.regle && l.regle.valide, l.article);
});

console.log('Exceptions commerciales toujours contrôlées');
const exc = a => ({ exceptions: [{ article: a, statut: 'validee', type: 'produit_appel', motif: 'prix accessible' }] });
ok('marge négative sur une exception : A3, statut à vérifier', () => {
  const x = L('Menthe', { prix_vente: 0.09, prix_achat: 0.1, quantite: 100, tva: 8.5 });
  const l = un([x], [x], exc('Menthe'));
  assert.ok(l.alertes.some(a => a.code === 'A3')); assert.strictEqual(l.statut, 'a_verifier'); assert.strictEqual(l.simulation.minimum, null);
});
ok('coût anormal sur une exception : A4 (et A7 coût hors tolérance)', () => {
  const x = L('Pack', { prix_vente: 6.37, prix_achat: 6 }), xp = L('Pack', { prix_vente: 6.37, prix_achat: 3.98 });
  const l = run([x], [xp], Object.assign(exc('Pack'), { stock: [{ article: 'Pack', pa_net_ht: 3.98 }] })).lignes[0];
  assert.ok(l.alertes.some(a => a.code === 'A4')); assert.ok(l.alertes.some(a => a.code === 'A7'));
});
ok('TVA incohérente sur une exception : A5', () => {
  const x = L('Pack', { tva: 0 }), xp = L('Pack', { tva: 2.1 }), autre = L('Autre');
  const l = run([x, autre], [xp, autre], exc('Pack')).lignes[0];
  assert.ok(l.alertes.some(a => a.code === 'A5' && a.donnees.constats.some(c => /TVA/.test(c))));
});
ok('contrôle réglementaire sur une exception : A8', () => {
  const x = L('Puff', { categorie: 'Vape' });
  const l = un([x], [x], Object.assign(exc('Puff'), { reglementaire: [{ article: 'Puff', etat: 'controle_ouvert' }] }));
  assert.ok(l.alertes.some(a => a.code === 'A8')); assert.strictEqual(l.statut, 'a_verifier');
});
ok('exception candidate : aucun effet, la proposition reste et le signale', () => {
  const x = L('Menthise', { prix_vente: 0.18, prix_achat: 0.11, quantite: 177, tva: 8.5 });
  const l = un([x], [x], { exceptions: [{ article: 'Menthise', statut: 'candidate' }] });
  assert.ok(l.simulation.minimum); assert.ok(l.alertes.some(a => a.code === 'A2' && a.donnees.exceptionCandidate === true));
});
ok('exception validée : jamais de prix envisageable', () => {
  const x = L('Bavaria', { prix_vente: 3.32, prix_achat: 2.2 });
  const l = un([x], [x], exc('Bavaria')); assert.strictEqual(l.simulation.minimum, null); assert.strictEqual(l.statut, 'a_surveiller');
});

console.log('Alertes de base');
ok('A1 hausse de coût non répercutée', () => {
  const l = un([L('X', { prix_achat: 1.1 })], [L('X', { prix_achat: 1 })]);
  const a = l.alertes.find(x => x.code === 'A1'); assert.ok(a); assert.strictEqual(a.consequence.montant, 1);
});
ok('A4 variation suspecte : fiabilité insuffisante, gain isolé', () => {
  const r = run([L('X', { prix_vente: 3, prix_achat: 2 })], [L('X', { prix_vente: 3, prix_achat: 1 })]);
  assert.strictEqual(r.lignes[0].fiabilite.niveau, 'insuffisante'); assert.ok(r.lignes[0].alertes.some(a => a.code === 'A4'));
  assert.strictEqual(r.gains.decisionnels.minimum.fiable.references, 0); assert.strictEqual(r.gains.preuvesTechniques.minimum.references, 1);
});
ok('ramener à 30 jours', () => { assert.strictEqual(T.ramener(36, 36), 30); assert.strictEqual(T.ramener(null, 36), null); });

console.log('Seuils validés, indicatifs et hypothèses');
const baseInd = { familles: { parRayon: { Bieres: 'Bières' } }, seuils: { 'Bières': { minimum: 0.47, cible: 0.50, statutMinimum: 'indicatif', statutCible: 'indicatif' } } };
ok('sous un seuil indicatif : à surveiller, aucune proposition, aucun A2, repère non décisionnel', () => {
  const b = L('Biere', { categorie: 'Bieres', prix_vente: 2, prix_achat: 1.2, tva: 8.5 });
  const r = run([b], [b], baseInd); const l = r.lignes[0];
  assert.strictEqual(l.statut, 'a_surveiller'); assert.ok(/indicatif/.test(l.raisonStatut));
  assert.strictEqual(l.simulation.minimum, null); assert.ok(!l.alertes.some(a => a.code === 'A2'));
  assert.ok(l.simulation.repereMinimum && l.simulation.repereMinimum.decisionnel === false);
  assert.strictEqual(r.gains.decisionnels.minimum.fiable.references, 0); assert.strictEqual(r.gains.reperesIndicatifs.minimum.fiable.references, 1);
  assert.strictEqual(r.gains.reperesIndicatifs.decisionnel, false); assert.strictEqual(l.regle.nature, 'indicative');
});
ok('au-dessus d\'un seuil indicatif : sans seuil validé, jamais conforme', () => {
  const b = L('Biere', { categorie: 'Bieres', prix_vente: 3, prix_achat: 1.2, tva: 8.5 });
  const l = un([b], [b], baseInd); assert.strictEqual(l.statut, 'sans_seuil_valide');
});
ok('minimum indicatif et cible à l\'étude : aucune proposition', () => {
  const j = L('Jus', { categorie: 'Jus', prix_vente: 2, prix_achat: 1.5 });
  const l = un([j], [j], { seuils: Object.assign({}, base.seuils, { Jus: { minimum: 0.41, cible: 0.49, statutMinimum: 'indicatif', statutCible: 'a_l_etude' } }) });
  assert.strictEqual(l.statut, 'a_surveiller'); assert.strictEqual(l.simulation.minimum, null); assert.strictEqual(l.simulation.repereCible, null, 'cible à l\'étude : pas même un repère');
});
ok('seuil validé : proposition décisionnelle et A2', () => {
  const b = L('Biere', { categorie: 'Bieres', prix_vente: 2, prix_achat: 1.2, tva: 8.5 });
  const l = un([b], [b], { familles: baseInd.familles, seuils: { 'Bières': { minimum: 0.47, cible: 0.50, statutMinimum: 'valide', statutCible: 'valide' } } });
  assert.strictEqual(l.statut, 'proposition_a_valider'); assert.ok(l.simulation.minimum); assert.ok(l.alertes.some(a => a.code === 'A2'));
});

console.log('Régime de prix déclaré, jamais déduit');
ok('régime « à qualifier » déclaré : aucune simulation, aucun conforme', () => {
  const f = L('Feuille de Tabac FINE LEAF 15g', { categorie: 'Sodas', prix_vente: 5, prix_achat: 4, tva: 8.5 });
  const l = un([f], [f], { regimes: [{ article: 'Feuille de Tabac FINE LEAF 15g', regime: 'a_qualifier', raison: 'régime non établi' }] });
  assert.strictEqual(l.simulation.minimum, null); assert.ok(/non établi ou non libre/.test(l.simulation.exclusion));
  assert.strictEqual(l.statut, 'sans_seuil_valide'); assert.deepStrictEqual(l.regimeDeclare, { regime: 'a_qualifier', raison: 'régime non établi' });
});
ok('sans déclaration, le libellé ne change pas le régime', () => {
  const f = L('Feuille de Tabac FINE LEAF 15g', { prix_vente: 5, prix_achat: 4 });
  assert.strictEqual(un([f], [f]).regime, 'libre');
});

console.log('Matérialité de l\'alerte A6');
const appel = { exceptions: [{ article: 'Bavaria', statut: 'validee', type: 'produit_appel' }] };
const bav = (pa, q) => L('Bavaria', { prix_vente: 3.32, prix_achat: pa, quantite: q || 97, tva: 8.5 });
ok('baisse d\'un centime de marge unitaire : pas d\'A6', () => {
  const l = un([bav(1.67)], [bav(1.66)], appel); assert.ok(!l.alertes.some(a => a.code === 'A6'));
});
ok('forte baisse de taux (Floup) : A6 avec montant et déclencheur', () => {
  const f = L('Floup', { prix_vente: 0.79, prix_achat: 0.53, quantite: 1063 }), fp = L('Floup', { prix_vente: 0.93, prix_achat: 0.53, quantite: 482 });
  const l = un([f], [fp], { exceptions: [{ article: 'Floup', statut: 'validee' }] });
  const a = l.alertes.find(x => x.code === 'A6'); assert.ok(a); assert.strictEqual(a.donnees.declencheur, 'baisse du taux'); assert.ok(a.consequence.montant > 80);
});
ok('baisse de taux de 3 points : A6 par le taux', () => {
  const l = un([bav(1.76)], [bav(1.66)], appel); const a = l.alertes.find(x => x.code === 'A6');
  assert.ok(a); assert.strictEqual(a.donnees.declencheur, 'baisse du taux'); assert.ok(a.consequence.montant >= 5);
});
ok('baisse de marge unitaire matérielle sous 2 points de taux (0,06 €, 6 %) : A6 par la marge', () => {
  const l = un([bav(2.38)], [bav(2.32)], appel); const a = l.alertes.find(x => x.code === 'A6');
  assert.ok(a); assert.strictEqual(a.donnees.declencheur, 'baisse de marge unitaire'); assert.strictEqual(a.consequence.montant, 5.82);
});
ok('baisse réelle mais sous le montant minimal : pas d\'A6', () => {
  const l = un([bav(1.76, 20)], [bav(1.66, 20)], appel); assert.ok(!l.alertes.some(a => a.code === 'A6'), '0,10 € × 20 = 2 € < 5 €');
});
ok('seuils A6 réglables par site', () => {
  const l = un([bav(1.67)], [bav(1.66)], Object.assign({ reglages: { a6: { baisseMargeUnitaireEuros: 0.01, baisseMargeUnitaireRelative: 0, montantMinimal: 0.5 } } }, appel));
  assert.ok(l.alertes.some(a => a.code === 'A6'));
});

console.log(`\n${n} tests réussis`);
