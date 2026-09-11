---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908
seq: 2
author: Frédéric Bragance
branch: config-par-environnement
decision: APPROVED
closes: false
in_reply_to: request-2.md
---
# Bible — les deux principes du §5.1 sont adoptés

## Ce qui est tranché

Frédéric Bragance fait ajouter à la section « Philosophie » de
`docs/nexus/BIBLE.md` les deux lignes proposées en `§5.1` de
`docs/nexus/AUDIT-PHILOSOPHIE-LANGAGE-RESULTATS-20260908.md`, sans
reformulation :

> - Une donnée absente n'est jamais transformée en zéro, conformité ou conclusion positive ; une donnée réellement mesurée à zéro reste dite comme telle.
> - Une décision humaine sensible envers un individu (évaluation, sanction, jugement de performance) n'est jamais déduite automatiquement d'une absence de donnée.

Ces deux principes étaient déjà vrais en pratique. Ils n'étaient pas écrits.
L'écart entre les deux est précisément ce qu'une Bible sert à fermer.

## Ce qui N'EST PAS adopté ici

La troisième proposition du même `§5.1` — une phrase de renvoi vers
`docs/nexus/DOCTRINE-LANGAGE-VOCABULAIRE.md` — n'est PAS appliquée. Ce document
n'existe pas encore (`§5.2`, non traité). Un renvoi vers un fichier absent ne
documente rien : il donne l'apparence d'une doctrine adossée à un texte, et
c'est exactement le genre de vide qu'une lecture rapide ne voit pas.

Elle reste ouverte, et redeviendra pertinente le jour où `§5.2` sera traité.

## Pourquoi ces lignes ne sont pas des vœux

Une ligne de doctrine que rien ne mécanise est une décoration. Chacune est donc
rattachée à un mécanisme vivant, et une épreuve le vérifie
(`test_bible_principes_mecanises_20260908.js`, câblée en CI) :

- « absence ≠ zéro » : `nexus-mesure.js` est le propriétaire unique de la
  distinction, et `outils/guardian-bible.js` surveille les replis silencieux
  vers zéro sur des montants affichés (9 signalements ouverts au 08/09/2026).
- « aucun jugement déduit d'une absence » : `nexus-evaluation-affichage.js`
  (EVAL-001) refuse de rendre un verdict faute de mesure — tout en continuant
  d'afficher un zéro RÉELLEMENT mesuré, car taire une mauvaise note serait
  l'erreur symétrique.

L'épreuve échoue si l'une des lignes disparaît, si le Guardian Bible sort de la
CI, ou si l'un des deux mécanismes cesse de tenir sa promesse. Les cinq
mutations correspondantes ont été tentées et détectées.

## Ce que ce lot laisse ouvert

`§4.2` (note de révision de `NEXUS-Constitution-v1.md` Art.12/13), `§5.2` (le
document de doctrine langage), et le chantier de réécriture des 1 481
occurrences de tiret cadratin dans le contenu affiché, dont le plafond par
fichier posé en 4dfc883 empêche désormais l'aggravation.
