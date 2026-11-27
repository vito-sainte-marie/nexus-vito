-- Objectifs de marge (A4-1b) : proposer et valider une marge cible sur tarif_seuils.
-- Dépend de R1/R2 (objectif_habilite) et des registres tarifaires. Test seulement
-- tant qu'aucun GO Production.
--
-- tarif_seuils n'est inscriptible que par le gérant (RLS). Ces deux fonctions sont
-- security definer, `set search_path = ''`, exécutables par authenticated seulement
-- (revoke explicite de public ET anon) ; seul objectif_habilite() ouvre le droit
-- (proposer / valider), le rôle ne compte pas. Chaque fonction refuse une station
-- qui n'est pas celle de l'appelant.
--
-- SÉPARATION DES POUVOIRS. proposer écrit une version 'indicatif' ; valider écrit
-- une nouvelle version 'valide' qui remplace la proposition, et refuse que
-- l'appelant soit l'auteur de la proposition (saisi_par). Le minimum déjà en place
-- est conservé. Aucune ligne n'est modifiée : le versionnement des registres
-- (remplace_id) porte l'historique.
--
-- ROLLBACK : supabase/retours/20261127171000_retour_objectifs_a4_1b_marge_cible.sql

create function public.proposer_marge_cible(
  p_site text, p_niveau text, p_cible_niveau text, p_cible numeric, p_commentaire text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cn  text;
  v_act public.tarif_seuils%rowtype;
  v_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'objectif_non_authentifie' using errcode = '42501';
  end if;
  if p_site is distinct from public.current_employee_site_id() then
    raise exception 'objectif_autre_station' using errcode = '42501';
  end if;
  if not public.objectif_habilite(p_site, 'proposer') then
    raise exception 'objectif_non_habilite_proposer' using errcode = '42501';
  end if;
  if p_niveau is null or p_niveau not in ('famille', 'rayon', 'defaut') then
    raise exception 'marge_cible_niveau_invalide' using errcode = '22023';
  end if;
  v_cn := case when p_niveau = 'defaut' then 'defaut' else nullif(btrim(p_cible_niveau), '') end;
  if v_cn is null then
    raise exception 'marge_cible_niveau_invalide : cible du niveau absente' using errcode = '22023';
  end if;
  if p_cible is null or p_cible < 0 or p_cible >= 1 then
    raise exception 'marge_cible_invalide : une marge se pose entre 0 et 1 (exclu)' using errcode = '22023';
  end if;

  select t.* into v_act from public.tarif_seuils t
   where t.site = p_site and t.cle = p_niveau || ':' || v_cn and t.annule_le is null
     and not exists (select 1 from public.tarif_seuils c where c.remplace_id = t.id and c.annule_le is null)
   for update;
  if found and v_act.minimum is not null and p_cible < v_act.minimum then
    raise exception 'marge_cible_sous_minimum : la cible ne peut pas passer sous le minimum en place' using errcode = '22023';
  end if;

  insert into public.tarif_seuils
    (site, niveau, cible_niveau, minimum, statut_minimum, cible, statut_cible, commentaire, saisi_par, remplace_id)
  values
    (p_site, p_niveau, v_cn, v_act.minimum, v_act.statut_minimum, p_cible, 'indicatif',
     nullif(btrim(p_commentaire), ''), auth.uid(), v_act.id)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.valider_marge_cible(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tarif_seuils%rowtype;
  v_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'objectif_non_authentifie' using errcode = '42501';
  end if;
  select * into v_row from public.tarif_seuils where id = p_id for update;
  if not found then
    raise exception 'marge_cible_introuvable' using errcode = '22023';
  end if;
  if v_row.site is distinct from public.current_employee_site_id() then
    raise exception 'objectif_autre_station' using errcode = '42501';
  end if;
  if not public.objectif_habilite(v_row.site, 'valider') then
    raise exception 'objectif_non_habilite_valider' using errcode = '42501';
  end if;
  if v_row.annule_le is not null
     or exists (select 1 from public.tarif_seuils c where c.remplace_id = v_row.id and c.annule_le is null) then
    raise exception 'marge_cible_version_inactive' using errcode = '22023';
  end if;
  if v_row.cible is null or v_row.statut_cible is distinct from 'indicatif' then
    raise exception 'marge_cible_statut_invalide : seule une cible indicative se valide' using errcode = '22023';
  end if;
  if v_row.saisi_par is not null and v_row.saisi_par = auth.uid() then
    raise exception 'objectif_auto_validation_interdite' using errcode = '42501';
  end if;

  insert into public.tarif_seuils
    (site, niveau, cible_niveau, minimum, statut_minimum, cible, statut_cible, commentaire, saisi_par, remplace_id)
  values
    (v_row.site, v_row.niveau, v_row.cible_niveau, v_row.minimum, v_row.statut_minimum, v_row.cible, 'valide',
     v_row.commentaire, auth.uid(), v_row.id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.proposer_marge_cible(text, text, text, numeric, text) from public, anon;
revoke all on function public.valider_marge_cible(uuid) from public, anon;
grant execute on function public.proposer_marge_cible(text, text, text, numeric, text) to authenticated;
grant execute on function public.valider_marge_cible(uuid) to authenticated;
