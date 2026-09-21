-- Le planning cesse d'avoir deux verites concurrentes.
-- ============================================================================
-- CE QUI ETAIT FAUX, ET POURQUOI CA NE SE VOYAIT PAS.
--
-- `station_config.planning_source` declare, par site, d'ou vient le planning :
-- `nexus` (le generateur) ou `google_sheets` (le classeur du gerant). Deux
-- ecrans lisaient ce reglage — Planning et Mon Planning. Trois ne le lisaient
-- pas : Pointage (`NEXUS-Pointage-v1.html`), Prise de poste (via
-- `nexus-station.js`) et Paye (`nexus-paye-donnees.js`). Ces trois-la
-- interrogeaient `planning_shifts` directement. Tant qu'aucun site n'etait
-- bascule sur `google_sheets`, les cinq ecrans disaient la meme chose et rien
-- ne se voyait. Le jour de la bascule, Planning aurait affiche le classeur
-- pendant que Pointage, Prise de poste et Paye auraient continue a lire des
-- lignes generees — sans le dire, et sans qu'aucune erreur ne soit levee.
--
-- Le reglage lui-meme n'a pas d'histoire : c'est une colonne, donc une seule
-- valeur, celle d'aujourd'hui. Basculer un site le 20/09 change
-- retroactivement la lecture du 01/09, alors que le planning du 01/09 avait
-- bel et bien ete produit par le generateur. Paye reconstruit des mois
-- passes : elle a besoin de savoir quelle source faisait foi CE JOUR-LA, pas
-- quelle source fait foi maintenant.
--
-- Enfin `planning_shifts` ne porte aucune provenance. Une ligne importee d'un
-- classeur et une ligne generee y sont indiscernables, et la cle
-- `(employee_id, date, quart)` interdit meme qu'elles coexistent : un import
-- ecraserait la generation, une generation ecraserait l'import, en silence.
--
-- LE CONTRAT, DESORMAIS.
--
--   1. Toute ligne de `planning_shifts` declare sa provenance (`source`), le
--      lot d'import qui l'a produite (`import_id`) et la cellule d'origine
--      (`source_ref`). Les lignes du generateur valent `source = 'nexus'`, que
--      `generer_planning_mensuel` ecrit desormais explicitement (section 6) ;
--      le defaut de la colonne couvre les lignes anterieures a cette migration
--      et les saisies de l'ecran Planning.
--
--   2. Les deux sources COEXISTENT. La cle unique devient
--      `(employee_id, date, quart, source)`. Un import n'ecrase plus une
--      generation, et reciproquement. Aucune des deux ne se decide a l'ecriture.
--
--   3. La source qui FAIT FOI se decide a la LECTURE, par date, dans
--      `planning_source_periodes` : l'historique des bascules, avec date
--      d'effet, auteur et motif. `source_planning_applicable(site, date)` le
--      resout. Avant la premiere ligne declaree, la reponse est `nexus` : ce
--      n'est pas un repli invente, c'est l'etat d'origine de NEXUS, ou toute
--      ligne de planning venait du generateur.
--
--   4. Il n'existe QU'UNE interface de consommation : `v_planning_officiel`.
--      Pointage, Prise de poste et Paye la lisent. Aucun ecran ne reimplemente
--      le choix de la source, et aucun ecran ne lit un classeur pour son
--      propre compte.
--
--   5. `station_config.planning_source` reste la valeur COURANTE, et rien de
--      plus. Une garde (section 8) refuse desormais qu'elle diverge de
--      l'historique : on ne peut plus basculer un site sans laisser la trace
--      de la bascule, dans la meme transaction.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS.
--
--   - Elle ne bascule AUCUN site. `planning_source` garde partout sa valeur.
--     En Production `vito-sainte-marie` vaut `nexus` et le reste.
--   - Elle n'ecrit aucune ligne de planning, n'en supprime aucune, n'en
--     modifie aucune. Les lignes existantes prennent `source = 'nexus'` par
--     le defaut de la colonne, ce qui est leur provenance reelle.
--   - Elle n'accorde, ne retire et ne modifie AUCUN privilege sur un objet
--     existant. Les seuls `grant` qu'elle emet portent sur les objets qu'elle
--     cree, et sont plus etroits que ceux de `planning_shifts` : lecture seule
--     sur la vue, lecture et insertion seules sur l'historique, et rien pour
--     `anon` nulle part.
--   - Elle ne developpe aucune fonction Paye, et n'ecrit aucun lecteur de
--     Google Sheets. Elle prepare la place d'un import ; elle ne l'importe pas.
--   - Elle ne lit ni le classeur, ni le reseau. Aucune correspondance de nom
--     ou de code n'y est devinee : la section 7 ouvre des dictionnaires, la
--     section 9 n'y pose que `SMU -> vito-sainte-marie`, seule correspondance
--     arbitree.

-- ---------------------------------------------------------------------------
-- 1. La provenance devient une colonne, pas une devinette.
-- ---------------------------------------------------------------------------

alter table public.planning_shifts
  add column if not exists source text not null default 'nexus',
  add column if not exists import_id uuid,
  add column if not exists source_ref text;

alter table public.planning_shifts
  drop constraint if exists planning_shifts_source_check;
alter table public.planning_shifts
  add constraint planning_shifts_source_check
  check (source in ('nexus', 'google_sheets'));

comment on column public.planning_shifts.source is
  'Provenance de la ligne. `nexus` = produite par `generer_planning_mensuel` '
  'ou saisie a la main dans l''ecran Planning. `google_sheets` = importee du '
  'classeur du gerant. Le DEFAUT `nexus` couvre les lignes anterieures a cette '
  'migration et les ecritures de l''ecran Planning, qui ne nomment pas la '
  'colonne ; `generer_planning_mensuel`, elle, l''ecrit explicitement. Cette '
  'colonne ne dit PAS quelle source '
  'fait foi : cela se lit dans `planning_source_periodes`, par date.';

comment on column public.planning_shifts.import_id is
  'Identifiant du lot d''import qui a produit la ligne, NULL pour une ligne '
  '`nexus`. Permet de reprendre, de compter et d''annuler un import entier.';

comment on column public.planning_shifts.source_ref is
  'Cellule d''origine dans le classeur, sous la forme '
  '`ONGLET!AAAA-MM-JJ|QUART|COLONNE` — par exemple '
  '`SMU09!2026-09-03|QUART A|ANGELIQUE`. NULL pour une ligne `nexus`. '
  'Sert a rouvrir la cellule exacte quand un manager conteste une ligne.';

-- ---------------------------------------------------------------------------
-- 2. Les deux sources ont le droit de coexister.
-- ---------------------------------------------------------------------------
-- Sans cette extension de cle, un import du classeur et une generation NEXUS
-- se disputeraient la meme ligne : le second arrive ecraserait le premier, ou
-- serait avale par un `on conflict do nothing`, sans trace. Avec elle, les
-- deux lignes existent cote a cote et c'est la LECTURE qui tranche
-- (section 5). C'est la condition pour qu'un import puisse etre previsualise,
-- corrige et publie sans detruire l'etat anterieur.

alter table public.planning_shifts
  drop constraint if exists planning_shifts_employee_id_date_quart_key;

alter table public.planning_shifts
  drop constraint if exists planning_shifts_employee_date_quart_source_key;
alter table public.planning_shifts
  add constraint planning_shifts_employee_date_quart_source_key
  unique (employee_id, date, quart, source);

create index if not exists idx_planning_shifts_site_date_source
  on public.planning_shifts (site_id, date, source);

create index if not exists idx_planning_shifts_import
  on public.planning_shifts (import_id) where import_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Une bascule de source devient un fait date, pas un reglage ecrase.
-- ---------------------------------------------------------------------------

create table if not exists public.planning_source_periodes (
  id                uuid primary key default gen_random_uuid(),
  site              text not null references public.sites(site_id),
  source            text not null check (source in ('nexus', 'google_sheets')),
  source_precedente text,
  date_effet        date not null,
  auteur_id         uuid references public.employees(id),
  change_le         timestamptz not null default now(),
  motif             text,
  unique (site, date_effet)
);

comment on table public.planning_source_periodes is
  'Historique des bascules de source de planning, par site. Une ligne = '
  '« a partir de cette date d''effet, la source qui fait foi pour ce site est '
  'celle-ci ». C''est le registre que lit `source_planning_applicable`, et '
  'donc `v_planning_officiel`. Il est en AJOUT SEUL : aucune policy de mise a '
  'jour ni de suppression n''existe pour `authenticated`, parce que reecrire '
  'une bascule passee changerait retroactivement ce que Paye a deja lu.';

comment on column public.planning_source_periodes.date_effet is
  'Premier jour ou la nouvelle source fait foi, exprime en JOUR METIER DU '
  'SITE (fuseau de `sites.timezone`), jamais dans le calendrier de l''appareil '
  'du manager. Une date d''effet passee est acceptee mais exige un motif '
  '(garde `planning_source_periodes_normalise`, section 8).';

comment on column public.planning_source_periodes.source_precedente is
  'Source qui faisait foi la veille de la date d''effet. Calculee par la base, '
  'jamais fournie par l''appelant : une trace qui se declare elle-meme peut '
  'mentir.';

create index if not exists idx_planning_source_periodes_site_date
  on public.planning_source_periodes (site, date_effet desc);

alter table public.planning_source_periodes enable row level security;

drop policy if exists select_planning_source_periodes on public.planning_source_periodes;
create policy select_planning_source_periodes on public.planning_source_periodes
  for select to authenticated
  using (
    site = (select public.current_employee_site_id())
    and (select public.current_employee_role()) in ('manager', 'gerant')
  );

drop policy if exists insert_planning_source_periodes on public.planning_source_periodes;
create policy insert_planning_source_periodes on public.planning_source_periodes
  for insert to authenticated
  with check (
    site = (select public.current_employee_site_id())
    and (select public.current_employee_role()) in ('manager', 'gerant')
  );

revoke all on table public.planning_source_periodes from public;
revoke all on table public.planning_source_periodes from anon;
grant select, insert on table public.planning_source_periodes to authenticated;
grant select, insert, update, delete on table public.planning_source_periodes to service_role;

-- ---------------------------------------------------------------------------
-- 4. Resoudre la source d'un site A UNE DATE DONNEE.
-- ---------------------------------------------------------------------------
-- `security definer` a dessein : la source qui fait foi n'est pas une donnee
-- confidentielle, et elle doit rendre LA MEME REPONSE a tout le monde. Si
-- cette resolution dependait des droits de l'appelant, un employe qui ne lit
-- pas `planning_source_periodes` obtiendrait `nexus` la ou son manager
-- obtient `google_sheets` : deux verites pour le meme jour, c'est exactement
-- ce que cette migration supprime. La fonction ne lit qu'une table de
-- reglages, ne prend aucun parametre d'identite et n'ecrit rien.

create or replace function public.source_planning_applicable(p_site text, p_date date)
  returns text
  language sql
  stable
  security definer
  set search_path to 'public'
as $fn$
  select coalesce(
    (
      select p.source
        from public.planning_source_periodes p
       where p.site = p_site
         and p.date_effet <= p_date
       order by p.date_effet desc
       limit 1
    ),
    'nexus'
  );
$fn$;

comment on function public.source_planning_applicable(text, date) is
  'Source de planning qui fait foi pour ce site A CETTE DATE : la periode '
  'declaree de plus grande date d''effet inferieure ou egale a la date '
  'demandee. En l''absence de toute periode declaree, rend `nexus` — l''etat '
  'd''origine de NEXUS, ou toute ligne de planning venait du generateur. Ce '
  'n''est donc pas un repli silencieux : c''est le seul passe possible.';

revoke all on function public.source_planning_applicable(text, date) from public;
revoke all on function public.source_planning_applicable(text, date) from anon;
grant execute on function public.source_planning_applicable(text, date) to authenticated;
grant execute on function public.source_planning_applicable(text, date) to service_role;

-- ---------------------------------------------------------------------------
-- 5. L'interface de consommation unique.
-- ---------------------------------------------------------------------------
-- `security_invoker = true` est IMPERATIF. Sans lui, la vue s'executerait avec
-- les droits de son proprietaire et court-circuiterait entierement la RLS de
-- `planning_shifts` : n'importe quel employe lirait le planning de tous les
-- sites, brouillons compris. C'est la panne exacte corrigee le 31/07/2026 sur
-- `current_normalized_sales` (migration 20260731121835) ; elle ne se reproduit
-- pas ici.
--
-- La vue ne filtre NI le site NI `publie` : ces deux filtres appartiennent a
-- la RLS de `planning_shifts`, qui s'applique telle quelle grace a
-- `security_invoker`. La vue ne fait qu'une chose : ecarter les lignes dont la
-- provenance n'est pas celle qui fait foi ce jour-la.

drop view if exists public.v_planning_officiel;

create view public.v_planning_officiel with (security_invoker = true) as
  select ps.*
    from public.planning_shifts ps
   where ps.source = public.source_planning_applicable(ps.site_id, ps.date);

comment on view public.v_planning_officiel is
  'Le planning qui fait foi, et lui seul. Meme colonnes que '
  '`planning_shifts`, moins les lignes dont la provenance n''est pas la source '
  'applicable a leur date. Pointage, Prise de poste et Paye lisent CETTE VUE '
  'et jamais la table. Zero ligne rendue pour un jour donne signifie « planning '
  'officiel indisponible » — jamais « repos », jamais « a l''heure ». '
  '`security_invoker = true` : la RLS de `planning_shifts` s''applique '
  'integralement, site et `publie` compris.';

revoke all on table public.v_planning_officiel from public;
revoke all on table public.v_planning_officiel from anon;
grant select on table public.v_planning_officiel to authenticated;
grant select on table public.v_planning_officiel to service_role;

-- ---------------------------------------------------------------------------
-- 6. Le generateur ne peut plus effacer un import.
-- ---------------------------------------------------------------------------
-- `generer_planning_mensuel` purgeait « tous les brouillons du mois » pour ce
-- site. Avec deux sources, cette purge emporterait un import Google Sheets en
-- cours de relecture. Elle est desormais bornee a `source = 'nexus'` : le
-- generateur ne nettoie que ce qu'il a lui-meme produit.
--
-- Les sept `on conflict (employee_id, date, quart)` portent sur une contrainte
-- qui n'existe plus (section 2) : sans cette reecriture, la fonction leverait
-- « there is no unique or exclusion constraint matching the ON CONFLICT
-- specification » au premier appel. Ils portent maintenant sur
-- `(employee_id, date, quart, source)`, et chaque `insert` nomme `source`
-- explicitement plutot que de s'en remettre au defaut.
--
-- CE QUI N'EST PAS BORNE A UNE SOURCE, ET POURQUOI. Les lectures
-- d'anti-collision (« cet employe est-il deja place ce jour-la ? », « a-t-il
-- onze heures de repos depuis hier ? ») et les compteurs d'historique
-- (week-ends et quarts deja travailles) interrogent toujours TOUTES les
-- sources. Un employe ne peut pas etre a deux endroits a la fois, quelle que
-- soit la provenance de la ligne qui l'y place : borner ces lectures a `nexus`
-- ferait re-placer par le generateur quelqu'un que le classeur a deja engage.
-- Seuls la purge et le compte final de lignes produites — qui decrivent le
-- travail de CETTE generation — sont bornes.
--
-- Corps identique par ailleurs a la definition du 25/07/2026
-- (20260725160808_ajouter_role_vacataire_planner), verifiee octet pour octet
-- contre la base avant reecriture. Signature inchangee, donc le proprietaire
-- et les privileges existants sont conserves par le REPLACE ; `search_path`
-- fixe a `public`, comme l'avait pose 20260728135643.

create or replace function public.generer_planning_mensuel(p_site text, p_mois date, p_genere_par uuid default null::uuid)
  returns table(date_gap date, quart_gap text, effectif_attendu integer, effectif_obtenu integer)
  language plpgsql
  set search_path to 'public'
as $function$
declare
  v_mois_cible date := date_trunc('month', p_mois)::date;
  v_fin date := (date_trunc('month', p_mois) + interval '1 month')::date; -- borne exclusive
  -- Ne jamais commencer avant le lundi de la semaine suivante (par
  -- rapport à AUJOURD'HUI), même si le mois choisi est en cours.
  v_debut date := greatest(v_mois_cible, (date_trunc('week', current_date)::date + 7));
  v_date date;
  v_jour text;
  v_indispo boolean;
  v_repos boolean;
  v_emp record;
  v_mgr record;
  v_horaire record;
  v_quart_type record;
  v_cand record;
  v_effectif_min int;
  v_effectif_min_renfort int;
  v_compte int;
  v_femme_quart2_prise boolean;
  v_piste_donnee boolean;
  v_caisse_donnee boolean;
  v_tache text;
  v_semaine_courante int;
  v_semaine_debut date;
  v_semaine_fin date;
  v_flex record;
  v_jour_cible_dow int;
  v_jour_repos_auto date;
  v_dernier_repos_date date;
  v_renfort_primaire uuid;
  v_gap_min interval := interval '11 hours';
  v_nb_trous int := 0;
  v_nb_lignes int := 0;
begin
  -- Nettoie TOUT le mois cible (pas seulement à partir de v_debut) :
  -- les éventuels brouillons non publiés laissés par un run précédent
  -- entre le 1er du mois et v_debut doivent disparaître. Le passé
  -- réel (publié) n'est jamais concerné grâce à publie = false.
  delete from planning_shifts
  where site_id = p_site
    and date >= v_mois_cible and date < v_fin
    and publie = false
    and source = 'nexus';

  create temporary table if not exists tmp_planning_heures (
    employee_id uuid primary key,
    heures numeric not null default 0,
    heures_renfort numeric not null default 0
  ) on commit drop;
  delete from tmp_planning_heures where true;

  insert into tmp_planning_heures (employee_id)
  select id from employees where site_id = p_site and actif = true;

  create temporary table if not exists tmp_planning_historique (
    employee_id uuid primary key,
    weekends_travailles integer not null default 0,
    quart1_travailles integer not null default 0,
    quart2_travailles integer not null default 0
  ) on commit drop;
  delete from tmp_planning_historique where true;

  insert into tmp_planning_historique (employee_id, weekends_travailles, quart1_travailles, quart2_travailles)
  select e.id,
    coalesce((
      select count(distinct ps.date) from planning_shifts ps
      where ps.employee_id = e.id and ps.publie = true
        and ps.statut in ('travail_normal','manager','renfort')
        and extract(dow from ps.date) in (0, 6)
    ), 0),
    coalesce((
      select count(*) from planning_shifts ps
      where ps.employee_id = e.id and ps.publie = true and ps.statut = 'travail_normal' and ps.quart = 'quart1'
    ), 0),
    coalesce((
      select count(*) from planning_shifts ps
      where ps.employee_id = e.id and ps.publie = true and ps.statut = 'travail_normal' and ps.quart = 'quart2'
    ), 0)
  from employees e
  where e.site_id = p_site and e.actif = true;

  create temporary table if not exists tmp_repos_auto (
    employee_id uuid primary key,
    jour_repos date
  ) on commit drop;
  delete from tmp_repos_auto where true;

  create temporary table if not exists tmp_dernier_repos (
    employee_id uuid primary key,
    derniere_date date
  ) on commit drop;
  delete from tmp_dernier_repos where true;

  v_semaine_courante := -1;
  v_renfort_primaire := null;
  v_date := v_debut;

  while v_date < v_fin loop

    if extract(week from v_date)::int <> v_semaine_courante then
      v_semaine_courante := extract(week from v_date)::int;
      update tmp_planning_heures set heures = 0 where true;
      v_renfort_primaire := null;

      v_semaine_debut := v_date;
      v_semaine_fin := least(v_fin - 1, (date_trunc('week', v_date)::date + 6));
      delete from tmp_repos_auto where true;

      -- Un vacataire n'entre jamais dans la rotation automatique de
      -- repos : il n'a pas de jour de repos hebdomadaire fixe, il
      -- n'est appelé qu'au coup par coup en cas de trou.
      for v_flex in
        select e.id,
          c.jours_repos_habituels,
          row_number() over (order by coalesce(h.weekends_travailles, 0) desc, e.nom) as rang
        from employees e
        left join employee_contraintes c on c.employee_id = e.id
        left join tmp_planning_historique h on h.employee_id = e.id
        where e.site_id = p_site and e.actif = true
          and (e.role not in ('manager','gerant') or coalesce(c.integre_au_planning, false) = true)
          and e.role <> 'vacataire'
      loop
        v_jour_repos_auto := null;

        if v_semaine_debut = v_debut and v_flex.jours_repos_habituels is not null and array_length(v_flex.jours_repos_habituels, 1) > 0 then
          select gs.d::date into v_jour_repos_auto
          from generate_series(v_semaine_debut::timestamp, v_semaine_fin::timestamp, interval '1 day') gs(d)
          where (array['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'])[extract(dow from gs.d)::int + 1] = any(v_flex.jours_repos_habituels)
          limit 1;
        end if;

        if v_jour_repos_auto is null then
          if v_flex.rang % 3 = 1 then
            v_jour_cible_dow := case when v_semaine_courante % 2 = 0 then 6 else 0 end;
          else
            v_jour_cible_dow := 1 + ((v_flex.rang + v_semaine_courante) % 5);
          end if;

          select gs.d::date into v_jour_repos_auto
          from generate_series(v_semaine_debut::timestamp, v_semaine_fin::timestamp, interval '1 day') gs(d)
          where extract(dow from gs.d)::int = v_jour_cible_dow
          limit 1;
        end if;

        select derniere_date into v_dernier_repos_date from tmp_dernier_repos where employee_id = v_flex.id;
        if v_dernier_repos_date is not null and v_jour_repos_auto is not null and (v_jour_repos_auto - v_dernier_repos_date) > 7 then
          v_jour_repos_auto := v_dernier_repos_date + 7;
        end if;

        if v_jour_repos_auto is not null and v_jour_repos_auto >= v_debut and v_jour_repos_auto < v_fin then
          insert into tmp_repos_auto (employee_id, jour_repos) values (v_flex.id, v_jour_repos_auto)
          on conflict (employee_id) do update set jour_repos = excluded.jour_repos;
          insert into tmp_dernier_repos (employee_id, derniere_date) values (v_flex.id, v_jour_repos_auto)
          on conflict (employee_id) do update set derniere_date = excluded.derniere_date;
        end if;
      end loop;
    end if;

    v_jour := (array['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'])[extract(dow from v_date)::int + 1];

    -- Étape 1 : congés et repos.
    for v_emp in
      select e.id from employees e
      left join employee_contraintes c on c.employee_id = e.id
      where e.site_id = p_site and e.actif = true
        and (e.role not in ('manager','gerant') or coalesce(c.integre_au_planning, false) = true)
    loop
      v_indispo := exists (
        select 1 from employee_indisponibilites i
        where i.employee_id = v_emp.id and v_date between i.date_debut and i.date_fin
      );
      v_repos := (not v_indispo) and exists (
        select 1 from tmp_repos_auto ra
        where ra.employee_id = v_emp.id and ra.jour_repos = v_date
      );
      if v_indispo then
        insert into planning_shifts (site_id, employee_id, date, quart, statut, genere_par, source)
        values (p_site, v_emp.id, v_date, 'quart1', 'conge', p_genere_par, 'nexus'),
               (p_site, v_emp.id, v_date, 'quart2', 'conge', p_genere_par, 'nexus')
        on conflict (employee_id, date, quart, source) do nothing;
      elsif v_repos then
        insert into planning_shifts (site_id, employee_id, date, quart, statut, genere_par, source)
        values (p_site, v_emp.id, v_date, 'quart1', 'repos', p_genere_par, 'nexus'),
               (p_site, v_emp.id, v_date, 'quart2', 'repos', p_genere_par, 'nexus')
        on conflict (employee_id, date, quart, source) do nothing;
      end if;
    end loop;

    -- Étape 2 : manager, quart1 ET quart2.
    for v_mgr in
      select e.id from employees e
      join employee_contraintes c on c.employee_id = e.id
      where e.site_id = p_site and e.actif = true and e.role in ('manager','gerant')
        and c.integre_au_planning = true
        and not exists (select 1 from planning_shifts ps where ps.employee_id = e.id and ps.date = v_date and ps.quart = 'quart1')
    loop
      for v_horaire in select * from calculer_horaires_quart(p_site, 'quart1', v_date) loop
        insert into planning_shifts (site_id, employee_id, date, quart, statut, duree_heures, heure_debut, heure_fin, genere_par, source)
        values (p_site, v_mgr.id, v_date, 'quart1', 'manager', v_horaire.duree_heures, v_horaire.heure_debut, v_horaire.heure_fin, p_genere_par, 'nexus')
        on conflict (employee_id, date, quart, source) do nothing;
        update tmp_planning_heures set heures = heures + v_horaire.duree_heures where employee_id = v_mgr.id;
      end loop;
      for v_horaire in select * from calculer_horaires_quart(p_site, 'quart2', v_date) loop
        insert into planning_shifts (site_id, employee_id, date, quart, statut, duree_heures, heure_debut, heure_fin, genere_par, source)
        values (p_site, v_mgr.id, v_date, 'quart2', 'manager', v_horaire.duree_heures, v_horaire.heure_debut, v_horaire.heure_fin, p_genere_par, 'nexus')
        on conflict (employee_id, date, quart, source) do nothing;
        update tmp_planning_heures set heures = heures + v_horaire.duree_heures where employee_id = v_mgr.id;
      end loop;
    end loop;

    -- Étape 3 : quart1 puis quart2 — couverture minimum en priorité,
    -- puis attribution piste/caisse (voir en tête de fichier).
    for v_quart_type in select unnest(array['quart1','quart2']) as quart loop
      select effectif_min into v_effectif_min
      from planning_regles_effectif
      where site_id = p_site and quart = v_quart_type.quart and v_jour = any(jours_semaine)
      order by array_length(jours_semaine, 1) asc
      limit 1;
      v_effectif_min := coalesce(v_effectif_min, 2);

      v_compte := 0;
      v_femme_quart2_prise := false;
      v_piste_donnee := false;
      v_caisse_donnee := false;
      for v_horaire in select * from calculer_horaires_quart(p_site, v_quart_type.quart, v_date) loop
        for v_cand in
          select e.id, e.role, ec.sexe from employees e
          join tmp_planning_heures h on h.employee_id = e.id
          left join employee_contraintes ec on ec.employee_id = e.id
          left join tmp_planning_historique hist on hist.employee_id = e.id
          where e.site_id = p_site and e.actif = true and e.role in ('caissier','pompiste','renfort')
            and not exists (
              select 1 from planning_shifts ps
              where ps.employee_id = e.id and ps.date = v_date and ps.quart in ('quart1','quart2','renfort')
            )
            and not exists (
              select 1 from planning_shifts ps
              join calculer_horaires_quart(p_site, ps.quart, ps.date) ch on true
              where ps.employee_id = e.id and ps.date = v_date - 1
                and ps.statut in ('travail_normal','manager','renfort')
                and ps.heure_fin is not null
                and (ps.date + ps.heure_fin + v_gap_min) > (v_date + v_horaire.heure_debut)
            )
          order by
            (case when e.role = 'renfort' then 1 else 0 end),
            (case when ec.heures_contrat_semaine is not null and (h.heures + v_horaire.duree_heures) > ec.heures_contrat_semaine then 1 else 0 end),
            h.heures asc,
            (case when v_quart_type.quart = 'quart1' then coalesce(hist.quart1_travailles, 0) else coalesce(hist.quart2_travailles, 0) end) asc,
            e.nom asc
        loop
          exit when v_compte >= v_effectif_min;

          if v_quart_type.quart = 'quart2' and v_cand.sexe = 'F' and v_femme_quart2_prise then
            continue;
          end if;

          -- Attribution de la tâche : un homme prend la piste en
          -- priorité, une femme prend la caisse en priorité ; sinon
          -- on complète simplement le poste manquant.
          if v_cand.sexe = 'M' and not v_piste_donnee then
            v_tache := 'piste'; v_piste_donnee := true;
          elsif v_cand.sexe = 'F' and not v_caisse_donnee then
            v_tache := 'caisse'; v_caisse_donnee := true;
          elsif not v_piste_donnee then
            v_tache := 'piste'; v_piste_donnee := true;
          elsif not v_caisse_donnee then
            v_tache := 'caisse'; v_caisse_donnee := true;
          else
            v_tache := case when v_compte % 2 = 0 then 'piste' else 'caisse' end;
          end if;

          insert into planning_shifts (site_id, employee_id, date, quart, statut, duree_heures, heure_debut, heure_fin, tache, genere_par, source)
          values (p_site, v_cand.id, v_date, v_quart_type.quart, 'travail_normal', v_horaire.duree_heures, v_horaire.heure_debut, v_horaire.heure_fin, v_tache, p_genere_par, 'nexus')
          on conflict (employee_id, date, quart, source) do nothing;
          update tmp_planning_heures set heures = heures + v_horaire.duree_heures where employee_id = v_cand.id;
          v_compte := v_compte + 1;
          if v_quart_type.quart = 'quart2' and v_cand.sexe = 'F' then
            v_femme_quart2_prise := true;
          end if;
        end loop;

        -- Étape 3bis : dernier recours "vacataire". Uniquement si un
        -- trou réel subsiste après épuisement du personnel régulier,
        -- et uniquement pour la tâche piste — jamais caisse, jamais
        -- renfort (le rôle 'vacataire' n'est de toute façon jamais
        -- éligible au renfort, voir étape 4).
        if v_compte < v_effectif_min and not v_piste_donnee then
          for v_cand in
            select e.id from employees e
            join tmp_planning_heures h on h.employee_id = e.id
            where e.site_id = p_site and e.actif = true and e.role = 'vacataire'
              and not exists (
                select 1 from planning_shifts ps
                where ps.employee_id = e.id and ps.date = v_date and ps.quart in ('quart1','quart2','renfort')
              )
              and not exists (
                select 1 from planning_shifts ps
                join calculer_horaires_quart(p_site, ps.quart, ps.date) ch on true
                where ps.employee_id = e.id and ps.date = v_date - 1
                  and ps.statut in ('travail_normal','manager','renfort')
                  and ps.heure_fin is not null
                  and (ps.date + ps.heure_fin + v_gap_min) > (v_date + v_horaire.heure_debut)
              )
            order by h.heures asc, e.nom asc
          loop
            exit when v_compte >= v_effectif_min or v_piste_donnee;
            insert into planning_shifts (site_id, employee_id, date, quart, statut, duree_heures, heure_debut, heure_fin, tache, genere_par, source)
            values (p_site, v_cand.id, v_date, v_quart_type.quart, 'travail_normal', v_horaire.duree_heures, v_horaire.heure_debut, v_horaire.heure_fin, 'piste', p_genere_par, 'nexus')
            on conflict (employee_id, date, quart, source) do nothing;
            update tmp_planning_heures set heures = heures + v_horaire.duree_heures where employee_id = v_cand.id;
            v_compte := v_compte + 1;
            v_piste_donnee := true;
          end loop;
        end if;

        if v_compte < v_effectif_min then
          date_gap := v_date; quart_gap := v_quart_type.quart; effectif_attendu := v_effectif_min; effectif_obtenu := v_compte;
          v_nb_trous := v_nb_trous + 1;
          return next;
        end if;
      end loop;
    end loop;

    -- Étape 4 : renfort. Éligible si : rôle "renfort" (directement,
    -- sans réglage manuel requis) OU peut_faire_renfort = true dans
    -- employee_contraintes (cas des caissier(e)s en renfort ponctuel).
    -- Un vacataire n'est jamais éligible au renfort, quel que soit le
    -- réglage peut_faire_renfort.
    select effectif_min into v_effectif_min_renfort
    from planning_regles_effectif
    where site_id = p_site and quart = 'renfort' and v_jour = any(jours_semaine)
    order by array_length(jours_semaine, 1) asc
    limit 1;
    v_effectif_min_renfort := coalesce(v_effectif_min_renfort, 1);

    if v_renfort_primaire is null and v_effectif_min_renfort > 0 then
      select e.id into v_renfort_primaire
      from employees e
      left join employee_contraintes c on c.employee_id = e.id
      join tmp_planning_heures h on h.employee_id = e.id
      where e.site_id = p_site and e.actif = true
        and e.role <> 'vacataire'
        and (e.role = 'renfort' or coalesce(c.peut_faire_renfort, false) = true)
      order by h.heures_renfort asc, e.nom asc
      limit 1;
    end if;

    v_compte := 0;
    for v_horaire in select * from calculer_horaires_quart(p_site, 'renfort', v_date) loop
      for v_cand in
        select e.id from employees e
        left join employee_contraintes c on c.employee_id = e.id
        join tmp_planning_heures h on h.employee_id = e.id
        where e.site_id = p_site and e.actif = true
          and e.role <> 'vacataire'
          and (e.role = 'renfort' or coalesce(c.peut_faire_renfort, false) = true)
          and not exists (select 1 from planning_shifts ps where ps.employee_id = e.id and ps.date = v_date and ps.quart in ('quart1','quart2'))
        order by (e.id <> v_renfort_primaire), h.heures_renfort asc, e.nom asc
      loop
        exit when v_compte >= v_effectif_min_renfort;
        insert into planning_shifts (site_id, employee_id, date, quart, statut, duree_heures, heure_debut, heure_fin, genere_par, source)
        values (p_site, v_cand.id, v_date, 'renfort', 'renfort', v_horaire.duree_heures, v_horaire.heure_debut, v_horaire.heure_fin, p_genere_par, 'nexus')
        on conflict (employee_id, date, quart, source) do nothing;
        update tmp_planning_heures
          set heures = heures + v_horaire.duree_heures, heures_renfort = heures_renfort + v_horaire.duree_heures
          where employee_id = v_cand.id;
        v_compte := v_compte + 1;
      end loop;

      if v_compte < v_effectif_min_renfort then
        date_gap := v_date; quart_gap := 'renfort'; effectif_attendu := v_effectif_min_renfort; effectif_obtenu := v_compte;
        v_nb_trous := v_nb_trous + 1;
        return next;
      end if;
    end loop;

    v_date := v_date + 1;
  end loop;

  select count(*) into v_nb_lignes
  from planning_shifts
  where site_id = p_site and date >= v_debut and date < v_fin and publie = false and source = 'nexus';

  insert into planning_generations (site_id, mois, genere_par, debut_reel, fin_reel, nb_lignes, nb_trous)
  values (p_site, v_mois_cible, p_genere_par, v_debut, v_fin - 1, v_nb_lignes, v_nb_trous);

  return;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Les correspondances d'import : declarees, jamais devinees.
-- ---------------------------------------------------------------------------
-- Le classeur du gerant ne parle pas la langue de NEXUS. Il ecrit des prenoms
-- en capitales (`LOANNE`, `FREDERIC`) la ou NEXUS connait des employes, et des
-- codes de site courts (`SMU`, `SME`, `T`, `TRINITE`, `UNION`) la ou NEXUS
-- connait des `site_id`. Rapprocher les deux par ressemblance serait le pire
-- des choix : `LOANNE` ressemble a `loane`, mais `T` ne ressemble a rien, et un
-- rapprochement approximatif place un employe sur un poste qu'il n'a pas.
--
-- D'ou deux dictionnaires EXPLICITES, par site, dans `station_config` :
--
--   `planning_alias`        — {"LOANNE": "loane", "FREDERIC": "Fred"}
--   `planning_codes_sites`  — {"SMU": "vito-sainte-marie"}
--
-- Ce qui n'y figure pas n'est pas devine : c'est une ANOMALIE rendue a
-- l'ecran, que le manager tranche avant de publier. Un import ne se valide
-- jamais avec une anomalie non levee.
--
-- Les deux colonnes sont `not null default '{}'` : « aucune correspondance
-- declaree » est un etat normal, et c'est l'etat de depart de tous les sites.

alter table public.station_config
  add column if not exists planning_alias jsonb not null default '{}'::jsonb,
  add column if not exists planning_codes_sites jsonb not null default '{}'::jsonb;

comment on column public.station_config.planning_alias is
  'Dictionnaire des noms du classeur vers les employes NEXUS, pour l''import '
  'Planning. Cle = le libelle tel qu''il apparait dans le classeur, valeur = '
  'le prenom NEXUS. `{}` = aucune correspondance declaree. Un libelle absent '
  'de ce dictionnaire est une anomalie d''import a trancher par le manager, '
  'jamais un rapprochement par ressemblance.';

comment on column public.station_config.planning_codes_sites is
  'Dictionnaire des codes de site du classeur vers les `sites.site_id` NEXUS, '
  'pour l''import Planning. Cle = le code ecrit dans la cellule, valeur = un '
  '`site_id` EXISTANT (le trigger `trg_planning_codes_sites_controle` le '
  'verifie). `{}` = aucune correspondance declaree. Un code absent est une '
  'anomalie d''import, jamais une supposition.';

-- Forme du dictionnaire. Un `check` ne peut pas contenir de sous-requete ni de
-- fonction a retour ensembliste : la verification passe donc par une fonction
-- scalaire, qui est la seule facon d'exprimer « tous les couples sont des
-- chaines non vides » dans une contrainte.
create or replace function public.planning_mappage_est_valide(p_mappage jsonb)
  returns boolean
  language sql
  immutable
  set search_path to 'public'
as $fn$
  select p_mappage is not null
     and jsonb_typeof(p_mappage) = 'object'
     and not exists (
       select 1
         from jsonb_each(p_mappage) e
        where jsonb_typeof(e.value) <> 'string'
           or btrim(e.key) = ''
           or btrim(e.value #>> '{}') = ''
     );
$fn$;

comment on function public.planning_mappage_est_valide(jsonb) is
  'Vrai si le dictionnaire d''import est un objet JSON dont toutes les cles et '
  'toutes les valeurs sont des chaines non vides. Sert aux contraintes de '
  '`station_config.planning_alias` et `station_config.planning_codes_sites` : '
  'une cle vide ou une valeur nulle rendrait une correspondance inexploitable '
  'tout en ayant l''air declaree.';

alter table public.station_config
  drop constraint if exists station_config_planning_alias_check;
alter table public.station_config
  add constraint station_config_planning_alias_check
  check (public.planning_mappage_est_valide(planning_alias));

alter table public.station_config
  drop constraint if exists station_config_planning_codes_sites_check;
alter table public.station_config
  add constraint station_config_planning_codes_sites_check
  check (public.planning_mappage_est_valide(planning_codes_sites));

-- Existence des sites vises. Ceci ne peut pas etre une contrainte : c'est une
-- reference vers une autre table, depuis l'interieur d'un jsonb. Le trigger la
-- rend structurelle quand meme — « ne devine aucune correspondance » cesse
-- d'etre une consigne pour devenir un refus de la base.
--
-- `security definer` : `sites` porte une RLS. Si la lecture dependait des
-- droits de l'appelant, un site invisible passerait pour inexistant et le
-- message accuserait une faute de frappe la ou il y a un defaut de droits.
create or replace function public.planning_codes_sites_controle()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
declare
  v_code text;
  v_site text;
begin
  for v_code, v_site in
    select e.key, e.value #>> '{}' from jsonb_each(new.planning_codes_sites) e
  loop
    if not exists (select 1 from public.sites s where s.site_id = v_site) then
      raise exception
        using errcode = '23503',
              message = format(
                'Correspondance d''import refusee : le code « %s » designe le site « %s », qui n''existe pas dans `sites`.',
                v_code, v_site),
              hint = 'Un code de site ne se devine pas. Declarez un `site_id` NEXUS existant, ou laissez le code hors du dictionnaire : il ressortira comme anomalie d''import, a trancher par le manager.';
    end if;
  end loop;
  return new;
end;
$fn$;

comment on function public.planning_codes_sites_controle() is
  'Trigger de `station_config` : refuse un `planning_codes_sites` dont une '
  'valeur ne correspond a aucun `sites.site_id`. Empeche qu''un import place '
  'des quarts sur un site fantome ecrit a la main.';

drop trigger if exists trg_planning_codes_sites_controle on public.station_config;
create trigger trg_planning_codes_sites_controle
  before insert or update of planning_codes_sites on public.station_config
  for each row execute function public.planning_codes_sites_controle();

-- ---------------------------------------------------------------------------
-- 8. On ne bascule plus un site sans laisser la trace de la bascule.
-- ---------------------------------------------------------------------------
-- `station_config.planning_source` dit la source COURANTE ;
-- `planning_source_periodes` dit depuis QUAND. Les deux peuvent diverger, et
-- une divergence ne se voit pas : l'ecran continue d'afficher une valeur
-- coherente avec elle-meme. L'invariant est donc pose dans la base :
--
--     source_planning_applicable(site, jour de la station) = planning_source
--
-- Toute ecriture qui le romprait est refusee, des deux cotes : changer le
-- reglage sans ecrire la periode, ou ecrire une periode sans changer le
-- reglage. A l'etat initial l'invariant est deja vrai partout : aucune periode
-- n'est declaree, la fonction rend `nexus`, et tous les sites valent `nexus`.
--
-- Les gardes sont des CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED :
-- elles se declenchent au COMMIT et non a l'instruction. C'est ce qui rend
-- l'ordre des deux ecritures indifferent a l'interieur de la transaction —
-- sans cela, l'ecran devrait deviner laquelle poser en premier, et le
-- deviner de travers echouerait sans raison lisible.
--
-- UNE BASCULE NE SE PROGRAMME PAS EN AVANCE DU COTE DU REGLAGE. Une periode
-- datee du futur est acceptee — elle ne change pas la source applicable
-- aujourd'hui — mais `planning_source` ne peut pas la devancer : la colonne ne
-- porte pas de date, et un reglage en avance sur l'historique ferait mentir
-- tout lecteur qui l'interroge encore. La bascule s'ecrit le jour ou elle
-- prend effet.

-- Le jour de la station. Meme formule et meme doctrine que
-- `NexusStation.dateLocaleStation` (`nexus-station.js`), qui est la reference
-- stricte cote application : `sites.timezone`, une ligne par site, et AUCUN
-- repli. Un fuseau absent LEVE au lieu de replier sur le calendrier du serveur
-- — une journee decoupee dans le mauvais fuseau produit un resultat faux sans
-- le moindre message. `security definer` pour la meme raison que
-- `source_planning_applicable` : la reponse ne depend pas de qui demande.
create or replace function public.planning_jour_station(p_site text)
  returns date
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $fn$
declare
  v_fuseau text;
begin
  select s.timezone into v_fuseau from public.sites s where s.site_id = p_site;
  if v_fuseau is null or btrim(v_fuseau) = '' then
    raise exception
      using errcode = '22004',
            message = format('Jour de la station indeterminable : aucun fuseau horaire pour le site « %s » (`sites.timezone`).', p_site),
            hint = 'Declarez le fuseau du site avant toute ecriture de source de planning. NEXUS ne substitue pas le fuseau d''une autre station et n''utilise pas celui du serveur.';
  end if;
  return (now() at time zone v_fuseau)::date;
end;
$fn$;

comment on function public.planning_jour_station(text) is
  'Le jour civil en cours dans le fuseau du site (`sites.timezone`), sans '
  'repli. Sert aux gardes de la source de planning : une bascule est datee du '
  'jour de la STATION, jamais de celui du serveur ni de l''appareil.';

create or replace function public.planning_source_coherence_controle()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
declare
  v_site       text;
  v_declaree   text;
  v_jour       date;
  v_applicable text;
begin
  if tg_op = 'DELETE' then v_site := old.site; else v_site := new.site; end if;

  select c.planning_source into v_declaree
    from public.station_config c
   where c.site = v_site;

  -- Aucun reglage pour ce site : il n'y a rien avec quoi diverger. Une periode
  -- peut etre declaree en avance d'une configuration de station.
  if v_declaree is null then
    return null;
  end if;

  v_jour := public.planning_jour_station(v_site);
  v_applicable := public.source_planning_applicable(v_site, v_jour);

  if v_applicable is distinct from v_declaree then
    raise exception
      using errcode = '23514',
            message = format(
              'Source de planning incoherente pour « %s » : le reglage dit « %s » alors que l''historique rend « %s » au %s.',
              v_site, v_declaree, v_applicable, v_jour),
            hint = 'Une bascule s''ecrit des deux cotes dans la meme transaction : `station_config.planning_source` ET une ligne `planning_source_periodes` prenant effet au plus tard le jour de la station. Une bascule sans trace n''est pas enregistrable.';
  end if;

  return null;
end;
$fn$;

comment on function public.planning_source_coherence_controle() is
  'Garde de non-divergence entre `station_config.planning_source` et '
  '`planning_source_periodes`. Posee en CONSTRAINT TRIGGER differe sur les '
  'deux tables : verifiee au commit, donc indifferente a l''ordre des deux '
  'ecritures.';

drop trigger if exists trg_planning_source_coherence on public.station_config;
create constraint trigger trg_planning_source_coherence
  after insert or update of planning_source on public.station_config
  deferrable initially deferred
  for each row execute function public.planning_source_coherence_controle();

drop trigger if exists trg_planning_source_periodes_coherence on public.planning_source_periodes;
create constraint trigger trg_planning_source_periodes_coherence
  after insert or update or delete on public.planning_source_periodes
  deferrable initially deferred
  for each row execute function public.planning_source_coherence_controle();

-- Ce que la base remplit elle-meme dans une periode, et pourquoi.
--
--   `source_precedente` — calculee, jamais recue. C'est la source qui faisait
--      foi la veille de la prise d'effet, telle que l'historique la rend au
--      moment de l'ecriture. Un appelant qui la fournirait pourrait la poser
--      fausse, et une trace fausse est pire qu'une trace absente. C'est un
--      TEMOIN, pas une donnee de decision : `source_planning_applicable` ne la
--      lit jamais. Une periode inseree apres coup entre deux autres ne
--      recalcule pas celle de sa voisine — le cas est exceptionnel, et
--      reecrire un temoin deja ecrit serait reecrire l'histoire.
--
--   `auteur_id` — impose a `auth.uid()` des qu'il y en a un. Un manager ne
--      signe pas une bascule au nom d'un autre. Hors session authentifiee
--      (service_role, migration), la valeur recue est conservee.
--
--   Le MOTIF devient obligatoire pour une date d'effet PASSEE. Basculer a
--      partir d'aujourd'hui se comprend tout seul ; requalifier des jours deja
--      pointes, deja payes peut-etre, demande de dire pourquoi.
create or replace function public.planning_source_periodes_normalise()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
declare
  v_jour date;
begin
  new.source_precedente := public.source_planning_applicable(new.site, new.date_effet);

  if auth.uid() is not null then
    new.auteur_id := auth.uid();
  end if;

  v_jour := public.planning_jour_station(new.site);
  if new.date_effet < v_jour and (new.motif is null or btrim(new.motif) = '') then
    raise exception
      using errcode = '23514',
            message = format(
              'Bascule datee du %s, anterieure au jour de la station (%s) : un motif est obligatoire.',
              new.date_effet, v_jour),
            hint = 'Une bascule retroactive change la source qui fait foi sur des journees deja travaillees. Dites pourquoi.';
  end if;

  return new;
end;
$fn$;

comment on function public.planning_source_periodes_normalise() is
  'Trigger de `planning_source_periodes` : calcule `source_precedente`, impose '
  '`auteur_id` a l''utilisateur authentifie, et exige un motif pour une date '
  'd''effet anterieure au jour de la station.';

drop trigger if exists trg_planning_source_periodes_normalise on public.planning_source_periodes;
create trigger trg_planning_source_periodes_normalise
  before insert on public.planning_source_periodes
  for each row execute function public.planning_source_periodes_normalise();

-- Privileges des fonctions creees par les sections 7 et 8.
--
-- PostgreSQL accorde `execute` a PUBLIC sur toute fonction nouvellement creee,
-- et Supabase double cela de `grant` nommes pour `anon` et `authenticated`.
-- Un `revoke ... from public` seul ne ferme donc rien : les deux roles sont
-- nommes explicitement, comme partout ailleurs dans ce depot.
--
-- `planning_mappage_est_valide` est appelee depuis deux `check`, donc executee
-- avec les droits de CELUI QUI ECRIT : sans `execute`, un manager ne pourrait
-- plus enregistrer ses reglages de station. Elle est `immutable` et ne lit
-- aucune table.
--
-- `planning_jour_station` n'est PAS ouverte a `authenticated`. Elle est
-- `security definer` et lit `sites` sans passer par la RLS : l'accorder
-- permettrait de connaitre le fuseau de n'importe quel site par son
-- identifiant. Les triggers l'appellent en tant que proprietaire et n'ont
-- besoin d'aucun `grant`. L'application a deja sa propre reference stricte,
-- `NexusStation.dateLocaleStation`.
--
-- Les trois fonctions de trigger ne sont appelables par personne : PostgreSQL
-- verifie le privilege a la creation du trigger, jamais a son declenchement.

revoke all on function public.planning_mappage_est_valide(jsonb) from public;
revoke all on function public.planning_mappage_est_valide(jsonb) from anon;
grant execute on function public.planning_mappage_est_valide(jsonb) to authenticated;
grant execute on function public.planning_mappage_est_valide(jsonb) to service_role;

revoke all on function public.planning_jour_station(text) from public;
revoke all on function public.planning_jour_station(text) from anon;
revoke all on function public.planning_jour_station(text) from authenticated;
grant execute on function public.planning_jour_station(text) to service_role;

revoke all on function public.planning_codes_sites_controle() from public;
revoke all on function public.planning_codes_sites_controle() from anon;
revoke all on function public.planning_codes_sites_controle() from authenticated;

revoke all on function public.planning_source_coherence_controle() from public;
revoke all on function public.planning_source_coherence_controle() from anon;
revoke all on function public.planning_source_coherence_controle() from authenticated;

revoke all on function public.planning_source_periodes_normalise() from public;
revoke all on function public.planning_source_periodes_normalise() from anon;
revoke all on function public.planning_source_periodes_normalise() from authenticated;

-- ---------------------------------------------------------------------------
-- 9. Amorcage : ce qui est connu, et rien d'autre.
-- ---------------------------------------------------------------------------
-- Une seule correspondance de site est connue et arbitree : `SMU` designe
-- `vito-sainte-marie`. Elle est posee ici, et UNIQUEMENT la ou aucun
-- dictionnaire n'a encore ete declare — une migration ne defait pas un reglage
-- saisi par un manager.
--
-- `SME`, `T`, `TRINITE`, `UNION` et les autres codes du classeur NE SONT PAS
-- amorces. Aucun `site_id` NEXUS ne leur correspond aujourd'hui ; les inventer
-- reviendrait a fabriquer des transferts. Ils ressortiront comme anomalies
-- d'import, ce qui est leur juste statut.
--
-- Sur Test cette instruction touche zero ligne : `vito-sainte-marie` existe
-- dans `sites` mais n'a pas de ligne `station_config`. C'est correct — le
-- dictionnaire naitra avec la configuration de la station.

update public.station_config c
   set planning_codes_sites = jsonb_build_object('SMU', 'vito-sainte-marie')
 where c.site = 'vito-sainte-marie'
   and c.planning_codes_sites = '{}'::jsonb
   and exists (select 1 from public.sites s where s.site_id = 'vito-sainte-marie');

-- Rattrapage de l'invariant de la section 8 pour un site qui serait deja
-- declare hors `nexus` sans aucune trace de bascule. Au 19/09/2026 cette
-- instruction touche zero ligne : Test et Production valent `nexus` partout.
-- Elle existe pour que la garde ne puisse pas se poser sur un etat qu'elle
-- refuserait — et la periode retablie est datee du JOUR de la station, jamais
-- d'une date d'effet inventee : NEXUS ne sait pas depuis quand le site etait
-- bascule, et ne fera pas semblant de le savoir.
insert into public.planning_source_periodes (site, source, date_effet, motif)
select c.site,
       c.planning_source,
       public.planning_jour_station(c.site),
       'Periode retablie a l''ouverture de l''historique : le site etait deja declare sur cette source, sans trace de bascule. La date d''effet reelle est inconnue et n''a pas ete inventee.'
  from public.station_config c
 where c.planning_source is distinct from 'nexus'
   and not exists (
     select 1 from public.planning_source_periodes p where p.site = c.site
   );
