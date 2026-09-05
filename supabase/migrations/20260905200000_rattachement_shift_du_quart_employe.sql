-- S-5 (05/09/2026) — rattachement d'un quart-employé d'inventaire au service
-- NEXUS réellement actif.
--
-- `inventaire_quart_employes.shift_id` existe depuis l'origine avec une clé
-- étrangère vers `shifts(id)`, et n'a jamais été renseigné : 6 lignes, toutes
-- à NULL. Le client écrit désormais le service courant. Cette migration pose
-- l'invariant correspondant EN BASE, parce que le bloqueur 1 a montré qu'un
-- contrat gardé seulement côté client finit par ne pas être respecté —
-- `cloture_source` existait lui aussi depuis l'origine, sans écrivain.
--
-- La clé étrangère garantit que le service EXISTE. Elle ne garantit pas qu'il
-- APPARTIENT au bon employé ni au bon site : c'est ce que ce garde ajoute.
--
-- Portée volontairement étroite :
--   * shift_id NULL reste accepté — les 6 lignes historiques d'avant S-5 sont
--     de l'historique légitime, et aucune reprise rétroactive n'est faite.
--   * les colonnes `shift_id` du domaine FDJ sont hors périmètre : elles
--     réfèrent à `fdj_shifts`, concept distinct.
--
-- Le garde couvre INSERT **et** UPDATE : une modification ultérieure de
-- `shift_id`, d'`employee_id` ou de `quart_id` pourrait sinon casser
-- l'invariant après coup, et la politique RLS d'UPDATE est ouverte aux
-- managers et gérants sur des lignes qui ne sont pas les leurs.

create or replace function public.nexus_valider_shift_du_quart_employe()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_shift_employee uuid;
  v_shift_site     text;
  v_site_du_quart  text;
begin
  -- Absence de rattachement : accepté, jamais deviné.
  if new.shift_id is null then
    return new;
  end if;

  select s.employee_id, s.site_id
    into v_shift_employee, v_shift_site
    from public.shifts s
   where s.id = new.shift_id;

  if not found then
    raise exception
      'Quart-employé % : le service % n''existe pas.',
      coalesce(new.id::text, '(nouveau)'), new.shift_id
      using errcode = '23503';
  end if;

  if v_shift_employee <> new.employee_id then
    raise exception
      'Quart-employé % : le service % appartient à l''employé %, pas à %.',
      coalesce(new.id::text, '(nouveau)'), new.shift_id,
      v_shift_employee, new.employee_id
      using errcode = '23514';
  end if;

  -- `inventaire_quarts.site` et `shifts.site_id` sont tous deux text NOT NULL :
  -- le site est donc déterminable avec certitude, et la concordance est exigée.
  select q.site into v_site_du_quart
    from public.inventaire_quarts q
   where q.id = new.quart_id;

  if found and v_site_du_quart <> v_shift_site then
    raise exception
      'Quart-employé % : le service % est au site %, le quart d''inventaire au site %.',
      coalesce(new.id::text, '(nouveau)'), new.shift_id,
      v_shift_site, v_site_du_quart
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.nexus_valider_shift_du_quart_employe() is
  'S-5 — interdit qu''un quart-employé d''inventaire référence le service d''un autre employé ou d''un autre site. NULL reste accepté (historique d''avant S-5).';

drop trigger if exists nexus_valider_shift_du_quart_employe on public.inventaire_quart_employes;

create trigger nexus_valider_shift_du_quart_employe
  before insert or update of shift_id, employee_id, quart_id
  on public.inventaire_quart_employes
  for each row
  execute function public.nexus_valider_shift_du_quart_employe();

-- Contrôle fail-closed : les lignes déjà présentes doivent toutes satisfaire
-- l'invariant, sinon la migration s'arrête au lieu de laisser une base dont le
-- garde n'est vrai que pour l'avenir.
do $$
declare
  v_incoherentes integer;
begin
  select count(*) into v_incoherentes
    from public.inventaire_quart_employes iqe
    join public.shifts s on s.id = iqe.shift_id
   where iqe.shift_id is not null
     and s.employee_id <> iqe.employee_id;

  if v_incoherentes > 0 then
    raise exception
      'S-5 interrompu : % ligne(s) inventaire_quart_employes référencent le service d''un autre employé. À arbitrer avant de poser le garde.',
      v_incoherentes;
  end if;
end;
$$;
