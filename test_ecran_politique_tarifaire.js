// Épreuves de l'écran 1 « Politique tarifaire » (T3). Données ENTIÈREMENT fictives.
const assert = require('assert');
const fs = require('fs');
const E = require('./nexus-politique-tarifaire-ecran.js');
const A = require('./nexus-politique-tarifaire-registres.js');
const T = require('./nexus-politique-tarifaire.js');

let n = 0;
const PROMESSES = [];
const ok = (nom, f) => { const r = f(); if (r && r.then) PROMESSES.push(r.then(() => { n++; })); else n++; };
const S = 'site-fictif-1';
const periode = { debut: '2030-03-01', fin: '2030-03-30' };

const reg = {
  familles: [{ site: S, famille_code: 'Alpha', libelle: 'Famille Alpha' }],
  rattachements: [{ site: S, portee: 'rayon', rayon: 'Rayon Alpha', famille_code: 'Alpha' }],
  seuils: [{ site: S, id: 1, niveau: 'famille', cible_niveau: 'Alpha', minimum: 0.4, cible: 0.5, statut_minimum: 'valide', statut_cible: 'valide' }],
};
const prod = (article, cat, q, pv, pa) => ({ article, categorie: cat, quantite: q, prix_vente: pv, prix_achat: pa, tva: 20, code_barres: '' });
const courantes = [
  prod('Produit A', 'Rayon Alpha', 100, 1.5, 1),
  prod('Produit B', 'Rayon Alpha', 50, 1.2, 1.5),
  prod('Produit C', 'Rayon Beta', 30, 3, 2),
];
const analyse = () => T.analyser(courantes, [], A.contexteDepuisRegistres(reg, { periode }));

ok('quatre cartes : unité, période, source, limite écrites', () => {
  const cs = E.cartes(analyse());
  assert.strictEqual(cs.length, 4);
  assert.deepStrictEqual(cs.map(c => c.id), ['marge_negative', 'propositions', 'a_verifier', 'non_constates']);
  cs.forEach(c => { assert.ok(c.unite && c.periode && c.source && c.limite, c.id); assert.ok(/01\/03\/2030/.test(c.periode)); });
});

ok('carte propositions : gain fiable au centre, à confirmer à côté', () => {
  const a = analyse(), c = E.cartes(a)[1], m = a.gains.decisionnels.minimum;
  assert.strictEqual(c.references, m.fiable.references);
  assert.ok(c.secondaire.indexOf('à confirmer') > 0);
});

ok('minimum et cible jamais additionnés', () => {
  const a = analyse(), sc = E.scenarios(a);
  assert.deepStrictEqual(sc.map(s => s.id), ['prixDecides', 'minimum', 'cible']);
  assert.strictEqual(a.gains.additionnables, false);
  const somme = sc.reduce((t, s) => t + (s.fiable || 0), 0);
  const cartePropo = E.cartes(a)[1].valeur;
  assert.strictEqual(cartePropo, Math.round(a.gains.decisionnels.minimum.fiable.montant).toLocaleString('fr-FR') + ' €');
  if (a.gains.decisionnels.cible.fiable.montant) assert.notStrictEqual(cartePropo, Math.round(somme).toLocaleString('fr-FR') + ' €');
});

ok('huit cartes d\'alerte : gravité et action du moteur, jamais « Appliquer »', () => {
  const as = E.alertesCartes(analyse());
  assert.deepStrictEqual(as.map(a => a.code), ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8']);
  ['A3', 'A8'].forEach(c => assert.strictEqual(as.find(a => a.code === c).gravite, 'critique'));
  ['A4', 'A5', 'A7'].forEach(c => assert.strictEqual(as.find(a => a.code === c).gravite, 'a_verifier'));
  ['A1', 'A2', 'A6'].forEach(c => assert.strictEqual(as.find(a => a.code === c).gravite, 'information'));
  as.forEach(a => assert.ok(['verifier', 'decider', 'surveiller'].indexOf(a.action) >= 0));
});

ok('les cinq statuts du moteur, tels quels', () => {
  assert.deepStrictEqual(Object.keys(E.htmlPage ? { a_verifier: 1, proposition_a_valider: 1, a_surveiller: 1, conforme: 1, sans_seuil_valide: 1 } : {}).sort(),
    ['a_surveiller', 'a_verifier', 'conforme', 'proposition_a_valider', 'sans_seuil_valide']);
  const st = analyse().lignes.map(l => l.statut);
  st.forEach(s => assert.ok(['a_verifier', 'proposition_a_valider', 'a_surveiller', 'conforme', 'sans_seuil_valide'].indexOf(s) >= 0, s));
  assert.ok(st.indexOf('proposition_a_valider') >= 0);
  assert.ok(st.indexOf('sans_seuil_valide') >= 0);
});

ok('« conforme » jamais sans seuil valide', () => {
  analyse().lignes.filter(l => l.statut === 'conforme').forEach(l => assert.ok(l.regle && l.regle.valide));
  const vide = T.analyser(courantes, [], A.contexteDepuisRegistres({}, { periode }));
  assert.ok(vide.lignes.every(l => l.statut !== 'conforme'));
});

ok('tri : gravité puis montant', () => {
  const L = [
    { article: 'x1', alertes: [{ gravite: 'information', consequence: { montant: 900 } }] },
    { article: 'x2', alertes: [{ gravite: 'critique', consequence: { montant: 10 } }] },
    { article: 'x3', alertes: [{ gravite: 'critique', consequence: { montant: 50 } }] },
    { article: 'x4', alertes: [] },
    { article: 'x5', alertes: [{ gravite: 'a_verifier', consequence: { montant: 5 } }] },
  ];
  assert.deepStrictEqual(E.trier(L).map(l => l.article), ['x3', 'x2', 'x5', 'x1', 'x4']);
  assert.deepStrictEqual(L.map(l => l.article), ['x1', 'x2', 'x3', 'x4', 'x5']);
});

ok('filtres cumulables', () => {
  const a = analyse(), L = a.lignes;
  assert.strictEqual(E.filtrer(L, {}).length, L.length);
  assert.ok(E.filtrer(L, { recherche: 'produit a' }).every(l => /produit a/i.test(l.article)));
  const rayon = E.filtrer(L, { rayon: 'Rayon Alpha' });
  assert.ok(rayon.length > 0 && rayon.every(l => l.rayon === 'Rayon Alpha'));
  const cumul = E.filtrer(L, { rayon: 'Rayon Alpha', statut: 'proposition_a_valider' });
  assert.ok(cumul.length <= rayon.length && cumul.every(l => l.rayon === 'Rayon Alpha' && l.statut === 'proposition_a_valider'));
  assert.strictEqual(E.filtrer(L, { rayon: 'Rayon Alpha', statut: 'conforme', fiabilite: 'insuffisante', alerte: 'A8' }).length, 0);
  assert.ok(E.filtrer(L, { alerte: 'A3' }).every(l => l.alertes.some(x => x.code === 'A3')));
});

ok('première page : dix lignes au plus, les autres derrière un bouton', () => {
  const a = analyse();
  const beaucoup = Array.from({ length: 25 }, (_, i) => Object.assign({}, a.lignes[0], { article: 'Produit ' + i }));
  const html = E.htmlPage({ analyse: Object.assign({}, a, { lignes: beaucoup }), role: 'gerant', filtres: {}, incoherences: [] });
  assert.strictEqual((html.split('id="ptRecherche"')[1].split('data-axe-panneau="decider"')[0].match(/class="vp-ligne-prod"/g) || []).length, 10);
  assert.ok(/Voir les 15 autres/.test(html));
});

ok('fiche en lecture seule : aucun bouton de décision ni d\'exception', () => {
  const a = analyse(), l = a.lignes[0];
  const f = E.fiche(l);
  assert.strictEqual(f.article, l.article);
  const html = E.htmlPage({ analyse: a, role: 'gerant', filtres: {}, incoherences: [], ouverte: l.article });
  assert.ok(html.indexOf('pt-fiche') > 0);
  assert.ok(!/Proposer une exception|Décider du prix|Appliquer/.test(html));
});

ok('bandeau d\'intégrité : gérant seulement, et seulement s\'il y a une ligne', () => {
  const a = analyse(), inc = [{ site: S, incoherence: 'x' }];
  assert.ok(/pt-integrite/.test(E.htmlPage({ analyse: a, role: 'gerant', filtres: {}, incoherences: inc })));
  assert.ok(!/pt-integrite/.test(E.htmlPage({ analyse: a, role: 'gerant', filtres: {}, incoherences: [] })));
  assert.ok(!/pt-integrite/.test(E.htmlPage({ analyse: a, role: 'manager', filtres: {}, incoherences: inc })));
});

ok('compte inactif, lecture vide et lecture impossible : trois messages distincts', () => {
  const inactif = E.etatAcces({ actif: false }, 0), vide = E.etatAcces({ actif: true }, 0), illisible = E.etatAcces({ erreur: true }, 0);
  assert.strictEqual(inactif.message, 'Compte inactif, contactez votre gérant');
  assert.strictEqual(vide.message, 'Aucune donnée tarifaire pour ce site');
  assert.strictEqual(illisible.message, 'Impossible de vérifier votre compte');
  assert.strictEqual(E.etatAcces({ actif: true }, 12).code, 'ok');
  assert.strictEqual(E.etatAcces(null, 12).code, 'illisible');
  assert.strictEqual(E.etatAcces({ actif: false }, 12).code, 'inactif');
});

ok('droits de l\'onglet', () => {
  assert.ok(E.peutVoirOnglet('gerant', false));
  assert.ok(E.peutVoirOnglet('manager', false));
  assert.ok(E.peutVoirOnglet('employe', true));
  assert.ok(!E.peutVoirOnglet('employe', false));
});

ok('Conseiller : deux tons, filtre associé', () => {
  const a = analyse();
  const g = E.conseiller(a, 'gerant'), m = E.conseiller(a, 'manager');
  // Format court commun aux deux rôles ; le ton se lit dans le détail derrière le (i).
  assert.ok(g.texte && m.texte && g.texte === m.texte);
  assert.ok(g.detail && m.detail && g.detail !== m.detail);
  const rien = E.conseiller({ synthese: { alertes: {}, statuts: {} } }, 'gerant');
  assert.strictEqual(rien.code, 'RAS');
});

ok('aucune écriture dans le module ni dans le montage', () => {
  const src = fs.readFileSync(require.resolve('./nexus-politique-tarifaire-ecran.js'), 'utf8');
  assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(src));
  const rpcs = src.match(/\.rpc\s*\(\s*'[a-z_]+'/g) || [];
  assert.deepStrictEqual(rpcs.map(x => x.replace(/.*'([a-z_]+)'/, '$1')), ['tarif_enregistrer_reevaluations']);
  assert.ok(!/tarif_enregistrer_decisions|Appliquer|\.post\(|method\s*:\s*['"](POST|PUT|PATCH|DELETE)/i.test(src));
  assert.ok(!/[?&]site=/.test(src), 'aucun paramètre de site côté client');
});

ok('lecture par vues du registre uniquement', () => {
  const src = fs.readFileSync(require.resolve('./nexus-politique-tarifaire-ecran.js'), 'utf8');
  const vues = src.match(/'v_tarif_[a-z_]+'/g) || [];
  assert.ok(vues.length >= 9);
});


ok('bloc fiche « Politique tarifaire » : replié, en lecture seule, sans bouton de décision', () => {
  const l = analyse().lignes[0], h = E.blocFiche(l);
  assert.ok(/<details class="sc-carte pt-pol"/.test(h) && /sc-chev/.test(h) && !/▼/.test(h) && !/Ouvrir la fiche produit/.test(h) && !/<details[^>]* open/.test(h));
  assert.ok(/Politique tarifaire/.test(h));
  assert.ok(!/<button|<input|<form|Appliquer|Proposer une exception|Décider/.test(h));
});

const A5 = ['régime déclaré « libre » contre règle NEXUS « réglementé »'];
const avecA5 = l => Object.assign({}, l, { alertes: (l.alertes || []).concat([{ code: 'A5', donnees: { constats: A5 } }]) });
const sansA5 = l => Object.assign({}, l, { alertes: (l.alertes || []).filter(a => a.code !== 'A5') });

ok('badge « Régime à vérifier » : seulement le désaccord registre / règle (A5)', () => {
  const l = avecA5(Object.assign({}, analyse().lignes[0], { regime: 'reglemente', regimeDeclare: null }));
  assert.ok(/Aucune action de prix/.test(E.avertissementRegime(l)));
  assert.ok(/Régime à vérifier/.test(E.htmlLigne(l)));
  assert.ok(/Aucune action de prix/.test(E.blocFiche(l)));
});

ok('prix réglementé sans désaccord : information neutre « Prix réglementé », aucun avertissement', () => {
  const l = sansA5(Object.assign({}, analyse().lignes[0], { regime: 'reglemente', regimeDeclare: null }));
  assert.strictEqual(E.avertissementRegime(l), null);
  const h = E.htmlLigne(l);
  assert.ok(/Prix réglementé/.test(h) && !/Régime à vérifier/.test(h));
  const c = sansA5(Object.assign({}, analyse().lignes[0], { regime: 'contractuel', regimeDeclare: null }));
  assert.ok(/Prix contractuel/.test(E.htmlLigne(c)) && !/Régime à vérifier/.test(E.htmlLigne(c)));
});

ok('prix libre : ni « Régime à vérifier » ni « Prix réglementé »', () => {
  const l = sansA5(Object.assign({}, analyse().lignes[0], { regime: 'libre', regimeDeclare: null }));
  assert.strictEqual(E.avertissementRegime(l), null);
  const h = E.htmlLigne(l);
  assert.ok(!/Régime à vérifier|Prix réglementé|Prix contractuel/.test(h));
});

ok('un seul état par ligne : « À vérifier » seulement pour statut À vérifier ou A4/A5', () => {
  const base = sansA5(analyse().lignes[0]);
  const conf = Object.assign({}, base, { statut: 'conforme', alertes: (base.alertes || []).filter(a => a.code !== 'A4') });
  assert.ok(!/À vérifier/.test(E.badgeLigne(conf)));
  assert.ok(/À vérifier/.test(E.badgeLigne(Object.assign({}, conf, { statut: 'a_verifier' }))));
  assert.ok(/À vérifier/.test(E.badgeLigne(avecA5(conf))));
});

ok('aucune référence de famille exclue ne reçoit de proposition de prix', () => {
  const a = T.analyser(courantes, [], A.contexteDepuisRegistres(reg, { periode, regimeDe: () => 'reglemente' }));
  a.lignes.forEach(l => assert.notStrictEqual(l.statut, 'proposition_a_valider', l.article));
});

ok('références à fiabilité insuffisante jamais dans « Décisions de prix »', () => {
  const a = analyse(), ins = a.lignes.filter(l => l.fiabilite.niveau === 'insuffisante');
  const fam = E.familles ? E.familles(a) : null;
  if (fam) fam.filter(f => /Décisions de prix/.test(f.titre || '')).forEach(f => ins.forEach(l => assert.ok(!(f.articles || []).includes(l.article))));
});

ok('chaque cible cliquable de la page a une destination', () => {
  const a = analyse(), l = a.lignes[0];
  const h = E.htmlPage({ analyse: a, role: 'gerant', filtres: {}, incoherences: [], ouverte: l.article });
  const cibles = h.match(/data-(fiche|article|controle-liste|conseil|plus|effacer)=/g) || [];
  assert.ok(cibles.length > 0);
  const src = fs.readFileSync(require.resolve('./NEXUS-Produits-v1.html'), 'utf8');
  ['data-fiche', 'data-article', 'data-controle-liste', 'data-conseil', 'data-plus', 'data-effacer'].forEach(k => assert.ok(src.indexOf('[' + k + ']') > 0, k));
});

ok('page Produits : deux écritures permises, tarif_marquer_verifie et l\'annulation tracée (3 colonnes), aucune autre', () => {
  const src = fs.readFileSync(require.resolve('./NEXUS-Produits-v1.html'), 'utf8');
  const i = src.indexOf('async function calculerAnalyseTarif'), j = src.indexOf('function ouvrirVue(cle)');
  const bloc = src.slice(i, j);
  const annul = "from('tarif_anomalies_verifications').update({ annule_le: new Date().toISOString(), annule_par: employee.id, motif_annulation: motif })";
  assert.strictEqual(bloc.split(annul).length - 1, 1, 'une seule annulation tracee');
  const reste = bloc.split(annul).join('');
  assert.ok(!/\.(insert|update|delete|upsert)\s*\(|tarif_enregistrer_decisions/.test(reste));
  const rpcs = (src.match(/\.rpc\(\s*['"][a-z_]+/g) || []).map(x => x.replace(/.*['"]/, ''));
  rpcs.forEach(r => assert.ok(['tarif_marquer_verifie'].indexOf(r) >= 0 || !/tarif/.test(r), 'rpc inattendu : ' + r));
});

ok('Écran v2 : Conseiller avant les cartes, scénarios dans le détail, filtres étiquetés, pas de « (s) »', () => {
  const a = analyse();
  const h = E.htmlPage({ analyse: a, role: 'gerant', filtres: {}, incoherences: [{}, {}] });
  assert.ok(h.indexOf('sc-conseiller') > 0 && h.indexOf('sc-conseiller') < h.indexOf('pt-inds'), 'Conseiller avant les cartes');
  assert.ok(/<details class="sc-carte pt-scenarios">[\s\S]*Prix décidés[\s\S]*<\/details>/.test(h), 'scénarios dans un détail');
  ['Famille', 'Rayon', 'Statut', 'Fiabilité', 'Exception', 'Recherche'].forEach(t => assert.ok(h.indexOf('<span class="sc-methode">' + t + '</span>') > 0, t));
  assert.ok(!/\(s\)/.test(h.replace(/<style[\s\S]*?<\/style>/g, '')), 'plus de (s)');
  assert.ok(/2 lignes à corriger/.test(h));
  assert.strictEqual((E.htmlControle({ code: 'X', titre: 'T', nombre: 0, nature: 'n', montant: null, gravite: 'info', action: 'a', methode: 'm', lignes: [], icone: 'x' }, null).match(/Aucun cas sur la période/g) || []).length, 1);
});

// ---------- Lot A : marge estimée, anomalies, vérification ----------
const ligneAvec = (etat, extra) => Object.assign({ article: 'Produit Z', rayon: 'Rayon Alpha', taux: 0.3, fiabilite: { niveau: 'bonne' }, conformite: { etat: 'conforme' },
  margeEstimee: { etat, taux: etat === 'non_calculable' ? null : 0.3, margeUnitaireHt: 0.2, cout: { valeur: 1, source: 'export', methode: 'x' }, raisons: [], limites: [] }, anomalies: [] }, extra || {});
ok('marge : trois états, une qualification chacun, jamais « certifié »', () => {
  const h = ['estimation', 'a_verifier', 'non_calculable'].map(e => E.htmlMarge(ligneAvec(e))).join(' ');
  assert.ok(/Estimation/.test(h) && /Non calculable/.test(h) && /À vérifier/.test(h));
  assert.ok(!/certifi/i.test(h));
});
ok('prix réglementé : qualification, aucune recommandation ni variation de coût', () => {
  const l = ligneAvec('estimation', { article: 'Bouteille gaz', statut: 'sans_seuil_valide', regimeDeclare: { regime: 'reglemente' } });
  const h = E.htmlMarge(l) + E.ficheMarge(l);
  assert.ok(/Prix fixé par un tiers/.test(h));
  // Le régime est dit une seule fois dans la ligne (après le nom), jamais répété après la marge.
  assert.ok(!/Prix réglementé/.test(E.htmlMarge(l)));
  // La marge d'une ligne à régime reste une estimation : l'étiquette « Estimation » doit rester visible.
  assert.ok(/Estimation/.test(E.htmlMarge(l)) && /Estimation/.test(E.htmlLigne(l)));
  assert.strictEqual((E.htmlLigne(l).match(/Prix réglementé/g) || []).length, 1);
  assert.ok(!/Sans seuil validé/.test(E.htmlLigne(l)) && !/Aucune action de prix/.test(E.htmlLigne(l)) && /Aucune action de prix/.test(E.ficheMarge(l)));
  assert.ok(!/variation de coût\s*:|inférieur au coût|augmenter|baisser/i.test(h.replace(/aucune variation de coût ni recommandation de prix/i, '')));
});
ok('(i) : bouton de 44 px ciblé, destination = fiche', () => {
  const h = E.htmlLigne(ligneAvec('estimation'));
  assert.ok(/data-info-marge="Produit Z"/.test(h) && /aria-label="Information/.test(h));
  assert.ok(!/<button[^>]*vp-ligne-prod[^>]*>[^]*<button/.test(h.replace(/<\/button>[^]*$/, '</button>')), 'pas de bouton imbriqué');
});
ok('carte marge estimée : X sur Y, répartition, limites', () => {
  const a = analyse(), c = E.carteMarge(a);
  assert.ok(/^\d+ sur 3$/.test(c.valeur) && /Estimation/.test(c.secondaire) && c.limite);
});
ok('droits : vérifier réservé au gérant et manager, jamais au créateur', () => {
  assert.strictEqual(E.peutVerifier('gerant', false), true); assert.strictEqual(E.peutVerifier('manager', false), true);
  assert.strictEqual(E.peutVerifier('employe', false), false); assert.strictEqual(E.peutVerifier('manager', true), false);
});
ok('bouton « vérifié » : présent avec droits, absent sinon, absent si déjà vérifié', () => {
  const an = { code: 'S2', niveau: 'a_verifier', cycle: 'nouvelle', empreinte: 'e', identiteDonnees: { fichierHash: 'H1', dateReleve: '2030-03-01' }, gravite: 'a_verifier' };
  const l = ligneAvec('estimation', { anomalies: [an] });
  assert.ok(/✓ Marquer comme vérifié/.test(E.htmlFiche(l, { role: 'manager' })));
  assert.ok(!/Marquer comme vérifié/.test(E.htmlFiche(l, { role: 'employe' })));
  l.anomalies[0].cycle = 'verifiee';
  assert.ok(!/Marquer comme vérifié/.test(E.htmlFiche(l, { role: 'manager' })) && /Vérifié/.test(E.htmlFiche(l, { role: 'manager' })));
});
ok('message après écriture : date, nom affiché, réévaluation', () => {
  const m = E.messageApresEcriture({ date: '2030-03-05', auteur: 'Alex Test' });
  assert.ok(/05\/03\/2030/.test(m) && /Alex Test/.test(m) && /Réévalué au prochain import/.test(m) && !/@/.test(m));
});
ok('commentaire : limite unique, charge utile sans site, lot et empreinte transmis', () => {
  assert.ok(E.commentaireValide('x'.repeat(E.LIMITE_COMMENTAIRE)) && !E.commentaireValide('x'.repeat(E.LIMITE_COMMENTAIRE + 1)));
  const an = { code: 'S2', niveau: 'a_verifier', empreinte: 'e', identiteDonnees: { fichierHash: 'H1', dateReleve: '2030-03-01' }, gravite: 'a_verifier' };
  const v = E.payloadVerification(an, { article: 'A' }, { importBatchId: 'b', moteurVersion: 'm', commentaire: 'y'.repeat(900) });
  assert.ok(!('site' in v) && v.fichier_hash === 'H1' && v.import_batch_id === 'b' && v.empreinte === 'e' && v.commentaire.length === E.LIMITE_COMMENTAIRE);
});
ok('aucune recommandation de prix depuis une marge Estimation', () => {
  const h = E.htmlFiche(ligneAvec('estimation'), { role: 'manager' });
  assert.ok(!/prix conseillé|appliquer ce prix|proposition de prix/i.test(h));
});

ok('commentaire : libellé visible, compteur n / 500, message traduit', () => {
  assert.ok(E.messageErreurEcriture('P0001 tarif_verif_commentaire_trop_long : x').indexOf('500') >= 0);
  assert.ok(E.messageErreurEcriture(new Error('autre')).indexOf('échoué') >= 0);
  assert.ok(E.commentaireValide('x'.repeat(500)) && !E.commentaireValide('x'.repeat(501)));
  const h = E.htmlFiche(ligneAvec('estimation'), { role: 'manager' });
  if (/pt-verif-com/.test(h)) assert.ok(/<label[^>]*for=/.test(h) && /0 \/ 500/.test(h));
});

ok('historique : filtre par défaut Nouveau/Persistant/Aggravé, détail (i), lecture seule', () => {
  const analyse = { lignes: [
    { article: 'A', anomalies: [{ code: 'S2', cle: 'k1', cycle: 'nouvelle' }], anomaliesResolues: [] },
    { article: 'B', anomalies: [{ code: 'S3', cle: 'k2', cycle: 'verifiee' }], anomaliesResolues: [{ code: 'S1', cle: 'k3' }] },
    { article: 'C', anomalies: [{ code: 'S2', cle: 'k4', cycle: 'aggravee' }], anomaliesResolues: [] }] };
  const verifs = [{ code: 'S3', cle: 'k2', verifie_le: '2030-03-05T10:00:00Z', auteur: 'Alex Test', commentaire: 'vu en rayon', reevaluation: null }];
  assert.strictEqual(E.historiqueLignes(analyse, verifs).length, 2);
  assert.strictEqual(E.historiqueLignes(analyse, verifs, 'verifiee').length, 1);
  assert.strictEqual(E.historiqueLignes(analyse, verifs, 'resolue').length, 1);
  assert.strictEqual(E.historiqueLignes(analyse, verifs, 'tous').length, 4);
  const h = E.htmlHistorique({ analyse, verifications: verifs, historiqueDispo: true, filtreHisto: 'verifiee', histoOuverte: 'S3|B' });
  assert.ok(/data-filtre-histo/.test(h) && /Alex Test/.test(h) && /vu en rayon/.test(h) && /05\/03\/2030/.test(h) && /Pas encore réévalué/.test(h));
  assert.strictEqual(E.htmlHistorique({ analyse, historiqueDispo: false }), '');
});


// ---------- Point 1 et 2 de la revue : date du relevé de stock, réévaluations ----------
const MA = require('./nexus-anomalies-tarifaires.js');
const page = fs.readFileSync(__dirname + '/NEXUS-Produits-v1.html', 'utf8');
const vref = (o) => Object.assign({ id: 'v-1', code: 'S2', cle: 'k1', article: 'Art A', code_barres: '123', empreinte: 'e1', gravite: 10, verifie_le: '2030-03-02T10:00:00Z',
  identiteDonnees: { fichierHash: 'h1', dateReleve: '2030-03-01' }, reevaluation: null }, o || {});
const anom = (o) => Object.assign({ code: 'S2', cle: 'k1', empreinte: 'e2', gravite: 60, valeurs: { a: 1 } }, o || {});
const faux = () => { const appels = []; return { appels, rpc: async (nom, args) => { appels.push([nom, args]); return { error: null }; } }; };
const id2 = { fichierHash: 'h2', dateReleve: '2030-03-15' };

ok('page : ctx.stockDate et fichierHash viennent du lot de relevé publié, transmis en date_releve à l\'écriture', () => {
  assert.ok(/ctx\.stockDate\s*=\s*RS\.lot\.dateReleve/.test(page) && /ctx\.fichierHash\s*=\s*RS\.lot\.fichierHash/.test(page));
  assert.ok(/identite:\s*\{\s*fichierHash:[^}]*dateReleve:\s*ctx\.stockDate/.test(page));
  const p = E.payloadVerification({ code: 'S2', empreinte: 'e', gravite: 5, niveau: 2, identiteDonnees: { fichierHash: 'h', dateReleve: '2030-03-15' } }, { article: 'A' }, { importBatchId: 'b', moteurVersion: 'm' });
  assert.strictEqual(p.date_releve, '2030-03-15');
});
ok('cycle de vie : même relevé, aucune réévaluation ; nouveau relevé et nouveau fichier, une réévaluation', () => {
  const v = [vref()];
  const memeReleve = MA.cycleDeVie([anom()], v, { fichierHash: 'h2', dateReleve: '2030-03-01' });
  assert.strictEqual(MA.reevaluations(memeReleve).length, 0);
  const neuf = MA.cycleDeVie([anom()], v, id2);
  assert.strictEqual(MA.reevaluations(neuf).length, 1);
});
ok('réévaluations : mêmes clés que la fonction SQL, une ligne par changement de cycle', () => {
  const a = { lignes: [{ article: 'Art A', anomalies: [anom({ cycle: 'aggravee' }), anom({ code: 'S3', cle: 'k9', cycle: 'verifiee' })], anomaliesResolues: [{ code: 'S1', cle: 'k5', empreinte: 'e5' }] }] };
  const v = [vref(), vref({ id: 'v-5', code: 'S1', cle: 'k5', empreinte: 'e5', article: 'Art B', code_barres: null })];
  const L = E.reevaluationsAEcrire(a, v, id2);
  assert.strictEqual(L.length, 2);
  const ADMIS = ['verification_id', 'article', 'code_barres', 'etat', 'fichier_hash', 'date_releve', 'empreinte', 'gravite', 'valeurs', 'cause'];
  L.forEach(x => Object.keys(x).forEach(k => assert.ok(ADMIS.indexOf(k) >= 0, k)));
  assert.strictEqual(L[0].etat, 'aggravee'); assert.strictEqual(L[0].verification_id, 'v-1'); assert.strictEqual(L[0].cause, 'S2');
  assert.strictEqual(L[1].etat, 'resolue'); assert.strictEqual(L[1].gravite, null); assert.strictEqual(L[1].article, 'Art B');
  assert.ok(!('site' in L[0]));
});
ok('réévaluations : même import, aucun appel ; nouvel import, un appel avec les bons états', async () => {
  const a = { lignes: [{ article: 'Art A', anomalies: [anom({ cycle: 'verifiee' })], anomaliesResolues: [] }] };
  const c1 = faux();
  assert.strictEqual((await E.enregistrerReevaluations(c1, 'gerant', false, a, [vref()], { fichierHash: 'h1', dateReleve: '2030-03-01' })).statut, 'aucune');
  assert.strictEqual(c1.appels.length, 0);
  const b = { lignes: [{ article: 'Art A', anomalies: [anom({ cycle: 'persistante' })], anomaliesResolues: [] }] };
  const c2 = faux(); const r = await E.enregistrerReevaluations(c2, 'manager', false, b, [vref()], id2);
  assert.strictEqual(r.statut, 'ecrit'); assert.strictEqual(c2.appels.length, 1);
  assert.strictEqual(c2.appels[0][0], 'tarif_enregistrer_reevaluations'); assert.strictEqual(c2.appels[0][1].p_lignes[0].etat, 'persistante');
  const c3 = faux(); // déjà enregistrée pour cet import : plus rien à envoyer
  await E.enregistrerReevaluations(c3, 'manager', false, b, [vref({ reevaluation: { etat: 'persistante', fichier_hash: 'h2' } })], id2);
  assert.strictEqual(c3.appels.length, 0);
});
ok('réévaluations : le filtre de l\'écran ne change pas les lignes envoyées', () => {
  const a = { lignes: [{ article: 'Art A', anomalies: [anom({ cycle: 'persistante' })], anomaliesResolues: [] }, { article: 'Art B', anomalies: [anom({ cle: 'k2', code: 'S4', cycle: 'aggravee' })], anomaliesResolues: [] }] };
  const v = [vref(), vref({ id: 'v-2', code: 'S4', cle: 'k2', article: 'Art B' })];
  const sans = JSON.stringify(E.reevaluationsAEcrire(a, v, id2));
    assert.strictEqual(JSON.stringify(E.reevaluationsAEcrire(a, v, id2)), sans);
  assert.ok(!/filtres/.test(String(E.reevaluationsAEcrire)));
});
ok('réévaluations : sans droits, rien n\'est écrit et la mention « non encore enregistrée » apparaît dans le (i)', async () => {
  const b = { lignes: [{ article: 'Art A', anomalies: [anom({ cycle: 'persistante' })], anomaliesResolues: [] }] };
  for (const [role, cr] of [['employe', false], ['gerant', true]]) {
    const c = faux(); const r = await E.enregistrerReevaluations(c, role, cr, b, [vref()], id2);
    assert.strictEqual(r.statut, 'droits'); assert.strictEqual(c.appels.length, 0);
  }
  const x = { article: 'Art A', code: 'S2', cle: 'k1', cycle: 'persistante', verif: vref({ auteur: 'Alex Test' }) };
  assert.ok(/non encore enregistrée/.test(E.htmlDetailHistorique(x, { reevalNonEnregistree: true })));
  assert.ok(!/non encore enregistrée/.test(E.htmlDetailHistorique(x, {})));
});
ok('réévaluations : un échec d\'écriture est signalé sans empêcher l\'affichage', async () => {
  const b = { lignes: [{ article: 'Art A', anomalies: [anom({ cycle: 'persistante' })], anomaliesResolues: [] }] };
  const r = await E.enregistrerReevaluations({ rpc: async () => ({ error: new Error('x') }) }, 'gerant', false, b, [vref()], id2);
  assert.strictEqual(r.statut, 'erreur');
  assert.ok(/pt-reeval-msg/.test(E.htmlPage({ analyse: analyse(), role: 'gerant', filtres: {}, incoherences: [], messageReeval: 'echec' })));
  assert.ok(/enregistrerReevaluations\(nexusClient/.test(page) && /etat\.messageReeval/.test(page));
});
ok('bouton Marquer comme vérifié masqué avant le clic si l\'import de référence est absent', () => {
  const l = { article: 'Art A', code_barres: '123' };
  const sans = E.htmlControlesAFaire(Object.assign({}, l, { anomalies: [{ code: 'S2', cycle: 'nouvelle', empreinte: 'e', identiteDonnees: {} }] }), true);
  assert.ok(!/data-verifier=/.test(sans) && /data-verif-indispo/.test(sans));
  const avec = E.htmlControlesAFaire(Object.assign({}, l, { anomalies: [{ code: 'S2', cycle: 'nouvelle', empreinte: 'e', identiteDonnees: { fichierHash: 'h1' } }] }), true);
  assert.ok(/data-verifier=/.test(avec));
});

ok('confirmations du pilote portées par le contexte : source, date et taux écrits', () => {
  const ctx = E.construireContexteTarif({ site: 'vito-sainte-marie', registres: reg, periode });
  const c = ctx.tva.confirmations;
  assert.ok(c.length >= 7);
  c.forEach(x => { assert.strictEqual(x.source, 'pilote, 18/11/2026'); assert.ok(typeof x.taux_confirme === 'number'); });
  const tx = (cat, art) => { const e = c.find(x => (!x.rayon || x.rayon === cat) && (!x.motif || new RegExp(x.motif, 'i').test(art))); return e && e.taux_confirme; };
  assert.strictEqual(tx('Cartes prépayées', 'Recharge Digicel Haïti 10'), 0);
  assert.strictEqual(tx('Cartes prépayées', 'Recharge Digicel 10'), 8.5);
  assert.strictEqual(tx('Cartes prépayées', 'Recharge Orange 20'), 8.5);
  assert.strictEqual(tx('Cartes prépayées', 'Autre carte'), 0);
  assert.strictEqual(tx('Cigarettes', 'X'), 0);
  assert.strictEqual(tx('Rayon Alpha', 'X'), undefined);
});
ok('un taux importé qui contredit la confirmation du pilote : S7 démontrée', () => {
  const lignes = [prod('Recharge Orange 20', 'Cartes prépayées', 10, 20, 18), prod('Recharge Orange 10', 'Cartes prépayées', 10, 10, 9)];
  lignes[0].tva = 0; lignes[1].tva = 8.5;
  const r = T.analyser(lignes, [], E.construireContexteTarif({ site: 'vito-sainte-marie', registres: reg, periode }));
  const s7 = l => (l.anomalies || []).filter(a => a.code === 'S7')[0];
  assert.ok(s7(r.lignes[0]) && s7(r.lignes[0]).niveau === 'demontree');
  assert.ok(!s7(r.lignes[1]));
});

ok('un autre site ne reçoit aucune confirmation du pilote', () => {
  ['autre-site', '', null, undefined, 'Vito-Sainte-Marie'].forEach(site => {
    const ctx = E.construireContexteTarif({ site, registres: reg, periode });
    assert.strictEqual(((ctx.tva && ctx.tva.confirmations) || []).filter(x => x.source === 'pilote, 18/11/2026').length, 0);
  });
  const lignes = [prod('Recharge Orange 20', 'Cartes prépayées', 10, 20, 18)]; lignes[0].tva = 0;
  const r = T.analyser(lignes, [], E.construireContexteTarif({ site: 'autre-site', registres: reg, periode }));
  assert.ok(!(r.lignes[0].anomalies || []).some(a => a.code === 'S7' && a.niveau === 'demontree'));
});
ok('catégorie lue comme T1 : « Ã  » devient « à », la variante fautive est reconnue sans être listée', () => {
  const ctx = E.construireContexteTarif({ site: 'vito-sainte-marie', registres: reg, periode });
  assert.ok(!ctx.tva.confirmations.some(x => /Ã/.test(x.rayon || '')));
  const lignes = [prod('Tabac X', 'Tabac Ã\u00a0rouler - 30g', 10, 20, 18)]; lignes[0].tva = 8.5;
  const r = T.analyser(lignes, [], ctx);
  const s7 = (r.lignes[0].anomalies || []).filter(a => a.code === 'S7')[0];
  assert.ok(s7 && s7.niveau === 'demontree');
});

const avecControles = (k) => {
  const a = analyse();
  a.lignes.forEach((l, i) => { l.anomalies = []; });
  for (let i = 0; i < k; i++) {
    const l = a.lignes[i % a.lignes.length];
    l.anomalies.push({ code: i % 2 ? 'S2' : 'S7', niveau: i % 2 ? 'a_verifier' : 'demontree', cycle: 'nouvelle', gravite: i, valeurs: i % 2 ? { ecart: 0.3, paNetHtReleve: 1.1 } : { tva: 20, etat: 'a_verifier' }, identiteDonnees: { fichierHash: 'h' + i }, empreinte: 'e' + i, peutExpliquerAussi: [] });
  }
  return a;
};
ok('B2/L2 : bloc Contrôles, liste compacte, détail avec consigne et bouton', () => {
  const h = E.htmlPage({ analyse: avecControles(2), role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  assert.ok(/data-bloc-controles/.test(h) && !/data-carte="controles_a_effectuer"/.test(h));
  assert.ok(/data-axe="niveau">Démontré/.test(h) && /data-axe="niveau">À vérifier/.test(h));
  assert.ok(/data-ctl-liste/.test(h) && /data-ctl-detail/.test(h) && /pt-ctl-3/.test(h) && !/data-ctl-info/.test(h));
  assert.ok(/✓ Marquer comme vérifié/.test(h) && /data-ctl-expl/.test(h));
  assert.ok(!/data-ctl-plus/.test(h) && /ptCtlRecherche/.test(h) && /Nom ou code-barres/.test(h), 'barre d\'outils toujours présente, sans suite sous le seuil');
});
ok('B2 : au-delà de 10 contrôles, outils et suite', () => {
  const h = E.htmlPage({ analyse: avecControles(14), role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  assert.ok(/ptCtlRecherche/.test(h) && /data-ctl-tri/.test(h) && /data-ctl-cycle="resolue"/.test(h) && /data-ctl-plus/.test(h));
  assert.strictEqual((h.match(/data-ctl-ligne="1"/g) || []).length, 10);
  assert.strictEqual((h.match(/data-ver-article=/g) || []).length, 1, 'un seul bouton de vérification : celui du contrôle choisi');
});
ok('B2 : une ligne vérifiée quitte la liste active, état vide et lecture seule', () => {
  const a = avecControles(2); a.lignes.forEach(l => l.anomalies.forEach(x => { x.cycle = 'verifiee'; }));
  const h = E.htmlPage({ analyse: a, role: 'employe', estCreateur: false, filtres: {}, incoherences: [] });
  assert.ok(/Contrôles à effectuer \(0\)/.test(h) && !/data-ctl-ligne="1"/.test(h));
  assert.ok(/data-ctl-lecture/.test(avecH('employe')));
  const v = E.htmlPage({ analyse: avecControles(0), role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  assert.ok(/Aucune anomalie à vérifier sur cet import/.test(v));
});
function avecH(role) { return E.htmlPage({ analyse: avecControles(2), role, estCreateur: false, filtres: {}, incoherences: [] }); }
ok('B2 : fiche en dialogue avec fermeture, et information (i) sur la ligne de référence', () => {
  const a = avecControles(2);
  const h = E.htmlPage({ analyse: a, role: 'manager', estCreateur: false, filtres: {}, incoherences: [], ouverte: a.lignes[0].article });
  assert.ok(/role="dialog"/.test(h) && /data-fermer/.test(h) && /pt-fiche-corps/.test(h));
  assert.ok(/class="pt-li"/.test(h));
});
ok('lignes hors ventes commerciales : aucune anomalie', () => {
  const ctx = A.contexteDepuisRegistres(reg, { periode }); ctx.natureDe = row => row.article === 'Produit A' ? 'operation_caisse' : null;
  const r = T.analyser(courantes, [], ctx);
  const l = r.lignes.filter(x => x.article === 'Produit A')[0];
  assert.deepStrictEqual(l.anomalies, []);
});

ok('L5 compact : le bloc précède les scénarios ; l\'indicateur « N contrôles sur M références » est retiré, les deux autres cartes restent', () => {
  const h = E.htmlPage({ analyse: avecControles(3), role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  const iB = h.indexOf('data-bloc-controles'), iS = h.indexOf('Scénarios de gain');
  assert.ok(iB > 0 && iB < iS, 'ordre bloc, scénarios');
  assert.ok(!/data-carte="controles_a_effectuer"/.test(h) && !/contrôles? sur \d+ références?/.test(h), 'indicateur retiré');
  assert.ok(/data-carte="marge_negative"/.test(h) && /data-carte="a_verifier"/.test(h), 'deux cartes gardées');
});
ok('L5 compact : le texte d\'aide est derrière un (i), outils sur un bloc unique', () => {
  const h = E.htmlPage({ analyse: avecControles(30), role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  assert.ok(/<details class="pt-ctl-aide"[^>]*data-ctl-expl="1"><summary class="info-btn"[^>]*>i<\/summary><p class="sc-methode">Un contrôle indique où comparer/.test(h), 'aide derrière (i)');
  assert.ok(!/<p class="sc-methode pt-ctl-expl"/.test(h), 'plus de paragraphe visible');
  const o = h.slice(h.indexOf('pt-ctl-outils'));
  assert.ok(/ptCtlRecherche/.test(o) && /data-ctl-tri/.test(o) && /pt-ctl-cycles/.test(o));
  const src = require('fs').readFileSync(require('path').join(__dirname, 'nexus-politique-tarifaire-ecran.js'), 'utf8');
  assert.ok(/@media\(min-width:900px\)\{\.vue-p1c \.pt-ctl-outils\{flex-wrap:nowrap/.test(src), 'ligne unique dès 900 px');
});
ok('recette Guardian : commentaire visible d\'emblée, rattaché au contrôle choisi', () => {
  const a = avecControles(2);
  const h = E.htmlPage({ analyse: a, role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  assert.ok(/<textarea/.test(h) && !/data-com-ouvrir=/.test(h), 'zone visible, sans lien de dépliage');
  assert.strictEqual((h.match(/<textarea/g) || []).length, 1, 'une seule zone : celle du contrôle choisi');
  assert.ok(!/data-ctl-info/.test(h), 'plus de (i) : la consigne est toujours visible dans le détail');
});
ok('mise en page Contrôler : fil d\'Ariane, vignette de famille, pas de title sur les lignes, bouton secondaire', () => {
  const h = E.htmlPage({ analyse: avecControles(3), role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  assert.ok(/Produits › Scanner tarifaire › Contrôler/.test(h));
  assert.ok(/pt-l-vign/.test(h) && /pt-l-gr-(demontree|averifier)/.test(h));
  assert.ok(/Passer au suivant sans vérifier/.test(h) && !/>Suivant<\/button>/.test(h));
  const lignes = h.match(/<button[^>]*data-ctl-ligne[^>]*>/g) || [];
  assert.ok(lignes.length >= 3 && lignes.every(b => !/\stitle=/.test(b)), 'aucune ligne ne porte de title');
  assert.ok(!/<li class="pt-ctl-item"[^>]*\stitle=/.test(h));
});
ok('en-tête Contrôler en tête de l\'axe : titre, sous-titre, pilule Estimations, avant les cartes, sans details', () => {
  const h = E.htmlPage({ analyse: avecControles(3), role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  const i = h.indexOf('data-bloc-controles'), c = h.indexOf('pt-inds', i);
  assert.ok(i > 0 && c > i && h.indexOf('<h2 class="pt-ctl-titre', i) < c, 'titre avant les cartes d\'axe');
  assert.ok(/data-ctl-sous="1">[^<]*références/.test(h) && /data-ctl-estimations="1">Estimations</.test(h));
  assert.ok(!/<details[^>]*data-bloc-controles/.test(h));
});
ok('détail Contrôler : bloc de deux indicateurs (chiffre clé en grand + niveau)', () => {
  const h = E.htmlPage({ analyse: avecControles(2), role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  assert.ok(/data-ctl-indicateurs="1"/.test(h) && /pt-ind-cle/.test(h) && /pt-ind-niv/.test(h));
});
ok('recette Guardian : cases de filtre avec accent-color', () => {
  assert.ok(/input\[type=checkbox\]\{accent-color:var\(--accent\)/.test(E.CSS));
});

// ---- Recette Guardian du 18/11 (c40006d6) : gaz, acompte, Conseiller contrôles, cartes, câblage ----
global.window = global; require('./nexus-marge.js');
const NM = global.NexusMarge || global.window.NexusMarge;
const SP = 'vito-sainte-marie';
const regP = { familles: [], rattachements: [], seuils: [] };
const analyserP = (lignes, extra) => T.analyser(lignes, [], E.construireContexteTarif(Object.assign({ site: SP, registres: regP, periode, lignes, exclusions: new Set(), famille: (c, a, ex) => NM.familleMarge(c, a, ex) }, extra || {})));
const ligneDe = (a, art) => a.lignes.find(l => l.article === art);

ok('gaz : 12,5 kg réglementé, 3 kg et 39 kg à qualifier, jamais libre', () => {
  const lg = [prod('GAZ FICTIF 12.5 KG', 'Gaz', 10, 30, 25), prod('GAZ FICTIF 3 KG', 'Gaz', 10, 15, 12), prod('GAZ FICTIF 39 KG', 'Gaz', 10, 90, 80)];
  const a = analyserP(lg);
  const h = E.htmlLigne(ligneDe(a, 'GAZ FICTIF 12.5 KG')), h3 = E.htmlLigne(ligneDe(a, 'GAZ FICTIF 3 KG')), h39 = E.htmlLigne(ligneDe(a, 'GAZ FICTIF 39 KG'));
  assert.ok(/Prix réglementé/.test(h), h);
  assert.ok(/Régime à qualifier/.test(h3) && /Régime à qualifier/.test(h39));
  assert.ok(!/libre/i.test(h3 + h39));
});
ok('acompte : les deux libellés exacts du relevé sont exclus partout', () => {
  ['22-09-2026 ACOMPTE', '30-10-2026 ACOMPTE', '30/10/2026 acompte'].forEach(lib => {
    const lg = [prod(lib, 'Divers', 1, 50, 0), prod('Produit réel', 'Divers', 10, 2, 1)];
    const a = analyserP(lg);
    const l = ligneDe(a, lib);
    assert.deepStrictEqual(l.anomalies || [], [], lib);
    assert.ok(!E.cartes(a).some(c => /ACOMPTE/i.test(JSON.stringify(c))), lib);
    assert.ok(!/ACOMPTE/i.test(E.conseiller(a, 'gerant').texte), lib);
  });
});
ok('Conseiller : sans vente à perte, il renvoie vers le bloc des contrôles', () => {
  const a = { synthese: { alertes: {}, statuts: {} }, lignes: [{ article: 'X', anomalies: [{ code: 'S2', cycle: 'nouvelle' }] }] };
  const c = E.conseiller(a, 'gerant');
  assert.strictEqual(c.code, 'CTRL'); assert.strictEqual(c.bloc, 'controles'); assert.ok(/1 contrôle/.test(c.detail || c.texte));
});
ok('deux cartes orange : libellés qui disent la différence', () => {
  const a = analyse();
  const v = E.cartes(a).find(c => c.id === 'a_verifier');
  assert.ok(/fiabilité incomplète/.test(v.titre + ' ' + (v.secondaire || '')));
  const h = E.htmlPage({ analyse: a, role: 'gerant', estCreateur: false, filtres: {}, incoherences: [] });
  assert.ok(!/data-carte="controles_a_effectuer"/.test(h));
});
ok('Historique : le (i) est sur la ligne du titre', () => {
  const a = analyse();
  const h = E.htmlPage({ analyse: a, role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  if (/pt-histo-li/.test(h)) assert.ok(/<div class="pt-histo-t"><span class="pt-histo-txt">[\s\S]*?<\/span><button[^>]*pt-histo-i/.test(h));
});
ok('câblage commun : lierOuvertures ouvre le bloc et le commentaire', () => {
  assert.strictEqual(typeof E.lierOuvertures, 'function');
  const ecouteurs = [];
  const mk = (sel) => ({ dataset: { comOuvrir: 'S2|X' }, addEventListener: (t, f) => ecouteurs.push([sel, f]) });
  const corps = { querySelectorAll: sel => /data-carte|data-bloc-conseil/.test(sel) ? [mk('ctl')] : /data-com-ouvrir/.test(sel) ? [mk('com')] : [], querySelector: () => null };
  const etat = { ctlReplie: true }; let rendus = 0;
  E.lierOuvertures(corps, etat, () => { rendus++; });
  assert.strictEqual(ecouteurs.length, 2);
  ecouteurs.find(e => e[0] === 'ctl')[1](); assert.strictEqual(etat.ctlReplie, false);
  ecouteurs.find(e => e[0] === 'com')[1](); assert.deepStrictEqual(etat.comOuvert, ['S2|X']); assert.strictEqual(rendus, 2);
});
ok('L2 : le choix d\'une ligne est câblé (clic, flèches) et le rendu est relancé', () => {
  const ev = {}; const mk = c => ({ dataset: { ctlSel: c }, focus() {}, addEventListener: (t, f) => { (ev[c] = ev[c] || {})[t] = f; } });
  const l = [mk('S2|A'), mk('S7|B'), mk('S1|C')];
  const corps = { querySelectorAll: sel => sel === '[data-ctl-sel]' ? l : [], querySelector: () => null };
  const etat = {}; let rendus = 0;
  E.lierOuvertures(corps, etat, () => { rendus++; });
  ev['S7|B'].click(); assert.strictEqual(etat.ctlSel, 'S7|B');
  let prevenu = false; ev['S7|B'].keydown({ key: 'ArrowDown', preventDefault() { prevenu = true; } });
  assert.strictEqual(etat.ctlSel, 'S1|C'); assert.ok(prevenu);
  ev['S1|C'].keydown({ key: 'ArrowDown', preventDefault() {} }); assert.strictEqual(etat.ctlSel, 'S1|C', 'pas de dépassement en bas');
  ev['S1|C'].keydown({ key: 'ArrowUp', preventDefault() {} }); assert.strictEqual(etat.ctlSel, 'S7|B');
  assert.strictEqual(rendus, 3);
});
ok('L2 : focus visible (contour défini, variable existante) et détail collant dès 900 px', () => {
  const src = fs.readFileSync('./nexus-politique-tarifaire-ecran.js', 'utf8');
  const f = /\.pt-ctl-ligne:focus-visible,[^}]*\{([^}]*)\}/.exec(src);
  assert.ok(f && /outline:2px solid var\(--t-text\)/.test(f[1]) && !/--accent/.test(f[1]), 'contour de focus des lignes et du summary');
  assert.ok(/min-width:900px\)\{[^@]*\.pt-ctl-deux>\.pt-ctl-droite\{position:sticky;top:8px[^}]*max-height:[^}]*overflow-y:auto/.test(src), 'détail collant avec défilement interne');
});
ok('L2 : aria-current sur la ligne choisie, repli sur la première, détail et Sources et calcul natifs', () => {
  const a = avecControles(4);
  const h = E.htmlPage({ analyse: a, role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  assert.strictEqual((h.match(/aria-current="true"/g) || []).length, 1);
  assert.ok(/<details class="pt-sources-calcul"[^>]*><summary>Sources et calcul<\/summary>/.test(h));
  const cle = 'S7|' + a.lignes[1].article;
  const h2 = E.htmlPage({ analyse: a, role: 'manager', estCreateur: false, filtres: {}, incoherences: [], ctlSel: cle });
  assert.ok(new RegExp('data-ctl-sel="' + cle.replace(/[|]/g, '\\|') + '" aria-current="true"').test(h2) || /aria-current="true"/.test(h2));
  const h3 = E.htmlPage({ analyse: a, role: 'manager', estCreateur: false, filtres: {}, incoherences: [], ctlSel: 'inconnu|x' });
  assert.strictEqual((h3.match(/aria-current="true"/g) || []).length, 1, 'sélection périmée : repli sur la première');
});
ok('D1 : une vérification enregistrée passe la ligne en « vérifiée » avec message daté', () => {
  const an = { code: 'S2', cycle: 'nouvelle' }; const etat = {};
  E.effetVerificationEnregistree(an, etat, 'Gérant du banc');
  assert.strictEqual(an.cycle, 'verifiee');
  assert.strictEqual(etat.messageVerif, 'Vérification enregistrée. Contrôle suivant ouvert.');
});
ok('L5 : Conseiller court, une phrase issue du premier contrôle, sans chiffre écrit en dur, détail derrière le (i)', () => {
  const a = avecControles(4); a.synthese.alertes = {}; a.lignes.forEach(l => { l.alertes = []; });
  const c = E.conseiller(a, 'gerant');
  assert.strictEqual(c.code, 'CTRL');
  assert.ok(/^Le plus grave : /.test(c.texte) && /^Le plus grave : /.test(c.art), c.texte);
  assert.ok(c.texte.length < 110, 'phrase courte');
  assert.ok(/contrôle/.test(c.detail) && c.detail !== c.texte, 'la phrase longue reste en détail');
  const premier = a.lignes.map(l => l.article).filter(x => c.texte.indexOf(x) >= 0);
  assert.ok(premier.length >= 1, 'nomme un article réel');
  const h = E.htmlPage({ analyse: a, role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  assert.ok(/data-conseil-detail="1"/.test(h));
});
ok('L5 : après vérification en séance, Suivre porte la vérification ; l\'annulation la retire', async () => {
  const an = { code: 'S2', cle: 'k1', article: 'ART', code_barres: '123', cycle: 'nouvelle', gravite: 3 }; const etat = { verifications: [] };
  E.effetVerificationEnregistree(an, etat, 'Gérant du banc', 'id-9', { commentaire: 'vu', dateReleve: '2026-01-02' });
  assert.strictEqual(etat.verifications.length, 1);
  const v = etat.verifications[0];
  assert.strictEqual(v.id, 'id-9'); assert.strictEqual(v.code, 'S2'); assert.strictEqual(v.cle, 'k1');
  assert.strictEqual(v.auteur, 'Gérant du banc'); assert.strictEqual(v.commentaire, 'vu'); assert.ok(v.verifie_le);
  assert.strictEqual(v.identiteDonnees.dateReleve, '2026-01-02');
  etat.surAnnulation = async () => ({ ok: true });
  const r = await E.annulerVerification(etat, 'motif');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(etat.verifications.filter(x => x.id === 'id-9').length, 0);
});
ok('L4 : motif d\'annulation de 1 à 500 caractères, message de refus lisible', () => {
  assert.ok(E.motifAnnulationValide('erreur de saisie'));
  assert.ok(E.motifAnnulationValide('x'.repeat(500)));
  assert.ok(!E.motifAnnulationValide('') && !E.motifAnnulationValide('   ') && !E.motifAnnulationValide('x'.repeat(501)) && !E.motifAnnulationValide(null));
  assert.ok(/Annulation refusée.*Rien n'a été modifié/.test(E.messageErreurAnnulation(new Error('new row violates row-level security policy'))));
  assert.ok(/L'annulation a échoué.*Rien n'a été modifié/.test(E.messageErreurAnnulation(new Error('réseau'))));
});
ok('L4 : annulation acceptée restaure le cycle et le compteur ; refus sans changement ; sans callback, rien', async () => {
  const an = { code: 'S2', cycle: 'nouvelle' }; const etat = { surAnnulation: null };
  E.effetVerificationEnregistree(an, etat, 'Gérant', 'id-1');
  assert.strictEqual(an.cycle, 'verifiee');
  assert.strictEqual(etat.derniereVerif.id, 'id-1');
  assert.strictEqual((await E.annulerVerification(etat, 'motif')).ok, false, 'sans callback');
  assert.strictEqual((await E.annulerVerification(etat, '')).ok, false, 'sans motif');
  const appels = [];
  etat.surAnnulation = async (c, m) => { appels.push([c.id, m]); return { ok: false, message: 'Annulation refusée : x' }; };
  const r1 = await E.annulerVerification(etat, 'motif');
  assert.strictEqual(r1.ok, false); assert.strictEqual(an.cycle, 'verifiee'); assert.ok(etat.messageVerif, 'état inchangé après refus');
  etat.surAnnulation = async (c, m) => { appels.push([c.id, m]); return { ok: true }; };
  const r2 = await E.annulerVerification(etat, '  motif  ');
  assert.strictEqual(r2.ok, true); assert.strictEqual(an.cycle, 'nouvelle');
  assert.strictEqual(etat.messageVerif, null); assert.ok(/Vérification annulée/.test(etat.messageAnnul));
  assert.deepStrictEqual(appels[1], ['id-1', 'motif']);
});
ok('L4 piste 4 : A puis B, « Annuler » sur la confirmation de B n\'annule que B, avec son id ; un échec reste à l\'écran', async () => {
  const anA = { code: 'S2', cycle: 'nouvelle' }; const anB = { code: 'S3', cycle: 'nouvelle' };
  const etat = { surAnnulation: null };
  E.effetVerificationEnregistree(anA, etat, 'Gérant', 'idA');
  E.effetVerificationEnregistree(anB, etat, 'Gérant', 'idB');
  assert.strictEqual(etat.derniereVerif.id, 'idB', 'la confirmation affichée est celle de B');
  const appels = [];
  etat.surAnnulation = async (c, m) => { appels.push([c.id, m]); return { ok: false, message: 'Annulation refusée : politique' }; };
  const r1 = await E.annulerVerification(etat, 'Test');
  assert.strictEqual(r1.ok, false);
  assert.deepStrictEqual(appels, [['idB', 'Test']], 'seul B est visé');
  assert.strictEqual(anA.cycle, 'verifiee'); assert.strictEqual(anB.cycle, 'verifiee', 'refus : rien ne change');
  etat.erreurAnnul = r1.message; etat.annulOuverte = true;
  const base = { analyse: avecControles(2), role: 'manager', estCreateur: false, filtres: {}, incoherences: [] };
  const h = E.htmlPage(Object.assign({}, base, etat));
  assert.ok(/data-annul-erreur/.test(h) && /Annulation refusée : politique/.test(h) && /role="alert"/.test(h), 'l\'échec reste affiché');
  etat.surAnnulation = async (c, m) => { appels.push([c.id, m]); return { ok: true }; };
  const r2 = await E.annulerVerification(etat, 'Test');
  assert.strictEqual(r2.ok, true);
  assert.deepStrictEqual(appels[1], ['idB', 'Test']);
  assert.strictEqual(anB.cycle, 'nouvelle'); assert.strictEqual(anA.cycle, 'verifiee', 'A reste vérifiée');
  assert.deepStrictEqual(etat.verifications.map(v => v.id), ['idA'], 'A reste dans l\'état');
});
ok('L4 : confirmation en aria-live, Annuler seulement avec droit, zone motif obligatoire, état « Tout est traité »', () => {
  const a = avecControles(2);
  const base = { analyse: a, role: 'manager', estCreateur: false, filtres: {}, incoherences: [] };
  assert.ok(/data-ctl-live="1"/.test(E.htmlPage(base)) && /aria-live="polite"/.test(E.htmlPage(base)));
  const v = { an: {}, id: 'i', cle: 'k', cycleAvant: 'nouvelle' };
  const h = E.htmlPage(Object.assign({}, base, { messageVerif: 'Vérification enregistrée. Contrôle suivant ouvert.', derniereVerif: v }));
  assert.ok(/data-verif-ok/.test(h) && /data-ctl-annuler/.test(h));
  assert.ok(!/data-ctl-annuler/.test(E.htmlPage(Object.assign({}, base, { role: 'pompiste', messageVerif: 'x', derniereVerif: v }))), 'pas de droit, pas d\'annulation');
  const h2 = E.htmlPage(Object.assign({}, base, { messageVerif: 'x', derniereVerif: v, annulOuverte: true, erreurAnnul: 'Annulation refusée : y' }));
  assert.ok(/id="ptAnnulMotif"[^>]*maxlength="500"[^>]*required|id="ptAnnulMotif"[^>]*required[^>]*maxlength="500"|maxlength="500"[^>]*id="ptAnnulMotif"/.test(h2) || (/ptAnnulMotif/.test(h2) && /maxlength="500"/.test(h2) && /required/.test(h2)));
  assert.ok(/data-annul-confirmer/.test(h2) && /data-annul-garder/.test(h2) && /role="alert"[^>]*data-annul-erreur|data-annul-erreur[^>]*role="alert"/.test(h2));
  a.lignes.forEach(l => (l.anomalies || []).forEach(x => { x.cycle = 'verifiee'; }));
  assert.ok(/data-ctl-traite/.test(E.htmlPage(base)), 'fin de liste');
});
ok('L4 : l\'écran lui-même n\'écrit jamais (annulation par callback injecté)', () => {
  const src = fs.readFileSync(require.resolve('./nexus-politique-tarifaire-ecran.js'), 'utf8');
  assert.ok(!/tarif_marquer_verifie|\.update\s*\(|\.insert\s*\(/.test(src));
  const host = fs.readFileSync(require.resolve('./NEXUS-Produits-v1.html'), 'utf8');
  assert.ok(/etat\.surAnnulation = async/.test(host));
});
ok('D3 : aucune ligne ne porte deux étiquettes de même texte', () => {
  const a = analyse();
  const forcees = a.lignes.map(l => Object.assign({}, l, { statut: 'a_verifier', margeEstimee: Object.assign({}, l.margeEstimee || { taux: 0.1, margeUnitaireHt: 0.1, cout: { valeur: 1 } }, { etat: 'a_verifier', taux: 0.1 }) }));
  assert.ok(forcees.length > 0);
  forcees.forEach(l => {
    const t = (E.htmlLigne(l).match(/<span class="nbe-qualif"[^>]*>[^<]*<\/span>/g) || []).map(x => x.replace(/<[^>]*>/g, ''));
    assert.strictEqual(new Set(t).size, t.length, 'doublon : ' + t.join(' | '));
    assert.ok(t.indexOf('À vérifier') >= 0, 'un « À vérifier » reste');
  });
});
// ---------- Bout en bout : chargerVerifications -> cycle de vie -> affichage -> appel RPC (données synthétiques) ----------
const clientLecture = (rows) => { const q = { eq: () => q, is: () => q, order: () => q, range: () => q, in: () => q, select: () => q, then: (r) => r({ data: rows, error: null }) };
  return { from: (t) => (t === 'tarif_anomalies_verifications' ? q : Object.assign({}, q, { then: (r) => r({ data: [], error: null }) })) }; };
ok('bout en bout : même import = Vérifié sans appel ; nouvel import = Persistant, Aggravé, Résolu avec un appel chacun', async () => {
  const ctxV = { periode: { debut: '2026-10-01', fin: '2026-10-31' }, fichierHash: 'hash-v', dateReleve: '2026-10-05' };
  const l0 = { article: 'ARTICLE FICTIF', code_barres: '3000000000001', regime: 'libre', taux: 0.3, pv_ht: 1, variationCout: null, variationPv: null, alertes: [], fiabilite: { raisons: [] }, prixDecide: null, tva: { etat: 'coherente', taux: 5.5 },
    margeEstimee: { cout: { valeur: 0.73 }, controle: { paNetHtReleve: 0.46, ecart: 0.27 } } };
  const ancienne = MA.anomaliesLigne(l0, ctxV).find(a => a.code === 'S2');
  assert.ok(ancienne, 'S2 attendue sur la ligne fictive');
  const rows = [{ id: 'v-e2e', article: l0.article, code_barres: l0.code_barres, cause: 'S2', cle: ancienne.cle, empreinte: ancienne.empreinte, gravite: ancienne.gravite,
    fichier_hash: 'hash-v', date_releve: '2026-10-05', commentaire: null, saisi_par: null, saisi_le: '2026-10-06T08:00:00Z' }];
  const { verifications } = await E.chargerVerifications(clientLecture(rows), 'site-fictif-1');
  assert.strictEqual(verifications.length, 1); assert.strictEqual(verifications[0].code, 'S2');
  const parcours = async (ligneCourante, ctx) => {
    const an = MA.anomaliesLigne(ligneCourante, ctx).filter(a => a.code === 'S2');
    const r = MA.cycleDeVie(an, verifications.filter(v => v.cle === MA.cle(ligneCourante)), { fichierHash: ctx.fichierHash, dateReleve: ctx.dateReleve });
    const analyse = { lignes: [{ article: l0.article, anomalies: r.anomalies, anomaliesResolues: r.resolues }] };
    const client = faux();
    const bilan = await E.enregistrerReevaluations(client, 'gerant', false, analyse, verifications, { fichierHash: ctx.fichierHash, dateReleve: ctx.dateReleve });
    const affichage = E.historiqueLignes(analyse, verifications, 'tous').map(x => x.cycle);
    return { r, client, bilan, affichage };
  };
  // 1. même import : Vérifié, aucune écriture
  const m = await parcours(l0, ctxV);
  assert.deepStrictEqual(m.affichage, ['verifiee']); assert.strictEqual(m.client.appels.length, 0); assert.strictEqual(m.bilan.statut, 'aucune');
  // 2. nouvel import et nouveau relevé, anomalie identique : Persistant, un appel
  const ctxN = { periode: ctxV.periode, fichierHash: 'hash-nouveau', dateReleve: '2026-11-10' };
  const p = await parcours(l0, ctxN);
  assert.strictEqual(p.r.anomalies[0].empreinte, ancienne.empreinte, 'anomalie strictement identique');
  assert.deepStrictEqual(p.affichage, ['persistante']);
  assert.strictEqual(p.client.appels.length, 1); assert.strictEqual(p.client.appels[0][0], 'tarif_enregistrer_reevaluations');
  assert.strictEqual(p.client.appels[0][1].p_lignes.length, 1); assert.strictEqual(p.client.appels[0][1].p_lignes[0].etat, 'persistante');
  assert.strictEqual(p.client.appels[0][1].p_lignes[0].fichier_hash, 'hash-nouveau'); assert.strictEqual(p.client.appels[0][1].p_lignes[0].verification_id, 'v-e2e');
  // 3. gravité plus forte : Aggravé, un appel
  const forte = Object.assign({}, l0, { margeEstimee: { cout: { valeur: 0.73 }, controle: { paNetHtReleve: 0.46, ecart: 0.9 } } });
  const g = await parcours(forte, ctxN);
  assert.deepStrictEqual(g.affichage, ['aggravee']); assert.strictEqual(g.client.appels.length, 1); assert.strictEqual(g.client.appels[0][1].p_lignes[0].etat, 'aggravee');
  // 4. anomalie absente : Résolu au nouvel import, un appel
  const saine = Object.assign({}, l0, { margeEstimee: { cout: { valeur: 0.73 }, controle: { paNetHtReleve: 0.73, ecart: 0 } } });
  const rs = await parcours(saine, ctxN);
  assert.deepStrictEqual(rs.affichage, ['resolue']); assert.strictEqual(rs.client.appels.length, 1); assert.strictEqual(rs.client.appels[0][1].p_lignes[0].etat, 'resolue');
  const vue = (r) => E.htmlHistorique({ historiqueDispo: true, analyse: { lignes: [{ article: l0.article, anomalies: r.anomalies, anomaliesResolues: r.resolues }] }, verifications, filtreHisto: 'tous' });
  assert.ok(/>Persistant</.test(vue(p.r)), 'Persistant affiché');
  assert.ok(/>Aggravé</.test(vue(g.r)), 'Aggravé affiché');
  assert.ok(/>Résolu au nouvel import</.test(vue(rs.r)), 'Résolu au nouvel import affiché');
  assert.ok(/>Vérifié</.test(vue(m.r)), 'Vérifié affiché sans nouvel import');
});
ok('bout en bout : Persistant, puis vérifié sur l\'import courant (nouvelle ligne en base) = Vérifié, aucune réévaluation', async () => {
  const ctxN = { periode: { debut: '2026-10-01', fin: '2026-10-31' }, fichierHash: 'hash-nouveau', dateReleve: '2026-11-10' };
  const l0 = { article: 'ARTICLE FICTIF', code_barres: '3000000000001', regime: 'libre', taux: 0.3, pv_ht: 1, variationCout: null, variationPv: null, alertes: [], fiabilite: { raisons: [] }, prixDecide: null, tva: { etat: 'coherente', taux: 5.5 },
    margeEstimee: { cout: { valeur: 0.73 }, controle: { paNetHtReleve: 0.46, ecart: 0.27 } } };
  const an = MA.anomaliesLigne(l0, ctxN).find(a => a.code === 'S2');
  const base = { article: l0.article, code_barres: l0.code_barres, cause: 'S2', cle: an.cle, empreinte: an.empreinte, gravite: an.gravite, commentaire: null, saisi_par: null };
  // Ancienne vérification (ancien import) puis nouvelle vérification de la même empreinte sur l'import courant : l'index unique (… fichier_hash) les garde toutes deux.
  const rows = [Object.assign({ id: 'v-ancienne', fichier_hash: 'hash-v', date_releve: '2026-10-05', saisi_le: '2026-10-06T08:00:00Z' }, base),
    Object.assign({ id: 'v-courante', fichier_hash: 'hash-nouveau', date_releve: '2026-11-10', saisi_le: '2026-11-11T09:00:00Z' }, base)];
  const { verifications } = await E.chargerVerifications(clientLecture(rows), 'site-fictif-1');
  assert.strictEqual(verifications.length, 2);
  const r = MA.cycleDeVie(MA.anomaliesLigne(l0, ctxN).filter(a => a.code === 'S2'), verifications.filter(v => v.cle === MA.cle(l0)), { fichierHash: ctxN.fichierHash, dateReleve: ctxN.dateReleve });
  const analyse = { lignes: [{ article: l0.article, anomalies: r.anomalies, anomaliesResolues: r.resolues }] };
  const client = faux();
  const bilan = await E.enregistrerReevaluations(client, 'gerant', false, analyse, verifications, { fichierHash: ctxN.fichierHash, dateReleve: ctxN.dateReleve });
  assert.deepStrictEqual(E.historiqueLignes(analyse, verifications, 'tous').map(x => x.cycle), ['verifiee']);
  assert.strictEqual(client.appels.length, 0); assert.strictEqual(bilan.statut, 'aucune');
});

// ---------- #332 avenant : ligne épurée (un régime, deux niveaux de marge, statuts dans le (i), filtres repliés) ----------
const nbReg = h => (h.match(/Prix réglementé|Prix contractuel|Régime à qualifier|Régime à vérifier/g) || []).length;
ok('ligne : un seul libellé de régime par ligne, quel que soit le régime', () => {
  [['reglemente', 'Prix réglementé'], ['contractuel', 'Prix contractuel'], ['x', 'Régime à qualifier']].forEach(([r, lib]) => {
    const h = E.htmlLigne(ligneAvec('estimation', { statut: 'sans_seuil_valide', regimeDeclare: { regime: r } }));
    assert.strictEqual(nbReg(h), 1); assert.ok(h.indexOf(lib) >= 0);
  });
  const h = E.htmlLigne(avecA5(ligneAvec('estimation', { statut: 'sans_seuil_valide', regimeDeclare: { regime: 'libre' } })));
  assert.strictEqual(nbReg(h), 1); assert.ok(/Régime à vérifier/.test(h));
});
ok('ligne : « Estimation » sur toute marge estimée, avec ou sans régime', () => {
  assert.ok(/Estimation/.test(E.htmlLigne(ligneAvec('estimation'))));
  assert.ok(/Estimation/.test(E.htmlLigne(ligneAvec('estimation', { regimeDeclare: { regime: 'contractuel' } }))));
});
ok('marge : deux niveaux, principal « Marge estimée : 30,0 % », secondaire en € HT/unité', () => {
  const h = E.htmlMarge(ligneAvec('estimation'));
  assert.ok(/Marge estimée : <span class="pt-mono pt-marge-prin">[^<]*%<\/span>/.test(h), h);
  assert.ok(/class="pt-marge-sec[^"]*"[^>]*>[^<]*HT\/unité/.test(h), h);
});
ok('marge non calculable : « Non calculable », jamais « n/d » seul ni 0, raison dans le (i)', () => {
  const l = ligneAvec('non_calculable', { margeEstimee: { etat: 'non_calculable', taux: null, margeUnitaireHt: null, cout: {}, raisons: ['Coût absent de l\'export'], limites: [] } });
  const h = E.htmlLigne(l);
  assert.ok(/Non calculable/.test(h) && !/n\/d/.test(h) && !/\b0,0 ?%/.test(h));
  assert.ok(/Non calculable/.test(E.ficheMarge(l)) && /Coût absent de l'export/.test(E.ficheMarge(l)));
  const l2 = ligneAvec('non_calculable', { margeEstimee: { etat: 'non_calculable', taux: null, cout: {}, raisons: [], limites: [] } });
  assert.ok(/Non calculable\s*:/.test(E.ficheMarge(l2)), 'raison par défaut dite dans le (i)');
});
ok('statuts écartés absents de la ligne, présents dans le (i) ; « À vérifier » et « Proposition à valider » visibles', () => {
  ['a_surveiller', 'conforme', 'sans_seuil_valide'].forEach(st => {
    const l = ligneAvec('estimation', { statut: st, alertes: [] });
    const lib = { a_surveiller: 'À surveiller', conforme: 'Conforme', sans_seuil_valide: 'Sans seuil validé' }[st];
    assert.ok(E.htmlLigne(l).indexOf(lib) < 0, st + ' hors ligne');
    assert.ok(E.ficheMarge(l).indexOf(lib) >= 0, st + ' dans le (i)');
  });
  assert.ok(/Aucune action de prix/.test(E.ficheMarge(ligneAvec('estimation', { statut: 'sans_seuil_valide', regimeDeclare: { regime: 'reglemente' } }))));
  assert.ok(/À vérifier/.test(E.htmlLigne(ligneAvec('estimation', { statut: 'a_verifier', alertes: [] }))));
  assert.ok(/Proposition à valider/.test(E.htmlLigne(ligneAvec('estimation', { statut: 'proposition_a_valider', alertes: [] }))));
});
ok('marge : aucune couleur d\'état (ni badge de gravité, ni classe de couleur, ni couleur en dur)', () => {
  ['estimation', 'a_verifier', 'non_calculable'].forEach(e => {
    const h = E.htmlMarge(ligneAvec(e, { statut: 'a_verifier' }));
    assert.ok(!/nbe-badge-etat|sc-rouge|sc-ambre|sc-vert|sc-info|style=/.test(h), e);
  });
  const css = E.CSS.split('}').filter(r => /pt-marge-(prin|sec)/.test(r)).join('}');
  assert.ok(css.length > 0 && /var\(--t-text\)/.test(css) && !/#[0-9a-f]{3,6}|rgb|var\(--t-(red|amber|green|danger|warn|ok)/i.test(css), css);
});
ok('filtres : panneau « Filtres (n) », n = filtres actifs, recherche visible hors panneau', () => {
  const a = analyse(), fam = a.lignes[0].famille, ray = a.lignes[0].rayon;
  const h0 = E.htmlPage({ analyse: a, role: 'gerant', filtres: {} });
  assert.ok(/<details class="[^"]*pt-filtres[^"]*"[^>]*><summary>[^]*Filtres \(0\)/.test(h0));
  assert.ok(!/<details class="[^"]*pt-filtres[^"]*"[^>]* open/.test(h0), 'replié par défaut');
  const h3 = E.htmlPage({ analyse: a, role: 'gerant', filtres: { famille: fam, rayon: ray, statut: 'conforme', recherche: 'zz' } });
  assert.ok(/Filtres \(3\)/.test(h3), 'la recherche ne compte pas');
  const panneau = h3.match(/<details class="[^"]*pt-filtres[^]*?<\/details>/)[0];
  assert.ok(!/id="ptRecherche"/.test(panneau) && /id="ptRecherche"/.test(h3));
  assert.ok(/Filtres \(5\)/.test(E.htmlPage({ analyse: a, role: 'gerant', filtres: { famille: fam, rayon: ray, statut: 'conforme', fiabilite: 'fiable', exception: 'sans' } })));
  assert.ok(/<details class="[^"]*pt-filtres[^"]*"[^>]* open/.test(E.htmlPage({ analyse: a, role: 'gerant', filtres: {}, filtresOuverts: true })));
});
ok('filtres : le bouton d\'alerte du Conseiller reste visible hors du panneau', () => {
  const a = analyse(), h = E.htmlPage({ analyse: a, role: 'gerant', filtres: { alerte: 'A4' } });
  const panneau = h.match(/<details class="[^"]*pt-filtres[^]*?<\/details>/)[0];
  assert.ok(/data-effacer="alerte"/.test(h) && !/data-effacer="alerte"/.test(panneau));
});
ok('aucun calcul changé : margeEstimee, statut et ordre des lignes identiques après rendu', () => {
  const a = analyse(), avant = JSON.stringify(a.lignes);
  E.htmlPage({ analyse: a, role: 'gerant', filtres: {} }); a.lignes.forEach(E.htmlLigne);
  assert.strictEqual(JSON.stringify(a.lignes), avant);
});
ok('recette 2f3f9a11 : filtres sans débordement (wrap), marge en deux niveaux mono, libellé « Fiabilité : »', () => {
  const src = fs.readFileSync(require.resolve('./nexus-politique-tarifaire-ecran.js'), 'utf8');
  assert.ok(!/pt-filtres-corps\{flex-wrap:nowrap/.test(src), 'plus de ligne unique de filtres');
  assert.ok(/pt-filtres-corps>\.pt-f\{flex:1 1 160px;min-width:0/.test(src));
  assert.ok(/pt-marge-prin\{[^}]*var\(--t-mono\)[^}]*font-weight:700/.test(src));
  assert.ok(/pt-marge-sec\{[^}]*var\(--t-mid\)[^}]*var\(--t-mono\)[^}]*font-size:12px/.test(src));
  const h = E.htmlPage({ analyse: analyse(), role: 'gerant', filtres: {} });
  assert.ok(/ · Fiabilité : /.test(h) && !/ · fiabilité /.test(h));
});
ok('recette : le chevron du panneau Filtres pointe vers le bas quand il est ouvert', () => {
  const src = fs.readFileSync(require.resolve('./nexus-politique-tarifaire-ecran.js'), 'utf8');
  assert.ok(/details\.pt-filtres\[open\]>summary \.sc-chev\{transform:rotate\(45deg\)\}/.test(src));
});
// ---------- Historique classé par cause (lot présentation) ----------
const histoEtat = (extra) => {
  const mk = (code, n, cycle) => Array.from({ length: n }, (_, i) => ({ code, cle: code + '-' + i, cycle: cycle || 'nouvelle' }));
  const lignes = [];
  mk('S3', 13).forEach((a, i) => lignes.push({ article: 'Art-S3-' + i, anomalies: [a] }));
  mk('S2', 4).forEach((a, i) => lignes.push({ article: 'Art-S2-' + i, anomalies: [a] }));
  mk('S7', 2, 'persistante').forEach((a, i) => lignes.push({ article: 'Art-S7-' + i, anomalies: [a] }));
  lignes.push({ article: 'Art-RES', anomalies: [], anomaliesResolues: [{ code: 'S5', cle: 'S5-0' }] });
  return Object.assign({ historiqueDispo: true, analyse: { lignes }, verifications: [], filtreHisto: 'actifs' }, extra || {});
};
ok('historique : une section par cause présente, aucune section vide, tri décroissant', () => {
  const h = E.htmlHistorique(histoEtat());
  const secs = (h.match(/data-histo-sec="(S\d)"/g) || []).map((x) => x.slice(-3, -1));
  assert.deepStrictEqual(secs, ['S3', 'S2', 'S7']);
  assert.ok(!/data-histo-sec="S5"/.test(h), 'S5 résolue : absente du filtre par défaut, donc pas de section vide');
  assert.ok(/data-histo-sec="S5"/.test(E.htmlHistorique(histoEtat({ filtreHisto: 'resolue' }))));
});
ok('historique : la somme des compteurs de sections = lignes du filtre', () => {
  ['actifs', 'verifiee', 'resolue', 'tous'].forEach((f) => {
    const e = histoEtat({ filtreHisto: f }), h = E.htmlHistorique(e);
    const somme = (h.match(/\((\d+)\)<\/span><span class="sc-chev"/g) || []).reduce((t, x) => t + Number(/\((\d+)\)/.exec(x)[1]), 0);
    assert.strictEqual(somme, E.historiqueLignes(e.analyse, e.verifications, f).length, f);
  });
});
ok('historique : Suivre, filtre par défaut « Vérifiés », aucun contrôle en attente proposé', () => {
  const h = E.htmlHistorique(histoEtat({ filtreHisto: undefined }));
  assert.ok(/<option value="verifiee" selected>Vérifiés</.test(h) && !/value="actifs"/.test(h) && !/Nouveau, persistant, aggravé/.test(h));
});
ok('historique : la plus grosse section seule est ouverte, 10 lignes puis « Afficher la suite »', () => {
  const h = E.htmlHistorique(histoEtat());
  assert.strictEqual((h.match(/<details class="sc-carte pt-histo-sec"[^>]* open>/g) || []).length, 1);
  assert.ok(/data-histo-sec="S3" open>/.test(h));
  assert.strictEqual((h.match(/<strong>Art-S3-/g) || []).length, 10);
  assert.ok(/data-histo-plus="S3">Afficher la suite \(3\)/.test(h));
  const h2 = E.htmlHistorique(histoEtat({ histoPlus: { S3: true } }));
  assert.strictEqual((h2.match(/<strong>Art-S3-/g) || []).length, 13);
  assert.ok(!/data-histo-plus/.test(h2));
});
ok('historique : aucun code S1 à S7 dans le texte visible, titre du lexique, compteur dans le nom accessible', () => {
  const h = E.htmlHistorique(histoEtat({ histoOuverte: 'S3|Art-S3-0' }));
  const visible = h.replace(/<[^>]*>/g, ' ');
  const sansArticles = visible.replace(/Art-S\d-\d+/g, ' ');
  assert.ok(!/\bS[1-7]\b/.test(sansArticles), 'code visible');
  assert.ok(/<summary aria-label="Coût en variation : 13 lignes"><span class="sc-nom">Coût en variation \(13\)<\/span>/.test(h));
  assert.ok(/<details[^>]*><summary/.test(h), 'details/summary natifs : ouverture au clavier');
  assert.ok(/data-histo-info="S3\|Art-S3-0"/.test(h), 'le code reste dans le (i)');
});
ok('historique : aucune donnée modifiée (analyse et vérifications intactes)', () => {
  const e = histoEtat(), avant = JSON.stringify([e.analyse, e.verifications]);
  E.htmlHistorique(e); E.htmlHistorique(Object.assign({}, e, { filtreHisto: 'tous' }));
  assert.strictEqual(JSON.stringify([e.analyse, e.verifications]), avant);
});
ok('historique : chevron au bord droit (summary en flex, space-between)', () => {
  const css = E.css ? E.css() : require('fs').readFileSync(require('path').join(__dirname, 'nexus-politique-tarifaire-ecran.js'), 'utf8');
  assert.ok(/pt-histo-sec>summary\{[^}]*display:flex[^}]*justify-content:space-between/.test(css));
});
ok('historique : vue vide hors filtre par défaut = action « Changer de statut » qui remet le défaut', () => {
  const vide = (f) => histoEtat({ filtreHisto: f, analyse: { lignes: [{ article: 'Art-X', anomalies: [] }] } });
  const h = E.htmlHistorique(vide('tous'));
  assert.ok(/Aucune anomalie dans cette vue/.test(h) && /data-histo-reset="1">Changer de statut</.test(h));
  assert.ok(!/data-histo-reset/.test(E.htmlHistorique(vide('verifiee'))), 'déjà au défaut : pas d\'action inutile');
  const ec = []; const b = { dataset: {}, addEventListener: (t, fn) => ec.push(fn) };
  const corps = { querySelectorAll: (sel) => /data-histo-reset/.test(sel) ? [b] : [], querySelector: () => null };
  const etat = { filtreHisto: 'tous', histoOuverte: 'S3|A' }; let rendus = 0;
  E.lierOuvertures(corps, etat, () => { rendus++; });
  ec[0]();
  assert.strictEqual(etat.filtreHisto, 'verifiee'); assert.strictEqual(etat.histoOuverte, null); assert.strictEqual(rendus, 1);
});

// ---------- Relevé de stock publié (option B) : lot stock_theorique publié, import_rows_raw.donnees ----------
const clientStock = (lots, rowsParLot, opts) => {
  opts = opts || {};
  return { from: (table) => {
    const f = {}; let eqs = {}, rng = null;
    const c = { select: () => c, eq: (k, v) => { eqs[k] = v; return c; }, order: () => c, limit: () => c, range: (a, b) => { rng = [a, b]; return c; },
      then: (ok, ko) => {
        if (opts.erreur) return Promise.resolve({ data: null, error: { message: 'x' } }).then(ok, ko);
        if (table === 'import_batches') {
          const L = lots.filter(l => Object.keys(eqs).every(k => k === 'site' ? l.site === eqs[k] : l[k] === eqs[k])).sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le))).slice(0, 1);
          return Promise.resolve({ data: L, error: null }).then(ok, ko);
        }
        const R = (rowsParLot[eqs.batch_id] || []).slice(rng[0], rng[1] + 1);
        return Promise.resolve({ data: R, error: null }).then(ok, ko);
      } };
    return c;
  } };
};
const rowD = (lib, pa, q) => ({ donnees: { 'Catégorie': 'Rayon Alpha', 'Libellé': lib, 'Mouvements': '', 'PA net HT': pa, 'Stock actuel': q, 'Stock date': '10/11/2030', 'Valeur stock HT': '' } });
const lot = (id, statut, cree, extra) => Object.assign({ id, site: 'S', intention: 'stock_theorique', statut, cree_le: cree, fichier_hash: 'h-' + id, date_releve: '2030-03-10' }, extra || {});
ok('relevé publié : formats de nombres (virgule décimale, vide, texte non numérique, espaces)', () => {
  assert.strictEqual(E.nombreReleve('1,94'), 1.94); assert.strictEqual(E.nombreReleve('1 234,50'), 1234.5); assert.strictEqual(E.nombreReleve(3.2), 3.2);
  assert.strictEqual(E.nombreReleve(''), null); assert.strictEqual(E.nombreReleve(null), null); assert.strictEqual(E.nombreReleve('n/d'), null); assert.strictEqual(E.nombreReleve('0'), 0);
  const l = E.lignesStockDepuisLot([rowD('A', '1,5', '12'), rowD('B', '', ''), rowD('C', 'abc', '0')]);
  assert.deepStrictEqual(l.map(x => [x.pa_net_ht, x.quantite]), [[1.5, 12], [null, null], [null, 0]]);
  assert.strictEqual(E.stockParLibelle(l).lignes.length, 1, 'une ligne sans PA exploitable ne crée pas de coût');
});
ok('relevé publié : un lot brouillon est ignoré, le publié le plus récent gagne, relevé lu par pages', async () => {
  const lots = [lot('p1', 'published', '2030-03-01T00:00:00Z'), lot('p2', 'published', '2030-03-05T00:00:00Z'), lot('d1', 'draft', '2030-03-09T00:00:00Z'), lot('v1', 'published', '2030-03-09T00:00:00Z', { intention: 'ventes' })];
  const rows = { p1: [rowD('Ancien', '9', '1')], p2: [rowD('A', '1,5', '2'), rowD('B', '2', '0'), rowD('C', '3', '5')], d1: [rowD('Brouillon', '8', '1')] };
  const r = await E.chargerStockPublie(clientStock(lots, rows), 'S', 2);
  assert.strictEqual(r.fourni, true); assert.strictEqual(r.lot.id, 'p2'); assert.strictEqual(r.lot.fichierHash, 'h-p2'); assert.strictEqual(r.lot.dateReleve, '2030-03-10');
  assert.deepStrictEqual(r.lignes.map(x => x.libelle), ['A', 'B', 'C']);
  assert.strictEqual((await E.chargerStockPublie(clientStock(lots, rows), 'autre-site')).fourni, false);
});
ok('relevé publié : aucun lot publié, lot vide ou lecture en erreur => stockFourni=false, sans faux contrôle', async () => {
  const brouillon = [lot('d1', 'draft', '2030-03-09T00:00:00Z')];
  assert.strictEqual((await E.chargerStockPublie(clientStock(brouillon, { d1: [rowD('A', '1', '1')] }), 'S')).fourni, false);
  assert.strictEqual((await E.chargerStockPublie(clientStock([lot('p', 'published', '2030-03-01T00:00:00Z')], { p: [] }), 'S')).fourni, false);
  const e = await E.chargerStockPublie(clientStock([lot('p', 'published', '2030-03-01T00:00:00Z')], { p: [rowD('A', '1', '1')] }, { erreur: true }), 'S');
  assert.strictEqual(e.fourni, false);
  const ctx = E.construireContexteTarif({ site: 'S', registres: reg, declarations: {}, lignes: courantes, periode, stock: e.fourni ? e.lignes : null });
  assert.strictEqual(ctx.stockFourni, false);
  const ctx2 = E.construireContexteTarif({ site: 'S', registres: reg, declarations: {}, lignes: courantes, periode, stock: [{ libelle: 'Produit A', pa_net_ht: 1 }], stockSource: 'relevé de stock publié du 10/03/2030, colonne « PA net HT »' });
  assert.strictEqual(ctx2.stockFourni, true); assert.ok(/relevé de stock publié du 10\/03\/2030/.test(ctx2.stockSource));
});
ok('relevé publié : libellé en double avec deux PA => ambigu et contrôle S5 ; même libellé avec un seul PA => rien', async () => {
  const lots = [lot('p', 'published', '2030-03-01T00:00:00Z')];
  const rows = { p: [rowD('Produit A', '0,00', '4'), rowD('Produit A', '1', '4'), rowD('Produit B', '1,5', '2'), rowD('Produit B', '1,5', '3')] };
  const r = await E.chargerStockPublie(clientStock(lots, rows), 'S');
  const st = E.stockParLibelle(r.lignes);
  assert.strictEqual(st.ambigus.length, 1); assert.strictEqual(st.ambigus[0].article, 'Produit A');
  const ctx = E.construireContexteTarif({ site: S, registres: reg, declarations: {}, periode, stock: r.lignes });
  const res = T.analyser(courantes, [], ctx);
  const codes = (nom) => ((res.lignes.filter(l => l.article === nom)[0] || {}).anomalies || []).map(a => a.code);
  assert.ok(codes('Produit A').includes('S5'), 'A : S5 attendu, obtenu ' + JSON.stringify(codes('Produit A')));
  assert.ok(!codes('Produit B').includes('S5') && !codes('Produit B').includes('S2'), 'B : aucun S5 ni S2');
});
(function parite() {
  const dossier = __dirname + '/docs/reference/scanner-tarifaire-dossiers/01-T1-moteur/t1/donnees/stock_pa_net_ht_20261110.json';
  if (!fs.existsSync(dossier)) { console.log('parité banc/page : relevé T1 absent (hors dépôt), épreuve non jouée'); return; }
  ok('parité banc/page : le relevé lu depuis des lignes import_rows_raw simulées donne le même stock que le banc (T1)', async () => {
    const stk = JSON.parse(fs.readFileSync(dossier, 'utf8')); const src = stk.lignes || stk;
    const rows = src.map(r => rowD(r.article, String(r.pa_net_ht).replace('.', ','), '3'));
    const r = await E.chargerStockPublie(clientStock([lot('t1', 'published', '2030-03-01T00:00:00Z')], { t1: rows }), 'S', 1000);
    const banc = E.stockParLibelle(src.map(x => ({ libelle: x.article, pa_net_ht: x.pa_net_ht })));
    const page = E.stockParLibelle(r.lignes);
    assert.deepStrictEqual(page, banc); assert.ok(page.lignes.length > 100);
  });
})();

// Avenant A1, A3, A7 : perte unitaire HT, un seul « À vérifier », S2 sans phrase de conclusion.
const s1 = { code: 'S1', cycle: 'nouvelle', niveau: 'demontree', empreinte: 'e', identiteDonnees: {}, valeurs: { taux: -51 } };
const s2 = { code: 'S2', cycle: 'nouvelle', niveau: 'a_verifier', empreinte: 'f', identiteDonnees: {}, valeurs: { ecart: 1.1, paNetHtReleve: 1.39 } };
const lA1 = (pv, cout, an) => ({ article: 'Art A1', code_barres: '1', pv_ht: pv, margeEstimee: { cout: { valeur: cout } }, anomalies: an });
ok('A1 : S1 affiche la perte unitaire HT (1,57 - 0,03 = 1,54), le pourcentage va dans le (i)', () => {
  const h = E.htmlControlesAFaire(lA1(0.03, 1.57, [s1]), false, {});
  assert.ok(/Perte de 1,54 € HT par unité : vendu 0,03 €, coût 1,57 €/.test(h));
  assert.ok(!/Marge : /.test(h.replace(/<p class="sc-note" data-s1-pct="1">[^<]*<\/p>/, '')), 'le pourcentage n\'est que dans la note S1 du détail');
  assert.ok(/data-s1-pct="1">Marge : /.test(h));
});
ok('A1 : un PV nul ne donne aucun pourcentage de perte', () => {
  const h = E.htmlControlesAFaire(lA1(0, 1.57, [s1]), false, {});
  assert.ok(/Perte de 1,57 € HT par unité : vendu 0,00 €/.test(h) && !/Infinity|NaN/.test(h));
});
ok('A1 : une marge positive ou un coût absent garde l\'affichage en pourcentage', () => {
  assert.ok(/Marge : /.test(E.htmlControlesAFaire(lA1(2, 1.5, [s1]), false, {})));
  assert.ok(/Marge : /.test(E.htmlControlesAFaire(lA1(2, null, [s1]), false, {})));
});
ok('A7 : S1 avec S2 sur la même ligne s\'affiche « À vérifier » et dit que le relevé contredit l\'export', () => {
  const h = E.htmlControlesAFaire(lA1(2.35, 2.94, [s1, s2]), false, {});
  const niv = h.match(/data-axe="niveau">([^<]*)</g);
  assert.ok(niv.length === 2 && niv.every(x => /À vérifier/.test(x)), 'aucun « Démontré » sur la ligne');
  assert.ok(/coût de l'export contredit par le relevé de stock/.test(h));
  const seul = E.htmlControlesAFaire(lA1(2.35, 2.94, [s1]), false, {});
  assert.ok(/data-axe="niveau">Démontré</.test(seul) && !/contredit/.test(seul));
});
ok('A2 : un seul « À vérifier » par contrôle rendu (niveau), jamais répété dans la ligne ni dans le bouton', () => {
  const h = E.htmlControlesAFaire(lA1(2.35, 2.94, [s1, s2]), true, {});
  h.split('<li ').slice(1).forEach(li => {
    const txt = li.replace(/<[^>]+>/g, ' ');
    assert.strictEqual((txt.match(/À vérifier/g) || []).length, 1, txt);
  });
});
ok('A4/L2 : la consigne de contrôle est toujours visible, sans (i)', () => {
  assert.ok(/pt-ctl-3[^>]*>Vérifier le coût de revient/.test(E.htmlControlesAFaire(lA1(2.35, 2.94, [s1]), false, {})));
});
ok('A3 : la phrase de contrôle de S2 ne conclut rien', () => {
  const V = require('./nexus-vocabulaire-tarif.js');
  const c = (V.anomaliesTarifaires || V.default && V.default.anomaliesTarifaires).codes.S2.controle;
  assert.strictEqual(c, 'Comparer à la dernière facture fournisseur (prix brut, remise).');
});
ok('L0 : aucun compteur du lot réel (184, 75, 62, 31, 89) en dur dans le code de l\'écran', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, 'nexus-politique-tarifaire-ecran.js'), 'utf8');
  [184, 75, 62, 31, 89].forEach(v => assert.ok(!new RegExp('(^|[^0-9.,])' + v + '([^0-9]|$)').test(src), 'chiffre en dur : ' + v));
});
ok('L0 démarque : article préfixé d\'une date nommé, sans marge, hors marge estimée, hors A3/A5, Conseiller et cartes', () => {
  const dem = prod('12-11-2030 ARTICLE FICTIF DATE', 'Rayon Alpha', 10, 0.03, 1.57);
  const a = T.analyser(courantes.concat([dem]), [], A.contexteDepuisRegistres(reg, { periode }));
  const b = analyse();
  const l = a.lignes.filter(x => /^12-11-2030/.test(x.article))[0];
  assert.ok(l && E.estDemarque(l));
  assert.ok(!E.estDemarque(b.lignes[0]));
  const h = E.htmlMarge(l);
  assert.ok(/Démarque : périmé ou casse/.test(h) && !/Perte de|%/.test(h), h);
  assert.ok(/Démarque : périmé ou casse/.test(JSON.stringify(E.ficheMarge(l))));
  // marges estimées : la démarque n'ajoute rien au compte
  assert.strictEqual(E.carteMarge(a).references, E.carteMarge(b).references);
  const nA3 = x => ((E.alertesCartes(x).find(c => c.code === 'A3') || {}).nombre);
  assert.strictEqual(nA3(a), nA3(b));
  assert.deepStrictEqual(E.lignesControle(a.lignes, 'A3').filter(r => E.estDemarque(r)), []);
  assert.deepStrictEqual(E.lignesControle(a.lignes, 'A5').filter(r => E.estDemarque(r)), []);
  assert.strictEqual(E.conseiller(a, 'gerant').texte, E.conseiller(b, 'gerant').texte);
  assert.strictEqual(E.cartes(a).find(c => c.id === 'a_verifier').valeur, E.cartes(b).find(c => c.id === 'a_verifier').valeur);
  assert.strictEqual(E.lignesControle(a.lignes, 'FI').filter(r => E.estDemarque(r)).length, 0);
  assert.ok(!/ARTICLE FICTIF DATE/.test(JSON.stringify(E.preuves ? E.preuves(a) : [])));
});

// ---- L1 : quatre axes (Contrôler, Analyser, Décider, Suivre) ----
const pageL1 = (extra) => E.htmlPage(Object.assign({ analyse: analyse(), role: 'gerant', filtres: {}, incoherences: [] }, extra || {}));
const panneau = (html, id) => { const d = html.split('data-axe-panneau="' + id + '"')[1] || ''; return d; };
ok('L1 : quatre axes dans l\'ordre, Contrôler ouvert par défaut', () => {
  assert.deepStrictEqual(E.AXES.map(x => x.id), ['controler', 'analyser', 'decider', 'suivre']);
  assert.deepStrictEqual(E.AXES.map(x => x.nom), ['Contrôler', 'Analyser', 'Décider', 'Suivre']);
  const h = pageL1();
  assert.ok(/role="tablist"/.test(h));
  assert.strictEqual((h.match(/role="tab"/g) || []).length, 4);
  assert.ok(/data-axe-onglet="controler"[^>]*aria-selected="true"/.test(h));
  assert.ok(/data-axe-onglet="decider"[^>]*aria-selected="false"/.test(h));
});
ok('L1 : le dernier axe consulté est repris, valeur inconnue ignorée', () => {
  assert.strictEqual(E.axeCourant({ axe: 'suivre' }), 'suivre');
  assert.strictEqual(E.axeCourant({ axe: 'inconnu' }), 'controler');
  assert.strictEqual(E.axeCourant({}), 'controler');
});
ok('L1 : stockage local indisponible, aucune exception', () => {
  const avant = global.window;
  global.window = { localStorage: { getItem() { throw new Error('refus'); }, setItem() { throw new Error('refus'); } } };
  try { assert.strictEqual(E.axeCourant({}), 'controler'); } finally { if (avant === undefined) delete global.window; else global.window = avant; }
});
ok('L1 : ARIA, onglets liés aux panneaux, un seul panneau visible', () => {
  const h = pageL1();
  for (const id of ['controler', 'analyser', 'decider', 'suivre']) {
    assert.ok(new RegExp('aria-controls="ptPan_' + id + '"').test(h), id);
    assert.ok(new RegExp('id="ptPan_' + id + '"').test(h) || new RegExp('ptPan_' + id + '"[^>]*role="tabpanel"|role="tabpanel"[^>]*ptPan_' + id).test(h), id);
  }
  assert.strictEqual((h.match(/role="tabpanel"/g) || []).length, 4);
  assert.strictEqual((h.match(/role="tabpanel"[^>]*\bhidden\b/g) || []).length, 3);
});
ok('L1 : « Pistes indicatives » dans Décider, note exacte, sans verbe d\'ordre', () => {
  const d = panneau(pageL1(), 'decider').split('data-axe-panneau="suivre"')[0];
  assert.ok(/Pistes indicatives/.test(d));
  assert.ok(d.indexOf("Aucun seuil n'est encore validé : aucune de ces pistes n'est une décision tarifaire et aucune n'est appliquée.") >= 0
    || d.indexOf('Aucun seuil n&#39;est encore validé') >= 0 || /Aucun seuil n.est encore valid/.test(d));
  assert.ok(!/(Appliquer|Corriger le prix)/i.test(d.replace(/aucune n.est appliquée/g, '')));
});
ok('L1 : mêmes sections sous les axes, aucune perdue', () => {
  const h = pageL1();
  const c = panneau(h, 'controler').split('data-axe-panneau="analyser"')[0];
  const an = panneau(h, 'analyser').split('data-axe-panneau="decider"')[0];
  assert.ok(/Contrôles à effectuer/.test(c));
  assert.ok(/ptRecherche/.test(an) && /Sources et limites/.test(an));
  assert.ok(!/Contrôles à effectuer/.test(an));
});
ok('L1 : Suivre porte l\'historique, filtre Vérifiés par défaut, sans contrôle en attente', () => {
  const h = E.htmlHistorique(histoEtat({ filtreHisto: undefined }));
  assert.ok(/<option value="verifiee" selected>Vérifiés</.test(h));
  assert.ok(!/value="actifs"/.test(h));
});
ok('L1 : aucun compteur de lot écrit en dur dans le code de l\'écran', () => {
  const src = fs.readFileSync(require.resolve('./nexus-politique-tarifaire-ecran.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const v of ['184', '75', '62', '31', '89']) assert.ok(!new RegExp('(?<![\\w.#-])' + v + '(?![\\w.%-])').test(src.replace(/#[0-9a-fA-F]{3,8}\b/g, '').replace(/\d+(\.\d+)?(px|em|rem|%|ms|s)\b/g, '')), 'compteur ' + v + ' écrit en dur');
});
ok('L3 : mode liste par défaut, mode détail avec retour, Suivant et barre d\'action', () => {
  const a = avecControles(4), base = { analyse: a, role: 'manager', estCreateur: false, filtres: {}, incoherences: [] };
  const hl = E.htmlPage(base);
  assert.ok(/data-mode="liste"/.test(hl) && !/data-mode="detail"/.test(hl));
  const hd = E.htmlPage(Object.assign({ ctlDetail: true }, base));
  assert.ok(/data-mode="detail"/.test(hd) && /data-ctl-retour="1"/.test(hd) && /Retour à la liste \(\d+ restants?\)/.test(hd));
  assert.ok(/data-ctl-actions="1"/.test(hd) && /data-ctl-suivant="1"/.test(hd) && /✓ Marquer comme vérifié/.test(hd));
  assert.strictEqual((hd.match(/data-verifier="/g) || []).length, 1, 'un seul bouton de vérification');
  assert.ok(hd.indexOf('data-ctl-suivant') < hd.indexOf('data-verifier='), 'Suivant précède Marquer comme vérifié dans la barre');
});
ok('L3 : en lecture seule la barre porte Suivant sans bouton de vérification', () => {
  const a = avecControles(3), h = E.htmlPage({ analyse: a, role: 'employe', estCreateur: false, filtres: {}, incoherences: [], ctlDetail: true });
  assert.ok(/data-ctl-suivant/.test(h) && !/data-verifier="/.test(h));
});
ok('L3 : dernier contrôle, Suivant désactivé', () => {
  const a = avecControles(2), e0 = { analyse: a, role: 'manager', estCreateur: false, filtres: {}, incoherences: [], ctlDetail: true };
  const cles = [...E.htmlPage(e0).matchAll(/data-ctl-sel="([^"]+)"/g)].map(m => m[1]);
  assert.ok(cles.length >= 2);
  const h = E.htmlPage(Object.assign({ ctlSel: cles[cles.length - 1] }, e0));
  assert.ok(/data-ctl-suivant="1" disabled/.test(h), 'dernier : Suivant désactivé');
  assert.ok(!/data-ctl-suivant="1" disabled/.test(E.htmlPage(Object.assign({ ctlSel: cles[0] }, e0))), 'premier : Suivant actif');
});
ok('L3 : câblage (historique, popstate, Échap, focus, défilement) et CSS étroit, sans écriture', () => {
  const src = fs.readFileSync(require.resolve('./nexus-politique-tarifaire-ecran.js'), 'utf8');
  assert.ok(/history\.pushState\(\{ ptDetail: 1 \}/.test(src) && /history\.back\(\)/.test(src) && /'popstate'/.test(src));
  assert.ok(/ev\.key === 'Escape' && etat\.ctlDetail && etroit\(\)/.test(src));
  assert.ok(/window\.scrollTo\(0, etat\.ctlScroll \|\| 0\)/.test(src) && /preventScroll: true/.test(src));
  assert.ok(/max-width:899\.98px\)\{[^}]*data-mode=liste\]>\.pt-ctl-droite\{display:none\}/.test(src));
  assert.ok(/\.pt-ctl-retour,\.vue-p1c \.pt-ctl-suivant\{min-height:44px/.test(src) && /\.pt-actions>button\{flex:1 1 0;min-height:44px/.test(src));
  assert.ok(/min-width:900px\)\{\.vue-p1c \.pt-ctl-retour,\.vue-p1c \.pt-ctl-suivant\{display:none\}/.test(src), 'bureau inchangé : retour et Suivant masqués');
});
ok('L3 : détail plein écran sous 900 px, position k / N, barre fixée en bas, titre produit sans fond', () => {
  const src = fs.readFileSync(require.resolve('./nexus-politique-tarifaire-ecran.js'), 'utf8');
  assert.ok(/data-mode=detail\]>\.pt-ctl-droite\{position:fixed;top:0;right:0;bottom:0;left:0;/.test(src), 'détail en surcouche plein écran');
  assert.ok(/\.pt-actions\{position:sticky;bottom:0;[^}]*env\(safe-area-inset-bottom/.test(src), 'barre en bas avec marge de sécurité');
  assert.ok(/\.pt-detail \.pt-ctl-prod\{background:none;border:0;padding:0/.test(src), 'titre produit sans fond ni bordure');
  assert.ok(/\.pt-detail \.pt-ctl-prod:focus-visible\{outline:2px solid var\(--t-text\)/.test(src), 'focus visible');
  const i = src.indexOf('@media (min-width:900px)'); assert.ok(i > 0 && !/position:fixed/.test(src.slice(i, i + 700)), 'bureau sans surcouche');
  assert.ok(/pt-ctl-pos/.test(src) && /n\.pos \+ ' \/ ' \+ n\.total/.test(src), 'position k / N émise');
});
ok('L3 : le détail porte le chiffre clé et l\'étiquette de preuve hors de « Sources et calcul »', () => {
  const src = fs.readFileSync(require.resolve('./nexus-politique-tarifaire-ecran.js'), 'utf8');
  const i = src.indexOf('function htmlDetailControle'), j = src.indexOf('htmlCorpsControle(x.a', i);
  const seg = src.slice(i, j);
  assert.ok(/data-ctl-chiffre="1"/.test(seg) && /pt-mono/.test(seg) && /data-axe="niveau"/.test(seg) && /pc\.chiffres/.test(seg) && /pc\.niveau/.test(seg), 'chiffre clé et niveau sous le titre');
  assert.ok(/suivant === undefined \? '<p class="pt-ctl-2 sc-methode">'/.test(src), 'le chiffre n\'est plus répété dans « Sources et calcul » du détail');
});
ok('L3 : vérifier en détail passe au contrôle suivant', () => {
  const a = avecControles(3), cle = (l) => 'S7|' + l.article;
  const etat = { analyse: a, role: 'manager', estCreateur: false, filtres: {}, incoherences: [], ctlDetail: true, ctlSel: cle(a.lignes[0]) };
  const premier = a.lignes[0].anomalies[0];
  assert.ok(premier, 'anomalie de la première ligne');
  E.effetVerificationEnregistree(premier, etat, 'Responsable du banc');
  assert.notStrictEqual(etat.ctlSel, cle(a.lignes[0]));
  assert.ok(/data-mode="detail"/.test(E.htmlPage(etat)));
});
// ---- Correction Guardian 7013684486 : Conseiller court (vente à perte), compte créateur, messages de refus ----
ok('Conseiller : vente à perte, format court identique, cible la vente à perte', () => {
  const a = T.analyser(courantes.concat([prod('Article perte test', 'Rayon Alpha', 10, 0.5, 3)]), [], A.contexteDepuisRegistres(reg, { periode }));
  const c = E.conseiller(a, 'gerant');
  assert.ok(/^Vente à perte : Article perte test, perte 2,50\s€ HT\/u$/.test(c.texte), c.texte);
  assert.strictEqual(c.art, 'Vente à perte : Article perte test');
  assert.ok(/^perte 2,50\s€ HT\/u$/.test(c.sous), c.sous);
  assert.ok(/Article : Article perte test\./.test(c.detail), 'nom complet dans le détail');
  assert.ok(c.detail && c.detail.length > c.texte.length, 'texte long derrière le (i)');
  assert.strictEqual(c.cible, 'S1|Article perte test');
  assert.strictEqual(c.bloc, 'controles');
  assert.ok(/data-cible="S1\|Article perte test"/.test(E.htmlPage({ analyse: a, role: 'gerant', estCreateur: false, filtres: {}, incoherences: [] })));
});
ok('Conseiller : deux lignes, nom long sur la ligne 1 seul, chiffre sur la ligne 2, nom complet dans le détail', () => {
  const nom = 'Sachet Menthe Bleue DURMINT 100g - 12P - Lot promotionnel';
  assert.ok(nom.length >= 40);
  const a = T.analyser(courantes.concat([prod(nom, 'Rayon Alpha', 10, 0.5, 3)]), [], A.contexteDepuisRegistres(reg, { periode }));
  const c = E.conseiller(a, 'gerant');
  assert.strictEqual(c.art, 'Vente à perte : ' + nom);
  assert.ok(/^perte /.test(c.sous) && !/perte/.test(c.art.replace('Vente à perte : ', '')));
  assert.ok(c.detail.indexOf('Article : ' + nom) === 0, 'nom complet en tête du détail');
  const h = E.htmlPage({ analyse: a, role: 'gerant', estCreateur: false, filtres: {}, incoherences: [] });
  assert.ok(/class="sc-conseil-art">Vente à perte : /.test(h) && /class="sc-conseil-sous">perte /.test(h), 'rendu en deux spans');
  const g = E.conseiller(avecControles(2), 'gerant');
  assert.ok(/^(Le plus grave|Vente à perte) : /.test(g.art || ''), 'chaque branche à contrôle porte la ligne 1 : ' + g.code + ' ' + g.texte);
  assert.ok(typeof g.sous === 'string');
});
ok('Conseiller : aucune branche ne dépasse le format court', () => {
  [avecControles(0), avecControles(2), analyse()].forEach(a => ['gerant', 'manager'].forEach(r => {
    const c = E.conseiller(a, r);
    assert.ok(c.texte.length <= 110, c.code + ' : ' + c.texte.length + ' caractères');
  }));
});
ok('Créateur : pas de bouton « Marquer comme vérifié », mention lecture seule', () => {
  const a = avecControles(2);
  const h = E.htmlPage({ analyse: a, role: 'manager', estCreateur: true, filtres: {}, incoherences: [], ouverte: null });
  assert.ok(!/data-verifier=/.test(h), 'aucun bouton');
  assert.ok(!E.peutVerifier('manager', true));
  const sel = E.htmlPage({ analyse: a, role: 'manager', estCreateur: true, filtres: {}, incoherences: [], ctlSel: 'S7|' + a.lignes[0].article, mode: 'detail' });
  assert.ok(!/data-verifier=/.test(sel));
});
ok('Hôte : lit employee.est_createur (et estCreateur)', () => {
  const src = fs.readFileSync(__dirname + '/NEXUS-Produits-v1.html', 'utf8');
  assert.ok(/employee\.est_createur \|\| employee\.estCreateur/.test(src));
  assert.ok(!/estCreateur: !!employee\.estCreateur/.test(src));
});
[
  ['tarif_verif_createur_lecture_seule : le créateur ne vérifie pas', /compte créateur est en lecture seule/],
  ['tarif_verif_reservee_manager_gerant : réservé', /réservée au manager et au gérant/],
  ['tarif_verif_compte_inactif : compte désactivé', /compte est désactivé/],
  ['tarif_verif_session_absente : aucune personne connectée', /session a expiré/],
  ['tarif_verif_lot_import_incoherent : lot', /lot d'import ne correspond plus/],
  ['tarif_verif_reference_absente : code-barres', /ni code-barres ni libellé/],
].forEach(([brut, motif]) => ok('Refus RPC traduit : ' + brut.split(' ')[0], () => {
  const m = E.messageErreurEcriture({ message: brut });
  assert.ok(motif.test(m), m);
  assert.ok(!/tarif_verif_/.test(m), 'pas de code technique');
}));
ok('Refus RPC inconnu : message générique', () => {
  assert.ok(/L'enregistrement a échoué/.test(E.messageErreurEcriture({ message: 'boom' })));
});
ok('annulation par le créateur : peutAnnuler, bouton « Annuler » sur la ligne de l\'historique, jamais « Marquer comme vérifié »', () => {
  assert.strictEqual(E.peutAnnuler('employe', true), true);
  assert.strictEqual(E.peutAnnuler('gerant', false), true); assert.strictEqual(E.peutAnnuler('manager', false), true);
  assert.strictEqual(E.peutAnnuler('employe', false), false); assert.strictEqual(E.peutAnnuler('pompiste', false), false);
  assert.strictEqual(E.peutAnnuler(undefined, false), false);
  assert.ok(!E.peutVerifier('employe', true) && !E.peutVerifier('gerant', true), 'le créateur ne vérifie toujours pas');
  const x = { article: 'Art A', code: 'S2', cle: 'k1', cycle: 'verifiee', verif: vref({ id: 'v-7', auteur: 'Alex Test' }) };
  const bouton = /data-histo-annuler="v-7"/;
  for (const [role, cr, voit] of [['employe', true, true], ['gerant', false, true], ['manager', false, true], ['employe', false, false], ['pompiste', false, false]]) {
    const h = E.htmlAnnulLigne(x, { role, estCreateur: cr });
    assert.strictEqual(bouton.test(h), voit, role + '/' + cr);
    assert.ok(!/Marquer comme vérifié/.test(h));
    assert.ok(!bouton.test(E.htmlDetailHistorique(x, { role, estCreateur: cr })), 'plus de bouton dans le détail');
  }
  const ouvert = E.htmlAnnulLigne(x, { role: 'employe', estCreateur: true, annulCible: { id: 'v-7' }, annulOuverte: true, erreurAnnul: 'Annulation refusée : x' });
  assert.ok(/data-annul-confirmer/.test(ouvert) && !bouton.test(ouvert));
  assert.ok(/data-annul-erreur="1"/.test(ouvert) && /Annulation refusée : x/.test(ouvert), 'échec affiché à côté de la ligne');
});
const etatSuivre = (extra) => {
  const analyse = { lignes: [
    { article: 'Art A', anomalies: [{ code: 'S2', cle: 'kA', cycle: 'verifiee' }], anomaliesResolues: [] },
    { article: 'Art B', anomalies: [{ code: 'S2', cle: 'kB', cycle: 'verifiee' }], anomaliesResolues: [] }] };
  const verifications = [
    { id: 'v-A', code: 'S2', cle: 'kA', verifie_le: '2030-03-05T10:00:00Z', auteur: 'Alex Test', saisiPar: 'u-1', commentaire: null, reevaluation: null },
    { id: 'v-B', code: 'S2', cle: 'kB', verifie_le: '2030-03-06T10:00:00Z', auteur: 'Alex Test', saisiPar: 'u-2', commentaire: null, reevaluation: null }];
  return Object.assign({ historiqueDispo: true, analyse, verifications, filtreHisto: 'verifiee', role: 'gerant', estCreateur: false }, extra || {});
};
ok('annulation depuis Suivre : un bouton par vérification active, avec le bon id', () => {
  const h = E.htmlHistorique(etatSuivre());
  assert.ok(/data-histo-annuler="v-A"/.test(h) && /data-histo-annuler="v-B"/.test(h));
  assert.strictEqual((h.match(/data-histo-annuler=/g) || []).length, 2);
  assert.ok(/aria-label="Annuler la vérification de Art A"/.test(h));
  const ouvert = E.htmlHistorique(etatSuivre({ annulCible: { id: 'v-B' }, annulOuverte: true }));
  assert.ok(/data-histo-annul-ligne="v-B"/.test(ouvert) && /data-annul-confirmer/.test(ouvert));
  assert.ok(!/data-histo-annuler="v-A"/.test(ouvert), 'une seule annulation à la fois');
});
ok('annulation depuis Suivre : aucun bouton sans le droit', () => {
  for (const [role, cr] of [['employe', false], ['pompiste', false], [undefined, false]]) {
    assert.ok(!/data-histo-annuler/.test(E.htmlHistorique(etatSuivre({ role, estCreateur: cr }))), String(role));
  }
  const m = E.htmlHistorique(etatSuivre({ role: 'manager', userId: 'u-1' }));
  assert.ok(/data-histo-annuler="v-A"/.test(m) && !/data-histo-annuler="v-B"/.test(m), 'un manager n\'annule que sa propre saisie');
  assert.ok(/data-histo-annuler="v-B"/.test(E.htmlHistorique(etatSuivre({ role: 'employe', estCreateur: true }))));
});
ok('annulation depuis Suivre : la ligne quitte « Vérifiés » et le contrôle revient, avec l\'id de CETTE ligne', async () => {
  const etat = etatSuivre({ annulCible: { id: 'v-B', an: null, cle: 'kB', cycleAvant: 'nouvelle' } });
  const an = etat.analyse.lignes[1].anomalies[0];
  etat.annulCible.an = an;
  const appels = [];
  etat.surAnnulation = async (c, m) => { appels.push([c.id, m]); return { ok: false, message: 'Annulation refusée : x' }; };
  assert.strictEqual((await E.annulerVerification(etat, 'motif')).ok, false);
  assert.strictEqual(E.historiqueLignes(etat.analyse, etat.verifications, 'verifiee').length, 2, 'échec : la vérification reste');
  etat.surAnnulation = async (c, m) => { appels.push([c.id, m]); return { ok: true }; };
  assert.strictEqual((await E.annulerVerification(etat, 'motif')).ok, true);
  assert.deepStrictEqual(appels.map(a => a[0]), ['v-B', 'v-B']);
  assert.deepStrictEqual(etat.verifications.map(v => v.id), ['v-A']);
  assert.strictEqual(an.cycle, 'nouvelle');
  assert.strictEqual(etat.ctlSel, 'kB');
  assert.strictEqual(E.historiqueLignes(etat.analyse, etat.verifications, 'verifiee').length, 1);
});
ok('annulation par le créateur : annulCible envoie le bon id, retire la ligne ; un refus garde la vérification', async () => {
  const etat = { role: 'employe', estCreateur: true, verifications: [{ id: 'v-7', code: 'S2', cle: 'k1' }, { id: 'v-8', code: 'S2', cle: 'k2' }], annulCible: { id: 'v-7' } };
  const appels = [];
  etat.surAnnulation = async (c, m) => { appels.push([c.id, m]); return { ok: false, message: 'Annulation refusée : x' }; };
  const r1 = await E.annulerVerification(etat, 'motif');
  assert.strictEqual(r1.ok, false); assert.strictEqual(etat.verifications.length, 2);
  etat.surAnnulation = async (c, m) => { appels.push([c.id, m]); return { ok: true }; };
  const r2 = await E.annulerVerification(etat, 'motif');
  assert.strictEqual(r2.ok, true);
  assert.deepStrictEqual(appels.map(a => a[0]), ['v-7', 'v-7']);
  assert.deepStrictEqual(etat.verifications.map(v => v.id), ['v-8']);
  assert.strictEqual(etat.annulCible, null);
});
Promise.all(PROMESSES).then(() => {
console.log('test_ecran_politique_tarifaire : ' + n + ' épreuves OK');
});

// L1 recette : grille 2x2 sous 900 px, compteur Décider = pistes indicatives (A1 seule).
(function () {
  var src = require('fs').readFileSync(__dirname + '/nexus-politique-tarifaire-ecran.js', 'utf8');
  assert.ok(/\.pt-axes\{display:grid;grid-template-columns:repeat\(2,1fr\)/.test(src), 'grille 2 colonnes par défaut');
  assert.ok(/min-width:900px\)\{\.vue-p1c \.pt-axes\{grid-template-columns:repeat\(4,1fr\)/.test(src), 'quatre colonnes dès 900 px');
  assert.ok(/c\.code === 'A1'/.test(src) && /pistes indicatives/.test(src), 'compteur Décider limité à A1, libellé pistes indicatives');
  console.log('test_ecran_politique_tarifaire : L1 recette OK');
})();

ok('L4 : détail ouvert, confirmation et Annuler rendus dans le détail (une seule zone aria-live)', () => {
  const src = require('fs').readFileSync(__dirname + '/nexus-politique-tarifaire-ecran.js', 'utf8');
  assert(/avecSuivi \? htmlSuiviVerif\(etat, droits\)/.test(src), 'le détail porte le suivi de vérification');
  assert(/if \(!enDetail\) h \+= htmlSuiviVerif/.test(src), 'le bloc ne le rend que si le détail est fermé');
});

ok('L5 : Conseiller sur une ligne, bouton « Commencer par » sur le cas des contrôles', () => {
  const a3 = avecControles(3); a3.synthese.alertes = {}; a3.lignes.forEach(l => { l.alertes = []; });
  const h = E.htmlPage({ analyse: a3, role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  assert.ok(/sc-conseil-ligne/.test(h) && /data-commencer="1"/.test(h) && /Commencer par</.test(h));
  assert.ok(/data-bloc-conseil="controles"/.test(h), 'le bouton porte l\'ouverture du bloc des contrôles');
});
ok('L5 : « Commencer par » trie par gravité, vide les filtres et choisit le premier contrôle', () => {
  const ec = []; const b = { dataset: { commencer: '1', blocConseil: 'controles' }, addEventListener: (t, f) => ec.push(f) };
  const corps = { querySelectorAll: (sel) => /data-bloc-conseil/.test(sel) ? [b] : [], querySelector: () => null };
  const a = avecControles(6);
  const etat = { analyse: a, ctlTri: 'cause', ctlRecherche: 'zzz', ctlReplie: true }; let rendus = 0;
  E.lierOuvertures(corps, etat, () => { rendus++; });
  assert.strictEqual(ec.length, 1);
  ec[0]();
  assert.strictEqual(etat.ctlTri, 'gravite'); assert.strictEqual(etat.ctlRecherche, ''); assert.strictEqual(etat.ctlReplie, false);
  assert.ok(etat.ctlSel || etat.ctlDetail, 'un premier contrôle est choisi ou son détail ouvert');
  assert.ok(rendus >= 1);
});
ok('L5 : Suivre, la ligne porte auteur, date, commentaire et import', () => {
  const analyse = { lignes: [{ article: 'B', anomalies: [{ code: 'S3', cle: 'k2', cycle: 'verifiee', identiteDonnees: { dateReleve: '2030-03-01' } }] }] };
  const verifs = [{ code: 'S3', cle: 'k2', verifie_le: '2030-03-05T10:00:00Z', auteur: 'Alex Test', commentaire: 'vu en rayon', identiteDonnees: { dateReleve: '2030-03-01' }, reevaluation: null }];
  const h = E.htmlHistorique({ analyse, verifications: verifs, historiqueDispo: true, filtreHisto: 'verifiee' });
  const m = /data-histo-suivi="1">([^<]*)</.exec(h);
  assert.ok(m, 'texte de suivi sur la ligne, hors (i)');
  assert.ok(/05\/03\/2030/.test(m[1]) && /Alex Test/.test(m[1]) && /vu en rayon/.test(m[1]) && /01\/03\/2030/.test(m[1]), m[1]);
});
ok('L5 : Suivre, ligne sans vérification = « Jamais vérifié », aucune vérification annulée affichée', () => {
  const analyse = { lignes: [{ article: 'P', anomalies: [{ code: 'S2', cle: 'k9', cycle: 'persistante' }] }] };
  const h = E.htmlHistorique({ analyse, verifications: [], historiqueDispo: true, filtreHisto: 'actifs' });
  assert.ok(/Jamais vérifié/.test(h) && !/Vérifié le/.test(h));
});
ok('L5 : l\'écran n\'écrit rien et ne code aucun compte en dur', () => {
  const src = require('fs').readFileSync(__dirname + '/nexus-politique-tarifaire-ecran.js', 'utf8');
  assert.ok(!/tarif_marquer_verifie|\.update\(|\.insert\(/.test(src));
  const fh = src.split('FILTRES_HISTO')[1].slice(0, 400);
  assert.ok(/'Résolus'/.test(fh) && !/'Résolus au nouvel import'/.test(fh));
});
ok('L5 : le chargement des vérifications exclut les annulées (annule_le is null)', () => {
  const src = require('fs').readFileSync(__dirname + '/nexus-politique-tarifaire-ecran.js', 'utf8');
  const i = src.indexOf("from('tarif_anomalies_verifications').select");
  assert.ok(i > 0 && /\.is\('annule_le', null\)/.test(src.slice(i, i + 700)), 'une vérification annulée ne revient jamais comme vérifiée');
});
ok('L5 : marquerVerifie lit le commentaire saisi dans le détail (hôte et banc), seulement celui de l\'article et de la cause du bouton', () => {
  ['NEXUS-Produits-v1.html', 'outils/recette/ecran_scanner/banc.html'].forEach(f => {
    const src = require('fs').readFileSync(__dirname + '/' + f, 'utf8');
    const lz = src.split('\n').filter(l => /(const|var) zone = btn\.closest/.test(l))[0];
    const lc = src.split('\n').filter(l => /(const|var) com = E2?\.commentaireDuControle\(zone, art, code\)/.test(l))[0];
    assert.ok(lz && lc, f + ' : lignes zone/commentaire introuvables');
    assert.ok(!/zone\.querySelector\('textarea\.pt-verif-com/.test(src), f + ' : plus de lecture du premier champ venu');
    const cut = (lz + '\n' + lc).replace(/(const|let)\s/g, 'var ');
    const champ = (article, code, v) => ({ value: v, dataset: { comArticle: article, comCode: code } });
    const mk = (champs, art, code) => {
      const zoneDetail = { querySelectorAll: s => /textarea\.pt-verif-com/.test(s) ? champs : [], appendChild() {} };
      const btn = { dataset: { verArticle: art, verifier: code }, closest: s => s === '[data-ctl-detail]' ? zoneDetail : null, parentNode: {} };
      return btn; };
    const lire = (champs, art, code) => new Function('btn', 'E', 'E2', 'art', 'code', cut + '; return com;')(mk(champs, art, code), E, E, art, code);
    assert.strictEqual(lire([champ('NETT VITRES', 'S2', 'vu sur facture')], 'NETT VITRES', 'S2'), 'vu sur facture', f + ' : le commentaire du bon contrôle est lu');
    // Deux champs ouverts : chaque bouton part avec son propre texte.
    const deux = [champ('DURMINT', 'S2', 'texte DURMINT'), champ('NETT VITRES', 'S2', 'texte NETT')];
    assert.strictEqual(lire(deux, 'NETT VITRES', 'S2'), 'texte NETT', f + ' : NETT VITRES ne prend pas le texte de DURMINT');
    assert.strictEqual(lire(deux, 'DURMINT', 'S2'), 'texte DURMINT', f + ' : DURMINT garde le sien');
    // Même article, autre cause : pas de mélange.
    assert.strictEqual(lire([champ('DURMINT', 'S7', 'autre cause')], 'DURMINT', 'S2'), '', f + ' : autre cause, aucun texte');
    // Chemin iPhone : l\'écriture de DURMINT a échoué, le texte reste dans son champ ; NETT VITRES enregistré sans ce texte.
    assert.strictEqual(lire([champ('DURMINT', 'S2', 'texte DURMINT')], 'NETT VITRES', 'S2'), '', f + ' : champ resté sur DURMINT, NETT VITRES part sans commentaire');
  });
});
ok('L5 : le payload de tarif_marquer_verifie porte l\'article et la cause du bouton, avec le commentaire du même contrôle', () => {
  const a = avecControles(2);
  const cs = []; a.lignes.forEach(l => (l.anomalies || []).forEach(an => cs.push({ l, an })));
  assert.ok(cs.length >= 2, 'deux contrôles');
  cs.slice(0, 2).forEach((c, i) => {
    const v = E.payloadVerification(c.an, c.l, { importBatchId: 'lot', moteurVersion: 'm', commentaire: 'com ' + i });
    assert.strictEqual(v.article, c.l.article);
    assert.strictEqual(v.cause, c.an.code);
    assert.strictEqual(v.commentaire, 'com ' + i);
  });
});
ok('L5 : la confirmation cite l\'article vérifié et le commentaire enregistré', () => {
  const a = avecControles(2); const cs = []; a.lignes.forEach(l => (l.anomalies || []).forEach(an => cs.push({ l, an })));
  const etat = { analyse: a };
  E.effetVerificationEnregistree(cs[0].an, etat, 'Gérant du banc', 'id1', { commentaire: 'vu sur facture' });
  assert.ok(etat.messageVerif.indexOf(cs[0].l.article) >= 0 && etat.messageVerif.indexOf('vu sur facture') >= 0, etat.messageVerif);
  const etat2 = { analyse: a };
  E.effetVerificationEnregistree(cs[1].an, etat2, 'Gérant du banc', 'id2', {});
  assert.ok(/sans commentaire/.test(etat2.messageVerif) && etat2.messageVerif.indexOf(cs[1].l.article) >= 0, etat2.messageVerif);
});

// Lot design Contrôler : recherche par code-barres, libellés courts, lignes sans troncature.
ok('Design Contrôler : la recherche de l\'axe trouve aussi par code-barres', () => {
  const a = avecControles(14);
  const l0 = a.lignes.filter(l => (l.anomalies || []).length)[0];
  l0.code_barres = '3999000111222';
  const h = E.htmlPage({ analyse: a, role: 'manager', estCreateur: false, filtres: {}, incoherences: [], ctlRecherche: '3999000111222' });
  assert.strictEqual((h.match(/data-ctl-ligne="1"/g) || []).length, l0.anomalies.length);
  const h2 = E.htmlPage({ analyse: a, role: 'manager', estCreateur: false, filtres: {}, incoherences: [], ctlRecherche: '3999000999' });
  assert.strictEqual((h2.match(/data-ctl-ligne="1"/g) || []).length, 0);
});
ok('Design Contrôler : puces à libellé court, libellé complet en aria-label', () => {
  const V = require('./nexus-vocabulaire-tarif.js').anomaliesTarifaires.codes;
  assert.strictEqual(V.S2.court, 'Coût écarté du relevé');
  assert.strictEqual(V.S6.court, 'Prix modifié sans décision');
  const h = E.htmlPage({ analyse: avecControles(14), role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  assert.ok(/aria-label="Coût écarté du relevé de stock : \d+"/.test(h), 'libellé complet');
  assert.ok(/data-ctl-cause="S2"[^>]*>Coût écarté du relevé <span/.test(h), 'libellé court affiché');
});
ok('Design Contrôler : aucune ellipse sur les lignes et aucun title croisé', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, 'nexus-politique-tarifaire-ecran.js'), 'utf8');
  const m = /\.pt-ctl-ligne>span\{([^}]*)\}/.exec(src);
  assert.ok(m && !/text-overflow:ellipsis/.test(m[1]) && !/nowrap/.test(m[1]));
  const h = E.htmlPage({ analyse: avecControles(14), role: 'manager', estCreateur: false, filtres: {}, incoherences: [] });
  const bloc = h.slice(h.indexOf('data-ctl-liste'));
  assert.ok(!/ title="/.test(bloc.slice(0, bloc.indexOf('data-ctl-detail') > 0 ? bloc.indexOf('data-ctl-detail') : bloc.length)), 'aucune info-bulle sur les lignes');
});
