-- Un depart ne ferme que SON service, et jamais un service plus recent.
-- ============================================================================
-- CONSTATE le 11/09/2026 sur Test : un service cree a 12:22:44.023762 a ete
-- cloture a 12:22:43, soit AVANT sa propre creation. Cause demontree : la
-- recette navigateur CI et un parcours humain tournaient au meme instant sur
-- le meme compte ; le trigger fermait « le service en cours le plus recent »,
-- qui n'etait plus celui que l'employe quittait.
--
-- DEUX CHANGEMENTS, et ils repondent a deux exigences distinctes :
--
--   1. quand le pointage porte un `service_id`, c'est CELUI-LA qui est ferme,
--      et aucun autre. L'invariant ne repose plus sur « le plus recent » ;
--   2. une fin anterieure au debut n'est jamais ecrite. Le produit le refuse,
--      en plus de la contrainte `shifts_fin_apres_debut` qui l'interdit en
--      base : une garantie qui ne tient que par une contrainte se decouvre
--      toujours trop tard, au moment ou elle casse une ecriture legitime.
--
-- Le repli sur « le plus recent » subsiste pour les pointages sans
-- `service_id` : les 92 lignes historiques n'en ont pas, et leur comportement
-- ne doit pas changer retroactivement.
-- ============================================================================

create or replace function public.nexus_cloturer_shift_au_depart()
returns trigger
language plpgsql
as $function$
declare
  v_shift_id uuid;
  v_debut    timestamptz;
  v_timezone text;
  v_fin      timestamptz;
  v_lignes   int;
begin
  select s.timezone into v_timezone
    from public.sites s where s.site_id = new.site;

  if v_timezone is null or btrim(v_timezone) = ''
     or not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception
      'Cloture impossible : le commerce % ne declare aucun fuseau horaire exploitable.', new.site;
  end if;

  v_fin := (new.date + new.heure) at time zone v_timezone;

  if new.service_id is not null then
    select sh.id, sh.heure_debut into v_shift_id, v_debut
      from public.shifts sh
     where sh.id          = new.service_id
       and sh.employee_id = new.employee_id
       and sh.site_id     = new.site
       and sh.statut      = 'en_cours';
  else
    select sh.id, sh.heure_debut into v_shift_id, v_debut
      from public.shifts sh
     where sh.employee_id = new.employee_id
       and sh.site_id     = new.site
       and sh.statut      = 'en_cours'
     order by sh.heure_debut desc
     limit 1;
  end if;

  if v_shift_id is null then
    raise notice 'Pointage de depart sans service actif correspondant (employe %, site %) : aucune cloture inventee.',
      new.employee_id, new.site;
    return new;
  end if;

  if v_fin < v_debut then
    raise notice 'Depart a % anterieur au debut du service % (%) : aucune cloture appliquee.',
      v_fin, v_shift_id, v_debut;
    return new;
  end if;

  update public.shifts
     set statut         = 'termine',
         heure_fin      = v_fin,
         cloture_source = 'pointage_depart',
         cloture_le     = now()
   where id = v_shift_id;

  get diagnostics v_lignes = row_count;
  if v_lignes <> 1 then
    raise exception
      'Cloture du service % impossible : % ligne(s) modifiee(s) au lieu de 1.', v_shift_id, v_lignes;
  end if;

  return new;
end;
$function$;
