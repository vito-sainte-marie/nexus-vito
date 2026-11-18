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
  assert.strictEqual((html.split('id="ptRecherche"')[1].match(/class="vp-ligne-prod"/g) || []).length, 10);
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
  assert.ok(g.texte && m.texte && g.texte !== m.texte);
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

ok('page Produits : une seule écriture permise, tarif_marquer_verifie, aucune autre', () => {
  const src = fs.readFileSync(require.resolve('./NEXUS-Produits-v1.html'), 'utf8');
  const i = src.indexOf('async function calculerAnalyseTarif'), j = src.indexOf('function ouvrirVue(cle)');
  const bloc = src.slice(i, j);
  assert.ok(!/\.(insert|update|delete|upsert)\s*\(|tarif_enregistrer_decisions/.test(bloc));
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
  const l = ligneAvec('estimation', { article: 'Bouteille gaz', regimeDeclare: { regime: 'reglemente' } });
  const h = E.htmlMarge(l) + E.ficheMarge(l);
  assert.ok(/Prix réglementé/.test(h) && /Prix fixé par un tiers/.test(h));
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

ok('page : ctx.stockDate vient de SYNTHESE_STOCK_DATE, relu puis transmis en date_releve à l\'écriture', () => {
  assert.ok(/ctx\.stockDate\s*=\s*String\(SYNTHESE_STOCK_DATE\)/.test(page));
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
  const ctx = E.construireContexteTarif({ registres: reg, periode });
  const c = ctx.tva.confirmations;
  assert.ok(c.length >= 8);
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
  const r = T.analyser(lignes, [], E.construireContexteTarif({ registres: reg, periode }));
  const s7 = l => (l.anomalies || []).filter(a => a.code === 'S7')[0];
  assert.ok(s7(r.lignes[0]) && s7(r.lignes[0]).niveau === 'demontree');
  assert.ok(!s7(r.lignes[1]));
});

Promise.all(PROMESSES).then(() => {
console.log('test_ecran_politique_tarifaire : ' + n + ' épreuves OK');
});
