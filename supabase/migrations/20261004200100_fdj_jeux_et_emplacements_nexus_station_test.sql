-- FDJ-CARNETS-LEDGER-AUDIT-1-20261004 — qualification nexus-test, decision-1.md.
--
-- Second constat de recette, après le forfait (migration 20261004200000) :
-- `fdj_games`/`fdj_locations` n'ont jamais été peuplées pour
-- 'nexus-station-test' — seul 'vito-sainte-marie' l'a été
-- (20260809130521_seed_fdj_jeux_et_emplacements.sql). Sans jeu ni
-- emplacement, aucune écriture FDJ (les 9 chemins audités par ce lot) n'est
-- exerçable sur ce site, qualification réelle ou non. Même geste que la
-- migration d'origine, reproduit pour le site de recette avec un jeu et deux
-- emplacements minimaux — pas le catalogue complet de 29 jeux, qui n'a pas
-- de valeur de recette ici.
--
-- Idempotent (garde `where not exists`, car ni fdj_games ni fdj_locations ne
-- portent de contrainte unique sur (site, nom)) ; ne touche aucune ligne
-- d'un autre site.
--
-- TEST/CI UNIQUEMENT — à ne PAS appliquer en Production : 'nexus-station-test'
-- n'existe pas en Production, et le catalogue de jeux d'un site client réel
-- relève de Paramètres FDJ, jamais d'une migration automatique.

insert into public.fdj_games (site, nom, prix, ordre_affichage)
select 'nexus-station-test', 'Jeu Recette FDJ', 2, 10
where not exists (
  select 1 from public.fdj_games where site = 'nexus-station-test' and nom = 'Jeu Recette FDJ'
);

insert into public.fdj_locations (site, nom, type, ordre_affichage)
select 'nexus-station-test', 'Bureau', 'bureau', 10
where not exists (
  select 1 from public.fdj_locations where site = 'nexus-station-test' and nom = 'Bureau'
);

insert into public.fdj_locations (site, nom, type, ordre_affichage)
select 'nexus-station-test', 'Caisse', 'caisse', 20
where not exists (
  select 1 from public.fdj_locations where site = 'nexus-station-test' and nom = 'Caisse'
);

-- Zone bloquée : indispensable pour exercer réellement 'blocage' et
-- 'retour_bloque' (2 des 6 écritures manager fermées par ce lot) — sans
-- elle, fdj_emplacement_du_site(site, 'bloque') renvoie NULL et l'écriture
-- échouerait silencieusement sur un emplacement absent.
insert into public.fdj_locations (site, nom, type, ordre_affichage)
select 'nexus-station-test', 'Zone bloquée', 'bloque', 30
where not exists (
  select 1 from public.fdj_locations where site = 'nexus-station-test' and nom = 'Zone bloquée'
);
