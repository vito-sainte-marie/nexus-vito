-- Une projection qui masque ne masque rien si la table reste lisible à côté.
-- ============================================================================
-- FDJ — Vague 1, PHASE C (« FERMER ») — RLS définitives
--
-- ###########################################################################
-- #  CE FICHIER N'EST PAS DANS supabase/migrations/, ET CE N'EST PAS UN      #
-- #  OUBLI.                                                                  #
-- #                                                                          #
-- #  Le §9 impose ÉTENDRE → BASCULER → FERMER, et de ne fermer qu'« après    #
-- #  preuve que le front servi utilise les nouvelles interfaces ». Un fichier #
-- #  placé dans supabase/migrations/ partirait avec le même `supabase db     #
-- #  push` que la Phase A : il fermerait les accès directs AVANT que le      #
-- #  front basculé soit servi, et l'écran FDJ tomberait au premier           #
-- #  enregistrement. Le tenir hors du dossier des migrations est la seule    #
-- #  façon de garantir qu'il ne s'applique pas par inadvertance.             #
-- #                                                                          #
-- #  IL EST LIVRÉ NON APPLIQUÉ. Ni Test ni Production ne le portent.         #
-- #  Application manuelle et délibérée, avec `psql -f`, après les conditions #
-- #  ci-dessous.                                                             #
-- ###########################################################################
--
-- ---------------------------------------------------------------------------
-- CONDITIONS À VÉRIFIER AVANT DE L'APPLIQUER (toutes, dans cet ordre)
--
--   C1. Les migrations 20260916220000 → 20260916220800 sont appliquées sur
--       l'environnement visé (Phase A), et `supabase migration list` le
--       confirme — le dépôt ne prouve rien, le registre de la base si.
--
--   C2. Le front SERVI est la version Phase B. Production est servie brute par
--       GitHub Pages, sans build : c'est le fichier téléchargé depuis l'URL
--       publique qu'il faut inspecter, pas celui du dépôt. Il ne doit plus
--       contenir aucune de ces écritures directes, relevées le 16/09/2026
--       dans NEXUS-FDJ-v1.html :
--
--         l. 1235, 1435, 2088, 2123   .from('fdj_audit_log').insert(
--         l. 2051                      .from('fdj_reports').upsert(
--         l. 2067                      .from('fdj_cash_controls').upsert(
--         l. 2162                      .from('fdj_releves_cloture').insert(
--         (+ les upserts de fdj_shifts et fdj_shift_counts du même fichier)
--
--       ni ces lectures directes, remplacées par fdj_ma_caisse() :
--
--         l. 796                       .from('fdj_cash_controls').select('*')
--         l. 1682-1683                 .from('fdj_reports').select('*')
--                                      .from('fdj_cash_controls').select('*')
--
--   C3. Un quart complet a été joué de bout en bout sur Test avec ce front :
--       ouverture depuis la prise de poste, brouillon, confirmation,
--       correction, contrôle manager, validation.
--
--   C4. Les outils de reprise (nexus-fdj-correction-stock-depart.js et
--       assimilés) ont été vérifiés : ils LISENT fdj_shift_counts et
--       fdj_shifts — lecture conservée ci-dessous — mais n'y écrivent plus
--       directement.
--
-- SI L'UNE DE CES CONDITIONS N'EST PAS TENUE, NE PAS APPLIQUER. Le retour
-- arrière figure en fin de fichier, mais un écran cassé en service ne se
-- rattrape pas par un rollback : il se rattrape par un front qui remarche.
--
-- ---------------------------------------------------------------------------
-- LES DEUX RÈGLES QUE CETTE PHASE POSE
--
--   1. L'ARGENT EST PERSONNEL, LE STOCK EST CELUI DE LA STATION.
--
--      Les tables qui portent des montants (fdj_cash_controls, fdj_reports,
--      fdj_releves_cloture, fdj_corrections) et le journal (fdj_audit_log) ne
--      sont plus lisibles que par un manager ou un gérant du site. L'employé
--      n'y accède plus du tout en direct : il lit sa caisse par
--      fdj_ma_caisse(), qui est la projection du §4.
--
--      Ce n'est pas une aggravation gratuite. La RLS filtre des LIGNES, jamais
--      des COLONNES. Aujourd'hui, `select('*') on fdj_cash_controls`
--      (NEXUS-FDJ-v1.html:796) rend à l'employé, sur sa propre ligne,
--      `motif_ecart_texte`, `valide_par` et `controle_par` — soit précisément
--      les trois champs que le §4 interdit de lui envoyer. Lui laisser un
--      SELECT « sur ses propres lignes » laisserait la fuite intacte et
--      rendrait la projection décorative. Ce qui ne doit pas être lu ne doit
--      pas être envoyé : la ligne entière lui devient donc inaccessible, et la
--      fonction choisit ce qu'il en reçoit.
--
--      En revanche, les comptages par jeu (fdj_shift_counts) et l'existence
--      des quarts (fdj_shifts) restent lisibles au niveau du site : le stock
--      final d'un quart est le stock initial du suivant, et un employé qui ne
--      verrait pas le comptage du quart précédent ne pourrait plus ouvrir le
--      sien. Fermer cela fermerait la station, pas la protégerait. Ni l'une ni
--      l'autre de ces tables ne porte de montant de caisse ni de commentaire
--      manager.
--
--   2. PLUS AUCUNE ÉCRITURE DIRECTE SUR LE CYCLE.
--
--      Les sept tables perdent toutes leurs politiques INSERT et UPDATE. Les
--      écritures passent par les commandes de la Phase A, qui sont SECURITY
--      DEFINER, appartiennent au propriétaire du schéma, contournent donc la
--      RLS — et vérifient d'abord identité, rôle, site, titulaire du quart,
--      état courant, transition demandée, idempotence et concurrence (§5.3).
--      C'est le « Les écritures directes trop larges doivent être supprimées
--      une fois le nouveau front basculé » du mandat.
--
-- HORS PÉRIMÈTRE DE CETTE PHASE, volontairement (§12, « ne pas refondre la
-- source FDJ au-delà du périmètre nécessaire ») : fdj_stock_movements,
-- fdj_booklets, fdj_games, fdj_locations, fdj_alertes, fdj_discrepancies,
-- fdj_recall_alerts, fdj_site_settings, fdj_imported_history et les tables de
-- référence de stock. Les livrets relèvent du §6, qui n'ordonne aucune
-- fermeture en Vague 1.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ----------------------------------------------------------------------------
-- 1. PRÉDICAT COMMUN — « je contrôle ce site »
--
--    Le rôle et le site sont lus EN BASE, dans public.employees (§5.2 : « ne
--    pas fonder une décision de sécurité sur une métadonnée modifiable côté
--    client »). Rien ici ne vient du navigateur : ni le site, ni le rôle, ni
--    l'identité — auth.uid() est la seule entrée, et elle vient du JWT vérifié.
--
--    'gerant' figure dans la liste bien qu'aucun employé ne porte ce rôle sur
--    Test au 16/09/2026 : c'est la liste déjà retenue par la politique
--    `ecriture_fdj_employee_shift_locks_manager`, seule table FDJ qui
--    distinguait les rôles avant cette phase. Une phase de fermeture n'est pas
--    le moment d'inventer une quatrième définition de « manager ».
-- ----------------------------------------------------------------------------

create or replace function public.fdj_je_controle_le_site(p_site text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.employees e
     where e.id = (select auth.uid())
       and e.site_id = p_site
       and e.actif is not false
       and e.role in ('manager', 'gerant')
  );
$$;

comment on function public.fdj_je_controle_le_site(text) is
  'Prédicat des RLS FDJ Phase C : l''appelant est manager ou gérant du site '
  'désigné. Rôle et site lus en base dans public.employees, jamais reçus du '
  'client. Aucun paramètre d''identité.';

-- L'ACL est ÉCRITE, pas héritée : `create or replace` conserve celle d'une
-- fonction préexistante, et l'`alter default privileges` de Supabase sur le
-- schéma `public` donnerait `anon = EXECUTE` sur une base neuve. `revoke ...
-- from public` seul ne retire jamais un grant nommé.
revoke all on function public.fdj_je_controle_le_site(text) from public;
revoke all on function public.fdj_je_controle_le_site(text) from anon;
grant execute on function public.fdj_je_controle_le_site(text) to authenticated;
grant execute on function public.fdj_je_controle_le_site(text) to service_role;

-- ----------------------------------------------------------------------------
-- 2. fdj_cash_controls — LA CAISSE
--    Lecture : manager/gérant du site. L'employé passe par fdj_ma_caisse().
--    Écriture : aucune en direct (fdj_enregistrer_brouillon_caisse,
--    fdj_confirmer_caisse, fdj_corriger_caisse_confirmee, fdj_valider_caisse,
--    fdj_rouvrir_caisse, fdj_corriger_caisse_manager).
-- ----------------------------------------------------------------------------

drop policy if exists insert_fdj_cash_controls on public.fdj_cash_controls;
drop policy if exists update_fdj_cash_controls on public.fdj_cash_controls;
drop policy if exists select_fdj_cash_controls on public.fdj_cash_controls;

create policy select_fdj_cash_controls
  on public.fdj_cash_controls
  for select
  using (public.fdj_je_controle_le_site(site));

-- ----------------------------------------------------------------------------
-- 3. fdj_reports, fdj_releves_cloture, fdj_corrections — LES MONTANTS ANNEXES
--    Même régime. lots_payes_grattage et caisse_tirages, seuls champs de
--    fdj_reports dont l'employé ait l'usage, lui sont rendus par le bloc
--    `ma_saisie` de fdj_ma_caisse().
-- ----------------------------------------------------------------------------

drop policy if exists insert_fdj_reports on public.fdj_reports;
drop policy if exists update_fdj_reports on public.fdj_reports;
drop policy if exists select_fdj_reports on public.fdj_reports;

create policy select_fdj_reports
  on public.fdj_reports
  for select
  using (public.fdj_je_controle_le_site(site));

drop policy if exists insert_fdj_releves_cloture on public.fdj_releves_cloture;
drop policy if exists select_fdj_releves_cloture on public.fdj_releves_cloture;

create policy select_fdj_releves_cloture
  on public.fdj_releves_cloture
  for select
  using (public.fdj_je_controle_le_site(site));

drop policy if exists insert_fdj_corrections on public.fdj_corrections;
drop policy if exists select_fdj_corrections on public.fdj_corrections;

create policy select_fdj_corrections
  on public.fdj_corrections
  for select
  using (public.fdj_je_controle_le_site(site));

-- ----------------------------------------------------------------------------
-- 4. fdj_audit_log — LE JOURNAL
--    Il est aujourd'hui inséré depuis le navigateur (quatre appels) et lisible
--    par tout le site. Un journal que son sujet peut écrire n'est pas un
--    journal, et un journal que son sujet peut lire en entier n'en est plus un
--    non plus. Les commandes de la Phase A y écrivent en SECURITY DEFINER ; la
--    lecture revient au manager.
-- ----------------------------------------------------------------------------

drop policy if exists insert_fdj_audit_log on public.fdj_audit_log;
drop policy if exists select_fdj_audit_log on public.fdj_audit_log;

create policy select_fdj_audit_log
  on public.fdj_audit_log
  for select
  using (public.fdj_je_controle_le_site(site));

-- ----------------------------------------------------------------------------
-- 5. fdj_shifts et fdj_shift_counts — LA CHAÎNE ET LE STOCK
--    Écritures fermées. Lectures de site CONSERVÉES, volontairement : voir la
--    règle 1 en tête de fichier. Les politiques select_fdj_shifts et
--    select_fdj_shift_counts ne sont donc ni supprimées ni recréées.
-- ----------------------------------------------------------------------------

drop policy if exists insert_fdj_shifts on public.fdj_shifts;
drop policy if exists update_fdj_shifts on public.fdj_shifts;

drop policy if exists insert_fdj_shift_counts on public.fdj_shift_counts;
drop policy if exists update_fdj_shift_counts on public.fdj_shift_counts;

-- ----------------------------------------------------------------------------
-- 6. AUCUNE POLITIQUE DELETE NULLE PART
--    Constat, pas action : aucune de ces sept tables n'a jamais porté de
--    politique DELETE, et cette phase n'en crée aucune. Sous RLS, l'absence de
--    politique vaut refus. Un quart, une caisse, un relevé ne se suppriment
--    pas depuis un écran.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 7. CONTRÔLES IMMÉDIATS — la phase échoue si elle n'a pas fait ce qu'elle
--    annonce. Mieux vaut un rollback ici qu'une fermeture qu'on croit faite.
-- ----------------------------------------------------------------------------

do $$
declare
  v_tables constant text[] := array[
    'fdj_cash_controls', 'fdj_reports', 'fdj_releves_cloture',
    'fdj_corrections', 'fdj_audit_log', 'fdj_shifts', 'fdj_shift_counts'];
  v_ecritures int;
  v_rls_off   text;
  v_lectures  int;
begin
  -- 7.a — plus aucune politique d'écriture sur le cycle.
  select count(*) into v_ecritures
    from pg_policies
   where schemaname = 'public'
     and tablename = any (v_tables)
     and cmd in ('INSERT', 'UPDATE', 'ALL');

  if v_ecritures <> 0 then
    raise exception
      'Phase C incomplète : % politique(s) d''écriture subsiste(nt) sur le cycle FDJ.',
      v_ecritures;
  end if;

  -- 7.b — la RLS est bien active partout. Une table sans politique dont la RLS
  -- serait désactivée serait GRANDE OUVERTE, et non fermée : le contrôle 7.a
  -- passerait au vert en décrivant exactement l'inverse de la réalité.
  select string_agg(c.relname, ', ' order by c.relname) into v_rls_off
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = any (v_tables)
     and c.relrowsecurity is not true;

  if v_rls_off is not null then
    raise exception 'Phase C incomplète : RLS inactive sur %.', v_rls_off;
  end if;

  -- 7.c — les cinq tables de montants et le journal ont exactement une
  -- politique, de lecture, et elle appelle le prédicat.
  select count(*) into v_lectures
    from pg_policies
   where schemaname = 'public'
     and tablename in ('fdj_cash_controls', 'fdj_reports', 'fdj_releves_cloture',
                       'fdj_corrections', 'fdj_audit_log')
     and cmd = 'SELECT'
     and qual like '%fdj_je_controle_le_site%';

  if v_lectures <> 5 then
    raise exception
      'Phase C incomplète : % lecture(s) restreinte(s) au manager sur 5 attendue(s).',
      v_lectures;
  end if;
end;
$$;

commit;

-- ============================================================================
-- VÉRIFICATION APRÈS APPLICATION (hors transaction, à copier telle quelle)
--
--   select tablename, policyname, cmd, roles::text, qual
--     from pg_policies
--    where schemaname = 'public' and tablename like 'fdj\_%'
--    order by tablename, cmd, policyname;
--
-- Attendu sur les sept tables du cycle : 5 SELECT appelant
-- fdj_je_controle_le_site, 2 SELECT `site = current_employee_site_id()`
-- (fdj_shifts, fdj_shift_counts), et rien d'autre.
--
--   select proname, proacl::text from pg_proc
--    where pronamespace = 'public'::regnamespace
--      and proname = 'fdj_je_controle_le_site';
--
-- Attendu : {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- — anon absent, PUBLIC absent.
--
-- ============================================================================
-- RETOUR ARRIÈRE (Phase C) — restaure exactement l'état d'avant, tel que relevé
-- le 16/09/2026 sur Test (18 politiques, `roles={public}`, prédicat unique
-- `site = current_employee_site_id()`).
--
-- begin;
--
--   drop policy if exists select_fdj_cash_controls   on public.fdj_cash_controls;
--   drop policy if exists select_fdj_reports         on public.fdj_reports;
--   drop policy if exists select_fdj_releves_cloture on public.fdj_releves_cloture;
--   drop policy if exists select_fdj_corrections     on public.fdj_corrections;
--   drop policy if exists select_fdj_audit_log       on public.fdj_audit_log;
--
--   create policy select_fdj_cash_controls on public.fdj_cash_controls
--     for select using (site = (select public.current_employee_site_id()));
--   create policy insert_fdj_cash_controls on public.fdj_cash_controls
--     for insert with check (site = (select public.current_employee_site_id()));
--   create policy update_fdj_cash_controls on public.fdj_cash_controls
--     for update using (site = (select public.current_employee_site_id()));
--
--   create policy select_fdj_reports on public.fdj_reports
--     for select using (site = (select public.current_employee_site_id()));
--   create policy insert_fdj_reports on public.fdj_reports
--     for insert with check (site = (select public.current_employee_site_id()));
--   create policy update_fdj_reports on public.fdj_reports
--     for update using (site = (select public.current_employee_site_id()));
--
--   create policy select_fdj_releves_cloture on public.fdj_releves_cloture
--     for select using (site = (select public.current_employee_site_id()));
--   create policy insert_fdj_releves_cloture on public.fdj_releves_cloture
--     for insert with check (site = (select public.current_employee_site_id()));
--
--   create policy select_fdj_corrections on public.fdj_corrections
--     for select using (site = (select public.current_employee_site_id()));
--   create policy insert_fdj_corrections on public.fdj_corrections
--     for insert with check (site = (select public.current_employee_site_id()));
--
--   create policy select_fdj_audit_log on public.fdj_audit_log
--     for select using (site = (select public.current_employee_site_id()));
--   create policy insert_fdj_audit_log on public.fdj_audit_log
--     for insert with check (site = (select public.current_employee_site_id()));
--
--   create policy insert_fdj_shifts on public.fdj_shifts
--     for insert with check (site = (select public.current_employee_site_id()));
--   create policy update_fdj_shifts on public.fdj_shifts
--     for update using (site = (select public.current_employee_site_id()));
--
--   create policy insert_fdj_shift_counts on public.fdj_shift_counts
--     for insert with check (site = (select public.current_employee_site_id()));
--   create policy update_fdj_shift_counts on public.fdj_shift_counts
--     for update using (site = (select public.current_employee_site_id()));
--
--   drop function if exists public.fdj_je_controle_le_site(text);
--
-- commit;
--
-- CONDITION D'ARRÊT DU RETOUR ARRIÈRE. Il rouvre les écritures directes à tout
-- employé du site. Ne l'exécuter que si le front Phase B a dû être remis en
-- arrière lui aussi ; sinon on rouvre une porte que plus personne n'emprunte,
-- et on la laisse ouverte.
-- ============================================================================
