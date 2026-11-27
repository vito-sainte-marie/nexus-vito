-- Retour arrière de 20261127170500 : rétablit la définition de R2 (sans garde de rôle).
create or replace function public.accorder_droit_objectif(p_site text, p_employe uuid, p_droit text)
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
