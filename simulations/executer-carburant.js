// Scénarios Carburant exécutables — `node simulations/executer-carburant.js`
//
// Chaque scénario décrit une situation d'exploitation réelle et vérifie ce que
// la chaîne de contrôle en fait. L'intérêt n'est pas de figer des nombres mais
// de figer des COMPORTEMENTS : quand NEXUS a le droit d'afficher un écart, et
// quand il doit se taire.
'use strict';

const assert = require('assert');
const S = require('./scenarios-carburant.js');

let echecs = 0;
function verifier(libelle, condition) {
  if (condition) { console.log(`     ✔ ${libelle}`); }
  else { console.log(`     ✘ ${libelle}`); echecs++; }
}

(async () => {
  // ---------------------------------------------------------------
  // A — La situation réelle du 02/09/2026, telle que Frédéric l'a vécue :
  // livraison la veille à 08:56 (au milieu du quart 1), jaugeage ce matin
  // à 05:55, quart 2 de la veille pas encore saisi dans Verify.
  // ---------------------------------------------------------------
  const a = await S.executer('A · Livraison la veille en plein quart 1, quart 2 non saisi', S.base(), S.MODULES_ECRAN);
  verifier("l'ancre est la mesure post-livraison, jamais le relevé d'avant livraison",
    Math.round(a.parCarburant.sp95.dernierReel) === 25280 && Math.round(a.parCarburant.go.dernierReel) === 23536);
  verifier("aucun écart affiché : le quart 1 chevauche l'instant de réception, ventilation impossible",
    a.parCarburant.sp95.ecart == null && a.parCarburant.go.ecart == null);
  verifier("la livraison n'est jamais ajoutée par-dessus une ancre qui la contient déjà",
    Number(a.parCarburant.sp95.livraison) === 0 && Number(a.parCarburant.go.livraison) === 0);

  // ---------------------------------------------------------------
  // B — Même situation, quart 2 de la veille saisi. Le chevauchement du
  // quart 1 sur l'instant de livraison demeure : saisir davantage ne rend
  // pas une ventilation intra-quart possible pour autant.
  // ---------------------------------------------------------------
  const b = await S.executer('B · Idem, mais quart 2 de la veille saisi', S.base({
    audits_caisse: [S.QUART1_01, S.QUART2_01],
  }), S.MODULES_ECRAN);
  verifier("toujours aucun écart : compléter Verify ne résout pas un chevauchement de quart",
    b.parCarburant.sp95.ecart == null);

  // ---------------------------------------------------------------
  // C — Journée sans livraison : deux jaugeages matinaux encadrent des
  // quarts entiers. C'est le cas nominal, un écart DOIT sortir.
  // ---------------------------------------------------------------
  const c = await S.executer('C · Journée normale sans livraison', {
    carburant_releves: [
      Object.assign({}, S.RELEVE_01, { date: '2026-09-01', stock_reel_sp95: 12000, stock_reel_go_cuve1: 6000, stock_reel_go_cuve2: 4000 }),
      Object.assign({}, S.RELEVE_02, { date: '2026-09-02', stock_reel_sp95: 9602, stock_reel_go_cuve1: 4000, stock_reel_go_cuve2: 3385 }),
    ],
    carburant_stock_references: [], carburant_stock_reference_lignes: [],
    carburant_reception_visites: [], carburant_reception_mesures: [],
    audits_caisse: [S.QUART1_01, S.QUART2_01],
    station_config: S.CONFIG,
  }, S.MODULES_ECRAN);
  verifier("un écart EST calculé quand rien ne manque",
    c.parCarburant.sp95.ecart != null && c.parCarburant.go.ecart != null);
  verifier("l'écart est proche de zéro sur des ventes cohérentes (|écart| < 50 L)",
    Math.abs(Number(c.parCarburant.sp95.ecart)) < 50 && Math.abs(Number(c.parCarburant.go.ecart)) < 50);

  // ---------------------------------------------------------------
  // D — Non-régression du bug du 02/09. Le piège : un point zéro ANTÉRIEUR
  // à la livraison ne doit jamais redevenir l'ancre, sinon la livraison
  // n'est comptée nulle part et ressort en gain fantôme.
  // ---------------------------------------------------------------
  const d = await S.executer('D · Non-régression — point zéro antérieur à la livraison', S.base(), S.MODULES_ECRAN);
  const gainFantome = ['sp95', 'go'].some(cle => Number(d.parCarburant[cle].ecart) > 5000);
  verifier("aucun gain fantôme de l'ordre de la livraison (+33 957 L le 02/09/2026)", !gainFantome);

  // ---------------------------------------------------------------
  // E — La ventilation avec estimation, branchée à côté du calcul mesuré.
  // Le contrôle continue de se taire (aucun écart), mais un ordre de
  // grandeur estimé devient disponible pour l'écran et pour la trace.
  // ---------------------------------------------------------------
  const { creerFauxClient } = require('./faux-client-supabase.js');
  const { creerContexte } = require('./banc.js');

  // Historique de ventes pour que l'estimation ait de quoi s'appuyer.
  const histo = [];
  for (let j = 20; j >= 3; j--) {
    const d = new Date(Date.UTC(2026, 8, 2) - j * 86400000).toISOString().slice(0, 10);
    histo.push({ site: S.SITE, date: d, quart: '1', litrage_sp95: 1400, litrage_gazole: 1200, litrage_gnr: 0 });
    histo.push({ site: S.SITE, date: d, quart: '2', litrage_sp95: 1000, litrage_gazole: 1500, litrage_gnr: 0 });
  }
  const tablesE = S.base({ audits_caisse: histo.concat([S.QUART1_01]) });
  const ctxE = creerContexte(S.MODULES_ECRAN);
  if (ctxE.NexusCarburantsP0Fixes && ctxE.NexusCarburantsP0Fixes.installer) ctxE.NexusCarburantsP0Fixes.installer();
  const clientE = creerFauxClient(tablesE);
  const e = await ctxE.NexusCarburantDonnees.chargerControleJour(clientE, S.SITE, '2026-09-02', 'America/Martinique');

  console.log('\n### E · Ventilation estimée disponible à côté du calcul mesuré');
  const nb = v => (v == null ? '—' : Math.round(v).toLocaleString('fr-FR'));
  console.log(`  ventes estimées  go ${nb(e.ventilation && e.ventilation.ventes.go)} · sp95 ${nb(e.ventilation && e.ventilation.ventes.sp95)}`);
  console.log('  contexte         ' + (e.ventilation ? e.ventilation.contexte
    .map(c => `${c.date.slice(5)} q${c.quart} ${c.nature}`).join(' · ') : '—'));

  verifier('une ventilation estimée est produite', !!(e.ventilation && e.ventilation.estime));
  verifier("l'écart mesuré reste tu : rien d'estimé n'est promu en écart",
    e.parCarburant.sp95.ecart == null && e.parCarburant.go.ecart == null);
  verifier("les ventes du contrôle (celles qui alimenteraient carburant_controles) restent non mesurées",
    e.parCarburant.sp95.ventes == null);
  verifier('le quart 1 à cheval sur la livraison est bien identifié comme estimé',
    e.ventilation.contexte.some(c => c.quart === '1' && c.nature === 'estime_chevauchement'));

  // F — Le contexte est consigné, et un recalcul empile au lieu d'écraser.
  const r1 = await ctxE.NexusCarburantDonnees.enregistrerContexteVentilation(clientE, S.SITE, '2026-09-02', e.ventilation);
  const r2 = await ctxE.NexusCarburantDonnees.enregistrerContexteVentilation(clientE, S.SITE, '2026-09-02', e.ventilation);
  const consignes = clientE._tables.carburant_ventilation_contexte || [];
  console.log(`\n### F · Trace du contexte\n  ${consignes.length} lignes consignées sur 2 calculs`);
  verifier('le contexte est consigné ligne par quart', r1.ok && r1.lignes === e.ventilation.contexte.length);
  verifier('un recalcul empile un nouveau calcul_id au lieu d’écraser',
    r2.ok && new Set(consignes.map(l => l.calcul_id)).size === 2);
  verifier('aucune ligne de contrôle métier n’a été écrite au passage',
    !(clientE._tables.carburant_controles || []).length);

  // ---------------------------------------------------------------
  // G — Ce que la carte Pilotage affichera. L'estimation remplit le silence,
  // et s'efface dès qu'un écart mesuré existe.
  // ---------------------------------------------------------------
  const Mg = ctxE.NexusCarburantMoteur;
  const estimSp95 = Mg.estimationControleCarburant(e.parCarburant.sp95, e.ventilation, 'sp95');
  console.log('\n### G · Composition de l’affichage');
  console.log(`  écart estimé sp95 : ${estimSp95.ecartEstime == null ? '—' : Math.round(estimSp95.ecartEstime).toLocaleString('fr-FR') + ' L'}`);
  console.log('  phrase            : ' + (estimSp95.phrase || '—').slice(0, 120) + '…');

  verifier('une estimation est composée là où le contrôle se tait', estimSp95.disponible === true);
  verifier("la phrase nomme les quarts estimés et dit que ce n'est pas un écart constaté",
    /quart 1 du 01\/09 \(coupé par la livraison\)/.test(estimSp95.phrase || '')
    && /pas un écart constaté/.test(estimSp95.phrase || ''));
  verifier("l'estimation reste un ordre de grandeur, pas le gain fantôme d'hier",
    Math.abs(estimSp95.ecartEstime) < 5000);

  // Dès qu'un théorique mesuré existe, l'estimation s'efface : elle ne vient
  // jamais concurrencer un chiffre réel.
  const avecMesure = Object.assign({}, e.parCarburant.sp95, { theorique: 20000, ecart: -120 });
  const estimEffacee = Mg.estimationControleCarburant(avecMesure, e.ventilation, 'sp95');
  verifier("l'estimation s'efface dès qu'un théorique mesuré existe", estimEffacee.disponible === false);

  console.log(`\n${echecs === 0 ? 'Tous les scénarios passent.' : echecs + ' scénario(s) en échec.'}`);
  process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
