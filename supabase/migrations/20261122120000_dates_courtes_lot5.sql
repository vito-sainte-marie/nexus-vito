-- Dates courtes, lot 5 : Prévention des pertes (lecture seule pour la gestion).
-- Ajout seul : une table de capture des prix, trois fonctions internes, un trigger, une fonction de lecture.
-- Aucune table du lot 1 n'est modifiée, aucun rôle nouveau, aucun droit élargi. Retour arrière : docs/deploiement/retour-arriere-dates-courtes-lot5-20261122.sql.

-- 0. Prérequis : on refuse de commencer si le lot 1 ou les sources de prix manquent.
do $prerequis$
declare v_manque text[] := '{}'; v_n text;
begin
  foreach v_n in array array['dates_courtes_demarques', 'dates_courtes_retraits', 'dates_courtes_tournees', 'products', 'inventaire_ventes_import'] loop
    if to_regclass('public.' || v_n) is null then v_manque := v_manque || v_n; end if;
  end loop;
  foreach v_n in array array['dates_courtes_gestion()', 'dates_courtes_courant_station(text,timestamptz)', 'dates_courtes_normaliser_ean(text)', 'dates_courtes_normaliser_libelle(text)'] loop
    if to_regprocedure('public.' || v_n) is null then v_manque := v_manque || v_n; end if;
  end loop;
  if array_length(v_manque, 1) is not null then
    raise exception 'prerequis_migrations : 20261121120000 : objets absents : %', array_to_string(v_manque, ', ') using errcode = 'P0001';
  end if;
end $prerequis$;

-- 1. Prix capturé à la pose d'une démarque. « absent » : aucun prix trouvé, la ligne n'est jamais valorisée à zéro.
create table if not exists dates_courtes_prix_demarques (
  demarque_id uuid primary key references dates_courtes_demarques(id),
  site text not null references sites(site_id),
  prix_achat_ht numeric(12, 4) check (prix_achat_ht is null or prix_achat_ht > 0),
  prix_vente_ht numeric(12, 4) check (prix_vente_ht is null or prix_vente_ht > 0),
  source text not null check (source in ('products', 'inventaire_ventes_import', 'absent')),
  periode_debut date,
  periode_fin date,
  capture_le timestamptz not null default now(),
  constraint dates_courtes_prix_demarques_coherence check ((source = 'absent' and prix_achat_ht is null and prix_vente_ht is null)
    or (source <> 'absent' and prix_achat_ht is not null))
);
create index if not exists dates_courtes_prix_demarques_site on dates_courtes_prix_demarques (site);

-- 2. Recherche du prix d'un article à une date. Fonction interne : aucun droit client.
-- Source 1 : products (période contenant la date, sinon la plus récente avant). Source 2 : dernier import d'inventaire avant la date.
-- Le prix de vente reste dans la même nature (HT ou TTC) que le prix d'achat de la même source : c'est le contrôle de nature fiscale qui tranche.
create or replace function dates_courtes_prix_article(p_site text, p_ean text, p_libelle text, p_date date)
returns table (prix_achat numeric, prix_vente numeric, source text, periode_debut date, periode_fin date)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
    select p.prix_achat::numeric, nullif(p.prix_vente, 0)::numeric, 'products'::text, p.periode_debut::date, p.periode_fin::date
    from products p
    where p.site = p_site and p.prix_achat > 0 and p.periode_debut <= p_date
      and ((p_ean is not null and dates_courtes_normaliser_ean(p.code_barres) = p_ean)
        or (p_libelle is not null and dates_courtes_normaliser_libelle(p.article) = p_libelle))
    order by (p.periode_fin >= p_date) desc, p.periode_fin desc, p.imported_at desc nulls last
    limit 1;
  if found then return; end if;
  return query
    select v.prix_achat_ht::numeric, nullif(v.prix_vente_ht, 0)::numeric, 'inventaire_ventes_import'::text, null::date, null::date
    from inventaire_ventes_import v
    where v.site = p_site and v.prix_achat_ht > 0 and v.importe_le::date <= p_date
      and ((p_ean is not null and dates_courtes_normaliser_ean(v.code_barres_brut) = p_ean)
        or (p_libelle is not null and dates_courtes_normaliser_libelle(v.designation_brute) = p_libelle))
    order by v.importe_le desc
    limit 1;
end $$;

-- 2 bis. Libellé affiché : le libellé lu (libelle_vu) du dernier relevé de l'article, à défaut le nom du catalogue (products), à défaut le libellé normalisé.
-- Fonction interne : aucun droit client.
create or replace function dates_courtes_libelle_affiche(p_site text, p_ean text, p_libelle text) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select r.libelle_vu from dates_courtes_releves r
      where r.site = p_site and r.annule_le is null and nullif(btrim(r.libelle_vu), '') is not null
        and ((p_ean is not null and r.ean = p_ean) or (p_ean is null and r.libelle_normalise = p_libelle))
      order by r.heure_geste desc limit 1),
    (select p.article from products p
      where p.site = p_site and p_ean is not null and dates_courtes_normaliser_ean(p.code_barres) = p_ean and nullif(btrim(p.article), '') is not null
      order by p.periode_fin desc, p.imported_at desc nulls last limit 1),
    p_libelle, p_ean)
$$;

-- 3. Capture du prix à l'insertion d'une démarque. Ne bloque jamais la saisie : en cas d'échec, la ligne est « absent » et un avertissement part au journal.
create or replace function dates_courtes_capturer_prix_demarque() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ean text; v_lib text; v_jour date; v_p record;
begin
  begin
    select r.ean, r.libelle_normalise into v_ean, v_lib from dates_courtes_retraits r where r.id = new.retrait_id and r.site = new.site;
    v_jour := (new.heure_geste at time zone 'America/Martinique')::date;
    select * into v_p from dates_courtes_prix_article(new.site, v_ean, v_lib, v_jour);
    if v_p.prix_achat is null then
      insert into dates_courtes_prix_demarques (demarque_id, site, source) values (new.id, new.site, 'absent');
    else
      insert into dates_courtes_prix_demarques (demarque_id, site, prix_achat_ht, prix_vente_ht, source, periode_debut, periode_fin)
      values (new.id, new.site, v_p.prix_achat, v_p.prix_vente, v_p.source, v_p.periode_debut, v_p.periode_fin);
    end if;
  exception when others then
    raise warning 'dates_courtes_capture_prix : % : %', new.id, sqlerrm;
    insert into dates_courtes_prix_demarques (demarque_id, site, source) values (new.id, new.site, 'absent') on conflict do nothing;
  end;
  return null;
end $$;

drop trigger if exists dates_courtes_capture_prix on dates_courtes_demarques;
create trigger dates_courtes_capture_prix after insert on dates_courtes_demarques
  for each row execute function dates_courtes_capturer_prix_demarque();

-- 4. Nature fiscale : les prix de products et ceux de l'inventaire désignent-ils le même niveau (HT) ?
-- On compare, article par article, le dernier prix d'achat de chaque source sur la fenêtre. La nature est « déterminée » si au moins un article
-- est comparable et si la médiane de |rapport - 1| ne dépasse pas la tolérance de 1,5 %. Justification : les arrondis au centime ne dépassent pas 1 %,
-- alors que le plus petit taux de TVA de Martinique (2,1 %) produit un écart net. Aucun article comparable : non déterminée, jamais présumée.
create or replace function dates_courtes_nature_fiscale(p_site text, p_depuis date)
returns table (determinee boolean, comparables integer, ecart_median numeric, tolerance numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  with a as (
    select distinct on (cle) cle, prix from (
      select coalesce(dates_courtes_normaliser_ean(p.code_barres), dates_courtes_normaliser_libelle(p.article)) cle, p.prix_achat::numeric prix, p.periode_fin, p.imported_at
      from products p where p.site = p_site and p.prix_achat > 0 and p.periode_fin >= p_depuis) s
    where cle is not null order by cle, periode_fin desc, imported_at desc nulls last
  ), b as (
    select distinct on (cle) cle, prix from (
      select coalesce(dates_courtes_normaliser_ean(v.code_barres_brut), dates_courtes_normaliser_libelle(v.designation_brute)) cle, v.prix_achat_ht::numeric prix, v.importe_le
      from inventaire_ventes_import v where v.site = p_site and v.prix_achat_ht > 0 and v.importe_le::date >= p_depuis) s
    where cle is not null order by cle, importe_le desc
  ), c as (select abs(a.prix / b.prix - 1) ecart from a join b using (cle))
  select coalesce((select percentile_cont(0.5) within group (order by ecart) from c) <= 0.015, false),
         (select count(*)::integer from c),
         round((select percentile_cont(0.5) within group (order by ecart) from c)::numeric, 4),
         0.015::numeric
$$;

-- 5. Lecture de Prévention des pertes. Site lu depuis le compte, jamais en paramètre. Réservée à la gestion.
create or replace function dates_courtes_prevention_pertes(p_instant timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_site text; v_jour date; v_debut_b date; v_nat record; v_det boolean; v_ventes_incompletes boolean; v_prix_absents boolean; v_periode_vide boolean;
  v_out jsonb;
begin
  if auth.uid() is null then
    raise exception 'non_authentifie : connexion requise' using errcode = 'P0001';
  end if;
  select e.site_id into v_site from employees e where e.id = auth.uid() and e.actif;
  if v_site is null or not dates_courtes_gestion() then
    raise exception 'droit_refuse : Prévention des pertes est réservée à la gestion' using errcode = 'P0001';
  end if;
  v_jour := (p_instant at time zone 'America/Martinique')::date;
  v_debut_b := date_trunc('month', v_jour)::date;
  select * into v_nat from dates_courtes_nature_fiscale(v_site, (v_debut_b - 60));
  v_det := v_nat.determinee;
  v_ventes_incompletes := not exists (select 1 from inventaire_ventes_import v where v.site = v_site and v.importe_le::date between v_debut_b and v_jour);
  v_prix_absents := exists (select 1 from dates_courtes_demarques dm left join dates_courtes_prix_demarques pd on pd.demarque_id = dm.id
      where dm.site = v_site and dm.annule_le is null and (dm.heure_geste at time zone 'America/Martinique')::date between v_debut_b and v_jour
        and (pd.demarque_id is null or pd.source = 'absent'));
  v_periode_vide := not exists (select 1 from dates_courtes_demarques dm where dm.site = v_site and dm.annule_le is null
      and (dm.heure_geste at time zone 'America/Martinique')::date between v_debut_b and v_jour);

  with pp as materialized (
    select p.prix_achat::numeric as pa, nullif(p.prix_vente, 0)::numeric as pv, p.periode_debut::date as pd, p.periode_fin::date as pf, p.imported_at::timestamptz as ia,
           dates_courtes_normaliser_ean(p.code_barres) as ek, dates_courtes_normaliser_libelle(p.article) as lk
    from products p where p.site = v_site and p.prix_achat > 0
  ), ry as materialized (
    select distinct on (u.ek) u.ek, u.rayon from (
      select dates_courtes_normaliser_ean(p.code_barres) as ek, nullif(btrim(p.categorie), '') as rayon, p.periode_fin, p.imported_at
      from products p where p.site = v_site) u
    where u.ek is not null and u.rayon is not null order by u.ek, u.periode_fin desc nulls last, u.imported_at desc nulls last
  ), iv as materialized (
    select v.prix_achat_ht::numeric as pa, nullif(v.prix_vente_ht, 0)::numeric as pv, v.importe_le::timestamptz as ia, v.importe_le::date as jd,
           dates_courtes_normaliser_ean(v.code_barres_brut) as ek, dates_courtes_normaliser_libelle(v.designation_brute) as lk
    from inventaire_ventes_import v where v.site = v_site and v.prix_achat_ht > 0
  ), c as (
    select cs.*, (cs.date_limite - v_jour) as r from dates_courtes_courant_station(v_site, p_instant) cs
  ), p as (
    select c.*, px.prix_achat as pu, px.prix_vente as pv, px.source as psource,
      (c.autres_tournees is not null and jsonb_array_length(c.autres_tournees) > 0) as autres
    from c left join lateral (
      select u.pa as prix_achat, u.pv as prix_vente, u.src as source, u.pdeb as periode_debut, u.pfin as periode_fin from (
        select 1 as ord, pp.pa, pp.pv, 'products'::text as src, pp.pd as pdeb, pp.pf as pfin, (pp.pf >= v_jour) as o1, pp.pf as o2, pp.ia as o3
          from pp where pp.pd <= v_jour and ((c.ean is not null and pp.ek = c.ean) or (c.libelle_normalise is not null and pp.lk = c.libelle_normalise))
        union all
        select 2, iv.pa, iv.pv, 'inventaire_ventes_import'::text, null::date, null::date, null::boolean, null::date, iv.ia
          from iv where iv.jd <= v_jour and ((c.ean is not null and iv.ek = c.ean) or (c.libelle_normalise is not null and iv.lk = c.libelle_normalise))
      ) u order by u.ord, u.o1 desc, u.o2 desc, u.o3 desc nulls last limit 1
    ) px on true
  ), cl as (
    select p.*, case when v_det then p.pu end as pu2, case when v_det then p.pv end as pv2,
      case when p.r < 0 and p.age_jours <= 7 then 'retirer'
           when p.r < 0 then 'presence'
           when p.age_jours > 14 then 'recontroler'
           when p.age_jours > 7 then 'releve'
           when p.autres then 'comparer'
           when p.r <= 7 then 'promo' end as code
    from p
  ), k as (
    select cl.*, case code when 'retirer' then 1 when 'presence' then 2 when 'recontroler' then 3 when 'releve' then 3 when 'comparer' then 2
                          when 'promo' then case when r <= 2 then 1 else 2 end end as prio
    from cl
  ), d as (
    select dm.id, dm.quantite, dm.heure_geste, r.ean, r.libelle_normalise, pd.source as psrc, pd.prix_achat_ht as ppa, pd.prix_vente_ht as ppv, pd.periode_debut as pdeb, pd.periode_fin as pfin,
      (pd.demarque_id is not null) as capt
    from dates_courtes_demarques dm
    join dates_courtes_retraits r on r.id = dm.retrait_id and r.site = dm.site
    left join dates_courtes_prix_demarques pd on pd.demarque_id = dm.id
    where dm.site = v_site and dm.annule_le is null
      and (dm.heure_geste at time zone 'America/Martinique')::date between v_debut_b and v_jour
  ), dv as (
    select d.*, case when d.capt then d.ppa else lk.prix_achat end as pu, case when d.capt then d.ppv else lk.prix_vente end as pv,
      case when d.capt and d.psrc <> 'absent' then 'fige' when d.capt then 'absent' when lk.prix_achat is not null then 'reconstitue' else 'absent' end as etat,
      case when d.capt then d.psrc else coalesce(lk.source, 'absent') end as src,
      case when d.capt then d.pdeb else lk.periode_debut end as sdeb, case when d.capt then d.pfin else lk.periode_fin end as sfin
    from d left join lateral (
      select u.pa as prix_achat, u.pv as prix_vente, u.src as source, u.pdeb as periode_debut, u.pfin as periode_fin from (
        select 1 as ord, pp.pa, pp.pv, 'products'::text as src, pp.pd as pdeb, pp.pf as pfin, (pp.pf >= (d.heure_geste at time zone 'America/Martinique')::date) as o1, pp.pf as o2, pp.ia as o3
          from pp where pp.pd <= (d.heure_geste at time zone 'America/Martinique')::date and ((d.ean is not null and pp.ek = d.ean) or (d.libelle_normalise is not null and pp.lk = d.libelle_normalise))
        union all
        select 2, iv.pa, iv.pv, 'inventaire_ventes_import'::text, null::date, null::date, null::boolean, null::date, iv.ia
          from iv where iv.jd <= (d.heure_geste at time zone 'America/Martinique')::date and ((d.ean is not null and iv.ek = d.ean) or (d.libelle_normalise is not null and iv.lk = d.libelle_normalise))
      ) u order by u.ord, u.o1 desc, u.o2 desc, u.o3 desc nulls last limit 1
    ) lk on not d.capt
  ), dw as (
    select dv.*, case when v_det then dv.pu end as pu2, case when v_det then dv.pv end as pv2 from dv
  )
  select jsonb_build_object(
    'jour', v_jour,
    'dernier_releve', (select max(dernier_releve) from c),
    'nature_fiscale', jsonb_build_object('determinee', v_det, 'comparables', v_nat.comparables, 'ecart_median', v_nat.ecart_median, 'tolerance', v_nat.tolerance),
    'compteurs', jsonb_build_object(
      'traiter', (select count(*) from k where code in ('retirer', 'promo')),
      'verifier', (select count(*) from k where code in ('presence', 'recontroler', 'releve', 'comparer')),
      'certifier', (select count(*) from dates_courtes_tournees t where t.site = v_site and t.etat = 'TERMINEE_A_CERTIFIER')),
    'liste', (select coalesce(jsonb_agg(x.o order by x.prio, x.dl, x.lib), '[]'::jsonb) from (
        select jsonb_build_object('cle_article', k.cle_article, 'ean', k.ean, 'libelle', dates_courtes_libelle_affiche(v_site, k.ean, k.libelle_normalise), 'date_limite', k.date_limite,
            'jours_restants', k.r, 'quantite', k.quantite, 'age_jours', k.age_jours, 'etat_age', k.etat_age, 'tournee_etat', k.tournee_etat,
            'categorie', case when k.code in ('retirer', 'promo') then 'traiter' else 'verifier' end,
            'code', k.code,
            'action', case k.code when 'retirer' then 'À retirer' when 'presence' then 'Vérifier la présence' when 'recontroler' then 'À recontrôler'
                                  when 'releve' then 'Relevé à vérifier' when 'comparer' then 'Comparer les tournées' when 'promo' then 'Promotion à envisager' end,
            'priorite', case k.prio when 1 then 'haute' when 2 then 'moyenne' else 'basse' end,
            'quantite_indicative', (k.code = 'releve'),
            'prix_connu', (k.pu is not null),
            'valeur', case when k.pu2 is not null then round(k.quantite * k.pu2, 2) end,
            'dernier_releve', k.dernier_releve,
            'rayon', case when k.ean is not null then (select ry.rayon from ry where ry.ek = k.ean) end,
            'autres_tournees', case when k.autres then (
              select coalesce(jsonb_agg(jsonb_build_object('tournee_id', a.tid, 'nom', a.nom, 'role', a.role_aff, 'heure', a.heure, 'quantite', a.qte, 'etat', a.etat) order by a.heure desc), '[]'::jsonb)
              from (
                select (e.o ->> 'tournee_id')::uuid as tid, e.o ->> 'nom' as nom, (e.o ->> 'heure')::timestamptz as heure, t.etat,
                  case when em.est_createur then 'Créateur' when em.role = 'renfort' then 'Renfort' when em.role = 'manager' then 'Manager'
                       when em.role = 'gerant' then 'Gérant' else 'Opérateur' end as role_aff,
                  coalesce((select sum(r.quantite) from dates_courtes_releves r
                              where r.site = v_site and r.tournee_id = (e.o ->> 'tournee_id')::uuid and r.annule_le is null and r.heure_geste <= p_instant
                                and r.date_limite = k.date_limite and dates_courtes_cle_article(r.site, r.ean, r.libelle_normalise) = k.cle_article), 0)
                  + coalesce((select sum(cr.delta) from dates_courtes_corrections cr
                              where cr.site = v_site and cr.tournee_id = (e.o ->> 'tournee_id')::uuid and cr.annule_le is null and cr.heure_geste <= p_instant
                                and cr.date_limite = k.date_limite and dates_courtes_cle_article(cr.site, cr.ean, cr.libelle_normalise) = k.cle_article), 0) as qte
                from jsonb_array_elements(k.autres_tournees) as e(o)
                left join dates_courtes_tournees t on t.id = (e.o ->> 'tournee_id')::uuid
                left join employees em on em.id = (e.o ->> 'saisi_par')::uuid) a) end) as o, k.prio, k.date_limite as dl, coalesce(k.libelle_normalise, k.ean) as lib
        from k where k.code is not null order by k.prio, k.date_limite, coalesce(k.libelle_normalise, k.ean) limit 200) x),
    'a', (select jsonb_build_object(
        'calculable', v_det and count(*) filter (where age_jours <= 7) > 0,
        'valeur', round(sum(quantite * pu2) filter (where age_jours <= 7), 2),
        'dont_non_certifiees', round(sum(quantite * pu2) filter (where age_jours <= 7 and tournee_etat <> 'CERTIFIEE'), 2),
        'unites', coalesce(sum(quantite) filter (where age_jours <= 7), 0),
        'articles_valorises', count(*) filter (where age_jours <= 7 and pu is not null),
        'sans_prix', jsonb_build_object('lignes', count(*) filter (where age_jours <= 7 and pu is null), 'unites', coalesce(sum(quantite) filter (where age_jours <= 7 and pu is null), 0)),
        'indicatif', jsonb_build_object('valeur', round(sum(quantite * pu2) filter (where age_jours between 8 and 14), 2),
            'unites', coalesce(sum(quantite) filter (where age_jours between 8 and 14), 0), 'articles', count(*) filter (where age_jours between 8 and 14)),
        'exclus', count(*) filter (where age_jours > 14),
        'plus_ancien_jours', max(age_jours) filter (where age_jours <= 7)) from k),
    'b', (select jsonb_build_object(
        'periode_debut', v_debut_b, 'periode_fin', v_jour,
        'demarques', count(*), 'unites', coalesce(sum(quantite), 0),
        'valeur', round(sum(quantite * pu2) filter (where etat <> 'absent'), 2),
        'fige', round(sum(quantite * pu2) filter (where etat = 'fige'), 2),
        'reconstitue', round(sum(quantite * pu2) filter (where etat = 'reconstitue'), 2),
        'lignes_figees', count(*) filter (where etat = 'fige'),
        'lignes_reconstituees', count(*) filter (where etat = 'reconstitue'),
        'lignes_sans_prix', count(*) filter (where etat = 'absent'),
        'badge', case when count(*) = 0 then 'aucune_perte' when count(*) filter (where etat = 'reconstitue') > 0 then 'partiellement_reconstitue' else 'fige' end,
        'detail', (select coalesce(jsonb_agg(jsonb_build_object('libelle', dates_courtes_libelle_affiche(v_site, w.ean, w.libelle_normalise), 'quantite', w.quantite,
              'heure_geste', w.heure_geste, 'date_comptabilisation', (w.heure_geste at time zone 'America/Martinique')::date,
              'etat', w.etat, 'source', w.src, 'periode_debut', w.sdeb, 'periode_fin', w.sfin,
              'prix_unitaire', w.pu2, 'valeur', case when w.pu2 is not null then round(w.quantite * w.pu2, 2) end) order by w.heure_geste desc), '[]'::jsonb)
            from (select * from dw order by heure_geste desc limit 100) w)) from dw),
    'marge', jsonb_build_object(
      'a', (select jsonb_build_object('ca_potentiel', round(sum(quantite * pv2) filter (where age_jours <= 7 and pu2 is not null and pv2 is not null), 2),
              'marge_exposee', round(sum(quantite * (pv2 - pu2)) filter (where age_jours <= 7 and pu2 is not null and pv2 is not null), 2),
              'hors_calcul', count(*) filter (where age_jours <= 7 and (pu is null or pv is null))) from k),
      'b', (select jsonb_build_object('ca_theorique', round(sum(quantite * pv2) filter (where etat <> 'absent' and pu2 is not null and pv2 is not null), 2),
              'marge_non_realisee', round(sum(quantite * (pv2 - pu2)) filter (where etat <> 'absent' and pu2 is not null and pv2 is not null), 2),
              'dont_reconstituee', round(sum(quantite * (pv2 - pu2)) filter (where etat = 'reconstitue' and pu2 is not null and pv2 is not null), 2),
              'hors_calcul', count(*) filter (where pu is null or pv is null)) from dw),
      'formule', 'CA = quantité × prix de vente HT ; marge = quantité × (prix de vente HT − prix d''achat HT)',
      'provenance', 'products, à défaut dernier import d''inventaire'),
    'c', jsonb_build_object('statut', 'indisponible', 'raisons',
      jsonb_build_array('Les ventes sont connues par article et par période, sans la date limite des unités vendues : le rapprochement avec les DLC est impossible',
                        'Aucune vente n''est attribuée à une DLC par défaut')
      || case when v_ventes_incompletes then jsonb_build_array('Historique des ventes incomplet sur la période') else '[]'::jsonb end
      || case when v_prix_absents then jsonb_build_array('Prix d''achat indisponible pour certaines lignes') else '[]'::jsonb end
      || case when v_periode_vide then jsonb_build_array('Période non exploitable : aucune démarque depuis le début du mois') else '[]'::jsonb end),
    'd', jsonb_build_object('statut', 'indisponible', 'raisons',
      jsonb_build_array('Ventes par DLC indisponibles (voir C)',
                        'Hypothèse de référence non validée : ce qui se serait vendu sans action',
                        'Une vente n''est jamais comptée comme perte évitée'))
  ) into v_out;
  return v_out;
end $$;

-- 6. Droits et sécurité. Table en lecture gestion seule ; fonctions internes sans droit client ; lecture ouverte aux comptes connectés (le contrôle de rôle est dans la fonction).
alter table dates_courtes_prix_demarques enable row level security;
alter table dates_courtes_prix_demarques force row level security;
drop policy if exists compte_actif_obligatoire on dates_courtes_prix_demarques;
create policy compte_actif_obligatoire on dates_courtes_prix_demarques as restrictive to authenticated
  using (exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif));
drop policy if exists lecture_gestion_meme_site on dates_courtes_prix_demarques;
create policy lecture_gestion_meme_site on dates_courtes_prix_demarques for select to authenticated
  using (site = (select current_employee_site_id()) and (select dates_courtes_gestion()));
revoke all on dates_courtes_prix_demarques from anon, public, authenticated, service_role;
grant select on dates_courtes_prix_demarques to authenticated, service_role;

revoke all on function dates_courtes_prix_article(text, text, text, date) from public, anon, authenticated, service_role;
revoke all on function dates_courtes_libelle_affiche(text, text, text) from public, anon, authenticated, service_role;
revoke all on function dates_courtes_capturer_prix_demarque() from public, anon, authenticated, service_role;
revoke all on function dates_courtes_nature_fiscale(text, date) from public, anon, authenticated, service_role;
revoke all on function dates_courtes_prevention_pertes(timestamptz) from public, anon, authenticated, service_role;
grant execute on function dates_courtes_prevention_pertes(timestamptz) to authenticated;

comment on table dates_courtes_prix_demarques is 'Lot 5 : prix d''achat et de vente HT capturés à la pose d''une démarque (prix figé). source absent : aucun prix, jamais valorisé à zéro.';
comment on function dates_courtes_prevention_pertes(timestamptz) is 'Lot 5 : lecture de Prévention des pertes (priorités, valeur exposée A, pertes B, marge). Gestion seule, site lu depuis le compte. C et D indisponibles.';
comment on function dates_courtes_nature_fiscale(text, date) is 'Lot 5 : contrôle de cohérence HT entre products et inventaire_ventes_import ; tolérance 1,5 % sur la médiane des écarts ; sans article comparable, non déterminée.';
