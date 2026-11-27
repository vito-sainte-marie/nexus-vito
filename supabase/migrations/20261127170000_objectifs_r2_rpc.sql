-- Objectifs de station, lot R2 (#394) : RPC de proposition, de validation, de
-- retrait et d'habilitation. Dépend de R1 (20261127160000). Test seulement tant
-- qu'aucun GO Production. AUCUN compte n'est désigné ici (R2b, séparée).
--
-- Toutes les fonctions sont security definer, `set search_path = ''`, exécutables
-- par authenticated seulement (revoke explicite de public ET anon). Le rôle
-- (gerant, manager…) ne compte jamais : seule objectif_habilite() ouvre un droit.
-- Chaque RPC refuse une station qui n'est pas celle de l'appelant.
--
-- SÉPARATION DES POUVOIRS. valider_objectif refuse la proposition de l'appelant
-- (valide_par <> propose_par). Une nouvelle version ne remplace la précédente
-- qu'à la validation, dans la même transaction. Un objectif officiel ne se
-- modifie ni ne se supprime : on le remplace (nouvelle version motivée) ou on le
-- retire (statut 'retire', motif obligatoire).
--
-- ROLLBACK : supabase/retours/20261127170000_retour_objectifs_r2_rpc.sql

create function public.proposer_objectif(
  p_site text, p_indicateur text, p_horizon text, p_debut date,
  p_cible numeric, p_origine text default 'gerant', p_motif text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cat   public.objectif_catalogue%rowtype;
  v_fin   date;
  v_off   public.station_objectifs%rowtype;
  v_vers  integer;
  v_id    uuid;
  v_tz    text;
  v_jour  date;
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
  if p_origine is null or p_origine not in ('gerant','proposition_nexus','reprise_historique') then
    raise exception 'objectif_origine_invalide' using errcode = '22023';
  end if;

  select * into v_cat from public.objectif_catalogue where indicateur_id = p_indicateur;
  if not found then
    raise exception 'objectif_indicateur_inconnu' using errcode = '22023';
  end if;
  if not v_cat.objectivable or v_cat.classe = 'non_disponible' then
    raise exception 'objectif_indicateur_non_objectivable' using errcode = '22023';
  end if;
  if v_cat.cible_externe is not null then
    raise exception 'objectif_cible_externe : la cible de % se pose dans %', p_indicateur, v_cat.cible_externe
      using errcode = '22023';
  end if;

  if p_horizon is null or p_debut is null then
    raise exception 'objectif_periode_invalide' using errcode = '22023';
  end if;
  v_fin := case p_horizon
    when 'mois'      then (p_debut + interval '1 month')::date
    when 'trimestre' then (p_debut + interval '3 months')::date
    when 'annee'     then (p_debut + interval '1 year')::date
  end;
  if v_fin is null
     or extract(day from p_debut) <> 1
     or (p_horizon = 'trimestre' and extract(month from p_debut) not in (1,4,7,10))
     or (p_horizon = 'annee' and extract(month from p_debut) <> 1) then
    raise exception 'objectif_periode_non_alignee' using errcode = '22023';
  end if;
  -- Jour de la station (sites.timezone, lot A3) : la date du serveur est UTC et
  -- décalerait la clôture de période de plusieurs heures. Fuseau absent : refus.
  select timezone into v_tz from public.sites where site_id = p_site;
  if v_tz is null then
    raise exception 'objectif_fuseau_station_absent' using errcode = '22023';
  end if;
  v_jour := (now() at time zone v_tz)::date;
  if v_fin <= v_jour and p_origine <> 'reprise_historique' then
    raise exception 'objectif_periode_close' using errcode = '22023';
  end if;

  if p_cible is null or p_cible < 0 then
    raise exception 'objectif_cible_invalide' using errcode = '22023';
  end if;
  if p_cible = 0 and not v_cat.cible_zero_ok then
    raise exception 'objectif_cible_zero_interdite' using errcode = '22023';
  end if;

  if exists (select 1 from public.station_objectifs
             where site = p_site and indicateur_id = p_indicateur
               and horizon = p_horizon and periode_debut = p_debut
               and statut = 'propose') then
    raise exception 'objectif_proposition_ouverte' using errcode = '23505';
  end if;

  select * into v_off from public.station_objectifs
   where site = p_site and indicateur_id = p_indicateur
     and horizon = p_horizon and periode_debut = p_debut and statut = 'officiel';

  select coalesce(max(version), 0) + 1 into v_vers from public.station_objectifs
   where site = p_site and indicateur_id = p_indicateur
     and horizon = p_horizon and periode_debut = p_debut;

  if v_vers > 1 and (p_motif is null or btrim(p_motif) = '') then
    raise exception 'objectif_motif_requis : une révision porte un motif' using errcode = '22023';
  end if;

  insert into public.station_objectifs
    (site, indicateur_id, horizon, periode_debut, periode_fin, version, cible,
     statut, origine, propose_par, propose_le, motif, remplace_id)
  values
    (p_site, p_indicateur, p_horizon, p_debut, v_fin, v_vers, p_cible,
     'propose', p_origine, auth.uid(), now(), nullif(btrim(p_motif), ''), v_off.id)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.valider_objectif(p_id uuid, p_arbitrage text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.station_objectifs%rowtype;
  v_cat public.objectif_catalogue%rowtype;
begin
  if auth.uid() is null then
    raise exception 'objectif_non_authentifie' using errcode = '42501';
  end if;
  select * into v_row from public.station_objectifs where id = p_id for update;
  if not found then
    raise exception 'objectif_introuvable' using errcode = '22023';
  end if;
  if v_row.site is distinct from public.current_employee_site_id() then
    raise exception 'objectif_autre_station' using errcode = '42501';
  end if;
  if not public.objectif_habilite(v_row.site, 'valider') then
    raise exception 'objectif_non_habilite_valider' using errcode = '42501';
  end if;
  if v_row.statut <> 'propose' then
    raise exception 'objectif_statut_invalide : % ne se valide pas', v_row.statut using errcode = '22023';
  end if;
  if v_row.propose_par is not null and v_row.propose_par = auth.uid() then
    raise exception 'objectif_auto_validation_interdite' using errcode = '42501';
  end if;

  select * into v_cat from public.objectif_catalogue where indicateur_id = v_row.indicateur_id;
  if not v_cat.objectivable or v_cat.classe = 'non_disponible' or v_cat.cible_externe is not null then
    raise exception 'objectif_indicateur_non_objectivable' using errcode = '22023';
  end if;
  if v_cat.classe = 'a_fiabiliser' and (p_arbitrage is null or btrim(p_arbitrage) = '') then
    raise exception 'objectif_arbitrage_requis : indicateur à fiabiliser' using errcode = '22023';
  end if;

  -- La version précédente passe à 'remplace' avant que celle-ci devienne
  -- officielle (index unique d'officiel), dans la même transaction.
  update public.station_objectifs
     set statut = 'remplace'
   where site = v_row.site and indicateur_id = v_row.indicateur_id
     and horizon = v_row.horizon and periode_debut = v_row.periode_debut
     and statut = 'officiel';

  update public.station_objectifs
     set statut = 'officiel',
         valide_par = auth.uid(),
         valide_le = now(),
         motif = case when v_cat.classe = 'a_fiabiliser'
                      then coalesce(motif || ' | ', '') || 'Arbitrage : ' || btrim(p_arbitrage)
                      else motif end
   where id = v_row.id;
  return v_row.id;
end;
$$;

create function public.retirer_objectif(p_id uuid, p_motif text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.station_objectifs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'objectif_non_authentifie' using errcode = '42501';
  end if;
  select * into v_row from public.station_objectifs where id = p_id for update;
  if not found then
    raise exception 'objectif_introuvable' using errcode = '22023';
  end if;
  if v_row.site is distinct from public.current_employee_site_id() then
    raise exception 'objectif_autre_station' using errcode = '42501';
  end if;
  if not public.objectif_habilite(v_row.site, 'valider') then
    raise exception 'objectif_non_habilite_valider' using errcode = '42501';
  end if;
  if p_motif is null or btrim(p_motif) = '' then
    raise exception 'objectif_motif_requis' using errcode = '22023';
  end if;
  if v_row.statut not in ('brouillon','propose','officiel') then
    raise exception 'objectif_statut_invalide : % ne se retire pas', v_row.statut using errcode = '22023';
  end if;
  update public.station_objectifs
     set statut = 'retire',
         motif = coalesce(motif || ' | ', '') || 'Retrait : ' || btrim(p_motif)
   where id = v_row.id;
  return v_row.id;
end;
$$;

-- Octroi : réservé à un valideur déjà habilité de la station de l'appelant, au
-- profit d'un compte actif de cette même station.
create function public.accorder_droit_objectif(p_site text, p_employe uuid, p_droit text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'objectif_non_authentifie' using errcode = '42501';
  end if;
  if p_site is distinct from public.current_employee_site_id() then
    raise exception 'objectif_autre_station' using errcode = '42501';
  end if;
  if not public.objectif_habilite(p_site, 'valider') then
    raise exception 'objectif_non_habilite_valider' using errcode = '42501';
  end if;
  if p_droit is null or p_droit not in ('lire','proposer','valider') then
    raise exception 'objectif_droit_invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from public.employees e
                 where e.id = p_employe and e.site_id = p_site and e.actif = true) then
    raise exception 'objectif_compte_inconnu_ou_autre_station' using errcode = '22023';
  end if;
  insert into public.objectif_habilitation (site, employe_id, droit, accorde_par, accorde_le, revoque_le)
  values (p_site, p_employe, p_droit, auth.uid(), now(), null)
  on conflict (site, employe_id, droit)
  do update set accorde_par = auth.uid(), accorde_le = now(), revoque_le = null;
end;
$$;

-- Révocation : même réserve. Refuse de retirer le dernier valideur de la
-- station, qui ne pourrait plus rien valider ni accorder.
create function public.revoquer_droit_objectif(p_site text, p_employe uuid, p_droit text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'objectif_non_authentifie' using errcode = '42501';
  end if;
  if p_site is distinct from public.current_employee_site_id() then
    raise exception 'objectif_autre_station' using errcode = '42501';
  end if;
  if not public.objectif_habilite(p_site, 'valider') then
    raise exception 'objectif_non_habilite_valider' using errcode = '42501';
  end if;
  if p_droit is null or p_droit not in ('lire','proposer','valider') then
    raise exception 'objectif_droit_invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from public.objectif_habilitation
                 where site = p_site and employe_id = p_employe and droit = p_droit
                   and revoque_le is null) then
    raise exception 'objectif_droit_absent' using errcode = '22023';
  end if;
  if p_droit = 'valider' and not exists (
       select 1 from public.objectif_habilitation h
       join public.employees e on e.id = h.employe_id
       where h.site = p_site and h.droit = 'valider' and h.revoque_le is null
         and e.site_id = p_site and e.actif = true
         and h.employe_id <> p_employe) then
    raise exception 'objectif_dernier_valideur' using errcode = '22023';
  end if;
  update public.objectif_habilitation
     set revoque_le = now()
   where site = p_site and employe_id = p_employe and droit = p_droit
     and revoque_le is null;
end;
$$;

revoke all on function public.proposer_objectif(text, text, text, date, numeric, text, text) from public, anon;
revoke all on function public.valider_objectif(uuid, text)                                  from public, anon;
revoke all on function public.retirer_objectif(uuid, text)                                  from public, anon;
revoke all on function public.accorder_droit_objectif(text, uuid, text)                     from public, anon;
revoke all on function public.revoquer_droit_objectif(text, uuid, text)                     from public, anon;
grant execute on function public.proposer_objectif(text, text, text, date, numeric, text, text) to authenticated;
grant execute on function public.valider_objectif(uuid, text)                                  to authenticated;
grant execute on function public.retirer_objectif(uuid, text)                                  to authenticated;
grant execute on function public.accorder_droit_objectif(text, uuid, text)                     to authenticated;
grant execute on function public.revoquer_droit_objectif(text, uuid, text)                     to authenticated;
