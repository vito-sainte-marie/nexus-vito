---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-REGUL-GROUPES-1-20261013
seq: 3
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
  - id: ci-pr-112
    classe: VERIFIED
    valeur: tests-et-deploiement-production-verts-5e78898
  - id: condition-5-a-md5
    classe: VERIFIED
    valeur: 94db6478-identique-20261008160000
  - id: condition-5-c-epreuves
    classe: VERIFIED
    valeur: 3-epreuves-vertes-16-6-12-contre-temoins
  - id: condition-5-reversibilite
    classe: VERIFIED
    valeur: catalogue-identique-4487
  - id: aucun-go-production
    classe: DECLARED
    valeur: migration-fusion-pages-non-accordes
---
# Régularisation différée (versements groupés) — condition 5 rejouée (réponse à decision-2)

**Ceci n'est ni un GO Production ni une demande d'exécution.** Aucune migration, fusion ni déploiement Pages n'a été effectué ni n'est demandé.

## 1. Les trois vérifications exigées par decision-2

Tête du portage : PR #112 (brouillon, base `production`), `5e78898`. Blob de la migration `20261013140000` inchangé : `eccdbafc53e9e34d365a49aa5c6d3708cc731d03`. CI à `5e78898` verte (Tests ×2, job Déploiement Production ; Pages non déployé).

- **(a) `_regul_tiroir_detail`** : la définition de Production (md5 `94db6478…`) est identique au texte de `20261008160000`. Une première lecture divergente (`2dcaf86a…`) venait de la méthode de mesure (hors `pg_get_functiondef`) ; elle est abandonnée et documentée. Les 8 autres fonctions ont le même md5 avant et après la migration ; seule `_regul_tiroir_detail` passe à `8f8a8156…`, par construction.
- **(b) Six fonctions `select … into` / `%rowtype`** : relues une à une, ainsi que les 8 anciennes fonctions touchant les deux tables ; aucune incompatibilité avec les colonnes `groupe_id` nullables.
- **(c) Rejeu des épreuves existantes avec la migration seule** : les 3 anciennes épreuves restent vertes (16 + 6 + 12 contre-témoins). Défaut trouvé et corrigé : 2 contre-témoins périmés (`mode-transfert.sql`, `sans-transferts.sql`) visaient une expression que la migration réécrit ; ils sont ré-ancrés sur `coalesce(v.mode_encaissement, g.mode_encaissement, 'sans_mode')`. Cette épreuve n'est pas câblée à la CI.
- **(d) Réversibilité** : script `docs/deploiement/retour-arriere-versements-groupes-20261013.sql` (une transaction : RPC, `_regul_tiroir_detail` d'origine, triggers, CHECK, colonnes, garde « table des groupes vide », table). Catalogue identique avant migration et après retour arrière (4487 éléments) tant que la table des groupes est vide. La migration modifie 62 lignes du relevé.

## 2. Limites déclarées

- Le rejeu s'est fait dans un conteneur Postgres jetable avec les migrations du dépôt, **pas sur une copie des données de Production** ; les 22 migrations de Production sans fichier ne sont pas rejouées. Production n'a de toute façon aucune ligne dans les deux tables concernées (lecture seule du 13/10).
- Le retour arrière avec des groupes existants est refusé par la garde, volontairement : il détruirait des écritures.

## 3. Question à l'arbitre

Cette instruction de la condition 5 suffit-elle pour que je prépare une proposition d'exécution (séquence migration puis code, fenêtre, retour arrière), ou exiges-tu une copie plus représentative de Production ? Dans ce cas, précise laquelle (schéma seul restauré, ou données comprises).

Aucun GO n'est sollicité pour : SUPABASE_PRODUCTION_MUTATION, fusion vers `production`, déploiement Pages.
