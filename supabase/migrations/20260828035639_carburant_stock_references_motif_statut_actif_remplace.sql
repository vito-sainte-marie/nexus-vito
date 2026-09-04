-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260828035639 · carburant_stock_references_motif_statut_actif_remplace
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 27/08/2026, refonte qualitative Carburants (point 19, demande de
-- Frédéric) : "Un point zéro certifié doit contenir : date, heure,
-- utilisateur, source, volumes par carburant, motif, statut actif/
-- remplacé, éventuelle justification. Une correction ou un nouveau point
-- zéro ne doit jamais supprimer l'ancien. NEXUS doit avoir une chaîne
-- d'audit immuable." La chaîne immuable existe déjà (insert-only, jamais
-- de delete/update destructif) — il manquait : un motif obligatoire
-- (aujourd'hui seulement une "note" facultative), un statut explicite
-- actif/remplacé (aujourd'hui toujours 'valide', jamais retourné à
-- 'remplacé' quand un nouveau point zéro le supplante), et un lien vers
-- la référence précédente (sur le modèle déjà existant pour FDJ,
-- fdj_stock_references.reference_precedente_id, task #145 — Article 11).
alter table public.carburant_stock_references add column if not exists motif text;
alter table public.carburant_stock_references add column if not exists reference_precedente_id uuid references public.carburant_stock_references(id);

-- Les lignes historiques ('valide', valeur unique jamais réutilisée
-- ailleurs dans le code ni affichée à l'écran — vérifié, aucune régression)
-- deviennent 'actif' : elles étaient bien la référence en vigueur au
-- moment de leur certification.
update public.carburant_stock_references set statut = 'actif' where statut = 'valide';
alter table public.carburant_stock_references alter column statut set default 'actif';
alter table public.carburant_stock_references add constraint carburant_stock_references_statut_check
  check (statut = any (array['actif'::text, 'remplace'::text]));
