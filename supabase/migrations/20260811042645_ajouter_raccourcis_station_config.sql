-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260811042645 · ajouter_raccourcis_station_config
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Raccourcis configurables (10/08/2026, demande de Frédéric) : "Vos
-- raccourcis" sur NEXUS-App-v1.html était jusqu'ici une liste fixe de 4
-- outils (Cockpit/Verify/Tempo/Produits), codée en dur. Ce champ permet à
-- chaque site de choisir ses propres raccourcis depuis Paramètres Station,
-- sans toucher au code (même esprit que horaires/prix_carburants sur cette
-- même table). NULL = pas encore configuré, l'app retombe alors sur la
-- liste par défaut historique (RACCOURCIS_DEFAUT côté NEXUS-App-v1.html).
-- Stocke un tableau de noms de fichiers .html (ex. ["NEXUS-Cockpit-v2.html", ...]),
-- jamais de logique métier ici — la validation (catalogue autorisé, max 4)
-- se fait côté application.
alter table public.station_config add column if not exists raccourcis jsonb;
comment on column public.station_config.raccourcis is 'Tableau JSON des raccourcis choisis pour "Vos raccourcis" (NEXUS-App-v1.html) — liste de noms de fichiers .html, ex. ["NEXUS-Cockpit-v2.html","NEXUS-Verify-v1.html"]. NULL = non configuré, l''app utilise sa liste par défaut.';
