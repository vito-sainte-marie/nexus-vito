-- =============================================================================
-- RECETTE — preuves 10.5 (livrets et mouvements) et 10.6 (donnees existantes)
-- Mandat « Refonte FDJ, Vague 1 », §10.5 et §10.6.
-- A jouer sur nexus-test UNIQUEMENT. Le fichier se termine par rollback;.
--
-- Ce fichier est AUTO-PORTANT : il charge lui-meme les neuf migrations de la
-- Phase A par \ir, entre la pose de l historique et les preuves. C est la
-- difference avec 20260917_preuves_cycle_caisse.sql, qui suppose les migrations
-- deja chargees : ici, l ORDRE est le sujet meme de la preuve. On ne peut pas
-- montrer ce qu une migration fait a des donnees existantes si les donnees
-- n existent pas avant elle.
--
-- Lancement :
--   PGPASSWORD="$(security find-generic-password -a nexus -s nexus-test-db -w)" \
--   PGCONNECT_TIMEOUT=20 /opt/homebrew/opt/libpq/bin/psql \
--     "postgresql://postgres@db.udljdqxerrbbbajxubfn.supabase.co:5432/postgres?sslmode=require" \
--     -v ON_ERROR_STOP=1 -q -f supabase/recette-vague1/20260917_preuves_livrets_et_historique.sql
-- =============================================================================

\set ON_ERROR_STOP on
begin;

\echo ''
\echo '############################################################'
\echo '#  P22.0 — LA CONDITION DE VALIDITE DE LA PHASE A          #'
\echo '############################################################'
-- Le dossier (section 5.7) justifie d avoir corrige deux migrations EN PLACE
-- plutot que d empiler une migration de rattrapage, au motif qu aucune des neuf
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

create temporary table ctx (cle text primary key, val text);
insert into ctx values
  ('emp_a',   '868d0b92-bf65-4c99-be43-656911919afd'),
  ('emp_b',   '755a2dc5-3390-4a29-a865-847cbebc1133'),
  ('manager', '28810f30-8182-4126-920f-051a4c7cb596'),
  ('site',    'nexus-station-test'),
  ('loc_bureau', 'e9851de4-e647-45b5-b685-3a7d33da9834'),
  ('loc_caisse', 'e3864f8f-a300-454c-9665-099cf719ac32');

insert into public.fdj_games (id, site, nom, prix, ordre_affichage) values
  ('00000003-0000-4000-8000-000000000001','nexus-station-test','JEU HISTORIQUE 2 EUROS',2.00,1),
  ('00000003-0000-4000-8000-000000000002','nexus-station-test','JEU HISTORIQUE 10 EUROS',10.00,2);

-- Neuf quarts historiques. Rappel de vocabulaire, qui compte pour lire la
-- suite : dans fdj_shifts.statut, 'valide' signifie « transmis par l employe »
-- et n a jamais voulu dire « valide par le manager ».
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut, ouvert_le, valide_le, created_at) values
  ('00000001-0000-4000-8000-000000000001','nexus-station-test','2026-08-01','1','868d0b92-bf65-4c99-be43-656911919afd','valide',   '2026-08-01 12:00:00+00', null,                     '2026-08-01 12:00:00+00'),
  ('00000001-0000-4000-8000-000000000002','nexus-station-test','2026-08-01','2','755a2dc5-3390-4a29-a865-847cbebc1133','valide',   '2026-08-01 21:00:00+00','2026-08-02 08:00:00+00','2026-08-01 21:00:00+00'),
  ('00000001-0000-4000-8000-000000000003','nexus-station-test','2026-08-02','1','868d0b92-bf65-4c99-be43-656911919afd','valide',   '2026-08-02 12:00:00+00', null,                     '2026-08-02 12:00:00+00'),
  ('00000001-0000-4000-8000-000000000004','nexus-station-test','2026-08-02','2','755a2dc5-3390-4a29-a865-847cbebc1133','valide',   '2026-08-02 21:00:00+00','2026-08-03 08:30:00+00','2026-08-02 21:00:00+00'),
  ('00000001-0000-4000-8000-000000000005','nexus-station-test','2026-08-03','1','868d0b92-bf65-4c99-be43-656911919afd','valide',   '2026-08-03 12:00:00+00', null,                     '2026-08-03 12:00:00+00'),
  ('00000001-0000-4000-8000-000000000006','nexus-station-test','2026-08-03','2','755a2dc5-3390-4a29-a865-847cbebc1133','valide',   '2026-08-03 21:00:00+00','2026-08-04 09:00:00+00','2026-08-03 21:00:00+00'),
  ('00000001-0000-4000-8000-000000000007','nexus-station-test','2026-08-04','1','868d0b92-bf65-4c99-be43-656911919afd','valide',   '2026-08-04 12:00:00+00','2026-08-05 08:00:00+00','2026-08-04 12:00:00+00'),
  ('00000001-0000-4000-8000-000000000008','nexus-station-test','2026-08-04','2','755a2dc5-3390-4a29-a865-847cbebc1133','valide',   '2026-08-04 21:00:00+00','2026-08-05 09:00:00+00','2026-08-04 21:00:00+00'),
  ('00000001-0000-4000-8000-000000000009','nexus-station-test','2026-08-05','1','868d0b92-bf65-4c99-be43-656911919afd','brouillon','2026-08-05 12:00:00+00', null,                     '2026-08-05 12:00:00+00');

-- Huit caisses, une par statut historique autorise par l ancienne CHECK.
-- La ligne 3 porte volontairement un valide_le SANS valide_par : c est le cas
-- qui rend la contrainte de coherence de la Vague 1 impossible a valider
-- immediatement, et c est pourquoi elle est posee NOT VALID.
insert into public.fdj_cash_controls
  (id, site, shift_id, caisse_attendue, caisse_reelle, ecart, statut, valide_par, valide_le, created_at, updated_at, resultat_controle, motif_ecart_texte) values
  ('00000002-0000-4000-8000-000000000001','nexus-station-test','00000001-0000-4000-8000-000000000001', 500.00, 500.00,   0.00,'provisoire',       null,                                  null,                    '2026-08-01 20:00:00+00','2026-08-01 20:00:00+00', null,           null),
  ('00000002-0000-4000-8000-000000000002','nexus-station-test','00000001-0000-4000-8000-000000000002', 610.00, 610.00,   0.00,'conforme',         '28810f30-8182-4126-920f-051a4c7cb596','2026-08-02 08:00:00+00','2026-08-01 23:00:00+00','2026-08-02 08:00:00+00','conforme',     'Controle sans remarque.'),
  ('00000002-0000-4000-8000-000000000003','nexus-station-test','00000001-0000-4000-8000-000000000003', 480.00, 443.00, -37.00,'a_regulariser',    null,                                  '2026-08-03 07:45:00+00','2026-08-02 20:00:00+00','2026-08-03 07:45:00+00','a_regulariser','Manquant constate au controle. Note interne manager.'),
  ('00000002-0000-4000-8000-000000000004','nexus-station-test','00000001-0000-4000-8000-000000000004', 520.00, 534.00,  14.00,'valide_avec_ecart','28810f30-8182-4126-920f-051a4c7cb596','2026-08-03 08:30:00+00','2026-08-02 23:00:00+00','2026-08-03 08:30:00+00','avec_ecart',   'Excedent, origine non identifiee.'),
  ('00000002-0000-4000-8000-000000000005','nexus-station-test','00000001-0000-4000-8000-000000000005', 455.00, 454.00,  -1.00,'a_controler',      null,                                  null,                    '2026-08-03 20:00:00+00','2026-08-03 20:00:00+00', null,           null),
  ('00000002-0000-4000-8000-000000000006','nexus-station-test','00000001-0000-4000-8000-000000000006', 610.00, 607.00,  -3.00,'en_attente',       null,                                  null,                    '2026-08-03 23:00:00+00','2026-08-03 23:00:00+00', null,           null),
  ('00000002-0000-4000-8000-000000000007','nexus-station-test','00000001-0000-4000-8000-000000000007', 505.00, 503.00,  -2.00,'expliquee',        null,                                  null,                    '2026-08-04 20:00:00+00','2026-08-04 20:00:00+00', null,           'Explication fournie, non tranchee.'),
  ('00000002-0000-4000-8000-000000000008','nexus-station-test','00000001-0000-4000-8000-000000000008', 600.00, 599.00,  -1.00,'regularise',       '28810f30-8182-4126-920f-051a4c7cb596','2026-08-05 09:00:00+00','2026-08-04 23:00:00+00','2026-08-05 09:00:00+00','a_regulariser','Regularise au quart suivant.');

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
  ('00000004-0000-4000-8000-000000000001','nexus-station-test','00000003-0000-4000-8000-000000000001','reception', 10, null,                                   'e9851de4-e647-45b5-b685-3a7d33da9834','868d0b92-bf65-4c99-be43-656911919afd','2026-08-01 12:30:00+00','00000001-0000-4000-8000-000000000001','quantite','historique','11111111-0000-4000-8000-000000000001'),
  ('00000004-0000-4000-8000-000000000002','nexus-station-test','00000003-0000-4000-8000-000000000001','transfert',  5, 'e9851de4-e647-45b5-b685-3a7d33da9834','e3864f8f-a300-454c-9665-099cf719ac32','755a2dc5-3390-4a29-a865-847cbebc1133','2026-08-01 21:15:00+00','00000001-0000-4000-8000-000000000002','quantite','historique','11111111-0000-4000-8000-000000000002'),
  ('00000004-0000-4000-8000-000000000003','nexus-station-test','00000003-0000-4000-8000-000000000002','activation', 1, 'e3864f8f-a300-454c-9665-099cf719ac32', null,                                  '868d0b92-bf65-4c99-be43-656911919afd','2026-08-02 13:00:00+00','00000001-0000-4000-8000-000000000003','scan',    'historique', null),
  ('00000004-0000-4000-8000-000000000004','nexus-station-test','00000003-0000-4000-8000-000000000002','activation', 1, 'e3864f8f-a300-454c-9665-099cf719ac32', null,                                  '755a2dc5-3390-4a29-a865-847cbebc1133','2026-08-02 22:00:00+00','00000001-0000-4000-8000-000000000004','scan',    'historique', null),
  ('00000004-0000-4000-8000-000000000005','nexus-station-test','00000003-0000-4000-8000-000000000001','correction', 2, null,                                   'e9851de4-e647-45b5-b685-3a7d33da9834','868d0b92-bf65-4c99-be43-656911919afd','2026-08-03 14:00:00+00','00000001-0000-4000-8000-000000000005','saisie_manuelle','historique', null);

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

select 'SECTION 0' as etape,
       (select count(*) from public.fdj_shifts)          as quarts_historiques,
       (select count(*) from public.fdj_cash_controls)   as caisses_historiques,
       (select count(*) from public.fdj_stock_movements) as mouvements_historiques,
       (select count(*) from public.fdj_booklets)        as livrets_attendu_0,
       (select count(*) from empreinte_avant)            as lignes_sous_empreinte;

\echo ''
\echo '############################################################'
\echo '#  LES NEUF MIGRATIONS DE LA PHASE A, DANS L ORDRE          #'
\echo '############################################################'

\ir ../migrations/20260916220000_fdj_quart_relie_a_la_prise_de_poste.sql
\ir ../migrations/20260916220100_fdj_caisse_cycle_de_vie_colonnes.sql
\ir ../migrations/20260916220200_fdj_caisse_journal_evenements.sql
\ir ../migrations/20260916220300_fdj_demandes_correction_apres_validation.sql
\ir ../migrations/20260916220400_fdj_mouvements_auteur_et_date_effet.sql
\ir ../migrations/20260916220500_fdj_commande_ouverture_quart.sql
\ir ../migrations/20260916220600_fdj_commandes_caisse_employe.sql
\ir ../migrations/20260916220700_fdj_commandes_caisse_manager.sql
\ir ../migrations/20260916220800_fdj_projection_employe.sql

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
  values ('00000002-0000-4000-8000-0000000000ff','nexus-station-test',
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
   'transfert', 3, 'e9851de4-e647-45b5-b685-3a7d33da9834','e3864f8f-a300-454c-9665-099cf719ac32',
   '868d0b92-bf65-4c99-be43-656911919afd',            -- responsable operationnel : A
   '28810f30-8182-4126-920f-051a4c7cb596',            -- auteur de la saisie : le manager
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
          'transfert', 3, 'e3864f8f-a300-454c-9665-099cf719ac32','868d0b92-bf65-4c99-be43-656911919afd',
          '28810f30-8182-4126-920f-051a4c7cb596', now(),'saisie_manuelle','saisie_differee_manager',
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
          'reception', 1,'e9851de4-e647-45b5-b685-3a7d33da9834','868d0b92-bf65-4c99-be43-656911919afd',
          '28810f30-8182-4126-920f-051a4c7cb596',
          '2026-09-20 12:00:00+00', '2026-09-17 03:00:00+00','quantite','saisie_differee_manager');
  raise notice 'P21.5 ECHEC DE LA PREUVE : une date d effet posterieure de trois jours a ete acceptee';
exception when check_violation then
  raise notice 'P21.5 date d effet absurde refusee, comme attendu : % (%)', sqlerrm, sqlstate;
end $$;
rollback to savepoint p215;

\echo ''
\echo '############################################################'
\echo '#  P21.6 — AUCUNE ACTIVATION, AUCUN MOUVEMENT REEL          #'
\echo '############################################################'
-- « Aucune activation ni aucun mouvement reel ne doit etre cree pendant cette
-- mission » (§6). Deux verifications de nature differente.
--
-- (a) Constat : la vague n a touche aucun livret.
select 'P21.6 (a)' as preuve,
       (select count(*) from public.fdj_booklets) as livrets_attendu_0,
       (select count(*) from public.fdj_stock_movements where source = 'historique') as mouvements_du_jeu_historique,
       (select count(*) from public.fdj_stock_movements where source <> 'historique') as mouvements_crees_par_la_recette;

-- (b) Argument structurel : AUCUNE des fonctions creees par les neuf migrations
--     n ecrit dans fdj_stock_movements ni dans fdj_booklets. Ce n est pas une
--     promesse de comportement, c est une propriete de leur code source, et la
--     liste des fonctions n est pas recopiee a la main : c est la difference
--     entre l etat d avant et l etat d apres.
select 'P21.6 (b)' as preuve,
       count(*) as fonctions_ajoutees_par_la_vague,
       count(*) filter (where p.prosrc ~ 'fdj_stock_movements') as ecrivent_ou_lisent_les_mouvements_attendu_0,
       count(*) filter (where p.prosrc ~ 'fdj_booklets')        as touchent_les_livrets_attendu_0
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.oid not in (select oid from fonctions_avant);

select 'P21.6 (b) detail' as preuve, p.proname,
       case p.provolatile when 's' then 'stable' when 'i' then 'immutable' else 'volatile' end as volatilite
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.oid not in (select oid from fonctions_avant)
order by p.proname;

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
       (select count(*) from supabase_migrations.schema_migrations where version like '2026091622%') as migrations_enregistrees_attendu_0;

\echo ''
\echo '============================================================'
\echo '=  RECETTE TERMINEE — TRANSACTION ANNULEE                   ='
\echo '=  Aucune migration appliquee, aucune donnee conservee.     ='
\echo '============================================================'
