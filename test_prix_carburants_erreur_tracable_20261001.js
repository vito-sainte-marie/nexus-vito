// Test — anomalie terrain Production du 01/10/2026 : enregistrement des prix
// carburants (Conseiller/Directeur d'Exploitation) échouait avec le seul
// message « Erreur — réessayez. », sans que la cause technique (RLS, schéma,
// contrainte...) ne soit jamais visible ailleurs qu'en console — inaccessible
// depuis un simple signalement terrain (capture d'écran, pas de devtools).
//
// Deux écrans écrivent exactement la même colonne par le même motif d'upsert
// (`station_config.prix_carburants`, onConflict: 'site') : la carte Rappel du
// 1er du mois (NEXUS-App-v1.html) et le formulaire de Paramètres Station
// (NEXUS-Parametres-Station-v1.html). Les deux portaient le même masquage.
//
// Ce test exécute le vrai bloc `if (error) { ... }` de chacun des deux
// écrans (extrait du fichier réel, jamais réécrit à la main) contre un faux
// `error` Postgrest, et vérifie que l'alerte transmise au manager reste
// simple EN TÊTE («Erreur — réessayez.») mais porte désormais le détail
// technique réel (message/code/hint) — pour qu'un prochain signalement par
// simple capture d'écran suffise à diagnostiquer sans accès Production.

'use strict';
const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const FICHIERS = ['NEXUS-App-v1.html', 'NEXUS-Parametres-Station-v1.html'];

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// Extrait le bloc `if (error) { ... }` qui suit la ligne
// `console.error('Enregistrement prix_carburants:', error);`, jamais
// réécrit à la main : on retrouve l'accolade ouvrante du `if` puis on compte
// les accolades jusqu'à sa fermeture.
function extraireBlocErreur(src) {
  const ancre = "console.error('Enregistrement prix_carburants:', error);";
  const iAncre = src.indexOf(ancre);
  assert.ok(iAncre !== -1, 'Ancre console.error(prix_carburants) introuvable');
  const iIf = src.lastIndexOf('if (error)', iAncre);
  assert.ok(iIf !== -1, 'if (error) introuvable avant l’ancre');
  const iOuvre = src.indexOf('{', iIf);
  let profondeur = 1, j = iOuvre + 1;
  while (profondeur > 0) {
    if (src[j] === '{') profondeur++;
    else if (src[j] === '}') profondeur--;
    j++;
  }
  return src.slice(iIf, j); // "if (error) { ... }"
}

// Exécute le bloc extrait avec un faux `error`, capture l'alerte réellement
// produite (pas une supposition sur le texte source).
function executerBloc(bloc, error) {
  let alerteRecue = null;
  const sandbox = {
    error,
    alert: (msg) => { alerteRecue = msg; },
    console: { error: () => {} },
    btn: { disabled: false },
    document: { getElementById: () => ({ style: {} }) },
  };
  // Le bloc appelle parfois `return;` — on l'enveloppe dans une fonction pour
  // que ce `return` reste valide hors d'une boucle/d'un gestionnaire réel.
  vm.createContext(sandbox);
  vm.runInContext('(function(){ ' + bloc + ' })();', sandbox);
  return alerteRecue;
}

for (const fichier of FICHIERS) {
  const src = fs.readFileSync(__dirname + '/' + fichier, 'utf8');
  const bloc = extraireBlocErreur(src);

  verifier(`${fichier} — l’alerte reste simple en tête pour le manager`, () => {
    const alerte = executerBloc(bloc, { message: 'new row violates row-level security policy for table "station_config"', code: '42501' });
    assert.ok(alerte, 'Aucune alerte produite');
    assert.ok(alerte.startsWith('Erreur — réessayez.'), 'Le message manager doit rester en tête : ' + alerte);
  });

  verifier(`${fichier} — le détail technique réel (message) est désormais transmis`, () => {
    const alerte = executerBloc(bloc, { message: 'new row violates row-level security policy for table "station_config"', code: '42501' });
    assert.ok(alerte.includes('new row violates row-level security policy'),
      'Le message Postgrest réel doit apparaître dans l’alerte, pas seulement en console : ' + alerte);
  });

  verifier(`${fichier} — le hint, quand il existe, est transmis sans fabriquer "undefined"`, () => {
    const alerte = executerBloc(bloc, { message: 'colonne manquante', code: '42703', hint: 'Rechargez le schéma PostgREST.' });
    assert.ok(alerte.includes('Rechargez le schéma PostgREST.'), 'Le hint réel doit apparaître : ' + alerte);
    assert.ok(!/\bundefined\b/.test(alerte), 'Aucun "undefined" ne doit fuiter dans l’alerte : ' + alerte);
  });

  verifier(`${fichier} — absence de message et de hint : repli sur le code, jamais "undefined"`, () => {
    const alerte = executerBloc(bloc, { code: '23502' });
    assert.ok(alerte.includes('23502'), 'À défaut de message, le code doit apparaître : ' + alerte);
    assert.ok(!/\bundefined\b/.test(alerte), 'Aucun "undefined" ne doit fuiter dans l’alerte : ' + alerte);
  });

  // Contre-épreuve : le motif qui masquait la cause avant ce correctif
  // (alerte fixe, error jamais lu au-delà de console.error) ne doit plus
  // être présent tel quel dans le fichier — sinon ce test ne prouverait rien.
  verifier(`${fichier} — l’ancien masquage (alerte fixe sans lecture de error) n’est plus présent`, () => {
    const ancienMotif = /alert\('Erreur — réessayez\.'\);\s*return;\s*\}/;
    assert.ok(!ancienMotif.test(bloc), 'L’ancien bloc masquant (sans détail technique) est encore présent : ' + bloc);
  });
}

console.log(`\n${passes} vérification(s) passée(s).`);
