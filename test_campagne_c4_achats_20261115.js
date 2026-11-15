const assert = require('assert');
const fs = require('fs');
const A = require('./nexus-campagne-achats.js');
const S = require('./nexus-campagne-stock.js');
let n = 0; const t = (nom, f) => { f(); n++; };
const cond8 = S.conditionnement('Schweppes Tonic 8P'.replace('8P', '- 8P'), null);

t('cas témoin Schweppes Tonic : 28 + 22,05, 7 cartons de 8', () => {
  const r = A.besoinAchat({ article: 'Schweppes Tonic - 8P', objectifJour: 4, joursRestants: A.joursPromoRestants('2026-11-23', '2026-11-30'),
    ventesRefJour: 1.47, stock: 0, fiable: true, resteARecevoir: 0, cond: cond8 });
  assert.strictEqual(r.besoin_promo, 28);
  assert.ok(Math.abs(r.besoin_apres - 22.05) < 1e-9);
  assert.strictEqual(r.cartons, 7); assert.strictEqual(r.a_commander, 56);
});
t('couverture de 15 jours, réglage de site versionné', () => {
  assert.strictEqual(A.reglages([]).joursCouverture, 15);
  assert.strictEqual(A.reglages([{ version: 1, jours_couverture_apres: 15, delai_commande_jours: 7 }, { version: 2, jours_couverture_apres: 10, delai_commande_jours: 5 }]).joursCouverture, 10);
});
t('rythme habituel après la fin de la promotion', () => {
  const r = A.besoinAchat({ article: 'X', objectifJour: 4, joursRestants: A.joursPromoRestants('2026-12-05', '2026-11-30'), ventesRefJour: 2, stock: 0, fiable: true, cond: { source: 'a_l_unite', unitesParCarton: 1 } });
  assert.strictEqual(r.besoin_promo, 0); assert.strictEqual(r.a_commander, 30);
});
t('stock théorique et commandes ouvertes déduits, plancher à 0', () => {
  const c = { source: 'a_l_unite', unitesParCarton: 1 };
  assert.strictEqual(A.besoinAchat({ article: 'X', objectifJour: 4, joursRestants: 7, ventesRefJour: 0, stock: 10, fiable: true, resteARecevoir: 5, cond: c }).a_commander, 13);
  assert.strictEqual(A.besoinAchat({ article: 'X', objectifJour: 4, joursRestants: 7, ventesRefJour: 0, stock: 100, fiable: true, resteARecevoir: 0, cond: c }).a_commander, 0);
  assert.strictEqual(A.besoinAchat({ article: 'X', objectifJour: 4, joursRestants: 7, ventesRefJour: 0, stock: 10, fiable: true, resteARecevoir: 50, cond: c }).a_commander, 0);
});
t('conditionnement absent : unités avec mention', () => {
  const r = A.besoinAchat({ article: 'Sans suffixe', objectifJour: 2, joursRestants: 5, ventesRefJour: 0, stock: 0, fiable: true, cond: S.conditionnement('Sans suffixe', null) });
  assert.strictEqual(r.a_commander, 10); assert.strictEqual(r.cartons, null); assert.strictEqual(r.mention, 'conditionnement à renseigner');
});
t('alerte carton seulement au-delà de 0,5 carton, recommandation toujours arrondie au-dessus', () => {
  const r1 = A.besoinAchat({ article: 'X - 8P', objectifJour: 1, joursRestants: 1, ventesRefJour: 0, stock: 0, fiable: true, cond: cond8 });
  assert.strictEqual(r1.a_commander, 8); assert.strictEqual(r1.alerte_carton, true);
  const r2 = A.besoinAchat({ article: 'X - 8P', objectifJour: 1, joursRestants: 5, ventesRefJour: 0, stock: 0, fiable: true, cond: cond8 });
  assert.strictEqual(r2.a_commander, 8); assert.strictEqual(r2.alerte_carton, false);
});
t('stock non fiable : indicatif, jamais prérempli ni dans l’alerte', () => {
  const r = A.besoinAchat({ article: 'X - 8P', objectifJour: 4, joursRestants: 7, ventesRefJour: 1, stock: 3, fiable: false, cond: cond8 });
  assert.strictEqual(r.indicatif, true); assert.strictEqual(r.preremplir, false); assert.strictEqual(r.motif_indicatif, 'stock à confirmer');
  assert.strictEqual(A.alerteAchats({ aujourdhui: '2026-11-20', limite: '2026-11-23', recommandations: [r] }).actif, false);
  assert.strictEqual(A.besoinAchat({ article: 'X', objectifJour: 4, joursRestants: 7, stock: null, fiable: false }).a_commander, null);
});
t('rythme habituel absent : indicatif', () => {
  const r = A.besoinAchat({ article: 'X - 8P', objectifJour: 4, joursRestants: 7, ventesRefJour: null, stock: 0, fiable: true, cond: cond8 });
  assert.strictEqual(r.motif_indicatif, 'rythme habituel absent'); assert.strictEqual(r.preremplir, false);
});
const base = () => ({
  commandes: [{ id: 'c1', remplace_commande_id: null }], annulations: [], clotures: [],
  lignesCommande: [{ commande_id: 'c1', article: 'Tonic', unites_commandees: 56 }],
  livraisons: [{ id: 'l1' }, { id: 'l2' }], livraisonsAnnulations: [],
  liens: [{ livraison_id: 'l1', commande_id: 'c1' }, { livraison_id: 'l2', commande_id: 'c1' }],
  lignesLivraison: [],
});
t('reste à recevoir après réception partielle puis complète', () => {
  const b = base();
  assert.strictEqual(A.resteARecevoir(b).get('tonic').reste, 56);
  b.lignesLivraison = [{ livraison_id: 'l1', article: 'Tonic', unites: 24 }];
  assert.strictEqual(A.resteARecevoir(b).get('tonic').reste, 32);
  b.lignesLivraison.push({ livraison_id: 'l2', article: 'Tonic', unites: 32 });
  assert.strictEqual(A.resteARecevoir(b).get('tonic').reste, 0);
  b.lignesLivraison.push({ livraison_id: 'l2', article: 'Tonic', unites: 8 });
  const f = A.resteARecevoir(b).get('tonic'); assert.strictEqual(f.reste, 0); assert.strictEqual(f.exces, 8);
});
t('livraison annulée, commande annulée, remplacée ou clôturée', () => {
  let b = base(); b.lignesLivraison = [{ livraison_id: 'l1', article: 'Tonic', unites: 24 }];
  b.livraisonsAnnulations = [{ livraison_id: 'l1' }]; assert.strictEqual(A.resteARecevoir(b).get('tonic').reste, 56);
  b = base(); b.annulations = [{ commande_id: 'c1' }]; assert.strictEqual(A.resteARecevoir(b).size, 0);
  b = base(); b.clotures = [{ commande_id: 'c1', motif: 'reliquat non livré' }]; assert.strictEqual(A.resteARecevoir(b).size, 0);
  b = base(); b.commandes.push({ id: 'c2', remplace_commande_id: 'c1' }); b.lignesCommande.push({ commande_id: 'c2', article: 'Tonic', unites_commandees: 40 });
  assert.strictEqual(A.resteARecevoir(b).get('tonic').reste, 40);
});
t('une commande ouverte réduit la recommandation', () => {
  const sans = A.besoinAchat({ article: 'Tonic - 8P', objectifJour: 4, joursRestants: 7, ventesRefJour: 1.47, stock: 0, fiable: true, resteARecevoir: 0, cond: cond8 });
  const avec = A.besoinAchat({ article: 'Tonic - 8P', objectifJour: 4, joursRestants: 7, ventesRefJour: 1.47, stock: 0, fiable: true, resteARecevoir: A.resteARecevoir(base()).get('tonic').reste, cond: cond8 });
  assert.ok(avec.a_commander < sans.a_commander); assert.strictEqual(avec.a_commander, 0);
});
t('D7 : mois de 30 jours, de 31 jours, février', () => {
  assert.strictEqual(A.dateLimiteCommande('2026-11-30', '2026-11-01', 7).date, '2026-11-23');
  assert.strictEqual(A.dateLimiteCommande('2026-12-31', '2026-12-01', 7).date, '2026-12-24');
  assert.strictEqual(A.dateLimiteCommande('2027-02-28', '2027-02-01', 7).date, '2027-02-21');
  assert.strictEqual(A.dateLimiteCommande('2028-02-10', '2028-02-01', 7).date, '2028-02-22');
});
t('D7 : campagne sur deux mois signalée, date aberrante ramenée au début et à vérifier', () => {
  const d = A.dateLimiteCommande('2026-12-10', '2026-11-20', 7);
  assert.strictEqual(d.date, '2026-12-24'); assert.strictEqual(d.deuxMois, true);
  const e = A.dateLimiteCommande('2026-11-03', '2026-11-01', 30);
  assert.strictEqual(e.date, '2026-11-01'); assert.strictEqual(e.aVerifier, true);
});
t('la veille, le jour même, le lendemain de la date limite', () => {
  const lim = '2026-11-23', c = { source: 'a_l_unite', unitesParCarton: 1 };
  const f = j => A.besoinAchat({ article: 'X', objectifJour: 4, joursRestants: 7, ventesRefJour: 0, stock: 0, fiable: true, cond: c, aujourdhui: j, limite: lim });
  assert.strictEqual(f('2026-11-22').hors_delai, false); assert.strictEqual(f('2026-11-22').preremplir, true);
  assert.strictEqual(f('2026-11-23').hors_delai, false); assert.strictEqual(f('2026-11-23').preremplir, true);
  const apres = f('2026-11-24'); assert.strictEqual(apres.hors_delai, true); assert.strictEqual(apres.preremplir, false);
});
t('point d’alerte : éteint le 15/11, allumé du 16/11 au 23/11 inclus, éteint le 24/11 (décision de Frédéric)', () => {
  const rec = [{ indicatif: false, hors_delai: false, a_commander: 10 }];
  const a = j => A.alerteAchats({ aujourdhui: j, limite: '2026-11-23', recommandations: rec });
  assert.strictEqual(a('2026-11-09').actif, false); assert.strictEqual(a('2026-11-15').actif, false);
  assert.strictEqual(a('2026-11-16').actif, true); assert.strictEqual(a('2026-11-23').actif, true);
  assert.strictEqual(a('2026-11-24').actif, false);
});
t('point d’alerte éteint si seules des recommandations non fiables, ou si tout est couvert', () => {
  const al = r => A.alerteAchats({ aujourdhui: '2026-11-18', limite: '2026-11-23', recommandations: r }).actif;
  assert.strictEqual(al([{ indicatif: true, a_commander: null }, { indicatif: true, a_commander: 8 }]), false);
  assert.strictEqual(al([{ indicatif: false, a_commander: 0 }]), false);
  assert.strictEqual(al([{ indicatif: true, a_commander: 8 }, { indicatif: false, a_commander: 8 }]), true);
  assert.strictEqual(A.echeanceAchats({ limite: '2026-11-23', recommandations: [{ indicatif: false, a_commander: 5 }] }).couvert, false);
});
t('échéance achats acceptée par prochaineEcheance', () => {
  const V = require('./nexus-campagne-ventes.js');
  const e = V.prochaineEcheance({ campagneFin: '2026-11-30', dernierImportFin: '2026-11-10', autres: [A.echeanceAchats({ limite: '2026-11-23', recommandations: [{ a_commander: 5 }] })] });
  assert.ok(e);
});
t('aucune écriture ni envoi vers un fournisseur dans le moteur', () => {
  const src = fs.readFileSync('./nexus-campagne-achats.js', 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|mailto:|\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(|supabase|WebSocket/i.test(src));
});
t('douze désignations réelles Petromix : le besoin arrondit au carton de la désignation', () => {
  const att = { 'Biere Heineken 0.0 25 cl - 24P': 24, 'Bisc Oreo 66gr -20P': 20, 'Quadratini chocolate 125g -12P': 12, 'Quadratini napoliter 125g - 12P': 12, 'Quadratini vanille 125g -12P': 12, 'Pringles Origl 175g - 19P': 19, 'Chips Lays Nature 75gr - 15P': 15, 'Eau didier gazeux 50 cl -8P': 8, 'Schweppes agrumes 50cl -8P': 8, 'Schweppes pomme 50cl -8P': 8, 'Schweppes Tonic 50cl -8P': 8 };
  Object.keys(att).forEach(nom => {
    const r = A.besoinAchat({ article: nom, objectifJour: 3, joursRestants: 7, ventesRefJour: 1, joursCouverture: 15, stock: 5, fiable: true, resteARecevoir: 0, aujourdhui: '2026-11-16', limite: '2026-11-23' });
    assert.strictEqual(r.a_commander % att[nom], 0, nom);
    assert.ok(r.a_commander >= 31, nom);
    assert.strictEqual(r.preremplir, true, nom);
  });
  const r = A.besoinAchat({ article: 'Jus caresse 50cl TS PARF', objectifJour: 3, joursRestants: 7, ventesRefJour: 1, joursCouverture: 15, stock: 5, fiable: true, resteARecevoir: 0, aujourdhui: '2026-11-16', limite: '2026-11-23' });
  assert.strictEqual(r.a_commander, 31);
});
t('aucune écriture ni envoi vers un fournisseur dans la page Achats, la page Livraison et le menu', () => {
  const nu = f => fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
  const achats = nu('./NEXUS-Campagne-v2-Achats.html');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|mailto:|WebSocket|\.rpc\(|\.update\(|\.upsert\(|\.delete\(/i.test(achats));
  const ecritures = (achats.match(/\.from\('([a-z_]+)'\)\.insert/g) || []).map(x => /'([a-z_]+)'/.exec(x)[1]);
  ecritures.forEach(t2 => assert.ok(/^campagne_commande/.test(t2), t2));
  const liv = nu('./NEXUS-Campagne-v2-Livraison.html');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|mailto:/i.test(liv));
});
t('le point achats du menu ne lit que des tables, sans écriture ni envoi', () => {
  const src = fs.readFileSync('./nexus-desktop.js', 'utf8');
  const bloc = src.slice(src.indexOf('async function nexusVerifierAlerteAchats'), src.indexOf('function nexusInstallerCurseurSidebar'));
  assert.ok(bloc.length > 200 && !/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(|fetch\(/.test(bloc));
});
t('la tuile Mes opportunités d\u2019achat est disponible et mène à la page Achats', () => {
  global.window = global.window || {};
  const V = require('./nexus-vocabulaire.js');
  const carte = (global.window.NexusVocab || V).campagne.cartes.find(c => c.cle === 'opportunites-achat');
  assert.strictEqual(carte.dispo, true);
  assert.strictEqual(carte.picto, 'opportunites-achat');
  assert.ok(/NEXUS-Campagne-v2-Achats\.html/.test(fs.readFileSync('./NEXUS-Campagne-v2.html', 'utf8')));
});

// ---- Un seul moteur pour la page Achats, l'accueil et le point du menu (consigne de Guardian, #160 6884997471). ----
const m_fausseBase = tables => ({ from: nom => { const b = { select: () => b, eq: () => b, order: () => b, then: (ok, ko) => Promise.resolve({ data: tables[nom] || [], error: null }).then(ok, ko) }; return b; } });
const m_CAMP = { id: 'c1', date_debut: '2026-11-01', date_fin: '2026-11-30' };
const m_base = (commandes, lignesCmd) => ({
  campagne_objectifs_produits: [
    { article: 'Petromix A - 8P', version: 1, objectif_valide_jour: 4, ventes_ref_jour: 1.5 },
    { article: 'Petromix B - 8P', version: 1, objectif_valide_jour: 4, ventes_ref_jour: 1.5 }],
  campagne_stock_depart: [
    { article: 'Petromix A - 8P', version: 1, quantite: 0, date_stock: '2026-11-19', source: 'comptage', a_confirmer: false },
    { article: 'Petromix B - 8P', version: 1, quantite: 0, date_stock: '2026-11-19', source: 'comptage', a_confirmer: false }],
  campagne_ventes_points: [
    { batch_id: 'b1', article: 'Petromix A - 8P', date_fin: '2026-11-19', importe_le: '2026-11-19T10:00:00Z', quantite: 0 },
    { batch_id: 'b1', article: 'Petromix B - 8P', date_fin: '2026-11-19', importe_le: '2026-11-19T10:00:00Z', quantite: 0 }],
  campagne_commandes: commandes, campagne_commande_lignes: lignesCmd,
});
const m_lg = (a, u) => ({ commande_id: 'o1', article: a, unites_commandees: u, cartons: u / 8, unites_par_carton: 8, recommande_unites: u });
const m_cmd1 = [{ id: 'o1', fournisseur: 'F', date_commande: '2026-11-19', date_livraison_prevue: null, note: null, remplace_commande_id: null, cree_le: '2026-11-19T10:00:00Z' }];
const m_etat = async (tables, auj) => { const d = await A.chargerDonnees(m_fausseBase(tables), 'site', m_CAMP, async () => []); return { d, e: A.etatAchats({ campagne: m_CAMP, donnees: d, aujourdhui: auj }) }; };

(async () => {
  const sans = await m_etat(m_base([], []), '2026-11-20');
  const un = await m_etat(m_base(m_cmd1, [m_lg('Petromix A - 8P', 400)]), '2026-11-20');
  const deux = await m_etat(m_base(m_cmd1, [m_lg('Petromix A - 8P', 400), m_lg('Petromix B - 8P', 400)]), '2026-11-20');
  t('deux articles fiables, un seul commandé : le point du menu est allumé', () => {
    assert.ok(sans.e.ctx.reco.every(r => !r.b.indicatif), 'les deux recommandations sont fiables');
    assert.strictEqual(un.e.alerte.actif, true);
    assert.strictEqual(un.e.echeance.couvert, false);
  });
  t('deux articles fiables, les deux commandés : le point du menu est éteint', () => {
    assert.strictEqual(deux.e.alerte.actif, false);
    assert.strictEqual(deux.e.echeance.couvert, true);
  });
  const hors = await m_etat(m_base([], []), '2026-11-10');
  const apres = await m_etat(m_base([], []), '2026-11-24');
  t('hors de D7-7 à D7 inclus, le point est éteint', () => {
    assert.strictEqual(hors.e.alerte.actif, false);
    assert.strictEqual(apres.e.alerte.actif, false);
    assert.strictEqual(sans.e.alerte.actif, true);
  });
  t('égalité : page Achats, accueil et menu obtiennent le même résultat des mêmes données', async () => {
    const page = A.recommandationsCampagne({ campagne: m_CAMP, donnees: un.d, aujourdhui: '2026-11-20' });
    assert.deepStrictEqual(page.reco.map(r => r.b), un.e.ctx.reco.map(r => r.b));
    const accueil = A.etatAchats({ campagne: m_CAMP, donnees: un.d, aujourdhui: '2026-11-20' }).echeance;
    assert.deepStrictEqual(accueil, un.e.echeance);
    assert.strictEqual(un.e.alerte.actif, un.e.echeance.couvert === false);
  });
  t('le chargement est un seul code, appelé par les trois écrans', () => {
    const page = fs.readFileSync('./NEXUS-Campagne-v2-Achats.html', 'utf8');
    const accueil = fs.readFileSync('./NEXUS-Campagne-v2.html', 'utf8');
    const menu = fs.readFileSync('./nexus-desktop.js', 'utf8');
    assert.ok(/A\.chargerDonnees\(/.test(page) && /A\.recommandationsCampagne\(/.test(page));
    assert.ok(/NexusCampagneAchats\.chargerDonnees\(/.test(accueil) && /NexusCampagneAchats\.etatAchats\(/.test(accueil) && !/COMMANDES_VALIDES/.test(accueil));
    assert.ok(/A\.chargerDonnees\(/.test(menu) && /A\.etatAchats\(/.test(menu));
    assert.ok(!/campagne_commandes'\)/.test(menu));
  });
  // Corrections de revue (Guardian, 6885148762)
  t('réglage : une couverture de 0 jour reste 0, elle n’est pas remplacée par 15', () => {
    assert.strictEqual(A.reglages([{ version: 1, jours_couverture_apres: 0, delai_commande_jours: 7 }]).joursCouverture, 0);
  });
  t('tout indicatif : l’échéance reste affichée « à confirmer », le point du menu reste éteint', () => {
    const rec = [{ indicatif: true, hors_delai: false, a_commander: 8 }, { indicatif: true, hors_delai: false, a_commander: null }];
    const e = A.echeanceAchats({ limite: '2026-11-23', recommandations: rec });
    assert.strictEqual(e.couvert, false); assert.strictEqual(e.aConfirmer, true);
    assert.strictEqual(A.alerteAchats({ aujourdhui: '2026-11-20', limite: { date: '2026-11-23' }, recommandations: rec }).actif, false);
    assert.strictEqual(A.echeanceAchats({ limite: '2026-11-23', recommandations: [{ indicatif: false, a_commander: 5 }] }).aConfirmer, false);
    assert.strictEqual(A.echeanceAchats({ limite: '2026-11-23', recommandations: [{ indicatif: true, a_commander: 0 }] }).couvert, true);
  });
  t('article à l’unité : la ligne enregistrée n’a pas de cartons', () => {
    const l = A.ligneCommande({ cond: S.conditionnement('Article seul', { 'article seul': 1 }) || { source: 'a_l_unite', unitesParCarton: 1 }, saisie: 559, article: 'X', recommande: 559 });
    const u = A.ligneCommande({ cond: { source: 'a_l_unite', unitesParCarton: 1, aRenseigner: false }, saisie: 559, article: 'X', recommande: 559 });
    assert.strictEqual(u.cartons, null); assert.strictEqual(u.unites_commandees, 559); assert.strictEqual(u.unites_par_carton, 1);
    assert.ok(l.cartons == null || l.cartons > 0);
    const inconnu = A.ligneCommande({ cond: S.conditionnement('Sans suffixe', null), saisie: 10, article: 'Y', recommande: null });
    assert.strictEqual(inconnu.cartons, null); assert.strictEqual(inconnu.unites_par_carton, null);
  });
  t('article en carton : la saisie en cartons donne les unités', () => {
    assert.deepStrictEqual(A.modeSaisie(cond8), { mode: 'cartons', upc: 8 });
    const l = A.ligneCommande({ cond: cond8, saisie: 7, article: 'Tonic - 8P', recommande: 56 });
    assert.strictEqual(l.cartons, 7); assert.strictEqual(l.unites_commandees, 56); assert.strictEqual(l.unites_par_carton, 8);
  });
  t('la page : libellé du menu, pas de « carton de 1 », une ligne repliable par article, saisie en cartons', () => {
    const page = fs.readFileSync('./NEXUS-Campagne-v2-Achats.html', 'utf8');
    assert.ok(/\$\('lienMenu'\)\.textContent = V\.menu \|\| '☰ Menu'/.test(page));
    assert.ok(/b\.cartons == null/.test(page));
    assert.ok(!/<table class="vt-table">/.test(page) && /<details class="vt-prod"/.test(page));
    assert.ok(/A\.ligneCommande\(/.test(page) && /A\.modeSaisie\(/.test(page));
  });
  t('le point du menu suit le délai de commande du site', () => {
    const menu = fs.readFileSync('./nexus-desktop.js', 'utf8');
    assert.ok(/campagne_achats_reglages/.test(menu) && /delai_commande_jours/.test(menu));
    assert.ok(!/- 7 \* 86400000/.test(menu));
  });
  t('ligne repliée : « indicatif » et « hors délai » visibles dans le résumé, en grisé', () => {
    const page = fs.readFileSync('./NEXUS-Campagne-v2-Achats.html', 'utf8');
    assert.ok(/P\.indicatifCourt/.test(page) && /P\.horsDelaiCourt/.test(page));
    const dec = page.slice(page.indexOf('const marque ='), page.indexOf("</summary>'"));
    assert.ok(/b\.indicatif/.test(dec) && /b\.hors_delai/.test(dec) && /data-marque/.test(dec) && /var\(--t-mid\)/.test(dec), 'la marque est dans le summary');
    const V = require('./nexus-vocabulaire.js');
    const ap = (V.campagne || V).achatsPage || (V.campagne && V.campagne.achatsPage);
    if (ap) { assert.strictEqual(ap.indicatifCourt, 'indicatif'); assert.strictEqual(ap.horsDelaiCourt, 'hors délai'); }
  });
  console.log(n + ' tests OK');
})().catch(e => { console.error(e); process.exit(1); });
