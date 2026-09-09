// Épreuve de la recette navigateur (outils/recette-navigateur-test.js).
//
// Ce qui est éprouvé ici, c'est le JUGEMENT — la fonction qui décide si ce
// qu'on a vu à l'écran prouve quelque chose. Le pilotage du navigateur, lui,
// n'a de valeur que branché sur NEXUS Test ; l'éprouver contre un faux
// navigateur ne prouverait que le faux navigateur.
//
// Le cas central : un total de 36 000 L SANS récupération de reliquat doit
// être un ÉCHEC. C'est le piège du 07/09 — deux carburants en sécurité
// s'arrondissent vers le haut et atteignent 36 000 L sans jamais exercer le
// correctif CARB-004. Une recette qui se contenterait du total afficherait
// vert sur un moteur non corrigé.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const OUTIL = path.join(__dirname, 'outils', 'recette-navigateur-test.js');
const { verifier, verifierLive, jugerCarburants, semisEffectue, secretsManquants, extraireCommitServi, SECRETS_REQUIS } = require(OUTIL);

let passes = 0;
function epreuve(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// Observation conforme : exactement ce que l'écran a rendu le 07/09/2026.
function vuConforme(muter) {
  const vu = {
    ok: true, site: 'nexus-station-test', total: 36000,
    volumes: { sp95: 23000, go: 13000 },
    reliquatArrondi: {
      recupereL: 1000,
      parCarburant: { go: 1000 },
      motifs: { sp95: 'Capacité disponible à la livraison insuffisante pour un compartiment de plus.' },
    },
    optimiseurBrut: { volumesRetenus: { sp95: 23606, go: 12394 }, total: 36000 },
  };
  if (muter) muter(vu);
  return vu;
}

epreuve('l’observation réelle du 07/09 est acceptée', () => {
  assert.deepStrictEqual(verifier(vuConforme()), [],
    'sans cette épreuve, toutes les suivantes passeraient avec un juge qui refuse tout');
});

epreuve('un total de 35 000 L est refusé, et le chiffre est nommé', () => {
  const e = verifier(vuConforme(v => { v.total = 35000; }));
  assert.ok(e.length, 'doit échouer');
  assert.ok(/35000/.test(e.join(' ')) && /36000/.test(e.join(' ')), e.join(' | '));
});

epreuve('36 000 L SANS récupération de reliquat est refusé', () => {
  // Le cœur de la recette. Le total seul ne prouve rien : il peut venir d'un
  // arrondi vers le haut sur deux carburants en sécurité, sans que la phase
  // corrigée par CARB-004 ait jamais été exercée.
  const e = verifier(vuConforme(v => {
    v.reliquatArrondi.recupereL = 0;
    v.reliquatArrondi.parCarburant = {};
  }));
  assert.ok(e.length, 'un total juste pour de mauvaises raisons doit échouer');
  assert.ok(/ne prouverait pas CARB-004/.test(e.join(' ')),
    'et le message doit dire pourquoi : ' + e.join(' | '));
});

epreuve('un reliquat absent de la réponse est refusé — traversée P0 rompue', () => {
  const e = verifier(vuConforme(v => { delete v.reliquatArrondi; }));
  assert.ok(e.length);
  assert.ok(/traversée de la couche P0 est rompue/.test(e.join(' ')), e.join(' | '));
});

epreuve('un reliquat crédité au mauvais carburant est refusé', () => {
  const e = verifier(vuConforme(v => { v.reliquatArrondi.parCarburant = { sp95: 1000 }; }));
  assert.ok(e.length, 'le compartiment doit aller au go, pas au sp95 déjà à sa capacité');
  assert.ok(/crédité à go/.test(e.join(' ')), e.join(' | '));
});

epreuve('un refus silencieux sur sp95 est refusé', () => {
  const e = verifier(vuConforme(v => { v.reliquatArrondi.motifs = {}; }));
  assert.ok(e.length);
  assert.ok(/motif de refus explicite, pas un silence/.test(e.join(' ')), e.join(' | '));
});

epreuve('un motif de refus générique est refusé', () => {
  // « Non » sans raison est la moitié d'une réponse : le manager doit savoir
  // que c'est la capacité qui bloque, pas la rotation.
  const e = verifier(vuConforme(v => { v.reliquatArrondi.motifs.sp95 = 'Impossible.'; }));
  assert.ok(e.length);
  assert.ok(/doit nommer la capacité/.test(e.join(' ')), e.join(' | '));
});

epreuve('une absence de recommandation renvoie vers le jeu de données, pas vers le moteur', () => {
  // Le 07/09, la première recette a échoué parce que la base Test était vide.
  // Le message doit envoyer là, sinon la prochaine session cherchera le bug
  // dans le moteur pendant une heure.
  const e = verifier({ ok: false, total: null });
  assert.strictEqual(e.length, 1, 'un seul diagnostic, pas une avalanche : ' + e.join(' | '));
  assert.ok(/recette-carburants-test\.sql/.test(e[0]), e[0]);
});

epreuve('les secrets manquants sont nommés un par un', () => {
  assert.deepStrictEqual(secretsManquants({}), SECRETS_REQUIS);
  assert.deepStrictEqual(
    secretsManquants({ NEXUS_TEST_URL: 'https://x', NEXUS_TEST_MANAGER_NOM: 'Manager Test',
      NEXUS_TEST_CREATEUR_NOM: 'Créateur Test', NEXUS_TEST_MANAGER_PIN: 'x', NEXUS_TEST_CREATEUR_PIN: '  ' }),
    ['NEXUS_TEST_CREATEUR_PIN'], 'un secret vide ou blanc est un secret manquant');
});

epreuve('chaque profil exigé porte désormais son propre secret PIN, plus de secret partagé', () => {
  // Le 08/09/2026, Frédéric a créé un PIN distinct par compte de recette
  // (Manager/Créateur/Employé A/Employé B) : partager NEXUS_TEST_PIN entre
  // des profils qui n'ont pas la même autorisation (Créateur vs Manager)
  // était une friction de moindre-privilège évitable.
  assert.ok(SECRETS_REQUIS.includes('NEXUS_TEST_MANAGER_PIN'), 'Manager doit exiger son propre PIN');
  assert.ok(SECRETS_REQUIS.includes('NEXUS_TEST_CREATEUR_PIN'), 'Créateur doit exiger son propre PIN');
  assert.ok(!SECRETS_REQUIS.includes('NEXUS_TEST_PIN'),
    'le secret partagé ne doit plus être une dépendance active de la recette canonique');
});

epreuve('l’identité de la version servie est lue dans nexus-build.js', () => {
  // Le 05/09, dix minutes ont été perdues à interroger nexus-generation.json,
  // une URL qui n'a jamais existé. Le vrai point de preuve est nexus-build.js.
  const servi = `  var IDENTITE = {\n    commit: '39d6b4d64e58fabef8134a62ada9b7a1872fe34e',\n` +
    `    commitCourt: '39d6b4d',\n    environnement: 'test',\n  };`;
  assert.strictEqual(extraireCommitServi(servi), '39d6b4d64e58fabef8134a62ada9b7a1872fe34e');
  assert.strictEqual(extraireCommitServi('rien de tel ici'), null,
    'une page qui ne dit pas sa version doit rendre null, jamais une valeur plausible');
  assert.strictEqual(extraireCommitServi(''), null);
});

epreuve('le PIN n’apparaît dans aucune sortie ni aucun message d’erreur', () => {
  // Contrat de source, comme celui qui interdit à la couche P0 de connaître le
  // mot « reliquat ». Une trace ajoutée un jour de débogage est exactement la
  // façon dont un secret finit dans un journal public.
  // Premier jet de cette épreuve : chercher « pin » sur les lignes contenant
  // console.* ou throw. Elle a laissé passer la mutation, parce que le `throw`
  // du fichier s'étend sur deux lignes et que la concaténation fautive était
  // sur la seconde. Une détection ligne à ligne ne voit pas une instruction.
  //
  // Contrat retenu, plus simple et plus fort : la VALEUR du PIN ne circule que
  // vers le champ du formulaire. L'identifiant `pin` (minuscule) ne doit donc
  // apparaître qu'à deux endroits — la signature qui le reçoit, et le `.fill()`
  // qui le saisit. Partout ailleurs, il s'échappe.
  const source = fs.readFileSync(OUTIL, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  // Liste NOMMÉE, pas un motif large : chaque endroit où la valeur transite
  // est déclaré ici un par un. Ajouter une fonction qui reçoit le PIN oblige
  // donc à venir l'inscrire — c'est-à-dire à se demander si elle a une raison
  // de le toucher. Un motif générique aurait laissé passer la suivante sans
  // que personne y pense. (Ce contrat a refusé `observerLive` à sa création,
  // et c'était le comportement voulu.)
  const autorisees = [
    'async function connecter(page, base, identifiant, pin) {',
    'await page.locator(\'input[type="password"]\').first().fill(pin);',
    'async function observerLive(navigateur, base, nom, pin) {',
    'await connecter(page, base, nom, pin);',
    // Inscrite le 09/09/2026, après que ce contrat l'a refusée — comportement
    // voulu. La question qu'il force : `observerEmploye` a-t-elle une raison de
    // recevoir le PIN ? Oui, elle connecte un compte employé, et elle ne fait
    // que le transmettre à `connecter`, seule fonction qui le saisit. Elle ne
    // le journalise pas, ne le met dans aucun message et n'écrit aucune
    // capture. Aucune ligne nouvelle ne s'ajoute donc ci-dessous.
    'async function observerEmploye(navigateur, base, nom, pin) {',
  ].map(l => l.trim());
  const fautives = source.split('\n')
    .filter(l => /\bpin\b/.test(l))
    .filter(l => !autorisees.includes(l.trim()));
  assert.deepStrictEqual(fautives, [],
    'la valeur du PIN ne doit aller que dans le champ du formulaire ; lignes fautives :\n' + fautives.join('\n'));
});


epreuve('CONTRAT — dans observerLive, ce qui est rendu depuis le try est ATTENDU', () => {
  // Le 08/09/2026, la recette a échoué sur « Target page, context or browser
  // has been closed ». La cause n'était pas l'écran : `return page.evaluate(…)`
  // dans un `try`/`finally` déclenche le `finally` AU MOMENT du return, pas
  // après. La fermeture du contexte et l'évaluation dans la page partaient en
  // course, et la recette gagnait cette course la plupart du temps — donc le
  // vert des jours précédents ne prouvait pas ce qu'on croyait. Une preuve qui
  // dépend d'un ordonnancement n'est pas une preuve.
  //
  // Ce contrat ne se relit pas à l'œil : il se vérifie ici, parce que la
  // version fautive est plus courte et plus naturelle à écrire que la bonne.
  const source = fs.readFileSync(OUTIL, 'utf8');
  const debut = source.indexOf('async function observerLive(');
  assert.ok(debut > 0, 'observerLive introuvable — le contrat a perdu son objet');
  const finallyPos = source.indexOf('} finally {', debut);
  assert.ok(finallyPos > debut, 'observerLive doit fermer son contexte dans un finally');
  const corpsTry = source.slice(debut, finallyPos);
  // Exactement quatre espaces : les `return` du code exécuté DANS le
  // navigateur (callbacks de waitForFunction/evaluate) sont plus indentés et
  // ne concernent pas ce contrat — ils s'exécutent dans la page, pas ici.
  const retours = corpsTry.split('\n').filter(l => /^ {4}return\s+\S/.test(l));
  assert.ok(retours.length > 0, 'le try doit rendre quelque chose');
  for (const r of retours) {
    assert.ok(/^\s*return\s+await\s/.test(r),
      'un return non attendu dans un try/finally ferme la ressource avant de lire : ' + r.trim());
  }
});


// ── Semis absent : ne pas accuser le moteur de ce qu'on n'a pas maîtrisé ──

epreuve('le semis n’est réputé fait que sur un OUI explicite', () => {
  // Survivante de mutation : remplacer cette lecture par `true` ne cassait
  // aucune épreuve, parce qu'elle vivait dans `executer()`, hors d'atteinte.
  // Un « je ne sais pas » doit valoir NON — sinon un run sans préparation
  // s'attribuerait la preuve d'un run qui l'avait faite.
  assert.strictEqual(semisEffectue({ NEXUS_SEMIS_FAIT: '1' }), true);
  for (const cas of [{}, { NEXUS_SEMIS_FAIT: '0' }, { NEXUS_SEMIS_FAIT: '' },
    { NEXUS_SEMIS_FAIT: 'true' }, { NEXUS_SEMIS_FAIT: 1 }, undefined]) {
    assert.strictEqual(semisEffectue(cas), false,
      'doit valoir NON : ' + JSON.stringify(cas));
  }
});

epreuve('CONTRAT — executer interroge semisEffectue, il ne décrète pas', () => {
  // `executer()` exige un vrai navigateur : aucune épreuve ne peut l'exercer,
  // et une mutation y remplaçant l'appel par `true` survit donc en silence.
  // Ce que l'exécution ne peut pas couvrir, la source le fixe.
  const source = fs.readFileSync(OUTIL, 'utf8');
  const assignations = source.split('\n').filter(l => /const\s+semisFait\s*=/.test(l));
  assert.strictEqual(assignations.length, 1, 'une seule origine : ' + assignations.join(' | '));
  assert.ok(/const\s+semisFait\s*=\s*semisEffectue\(env\);/.test(assignations[0]),
    'le semis doit être LU dans l’environnement, jamais décrété : ' + assignations[0].trim());
});

epreuve('un écart sur données NON semées ne devient jamais une régression', () => {
  // Le 08/09/2026, le semis n'a pas pu s'exécuter et la recette a conclu que
  // CARB-004 n'était pas prouvé. Elle jugeait des données dérivées : le fait
  // réel n'était pas « le moteur a régressé » mais « je n'ai pas maîtrisé
  // l'entrée ». Les deux exigent des actions opposées, d'où cette séparation.
  const j = jugerCarburants(['reliquat récupéré 0 L, attendu 1000 L'], false);
  assert.deepStrictEqual(j.echecs, [], 'aucun échec imputé au moteur');
  assert.ok(j.indisponibilite, 'mais la situation doit être DITE');
  assert.ok(/NON SATISFAITE/.test(j.indisponibilite),
    'et la preuve déclarée non satisfaite, jamais passée sous silence : ' + j.indisponibilite);
  assert.ok(/reliquat récupéré 0 L/.test(j.indisponibilite),
    'l’écart observé doit rester lisible, pas être avalé : ' + j.indisponibilite);
});

epreuve('le même écart sur données SEMÉES reste un échec bloquant', () => {
  // La moitié qui donne son sens à la précédente. Sans elle, on aurait
  // simplement cessé de juger les carburants.
  const j = jugerCarburants(['reliquat récupéré 0 L, attendu 1000 L'], true);
  assert.strictEqual(j.echecs.length, 1, 'le moteur reste jugé quand l’entrée est maîtrisée');
  assert.strictEqual(j.indisponibilite, null);
});

epreuve('un succès sur données non semées reste une observation vraie', () => {
  // L'écran a réellement produit ces chiffres : il n'y a rien à excuser.
  const j = jugerCarburants([], false);
  assert.deepStrictEqual(j.echecs, []);
  assert.strictEqual(j.indisponibilite, null,
    'ne pas fabriquer une indisponibilité là où la preuve est faite');
});


// ── NEXUS Live : le jugement d'accès ────────────────────────────────────
// Le MVP n'avait qu'une recette NÉGATIVE. C'est la moitié rassurante et la
// moins utile : un écran cassé, qui refuse absolument tout le monde, la
// passerait aussi. Les deux moitiés sont donc exigées ensemble.

epreuve('le Créateur doit ENTRER, pas seulement les autres être refusés', () => {
  const createurEntre = { texte: 'NEXUS LIVE DÉVELOPPEMENT\nTimeline\n…', refuse: false, contientTimeline: true, attente: 'rien', boutonAutoriser: false };
  // Texte RÉEL de l'écran, relevé en CI le 07/09 — et non une prose inventée
  // qui contiendrait commodément le mot « refusé ». C'est précisément l'écart
  // entre les deux qui a produit une fausse accusation de fuite d'accès.
  const managerRefuse = { texte: 'Cet écran est réservé au Créateur NEXUS. (capacite_createur_absente)', refuse: true, contientTimeline: false };
  assert.deepStrictEqual(verifierLive(createurEntre, managerRefuse), [],
    'la situation conforme doit passer, sinon les épreuves suivantes ne prouvent rien');

  const e = verifierLive({ texte: 'Cet écran est réservé au Créateur NEXUS. (capacite_createur_absente)', refuse: true, contientTimeline: false }, managerRefuse);
  assert.ok(e.length, 'un écran qui refuse AUSSI le Créateur doit échouer');
  assert.ok(/doit ENTRER/.test(e.join(' ')), e.join(' | '));
});

epreuve('un manager qui ENTRE dans Live est un échec, pas un détail', () => {
  const createurEntre = { texte: 'Timeline', refuse: false, contientTimeline: true, attente: 'rien', boutonAutoriser: false };
  const managerEntre = { texte: 'Timeline', refuse: false, contientTimeline: true, attente: 'rien', boutonAutoriser: false };
  const e = verifierLive(createurEntre, managerEntre);
  assert.ok(e.length, 'la fuite d’accès doit être détectée');
  assert.ok(/ne doit PAS accéder/.test(e.join(' ')), e.join(' | '));
});

epreuve('un Créateur qui entre sur un écran VIDE ne prouve rien', () => {
  // Entrer ne suffit pas : si la timeline est absente, l'écran n'a rien à
  // montrer et le « succès » ne dit rien de la chaîne d'événements.
  const e = verifierLive({ texte: 'NEXUS LIVE', refuse: false, contientTimeline: false },
    { texte: 'Cet écran est réservé au Créateur NEXUS. (capacite_createur_absente)', refuse: true, contientTimeline: false });
  assert.ok(e.length, 'un écran sans timeline ne vaut pas preuve d’accès');
});


epreuve('un Créateur NON OBSERVÉ n’accuse pas l’écran', () => {
  // Distinction décisive : un compte de recette inconnectable et un écran qui
  // refuse le Créateur sont opposés. Les confondre accuserait le contrôle
  // d'accès d'un défaut qu'il n'a pas — et masquerait le vrai, qui est
  // l'absence de compte.
  const managerRefuse = { texte: 'Cet écran est réservé au Créateur NEXUS. (capacite_createur_absente)', refuse: true, contientTimeline: false };
  assert.deepStrictEqual(verifierLive(null, managerRefuse), [],
    'aucune observation ne doit produire aucune accusation');
  // Le refus manager, lui, reste jugé même sans observation du Créateur.
  const e = verifierLive(null, { texte: 'Timeline', refuse: false, contientTimeline: true });
  assert.ok(e.length, 'une fuite d’accès manager doit rester détectée');
});

// ——— Le bouton qui manquait ———————————————————————————————————————————
// Frédéric, 08/09/2026 : « pourquoi le bouton J'autorise n'est pas présent ? »
// La question ne pouvait pas être tranchée : rien ne regardait ce bouton. On
// ne décrète pas ici qu'un arbitrage DOIT être ouvert — cela dépend du journal
// du moment, et une preuve qui exige un état du monde ment dès que le monde
// change. On exige que les deux moitiés de l'écran s'accordent.

epreuve('un arbitrage annoncé SANS bouton pour y répondre est un échec', () => {
  const manager = { texte: '(capacite_createur_absente)', refuse: true, contientTimeline: false };
  const e = verifierLive({ texte: 'Ce qui t’attend', refuse: false, contientTimeline: true,
    attente: 'arbitrage', boutonAutoriser: false }, manager);
  assert.ok(e.length, 'une question posée sans moyen de répondre doit être vue');
  assert.ok(/AUCUN bouton/.test(e.join(' ')), e.join(' | '));

  // Et la situation conforme passe, sinon l'épreuve ci-dessus ne prouve rien.
  assert.deepStrictEqual(verifierLive({ texte: 'Ce qui t’attend', refuse: false,
    contientTimeline: true, attente: 'arbitrage', boutonAutoriser: true }, manager), []);
});

epreuve('un bouton d’autorisation SANS question à laquelle il répond est un échec', () => {
  const manager = { texte: '(capacite_createur_absente)', refuse: true, contientTimeline: false };
  const e = verifierLive({ texte: 'Rien ne t’attend', refuse: false, contientTimeline: true,
    attente: 'rien', boutonAutoriser: true }, manager);
  assert.ok(/propose quand même d’autoriser/.test(e.join(' ')), e.join(' | '));
});

epreuve('un écran qui ne dit pas ce qu’il attend est un échec, pas un silence', () => {
  const manager = { texte: '(capacite_createur_absente)', refuse: true, contientTimeline: false };
  // `undefined`, et non `null` : une observation qui ne porte pas du tout le
  // champ échappait au jugement, parce que `undefined === null` est faux.
  const muet = verifierLive({ texte: 'x', refuse: false, contientTimeline: true }, manager);
  assert.ok(/ne déclare pas ce qu’il attend/.test(muet.join(' ')), muet.join(' | '));
  const nul = verifierLive({ texte: 'x', refuse: false, contientTimeline: true, attente: null }, manager);
  assert.ok(/ne déclare pas ce qu’il attend/.test(nul.join(' ')), nul.join(' | '));
});

epreuve('un Créateur REFUSÉ n’est pas jugé sur un bouton qu’il ne peut pas voir', () => {
  const manager = { texte: '(capacite_createur_absente)', refuse: true, contientTimeline: false };
  const e = verifierLive({ texte: '(capacite_createur_absente)', refuse: true,
    contientTimeline: false }, manager);
  assert.ok(!/bouton|déclare pas ce qu’il attend/.test(e.join(' ')),
    'le vrai défaut est le refus, pas l’absence de bouton : ' + e.join(' | '));
});

epreuve('une question déjà répondue ne doit pas reproposer le bouton', () => {
  const manager = { texte: '(capacite_createur_absente)', refuse: true, contientTimeline: false };
  const e = verifierLive({ texte: 'Tu as répondu', refuse: false, contientTimeline: true,
    attente: 'repondu', boutonAutoriser: true }, manager);
  assert.ok(/déjà répondue/.test(e.join(' ')), e.join(' | '));

  assert.deepStrictEqual(verifierLive({ texte: 'Tu as répondu', refuse: false,
    contientTimeline: true, attente: 'repondu', boutonAutoriser: false }, manager), [],
    'l’état conforme doit passer, sinon l’épreuve ci-dessus ne prouve rien');
});

epreuve('un état d’attente INCONNU n’est pas jugé conforme par défaut', () => {
  // C'est ainsi qu'un écran modifié cesse silencieusement d'être jugé : la
  // recette ne reconnaît plus rien, donc elle ne reproche plus rien.
  const manager = { texte: '(capacite_createur_absente)', refuse: true, contientTimeline: false };
  const e = verifierLive({ texte: 'x', refuse: false, contientTimeline: true,
    attente: 'en-cours-de-reflexion', boutonAutoriser: false }, manager);
  assert.ok(/état d’attente inconnu/.test(e.join(' ')), e.join(' | '));
});

// ─────────────────────────────────────────────────────────────────────────
// SCÉNARIO EMPLOYÉ — le verdict, éprouvé sans navigateur.
//
// Ce qui décide ici n'est pas la première prise de poste mais la SECONDE :
// celle de l'employé qui n'a pas fermé son quart de la veille, comportement
// ordinaire de l'équipe selon Frédéric (09/09/2026). C'est elle que l'index
// d'unicité de la release 2026.09.1 pourrait refuser.

const { verifierEmploye, SECRETS_EMPLOYE } = require('./outils/recette-navigateur-test.js');

const CONFIRME = { atteint: 'confirme', alertes: [], role: 'caissiere' };

epreuve('les deux prises de poste abouties : rien à reprocher', () => {
  assert.deepStrictEqual(verifierEmploye(CONFIRME, CONFIRME), [],
    'l’état conforme doit passer, sinon les épreuves suivantes ne prouvent rien');
});

epreuve('la SECONDE prise de poste refusée est dénoncée, avec ce que l’employé a lu', () => {
  const bloque = { atteint: 'bloque', role: 'caissiere',
                   alertes: ['Un problème est survenu, réessayez.'] };
  const e = verifierEmploye(CONFIRME, bloque).join(' | ');
  assert.ok(/QUART DÉJÀ OUVERT REFUSÉE/.test(e), e);
  assert.ok(/Un problème est survenu/.test(e),
    'le message RÉELLEMENT vu par l’employé doit être rapporté, pas résumé');
  assert.ok(/réessayez.*ne marchera jamais|jamais/.test(e),
    'le rapport doit dire que réessayer est vain — sinon on croit à un incident passager');
});

epreuve('une alerte à la seconde prise est signalée MÊME si l’écran aboutit', () => {
  // Un écran qui finit par marcher après avoir affiché une erreur reste un
  // écran qui a affiché une erreur. Pour une équipe qui pense déjà que NEXUS
  // ne fonctionne pas, c'est le message vu qui compte, pas l'issue technique.
  const avecAlerte = { atteint: 'confirme', role: 'caissiere', alertes: ['Erreur réseau'] };
  const e = verifierEmploye(CONFIRME, avecAlerte).join(' | ');
  assert.ok(/alerte est apparue/.test(e), e);
});

epreuve('la PREMIÈRE prise refusée arrête le jugement — le reste n’a plus de sens', () => {
  const bloque = { atteint: 'bloque', role: 'caissiere', alertes: [] };
  const e = verifierEmploye(bloque, CONFIRME);
  assert.strictEqual(e.length, 1, 'un seul reproche : le premier échec explique tout');
  assert.ok(/initiale REFUSÉE/.test(e[0]), e[0]);
});

epreuve('aucun rôle proposé est un défaut NOMMÉ, pas un succès', () => {
  const e = verifierEmploye({ atteint: 'aucun_role', alertes: [] }, CONFIRME).join(' | ');
  assert.ok(/aucun rôle proposé/.test(e), e);
});

epreuve('une observation MANQUANTE ne vaut pas conforme', () => {
  // Trois états, jamais deux : ne pas avoir pu observer n'est pas « ça marche ».
  assert.ok(verifierEmploye(null, null).length > 0, 'null doit produire un refus');
  assert.ok(/on ne conclut pas/.test(verifierEmploye(CONFIRME, null).join(' ')),
    'une seconde observation absente doit refuser de conclure');
});

epreuve('les secrets employé sont HORS des secrets requis', () => {
  // Les y mettre ferait dégrader la recette entière le jour où ils manquent :
  // on perdrait la preuve UI Carburants et les deux preuves d'accès Live,
  // acquises le 09/09, pour un scénario sans rapport.
  const { SECRETS_REQUIS } = require('./outils/recette-navigateur-test.js');
  for (const n of SECRETS_EMPLOYE)
    assert.ok(!SECRETS_REQUIS.includes(n),
      `${n} est dans SECRETS_REQUIS : son absence ferait tomber toute la recette`);
});

// ─────────────────────────────────────────────────────────────────────────
// L'INVITATION À L'INVENTAIRE — le verdict, sans navigateur.
//
// Le piège que ce verdict évite : la carte peut être LÉGITIMEMENT absente
// quand rien n'attend. Une épreuve qui exigerait sa présence serait rouge les
// jours calmes ; une qui accepterait son absence ne prouverait rien. On juge
// donc la COHÉRENCE entre ce que l'accueil a DÉCIDÉ et ce qu'il MONTRE.

const { verifierInvitation, indisponibiliteInvitation } = require('./outils/recette-navigateur-test.js');

epreuve('rien n’attend et rien n’est montré : conforme', () => {
  assert.deepStrictEqual(
    verifierInvitation({ presente: true, etat: 'aucune', visible: false, texte: '' }), [],
    'l’état conforme doit passer, sinon les épreuves suivantes ne prouvent rien');
});

epreuve('une mission attend et est montrée : conforme', () => {
  assert.deepStrictEqual(
    verifierInvitation({ presente: true, etat: 'proposee', visible: true, texte: 'Contrôle sensibles' }), []);
});

epreuve('DÉCIDÉE puis NON MONTRÉE est dénoncé — c’est le défaut mesuré', () => {
  const e = verifierInvitation({ presente: true, etat: 'proposee', visible: false, texte: '' }).join(' | ');
  assert.ok(/décidé.*attendait.*PAS montrée/i.test(e) || /non montr/i.test(e), e);
  assert.ok(/36 services|zéro participation/.test(e),
    'le rapport doit rappeler la mesure qui justifie cette carte');
});

epreuve('une carte VIDE qui invite sans dire à quoi est refusée', () => {
  const e = verifierInvitation({ presente: true, etat: 'proposee', visible: true, texte: '' }).join(' | ');
  assert.ok(/VIDE/.test(e), e);
});

epreuve('s’afficher alors que RIEN n’attend est refusé', () => {
  const e = verifierInvitation({ presente: true, etat: 'aucune', visible: true, texte: 'x' }).join(' | ');
  assert.ok(/rien n’attend|bruit/i.test(e), e);
});

epreuve('« indisponible » n’est PAS un échec — c’est un refus de conclure', () => {
  // Le confondre avec « aucune » ferait passer une panne pour un calme ; le
  // compter comme un échec rendrait la recette rouge sur une simple lenteur.
  assert.deepStrictEqual(
    verifierInvitation({ presente: true, etat: 'indisponible', visible: false, texte: '' }), [],
    'l’indisponibilité se rapporte à part, elle ne fait pas échouer la recette');
});

epreuve('une carte ABSENTE de l’accueil est un vrai échec', () => {
  const e = verifierInvitation({ presente: false, etat: null, visible: false, texte: '' }).join(' | ');
  assert.ok(/ABSENTE/.test(e), e);
  assert.ok(/jamais se voir proposer/.test(e),
    'le rapport doit dire ce que cette absence COÛTE, pas seulement qu’elle existe');
});

epreuve('MUTATION : ranger « non jugée » dans les échecs rend la recette rouge à tort', () => {
  // Le défaut du 09/09, reproduit. La recette annonçait « ÉCHEC » puis, dans la
  // même phrase, « ce n'est pas un défaut de la carte ». Une recette qui se
  // contredit en une ligne n'apprend rien à qui la lit — et une séquence métier
  // normale, le pointage exigé avant l'accueil, la rendait rouge tous les jours.
  const src = fs.readFileSync(path.join(__dirname, 'outils', 'recette-navigateur-test.js'), 'utf8');
  const mute = src.replace('if (NON_JUGEABLE.test(vue.motif || \'\')) return echecs;',
    "if (NON_JUGEABLE.test(vue.motif || '')) { echecs.push('NON JUGÉE'); return echecs; }");
  assert.notStrictEqual(mute, src, 'la mutation n’a rien changé : elle ne prouve rien');
  const ctx = { module: { exports: {} }, require, console, RegExp, Error, URL, Date, Math, JSON, process };
  ctx.exports = ctx.module.exports;
  require('vm').runInNewContext(mute, ctx);
  const V = { presente: false, etat: null, visible: false, texte: '',
              motif: 'le pointage d’arrivée est exigé avant l’accueil' };
  assert.ok(ctx.module.exports.verifierInvitation(V).length > 0,
    'le code muté devait rendre un échec ; l’épreuve ne détecte donc pas ce défaut');
});

epreuve('une REDIRECTION n’est pas accusée sur le dos de la carte', () => {
  // L'accueil redirige vers la prise de poste quand il ne trouve aucun service
  // actif. La carte est alors absente pour une raison qui n'a rien à voir avec
  // elle. L'accuser masquerait la vraie cause, et enverrait chercher un défaut
  // là où il n'y en a pas.
  const vue = { presente: false, etat: null, visible: false, texte: '',
    motif: 'l’accueil a redirigé vers la prise de poste : aucun service actif' };
  assert.deepStrictEqual(verifierInvitation(vue), [],
    'une redirection n’est PAS un échec : le jugement n’a pas eu lieu');
  const i = indisponibiliteInvitation(vue) || '';
  assert.ok(/NON JUGÉE/.test(i), i);
  assert.ok(/pas un défaut de la carte/.test(i), i);
  assert.ok(!/ABSENTE de l’accueil/.test(i),
    'une redirection ne doit pas être rapportée comme une carte manquante');
});

epreuve('le POINTAGE exigé avant l’accueil n’est pas un défaut de la carte', () => {
  // nexus-auth impose une séquence : prise de poste, PUIS pointage d’arrivée,
  // et seulement ensuite l’accueil. Un scénario qui va droit à l’accueil est
  // renvoyé pointer, et la carte n’est jamais atteinte. L’accuser reviendrait
  // à signaler un défaut inexistant à chaque exécution.
  const vue = { presente: false, etat: null, visible: false, texte: '',
    motif: 'le pointage d’arrivée est exigé avant l’accueil (NEXUS-Pointage-v1) — séquence obligatoire' };
  assert.deepStrictEqual(verifierInvitation(vue), [],
    'le pointage exigé n’est PAS un échec de la recette : c’est la séquence métier');
  const i = indisponibiliteInvitation(vue) || '';
  assert.ok(/NON JUGÉE/.test(i), i);
  assert.ok(/pointage/i.test(i), 'le rapport doit nommer l’étape qui s’est interposée');
  assert.ok(!/ABSENTE de l’accueil/.test(i));
});

epreuve('une chaîne de requête n’est pas une destination', () => {
  // L’URL réelle du 09/09 était « NEXUS-Pointage-v1?retour=NEXUS-App-v1 ». Un
  // test sur l’URL entière y voit « App-v1 » et conclut que l’accueil était
  // affiché — c’est exactement l’erreur qui a fait accuser la carte.
  const src = fs.readFileSync(path.join(__dirname, 'outils', 'recette-navigateur-test.js'), 'utf8');
  const bloc = src.slice(src.indexOf('async function observerInvitationInventaire'),
                         src.indexOf('function verifierInvitation'));
  assert.ok(/new URL\(url\)\.pathname/.test(bloc),
    'le motif doit se décider sur le CHEMIN, jamais sur l’URL complète');
});

epreuve('une carte VRAIMENT absente reste dénoncée, elle', () => {
  // Sans cette épreuve, la précédente pourrait être satisfaite par un code qui
  // ne dénonce plus jamais rien.
  const vue = { presente: false, etat: null, visible: false, texte: '', motif: 'carte absente du document' };
  const e = verifierInvitation(vue).join(' | ');
  assert.ok(/ABSENTE de l’accueil/.test(e), e);
  assert.strictEqual(indisponibiliteInvitation(vue), null,
    'une vraie absence n’est pas une indisponibilité : elle doit rester un ÉCHEC');
});

epreuve('aucune observation ne vaut pas conforme', () => {
  assert.ok(verifierInvitation(null).length > 0, 'null doit produire un refus');
});

console.log(`\n${passes}/${passes} vérifications passées — la recette juge la preuve, pas seulement le chiffre.`);
