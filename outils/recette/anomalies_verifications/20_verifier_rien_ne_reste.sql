-- NEXUS Scanner tarifaire : apres 10_repetition_rollback.sql, verifier qu'il ne reste RIEN. LECTURE SEULE. Cible : Test.
begin transaction read only;
select 'ABSENCE tables et fonctions' as controle,
  (to_regclass('public.tarif_anomalies_verifications') is null) as table_verifications_absente,
  (to_regclass('public.tarif_anomalies_reevaluations') is null) as table_reevaluations_absente,
  (to_regprocedure('public.tarif_marquer_verifie(jsonb)') is null) as fonction_marquer_absente,
  (to_regprocedure('public.tarif_enregistrer_reevaluations(jsonb)') is null) as fonction_reevaluations_absente;
select 'ABSENCE : verdict' as controle, case when to_regclass('public.tarif_anomalies_verifications') is null and to_regclass('public.tarif_anomalies_reevaluations') is null
  and to_regprocedure('public.tarif_marquer_verifie(jsonb)') is null and to_regprocedure('public.tarif_enregistrer_reevaluations(jsonb)') is null then 'OK rien ne reste' else 'KO objet restant' end as verdict;
create temp table c73 as
with r(registre, actives, total, empreinte) as (
  select 'tarif_familles', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, libelle, remplace_id, annule_le), ';' order by id), '')) from tarif_familles where site = 'vito-sainte-marie'
  union all select 'tarif_rattachements', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, famille_code, remplace_id, annule_le), ';' order by id), '')) from tarif_rattachements where site = 'vito-sainte-marie'
  union all select 'tarif_seuils', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, minimum, statut_minimum, cible, statut_cible, remplace_id, annule_le), ';' order by id), '')) from tarif_seuils where site = 'vito-sainte-marie'
  union all select 'tarif_reglages', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, valeur, remplace_id, annule_le), ';' order by id), '')) from tarif_reglages where site = 'vito-sainte-marie'
  union all select 'tarif_exceptions', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, type, statut, cond_prix_ttc, cond_tolerance_cout, cond_cout_reference, remplace_id, annule_le), ';' order by id), '')) from tarif_exceptions where site = 'vito-sainte-marie'
  union all select 'tarif_prix_decides', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, nature, prix_ttc, decide_le, remplace_id, annule_le), ';' order by id), '')) from tarif_prix_decides where site = 'vito-sainte-marie' and coalesce(article, '') not like 'RECETTE T3 %'
  union all select 'tarif_prix_application', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, prix_decide_id, evenement, date_effet, annule_le), ';' order by id), '')) from tarif_prix_application where site = 'vito-sainte-marie'
  union all select 'tarif_regimes_prix', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, regime, remplace_id, annule_le), ';' order by id), '')) from tarif_regimes_prix where site = 'vito-sainte-marie'
  union all select 'tarif_controles_reglementaires', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, etat, remplace_id, annule_le), ';' order by id), '')) from tarif_controles_reglementaires where site = 'vito-sainte-marie'
  union all select 'tarif_decisions', count(*) filter (where annule_le is null), count(*), md5(coalesce(string_agg(concat_ws('|', id, cle, decision, prix_ttc_retenu, photo::text, annule_le), ';' order by id), '')) from tarif_decisions where site = 'vito-sainte-marie' and coalesce(article, '') not like 'RECETTE T3 %'
)
select registre, actives, total, empreinte from r
union all select 'TOTAL', sum(actives), sum(total), md5(string_agg(empreinte, '' order by registre)) from r
order by 1;

select * from pg_temp.c73 order by 1;
select 'CONTROLE 73 : TOTAL attendu 130 / 138 / 1752f6f440c7777399d6b0040c86438e' as controle,
  case when (select count(*) from pg_temp.c73 where registre='TOTAL' and actives=130 and total=138 and empreinte='1752f6f440c7777399d6b0040c86438e')=1 then 'OK identique' else 'KO different' end as verdict;
select 'CONTROLE 40 : ' || 'apres' as controle, (select count(*) from products) as products_lignes,
  (select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) from products t) as products_empreinte,
  (select count(*) from stock_releves) as stock_releves_lignes,
  (select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) from stock_releves t) as stock_releves_empreinte;
-- A comparer avec la ligne CONTROLE 40 : avant du script 10 (memes comptes et memes empreintes).
rollback;
