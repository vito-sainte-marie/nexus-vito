-- Retour arrière de 20261127160000_objectifs_r1_schema_habilitation.sql.
-- Ordre inverse de la création. Le trigger d'immuabilité est ôté d'abord : avec
-- des lignes officielles présentes, il refuserait toute suppression de ligne.
drop view if exists public.objectif_officiel;
drop trigger if exists station_objectifs_immuable on public.station_objectifs;
drop policy if exists so_lecture on public.station_objectifs;
drop policy if exists oh_lecture on public.objectif_habilitation;
drop policy if exists oc_lecture on public.objectif_catalogue;
drop table if exists public.station_objectifs;
drop table if exists public.objectif_habilitation;
drop table if exists public.objectif_catalogue;
drop function if exists public.objectif_habilite(text, text);
drop function if exists public.station_objectifs_immuable();
