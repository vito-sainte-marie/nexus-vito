// Épreuve — cause isolée du pointage d'arrivée « non franchi » dans la
// recette employé (outils/recette-navigateur-test.js).
//
// CONTEXTE. Trois commits successifs le 09/09/2026 au soir ont ajouté le
// franchissement du pointage (fceaa13), constaté qu'il ne suffisait pas
// (cc6c9ae) puis instrumenté sans corriger (28bcfb8, « CAUSE NON ISOLÉE »).
// Cette épreuve documente la cause réellement isolée et prouve le correctif.
//
// LA CAUSE. `station_config.pointage_actif` a été mis à `false` pour
// `nexus-station-test` le 07/09/2026 (autorisation Frédéric, pour simplifier
// la navigation des trois profils de recette). `NEXUS-Pointage-v1.html:507`
// affiche alors un verrou défensif — « Le pointage est désactivé sur ce
// site. » — au lieu du formulaire, et `#photoInput-arrivee` n'est jamais
// rendu : exactement le symptôme « champ photo d'arrivée absent » observé.
//
// CLASSIFICATION. Ni un défaut de release (le verrou est un comportement
// voulu, demandé par Frédéric le 16/08/2026), ni une simple absence de
// caméra (déjà traitée par le repli champ fichier) : un défaut de
// FIXTURE/RECETTE — le scénario employé ne savait pas reconnaître une
// dispense légitime et attendait en vain un champ qui ne devait pas exister.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const OUTIL = path.join(__dirname, 'outils', 'recette-navigateur-test.js');
const { pointageDesactive } = require(OUTIL);

let passes = 0;
function epreuve(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

epreuve('le texte réel du verrou de NEXUS-Pointage-v1.html est reconnu', () => {
  // Extrait tel quel de l'écran, pas recopié à la main : si le libellé change
  // dans l'écran sans que cette épreuve soit mise à jour, elle doit échouer —
  // pas continuer à comparer une phrase qui n'existe plus.
  const ecran = fs.readFileSync(path.join(__dirname, 'NEXUS-Pointage-v1.html'), 'utf8');
  const m = ecran.match(/pointage_actif === false\) \{[\s\S]{0,400}?<div class="locked">([^<]+)</);
  assert.ok(m, 'le verrou "pointage désactivé" doit exister dans l’écran — sinon cette épreuve ne prouve rien');
  assert.ok(pointageDesactive(m[1]),
    `le libellé réel de l’écran (« ${m[1]} ») doit être reconnu par pointageDesactive`);
});

epreuve('un écran normal (formulaire de pointage) n’est pas confondu avec le verrou', () => {
  assert.strictEqual(pointageDesactive('Pointer ma journée ⏱ Votre journée Arrivée Pause…'), false);
});

epreuve('une observation vide ou absente ne fait jamais planter la détection', () => {
  assert.strictEqual(pointageDesactive(''), false);
  assert.strictEqual(pointageDesactive(undefined), false);
  assert.strictEqual(pointageDesactive(null), false);
});

epreuve('franchirPointageArrivee vérifie le verrou AVANT d’attendre #photoInput-arrivee', () => {
  // Défaut d’origine (09/09/2026) : la fonction attendait `#photoInput-arrivee`
  // (jusqu’à 20 s) sans jamais regarder si le site avait désactivé le
  // pointage — elle concluait alors « champ absent », un faux défaut. Le
  // contrôle doit apparaître, dans le corps de la fonction, AVANT la
  // recherche du champ, sinon le correctif ne protège rien.
  const src = fs.readFileSync(OUTIL, 'utf8');
  const debut = src.indexOf('async function franchirPointageArrivee');
  const fin = src.indexOf('const ECRAN_ACCUEIL');
  assert.ok(debut > -1 && fin > debut, 'franchirPointageArrivee doit exister dans le fichier');
  const bloc = src.slice(debut, fin);

  const idxVerrou = bloc.indexOf('pointageDesactive(');
  const idxChamp = bloc.indexOf("locator('#photoInput-arrivee')");
  assert.ok(idxVerrou > -1, 'franchirPointageArrivee doit consulter pointageDesactive');
  assert.ok(idxChamp > -1, 'franchirPointageArrivee doit toujours chercher #photoInput-arrivee dans le cas normal');
  assert.ok(idxVerrou < idxChamp,
    'la vérification du verrou doit précéder l’attente du champ — sinon on retombe dans le défaut du 09/09');

  // Mutation négative : le défaut d’origine (aucune détection du verrou)
  // rejoué contre cette même épreuve doit être détecté — sans quoi l’épreuve
  // ne fait que confirmer sa propre existence.
  const blocMuté = bloc.replace(/const texteVerrou[\s\S]*?desactive: true \};\n\s*\}\n\n\s*/, '');
  assert.ok(!blocMuté.includes('pointageDesactive('),
    'la mutation de contrôle devait retirer la vérification, pour prouver que l’épreuve la détecte réellement');
});

epreuve('un pointage franchi normalement n’est jamais marqué "desactive"', () => {
  // Rappel de contrat : `desactive: true` ne doit apparaître QUE dans la
  // branche de détection du verrou — jamais dans le succès ordinaire après
  // dépôt de la photo (sinon le rapport confondrait les deux preuves).
  const src = fs.readFileSync(OUTIL, 'utf8');
  const bloc = src.slice(src.indexOf('async function franchirPointageArrivee'), src.indexOf('const ECRAN_ACCUEIL'));
  const occurrences = (bloc.match(/desactive: true/g) || []).length;
  assert.strictEqual(occurrences, 1,
    '"desactive: true" ne doit apparaître qu’une seule fois — dans la branche du verrou détecté, pas dans le succès normal');
});

epreuve('le rapport imprimé distingue "non requis" de "franchi avec succès"', () => {
  // Sans cette distinction, "oui" pourrait vouloir dire "la recette a
  // vraiment déposé une photo" ou "il n'y avait rien à faire" — deux preuves
  // différentes, qui ne doivent pas se lire pareil dans le rapport que
  // Frédéric consulte.
  const src = fs.readFileSync(OUTIL, 'utf8');
  const bloc = src.slice(src.indexOf('Pointage d’arrivée franchi par la recette'), src.indexOf('Invitation à l’inventaire sur l’accueil'));
  assert.ok(/e\.pointage\.desactive/.test(bloc),
    'le rapport doit distinguer le cas "pointage désactivé" du cas "franchi avec succès"');
});

console.log(`\n${passes}/${passes} vérifications passées — cause isolée : défaut de fixture/recette, pas de release.`);
