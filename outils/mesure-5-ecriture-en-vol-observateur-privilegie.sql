-- Mesure #5 — écritures en vol sur les tables touchées par les migrations #3 et #6
-- ============================================================================
-- À EXÉCUTER AU MOMENT DE LA GATE, par un observateur DÉJÀ privilégié
-- (connecteur Supabase, rôle postgres), en lecture seule. Cette requête n'est
-- PAS exécutable par `nexus_prod_readonly` et ne doit pas le devenir : la
-- rendre exécutable exigerait `pg_read_all_stats`, qui donnerait au rôle
-- d'audit le texte des requêtes de toutes les sessions — donc, potentiellement,
-- des données personnelles, des identifiants et des valeurs métier.
--
-- ── Ce que « écriture en vol » veut dire ici ────────────────────────────────
--
-- PAS une session active. Une session `active` peut exécuter un SELECT, un
-- VACUUM, un pg_dump : rien de cela ne verrouille une ligne ni ne menace une
-- migration. La mesure du 10/09 confondait les deux et rendait « 0 » parce
-- qu'elle cherchait un motif textuel — un proxy, encore.
--
-- Une écriture en vol est une session qui remplit AU MOINS l'une des deux
-- conditions suivantes, toutes deux vérifiables sans lire une seule requête :
--
--   A. `backend_xid is not null` — la session a obtenu un identifiant de
--      transaction réel. PostgreSQL n'en attribue un qu'au moment où la
--      transaction écrit effectivement. Une transaction qui n'a fait que lire
--      n'en a pas. C'est le fait, pas son ombre.
--
--   B. elle détient sur `public.shifts`, `public.mission_catalog` ou
--      `public.pointages` un verrou de niveau RowExclusiveLock ou supérieur —
--      les niveaux que seuls INSERT / UPDATE / DELETE / DDL prennent. Un SELECT
--      prend AccessShareLock, qui n'apparaît pas ici.
--
-- La condition B rattrape le cas où la session a verrouillé mais n'a pas encore
-- obtenu son xid ; la condition A rattrape le cas où elle a écrit sur une autre
-- table de la même transaction. Ni l'une ni l'autre ne dépend d'un motif
-- textuel, donc aucune ne peut se reconnaître elle-même.
--
-- ── Ce que la requête rend ──────────────────────────────────────────────────
--
-- Uniquement des identifiants techniques : pid, rôle, nom d'application, état,
-- ancienneté, motif. AUCUN texte de requête, jamais — ni dans la sortie, ni
-- dans le rapport. `pg_backend_pid()` exclut l'observateur lui-même.
--
-- ── Lecture du résultat ─────────────────────────────────────────────────────
--
--   0 ligne  → aucune écriture en vol sur les tables concernées. Mesure #5 OK.
--   ≥1 ligne → reporter l'exécution de quelques secondes et rejouer. Une
--              écriture qui persiste plusieurs minutes n'est pas une
--              transaction de passage : chercher qui, avant d'appliquer.
--
-- Tant que cette requête n'a pas été exécutée dans les minutes précédant la
-- fenêtre, la mesure #5 vaut INCONNU. Pas OK. INCONNU.
-- ============================================================================

with cibles as (
  select unnest(array['public.shifts','public.mission_catalog','public.pointages'])::regclass as rel
),
verrous_ecriture as (
  select distinct l.pid
    from pg_locks l
    join cibles c on c.rel = l.relation
   where l.locktype = 'relation'
     and l.granted
     and l.mode in ('RowExclusiveLock','ShareRowExclusiveLock',
                    'ExclusiveLock','AccessExclusiveLock')
)
select a.pid,
       a.usename                       as role_connecte,
       a.application_name,
       a.state,
       a.backend_xid is not null       as transaction_ecrivante,
       (v.pid is not null)             as verrou_ecriture_sur_cible,
       date_trunc('second', now() - a.xact_start) as anciennete_transaction
  from pg_stat_activity a
  left join verrous_ecriture v on v.pid = a.pid
 where a.datname = current_database()
   and a.pid <> pg_backend_pid()
   and a.state is distinct from 'idle'
   and (a.backend_xid is not null or v.pid is not null)
 order by a.xact_start;
