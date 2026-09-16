-- =====================================================================
-- S-1 · Reprise des services ouverts, puis unicité du service en cours
--       (05/09/2026 — bloqueur production « cycle de vie des shifts »)
--
-- CE QUE LA RECETTE A ÉTABLI
--
-- NEXUS contient UN insert dans `shifts` (la prise de poste) et ZÉRO
-- update. Aucun code ne ferme jamais un service. Les colonnes heure_fin,
-- cloture_source et cloture_le existent, trois contraintes veillent sur
-- leur cohérence, et la contrainte shifts_cloture_source_check nomme même
-- les deux événements attendus — 'pointage_depart' et
-- 'prise_de_poste_suivante'. Le contrat a été modélisé en entier, puis
-- jamais implémenté.
--
-- Preuve du 05/09/2026 : un départ pointé à 14:47, photo de mise en alarme
-- à l'appui, laisse le service `en_cours` avec heure_fin null.
--
-- CE QUE FAIT CETTE MIGRATION, ET DANS CET ORDRE
--
--   1. reprise des services qui ne peuvent plus être ouverts ;
--   2. contrôle fail-closed ;
--   3. index unique partiel.
--
-- L'ORDRE EST IMPÉRATIF. Manager Test a trois services `en_cours` : créer
-- l'index d'abord ferait échouer la migration.
--
-- CE QU'ELLE NE FAIT PAS
--
--   * elle n'invente AUCUNE heure de fin. `heure_fin` reste NULL, ce que
--     shifts_heure_fin_coherente autorise explicitement pour
--     'clos_sans_pointage' ;
--   * elle ne marque rien 'termine' : un service terminé exige une heure de
--     fin connue, et nous ne la connaissons pas ;
--   * elle ne rattache pas le départ pointé le 05/09 par Employé Test B au
--     service du 04/09. Le lien est plausible, il n'est pas prouvé. Une
--     fausse précision serait pire qu'une absence assumée ;
--   * elle n'implémente aucune clôture applicative — c'est S-2 et S-3.
--
-- `cloture_le` n'est pas l'heure de fin du service : c'est l'heure à
-- laquelle NEXUS a constaté qu'il ne pouvait plus être ouvert. C'est un
-- fait, et c'est autre chose.
-- =====================================================================

begin;

-- ── 1. Reprise ──────────────────────────────────────────────────────
-- Deux motifs, et deux seulement :
--   a) le service appartient à un jour STATION antérieur — un service de
--      la veille ne peut pas être encore en cours ;
--   b) un service plus récent existe pour le même employé — c'est un
--      doublon, constaté à 7 secondes d'intervalle le 05/09.
--
-- Le jour est calculé dans le fuseau de la station (sites.timezone, A3-3),
-- jamais en UTC : la frontière de journée est une notion de commerce.
with a_reprendre as (
  select sh.id
  from public.shifts sh
  join public.employees e on e.id = sh.employee_id
  join public.sites s on s.site_id = e.site_id
  where sh.statut = 'en_cours'
    and (
      (sh.heure_debut at time zone s.timezone)::date
        < (now() at time zone s.timezone)::date
      or sh.id <> (
        select sh2.id from public.shifts sh2
        where sh2.employee_id = sh.employee_id and sh2.statut = 'en_cours'
        order by sh2.heure_debut desc limit 1
      )
    )
)
update public.shifts sh
   set statut = 'clos_sans_pointage',
       heure_fin = null,                    -- inconnue, jamais inventée
       cloture_source = 'systeme_legacy',   -- reprise de données, pas un acte métier
       cloture_le = now()
  from a_reprendre r
 where sh.id = r.id;

-- ── 2. Contrôle fail-closed ─────────────────────────────────────────
-- S'il reste plus d'un service ouvert par employé, la migration échoue en
-- les nommant, plutôt que de laisser la création d'index produire une
-- erreur d'unicité illisible.
do $ctrl$
declare v_coupables text;
begin
  select string_agg(employee_id::text || ' (' || n || ' services)', ', ')
    into v_coupables
    from (select employee_id, count(*) as n from public.shifts
          where statut = 'en_cours' group by employee_id having count(*) > 1) t;
  if v_coupables is not null then
    raise exception 'S-1 : la reprise laisse plusieurs services ouverts pour %. L''index ne peut pas être créé.', v_coupables;
  end if;
end
$ctrl$;

-- ── 3. Unicité du service en cours ──────────────────────────────────
-- La clause WHERE exclut de l'index tout service clos : un employé peut
-- accumuler autant d'historique 'termine' ou 'clos_sans_pointage' que
-- nécessaire, mais un seul service ouvert à la fois.
--
-- Sur employee_id seul : un employé appartient à un site unique, et
-- shifts.site = site_id est déjà garanti (A2). Ajouter le site masquerait
-- un doublon inter-sites au lieu de l'interdire.
create unique index if not exists shifts_un_seul_service_en_cours
  on public.shifts (employee_id)
  where statut = 'en_cours';

comment on index public.shifts_un_seul_service_en_cours is
  'S-1 (05/09/2026) — au plus un service en_cours par employé. Seule barrière qui tienne face à un double clic, une double soumission ou deux onglets : le bouton désactivé côté écran n''a pas suffi, deux services identiques ayant été créés à 7 secondes d''intervalle.';

commit;
