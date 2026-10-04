-- =============================================================================
-- RECETTE — preuves 10.5 (livrets et mouvements) et 10.6 (donnees existantes)
-- Mandat « Refonte FDJ, Vague 1 », §10.5 et §10.6.
-- A jouer sur nexus-test UNIQUEMENT. Le fichier se termine par rollback;.
--
-- Ce fichier est AUTO-PORTANT : il charge lui-meme les DOUZE migrations de la
-- Phase A par \ir, entre la pose de l historique et les preuves. C est la
-- difference avec 20260917_preuves_cycle_caisse.sql, qui suppose les migrations
-- deja chargees : ici, l ORDRE est le sujet meme de la preuve. On ne peut pas
-- montrer ce qu une migration fait a des donnees existantes si les donnees
-- n existent pas avant elle.
--
-- DOUZE, ET PLUS NEUF. Cette recette s arretait a 20260916220800. C etait une
-- limite de portee tenable tant qu on ne lui demandait qu une chose ; elle ne
-- l est plus des lors qu elle sert a repondre au troisieme blocage de la
-- relecture. 20260916221000 cree precisement les commandes serveur qui
-- ecrivent les mouvements de stock : une preuve qui ne les charge pas ne parle
-- pas de la Phase A finale, elle parle d un etat intermediaire qui ne sera
-- jamais deploye. Les trois dernieres migrations sont donc chargees ici, et
-- P21.6 a ete refondue en consequence : elle n attend plus « zero fonction qui
-- touche les mouvements », elle distingue ce qu il fallait distinguer — leur
-- INSTALLATION, qui n ecrit rien ; leur CODE, qui contient legitimement les
-- ecritures ; leur EXECUTION controlee, qui est mesuree en P21.7.
--
-- Lancement (depuis la racine du depot) :
--   PGPASSWORD="$(security find-generic-password -a nexus -s nexus-test-db -w)" \
--   PGCONNECT_TIMEOUT=45 /opt/homebrew/opt/libpq/bin/psql \
--     "postgresql://postgres@db.udljdqxerrbbbajxubfn.supabase.co:5432/postgres?sslmode=require" \
--     -X -v ON_ERROR_STOP=1 -q -f supabase/recette-vague1/20260917_preuves_livrets_et_historique.sql
-- =============================================================================

\set ON_ERROR_STOP on
begin;

\echo ''
\echo '############################################################'
\echo '#  P22.0 — LA CONDITION DE VALIDITE DE LA PHASE A          #'
\echo '############################################################'
-- Le dossier (section 5.7) justifie d avoir corrige deux migrations EN PLACE
-- plutot que d empiler une migration de rattrapage, au motif qu aucune des douze
-- n a jamais ete appliquee nulle part. Cette prémisse n est pas une opinion :
-- elle se verifie, et c est la premiere chose que fait cette recette.

select 'P22.0' as preuve,
       count(*) as migrations_vague1_deja_enregistrees_attendu_0,
       coalesce(string_agg(version, ', ' order by version), '(aucune)') as versions_trouvees
from supabase_migrations.schema_migrations
where version like '2026091622%';

-- Et l empreinte de la base : aucune colonne, aucune table de la vague.
select 'P22.0 schema' as preuve,
       to_regclass('public.fdj_caisse_evenements') is null   as journal_caisse_absent,
       to_regclass('public.fdj_demandes_correction') is null as demandes_absentes,
       not exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name='fdj_shifts'
                     and column_name='prise_de_poste_id')     as colonne_prise_de_poste_absente,
       not exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name='fdj_cash_controls'
                     and column_name='confirme_le')           as colonne_confirme_le_absente,
       not exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name='fdj_stock_movements'
                     and column_name='effective_at')          as colonne_effective_at_absente;

\echo ''
\echo '############################################################'
\echo '#  SECTION 0 — UN HISTORIQUE, POSE AVANT LES MIGRATIONS    #'
\echo '############################################################'
-- nexus-test ne contient aucune donnee FDJ (fdj_shifts, fdj_cash_controls,
-- fdj_stock_movements et fdj_booklets sont vides). L historique reel vit sur
-- Production, et on ne joue pas de recette sur Production. On reconstitue donc
-- ici les cas qui existent vraiment en Production, mesures en lecture seule et
-- inventories au point 21 du dossier :
--
--   * des quarts en statut 'valide' — c est-a-dire TRANSMIS par l employe —
--     sans valide_le : 14 lignes en Production ;
--   * des quarts en brouillon : 3 lignes ;
--   * les huit statuts de caisse que la CHECK d origine autorisait ;
--   * une caisse validee dont on connait la date mais pas le validateur ;
--   * des ecarts marques a_regulariser : 6 lignes en Production ;
--   * des mouvements de stock dont on ignore l auteur de saisie, certains
--     portant une cle d idempotence, d autres non.
--
-- Ce jeu n est pas « un jeu de test » : c est la forme des donnees reelles.

-- Instantane du remplissage des tables AVANT la moindre ecriture de la
-- recette. Il ne sert qu au controle d identite de la fin : celui-ci doit
-- pouvoir distinguer les lignes posees ici de celles qui preexistaient sur
-- nexus-test, sans jamais nommer ni les unes ni les autres.
create temporary table etat_initial (tab text primary key, n bigint);
do $$
declare r record; n bigint;
begin
  for r in select table_name from information_schema.tables
           where table_schema = 'public' and table_type = 'BASE TABLE'
             and (table_name like 'fdj\_%' or table_name in ('employees','shifts'))
  loop
    execute format('select count(*) from public.%I', r.table_name) into n;
    insert into etat_initial values (r.table_name, n);
  end loop;
end $$;

create temporary table ctx (cle text primary key, val text);
insert into ctx values
  ('emp_a',   'eeeeeee1-0000-4000-8000-eeeeeeeeeee1'),
  ('emp_b',   'eeeeeee2-0000-4000-8000-eeeeeeeeeee2'),
  ('manager', 'eeeeeee3-0000-4000-8000-eeeeeeeeeee3'),
  ('site',    'nexus-station-test'),
  ('loc_bureau', 'ddddddd1-0000-4000-8000-ddddddddddd1'),
  ('loc_caisse', 'ddddddd2-0000-4000-8000-ddddddddddd2');

-- Les acteurs de cette recette sont SYNTHETIQUES et crees ici meme, dans la
-- transaction annulee. Aucun employe reel de nexus-test n est sollicite : le
-- depot est public, et l identifiant d un employe y est un identifiant
-- pseudonyme persistant, correlable a une personne meme sans nom ni courriel.
--
-- Ils ne sont pas decoratifs pour autant. employees.site_id porte une cle
-- etrangere vers public.sites, role est soumis a employees_role_check, et
-- username est unique : les quatre lignes exercent reellement ces trois
-- contraintes. Leurs roles reproduisent ceux des comptes qu ils remplacent —
-- un caissier, un pompiste, un manager, un manager createur — parce que la
-- RLS et les commandes serveur lisent ces colonnes, et qu une fixture qui ne
-- les reproduirait pas ferait mentir la preuve.
--
-- public.employees.id n a aucune cle etrangere vers auth.users : un employe
-- peut donc exister sans compte d authentification, et le jeton simule par
-- set_config('request.jwt.claims', ...) n a besoin que de cet id.
insert into public.employees
  (id, username, nom, role, actif, est_createur, site_id, compte_test)
values
  ('eeeeeee1-0000-4000-8000-eeeeeeeeeee1','recette-vague1-employe-a',
   'Recette Vague 1 — employe A',      'caissier', true, false, 'nexus-station-test', true),
  ('eeeeeee2-0000-4000-8000-eeeeeeeeeee2','recette-vague1-employe-b',
   'Recette Vague 1 — employe B',      'pompiste', true, false, 'nexus-station-test', true),
  ('eeeeeee3-0000-4000-8000-eeeeeeeeeee3','recette-vague1-manager',
   'Recette Vague 1 — manager',        'manager',  true, false, 'nexus-station-test', true),
  ('eeeeeee4-0000-4000-8000-eeeeeeeeeee4','recette-vague1-manager-2',
   'Recette Vague 1 — second manager', 'manager',  true, true,  'nexus-station-test', true);

-- Deux emplacements synthetiques. fdj_stock_movements porte deux cles
-- etrangeres vers fdj_locations : sans ces deux lignes, la recette devrait
-- emprunter des emplacements reels de nexus-test — lesquels appartiennent au
-- site vito-sainte-marie, si bien qu un mouvement declare sur
-- nexus-station-test pointait vers l emplacement d un autre site. La fixture
-- corrige donc aussi cette incoherence.
insert into public.fdj_locations (id, site, nom, type, actif, ordre_affichage) values
  ('ddddddd1-0000-4000-8000-ddddddddddd1','nexus-station-test','Bureau (recette Vague 1)','bureau',true,910),
  ('ddddddd2-0000-4000-8000-ddddddddddd2','nexus-station-test','Caisse (recette Vague 1)','caisse',true,920);

insert into public.fdj_games (id, site, nom, prix, ordre_affichage) values
  ('00000003-0000-4000-8000-000000000001','nexus-station-test','JEU HISTORIQUE 2 EUROS',2.00,1),
  ('00000003-0000-4000-8000-000000000002','nexus-station-test','JEU HISTORIQUE 10 EUROS',10.00,2);

-- Neuf quarts historiques. Rappel de vocabulaire, qui compte pour lire la
-- suite : dans fdj_shifts.statut, 'valide' signifie « transmis par l employe »
-- et n a jamais voulu dire « valide par le manager ».
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut, ouvert_le, valide_le, created_at) values
  ('00000001-0000-4000-8000-000000000001','nexus-station-test','2026-08-01','1','eeeeeee1-0000-4000-8000-eeeeeeeeeee1','valide',   '2026-08-01 12:00:00+00', null,                     '2026-08-01 12:00:00+00'),
  ('00000001-0000-4000-8000-000000000002','nexus-station-test','2026-08-01','2','eeeeeee2-0000-4000-8000-eeeeeeeeeee2','valide',   '2026-08-01 21:00:00+00','2026-08-02 08:00:00+00','2026-08-01 21:00:00+00'),
  ('00000001-0000-4000-8000-000000000003','nexus-station-test','2026-08-02','1','eeeeeee1-0000-4000-8000-eeeeeeeeeee1','valide',   '2026-08-02 12:00:00+00', null,                     '2026-08-02 12:00:00+00'),
  ('00000001-0000-4000-8000-000000000004','nexus-station-test','2026-08-02','2','eeeeeee2-0000-4000-8000-eeeeeeeeeee2','valide',   '2026-08-02 21:00:00+00','2026-08-03 08:30:00+00','2026-08-02 21:00:00+00'),
  ('00000001-0000-4000-8000-000000000005','nexus-station-test','2026-08-03','1','eeeeeee1-0000-4000-8000-eeeeeeeeeee1','valide',   '2026-08-03 12:00:00+00', null,                     '2026-08-03 12:00:00+00'),
  ('00000001-0000-4000-8000-000000000006','nexus-station-test','2026-08-03','2','eeeeeee2-0000-4000-8000-eeeeeeeeeee2','valide',   '2026-08-03 21:00:00+00','2026-08-04 09:00:00+00','2026-08-03 21:00:00+00'),
  ('00000001-0000-4000-8000-000000000007','nexus-station-test','2026-08-04','1','eeeeeee1-0000-4000-8000-eeeeeeeeeee1','valide',   '2026-08-04 12:00:00+00','2026-08-05 08:00:00+00','2026-08-04 12:00:00+00'),
  ('00000001-0000-4000-8000-000000000008','nexus-station-test','2026-08-04','2','eeeeeee2-0000-4000-8000-eeeeeeeeeee2','valide',   '2026-08-04 21:00:00+00','2026-08-05 09:00:00+00','2026-08-04 21:00:00+00'),
  ('00000001-0000-4000-8000-000000000009','nexus-station-test','2026-08-05','1','eeeeeee1-0000-4000-8000-eeeeeeeeeee1','brouillon','2026-08-05 12:00:00+00', null,                     '2026-08-05 12:00:00+00');

-- Huit caisses, une par statut historique autorise par l ancienne CHECK.
-- La ligne 3 porte volontairement un valide_le SANS valide_par : c est le cas
-- qui rend la contrainte de coherence de la Vague 1 impossible a valider
-- immediatement, et c est pourquoi elle est posee NOT VALID.
insert into public.fdj_cash_controls
  (id, site, shift_id, caisse_attendue, caisse_reelle, ecart, statut, valide_par, valide_le, created_at, updated_at, resultat_controle, motif_ecart_texte) values
  ('00000002-0000-4000-8000-000000000001','nexus-station-test','00000001-0000-4000-8000-000000000001', 500.00, 500.00,   0.00,'provisoire',       null,                                  null,                    '2026-08-01 20:00:00+00','2026-08-01 20:00:00+00', null,           null),
  ('00000002-0000-4000-8000-000000000002','nexus-station-test','00000001-0000-4000-8000-000000000002', 610.00, 610.00,   0.00,'conforme',         'eeeeeee3-0000-4000-8000-eeeeeeeeeee3','2026-08-02 08:00:00+00','2026-08-01 23:00:00+00','2026-08-02 08:00:00+00','conforme',     'Controle sans remarque.'),
  ('00000002-0000-4000-8000-000000000003','nexus-station-test','00000001-0000-4000-8000-000000000003', 480.00, 443.00, -37.00,'a_regulariser',    null,                                  '2026-08-03 07:45:00+00','2026-08-02 20:00:00+00','2026-08-03 07:45:00+00','a_regulariser','Manquant constate au controle. Note interne manager.'),
  ('00000002-0000-4000-8000-000000000004','nexus-station-test','00000001-0000-4000-8000-000000000004', 520.00, 534.00,  14.00,'valide_avec_ecart','eeeeeee3-0000-4000-8000-eeeeeeeeeee3','2026-08-03 08:30:00+00','2026-08-02 23:00:00+00','2026-08-03 08:30:00+00','avec_ecart',   'Excedent, origine non identifiee.'),
  ('00000002-0000-4000-8000-000000000005','nexus-station-test','00000001-0000-4000-8000-000000000005', 455.00, 454.00,  -1.00,'a_controler',      null,                                  null,                    '2026-08-03 20:00:00+00','2026-08-03 20:00:00+00', null,           null),
  ('00000002-0000-4000-8000-000000000006','nexus-station-test','00000001-0000-4000-8000-000000000006', 610.00, 607.00,  -3.00,'en_attente',       null,                                  null,                    '2026-08-03 23:00:00+00','2026-08-03 23:00:00+00', null,           null),
  ('00000002-0000-4000-8000-000000000007','nexus-station-test','00000001-0000-4000-8000-000000000007', 505.00, 503.00,  -2.00,'expliquee',        null,                                  null,                    '2026-08-04 20:00:00+00','2026-08-04 20:00:00+00', null,           'Explication fournie, non tranchee.'),
  ('00000002-0000-4000-8000-000000000008','nexus-station-test','00000001-0000-4000-8000-000000000008', 600.00, 599.00,  -1.00,'regularise',       'eeeeeee3-0000-4000-8000-eeeeeeeeeee3','2026-08-05 09:00:00+00','2026-08-04 23:00:00+00','2026-08-05 09:00:00+00','a_regulariser','Regularise au quart suivant.');

-- Cinq mouvements de stock historiques. Aucun ne sait qui l a saisi : cette
-- information n existait pas avant la Vague 1. Deux portent une cle
-- d idempotence distincte, trois n en portent aucune.
--
-- Detail de forme, qui compte pour qui ecrira une commande serveur au-dessus :
-- fdj_stock_movements.idempotency_key est de type uuid, pas text. Une cle
-- « parlante » du genre 'APPRO-20260801-A' est rejetee par la base avec un
-- 22P02 avant meme d atteindre l index unique. Les cles sont donc des uuid
-- deterministes, a deriver de l evenement source.
insert into public.fdj_stock_movements
  (id, site, game_id, type_mouvement, quantite, location_source_id, location_destination_id, employee_id, created_at, shift_id, methode_identification, source, idempotency_key) values
  ('00000004-0000-4000-8000-000000000001','nexus-station-test','00000003-0000-4000-8000-000000000001','reception', 10, null,                                   'ddddddd1-0000-4000-8000-ddddddddddd1','eeeeeee1-0000-4000-8000-eeeeeeeeeee1','2026-08-01 12:30:00+00','00000001-0000-4000-8000-000000000001','quantite','historique','11111111-0000-4000-8000-000000000001'),
  ('00000004-0000-4000-8000-000000000002','nexus-station-test','00000003-0000-4000-8000-000000000001','transfert',  5, 'ddddddd1-0000-4000-8000-ddddddddddd1','ddddddd2-0000-4000-8000-ddddddddddd2','eeeeeee2-0000-4000-8000-eeeeeeeeeee2','2026-08-01 21:15:00+00','00000001-0000-4000-8000-000000000002','quantite','historique','11111111-0000-4000-8000-000000000002'),
  ('00000004-0000-4000-8000-000000000003','nexus-station-test','00000003-0000-4000-8000-000000000002','activation', 1, 'ddddddd2-0000-4000-8000-ddddddddddd2', null,                                  'eeeeeee1-0000-4000-8000-eeeeeeeeeee1','2026-08-02 13:00:00+00','00000001-0000-4000-8000-000000000003','scan',    'historique', null),
  ('00000004-0000-4000-8000-000000000004','nexus-station-test','00000003-0000-4000-8000-000000000002','activation', 1, 'ddddddd2-0000-4000-8000-ddddddddddd2', null,                                  'eeeeeee2-0000-4000-8000-eeeeeeeeeee2','2026-08-02 22:00:00+00','00000001-0000-4000-8000-000000000004','scan',    'historique', null),
  ('00000004-0000-4000-8000-000000000005','nexus-station-test','00000003-0000-4000-8000-000000000001','correction', 2, null,                                   'ddddddd1-0000-4000-8000-ddddddddddd1','eeeeeee1-0000-4000-8000-eeeeeeeeeee1','2026-08-03 14:00:00+00','00000001-0000-4000-8000-000000000005','saisie_manuelle','historique', null);

-- L empreinte de l historique, colonne par colonne. On ne peut pas prendre
-- md5(ligne entiere) : les migrations AJOUTENT des colonnes, la ligne entiere
-- change forcement de forme. Ce qu on veut verifier, c est que les valeurs
-- DEJA LA n ont pas bouge — donc on nomme explicitement ces colonnes.
create temporary table empreinte_avant as
  select 'fdj_shifts'::text as tbl, id,
         md5(row(site, date, quart, employee_id, statut, ouvert_le, valide_le, created_at)::text) as h
  from public.fdj_shifts
  union all
  select 'fdj_cash_controls', id,
         md5(row(site, shift_id, caisse_attendue, caisse_reelle, ecart, statut, valide_par,
                 valide_le, created_at, resultat_controle, motif_ecart_texte, regularisations)::text)
  from public.fdj_cash_controls
  union all
  select 'fdj_stock_movements', id,
         md5(row(site, game_id, type_mouvement, quantite, location_source_id, location_destination_id,
                 employee_id, created_at, shift_id, methode_identification, source, idempotency_key)::text)
  from public.fdj_stock_movements;

-- La liste des fonctions publiques AVANT la vague. La difference apres les
-- migrations donnera exactement les fonctions que la Vague 1 ajoute — sans
-- avoir a les enumerer a la main, donc sans risque d en oublier une.
create temporary table fonctions_avant as
  select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public';

-- Les compteurs qui serviront a separer l INSTALLATION des commandes de leur
-- EXECUTION (P21.6 b1). Ils sont pris ICI, c est-a-dire apres la pose de tout
-- l historique et juste avant le premier \ir : tout ecart mesure apres le bloc
-- des douze migrations sera donc imputable aux migrations elles-memes, a rien
-- d autre.
create temporary table compteurs_avant_migrations as
  select (select count(*) from public.fdj_stock_movements) as mouvements,
         (select count(*) from public.fdj_booklets)        as livrets,
         (select count(*) from public.fdj_audit_log)       as audit,
         (select count(*) from public.fdj_shifts)          as quarts,
         (select count(*) from public.fdj_cash_controls)   as caisses;

select 'SECTION 0' as etape,
       (select count(*) from public.fdj_shifts)          as quarts_historiques,
       (select count(*) from public.fdj_cash_controls)   as caisses_historiques,
       (select count(*) from public.fdj_stock_movements) as mouvements_historiques,
       (select count(*) from public.fdj_booklets)        as livrets_attendu_0,
       (select count(*) from empreinte_avant)            as lignes_sous_empreinte;

\echo ''
\echo '############################################################'
\echo '#  LES DOUZE MIGRATIONS DE LA PHASE A, DANS L ORDRE         #'
\echo '############################################################'
-- L ordre n est pas cosmetique : 20260916220400 ajoute created_by et
-- effective_at, et 20260916221000 ecrit ces deux colonnes. Charger la seconde
-- sans la premiere echouerait. Les douze sont donc nommees une a une, de
-- 220000 a 221100, sans glob : ce qui est charge est ce qui est lisible ici.
-- Le serveur annonce lui-meme chacune d elles dans la sortie, en prefixe
-- psql:supabase/migrations/<fichier>:<ligne> des le premier message qu elle
-- produit ; le decompte n a donc pas a etre cru sur parole.

\ir ../migrations/20260916220000_fdj_quart_relie_a_la_prise_de_poste.sql
\ir ../migrations/20260916220100_fdj_caisse_cycle_de_vie_colonnes.sql
\ir ../migrations/20260916220200_fdj_caisse_journal_evenements.sql
\ir ../migrations/20260916220300_fdj_demandes_correction_apres_validation.sql
\ir ../migrations/20260916220400_fdj_mouvements_auteur_et_date_effet.sql
\ir ../migrations/20260916220500_fdj_commande_ouverture_quart.sql
\ir ../migrations/20260916220600_fdj_commandes_caisse_employe.sql
\ir ../migrations/20260916220700_fdj_commandes_caisse_manager.sql
\ir ../migrations/20260916220800_fdj_projection_employe.sql
\ir ../migrations/20260916220900_fdj_projection_progression.sql
\ir ../migrations/20260916221000_fdj_commandes_activations_et_mouvements.sql
\ir ../migrations/20260916221100_fdj_commande_saisie_caisse_manager.sql

-- Le meme releve, immediatement apres. Aucune requete ne s est intercalee.
create temporary table compteurs_apres_migrations as
  select (select count(*) from public.fdj_stock_movements) as mouvements,
         (select count(*) from public.fdj_booklets)        as livrets,
         (select count(*) from public.fdj_audit_log)       as audit,
         (select count(*) from public.fdj_shifts)          as quarts,
         (select count(*) from public.fdj_cash_controls)   as caisses;

-- Et la liste des douze, telle que le fichier la declare — a confronter aux
-- prefixes psql:supabase/migrations/... que le serveur a emis juste au-dessus.
select 'PREREQUIS' as bloc, n as rang, v as migration_chargee
from unnest(array[
  '20260916220000_fdj_quart_relie_a_la_prise_de_poste.sql',
  '20260916220100_fdj_caisse_cycle_de_vie_colonnes.sql',
  '20260916220200_fdj_caisse_journal_evenements.sql',
  '20260916220300_fdj_demandes_correction_apres_validation.sql',
  '20260916220400_fdj_mouvements_auteur_et_date_effet.sql',
  '20260916220500_fdj_commande_ouverture_quart.sql',
  '20260916220600_fdj_commandes_caisse_employe.sql',
  '20260916220700_fdj_commandes_caisse_manager.sql',
  '20260916220800_fdj_projection_employe.sql',
  '20260916220900_fdj_projection_progression.sql',
  '20260916221000_fdj_commandes_activations_et_mouvements.sql',
  '20260916221100_fdj_commande_saisie_caisse_manager.sql'
]) with ordinality as u(v, n)
order by n;

-- Preuve d existence, cote serveur cette fois : les objets que seules les
-- trois dernieres migrations creent. Si l une des trois n avait pas ete
-- chargee, cette ligne le dirait sans qu il faille lire la sortie a l oeil.
do $$
begin
  if to_regprocedure('public.fdj_activer_carnet(uuid, uuid, numeric, text, text, text, text, uuid)') is null
     or to_regprocedure('public.fdj_enregistrer_mouvement_stock(text, jsonb, text, text, text, text, timestamptz)') is null
     or to_regprocedure('public.fdj_saisir_caisse_manager(uuid, numeric, text, numeric, text, text, text)') is null then
    raise exception 'PREREQUIS : les douze migrations ne sont pas toutes chargees — les commandes de 221000/221100 manquent';
  end if;
  raise notice 'PREREQUIS OK : les douze migrations de la Phase A sont chargees, 220000 a 221100';
end $$;

\echo ''
\echo '############################################################'
\echo '#  P22.1 — AUCUNE COLONNE AJOUTEE N EST REMPLIE            #'
\echo '############################################################'
-- « Aucune migration ne doit inventer ou corriger silencieusement des faits
-- historiques » (§8). Une colonne ajoutee a une table qui contient deja des
-- lignes est le premier endroit ou l on invente : il suffit d un DEFAULT.

select 'P22.1 fdj_shifts' as preuve, count(*) as lignes,
       count(prise_de_poste_id)        as prise_de_poste_id_renseigne_attendu_0,
       count(created_by)               as created_by_renseigne_attendu_0,
       count(ouverture_source)         as ouverture_source_renseigne_attendu_0,
       count(responsable_precedent_id) as responsable_precedent_attendu_0,
       count(responsable_transfere_par)as transfere_par_attendu_0,
       count(responsable_transfere_le) as transfere_le_attendu_0,
       count(motif_transfert)          as motif_transfert_attendu_0
from public.fdj_shifts;

select 'P22.1 fdj_stock_movements' as preuve, count(*) as lignes,
       count(created_by)   as created_by_renseigne_attendu_0,
       count(effective_at) as effective_at_renseigne_attendu_0
from public.fdj_stock_movements;

select 'P22.1 fdj_cash_controls' as preuve, count(*) as lignes,
       count(saisi_par)              as saisi_par_attendu_0,
       count(confirme_par)           as confirme_par_attendu_0,
       count(confirme_le)            as confirme_le_attendu_0,
       count(controle_par)           as controle_par_attendu_0,
       count(controle_le)            as controle_le_attendu_0,
       count(derniere_correction_le) as derniere_correction_attendu_0
from public.fdj_cash_controls;

-- Les deux seules colonnes de la vague qui portent une valeur sur l historique,
-- et elles la portent parce qu elles sont NOT NULL : version et nb_corrections.
-- Ce n est pas un fait invente, c est un compteur a sa valeur neutre. Mais il
-- faut le dire exactement : nb_corrections = 0 signifie « aucune correction
-- ENREGISTREE », et le journal qui les enregistre nait avec cette vague. Une
-- caisse historique modifiee par un UPDATE direct en 2026 reste donc a 0. Cette
-- ligne figure au point 21 du dossier, parmi ce qui demande un arbitrage humain.
select 'P22.1 valeurs posees' as preuve,
       min(version) as version_min, max(version) as version_max,
       min(nb_corrections) as corrections_min, max(nb_corrections) as corrections_max,
       count(*) filter (where version <> nb_corrections + 1) as invariant_viole_attendu_0
from public.fdj_cash_controls;

\echo ''
\echo '############################################################'
\echo '#  P22.2 — AUCUNE VALEUR EXISTANTE N A BOUGE               #'
\echo '############################################################'

create temporary table empreinte_apres as
  select 'fdj_shifts'::text as tbl, id,
         md5(row(site, date, quart, employee_id, statut, ouvert_le, valide_le, created_at)::text) as h
  from public.fdj_shifts
  union all
  select 'fdj_cash_controls', id,
         md5(row(site, shift_id, caisse_attendue, caisse_reelle, ecart, statut, valide_par,
                 valide_le, created_at, resultat_controle, motif_ecart_texte, regularisations)::text)
  from public.fdj_cash_controls
  union all
  select 'fdj_stock_movements', id,
         md5(row(site, game_id, type_mouvement, quantite, location_source_id, location_destination_id,
                 employee_id, created_at, shift_id, methode_identification, source, idempotency_key)::text)
  from public.fdj_stock_movements;

select 'P22.2' as preuve,
       (select count(*) from empreinte_avant) as lignes_avant,
       (select count(*) from empreinte_apres) as lignes_apres,
       (select count(*) from empreinte_avant a join empreinte_apres b
          on b.tbl = a.tbl and b.id = a.id where b.h is distinct from a.h) as valeurs_modifiees_attendu_0,
       (select count(*) from empreinte_avant a left join empreinte_apres b
          on b.tbl = a.tbl and b.id = a.id where b.id is null)             as lignes_disparues_attendu_0,
       (select count(*) from empreinte_apres b left join empreinte_avant a
          on a.tbl = b.tbl and a.id = b.id where a.id is null)             as lignes_apparues_attendu_0;

\echo ''
\echo '############################################################'
\echo '#  P22.3 — LES HUIT STATUTS HISTORIQUES SURVIVENT          #'
\echo '############################################################'
-- La migration 220100 SUPPRIME puis RECREE fdj_cash_controls_statut_check, et
-- la recree VALIDEE — pas NOT VALID. C est donc le seul endroit de la vague ou
-- une contrainte est confrontee immediatement a tout l historique. Si le
-- nouveau jeu de statuts n etait pas un surensemble de l ancien, la migration
-- echouerait ici, sur cette ligne, en Production. Elle ne l a pas fait.

select 'P22.3' as preuve, statut, count(*) as lignes
from public.fdj_cash_controls group by statut order by statut;

select 'P22.3 contraintes' as preuve, conname,
       convalidated as validee,
       case when convalidated then 'confrontee a tout l historique' else 'NOT VALID : l historique est epargne' end as portee
from pg_constraint
where conrelid = 'public.fdj_cash_controls'::regclass
  and conname in ('fdj_cash_controls_statut_check','fdj_cash_controls_version_check',
                  'fdj_cash_controls_validation_complete_check')
order by conname;

\echo ''
\echo '--- P22.3b — ce que NOT VALID epargne, et ce qu il n epargne pas ---'
-- La ligne 3 de l historique porte un valide_le sans valide_par. Elle viole la
-- contrainte de coherence de validation. Trois questions, trois reponses.

-- 1) Est-elle toujours la, apres la migration ?
select 'P22.3b (1) la ligne incoherente survit' as preuve, id, statut, valide_par, valide_le
from public.fdj_cash_controls where valide_le is not null and valide_par is null;

-- 2) Une ligne NEUVE de meme forme serait-elle acceptee ? NOT VALID n exempte
--    que l existant : toute ecriture future est controlee. Attendu : 23514.
savepoint p223b;
do $$
begin
  insert into public.fdj_cash_controls (id, site, shift_id, statut, valide_par, valide_le)
  values ('00000002-0000-4000-8000-fffffffffff0','nexus-station-test',
          '00000001-0000-4000-8000-000000000009','conforme', null, now());
  raise notice 'P22.3b (2) ECHEC DE LA PREUVE : une ligne neuve incoherente a ete acceptee';
exception when check_violation then
  raise notice 'P22.3b (2) refus attendu sur une ligne NEUVE : % (%)', sqlerrm, sqlstate;
end $$;
rollback to savepoint p223b;

-- 3) Que se passerait-il si l on validait la contrainte tout de suite ? Elle
--    echouerait — c est precisement pourquoi elle est posee NOT VALID, et c est
--    une condition d arret ecrite au point 23 du dossier : valider ces
--    contraintes n est PAS une operation de la Vague 1.
savepoint p223c;
do $$
begin
  alter table public.fdj_cash_controls validate constraint fdj_cash_controls_validation_complete_check;
  raise notice 'P22.3b (3) la validation immediate passe sur CE jeu — en Production, 24 lignes la feraient echouer';
exception when check_violation then
  raise notice 'P22.3b (3) validation immediate refusee, comme attendu : % (%)', sqlerrm, sqlstate;
end $$;
rollback to savepoint p223c;

\echo ''
\echo '############################################################'
\echo '#  P22.4 — LES QUARTS TRANSMIS SANS DATE RESTENT SANS DATE #'
\echo '############################################################'
-- 14 lignes de Production sont en statut 'valide' sans valide_le. On ne sait
-- pas quand elles l ont ete. NULL veut dire « inconnu », et aucune migration
-- n invente une date (§8).

select 'P22.4' as preuve,
       count(*) filter (where statut = 'valide' and valide_le is null)     as transmis_sans_date,
       count(*) filter (where statut = 'valide' and valide_le is not null) as transmis_avec_date,
       count(*) filter (where statut = 'brouillon')                        as brouillons_preserves,
       count(*) filter (where statut = 'brouillon' and valide_le is not null) as brouillon_date_inventee_attendu_0
from public.fdj_shifts;

\echo ''
\echo '############################################################'
\echo '#  P22.5 — LES ECARTS a_regulariser RESTENT INTACTS        #'
\echo '############################################################'
-- « Les six ecarts actuellement marques a_regulariser doivent rester
-- identifiables et accessibles au manager. Ils ne doivent pas etre declares
-- regles ou modifies. » (§7)

select 'P22.5' as preuve, c.id, c.statut, c.resultat_controle, c.ecart,
       s.date as date_metier, s.quart
from public.fdj_cash_controls c join public.fdj_shifts s on s.id = c.shift_id
where c.statut = 'a_regulariser' or c.resultat_controle = 'a_regulariser'
order by s.date, s.quart;

\echo ''
\echo '############################################################'
\echo '#  P22.6 — UN DOUBLON DE CLE ARRETERAIT LA PHASE A         #'
\echo '############################################################'
-- Un index unique se cree sur une table qui contient deja des lignes : sa
-- creation echoue si deux d entre elles partagent une cle. La mesure prealable
-- (110 cles, 110 distinctes en Production) dit que non — mais une mesure n est
-- pas une garantie : elle date du 16/09. Voici ce qui arriverait si elle etait
-- fausse le jour de l application, et pourquoi c est un arret propre.
--
-- On ne nomme pas l index en dur : on demande a la base lequel porte
-- reellement l unicite, on le retire, on fabrique le doublon, puis on tente de
-- le recreer avec SA PROPRE definition. C est cette precaution qui a revele
-- le doublon d index corrige dans la migration 220400.
savepoint p226;
do $$
declare v_nom text; v_def text;
begin
  select c.relname, pg_get_indexdef(i.indexrelid) into v_nom, v_def
  from pg_index i join pg_class c on c.oid = i.indexrelid
  where i.indrelid = 'public.fdj_stock_movements'::regclass
    and i.indisunique and i.indnkeyatts = 1
    and i.indkey[0] = (select attnum from pg_attribute
                       where attrelid = 'public.fdj_stock_movements'::regclass
                         and attname = 'idempotency_key' and not attisdropped);
  if v_nom is null then
    raise exception 'P22.6 ECHEC DE LA PREUVE : aucun index unique ne couvre idempotency_key';
  end if;
  raise notice 'P22.6 index porteur de l unicite : %', v_nom;

  execute format('drop index public.%I', v_nom);
  update public.fdj_stock_movements set idempotency_key = '11111111-0000-4000-8000-000000000001'
  where id = '00000004-0000-4000-8000-000000000002';

  begin
    execute v_def;
    raise notice 'P22.6 ECHEC DE LA PREUVE : l index a ete cree malgre un doublon';
  exception when unique_violation then
    raise notice 'P22.6 la migration s arrete, sans rien modifier : % (%)', sqlerrm, sqlstate;
  end;
end $$;
rollback to savepoint p226;

select 'P22.6 apres retour arriere' as preuve,
       (select count(*) from pg_indexes where schemaname = 'public'
          and tablename = 'fdj_stock_movements' and indexdef ilike '%idempotency_key%') as index_retabli_attendu_1,
       (select idempotency_key from public.fdj_stock_movements where id = '00000004-0000-4000-8000-000000000002') as cle_intacte;

\echo ''
\echo '############################################################'
\echo '#  P21.1 — TROIS NOTIONS DISTINCTES SUR UN MOUVEMENT        #'
\echo '############################################################'
-- §6 : distinguer employee_id (responsable operationnel), created_by (auteur de
-- la saisie), effective_at (date reelle d effet) et created_at (enregistrement).
-- Le manager saisit, a 23 h, un mouvement dont l employe A est responsable et
-- qui a eu lieu la veille a 13 h.

insert into public.fdj_stock_movements
  (id, site, game_id, type_mouvement, quantite, location_source_id, location_destination_id,
   employee_id, created_by, effective_at, created_at, shift_id, methode_identification, source, idempotency_key)
values
  ('00000004-0000-4000-8000-00000000000a','nexus-station-test','00000003-0000-4000-8000-000000000001',
   'transfert', 3, 'ddddddd1-0000-4000-8000-ddddddddddd1','ddddddd2-0000-4000-8000-ddddddddddd2',
   'eeeeeee1-0000-4000-8000-eeeeeeeeeee1',            -- responsable operationnel : A
   'eeeeeee3-0000-4000-8000-eeeeeeeeeee3',            -- auteur de la saisie : le manager
   '2026-09-16 17:00:00+00', '2026-09-17 03:00:00+00',
   '00000001-0000-4000-8000-000000000001','saisie_manuelle','saisie_differee_manager','11111111-0000-4000-8000-00000000000a');

select 'P21.1' as preuve,
       (select nom from public.employees where id = m.employee_id) as responsable_operationnel,
       (select nom from public.employees where id = m.created_by)  as auteur_de_la_saisie,
       m.employee_id is distinct from m.created_by as deux_identites_distinctes,
       m.effective_at, m.created_at,
       m.effective_at is distinct from m.created_at as date_effet_distincte_de_l_enregistrement
from public.fdj_stock_movements m where m.id = '00000004-0000-4000-8000-00000000000a';

\echo ''
\echo '############################################################'
\echo '#  P21.2 — L HISTORIQUE NE RECOIT NI AUTEUR NI DATE D EFFET #'
\echo '############################################################'

select 'P21.2' as preuve, m.id, m.type_mouvement,
       (select nom from public.employees where id = m.employee_id) as responsable_connu,
       m.created_by   as auteur_de_saisie_attendu_null,
       m.effective_at as date_effet_attendue_null
from public.fdj_stock_movements m
where m.source = 'historique' order by m.created_at;

\echo ''
\echo '############################################################'
\echo '#  P21.3 — LA CLE D IDEMPOTENCE MORD                        #'
\echo '############################################################'
savepoint p213;
do $$
begin
  insert into public.fdj_stock_movements
    (id, site, game_id, type_mouvement, quantite, location_destination_id, employee_id,
     created_by, created_at, methode_identification, source, idempotency_key)
  values ('00000004-0000-4000-8000-00000000000b','nexus-station-test','00000003-0000-4000-8000-000000000001',
          'transfert', 3, 'ddddddd2-0000-4000-8000-ddddddddddd2','eeeeeee1-0000-4000-8000-eeeeeeeeeee1',
          'eeeeeee3-0000-4000-8000-eeeeeeeeeee3', now(),'saisie_manuelle','saisie_differee_manager',
          '11111111-0000-4000-8000-00000000000a');
  raise notice 'P21.3 ECHEC DE LA PREUVE : le meme mouvement a ete enregistre deux fois';
exception when unique_violation then
  raise notice 'P21.3 rejeu refuse, comme attendu : % (%)', sqlerrm, sqlstate;
end $$;
rollback to savepoint p213;

select 'P21.3' as preuve, idempotency_key, count(*) as lignes
from public.fdj_stock_movements where idempotency_key is not null
group by idempotency_key order by idempotency_key;

\echo ''
\echo '############################################################'
\echo '#  P21.4 — SANS CLE, PLUSIEURS LIGNES COHABITENT            #'
\echo '############################################################'
-- L index est PARTIEL (where idempotency_key is not null). L historique, qui
-- n a jamais porte de cle, n est donc pas contraint retroactivement a
-- l unicite : trois mouvements sans cle restent trois mouvements.

select 'P21.4' as preuve,
       count(*) filter (where idempotency_key is null)     as mouvements_sans_cle,
       count(*) filter (where idempotency_key is not null) as mouvements_avec_cle
from public.fdj_stock_movements;

\echo '--- P21.4b — un seul index, pas deux ---'
-- L unicite existait AVANT la vague, sous le nom fdj_stock_movements_idempotency_key_uniq,
-- avec exactement la definition que la migration 220400 voulait poser. Comme
-- `create unique index if not exists` compare le nom et non la definition, la
-- version initiale de 220400 en aurait cree un second, identique. La migration
-- teste desormais la definition ; ce controle verifie qu il n en reste qu un.
select 'P21.4b' as preuve,
       count(*) as index_uniques_sur_idempotency_key_attendu_1,
       string_agg(c.relname, ', ' order by c.relname) as nom_de_l_index,
       min(pg_get_indexdef(i.indexrelid)) as definition
from pg_index i join pg_class c on c.oid = i.indexrelid
where i.indrelid = 'public.fdj_stock_movements'::regclass
  and i.indisunique and i.indnkeyatts = 1
  and i.indkey[0] = (select attnum from pg_attribute
                     where attrelid = 'public.fdj_stock_movements'::regclass
                       and attname = 'idempotency_key' and not attisdropped);

\echo ''
\echo '############################################################'
\echo '#  P21.5 — UNE DATE D EFFET ABSURDE EST REFUSEE             #'
\echo '############################################################'
-- La contrainte effective_at <= created_at + 1 jour est NOT VALID : elle
-- n examine pas l historique, mais elle controle toute ecriture nouvelle.
savepoint p215;
do $$
begin
  insert into public.fdj_stock_movements
    (id, site, game_id, type_mouvement, quantite, location_destination_id, employee_id,
     created_by, effective_at, created_at, methode_identification, source)
  values ('00000004-0000-4000-8000-00000000000c','nexus-station-test','00000003-0000-4000-8000-000000000001',
          'reception', 1,'ddddddd1-0000-4000-8000-ddddddddddd1','eeeeeee1-0000-4000-8000-eeeeeeeeeee1',
          'eeeeeee3-0000-4000-8000-eeeeeeeeeee3',
          '2026-09-20 12:00:00+00', '2026-09-17 03:00:00+00','quantite','saisie_differee_manager');
  raise notice 'P21.5 ECHEC DE LA PREUVE : une date d effet posterieure de trois jours a ete acceptee';
exception when check_violation then
  raise notice 'P21.5 date d effet absurde refusee, comme attendu : % (%)', sqlerrm, sqlstate;
end $$;
rollback to savepoint p215;

\echo ''
\echo '############################################################'
\echo '#  P21.6 — INSTALLER LES COMMANDES N ECRIT RIEN              #'
\echo '############################################################'
-- « Aucune activation ni aucun mouvement reel ne doit etre cree pendant cette
-- mission » (§6).
--
-- Cette preuve tenait autrefois en une phrase : aucune fonction apportee par la
-- vague n ecrit dans fdj_stock_movements ni dans fdj_booklets. La phrase etait
-- vraie tant que cette recette s arretait a la neuvieme migration. Elle est
-- fausse des lors que les douze sont chargees, et elle devait l etre :
-- 20260916221000 cree precisement deux commandes serveur qui ecrivent dans
-- fdj_stock_movements. C est leur raison d etre, et c est ce qui repond au
-- troisieme blocage de la relecture. Attendre ici « zero fonction ecrivante »
-- reviendrait a exiger que la correction n ait pas eu lieu.
--
-- On ne prouve donc plus « aucune fonction n ecrit ». On distingue les trois
-- choses que cette phrase confondait :
--   (b1) l INSTALLATION des douze migrations ne cree aucun mouvement ;
--   (b2) leur CODE contient legitimement les ecritures, et sous quelles gardes ;
--   (b3) leur EXECUTION est jouee, mesuree et annulee — c est P21.7.
--
-- (a) Etat des lieux a cet instant, avant toute execution de commande.
select 'P21.6 (a)' as preuve,
       (select count(*) from public.fdj_booklets) as livrets_attendu_0,
       (select count(*) from public.fdj_stock_movements where source = 'historique') as mouvements_du_jeu_historique,
       (select count(*) from public.fdj_stock_movements where source is distinct from 'historique') as mouvements_poses_par_la_recette;
-- `is distinct from` et non `<>` : fdj_activer_carnet n ecrit pas la colonne
-- source, qui reste NULL. Avec `<>`, les lignes ecrites par la commande
-- auraient echappe au comptage — la mesure se serait auto-innocentee.

-- (b1) L INSTALLATION. Les deux releves encadrent le bloc des douze \ir : entre
--      eux, rien d autre ne s est execute. Un delta non nul serait le signe
--      qu une migration de la Phase A touche aux donnees, ce qu aucune ne doit
--      faire.
select 'P21.6 (b1)' as preuve,
       b.mouvements - a.mouvements as delta_mouvements_attendu_0,
       b.livrets    - a.livrets    as delta_livrets_attendu_0,
       b.audit      - a.audit      as delta_journal_audit_attendu_0,
       b.quarts     - a.quarts     as delta_quarts_attendu_0,
       b.caisses    - a.caisses    as delta_caisses_attendu_0
from compteurs_avant_migrations a, compteurs_apres_migrations b;

do $$
declare d record;
begin
  select b.mouvements - a.mouvements as m, b.livrets - a.livrets as l,
         b.audit - a.audit as j, b.quarts - a.quarts as q, b.caisses - a.caisses as c
    into d
    from compteurs_avant_migrations a, compteurs_apres_migrations b;
  if d.m <> 0 or d.l <> 0 or d.j <> 0 or d.q <> 0 or d.c <> 0 then
    raise exception 'ECHEC DE LA PREUVE P21.6 (b1) : installer les douze migrations a modifie les donnees (mouvements %, livrets %, audit %, quarts %, caisses %)',
      d.m, d.l, d.j, d.q, d.c;
  end if;
  raise notice 'P21.6 (b1) OK — installer les douze migrations ne cree ni mouvement, ni livret, ni ligne de journal';
end $$;

-- (b2) LE CODE. Les fonctions ajoutees par la vague qui ecrivent dans
--      fdj_stock_movements sont nommees — la liste n est pas recopiee a la
--      main, c est la difference entre l etat d avant et l etat d apres — et
--      chacune est examinee sur ce qui rend l ecriture acceptable :
--        * elle s execute en SECURITY DEFINER, avec un search_path fige ;
--        * elle n accepte pas de recevoir le responsable operationnel en
--          parametre : employee_id est lu en base depuis le quart, jamais
--          dicte par l appelant. C est la garantie qu une session ne peut pas
--          ecrire un mouvement au nom d un tiers ;
--        * son droit d execution est ferme a anon et a PUBLIC. `revoke from
--          public` ne suffit pas sur Supabase : anon recoit ses droits par
--          grants nommes, les deux sont donc verifies separement.
select 'P21.6 (b2)' as preuve, p.proname,
       p.prosecdef as security_definer_attendu_t,
       coalesce(array_to_string(p.proconfig, ','), '') ~ 'search_path=' as search_path_fige_attendu_t,
       not ('employee_id' = any (coalesce(p.proargnames, '{}'::text[]))) as employee_id_non_dicte_attendu_t,
       not has_function_privilege('anon', p.oid, 'execute') as execute_ferme_a_anon_attendu_t,
       not exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                    where a.grantee = 0 and a.privilege_type = 'EXECUTE') as execute_ferme_a_public_attendu_t
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.oid not in (select oid from fonctions_avant)
  and p.prosrc ~ 'insert into public\.fdj_stock_movements'
order by p.proname;

do $$
declare n_ecrivantes int; n_defaillantes int; n_livrets int;
begin
  select count(*) into n_ecrivantes
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.oid not in (select oid from fonctions_avant)
     and p.prosrc ~ 'insert into public\.fdj_stock_movements';

  select count(*) into n_defaillantes
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.oid not in (select oid from fonctions_avant)
     and p.prosrc ~ 'insert into public\.fdj_stock_movements'
     and not (
       p.prosecdef
       and coalesce(array_to_string(p.proconfig, ','), '') ~ 'search_path='
       and not ('employee_id' = any (coalesce(p.proargnames, '{}'::text[])))
       and not has_function_privilege('anon', p.oid, 'execute')
       and not exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                        where a.grantee = 0 and a.privilege_type = 'EXECUTE'));

  select count(*) into n_livrets
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.oid not in (select oid from fonctions_avant)
     and p.prosrc ~ 'fdj_booklets';

  if n_ecrivantes < 2 then
    raise exception 'ECHEC DE LA PREUVE P21.6 (b2) : % fonction(s) ecrivante(s) reperee(s) — la vague en apporte deux, la mesure a rate sa cible', n_ecrivantes;
  end if;
  if n_defaillantes > 0 then
    raise exception 'ECHEC DE LA PREUVE P21.6 (b2) : % fonction(s) ecrivante(s) hors garde (definer, search_path, employee_id dicte, anon ou PUBLIC)', n_defaillantes;
  end if;
  if n_livrets <> 0 then
    raise exception 'ECHEC DE LA PREUVE P21.6 (b2) : % fonction(s) de la vague touche(nt) fdj_booklets — la Vague 1 ne devait pas y toucher', n_livrets;
  end if;
  raise notice 'P21.6 (b2) OK — % commandes ecrivent les mouvements, toutes sous garde ; aucune ne touche les livrets', n_ecrivantes;
end $$;

-- Le detail de toutes les fonctions apportees par la vague, ecrivantes ou non.
select 'P21.6 (b2) detail' as preuve, p.proname,
       case p.provolatile when 's' then 'stable' when 'i' then 'immutable' else 'volatile' end as volatilite,
       p.prosrc ~ 'insert into public\.fdj_stock_movements' as ecrit_les_mouvements
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.oid not in (select oid from fonctions_avant)
order by p.proname;

-- (b3) L EXECUTION. Elle n est pas supposee : elle est jouee juste en dessous,
--      sous identites simulees, avec ses refus et son idempotence, puis
--      annulee avec le reste de la transaction.
select 'P21.6 (b3)' as preuve,
       'l execution controlee des deux commandes est mesuree en P21.7' as renvoi;

\echo ''
\echo '############################################################'
\echo '#  P21.7 — EXECUTION CONTROLEE DES COMMANDES DE LA VAGUE    #'
\echo '############################################################'
-- Ce qui suit exerce reellement fdj_activer_carnet et
-- fdj_enregistrer_mouvement_stock, sous jetons simules, avec les acteurs, les
-- emplacements et les jeux synthetiques poses en SECTION 0. Aucune donnee
-- reelle n est creee, et la transaction entiere est annulee a la fin du
-- fichier.
--
-- Deux precautions de forme, dites plutot que tues :
--   * les identifiants engendres par le serveur (mouvement_id, mouvement_ids)
--     sont retires des resultats affiches par l operateur jsonb `-`. Ce sont
--     des gen_random_uuid() : ils ne sont pas de forme fixture et n ont rien a
--     faire dans la sortie publiee d un depot public. Rien n est retouche a la
--     main pour autant : c est la requete qui ne les demande pas.
--   * aucun emplacement synthetique de type « bloque » n existe ici. Les
--     operations blocage et retour_bloque ne sont donc eprouvees que par leurs
--     refus, pas par leur chemin nominal.

-- ---------------------------------------------------------------------------
-- (1) Activation par l employe, sur son propre quart.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
                  '{"sub":"eeeeeee1-0000-4000-8000-eeeeeeeeeee1","role":"authenticated"}', true)
       is not null as identite_employe_a;
set local role authenticated;

select 'P21.7 (1)' as preuve,
       public.fdj_activer_carnet(
         '00000001-0000-4000-8000-000000000001',
         '00000003-0000-4000-8000-000000000001',
         3, 'quantite', 'jeton-p217-activation-employe') - 'mouvement_id'::text as resultat;

-- (1 bis) Idempotence : le meme appel, le meme jeton, aucune ligne de plus.
select 'P21.7 (1 bis)' as preuve,
       public.fdj_activer_carnet(
         '00000001-0000-4000-8000-000000000001',
         '00000003-0000-4000-8000-000000000001',
         3, 'quantite', 'jeton-p217-activation-employe') - 'mouvement_id'::text as resultat_du_rejeu;

reset role;

select 'P21.7 (1) controle' as preuve, m.type_mouvement, m.quantite, m.methode_identification,
       (select username from public.employees where id = m.employee_id) as responsable_operationnel,
       (select username from public.employees where id = m.created_by)  as auteur_de_la_saisie,
       m.employee_id = m.created_by as l_employe_est_son_propre_auteur_attendu_t,
       m.effective_at as date_d_effet_reprise_de_l_ouverture_du_quart,
       m.source is null as source_laissee_vide_attendu_t
from public.fdj_stock_movements m
where m.shift_id = '00000001-0000-4000-8000-000000000001'
  and m.created_by = 'eeeeeee1-0000-4000-8000-eeeeeeeeeee1';

do $$
declare n int;
begin
  select count(*) into n from public.fdj_stock_movements
   where shift_id = '00000001-0000-4000-8000-000000000001'
     and created_by = 'eeeeeee1-0000-4000-8000-eeeeeeeeeee1';
  if n <> 1 then
    raise exception 'ECHEC DE LA PREUVE P21.7 (1 bis) : % ligne(s) apres deux appels identiques — l idempotence ne tient pas', n;
  end if;
  raise notice 'P21.7 (1 bis) OK — deux appels au meme jeton, une seule ligne de mouvement';
end $$;

-- ---------------------------------------------------------------------------
-- (2) Reconstitution manageriale sur le quart d un autre : le responsable
--     reste l employe du quart, l auteur devient le manager.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
                  '{"sub":"eeeeeee3-0000-4000-8000-eeeeeeeeeee3","role":"authenticated"}', true)
       is not null as identite_manager;
set local role authenticated;

select 'P21.7 (2)' as preuve,
       public.fdj_activer_carnet(
         '00000001-0000-4000-8000-000000000001',
         '00000003-0000-4000-8000-000000000002',
         2, 'reconstituee_correction_manager', 'jeton-p217-reconstitution-manager',
         'Carnet active en fin de quart, saisi le lendemain par le manager') - 'mouvement_id'::text as resultat;

-- (2 bis) La meme voie en negatif : une correction manageriale qui annule.
select 'P21.7 (2 bis)' as preuve,
       public.fdj_activer_carnet(
         '00000001-0000-4000-8000-000000000001',
         '00000003-0000-4000-8000-000000000002',
         -2, 'reconstituee_correction_manager', 'jeton-p217-annulation-manager',
         'Annulation de l activation reconstituee') - 'mouvement_id'::text as resultat_de_la_correction;

-- (2 ter) La cle d idempotence n est pas forgeable. Le manager rejoue ici
--         EXACTEMENT les parametres de l appel (1) — meme quart, meme jeu,
--         meme methode, meme jeton — et obtient une ligne nouvelle, non un
--         rejeu silencieux : auth.uid() entre dans le condensat. Sans cela,
--         connaitre le jeton d autrui suffirait a etouffer son ecriture.
select 'P21.7 (2 ter)' as preuve,
       public.fdj_activer_carnet(
         '00000001-0000-4000-8000-000000000001',
         '00000003-0000-4000-8000-000000000001',
         3, 'quantite', 'jeton-p217-activation-employe') - 'mouvement_id'::text as resultat_meme_jeton_autre_acteur;

reset role;

select 'P21.7 (2) controle' as preuve, m.type_mouvement, m.quantite, m.methode_identification,
       (select username from public.employees where id = m.employee_id) as responsable_operationnel,
       (select username from public.employees where id = m.created_by)  as auteur_de_la_saisie,
       m.employee_id = 'eeeeeee1-0000-4000-8000-eeeeeeeeeee1' as responsable_reste_l_employe_du_quart_attendu_t,
       m.created_by  = 'eeeeeee3-0000-4000-8000-eeeeeeeeeee3' as auteur_est_le_manager_attendu_t
from public.fdj_stock_movements m
where m.created_by = 'eeeeeee3-0000-4000-8000-eeeeeeeeeee3'
  and m.methode_identification in ('quantite', 'reconstituee_correction_manager')
order by m.methode_identification, m.quantite;

do $$
declare n_total int; n_auteurs int;
begin
  -- Le filtre de forme ecarte le mouvement d historique pose en SECTION 0, qui
  -- porte lui aussi la methode `quantite` sur ce quart : on ne compte ici que
  -- ce que les commandes ont ecrit.
  select count(*), count(distinct created_by) into n_total, n_auteurs
    from public.fdj_stock_movements
   where shift_id = '00000001-0000-4000-8000-000000000001'
     and methode_identification = 'quantite'
     and id::text !~ '^([0-9a-f])\1{6}[0-9a-f]-0000-4000-8000-';
  if n_total <> 2 or n_auteurs <> 2 then
    raise exception 'ECHEC DE LA PREUVE P21.7 (2 ter) : % ligne(s) pour % auteur(s), deux et deux attendus — la cle d idempotence serait forgeable', n_total, n_auteurs;
  end if;
  raise notice 'P21.7 (2 ter) OK — le meme jeton joue par un autre acteur n etouffe pas l ecriture du premier';
end $$;

-- ---------------------------------------------------------------------------
-- (3) Mouvement de gestion manager : reception au bureau, puis reapprovision-
--     nement de la caisse. Hors quart : shift_id reste NULL.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
                  '{"sub":"eeeeeee3-0000-4000-8000-eeeeeeeeeee3","role":"authenticated"}', true)
       is not null as identite_manager_gestion;
set local role authenticated;

select 'P21.7 (3)' as preuve,
       public.fdj_enregistrer_mouvement_stock(
         'reception',
         '[{"game_id":"00000003-0000-4000-8000-000000000001","quantite":10},
           {"game_id":"00000003-0000-4000-8000-000000000002","quantite":4}]'::jsonb,
         'jeton-p217-reception', 'Livraison hebdomadaire (recette)', 'recette-vague1')
       - 'mouvement_ids'::text as resultat_reception;

-- (3 bis) Idempotence d un lot entier : deux lignes rejouees, zero ecriture.
select 'P21.7 (3 bis)' as preuve,
       public.fdj_enregistrer_mouvement_stock(
         'reception',
         '[{"game_id":"00000003-0000-4000-8000-000000000001","quantite":10},
           {"game_id":"00000003-0000-4000-8000-000000000002","quantite":4}]'::jsonb,
         'jeton-p217-reception', 'Livraison hebdomadaire (recette)', 'recette-vague1')
       - 'mouvement_ids'::text as resultat_du_rejeu;

-- (3 ter) Transfert bureau vers caisse.
select 'P21.7 (3 ter)' as preuve,
       public.fdj_enregistrer_mouvement_stock(
         'reappro_caisse',
         '[{"game_id":"00000003-0000-4000-8000-000000000001","quantite":6}]'::jsonb,
         'jeton-p217-reappro', null, 'recette-vague1')
       - 'mouvement_ids'::text as resultat_reappro;

reset role;

select 'P21.7 (3) controle' as preuve, m.type_mouvement, m.quantite, m.source,
       (select l.nom from public.fdj_locations l where l.id = m.location_source_id)      as depuis,
       (select l.nom from public.fdj_locations l where l.id = m.location_destination_id) as vers,
       (select username from public.employees where id = m.employee_id) as responsable_operationnel,
       (select username from public.employees where id = m.created_by)  as auteur_de_la_saisie,
       m.shift_id is null as mouvement_hors_quart_attendu_t
from public.fdj_stock_movements m
where m.source = 'recette-vague1'
order by m.type_mouvement, m.quantite desc;

-- ---------------------------------------------------------------------------
-- (4) Les refus. Chacun est encadre : si l appel passait, le `raise exception`
--     de la ligne suivante porterait l errcode P0001, que le handler cible ne
--     rattrape pas — la garde mord.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
                  '{"sub":"eeeeeee1-0000-4000-8000-eeeeeeeeeee1","role":"authenticated"}', true)
       is not null as identite_employe_a_pour_les_refus;
set local role authenticated;

do $$
declare v_msg text;
begin
  begin
    perform public.fdj_activer_carnet('00000001-0000-4000-8000-000000000001',
      '00000003-0000-4000-8000-000000000001', 1, 'reconstituee_correction_manager', 'jeton-p217-refus-a');
    raise exception 'ECHEC DE LA PREUVE P21.7 (4.1) : un employe a pu reconstituer une correction manageriale';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P21.7 (4.1) OK — refus attendu : %', v_msg;
  end;

  begin
    perform public.fdj_enregistrer_mouvement_stock('reception',
      '[{"game_id":"00000003-0000-4000-8000-000000000001","quantite":1}]'::jsonb, 'jeton-p217-refus-b');
    raise exception 'ECHEC DE LA PREUVE P21.7 (4.2) : un employe a pu enregistrer un mouvement de gestion';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P21.7 (4.2) OK — refus attendu : %', v_msg;
  end;

  begin
    perform public.fdj_activer_carnet('00000001-0000-4000-8000-000000000001',
      '00000003-0000-4000-8000-000000000001', -1, 'quantite', 'jeton-p217-refus-c');
    raise exception 'ECHEC DE LA PREUVE P21.7 (4.3) : une quantite negative est passee hors correction manageriale';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P21.7 (4.3) OK — refus attendu : %', v_msg;
  end;

  begin
    perform public.fdj_activer_carnet('00000001-0000-4000-8000-000000000002',
      '00000003-0000-4000-8000-000000000001', 1, 'quantite', 'jeton-p217-refus-d');
    raise exception 'ECHEC DE LA PREUVE P21.7 (4.4) : un employe a pu activer sur le quart d un collegue';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P21.7 (4.4) OK — refus attendu : %', v_msg;
  end;

  begin
    perform public.fdj_activer_carnet('00000001-0000-4000-8000-000000000001',
      '00000003-0000-4000-8000-000000000001', 1, 'quantite', '   ');
    raise exception 'ECHEC DE LA PREUVE P21.7 (4.5) : un appel sans jeton a ete accepte';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P21.7 (4.5) OK — refus attendu : %', v_msg;
  end;

  begin
    perform public.fdj_activer_carnet('00000001-0000-4000-8000-000000000001',
      '00000003-0000-4000-8000-000000000001', 0, 'quantite', 'jeton-p217-refus-f');
    raise exception 'ECHEC DE LA PREUVE P21.7 (4.6) : une activation de quantite nulle a ete acceptee';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P21.7 (4.6) OK — refus attendu : %', v_msg;
  end;
end $$;

reset role;

select set_config('request.jwt.claims',
                  '{"sub":"eeeeeee3-0000-4000-8000-eeeeeeeeeee3","role":"authenticated"}', true)
       is not null as identite_manager_pour_les_refus;
set local role authenticated;

do $$
declare v_msg text;
begin
  begin
    perform public.fdj_enregistrer_mouvement_stock('inventaire_sauvage',
      '[{"game_id":"00000003-0000-4000-8000-000000000001","quantite":1}]'::jsonb, 'jeton-p217-refus-g');
    raise exception 'ECHEC DE LA PREUVE P21.7 (4.7) : une operation inconnue a ete acceptee';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P21.7 (4.7) OK — refus attendu : %', v_msg;
  end;

  -- 4.8 : l emplacement est volontairement valide, sinon c est la garde
  -- d emplacement qui repondrait et le motif ne serait jamais examine.
  begin
    perform public.fdj_enregistrer_mouvement_stock('blocage',
      '[{"game_id":"00000003-0000-4000-8000-000000000001","quantite":1}]'::jsonb, 'jeton-p217-refus-h',
      p_emplacement_source => 'bureau');
    raise exception 'ECHEC DE LA PREUVE P21.7 (4.8) : un blocage sans motif a ete accepte';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P21.7 (4.8) OK — refus attendu : %', v_msg;
  end;

  begin
    perform public.fdj_enregistrer_mouvement_stock('blocage',
      '[{"game_id":"00000003-0000-4000-8000-000000000001","quantite":1}]'::jsonb, 'jeton-p217-refus-i',
      p_motif => 'Carnets abimes', p_emplacement_source => 'reserve');
    raise exception 'ECHEC DE LA PREUVE P21.7 (4.9) : un emplacement de blocage inconnu a ete accepte';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P21.7 (4.9) OK — refus attendu : %', v_msg;
  end;

  begin
    perform public.fdj_enregistrer_mouvement_stock('reception',
      '[{"game_id":"00000003-0000-4000-8000-000000000001","quantite":1}]'::jsonb, 'jeton-p217-refus-j',
      p_effective_at => now() + interval '1 day');
    raise exception 'ECHEC DE LA PREUVE P21.7 (4.10) : une date d effet dans le futur a ete acceptee';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P21.7 (4.10) OK — refus attendu : %', v_msg;
  end;

  begin
    perform public.fdj_enregistrer_mouvement_stock('reception',
      '[{"game_id":"00000003-0000-4000-8000-000000000001","quantite":0}]'::jsonb, 'jeton-p217-refus-k');
    raise exception 'ECHEC DE LA PREUVE P21.7 (4.11) : une ligne sans quantite positive a ete acceptee';
  exception when invalid_parameter_value then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P21.7 (4.11) OK — refus attendu : %', v_msg;
  end;
end $$;

reset role;

-- 4.12 : aucune session. Les claims sont poses SANS cle `sub`, ce qui rend
-- auth.uid() NULL sans erreur de cast ; le role reste `authenticated`, de sorte
-- que ce soit bien la garde de la commande qui reponde, et non un simple defaut
-- de droit d execution.
select set_config('request.jwt.claims', '{"role":"anon"}', true)
       is not null as aucune_session_simulee;
set local role authenticated;

do $$
declare v_msg text;
begin
  begin
    perform public.fdj_activer_carnet('00000001-0000-4000-8000-000000000001',
      '00000003-0000-4000-8000-000000000001', 1, 'quantite', 'jeton-p217-refus-l');
    raise exception 'ECHEC DE LA PREUVE P21.7 (4.12) : une activation a ete acceptee sans session authentifiee';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    raise notice 'P21.7 (4.12) OK — refus attendu : %', v_msg;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '{}', true) is not null as identite_rendue;

-- ---------------------------------------------------------------------------
-- (5) Bilan de ce que les commandes ont ecrit. Le filtre porte sur la forme de
--     l identifiant : les lignes posees a la main par la recette ont un id de
--     forme fixture, celles ecrites par les commandes portent un
--     gen_random_uuid(). Aucune liste tenue a la main.
-- ---------------------------------------------------------------------------
select 'P21.7 (5)' as bilan, m.type_mouvement, m.methode_identification,
       count(*) as lignes, sum(m.quantite) as quantite_totale,
       (select username from public.employees where id = m.employee_id) as responsable_operationnel,
       (select username from public.employees where id = m.created_by)  as auteur_de_la_saisie
from public.fdj_stock_movements m
where m.id::text !~ '^([0-9a-f])\1{6}[0-9a-f]-0000-4000-8000-'
group by m.type_mouvement, m.methode_identification, m.employee_id, m.created_by
order by m.type_mouvement, m.methode_identification;

do $$
declare n_lignes int; n_dissocies int; n_incoherents int;
begin
  with ecrites as (
    select m.employee_id, m.created_by, m.shift_id,
           (select s.employee_id from public.fdj_shifts s where s.id = m.shift_id) as titulaire
      from public.fdj_stock_movements m
     where m.id::text !~ '^([0-9a-f])\1{6}[0-9a-f]-0000-4000-8000-'
  )
  select count(*),
         count(*) filter (where employee_id is distinct from created_by),
         count(*) filter (where shift_id is not null and employee_id is distinct from titulaire)
    into n_lignes, n_dissocies, n_incoherents
    from ecrites;

  if n_lignes = 0 then
    raise exception 'ECHEC DE LA PREUVE P21.7 (5) : aucune ligne ecrite par les commandes — la preuve d execution est vide';
  end if;
  if n_dissocies = 0 then
    raise exception 'ECHEC DE LA PREUVE P21.7 (5) : aucune ligne ou l auteur differe du responsable — la dissociation n est pas eprouvee';
  end if;
  if n_incoherents > 0 then
    raise exception 'ECHEC DE LA PREUVE P21.7 (5) : % ligne(s) rattachee(s) a un quart dont le responsable n est pas le titulaire', n_incoherents;
  end if;
  raise notice 'P21.7 (5) OK — % lignes ecrites par les commandes, dont % ou l auteur n est pas le responsable ; aucun rattachement de quart incoherent', n_lignes, n_dissocies;
end $$;

-- Et le journal : chaque ecriture a laisse une trace nominative.
select 'P21.7 (6)' as preuve, a.action, count(*) as lignes_de_journal,
       (select username from public.employees where id = a.acteur_id) as acteur
from public.fdj_audit_log a
group by a.action, a.acteur_id
order by a.action;

\echo ''
\echo '############################################################'
\echo '#  BILAN AVANT ANNULATION                                   #'
\echo '############################################################'

select 'BILAN' as bilan,
       (select count(*) from public.fdj_shifts)              as quarts,
       (select count(*) from public.fdj_cash_controls)        as caisses,
       (select count(*) from public.fdj_stock_movements)      as mouvements,
       (select count(*) from public.fdj_booklets)             as livrets,
       (select count(*) from public.fdj_caisse_evenements)    as evenements_caisse_attendu_0,
       (select count(*) from public.fdj_demandes_correction)  as demandes_attendu_0;

\echo ''
\echo '##############################################################'
\echo '#  CONTROLE D IDENTITE — aucun employe reel dans la recette   #'
\echo '##############################################################'
-- Ce controle ne connait aucune valeur. Il ne connait qu une FORME :
--
--   ^([0-9a-f])\1{6}[0-9a-f]-0000-4000-8000-([0-9a-f])\2{10}[0-9a-f]$
--
-- sept chiffres hexadecimaux identiques puis un libre, variante 4 et variant
-- 8 figes, onze chiffres identiques puis un libre. Un uuid v4 tire au hasard
-- n a aucune chance pratique de la satisfaire. C est ce qui fait qu aucune
-- liste d autorisation n est necessaire ici — et surtout qu aucun identifiant
-- reel ne pourrait y etre blanchi en l y inscrivant.
--
-- Il balaie les colonnes uuid d IDENTITE, celles qui designent un employe :
-- employee_id, manager_id, acteur_id, auteur, demandeur, responsable,
-- valide_par, controle_par, saisi_par, cloture_par, created_by, confirmed_by,
-- traite_par, override_manager_id — plus employees.id lui-meme — sur toutes
-- les tables fdj_*, shifts et employees. Les identifiants de lignes engendres
-- par le serveur (gen_random_uuid()) ne sont volontairement pas soumis a la
-- regle : ce sont des cles techniques, pas des identites.
--
-- Pour les tables qui n etaient PAS vides au depart — instantane etat_initial
-- pris avant la premiere ecriture — il ne regarde que les lignes posees par la
-- recette, reconnues a leur id de forme fixture. Ailleurs il regarde tout, y
-- compris ce qu ont ecrit les commandes serveur.
--
-- Les jetons simules sont couverts par ricochet : une commande serveur inscrit
-- auth.uid() dans fdj_audit_log.acteur_id ou dans le journal de caisse, et un
-- jeton portant un identifiant reel y laisserait sa trace. Les jetons de
-- simple consultation, qui n ecrivent rien, sont couverts hors base par
-- test_recette_vague1_identifiants_synthetiques_20260917.js.
--
-- Deux garde-fous ferment la porte au controle qui ne controle rien : moins de
-- douze colonnes balayees, ou zero valeur vue, et il echoue.
-- Ce controle doit voir TOUTES les lignes. Sous le role authenticated la RLS
-- en masquerait une partie, et le balayage serait vert pour la plus mauvaise
-- des raisons : parce qu il n aurait rien vu. D ou le retour au role de
-- session, et la verification que ce retour a bien eu lieu.
reset role;
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'IDENTITE : le controle tourne sous le role % et non postgres — la RLS le rendrait aveugle', current_user;
  end if;
end $$;

do $$
declare
  forme constant text := '^([0-9a-f])\1{6}[0-9a-f]-0000-4000-8000-([0-9a-f])\2{10}[0-9a-f]$';
  r record; n bigint; vus bigint; cols int := 0; total bigint := 0;
begin
  for r in
    select c.table_name as tab, c.column_name as col,
           coalesce((select e.n from etat_initial e where e.tab = c.table_name), 0) as n0,
           exists (select 1 from information_schema.columns i
                    where i.table_schema = 'public' and i.table_name = c.table_name
                      and i.column_name = 'id' and i.udt_name = 'uuid') as a_id
      from information_schema.columns c
      join information_schema.tables x
        on x.table_schema = c.table_schema and x.table_name = c.table_name
       and x.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.udt_name = 'uuid'
       and (c.table_name like 'fdj\_%' or c.table_name in ('shifts','employees'))
       and (c.column_name ~ '(employee|manager|acteur|auteur|demandeur|responsable|valide_par|controle_par|saisi_par|cloture_par|created_by|confirmed_by|traite_par)'
            or (c.table_name = 'employees' and c.column_name = 'id'))
     order by c.table_name, c.column_name
  loop
    if r.n0 > 0 and not r.a_id then
      raise exception 'IDENTITE : %.% appartient a une table deja peuplee et sans id uuid — le controle ne sait pas isoler les lignes de la recette', r.tab, r.col;
    end if;
    execute format(
      'select count(*) filter (where %2$I is not null and %2$I::text !~ %3$L), count(%2$I) from public.%1$I %4$s',
      r.tab, r.col, forme,
      case when r.n0 > 0 then format('where id::text ~ %L', forme) else '' end)
      into n, vus;
    if n > 0 then
      raise exception 'IDENTITE : %.% porte % identifiant(s) qui ne sont pas de forme fixture', r.tab, r.col, n;
    end if;
    cols  := cols + 1;
    total := total + vus;
  end loop;
  if cols < 12 then
    raise exception 'IDENTITE : % colonne(s) seulement balayee(s) — le controle a rate sa cible', cols;
  end if;
  if total = 0 then
    raise exception 'IDENTITE : aucune valeur controlee — le controle est vide';
  end if;
  raise notice 'IDENTITE OK : % colonnes d identite balayees, % valeurs vues, toutes de forme fixture', cols, total;
end $$;

rollback;

\echo ''
\echo '############################################################'
\echo '#  APRES ROLLBACK — nexus-test est revenu a son etat initial #'
\echo '############################################################'

select 'POST-ROLLBACK' as controle,
       (select count(*) from public.fdj_shifts)          as fdj_shifts_attendu_0,
       (select count(*) from public.fdj_cash_controls)   as fdj_cash_controls_attendu_0,
       (select count(*) from public.fdj_stock_movements) as fdj_stock_movements_attendu_0,
       (select count(*) from public.fdj_booklets)        as fdj_booklets_attendu_0,
       (select count(*) from public.fdj_games where site = 'nexus-station-test') as jeux_historiques_attendu_0,
       to_regclass('public.fdj_caisse_evenements') is null as journal_caisse_disparu,
       not exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name='fdj_stock_movements'
                     and column_name='effective_at') as colonne_effective_at_disparue,
       (select count(*) from supabase_migrations.schema_migrations where version like '2026091622%') as migrations_enregistrees_attendu_0,
       (select count(*) from public.employees)                                          as employes_attendu_4,
       (select count(*) from public.fdj_locations)                                      as fdj_locations_attendu_3;

-- Et la demonstration qu aucune fixture ne subsiste. Ce balayage ne cherche
-- aucune valeur connue : il cherche la FORME, sur TOUTES les colonnes uuid du
-- schema public — pas seulement celles que la recette a touchees — et exige
-- qu aucune ligne n en porte plus une seule. Il leve, il n imprime pas : une
-- preuve qui se contente d afficher un compteur se lit en diagonale.
do $$
declare
  forme constant text := '^([0-9a-f])\1{6}[0-9a-f]-0000-4000-8000-([0-9a-f])\2{10}[0-9a-f]$';
  r record; n bigint; cols int := 0; restes bigint := 0; ou text := '';
begin
  for r in
    select c.table_name as tab, c.column_name as col
      from information_schema.columns c
      join information_schema.tables x
        on x.table_schema = c.table_schema and x.table_name = c.table_name
       and x.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.udt_name = 'uuid'
     order by 1, 2
  loop
    execute format('select count(*) from public.%I where %I::text ~ %L', r.tab, r.col, forme) into n;
    cols := cols + 1;
    if n > 0 then
      restes := restes + n;
      ou := ou || format(' %s.%s=%s', r.tab, r.col, n);
    end if;
  end loop;
  if cols < 100 then
    raise exception 'POST-ROLLBACK : % colonne(s) uuid seulement balayee(s) — le balayage a rate sa cible', cols;
  end if;
  if restes > 0 then
    raise exception 'POST-ROLLBACK : % ligne(s) de forme fixture subsistent :%', restes, ou;
  end if;
  raise notice 'POST-ROLLBACK OK : % colonnes uuid du schema public balayees, aucune fixture ne subsiste', cols;
end $$;

\echo ''
\echo '============================================================'
\echo '=  RECETTE TERMINEE — TRANSACTION ANNULEE                   ='
\echo '=  Aucune migration appliquee, aucune donnee conservee.     ='
\echo '============================================================'
