// Test — Chaîne temporelle carburant (21/08/2026, demande de Frédéric :
// "peux-tu vérifier ma différence de litrage dans pilotage" -> faux écarts
// +1022L SP95 / +912L GO du 21/08/2026, causés par une ancre (jaugeage
// post-livraison du 20/08 à 15:01) comparée aux ventes de TOUTE la journée
// du 20/08, alors qu'une partie de ces ventes (quart 2) avait déjà eu lieu
// AVANT la mesure. Règle imposée par Frédéric : "Théorique(t1) =
// Physique(t0) + livraisons(t0,t1) + mouvements(t0,t1) − ventes(t0,t1)",
// avec un absolu : si un quart de ventes chevauche l'une des deux bornes,
// la fenêtre est déclarée PROVISOIRE/NON COMPARABLE, jamais une ventilation
// devinée.
//
// PARTIE 1 — nexus-carburant-moteur.js : fonctions pures (instantParisVersUTC,
//   fenetreQuartLarge, classerQuartFaceFenetre, resoudreVentesFenetre,
//   qualiteChaineCarburant avec la nouvelle cause).
// PARTIE 2 — nexus-carburant-donnees.js : chargerControleJour rejoue le
//   scénario RÉEL du 20-21/08/2026 sur vito-sainte-marie (données exactes
//   vérifiées en base) et confirme fenetreIsolable=false / théorique non
//   calculé — jamais +1022L/+912L.

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
['instantParisVersUTC', 'fenetreQuartLarge', 'classerQuartFaceFenetre', 'resoudreVentesFenetre']
  .forEach(fn => assert.strictEqual(typeof M[fn], 'function', `${fn} doit être exportée`));

const HORAIRES_VITO = {
  quart1: { etendu: '05:45', normal: '05:45', fin_etendu: '13:45', fin_normal: '12:45' },
  quart2: { etendu: '13:40', normal: '12:40', fin_etendu: '22:05', fin_normal: '20:05' },
};

// ------------------------------------------------------------
// PARTIE 1 — moteur pur
// ------------------------------------------------------------
testSync('instantParisVersUTC : août (CEST, UTC+2) — 15:01 Paris -> 13:01 UTC', () => {
  const t = M.instantParisVersUTC('2026-08-20', '15:01');
  assert.strictEqual(t.toISOString(), '2026-08-20T13:01:00.000Z');
});

testSync('instantParisVersUTC : entrée invalide -> null, jamais une exception', () => {
  assert.strictEqual(M.instantParisVersUTC(null, '15:01'), null);
  assert.strictEqual(M.instantParisVersUTC('2026-08-20', null), null);
  assert.strictEqual(M.instantParisVersUTC('2026-08-20', 'xx:yy'), null);
});

testSync('fenetreQuartLarge : bornes ÉTENDUES (jamais normales), quart non configuré -> null', () => {
  const f1 = M.fenetreQuartLarge(HORAIRES_VITO, 'quart1', '2026-08-20');
  assert.strictEqual(f1.debut.toISOString(), '2026-08-20T03:45:00.000Z'); // 05:45 Paris
  assert.strictEqual(f1.fin.toISOString(), '2026-08-20T11:45:00.000Z');  // 13:45 Paris (étendu, pas 12:45 normal)
  assert.strictEqual(M.fenetreQuartLarge(HORAIRES_VITO, 'quart3', '2026-08-20'), null, 'Quart non configuré -> null, jamais un horaire inventé');
  assert.strictEqual(M.fenetreQuartLarge(null, 'quart1', '2026-08-20'), null);
});

testSync('classerQuartFaceFenetre : avant / après / dans / chevauche / inconnu', () => {
  const t0 = new Date('2026-08-20T13:01:00.000Z');
  const t1 = new Date('2026-08-21T17:32:00.000Z');
  const quart1_20 = M.fenetreQuartLarge(HORAIRES_VITO, 'quart1', '2026-08-20'); // 03:45->11:45 UTC, avant t0
  const quart2_20 = M.fenetreQuartLarge(HORAIRES_VITO, 'quart2', '2026-08-20'); // 11:40->20:05 UTC, chevauche t0 (13:01)
  const quart1_21 = M.fenetreQuartLarge(HORAIRES_VITO, 'quart1', '2026-08-21'); // dans [t0,t1]
  const quart2_21 = M.fenetreQuartLarge(HORAIRES_VITO, 'quart2', '2026-08-21'); // chevauche t1
  assert.strictEqual(M.classerQuartFaceFenetre(quart1_20, t0, t1), 'avant');
  assert.strictEqual(M.classerQuartFaceFenetre(quart2_20, t0, t1), 'chevauche');
  assert.strictEqual(M.classerQuartFaceFenetre(quart1_21, t0, t1), 'dans');
  assert.strictEqual(M.classerQuartFaceFenetre(quart2_21, t0, t1), 'chevauche');
  assert.strictEqual(M.classerQuartFaceFenetre(null, t0, t1), 'inconnu');
});

testSync('resoudreVentesFenetre : scénario RÉEL 20/08->21/08 (vito-sainte-marie) — quart 2 du 20/08 chevauche la livraison -> non isolable', () => {
  const lignesQuarts = [
    { date: '2026-08-20', quart: '1', litrage_gazole: 1443.78, litrage_sp95: 1615.74, litrage_gnr: 0 },
    { date: '2026-08-20', quart: '2', litrage_gazole: 974.6, litrage_sp95: 1355.31, litrage_gnr: 0 },
  ];
  const t0 = new Date('2026-08-20T15:01:16.151Z'); // mesure_le réelle du relevé post-livraison
  const t1 = new Date('2026-08-21T19:32:09.608Z'); // mesure_le réelle du relevé du 21/08
  const r = M.resoudreVentesFenetre(lignesQuarts, HORAIRES_VITO, t0, t1);
  assert.strictEqual(r.isolable, false, 'La visite de livraison (14:27-15:01 Paris) tombe EN PLEIN dans la fenêtre étendue du quart 2 (13:40-22:05) -> non isolable');
  assert.deepStrictEqual(r.ventes, { go: null, sp95: null, gnr: null }, 'Jamais une ventilation devinée -> ventes null sur les 3 carburants');
  assert.strictEqual(r.quartsChevauchants.length, 1);
  assert.strictEqual(r.quartsChevauchants[0].quart, '2');
});

testSync('resoudreVentesFenetre : fenêtre propre (aucun chevauchement) -> somme exacte des quarts entièrement "dans"', () => {
  const lignesQuarts = [
    { date: '2026-08-19', quart: '1', litrage_gazole: 100, litrage_sp95: 200, litrage_gnr: 0 },
    { date: '2026-08-19', quart: '2', litrage_gazole: 50, litrage_sp95: 60, litrage_gnr: 5 },
  ];
  const t0 = M.instantParisVersUTC('2026-08-19', '00:00');
  const t1 = M.instantParisVersUTC('2026-08-20', '01:00');
  const r = M.resoudreVentesFenetre(lignesQuarts, HORAIRES_VITO, t0, t1);
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
  const t0 = M.instantParisVersUTC('2026-08-19', '00:00');
  const t1 = M.instantParisVersUTC('2026-08-20', '01:00');
  const r = M.resoudreVentesFenetre(lignesQuarts, HORAIRES_VITO, t0, t1);
  assert.strictEqual(r.isolable, true);
  assert.deepStrictEqual(r.ventes, { go: 100, sp95: 200, gnr: 0 }, 'seul le quart "dans" (litrage_gnr=0, une vraie valeur captée) compte -> gnr=0, pas null');
});

testSync('resoudreVentesFenetre : quart avec horaires non configurés -> traité comme un chevauchement (jamais une fausse certitude)', () => {
  const lignesQuarts = [{ date: '2026-08-19', quart: '1', litrage_gazole: 100, litrage_sp95: 200, litrage_gnr: 0 }];
  const t0 = M.instantParisVersUTC('2026-08-19', '00:00');
  const t1 = M.instantParisVersUTC('2026-08-20', '01:00');
  const r = M.resoudreVentesFenetre(lignesQuarts, {}, t0, t1);
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

console.log('\n--- PARTIE 1 (nexus-carburant-moteur.js) terminée ---\n');

// ------------------------------------------------------------
// PARTIE 2 — chargerControleJour, scénario RÉEL 20/08->21/08
// (vito-sainte-marie, données exactes vérifiées en base Supabase le
// 21/08/2026) — mock Supabase chaînable minimal.
// ------------------------------------------------------------
(async function main() {
  const dernierReleve = {
    date: '2026-08-20', version_num: 2, mesure_le: '2026-08-20T15:01:16.151Z',
    stock_reel_go_cuve1: 14851, stock_reel_go_cuve2: 9539, stock_reel_sp95: 23556, stock_reel_gnr: 4371,
    livraison_go: 14938, livraison_sp95: 21007, livraison_gnr: 0, mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0,
  };
  const releveDuJour = {
    date: '2026-08-21', version_num: 1, mesure_le: '2026-08-21T19:32:09.608971Z',
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
        if (table === 'station_config') return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { horaires: HORAIRES_VITO }, error: null }) };
        if (table === 'audits_caisse') return { select() { return this; }, eq() { return this; }, gte() { return this; }, lte() { return this; }, then: (resolve) => resolve({ data: quarts, error: null }) };
        if (table === 'carburant_stock_references') return { select() { return this; }, eq() { return this; }, lte() { return this; }, order() { return this; }, limit() { return this; }, maybeSingle: async () => ({ data: null, error: null }) };
        return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: null }) };
      },
    };
  }

  await testAsync('chargerControleJour : scénario réel 20/08->21/08 — fenêtre non isolable, théorique/écart null sur les 3 carburants (jamais +1022L/+912L)', async () => {
    const r = await D.chargerControleJour(creerClientReel(), 'vito-sainte-marie', '2026-08-21');
    assert.strictEqual(r.fenetreIsolable, false);
    assert.strictEqual(r.quartsChevauchants.length, 1);
    assert.strictEqual(r.quartsChevauchants[0].date, '2026-08-20');
    assert.strictEqual(r.quartsChevauchants[0].quart, '2');
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

  console.log('\nTous les tests "Chaîne temporelle carburant" passent.');
})();
