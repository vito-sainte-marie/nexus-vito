<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-REGUL-GROUPES-1-20261013/request-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-REGUL-GROUPES-1-20261013
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=e1251e2 production=7e37b88
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 147-fichiers
  - id: pr-portage
    classe: VERIFIED
    valeur: PR-112-tete-30f7a5e-base-production
  - id: migration-blob
    classe: VERIFIED
    valeur: 20261013140000-eccdbafc53e9e34d365a49aa5c6d3708cc731d03
  - id: ci-pr-112
    classe: VERIFIED
    valeur: non-regression-et-artefact-verts
  - id: condition-5
    classe: DECLARED
    valeur: raisonnement-non-rejoue
  - id: aucun-go-production
    classe: DECLARED
    valeur: migration-fusion-pages-non-accordes
---
# Régularisation différée (versements groupés) — portage depuis `origin/production` et condition 5

**Ceci n'est ni un GO Production ni une demande d'exécution.** Aucune migration, fusion ni déploiement Pages n'a été effectué ni n'est demandé.

## 1. Réponse aux conditions de decision-1

- Condition 3 : portage propre depuis `origin/production` (`7e37b88`), PR #112 en brouillon (base `production`), branche `portage-regularisation-groupes-20261013`, tête `30f7a5e`. La PR #109 n'est pas fusionnée.
- Condition 4 : blob de la migration `20261013140000` inchangé (`eccdbafc53e9e34d365a49aa5c6d3708cc731d03`). Écart d'estampille propre à Test documenté dans le dossier. Empreinte d'artefact re-mesurée : 307 migrations, `ca778d6c…2acc86b`. CI de la PR #112 verte (non-regression, construction de l'artefact, aperçu Cloudflare) ; déploiement Pages et Supabase Preview ignorés.
- Conditions 1 et 2 : classement `atomique_ou_procedure_speciale` conservé ; ordre migration puis code.
- Conditions 6 et 7 : respectées ; la restitution du surplus reste hors lot.

## 2. Condition 5 — intervalle « migration posée, code non déployé »

Lectures seules sur Production le 13/10 : `groupe_id` et la table des groupes absents ; `ecarts_versements_regularisation` et `caisse_transferts_coffre` à 0 ligne ; aucune vue dépendante ; seuls triggers existants : l'immuabilité.

Raisonnement : migration additive ; les nouveaux triggers sortent immédiatement quand `groupe_id` est nul ; le CHECK `ctc_versement_ou_groupe` est vrai pour toute ligne sans groupe ; `_regul_tiroir_detail` garde signature et forme de sortie, résultats identiques sans groupe ; seules les nouvelles RPC créent un groupe et aucun écran actuel ne les appelle. Le retour arrière de l'en-tête de la migration est sans perte tant que la table des groupes est vide.

**Limites déclarées (statut : raisonnement, pas rejeu)** : la définition Production de `_regul_tiroir_detail` n'a pas été comparée au texte de `20261008160000` ; les six fonctions citant les tables avec `select … into` / `%rowtype` n'ont pas été relues une à une ; les scénarios existants n'ont pas été rejoués sur une copie de Production avec la migration seule.

## 3. Question à l'arbitre

La condition 5 est-elle suffisamment instruite par ce raisonnement, ou exige-t-elle, avant toute proposition d'exécution, les trois vérifications ci-dessus (comparaison de définition, relecture des six fonctions, rejeu sur copie) ? Je les mènerai sur ta demande ; je ne les déclare pas acquises.

Aucun GO n'est sollicité pour : SUPABASE_PRODUCTION_MUTATION, fusion vers `production`, déploiement Pages.
