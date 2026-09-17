-- =====================================================================
-- FDJ — Vague 1, PHASE C : FERMER.
--
-- Ce fichier n'est PAS une migration. Il vit dans supabase/phase-c/ pour
-- qu'aucun `supabase db push` ne l'emporte avec le lot de la Phase A.
-- Voir supabase/phase-c/LISEZ-MOI.md.
--
-- ---------------------------------------------------------------------
-- 17/09/2026 — PÉRIMÈTRE, DEUXIÈME RÉVISION (Article 5 : on n'efface pas
-- l'historique d'une décision, on écrit pourquoi elle a changé).
--
-- Ce fichier a eu trois périmètres successifs. Les deux premiers sont
-- consignés ici parce qu'ils expliquent la forme du troisième.
--
--   Version 1 — SUPPRIMER toute politique d'écriture sur les sept tables
--   du cycle. Inapplicable telle quelle : les deux écrans écrivaient
--   encore en direct, et la fermeture aurait fait tomber celui qui
--   VALIDE les caisses. Fermer le cycle en cassant son contrôle n'est
--   pas fermer le cycle.
--
--   Version 2 (matin du 17/09) — ne fermer que ce dont la Vague 1
--   fournissait le substitut, RESTREINDRE au manager là où l'on ne
--   pouvait pas encore supprimer, et nommer chaque écriture laissée
--   ouverte avec son appelant. Trois dettes étaient alors ouvertes et
--   renvoyées à une Vague 2 : l'écran manager écrivait la caisse en
--   direct (fdj_cash_controls 1669/5636), il réattribuait un quart par
--   fdj_shifts.employee_id (5510), et le parcours carnets de l'écran
--   employé insérait lui-même ses fdj_stock_movements (1638/1809).
--
--   Version 3 (celle-ci) — la relecture de la PR #62 a refusé ces trois
--   dettes, et elle a raison sur le fond : aucune des trois n'est « hors
--   du cycle sécurisé », elles SONT le cycle. Une caisse dont l'écart se
--   réécrit par un update direct n'est pas une caisse fermée ; un quart
--   dont le titulaire change par une écriture de colonne n'a pas de
--   titulaire ; un mouvement de stock dont l'employé choisit lui-même
--   l'auteur n'est pas un mouvement attribué. Les substituts manquants
--   ont donc été écrits (migrations 20260916221000 et 20260916221100),
--   les deux écrans y ont été basculés, et ce fichier ferme pour de bon :
--
--     · fdj_cash_controls  — plus AUCUNE politique d'écriture, pour
--       personne, pas même managériale. Les sept gestes du manager
--       (prise en contrôle, saisie à la place de l'employé, correction,
--       validation, réouverture, décision sur une demande de correction,
--       recalcul après rétablissement de chaîne) passent tous par des
--       commandes SECURITY DEFINER.
--     · fdj_corrections    — inchangé : fermée dès la version 2.
--     · fdj_stock_movements — l'insertion directe disparaît. Activations
--       et mouvements passent par fdj_activer_carnet et
--       fdj_enregistrer_mouvement_stock, qui déterminent elles-mêmes
--       l'auteur, l'employé responsable, le site, le quart, la date
--       d'effet et la clé d'idempotence.
--     · fdj_shifts         — la garde de colonnes du §5.a mord désormais
--       AUSSI sur le manager, pour la seule colonne `employee_id` :
--       changer de titulaire est un transfert motivé et journalisé
--       (fdj_transferer_responsabilite_quart), pas une écriture.
--
-- CE QUI RESTE OUVERT, et pourquoi c'est légitime au sens exact de la
-- relecture — « réellement hors du cycle sécurisé, et démontré sans
-- incidence sur les garanties de cette vague » :
--
--   a) fdj_reports — écriture réservée au MANAGER du site (§3). Ce sont
--      les deux relevés recopiés depuis le terminal FDJ : lots payés
--      grattage et caisse tirages. Ils ALIMENTENT le calcul, ils ne le
--      DÉCIDENT pas : depuis la bascule, plus aucun écran ne recompose
--      de montant de caisse à partir d'eux — ce sont les commandes qui
--      appellent fdj_calculer_caisse et réécrivent la caisse. Un employé
--      ne peut ni les lire ni les écrire. Aucune des garanties de cette
--      vague (qui valide, qui corrige, qui voit quoi, qui est
--      responsable) ne dépend de cette table.
--
--   b) fdj_releves_cloture — écriture réservée au MANAGER du site (§3).
--      Table de relevés VERSIONNÉS : aucune politique UPDATE, aucune
--      politique DELETE, ici comme avant. On ne peut qu'y ajouter une
--      version, jamais réécrire l'histoire. Et les versions qui comptent
--      — celles du cycle de caisse — ne sont pas posées par l'écran :
--      elles le sont par le trigger trg_fdj_sync_releve_apres_cash_control,
--      donc par les commandes, sous l'identité du propriétaire.
--
--   c) fdj_audit_log — insertion ouverte au site, employé compris (§4).
--      Deux appelants subsistent : validerOuverture() côté employé
--      (NEXUS-FDJ-v1.html:1460) et l'écran manager pour ses gestes hors
--      cycle de caisse. Le trigger 4.b interdit d'imputer une action à
--      autrui : on peut ajouter au journal, jamais mentir sur son auteur,
--      jamais effacer ni modifier (ni UPDATE ni DELETE n'ont de
--      politique). Un journal auquel on ajoute reste un journal ; ce sont
--      l'usurpation et l'effacement qui le détruisent, et les deux sont
--      fermés.
--
--   d) fdj_shifts / fdj_shift_counts / fdj_alertes /
--      fdj_employee_shift_locks — la validation du STOCK D'OUVERTURE
--      côté employé, plus previous_shift_id (718). C'est le seul bloc
--      d'écriture employé qui subsiste, et il est hors du cycle de
--      caisse : il ne touche ni un montant, ni un verdict, ni une
--      identité de contrôleur. Le §5.a en délimite la surface exacte en
--      base — `ouverture_validee`, `ouverture_validee_le`,
--      `previous_shift_id`, et rien d'autre : ni titulaire, ni site, ni
--      date, ni statut, ni `a_revoir`. Sa fermeture complète suppose une
--      commande de validation d'ouverture, que le §5.3 du mandat
--      n'énumère pas ; c'est la seule dette encore renvoyée à la Vague 2,
--      et elle est bornée par une garde en base, pas par une garde
--      d'écran.
--
-- CE QUE CETTE PHASE C OBTIENT :
--   · l'employé ne peut plus écrire DU TOUT, en direct, dans les quatre
--     tables de montants — donc il ne peut ni valider sa caisse, ni
--     valider celle d'un collègue, ni modifier une caisse validée ;
--   · PERSONNE ne peut plus écrire en direct dans fdj_cash_controls,
--     fdj_corrections ni fdj_stock_movements : ces trois tables n'ont
--     plus aucun chemin d'écriture hors commande serveur ;
--   · l'employé ne peut plus lire les caisses de ses collègues (il ne
--     voyait jusqu'ici RIEN de moins que tout le site), et ne reçoit
--     plus, même pour les siennes, ni commentaire interne, ni identité
--     de contrôleur, ni résultat de contrôle non validé ;
--   · le titulaire d'un quart ne change plus par une écriture de
--     colonne, pour personne — ni employé, ni manager ;
--   · un employé ne peut plus s'attribuer le mouvement de stock d'un
--     collègue, ni antidater une activation ;
--   · l'employé ne peut plus imputer une action du journal à un tiers.
--
-- ---------------------------------------------------------------------
-- CONDITIONS D'APPLICATION — à vérifier une par une AVANT d'exécuter.
--
--  C1. Les douze migrations de la Phase A (20260916220000 →
--      20260916221100) sont appliquées sur l'environnement visé, et
--      `select proname from pg_proc join pg_namespace n on n.oid=pronamespace
--       where nspname='public' and proname like 'fdj_%'` montre les dix
--      commandes du §5.3 ainsi que fdj_activer_carnet,
--      fdj_enregistrer_mouvement_stock, fdj_saisir_caisse_manager,
--      fdj_demandes_correction_du_quart et
--      fdj_transferer_responsabilite_quart.
--      Le §7 ne s'en remet pas à cette relecture : le contrôle 7.h
--      échoue si l'une de ces commandes manque.
--
--  C2. Le fichier NEXUS-FDJ-v1.html RÉELLEMENT SERVI (pas celui du
--      dépôt : Production est servie brute par GitHub Pages, les deux
--      calendriers sont indépendants) ne contient plus aucune occurrence
--      de .from('fdj_cash_controls'), .from('fdj_reports'),
--      .from('fdj_releves_cloture'), .from('fdj_corrections'), ni aucun
--      insert direct dans .from('fdj_stock_movements').
--      Se vérifie sur l'URL servie, pas sur le disque.
--
--  C3. NEXUS-Prise-De-Poste-v1.html servi appelle bien
--      fdj_ouvrir_quart_depuis_prise_de_poste.
--
--  C4. Une caisse de test a parcouru, sur l'environnement visé, le cycle
--      complet brouillon → confirmation → correction → validation par les
--      seules commandes serveur.
--
--  C5. L'écran NEXUS-Progression-v1.html RÉELLEMENT SERVI appelle
--      fdj_ma_progression_caisse() et ne contient plus aucune occurrence
--      de fdj_cash_controls(*) ni de .from('fdj_shifts'). Se vérifie sur
--      l'URL servie, pas sur le disque.
--
--      Cette condition a changé de sens le 17/09/2026. Elle disait
--      jusqu'ici l'inverse : « l'écran lit fdj_cash_controls par
--      jointure, donc la politique DOIT conserver le cas c'est mon
--      propre quart ». La jointure a été remplacée par une projection
--      serveur (migration 20260916220900), la clause `fdj_est_mon_quart`
--      a donc été retirée du §2 avec la fonction qui la portait, et la
--      lecture des caisses est désormais réservée au manager et aux
--      fonctions serveur. Tant que l'écran SERVI est l'ancien, appliquer
--      ce fichier vide son onglet FDJ — en silence, sans erreur : c'est
--      exactement le piège que C5 décrit, il a seulement changé de côté.
--
--  C6. L'écran NEXUS-FDJ-Manager-v1.html RÉELLEMENT SERVI n'écrit plus
--      en direct dans fdj_cash_controls et ne réattribue plus de quart
--      par `employee_id` : il appelle fdj_ouvrir_controle_caisse,
--      fdj_saisir_caisse_manager, fdj_corriger_caisse_manager,
--      fdj_valider_caisse, fdj_rouvrir_caisse,
--      fdj_traiter_demande_correction et
--      fdj_transferer_responsabilite_quart. Se vérifie sur l'URL servie,
--      pas sur le disque.
--
--      C'est la condition la plus coûteuse à manquer, et c'est une
--      nouveauté de la version 3 : jusqu'ici la table gardait des
--      politiques d'écriture managériales qui rattrapaient un écran en
--      retard. Elles n'existent plus. Appliquer ce fichier devant
--      l'ancien écran manager rend le contrôle des caisses IMPOSSIBLE —
--      en 42501, cette fois, donc bruyamment.
--
--  C7. Le parcours carnets de NEXUS-FDJ-v1.html SERVI appelle
--      fdj_activer_carnet et fdj_enregistrer_mouvement_stock. Sinon,
--      activer un carnet échoue en 42501 (la lecture, elle, reste
--      ouverte au site : l'écran n'affiche pas moins, il n'écrit plus).
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

-- 1.b — « Ce quart est-il le mien ? » — RETIRÉE le 17/09/2026.
-- Cette fonction a existé pour une raison unique : NEXUS-Progression-v1.html
-- lisait fdj_cash_controls par jointure sur ses propres quarts, et sans
-- clause « c'est mon quart » cette lecture se serait vidée en silence.
-- L'écran passe désormais par fdj_ma_progression_caisse() (migration
-- 20260916220900), qui est SECURITY DEFINER et ne dépend donc d'aucune
-- politique de lecture. Le besoin a disparu, la fonction aussi : une
-- fonction de prédicat qu'aucune politique n'appelle est une porte qu'on
-- laisse déverrouillée en croyant l'avoir condamnée. Son `drop` figure au
-- retour arrière, pour les bases où la version précédente de ce fichier
-- aurait déjà été appliquée.
drop function if exists public.fdj_est_mon_quart(uuid);

-- ---------------------------------------------------------------------
-- §2 — fdj_cash_controls
--
-- Lecture  : manager du site, et rien d'autre.
--            AVANT (mesuré sur nexus-test le 17/09/2026, transaction
--            annulée) : la politique était `site =
--            current_employee_site_id()`. Un caissier lisait donc TOUTES
--            les caisses de son site — celles de ses collègues comprises
--            — et sa réponse réseau portait neuf colonnes réservées au
--            manager : motif_ecart_texte, resultat_controle, valide_par,
--            controle_par, controle_le, saisi_par, confirme_par, version,
--            nb_corrections. Deux contrôles lisibles, dont un d'un
--            collègue, avec le commentaire interne en clair.
--            APRÈS : il n'en lit plus aucun en direct.
--
--            LA DETTE VAGUE 2 EST LEVÉE, elle n'est pas reportée. Elle
--            disait : « sur SES PROPRES caisses, l'employé lit encore
--            motif_ecart_texte via Ma Progression, qui demande
--            fdj_cash_controls(*) ; la RLS filtre des lignes, jamais des
--            colonnes, et `grant select (colonnes)` ne peut pas trancher
--            parce que le privilège porte sur `authenticated`, commun aux
--            employés ET aux managers — il casserait l'écran Écarts, qui
--            lit précisément motif_ecart_texte ». La fermeture propre
--            était nommée : une projection de progression. Elle a été
--            écrite (20260916220900), le front a basculé dessus, et la
--            clause « ou c'est mon quart » a disparu avec son motif.
--            Ce que l'employé voit de sa propre caisse, il le reçoit
--            maintenant de fdj_ma_progression_caisse() : douze champs,
--            écart provisoire et définitif compris, aucun commentaire
--            interne, aucune identité de contrôleur.
--
-- Écriture : AUCUNE. Ni employé, ni manager, ni personne d'autre par
--            PostgREST. La table n'a plus, après ce fichier, la moindre
--            politique INSERT, UPDATE ou DELETE : son seul chemin
--            d'écriture est une commande SECURITY DEFINER détenue par
--            postgres, propriétaire de la table, pour qui la RLS n'est
--            pas forcée.
--
--            LA SECONDE DETTE VAGUE 2 EST LEVÉE ELLE AUSSI. Elle disait :
--            « la suppression complète de insert_fdj_cash_controls et
--            update_fdj_cash_controls est un livrable de Vague 2, après
--            bascule de l'écran manager ». La bascule a été faite le
--            17/09/2026 : les sept écritures directes de
--            NEXUS-FDJ-Manager-v1.html sur cette table ont été remplacées
--            par fdj_ouvrir_controle_caisse, fdj_saisir_caisse_manager,
--            fdj_corriger_caisse_manager, fdj_valider_caisse,
--            fdj_rouvrir_caisse et fdj_traiter_demande_correction. La
--            dernière — un recalcul d'écart après rétablissement de
--            chaîne, qui réécrivait ventes, caisse grattage, caisse
--            attendue et écart avec `acteur_id: null` — passe désormais
--            par fdj_corriger_caisse_manager, qui fait le même calcul
--            sous l'identité réelle du manager et avec un motif.
--
--            Ce que change concrètement la suppression, au-delà de la
--            symétrie : un manager ne peut plus écrire `valide_par`,
--            `resultat_controle`, `motif_ecart_texte` ni `ecart` à la
--            main, donc plus valider une caisse sans passer par les
--            contrôles de fdj_valider_caisse (quart clos, caisse
--            confirmée, version attendue), ni corriger sans motif, ni
--            corriger sans laisser d'événement de journal. Une politique
--            d'écriture managériale n'est pas une garde : elle dit QUI
--            écrit, jamais SOUS QUELLES CONDITIONS.
-- ---------------------------------------------------------------------

drop policy if exists select_fdj_cash_controls on public.fdj_cash_controls;
create policy select_fdj_cash_controls on public.fdj_cash_controls
  for select
  using (public.fdj_je_controle_le_site(site));

-- Fermeture complète de l'écriture. Ces deux `drop` sont l'aboutissement
-- de la Vague 1 : ils n'ont plus aucun appelant dans le dépôt, et le
-- contrôle 7.a échoue si l'un d'eux est recréé par mégarde.
drop policy if exists insert_fdj_cash_controls on public.fdj_cash_controls;
drop policy if exists update_fdj_cash_controls on public.fdj_cash_controls;

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
-- Écriture : CONSERVÉE au site, et c'est un choix, pas un report. Voir
--            le point (c) de l'en-tête. Côté employé il ne reste qu'UN
--            appelant — validerOuverture() (NEXUS-FDJ-v1.html:1460) ;
--            l'insert du parcours carnets (ex-1660) a disparu avec la
--            bascule sur fdj_activer_carnet, qui journalise elle-même.
--            Côté manager, six inserts subsistent, tous hors du cycle de
--            caisse : les gestes du cycle journalisent maintenant dans
--            les commandes.
--            Ce qui est fermé, et qui est l'essentiel de ce que vaut un
--            journal : on ne peut pas imputer une action à quelqu'un
--            d'autre que soi (trigger 4.b), et on ne peut ni modifier ni
--            effacer ce qui y est écrit (aucune politique UPDATE ni
--            DELETE, §6).
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
-- acteur_id null est admis : trois écritures du manager journalisent des
-- recalculs automatiques que personne n'a demandés (NEXUS-FDJ-Manager
-- 1871, 1913, 2028) — « auteur inconnu » est un fait, pas un trou. Elles
-- étaient quatre avant le 17/09 ; la quatrième réécrivait l'écart de
-- caisse et a été basculée sur fdj_corriger_caisse_manager, qui
-- journalise sous l'identité réelle du manager.
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
-- Ici la suppression des politiques reste impossible, des deux côtés :
--   · l'employé écrit encore fdj_shifts.previous_shift_id (718),
--     fdj_shifts.ouverture_validee (1421) et fdj_shift_counts (1417) ;
--   · le manager crée des quarts, en modifie le statut et le suivi de
--     relevé, et upserte les comptages.
-- Mais UNE colonne, elle, est fermée pour tout le monde : `employee_id`.
-- Voir 5.a.
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
-- Quatre cas, dans cet ordre :
--   1. écriture par une commande serveur → laissée passer (c'est elle
--      qui porte les vérifications du §5.3) ;
--   2. CHANGEMENT DE TITULAIRE (`employee_id`) par écriture directe →
--      REFUSÉ, y compris au manager. C'est la correction du 17/09/2026,
--      et elle est testée AVANT le passage manager, délibérément : la
--      version 2 de ce fichier laissait passer tout manager du site et
--      nommait une dette Vague 2 (« NEXUS-FDJ-Manager-v1.html:5510
--      réattribue un quart sans motif ni journal »). La relecture de la
--      PR #62 a refusé cette dette. Le §2.3 veut qu'une reprise soit
--      « explicite, justifiée et journalisée » : c'est exactement ce que
--      fdj_transferer_responsabilite_quart impose — même site, quart non
--      validé, motif d'au moins cinq caractères, événement de journal et
--      ligne de transfert. Une écriture de colonne n'impose rien de tout
--      cela, et rien ne distingue après coup un transfert légitime d'une
--      réattribution silencieuse. L'écran manager a été basculé le même
--      jour ; cette garde est ce qui garantit qu'il le reste.
--   3. autre écriture directe par un manager du site → laissée passer.
--      Ce qu'il écrit encore (statut, releve_cloture_statut, version)
--      est hors du cycle de caisse : voir le point (d) de l'en-tête.
--   4. écriture directe par quelqu'un d'autre → seules les colonnes que
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

  -- Cas 2 — avant le passage manager, et pour tout le monde : le
  -- titulaire d'un quart ne change pas par une écriture de colonne.
  if new.employee_id is distinct from old.employee_id then
    raise exception
      'Quart FDJ : changer de titulaire est un transfert de responsabilité, pas une modification de champ.'
      using errcode = '42501',
            hint = 'Appeler fdj_transferer_responsabilite_quart(p_shift_id, p_nouvel_employe_id, p_motif) : elle exige un motif, vérifie le site et journalise le transfert.';
  end if;

  if public.fdj_je_controle_le_site(old.site) then
    return new;
  end if;

  -- Liste blanche : ce qu'une écriture directe d'employé peut encore
  -- toucher, et rien d'autre. (validerOuverture : ouverture_validee,
  -- ouverture_validee_le ; chargerDernierStockFinal : previous_shift_id.)
  -- `employee_id` n'y figure plus : il est traité au-dessus, pour tout
  -- le monde, et le répéter ici laisserait croire qu'il n'est fermé que
  -- pour l'employé.
  if new.id                     is distinct from old.id
     or new.site                is distinct from old.site
     or new.date                is distinct from old.date
     or new.quart               is distinct from old.quart
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
  'Vague 1 Phase C — PERSONNE ne peut changer le titulaire (employee_id) '
  'd''un quart FDJ par écriture directe : ni employé, ni manager. Le '
  'transfert passe par fdj_transferer_responsabilite_quart, qui exige un '
  'motif et journalise. Au-delà de cette colonne, un employé ne peut pas '
  'davantage changer le site, la date, le numéro ni l''état d''un quart : '
  'seules les colonnes de la validation d''ouverture lui restent ouvertes. '
  'Ne mord pas sur les commandes serveur (current_user = propriétaire).';

-- 5.b — fdj_shifts : les politiques restent celles du site.
-- Elles ne sont pas récrites ici : les modifier sans pouvoir les
-- restreindre n'apporterait rien et brouillerait le retour arrière. Ce
-- qui devait être fermé sur cette table l'est par 5.a, colonne par
-- colonne, ce qu'une politique ne sait pas faire.
-- fdj_shift_counts : inchangée (validerOuverture côté employé, upsert
-- côté manager). DERNIÈRE DETTE ENCORE OUVERTE de la Vague 1, et la
-- seule : un employé peut encore écraser le comptage d'un quart de son
-- site qui n'est pas le sien. Elle tient dans le point (d) de l'en-tête —
-- hors cycle de caisse, aucun montant, aucun verdict, aucune identité de
-- contrôleur — et sa fermeture suppose une commande serveur de validation
-- d'ouverture, que le §5.3 du mandat n'énumère pas.

-- ---------------------------------------------------------------------
-- §5 bis — fdj_stock_movements
--
-- Table ajoutée au périmètre de ce fichier le 17/09/2026. Elle n'y
-- figurait pas : la version 2 la mentionnait dans deux commentaires et
-- la laissait entièrement ouverte, au motif que le parcours carnets de
-- l'écran employé insérait lui-même ses mouvements. La relecture de la
-- PR #62 a refusé ce report, et le mandat a demandé les commandes qui
-- manquaient.
--
-- CE QUI ÉTAIT OUVERT, exactement (politique d'origine, migration
-- 20260809130450) : `insert_fdj_stock_movements`, en
-- `site = current_employee_site_id()`. Un employé posait donc la ligne
-- entière, `employee_id` compris : il pouvait attribuer une activation
-- ou un retour de carnet à un collègue du site, ou la dater comme il
-- voulait. Ce n'est pas une hypothèse d'école — c'est précisément ce que
-- les colonnes `created_by` et `effective_at` ajoutées par la Phase A
-- servent à départager : QUI a saisi, et POUR QUAND. Laissées au front,
-- elles n'auraient rien départagé du tout.
--
-- Lecture  : CONSERVÉE au site. C'est le stock du magasin, pas une
--            donnée personnelle, et l'écran employé comme les écrans
--            d'analyse en dépendent. Rien n'y est confidentiel : ni
--            montant de caisse, ni verdict, ni commentaire interne.
--
-- Écriture : AUCUNE. Les activations et les mouvements passent par
--            fdj_activer_carnet et fdj_enregistrer_mouvement_stock
--            (migration 20260916221000), qui déterminent SERVEUR
--            l'auteur (auth.uid()), l'employé responsable (le titulaire
--            du quart, pas celui que le client annonce), le site et le
--            quart (depuis le quart autorisé), la date d'effet et la clé
--            d'idempotence. Un employé ne peut donc plus fournir
--            arbitrairement l'un de ces champs, et un manager qui saisit
--            la feuille à la place d'un employé produit une ligne où
--            `employee_id` reste l'employé opérationnel tandis que
--            `created_by` devient le manager — ce que l'insert direct ne
--            savait pas exprimer.
-- ---------------------------------------------------------------------

drop policy if exists insert_fdj_stock_movements on public.fdj_stock_movements;

-- La lecture est recréée à l'identique plutôt que laissée telle quelle :
-- ce fichier doit pouvoir être relu comme l'état CIBLE de la table, pas
-- comme un diff de ce qui existait. Le prédicat est celui d'origine.
drop policy if exists select_fdj_stock_movements on public.fdj_stock_movements;
create policy select_fdj_stock_movements on public.fdj_stock_movements
  for select
  using (site = (select public.current_employee_site_id()));

-- ---------------------------------------------------------------------
-- §6 — DELETE
--
-- Aucune des huit tables n'a jamais eu de politique DELETE. Sous RLS
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

  -- 7.b — TROIS tables sont fermées pour de bon : aucune écriture
  -- directe, pas même managériale. C'est le contrôle qui a le plus
  -- changé le 17/09/2026 : il ne portait que sur fdj_corrections, il
  -- porte maintenant aussi sur fdj_cash_controls et
  -- fdj_stock_movements, dont les politiques d'écriture ont été
  -- supprimées avec la bascule des deux écrans.
  --
  -- Formulé table par table, et pas en un seul count : « il reste des
  -- politiques » n'aide personne à savoir laquelle rouvrir.
  select count(*), string_agg(tablename || '.' || policyname || ' (' || cmd || ')', ', ')
    into v_n, v_manquantes
    from pg_policies
   where schemaname = 'public'
     and tablename in ('fdj_corrections', 'fdj_cash_controls', 'fdj_stock_movements')
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  if v_n <> 0 then
    raise exception
      'Phase C : ces trois tables ne doivent plus avoir AUCUNE politique d''écriture (leur seul chemin est une commande serveur) — % trouvée(s) : %.',
      v_n, v_manquantes;
  end if;

  -- 7.c — La RLS est bien ACTIVE sur les huit tables (sept jusqu'au
  -- 17/09/2026 ; fdj_stock_movements est entrée au périmètre avec le
  -- §5 bis). Sans elle, une politique ne s'applique pas : la table
  -- serait GRANDE OUVERTE, et non fermée. C'est l'erreur qui ne se voit
  -- pas — et elle se verrait d'autant moins sur fdj_stock_movements,
  -- dont on vient de SUPPRIMER la politique d'écriture : sans RLS,
  -- supprimer une politique ouvre au lieu de fermer.
  select count(*) into v_n
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('fdj_cash_controls', 'fdj_reports', 'fdj_releves_cloture',
                       'fdj_corrections', 'fdj_audit_log', 'fdj_shifts',
                       'fdj_shift_counts', 'fdj_stock_movements')
     and c.relrowsecurity;
  if v_n <> 8 then
    raise exception 'Phase C : RLS active sur % table(s) sur 8 — une table sans RLS est ouverte, pas fermée.', v_n;
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

  -- 7.e — La lecture des caisses n'est ouverte QU'au manager du site.
  -- Formulé en négatif, et c'est voulu : compter les politiques
  -- managériales dirait « il en existe une », pas « il n'en existe pas
  -- d'autre ». Une seconde politique SELECT, même laissée par une
  -- version antérieure de ce fichier, s'additionnerait à la première —
  -- les politiques permissives sont un OU, pas un ET.
  select count(*) into v_n
    from pg_policies
   where schemaname = 'public' and tablename = 'fdj_cash_controls'
     and cmd in ('SELECT', 'ALL')
     and coalesce(qual, '') not like '%fdj_je_controle_le_site%';
  if v_n <> 0 then
    raise exception
      'Phase C : % politique(s) de lecture non managériale(s) sur fdj_cash_controls — la table reste lisible par un employé, colonnes du manager comprises.', v_n;
  end if;

  -- 7.f — Et le prédicat « c'est mon quart » n'existe plus : l'écran
  -- Progression passe par fdj_ma_progression_caisse(). Une fonction de
  -- prédicat qu'aucune politique n'appelle est une porte qu'on croit
  -- condamnée ; la prochaine politique écrite à la hâte la rouvrirait
  -- sans que personne ait à la réécrire.
  if to_regprocedure('public.fdj_est_mon_quart(uuid)') is not null then
    raise exception 'Phase C : fdj_est_mon_quart existe encore — la clause de lecture employé n''a pas été retirée.';
  end if;

  -- 7.g — La projection qui REMPLACE cette lecture est bien là. Fermer
  -- sans elle ne sécurise rien : cela vide « Ma Progression », en
  -- silence et sans erreur.
  if to_regprocedure('public.fdj_ma_progression_caisse(integer)') is null then
    raise exception 'Phase C : fdj_ma_progression_caisse absente — appliquer cette fermeture viderait l''onglet FDJ de Ma Progression.';
  end if;

  -- 7.h — Les SUBSTITUTS des écritures qu'on vient de supprimer existent.
  -- C'est le contrôle qui manquait à la version 2, et c'est celui dont
  -- l'absence coûterait le plus cher : les §2 et §5 bis suppriment des
  -- politiques, et une politique supprimée sans sa commande de
  -- remplacement ne sécurise rien — elle met l'établissement à l'arrêt.
  -- La condition C1 le demande en prose ; ici la base le vérifie.
  --
  -- to_regprocedure exige la signature exacte : un paramètre ajouté à une
  -- commande crée une surcharge et ne satisfait plus ce contrôle. C'est
  -- voulu — c'est exactement la signature que le front appelle.
  select string_agg(p, ', ') into v_manquantes
    from unnest(array[
      -- Écran manager (§4 du mandat de relecture) : prise en contrôle,
      -- saisie, correction, validation, réouverture, décision sur une
      -- demande, transfert de responsabilité.
      'public.fdj_ouvrir_controle_caisse(uuid)',
      'public.fdj_saisir_caisse_manager(uuid,numeric,text,numeric,text,text,text)',
      'public.fdj_corriger_caisse_manager(uuid,text,numeric,numeric,text)',
      'public.fdj_valider_caisse(uuid,text,text,text)',
      'public.fdj_rouvrir_caisse(uuid,text)',
      'public.fdj_traiter_demande_correction(uuid,text,text)',
      'public.fdj_demandes_correction_du_quart(uuid)',
      'public.fdj_transferer_responsabilite_quart(uuid,uuid,text)',
      -- Activations et mouvements (§3 du mandat), substituts directs de
      -- la politique insert_fdj_stock_movements supprimée au §5 bis.
      'public.fdj_activer_carnet(uuid,uuid,numeric,text,text,text,text,uuid)',
      'public.fdj_enregistrer_mouvement_stock(text,jsonb,text,text,text,text,timestamptz)'
      -- fdj_ma_progression_caisse(integer) manque volontairement à cette
      -- liste : 7.g la vérifie déjà, avec son propre message. L'ajouter
      -- ici ne serait jamais atteint.
    ]) as p
   where to_regprocedure(p) is null;
  if v_manquantes is not null then
    raise exception
      'Phase C : commande(s) de remplacement absente(s) — %. Appliquer ce fichier sans elles rend le cycle de caisse inutilisable (condition C1).',
      v_manquantes;
  end if;

  raise notice 'Phase C — les huit contrôles passent.';
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
--                         'fdj_corrections','fdj_audit_log','fdj_shifts',
--                         'fdj_shift_counts','fdj_stock_movements')
--     order by tablename, cmd, policyname;
--
--    Attendu : 16 politiques sur 8 tables. Le décompte tient en entier
--    ici — le renvoi au « dossier de PR » de la version précédente était
--    une dette de relecture, et le chiffre qu'il accompagnait était faux.
--
--      AVANT (20, relevées le 17/09/2026 sur Test, conformes à Production)
--        fdj_cash_controls    select, insert, update        3
--        fdj_reports          select, insert, update        3
--        fdj_releves_cloture  select, insert                2
--        fdj_corrections      select, insert                2
--        fdj_audit_log        select, insert                2
--        fdj_shifts                                         3
--        fdj_shift_counts                                   3
--        fdj_stock_movements  select, insert                2
--
--      APRÈS (16)
--        fdj_cash_controls    select                        1   (-2)
--        fdj_reports          select, insert, update        3
--        fdj_releves_cloture  select, insert                2
--        fdj_corrections      select                        1   (-1)
--        fdj_audit_log        select, insert                2
--        fdj_shifts                                         3
--        fdj_shift_counts                                   3
--        fdj_stock_movements  select                        1   (-1)
--
--    Quatre politiques d'écriture retirées, aucune ajoutée. Les six
--    politiques de fdj_shifts et fdj_shift_counts ne sont pas touchées :
--    fdj_shifts est resserrée par un TRIGGER (§5), pas par ses
--    politiques — un trigger voit l'ancienne et la nouvelle ligne, une
--    politique non.
--
--    Et aucune politique d'écriture sur les quatre tables de montants ne
--    cite current_employee_site_id : sur trois d'entre elles il n'y a
--    plus de politique d'écriture du tout.
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
-- 4) Le comportement qui doit CONTINUER de marcher — Ma Progression.
--    Les deux moitiés comptent : la fermeture SANS la première est une
--    régression, la première SANS la fermeture est la fuite.
--
--    begin;
--      set local role authenticated;
--      set local request.jwt.claims = '{"sub":"<uuid employé>","role":"authenticated"}';
--
--      -- a) l'employé voit toujours ses propres caisses, par la projection
--      select count(*) from public.fdj_ma_progression_caisse();
--                                                      -- attendu : > 0
--
--      -- b) et il ne lit plus la table en direct, ni les siennes ni
--      --    celles de ses collègues — 0 ligne, sans erreur : la RLS
--      --    masque, elle ne refuse pas.
--      select count(*) from public.fdj_cash_controls;  -- attendu : 0
--    rollback;
--
-- 5) La mutation qui doit ÉCHOUER — un employé pose un mouvement de
--    stock en direct, et s'en attribue (ou en attribue à un collègue)
--    la paternité. Avant cette phase, la politique d'insertion ne
--    regardait que le site : la ligne entière, employee_id compris,
--    était à la main du poste client.
--
--    begin;
--      set local role authenticated;
--      set local request.jwt.claims = '{"sub":"<uuid employé>","role":"authenticated"}';
--      insert into public.fdj_stock_movements (site, game_id, quantite, type_mouvement, employee_id)
--      values ('<site>', '<jeu>', 1, 'activation', '<uuid d''un collègue>');
--                                                      -- attendu : 42501
--    rollback;
--
--    Le chemin qui doit CONTINUER de marcher, dans la même transaction :
--      select public.fdj_activer_carnet('<quart>', '<jeu>', 1, 'quantite', '<jeton>');
--    ('quantite' et non 'manuelle' : la contrainte check de
--    methode_identification n'admet que quantite, scan,
--    saisie_manuelle, implicite_appro et
--    reconstituee_correction_manager — une méthode inventée
--    ferait échouer ce contrôle sur la contrainte, pas sur la garde.)
--    et la ligne écrite porte created_by = auth.uid(), employee_id = le
--    responsable opérationnel du quart, site et shift_id venant du quart.
--
-- 6) La mutation qui doit ÉCHOUER — un MANAGER réattribue un quart par
--    une écriture de colonne. C'est le seul des six contrôles de cette
--    liste qui se joue sous un compte manager : jusqu'au 17/09/2026, le
--    trigger du §5 laissait passer le manager sur toute la liste
--    blanche, employee_id compris.
--
--    begin;
--      set local role authenticated;
--      set local request.jwt.claims = '{"sub":"<uuid manager>","role":"authenticated"}';
--      update public.fdj_shifts set employee_id = '<uuid autre employé>'
--       where id = '<quart de son site>';              -- attendu : 42501
--
--      -- le geste légitime, lui, passe — et exige un motif :
--      select public.fdj_transferer_responsabilite_quart(
--               '<quart>', '<uuid autre employé>', 'passation de poste 14h');
--    rollback;
--
-- =====================================================================
-- RETOUR ARRIÈRE
--
-- Condition d'arrêt : ne l'exécuter QUE si le front a lui aussi été remis
-- en arrière. Rouvrir les écritures directes alors que le front basculé
-- est servi ne répare rien et rouvre tout.
--
-- Il restaure les 20 politiques d'origine, telles que relevées le
-- 17/09/2026 sur Test ET conformes à Production : toutes en
-- `site = current_employee_site_id()`, rôle public, aucune DELETE.
-- (18 jusqu'au 17/09/2026 : fdj_stock_movements est entrée au périmètre
-- avec le §5 bis, et ses deux politiques doivent être restaurées elles
-- aussi — sans quoi le retour arrière laisse le stock fermé sans
-- personne pour l'écrire.)
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
--   drop policy if exists select_fdj_stock_movements on public.fdj_stock_movements;
--   drop policy if exists insert_fdj_stock_movements on public.fdj_stock_movements;
--   create policy select_fdj_stock_movements on public.fdj_stock_movements
--     for select using (site = (select current_employee_site_id()));
--   create policy insert_fdj_stock_movements on public.fdj_stock_movements
--     for insert with check (site = (select current_employee_site_id()));
--
--   -- Les SIX POLITIQUES de fdj_shifts et fdj_shift_counts n'ont pas été
--   -- modifiées par la Phase C : il n'y a rien à restaurer de ce côté.
--   -- Attention toutefois : fdj_shifts A bien été resserrée, par le
--   -- trigger fdj_shifts_garde_colonnes — c'est le `drop trigger` en
--   -- tête de ce bloc qui la rouvre, pas une politique. Sauter ce
--   -- `drop trigger` laisserait le transfert de responsabilité refusé
--   -- alors même que la commande qui le remplace n'existe peut-être
--   -- plus.
--
--   -- Le prédicat peut rester : il ne donne aucun droit par lui-même.
--   -- Pour le retirer malgré tout :
--   -- drop function if exists public.fdj_je_controle_le_site(text);
--
--   -- fdj_est_mon_quart n'a pas à être recréée : ce fichier ne la crée
--   -- plus, il la supprime. Elle n'était utile qu'à l'écran Progression
--   -- d'avant la projection ; si c'est CET écran-là qu'on remet en
--   -- service, la politique restaurée ci-dessus (« tout le site ») lui
--   -- suffit déjà — et rouvre du même coup la fuite de colonnes que la
--   -- projection avait fermée. À ne faire qu'en connaissance de cause.
--
-- commit;
-- =====================================================================
