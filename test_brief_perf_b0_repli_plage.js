// B0-perf-4b : le repli carburant du Brief en UNE vague de lectures par plage
// retient le MÊME jour, avec le MÊME contrôle, que l'ancienne boucle série
// (chargerControleJour jour par jour, premier complet DANS L'ORDRE).
const assert = require('assert');
const path = require('path');
global.window = global;
require(path.join(__dirname, 'nexus-boussole-moteur.js'));
require(path.join(__dirname, 'nexus-carburant-moteur.js'));
require(path.join(__dirname, 'nexus-periodes.js'));
require('./outils/fuseau-metier-pour-tests.js').installerAvecFuseau('America/Martinique');
require(path.join(__dirname, 'nexus-carburant-donnees.js'));
const M = global.NexusCarburantMoteur, P = global.NexusPeriodes, D = global.NexusCarburantDonnees;
const ORIGINAL = D.chargerControleJour;

const AUJ = '2026-08-27';
const SITE = 'site-test';
const jour = n => P.ajouterJours(AUJ, -n);
const MAINTENANT = new Date('2026-08-27T15:00:00.000Z').getTime();

// Horloge figée : chargerControleJour lit `new Date()` quand il n'y a pas de relevé du jour.
const DateReelle = Date;
function figerHorloge() {
  global.Date = class extends DateReelle {
    constructor(...a) { if (a.length === 0) super(MAINTENANT); else super(...a); }
    static now() { return MAINTENANT; }
  };
}
function libererHorloge() { global.Date = DateReelle; }

const estComplet = c => M.jourCarburantEstComplet(c.parCarburant, c.aucunReleve);

function releve(date, o = {}) {
  return {
    site: SITE, date, origine: o.origine || 'jaugeage', mesure_le: o.mesure_le === undefined ? `${date}T10:00:00+00:00` : o.mesure_le,
    stock_reel_go_cuve1: o.go1 === undefined ? 1000 : o.go1, stock_reel_go_cuve2: o.go2 === undefined ? 1000 : o.go2,
    stock_reel_sp95: o.sp95 === undefined ? 2000 : o.sp95, stock_reel_gnr: o.gnr === undefined ? 500 : o.gnr,
    livraison_go: 0, livraison_sp95: 0, livraison_gnr: 0, mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0,
  };
}
function audit(date, quart = 'quart1', l = 100) {
  return { site: SITE, date, quart, litrage_gazole: l, litrage_sp95: l, litrage_gnr: l };
}
const tablesVides = () => ({
  carburant_releves: [], carburant_stock_references: [], carburant_stock_reference_lignes: [],
  station_config: [{ site: SITE, horaires: { quart1: { etendu: '05:45', fin_etendu: '13:45' }, quart2: { etendu: '13:40', fin_etendu: '22:05' } }, fuseau_horaire: 'America/Martinique' }],
  audits_caisse: [], carburant_reception_visites: [], carburant_reception_mesures: [], carburant_reception_visite_lignes: [],
});

// Faux client « réseau » : même moteur mémoire, sans garde, avec comptage des requêtes.
function clientReseau(tables) {
  const m = D.creerClientMemoire(tables);
  let n = 0;
  return { client: { from: t => { n++; return m.client.from(t); } }, compte: () => n };
}

// Rejoue le scénario de deux façons et exige l'égalité exacte.
async function comparer(nom, tables, candidats, attendu) {
  figerHorloge();
  try {
    const ancien = clientReseau(tables);
    let refIndex = -1, refControle = null;
    for (let i = 0; i < candidats.length; i++) {
      const c = await D.chargerControleJour(ancien.client, SITE, candidats[i]);
      if (estComplet(c)) { refIndex = i; refControle = c; break; }
    }
    // Les lectures « plage » passent par le même moteur mémoire, mais comptées à part.
    const plage = clientReseau(tables);
    const r = await D.chargerControlesRepliEnPlage(plage.client, SITE, candidats, AUJ, estComplet);
    assert.strictEqual(r.index, refIndex, `${nom} : index`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(r.controle)), JSON.parse(JSON.stringify(refControle)), `${nom} : contrôle`);
    if (attendu !== undefined) assert.strictEqual(r.index, attendu, `${nom} : index attendu`);
    console.log(`ok  ${nom} : index ${r.index}, requêtes ${ancien.compte()} → ${plage.compte()}`);
    return { index: r.index, serie: ancien.compte(), plage: plage.compte() };
  } finally { libererHorloge(); }
}

const CANDIDATS = Array.from({ length: 6 }, (_, i) => jour(i));   // AUJ, J-1 ... J-5

// Jaugeages quotidiens du jour d'ancre jusqu'à `fin` (décalages en jours), avec ventes.
function chaine(tables, decalages) {
  decalages.forEach(n => { tables.carburant_releves.push(releve(jour(n))); tables.audits_caisse.push(audit(jour(n))); });
}

(async () => {
  const stats = [];

  // 1. jour courant complet
  { const t = tablesVides(); chaine(t, [8, 7, 6, 5, 4, 3, 2, 1, 0]);
    stats.push(await comparer('jour courant complet', t, CANDIDATS, 0)); }

  // 2. un jour incomplet (aujourd'hui sans relevé, J-1 complet)
  { const t = tablesVides(); chaine(t, [8, 7, 6, 5, 4, 3, 2, 1]);
    const s = await comparer('1 jour incomplet', t, CANDIDATS); assert.ok(s.index >= 1); stats.push(s); }

  // 3. deux jours incomplets : le relevé de J-1 existe mais sans jauge SP95/GNR/GO
  { const t = tablesVides(); chaine(t, [8, 7, 6, 5, 4, 3, 2]);
    t.carburant_releves.push(releve(jour(1), { go1: null, go2: null, sp95: null, gnr: null }));
    const s = await comparer('2 jours incomplets', t, CANDIDATS); assert.strictEqual(s.index, 2); stats.push(s); }

  // 4. cinq jours incomplets
  { const t = tablesVides(); chaine(t, [9, 8, 7, 6, 5]);
    const s = await comparer('5 jours incomplets', t, CANDIDATS); assert.strictEqual(s.index, 5); stats.push(s); }

  // 5. aucun jour complet : aucun relevé du tout
  { const t = tablesVides();
    const s = await comparer('aucun jour complet', t, CANDIDATS, -1); stats.push(s); }

  // 6. cuve inactive : GNR jamais jaugé (null partout)
  { const t = tablesVides();
    [8, 7, 6, 5, 4, 3, 2, 1, 0].forEach(n => { t.carburant_releves.push(releve(jour(n), { gnr: null })); t.audits_caisse.push(audit(jour(n))); });
    stats.push(await comparer('cuve inactive', t, CANDIDATS)); }

  // 7. point zéro plus récent que le dernier relevé
  { const t = tablesVides(); chaine(t, [9, 8, 7]);
    t.carburant_stock_references.push({ id: 'ref1', site: SITE, type: 'initialisation', date: jour(3), heure: '08:00', created_at: `${jour(3)}T08:00:00.000Z` });
    ['go', 'sp95', 'gnr'].forEach(c => t.carburant_stock_reference_lignes.push({ reference_id: 'ref1', carburant: c, stock_reel: 1500 }));
    t.audits_caisse.push(audit(jour(3)), audit(jour(2)));
    t.carburant_releves.push(releve(jour(1)));
    stats.push(await comparer('point zéro ancre', t, CANDIDATS)); }

  // 8. relevé lié à une réception (mesure_le précis) et quart chevauchant
  { const t = tablesVides(); chaine(t, [9, 8, 7, 6, 5, 4]);
    t.carburant_releves.push(releve(jour(3), { origine: 'reception_livraison', mesure_le: `${jour(3)}T14:30:00.000Z` }));
    t.audits_caisse.push(audit(jour(3), 'quart2', 80), audit(jour(2), 'quart1', 90));
    t.carburant_releves.push(releve(jour(1)));
    stats.push(await comparer('relevé de réception', t, CANDIDATS)); }

  // 9. visite de réception terminée entre l'ancre et le jour courant
  { const t = tablesVides(); chaine(t, [8, 7, 6, 5, 4, 3, 2, 1]);
    t.carburant_reception_visites.push({ id: 'v1', site: SITE, date_visite: jour(1), heure_debut: `${jour(1)}T11:00:00.000Z`, heure_fin: `${jour(1)}T13:00:00+00:00`, statut: 'terminee' });
    t.carburant_reception_mesures.push({ visite_id: 'v1', carburant: 'sp95', jaugeage_apres_l: 2500, jaugeage_apres_le: `${jour(1)}T13:00:00.000Z` });
    stats.push(await comparer('réception récente', t, CANDIDATS)); }

  // 10. mélange +00:00 / .000Z sur les horodatages de visites (comparaison ISO)
  { const t = tablesVides(); chaine(t, [8, 7, 6, 5, 4, 3, 2, 1]);
    for (let i = 0; i < 25; i++) {
      const d = jour(2 + (i % 9));
      t.carburant_reception_visites.push({ id: `w${i}`, site: SITE, date_visite: d, heure_debut: `${d}T0${i % 9}:00:00+00:00`, heure_fin: i % 2 ? `${d}T1${i % 9}:00:00+00:00` : `${d}T1${i % 9}:00:00.000Z`, statut: 'terminee' });
      t.carburant_reception_mesures.push({ visite_id: `w${i}`, carburant: ['go', 'sp95', 'gnr'][i % 3], jaugeage_apres_l: 1800 + i, jaugeage_apres_le: null });
    }
    stats.push(await comparer('visites nombreuses, horodatages mêlés', t, CANDIDATS)); }

  // 11. fuzz déterministe
  let graine = 12345;
  const alea = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const indices = new Set();
  for (let k = 0; k < 150; k++) {
    const t = tablesVides();
    for (let n = 14; n >= 0; n--) {
      if (alea() < 0.65) t.carburant_releves.push(releve(jour(n), {
        go1: alea() < 0.15 ? null : 1000, sp95: alea() < 0.15 ? null : 2000, gnr: alea() < 0.2 ? null : 500,
        origine: alea() < 0.15 ? 'reception_livraison' : 'jaugeage',
        mesure_le: alea() < 0.1 ? null : `${jour(n)}T${String(8 + Math.floor(alea() * 8)).padStart(2, '0')}:00:00${alea() < 0.5 ? '+00:00' : '.000Z'}`,
      }));
      if (alea() < 0.8) t.audits_caisse.push(audit(jour(n), alea() < 0.5 ? 'quart1' : 'quart2', Math.floor(alea() * 300)));
      if (alea() < 0.15) {
        const id = `f${k}_${n}`;
        t.carburant_reception_visites.push({ id, site: SITE, date_visite: jour(n), heure_debut: `${jour(n)}T09:00:00.000Z`, heure_fin: `${jour(n)}T1${Math.floor(alea() * 9)}:00:00+00:00`, statut: 'terminee' });
        t.carburant_reception_mesures.push({ visite_id: id, carburant: ['go', 'sp95', 'gnr'][Math.floor(alea() * 3)], jaugeage_apres_l: 1500, jaugeage_apres_le: null });
      }
      if (alea() < 0.05) {
        const id = `r${k}_${n}`;
        t.carburant_stock_references.push({ id, site: SITE, type: 'initialisation', date: jour(n), heure: '07:30', created_at: `${jour(n)}T07:30:00.000Z` });
        ['go', 'sp95', 'gnr'].forEach(c => t.carburant_stock_reference_lignes.push({ reference_id: id, carburant: c, stock_reel: 1200 }));
      }
    }
    const s = await comparer(`fuzz ${k}`, t, CANDIDATS);
    indices.add(s.index); stats.push(s);
  }
  assert.ok(indices.size >= 3, `le tirage doit varier les résultats (vu: ${[...indices]})`);

  // 12. enveloppe P0 installée : la version enveloppée est celle rejouée
  { const t = tablesVides(); chaine(t, [8, 7, 6, 5, 4, 3, 2, 1]);
    let appels = 0;
    D.chargerControleJour = async (c, s, d) => { appels++; return ORIGINAL(c, s, d); };
    figerHorloge();
    try {
      const r = await D.chargerControlesRepliEnPlage(clientReseau(t).client, SITE, CANDIDATS, AUJ, estComplet);
      assert.ok(r.index >= 1); assert.ok(appels >= 1, 'enveloppe appelée');
    } finally { libererHorloge(); D.chargerControleJour = ORIGINAL; }
    console.log('ok  enveloppe P0 respectée'); }

  // 13. HORS_PLAGE : la lecture d'une table non préchargée lève, l'appelant retombe sur la boucle réseau
  { const m = D.creerClientMemoire({ carburant_releves: [] }, {});
    let leve = false;
    try { await m.client.from('table_inconnue').select('*'); } catch (e) { leve = /HORS_PLAGE/.test(String(e.message)); }
    const aussi = m.etat.horsPlage || leve;
    assert.ok(aussi, 'HORS_PLAGE signalé');
    console.log('ok  garde HORS_PLAGE'); }

  // 14. 1000 lignes ou plus : refus explicite (PLAGE_TROP_LARGE)
  { const t = tablesVides();
    for (let i = 0; i < 1000; i++) t.audits_caisse.push(audit(jour(i % 6), `q${i}`, 1));
    figerHorloge();
    try {
      await assert.rejects(() => D.chargerControlesRepliEnPlage(clientReseau(t).client, SITE, CANDIDATS, AUJ, estComplet), /PLAGE_TROP_LARGE/);
    } finally { libererHorloge(); }
    console.log('ok  PLAGE_TROP_LARGE'); }

  const serie = stats.reduce((a, s) => a + s.serie, 0), plage = stats.reduce((a, s) => a + s.plage, 0);
  console.log(`\nÉquivalence prouvée sur ${stats.length} scénarios. Requêtes : ${serie} (série) → ${plage} (plage).`);
})().catch(e => { console.error(e); process.exit(1); });
