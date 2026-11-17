// Épreuves du moteur de politique tarifaire (T1 v2, branché sur les registres T2).
// Données ENTIÈREMENT fictives : produits, prix, quantités et rayons inventés. Aucun article ni prix réel de station.
const assert = require('assert');
const T = require('./nexus-politique-tarifaire.js');

let n = 0;
const ok = (nomEpreuve, f) => { f(); n++; };
const periode = { debut: '2030-03-01', fin: '2030-03-30' };
// Ligne de ventes fictive : prix de vente et d'achat HT, TVA 20 %, 10 unités.
const L = (article, o = {}) => ({ article, categorie: 'Rayon Alpha', quantite: 10, prix_vente: 2, prix_achat: 1, tva: 20, code_barres: '', ...o });
const seuilValide = { Alpha: { minimum: 0.4, cible: 0.5, statutMinimum: 'valide', statutCible: 'valide' } };
const ctxBase = (o = {}) => ({ periode, familles: { parRayon: { 'Rayon Alpha': 'Alpha' }, parReference: [], parMotif: [] }, seuils: seuilValide, ...o });
const un = (res, article) => res.lignes.find(l => l.article === article);

// ---- Palier TTC et arrondi
ok('palier 0,05 par défaut, arrondi toujours au palier supérieur', () => {
  assert.strictEqual(T.REGLAGES_DEFAUT.palierTtc, 0.05);
  assert.strictEqual(T.arrondiPalier(1.01), 1.05);
  assert.strictEqual(T.arrondiPalier(1.05), 1.05);
  assert.strictEqual(T.arrondiPalier(1.0500000001), 1.05);
  assert.strictEqual(T.arrondiPalier(1.06), 1.10);
  assert.strictEqual(T.arrondiPalier(null), null);
});
ok('palier réglable', () => {
  assert.strictEqual(T.arrondiPalier(1.01, 0.10), 1.10);
  assert.strictEqual(T.arrondiPalier(1.01, 0.01), 1.01);
  assert.strictEqual(T.arrondiPalier(1.011, 0.01), 1.02);
});
ok('le prix envisageable atteint toujours le seuil', () => {
  for (const cout of [0.37, 0.8, 1.13, 2.49, 7.77]) for (const seuil of [0.2, 0.35, 0.5]) for (const tva of [0, 5.5, 20]) {
    const x = T.prixEnvisageable(cout, seuil, tva, 0.05);
    assert.ok(x.taux >= seuil - 1e-4, `cout ${cout} seuil ${seuil} tva ${tva} taux ${x.taux}`);
    assert.strictEqual(Math.round(x.ttc * 100) % 5, 0);
  }
  assert.strictEqual(T.prixEnvisageable(1, 1, 20, 0.05), null);
  assert.strictEqual(T.prixEnvisageable(null, 0.4, 20, 0.05), null);
});

// ---- Libellé et méthode du coût
ok('libellé « PA HT » et méthode non établie par défaut', () => {
  const r = T.analyser([L('Produit A')], [], ctxBase());
  const c = r.lignes[0].cout;
  assert.strictEqual(c.libelle, 'PA HT');
  assert.ok(/non établie/.test(c.methode));
  assert.strictEqual(r.synthese.cout.methodeEtablie, false);
  assert.ok(!/PMP$/.test(c.libelle));
});
ok('une méthode fournie est conservée avec sa provenance', () => {
  const r = T.analyser([L('Produit A')], [], ctxBase({ cout: { methode: 'dernier prix d\'achat', provenance: 'fichier fictif' } }));
  assert.strictEqual(r.lignes[0].cout.methode, 'dernier prix d\'achat');
  assert.strictEqual(r.synthese.cout.methodeEtablie, true);
});

// ---- Seuils : seul « valide » décide
ok('seuil valide : sous le minimum, proposition à valider avec prix envisageable', () => {
  const r = T.analyser([L('Produit A', { prix_vente: 1.5, prix_achat: 1 })], [], ctxBase());
  const l = r.lignes[0];
  assert.strictEqual(l.statut, 'proposition_a_valider');
  assert.ok(l.simulation.minimum && l.simulation.minimum.taux >= 0.4 - 1e-4);
  assert.ok(l.alertes.some(a => a.code === 'A2'));
});
ok('seuil valide : au-dessus de la cible, conforme', () => {
  const r = T.analyser([L('Produit A', { prix_vente: 4, prix_achat: 1 })], [L('Produit A', { prix_vente: 4, prix_achat: 1 })], ctxBase({ stock: [{ article: 'Produit A', pa_net_ht: 1 }] }));
  assert.strictEqual(r.lignes[0].statut, 'conforme');
});
ok('seuils indicatif, à l\'étude, hypothèse : jamais décisionnels, jamais « conforme »', () => {
  for (const st of ['indicatif', 'a_l_etude', 'hypothese']) {
    const r = T.analyser([L('Produit A', { prix_vente: 4, prix_achat: 1 }), L('Produit B', { prix_vente: 1.5, prix_achat: 1 })], [],
      ctxBase({ seuils: { Alpha: { minimum: 0.4, cible: 0.5, statutMinimum: st, statutCible: st } } }));
    for (const l of r.lignes) {
      assert.notStrictEqual(l.statut, 'conforme', st);
      assert.notStrictEqual(l.statut, 'proposition_a_valider', st);
      assert.strictEqual(l.regle.valide, false);
      assert.strictEqual(l.simulation.minimum, null);
      assert.strictEqual(l.simulation.cible, null);
    }
    assert.strictEqual(r.gains.decisionnels.minimum.fiable.references + r.gains.decisionnels.minimum.a_confirmer.references, 0);
  }
});
ok('seuil indicatif : repère non décisionnel, sous le repère à surveiller', () => {
  const r = T.analyser([L('Produit B', { prix_vente: 1.5, prix_achat: 1 })], [],
    ctxBase({ seuils: { Alpha: { minimum: 0.4, cible: 0.5, statutMinimum: 'indicatif', statutCible: 'indicatif' } } }));
  const l = r.lignes[0];
  assert.strictEqual(l.statut, 'a_surveiller');
  assert.ok(l.simulation.repereMinimum && l.simulation.repereMinimum.decisionnel === false);
  assert.strictEqual(r.gains.reperesIndicatifs.decisionnel, false);
});
ok('« sans seuil validé » au lieu de « conforme » en l\'absence de seuil', () => {
  const r = T.analyser([L('Produit A', { prix_vente: 4, prix_achat: 1 })], [], ctxBase({ seuils: {} }));
  assert.strictEqual(r.lignes[0].statut, 'sans_seuil_valide');
  assert.strictEqual(r.lignes[0].regle, null);
});
ok('priorité famille, rayon, défaut', () => {
  const ctx = ctxBase({ seuils: { Alpha: { minimum: 0.4, statutMinimum: 'valide' } }, seuilsRayon: { 'Rayon Alpha': { minimum: 0.3, statutMinimum: 'valide' } }, seuilDefaut: { minimum: 0.2, statutMinimum: 'valide' } });
  assert.strictEqual(T.analyser([L('P')], [], ctx).lignes[0].regle.niveau, 'famille');
  const sansFamille = { ...ctx, familles: { parRayon: {}, parReference: [], parMotif: [] } };
  assert.strictEqual(T.analyser([L('P')], [], sansFamille).lignes[0].regle.niveau, 'rayon');
  const sansRayon = { ...sansFamille, seuilsRayon: {} };
  assert.strictEqual(T.analyser([L('P')], [], sansRayon).lignes[0].regle.niveau, 'defaut');
});
ok('rattachement par référence prioritaire sur le rayon, sans expression régulière', () => {
  const ctx = ctxBase({ familles: { parRayon: { 'Rayon Alpha': 'Alpha' }, parReference: [{ code_barres: '9990000000017', famille: 'Beta', motif: 'fictif' }], parMotif: [] },
    seuils: { ...seuilValide, Beta: { minimum: 0.6, statutMinimum: 'valide' } } });
  const r = T.analyser([L('Produit A', { code_barres: '9990000000017' }), L('Produit B')], [], ctx);
  assert.strictEqual(un(r, 'Produit A').famille, 'Beta');
  assert.strictEqual(un(r, 'Produit A').sourceFamille, 'reference');
  assert.strictEqual(un(r, 'Produit B').famille, 'Alpha');
  assert.strictEqual(un(r, 'Produit B').sourceFamille, 'rayon');
});

// ---- Références sans historique
ok('référence sans période précédente ni historique', () => {
  const r = T.analyser([L('Produit A')], [], ctxBase());
  const l = r.lignes[0];
  assert.strictEqual(l.historique, false);
  assert.strictEqual(l.variationCout, null);
  assert.strictEqual(l.tauxPrecedent, null);
  assert.ok(l.fiabilite.raisons.some(x => /sans historique/.test(x)));
});
ok('référence avec historique', () => {
  const r = T.analyser([L('Produit A')], [L('Produit A', { prix_achat: 0.95 })], ctxBase());
  assert.strictEqual(r.lignes[0].historique, true);
  assert.ok(r.lignes[0].variationCout > 0);
});

// ---- Prix décidés et états d'application
const pdBase = { article: 'Produit A', prix_ttc: 3.6, nature: 'changement', decide_le: '2030-02-20' };
const avecPd = (pd, ligne = {}, prec = []) => T.analyser([L('Produit A', { prix_vente: 3, prix_achat: 1, ...ligne })], prec, ctxBase({ prixDecides: [pd] })).lignes[0];
ok('prix décidé sans autre information : décidé', () => {
  const l = avecPd({ ...pdBase, prix_ttc: 4.8 });
  assert.strictEqual(l.prixDecide.etat, 'decide');
});
ok('saisie déclarée avant la période, PV cohérent : cohérence constatée, pas vérifiée', () => {
  const l = avecPd({ ...pdBase, saisie_declaree_le: '2030-02-25' });
  assert.strictEqual(l.prixDecide.etat, 'coherence_constatee');
  assert.notStrictEqual(l.prixDecide.etat, 'application_verifiee');
});
ok('saisie déclarée pendant la période : saisie déclarée, période chevauchante', () => {
  const l = avecPd({ ...pdBase, saisie_declaree_le: '2030-03-15' });
  assert.strictEqual(l.prixDecide.etat, 'saisie_declaree');
  assert.strictEqual(l.prixDecide.periodeChevauchante, true);
});
ok('saisie déclarée après la période : saisie déclarée', () => {
  const l = avecPd({ ...pdBase, saisie_declaree_le: '2030-04-02' });
  assert.strictEqual(l.prixDecide.etat, 'saisie_declaree');
  assert.strictEqual(l.prixDecide.periodeChevauchante, false);
});
ok('application vérifiée seulement avec preuve datée', () => {
  const l = avecPd({ ...pdBase, preuve_application: { type: 'ticket', date: '2030-03-10' } });
  assert.strictEqual(l.prixDecide.etat, 'application_verifiee');
  assert.strictEqual(l.statut, 'conforme');
  const sansType = avecPd({ ...pdBase, preuve_application: { date: '2030-03-10' } });
  assert.notStrictEqual(sansType.prixDecide.etat, 'application_verifiee');
  const sansDate = avecPd({ ...pdBase, preuve_application: { type: 'ticket' } });
  assert.notStrictEqual(sansDate.prixDecide.etat, 'application_verifiee');
  const apresPeriode = avecPd({ ...pdBase, preuve_application: { type: 'ticket', date: '2030-04-05' } });
  assert.notStrictEqual(apresPeriode.prixDecide.etat, 'application_verifiee');
});
ok('preuve contredite par le PV moyen : écart constaté', () => {
  const l = avecPd({ ...pdBase, prix_ttc: 4.8, preuve_application: { type: 'releve', date: '2030-02-28' } });
  assert.strictEqual(l.prixDecide.etat, 'ecart_constate');
  assert.strictEqual(l.statut, 'a_verifier');
});
ok('écart constaté : prix déclaré en vigueur non retrouvé, alerte A5', () => {
  const l = avecPd({ ...pdBase, prix_ttc: 4.8, nature: 'en_vigueur', saisie_declaree_le: '2030-02-25' });
  assert.strictEqual(l.prixDecide.etat, 'ecart_constate');
  assert.ok(l.alertes.some(a => a.code === 'A5'));
});
ok('prix maintenu : aucune simulation', () => {
  const l = avecPd({ ...pdBase, nature: 'maintenu' });
  assert.strictEqual(l.prixDecide.etat, 'maintenu');
  assert.strictEqual(l.simulation.prixDecide, null);
});
ok('prix décidé : simulation au prix décidé', () => {
  const l = avecPd({ ...pdBase, prix_ttc: 4.8 });
  assert.strictEqual(l.simulation.prixDecide.ttc, 4.8);
  assert.strictEqual(l.simulation.prixDecide.ht, 4);
  assert.strictEqual(l.simulation.prixDecide.gain, 10);
});
ok('changement probable en cours de période : PV entre ancien et nouveau prix', () => {
  const l = avecPd({ ...pdBase, prix_ttc: 4.8, saisie_declaree_le: '2030-02-25' }, { prix_vente: 3.5 }, [L('Produit A', { prix_vente: 3, prix_achat: 1 })]);
  assert.strictEqual(l.prixDecide.changementProbableEnCours, true);
  assert.ok(l.prixDecide.partEstimee > 0 && l.prixDecide.partEstimee < 1);
  assert.ok(l.alertes.some(a => a.code === 'A5'));
});

// ---- Un seul compartiment de gains par référence, scénarios non additifs
ok('une seule case de gain par référence, selon sa fiabilité', () => {
  const lignes = [L('Produit A', { prix_vente: 1.5, prix_achat: 1 }), L('Produit B', { prix_vente: 1.5, prix_achat: 1.4, quantite: 1 }), L('Produit C', { prix_vente: 1.5, prix_achat: 0 })];
  const ctx = ctxBase({ stock: [{ article: 'Produit A', pa_net_ht: 1 }] });
  const r = T.analyser(lignes, [L('Produit A'), L('Produit B'), L('Produit C')], ctx);
  const comptes = k => ['fiable', 'a_confirmer'].reduce((s, c) => s + r.gains.decisionnels[k][c].references, 0) + r.gains.preuvesTechniques[k].references;
  const total = r.lignes.filter(l => l.simulation.minimum && l.simulation.minimum.gain !== null).length;
  assert.strictEqual(comptes('minimum'), total);
  assert.strictEqual(r.gains.additionnables, false);
  assert.deepStrictEqual(r.gains.alternatives, ['minimum', 'cible']);
  assert.strictEqual(un(r, 'Produit A').fiabilite.niveau, 'fiable');
  assert.strictEqual(un(r, 'Produit C').fiabilite.niveau, 'insuffisante');
  assert.ok(r.gains.preuvesTechniques.usage.includes('jamais'));
});
ok('référence insuffisante : simulation en preuve technique, non décisionnelle', () => {
  const r = T.analyser([L('Produit C', { prix_vente: 1.5, prix_achat: 1.45 })], [], ctxBase({ stock: [{ article: 'Produit C', pa_net_ht: 1 }] }));
  const l = r.lignes[0];
  assert.strictEqual(l.fiabilite.niveau, 'insuffisante');
  assert.strictEqual(l.simulation.minimum.decisionnel, false);
  assert.strictEqual(l.simulation.minimum.usage, 'preuve technique');
  assert.strictEqual(l.statut, 'a_verifier');
});

// ---- Contrôle réglementaire indépendant de la fiabilité
ok('contrôle réglementaire ouvert : A8, simulation exclue, statut à vérifier, fiabilité intacte', () => {
  const r = T.analyser([L('Produit A', { prix_vente: 4, prix_achat: 1 })], [L('Produit A')],
    ctxBase({ stock: [{ article: 'Produit A', pa_net_ht: 1 }], reglementaire: [{ article: 'Produit A', etat: 'controle_ouvert', type_element: 'fictif', raison: 'raison fictive' }] }));
  const l = r.lignes[0];
  assert.strictEqual(l.fiabilite.niveau, 'fiable');
  assert.strictEqual(l.conformite.etat, 'controle_ouvert');
  assert.strictEqual(l.statut, 'a_verifier');
  assert.ok(l.alertes.some(a => a.code === 'A8'));
  assert.strictEqual(l.simulation.exclusion, 'contrôle réglementaire ouvert');
  assert.strictEqual(r.synthese.exclusReglementaire.references, 1);
});
ok('contrôle réglementaire clos (conforme) : pas d\'A8, aucune exclusion', () => {
  const r = T.analyser([L('Produit A', { prix_vente: 4, prix_achat: 1 })], [L('Produit A')],
    ctxBase({ stock: [{ article: 'Produit A', pa_net_ht: 1 }], reglementaire: [{ article: 'Produit A', etat: 'conforme', raison: 'clos' }] }));
  const l = r.lignes[0];
  assert.strictEqual(l.conformite.etat, 'conforme');
  assert.ok(!l.alertes.some(a => a.code === 'A8'));
  assert.strictEqual(l.statut, 'conforme');
});
ok('contrôle par rayon', () => {
  const r = T.analyser([L('Produit A'), L('Produit B')], [], ctxBase({ reglementaire: [{ rayon: 'Rayon Alpha', etat: 'a_completer' }] }));
  assert.ok(r.lignes.every(l => l.conformite.etat === 'a_completer'));
});

// ---- Régimes
ok('régime à qualifier déclaré : exclu, sans seuil validé, aucune recommandation', () => {
  const r = T.analyser([L('Produit A', { prix_vente: 1.5, prix_achat: 1 })], [], ctxBase({ regimes: [{ article: 'Produit A', regime: 'a_qualifier', raison: 'raison fictive' }] }));
  const l = r.lignes[0];
  assert.strictEqual(l.regime, 'a_qualifier');
  assert.strictEqual(l.statut, 'sans_seuil_valide');
  assert.strictEqual(l.simulation.minimum, null);
  assert.ok(/régime de prix/.test(l.simulation.exclusion));
});
ok('le libellé n\'influe pas sur le régime', () => {
  const r = T.analyser([L('Carte prépayée fictive'), L('Tabac fictif', { categorie: 'Tabac' })], [], ctxBase());
  assert.ok(r.lignes.every(l => l.regime === 'libre'));
});

// ---- Exceptions
const excValidee = { article: 'Produit A', statut: 'validee', type: 'produit_d_appel', motif: 'fictif' };
ok('exception validée : pas de simulation, à surveiller, comptée à part', () => {
  const r = T.analyser([L('Produit A', { prix_vente: 1.5, prix_achat: 1 })], [], ctxBase({ exceptions: [excValidee] }));
  const l = r.lignes[0];
  assert.strictEqual(l.statut, 'a_surveiller');
  assert.strictEqual(l.simulation.exclusion, 'exception commerciale validée');
  assert.strictEqual(r.synthese.exclusException.references, 1);
});
ok('exception candidate : sans effet sur le calcul', () => {
  const sans = T.analyser([L('Produit A', { prix_vente: 1.5, prix_achat: 1 })], [], ctxBase()).lignes[0];
  const avec = T.analyser([L('Produit A', { prix_vente: 1.5, prix_achat: 1 })], [], ctxBase({ exceptions: [{ ...excValidee, statut: 'candidate' }] })).lignes[0];
  assert.strictEqual(avec.statut, sans.statut);
  assert.deepStrictEqual(avec.simulation, sans.simulation);
  const a2 = avec.alertes.find(a => a.code === 'A2');
  assert.strictEqual(a2.donnees.exceptionCandidate, true);
});
ok('une exception reste soumise à A3 (marge négative)', () => {
  const l = T.analyser([L('Produit A', { prix_vente: 1, prix_achat: 1.2 })], [], ctxBase({ exceptions: [excValidee] })).lignes[0];
  assert.ok(l.alertes.some(a => a.code === 'A3'));
  assert.ok(l.alertes.some(a => a.code === 'A7'));
});
ok('une exception reste soumise à A4 (variation anormale)', () => {
  const l = T.analyser([L('Produit A', { prix_vente: 3, prix_achat: 1.8 })], [L('Produit A', { prix_vente: 3, prix_achat: 1 })], ctxBase({ exceptions: [excValidee] })).lignes[0];
  assert.ok(l.alertes.some(a => a.code === 'A4'));
});
ok('une exception reste soumise à A5 (TVA à vérifier)', () => {
  const r = T.analyser([L('Produit A', { tva: 0 }), L('Produit B', { tva: 20 }), L('Produit C', { tva: 20 })], [], ctxBase({ exceptions: [excValidee] }));
  assert.ok(un(r, 'Produit A').alertes.some(a => a.code === 'A5'));
});
ok('une exception reste soumise à A8', () => {
  const l = T.analyser([L('Produit A')], [], ctxBase({ exceptions: [excValidee], reglementaire: [{ article: 'Produit A', etat: 'controle_ouvert' }] })).lignes[0];
  assert.ok(l.alertes.some(a => a.code === 'A8'));
});
ok('A7 : exception hors de ses conditions', () => {
  const l = T.analyser([L('Produit A', { prix_vente: 3, prix_achat: 1 })], [L('Produit A', { prix_vente: 3, prix_achat: 1 })],
    ctxBase({ exceptions: [{ ...excValidee, conditions: { prix_ttc: 2.4 } }] })).lignes[0];
  const a7 = l.alertes.find(a => a.code === 'A7');
  assert.ok(a7 && a7.donnees.constats.some(c => /déclaré/.test(c)));
});

// ---- A1, A2, A4
ok('A1 : hausse du coût à prix constant', () => {
  const l = T.analyser([L('Produit A', { prix_vente: 2, prix_achat: 1.2 })], [L('Produit A', { prix_vente: 2, prix_achat: 1 })], ctxBase()).lignes[0];
  const a1 = l.alertes.find(a => a.code === 'A1');
  assert.ok(a1);
  assert.strictEqual(a1.consequence.montant, 2);
});
ok('A2 : montant égal au gain théorique au seuil', () => {
  const l = T.analyser([L('Produit A', { prix_vente: 1.5, prix_achat: 1 })], [], ctxBase()).lignes[0];
  const a2 = l.alertes.find(a => a.code === 'A2');
  assert.strictEqual(a2.consequence.montant, l.simulation.minimum.gain);
});
ok('A4 : coût en variation de plus de 50 %', () => {
  const l = T.analyser([L('Produit A', { prix_vente: 4, prix_achat: 1.6 })], [L('Produit A', { prix_vente: 4, prix_achat: 1 })], ctxBase()).lignes[0];
  assert.ok(l.alertes.some(a => a.code === 'A4'));
  assert.strictEqual(l.fiabilite.niveau, 'insuffisante');
});

// ---- A6 : par taux, par marge unitaire, sous le montant minimal, seuils réglables
const a6 = (cour, prec, reglages) => T.analyser([L('Produit A', { quantite: 100, ...cour })], [L('Produit A', { quantite: 100, ...prec })],
  ctxBase({ exceptions: [excValidee], ...(reglages ? { reglages } : {}) })).lignes[0].alertes.find(a => a.code === 'A6');
ok('A6 par taux', () => {
  const a = a6({ prix_vente: 2, prix_achat: 1.1 }, { prix_vente: 2, prix_achat: 1 });
  assert.ok(a);
  assert.strictEqual(a.donnees.declencheur, 'baisse du taux');
});
ok('A6 par marge unitaire, sans baisse de taux suffisante', () => {
  const a = a6({ prix_vente: 10, prix_achat: 5.4 }, { prix_vente: 10, prix_achat: 5.1 }, { a6: { baissePoints: 0.5 } });
  assert.ok(a);
  assert.strictEqual(a.donnees.declencheur, 'baisse de marge unitaire');
});
ok('A6 sous le montant minimal : aucune alerte', () => {
  assert.strictEqual(a6({ prix_vente: 2, prix_achat: 1.1, quantite: 2 }, { prix_vente: 2, prix_achat: 1, quantite: 2 }), undefined);
});
ok('A6 : seuils réglables par site', () => {
  const cour = { prix_vente: 2, prix_achat: 1.1, quantite: 2 }, prec = { prix_vente: 2, prix_achat: 1, quantite: 2 };
  const a = a6(cour, prec, { a6: { montantMinimal: 0.1 } });
  assert.ok(a);
  assert.strictEqual(a.donnees.seuils.montantMinimal, 0.1);
  assert.strictEqual(a6({ prix_vente: 2, prix_achat: 1.1 }, { prix_vente: 2, prix_achat: 1 }, { a6: { baissePoints: 0.2, baisseMargeUnitaireEuros: 0.5 } }), undefined);
});

// ---- Réglages et lecture seule
ok('réglage du palier appliqué aux prix envisageables', () => {
  const l = T.analyser([L('Produit A', { prix_vente: 1.5, prix_achat: 1 })], [], ctxBase({ reglages: { palierTtc: 0.10 } })).lignes[0];
  assert.strictEqual(Math.round(l.simulation.minimum.ttc * 100) % 10, 0);
});
ok('le moteur ne modifie pas ses entrées', () => {
  const cour = [L('Produit A', { prix_vente: 1.5, prix_achat: 1 })], prec = [L('Produit A')], ctx = ctxBase();
  const avant = JSON.stringify([cour, prec, ctx]);
  T.analyser(cour, prec, ctx);
  assert.strictEqual(JSON.stringify([cour, prec, ctx]), avant);
});
ok('ramener à 30 jours', () => {
  assert.strictEqual(T.ramener(60, 15), 120);
  assert.strictEqual(T.ramener(60, null), null);
  assert.strictEqual(T.ramener(null, 15), null);
});

ok('version du moteur exposée, conforme à la forme exigée par la base (T3)', () => {
  assert.strictEqual(T.VERSION_MOTEUR, 'politique-tarifaire-t2-v2');
  assert.ok(/^politique-tarifaire-t2(-[a-z0-9.]+)?$/.test(T.VERSION_MOTEUR));
});

// ---- Lot moteur T3 : A5 « identité changée », A3 marge nulle / vente à perte, régime injecté
const alerte = (l, code) => l.alertes.find(a => a.code === code);
ok('A5 identité changée : libellé changé, code-barres identique', () => {
  const r = T.analyser([L('Produit A bis', { code_barres: '999001' })], [L('Produit A', { code_barres: '999001' })], ctxBase());
  const a = alerte(un(r, 'Produit A bis'), 'A5');
  assert.ok(a && a.donnees.constats.some(c => /identité changée : libellé/.test(c)));
});
ok('A5 identité changée : code-barres changé, libellé identique', () => {
  const r = T.analyser([L('Produit A', { code_barres: '999002' })], [L('Produit A', { code_barres: '999001' })], ctxBase());
  const a = alerte(un(r, 'Produit A'), 'A5');
  assert.ok(a && a.donnees.constats.some(c => /identité changée : code-barres 999001 devenu 999002/.test(c)));
});
ok('A5 identité changée : sans effet sur les gains ni sur le statut', () => {
  const avant = T.analyser([L('Produit A', { code_barres: '999001' })], [L('Produit A', { code_barres: '999001' })], ctxBase());
  const apres = T.analyser([L('Produit A', { code_barres: '999002' })], [L('Produit A', { code_barres: '999001' })], ctxBase());
  assert.strictEqual(un(apres, 'Produit A').statut, un(avant, 'Produit A').statut);
  assert.deepStrictEqual(apres.gains.decisionnels, avant.gains.decisionnels);
});
ok('A5 identité inchangée : pas de constat (casse et espaces du libellé ignorés)', () => {
  const r = T.analyser([L('Produit  A ', { code_barres: '999001' })], [L('produit a', { code_barres: '999001' })], ctxBase());
  const a = alerte(un(r, 'Produit  A '), 'A5');
  assert.ok(!a || !a.donnees.constats.some(c => /identité changée/.test(c)));
});
ok('A3 marge nulle : 0 € et jamais présentée comme une perte', () => {
  const r = T.analyser([L('Produit A', { prix_vente: 1, prix_achat: 1 })], [], ctxBase());
  const a = alerte(un(r, 'Produit A'), 'A3');
  assert.strictEqual(a.donnees.cas, 'marge_nulle');
  assert.strictEqual(a.consequence.montant, 0);
  assert.ok(!/^perte/.test(a.consequence.nature));
});
ok('A3 vente à perte : montant de la perte, cas distinct', () => {
  const r = T.analyser([L('Produit B', { prix_vente: 1, prix_achat: 1.5, quantite: 10 })], [], ctxBase());
  const a = alerte(un(r, 'Produit B'), 'A3');
  assert.strictEqual(a.donnees.cas, 'vente_a_perte');
  assert.strictEqual(a.consequence.montant, 5);
  assert.strictEqual(a.consequence.nature, 'perte');
});
ok('A3 : la perte totale ne somme que les ventes à perte', () => {
  const r = T.analyser([L('Produit A', { prix_vente: 1, prix_achat: 1 }), L('Produit B', { prix_vente: 1, prix_achat: 1.5 }), L('Produit C', { prix_vente: 1, prix_achat: 1.2, quantite: 5 })], [], ctxBase());
  const a3 = r.lignes.map(l => alerte(l, 'A3')).filter(Boolean);
  assert.strictEqual(a3.length, 3);
  const perte = a3.filter(a => a.donnees.cas === 'vente_a_perte').reduce((t, a) => t + a.consequence.montant, 0);
  assert.strictEqual(Math.round(perte * 100) / 100, 6);
  assert.strictEqual(a3.filter(a => a.donnees.cas === 'marge_nulle').reduce((t, a) => t + a.consequence.montant, 0), 0);
});
ok('A3 marge nulle justifiée : la note ne parle pas de perte', () => {
  const r = T.analyser([L('Produit A', { prix_vente: 1, prix_achat: 1 })], [], ctxBase({ justifications: [{ article: 'Produit A', motif: 'motif fictif' }] }));
  const a = alerte(un(r, 'Produit A'), 'A3');
  assert.ok(a.donnees.note && !/perte/.test(a.donnees.note));
});
const sansProposition = (l) => {
  assert.strictEqual(l.simulation.minimum, null);
  assert.strictEqual(l.simulation.cible, null);
  assert.strictEqual(l.simulation.prixDecide, null);
  assert.ok(!alerte(l, 'A2'));
  assert.notStrictEqual(l.statut, 'proposition_a_valider');
};
ok('régime injecté (réglementé, contractuel) : aucune proposition ni « Décider »', () => {
  const regimeDe = row => row.article === 'Produit R' ? 'reglemente' : row.article === 'Produit K' ? 'contractuel' : null;
  const r = T.analyser([L('Produit R', { prix_vente: 1.5 }), L('Produit K', { prix_vente: 1.5 }), L('Produit A', { prix_vente: 1.5 })], [], ctxBase({ regimeDe, prixDecides: [{ article: 'Produit R', prix_ttc: 3, nature: 'changement' }, { article: 'Produit K', prix_ttc: 3, nature: 'changement' }] }));
  sansProposition(un(r, 'Produit R'));
  sansProposition(un(r, 'Produit K'));
  assert.strictEqual(un(r, 'Produit R').regime, 'reglemente');
  assert.strictEqual(un(r, 'Produit K').regime, 'contractuel');
  assert.strictEqual(un(r, 'Produit A').regime, 'libre');
  assert.strictEqual(un(r, 'Produit A').statut, 'proposition_a_valider');
});
ok('régime du registre : même exclusion, et il reste prioritaire sur la règle injectée', () => {
  const r = T.analyser([L('Produit R'), L('Produit K')], [], ctxBase({
    regimeDe: () => 'libre',
    regimes: [{ article: 'Produit R', regime: 'reglemente', raison: 'raison fictive' }, { article: 'Produit K', regime: 'contractuel', raison: 'raison fictive' }] }));
  sansProposition(un(r, 'Produit R'));
  sansProposition(un(r, 'Produit K'));
  assert.strictEqual(un(r, 'Produit R').regime, 'reglemente');
});

ok('A5 régime déclaré contre règle NEXUS : constat, sans effet sur gains ni statut', () => {
  const regimes = [{ article: 'Produit R', regime: 'libre', raison: 'raison fictive' }];
  const avec = T.analyser([L('Produit R', { prix_vente: 1.5 })], [], ctxBase({ regimeDe: () => 'reglemente', regimes }));
  const a = alerte(un(avec, 'Produit R'), 'A5');
  assert.ok(a && a.donnees.constats.some(c => c === 'régime déclaré « libre » contre règle NEXUS « reglemente »'));
  const sans = T.analyser([L('Produit R', { prix_vente: 1.5 })], [], ctxBase({ regimes }));
  assert.ok(!(alerte(un(sans, 'Produit R'), 'A5') || { donnees: { constats: [] } }).donnees.constats.some(c => /régime déclaré/.test(c)));
  assert.strictEqual(un(avec, 'Produit R').statut, un(sans, 'Produit R').statut);
  assert.deepStrictEqual(avec.gains.decisionnels, sans.gains.decisionnels);
  const accord = T.analyser([L('Produit R', { prix_vente: 1.5 })], [], ctxBase({ regimeDe: () => 'reglemente', regimes: [{ article: 'Produit R', regime: 'reglemente', raison: 'x' }] }));
  assert.ok(!(alerte(un(accord, 'Produit R'), 'A5') || { donnees: { constats: [] } }).donnees.constats.some(c => /régime déclaré/.test(c)));
});

ok('stock non fourni : aucun constat « absent du relevé » par référence, limite portée par la synthèse', () => {
  const lignes = [L('Produit S1', { prix_vente: 4, prix_achat: 1 }), L('Produit S2', { prix_vente: 4, prix_achat: 1 })];
  const sans = T.analyser(lignes, [], ctxBase({ stockFourni: false }));
  for (const l of sans.lignes) assert.ok(!JSON.stringify(l).includes('absent du relevé de stock'));
  assert.strictEqual(sans.synthese.stockFourni, false);
  const avec = T.analyser(lignes, [], ctxBase());
  assert.strictEqual(avec.synthese.stockFourni, true);
  assert.ok(avec.lignes.every(l => JSON.stringify(l).includes('absent du relevé de stock')));
});

ok('opération de caisse : jamais une vente à perte (pas de A3), exclue des ventes commerciales', () => {
  const a = T.analyser([L('Produit V', { prix_vente: 1, prix_achat: 2 }), L('Produit W', { prix_vente: 1, prix_achat: 2 })], [], ctxBase({ natureDe: r => (r.article === 'Produit W' ? 'operation_caisse' : null) }));
  assert.ok(alerte(un(a, 'Produit V'), 'A3'));
  assert.ok(!alerte(un(a, 'Produit W'), 'A3'));
  assert.strictEqual(un(a, 'Produit W').simulation.exclusion, 'hors ventes commerciales');
});

ok('stock non fourni : aucune référence fiable sur le coût, aucun A5 « absente du relevé », gains fiables nuls', () => {
  const lignes = [L('Produit S1', { prix_vente: 1.2, prix_achat: 1 }), L('Produit S2', { prix_vente: 1.2, prix_achat: 1 })];
  const sans = T.analyser(lignes, [], ctxBase({ stockFourni: false }));
  assert.ok(sans.lignes.every(l => l.fiabilite.niveau !== 'fiable'));
  assert.ok(sans.lignes.every(l => JSON.stringify(l.fiabilite).includes('coût non contrôlé : relevé de stock non fourni')));
  for (const l of sans.lignes) {
    const a5 = alerte(l, 'A5');
    assert.ok(!a5 || !JSON.stringify(a5).includes('absente du relevé'));
  }
  assert.ok(!sans.lignes.some(l => JSON.stringify(l.alertes || []).includes('absente du relevé')));
  assert.ok([null, 0].includes(sans.gains.decisionnels.minimum.fiable.montant));
  assert.strictEqual(sans.gains.decisionnels.minimum.fiable.references, 0);
  assert.strictEqual(sans.synthese.stockFourni, false);
});

ok('stock : un libellé au coût ambigu est retenu sans PA, la référence passe à confirmer avec la raison', () => {
  const l = [L('Produit AMB', { prix_vente: 1.2, prix_achat: 1 })];
  const r = T.analyser(l, [], ctxBase({ stockFourni: true, stock: [{ article: 'Produit AMB', pa_net_ht: null, ambigu: 'coût ambigu dans le relevé : 2 lignes, PA de 0.76 à 0.85' }] }));
  assert.strictEqual(r.lignes[0].fiabilite.niveau, 'a_confirmer');
  assert.ok(JSON.stringify(r.lignes[0].fiabilite).includes('coût ambigu dans le relevé : 2 lignes, PA de 0.76 à 0.85'));
  assert.ok(!(r.lignes[0].alertes || []).some(a => a.code === 'A4'));
});

ok('gains décisionnels : aucune référence « fiable » sans PA de stock établi (absent, ambigu, nul)', () => {
  const ventes = ['Produit A', 'Produit B', 'Produit C', 'Produit D'].map(a => L(a, { prix_vente: 1.5, prix_achat: 1 }));
  const stock = [{ article: 'Produit A', pa_net_ht: 1 }, // PA établi : seule référence pouvant être fiable
    { article: 'Produit B', pa_net_ht: null, ambigu: 'coût ambigu dans le relevé : 2 lignes, PA de 0.9 à 1' },
    { article: 'Produit C', pa_net_ht: 0 }]; // Produit D : absent du relevé
  const r = T.analyser(ventes, [], ctxBase({ stock }));
  const fiables = r.lignes.filter(l => l.fiabilite.niveau === 'fiable');
  fiables.forEach(l => assert.strictEqual(l.article, 'Produit A', 'fiable sans PA de stock établi : ' + l.article));
  ['Produit B', 'Produit C', 'Produit D'].forEach(a => assert.notStrictEqual(un(r, a).fiabilite.niveau, 'fiable', a));
  const g = r.gains.decisionnels;
  [g.minimum, g.cible, g.prixDecides].forEach(x => assert.ok(x.fiable.references <= fiables.length));
  assert.ok(g.minimum.fiable.references <= 1);
});

console.log('test_politique_tarifaire_t2 : ' + n + ' épreuves OK');
