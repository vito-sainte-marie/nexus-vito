-- =====================================================================
-- A3-3 · Le fuseau horaire devient une propriété du site
--
-- NOM PROPOSÉ POUR LA MIGRATION RÉELLE :
--     supabase/migrations/20260905131500_fuseau_horaire_par_site.sql
--
-- Ce fichier n'est PAS une migration : il vit dans docs/plans/ et aucun
-- outil ne peut le prendre pour telle. Il sera copié sous le nom ci-dessus
-- au moment de l'exécution, et cet horodatage deviendra alors immuable
-- dans son identité (règle A12).
--
-- CORRIGE
--   C1-S1  20260803021549:102 — `now() at time zone 'America/Martinique'`
--          calculé UNE FOIS hors de la boucle, appliqué à TOUS les sites.
--   C1-S2  station_config.fuseau_horaire NOT NULL DEFAULT 'America/Martinique'
--          — la substitution vivait dans le schéma lui-même.
--
-- NE FAIT PAS
--   * Ne modifie aucune migration appliquée. 20260803021549 reste intacte :
--     on redéfinit la fonction, on ne réécrit pas son histoire.
--   * Ne supprime pas station_config.fuseau_horaire — des lecteurs y
--     pointent encore (C1 client, lot suivant).
--   * Ne touche NI aux horaires NI aux cuves : A3-5, lot distinct.
--
-- POURQUOI `sites` ET NON `station_config`
--   station_config peut n'avoir AUCUNE ligne — c'est le cas des trois sites
--   de nexus-test aujourd'hui. Tant que le fuseau y habite, « pas de
--   configuration » et « pas de fuseau » sont le même état, et c'est ce qui
--   rend un repli tentant. Dans `sites`, la ligne existe toujours.
-- =====================================================================

begin;

-- ── 1. La colonne, nullable d'abord ─────────────────────────────────
alter table public.sites add column if not exists timezone text;

comment on column public.sites.timezone is
  'Fuseau IANA du commerce (ex. America/Martinique, Europe/Paris). Source de vérité unique du découpage des journées. NOT NULL sans valeur par défaut : un site ne peut pas exister sans fuseau, et aucune valeur n''est devinée (A3, 05/09/2026).';

-- ── 2. Validation IANA ──────────────────────────────────────────────
-- Un CHECK ne peut pas interroger pg_timezone_names ; un trigger le peut,
-- et il rejette la valeur à l'écriture au lieu de la laisser produire un
-- calcul faux des mois plus tard.
create or replace function public.nexus_valider_fuseau_site()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if new.timezone is null or btrim(new.timezone) = '' then
    raise exception 'Le site % doit déclarer un fuseau horaire IANA.', new.site_id
      using errcode = '23514';
  end if;
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Fuseau horaire inconnu pour le site % : « % ». Attendu un nom IANA (ex. America/Martinique, Europe/Paris).',
      new.site_id, new.timezone using errcode = '23514';
  end if;
  return new;
end;
$fn$;

drop trigger if exists nexus_valider_fuseau_site on public.sites;
create trigger nexus_valider_fuseau_site
  before insert or update of timezone on public.sites
  for each row execute function public.nexus_valider_fuseau_site();

-- ── 3. Reprise des valeurs existantes ───────────────────────────────
-- Depuis station_config quand une ligne existe ET que sa valeur est un
-- fuseau IANA réel. Aucune valeur inventée.
update public.sites s
   set timezone = c.fuseau_horaire
  from public.station_config c
 where c.site = s.site_id
   and s.timezone is null
   and c.fuseau_horaire is not null
   and exists (select 1 from pg_timezone_names where name = c.fuseau_horaire);

-- ── 4. Décisions explicites, site par site ──────────────────────────
-- Chaque ligne est une décision nommée, pas un défaut. C'est la règle A3
-- appliquée à la migration elle-même.
--
-- Sur `nexus-test`, station_config est vide : les trois lignes ci-dessous
-- sont donc les seules sources. Sur la base de production, l'étape 3
-- couvrira les sites déjà configurés et l'étape 5 nommera les autres.
--
-- NOTE SUR LE SITE SENTINELLE : dans nexus-test, `vito-sainte-marie` porte
-- le nom « SITE SENTINELLE — ÉCRITURE INTERDITE ». Cette migration écrit
-- une colonne sur cette ligne — c'est inévitable puisque timezone devient
-- NOT NULL, et la valeur posée est exactement celle que la station réelle
-- porte en production. Aucune autre colonne n'est touchée.
update public.sites set timezone = 'America/Martinique'
 where site_id = 'vito-sainte-marie' and timezone is null;
update public.sites set timezone = 'America/Martinique'
 where site_id = 'nexus-station-test' and timezone is null;
update public.sites set timezone = 'America/Martinique'
 where site_id = 'site-fantome-test' and timezone is null;

-- ── 5. Fail-closed : aucun site sans fuseau ─────────────────────────
-- S'il en reste un, la migration ÉCHOUE et le nomme. On n'ajoute pas de
-- valeur par défaut pour la faire passer : ce serait exactement le défaut
-- qu'elle corrige.
do $ctrl$
declare v_manquants text;
begin
  select string_agg(site_id, ', ' order by site_id) into v_manquants
    from public.sites where timezone is null;
  if v_manquants is not null then
    raise exception 'A3-3 : ces sites n''ont pas de fuseau horaire, et aucune valeur ne sera devinée : %. Déclarez-les explicitement à l''étape 4 de cette migration.', v_manquants;
  end if;
end
$ctrl$;

alter table public.sites alter column timezone set not null;

-- ── 6. C1-S2 — le défaut du schéma disparaît ────────────────────────
alter table public.station_config alter column fuseau_horaire drop default;

comment on column public.station_config.fuseau_horaire is
  'DÉPRÉCIÉ (A3-3, 05/09/2026) — la source de vérité du fuseau est sites.timezone. Colonne conservée le temps que les lecteurs client migrent ; retrait dans un lot ultérieur. Plus aucune valeur par défaut : elle substituait silencieusement l''heure de Sainte-Marie à toute station nouvelle.';

-- ── 7. C1-S1 — la synthèse d'inventaire à l'heure de CHAQUE site ────
-- Corps repris à l'identique de 20260803021549, à une différence près :
-- l'heure locale est calculée DANS la boucle, avec le fuseau du site
-- courant. Un site sans fuseau est SAUTÉ avec un avertissement — jamais
-- traité à l'heure d'un autre.
create or replace function public.run_scheduled_inventory_reviews()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record; q record; p record;
  v_fuseau text;
  v_now_local timestamp; v_today date; v_isodow int;
  v_params jsonb; v_review_time time; v_window_start timestamp; v_window_end timestamp;
  v_period_start date; v_period_end date; v_summary jsonb; v_exists boolean;
  v_quart_cle text; v_fin_normal text; v_delai int; v_deadline timestamp; v_alerte_existe boolean;
begin
  for r in select * from station_config loop
    -- A3-3 : le fuseau du site courant, jamais un fuseau global.
    select s.timezone into v_fuseau from sites s where s.site_id = r.site;
    if v_fuseau is null then
      raise warning 'Synthèse inventaire ignorée pour le site % : aucun fuseau déclaré. NEXUS ne traite pas un site à l''heure d''un autre.', r.site;
      continue;
    end if;
    v_now_local := now() at time zone v_fuseau;
    v_today := v_now_local::date;
    v_isodow := extract(isodow from v_now_local);

    v_params := coalesce(r.parametres_inventaire, '{}'::jsonb);
    v_review_time := coalesce(nullif(v_params->>'reviewTime','')::time, '20:00'::time);
    v_window_start := v_today + v_review_time;
    v_window_end := v_window_start + interval '15 minutes';

    if v_params->>'reviewFrequency' = 'daily' and v_now_local >= v_window_start and v_now_local < v_window_end then
      v_period_start := v_today; v_period_end := v_today;
      select exists(select 1 from inventory_reviews where site = r.site and review_type = 'daily' and period_start = v_period_start and period_end = v_period_end) into v_exists;
      if not v_exists then
        v_summary := public._generate_inventory_review_core(r.site, v_period_start, v_period_end, 'daily');
        insert into inventory_reviews (site, review_type, period_start, period_end, summary_json) values (r.site, 'daily', v_period_start, v_period_end, v_summary);
      end if;
    end if;

    if v_params->>'reviewFrequency' = 'weekly' and v_isodow = coalesce(nullif(v_params->>'weeklyReviewDay','')::int, 0) + 1
       and v_now_local >= v_window_start and v_now_local < v_window_end then
      v_period_end := v_today - 1; v_period_start := v_period_end - 6;
      select exists(select 1 from inventory_reviews where site = r.site and review_type = 'weekly' and period_start = v_period_start and period_end = v_period_end) into v_exists;
      if not v_exists then
        v_summary := public._generate_inventory_review_core(r.site, v_period_start, v_period_end, 'weekly');
        insert into inventory_reviews (site, review_type, period_start, period_end, summary_json) values (r.site, 'weekly', v_period_start, v_period_end, v_summary);
      end if;
    end if;

    if v_params->>'reviewFrequency' = 'monthly'
       and extract(day from v_now_local)::int = least(coalesce(nullif(v_params->>'monthlyReviewDay','')::int, 1), extract(day from (date_trunc('month', v_today) + interval '1 month - 1 day'))::int)
       and v_now_local >= v_window_start and v_now_local < v_window_end then
      v_period_start := date_trunc('month', v_today - interval '1 month')::date;
      v_period_end := (date_trunc('month', v_today) - interval '1 day')::date;
      select exists(select 1 from inventory_reviews where site = r.site and review_type = 'monthly' and period_start = v_period_start and period_end = v_period_end) into v_exists;
      if not v_exists then
        v_summary := public._generate_inventory_review_core(r.site, v_period_start, v_period_end, 'monthly');
        insert into inventory_reviews (site, review_type, period_start, period_end, summary_json) values (r.site, 'monthly', v_period_start, v_period_end, v_summary);
      end if;
    end if;

    v_delai := coalesce(nullif(v_params->>'closureDelayMinutes','')::int, 30);
    for q in select * from inventaire_quarts where site = r.site and statut <> 'cloture' and date >= v_today - 2 loop
      v_quart_cle := case q.quart when 'matin' then 'quart1' when 'soir' then 'quart2' else null end;
      if v_quart_cle is not null and r.horaires ? v_quart_cle then
        v_fin_normal := r.horaires->v_quart_cle->>'fin_normal';
        if v_fin_normal is not null then
          v_deadline := q.date + v_fin_normal::time + (v_delai || ' minutes')::interval;
          if v_now_local > v_deadline then
            select exists(select 1 from inventaire_alertes where quart_id = q.id and type_alerte = 'cloture_en_retard' and statut in ('ouverte','en_cours')) into v_alerte_existe;
            if not v_alerte_existe then
              insert into inventaire_alertes (site, quart_id, type_alerte, gravite) values (r.site, q.id, 'cloture_en_retard', 'critique');
            end if;
          end if;
        end if;
      end if;
    end loop;

    for p in
      select produit_id, count(*) as n from inventaire_alertes
      where site = r.site and produit_id is not null and cree_le >= (v_now_local - interval '7 days')
        and type_alerte not in ('anomalie_repetee','cloture_en_retard','cloture_incomplete','reassort_non_justifie','modification_apres_validation')
      group by produit_id having count(*) >= 3
    loop
      select exists(select 1 from inventaire_alertes where produit_id = p.produit_id and type_alerte = 'anomalie_repetee' and statut in ('ouverte','en_cours') and cree_le >= (v_now_local - interval '7 days')) into v_alerte_existe;
      if not v_alerte_existe then
        insert into inventaire_alertes (site, produit_id, type_alerte, gravite, valeur_constatee) values (r.site, p.produit_id, 'anomalie_repetee', 'attention', p.n);
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.run_scheduled_inventory_reviews() from public;

commit;
