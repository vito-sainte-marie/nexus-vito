-- Doublons de pointage : détection, AVANT toute contrainte d'unicité.
-- ============================================================================
-- SELECT-only. À exécuter sur Test ET sur Production avant d'écrire une
-- migration d'unicité sur public.pointages.
--
-- POURQUOI CE FICHIER EXISTE. La règle « un seul pointage par type et par
-- jour » ne vivait que dans l'écran : `public.pointages` ne porte aucun index
-- unique, seule la clé primaire sur `id`. Une relecture applicative avant
-- écriture réduit le risque, elle ne le supprime pas — deux envois vraiment
-- simultanés passent encore.
--
-- LA CLÉ N'EST PAS ÉVIDENTE, et ce fichier ne la choisit pas :
--
--   (employee_id, date, type)          interdit à un employé de pointer deux
--                                      fois le même type le même jour, y
--                                      compris sur DEUX SITES différents. Or
--                                      `transfert_site` existe dans les
--                                      statuts de travail.
--
--   (employee_id, site, date, type)    autorise un pointage par site. Plus
--                                      permissif, cohérent avec un transfert,
--                                      mais autorise deux arrivées le même
--                                      jour.
--
-- `date` est par ailleurs écrite par le client depuis l'heure LOCALE de
-- l'appareil, pas depuis une date métier calculée dans le fuseau de la
-- station. Avant de figer une clé, il faut trancher si `date` est la bonne
-- dimension, ou s'il faut dériver la date métier de `heure` et du fuseau du
-- site.
-- ============================================================================

select
  (select count(*) from public.pointages)                                   as lignes_totales,
  (select count(*) from (select employee_id, date, type
                           from public.pointages group by 1,2,3 having count(*) > 1) a)
                                                                            as doublons_employe_date_type,
  (select count(*) from (select employee_id, site, date, type
                           from public.pointages group by 1,2,3,4 having count(*) > 1) b)
                                                                            as doublons_employe_site_date_type,
  (select count(*) from public.pointages where site is null)                as site_nul,
  (select count(*) from public.pointages where date is null)                as date_nulle,
  (select count(distinct site) from public.pointages)                       as sites_distincts,
  (select count(*) from (select employee_id, date from public.pointages
                          group by 1,2 having count(distinct site) > 1) c)
                                                                            as employes_pointant_sur_deux_sites_le_meme_jour;

-- Le détail, s'il y en a. Vide = rien à résoudre avant la contrainte.
select employee_id, site, date, type, count(*) as occurrences,
       min(heure) as premiere, max(heure) as derniere
  from public.pointages
 group by employee_id, site, date, type
having count(*) > 1
 order by date desc, employee_id;
