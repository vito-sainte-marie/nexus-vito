-- Clôture des services (04/09/2026)
--
-- Constat en base : les 227 prises de poste étaient TOUTES `en_cours`,
-- aucune ne portait de `heure_fin`, de juillet à septembre 2026. Rien, dans
-- le code, n'écrivait jamais `statut = 'termine'`. La colonne ne portait
-- donc aucune information : « en cours » était la seule valeur jamais
-- écrite, ce qui interdisait toute règle fondée sur la fin d'un service.
--
-- Second constat, décisif pour la conception : `station_config.pointage_actif`
-- vaut false sur vito-sainte-marie. Le pointage est désactivé à la station —
-- 11 départs pointés en tout, aucun depuis le 14/08/2026. Fonder la clôture
-- sur le pointage de départ, la solution évidente, ne clôturerait donc
-- RIEN ici. La clôture repose sur plusieurs signaux réels, le pointage
-- n'étant que l'un d'eux, disponible seulement là où il est activé.
--
-- Règle absolue posée par Frédéric : NEXUS n'invente jamais une heure de
-- départ. Un service dont on sait qu'il est fini, mais dont on ignore
-- quand, se dit — il ne se devine pas. D'où deux états de clôture
-- distincts, et une contrainte qui rend l'invention impossible :
--
--   termine             fin connue      heure_fin OBLIGATOIRE
--   clos_sans_pointage  fin inconnue    heure_fin INTERDITE
--
-- Et deux qualifications qui ne sont pas des clôtures :
--   legacy              service antérieur à ce mécanisme, jamais clôturé
--   test                prise de poste de test, hors résultats de l'employé
--
-- Aucune clôture ne peut être déclenchée par la seule heure courante
-- (exigence de Frédéric). L'horloge ne sert qu'à SIGNALER au manager un
-- service resté ouvert — c'est lui qui tranche. Les signaux de clôture
-- sont tous des événements réels : l'employé termine, il pointe son
-- départ, il ouvre un nouveau service, ou le manager corrige.

-- 1. Journal de clôture. Un service clôturé dit toujours par qui, quand,
--    par quel chemin et, le cas échéant, pourquoi.
alter table public.shifts
  add column if not exists cloture_par uuid references public.employees(id),
  add column if not exists cloture_le timestamptz,
  add column if not exists cloture_source text,
  add column if not exists cloture_motif text;

alter table public.shifts drop constraint if exists shifts_cloture_source_check;
alter table public.shifts add constraint shifts_cloture_source_check
  check (cloture_source is null or cloture_source = any (array[
    'employe',                  -- l'employé a terminé son service
    'pointage_depart',          -- pointage de départ, là où le pointage est actif
    'manager',                  -- clôture ou correction manager
    'prise_de_poste_suivante',  -- l'employé a ouvert un nouveau service
    'systeme_legacy',           -- qualification des services antérieurs
    'test'                      -- prise de poste de test
  ]));

-- 2. Nouveaux états.
alter table public.shifts drop constraint if exists shifts_statut_check;
alter table public.shifts add constraint shifts_statut_check
  check (statut = any (array['en_cours', 'termine', 'clos_sans_pointage', 'legacy', 'test']));

-- 3. Les garanties qui empêchent d'inventer une heure de départ, et qui
--    empêchent un service de changer d'état sans laisser de trace.
alter table public.shifts drop constraint if exists shifts_heure_fin_coherente;
alter table public.shifts add constraint shifts_heure_fin_coherente check (
  (statut = 'termine' and heure_fin is not null)
  or (statut = 'en_cours' and heure_fin is null)
  or (statut in ('clos_sans_pointage', 'legacy', 'test') and heure_fin is null)
);

alter table public.shifts drop constraint if exists shifts_journal_cloture;
alter table public.shifts add constraint shifts_journal_cloture check (
  statut = 'en_cours'
  or (cloture_source is not null and cloture_le is not null)
);

-- 4. Qualification des services antérieurs. Aucune heure_fin n'est créée :
--    ces services sont marqués pour ce qu'ils sont — des données d'avant le
--    mécanisme, dont personne ne sait quand elles se sont terminées.
--    La prise de poste de test réalisée avec le compte de Nadine le
--    04/09/2026 est distinguée : c'était un test, pas un service réel, et
--    elle ne doit pas peser dans ses résultats.
update public.shifts
set statut = 'test',
    cloture_source = 'test',
    cloture_le = now(),
    cloture_motif = 'Prise de poste de test du 04/09/2026 (contrôle de l''isolation des missions) — hors résultats de l''employé.'
where id = 'cef4fd7b-3430-4e5d-b6bb-07b26e9b83fd';

update public.shifts
set statut = 'legacy',
    cloture_source = 'systeme_legacy',
    cloture_le = now(),
    cloture_motif = 'Service antérieur à la clôture des services (04/09/2026) : jamais clôturé, heure de fin inconnue. Aucune heure de départ n''a été inventée.'
where statut = 'en_cours';

-- 5. Retrouver le service ouvert d'un employé doit être immédiat : c'est la
--    requête que feront tous les écrans.
create index if not exists idx_shifts_employee_statut
  on public.shifts using btree (employee_id, statut, heure_debut desc);

comment on column public.shifts.statut is
  'en_cours = service ouvert · termine = clôturé, heure_fin connue · clos_sans_pointage = clôturé, fin réelle inconnue (jamais inventée) · legacy = service antérieur au mécanisme de clôture · test = prise de poste de test, hors résultats.';
comment on column public.shifts.cloture_source is
  'Par quel chemin le service a été clôturé. Jamais par la seule heure courante : l''horloge ne fait que signaler au manager un service resté ouvert.';
