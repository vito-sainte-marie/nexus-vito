-- v2.237 — Correctif racine : écritures d'inventaire silencieusement perdues
-- (24/08/2026, suite au signalement de Frédéric : "angelique m'a dit qu'elle
-- n'a pas pu valider son inventaire produits hier peut etre dû au stock nul").
--
-- Root cause identifié et reproduit directement en base : ecrireComptageImmediat()
-- et ecrireMouvementImmediat() (NEXUS-Inventaire-v1.html, Sprint 4bis du
-- 18/08/2026) font .upsert(payload, { onConflict: 'idempotency_key' }).
-- Postgres exige une contrainte UNIQUE (ou d'exclusion) réelle sur la colonne
-- cible pour résoudre ON CONFLICT -- elle n'a jamais été créée lors de l'ajout
-- de la colonne idempotency_key. Résultat vérifié en base (24/08/2026,
-- reproduction directe) : CHAQUE écriture immédiate depuis le 18/08/2026 a
-- échoué en 42P10 "no unique or exclusion constraint matching the ON CONFLICT
-- specification", rattrapée silencieusement par le code employé (mise en
-- file d'attente locale au navigateur, jamais synchronisée puisque la
-- resynchronisation retente exactement le même upsert cassé). Confirmé par
-- lecture directe : 0 ligne sur 2626 dans inventaire_comptages et 0/7 dans
-- inventaire_mouvements ne porte de idempotency_key non nul à ce jour -- la
-- voie "écriture immédiate" n'a donc jamais réussi une seule fois depuis sa
-- mise en service. Ce n'était pas un incident isolé d'Angelique : le même
-- symptôme (taps sans comptage, ou quart resté bloqué en
-- statut='ouverture_en_cours') a été retrouvé sur la quasi-totalité des
-- quarts du site vito-sainte-marie depuis le 18/08/2026.
--
-- Un index UNIQUE Postgres traite chaque NULL comme distinct (jamais en
-- conflit entre eux) -- les lignes existantes, toutes à idempotency_key NULL
-- (écrites par l'ancien chemin, avant ce mécanisme), restent donc totalement
-- inchangées par cet ajout. Aucune modification du code applicatif n'était
-- nécessaire : NEXUS-Inventaire-v1.html était correct depuis le départ,
-- seule la contrainte de base manquait.
--
-- Appliquée le 24/08/2026 sur le projet Supabase uzhjpqpctpvxytxpxoqz via
-- apply_migration (nom : ajouter_index_unique_idempotency_key_inventaire).
-- Ce fichier est une copie de traçabilité locale. Vérifiée avant/après par
-- reproduction directe d'un insert ... on conflict (idempotency_key) do
-- nothing (échec 42P10 avant, succès après ; ligne de test supprimée
-- immédiatement après vérification).

create unique index if not exists inventaire_comptages_idempotency_key_key
  on inventaire_comptages (idempotency_key);

create unique index if not exists inventaire_mouvements_idempotency_key_key
  on inventaire_mouvements (idempotency_key);
