-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260726061316 · ajouter_forfait_sites
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table sites
  add column forfait text not null default 'essential'
  check (forfait in ('essential', 'professional'));
comment on column sites.forfait is 'Forfait NEXUS attribué au site : essential (Cockpit, Produits, Rayon, Centre d''Intelligence NEXUS, Scanner Stock, Import, Paramètres Station, Nexus Verify, Missions) ou professional (toutes les fonctionnalités). Attribué exclusivement par le créateur depuis NEXUS-Admin-Sites-v1.html.';
-- Vito Sainte-Marie utilise déjà Capital NEXUS, Nexus Planner, NEXUS Tempo,
-- Campagne NEXUS et Scanner Stock en conditions réelles (offre Professional
-- confirmée par Frédéric le 24/07/2026, 399€ HT/mois) : on l'aligne
-- immédiatement pour ne rien lui retirer au moment d'activer le contrôle.
update sites set forfait = 'professional' where site_id = 'vito-sainte-marie';
