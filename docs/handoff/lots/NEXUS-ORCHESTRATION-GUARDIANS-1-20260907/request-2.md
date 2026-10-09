---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-ORCHESTRATION-GUARDIANS-1-20260907
seq: 2
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: guardians-crees
    classe: VERIFIED
    valeur: QA 14->1, Business Rules 8887->2, Bible 638->17 ; calibrations mesurees
  - id: defauts-produit
    classe: VERIFIED
    valeur: 5 defauts reels relus a la main, dont 0.0/5 affiche a un salarie
  - id: performance
    classe: VERIFIED
    valeur: Bible 55,3 s -> 0,75 s ; 17 findings identiques objet par objet
  - id: memoire
    classe: VERIFIED
    valeur: QA-002/003/004 promues, briefing-agent rend le texte a la virgule pres
  - id: gouvernance
    classe: HUMAN
    valeur: CLAUDE.md modifie sur autorisation explicite de Frederic
  - id: mutations
    classe: VERIFIED
    valeur: 26 tentees, 26 detectees
  - id: suite
    classe: VERIFIED
    valeur: 204/213, les 9 echecs historiques
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Request-2 — trois Guardians de plus, la mémoire servie, et une gouvernance modifiée

**Arbitrer CETTE demande, pas `request-1.md`.** `request-1.md` n'a jamais été
relayée à l'Orchestrator et son périmètre est entièrement repris ici. Cette
précision n'est pas de la forme : cet après-midi, un arbitrage rédigé pour
`request-1` d'un autre lot est devenu périmé avant d'être consommé parce qu'une
`request-2` avait été déposée entre-temps.

## 1) Ce que `request-1.md` portait, et qui tient toujours

Rapatriement sélectif des Guardians depuis `claude/issue-28-20260907-0028`,
fichier par fichier. La règle a servi immédiatement : `recette-navigateur-test.js`
existe sur le canon avec la vraie recette Playwright et n'a **pas** été repris
de la branche, qui n'en portait que le vérificateur de préconditions.

Le routeur rendait **13 findings, dont un seul réel** — `\s*=` matchait le
premier `=` de `===`, si bien qu'un fichier qui LIT une globale était rapporté
comme la DÉCLARANT. Après calibration : 13 → 1, la collision `NexusStock`.

`preflightHeadCanonique` embarquait sa propre implémentation d'ENV-001. Deux
vérités pour une règle : il délègue désormais à `outils/garde-env-001.js`.

Les huit critères de sortie de `decision-2.md` de REPAIR-1 sont couverts.

## 2) Trois Guardians créés — les deux tiers de la doctrine étaient vides

Sur les cinq Guardians de la doctrine, **trois n'avaient aucun code**. Ils en
ont maintenant.

| Guardian | calibration | findings restants |
|---|---|---|
| QA / Regression | 14 → 1 | 0 (le finding était dans notre code, corrigé) |
| Business Rules | 8 887 → 2 | 2 |
| Bible / UX Terrain | 638 → 17 | 17 |

Chaque calibration est **mesurée**, pas estimée : la variante naïve a été
exécutée en désactivant chaque filtre.

**Ce qu'ils ont trouvé sur le produit, dès leur premier run réel :**

- `NEXUS-Debug-v1.html:560` — un écart de caisse jamais mesuré vaut `0`,
  s'affiche « **+0 €** » et **se peint en vert** par
  `(ecart_total||0)===0 ? green : red`. L'absence de mesure se lit comme une
  conformité parfaite. Colonne vérifiée nullable au schéma.
- `NEXUS-Evaluation-Employe-v1.html:487-488` — une évaluation sans note
  affiche « **0.0 / 5** » et « **0 %** ». **Le salarié lit une sanction là où
  il n'y a pas de donnée.** C'est le finding qui touche un humain.
- `nexus-coach-fdj-moteur.js:85` — « conformes sur **0 %** de vos quarts » :
  un reproche fabriqué à partir d'une absence.
- `NEXUS-Parametres-Rappels-v1.html:608` — un **moteur carburant parallèle
  complet** dans un écran (`CAPACITE_CUVE`, `CAMION_CAPACITE = 36000`, calcul
  de moyenne propre) alors que le moteur exporte `MAXIMUM_CAMION_LITRES`.
  Littéralement la famille de défaut de CARB-004.
- `test_garde_env_001_20260907.js:69` — une assertion qui ne pouvait pas
  échouer, **dans notre propre code**. Corrigée.

Aucun de ces cinq défauts n'avait été vu par une relecture humaine ni par les
212 épreuves existantes.

Le Guardian Bible a d'abord été livré à **55 s** par balayage, avec un test qui
dépassait le budget de 30 s du lanceur — la suite passait de 9 à 10 échecs.
Cause mesurée au profileur : 99,6 % du temps dans une regex `[\s(]+$` ancrée en
fin de chaîne, appliquée par candidat à une copie du début du fichier, sur un
masque rempli de blancs. Le coût suivait la densité de blancs, pas la taille.
**55,3 s → 0,75 s**, et les 17 findings comparés objet par objet, pas en
comptant.

## 3) Câblage CI — trois régimes, délibérément différents

- `verifier-apprentissage` et **Guardian QA : BLOQUANTS.** Tous deux à zéro
  finding sur le canon ; tout rouge y sera une régression réelle.
- **Business Rules, Bible et le routeur : RAPPORTENT** sans arrêter la CI.
  Leurs findings sont des dettes pré-existantes qu'aucun lot en cours n'a le
  droit de corriger. Une garde rouge au premier run se fait retirer, et emporte
  avec elle tout ce qu'elle aurait trouvé ensuite.
- **Leurs épreuves restent bloquantes** : une garde peut se taire, elle ne peut
  pas mentir sans qu'on le voie.

## 4) La mémoire est désormais servie, plus retapée

Trois agents ont bien travaillé aujourd'hui parce que leurs consignes
contenaient, **recopiées à la main**, les leçons de la journée. L'un d'eux a
appliqué « mesure avant d'agir sur une hypothèse » à une hypothèse de Claude,
l'a mesurée à 0,0 % du profil, et a évité d'optimiser le mauvais endroit.

Ces leçons vivaient déjà dans `RULES.json` ; personne ne les lisait au
démarrage. Trois leçons promues conformément à **GOV-002** :

- **QA-002** — un détecteur se calibre sur le vrai dépôt avant d'être câblé
  (cinq occurrences : 78→48, 13→1, 8887→2, 638→17, 14→1) ;
- **QA-003** — une mutation doit être prouvée appliquée avant que son résultat
  soit lu, une hypothèse mesurée avant qu'on agisse dessus ;
- **QA-004** — une assertion doit pouvoir échouer (mécanisée par guardian-qa).

`outils/briefing-agent.js` les rend, filtrables par portée, **texte à la
virgule près** : paraphraser créerait une seconde vérité dont la divergence
passerait inaperçue. Fail-closed : un `RULES.json` illisible produit un briefing
« INDISPONIBLE » et sort en 1, plutôt qu'une page d'apparence complète qui
ferait conclure à un agent qu'il n'y a pas de règle.

## 5) Changement de gouvernance à déclarer

`CLAUDE.md` a été modifié **sur autorisation humaine explicite de Frédéric**
(« applique les pré-autorisations »). Il décrivait encore le protocole v1 et
n'orientait pas vers les commandes de l'outil — origine directe des quatre
écarts d'enveloppe.

Claude décide désormais seul : alimenter la base de recette Test ; déroger à un
défaut de **forme** d'enveloppe déjà publiée, sans jamais réécrire le fichier ;
créer et câbler outils, gardes et épreuves ; lancer la recette ; publier et
consommer par l'outil.

Les gates humaines sont **élargies**, pas réduites : s'y ajoutent la lecture ou
rotation d'un secret, et toute dépendance ou harnais tiers élargissant la
surface de sécurité.

Motif : le 07/09, Frédéric a servi de facteur dans six arbitrages et cinq
questions, dont trois portaient sur des cas déjà tranchés par la doctrine.

## 6) Preuves

Suite **204/213**, exactement les 9 échecs historiques. Registre Handoff
conforme (27 lots). Apprentissage conforme (16 règles). `main` `10c65d0`,
`production` `501c0c7` inchangées. Mutations sur ce lot : **26 tentées, 26
détectées**, chacune vérifiant que le source a réellement changé avant de
conclure.

## 7) Limites honnêtes

1. Le Guardian Bible classe 586 replis « hors affichage » et se tait : il ne
   suit pas le flot de données. De vrais défauts s'y cachent certainement.
2. Le Guardian Business Rules ne voit que les constantes MAJUSCULES littérales
   d'un moteur. `const pasArrondi = 1000`, au cœur de CARB-004, lui échappe.
3. Le Guardian QA ne voit pas une assertion juste sur la mauvaise chose, ni une
   épreuve neutralisée par un `return` précoce.
4. Deux principes de l'ADN — « un conseiller, pas un tableau de bord » et
   « conçu sur le terrain » — restent sans contrôle : ils se jugent, ils ne se
   détectent pas.
5. `outils/reveil-handoff.js` reste **sans déclencheur** (ORCH-001).

## 8) Production

`NOT_APPLICABLE` — aucune requête, aucun merge, aucun déploiement.

## Questions à arbitrer

**Q73 — Activer le routeur et les deux gardes en bloquant ?** Recommandation :
**pas avant** que leurs dettes soient tranchées. Bloquer d'abord les ferait
retirer.

**Q74 — Ouvrir un lot pour les défauts trouvés ?** Ils touchent le produit, pas
l'outillage. Recommandation : **oui, et par ordre de gravité humaine** — le
« 0.0 / 5 » affiché à un salarié d'abord, l'écart vert ensuite, le moteur
carburant parallèle enfin.

**Q75 — Le relecteur de philosophie ?** Les deux principes non mécanisables
demanderaient un agent qui juge. Recommandation : **consultatif, jamais
bloquant**, et hors CI tant qu'il suppose un appel modèle.

**Q76 — Un lot purement outillage/QA peut-il s'arbitrer a posteriori ?** Sans
métier, sans secret, sans Production, sans `main`. Les six lots du 07/09
auraient tenu en deux arbitrages. C'est la principale source de perte de temps
de Frédéric, et la seule que les pré-autorisations n'attaquent pas.
Recommandation : **oui, avec les quatre conditions ci-dessus comme définition
stricte** — et retour au régime normal dès qu'une seule tombe.
