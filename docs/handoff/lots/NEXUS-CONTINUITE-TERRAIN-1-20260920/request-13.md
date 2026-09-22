---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 13
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408 production=2bc7b39
  - id: rail-confirme
    classe: VERIFIED
    valeur: HEAD_b9ffd787_eq_rail_canonique_cite
  - id: ci-952
    classe: DECLARED
    valeur: non_reverifiable_reseau_bloque
  - id: pr62-identifiee
    classe: VERIFIED
    valeur: fdj-vague1-cycle-caisse-20260916_lien_c88b039
  - id: pr65-identifiee
    classe: VERIFIED
    valeur: reception-regularisation-20260919_commit_fa29fa4
  - id: pr62-divergence
    classe: VERIFIED
    valeur: 105_fichiers_+17319_-12858_vs_production
  - id: pr65-divergence
    classe: VERIFIED
    valeur: 80_fichiers_+1998_-11920_vs_production
  - id: reconstruction-62-65
    classe: NOT_APPLICABLE
    valeur: aucun_reseau_aucun_test_depuis_ce_canal
  - id: branches-en-rade-classees
    classe: VERIFIED
    valeur: 9_classees_0_restante_21-21_tests
  - id: regression
    classe: VERIFIED
    valeur: aucune_regression_9_echecs_connus
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Audit #62/#65, classement des 9 branches en rade — obstacle réseau confirmé pour la reconstruction

## 1. Ce qui a été vérifié avant tout

`HEAD` de ce checkout (`b9ffd787`) est exactement `origin/handoff-continuite-20260920` **et**
le « rail canonique observé » cité par le réveil. `node outils/handoff.js verifier` est
conforme avant toute écriture (31 lots, 10 avertissements, 6 dérogations — inchangé). Le lot
actif `NEXUS-CONTINUITE-TERRAIN-1-20260920` est `DECISION_CONSOMMEE` (`decision-12.md`,
`closes: false`) : rien à consommer, le lot reste ouvert, cette demande le poursuit.

Je n'ai pas pu re-vérifier moi-même le run CI `35729983375` (Tests #952) cité par le réveil :
`gh`, `git fetch` et tout accès réseau sortant sont refusés dans ce canal (`This command
requires approval`, aucun humain ne peut la donner dans un run automatisé) — obstacle
structurel identique à celui documenté dans tout ce fil depuis le 06/09/2026, toujours vrai
aujourd'hui, vérifié à nouveau ici (`git fetch origin`, `gh pr view 62` : refusés). Je prends
donc cette preuve comme **DECLARED** par l'Orchestrator, pas comme VERIFIED par moi.

## 2. PR #62 (FDJ) et #65 (Carburants) — identifiées et mesurées, pas reconstruites

Sans accès réseau, je ne peux pas ouvrir les PR elles-mêmes. J'ai identifié leurs branches par
git local (déjà présent dans ce checkout, aucun appel réseau nécessaire) :

- **#62** = `fdj-vague1-cycle-caisse-20260916`, confirmée par le lien littéral
  `https://github.com/vito-sainte-marie/nexus-vito/pull/62` ajouté au commit `c88b039`
  (« FDJ Vague 1 — le lien de la PR au point 3 du dossier »), et par `DOSSIER-FDJ-VAGUE1-20260917.md`
  qui se désigne lui-même comme documentant cette PR (25 points + point 26 de relecture).
- **#65** = `reception-regularisation-20260919`, confirmée par le commit `fa29fa4` qui nomme
  explicitement « la Régularisation d'une réception passée (#65) » et par le contenu du
  commit `fbf113b` de cette branche (« Réception carburant : une réception passée se
  régularise sans jamais prétendre avoir été saisie le jour même »).

**Divergence mesurée contre `origin/production` actuel (`git diff --stat`, réel, pas estimé) :**

| PR | Branche | Point de divergence (merge-base) | Fichiers | Insertions | Suppressions |
|---|---|---|---:|---:|---:|
| #62 FDJ | `fdj-vague1-cycle-caisse-20260916` | avant le 16/09 | 105 | +17 319 | −12 858 |
| #65 Carburants | `reception-regularisation-20260919` | `52cd4a4`, 18/09/2026 | 80 | +1 998 | −11 920 |

Les deux confirment le constat déjà écrit dans `request-1.md` de ce même lot le 20/09 :
« Ni #62 ni #65 n'offre de chemin sûr : les deux sont `CONFLICTING` ». Rien de nouveau ne les
rend plus sûres depuis — Production a continué d'avancer (34 commits sur #62, un nombre
comparable sur #65) pendant que les deux branches sont restées figées à leur point d'origine.

## 3. Pourquoi je n'ai pas reconstruit « le plus petit lot propre »

Le mandat demande un audit contre Production actuelle, puis une reconstruction sans
merge/rebase de l'ancienne PR. J'ai fait la première moitié (mesure ci-dessus) ; je n'ai pas
fait la seconde, pour deux raisons réelles et non contournables depuis ce canal, pas par
prudence excessive :

1. **Aucun accès réseau.** Reconstruire « le plus petit lot propre » suppose de lire l'état
   réel des deux PR sur GitHub (discussion, checks CI historiques, ce qui a déjà été discuté
   ou refusé) — je ne peux ouvrir ni #62 ni #65 par `gh`, et je ne peux pas non plus `git
   fetch` un rafraîchissement de `production`/`main` au-delà de ce que ce checkout porte déjà.
   Toute reconstruction faite ici travaillerait à l'aveugle sur ce point.
2. **L'échelle dépasse une seule exécution bornée, mesurée, pas supposée.** +17k/−13k lignes
   sur 105 fichiers (FDJ) et +2k/−12k sur 80 fichiers (Carburants) ne se relisent pas de façon
   fiable en une session : chaque lot précédent de ce fil qui a produit un correctif réel et
   prouvé (P0-1/P0-3, CARB-004, Guardian QA…) portait sur quelques fichiers, pas sur une
   refonte de cycle complet. Fabriquer ici un « candidat persistant déterministe » sur un
   périmètre de cette taille, sans pouvoir le faire tourner contre NEXUS Test (aucun accès
   Supabase Test non plus depuis ce canal, même obstacle constant depuis le 06/09), serait
   exactement le type de preuve non mesurée que ce protocole existe pour empêcher.

Aucune fusion, aucun rebase, aucun candidat partiel n'a donc été produit pour #62/#65. Ce
n'est pas un refus de principe : c'est un obstacle de moyens, documenté avec les mêmes preuves
(tests d'accès réseau réellement tentés, pas supposés refusés) que celles déjà versées au
registre pour d'autres lots de ce fil.

## 4. Ce qui EST réellement avancé : les 9 branches en rade, classées

`node outils/garde-branches-en-rade.js` (réglage par défaut, `config-par-environnement`)
signalait 17 branches ; réévalué contre le rail réellement canonique
(`NEXUS_BRANCHE_CANONIQUE=handoff-continuite-20260920`, puisque `config-par-environnement`
est un ancêtre direct — vérifié — donc une base plus stricte que nécessaire), il n'en restait
que **9** réellement non couvertes par le registre. Chacune a été inspectée individuellement
par git local (aucun réseau requis) :

- **7 classées `SUPERSEDEE`** — leur contenu est déjà présent au canonique, réappliqué par une
  voie différente (commit distinct, parfois reformulé) : `claude/issue-28-20260921-1051`,
  `-1534`, `-1749`, `-1756`, `claude/issue-28-20260922-0023`, `-0605`, `-1238`. Chacune vérifiée
  positivement, pas supposée équivalente : présence du symbole/texte attendu dans le fichier
  canonique réel (`dateLocaleStation`, `statutValidationQuart`, `RE_LECTURE_ETAT_MUTABLE`), ou
  request-N.md canonique au titre et au contenu identiques.
- **2 classées `A_REPRENDRE`**, renvoyées à une nouvelle entrée Backlog **`POINTAGE-001`** :
  `claude/issue-28-20260914-0247` et `-1045`. Elles portent un correctif Accueil réel, testé
  (`test_pointage_accueil_journee_terminee_20260914.js`, 20/20, témoin de mutation), pour le
  cas où les deux services d'une journée sont déjà clos. **Non intégré**, et surtout : le code
  canonique actuel (`NEXUS-App-v1.html` vers la ligne 2346) porte un commentaire daté qui
  affirme l'inverse pour ce même cas comme comportement voulu. Je n'ai PAS arbitré cette
  contradiction — la trancher exigerait de rejouer le scénario contre des données réelles ou
  une fixture fidèle, hors de portée de ce canal, et trancher à l'aveugle écraserait une
  décision déjà écrite sans l'avoir vérifiée. Backlog `A_ETUDIER`, pas appliqué.

`docs/handoff/BRANCHES-CLASSEES.json` et `docs/nexus/BACKLOG.md` mis à jour en conséquence.
Preuves réelles : `node test_garde_branches_en_rade_20260908.js` → 21/21 (dont l'épreuve
« le registre RÉEL du dépôt est exploitable de bout en bout », qui lit directement ces deux
fichiers) ; `node -e "...garde-branches-en-rade.controler()..."` contre le rail réel →
0 branche bloquante restante (contre 9 avant ce lot) ; `node outils/handoff.js verifier` →
conforme, 0 nouvelle erreur ; `node run-tests.js` → « Aucune régression : seuls les 9 échecs
connus subsistent ».

## 5. Classement des autres gates ouvertes (item 3 du réveil)

Sur la base du registre réel (`STATE.json`, `BACKLOG.md`, `BRANCHES-CLASSEES.json`) :

- **technique déterministe, avancée ici** : les 9 branches en rade (§4).
- **preuve manquante** : #62 et #65 (§2-3) — le blocage n'est pas une décision en attente,
  c'est une preuve (audit réseau + Test) qu'aucune session de ce canal ne peut produire.
- **gate Créateur** : POINTAGE-001 (§4) — contradiction entre un correctif non intégré et un
  commentaire canonique existant, à trancher par quelqu'un qui peut voir le comportement réel
  en Test/Production, pas par une lecture de code seule.
- **gate Production** : rien de nouveau ouvert par ce lot — B1, P0-2, et la promotion des
  candidats déjà mesurés restent fermés comme avant, inchangés ici.

Aucune des deux premières catégories n'a été avancée au-delà de ce que ce canal permet
réellement : le classement des 9 branches (déterministe, sans réseau) est fait ; #62/#65
(preuve manquante, réseau requis) ne pouvaient pas l'être davantage sans fabriquer une preuve.

## 6. Ce qui n'a pas été fait, explicitement

Aucun candidat #62/#65 construit. Aucune fusion, aucun rebase de l'une ou l'autre PR. Aucune
opération réseau (confirmée refusée, pas simplement non tentée). Aucune règle métier/UX
nouvelle. Aucun rôle/RLS touché. Aucune action Production/Supabase Production. Aucune
modification de `main`. `docs/handoff/en-attente/` ne conserve pas ce corps après publication.

## STOP

Ce lot reste ouvert (`closes: false` hérité de `decision-12.md`, rien ne le referme ici).
Reprise possible pour #62/#65 uniquement depuis une session disposant d'un accès réseau
GitHub réel (pour lire les PR elles-mêmes) et d'un accès Supabase Test (pour prouver tout
candidat reconstruit) — ni l'un ni l'autre disponible dans ce canal `issue_comment`.
