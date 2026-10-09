---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908
seq: 2
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: lang-003-cablee
    classe: VERIFIED
    valeur: outils/garde-langage-nexus.js, 14 epreuves, 8 mutations detectees, CI bloquante, 0 signalement
  - id: mesure-portee-1
    classe: VERIFIED
    valeur: 1481 chaines affichees sur 124 fichiers, commentaires HTML et JS retires
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune operation Production ni Supabase Production
---
# LANG-003 est câblée. Les deux ajouts Bible du §5.1 sont-ils adoptés ?

## Ce qui a été fait sur decision-1

La portée 1 arbitrée le 08/09/2026 est appliquée, dans l'ordre exact que la
décision imposait.

**Mesuré avant d'être câblé (QA-002).** Première mesure : 1 485 occurrences.
Elle était FAUSSE — elle retirait les commentaires JavaScript mais pas les
commentaires HTML, or les écrans en portent d'énormes en tête de fichier. Deux
cents occurrences accusées vivaient dans des blocs que personne n'affiche.
Mesure corrigée : **1 481 chaînes réellement affichées**, dont 191 tirets seuls
tenant lieu de valeur absente, réparties sur 124 fichiers.

**La garde n'exige donc pas zéro.** Exiger « aucun tiret » aurait produit 1 481
signalements au premier run, et QA-002 dit la suite. `outils/garde-langage-nexus.js`
pose un plafond PAR FICHIER et refuse qu'il monte : la règle est vraie
immédiatement pour tout ce que NEXUS écrira, sans exiger la réécriture préalable
de 1 481 phrases. Le plafond ne peut que DESCENDRE — un plafond laissé au-dessus
de la mesure autoriserait à réintroduire en silence. Un fichier neuf part de
zéro : le plafond est une dette constatée, pas un budget distribué.

Elle est **bloquante** en CI, contrairement aux Guardians consultatifs, parce
qu'elle est arbitrée et calibrée à 0 signalement. Premières corrections dans
`nexus-vocabulaire.js`, l'endroit le plus emblématique.

## La question soumise

Les deux lignes proposées en `§5.1` de
`docs/nexus/AUDIT-PHILOSOPHIE-LANGAGE-RESULTATS-20260908.md` sont-elles
adoptées dans la section « Philosophie » de `docs/nexus/BIBLE.md` ?

> - Une donnée absente n'est jamais transformée en zéro, conformité ou conclusion positive ; une donnée réellement mesurée à zéro reste dite comme telle.
> - Une décision humaine sensible envers un individu (évaluation, sanction, jugement de performance) n'est jamais déduite automatiquement d'une absence de donnée.

Ces deux principes sont déjà vrais en pratique. Ils ne sont pas écrits. C'est
l'écart entre les deux qu'une Bible sert à fermer.

La troisième proposition du même `§5.1` — un renvoi vers
`docs/nexus/DOCTRINE-LANGAGE-VOCABULAIRE.md` — n'est PAS soumise ici : ce
document n'existe pas encore (`§5.2`, non traité), et un renvoi vers un fichier
absent donnerait l'apparence d'une doctrine adossée à un texte.

## Pourquoi ce serait vérifiable et non décoratif

Une ligne de doctrine que rien ne mécanise se met à mentir le jour où le code
s'en écarte, sans que personne ne le voie. Chaque ligne serait donc rattachée à
un mécanisme vivant, et `test_bible_principes_mecanises_20260908.js` le
vérifierait en CI : `nexus-mesure.js` et `outils/guardian-bible.js` pour la
première, `nexus-evaluation-affichage.js` (EVAL-001) pour la seconde — laquelle
continue d'afficher un zéro RÉELLEMENT mesuré, car taire une mauvaise note
serait l'erreur symétrique.

## Retour attendu

Adoption ou non des deux lignes. Restent ouverts par ailleurs : `§4.2` (note de
révision Constitution), `§5.2` (document de doctrine langage), et le chantier de
réécriture des 1 481 occurrences, dont l'aggravation est désormais empêchée.
