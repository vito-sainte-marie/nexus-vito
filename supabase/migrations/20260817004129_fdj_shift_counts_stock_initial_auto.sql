-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260817004129 · fdj_shift_counts_stock_initial_auto
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 16/08/2026, suite à la demande de Frédéric sur la continuité de chaîne
-- FDJ : "Recalculer et réécrire automatiquement" les écarts après
-- rétablissement d'une chaîne rompue, MAIS sans jamais écraser une valeur
-- de stock_initial qu'un humain (employé ou manager) a délibérément tapée
-- ou confirmée à l'écran. Ce booléen distingue les deux cas :
--   true  = stock_initial actuellement affiché = hérité automatiquement du
--           quart précédent, jamais confirmé/modifié par un humain -> NEXUS
--           peut le corriger tout seul si le quart précédent est recalculé
--           après rétablissement de la chaîne (voir reconcilierAlertesChaine,
--           NEXUS-FDJ-Manager-v1.html).
--   false = un humain a explicitement saisi ou confirmé cette valeur -> NEXUS
--           ne la touche jamais automatiquement ; en cas d'écart détecté
--           après rétablissement, l'alerte 'continuite_stock_a_verifier'
--           existante reste posée pour arbitrage manager (comportement
--           inchangé, aucune régression).
-- Défaut false sur les lignes déjà existantes : rollout sûr, aucune
-- reconstitution rétroactive d'un historique dont la provenance réelle
-- (auto vs humaine) n'est pas connue avec certitude.
alter table fdj_shift_counts
  add column stock_initial_auto boolean not null default false;

comment on column fdj_shift_counts.stock_initial_auto is
  'true = stock_initial hérité automatiquement du quart précédent et jamais confirmé par un humain (éligible à la réécriture automatique lors du rétablissement de chaîne) ; false = saisi/confirmé par un humain (jamais réécrit automatiquement, alerte continuite_stock_a_verifier posée à la place).';
