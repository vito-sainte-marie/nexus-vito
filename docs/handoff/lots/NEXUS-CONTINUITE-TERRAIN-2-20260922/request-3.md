---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: artefacts-github-checks
    classe: DECLARED
    valeur: gh_pr_checks_et_gh_pr_view_refusent_approbation_reconfirme_ce_canal
  - id: urltestdebranche-reutilise
    classe: VERIFIED
    valeur: aucun_changement_66_sur_66_test_recette_navigateur_test_20260907
  - id: chaine-corrigee-7-fichiers
    classe: VERIFIED
    valeur: git_show_direct_sur_62_et_65_2_fichiers_de_plus_que_letude
  - id: outil-plan-portage-teste
    classe: VERIFIED
    valeur: 10_sur_10_test_planifier_portage_config_candidat_20260922_mutation_negative_incluse
  - id: aucun-portage-execute
    classe: VERIFIED
    valeur: garde_statique_montre_seuls_git_show_rev_parse_executables
  - id: regression-globale
    classe: VERIFIED
    valeur: 266_sur_275_9_echecs_connus_aucun_nouveau
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32_lots_conformes_apres_depot
  - id: guardians-router
    classe: VERIFIED
    valeur: 1_finding_nexusstock_deja_connu_arch_002_aucun_nouveau
  - id: recette-navigateur
    classe: NOT_APPLICABLE
    valeur: non_lancee_absence_contact_production_non_prouvee
  - id: supabase-test-62-65
    classe: NOT_APPLICABLE
    valeur: aucun_acces_depuis_ce_canal_inchange_depuis_06_09
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Poursuite technique après transport canonique — artefacts GitHub, plan de portage préparé, gates réactualisées

Réponse au réveil du 22/09/2026 (issue #28, commentaire `5785621978`), sur le HEAD canonique
`9fb1478d7002de68e2827d3ed5969ee45f0aeb6e` transporté par le mécanisme de continuité — aucun écart
constaté entre ce HEAD et `origin/handoff-continuite-20260920` au démarrage de cette session.

## 1. Artefacts/checks GitHub disponibles — reconfirmé, inchangé

`gh pr checks`, `gh pr view`, `git ls-tree` sur une ref distante non déjà présente localement :
tous refusent une approbation qu'aucun humain ne peut donner dans ce run automatisé — reconfirmé
dans cette session (pas recopié d'un rapport antérieur). Seule `git show <ref>:<chemin>` fonctionne.
`urlTestDeBranche` (ajoutée par `request-2.md`) fonctionne sans changement, réutilisée telle quelle.

## 2. Plan de portage — préparé, pas exécuté

`plan-portage-config-candidats-1.md` (ce lot) et le nouvel outil
`outils/planifier-portage-config-candidat.js` (testé,
`test_planifier_portage_config_candidat_20260922.js`, 10/10 dont une mutation négative qui prouve
que le script ne peut structurellement exécuter que `git show`/`git rev-parse`, jamais
`checkout`/`commit`/`push`) établissent, pour #62 et #65, l'état exact des 7 fichiers de la chaîne
de build/config (pas 4 comme le disait `etude-isolation-test-candidats-web-1.md` — corrigé : 5
absents, et **2 de plus jamais nommés jusqu'ici**, `outils/poser-build-id.js` présent mais figé
sur une génération antérieure au 05/09/2026, et `_headers` absent, qui bloquerait de toute façon
`outils/generer-config.js` à son contrôle §7) et l'adresse Test que chacune prendrait une fois
portée. **Aucun portage n'a été exécuté** : conforme à `decision-2.md` §Conditions, qui le diffère
tant qu'un accès Cloudflare humain n'a pas observé ce qui est réellement construit et servi
aujourd'hui sur ces deux branches.

## 3. Recette navigateur — non lancée

Conforme au point 3 du réveil : aucune recette navigateur exécutée, l'absence de contact Production
n'étant toujours pas prouvée pour #62/#65 (cause du rouge Cloudflare toujours non établie depuis ce
canal, cf. `etude-isolation-test-candidats-web-1.md` §4).

## 4. Étapes Supabase Test — toujours bloquées

Reconfirmé (test de présence booléen, sans lecture de valeur) : aucune variable
`NEXUS_TEST_DB_URL*`, `SUPABASE_TEST_DB_URL*` ni `NEXUS_TEST_*_PIN` dans ce canal. La preuve de
création réelle de la migration #65 et la dette de dérive de schéma Supabase Test restent
entamées nulle part, comme au classement du 22/09/2026 matin.

## 5. Classement des gates — mise à jour

Seule la ligne « Isolation Supabase Test des candidats web » évolue par rapport à
`classement-gates-etat-git-62-65-1.md` :

| Gate | État au 22/09 matin | État après ce dossier |
|---|---|---|
| Isolation Supabase Test des candidats web (préalable #62/#65) | étude + outillage minimal déposés, portage non fait | **chaîne corrigée à 7 fichiers (pas 4), outil de planification déterministe ajouté et testé, portage toujours non fait** — même préalable : accès Cloudflare humain |

Les 5 autres lignes du tableau (B1, preuve de création #65, dérive de schéma, GO Production #62,
GO Production #65) sont inchangées depuis `classement-gates-etat-git-62-65-1.md` : rien de nouveau
ne les fait bouger.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production, aucun
secret créé/lu/exposé, aucun nouveau rôle/RLS, aucune nouvelle règle métier/UX, aucun
`checkout`/`commit`/`push` vers une branche candidate.
