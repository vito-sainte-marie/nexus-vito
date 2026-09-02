// Test — Inventaire V2 Sprint 5 "Rapprochement Decenium ↔ Missions"
// (29/08/2026, Frédéric a confirmé "continue" après le Scénario de
// référence Sainte-Marie). Ce sprint ne recalcule RIEN (Article 11) : il
// relie les lignes déjà persistées dans inventaire_rapprochements (calculées
// par quart_id + produit_id à l'import Decenium, vérifié directement sur le
// schéma réel) au périmètre produit de chaque Mission, puis réutilise
// NexusInventaireMoteur.syntheseQualiteRapprochements — déjà existante
// avant ce sprint, jamais réécrite.
//
// PARTIE 1 — nexus-inventaire-moteur.js::rapprochementsPourPerimetre
//   (require direct, fonction pure), combinée à syntheseQualiteRapprochements.
// PARTIE 2 — nexus-inventaire-missions-donnees.js::
//   chargerRapprochementsPourMissions.
// PARTIE 3 — NEXUS-Inventaire-Manager-v1.html::renderRapprochementParMission,
//   extraite par regex (même méthode que les tests Sprint 3/4).

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = __dirname;

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}
async function testAsync(nom, fn) {
  try { await fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

// ------------------------------------------------------------
// PARTIE 1 — nexus-inventaire-moteur.js
// ------------------------------------------------------------
global.window = global;
require(path.join(PROJET, 'nexus-inventaire-moteur.js'));
const M = global.NexusInventaireMoteur;
assert.strictEqual(typeof M.rapprochementsPourPerimetre, 'function', 'rapprochementsPourPerimetre doit être exportée');
assert.strictEqual(typeof M.syntheseQualiteRapprochements, 'function', 'syntheseQualiteRapprochements doit déjà exister (Article 11, jamais réécrite)');

testSync('rapprochementsPourPerimetre — ne garde que les lignes dont le produit appartient au périmètre de la mission', () => {
  const rapprochements = [
    { produit_id: 'gaz1', statut_validation: 'fiable' },
    { produit_id: 'gaz2', statut_validation: 'provisoire' },
    { produit_id: 'tabac1', statut_validation: 'fiable' },
  ];
  const resultat = M.rapprochementsPourPerimetre(['gaz1', 'gaz2'], rapprochements);
  assert.deepStrictEqual(resultat.map(r => r.produit_id).sort(), ['gaz1', 'gaz2']);
});

testSync('rapprochementsPourPerimetre — périmètre vide ou rapprochements absents -> tableau vide, jamais une exception', () => {
  assert.deepStrictEqual(M.rapprochementsPourPerimetre([], [{ produit_id: 'gaz1' }]), []);
  assert.deepStrictEqual(M.rapprochementsPourPerimetre(['gaz1'], null), []);
  assert.deepStrictEqual(M.rapprochementsPourPerimetre(null, null), []);
});

testSync('rapprochementsPourPerimetre + syntheseQualiteRapprochements — combinaison correcte pour UNE mission, jamais un second calcul de qualité', () => {
  const rapprochements = [
    { produit_id: 'c1', statut_validation: 'fiable' },
    { produit_id: 'c2', statut_validation: 'fiable' },
    { produit_id: 'c3', statut_validation: 'provisoire' },
    { produit_id: 'autre', statut_validation: 'non_comparable' }, // hors périmètre de cette mission
  ];
  const lignesMission = M.rapprochementsPourPerimetre(['c1', 'c2', 'c3'], rapprochements);
  const synthese = M.syntheseQualiteRapprochements(lignesMission);
  assert.deepStrictEqual(synthese, { total: 3, fiable: 2, provisoire: 1, nonComparable: 0, toutFiable: false });
});

testSync('rapprochementsPourPerimetre — deux missions distinctes sur le même quart obtiennent des synthèses indépendantes', () => {
  const rapprochements = [
    { produit_id: 'piste1', statut_validation: 'fiable' },
    { produit_id: 'piste2', statut_validation: 'fiable' },
    { produit_id: 'caisse1', statut_validation: 'non_comparable' },
  ];
  const syntPiste = M.syntheseQualiteRapprochements(M.rapprochementsPourPerimetre(['piste1', 'piste2'], rapprochements));
  const syntCaisse = M.syntheseQualiteRapprochements(M.rapprochementsPourPerimetre(['caisse1'], rapprochements));
  assert.strictEqual(syntPiste.toutFiable, true);
  assert.strictEqual(syntCaisse.nonComparable, 1);
});

// ------------------------------------------------------------
// PARTIE 2 — nexus-inventaire-missions-donnees.js::chargerRapprochementsPourMissions
// ------------------------------------------------------------
require(path.join(PROJET, 'nexus-inventaire-missions-donnees.js'));
const D = global.NexusInventaireMissionsDonnees;
assert.strictEqual(typeof D.chargerRapprochementsPourMissions, 'function', 'chargerRapprochementsPourMissions doit être exportée');

function mockClientRapprochements({ quartExiste, rapprochements }) {
  return {
    from(table) {
      if (table === 'inventaire_quarts') {
        return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: quartExiste ? { id: 'q1' } : null, error: null }) }) }) }) }) };
      }
      if (table === 'inventaire_rapprochements') {
        return { select: () => ({ eq: () => Promise.resolve({ data: rapprochements, error: null }) }) };
      }
      throw new Error('table inattendue: ' + table);
    },
  };
}

(async () => {
  await testAsync('chargerRapprochementsPourMissions — quart pas encore ouvert -> missions inchangées, jamais une erreur', async () => {
    const client = mockClientRapprochements({ quartExiste: false, rapprochements: [] });
    const missions = [{ nom: 'Piste', produit_ids: ['p1'] }];
    const resultat = await D.chargerRapprochementsPourMissions(client, 'vito-sainte-marie', '2026-08-29', 'matin', missions);
    assert.deepStrictEqual(resultat, missions);
    assert.ok(!resultat[0].rapprochement, 'aucun champ rapprochement ajouté sans donnée réelle');
  });

  await testAsync('chargerRapprochementsPourMissions — aucun rapprochement importé pour ce quart -> missions inchangées (jamais un faux 0/0)', async () => {
    const client = mockClientRapprochements({ quartExiste: true, rapprochements: [] });
    const missions = [{ nom: 'Piste', produit_ids: ['p1'] }];
    const resultat = await D.chargerRapprochementsPourMissions(client, 'vito-sainte-marie', '2026-08-29', 'matin', missions);
    assert.ok(!resultat[0].rapprochement);
  });

  await testAsync('chargerRapprochementsPourMissions — enrichit chaque mission avec SA synthèse propre, sans muter les autres', async () => {
    const rapprochements = [
      { produit_id: 'gaz1', statut_validation: 'fiable' },
      { produit_id: 'gaz2', statut_validation: 'fiable' },
      { produit_id: 'cig1', statut_validation: 'non_comparable' },
    ];
    const client = mockClientRapprochements({ quartExiste: true, rapprochements });
    const missions = [
      { nom: 'Piste — ouverture', produit_ids: ['gaz1', 'gaz2'] },
      { nom: 'Caisse — Cigarettes', produit_ids: ['cig1'] },
      { nom: 'Renfort', produit_ids: ['sans_donnee'] },
    ];
    const resultat = await D.chargerRapprochementsPourMissions(client, 'vito-sainte-marie', '2026-08-29', 'matin', missions);
    assert.deepStrictEqual(resultat[0].rapprochement, { total: 2, fiable: 2, provisoire: 0, nonComparable: 0, toutFiable: true });
    assert.deepStrictEqual(resultat[1].rapprochement, { total: 1, fiable: 0, provisoire: 0, nonComparable: 1, toutFiable: false });
    assert.ok(!resultat[2].rapprochement, 'Renfort sans aucune ligne importée sur son périmètre -> pas de champ ajouté');
  });

  // ------------------------------------------------------------
  // PARTIE 3 — NEXUS-Inventaire-Manager-v1.html::renderRapprochementParMission
  // ------------------------------------------------------------
  {
    const html = fs.readFileSync(path.join(PROJET, 'NEXUS-Inventaire-Manager-v1.html'), 'utf8');
    const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    const script = scriptMatches.reduce((a, b) => (b.length > a.length ? b : a), '');
    assert.ok(script.includes('renderRapprochementParMission'), 'Bloc script applicatif introuvable');

    function extraireFonction(nomFonction) {
      let debut = script.indexOf(`function ${nomFonction}(`);
      assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
      const prefixe = 'async ';
      if (script.slice(debut - prefixe.length, debut) === prefixe) debut -= prefixe.length;
      let i = script.indexOf('{', debut);
      let profondeur = 1, j = i + 1;
      while (profondeur > 0) {
        if (script[j] === '{') profondeur++;
        else if (script[j] === '}') profondeur--;
        j++;
      }
      return script.slice(debut, j);
    }

    const srcParts = [
      'const NexusInventaireMoteur = globalThis.__moteur;',
      extraireFonction('renderRapprochementParMission'),
      'globalThis.__test = { renderRapprochementParMission };',
    ].join('\n\n');
    const ctx = { globalThis: {}, console, __moteur: M };
    ctx.globalThis = ctx;
    vm.runInNewContext(srcParts, ctx);
    const T = ctx.__test;

    testSync('renderRapprochementParMission — aucune mission avec rapprochement -> chaîne vide (panneau invisible)', () => {
      assert.strictEqual(T.renderRapprochementParMission([]), '');
      assert.strictEqual(T.renderRapprochementParMission([{ nom: 'Piste', produit_ids: ['p1'] }]), '');
    });

    testSync('renderRapprochementParMission — affiche nom, moment, rôle et la synthèse réelle de chaque mission concernée', () => {
      const missions = [
        {
          nom: 'Piste — ouverture', moment_code: 'debut', role_affecte: 'Piste',
          rapprochement: { total: 6, fiable: 6, provisoire: 0, nonComparable: 0, toutFiable: true },
        },
        {
          nom: 'Caisse — Cigarettes', moment_code: 'debut', role_affecte: 'Caisse',
          rapprochement: { total: 20, fiable: 15, provisoire: 3, nonComparable: 2, toutFiable: false },
        },
        { nom: 'Renfort', moment_code: 'pendant', role_affecte: 'Renfort' }, // pas de rapprochement -> exclue
      ];
      const rendu = T.renderRapprochementParMission(missions);
      assert.ok(rendu.includes('Piste — ouverture'));
      assert.ok(rendu.includes('Caisse — Cigarettes'));
      assert.ok(!rendu.includes('Renfort'), 'une mission sans rapprochement ne doit jamais apparaître dans ce bloc');
      assert.ok(rendu.includes('6 / 6'), 'la synthèse réelle de Piste doit être affichée');
      assert.ok(rendu.includes('15 / 20'), 'la synthèse réelle de Caisse doit être affichée');
      assert.ok(rendu.includes('3 provisoire'));
      assert.ok(rendu.includes('2 non comparable'));
    });
  }

  if (process.exitCode) { console.log('\nDes tests ont échoué.'); }
  else { console.log('\nTous les tests sont passés.'); }
})();
