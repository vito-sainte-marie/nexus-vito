-- Requête de contrôle de R2b, à passer AVANT et APRÈS l'application (lecture seule).
-- Compte par rôle, sans nommer personne. Avant : comptes_eligibles = comptes
-- concernés, habilites_valider = 0 (objectif_habilitation vide). Après :
-- habilites_valider doit égaler comptes_eligibles, dont posees_par_migration.
select
  e.role,
  count(*) filter (where e.actif and (e.role in ('manager','gerant') or coalesce(e.est_createur,false)))
    as comptes_eligibles,
  count(*) filter (where h.employe_id is not null and h.revoque_le is null)
    as habilites_valider,
  count(*) filter (where h.employe_id is not null and h.accorde_par is null)
    as posees_par_migration
from public.employees e
left join public.objectif_habilitation h
  on h.employe_id = e.id and h.site = e.site_id and h.droit = 'valider'
where e.site_id = 'vito-sainte-marie'
  and (e.role in ('manager','gerant') or coalesce(e.est_createur,false) or h.employe_id is not null)
group by e.role
order by e.role;
