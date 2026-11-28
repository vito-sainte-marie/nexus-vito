-- Objectifs de marge (A4-1d) : périmètre exclu de l'objectif de station.
-- Test seulement tant qu'aucun GO Production. Aucune liste initiale ici : les rayons
-- exclus sont posés par un script de données distinct, appliqué par Guardian.
--
-- PRINCIPE. Un rayon exclu sort du périmètre pilotable de l'objectif de station
-- (il ne compte ni dans la cible ni dans la marge réelle ni dans la couverture).
-- La table tarif_perimetre_exclu suit le modèle d'annulation de tarif_rattachements :
-- on n'efface rien, on annule (annule_le, annule_par, motif_annulation).
--
-- ACCÈS. RLS : lecture réservée à objectif_habilite(site, 'lire'), aucun droit
-- d'écriture direct. Écriture par deux fonctions security definer, search_path vide,
-- exécutables par authenticated seulement (public et anon révoqués), qui exigent
-- objectif_habilite(site, 'valider').
--
-- GARDE « rayon exclu et cible validée ». Un rayon portant une cible 'valide' active
-- (tarif_seuils, niveau rayon) ne peut pas être exclu, et inversement une cible rayon
-- 'valide' ne peut pas être écrite sur un rayon exclu. La clé de comparaison est la
-- forme normalisée (minuscules, espaces réduits) ; la normalisation complète
-- (diacritiques, mojibake) est faite côté application par normaliserRayon.
--
-- ROLLBACK : supabase/retours/20261128100000_retour_objectifs_a4_1d_perimetre_exclu.sql

create table if not exists public.tarif_perimetre_exclu (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  rayon_cle text not null check (length(btrim(rayon_cle)) > 0),
  motif text,
  saisi_par uuid not null references public.employees(id),
  saisi_le timestamptz not null default now(),
  annule_le timestamptz,
  annule_par uuid references public.employees(id),
  motif_annulation text,
  constraint tarif_perimetre_exclu_annulation check (
    (annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null
        and length(btrim(coalesce(motif_annulation, ''))) > 0))
);

create unique index if not exists tarif_perimetre_exclu_un_actif
  on public.tarif_perimetre_exclu (site, rayon_cle) where annule_le is null;

alter table public.tarif_perimetre_exclu enable row level security;

revoke all on table public.tarif_perimetre_exclu from public, anon, authenticated;
grant select on table public.tarif_perimetre_exclu to authenticated;

drop policy if exists tarif_perimetre_exclu_lecture on public.tarif_perimetre_exclu;
create policy tarif_perimetre_exclu_lecture on public.tarif_perimetre_exclu
  for select to authenticated
  using (public.objectif_habilite(site, 'lire'));

create or replace function public.declarer_perimetre_exclu(
  p_site text, p_rayon_cle text, p_motif text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cle text;
  v_id  uuid;
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
  v_cle := lower(regexp_replace(btrim(coalesce(p_rayon_cle, '')), '\s+', ' ', 'g'));
  if v_cle = '' then
    raise exception 'perimetre_rayon_invalide : rayon absent' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.tarif_seuils t
     where t.site = p_site and t.niveau = 'rayon' and t.statut_cible = 'valide'
       and t.annule_le is null
       and lower(regexp_replace(btrim(t.cible_niveau), '\s+', ' ', 'g')) = v_cle
       and not exists (select 1 from public.tarif_seuils c where c.remplace_id = t.id and c.annule_le is null)
  ) then
    raise exception 'perimetre_rayon_cible_validee : ce rayon porte une cible validée, la retirer d''abord' using errcode = '23514';
  end if;

  if exists (select 1 from public.tarif_perimetre_exclu
              where site = p_site and rayon_cle = v_cle and annule_le is null) then
    raise exception 'perimetre_rayon_deja_exclu' using errcode = '23505';
  end if;

  insert into public.tarif_perimetre_exclu (site, rayon_cle, motif, saisi_par)
  values (p_site, v_cle, nullif(btrim(p_motif), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.retirer_perimetre_exclu(p_id uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.tarif_perimetre_exclu%rowtype;
begin
  if auth.uid() is null then
    raise exception 'objectif_non_authentifie' using errcode = '42501';
  end if;
  select * into v_l from public.tarif_perimetre_exclu where id = p_id for update;
  if not found or v_l.annule_le is not null then
    raise exception 'perimetre_introuvable_ou_deja_retire' using errcode = 'P0002';
  end if;
  if v_l.site is distinct from public.current_employee_site_id() then
    raise exception 'objectif_autre_station' using errcode = '42501';
  end if;
  if not public.objectif_habilite(v_l.site, 'valider') then
    raise exception 'objectif_non_habilite_valider' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motif, ''))) = 0 then
    raise exception 'perimetre_motif_requis' using errcode = '22023';
  end if;
  update public.tarif_perimetre_exclu
     set annule_le = now(), annule_par = auth.uid(), motif_annulation = btrim(p_motif)
   where id = p_id;
end;
$$;

-- Garde dans l'autre sens : pas de cible rayon validée sur un rayon exclu.
create or replace function public.tarif_seuils_rayon_exclu_garde()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.niveau = 'rayon' and new.statut_cible = 'valide' and new.annule_le is null
     and exists (select 1 from public.tarif_perimetre_exclu e
                  where e.site = new.site and e.annule_le is null
                    and e.rayon_cle = lower(regexp_replace(btrim(new.cible_niveau), '\s+', ' ', 'g'))) then
    raise exception 'perimetre_rayon_exclu : ce rayon est exclu du périmètre, pas de cible validée' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists tarif_seuils_rayon_exclu on public.tarif_seuils;
create trigger tarif_seuils_rayon_exclu
  before insert on public.tarif_seuils
  for each row execute function public.tarif_seuils_rayon_exclu_garde();

revoke all on function public.declarer_perimetre_exclu(text, text, text) from public, anon;
grant execute on function public.declarer_perimetre_exclu(text, text, text) to authenticated;
revoke all on function public.retirer_perimetre_exclu(uuid, text) from public, anon;
grant execute on function public.retirer_perimetre_exclu(uuid, text) to authenticated;
revoke all on function public.tarif_seuils_rayon_exclu_garde() from public, anon, authenticated;
