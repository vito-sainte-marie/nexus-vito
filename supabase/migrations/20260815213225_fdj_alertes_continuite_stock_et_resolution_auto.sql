-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260815213225 · fdj_alertes_continuite_stock_et_resolution_auto
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 16/08/2026, demande de Frédéric : l'alerte "chaîne interrompue" ne doit
-- jamais rester un statut figé. On distingue désormais deux choses sur
-- fdj_alertes qui étaient jusqu'ici confondues :
--   - vue/vue_par/vue_le : le MANAGER a pris connaissance de l'alerte
--     (acquittement humain, inchangé).
--   - resolue_automatiquement/resolue_le : NEXUS a constaté que le
--     problème signalé n'existe plus (ex: le quart manquant a été
--     complété, la chaîne est redevenue intacte) — jamais posé par un
--     humain, jamais par un simple clic, uniquement par un recalcul.
-- Une alerte 'chaine_interrompue' résolue automatiquement n'est plus
-- affichée comme active, mais la ligne reste en base (aucun historique
-- supprimé) — elle sert de trace "détectée le ... / rétablie le ...".
--
-- Nouveau type 'continuite_stock_a_verifier' : quand la chaîne temporelle
-- est rétablie mais que le stock final du quart précédent ne correspond
-- plus au stock initial du quart suivant, ce n'est plus un problème de
-- CHAÎNE (elle est intacte) mais un problème de STOCK — anomalie
-- distincte, jamais confondue avec "chaîne interrompue".

alter table fdj_alertes
  add column resolue_automatiquement boolean not null default false,
  add column resolue_le timestamptz null;

alter table fdj_alertes drop constraint fdj_alertes_type_check;
alter table fdj_alertes add constraint fdj_alertes_type_check
  check (type = any (array['stock_initial_modifie'::text, 'activation_sans_carnet_confie'::text, 'chaine_interrompue'::text, 'continuite_stock_a_verifier'::text]));
