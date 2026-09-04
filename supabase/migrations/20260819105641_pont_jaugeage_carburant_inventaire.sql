-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260819105641 · pont_jaugeage_carburant_inventaire
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- ============================================================
-- NEXUS — Pont Jaugeage carburant Inventaire → Carburants (19/08/2026)
-- ============================================================
-- Demande de Frédéric : le pompiste du Quart 1 doit pouvoir saisir le
-- jaugeage physique d'ouverture directement dans son parcours Inventaire ;
-- cette saisie unique alimente ensuite carburant_releves (Article 11 :
-- Inventaire déclenche l'action, mais la donnée va dans le domaine
-- Carburants qui la possède légitimement, jamais une deuxième vérité).
--
-- 1) Feature flag site (pattern station_config.pointage_actif).
-- 2) Colonne `origine` sur carburant_releves/carburant_releve_versions —
--    comble le gap documenté dans nexus-carburant-moteur.js:601-614
--    ("granularité sans horodatage précis... ouvert pour un sprint
--    ultérieur si Frédéric confirme le besoin"). L'heure exacte n'a PAS
--    besoin d'une nouvelle colonne : carburant_releve_versions.cree_le
--    la capture déjà à chaque version, on la relit plutôt que de la
--    dupliquer.
-- 3) RLS carburant_releves/carburant_releve_versions actuellement
--    manager/gerant UNIQUEMENT (current_employee_role() = employees.role,
--    le rôle FIXE, jamais le rôle du jour) : un employé assigné pompiste
--    aujourd'hui (table shifts.role, choisi à la prise de poste) ne
--    pourrait pas écrire son propre jaugeage sans cette extension.
-- 4) Table carburant_jaugeage_statuts_jour : trace le fait "le contrôle
--    d'ouverture du jour a-t-il eu lieu, et comment" (fait / impossible +
--    motif) — distinct de carburant_releves qui porte les VALEURS
--    mesurées. Permet à Inventaire de ne plus relancer le pompiste une
--    fois fait, et au manager de voir "non réalisé — provisoire" même
--    quand aucune valeur n'a pu être saisie.
-- ============================================================

-- --- 1) Feature flag ------------------------------------------------
ALTER TABLE station_config
  ADD COLUMN IF NOT EXISTS jaugeage_carburant_actif boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN station_config.jaugeage_carburant_actif IS
  'Si true, le pompiste du Quart 1 voit le bloc "Jaugeage carburants — ouverture" dans son parcours Inventaire avant le parcours normal, et sa saisie alimente directement carburant_releves. Si false (défaut), aucun changement de comportement : le manager continue de saisir seul sur NEXUS-Carburants-v1.html.';

-- --- 2) Origine (qui/comment) sur le relevé du jour ------------------
ALTER TABLE carburant_releves
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'manager'
    CHECK (origine IN ('manager', 'terrain_pompiste'));
COMMENT ON COLUMN carburant_releves.origine IS
  'Origine de la version actuellement retenue (mirroir de carburant_releve_versions.origine pour la version en cours) : terrain_pompiste = saisie par le pompiste du Quart 1 via Inventaire (pont), manager = saisie manuelle habituelle sur NEXUS-Carburants-v1.html.';

ALTER TABLE carburant_releve_versions
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'manager'
    CHECK (origine IN ('manager', 'terrain_pompiste'));
COMMENT ON COLUMN carburant_releve_versions.origine IS
  'Origine de CETTE version précise (append-only) : terrain_pompiste ou manager. L''heure exacte de la saisie est cree_le sur cette même ligne — ne pas dupliquer un horodatage ailleurs.';

-- --- 3) RLS : autoriser le pompiste du jour (shifts.role, pas le rôle fixe) ---
CREATE OR REPLACE FUNCTION public.est_pompiste_du_jour(p_site text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  select exists (
    select 1 from shifts
    where employee_id = auth.uid()
      and site = p_site
      and role = 'pompiste'
      and heure_debut::date = current_date
  );
$$;
COMMENT ON FUNCTION public.est_pompiste_du_jour(text) IS
  'Vrai si l''employé authentifié a un shift ouvert aujourd''hui avec role=pompiste sur ce site (assignation du JOUR via prise de poste, distincte du rôle fixe employees.role lu par current_employee_role()). Sert de garde RLS pour le pont Jaugeage carburant (bloc Inventaire Q1).';

DROP POLICY IF EXISTS ecriture_manager_meme_site ON carburant_releves;
CREATE POLICY ecriture_manager_meme_site ON carburant_releves
  FOR INSERT
  WITH CHECK (
    site = current_employee_site_id()
    AND (
      current_employee_role() = ANY (ARRAY['manager','gerant'])
      OR est_pompiste_du_jour(site)
    )
  );

DROP POLICY IF EXISTS modification_manager_meme_site ON carburant_releves;
CREATE POLICY modification_manager_meme_site ON carburant_releves
  FOR UPDATE
  USING (
    site = current_employee_site_id()
    AND (
      current_employee_role() = ANY (ARRAY['manager','gerant'])
      OR est_pompiste_du_jour(site)
    )
  );

DROP POLICY IF EXISTS ecriture_manager_meme_site ON carburant_releve_versions;
CREATE POLICY ecriture_manager_meme_site ON carburant_releve_versions
  FOR INSERT
  WITH CHECK (
    site = current_employee_site_id()
    AND (
      current_employee_role() = ANY (ARRAY['manager','gerant'])
      OR est_pompiste_du_jour(site)
    )
  );

-- --- 4) Statut du contrôle d'ouverture du jour -----------------------
CREATE TABLE IF NOT EXISTS carburant_jaugeage_statuts_jour (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site text NOT NULL,
  date date NOT NULL,
  statut text NOT NULL CHECK (statut IN ('fait', 'impossible')),
  motif_impossible text CHECK (motif_impossible IN ('equipement_indisponible', 'acces_impossible', 'autre') OR motif_impossible IS NULL),
  commentaire text,
  declare_par uuid,
  cree_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site, date)
);
COMMENT ON TABLE carburant_jaugeage_statuts_jour IS
  'Un enregistrement par (site, date) : le contrôle d''ouverture du jour a-t-il eu lieu (fait, alors un carburant_releves existe pour ce jour) ou a-t-il été déclaré impossible (motif obligatoire, aucune valeur physique disponible) ? Distinct de carburant_releves qui porte les valeurs mesurées elles-mêmes.';

ALTER TABLE carburant_jaugeage_statuts_jour ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_carburant_jaugeage_statuts_jour ON carburant_jaugeage_statuts_jour
  FOR SELECT
  USING (
    site = current_employee_site_id()
    OR (je_suis_createur() AND EXISTS (SELECT 1 FROM sites s WHERE s.site_id = carburant_jaugeage_statuts_jour.site AND s.acces_createur_autorise = true))
  );

CREATE POLICY ecriture_carburant_jaugeage_statuts_jour ON carburant_jaugeage_statuts_jour
  FOR INSERT
  WITH CHECK (
    site = current_employee_site_id()
    AND (
      current_employee_role() = ANY (ARRAY['manager','gerant'])
      OR est_pompiste_du_jour(site)
    )
  );

CREATE POLICY modification_carburant_jaugeage_statuts_jour ON carburant_jaugeage_statuts_jour
  FOR UPDATE
  USING (
    site = current_employee_site_id()
    AND (
      current_employee_role() = ANY (ARRAY['manager','gerant'])
      OR est_pompiste_du_jour(site)
    )
  );
