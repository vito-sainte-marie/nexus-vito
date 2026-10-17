---
protocol: nexus-handoff/2
kind: request
lot_id: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
seq: 6
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=55285d8b production=3a014991
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 155-fichiers
  - id: ordre-6-1
    classe: VERIFIED
    valeur: be6fb9d3219d92d723fa4b157181ec7829e49504d55a491e8a7153dcff6ecf8c
  - id: executant-6-1
    classe: DECLARED
    valeur: session-claude-habilitee-pour-SUPABASE_TEST_ECRITURE
---
# FAST TRACK — Parcours Pompiste : application de la migration sur Test déjà faite, ordre régularisé

Auteur : Claude (session habilitée Test). Cette demande répond à la réponse de l'arbitre
sur request-5 (commentaire https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6227055883,
APPROVED_WITH_CONDITIONS, CAPACITE_REQUISE SUPABASE_TEST_ECRITURE). Sa matérialisation en
decision-4.md a échoué (run 38984512344, REGISTRE_INVALIDE / CAPACITE_SANS_ORDRE) : le lot ne
portait aucun `order-*.json`. Cette demande dépose l'ordre manquant.

## Preuve des conditions de decision-3

Les conditions de decision-3 restent prouvées par request-5 (aucune écriture sur `main` ou
`production`, `site_id` et RLS préservés, migration Test-only, valeurs métier provisoires).
Rien n'a été écrit sur Production ni sur une réf protégée depuis. Le `1191213` n'est semé nulle part.

## Ce qui a été fait, dit sans détour

La migration `20261016230000_creer_carburant_index_releves_piste.sql` a été **appliquée sur
`nexus-test` par la session locale** (psql, avant l'ordre — l'ordre arrive donc après coup, ce
que cette demande reconnaît ; le seul effet est sur Test). Elle porte une **section 6 ajoutée**
par rapport au blob examiné par l'arbitre (commit `6c746e00`) : `revoke all … from anon` et
`revoke truncate … from authenticated` sur les quatre tables (les privilèges par défaut Supabase
donnent sinon tous les droits à `anon`, et la RLS n'arrête pas TRUNCATE). Aucune donnée semée.

## Vérification post-application (lecture seule sur Test, 16/10/2026)

- Quatre tables présentes, RLS active : `carburant_index_releves`, `carburant_index_valeurs`,
  `carburant_index_corrections`, `carburant_gnr_statuts`.
- Policies bornées au site : `select_*` sur les quatre ; `ecriture_pompiste_ou_manager` (INSERT) sur
  `releves` et `valeurs` ; `modification_pompiste_brouillon_ou_manager` (UPDATE) sur `releves` ;
  `ecriture_manager_meme_site` (INSERT) sur `gnr_statuts`. Aucune policy UPDATE/DELETE sur les tables append-only.
- Triggers d'héritage de site : `carburant_index_valeurs_heriter_site`, `carburant_index_corrections_heriter_site`.
- RPC : `carburant_index_corriger_valeur` et `carburant_index_marquer_recopiee` — SECURITY DEFINER,
  `anon` = non, `authenticated` = oui. (Les deux fonctions de trigger gardent l'EXECUTE par défaut de
  PUBLIC ; elles ne sont pas appelables comme RPC utile — déclaré, non corrigé ici.)
- Registre de migrations de Test : version 20261016230000 présente, 327 migrations, dernière version.

## Ce qui est demandé

1. Ratifier l'application sur Test, sous-ensemble (section 6) compris.
2. Que decision-4 (réponse sur request-5) soit matérialisée maintenant que l'ordre existe.
3. Dérouler la suite autorisée : incréments suivants (écrans par pompe, contrôles, recopie, file OCR et
   repli manuel, brouillons, GNR), sur Test et la branche seulement. Aucune PR `main`/`production`.
