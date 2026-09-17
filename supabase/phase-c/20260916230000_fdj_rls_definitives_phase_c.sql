-- =====================================================================
-- FDJ — Vague 1, PHASE C : FERMER.
--
-- Ce fichier n'est PAS une migration. Il vit dans supabase/phase-c/ pour
-- qu'aucun `supabase db push` ne l'emporte avec le lot de la Phase A.
-- Voir supabase/phase-c/LISEZ-MOI.md.
--
-- ---------------------------------------------------------------------
-- 17/09/2026 — RÉVISION DU PÉRIMÈTRE (Article 5 : on n'efface pas
-- l'historique d'une décision, on écrit pourquoi elle a changé).
--
-- La première version de ce fichier SUPPRIMAIT toute politique d'écriture
-- sur les sept tables du cycle. Le recensement des accès directs, fait
-- après coup sur la totalité du dépôt, a montré que cette fermeture-là
-- est inapplicable en Vague 1, pour trois raisons mesurées :
--
--   (i)  NEXUS-FDJ-Manager-v1.html n'est PAS basculé en Vague 1 (§12 du
--        mandat : « ne pas refondre la source FDJ au-delà du périmètre
--        nécessaire à cette vague »). Il écrit encore en direct :
--          · fdj_cash_controls   — 1669 (update), 5636 (upsert)
--          · fdj_reports         — 5627 (upsert)
--          · fdj_releves_cloture — 1759, 2055, 2119, 5734 (insert)
--          · fdj_shifts          — 5510, 5524, 5531 (update ET insert)
--          · fdj_shift_counts    — 5553 (upsert)
--          · fdj_audit_log       — 10 inserts
--        Supprimer ces politiques ferait tomber l'écran qui VALIDE les
--        caisses. Fermer le cycle en cassant son contrôle n'est pas
--        fermer le cycle.
--
--   (ii) Côté employé, la Phase B a bien retiré tout accès direct aux
--        QUATRE TABLES DE MONTANTS : fdj_cash_controls, fdj_reports,
--        fdj_releves_cloture, fdj_corrections ont zéro occurrence dans
--        NEXUS-FDJ-v1.html. Mais trois écritures y subsistent, qu'aucune
--        commande du §5.3 ne couvre :
--          · validerOuverture()          → fdj_shift_counts (1417),
--            fdj_shifts.ouverture_validee (1421), fdj_alertes (1431/1435),
--            fdj_employee_shift_locks (1452), fdj_audit_log (1460)
--          · chargerDernierStockFinal()  → fdj_shifts.previous_shift_id (718)
--          · parcours carnets            → fdj_stock_movements (1638/1809),
--            fdj_alertes (1652/1835), fdj_audit_log (1660)
--        La validation du stock d'OUVERTURE n'est pas dans le périmètre du
--        §5.3, qui énumère dix commandes ne la comprenant pas.
--
--   (iii) NEXUS-Progression-v1.html:353 — écran EMPLOYÉ — lit
--        fdj_cash_controls par jointure imbriquée
--        (`select('*, fdj_cash_controls(*)')`). Une politique de lecture
--        réservée au manager ne renverrait pas d'erreur : PostgREST
--        rendrait simplement la ligne imbriquée VIDE. Les badges « Série
--        Caisse » cesseraient d'être comptés sans le moindre message.
--        Une fermeture qui se manifeste par une donnée manquante et
--        silencieuse est pire que pas de fermeture du tout.
--
-- LA RÈGLE RETENUE, en conséquence :
--   on ne ferme que ce dont la Vague 1 a réellement fourni le substitut,
--   et on RESTREINT là où l'on ne peut pas encore supprimer. Toute
--   écriture directe laissée ouverte est nommée ici avec son appelant et
--   sa date de fermeture prévue (Vague 2). Rien n'est laissé ouvert par
--   omission : ce fichier est aussi l'inventaire de ce qui reste à faire.
--
-- CE QUE CETTE PHASE C OBTIENT MALGRÉ TOUT, et qui est l'objet du §5.1 :
--   · l'employé ne peut plus écrire DU TOUT, en direct, dans les quatre
--     tables de montants — donc il ne peut ni valider sa caisse, ni
--     valider celle d'un collègue, ni modifier une caisse validée ;
--   · l'employé ne peut plus lire les caisses de ses collègues (il ne
--     voyait jusqu'ici RIEN de moins que tout le site) ;
--   · l'employé ne peut plus, par écriture directe, changer le titulaire
--     d'un quart, son site, sa date, son numéro, ni son état — c'est une
--     garde en base, pas une garde d'écran ;
--   · l'employé ne peut plus imputer une action du journal à un tiers.
--
-- ---------------------------------------------------------------------
-- CONDITIONS D'APPLICATION — à vérifier une par une AVANT d'exécuter.
--
--  C1. Les neuf migrations de la Phase A (20260916220000 →
--      20260916220800) sont appliquées sur l'environnement visé, et
--      `select proname from pg_proc join pg_namespace n on n.oid=pronamespace
--       where nspname='public' and proname like 'fdj_%'` montre les dix
--      commandes du §5.3.
--
--  C2. Le fichier NEXUS-FDJ-v1.html RÉELLEMENT SERVI (pas celui du
--      dépôt : Production est servie brute par GitHub Pages, les deux
--      calendriers sont indépendants) ne contient plus aucune occurrence
--      de .from('fdj_cash_controls'), .from('fdj_reports'),
--      .from('fdj_releves_cloture'), .from('fdj_corrections').
--      Se vérifie sur l'URL servie, pas sur le disque.
--
--  C3. NEXUS-Prise-De-Poste-v1.html servi appelle bien
--      fdj_ouvrir_quart_depuis_prise_de_poste.
--
--  C4. Une caisse de test a parcouru, sur l'environnement visé, le cycle
--      complet brouillon → confirmation → correction → validation par les
--      seules commandes serveur.
--
--  C5. (nouveau) L'écran NEXUS-Progression-v1.html servi lit toujours
--      fdj_cash_controls par jointure — donc la politique de lecture
--      écrite ici DOIT conserver le cas « c'est mon propre quart ». Si un
--      jour cet écran passe par une projection, alors et seulement alors
--      la clause `fdj_est_mon_quart` pourra disparaître.
--
-- HORS PÉRIMÈTRE de ce fichier : aucune donnée n'est lue, modifiée,
-- déplacée ou supprimée. Il ne touche que des politiques, deux fonctions
-- de prédicat et deux triggers de garde.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- §1 — PRÉDICATS
-- ---------------------------------------------------------------------

-- 1.a — « Suis-je manager de ce site ? »
-- Le rôle est lu DANS LA BASE (public.employees), jamais dans une
-- métadonnée de jeton modifiable côté client (§5.2 du mandat).
-- security definer : la lecture de public.employees est elle-même
-- soumise à RLS ; sans cela le prédicat renverrait faux pour tout le
-- monde. search_path vidé explicitement (§4).
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
     where e.id = auth.uid()
       and e.role in ('manager', 'gerant')
       and e.site_id = p_site
  );
$$;

revoke all on function public.fdj_je_controle_le_site(text) from public;
revoke all on function public.fdj_je_controle_le_site(text) from anon;
grant execute on function public.fdj_je_controle_le_site(text) to authenticated;
grant execute on function public.fdj_je_controle_le_site(text) to service_role;

comment on function public.fdj_je_controle_le_site(text) is
  'Vague 1 §5.2 — vrai si l''utilisateur authentifié est manager ou gérant '
  'DU site donné, d''après public.employees (rôle enregistré en base, jamais '
  'une métadonnée de jeton). Seul prédicat de contrôle managérial des '
  'politiques RLS du cycle FDJ.';

-- 1.b — « Ce quart est-il le mien ? »
-- Existe pour une raison précise et unique : NEXUS-Progression-v1.html
-- (écran employé) lit fdj_cash_controls par jointure sur SES propres
-- quarts. Sans cette clause, la lecture se viderait en silence (cf. (iii)).
-- Elle n'ouvre rien de plus que ce que l'employé voyait déjà : elle
-- RÉDUIT, de « tout le site » à « mes quarts ».
create or replace function public.fdj_est_mon_quart(p_shift_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.fdj_shifts s
     where s.id = p_shift_id
       and s.employee_id = auth.uid()
  );
$$;

revoke all on function public.fdj_est_mon_quart(uuid) from public;
revoke all on function public.fdj_est_mon_quart(uuid) from anon;
grant execute on function public.fdj_est_mon_quart(uuid) to authenticated;
grant execute on function public.fdj_est_mon_quart(uuid) to service_role;

comment on function public.fdj_est_mon_quart(uuid) is
  'Vague 1 — vrai si le quart FDJ donné a pour employé responsable '
  'l''utilisateur authentifié. Sert uniquement aux politiques de LECTURE, '
  'pour que « Ma Progression » continue de voir les caisses de l''employé '
  'lui-même après la fermeture de la lecture du site.';

-- ---------------------------------------------------------------------
-- §2 — fdj_cash_controls
--
-- Lecture  : manager du site, OU titulaire du quart.
--            AVANT : tout employé du site voyait toutes les caisses du
--            site, y compris motif_ecart_texte (le motif interne du
--            manager) et valide_par. APRÈS : il ne voit plus que les
--            siennes.
--            DETTE VAGUE 2, nommée et non masquée : sur SES PROPRES
--            caisses, l'employé lit encore motif_ecart_texte,
--            resultat_controle et valide_par via Ma Progression, qui
--            demande `fdj_cash_controls(*)`. La RLS filtre des lignes,
--            jamais des colonnes ; et `grant select (colonnes)` ne peut
--            pas trancher ici, parce que le privilège porte sur le rôle
--            `authenticated`, commun aux employés ET aux managers — il
--            casserait l'écran Écarts (nexus-ecarts-donnees.js, chargé
--            par NEXUS-Paye / NEXUS-Analyse-Ecarts / NEXUS-FDJ-Manager),
--            qui lit précisément motif_ecart_texte. La fermeture propre
--            est une projection de progression : Vague 2.
--
-- Écriture : réservée au manager du site. L'employé n'écrit plus rien ici
--            en direct — c'est le cœur du §5.1, et c'est acquis dès
--            maintenant. Les commandes de la Phase A, SECURITY DEFINER
--            détenues par postgres (propriétaire des tables, RLS non
--            forcée), ne sont pas concernées par ces politiques.
--            La suppression complète de ces deux politiques est un
--            livrable de Vague 2, après bascule de l'écran manager.
-- ---------------------------------------------------------------------

drop policy if exists select_fdj_cash_controls on public.fdj_cash_controls;
create policy select_fdj_cash_controls on public.fdj_cash_controls
  for select
  using (
    public.fdj_je_controle_le_site(site)
    or public.fdj_est_mon_quart(shift_id)
  );

drop policy if exists insert_fdj_cash_controls on public.fdj_cash_controls;
create policy insert_fdj_cash_controls on public.fdj_cash_controls
  for insert
  with check (public.fdj_je_controle_le_site(site));

drop policy if exists update_fdj_cash_controls on public.fdj_cash_controls;
create policy update_fdj_cash_controls on public.fdj_cash_controls
  for update
  using (public.fdj_je_controle_le_site(site))
  with check (public.fdj_je_controle_le_site(site));

-- ---------------------------------------------------------------------
-- §3 — fdj_reports, fdj_releves_cloture, fdj_corrections
--
-- Aucun écran employé ne lit ni n'écrit ces trois tables (recensement du
-- 17/09/2026 : seul NEXUS-FDJ-Manager-v1.html les touche, et
-- fdj_corrections n'est touchée par AUCUN front). Elles passent donc
-- intégralement sous contrôle managérial, en lecture comme en écriture.
--
-- fdj_corrections est le seul cas où la fermeture est complète dès la
-- Vague 1 : plus aucune écriture directe n'est possible, par personne.
-- C'est la commande fdj_corriger_caisse_confirmee / _manager qui y écrit.
-- ---------------------------------------------------------------------

drop policy if exists select_fdj_reports on public.fdj_reports;
create policy select_fdj_reports on public.fdj_reports
  for select using (public.fdj_je_controle_le_site(site));

drop policy if exists insert_fdj_reports on public.fdj_reports;
create policy insert_fdj_reports on public.fdj_reports
  for insert with check (public.fdj_je_controle_le_site(site));

drop policy if exists update_fdj_reports on public.fdj_reports;
create policy update_fdj_reports on public.fdj_reports
  for update
  using (public.fdj_je_controle_le_site(site))
  with check (public.fdj_je_controle_le_site(site));

drop policy if exists select_fdj_releves_cloture on public.fdj_releves_cloture;
create policy select_fdj_releves_cloture on public.fdj_releves_cloture
  for select using (public.fdj_je_controle_le_site(site));

drop policy if exists insert_fdj_releves_cloture on public.fdj_releves_cloture;
create policy insert_fdj_releves_cloture on public.fdj_releves_cloture
  for insert with check (public.fdj_je_controle_le_site(site));

-- fdj_releves_cloture n'a jamais eu de politique UPDATE : un relevé est
-- versionné, jamais réécrit. On ne la crée pas.

drop policy if exists select_fdj_corrections on public.fdj_corrections;
create policy select_fdj_corrections on public.fdj_corrections
  for select using (public.fdj_je_controle_le_site(site));

-- FERMETURE COMPLÈTE : la politique d'insertion directe disparaît.
drop policy if exists insert_fdj_corrections on public.fdj_corrections;

-- ---------------------------------------------------------------------
-- §4 — fdj_audit_log
--
-- Lecture  : manager du site. Aucun écran employé ne lit le journal
--            (0 lecture dans NEXUS-FDJ-v1.html) — la restriction est donc
--            sans effet de bord.
--
-- Écriture : CONSERVÉE au site. DETTE VAGUE 2 nommée : l'employé y écrit
--            encore par validerOuverture() (NEXUS-FDJ-v1.html:1460) et
--            par le parcours carnets (1660), et le manager par dix
--            inserts. Fermer l'insertion ici ferait tomber les deux
--            écrans d'un coup.
--            Ce qui est fermé en revanche, et qui est l'essentiel de ce
--            que valait la journalisation : on ne peut plus imputer une
--            action à quelqu'un d'autre que soi. Le trigger 4.b l'impose.
-- ---------------------------------------------------------------------

drop policy if exists select_fdj_audit_log on public.fdj_audit_log;
create policy select_fdj_audit_log on public.fdj_audit_log
  for select using (public.fdj_je_controle_le_site(site));

drop policy if exists insert_fdj_audit_log on public.fdj_audit_log;
create policy insert_fdj_audit_log on public.fdj_audit_log
  for insert
  with check (site = (select public.current_employee_site_id()));

-- 4.b — garde d'imputation.
-- current_user vaut 'authenticated' dans une requête PostgREST directe,
-- et le propriétaire du schéma dans une fonction SECURITY DEFINER : c'est
-- le discriminant, et il ne demande aucun drapeau de session à poser.
-- acteur_id null est admis : quatre écritures du manager journalisent des
-- recalculs automatiques que personne n'a demandés (NEXUS-FDJ-Manager
-- 1677, 1807, 1849, 1964) — « auteur inconnu » est un fait, pas un trou.
create or replace function public.fdj_audit_log_garde_acteur()
returns trigger
language plpgsql
-- SECURITY INVOKER, et c'est tout le sujet : en security definer, la
-- fonction s'exécuterait sous le propriétaire, current_user vaudrait
-- 'postgres' et la garde désactiverait sa propre condition. Elle serait
-- verte à l'installation et n'aurait jamais rien refusé. Mesuré le
-- 17/09/2026 : la mutation M5 est passée tant que ce mot était là.
-- Elle n'a besoin d'aucun privilège propre : fdj_je_controle_le_site()
-- porte seule l'élévation nécessaire pour lire public.employees.
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.acteur_id is not null and new.acteur_id <> auth.uid() then
    raise exception
      'Journal FDJ : une action ne peut être imputée qu''à soi-même (acteur_id attendu : %).', auth.uid()
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists fdj_audit_log_garde_acteur on public.fdj_audit_log;
create trigger fdj_audit_log_garde_acteur
  before insert on public.fdj_audit_log
  for each row execute function public.fdj_audit_log_garde_acteur();

comment on function public.fdj_audit_log_garde_acteur() is
  'Vague 1 Phase C — interdit à une écriture DIRECTE (PostgREST) du journal '
  'FDJ d''imputer une action à un autre utilisateur. Ne mord pas sur les '
  'commandes serveur SECURITY DEFINER, où current_user est le propriétaire '
  'du schéma. acteur_id null reste admis : recalculs automatiques.';

-- ---------------------------------------------------------------------
-- §5 — fdj_shifts et fdj_shift_counts
--
-- Ici la suppression est IMPOSSIBLE en Vague 1, des deux côtés :
--   · l'employé écrit encore fdj_shifts.previous_shift_id (718),
--     fdj_shifts.ouverture_validee (1421) et fdj_shift_counts (1417) ;
--   · le manager crée (5531) et modifie (5510/5524) des quarts, et
--     upserte les comptages (5553).
--
-- La lecture reste ouverte au site : elle l'était, et six écrans en
-- dépendent (nexus-coach-fdj-donnees, NEXUS-App, nexus-fdj-analyse,
-- nexus-risques, NEXUS-Progression, nexus-ecarts). Ce n'est pas une
-- donnée confidentielle : c'est le planning FDJ du site.
--
-- Ce qui est fermé, c'est la SURFACE de l'écriture directe, par un
-- trigger de garde. C'est le seul moyen : la RLS ne filtre pas les
-- colonnes, et `grant update (colonnes)` porterait sur `authenticated`,
-- commun aux employés et aux managers.
-- ---------------------------------------------------------------------

-- 5.a — garde de colonnes sur fdj_shifts.
--
-- Trois cas, dans cet ordre :
--   1. écriture par une commande serveur  → laissée passer (c'est elle
--      qui porte les vérifications du §5.3) ;
--   2. écriture directe par un manager du site → laissée passer.
--      DETTE VAGUE 2 nommée : NEXUS-FDJ-Manager-v1.html:5510 réattribue
--      encore un quart (employee_id) par écriture directe, SANS motif ni
--      journal de transfert, alors que fdj_transferer_responsabilite_quart
--      existe désormais et l'exige. Le §2.3 veut qu'une reprise soit
--      « explicite, justifiée et journalisée » : elle ne l'est pas encore
--      côté manager. C'est la première chose à basculer en Vague 2.
--   3. écriture directe par quelqu'un d'autre → seules les colonnes que
--      la validation d'ouverture a encore besoin d'écrire peuvent bouger.
--      Toute autre différence est refusée par la base.
create or replace function public.fdj_shifts_garde_colonnes()
returns trigger
language plpgsql
-- SECURITY INVOKER — voir la note sur fdj_audit_log_garde_acteur() :
-- security definer rendrait current_user égal au propriétaire et la
-- garde se laisserait passer elle-même.
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if public.fdj_je_controle_le_site(old.site) then
    return new;
  end if;

  -- Liste blanche : ce qu'une écriture directe d'employé peut encore
  -- toucher, et rien d'autre. (validerOuverture : ouverture_validee,
  -- ouverture_validee_le ; chargerDernierStockFinal : previous_shift_id.)
  if new.id                     is distinct from old.id
     or new.site                is distinct from old.site
     or new.date                is distinct from old.date
     or new.quart               is distinct from old.quart
     or new.employee_id         is distinct from old.employee_id
     or new.statut              is distinct from old.statut
     or new.ouvert_le           is distinct from old.ouvert_le
     or new.valide_le           is distinct from old.valide_le
     or new.created_at          is distinct from old.created_at
     or new.a_revoir            is distinct from old.a_revoir
     or new.a_revoir_motif      is distinct from old.a_revoir_motif
     or new.a_revoir_depuis_le  is distinct from old.a_revoir_depuis_le
     or new.version             is distinct from old.version
     or new.needs_replay        is distinct from old.needs_replay
     or new.releve_cloture_statut is distinct from old.releve_cloture_statut
     or new.last_replayed_at    is distinct from old.last_replayed_at then
    raise exception
      'Quart FDJ : cette modification passe par une commande NEXUS (ouverture, transfert, validation), pas par une écriture directe.'
      using errcode = '42501',
            hint = 'Transfert de responsabilité : fdj_transferer_responsabilite_quart. Validation : fdj_valider_caisse.';
  end if;
  return new;
end;
$$;

drop trigger if exists fdj_shifts_garde_colonnes on public.fdj_shifts;
create trigger fdj_shifts_garde_colonnes
  before update on public.fdj_shifts
  for each row execute function public.fdj_shifts_garde_colonnes();

comment on function public.fdj_shifts_garde_colonnes() is
  'Vague 1 Phase C — un employé ne peut plus, par écriture directe, changer '
  'le titulaire, le site, la date, le numéro ni l''état d''un quart FDJ : '
  'seules les colonnes de la validation d''ouverture restent ouvertes. '
  'Ne mord ni sur les commandes serveur (current_user = propriétaire) ni '
  'sur les managers du site (dette Vague 2 : leur écran écrit encore en '
  'direct, sans motif de transfert).';

-- 5.b — fdj_shifts : les politiques restent celles du site.
-- Elles ne sont pas récrites ici : les modifier sans pouvoir les
-- restreindre n'apporterait rien et brouillerait le retour arrière.
-- fdj_shift_counts : inchangée pour la même raison (validerOuverture côté
-- employé, upsert 5553 côté manager). DETTE VAGUE 2 : un employé peut
-- encore écraser le comptage d'un quart de son site qui n'est pas le sien.
-- La fermeture suppose une commande serveur de validation d'ouverture,
-- qui n'est pas au périmètre du §5.3 de ce mandat.

-- ---------------------------------------------------------------------
-- §6 — DELETE
--
-- Aucune des sept tables n'a jamais eu de politique DELETE. Sous RLS
-- active, l'absence de politique vaut refus : la suppression est donc
-- déjà impossible pour `authenticated`, et rien n'est à faire. On
-- l'écrit pour qu'un relecteur ne prenne pas ce silence pour un oubli.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- §7 — CONTRÔLES INTERNES
--
-- Ils font échouer la transaction si la fermeture n'a pas eu l'effet
-- attendu. Une garde qui ne mord pas est pire qu'une absence de garde :
-- celle-ci mord sur l'état réel de pg_policies et pg_trigger, pas sur
-- l'intention du fichier.
-- ---------------------------------------------------------------------

do $$
declare
  v_n integer;
  v_manquantes text;
begin
  -- 7.a — Plus AUCUNE politique d'écriture ouverte au site sur les
  -- quatre tables de montants : toute politique INSERT/UPDATE/ALL qui y
  -- subsiste doit citer le prédicat managérial.
  select count(*), string_agg(tablename || '.' || policyname, ', ')
    into v_n, v_manquantes
    from pg_policies
   where schemaname = 'public'
     and tablename in ('fdj_cash_controls', 'fdj_reports',
                       'fdj_releves_cloture', 'fdj_corrections')
     and cmd in ('INSERT', 'UPDATE', 'ALL')
     and coalesce(with_check, '') || coalesce(qual, '') not like '%fdj_je_controle_le_site%';
  if v_n <> 0 then
    raise exception
      'Phase C incomplète : % politique(s) d''écriture non managériale(s) sur les tables de montants — %.',
      v_n, v_manquantes;
  end if;

  -- 7.b — fdj_corrections est fermée pour de bon : aucune écriture
  -- directe, pas même managériale.
  select count(*) into v_n
    from pg_policies
   where schemaname = 'public' and tablename = 'fdj_corrections'
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  if v_n <> 0 then
    raise exception 'Phase C : fdj_corrections devait n''avoir plus aucune politique d''écriture, % trouvée(s).', v_n;
  end if;

  -- 7.c — La RLS est bien ACTIVE sur les sept tables. Sans elle, une
  -- politique ne s'applique pas : la table serait GRANDE OUVERTE, et non
  -- fermée. C'est l'erreur qui ne se voit pas.
  select count(*) into v_n
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('fdj_cash_controls', 'fdj_reports', 'fdj_releves_cloture',
                       'fdj_corrections', 'fdj_audit_log', 'fdj_shifts', 'fdj_shift_counts')
     and c.relrowsecurity;
  if v_n <> 7 then
    raise exception 'Phase C : RLS active sur % table(s) sur 7 — une table sans RLS est ouverte, pas fermée.', v_n;
  end if;

  -- 7.d — Les deux gardes existent réellement, en tant que triggers
  -- attachés, et pas seulement en tant que fonctions écrites.
  select count(*) into v_n
    from pg_trigger
   where not tgisinternal
     and tgname in ('fdj_shifts_garde_colonnes', 'fdj_audit_log_garde_acteur');
  if v_n <> 2 then
    raise exception 'Phase C : % garde(s) attachée(s) sur 2 attendues.', v_n;
  end if;

  -- 7.e — La lecture des caisses n'est plus ouverte au site entier.
  select count(*) into v_n
    from pg_policies
   where schemaname = 'public' and tablename = 'fdj_cash_controls'
     and cmd = 'SELECT' and coalesce(qual, '') like '%current_employee_site_id%';
  if v_n <> 0 then
    raise exception 'Phase C : la lecture de fdj_cash_controls est restée ouverte au site entier.';
  end if;

  raise notice 'Phase C — les cinq contrôles passent.';
end;
$$;

commit;

-- =====================================================================
-- VÉRIFICATIONS APRÈS APPLICATION (à rejouer à la main)
-- =====================================================================
--
-- 1) L'état complet des politiques du cycle :
--
--    select tablename, policyname, cmd,
--           coalesce(qual, '-') as lecture,
--           coalesce(with_check, '-') as ecriture
--      from pg_policies
--     where schemaname = 'public'
--       and tablename in ('fdj_cash_controls','fdj_reports','fdj_releves_cloture',
--                         'fdj_corrections','fdj_audit_log','fdj_shifts','fdj_shift_counts')
--     order by tablename, cmd, policyname;
--
--    Attendu : 16 politiques (18 avant, moins insert_fdj_corrections,
--    moins update_fdj_cash_controls recréée... voir le décompte exact du
--    dossier de PR). Aucune politique d'écriture sur les quatre tables de
--    montants ne cite current_employee_site_id.
--
-- 2) La mutation qui doit ÉCHOUER — un employé tente d'écrire une caisse
--    en direct (à jouer en transaction annulée, avec un uuid d'employé
--    non manager de Test) :
--
--    begin;
--      set local role authenticated;
--      set local request.jwt.claims = '{"sub":"<uuid employé>","role":"authenticated"}';
--      insert into public.fdj_cash_controls (site, shift_id, statut)
--      values ('<site>', '<shift>', 'provisoire');   -- attendu : 42501
--    rollback;
--
-- 3) La mutation qui doit ÉCHOUER — un employé tente de se réattribuer
--    un quart :
--
--    begin;
--      set local role authenticated;
--      set local request.jwt.claims = '{"sub":"<uuid employé>","role":"authenticated"}';
--      update public.fdj_shifts set employee_id = '<uuid employé>'
--       where id = '<quart d''un collègue>';          -- attendu : 42501
--    rollback;
--
-- 4) Le comportement qui doit CONTINUER de marcher — Ma Progression :
--
--    begin;
--      set local role authenticated;
--      set local request.jwt.claims = '{"sub":"<uuid employé>","role":"authenticated"}';
--      select count(*) from public.fdj_cash_controls c
--        join public.fdj_shifts s on s.id = c.shift_id
--       where s.employee_id = '<uuid employé>';       -- attendu : > 0
--    rollback;
--
-- =====================================================================
-- RETOUR ARRIÈRE
--
-- Condition d'arrêt : ne l'exécuter QUE si le front a lui aussi été remis
-- en arrière. Rouvrir les écritures directes alors que le front basculé
-- est servi ne répare rien et rouvre tout.
--
-- Il restaure les 18 politiques d'origine, telles que relevées le
-- 17/09/2026 sur Test ET conformes à Production : toutes en
-- `site = current_employee_site_id()`, rôle public, aucune DELETE.
--
-- begin;
--
--   drop trigger if exists fdj_shifts_garde_colonnes on public.fdj_shifts;
--   drop trigger if exists fdj_audit_log_garde_acteur on public.fdj_audit_log;
--   drop function if exists public.fdj_shifts_garde_colonnes();
--   drop function if exists public.fdj_audit_log_garde_acteur();
--
--   drop policy if exists select_fdj_cash_controls on public.fdj_cash_controls;
--   drop policy if exists insert_fdj_cash_controls on public.fdj_cash_controls;
--   drop policy if exists update_fdj_cash_controls on public.fdj_cash_controls;
--   create policy select_fdj_cash_controls on public.fdj_cash_controls
--     for select using (site = (select current_employee_site_id()));
--   create policy insert_fdj_cash_controls on public.fdj_cash_controls
--     for insert with check (site = (select current_employee_site_id()));
--   create policy update_fdj_cash_controls on public.fdj_cash_controls
--     for update using (site = (select current_employee_site_id()));
--
--   drop policy if exists select_fdj_reports on public.fdj_reports;
--   drop policy if exists insert_fdj_reports on public.fdj_reports;
--   drop policy if exists update_fdj_reports on public.fdj_reports;
--   create policy select_fdj_reports on public.fdj_reports
--     for select using (site = (select current_employee_site_id()));
--   create policy insert_fdj_reports on public.fdj_reports
--     for insert with check (site = (select current_employee_site_id()));
--   create policy update_fdj_reports on public.fdj_reports
--     for update using (site = (select current_employee_site_id()));
--
--   drop policy if exists select_fdj_releves_cloture on public.fdj_releves_cloture;
--   drop policy if exists insert_fdj_releves_cloture on public.fdj_releves_cloture;
--   create policy select_fdj_releves_cloture on public.fdj_releves_cloture
--     for select using (site = (select current_employee_site_id()));
--   create policy insert_fdj_releves_cloture on public.fdj_releves_cloture
--     for insert with check (site = (select current_employee_site_id()));
--
--   drop policy if exists select_fdj_corrections on public.fdj_corrections;
--   create policy select_fdj_corrections on public.fdj_corrections
--     for select using (site = (select current_employee_site_id()));
--   create policy insert_fdj_corrections on public.fdj_corrections
--     for insert with check (site = (select current_employee_site_id()));
--
--   drop policy if exists select_fdj_audit_log on public.fdj_audit_log;
--   drop policy if exists insert_fdj_audit_log on public.fdj_audit_log;
--   create policy select_fdj_audit_log on public.fdj_audit_log
--     for select using (site = (select current_employee_site_id()));
--   create policy insert_fdj_audit_log on public.fdj_audit_log
--     for insert with check (site = (select current_employee_site_id()));
--
--   -- fdj_shifts et fdj_shift_counts n'ont pas été modifiées par la
--   -- Phase C : leurs six politiques d'origine sont intactes, il n'y a
--   -- rien à restaurer.
--
--   -- Les prédicats peuvent rester : ils ne donnent aucun droit par
--   -- eux-mêmes. Pour les retirer malgré tout :
--   -- drop function if exists public.fdj_est_mon_quart(uuid);
--   -- drop function if exists public.fdj_je_controle_le_site(text);
--
-- commit;
-- =====================================================================
