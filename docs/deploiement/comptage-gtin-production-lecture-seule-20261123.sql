-- Comptage GTIN : LECTURE SEULE, Production, site vito-sainte-marie.
-- A jouer par Guardian uniquement sur GO distinct du pilote. Aucune ecriture.
-- Lecture seule stricte (aucune fonction temporaire : passe en transaction read only).
-- Ne renvoie que des comptes : `article` n'apparait que dans count(distinct ...), jamais affiche.
with x as (select regexp_replace(coalesce(code_barres,''),'[^0-9]','','g') d, article art
           from products where site = 'vito-sainte-marie'),
g as (select *, length(d) len, case when length(d) in (8,12,13,14) then lpad(d,14,'0') end g14 from x),
v as (select *, case when g14 is not null then ((10-(select sum(substr(g14,i,1)::int*case when i%2=1 then 3 else 1 end) from generate_series(1,13) i)%10)%10)=right(g14,1)::int end ok from g)
select count(distinct art) filter (where len>0) articles_distincts_avec_code,
  count(distinct art) filter (where len in (8,13) and ok) valides_regle_actuelle,
  count(distinct art) filter (where ok) valides_regle_proposee,
  count(distinct art) filter (where ok and len=12) upca_gagnes,
  count(distinct art) filter (where g14 is not null and not ok) cle_fausse,
  count(distinct art) filter (where len between 9 and 11) incomplets_11,
  (select count(*) from (select g14 from v where ok group by g14 having count(distinct art)>1) t) gtin14_articles_distincts
from v;
