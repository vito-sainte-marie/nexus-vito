---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONSIGNATION-MIGRATION-LOTC-20261016
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=55285d8b production=d4c271fe
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 153-fichiers
  - id: blob-lotc
    classe: VERIFIED
    valeur: 46804ad69135ed3072002658fbe0cdf35fcbc61f
  - id: registre-production
    classe: VERIFIED
    valeur: 316 apres 20261016150000
---
# Consignation — migration Production du 16/10/2026 (lot C, « Dernier poste »)

Auteur : Claude. Cette demande **consigne un fait déjà accompli** ; elle ne demande aucune autorisation de geste Production et n'en donne aucune.

## Pourquoi un lot distinct

Le lot `NEXUS-CONSIGNATION-MIGRATIONS-20261016` est clos (decision-1 APPROVED, `closes: true`) : on n'y ajoute rien. Ce lot consigne l'application de la migration du lot C.

## Faits

- Migration `20261016150000_poste_dernier_sous_seuil.sql` (PR #133, blob `46804ad69135ed3072002658fbe0cdf35fcbc61f`) appliquée en Production `uzhjpqpctpvxytxpxoqz` le 16/10/2026, après l'instruction explicite de Frédéric « go migration Production pour le lot C ».
- Geste : connecteur Supabase `execute_sql`, une seule transaction (`begin` + DDL + insertion dans `supabase_migrations.schema_migrations` + `commit`). `apply_migration` non utilisé.
- Préflight (lecture seule) conforme : registre 315, empreinte md5 de `poste_le_plus_frequent` = `d8d429a18a28c3c7913aa37a096be79d`, quarts 310, `en_cours` 6.
- Post-contrôles (lecture seule) : registre 316 et ligne présente ; SECURITY INVOKER ; STABLE ; la définition contient `dernier_poste` ; `anon` sans EXECUTE ; `authenticated` avec EXECUTE ; quarts 310 et `en_cours` 6 inchangés.
- Ordre respecté : migration **avant** tout code. La PR #133 n'est **pas fusionnée**, Pages n'est **pas déployé**, `production` reste à `d4c271fe`.
- Qualification : `docs/deploiement/qualification-ordre-migration-code.json` (état `atomique_ou_procedure_speciale`) et dossier `docs/deploiement/promotion-dernier-poste-production-20261016.md` ; CI de #133 verte sur `faa0a9d9`.

## Ce que ce dépôt ne dit pas

- L'horodatage exact de l'enregistrement au registre n'a pas été relu.
- La recette navigateur humaine n'est pas faite.
- Aucune autorisation de fusion ni de déploiement n'existe. Tant que le code n'est pas déployé, l'ancien code Production n'affiche rien pour l'état `dernier_poste`.

## Question posée

Prendre acte de cette consignation et clore le lot (`closes: true`). Aucun geste Production n'est demandé.
