-- Retour arrière de 20261013140000 (versements groupés). SANS PERTE seulement si la table des groupes est vide :
-- le garde de l'étape (5) refuse sinon, et la transaction entière est annulée. Rejoué le 13/10/2026 sur un conteneur
-- jetable : catalogue public (fonctions, droits, triggers, colonnes, contraintes, index, policies) identique à l'état d'avant.
begin;
-- (1) RPC et fonctions d'appui ajoutées par 20261013140000 (sauf _regul_tiroir_detail, recréée en (2))
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('enregistrer_versement_groupe','affecter_surplus_groupe','annuler_versement_groupe',
                               'enregistrer_transfert_coffre_groupe','ecarts_ouverts_employe','versements_groupes',
                               '_groupe_valider_affectations','_groupe_inserer_affectations')
  loop execute 'drop function ' || r.sig; end loop;
end $$;
-- (2) _regul_tiroir_detail telle que dans 20261008160000
create or replace function public._regul_tiroir_detail(p_site text, p_tiroir text, p_date date, p_quart text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ops as (
    select v.mode_encaissement as mode, v.montant as entree, 0::numeric as sortie
      from public.ecarts_versements_regularisation v
     where v.site = p_site and v.destination = p_tiroir
       and v.recepteur_date = p_date and v.recepteur_quart = p_quart
       and v.annule_le is null
    union all
    select r.mode_restitution, 0, r.montant
      from public.ecarts_restitutions_trop_percu r
     where r.site = p_site and r.source = p_tiroir
       and r.source_date = p_date and r.source_quart = p_quart
       and r.annule_le is null
    union all
    select coalesce(v.mode_encaissement, 'sans_mode'), 0, t.montant
      from public.caisse_transferts_coffre t
      left join public.ecarts_versements_regularisation v on v.id = t.versement_id
     where t.site = p_site and t.source = p_tiroir
       and t.source_date = p_date and t.source_quart = p_quart
       and t.annule_le is null
  ), par_mode as (
    select mode, sum(entree) as entrees, sum(sortie) as sorties
      from ops group by mode
  )
  select jsonb_build_object(
    'tiroir',  p_tiroir,
    'net',     coalesce((select sum(entrees - sorties) from par_mode), 0),
    'entrees', coalesce((select sum(entrees) from par_mode), 0),
    'sorties', coalesce((select sum(sorties) from par_mode), 0),
    'par_mode', coalesce((select jsonb_object_agg(mode, jsonb_build_object(
                    'entrees', entrees, 'sorties', sorties, 'net', entrees - sorties)
                  order by mode) from par_mode), '{}'::jsonb));
$$;

-- (3) triggers de §3 puis leurs fonctions
drop trigger evr_groupe_controle on public.ecarts_versements_regularisation;
drop trigger evr_a_groupe_annulation on public.ecarts_versements_regularisation;
drop trigger ctc_groupe_controle on public.caisse_transferts_coffre;
drop function public._evr_groupe_controle();
drop function public._evr_groupe_annulation();
drop function public._ctc_groupe_controle();
-- (4) colonnes groupe_id (et le CHECK)
alter table public.caisse_transferts_coffre drop constraint ctc_versement_ou_groupe;
alter table public.caisse_transferts_coffre drop column groupe_id;
alter table public.ecarts_versements_regularisation drop column groupe_id;
-- (5) table des groupes, seulement si vide
do $$ begin
  if exists (select 1 from public.versements_regularisation_groupes) then
    raise exception 'retour arrière refusé : la table des groupes n''est pas vide';
  end if;
end $$;
drop table public.versements_regularisation_groupes;
commit;
