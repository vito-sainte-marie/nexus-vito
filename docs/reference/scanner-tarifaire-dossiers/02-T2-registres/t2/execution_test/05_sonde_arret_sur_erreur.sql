-- Sonde d'arrêt sur erreur du canal réellement utilisé (envoi de migration Supabase), projet Test uniquement.
-- À envoyer UNE fois, avant la migration 100000, sous le nom tarif_sonde_arret_sur_erreur. Elle échoue toujours.
-- Canal sûr si, après l'échec : la table tarif_sonde_atomicite n'existe pas ET aucune migration tarif_sonde_arret_sur_erreur
-- n'est enregistrée (contrôle 06, lecture seule). Sinon : arrêt, aucune migration T2 envoyée par ce canal.
-- GARDE PROJET TEST (obligatoire, en tête de transaction). Identité vérifiée : l'identifiant système du cluster
-- PostgreSQL, fixé à sa création et propre au projet Supabase Test udljdqxerrbbbajxubfn (relu le 16/11/2026).
-- Toute autre base, Production comprise, est refusée avant la moindre écriture. Seconde vérification : sites de recette.
do $garde$
declare v_sysid bigint := (select system_identifier from pg_control_system());
begin
  if v_sysid is distinct from 7678069749886157684 then
    raise exception 'garde_projet_test : identifiant système % : ce n est pas le projet Supabase Test udljdqxerrbbbajxubfn', v_sysid;
  end if;
  if (select count(*) from public.sites where site_id in ('site-fantome-test', 'nexus-station-test')) <> 2 then
    raise exception 'garde_projet_test : sites de recette absents';
  end if;
end $garde$;
create table public.tarif_sonde_atomicite (id int);
select 1 / 0;
