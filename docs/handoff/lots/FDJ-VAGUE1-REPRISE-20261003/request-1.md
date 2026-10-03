---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=2faeb40
  - id: git-head-rail
    classe: VERIFIED
    valeur: HEAD=5babc37=origin/handoff-continuite-20260920,aucun-obstacle-racine
  - id: git-pr62-tete-inchangee
    classe: VERIFIED
    valeur: fe4e9a2=SHA-cite-par-le-reveil-et-par-dossier-decision-pr-62
  - id: divergence-production
    classe: VERIFIED
    valeur: merge-base-2bc7b39,32-commits-production-30-commits-pr62,non-ancestor
  - id: chevauchement-fichiers
    classe: VERIFIED
    valeur: un-seul-fichier-touche-des-deux-cotes-test-empreinte-artefact
  - id: precedent-isolation-65
    classe: VERIFIED
    valeur: 290a217-sept-fichiers-portes-puis-pr65-fusionnee-adee9bb
  - id: url-test-de-branche-deja-present
    classe: VERIFIED
    valeur: outils-recette-navigateur-test-js-ligne-199
  - id: vocabulaire-a-regulariser-deja-absorbe
    classe: VERIFIED
    valeur: production-nexus-fdj-moteur-js-6-occurrences-migration-20260821230243-anterieure
  - id: six-ecarts-a-regulariser
    classe: DECLARED
    valeur: mesure-du-17-09-non-reverifiable-depuis-ce-canal-aucun-acces-production
  - id: mergeable-state-gh
    classe: NOT_APPLICABLE
    valeur: gh-pr-view-et-git-merge-tree-refusent-approbation-dans-ce-canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucune-migration-aucun-deploiement
---
# Reprise FDJ — audit de la PR #62 contre le rail/production réels, 03/10/2026

Réponse au réveil Orchestrateur de l'issue #28 (commentaire du 03/10/2026, `@claude` /
`NEXUS_BASE_BRANCH=handoff-continuite-20260920`). Ce document est un **audit**, pas une
exécution : aucune fusion, aucune migration, aucune écriture Production. Il ouvre le plus petit
lot Handoff nécessaire pour que la reprise du cycle de caisse FDJ (PR #62) se décide sur des
faits mesurés aujourd'hui, pas sur l'état du 22/09/2026.

## 0. Ce qui a été lu avant d'écrire une ligne de jugement

- `docs/handoff/STATE.json` (lu avant toute écriture) : `lot_actif` =
  `NEXUS-CONTINUITE-TERRAIN-2-20260922`, `statut: DECISION_CONSOMMEE` — **hors**
  `STATUTS_LOT_ACTIFS` (`ATTENTE_DECISION`, `ATTENTE_CONSOMMATION_DECISION`). Aucune demande non
  consommée n'interdit l'ouverture d'un nouveau lot. `node outils/handoff.js verifier` est
  conforme avant toute écriture de ce lot (32 lots, 16 avertissements, 11 dérogations — tous
  préexistants, 0 nouvelle erreur).
- Le dossier de décision du 22/09/2026 : `docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-1-20260920/dossier-decision-pr-62.md`
  (NO GO temporaire rendu par Frédéric ce jour-là) et son prolongement
  `docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/{classement-gates-etat-git-62-65-1.md,
  preuve-62-isolation-environnement.md, etude-isolation-test-candidats-web-1.md}`.
- Le dossier métier complet de la PR, à la tête de la branche elle-même (jamais recopié dans ce
  dépôt de travail, lu par `git show`) :
  `fdj-vague1-cycle-caisse-20260916:DOSSIER-FDJ-VAGUE1-20260917.md` (1862 lignes, §1 à §26.14 +
  annexe).

## 1. État Git exact, mesuré aujourd'hui (pas repris du 22/09)

| Réf | SHA | Remarque |
|---|---|---|
| Rail (`handoff-continuite-20260920`) | `5babc3704d24546bff04503032d4c78e5f7fbbfc` | **identique** à `HEAD` de ce checkout — pour la première fois sur ce fil, aucun obstacle de racine `main`. |
| `production` | `2faeb40feba1d2bcdb9fb7c84655ab241f063003` | lue, rien écrit. |
| PR #62 (`fdj-vague1-cycle-caisse-20260916`) | `fe4e9a2bf7e2ee15fc302e7d89c59be2259fe6d2` | **identique** au SHA cité par le réveil et par `dossier-decision-pr-62.md` — la tête n'a pas bougé depuis le 22/09. |

- `merge-base(rail, production)` = `501c0c7` — deux lignées **toujours délibérément séparées**
  (inchangé depuis le 22/09).
- `merge-base(production, #62)` = `2bc7b39` — c'était la tête de `production` **au 22/09**.
  Depuis, `production` a avancé de **32 commits** que #62 n'a pas, et #62 a toujours ses
  **30 commits** que `production` n'a pas. `git merge-base --is-ancestor origin/production
  origin/fdj-vague1-cycle-caisse-20260916` → **échec** : c'est la cause mécanique exacte du
  « non mergeable » cité par le réveil. Ce n'est pas un défaut du candidat : c'est la distance
  normale d'une branche ouverte il y a 17 jours sur un dépôt actif.

### 1.1 — Les 32 commits que `production` a gagnés depuis, et ce qu'ils signifient pour #62

Parmi eux : **PR #65 a été fusionnée** (`adee9bb Merge pull request #65`), avec tout son
rail de portage (`290a217 rebuild(65): porter la chaine de build/config du rail (7 fichiers,
mecanique)`, puis la série `#65` jusqu'à `fe36a8e`). C'est directement pertinent : c'est
l'exécution réelle, et réussie, du geste que `etude-isolation-test-candidats-web-1.md` §3.2
décrivait pour #62 **sans l'exécuter** (« hors de ce lot de travail », « pas fait ici »). Le
mécanisme n'est donc plus hypothétique — il est éprouvé, sur le même type de candidat, par les
mêmes fichiers.

Les autres commits de production touchent `station_config` (deux correctifs d'upsert,
`5478a8b`/`a1c29f1`-lignée), une garde d'ordre migration/code (`eba2f90`), et un diagnostic
carburants (`c23ad44`) — aucun ne touche `nexus-fdj-moteur.js`, `nexus-caisse-source.js`,
`nexus-progression.js` ni aucune des tables `fdj_*`.

### 1.2 — Chevauchement de fichiers réel, mesuré (pas estimé)

Comparaison des deux listes de fichiers changés depuis `2bc7b39` (production d'un côté, #62 de
l'autre) : **un seul fichier est touché des deux côtés** :
`.github/deploiement/test_empreinte_artefact_20260915.js` — exactement le conflit déjà annoncé
par `dossier-decision-pr-62.md` §5 (« le second fusionné devra re-mesurer ses deux constantes »).
C'est maintenant #62 qui serait « le second ». Aucun autre fichier métier FDJ ne collisionne
textuellement avec les 32 commits de production : `nexus-fdj-moteur.js`, les 12 migrations,
`NEXUS-FDJ-Manager-v1.html`, `NEXUS-FDJ-v1.html`, `NEXUS-Prise-De-Poste-v1.html`,
`NEXUS-Progression-v1.html`, `nexus-caisse-source.js`, `nexus-progression.js` n'apparaissent dans
aucune des deux listes à la fois.

Ceci est une mesure de **diff textuel**, pas une preuve d'absence de conflit sémantique, et pas
un calcul de `mergeable_state` GitHub (`gh pr view`/`git merge-tree` ont été essayés depuis ce
canal et refusent une approbation qu'aucun humain ne peut donner dans ce run automatisé — même
limite que toute la série de réveils précédents sur cette issue). Une session avec ces deux
capacités doit confirmer `mergeable_state` avant toute décision de fusion.

## 2. Matrice de reprise — chaque apport de #62 classé

| Apport | Classement | Preuve |
|---|---|---|
| **12 migrations Vague 1** (`20260916220000`→`20260916221100`) | `ENCORE_NECESSAIRE` | Absentes de `production` et du rail (confirmé par diff de fichiers, §1.2). Aucune collision textuelle avec les migrations ajoutées depuis par `production`. Compatibilité SQL mesurée **au 22/09** sur Test (287 migrations, essai à blanc `exit 0`, 54 colonnes/36 fonctions créées) — **à remesurer** : Test a probablement encore dérivé depuis (gate déjà ouverte, §2 `classement-gates...`, non traitée ici). |
| **`nexus-fdj-moteur.js` — cycle `etapeCaisseFdj`/`permissionsEcartCaisseEmploye`** | `ENCORE_NECESSAIRE` | Diff mesuré : remplace un modèle de permission ambigu (`fdj_shifts.statut==='valide'` confondait « transmis employé » et « validé manager ») par un modèle à étapes explicites (`saisie_a_commencer / brouillon / en_attente_controle_manager / validee`), rétrocompatible avec l'ancienne forme d'appel. Rien d'équivalent sur `production` : son `nexus-fdj-moteur.js` ne contient que l'ancienne fonction. Couvre directement le point 4 du réveil (validation/réouverture/correction). |
| **Vocabulaire `a_regulariser` / `regularise` / `valide_avec_ecart`** | `DEJA_ABSORBE` | Mesuré, pas supposé : `production:nexus-fdj-moteur.js` porte déjà 6 occurrences de `a_regulariser` — la migration `20260821230243_fdj_cash_controls_verdict_a_regulariser.sql` (21/08) est **antérieure** à la Vague 1 et déjà sur `production`. Les 12 migrations de #62 n'introduisent pas ce vocabulaire, elles s'appuient dessus. Ne pas le recopier comme s'il manquait. |
| **Mécanisme d'isolation Test (adressage de branche candidate)** | `DEJA_ABSORBE` | `urlTestDeBranche()` existe déjà dans `outils/recette-navigateur-test.js` du rail (ligne 199) — exactement la fonction que `etude-isolation-test-candidats-web-1.md` §3.1/§5.1 recommandait d'ajouter. Elle est présente, pas à refaire. |
| **Mécanisme d'isolation Test (chaîne de build/config sur la branche candidate)** | `ENCORE_NECESSAIRE`, **avec méthode prouvée** | `etude-isolation-test-candidats-web-1.md` §3.2 décrivait le geste (porter 4-5 fichiers + le `nexus-auth.js` de 305 lignes) sans l'exécuter pour #62. Ce même geste **a depuis été exécuté avec succès pour #65** (commit `290a217`, 7 fichiers, puis fusion réelle en production). Ce n'est donc plus une hypothèse à valider : c'est un geste mécanique déjà réussi une fois sur un candidat de même nature, à répéter pour #62 — **non exécuté ici**, car il modifie une branche candidate hors de ce lot de travail et hors du périmètre audit demandé par le réveil. |
| **Confidentialité des identifiants dans les fixtures de recette (§26.13)** | `DEJA_ABSORBE` (à la tête), `PREUVE_MANQUANTE` (historique) | À la tête `fe4e9a2`, les deux recettes (Phase C et Vague 1) ne dépendent plus d'aucun compte réel : identifiants pseudonymes synthétiques créés/démontés dans leurs propres transactions annulées, gardées par deux tests dédiés (`test_phase_c_identifiants_synthetiques_20260917.js`, `test_recette_vague1_identifiants_synthetiques_20260917.js`). **Ce que cela ne règle pas**, et que le dossier dit lui-même : l'exposition **historique** (un identifiant pseudonyme publié depuis le 05/09 sur une quarantaine de références distantes) subsiste — « relève d'une décision, pas d'une initiative » (§26.13). Aucune réécriture d'historique n'a eu lieu. Point à trancher par Frédéric si besoin, pas par ce lot. |
| **Confidentialité des champs manager dans la projection employé** | `ENCORE_NECESSAIRE` (mesure comportementale manquante) | Le dossier §9/§16 documente la séparation auteur de saisie / employé opérationnel et les RLS Phase C (§7) côté serveur, avec preuves SQL (§16, §16 bis). Aucune recette navigateur n'a jamais tourné contre l'écran employé réel pour vérifier que les champs réservés au manager restent invisibles côté UI — c'est structurellement impossible tant que la branche n'a pas d'isolation Test (ligne précédente). Classé `PREUVE_MANQUANTE` pour la part UI, `ENCORE_NECESSAIRE` pour le reste déjà écrit en RLS. |
| **Transfert de responsabilité / mouvements / carnets-activations** (migrations `20260916220400`, `20260916221000`) | `ENCORE_NECESSAIRE` | Aucune trace de ces tables/fonctions sur `production` ou le rail (absentes des deux listes de diff). Non repris ailleurs, non obsolète. |
| **Projection employé (`20260916220800`) / projection progression (`20260916220900`)** | `ENCORE_NECESSAIRE` | Idem — absentes ailleurs. `nexus-progression.js` sur `production` ne porte pas les 45 lignes ajoutées par #62. |
| **`.github/deploiement/test_empreinte_artefact_20260915.js`** | `CONFLIT_A_REQUALIFIER` | Seul fichier touché des deux côtés (§1.2). Les constantes qu'il vérifie devront être remesurées après que #62 soit porté sur une base à jour — exactement le geste déjà fait pour #65 (`ffb520b Empreinte de l'artefact : re-mesurer les deux constantes...`), à répéter, pas à inventer. |
| **Dossier `DOSSIER-FDJ-VAGUE1-20260917.md` lui-même** | `ENCORE_NECESSAIRE` (comme pièce de preuve) | Absent de `production`/du rail. Reste la source de vérité la plus complète sur #62 ; ce document s'appuie sur lui plutôt que de le dupliquer. |
| **Preuve « SHA attendu = SHA servi » et recette navigateur profonde** | `PREUVE_MANQUANTE` | Confirmé inchangé : absente de `fe4e9a2` par construction du fichier (`tests.yml` de cette branche ne déclare aucune étape profonde), pour les deux causes déjà nommées en 2 (isolation Test). Non levée par cet audit. |
| **Dérive de schéma Supabase Test (287 vs 276 au 22/09)** | `PREUVE_MANQUANTE` | Gate déjà ouverte par `classement-gates-etat-git-62-65-1.md`, toujours « non entamée », inchangée par cet audit (aucun accès Supabase Test depuis ce canal). |
| **Les six écarts `a_regulariser`** | voir §3 ci-dessous | Traité séparément, conformément au point 5 du réveil. |

## 3. Les six écarts `a_regulariser` — ce qui peut être dit, et ce qui ne peut pas

`DOSSIER-FDJ-VAGUE1-20260917.md` §20 les documente, mesurés en lecture seule sur **Production**
le 17/09/2026 : `fdj_cash_controls` comptait alors 55 `conforme`, 18 `valide_avec_ecart`,
**6 `a_regulariser`**, 3 `regularise`, tous les six sur `vito-sainte-marie`, chacun identifié par
le préfixe de son UUID de contrôle et son montant d'écart (`+14`, puis cinq écarts négatifs de
−1 à −37).

**Ce que cet audit ne peut pas faire depuis ce canal : les revérifier.** Ce canal GitHub Issue
n'a, comme pour tous les réveils précédents de ce fil depuis le 06/09/2026, aucun identifiant ni
accès réseau vers Supabase Production. Affirmer qu'ils sont « toujours six, toujours intacts »
aujourd'hui serait réciter une mesure vieille de 16 jours comme si elle était d'aujourd'hui — exactement ce que le point 5 du réveil interdit. Ce qui peut être dit sans nouvelle mesure :

- Aucune des 12 migrations de #62, ni aucun commit de `production` depuis, ne touche
  `fdj_cash_controls.statut` par une instruction `UPDATE`/`DELETE` active (vérifié par recherche
  des mots-clés destructeurs sur les 12 fichiers, §3 de `dossier-decision-pr-62.md` — 18
  correspondances, toutes en commentaire).
- Le mécanisme de régularisation lui-même reste **non implémenté** par la Vague 1, comme le
  dossier le dit explicitement (§20 : vocabulaire fixé, commande serveur non écrite) — rien dans
  #62 ne pouvait donc les solder.
- Une remesure réelle (même `SELECT` seul) nécessite un accès Production en lecture, hors de
  portée de ce canal. À faire par l'Orchestrator ou par une session outillée avant toute décision
  de fusion, pas supposée ici.

## 4. Pourquoi ne pas recopier un correctif déjà présent sous une forme plus récente (point 6)

Deux pièges identifiés et évités dans cette lecture :

1. **Ne pas réécrire `urlTestDeBranche()`** : elle existe déjà sur le rail (§2, ligne
   « Mécanisme d'isolation Test (adressage) »). La recréer dupliquerait une fonction déjà
   éprouvée.
2. **Ne pas retraiter l'isolation `nexus-auth.js`/chaîne de build comme un problème ouvert** :
   le motif exact du NO GO du 22/09 a déjà été requalifié par
   `preuve-62-isolation-environnement.md` (« le défaut n'est pas dans #62, il est hérité de la
   lignée `production` ; il se referme quand le rail arrive en Production, pas branche par
   branche »), et la méthode de fermeture a depuis été **exécutée avec succès pour #65**. Rouvrir
   une étude du problème serait refaire un travail déjà fait deux fois (l'étude, puis
   l'exécution réelle sur #65).

## 5. Ce que cet audit ne fait pas (point 8 du réveil)

Aucun fichier de `fdj-vague1-cycle-caisse-20260916` n'a été modifié, copié ou porté. Aucun
`checkout`/`cherry-pick`/`merge` n'a été tenté vers cette branche ni vers `rebuild/fdj-62-20260922`
(confirmé à `2bc7b39`, identique au `merge-base` du 22/09 — rien n'y a été construit). Aucune
requête Supabase, aucune migration, aucune opération sur `main` ou `production`. La PR #62 n'a
pas été fusionnée. Rien n'a été écrit en dehors de ce dossier et du registre Handoff lui-même.

## 6. Proposition — le plus petit lot technique suivant (demande d'arbitrage, pas une exécution)

Avant de rouvrir le développement FDJ, trois gestes déterministes, bornés, et dans cet ordre :

1. **Porter la chaîne d'isolation Test sur un candidat FDJ** — reprendre exactement le geste
   déjà réussi pour #65 (`290a217`, 7 fichiers mécaniques : `nexus-auth.js`, `nexus-page.js`,
   `nexus-bandeau-environnement.js`, `outils/build.sh`, `outils/generer-config.js`,
   `outils/poser-build-id.js`, `_headers`) sur une branche candidate FDJ dédiée (`rebuild/fdj-62-20260922`,
   aujourd'hui identique à `2bc7b39` et donc vierge de ce portage), **sans toucher au reste du
   delta métier FDJ**. Outillage/mécanique pur, aucun secret, aucune Production.
2. **Remesurer, pas supposer** : réappliquer l'essai à blanc des 12 migrations sur le schéma
   Test réel (il a dérivé depuis le 22/09, §2 `classement-gates...`), puis exécuter la recette
   navigateur réelle (quart ouvert par la prise de poste, prise de contrôle manager, validation/
   réouverture/correction, demandes de correction, transfert de responsabilité, mouvements,
   carnets/activations, projection employé — en vérifiant spécifiquement qu'aucun champ réservé
   au manager ne fuite côté UI employé) sur ce candidat isolé, et republier
   `.github/deploiement/test_empreinte_artefact_20260915.js` avec ses constantes remesurées.
3. **Remesurer les six écarts `a_regulariser`** en lecture seule sur Production, depuis une
   session qui en a l'accès (hors de ce canal), avant toute décision de fusion — pour confirmer
   ou infirmer qu'ils sont toujours six et intacts.

Aucun de ces trois gestes n'est exécuté par ce document. Le premier et le second sont du
ressort d'une session outillée (accès Supabase Test + droit d'écriture sur une branche
candidate) ; le troisième d'une lecture Production que ce canal n'a jamais eue. Ce lot
(`FDJ-VAGUE1-REPRISE-20261003`) reste ouvert (`closes: false` attendu) en attendant cette
exécution ou un arbitrage contraire.

## Critères de recette Test précis et causalement bornés, pour la suite

- **Cas 1 — un seul quart ouvert par prise de poste.** Une prise de poste sur un site sans quart
  FDJ `brouillon` en cours crée exactement un `fdj_shifts`. Rejouer la prise de poste n'en crée
  pas un second (index partiel `fdj_shifts_prise_de_poste_unique`, déjà prouvé le 17/09 — à
  rejouer sur Test à jour, pas à retester depuis zéro).
- **Cas 2 — permission employé par étape, pas par statut brut.** `permissionsEcartCaisseEmploye`
  retourne `voir:false` en `brouillon`, `voir:true, provisoire:true, corrigerDirectement:true` en
  `en_attente_controle_manager`, `voir:true, signalerApresValidation:true, corrigerDirectement:false`
  en `validee` — sur le serveur réel (`fdj_ma_caisse().etape`), pas sur un objet construit à la
  main.
- **Cas 3 — seul le manager valide**, et sa prise de contrôle est tracée (auteur distinct de
  l'employé opérationnel, §15/§16 du dossier).
- **Cas 4 — confidentialité des champs manager** : l'écran employé réel, chargé contre un
  candidat isolé, ne reçoit jamais les colonnes réservées au contrôle manager avant validation
  (§26.4 du dossier signale un défaut déjà vu une fois — « l'écran manager reposait sur la bonne
  volonté d'un fichier HTML » — à reconfirmer fermé sur la tête actuelle, pas supposé fermé).
- **Cas 5 — aucun nouvel échec imputable.** Suite complète Test après portage : tout nouveau rouge
  hors `docs/qa/ECHECS-CONNUS.json` bloque la suite, pas de reclassement silencieux en dette.
- **Cas 6 — empreinte artefact remesurée**, pas recopiée d'un ancien lot.

Toute recette comportementale vise exclusivement `nexus-test` (`udljdqxerrbbbajxubfn`). Aucune
URL, aucun identifiant, aucune donnée de production réelle n'y est utilisée.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucun secret créé/lu/exposé,
aucune fusion de la PR #62, aucune migration, aucun déploiement, aucune donnée réelle manipulée.
