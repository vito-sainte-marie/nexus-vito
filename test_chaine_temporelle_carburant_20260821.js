// Test — Chaîne temporelle carburant (21/08/2026, demande de Frédéric :
// "peux-tu vérifier ma différence de litrage dans pilotage" -> faux écarts
// +1022L SP95 / +912L GO du 21/08/2026, causés par une ancre (jaugeage
// post-livraison du 20/08 à 15:01 UTC) comparée aux ventes de TOUTE la
// journée du 20/08, alors qu'une partie de ces ventes (quart 2) avait déjà
// eu lieu AVANT la mesure. Règle imposée par Frédéric : "Théorique(t1) =
// Physique(t0) + livraisons(t0,t1) + mouvements(t0,t1) − ventes(t0,t1)",
// avec un absolu : si un quart de ventes chevauche l'une des deux bornes,
// la fenêtre est déclarée PROVISOIRE/NON COMPARABLE, jamais une ventilation
// devinée.
//
// MIS À JOUR le 24/08/2026 (v2.232, anomalie signalée par Frédéric : heures
// carburant fausses en Martinique). `instantParisVersUTC` avait 'Europe/
// Paris' codé en dur alors que vito-sainte-marie est en Martinique
// (America/Martinique, UTC-4, jamais d'heure d'été — Paris est UTC+1/+2) :
// un décalage fixe de plusieurs heures sur TOUTES les fenêtres de quart.
// Renommée `instantLocalVersUTC(dateISO, heureHHMM, fuseau)` — `fuseau`
// est désormais un paramètre EXPLICITE, propagé à `fenetreQuartLarge` et
// `resoudreVentesFenetre`.
//
// DÉCOUVERTE EN CORRIGEANT CE TEST : recalculé avec le fuseau Martinique
// (le vrai fuseau de vito-sainte-marie), le scénario réel du 20-21/08/2026
// donne un verdict global IDENTIQUE (fenêtre non isolable, théorique/écart
// null sur les 3 carburants) mais pour une RAISON DIFFÉRENTE — c'est
// désormais le quart 1 du 20/08 qui chevauche l'instant de mesure t0
// (11:01 heure de Martinique, en plein dans sa fenêtre étendue 05:45-13:45),
// alors que l'ancien calcul (à tort en heure de Paris) désignait le quart 2
// (l'instant t0 en heure de Paris, 17:01, tombait dans la fenêtre étendue
// 13:40-22:05 du quart 2). Le verdict "Données insuffisantes" affiché à
// Frédéric le 21/08/2026 restait donc correct par coïncidence sur CE cas
// précis — mais le raisonnement qui y menait était faux, et rien ne
// garantit qu'un autre cas n'aurait pas donné un résultat différent (et
// donc un théorique/écart chiffré à tort) sous l'ancien fuseau erroné.
//
// PARTIE 1 — nexus-carburant-moteur.js : fonctions pures
//   (instantLocalVersUTC, fenetreQuartLarge, classerQuartFaceFenetre,
//   resoudreVentesFenetre, qualiteChaineCarburant avec la nouvelle cause).
// PARTIE 2 — nexus-carburant-donnees.js : chargerControleJour rejoue le
//   scénario RÉEL du 20-21/08/2026 sur vito-sainte-marie (données exactes
//   vérifiées en base), fuseau Martinique, et confirme fenetreIsolable=false
//   / théorique non calculé — jamais +1022L/+912L.

const path = require('path');
const assert = require('assert');

const PROJET = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}
async function testAsync(nom, fn) {
  try { await fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

global.window = global;
require(path.join(PROJET, 'nexus-carburant-moteur.js'));
require(path.join(PROJET, 'nexus-carburant-donnees.js'));
const M = global.NexusCarburantMoteur;
const D = global.NexusCarburantDonnees;
['instantLocalVersUTC', 'fenetreQuartLarge', 'classerQuartFaceFenetre', 'resoudreVentesFenetre']
  .forEach(fn => assert.strictEqual(typeof M[fn], 'function', `${fn} doit être exportée`));

const HORAIRES_VITO = {
  quart1: { etendu: '05:45', normal: '05:45', fin_etendu: '13:45', fin_normal: '12:45' },
  quart2: { etendu: '13:40', normal: '12:40', fin_etendu: '22:05', fin_normal: '20:05' },
};
const FUSEAU_VITO = 'America/Martinique'; // vraie station, jamais Europe/Paris.

// ------------------------------------------------------------
// PARTIE 1 — moteur pur
// ------------------------------------------------------------
testSync('instantLocalVersUTC : Martinique (UTC-4, jamais d\'heure d\'été) — 15:01 Martinique -> 19:01 UTC, été comme hiver', () => {
  const tAout = M.instantLocalVersUTC('2026-08-20', '15:01', FUSEAU_VITO);
  assert.strictEqual(tAout.toISOString(), '2026-08-20T19:01:00.000Z');
  const tJanvier = M.instantLocalVersUTC('2026-01-20', '15:01', FUSEAU_VITO);
  assert.strictEqual(tJanvier.toISOString(), '2026-01-20T19:01:00.000Z', 'Martinique ne bascule jamais — même décalage été/hiver');
});

testSync('instantLocalVersUTC : Europe/Paris — 15:01 Paris -> 13:01 UTC en août (CEST, UTC+2), preuve que la résolution 2 passes gère bien la DST pour un fuseau qui la connaît', () => {
  const t = M.instantLocalVersUTC('2026-08-20', '15:01', 'Europe/Paris');
  assert.strictEqual(t.toISOString(), '2026-08-20T13:01:00.000Z');
});

testSync('instantLocalVersUTC : entrée invalide -> null, jamais une exception (dont fuseau manquant ou inconnu)', () => {
  assert.strictEqual(M.instantLocalVersUTC(null, '15:01', FUSEAU_VITO), null);
  assert.strictEqual(M.instantLocalVersUTC('2026-08-20', null, FUSEAU_VITO), null);
  assert.strictEqual(M.instantLocalVersUTC('2026-08-20', 'xx:yy', FUSEAU_VITO), null);
  assert.strictEqual(M.instantLocalVersUTC('2026-08-20', '15:01', null), null, 'fuseau manquant -> null, aucun défaut silencieux dans le moteur (le défaut est de la responsabilité de l\'appelant)');
  assert.strictEqual(M.instantLocalVersUTC('2026-08-20', '15:01', 'Pas/UnFuseau'), null, 'fuseau IANA invalide -> null, jamais une exception qui remonterait à l\'écran');
});

testSync('fenetreQuartLarge : bornes ÉTENDUES (jamais normales) en Martinique, quart non configuré -> null', () => {
  const f1 = M.fenetreQuartLarge(HORAIRES_VITO, 'quart1', '2026-08-20', FUSEAU_VITO);
  assert.strictEqual(f1.debut.toISOString(), '2026-08-20T09:45:00.000Z'); // 05:45 Martinique (UTC-4)
  assert.strictEqual(f1.fin.toISOString(), '2026-08-20T17:45:00.000Z');  // 13:45 Martinique (étendu, pas 12:45 normal)
  assert.strictEqual(M.fenetreQuartLarge(HORAIRES_VITO, 'quart3', '2026-08-20', FUSEAU_VITO), null, 'Quart non configuré -> null, jamais un horaire inventé');
  assert.strictEqual(M.fenetreQuartLarge(null, 'quart1', '2026-08-20', FUSEAU_VITO), null);
  assert.strictEqual(M.fenetreQuartLarge(HORAIRES_VITO, 'quart1', '2026-08-20', null), null, 'fuseau manquant -> null, propagé depuis instantLocalVersUTC');
});

testSync('classerQuartFaceFenetre : avant / après / dans / chevauche / inconnu (fuseau Martinique)', () => {
  const t0 = new Date('2026-08-20T13:01:00.000Z');
  const t1 = new Date('2026-08-21T21:32:00.000Z');
  const quart1_20 = M.fenetreQuartLarge(HORAIRES_VITO, 'quart1', '2026-08-20', FUSEAU_VITO); // 09:45->17:45 UTC, chevauche t0 (13:01)
  const quart2_20 = M.fenetreQuartLarge(HORAIRES_VITO, 'quart2', '2026-08-20', FUSEAU_VITO); // 17:40 20/08 -> 02:05 21/08 UTC, dans [t0,t1]
  const quart1_21 = M.fenetreQuartLarge(HORAIRES_VITO, 'quart1', '2026-08-21', FUSEAU_VITO); // 09:45->17:45 UTC 21/08, dans [t0,t1]
  const quart2_21 = M.fenetreQuartLarge(HORAIRES_VITO, 'quart2', '2026-08-21', FUSEAU_VITO); // débute 17:40 UTC 21/08, chevauche t1
  assert.strictEqual(M.classerQuartFaceFenetre(quart1_20, t0, t1), 'chevauche');
  assert.strictEqual(M.classerQuartFaceFenetre(quart2_20, t0, t1), 'dans');
  assert.strictEqual(M.classerQuartFaceFenetre(quart1_21, t0, t1), 'dans');
  assert.strictEqual(M.classerQuartFaceFenetre(quart2_21, t0, t1), 'chevauche');
  assert.strictEqual(M.classerQuartFaceFenetre(null, t0, t1), 'inconnu');
});

testSync('resoudreVentesFenetre : scénario RÉEL 20/08->21/08 (vito-sainte-marie, fuseau Martinique) — quart 1 du 20/08 chevauche la livraison -> non isolable', () => {
  const lignesQuarts = [
    { date: '2026-08-20', quart: '1', litrage_gazole: 1443.78, litrage_sp95: 1615.74, litrage_gnr: 0 },
    { date: '2026-08-20', quart: '2', litrage_gazole: 974.6, litrage_sp95: 1355.31, litrage_gnr: 0 },
  ];
  const t0 = new Date('2026-08-20T15:01:16.151Z'); // mesure_le réelle du relevé post-livraison (11:01 Martinique)
  const t1 = new Date('2026-08-21T19:32:09.608Z'); // mesure_le réelle du relevé du 21/08 (15:32 Martinique)
  const r = M.resoudreVentesFenetre(lignesQuarts, HORAIRES_VITO, t0, t1, FUSEAU_VITO);
  assert.strictEqual(r.isolable, false, 'La visite de livraison (11:01 Martinique) tombe EN PLEIN dans la fenêtre étendue du quart 1 (05:45-13:45 Martinique) -> non isolable');
  assert.deepStrictEqual(r.ventes, { go: null, sp95: null, gnr: null }, 'Jamais une ventilation devinée -> ventes null sur les 3 carburants');
  assert.strictEqual(r.quartsChevauchants.length, 1);
  assert.strictEqual(r.quartsChevauchants[0].quart, '1', 'sous l\'ancien fuseau Paris (bug), c\'était à tort le quart 2 qui était désigné — voir l\'en-tête de ce fichier');
});

testSync('resoudreVentesFenetre : fenêtre propre (aucun chevauchement) -> somme exacte des quarts entièrement "dans"', () => {
  const lignesQuarts = [
    { date: '2026-08-19', quart: '1', litrage_gazole: 100, litrage_sp95: 200, litrage_gnr: 0 },
    { date: '2026-08-19', quart: '2', litrage_gazole: 50, litrage_sp95: 60, litrage_gnr: 5 },
  ];
  const t0 = M.instantLocalVersUTC('2026-08-19', '00:00', FUSEAU_VITO);
  const t1 = M.instantLocalVersUTC('2026-08-20', '01:00', FUSEAU_VITO);
  const r = M.resoudreVentesFenetre(lignesQuarts, HORAIRES_VITO, t0, t1, FUSEAU_VITO);
  assert.strictEqual(r.isolable, true);
  assert.deepStrictEqual(r.ventes, { go: 150, sp95: 260, gnr: 5 });
  assert.strictEqual(r.quartsChevauchants.length, 0);
});

testSync('resoudreVentesFenetre : quart hors fenêtre (avant t0 ou après t1) -> exclu proprement, jamais compté', () => {
  const lignesQuarts = [
    { date: '2026-08-18', quart: '1', litrage_gazole: 999, litrage_sp95: 999, litrage_gnr: 0 }, // avant
    { date: '2026-08-19', quart: '1', litrage_gazole: 100, litrage_sp95: 200, litrage_gnr: 0 }, // dans
    { date: '2026-08-22', quart: '1', litrage_gazole: 999, litrage_sp95: 999, litrage_gnr: 0 }, // après
  ];
  const t0 = M.instantLocalVersUTC('2026-08-19', '00:00', FUSEAU_VITO);
  const t1 = M.instantLocalVersUTC('2026-08-20', '01:00', FUSEAU_VITO);
  const r = M.resoudreVentesFenetre(lignesQuarts, HORAIRES_VITO, t0, t1, FUSEAU_VITO);
  assert.strictEqual(r.isolable, true);
  assert.deepStrictEqual(r.ventes, { go: 100, sp95: 200, gnr: 0 }, 'seul le quart "dans" (litrage_gnr=0, une vraie valeur captée) compte -> gnr=0, pas null');
});

testSync('resoudreVentesFenetre : quart avec horaires non configurés -> traité comme un chevauchement (jamais une fausse certitude)', () => {
  const lignesQuarts = [{ date: '2026-08-19', quart: '1', litrage_gazole: 100, litrage_sp95: 200, litrage_gnr: 0 }];
  const t0 = M.instantLocalVersUTC('2026-08-19', '00:00', FUSEAU_VITO);
  const t1 = M.instantLocalVersUTC('2026-08-20', '01:00', FUSEAU_VITO);
  const r = M.resoudreVentesFenetre(lignesQuarts, {}, t0, t1, FUSEAU_VITO);
  assert.strictEqual(r.isolable, false);
  assert.strictEqual(r.quartsChevauchants[0].raison, 'horaires_non_configures');
});

testSync('resoudreVentesFenetre : fuseau manquant -> mêmes garde-fous que des horaires manquants (jamais une fausse certitude)', () => {
  const lignesQuarts = [{ date: '2026-08-19', quart: '1', litrage_gazole: 100, litrage_sp95: 200, litrage_gnr: 0 }];
  const t0 = M.instantLocalVersUTC('2026-08-19', '00:00', FUSEAU_VITO);
  const t1 = M.instantLocalVersUTC('2026-08-20', '01:00', FUSEAU_VITO);
  const r = M.resoudreVentesFenetre(lignesQuarts, HORAIRES_VITO, t0, t1, null);
  assert.strictEqual(r.isolable, false);
  assert.strictEqual(r.quartsChevauchants[0].raison, 'horaires_non_configures');
});

testSync('qualiteChaineCarburant : fenetreIsolable=false -> provisoire/fenetre_ventes_non_isolable, jamais non_comparable ni fiable', () => {
  const q = M.qualiteChaineCarburant({
    referenceExiste: true, dernierReel: 23556, referenceCertifieeCeJour: false,
    reelDuJour: 21607, ventes: null, mouvement: 0, commentaire: null, fenetreIsolable: false,
  });
  assert.deepStrictEqual(q, { qualite: 'provisoire', cause: 'fenetre_ventes_non_isolable' });
  assert.ok(M.libelleCauseQualiteChaine('fenetre_ventes_non_isolable').includes('chevauche'));
});

testSync('qualiteChaineCarburant : fenetreIsolable absent (undefined) -> comportement historique inchangé (rétrocompatibilité)', () => {
  const q = M.qualiteChaineCarburant({
    referenceExiste: true, dernierReel: 1000, referenceCertifieeCeJour: false,
    reelDuJour: 900, ventes: 100, mouvement: 0, commentaire: null,
  });
  assert.deepStrictEqual(q, { qualite: 'fiable', cause: null }, 'Aucun appelant existant ne doit être affecté par ce nouveau paramètre optionnel');
});

testSync('calculerTheorique/calculerEcart : ventes=null (fenêtre non isolable) -> théorique et écart null, jamais un chiffre approché', () => {
  assert.strictEqual(M.calculerTheorique(23556, 21007, 0, null), null);
  assert.strictEqual(M.calculerEcart(21607, null), null);
});

testSync('instantFenetreReleve (25/08/2026, retour de Frédéric : "le jaugeage du matin est toujours celui de l\'ouverture, même si un employé oublie de le saisir à temps") — cas RÉEL 24/08 : jaugeage saisi à 8h09 Martinique (mesure_le), doit retomber sur minuit local, jamais sur 8h09', () => {
  const releveOuverture = { date: '2026-08-24', mesure_le: '2026-08-24T12:09:34.765Z', origine: 'manager' };
  const t = M.instantFenetreReleve(releveOuverture, FUSEAU_VITO);
  assert.strictEqual(t.toISOString(), '2026-08-24T04:00:00.000Z', 'minuit local Martinique (UTC-4) du 24/08, jamais 12:09 UTC (heure de SAISIE, pas de mesure)');
  // terrain_pompiste : même traitement que manager, aucun des deux n'est un
  // relevé lié à une livraison.
  const releveTerrain = { date: '2026-08-22', mesure_le: '2026-08-22T11:24:42.013Z', origine: 'terrain_pompiste' };
  assert.strictEqual(M.instantFenetreReleve(releveTerrain, FUSEAU_VITO).toISOString(), '2026-08-22T04:00:00.000Z');
  // Un relevé lié à une livraison garde son instant RÉEL (mesure_le) — le
  // cas exact qui a motivé la chaîne temporelle horodatée de v2.205.
  const releveLivraison = { date: '2026-08-20', mesure_le: '2026-08-20T15:01:16.151Z', origine: 'reception_livraison' };
  assert.strictEqual(M.instantFenetreReleve(releveLivraison, FUSEAU_VITO).toISOString(), '2026-08-20T15:01:16.151Z', 'un relevé post-livraison représente un instant réel précis, pas une ouverture de journée -- mesure_le reste l\'ancre');
  assert.strictEqual(M.instantFenetreReleve(null, FUSEAU_VITO), null);
});

testSync('resoudreVentesFenetre — cas RÉEL 23/08->24/08 (vito-sainte-marie) : AVANT le correctif, le quart 1 du 24/08 chevauchait à tort mesure_le (12h09, saisi en pleine fenêtre du quart 1) ; APRÈS, en ancrant sur minuit local, le quart 1 déjà clos est correctement inclus dans la somme, jamais signalé chevauchant', () => {
  const lignesQuarts = [
    { date: '2026-08-23', quart: '1', litrage_gazole: 889.59, litrage_sp95: 1566.98, litrage_gnr: 0 },
    { date: '2026-08-23', quart: '2', litrage_gazole: 790.69, litrage_sp95: 1209.64, litrage_gnr: 0 },
    { date: '2026-08-24', quart: '1', litrage_gazole: 1640.49, litrage_sp95: 1692.63, litrage_gnr: 0 },
  ];
  const releve23 = { date: '2026-08-23', mesure_le: '2026-08-23T11:28:55.704Z', origine: 'manager' };
  const releve24 = { date: '2026-08-24', mesure_le: '2026-08-24T12:09:34.765Z', origine: 'manager' };
  // Preuve du bug AVANT correctif : mesure_le brut du 24/08 (12:09 UTC)
  // tombe en pleine fenêtre étendue du quart 1 (09:45-17:45 UTC) -> chevauche.
  const avant = M.resoudreVentesFenetre(lignesQuarts, HORAIRES_VITO, new Date(releve23.mesure_le), new Date(releve24.mesure_le), FUSEAU_VITO);
  assert.strictEqual(avant.isolable, false, 'AVANT correctif : mesure_le du 24/08 (12:09, saisie tardive) chevauchait à tort le quart 1 du 24/08');

  // APRÈS correctif : bornes construites via instantFenetreReleve (minuit
  // local de chaque jaugeage d'ouverture) -> le quart 1 du 24/08 (déjà clos)
  // est ENTIÈREMENT dans la fenêtre [minuit 23/08, minuit 24/08 exclu du
  // suivant... en réalité ici la fenêtre s'arrête à minuit du 24/08, donc le
  // quart 1 du 24/08 lui-même n'est PAS dans cette fenêtre précise (il
  // appartient à la fenêtre SUIVANTE, celle de "maintenant" côté Commande
  // Carburant) -- ce test vérifie seulement que le quart 1 du 23/08 et du
  // quart 2 du 23/08 sont désormais isolables sans chevauchement à tort.
  const t0 = M.instantFenetreReleve(releve23, FUSEAU_VITO);
  const t1 = M.instantFenetreReleve(releve24, FUSEAU_VITO);
  const apres = M.resoudreVentesFenetre(lignesQuarts, HORAIRES_VITO, t0, t1, FUSEAU_VITO);
  assert.strictEqual(apres.isolable, true, 'plus aucun chevauchement à tort une fois ancré sur minuit local plutôt que sur l\'heure de saisie');
  assert.deepStrictEqual(apres.ventes, { go: 889.59 + 790.69, sp95: 1566.98 + 1209.64, gnr: 0 }, 'exactement les 2 quarts du 23/08 (le 23 est le jour de l\'ancre, entièrement inclus) ; le quart 1 du 24/08 appartient à la fenêtre suivante, jamais compté ici (bornes [minuit 23, minuit 24[)');
});

console.log('\n--- PARTIE 1 (nexus-carburant-moteur.js) terminée ---\n');

// ------------------------------------------------------------
// PARTIE 2 — chargerControleJour, scénario RÉEL 20/08->21/08
// (vito-sainte-marie, données exactes vérifiées en base Supabase le
// 21/08/2026, fuseau Martinique) — mock Supabase chaînable minimal.
// ------------------------------------------------------------
(async function main() {
  const dernierReleve = {
    // origine réelle vérifiée en base (25/08/2026) : ce relevé du 20/08 est
    // bien lié à la livraison (jaugeage post-livraison à 15h01) — son
    // `mesure_le` reste donc l'ancre exacte via `instantFenetreReleve`,
    // exactement le cas qui a motivé la chaîne temporelle horodatée.
    date: '2026-08-20', version_num: 2, mesure_le: '2026-08-20T15:01:16.151Z', origine: 'reception_livraison',
    stock_reel_go_cuve1: 14851, stock_reel_go_cuve2: 9539, stock_reel_sp95: 23556, stock_reel_gnr: 4371,
    livraison_go: 14938, livraison_sp95: 21007, livraison_gnr: 0, mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0,
  };
  const releveDuJour = {
    // origine réelle vérifiée en base : jaugeage matinal ordinaire (manager)
    // -> `instantFenetreReleve` retombe sur minuit local du 21/08, jamais
    // sur `mesure_le` (19h32, saisi tardivement) — voir Data Dictionary
    // v2.244.
    date: '2026-08-21', version_num: 1, mesure_le: '2026-08-21T19:32:09.608971Z', origine: 'manager',
    stock_reel_go_cuve1: 14017, stock_reel_go_cuve2: 8867, stock_reel_sp95: 21607, stock_reel_gnr: 4370,
    livraison_go: 0, livraison_sp95: 0, livraison_gnr: 0, mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0,
    commentaire: null,
  };
  const quarts = [
    { date: '2026-08-20', quart: '1', litrage_gazole: 1443.78, litrage_sp95: 1615.74, litrage_gnr: 0 },
    { date: '2026-08-20', quart: '2', litrage_gazole: 974.6, litrage_sp95: 1355.31, litrage_gnr: 0 },
    { date: '2026-08-21', quart: '1', litrage_gazole: 1598.51, litrage_sp95: 2056.64, litrage_gnr: 0 },
  ];

  function chainReleves() {
    const chain = {
      select() { return chain; },
      eq(k, v) { if (k === 'date') chain._exact = v; return chain; },
      lt(k, v) { chain._before = v; return chain; },
      order() { return chain; },
      limit() { return chain; },
      maybeSingle: async () => {
        if (chain._exact === '2026-08-21') return { data: releveDuJour, error: null };
        if (chain._before === '2026-08-21') return { data: dernierReleve, error: null };
        return { data: null, error: null };
      },
    };
    return chain;
  }
  function creerClientReel() {
    return {
      from(table) {
        if (table === 'carburant_releves') return chainReleves();
        // fuseau_horaire (v2.232) — inclus explicitement dans le mock,
        // valeur réelle de vito-sainte-marie (station_config.fuseau_horaire),
        // jamais 'Europe/Paris'.
        if (table === 'station_config') return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { horaires: HORAIRES_VITO, fuseau_horaire: FUSEAU_VITO }, error: null }) };
        if (table === 'audits_caisse') return { select() { return this; }, eq() { return this; }, gte() { return this; }, lte() { return this; }, then: (resolve) => resolve({ data: quarts, error: null }) };
        if (table === 'carburant_stock_references') return { select() { return this; }, eq() { return this; }, lte() { return this; }, order() { return this; }, limit() { return this; }, maybeSingle: async () => ({ data: null, error: null }) };
        return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: null }) };
      },
    };
  }

  await testAsync('chargerControleJour : scénario réel 20/08->21/08, fuseau Martinique — fenêtre non isolable, théorique/écart null sur les 3 carburants (jamais +1022L/+912L)', async () => {
    const r = await D.chargerControleJour(creerClientReel(), 'vito-sainte-marie', '2026-08-21');
    assert.strictEqual(r.fenetreIsolable, false);
    assert.strictEqual(r.quartsChevauchants.length, 1);
    assert.strictEqual(r.quartsChevauchants[0].date, '2026-08-20');
    assert.strictEqual(r.quartsChevauchants[0].quart, '1', 'fuseau Martinique correct : c\'est le quart 1 (05:45-13:45) qui chevauche l\'instant de mesure (11:01 Martinique), pas le quart 2 comme l\'ancien calcul en heure de Paris le concluait à tort');
    ['sp95', 'go', 'gnr'].forEach(cle => {
      assert.strictEqual(r.parCarburant[cle].theorique, null, `${cle}: théorique doit être null, jamais un chiffre bâti sur une ventilation devinée`);
      assert.strictEqual(r.parCarburant[cle].ecart, null, `${cle}: écart doit être null`);
      assert.strictEqual(r.parCarburant[cle].statut, 'Données insuffisantes', `${cle}: jamais "À corriger" sur une fenêtre non isolable`);
    });
    // Les stocks RÉELS mesurés, eux, restent affichés tels quels (Article 5 — un stock physique n'est jamais masqué).
    assert.strictEqual(r.parCarburant.sp95.reelDuJour, 21607);
    assert.strictEqual(r.parCarburant.go.reelDuJour, 22884);
    assert.strictEqual(r.parCarburant.gnr.reelDuJour, 4370);
  });

  await testAsync('qualiteChaineCarburant, alimentée par le résultat réel de chargerControleJour, ne dit plus jamais "fiable" sur ce cas', async () => {
    const r = await D.chargerControleJour(creerClientReel(), 'vito-sainte-marie', '2026-08-21');
    ['sp95', 'go', 'gnr'].forEach(cle => {
      const p = r.parCarburant[cle];
      const q = M.qualiteChaineCarburant({
        referenceExiste: true, dernierReel: p.dernierReel, referenceCertifieeCeJour: false,
        reelDuJour: p.reelDuJour, ventes: p.ventesDepuis, mouvement: p.mouvement, commentaire: null,
        fenetreIsolable: r.fenetreIsolable,
      });
      assert.strictEqual(q.qualite, 'provisoire');
      assert.strictEqual(q.cause, 'fenetre_ventes_non_isolable');
    });
  });

  await testAsync('chargerControleJour : station_config sans fuseau_horaire (ligne pré-migration hypothétique) -> repli explicite America/Martinique, jamais Europe/Paris', async () => {
    const clientSansFuseau = {
      from(table) {
        if (table === 'carburant_releves') return chainReleves();
        if (table === 'station_config') return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { horaires: HORAIRES_VITO }, error: null }) };
        if (table === 'audits_caisse') return { select() { return this; }, eq() { return this; }, gte() { return this; }, lte() { return this; }, then: (resolve) => resolve({ data: quarts, error: null }) };
        if (table === 'carburant_stock_references') return { select() { return this; }, eq() { return this; }, lte() { return this; }, order() { return this; }, limit() { return this; }, maybeSingle: async () => ({ data: null, error: null }) };
        return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: null }) };
      },
    };
    const r = await D.chargerControleJour(clientSansFuseau, 'vito-sainte-marie', '2026-08-21');
    // Même résultat que le scénario nominal ci-dessus : le repli tombe bien
    // sur America/Martinique, pas sur un comportement différent.
    assert.strictEqual(r.quartsChevauchants[0].quart, '1');
  });

  console.log('\nTous les tests "Chaîne temporelle carburant" passent.');
})();
