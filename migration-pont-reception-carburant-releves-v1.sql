-- ============================================================
-- NEXUS — Pont Réception carburant → Carburants (stock) (21/08/2026)
-- ============================================================
-- Constat de Frédéric : une livraison est bien enregistrée (visite
-- carburant_reception_visites terminée, jaugeage avant/après capturé dans
-- carburant_reception_mesures) mais n'apparaît jamais dans le "stock"
-- affiché par Carburants Pilotage, qui lit exclusivement carburant_releves.
-- Aucun pont n'existait entre les deux modules (contrairement au pont
-- Jaugeage Inventaire → Carburants du 19/08/2026, qui ne couvre QUE le
-- jaugeage d'ouverture du pompiste Q1, pas la réception de livraison).
--
-- Même principe que le pont existant (Article 11) : la logique de
-- versionnement (prochaineVersionReleveCarburant/diffReleveCarburant) reste
-- entièrement dans le moteur JS partagé, jamais réimplémentée ici. Cette
-- migration ne fait que :
-- 1) Élargir origine (carburant_releves / carburant_releve_versions) pour
--    accueillir 'reception_livraison'.
-- 2) Ajouter une colonne de traçabilité visite_reception_id sur la couche
--    de preuve append-only (carburant_releve_versions) — jamais sur
--    carburant_releves qui est une vue courante mutable.
-- 3) Étendre RLS : l'employé qui vient de terminer une réception carburant
--    pour (site, date) peut écrire dans carburant_releves/versions pour ce
--    même (site, date) — même mécanisme que est_pompiste_du_jour, mais basé
--    sur "j'ai terminé une visite de réception ce jour-là", pas sur un rôle
--    de shift. La réception carburant est ouverte à 'employe' par défaut
--    (station_config.reception_carburant_role) : le rôle fixe manager/gerant
--    ne suffit donc pas à couvrir qui doit pouvoir écrire ce relevé.
-- ============================================================

-- --- 1) origine : accueillir 'reception_livraison' -------------------
ALTER TABLE carburant_releves DROP CONSTRAINT IF EXISTS carburant_releves_origine_check;
ALTER TABLE carburant_releves ADD CONSTRAINT carburant_releves_origine_check
  CHECK (origine IN ('manager', 'terrain_pompiste', 'reception_livraison'));

ALTER TABLE carburant_releve_versions DROP CONSTRAINT IF EXISTS carburant_releve_versions_origine_check;
ALTER TABLE carburant_releve_versions ADD CONSTRAINT carburant_releve_versions_origine_check
  CHECK (origine IN ('manager', 'terrain_pompiste', 'reception_livraison'));

-- --- 2) Traçabilité : quelle visite de réception a produit CETTE version ---
ALTER TABLE carburant_releve_versions
  ADD COLUMN IF NOT EXISTS visite_reception_id uuid REFERENCES carburant_reception_visites(id);

COMMENT ON COLUMN carburant_releve_versions.visite_reception_id IS
  'Renseigné uniquement quand origine=reception_livraison : id de la visite carburant_reception_visites dont le jaugeage après-livraison a produit cette version. Sert aussi de clé d''idempotence (une même visite ne doit jamais alimenter deux fois livraison_*, qui est un champ additif).';

CREATE INDEX IF NOT EXISTS idx_carburant_releve_versions_visite_reception
  ON carburant_releve_versions (visite_reception_id) WHERE visite_reception_id IS NOT NULL;

-- --- 3) RLS : autoriser le réceptionnaire du jour ---------------------
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
