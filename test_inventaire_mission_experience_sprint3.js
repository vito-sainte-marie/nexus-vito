// Test — Inventaire V2 Sprint 3 "Expérience employé" (29/08/2026, Frédéric
// a confirmé "sprint 3"). Doctrine : deux jauges strictement distinctes
// (mission / collective), jamais de stock théorique, de raison de
// sélection, ni de vocabulaire "anomalie" montré à l'employé.
//
// PARTIE 1 — nexus-inventaire-moteur.js::jaugePerimetre (require direct).
// PARTIE 2 — NEXUS-Inventaire-v1.html : comptesFaitsDuPlan +
//   renderBlocMesMissions, extraites par regex (même méthode que
//   test_pont_jaugeage_carburant_inventaire.js — jamais réécrites à la
//   main).

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = __dirname;

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

// ------------------------------------------------------------
// PARTIE 1 — nexus-inventaire-moteur.js::jaugePerimetre
// ------------------------------------------------------------
global.window = global;
require(path.join(PROJET, 'nexus-inventaire-moteur.js'));
const M = global.NexusInventaireMoteur;
assert.strictEqual(typeof M.jaugePerimetre, 'function', 'jaugePerimetre doit être exportée');

testSync('jaugePerimetre — périmètre vide -> 100%, jamais "rien à faire" affiché comme 0%', () => {
  assert.deepStrictEqual(M.jaugePerimetre([], new Set()), { total: 0, faits: 0, pct: 100 });
});
testSync('jaugePerimetre — total/faits/pct corrects sur un périmètre partiel', () => {
  assert.deepStrictEqual(M.jaugePerimetre(['a', 'b', 'c', 'd'], new Set(['a', 'b'])), { total: 4, faits: 2, pct: 50 });
});
testSync('jaugePerimetre — accepte un array en plus d\'un Set pour les comptes déjà faits', () => {
  assert.deepStrictEqual(M.jaugePerimetre(['a', 'b'], ['a']), { total: 2, faits: 1, pct: 50 });
});
testSync('jaugePerimetre — même fonction générique pour jauge de mission ET jauge collective (Article 11, pas deux implémentations)', () => {
  const jaugeMission = M.jaugePerimetre(['gaz1', 'gaz2'], new Set(['gaz1']));
  const jaugeCollective = M.jaugePerimetre(['gaz1', 'gaz2', 'tabac1', 'tabac2'], new Set(['gaz1']));
  assert.strictEqual(jaugeMission.pct, 50);
  assert.strictEqual(jaugeCollective.pct, 25);
});

// ------------------------------------------------------------
// PARTIE 2 — NEXUS-Inventaire-v1.html : comptesFaitsDuPlan +
// renderBlocMesMissions, extraction par regex.
// ------------------------------------------------------------
{
  const html = fs.readFileSync(path.join(PROJET, 'NEXUS-Inventaire-v1.html'), 'utf8');
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const script = scriptMatches.reduce((a, b) => (b.length > a.length ? b : a), '');
  assert.ok(script.includes('renderBlocMesMissions'), 'Bloc script applicatif introuvable');

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
    'let planQuartActif = null;',
    'let missionsDuJour = [];',
    'const NexusInventaireMoteur = globalThis.__moteur;',
    extraireFonction('comptesFaitsDuPlan'),
    extraireFonction('renderBlocMesMissions'),
    `globalThis.__test = {
      setEnv: (env) => { planQuartActif = env.planQuartActif; missionsDuJour = env.missionsDuJour; },
      comptesFaitsDuPlan, renderBlocMesMissions,
    };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console, __moteur: M };
  ctx.globalThis = ctx;
  vm.runInNewContext(srcParts, ctx);
  const T = ctx.__test;

  testSync('comptesFaitsDuPlan — ne retient que les items du plan au statut "fait"', () => {
    T.setEnv({
      planQuartActif: { items: [
        { produit_id: 'p1', statut: 'fait' },
        { produit_id: 'p2', statut: 'a_faire' },
        { produit_id: 'p3', statut: 'fait' },
      ] },
      missionsDuJour: [],
    });
    const comptes = T.comptesFaitsDuPlan();
    assert.deepStrictEqual(Array.from(comptes).sort(), ['p1', 'p3']);
  });

  testSync('comptesFaitsDuPlan — plan absent -> ensemble vide, jamais une exception', () => {
    T.setEnv({ planQuartActif: null, missionsDuJour: [] });
    assert.deepStrictEqual(Array.from(T.comptesFaitsDuPlan()), []);
  });

  testSync('renderBlocMesMissions — aucune mission -> chaîne vide (panneau invisible, jamais un bloc "0 mission" qui inquiéterait sans raison)', () => {
    T.setEnv({ planQuartActif: null, missionsDuJour: [] });
    assert.strictEqual(T.renderBlocMesMissions(), '');
  });

  testSync('renderBlocMesMissions — une mission affiche son nom, son moment, et sa jauge X sur Y', () => {
    T.setEnv({
      planQuartActif: { items: [
        { produit_id: 'gaz1', statut: 'fait' },
        { produit_id: 'gaz2', statut: 'a_faire' },
      ] },
      missionsDuJour: [
        { nom: 'Piste · Début de quart', moment_code: 'debut', produit_ids: ['gaz1', 'gaz2'] },
      ],
    });
    const rendu = T.renderBlocMesMissions();
    assert.ok(rendu.includes('Piste · Début de quart'), 'le nom de la mission doit être affiché');
    assert.ok(rendu.includes('Début de quart'), 'le libellé du moment doit être affiché (libelleMoment)');
    assert.ok(rendu.includes('1 sur 2'), 'la jauge doit refléter le comptage réel (1 produit fait sur 2)');
    assert.ok(rendu.includes('width:50%'), 'la barre de progression doit être remplie à 50%');

    ok_doctrine_compliance(rendu);
  });

  testSync('renderBlocMesMissions — plusieurs missions, chacune avec sa propre jauge indépendante', () => {
    T.setEnv({
      planQuartActif: { items: [
        { produit_id: 'gaz1', statut: 'fait' },
        { produit_id: 'tabac1', statut: 'fait' },
        { produit_id: 'tabac2', statut: 'a_faire' },
      ] },
      missionsDuJour: [
        { nom: 'Piste · Début de quart', moment_code: 'debut', produit_ids: ['gaz1'] },
        { nom: 'Caisse · Début de quart', moment_code: 'debut', produit_ids: ['tabac1', 'tabac2'] },
      ],
    });
    const rendu = T.renderBlocMesMissions();
    assert.ok(rendu.includes('1 sur 1'), 'la mission Piste (1 produit, déjà fait) doit afficher 1 sur 1');
    assert.ok(rendu.includes('1 sur 2'), 'la mission Caisse (2 produits, 1 fait) doit afficher 1 sur 2 — jauge indépendante de celle de Piste');

    ok_doctrine_compliance(rendu);
  });

  // Vérifie qu'aucun vocabulaire proscrit par la doctrine de Frédéric
  // ("NEXUS Inventaire V2", §"l'employé ne voit jamais...") n'apparaît dans
  // le panneau "Mes missions" — stock théorique, raison de sélection,
  // vocabulaire "anomalie". Contrôle de non-régression textuel simple,
  // jamais un audit exhaustif de l'écran entier (hors scope de ce sprint).
  function ok_doctrine_compliance(renduHtml) {
    const brut = renduHtml.toLowerCase();
    ['anomalie', 'théorique', 'theorique', 'raison_selection', 'raison de sélection'].forEach(mot => {
      assert.ok(!brut.includes(mot), `le panneau "Mes missions" ne doit jamais afficher le mot "${mot}" (doctrine : jamais de stock théorique/raison de sélection/vocabulaire anomalie visible par l'employé)`);
    });
  }
  testSync('renderBlocMesMissions — jamais de vocabulaire proscrit (stock théorique / raison de sélection / anomalie)', () => {
    T.setEnv({
      planQuartActif: { items: [{ produit_id: 'gaz1', statut: 'fait' }] },
      missionsDuJour: [{ nom: 'Piste · Début de quart', moment_code: 'debut', produit_ids: ['gaz1'] }],
    });
    ok_doctrine_compliance(T.renderBlocMesMissions());
  });
}

if (process.exitCode) { console.log('\nDes tests ont échoué.'); }
else { console.log('\nTous les tests sont passés.'); }
