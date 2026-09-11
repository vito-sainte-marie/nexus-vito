-- PRÉPARÉE, NON APPLIQUÉE.
-- ============================================================================
-- Étape 2 sur 3 : rattacher UNIQUEMENT ce qui est certain.
--
-- Mesure du 11/09/2026 sur Production, 92 pointages :
--   80 ont exactement UN service candidat ce jour-là  -> rattachés ici
--    8 en ont plusieurs (jusqu'à 6)                   -> laissés NULL
--    4 n'en ont aucun                                 -> laissés NULL
--
-- AUCUNE CORRESPONDANCE ARBITRAIRE. Un pointage dont le service est ambigu
-- reste sans service : c'est une donnée manquante honnête, pas un rattachement
-- plausible. Le rapport d'exception ci-dessous les nomme un par un.
-- ============================================================================

update public.pointages p
   set service_id = c.id
  from lateral (
        select sh.id
          from public.shifts sh
         where sh.employee_id = p.employee_id
           and sh.site_id     = p.site
           and (sh.heure_debut at time zone
                 (select s.timezone from public.sites s where s.site_id = p.site))::date = p.date
       ) c
 where p.service_id is null
   and 1 = (select count(*)
              from public.shifts sh2
             where sh2.employee_id = p.employee_id
               and sh2.site_id     = p.site
               and (sh2.heure_debut at time zone
                     (select s.timezone from public.sites s where s.site_id = p.site))::date = p.date);

-- Rapport d'exception : ce qui reste sans service, et pourquoi.
select p.id, p.employee_id, p.site, p.date, p.type,
       (select count(*) from public.shifts sh
         where sh.employee_id = p.employee_id and sh.site_id = p.site
           and (sh.heure_debut at time zone
                 (select s.timezone from public.sites s where s.site_id = p.site))::date = p.date
       ) as services_candidats,
       case when (select count(*) from public.shifts sh
                   where sh.employee_id = p.employee_id and sh.site_id = p.site
                     and (sh.heure_debut at time zone
                           (select s.timezone from public.sites s where s.site_id = p.site))::date = p.date) = 0
            then 'aucun service ce jour-la'
            else 'plusieurs services candidats — rattachement impossible sans choisir' end as motif
  from public.pointages p
 where p.service_id is null
 order by p.date, p.employee_id;
