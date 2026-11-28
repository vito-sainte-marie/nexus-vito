-- Objectifs de marge (A4-1d, correction de revue) : clé de rayon alignée sur normaliserRayon.
-- Test seulement tant qu'aucun GO Production.
--
-- POURQUOI. La clé de 20261128100000 ne faisait que minuscules + espaces réduits. Côté application,
-- normaliserRayon répare aussi « Ã » + espace (mojibake de « à ») et retire les diacritiques. Deux libellés
-- d'un même rayon pouvaient donc passer la garde SQL comme différents. Une seule clé, deux implémentations :
-- public.tarif_rayon_cle(text) reproduit normaliserRayon (réparation de « Ã\s+ » en « à », diacritiques
-- français retirés, minuscules, espaces réduits). Les tests des deux côtés comparent les mêmes cas.
--
-- Les lignes de tarif_perimetre_exclu déjà posées sont recalculées avec la nouvelle clé.
--
-- ROLLBACK : supabase/retours/20261128140000_retour_objectifs_a4_1d_cle_rayon_normalisee.sql

create or replace function public.tarif_rayon_cle(p_rayon text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(
      lower(regexp_replace(coalesce(p_rayon, ''), 'Ã\s+', 'à ', 'g')),
      'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyy'),
    '\s+', ' ', 'g'))
$$;

revoke all on function public.tarif_rayon_cle(text) from public, anon;
grant execute on function public.tarif_rayon_cle(text) to authenticated;

update public.tarif_perimetre_exclu
   set rayon_cle = public.tarif_rayon_cle(rayon_cle)
 where rayon_cle <> public.tarif_rayon_cle(rayon_cle);

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
  v_cle := public.tarif_rayon_cle(p_rayon_cle);
  if v_cle = '' then
    raise exception 'perimetre_rayon_invalide : rayon absent' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.tarif_seuils t
     where t.site = p_site and t.niveau = 'rayon' and t.statut_cible = 'valide'
       and t.annule_le is null
       and public.tarif_rayon_cle(t.cible_niveau) = v_cle
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
                    and e.rayon_cle = public.tarif_rayon_cle(new.cible_niveau)) then
    raise exception 'perimetre_rayon_exclu : ce rayon est exclu du périmètre, pas de cible validée' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.declarer_perimetre_exclu(text, text, text) from public, anon;
grant execute on function public.declarer_perimetre_exclu(text, text, text) to authenticated;
revoke all on function public.tarif_seuils_rayon_exclu_garde() from public, anon, authenticated;
