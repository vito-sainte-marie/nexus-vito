-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260810014824 · fdj_pilotage_phase_b_vues_agregation
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- NEXUS FDJ Pilotage — Phase B (audit "Moteur de clairvoyance manager",
-- §41/§42) : vues d'agrégation dérivées des tables sources, jamais une
-- nouvelle vérité. Grain quotidien partout où c'est pertinent, pour que la
-- future page Analyse (Phase C) puisse recomposer n'importe quelle période
-- ("Aujourd'hui", "Cette semaine", dates personnalisées...) par simple
-- SOMME sur une plage de dates, sans dupliquer ces vues par période.
--
-- Principe respecté (Article 11, "une seule vérité") : ces vues ASSEMBLENT
-- des valeurs déjà calculées et validées par NEXUS-FDJ-v1.html /
-- NEXUS-FDJ-Manager-v1.html / nexus-fdj-moteur.js (ventes_qte,
-- ventes_valeur, caisse_attendue, écart...) — elles ne recalculent AUCUNE
-- formule métier. Les écarts "provisoire" (non encore validés par un
-- manager) sont systématiquement exclus des agrégats de pilotage, comme
-- l'exige le document (§45 : "les écarts provisoires ne figurent pas dans
-- les classements définitifs").
--
-- Volontairement absent de cette migration : un "view_fdj_stock_state" qui
-- recalculerait bureau/caisse/activé en SQL. Ce calcul dépend du dernier
-- point zéro (fdj_stock_references) et vit déjà, testé, dans
-- NexusFdjMoteur.soldesCarnetsAvecReference (nexus-fdj-moteur.js) — le
-- dupliquer ici créerait exactement le risque que la Constitution NEXUS
-- interdit (la même formule à deux endroits, un jour en désaccord).

-- ------------------------------------------------------------
-- BASE : un fait par quart, assemblé (jamais recalculé) depuis
-- fdj_shifts + fdj_cash_controls + fdj_shift_counts.
-- ------------------------------------------------------------
create or replace view view_fdj_shift_facts as
select
  s.id as shift_id,
  s.site,
  s.date,
  s.quart,
  s.employee_id,
  s.statut as statut_shift,
  cc.statut as statut_caisse,
  cc.ventes_grattage_valeur,
  cc.caisse_tirages,
  cc.caisse_attendue,
  cc.caisse_reelle,
  cc.ecart,
  cc.motif_ecart,
  sc.tickets_vendus,
  sc.nb_jeux_comptes
from fdj_shifts s
left join fdj_cash_controls cc on cc.shift_id = s.id
left join (
  select shift_id,
    sum(ventes_qte) as tickets_vendus,
    count(*) filter (where ventes_qte is not null) as nb_jeux_comptes
  from fdj_shift_counts
  group by shift_id
) sc on sc.shift_id = s.id;

-- ------------------------------------------------------------
-- RÉSUMÉS PÉRIODE (jour / semaine ISO / mois / année) — §46 Phase B,
-- item 5. Uniquement les quarts dont la caisse n'est plus "provisoire"
-- entrent dans les sommes financières ; nb_quarts reste le compte brut
-- pour ne rien cacher de l'activité opérationnelle.
-- ------------------------------------------------------------
create or replace view view_fdj_daily_summary as
select
  site, date,
  count(*) as nb_quarts,
  count(*) filter (where statut_shift = 'valide') as nb_quarts_valides,
  count(*) filter (where statut_caisse is not null and statut_caisse <> 'provisoire') as nb_quarts_controles,
  count(*) filter (where statut_caisse = 'conforme') as nb_quarts_conformes,
  sum(ventes_grattage_valeur) filter (where statut_caisse <> 'provisoire') as ca_grattage,
  sum(tickets_vendus) filter (where statut_caisse <> 'provisoire') as tickets_vendus,
  sum(caisse_tirages) filter (where statut_caisse <> 'provisoire') as caisse_tirages,
  sum(ecart) filter (where statut_caisse <> 'provisoire') as ecart_total,
  count(*) filter (where statut_caisse <> 'provisoire' and ecart <> 0) as nb_ecarts_non_nuls
from view_fdj_shift_facts
group by site, date;

create or replace view view_fdj_weekly_summary as
select
  site,
  date_trunc('week', date)::date as semaine_debut,
  to_char(date, 'IYYY-"S"IW') as semaine_iso,
  count(*) as nb_quarts,
  count(*) filter (where statut_shift = 'valide') as nb_quarts_valides,
  count(*) filter (where statut_caisse is not null and statut_caisse <> 'provisoire') as nb_quarts_controles,
  count(*) filter (where statut_caisse = 'conforme') as nb_quarts_conformes,
  sum(ventes_grattage_valeur) filter (where statut_caisse <> 'provisoire') as ca_grattage,
  sum(tickets_vendus) filter (where statut_caisse <> 'provisoire') as tickets_vendus,
  sum(caisse_tirages) filter (where statut_caisse <> 'provisoire') as caisse_tirages,
  sum(ecart) filter (where statut_caisse <> 'provisoire') as ecart_total,
  count(*) filter (where statut_caisse <> 'provisoire' and ecart <> 0) as nb_ecarts_non_nuls
from view_fdj_shift_facts
group by site, date_trunc('week', date), to_char(date, 'IYYY-"S"IW');

create or replace view view_fdj_monthly_summary as
select
  site,
  date_trunc('month', date)::date as mois_debut,
  to_char(date, 'YYYY-MM') as mois_label,
  count(*) as nb_quarts,
  count(*) filter (where statut_shift = 'valide') as nb_quarts_valides,
  count(*) filter (where statut_caisse is not null and statut_caisse <> 'provisoire') as nb_quarts_controles,
  count(*) filter (where statut_caisse = 'conforme') as nb_quarts_conformes,
  sum(ventes_grattage_valeur) filter (where statut_caisse <> 'provisoire') as ca_grattage,
  sum(tickets_vendus) filter (where statut_caisse <> 'provisoire') as tickets_vendus,
  sum(caisse_tirages) filter (where statut_caisse <> 'provisoire') as caisse_tirages,
  sum(ecart) filter (where statut_caisse <> 'provisoire') as ecart_total,
  count(*) filter (where statut_caisse <> 'provisoire' and ecart <> 0) as nb_ecarts_non_nuls
from view_fdj_shift_facts
group by site, date_trunc('month', date), to_char(date, 'YYYY-MM');

create or replace view view_fdj_yearly_summary as
select
  site,
  date_trunc('year', date)::date as annee_debut,
  to_char(date, 'YYYY') as annee_label,
  count(*) as nb_quarts,
  count(*) filter (where statut_shift = 'valide') as nb_quarts_valides,
  count(*) filter (where statut_caisse is not null and statut_caisse <> 'provisoire') as nb_quarts_controles,
  count(*) filter (where statut_caisse = 'conforme') as nb_quarts_conformes,
  sum(ventes_grattage_valeur) filter (where statut_caisse <> 'provisoire') as ca_grattage,
  sum(tickets_vendus) filter (where statut_caisse <> 'provisoire') as tickets_vendus,
  sum(caisse_tirages) filter (where statut_caisse <> 'provisoire') as caisse_tirages,
  sum(ecart) filter (where statut_caisse <> 'provisoire') as ecart_total,
  count(*) filter (where statut_caisse <> 'provisoire' and ecart <> 0) as nb_ecarts_non_nuls
from view_fdj_shift_facts
group by site, date_trunc('year', date), to_char(date, 'YYYY');

-- ------------------------------------------------------------
-- JEU — §46 Phase B, item 6. Deux sources distinctes assemblées : les
-- ventes (grain quart, comptages validés) et les mouvements de stock
-- (grain évènement, toujours connus). Séparées puis combinées en
-- FULL OUTER JOIN pour ne jamais confondre "aucune vente comptée ce
-- jour-là" (NULL, vérité avant certitude) et "zéro mouvement ce jour-là"
-- (0, fait vérifiable — on connaît tous les mouvements).
-- ------------------------------------------------------------
create or replace view view_fdj_game_daily_ventes as
select
  s.site, s.date, sc.game_id,
  sum(sc.ventes_qte) as tickets_vendus,
  sum(sc.ventes_valeur) as ca,
  count(*) as nb_quarts_comptes
from fdj_shift_counts sc
join fdj_shifts s on s.id = sc.shift_id
join fdj_cash_controls cc on cc.shift_id = s.id and cc.statut <> 'provisoire'
where sc.ventes_qte is not null
group by s.site, s.date, sc.game_id;

create or replace view view_fdj_game_daily_mouvements as
select
  site,
  (created_at at time zone 'Europe/Paris')::date as date,
  game_id,
  count(*) filter (where type_mouvement = 'activation') as nb_activations,
  coalesce(sum(quantite) filter (where type_mouvement = 'activation'), 0) as qte_activations,
  count(*) filter (where type_mouvement = 'transfert') as nb_transferts,
  coalesce(sum(quantite) filter (where type_mouvement = 'transfert'), 0) as qte_transferts,
  count(*) filter (where type_mouvement = 'reception') as nb_receptions,
  coalesce(sum(quantite) filter (where type_mouvement = 'reception'), 0) as qte_receptions,
  count(*) filter (where type_mouvement = 'blocage') as nb_blocages,
  coalesce(sum(quantite) filter (where type_mouvement = 'blocage'), 0) as qte_blocages
from fdj_stock_movements
group by site, (created_at at time zone 'Europe/Paris')::date, game_id;

create or replace view view_fdj_game_daily as
select
  coalesce(v.site, m.site) as site,
  coalesce(v.date, m.date) as date,
  coalesce(v.game_id, m.game_id) as game_id,
  v.tickets_vendus, v.ca, v.nb_quarts_comptes,
  coalesce(m.nb_activations, 0) as nb_activations,
  coalesce(m.qte_activations, 0) as qte_activations,
  coalesce(m.nb_transferts, 0) as nb_transferts,
  coalesce(m.qte_transferts, 0) as qte_transferts,
  coalesce(m.nb_receptions, 0) as nb_receptions,
  coalesce(m.qte_receptions, 0) as qte_receptions,
  coalesce(m.nb_blocages, 0) as nb_blocages,
  coalesce(m.qte_blocages, 0) as qte_blocages
from view_fdj_game_daily_ventes v
full outer join view_fdj_game_daily_mouvements m
  on m.site = v.site and m.date = v.date and m.game_id = v.game_id;

-- ------------------------------------------------------------
-- PALIER DE PRIX — §11, calculé à partir des ventes réelles (jamais du
-- nombre de références disponibles).
-- ------------------------------------------------------------
create or replace view view_fdj_price_tier_daily as
select
  v.site, v.date, g.prix as palier,
  sum(v.tickets_vendus) as tickets_vendus,
  sum(v.ca) as ca
from view_fdj_game_daily_ventes v
join fdj_games g on g.id = v.game_id
group by v.site, v.date, g.prix;

-- ------------------------------------------------------------
-- EMPLOYÉ — §14, toujours accompagné du nombre de quarts pour ne jamais
-- comparer des volumes de présence différents sans le dire.
-- ------------------------------------------------------------
create or replace view view_fdj_employee_daily as
select
  site, date, employee_id,
  count(*) as nb_quarts,
  count(*) filter (where statut_shift = 'valide') as nb_quarts_valides,
  count(*) filter (where statut_caisse is not null and statut_caisse <> 'provisoire') as nb_quarts_controles,
  count(*) filter (where statut_caisse = 'conforme') as nb_quarts_conformes,
  sum(ventes_grattage_valeur) filter (where statut_caisse <> 'provisoire') as ca_grattage,
  sum(tickets_vendus) filter (where statut_caisse <> 'provisoire') as tickets_vendus,
  sum(ecart) filter (where statut_caisse <> 'provisoire') as ecart_total,
  count(*) filter (where statut_caisse <> 'provisoire' and ecart <> 0) as nb_ecarts_non_nuls
from view_fdj_shift_facts
where employee_id is not null
group by site, date, employee_id;

-- ------------------------------------------------------------
-- ÉCARTS — §15, §22 : de quoi retrouver "deux écarts validés concentrés
-- sur la même cause" sans recompter la caisse. Un seul écart non nul par
-- quart validé, jamais un écart provisoire.
-- ------------------------------------------------------------
create or replace view view_fdj_discrepancy_daily as
select
  site, date, motif_ecart,
  count(*) as nb_occurrences,
  sum(ecart) as ecart_total,
  avg(ecart) as ecart_moyen
from view_fdj_shift_facts
where statut_caisse is not null and statut_caisse <> 'provisoire' and ecart <> 0
group by site, date, motif_ecart;
