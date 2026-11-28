-- Retour arrière de 20261128100000_objectifs_a4_1d_perimetre_exclu.sql.
-- Les exclusions posées (actives ou annulées) sont perdues avec la table : les exporter avant si utile.
drop trigger if exists tarif_seuils_rayon_exclu on public.tarif_seuils;
drop function if exists public.tarif_seuils_rayon_exclu_garde();
drop function if exists public.retirer_perimetre_exclu(uuid, text);
drop function if exists public.declarer_perimetre_exclu(text, text, text);
drop table if exists public.tarif_perimetre_exclu;
