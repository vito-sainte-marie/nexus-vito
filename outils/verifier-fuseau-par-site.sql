-- A3-3 · Preuves à exécuter APRÈS application de la migration, sur nexus-test.
-- Hors suite de tests : run-tests.js n'accède à aucun réseau.
-- Aucune de ces vérifications ne laisse de trace : les deux écritures d'essai
-- sont annulées par un rollback explicite.

-- ─────────────────────────────────────────────────────────────────────
-- PREUVE 1 — un fuseau invalide est REFUSÉ
-- Attendu : ERREUR 23514 « Fuseau horaire inconnu … Europe/Atlantide »
-- ─────────────────────────────────────────────────────────────────────
begin;
  update public.sites set timezone = 'Europe/Atlantide' where site_id = 'site-fantome-test';
rollback;

-- Variante : chaîne vide, également refusée (23514).
begin;
  update public.sites set timezone = '' where site_id = 'site-fantome-test';
rollback;

-- Variante : un fuseau IANA réel mais différent est ACCEPTÉ — la contrainte
-- valide la forme, elle n'impose pas une valeur.
begin;
  update public.sites set timezone = 'Europe/Paris' where site_id = 'site-fantome-test';
  select site_id, timezone as apres_ecriture from public.sites where site_id = 'site-fantome-test';
rollback;

-- ─────────────────────────────────────────────────────────────────────
-- PREUVE 2 — un site sans fuseau est IMPOSSIBLE
-- Attendu : ERREUR 23514 sur le trigger (null explicite),
--           puis ERREUR 23502 (NOT NULL) si le trigger était retiré.
-- ─────────────────────────────────────────────────────────────────────
begin;
  update public.sites set timezone = null where site_id = 'site-fantome-test';
rollback;

-- Un site créé sans fuseau est refusé dès l'insertion.
begin;
  insert into public.sites (site_id, nom_entreprise) values ('site-sans-fuseau-essai', 'Essai A3-3');
rollback;

-- État réel attendu : aucune ligne, la colonne est NOT NULL et peuplée.
select count(*) as sites_sans_fuseau_attendu_zero
  from public.sites where timezone is null;

select site_id, timezone from public.sites order by site_id;

-- ─────────────────────────────────────────────────────────────────────
-- PREUVE 3 — la fonction planifiée utilise le fuseau DU SITE
-- ─────────────────────────────────────────────────────────────────────

-- 3a · Le littéral a disparu du corps déployé, et la lecture par site y est.
select
  (pg_get_functiondef(p.oid) like '%at time zone v_fuseau%')                    as calcule_avec_le_fuseau_du_site,
  (pg_get_functiondef(p.oid) not like '%at time zone ''America/Martinique''%')  as plus_aucun_fuseau_en_dur,
  (pg_get_functiondef(p.oid) like '%select s.timezone into v_fuseau%')          as lit_bien_sites_timezone,
  (pg_get_functiondef(p.oid) like '%raise warning%')                            as saute_les_sites_sans_fuseau
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'run_scheduled_inventory_reviews';

-- 3b · Preuve de comportement : deux sites, deux fuseaux, deux dates locales.
-- On ne fait pas tourner la fonction (elle écrit) ; on évalue l'expression
-- exacte qu'elle utilise, site par site.
select s.site_id, s.timezone,
       (now() at time zone s.timezone)::date       as date_locale,
       (now() at time zone s.timezone)::time(0)    as heure_locale
  from public.sites s order by s.site_id;

-- 3c · La démonstration du décalage : ce que l'ancienne version faisait
-- pour TOUS les sites, contre ce que la nouvelle fait pour chacun.
select
  (now() at time zone 'America/Martinique')::timestamp(0) as ancienne_heure_unique_pour_tous,
  (now() at time zone 'Europe/Paris')::timestamp(0)       as heure_d_un_site_metropolitain,
  ((now() at time zone 'Europe/Paris') - (now() at time zone 'America/Martinique')) as decalage_ignore_avant_a3;

-- ─────────────────────────────────────────────────────────────────────
-- PREUVE 4 — l'ancienne migration n'a pas bougé
-- ─────────────────────────────────────────────────────────────────────
select version, name from supabase_migrations.schema_migrations
 where version in ('20260803021549', '20260905131500') order by version;
