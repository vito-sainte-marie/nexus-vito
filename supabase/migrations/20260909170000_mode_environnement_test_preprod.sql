-- MODE D'ENVIRONNEMENT — NEXUS sait explicitement où il est.
--
-- ARBITRAGE DE FRÉDÉRIC BRAGANCE, 09/09/2026. `nexus-test` est la plateforme
-- physique de DEUX états logiques : la recette normale, et une répétition de
-- release temporaire. « Pour éviter les ambiguïtés, il faut que NEXUS sache
-- explicitement dans quel mode il est : TEST_NORMAL ou PREPROD_REHEARSAL. »
--
-- POURQUOI UNE TABLE ET PAS UNE CONVENTION. Un mode qui se devine — au nom
-- d'un jeu de données, à la présence d'une ligne, à l'heure qu'il est — se
-- devine mal un jour donné. Et le jour où il se devine mal, on croit être en
-- répétition alors qu'on est en recette, ou l'inverse : on nettoie ce qu'il
-- fallait garder, ou on garde ce qu'il fallait nettoyer. L'état est donc
-- DÉCLARÉ, lisible par une requête, et contraint à deux valeurs.
--
-- PREPROD N'EST JAMAIS UNE COPIE PERMANENTE DE PRODUCTION. C'est la précaution
-- que l'arbitrage nomme comme l'unique importante. `PREPROD_REHEARSAL` désigne
-- un état construit à partir de données de recette STRUCTURÉES pour reproduire
-- les cas Production utiles — colonnes divergentes, services restés ouverts,
-- fuseau absent — jamais des lignes copiées depuis la station réelle. Aucune
-- identité de l'équipe de Frédéric ne sort de Production.
--
-- UNE SEULE LIGNE, par construction : un environnement n'a pas deux états.
-- La contrainte `mode_unique` le garantit plutôt que de compter sur la
-- discipline de qui écrit.
--
-- TEST/CI UNIQUEMENT — à ne PAS appliquer en Production : la question « suis-je
-- en répétition ? » n'y a pas de sens, et y répondre serait déjà une ambiguïté.

create table if not exists public.nexus_environnement_mode (
  mode_unique boolean primary key default true check (mode_unique),
  mode text not null default 'TEST_NORMAL'
    check (mode in ('TEST_NORMAL', 'PREPROD_REHEARSAL')),
  depuis timestamptz not null default now(),
  -- La release que cette répétition prépare. Obligatoire en PREPROD_REHEARSAL :
  -- une répétition qui ne dit pas ce qu'elle répète ne se rattache à rien, et
  -- son nettoyage ne se réclame de rien non plus.
  release text,
  motif text,
  constraint release_requise_en_repetition
    check (mode <> 'PREPROD_REHEARSAL' or (release is not null and btrim(release) <> ''))
);

insert into public.nexus_environnement_mode (mode_unique, mode, motif)
values (true, 'TEST_NORMAL', 'État par défaut après reconstruction.')
on conflict (mode_unique) do nothing;

alter table public.nexus_environnement_mode enable row level security;

-- Lecture ouverte aux identités authentifiées : savoir dans quel environnement
-- on se trouve n'est pas un secret, et le cacher produirait exactement
-- l'ambiguïté que cette table supprime. Aucune écriture n'est accordée par
-- politique : le mode se change par un rôle d'administration, jamais depuis
-- l'application.
drop policy if exists lecture_mode_environnement on public.nexus_environnement_mode;
create policy lecture_mode_environnement on public.nexus_environnement_mode
  for select to authenticated using (true);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nexus_ci_recette') then
    execute 'grant select on public.nexus_environnement_mode to nexus_ci_recette';
    execute 'drop policy if exists lecture_mode_ci on public.nexus_environnement_mode';
    execute 'create policy lecture_mode_ci on public.nexus_environnement_mode
               for select to nexus_ci_recette using (true)';
  end if;
end
$$;
