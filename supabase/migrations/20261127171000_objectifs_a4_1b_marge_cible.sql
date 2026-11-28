-- Objectifs de marge (A4-1b) : proposer, valider et retirer une marge cible.
-- Dépend de R1/R2 (objectif_habilite) et des registres tarifaires. Test seulement
-- tant qu'aucun GO Production.
--
-- PRINCIPE. Une proposition ne touche JAMAIS tarif_seuils : elle vit dans une table
-- à part, marge_cible_propositions. La cible validée en place reste active et
-- notante pendant toute la durée d'une proposition de révision. Seule la validation,
-- par un autre compte que l'auteur, écrit UNE nouvelle version 'valide' dans
-- tarif_seuils (remplace_id = la version active, minimum conservé) et ferme la
-- proposition, dans la même transaction. Le schéma de tarif_seuils est inchangé.
--
-- ACCÈS. Table en RLS : lecture réservée à objectif_habilite(site, 'lire'), aucun
-- droit d'écriture direct (tout passe par les trois fonctions security definer,
-- search_path vide, exécutables par authenticated seulement ; public et anon
-- révoqués explicitement). Une seule proposition ouverte par clé (index unique).
--
-- Les deux fonctions de la première version d'A4-1b (mêmes signatures, déjà
-- posées sur Test) sont remplacées par create or replace.
--
-- ROLLBACK : supabase/retours/20261127171000_retour_objectifs_a4_1b_marge_cible.sql

create table if not exists public.marge_cible_propositions (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  niveau text not null check (niveau in ('famille', 'rayon', 'defaut')),
  cible_niveau text not null,
  cible numeric not null check (cible >= 0 and cible < 1),
  commentaire text,
  propose_par uuid not null references public.employees(id),
  propose_le timestamptz not null default now(),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'validee', 'retiree')),
  motif text,
  traite_par uuid references public.employees(id),
  traite_le timestamptz,
  version_validee_id uuid references public.tarif_seuils(id),
  constraint marge_cible_propositions_defaut check (niveau <> 'defaut' or cible_niveau = 'defaut'),
  constraint marge_cible_propositions_cloture check (
    (statut = 'ouverte' and traite_par is null and traite_le is null)
    or (statut <> 'ouverte' and traite_par is not null and traite_le is not null)),
  constraint marge_cible_propositions_motif check (
    statut <> 'retiree' or length(btrim(coalesce(motif, ''))) > 0)
);

create unique index if not exists marge_cible_propositions_une_ouverte
  on public.marge_cible_propositions (site, niveau, cible_niveau) where statut = 'ouverte';

alter table public.marge_cible_propositions enable row level security;

revoke all on table public.marge_cible_propositions from public, anon, authenticated;
grant select on table public.marge_cible_propositions to authenticated;

drop policy if exists marge_cible_propositions_lecture on public.marge_cible_propositions;
create policy marge_cible_propositions_lecture on public.marge_cible_propositions
  for select to authenticated
  using (public.objectif_habilite(site, 'lire'));

create or replace function public.proposer_marge_cible(
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
     and not exists (select 1 from public.tarif_seuils c where c.remplace_id = t.id and c.annule_le is null);
  if found and v_act.minimum is not null and p_cible < v_act.minimum then
    raise exception 'marge_cible_sous_minimum : la cible ne peut pas passer sous le minimum en place' using errcode = '22023';
  end if;

  if exists (select 1 from public.marge_cible_propositions
              where site = p_site and niveau = p_niveau and cible_niveau = v_cn and statut = 'ouverte') then
    raise exception 'marge_cible_proposition_existante : une proposition est déjà en attente sur cette clé' using errcode = '23505';
  end if;

  insert into public.marge_cible_propositions (site, niveau, cible_niveau, cible, commentaire, propose_par)
  values (p_site, p_niveau, v_cn, p_cible, nullif(btrim(p_commentaire), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.valider_marge_cible(p_proposition uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p   public.marge_cible_propositions%rowtype;
  v_act public.tarif_seuils%rowtype;
  v_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'objectif_non_authentifie' using errcode = '42501';
  end if;
  select * into v_p from public.marge_cible_propositions where id = p_proposition for update;
  if not found then
    raise exception 'marge_cible_introuvable' using errcode = '22023';
  end if;
  if v_p.site is distinct from public.current_employee_site_id() then
    raise exception 'objectif_autre_station' using errcode = '42501';
  end if;
  if not public.objectif_habilite(v_p.site, 'valider') then
    raise exception 'objectif_non_habilite_valider' using errcode = '42501';
  end if;
  if v_p.statut <> 'ouverte' then
    raise exception 'marge_cible_proposition_close : cette proposition n''est plus en attente' using errcode = '22023';
  end if;
  if v_p.propose_par = auth.uid() then
    raise exception 'objectif_auto_validation_interdite' using errcode = '42501';
  end if;

  select t.* into v_act from public.tarif_seuils t
   where t.site = v_p.site and t.cle = v_p.niveau || ':' || v_p.cible_niveau and t.annule_le is null
     and not exists (select 1 from public.tarif_seuils c where c.remplace_id = t.id and c.annule_le is null)
   for update;
  if found and v_act.minimum is not null and v_p.cible < v_act.minimum then
    raise exception 'marge_cible_sous_minimum : la cible ne peut pas passer sous le minimum en place' using errcode = '22023';
  end if;

  insert into public.tarif_seuils
    (site, niveau, cible_niveau, minimum, statut_minimum, cible, statut_cible, commentaire, saisi_par, remplace_id)
  values
    (v_p.site, v_p.niveau, v_p.cible_niveau, v_act.minimum, v_act.statut_minimum, v_p.cible, 'valide',
     v_p.commentaire, auth.uid(), v_act.id)
  returning id into v_id;

  update public.marge_cible_propositions
     set statut = 'validee', traite_par = auth.uid(), traite_le = now(), version_validee_id = v_id
   where id = v_p.id;
  return v_id;
end;
$$;

create or replace function public.retirer_marge_cible(p_proposition uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.marge_cible_propositions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'objectif_non_authentifie' using errcode = '42501';
  end if;
  select * into v_p from public.marge_cible_propositions where id = p_proposition for update;
  if not found then
    raise exception 'marge_cible_introuvable' using errcode = '22023';
  end if;
  if v_p.site is distinct from public.current_employee_site_id() then
    raise exception 'objectif_autre_station' using errcode = '42501';
  end if;
  -- L'auteur retire sa proposition ; un valideur peut aussi la refuser.
  if not (v_p.propose_par = auth.uid() and public.objectif_habilite(v_p.site, 'proposer'))
     and not public.objectif_habilite(v_p.site, 'valider') then
    raise exception 'objectif_non_habilite_retirer' using errcode = '42501';
  end if;
  if v_p.statut <> 'ouverte' then
    raise exception 'marge_cible_proposition_close : cette proposition n''est plus en attente' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_motif, ''))) = 0 then
    raise exception 'marge_cible_motif_requis : un retrait demande un motif' using errcode = '22023';
  end if;
  update public.marge_cible_propositions
     set statut = 'retiree', motif = btrim(p_motif), traite_par = auth.uid(), traite_le = now()
   where id = v_p.id;
end;
$$;

revoke all on function public.proposer_marge_cible(text, text, text, numeric, text) from public, anon;
revoke all on function public.valider_marge_cible(uuid) from public, anon;
revoke all on function public.retirer_marge_cible(uuid, text) from public, anon;
grant execute on function public.proposer_marge_cible(text, text, text, numeric, text) to authenticated;
grant execute on function public.valider_marge_cible(uuid) to authenticated;
grant execute on function public.retirer_marge_cible(uuid, text) to authenticated;
