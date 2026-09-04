-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260824140817 · ajouter_index_unique_idempotency_key_inventaire
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- v2.237 — Correctif racine : les upserts d'écriture immédiate d'inventaire
-- (nexus-inventaire ecrireComptageImmediat / ecrireMouvementImmediat, Sprint
-- 4bis du 18/08/2026) utilisent .upsert(payload, { onConflict: 'idempotency_key' }).
-- Postgres exige une contrainte UNIQUE (ou d'exclusion) réelle sur la colonne
-- cible pour résoudre ON CONFLICT — elle n'a jamais été créée lors de l'ajout
-- de la colonne idempotency_key. Résultat vérifié en base (24/08/2026,
-- reproduction directe) : CHAQUE écriture immédiate depuis le 18/08/2026 a
-- échoué en 42P10 "no unique or exclusion constraint matching the ON CONFLICT
-- specification", rattrapée silencieusement par le code employé (mise en
-- file d'attente locale au navigateur, jamais synchronisée puisque la
-- resynchronisation retente exactement le même upsert cassé). Confirmé par
-- lecture directe : 0 ligne sur 2626 dans inventaire_comptages et 0/7 dans
-- inventaire_mouvements ne porte de idempotency_key non nul à ce jour — la
-- voie "écriture immédiate" n'a donc jamais réussi une seule fois depuis sa
-- mise en service.
--
-- Un index UNIQUE Postgres traite chaque NULL comme distinct (jamais en
-- conflit entre eux) — les 2626/7 lignes existantes, toutes à
-- idempotency_key NULL (écrites par l'ancien chemin, avant ce mécanisme),
-- restent donc totalement inchangées par cet ajout.
create unique index if not exists inventaire_comptages_idempotency_key_key
  on inventaire_comptages (idempotency_key);

create unique index if not exists inventaire_mouvements_idempotency_key_key
  on inventaire_mouvements (idempotency_key);
