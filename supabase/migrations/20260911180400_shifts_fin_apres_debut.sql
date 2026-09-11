-- PRÉPARÉE, NON APPLIQUÉE.
-- ============================================================================
-- Une fin de service ne peut pas précéder son début.
--
-- CONSTATÉ le 11/09/2026 sur Test : un service créé à 12:22:44.023762 porte
-- une fin à 12:22:43. Cause démontrée (diagnostic-services-successifs-1.md) :
-- deux déclencheurs posent `heure_fin` de deux façons différentes —
-- `nexus_shifts_avant_insertion` avec l'heure SERVEUR de la nouvelle prise,
-- `nexus_cloturer_shift_au_depart` avec l'heure du CLIC — et rien n'interdit
-- que la seconde précède la création du service.
--
-- LA CONTRAINTE N'EST PAS LE CORRECTIF, elle est le garde-fou : elle
-- transforme une donnée absurde en refus visible. Le trigger de départ doit
-- en outre ne jamais poser une fin antérieure au début (voir ci-dessous).
-- ============================================================================

-- 1) Le garde-fou. NOT VALID d'abord : la contrainte protège l'avenir sans
--    bloquer sur un historique qu'on n'a pas encore examiné.
alter table public.shifts
  drop constraint if exists shifts_fin_apres_debut;

alter table public.shifts
  add constraint shifts_fin_apres_debut
  check (heure_fin is null or heure_fin >= heure_debut) not valid;

-- 2) Ce que l'historique en dit, à lire AVANT de valider la contrainte.
select count(*) as services_a_fin_anterieure
  from public.shifts where heure_fin is not null and heure_fin < heure_debut;

-- 3) À n'exécuter qu'une fois le compte ci-dessus ramené à zéro, et jamais
--    en corrigeant les valeurs sans les avoir comprises une par une :
-- alter table public.shifts validate constraint shifts_fin_apres_debut;
