-- NEXUS — jeu de répétition PREPROD : les FORMES de Production, pas ses données.
--
-- ARBITRAGE DE FRÉDÉRIC BRAGANCE, 09/09/2026. PREPROD est un état temporaire de
-- `nexus-test`, « créé à partir de données de Test structurées pour reproduire
-- les cas Production utiles », jamais une copie de la station réelle.
--
-- CE FICHIER EST DONC ENTIÈREMENT SYNTHÉTIQUE. Aucun nom, aucun horaire, aucun
-- montant ne vient de Production. Ce qui en vient, ce sont les FORMES et les
-- VOLUMES, relevés en lecture seule le 08/09/2026 :
--
--   · 89 lignes de `mission_catalog` où `site` et `site_id` DIVERGENT ;
--   · 17 lignes de `shifts` où ces deux colonnes divergent également, mais
--     dans l'autre sens ;
--   · 13 services restés `en_cours`, répartis sur 3 employés, du 04 au 08/09.
--
-- POURQUOI CES TROIS CAS ET PAS D'AUTRES. Ce sont exactement ceux que les trois
-- migrations DML de la promotion rencontreront. Une répétition sur une base
-- propre prouverait seulement que les migrations s'appliquent ; elle ne dirait
-- rien de ce qu'elles FONT. Le 08/09, la mesure a montré que ces trois cas
-- décidaient de tout : les 89 et les 17 sont des données de test à recaler, les
-- 13 sont une réparation qui touche l'historique.
--
-- LA DIVERGENCE VA DANS DEUX SENS OPPOSÉS, et c'est le détail qui compte. En
-- Production, `mission_catalog.site` vaut la station réelle tandis que
-- `site_id` vaut le site fantôme ; pour `shifts`, c'est l'inverse. Les deux
-- migrations corrigent dans des directions contraires (`site := site_id` d'un
-- côté, `site_id := site` de l'autre). Reproduire un seul sens laisserait la
-- moitié du comportement non éprouvée.
--
-- QUAND CE FICHIER S'APPLIQUE — ET C'EST LE POINT LE PLUS IMPORTANT.
-- Il doit être semé sur un `nexus-test` reconstruit à l'ÉTAT D'AVANT LA
-- RELEASE, c'est-à-dire au sha servi en Production, PUIS les migrations de
-- promotion s'appliquent dessus. Le semer sur un Test entièrement migré est
-- IMPOSSIBLE pour le troisième cas, et cette impossibilité est instructive :
--
--   CREATE UNIQUE INDEX shifts_un_seul_service_en_cours
--     ON public.shifts (employee_id) WHERE statut = 'en_cours'
--
-- Cet index — créé par la migration même qui répare les services ouverts —
-- interdit qu'un employé en ait deux. Les 13 services de Production existent
-- précisément parce que Production ne l'a pas encore. Reproduire cet état après
-- migration reviendrait à demander à la base d'accepter ce que la migration est
-- venue rendre impossible.
--
-- Autrement dit : ce jeu ne se semble pas « pour tester », il se sème pour
-- REJOUER une histoire. Sur une base déjà à jour, le semis échouera sur une
-- violation d'unicité — un échec juste, qui dit que l'ordre n'a pas été
-- respecté, et non un défaut du jeu.
--
-- CE FICHIER NE S'EXÉCUTE QUE HORS PRODUCTION et hors recette normale : il
-- exige le mode `PREPROD_REHEARSAL`, déclaré dans
-- `public.nexus_environnement_mode`. Semé par erreur en recette, il fausserait
-- des verdicts qui resteraient verts.

do $$
declare v_mode text;
begin
  select mode into v_mode from public.nexus_environnement_mode;
  if v_mode is distinct from 'PREPROD_REHEARSAL' then
    raise exception 'REFUS : jeu de répétition réservé au mode PREPROD_REHEARSAL (mode lu : %). '
      'Semé en recette normale, il fausserait des verdicts qui resteraient verts.',
      coalesce(v_mode, 'NON LU');
  end if;
end
$$;

-- Le site fantôme est le pendant de `site-fantome-test`, qui existe en
-- Production depuis le 03/08/2026 et porte des données de test.
-- ADAPTATIF AU SCHÉMA DU JOUR, pour la même raison que `semer-recette-test.sql`.
-- `sites.timezone` est ajoutée par 20260905131500_fuseau_horaire_par_site.sql,
-- POSTÉRIEURE à la borne : sur l'état d'avant la release, que ce jeu est fait
-- pour peupler, la colonne n'existe pas encore.
--
-- Semer le site fantôme SANS fuseau est d'ailleurs plus fidèle : en Production
-- il n'en a pas non plus, puisque la colonne n'y existe pas davantage. C'est
-- précisément la ligne que la migration de fuseau devra savoir traiter.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'sites'
                and column_name = 'timezone') then
    insert into public.sites (site_id, nom_entreprise, acces_createur_autorise, timezone)
    values ('site-fantome-test', 'Site Test (fantôme)', true, 'America/Martinique')
    on conflict (site_id) do nothing;
  else
    raise notice 'sites.timezone absente à cet état du schéma : site fantôme semé sans fuseau.';
    insert into public.sites (site_id, nom_entreprise, acces_createur_autorise)
    values ('site-fantome-test', 'Site Test (fantôme)', true)
    on conflict (site_id) do nothing;
  end if;
end
$$;

-- 1) 89 missions divergentes : `site` = la station, `site_id` = le fantôme.
--    En Production, les 89 portent un titre qui existe AUSSI côté station :
--    ce sont des copies du catalogue faites pour le site de test, dont la
--    colonne `site` est restée sur la station. La migration les recale vers le
--    fantôme — une correction, pas une perte. Le jeu reproduit ce doublonnage.
insert into public.mission_catalog (mission_id, titre, site, site_id)
select 'preprod-mission-' || i,
       'Mission de répétition ' || i,
       'nexus-station-test',
       'site-fantome-test'
from generate_series(1, 89) as i
on conflict (mission_id) do nothing;

-- IDEMPOTENT SANS RIEN SUPPRIMER — corrigé le 09/09/2026.
--
-- `DEPUIS_ETAPE=3` rejoue ce fichier. Les 89 missions étaient protégées par
-- `on conflict do nothing` ; les services ne l'étaient pas. Une deuxième passe
-- aurait produit 34 services divergents au lieu de 17, et le rapport d'impact
-- aurait mesuré ma reprise au lieu de la release — en restant vert.
--
-- MA PREMIÈRE CORRECTION SUPPRIMAIT LES LIGNES AVANT DE LES REPOSER, et la
-- garde `test_jeu_preprod_cas_production` l'a refusée : « un jeu de données
-- ajoute ; il ne corrige ni ne supprime ». Elle a raison, et sa version est
-- meilleure — un jeu qui efface pour se rendre rejouable peut effacer autre
-- chose le jour où son prédicat dérape.
--
-- On ne pose donc que ce qui MANQUE, et la vérification finale refuse si le
-- compte est faux. Un état partiel n'est pas réparé en douce : il est signalé.

-- 2) 17 services divergents, dans le SENS INVERSE : `site` = le fantôme,
--    `site_id` = la station. En Production ils appartiennent à des employés du
--    site fantôme. On les rattache donc au compte de recette destiné à cet
--    usage, jamais à une identité réelle.
--
--    UN SERVICE « TERMINE » DOIT ÊTRE COMPLET. Deux contraintes le disent, et
--    la première version de ce jeu les ignorait toutes les deux :
--      · shifts_heure_fin_coherente — 'termine' exige une heure de fin ;
--      · shifts_journal_cloture     — hors 'en_cours', la source et la date de
--        clôture sont obligatoires.
--    Ces deux règles précèdent la borne : elles s'appliquent donc déjà à l'état
--    d'avant la release. Un service clos par le pointage de départ de l'employé
--    est le cas ordinaire, d'où `pointage_depart`.
--
--    ET LE RÔLE S'ÉCRIT « caissiere », avec un e. `shifts_role_check`, héritée
--    de la baseline, n'admet que pompiste, caissiere, renfort, manager et
--    polyvalent. J'avais écrit « caissier » — la répétition l'a refusé, comme
--    Production l'aurait refusé.
insert into public.shifts (employee_id, site, site_id, role, heure_debut, heure_fin,
                           statut, cloture_source, cloture_le)
select e.id, 'site-fantome-test', 'nexus-station-test', 'caissiere',
       (now() - (i || ' days')::interval),
       (now() - (i || ' days')::interval + interval '7 hours'),
       'termine', 'pointage_depart',
       (now() - (i || ' days')::interval + interval '7 hours')
from generate_series(1, 17) as i
cross join lateral (
  select id from public.employees where site_id = 'nexus-station-test' order by id limit 1
) e
where not exists (select 1 from public.shifts where site = 'site-fantome-test');

-- 3) 13 services restés OUVERTS sur 3 employés, du plus ancien au plus récent.
--    C'est le cas que la migration de reprise clôturera en écrivant
--    `clos_sans_pointage` et en laissant `heure_fin` NULL — « inconnue, jamais
--    inventée ». C'est la seule des trois migrations qui touche vraiment un
--    historique, et donc la seule dont le nombre exact importe à Frédéric.
insert into public.shifts (employee_id, site, site_id, role, heure_debut, statut)
select e.id, 'nexus-station-test', 'nexus-station-test', 'pompiste',
       (now() - ((5 - (i % 5)) || ' days')::interval - (i || ' hours')::interval),
       'en_cours'
from generate_series(1, 13) as i
cross join lateral (
  select id from public.employees
   where site_id = 'nexus-station-test' and compte_test = true
   order by id offset (i % 3) limit 1
) e
where not exists (
  select 1 from public.shifts
   where statut = 'en_cours' and site = 'nexus-station-test' and role = 'pompiste');

-- CE JEU VÉRIFIE CE QU'IL A POSÉ.
--
-- Les trois insertions dépendent de comptes de recette résolus par jointure sur
-- `auth.users`. Si ces comptes manquent, la jointure ne trouve rien et les
-- insertions posent ZÉRO ligne — sans erreur. La répétition mesurerait alors
-- 0/0/0 avant ET après, ne verrait aucun écart, et conclurait que les
-- migrations n'ont rien changé. Un rapport d'impact vide qui se croit vert est
-- le pire résultat possible : il autoriserait une promotion sur du vent.
--
-- On refuse donc de rendre la main sur un jeu incomplet. Les trois nombres sont
-- ceux relevés en lecture seule sur Production le 08/09/2026.
do $$
declare m int; d int; o int;
begin
  select count(*) into m from public.mission_catalog where site is distinct from site_id;
  select count(*) into d from public.shifts where site is distinct from site_id;
  select count(*) into o from public.shifts where statut = 'en_cours';
  if m <> 89 or d <> 17 or o <> 13 then
    raise exception 'JEU INCOMPLET — missions divergentes % (attendu 89), services divergents % (attendu 17), services ouverts % (attendu 13). '
      'Cause la plus probable : les comptes de recette sont absents de auth.users, donc la jointure ne pose aucune ligne. '
      'On refuse de continuer : une répétition sur un jeu vide ne mesurerait aucun écart et conclurait à tort que les migrations sont sans effet.',
      m, d, o;
  end if;
  raise notice 'Jeu PREPROD conforme : 89 missions divergentes, 17 services divergents, 13 services ouverts.';
end
$$;
