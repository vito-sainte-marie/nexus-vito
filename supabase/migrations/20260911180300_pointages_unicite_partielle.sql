-- PRÉPARÉE, NON APPLIQUÉE. À n'appliquer qu'APRÈS que le chemin applicatif
-- renseigne service_id pour tout nouveau pointage.
-- ============================================================================
-- Étape 3 sur 3 : l'unicité métier, là où elle a un sens.
--
-- « Un seul pointage de chaque type par service et par employé. »
--
-- PARTIELLE, et c'est le point : les pointages historiques laissés à NULL par
-- l'étape 2 ne sont pas concernés. Une contrainte totale les rendrait
-- impossibles à conserver, et les effacer pour satisfaire une contrainte
-- serait le contraire du travail fait ici.
--
-- `employee_id` est conservé dans la clé bien que `service_id` désigne déjà un
-- employé : un invariant transverse ne doit pas reposer implicitement sur
-- l'intégrité d'une autre table.
-- ============================================================================

create unique index if not exists pointages_un_par_service_et_type
  on public.pointages (service_id, employee_id, type)
  where service_id is not null;
