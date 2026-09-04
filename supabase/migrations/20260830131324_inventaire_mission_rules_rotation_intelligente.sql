-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830131324 · inventaire_mission_rules_rotation_intelligente
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Rotation intelligente missions, Étape 2 "données" (30/08/2026, demande de
-- Frédéric — voir Data Dictionary v2.301/v2.303). Le mode_selection
-- 'intelligent' a été ajouté au moteur pur (nexus-inventaire-moteur.js,
-- v2.301) mais la contrainte CHECK existante sur cette colonne ne
-- l'autorisait pas encore -- sans ce correctif, tenter de régler une
-- mission_rule sur 'intelligent' depuis l'écran Paramètres (Étape 3, à
-- venir) aurait échoué au niveau base de données. inclure_surprise et
-- nombre_surprises sont les deux nouveaux paramètres validés explicitement
-- par Frédéric ("je valide : mode_selection = intelligent, inclure_surprise,
-- nombre_surprises") -- AUCUN champ délai max n'est ajouté ici, le délai
-- continue de venir exclusivement de inventaire_regles_produit /
-- inventaire_categories (Article 11, demande explicite de Frédéric).

alter table inventaire_mission_rules
  drop constraint inventaire_mission_rules_mode_selection_check;

alter table inventaire_mission_rules
  add constraint inventaire_mission_rules_mode_selection_check
  check (mode_selection = any (array['complet'::text, 'tournant'::text, 'cible'::text, 'intelligent'::text]));

alter table inventaire_mission_rules
  add column if not exists inclure_surprise boolean not null default false;

alter table inventaire_mission_rules
  add column if not exists nombre_surprises integer;

comment on column inventaire_mission_rules.inclure_surprise is 'Rotation intelligente (mode_selection=intelligent) : si vrai, ajoute des références "surprise" déterministes au périmètre calculé par construirePlanComptage. Sans effet sur les autres modes.';
comment on column inventaire_mission_rules.nombre_surprises is 'Nombre de références surprise à tirer si inclure_surprise=true (défaut 1 si null). Sans effet sur les autres modes.';
