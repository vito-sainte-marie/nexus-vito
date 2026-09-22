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
    valeur: reception-regularisation-20260919_commit_fbf113b_correction_citation
  - id: pr62-divergence
    classe: VERIFIED
    valeur: 105_fichiers_+17319_-12858_vs_production
  - id: pr65-divergence
    classe: VERIFIED
    valeur: 80_fichiers_+1998_-11920_vs_production
  - id: reconstruction-62-65
    classe: NOT_APPLICABLE
    valeur: aucun_reseau_aucun_test_depuis_ce_canal
  - id: branches-en-rade-rattrapees
    classe: VERIFIED
    valeur: 8_classees_3_laissees_ouvertes_21-21_tests
  - id: regression
    classe: VERIFIED
    valeur: handoff_verifier_conforme_0_nouvelle_erreur
  - id: gate-roles-remontee
    classe: DECLARED
    valeur: sujet_B1_Audrey_1530_ni_execute_ni_classe
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Audit #62/#65 confirmé, une citation corrigée, registre des branches en rade rattrapé

## 1. Ce qui a été vérifié avant tout

`HEAD` de ce checkout (`b9ffd787`) est exactement `origin/handoff-continuite-20260920` **et** le
« rail canonique vérifié » cité par le réveil. `node outils/handoff.js verifier` est conforme
avant toute écriture (31 lots, 10 avertissements, 6 dérogations). Le lot actif
`NEXUS-CONTINUITE-TERRAIN-1-20260920` est `DECISION_CONSOMMEE` (`decision-12.md`,
`closes: false`) : rien à consommer, le lot reste ouvert, cette demande le poursuit.

Je n'ai pas pu re-vérifier moi-même le run CI `35729983375` (Tests #952) : `gh`, `git fetch` et
tout accès réseau sortant restent refusés dans ce canal (`This command requires approval`,
aucun humain ne peut la donner dans un run automatisé) — obstacle structurel documenté dans ce
fil depuis le 06/09/2026, encore vrai aujourd'hui, revérifié ici (`git fetch origin --dry-run`,
`gh pr view 62` : tous deux refusés). Cette preuve reste **DECLARED** par l'Orchestrator, pas
VERIFIED par moi.

## 2. Un travail préparé aujourd'hui n'avait jamais rejoint le rail

Avant de refaire l'audit, j'ai trouvé qu'une session de ce même jour
(`claude/issue-28-20260922-1400`, commit `00f4be7`) avait déjà produit exactement ce travail —
identification #62/#65, mesure de divergence, classement de 9 branches en rade, un
`request-13.md` prêt — mais jamais intégré à `handoff-continuite-20260920` : la garde
`outils/garde-branches-en-rade.js`, réexécutée ici, signale onze branches en rade, pas neuf,
parce que `1400` (et une seconde branche `1530`, postérieure) n'avaient pas encore été classées
en tant que telles.

**Reproduit indépendamment, pas recopié** : mesures identiques bit à bit (voir §3). **Une
correction** : `request-13` de `1400` citait `fa29fa4` comme le commit nommant explicitement
« la Régularisation d'une réception passée (#65) ». Vérifié : `fa29fa4` porte en réalité
« Empreinte : re-mesurée à 269, pas déduite de 268 » — sujet sans rapport. Le vrai commit qui
nomme le sujet est `fbf113b` (« Réception carburant : une réception passée se régularise sans
jamais prétendre avoir été saisie le jour même »), déjà cité en second dans `1400` mais mal
présenté comme confirmation secondaire d'un lien que `fa29fa4` ne porte pas. L'identification de
la branche reste donc fondée sur `fbf113b` et la correspondance thématique du nom de branche —
pas sur une citation numérique littérale « (#65) », qu'aucun commit de cette branche ne porte
(vérifié par recherche exhaustive sur son historique).

## 3. PR #62 (FDJ) et #65 (Carburants) — identifiées et mesurées, pas reconstruites

Sans accès réseau, je ne peux pas ouvrir les PR elles-mêmes ; l'identification reste une
inférence par nom de branche et contenu thématique, pas une lecture GitHub :

- **#62 (FDJ)** = `fdj-vague1-cycle-caisse-20260916`, confirmée par le lien littéral
  `https://github.com/vito-sainte-marie/nexus-vito/pull/62` ajouté au commit `c88b039`
  (« FDJ Vague 1 — le lien de la PR au point 3 du dossier ») et par
  `DOSSIER-FDJ-VAGUE1-20260917.md`, qui se désigne lui-même comme documentant cette PR.
- **#65 (Carburants)** = `reception-regularisation-20260919`, confirmée par le contenu du
  commit `fbf113b` de cette branche (voir §2) et par la correspondance exacte avec les « trois
  temporalités » citées par le réveil (livraison réelle / relevé terrain / saisie-régularisation
  NEXUS).

**Divergence mesurée contre `origin/production` actuel (`git diff --stat`, réel) — reproduite à
l'identique de `1400` :**

| PR | Branche | Fichiers | Insertions | Suppressions |
|---|---|---:|---:|---:|
| #62 FDJ | `fdj-vague1-cycle-caisse-20260916` | 105 | +17 319 | −12 858 |
| #65 Carburants | `reception-regularisation-20260919` | 80 | +1 998 | −11 920 |

`origin/production` a continué d'avancer sur son propre rail (`2bc7b39`, « Continuité terrain —
P0-1/P0-3 », ratifiée par `decision-12.md`) pendant que les deux branches restent figées à leur
point d'origine. Le constat de `request-1.md` de ce même lot (20/09) tient toujours : ni #62 ni
#65 n'offre de chemin de fusion sûr.

## 4. Pourquoi aucune reconstruction n'est produite

Le mandat demande une reconstruction minimale depuis Production, avec un candidat persistant
**seulement si déterministe**. Ce n'est pas le cas ici, pour deux raisons réelles :

1. **Aucun accès réseau.** Reconstruire « le plus petit lot propre » suppose de lire l'état réel
   des deux PR (discussion, CI historique, ce qui a déjà été refusé) — impossible depuis ce
   canal, vérifié à nouveau aujourd'hui.
2. **L'échelle dépasse une exécution bornée et mesurée.** +17k/−13k lignes sur 105 fichiers
   (FDJ) et +2k/−12k sur 80 fichiers (Carburants) ne se relisent pas de façon fiable en une
   session, et aucun accès Supabase Test n'est disponible depuis ce canal pour prouver quoi que
   ce soit qui en sortirait. Produire ici un « candidat persistant déterministe » sur un
   périmètre de cette taille, sans preuve Test, serait le type même de preuve non mesurée que ce
   protocole existe pour empêcher.

Aucune fusion, aucun rebase, aucun candidat partiel n'a donc été produit pour #62/#65. Les
entrées Backlog déjà ouvertes et directement issues de ces deux PR (`FDJ-001`, `FDJ-002`,
`FDJ-003`, `CARB-004`, `CARB-005`, `CARB-006`, toutes `PRET_POUR_DEV`) restent le chemin de
reprise : périmètre borné, testable sans reconstruction complète.

## 5. Registre des branches en rade — rattrapé

`node outils/garde-branches-en-rade.js` (rail `handoff-continuite-20260920`) signalait
**onze** branches non couvertes par le registre (neuf du classement `1400`, plus `1400`
elle-même et `1530`, postérieure). Chacune vérifiée individuellement par git local :

- **8 classées `SUPERSEDEE`** (les 7 déjà identifiées par `1400`, revérifiées indépendamment
  par diff `--stat` et non recopiées sur parole, plus `1400` elle-même, dont le contenu utile
  est repris dans cette demande) : `claude/issue-28-20260921-1051`, `-1534`, `-1749`, `-1756`,
  `claude/issue-28-20260922-0023`, `-0605`, `-1238`, `-1400`.
- **3 laissées EN RADE, volontairement non classées** : `claude/issue-28-20260914-0247`,
  `claude/issue-28-20260914-1045` et `claude/issue-28-20260922-1530`. `1400` proposait de
  classer les deux premières `A_REPRENDRE` → `POINTAGE-001`. Je ne reprends pas cette
  proposition telle quelle : `1045` va plus loin que `0247` (elle enveloppe le même correctif
  — « L'accueil confondait journée pas commencée et journée déjà terminée » — dans un lot
  Handoff complet, `NEXUS-POINTAGE-CORRECTIF-1-20260911`, avec décision et consommation), **et
  ce lot est DÉJÀ `DECISION_CONSOMMEE` au registre canonique** (`decision-1.md`, commit
  `d0d9ea7`, ancêtre confirmé du HEAD actuel). Mais la décision consommée porte sur trois
  défauts Pointage précis datés du 11-13/09 (départ inatteignable sans pause, file hors ligne,
  portée journée/service) — pas explicitement sur « journée pas commencée vs déjà terminée ».
  Le commit `894e306`, commun à `1045` ET à `1530`, montre que ce fil de travail s'est ensuite
  poursuivi sur `1530` (checkout stale, 9+ jours, jamais réintégré), qui ajoute une preuve
  terrain « les six mesures sont rejouées » et prépare pour finir des corps de demande pour un
  **nouveau sujet distinct : rôles Audrey/Lydie/Yannick/Angélique (« B1 preuve terrain »)**.
  Trancher si le correctif « journée pas commencée/terminée » est déjà couvert par
  `NEXUS-POINTAGE-CORRECTIF-1-20260911` ou reste un résidu distinct demande de rejouer le
  scénario réel, hors de portée de ce canal — je ne le fais pas à l'aveugle.

**STOP explicite sur ce point, conformément au mandat** : le sujet réellement nouveau porté par
`1530` touche les rôles (`sécurité/rôles`), une des conditions d'arrêt du réveil. Je ne l'ai ni
exécuté ni classé. `docs/handoff/BRANCHES-CLASSEES.json` n'est donc PAS complet — la garde
continue de signaler ces trois branches, intentionnellement, jusqu'à décision.

Preuves : `node test_garde_branches_en_rade_20260908.js` → 21/21 ; contrôle direct
(`garde-branches-en-rade.controler()`) contre le rail réel → 3 branches EN_RADE restantes
(contre 11 avant ce lot), exactement les trois laissées volontairement ouvertes ;
`node outils/handoff.js verifier` → conforme, 0 nouvelle erreur, mêmes 10 avertissements.

## 6. Classement des autres gates ouvertes (item 3 du réveil)

Sur la base du registre réel (`STATE.json`, `BACKLOG.md`, `BRANCHES-CLASSEES.json`) :

- **technique déterministe, avancée ici** : rattrapage du registre des branches (§5).
- **preuve manquante, pas une décision en attente** : #62 et #65 (§3-4) — reconstruction hors
  de portée de ce canal (réseau + Test).
- **gate Créateur (rôles), nouvelle, non exécutée** : le sujet B1/Audrey porté par `1530` (§5).
- **techniques déterministes déjà ouvertes, non reprises dans CE lot** (périmètre progressif,
  pas de big-bang) : `ARCH-002` (collision `NexusStock`), `ARCH-004`/`ARCH-005` (propriété CIN,
  Data Dictionary), `ARCH-006` (factorisation résolution connexion Test), `QA-007` (motifs des
  9 échecs tolérés), `GOV-006` (rail de fusion vs réapplication à la main), `ORCH-001` (réveil
  autonome sans toucher `main`), `SEC-017` (policies `TO PUBLIC`), `LIVE-001` (contrainte
  `actor_role`), et les trois FDJ/trois CARB déjà cités en §4. Aucun n'a été touché ici : chacun
  mérite sa propre mesure avant modification (règle d'architecture progressive du réveil), et
  le temps de cette session est allé à fermer l'angle mort réel trouvé en §2 plutôt qu'à ouvrir
  un nouveau chantier.
- **gate Production** : rien de nouveau ouvert par ce lot.

## 7. Ce qui n'a pas été fait, explicitement

Aucun candidat #62/#65 construit. Aucune fusion, aucun rebase. Aucune opération réseau
(confirmée refusée, pas simplement non tentée). Aucune règle métier/UX nouvelle tranchée. Le
sujet rôles porté par `1530` n'a été ni exécuté ni classé — remonté, pas résolu. Aucun rôle/RLS
touché. Aucune action Production/Supabase Production. Aucune modification de `main`.
`docs/handoff/en-attente/` ne conserve pas ce corps après publication.

## STOP

Ce lot reste ouvert (`closes: false` hérité de `decision-12.md`). Deux reprises possibles,
distinctes :
1. #62/#65 — uniquement depuis une session disposant d'un accès réseau GitHub réel et d'un
   accès Supabase Test ; à défaut, les entrées Backlog FDJ-00x/CARB-00x restent le chemin
   borné.
2. Le sujet rôles B1/Audrey (`1530`) — nécessite une décision humaine/Orchestrator explicite
   avant toute exécution, conformément au mandat.
