<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-REGUL-GROUPES-1-20261013/request-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-REGUL-GROUPES-1-20261013
seq: 4
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
    valeur: PR-112-tete-5e78898-base-production
  - id: migration-blob
    classe: VERIFIED
    valeur: 20261013140000-eccdbafc53e9e34d365a49aa5c6d3708cc731d03
  - id: decision-3
    classe: VERIFIED
    valeur: APPROVED_WITH_CONDITIONS-PROOF_VALID-a285137
  - id: aucun-go-production
    classe: DECLARED
    valeur: migration-fusion-pages-non-accordes
---
# Régularisation différée (versements groupés) — proposition d'exécution NON EXÉCUTOIRE (réponse à decision-3)

**Ceci n'est ni un GO ni une exécution.** Rien n'a été appliqué sur Production. Cette proposition sépare migration, code et déploiement, et nomme les autorisations distinctes que seul Frédéric peut accorder (`SUPABASE_PRODUCTION_MUTATION`, `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`). Elle suit les conditions de decision-3.

Support : PR #112 (brouillon, base `production`, tête `5e78898`), dossier `docs/deploiement/promotion-versements-groupes-production-20261013.md`, retour arrière `docs/deploiement/retour-arriere-versements-groupes-20261013.sql`, migration `20261013140000` (blob `eccdbafc53e9e34d365a49aa5c6d3708cc731d03`, à garder identique).

## 0. Précontrôle Production en lecture seule (juste avant toute exécution)

Exécuté par moi sous `begin read only … rollback` (AUTO, lectures seules). Un seul écart = arrêt, retour à l'arbitre. Il couvre, dans l'ordre :

1. **Schéma réel** : table `versements_regularisation_groupes` absente ; colonne `groupe_id` absente sur `ecarts_versements_regularisation` et `caisse_transferts_coffre` ; contrainte `ctc_versement_ou_groupe` absente ; les 6 RPC et les 2 fonctions d'appui absentes. Dernière migration appliquée relevée et comparée à celle du 13/10 (311 / `20261013152155`) : toute migration nouvelle depuis, notamment parmi les 22 sans fichier, est listée et lue avant de continuer.
2. **Dépendances** : aucune vue ni fonction nouvelle ne cite les deux tables au-delà des neuf fonctions connues ; triggers existants limités à l'immuabilité.
3. **Définitions des fonctions** : md5 de `pg_get_functiondef` des neuf fonctions qui citent les tables, comparés à ceux du dépôt avant migration. `_regul_tiroir_detail` attendue à `94db6478036dbdb1d427b5b8b8b8ae58`. Toute dérive = arrêt et relecture.
4. **Volumétrie** : nombre de lignes des deux tables (0 au 13/10). Si une ligne existe, le CHECK et les triggers sont réévalués avant de poursuivre.
5. **Applicabilité de la garde de retour arrière** : la table des groupes n'existe pas encore, donc le retour arrière est trivialement sans perte ; le script est relu à l'identique du dépôt et la garde « table des groupes vide » est confirmée sur le texte.

Le résultat est consigné sur le rail avant toute demande de GO.

## 1. Étape A — Migration (autorisation : `SUPABASE_PRODUCTION_MUTATION`)

- Véhicule : le connecteur Supabase (seul écrivain Production), fichier `20261013140000` tel quel. Production recevra l'estampille posée par le connecteur (écart d'estampille déjà documenté pour Test).
- Compatibilité du code actuel sur le nouveau schéma : instruite (decision-3, `PROOF_VALID`) : additive, colonnes nullables, triggers sans effet quand `groupe_id` est nul, `_regul_tiroir_detail` de même signature et même sortie hors groupe, aucun écran actuel n'appelle les nouvelles RPC.
- Contrôle après pose, lecture seule : objets présents, `_regul_tiroir_detail` à `8f8a8156…`, huit autres fonctions inchangées, deux tables toujours à 0 ligne, grants des 6 RPC (aucune ouverte à `anon`).
- **Arrêt après A.** Production tient sans nouveau code. Le code n'est déployé qu'après le contrôle.

## 2. Étape B — Code (autorisation : `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`, fusion)

- Condition : étape A contrôlée, CI de la PR #112 re-verte sur la tête à fusionner, PR sortie du brouillon par Frédéric ou sur son GO.
- Fusion de #112 vers `production` (ordre migration puis code, jamais l'inverse : l'écran Écarts appelle des RPC absentes avant A).

## 3. Étape C — Déploiement Pages (même famille d'autorisation, GO distinct)

- Production est servie brute par GitHub Pages, sans construction. Après publication : comparer le contenu servi au fichier de `production` (un 200 ne prouve pas le contenu), jamais l'URL seule.
- Recette Production en lecture seule d'abord (écran Écarts, vue Paye à deux compteurs), aucune écriture de test sans GO.

## 4. Fenêtre

Le code actuel est compatible avec le schéma migré, donc l'intervalle A→B n'est pas critique ; je propose néanmoins d'enchaîner A, contrôle, B, C dans la même séance, hors de la saisie de caisse en cours (Verify, FDJ), pour borner l'intervalle. Aucune fenêtre d'arrêt de service n'est nécessaire.

## 5. Retour arrière par étape

- Après A seulement : `retour-arriere-versements-groupes-20261013.sql` (une transaction, garde « table des groupes vide »). Sans perte tant qu'aucun groupe n'existe, ce que garantit l'absence de nouveau code.
- Après B/C : d'abord revenir au code précédent (revert de la fusion sur `production`, republication Pages, contenu servi comparé), puis, si des groupes n'existent pas, le script. **Si des groupes existent**, le script refuse (volontairement : les lignes sont immuables) ; il faudrait alors sauvegarde et accord distinct, hors de cette proposition.
- Limite connue : rejeu fait en conteneur jetable, pas sur copie de données ; levée en partie par le précontrôle §0.

## 6. Ce qui reste hors lot

La restitution du surplus (décision du 13/10 : aucune écriture ni trace). Aucune modification de Paye au-delà de la lecture à deux compteurs.

## 7. Question à l'arbitre

Cette séquence (précontrôle, A, contrôle, B, C, retours arrière) est-elle conforme à decision-3 pour être soumise telle quelle au palier humain de Frédéric ? Je ne sollicite aucun GO ici.

Aucun GO n'est sollicité pour : SUPABASE_PRODUCTION_MUTATION, fusion vers `production`, déploiement Pages.
