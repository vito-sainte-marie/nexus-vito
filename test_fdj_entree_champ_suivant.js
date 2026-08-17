// Test — Entrée/Retour passe au champ de stock suivant, en vue bureau
// (16/08/2026, demande de Frédéric : "en vue bureau que ce soit FDJ ou
// contrôle FDJ en inscrivant le stock initial ou final, peux tu faire en
// sorte de passer à la ligne suivante en cliquant sur la touche return ou
// entrée").
//
// Extrait la fonction réelle jeuInputToucheEntree de chaque fichier via
// regex (jamais réécrite à la main, comme tous les tests de ce module).
// Simule un document minimal (querySelectorAll par classe + focus/select
// trackés) plutôt que jsdom, cohérent avec le fait qu'aucun autre test de
// ce projet ne dépend de jsdom.

const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

function extraire(source, nomFonction) {
  const debut = source.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  let i = source.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (source[j] === '{') profondeur++;
    else if (source[j] === '}') profondeur--;
    j++;
  }
  return source.slice(debut, j);
}

function fauxInput(classes) {
  return {
    classList: classes,
    focused: false,
    selected: false,
    focus() { this.focused = true; },
    select() { this.selected = true; },
  };
}

function fauxDocument(elements) {
  return {
    querySelectorAll(selector) {
      const cle = selector.replace('.', '');
      return elements.filter(el => el.classList.includes(cle));
    },
  };
}

function nouveauContexte(fichier, script, vueBureau) {
  const src = [
    extraire(script, 'jeuInputToucheEntree'),
    'globalThis.__test = jeuInputToucheEntree;',
  ].join('\n\n');
  const ctx = {
    globalThis: {},
    console,
    document: null, // injecté par scénario
    nexusEstVueBureau: () => vueBureau,
  };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  return ctx;
}

function testerFichier(chemin, nomFichier) {
  const script = fs.readFileSync(chemin, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

  // 1) Hors vue bureau : Entrée ne fait RIEN — ni preventDefault, ni focus.
  //    Comportement natif préservé (le clavier numérique mobile gère son
  //    propre "suivant").
  (() => {
    const elements = [fauxInput(['jeu-input']), fauxInput(['jeu-input'])];
    const ctx = nouveauContexte(nomFichier, script, false);
    ctx.document = fauxDocument(elements);
    let empeche = false;
    ctx.__test({ key: 'Enter', target: elements[0], preventDefault: () => { empeche = true; } });
    assert.strictEqual(empeche, false, 'Hors vue bureau, Entrée ne doit jamais être interceptée');
    assert.strictEqual(elements[1].focused, false, 'Hors vue bureau, aucun focus ne doit être déplacé');
    console.log(`OK [${nomFichier}] — hors vue bureau, Entrée reste un no-op (clavier mobile natif préservé).`);
  })();

  // 2) En vue bureau, Entrée sur un champ non-dernier -> focus + select sur
  //    le champ suivant dans l'ordre DOM, et preventDefault appelé.
  (() => {
    const elements = [fauxInput(['jeu-input']), fauxInput(['jeu-input']), fauxInput(['jeu-input'])];
    const ctx = nouveauContexte(nomFichier, script, true);
    ctx.document = fauxDocument(elements);
    let empeche = false;
    ctx.__test({ key: 'Enter', target: elements[0], preventDefault: () => { empeche = true; } });
    assert.strictEqual(empeche, true, 'En vue bureau, Entrée doit être interceptée (preventDefault)');
    assert.strictEqual(elements[1].focused, true, 'Le champ suivant doit recevoir le focus');
    assert.strictEqual(elements[1].selected, true, 'Le contenu du champ suivant doit être sélectionné (ré-écriture facile)');
    assert.strictEqual(elements[2].focused, false, 'Le focus ne doit jamais sauter un champ');
    console.log(`OK [${nomFichier}] — en vue bureau, Entrée déplace le focus sur le champ suivant et le sélectionne.`);
  })();

  // 3) En vue bureau, Entrée sur le DERNIER champ -> ne plante jamais,
  //    aucun focus déplacé (rien après).
  (() => {
    const elements = [fauxInput(['jeu-input']), fauxInput(['jeu-input'])];
    const ctx = nouveauContexte(nomFichier, script, true);
    ctx.document = fauxDocument(elements);
    assert.doesNotThrow(() => ctx.__test({ key: 'Enter', target: elements[1], preventDefault: () => {} }));
    console.log(`OK [${nomFichier}] — Entrée sur le dernier champ ne plante jamais.`);
  })();

  // 4) Une touche autre que Entrée ne déclenche jamais rien, même en vue
  //    bureau (régression — ne doit pas intercepter la frappe normale).
  (() => {
    const elements = [fauxInput(['jeu-input']), fauxInput(['jeu-input'])];
    const ctx = nouveauContexte(nomFichier, script, true);
    ctx.document = fauxDocument(elements);
    let empeche = false;
    ctx.__test({ key: 'Tab', target: elements[0], preventDefault: () => { empeche = true; } });
    assert.strictEqual(empeche, false, 'Une touche autre que Entrée ne doit jamais être interceptée');
    assert.strictEqual(elements[1].focused, false);
    console.log(`OK [${nomFichier}] — seule la touche Entrée déclenche le saut de champ (régression).`);
  })();

  // 5) Champ cible introuvable dans la liste (ex. élément déjà retiré du
  //    DOM entre-temps) -> ne plante jamais, aucun focus déplacé.
  (() => {
    const elements = [fauxInput(['jeu-input']), fauxInput(['jeu-input'])];
    const cibleEtrangere = fauxInput(['jeu-input']); // volontairement absent de `elements`
    const ctx = nouveauContexte(nomFichier, script, true);
    ctx.document = fauxDocument(elements);
    assert.doesNotThrow(() => ctx.__test({ key: 'Enter', target: cibleEtrangere, preventDefault: () => {} }));
    console.log(`OK [${nomFichier}] — cible introuvable dans la liste courante : ne plante jamais (régression).`);
  })();
}

testerFichier('/sessions/dazzling-compassionate-ride/mnt/image nexus project/NEXUS-FDJ-v1.html', 'NEXUS-FDJ-v1.html');
testerFichier('/sessions/dazzling-compassionate-ride/mnt/image nexus project/NEXUS-FDJ-Manager-v1.html', 'NEXUS-FDJ-Manager-v1.html');

console.log('\nTous les tests "Entrée -> champ suivant (FDJ)" passent.');
