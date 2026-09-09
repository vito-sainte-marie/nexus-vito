-- CORRECTION DES HORAIRES CANONIQUES — Vito Sainte-Marie Usine
-- Arbitrage de Frédéric Bragance, 09/09/2026.
--
-- À EXÉCUTER PAR FRÉDÉRIC SUR PRODUCTION. Claude ne l'a pas appliquée : une
-- écriture sur station_config de Production est une opération Production.
--
-- Ce qui change, et pourquoi :
--   quart1.fin_normal  12:45 -> 13:15   (chevauchement 5 min -> 35 min)
--   quart1.fin_etendu  13:45 -> 14:15   (chevauchement 5 min -> 35 min)
--   quart2.fin_normal  20:05 -> 20:10   (durée 7h25 -> 7h30)
--   quart2.fin_etendu  22:05 -> 22:10   (durée 8h25 -> 8h30)
--
-- Inchangés, déjà exacts : quart1.normal et quart1.etendu à 05:45,
-- quart2.normal à 12:40, quart2.etendu à 13:40, temps_habillage_min à 15.
--
-- Le bloc `renfort` est laissé TEL QUEL : il n'était pas dans le tableau
-- canonique, et le retirer ou le modifier sans arbitrage effacerait une
-- configuration peut-être encore en usage.

update public.station_config
   set horaires = jsonb_set(jsonb_set(jsonb_set(jsonb_set(
         horaires,
         '{quart1,fin_normal}', '"13:15"'),
         '{quart1,fin_etendu}', '"14:15"'),
         '{quart2,fin_normal}', '"20:10"'),
         '{quart2,fin_etendu}', '"22:10"')
 where site = 'vito-sainte-marie';

-- CONTRÔLE À LIRE APRÈS, avant de refermer : les deux règles doivent tomber
-- juste. Si l'une des deux est fausse, la mise à jour est à revoir.
select
  (horaires#>>'{quart1,fin_normal}') as fin_q1_dim_mer,
  (horaires#>>'{quart2,normal}')     as debut_q2_dim_mer,
  'chevauchement attendu 35 min'     as regle_1,
  (horaires#>>'{quart1,fin_etendu}') as fin_q1_jeu_sam,
  (horaires#>>'{quart2,etendu}')     as debut_q2_jeu_sam,
  'durées attendues 7h30 et 8h30'    as regle_2
from public.station_config
where site = 'vito-sainte-marie';
