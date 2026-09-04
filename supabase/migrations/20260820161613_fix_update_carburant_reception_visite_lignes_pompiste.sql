-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260820161613 · fix_update_carburant_reception_visite_lignes_pompiste
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- R8 différé (audit RLS, 20/08/2026) : carburant_reception_visite_lignes avait
-- le même écart structurel INSERT-permissif / UPDATE-manager-seul que
-- carburant_reception_visites (corrigé le même jour, v2.177). Pas d'appel
-- .update() sur cette table côté code aujourd'hui donc pas de bug vécu, mais
-- corrigé par cohérence (Article 11) et en prévention d'un futur correctif
-- terrain sur les lignes de réception qui reproduirait le même blocage
-- silencieux pour un pompiste.
drop policy if exists update_carburant_reception_visite_lignes on carburant_reception_visite_lignes;
create policy update_carburant_reception_visite_lignes on carburant_reception_visite_lignes
  for update
  using (
    (site = current_employee_site_id())
    and (
      (current_employee_role() = ANY (ARRAY['manager'::text, 'gerant'::text]))
      or est_pompiste_du_jour(site)
    )
  );
