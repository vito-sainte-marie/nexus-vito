// Test — Écran de chargement de Brief NEXUS 100 % dynamique (22/08/2026,
// demande de Frédéric : "Brief doit interroger la station, pas réciter une
// liste de modules codée en dur"). Avant ce lot, `demarrerAnimationChargement()`
// affichait 4 jalons hardcodés ("Commerce analysé"/"Marge analysée"/
// "FDJ analysée"/"Contrôles consolidés") identiques quel que soit le site —
// un futur boulanger/pharmacien aurait vu "FDJ"/"Carburants" sans jamais
// faire de FDJ ni de carburant.
//
// Fonction extraite du script inline de NEXUS-Brief-v1.html (jamais
// réécrite à la main — même discipline que les autres tests Brief/FDJ/
// Import), exécutée dans un contexte vm avec un DOM minimal fabriqué à la
// main (juste assez pour observer ce qui est réellement ajouté à l'écran).
// `NexusSecteursCatalogue` est chargé pour de vrai (Article 11) : les
// libellés testés ici sont ceux réellement utilisés à l'écran, jamais une
// copie locale qui pourrait diverger.

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const CHEMIN_BASE = __dirname;
require(CHEMIN_BASE + '/nexus-secteurs-catalogue.js');
const CATALOGUE = global.NexusSecteursCatalogue.SECTEURS_CATALOGUE;

const html = fs.readFileSync(`${CHEMIN_BASE}/NEXUS-Brief-v1.html`, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  const debut = script.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j);
}

const src = extraire('demarrerAnimationChargement');

// Fabrique un DOM minimal : juste assez pour que la fonction s'exécute et
// pour qu'on puisse observer les éléments réellement ajoutés à la
// checklist — jamais un vrai navigateur (aucun accès headless dans cet
// environnement, voir les autres tests Brief/Import de cette session).
function creerFauxDom(elementsDisponibles) {
  const items = [];
  const msgEl = { classList: { add() {}, remove() {} }, innerHTML: '' };
  const checklistEl = { appendChild(div) { items.push(div); } };
  const document = {
    getElementById(id) {
      if (!elementsDisponibles) return null;
      if (id === 'briefLoadingMsg') return msgEl;
      if (id === 'briefLoadingChecklist') return checklistEl;
      return null;
    },
    createElement() { return { className: '', innerHTML: '' }; },
  };
  return { document, items };
}

function instancier(elementsDisponibles) {
  const { document, items } = creerFauxDom(elementsDisponibles);
  const ctx = { document, setTimeout, console };
  ctx.globalThis = ctx;
  const runnable = new vm.Script(`${src}\nglobalThis.__demarrerAnimationChargement = demarrerAnimationChargement;`);
  vm.createContext(ctx);
  runnable.runInContext(ctx);
  return { anim: ctx.__demarrerAnimationChargement, items };
}

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) Écran déjà remplacé (chargement très rapide) -> repli propre, jamais
//    une exception.
// ------------------------------------------------------------
{
  const { anim } = instancier(false);
  const resultat = anim([CATALOGUE.marge]);
  assert.strictEqual(resultat, null, 'Éléments DOM absents -> null, jamais une exception');
  ok('demarrerAnimationChargement(secteurs) renvoie null si l\'écran de chargement a déjà été remplacé');
}

// ------------------------------------------------------------
// 2) Site station-service (Marge + Carburants actifs) : tickSecteur('marge')
//    et tickSecteur('carburants') produisent chacun UNE coche, avec le
//    libellé réel du catalogue (Article 11 — jamais une copie locale).
// ------------------------------------------------------------
{
  const { anim, items } = instancier(true);
  const app = anim([CATALOGUE.marge, CATALOGUE.carburants]);
  assert.ok(app, 'demarrerAnimationChargement doit renvoyer {tickSecteur, demarrerSequenceFinale} quand l\'écran existe');
  app.tickSecteur('marge');
  app.tickSecteur('carburants');
  assert.strictEqual(items.length, 2, 'Une coche par secteur réellement actif et interrogé');
  assert.ok(items[0].innerHTML.includes('Marge analysée'), 'Libellé réel du catalogue utilisé pour Marge');
  assert.ok(items[1].innerHTML.includes('Carburants analysés'), 'Libellé réel du catalogue utilisé pour Carburants');
  ok('tickSecteur affiche le libellé réel du catalogue pour chaque secteur actif interrogé');
}

// ------------------------------------------------------------
// 3) LE test central de la demande de Frédéric : un secteur non actif pour
//    CE site (ex. Carburants sur un site qui n'en fait pas) ne produit
//    JAMAIS de coche, même si tickSecteur est appelé par erreur — un futur
//    boulanger ne doit jamais voir "Carburants" ou "FDJ".
// ------------------------------------------------------------
{
  const { anim, items } = instancier(true);
  // Site fictif type "boulangerie" : seuls Marge et Équipe seraient actifs
  // (aucun secteur station-service comme Carburants/FDJ).
  const app = anim([CATALOGUE.marge, CATALOGUE.equipe]);
  app.tickSecteur('marge');
  app.tickSecteur('carburants'); // jamais actif sur ce site -> ne doit rien afficher
  app.tickSecteur('fdj');        // idem
  assert.strictEqual(items.length, 1, 'Seul le secteur réellement actif (Marge) produit une coche');
  assert.ok(!items.some(it => it.innerHTML.includes('Carburants')), 'Carburants n\'apparaît jamais pour un site qui ne l\'a pas activé');
  assert.ok(!items.some(it => it.innerHTML.includes('FDJ')), 'FDJ n\'apparaît jamais pour un site qui ne l\'a pas activé');
  ok('tickSecteur ne produit jamais de coche pour un secteur non actif sur ce site (aucune liste de modules codée en dur)');
}

// ------------------------------------------------------------
// 4) Idempotence — un secteur alimenté par plusieurs chargeurs (Opérations,
//    FDJ) ne doit jamais produire deux coches.
// ------------------------------------------------------------
{
  const { anim, items } = instancier(true);
  const app = anim([CATALOGUE.operations]);
  app.tickSecteur('operations');
  app.tickSecteur('operations');
  app.tickSecteur('operations');
  assert.strictEqual(items.length, 1, 'Un secteur coché une fois ne se recoche jamais, même appelé plusieurs fois');
  ok('tickSecteur est idempotent (jamais deux coches pour le même secteur)');
}

// ------------------------------------------------------------
// 5) Le vrai test "ajouter un moteur demain ne nécessite pas de réécrire
//    Brief" : un secteur totalement inconnu de NEXUS-Brief-v1.html
//    aujourd'hui (ex. futur "Production boulangerie"), sans `libelleChecklist`
//    dédié, obtient un repli générique — jamais un écran cassé, jamais une
//    coche muette.
// ------------------------------------------------------------
{
  const { anim, items } = instancier(true);
  const secteurFutur = { id: 'production_boulangerie', label: 'Production' };
  const app = anim([secteurFutur]);
  app.tickSecteur('production_boulangerie');
  assert.strictEqual(items.length, 1);
  assert.ok(items[0].innerHTML.includes('Production analysé'), 'Repli générique "{label} analysé" pour un secteur sans libelleChecklist dédié');
  ok('Un secteur futur, jamais codé en dur dans Brief, obtient un libellé générique plutôt que de casser l\'écran');
}

console.log(`\n${n}/${n} tests passés — écran de chargement dynamique Brief NEXUS.`);
