---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908
seq: 3
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: doctrine-langage
    classe: VERIFIED
    valeur: docs/nexus/DOCTRINE-LANGAGE-VOCABULAIRE.md, 7 epreuves, 6 mutations detectees, cablee en CI
  - id: dette-renommage
    classe: VERIFIED
    valeur: 69 occurrences dans 29 fichiers de produit, epreuves exclues, suivie en LANG-004
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune operation Production ni Supabase Production
---
# La doctrine langage existe. Le renvoi de la Bible est-il souhaité ?

## Ce qui a été fait sur decision-2

Les deux lignes du §5.1 sont dans `docs/nexus/BIBLE.md`, section « Philosophie »,
sans reformulation. Chacune est rattachée à un mécanisme vivant, et
`test_bible_principes_mecanises_20260908.js` le vérifie en CI : une ligne de
doctrine que rien ne mécanise est une décoration.

La note de révision du §4.2 est en fin de `NEXUS-Constitution-v1.md`. Les
articles 12 et 13 ne sont PAS réécrits : réécrire un texte fondateur pour le
faire coïncider avec l'état présent efface la trace de la décision qui a changé
les choses. La dette de propagation qu'elle annonce est inscrite au Backlog
sous `LANG-004`, chiffrée à 69 occurrences dans 29 fichiers de produit.

Et `docs/nexus/DOCTRINE-LANGAGE-VOCABULAIRE.md` (§5.2) est écrit : les deux
agents et leur destinataire, le vocabulaire canonique et ce qu'il ne désigne
pas, le glossaire des états d'une mesure, le langage par destinataire, LANG-003
avec sa portée arbitrée, et les règles Guardian qui ne deviennent pas des
entrées `RULES.json` (§5.3 respecté).

Le document ne recopie AUCUNE liste vivant dans le code. `NexusVocab.SIGNATURE`
en reste le propriétaire unique : dupliquer ses termes créerait une seconde
source, et c'est toujours la copie qu'on oublie de mettre à jour. Sept épreuves
vérifient qu'il ne duplique rien, que chaque propriétaire désigné existe, que
les chiffres annoncés sont encore vrais, et qu'il s'applique à lui-même la règle
qu'il pose. Six mutations tentées et détectées.

Deux choses y sont dites plutôt que tues : « Couverture jusqu'à » et « Présence
réelle » sont prescrits mais n'existent nulle part dans le code, et la portée
retenue pour LANG-003 est plus ÉTROITE que celle du cadrage d'origine, qui
visait aussi la documentation active.

## La question soumise

La troisième proposition du §5.1 avait été écartée en decision-2 pour une raison
précise : elle renvoyait vers un document qui n'existait pas, et un renvoi vers
un fichier absent donne l'apparence d'une doctrine adossée à un texte.

Ce document existe désormais. La phrase de renvoi est-elle souhaitée dans
`BIBLE.md` ?

> Le vocabulaire officiel et le ton par destinataire sont définis dans `docs/nexus/DOCTRINE-LANGAGE-VOCABULAIRE.md`.

Elle n'est pas ajoutée d'office. Frédéric a validé « les deux lignes », pas
trois, et traiter la levée d'un obstacle comme une approbation fabriquerait un
accord qui n'a pas été donné.

## Retour attendu

Ajout ou non de cette phrase de renvoi. Restent ouverts par ailleurs :
`LANG-004`, et le chantier de réécriture des 1 481 occurrences de tiret
cadratin, dont l'aggravation est empêchée par le plafond par fichier.
