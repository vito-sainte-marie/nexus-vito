'use strict';
// Épreuve de l'étape connectée « enregistrement des prix SP/GO/GNR »
// (outils/recette-navigateur-test.js).
//
// POURQUOI CE TEST EXISTE
// L'étape qu'il éprouve a pour seul but de rougir quand l'écran Paramètres
// Station ne peut pas enregistrer les prix. Si son classement est faux, elle
// ne rougira pas — ou rougira tous les jours — et plus personne ne lira la
// recette. Ce qui doit être prouvé n'est donc pas « la fonction marche »
// mais :
//   1. un refus de contrainte NOT NULL est un ÉCHEC, jamais une indisponibilité ;
//   2. une absence d'horaires de quart est une INDISPONIBILITÉ, jamais un échec ;
//   3. un écran qui ne conclut pas rougit (sans quoi il ne rougirait jamais) ;
//   4. l'écouteur `page.on('dialog')` est CÂBLÉ — sans lui l'étape serait
//      verte à tort, le refus ne passant pas par le DOM ;
//   5. l'étape est effectivement BRANCHÉE dans `executer()`.
//
// Les 4 et 5 sont des preuves de CÂBLAGE, pas de fonction : chaque contrôle
// est un couple — la forme correcte qui doit passer, et la mutation minimale
// qui doit être refusée. Une mutation à la fois : deux mutations concurrentes
// dans le même bac ne mesurent rien.
//
// Ce test NE SE CONNECTE À AUCUNE BASE et n'ouvre aucun navigateur. Il ne
// remplace pas la recette connectée : il garantit que celle-ci dira la vérité.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const CHEMIN = path.join(RACINE, 'outils/recette-navigateur-test.js');
const recette = require(CHEMIN);
const SOURCE = fs.readFileSync(CHEMIN, 'utf8');

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// Le message exact mesuré sur nexus-test le 02/10/2026, jamais réécrit de
// mémoire (outils/epreuve-station-config-upsert-fuseau-horaire-23502-20261002.sql).
const REFUS_MESURE = 'Erreur — réessayez.\n\nDétail technique (à transmettre à NEXUS) : '
  + 'null value in column "fuseau_horaire" of relation "station_config" violates not-null constraint';
const ALERTE_HORAIRES_MESUREE = 'Horaires de quart non configurés pour ce commerce.\n\n'
  + 'NEXUS ne peut pas créer la configuration de ce site sans eux, et il ne reprendra pas '
  + 'ceux d’une autre station.';

const vue = (sur) => Object.assign({
  tente: true, motif: null, alertes: [], reecrit: 'identiques',
  note: true, statut: '', boutonDesactive: false, chemin: 'NEXUS-Parametres-Station-v1.html',
}, sur);

// --- 1. Le refus de contrainte est un échec -------------------------------
verifier('un refus NOT NULL rend PRIX-001', () => {
  const e = recette.verifierPrix(vue({ alertes: [REFUS_MESURE], note: false }));
  assert.strictEqual(e.length, 1, 'un seul échec attendu, obtenu : ' + JSON.stringify(e));
  assert.ok(/^PRIX-001/.test(e[0]), e[0]);
  assert.ok(/fuseau_horaire/.test(e[0]), 'l’échec doit NOMMER la colonne refusée : ' + e[0]);
  assert.ok(/Verify/.test(e[0]), 'l’échec doit dire ce qui est cassé en bout de chaîne');
});

verifier('un refus NOT NULL n’est JAMAIS rangé en indisponibilité', () => {
  // La faute à éviter : classer le défaut mesuré avec les états non jugeables.
  // Il survivrait alors derrière un « INDISPONIBLE » que personne ne traite.
  assert.strictEqual(recette.indisponibilitePrix(vue({ alertes: [REFUS_MESURE], note: false })), null);
});

verifier('le code SQLSTATE seul suffit (PostgREST peut ne rendre que lui)', () => {
  const e = recette.verifierPrix(vue({ alertes: ['Erreur — réessayez.\n\nDétail technique : 23502'], note: false }));
  assert.ok(e.length === 1 && /^PRIX-001/.test(e[0]), JSON.stringify(e));
});

// Contre-épreuve : sans le refus, le même état est vert. Sinon ce test ne
// prouverait pas que c'est bien l'alerte qui décide.
verifier('contre-épreuve — confirmation sans alerte : aucun échec', () => {
  assert.deepStrictEqual(recette.verifierPrix(vue({ alertes: [], note: true })), []);
  assert.strictEqual(recette.indisponibilitePrix(vue({ alertes: [], note: true })), null);
});

// --- 2. L'absence d'horaires est une indisponibilité ----------------------
verifier('l’alerte horaires ne rougit pas et se déclare indisponible', () => {
  const v = vue({ alertes: [ALERTE_HORAIRES_MESUREE], note: false });
  assert.deepStrictEqual(recette.verifierPrix(v), [],
    'un site de Test sans horaires rougirait tous les jours');
  const i = recette.indisponibilitePrix(v);
  assert.ok(i && /horaires/i.test(i), 'indisponibilité attendue, obtenu : ' + i);
  assert.ok(/AVANT l’upsert/.test(i), 'le motif doit dire POURQUOI le refus observé n’est pas le bon');
});

verifier('le bouton resté désactivé est mentionné, jamais compté comme échec', () => {
  const v = vue({ alertes: [ALERTE_HORAIRES_MESUREE], note: false, boutonDesactive: true });
  assert.deepStrictEqual(recette.verifierPrix(v), []);
  assert.ok(/défaut latent/.test(recette.indisponibilitePrix(v)));
});

verifier('une étape non tentée est non jugée, pas conforme', () => {
  const v = { tente: false, motif: 'redirigé vers NEXUS-Login-v1.html', alertes: [] };
  assert.deepStrictEqual(recette.verifierPrix(v), []);
  const i = recette.indisponibilitePrix(v);
  assert.ok(/NON JUG/.test(i) && /NEXUS-Login/.test(i), i);
  assert.ok(/Ne pas lire cette absence/.test(i), 'une absence de preuve doit se dire comme telle');
});

// --- 3. Un écran qui ne conclut pas rougit -------------------------------
verifier('ni confirmation ni erreur rend PRIX-004', () => {
  const e = recette.verifierPrix(vue({ alertes: [], note: false }));
  assert.ok(e.length === 1 && /^PRIX-004/.test(e[0]), JSON.stringify(e));
});

verifier('confirmation ET alerte rend PRIX-005 en plus du refus', () => {
  const e = recette.verifierPrix(vue({ alertes: [REFUS_MESURE], note: true }));
  assert.strictEqual(e.length, 2, JSON.stringify(e));
  assert.ok(/^PRIX-001/.test(e[0]) && /^PRIX-005/.test(e[1]), JSON.stringify(e));
});

verifier('un rejet de saisie valide rend PRIX-002, et n’est pas une indisponibilité', () => {
  const v = vue({ alertes: ['Renseignez les 3 nouveaux prix (SP, GO, GNR).'], note: false });
  const e = recette.verifierPrix(v);
  assert.ok(e.length === 1 && /^PRIX-002/.test(e[0]), JSON.stringify(e));
  assert.strictEqual(recette.indisponibilitePrix(v), null);
});

verifier('un refus non classé rend PRIX-003 plutôt que le silence', () => {
  const e = recette.verifierPrix(vue({ alertes: ['Erreur — réessayez.\n\nDétail technique : JWT expired'], note: false }));
  assert.ok(e.length === 1 && /^PRIX-003/.test(e[0]) && /JWT expired/.test(e[0]), JSON.stringify(e));
});

// --- Le détail technique survit au résumé --------------------------------
verifier('messageAlerte conserve le détail situé APRÈS le saut de ligne', () => {
  const m = recette.messageAlerte(REFUS_MESURE);
  assert.ok(/fuseau_horaire/.test(m), 'la cause est après le \\n : la garder est tout l’objet');
  assert.ok(!/\n/.test(m), 'le message doit tenir sur une ligne de rapport');
  // Mutation témoin : la forme naïve perd précisément la cause.
  assert.ok(!/fuseau_horaire/.test(REFUS_MESURE.split('\n')[0]));
});

// --- resumePrix est la seule source du résumé ----------------------------
verifier('resumePrix suit le verdict, l’indisponibilité et le cas d’écriture', () => {
  assert.ok(/^NON SATISFAITE/.test(recette.resumePrix(vue({ alertes: [REFUS_MESURE], note: false }))));
  assert.ok(/^NON JUG/.test(recette.resumePrix(vue({ alertes: [ALERTE_HORAIRES_MESUREE], note: false }))));
  const ok = recette.resumePrix(vue({ alertes: [], note: true, reecrit: 'identiques' }));
  assert.ok(/^satisfaite/.test(ok) && /identique/.test(ok), ok);
  const neufs = recette.resumePrix(vue({ alertes: [], note: true, reecrit: 'nouveaux' }));
  assert.ok(/valeurs de recette/.test(neufs), 'écrire des prix doit se DÉCLARER : ' + neufs);
});

// --- 4. CÂBLAGE de l'écouteur de dialogues -------------------------------
// Ce que ce couple mesure n'est pas « l'écouteur fonctionne » mais
// « l'écouteur est branché ». Le refus de l'écran passe par alert() : sans
// `page.on('dialog')`, aucune alerte n'est collectée, `alertes` reste vide,
// et PRIX-004 ou un faux vert prend la place du défaut réel.
const SRC_OBS = recette.observerEnregistrementPrix.toString();
const cable = (t) => /page\.on\(\s*'dialog'/.test(t) && /page\.off\(\s*'dialog'/.test(t);

verifier('témoin — l’observateur branche ET débranche page.on(\'dialog\')', () => {
  assert.ok(cable(SRC_OBS), 'sans écouteur de dialogue, l’étape est verte à tort');
});

verifier('contre-témoin — l’aide débranchée est détectée', () => {
  // On retire LE BLOC entier, pas un caractère : « débrancher l'aide ».
  const mute = SRC_OBS.split('\n').filter(l => !/page\.on\(\s*'dialog'/.test(l)).join('\n');
  assert.notStrictEqual(mute, SRC_OBS, 'la mutation doit porter : ligne introuvable');
  assert.strictEqual(cable(mute), false, 'le contrôle ne verrait pas l’écouteur manquant');
});

verifier('l’observateur ne jette jamais et rend un motif', () => {
  // Une étape qui jette fait tomber la recette entière : les observations
  // suivantes ne seraient jamais prises.
  assert.ok(/return nonJuge\(/.test(SRC_OBS), 'les sorties non jugeables doivent rendre un motif');
  assert.ok(!/throw /.test(SRC_OBS), 'l’observateur ne doit pas jeter');
});

// --- 4 bis. L'INTERRUPTION DU NAVIGATEUR EST UNE OBSERVATION -------------
// Mesuré le 02/10/2026, run 37077466591 : l'attente de visibilité d'un champ
// de prix a expiré — la carte vit dans l'accordéon `#secCarburants`, replié
// au chargement, donc le champ EXISTE et n'est pas VISIBLE. L'exception est
// remontée à travers un `try … finally` SANS rattrapage et la recette
// entière est morte sans publier un seul code PRIX-00x. Le contrôle
// ci-dessus ne voyait rien : il cherche un mot-clé d'exception dans la
// source, et une attente qui expire ne l'écrit pas. C'est l'angle mort
// d'un scan de mot-clé, et il se ferme par une mutation.
const OUTER_CATCH = /\n  \} catch \(\s*[A-Za-z_$][\w$]*\s*\)\s*\{([\s\S]*?)\n  \} finally \{/;

// Le rattrapage attendu est celui du PREMIER NIVEAU de la fonction — à la
// hauteur du `finally` qui débranche le dialogue, deux espaces d'indentation.
// Un motif plus lâche ne mord pas : mesuré: il attrapait le rattrapage
// INTERNE de l'analyse d'URL (plus profond), suivi plus loin d'un
// `return nonJuge(`, et passait VERT sur la recette d'avant correctif.
const rattrape = (t) => {
  const m = OUTER_CATCH.exec(t);
  return !!m && /return nonJuge\(/.test(m[1]);
};

verifier('témoin — une interruption du navigateur devient un motif non jugé', () => {
  assert.ok(rattrape(SRC_OBS),
    'une attente qui expire doit devenir un motif, pas la mort de la recette');
});

verifier('contre-témoin — le rattrapage retiré rougit le contrôle', () => {
  // On retire LE BLOC entier, pas un caractère : « débrancher l'aide ».
  const mute = SRC_OBS.replace(OUTER_CATCH, '\n  } finally {');
  assert.notStrictEqual(mute, SRC_OBS, 'la mutation doit porter : bloc de rattrapage introuvable');
  assert.strictEqual(rattrape(mute), false, 'le contrôle ne verrait pas le rattrapage manquant');
});

// --- 4 ter. DÉPLIER LA SECTION, ET MESURER LA VISIBILITÉ ------------------
const ANCRE_SECTION = '#secCarburants .psec-head';
const ANCRE_VISIBILITE = 'offsetParent !== null';

// Le contrôle est une FONCTION, pour qu'un contre-témoin puisse l'évaluer sur
// une source mutée. Un contre-témoin qui se contenterait de réaffirmer sa
// propre mutation ne mesurerait pas le contrôle, seulement lui-même.
const deplieEtVoitAvantDeSaisir = (t) => {
  const iOuvre = t.indexOf(ANCRE_SECTION);
  const iVoit = t.indexOf(ANCRE_VISIBILITE);
  const iSaisit = t.indexOf('.fill(');
  return iOuvre > 0 && iVoit > 0 && iSaisit > 0 && iOuvre < iSaisit && iVoit < iSaisit;
};

verifier('témoin — l’étape déplie « Carburants » et mesure la visibilité avant de saisir', () => {
  assert.ok(SRC_OBS.indexOf(ANCRE_SECTION) > 0,
    'la section « Carburants » doit être dépliée par son entête');
  assert.ok(SRC_OBS.indexOf(ANCRE_VISIBILITE) > 0,
    'la visibilité doit être mesurée, pas la seule présence dans le DOM');
  assert.ok(deplieEtVoitAvantDeSaisir(SRC_OBS),
    'déplier ou vérifier la visibilité APRÈS la saisie ne protège de rien');
});

verifier('contre-témoin — l’ouverture de la section retirée rougit le contrôle', () => {
  const mute = SRC_OBS.split('\n').filter(l => l.indexOf(ANCRE_SECTION) === -1).join('\n');
  assert.notStrictEqual(mute, SRC_OBS, 'la mutation doit porter : ouverture introuvable');
  assert.strictEqual(deplieEtVoitAvantDeSaisir(mute), false,
    'le contrôle ne verrait pas la section restée repliée');
});

verifier('contre-témoin — la mesure de visibilité retirée rougit le contrôle', () => {
  // C'est LE défaut du 02/10/2026 : la garde de présence restait verte pendant
  // que le champ était invisible. La retirer doit se voir.
  const mute = SRC_OBS.split('\n').filter(l => l.indexOf(ANCRE_VISIBILITE) === -1).join('\n');
  assert.notStrictEqual(mute, SRC_OBS, 'la mutation doit porter : mesure de visibilité introuvable');
  assert.strictEqual(deplieEtVoitAvantDeSaisir(mute), false,
    'le contrôle ne verrait pas une garde qui ne mesure que la présence');
});

// --- 5. CÂBLAGE dans executer() ------------------------------------------
verifier('témoin — l’étape est branchée dans executer() et pèse sur le verdict', () => {
  assert.ok(/const vuePrix = await observerEnregistrementPrix\(page, base\);/.test(SOURCE),
    'l’étape doit être appelée avec la session manager déjà ouverte');
  assert.ok(/echecs\.concat\(echecsPrix,/.test(SOURCE),
    'les échecs des prix doivent rejoindre les échecs rapportés');
  assert.ok(/echecs\.length \+ echecsPrix\.length/.test(SOURCE),
    'les échecs des prix doivent rendre la recette bloquante');
  assert.ok(/prixIndisponible/.test(SOURCE.match(/const indisponibilites = \[[^\]]*\]/)[0]),
    'l’indisponibilité des prix doit être rapportée');
  assert.ok(/resumePrix\(r\.prix\)/.test(SOURCE),
    'le rapport doit énumérer ce qui est prouvé ET ce qui ne l’est pas');
});

verifier('contre-témoin — une étape observée mais non comptée est détectée', () => {
  // La panne silencieuse la plus probable : appeler l'étape sans joindre ses
  // échecs au verdict. La recette serait verte avec le défaut sous les yeux.
  const mute = SOURCE.replace('echecs.concat(echecsPrix,', 'echecs.concat(');
  assert.notStrictEqual(mute, SOURCE, 'la mutation doit porter');
  assert.strictEqual(/echecs\.concat\(echecsPrix,/.test(mute), false);
});

verifier('l’écran visé est nommé une seule fois, par sa constante', () => {
  assert.strictEqual(recette.ECRAN_PARAMETRES_STATION, 'NEXUS-Parametres-Station-v1.html');
  assert.ok(fs.existsSync(path.join(RACINE, recette.ECRAN_PARAMETRES_STATION)),
    'la constante doit désigner un écran qui existe');
  const litteraux = (SOURCE.match(/'NEXUS-Parametres-Station-v1\.html'/g) || []).length;
  assert.strictEqual(litteraux, 1, 'un chemin recopié divergera : ' + litteraux + ' littéraux');
});

verifier('les prix de recette sont au format décimal français', () => {
  for (const [carburant, valeur] of Object.entries(recette.PRIX_DE_RECETTE)) {
    assert.ok(/^\d+,\d{3}$/.test(valeur), carburant + ' : ' + valeur
      + ' — un point décimal masquerait un défaut de numFR');
  }
});

console.log(`\n${passes} vérification(s) passée(s).`);
