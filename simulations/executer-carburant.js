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

  console.log(`\n${echecs === 0 ? 'Tous les scénarios passent.' : echecs + ' scénario(s) en échec.'}`);
  process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
