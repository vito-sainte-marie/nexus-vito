-- NEXUS Scanner T3 : EMPREINTES DES REGISTRES T2 de vito-sainte-marie (LECTURE SEULE). Condition 2 du contre-audit du 17/11, 11 h 59 :
-- les 130 règles tarifaires T2 et les décisions historiques sont préservées. Lignes de recette T3 (préfixe « RECETTE T3 ») exclues.
-- À jouer avant la migration, après la migration et après la recette : les trois sorties doivent être identiques.
-- Colonne lien (prix_decide_id) volontairement exclue : elle n'existe qu'après la migration.
begin transaction read only;
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
rollback;
