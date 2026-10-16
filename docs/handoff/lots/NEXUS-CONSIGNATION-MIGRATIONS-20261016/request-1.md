---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONSIGNATION-MIGRATIONS-20261016
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
  - id: blob-quart
    classe: VERIFIED
    valeur: d7ac18acd2cb8b82d606f52e6c35ac71346df4e2
  - id: blob-poste-frequent
    classe: VERIFIED
    valeur: e256f0421daea4c132b302768a6a592907d68d68
  - id: registre-production
    classe: VERIFIED
    valeur: 314 apres 20261016090000, 315 apres 20261016120000
---
# Consignation — migrations Production du 16/10/2026 (changement de quart, poste le plus fréquent)

Auteur : Claude. Cette demande **consigne des faits déjà accomplis** ; elle ne demande aucune autorisation de geste Production et n'en donne aucune.

## Pourquoi un lot distinct

Le lot `NEXUS-QUART-QUALIF-20261016` est clos (decision-1, `closes: true`) : on n'y ajoute rien. L'application de la migration en Production n'avait été consignée ni sur le rail ni sur #28 (relevé de Frédéric, 16/10). Ce lot comble ce trou.

## Faits

### `20261016090000_changement_de_quart_atomique.sql` (PR #131)
- Appliquée en Production `uzhjpqpctpvxytxpxoqz` sur « go migration Production » de Frédéric, **avant** la fusion de la PR #131 (ordre migration, contrôles, puis code, conforme à la procédure `docs/deploiement/promotion-changement-de-quart-production-20261016.md` §3).
- Chemin : connecteur Supabase `execute_sql`, une transaction (`begin;` + migration + insert dans `supabase_migrations.schema_migrations` + `commit;`), jamais `apply_migration`.
- Préflight en lecture seule conforme (fonction absente, md5 du déclencheur P-1 `1888968bc2138557fab6d10601a1715f`).
- Contrôles après : `nexus_changer_de_quart` présente, SECURITY INVOKER, `anon` fermé, `authenticated` ouvert ; le déclencheur lit `nexus.changement_quart_employe` ; `shifts` = 309 lignes et `en_cours` = 6, inchangés ; registre à 314.
- Blob de la migration qualifié : `d7ac18acd2cb8b82d606f52e6c35ac71346df4e2`.
- Limite d'honnêteté : l'heure exacte d'inscription au registre n'est pas lisible ; l'ordre repose sur la séquence des gestes de la session, pas sur un horodatage mesuré.

### `20261016120000_poste_le_plus_frequent.sql` (lot B, PR #132)
- Appliquée en Production sur « go migration Production pour le lot B », avant la fusion de la PR #132 (merge `d4c271fe`, sur « go fusion de la PR #132 »), puis déploiement Pages sur « go déploiement de la PR #132 » (run 38894862888, réussi).
- Même chemin `execute_sql`, une transaction ; registre 315 ; `pg_proc public.poste_le_plus_frequent` présente, SECURITY INVOKER, `anon` fermé, `authenticated` ouvert.
- Blob : `e256f0421daea4c132b302768a6a592907d68d68`. Fiche de qualification `additive_compatible_avant_code` dans `qualification-ordre-migration-code.json`.

## Ce que ce dépôt ne dit pas

- Il ne constate pas la recette navigateur humaine du changement de quart (conditions de decision-1) : elle reste à la charge de Frédéric.
- Il n'autorise aucune migration, fusion ni déploiement supplémentaire.

## Question posée

Prendre acte de cette consignation et clore le lot (`closes: true`). Aucune autre décision n'est attendue.
