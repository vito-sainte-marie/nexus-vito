-- Retour arrière de 20261128140000_objectifs_a4_1d_cle_rayon_normalisee.sql.
-- Remet la clé simple de 20261128100000 (minuscules, espaces réduits). Les clés déjà recalculées
-- (sans diacritiques) restent telles quelles : elles sont dans la forme minuscule, donc compatibles.
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

drop function if exists public.tarif_rayon_cle(text);
