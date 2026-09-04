-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260813140027 · fdj_alertes_chaine_interrompue
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 13/08/2026, demande de Frédéric (capture d'écran : Samantha du 13/08 Q1
-- comparée à tort au 10/08 Q2, 3 jours de quarts manquants entre les deux,
-- ce qui a généré 15 fausses alertes "stock initial modifié" jeu par jeu).
-- Nouveau type d'alerte "chaine_interrompue" : UNE alerte racine au niveau
-- du quart (pas du jeu) quand le dernier quart validé retrouvé n'est pas le
-- quart immédiatement précédent. game_id devient nullable car cette alerte
-- ne porte pas sur un jeu en particulier.
ALTER TABLE fdj_alertes ALTER COLUMN game_id DROP NOT NULL;

ALTER TABLE fdj_alertes DROP CONSTRAINT fdj_alertes_type_check;
ALTER TABLE fdj_alertes ADD CONSTRAINT fdj_alertes_type_check
  CHECK (type = ANY (ARRAY['stock_initial_modifie'::text, 'activation_sans_carnet_confie'::text, 'chaine_interrompue'::text]));

ALTER TABLE fdj_alertes ADD COLUMN quarts_manquants jsonb;
COMMENT ON COLUMN fdj_alertes.quarts_manquants IS 'Liste [{date,quart}] des quarts manquants entre le dernier quart validé retrouvé et le quart actuel — uniquement pour type=chaine_interrompue.';
