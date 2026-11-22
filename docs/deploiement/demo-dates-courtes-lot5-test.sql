-- Jeu de démonstration Dates courtes, lot 5 (Prévention des pertes), pour la base de TEST seulement.
-- Données fictives, libellés préfixés « [Démo] », clés d'idempotence préfixées « demo- ».
-- Toutes les saisies passent par dates_courtes_enregistrer et les fonctions de tournée, sous l'identité de leur auteur
-- (M1 : gestion ; MC : opérateur distinct). Aucune insertion directe dans les tables de Dates courtes.
-- Rejouable : une seconde exécution ne crée rien de plus. Retrait : demo-dates-courtes-lot5-test-retrait.sql.
-- Refuse de tourner si la base n'est pas Test, si la station nexus-station-test est absente ou si les comptes manquent.
-- Ne crée aucun compte d'authentification : M1 et MC sont choisis parmi les employés actifs de la station de test.
begin;

do $garde_demo$
declare v_id text;
begin
  if coalesce(current_setting('recette.banc_local', true), '') <> 'pglite-jetable' then
    select system_identifier::text into v_id from pg_control_system();
    if v_id is distinct from '7678069749886157684' then
      raise exception 'GARDE_DEMO : base inattendue (%), arrêt', v_id;
    end if;
  end if;
  if not exists (select 1 from sites where site_id = 'nexus-station-test') then
    raise exception 'GARDE_DEMO : station nexus-station-test absente, arrêt';
  end if;
  if to_regprocedure('dates_courtes_prevention_pertes(timestamptz)') is null then
    raise exception 'GARDE_DEMO : migration dates_courtes_lot5 absente, arrêt';
  end if;
end
$garde_demo$;

create temp table demo_ids (k text primary key, v uuid) on commit drop;
grant all on demo_ids to public;

do $choix$
declare v_m1 uuid; v_mc uuid;
begin
  select id into v_m1 from employees
    where site_id = 'nexus-station-test' and actif and (role in ('manager', 'gerant') or est_createur)
    order by (role = 'manager') desc, id limit 1;
  if v_m1 is null then
    raise exception 'GARDE_DEMO : aucun manager, gérant ou créateur actif sur nexus-station-test, arrêt';
  end if;
  select id into v_mc from employees
    where site_id = 'nexus-station-test' and actif and id <> v_m1 and role in ('renfort', 'manager', 'gerant')
    order by (role = 'renfort') desc, id limit 1;
  if v_mc is null then
    raise exception 'GARDE_DEMO : aucun second opérateur actif (renfort, manager ou gérant) sur nexus-station-test, arrêt';
  end if;
  insert into demo_ids values ('M1', v_m1), ('MC', v_mc);
end
$choix$;

create or replace function pg_temp.comme(k text) returns void language plpgsql as $$
declare v uuid;
begin
  reset role;
  select demo_ids.v into v from demo_ids where demo_ids.k = comme.k;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end $$;

-- 1. Articles : prix d'achat et de vente HT identiques dans le catalogue produits (articles 1 à 3) et dans l'import d'inventaire (4 et 5).
--    L'article 6 n'a aucun prix et aucun libellé : il sert au cas « sans prix ».
reset role;
insert into products (site, periode_debut, periode_fin, article, prix_achat, prix_vente, code_barres, categorie)
select 'nexus-station-test', current_date - 30, current_date, a.article, a.pa, a.pv, a.ean, '[Démo]'
from (values
  ('[Démo] Jambon blanc 4 tranches', 2.10, 3.49, '2999900000013'),
  ('[Démo] Saucisson sec', 3.20, 4.95, '2999900000020'),
  ('[Démo] Pâté de campagne', 1.40, 2.29, '2999900000037')) a(article, pa, pv, ean)
where not exists (select 1 from products p where p.site = 'nexus-station-test' and p.article = a.article);

insert into inventaire_quarts (site, date, quart, statut, is_simulation)
select 'nexus-station-test', current_date, '[Démo] Dates courtes', 'brouillon', true
where not exists (select 1 from inventaire_quarts where site = 'nexus-station-test' and date = current_date and quart = '[Démo] Dates courtes');

insert into inventaire_ventes_import (site, quart_id, designation_brute, code_barres_brut, categorie_brute, quantite_vendue, prix_achat_ht, prix_vente_ht)
select 'nexus-station-test', q.id, a.des, a.ean, '[Démo]', 0, a.pa, a.pv
from inventaire_quarts q,
  (values ('[Démo] Yaourt nature x4', '2999900000044', 0.95, 1.59), ('[Démo] Salade composée', '2999900000051', 1.80, 2.99)) a(des, ean, pa, pv)
where q.site = 'nexus-station-test' and q.date = current_date and q.quart = '[Démo] Dates courtes'
  and not exists (select 1 from inventaire_ventes_import i where i.site = 'nexus-station-test' and i.designation_brute = a.des);

-- 2. Tournées et saisies, chacune sous l'identité de son auteur. Heures de geste relatives à l'instant d'exécution.
do $saisies$
declare
  v_tc uuid; v_tf uuid; v_r jsonb; v_ret1 uuid; v_ret2 uuid;
  v_d date := current_date;
begin
  -- Tournée « Charcuterie », par MC.
  perform pg_temp.comme('MC');
  v_tc := (dates_courtes_creer_tournee('[Démo] Charcuterie', 'demo-tournee-charcuterie') ->> 'tournee_id')::uuid;
  -- Tournée « Frais du matin », par M1, ouverte en même temps (les deux se recouvrent sur le saucisson).
  perform pg_temp.comme('M1');
  v_tf := (dates_courtes_creer_tournee('[Démo] Frais du matin', 'demo-tournee-frais') ->> 'tournee_id')::uuid;

  perform pg_temp.comme('MC');
  -- Article expiré : date limite hier, relevé il y a 3 heures (donc « à retirer »).
  perform dates_courtes_enregistrer('releve', 'demo-rel-jambon', jsonb_build_object('tournee_id', v_tc, 'ean', '2999900000013', 'libelle', '[Démo] Jambon blanc 4 tranches', 'date_limite', v_d - 1, 'quantite', 6, 'heure_geste', now() - interval '3 hours'));
  -- Échéance à J+1 (saucisson, relevé aussi par M1 plus bas : le recouvrement).
  perform dates_courtes_enregistrer('releve', 'demo-rel-saucisson-mc', jsonb_build_object('tournee_id', v_tc, 'ean', '2999900000020', 'libelle', '[Démo] Saucisson sec', 'date_limite', v_d + 1, 'quantite', 8, 'heure_geste', now() - interval '170 minutes'));
  -- Échéance à J+2.
  perform dates_courtes_enregistrer('releve', 'demo-rel-pate', jsonb_build_object('tournee_id', v_tc, 'ean', '2999900000037', 'libelle', '[Démo] Pâté de campagne', 'date_limite', v_d + 2, 'quantite', 5, 'heure_geste', now() - interval '160 minutes'));
  -- Retrait physique de 2 jambons.
  v_r := dates_courtes_enregistrer('retrait', 'demo-ret-jambon', jsonb_build_object('tournee_id', v_tc, 'ean', '2999900000013', 'libelle', '[Démo] Jambon blanc 4 tranches', 'date_limite', v_d - 1, 'quantite', 2, 'heure_geste', now() - interval '150 minutes'));
  v_ret1 := (v_r -> 'lignes' -> 0 ->> 'id')::uuid;

  perform pg_temp.comme('M1');
  -- Échéance à J+4.
  perform dates_courtes_enregistrer('releve', 'demo-rel-yaourt', jsonb_build_object('tournee_id', v_tf, 'ean', '2999900000044', 'libelle', '[Démo] Yaourt nature x4', 'date_limite', v_d + 4, 'quantite', 12, 'heure_geste', now() - interval '120 minutes'));
  -- Relevé ancien, à J-11 (« à vérifier » puis « à recontrôler »).
  perform dates_courtes_enregistrer('releve', 'demo-rel-salade-ancien', jsonb_build_object('tournee_id', v_tf, 'ean', '2999900000051', 'libelle', '[Démo] Salade composée', 'date_limite', v_d + 3, 'quantite', 4, 'heure_geste', now() - interval '11 days'));
  -- Recouvrement : le saucisson aussi relevé dans l'autre tournée, entre deux gestes.
  perform dates_courtes_enregistrer('releve', 'demo-rel-saucisson-m1', jsonb_build_object('tournee_id', v_tf, 'ean', '2999900000020', 'libelle', '[Démo] Saucisson sec', 'date_limite', v_d + 1, 'quantite', 3, 'heure_geste', now() - interval '165 minutes'));
  -- Article sans libellé : code-barres seul, échéance à J+2, un retrait d'une unité.
  perform dates_courtes_enregistrer('releve', 'demo-rel-sans-libelle', jsonb_build_object('tournee_id', v_tf, 'ean', '2999900000068', 'date_limite', v_d + 2, 'quantite', 3, 'heure_geste', now() - interval '110 minutes'));
  v_r := dates_courtes_enregistrer('retrait', 'demo-ret-sans-libelle', jsonb_build_object('tournee_id', v_tf, 'ean', '2999900000068', 'date_limite', v_d + 2, 'quantite', 1, 'heure_geste', now() - interval '100 minutes'));
  v_ret2 := (v_r -> 'lignes' -> 0 ->> 'id')::uuid;
  perform dates_courtes_terminer_tournee(v_tf);

  perform pg_temp.comme('MC');
  perform dates_courtes_terminer_tournee(v_tc);

  -- Démarques comptabilisées par la gestion : la première sur un article avec prix, la seconde sur l'article sans prix.
  perform pg_temp.comme('M1');
  perform dates_courtes_comptabiliser_demarque(v_ret1, 2, 'DLC dépassée (démo)', 'demo-dem-jambon', now() - interval '90 minutes');
  perform dates_courtes_comptabiliser_demarque(v_ret2, 1, 'Article sans prix (démo)', 'demo-dem-sans-prix', now() - interval '80 minutes');
  reset role;
end
$saisies$;

-- 3. Contrôle : rien d'autre que le site de test n'a été touché.
do $controle$
begin
  if exists (select 1 from dates_courtes_releves where site <> 'nexus-station-test' and cle_idempotence like 'demo-%')
     or exists (select 1 from dates_courtes_retraits where site <> 'nexus-station-test' and cle_idempotence like 'demo-%') then
    raise exception 'GARDE_DEMO : une ligne de démonstration touche un autre site, arrêt (rien n''est validé)';
  end if;
  raise notice 'DEMO_DC5 : % relevés, % retraits, % démarques sur nexus-station-test',
    (select count(*) from dates_courtes_releves where site = 'nexus-station-test' and cle_idempotence like 'demo-%'),
    (select count(*) from dates_courtes_retraits where site = 'nexus-station-test' and cle_idempotence like 'demo-%'),
    (select count(*) from dates_courtes_demarques where site = 'nexus-station-test' and cle_idempotence like 'demo-%');
end
$controle$;

commit;
