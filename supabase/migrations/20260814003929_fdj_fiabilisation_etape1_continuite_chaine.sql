-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260814003929 · fdj_fiabilisation_etape1_continuite_chaine
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- NEXUS FDJ — Fiabilisation Étape 1 (13/08/2026, audit de cadrage développeur
-- de Frédéric). Fondations de la "chaîne FDJ" : chaque quart connaît
-- explicitement son prédécesseur (plutôt que de le recalculer à chaque
-- lecture via NexusFdjMoteur.quartPrecedentAttendu/chaineContinuite, déjà en
-- place depuis le 13/08/2026 — cette colonne les rend consultables
-- directement en SQL et servira de point d'ancrage aux Étapes 2 et 4
-- (propagation de correction, replay). previous_shift_id reste NULLABLE :
-- NULL signifie honnêtement "non résolu" (premier quart jamais compté, ou
-- chaîne rompue) — jamais une valeur inventée (Article 11, non-invention).
--
-- a_revoir / a_revoir_motif / a_revoir_depuis_le : au lieu de renommer le
-- statut existant ('brouillon'/'valide', déjà consommé à des dizaines
-- d'endroits dans NEXUS-FDJ-v1.html et NEXUS-FDJ-Manager-v1.html pour
-- distinguer "quart en cours" de "quart clôturé/soumis"), on ajoute un
-- indicateur ORTHOGONAL : un quart déjà 'valide' peut être marqué a_revoir
-- si une correction rétroactive sur un quart antérieur a changé sa donnée
-- d'entrée (Étape 2). Volontairement non-invasif : zéro requête existante
-- cassée par ce changement.
--
-- version / needs_replay : fondation pour l'Étape 4 (replay chronologique).
-- Non exploités par le code applicatif à ce stade — ajoutés maintenant pour
-- éviter une deuxième migration à l'Étape 4 sur une table déjà en
-- production.
alter table fdj_shifts
  add column if not exists previous_shift_id uuid references fdj_shifts(id),
  add column if not exists a_revoir boolean not null default false,
  add column if not exists a_revoir_motif text,
  add column if not exists a_revoir_depuis_le timestamptz,
  add column if not exists version integer not null default 1,
  add column if not exists needs_replay boolean not null default false;

comment on column fdj_shifts.previous_shift_id is 'Quart immédiatement précédent attendu (continuité stricte) — NULL = non résolu (premier quart ou chaîne rompue), jamais deviné. Voir NexusFdjMoteur.quartPrecedentAttendu.';
comment on column fdj_shifts.a_revoir is 'Vrai si une correction rétroactive sur un quart antérieur a invalidé les calculs de ce quart (Étape 2 fiabilisation FDJ, 13/08/2026) — orthogonal à statut.';
comment on column fdj_shifts.needs_replay is 'Fondation Étape 4 (replay chronologique) — pas encore consommé par le code applicatif au 13/08/2026.';

-- Backfill des 15 quarts existants : lien explicite vers le quart
-- immédiatement précédent au sens calendaire strict (même site, quart
-- consécutif), jamais "le quart créé juste avant en base" (create order
-- ≠ ordre chronologique métier — les deux coïncident aujourd'hui car les
-- données sont propres, mais on backfill sur la vraie règle, pas sur un
-- raccourci qui serait faux dans un cas moins propre).
with quarts_ordonnes as (
  select id, site, date, quart,
    lag(id) over (partition by site order by date, quart) as id_precedent_calendaire,
    lag(date) over (partition by site order by date, quart) as date_precedente,
    lag(quart) over (partition by site order by date, quart) as quart_precedent
  from fdj_shifts
)
update fdj_shifts f
set previous_shift_id = q.id_precedent_calendaire
from quarts_ordonnes q
where f.id = q.id
  and q.id_precedent_calendaire is not null
  -- n'accepter le lien que si c'est vraiment le quart consécutif attendu
  -- (Q2 -> Q1 même jour, Q1 -> Q2 la veille) — sinon laisser NULL (chaîne
  -- rompue, honnêtement non résolue plutôt que liée à un quart lointain).
  and (
    (f.quart = '2' and q.quart_precedent = '1' and q.date_precedente = f.date)
    or (f.quart = '1' and q.quart_precedent = '2' and q.date_precedente = f.date - interval '1 day')
  );
