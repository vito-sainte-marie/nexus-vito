-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260820152614 · fix_update_carburant_reception_visites_pompiste
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- Correctif (20/08/2026, demande de Frédéric : réception de Dylan invisible
-- dans "dernière livraison") : la policy UPDATE de carburant_reception_visites
-- ne permettait qu'aux managers/gérants de poser le statut final ('terminee'),
-- alors que nexus-reception-donnees.js (soumettreVisiteComplete) exige que
-- l'employé qui vient de saisir la visite (souvent un pompiste) pose lui-même
-- ce statut final juste après l'insertion des lignes/compartiments/mesures.
-- Résultat : toute visite saisie par un pompiste restait bloquée à
-- statut='en_cours' (l'UPDATE ne levait aucune erreur côté Supabase-js,
-- juste 0 ligne modifiée), et donc exclue de chargerDerniereVisite/
-- chargerHistoriqueVisites (voir commentaire dans nexus-reception-donnees.js).
-- Même règle que carburant_releves.modification_manager_meme_site et
-- carburant_jaugeage_statuts_jour.modification_carburant_jaugeage_statuts_jour :
-- manager/gérant du site, OU pompiste du jour sur ce site.
drop policy if exists update_carburant_reception_visites on public.carburant_reception_visites;
create policy update_carburant_reception_visites on public.carburant_reception_visites
  for update
  using (
    (site = current_employee_site_id())
    and (
      (current_employee_role() = ANY (ARRAY['manager'::text, 'gerant'::text]))
      or est_pompiste_du_jour(site)
    )
  );
