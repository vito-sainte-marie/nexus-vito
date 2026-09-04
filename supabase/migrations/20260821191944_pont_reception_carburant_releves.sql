-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260821191944 · pont_reception_carburant_releves
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 1) origine : accueillir 'reception_livraison'
ALTER TABLE carburant_releves DROP CONSTRAINT IF EXISTS carburant_releves_origine_check;
ALTER TABLE carburant_releves ADD CONSTRAINT carburant_releves_origine_check
  CHECK (origine IN ('manager', 'terrain_pompiste', 'reception_livraison'));

ALTER TABLE carburant_releve_versions DROP CONSTRAINT IF EXISTS carburant_releve_versions_origine_check;
ALTER TABLE carburant_releve_versions ADD CONSTRAINT carburant_releve_versions_origine_check
  CHECK (origine IN ('manager', 'terrain_pompiste', 'reception_livraison'));

-- 2) Traçabilité
ALTER TABLE carburant_releve_versions
  ADD COLUMN IF NOT EXISTS visite_reception_id uuid REFERENCES carburant_reception_visites(id);

COMMENT ON COLUMN carburant_releve_versions.visite_reception_id IS
  'Renseigné uniquement quand origine=reception_livraison : id de la visite carburant_reception_visites dont le jaugeage après-livraison a produit cette version. Sert aussi de clé d''idempotence (une même visite ne doit jamais alimenter deux fois livraison_*, qui est un champ additif).';

CREATE INDEX IF NOT EXISTS idx_carburant_releve_versions_visite_reception
  ON carburant_releve_versions (visite_reception_id) WHERE visite_reception_id IS NOT NULL;

-- 3) RLS : autoriser le réceptionnaire du jour
CREATE OR REPLACE FUNCTION public.est_receptionniste_livraison_du_jour(p_site text, p_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  select exists (
    select 1 from carburant_reception_visites v
    where v.employe_id = auth.uid()
      and v.site = p_site
      and v.date_visite = p_date
      and v.statut in ('terminee', 'terminee_avec_derogation')
  );
$$;
COMMENT ON FUNCTION public.est_receptionniste_livraison_du_jour(text, date) IS
  'Vrai si l''employé authentifié a terminé (avec ou sans dérogation tracée) une visite de réception carburant sur ce site à cette date. Sert de garde RLS pour le pont Réception → Carburants : ne dépend pas d''un rôle de shift fixe, la réception carburant pouvant être ouverte à tout employé (station_config.reception_carburant_role).';

DROP POLICY IF EXISTS ecriture_manager_meme_site ON carburant_releves;
CREATE POLICY ecriture_manager_meme_site ON carburant_releves
  FOR INSERT
  WITH CHECK (
    site = current_employee_site_id()
    AND (
      current_employee_role() = ANY (ARRAY['manager','gerant'])
      OR est_pompiste_du_jour(site)
      OR est_receptionniste_livraison_du_jour(site, date)
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
      OR est_receptionniste_livraison_du_jour(site, date)
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
      OR est_receptionniste_livraison_du_jour(site, date)
    )
  );
