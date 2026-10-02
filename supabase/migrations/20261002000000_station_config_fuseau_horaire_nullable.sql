-- Corrige l'anomalie terrain « Enregistrer les prix du mois » (Carburants) —
-- HTTP 400, PostgREST 23502 sur `station_config?on_conflict=site`.
--
-- CAUSE RACINE (prouvée statiquement, pas supposée) :
--   `20260824123103_ajouter_fuseau_horaire_station_config` a posé
--   `fuseau_horaire text NOT NULL DEFAULT 'America/Martinique'`.
--   `20260905131500_fuseau_horaire_par_site` (section 6, « C1-S2 — le défaut
--   du schéma disparaît ») a fait `ALTER COLUMN fuseau_horaire DROP DEFAULT`
--   — volontairement, pour ne plus substituer silencieusement le fuseau de
--   Sainte-Marie à une station nouvelle, `sites.timezone` étant devenue la
--   source de vérité (A3-3). Elle n'a PAS fait `DROP NOT NULL` en même temps,
--   contrairement au même jour/même esprit sur `pointages.retard_min`
--   (`20260919160000`, section 1 : « Le DEFAULT 0 doit tomber EN MÊME TEMPS
--   que le NOT NULL »).
--
--   Le même jour (A3 / C1c-3, `NEXUS-Parametres-Station-v1.html`), le client
--   a délibérément arrêté d'écrire `fuseau_horaire` dans tout upsert
--   `station_config` (« l'enregistrement n'écrit PLUS fuseau_horaire »).
--
--   Résultat : `fuseau_horaire` est NOT NULL, sans défaut, et plus aucun
--   appelant ne le fournit. PostgreSQL valide la ligne proposée par
--   `INSERT ... ON CONFLICT (site) DO UPDATE` (NOT NULL inclus) AVANT même de
--   détecter le conflit — qu'il y ait ou non déjà une ligne pour ce site. Les
--   colonnes absentes du payload sont remplies par leur défaut, ou NULL s'il
--   n'y en a pas : `fuseau_horaire` devient NULL, et la base refuse (23502),
--   quel que soit le contenu réel du payload (`prix_carburants`, `raccourcis`,
--   `pointage_actif`…) et quel que soit l'écran (`NEXUS-App-v1.html`,
--   `NEXUS-Parametres-Station-v1.html` — les 15 upserts `station_config` du
--   dépôt omettent tous cette colonne, aucun n'est épargné).
--
-- CORRECTIF MINIMAL : terminer ce que `20260905131500` avait commencé —
-- `fuseau_horaire` devient nullable, comme `pointages.retard_min` l'est
-- devenu dans les mêmes conditions. Aucune réintroduction de défaut (on ne
-- réintroduit pas la substitution silencieuse que la migration de référence
-- supprimait), et le client continue de ne jamais l'écrire : c'est une
-- colonne dépréciée, en sursis avant retrait (« retrait dans un lot
-- ultérieur »), elle ne doit plus pouvoir bloquer une écriture qui ne la
-- concerne pas.
--
-- TEST ONLY — non appliqué à Production depuis ce canal (aucun accès
-- Supabase). Preuve statique : test_station_config_upsert_fuseau_horaire_
-- 23502_20261002.js. Reproduction comportementale SQL portable, à exécuter
-- avec un accès réel : outils/epreuve-station-config-upsert-fuseau-horaire-
-- 23502-20261002.sql.

alter table public.station_config alter column fuseau_horaire drop not null;

comment on column public.station_config.fuseau_horaire is
  'DÉPRÉCIÉ (A3-3, 05/09/2026) — la source de vérité du fuseau est sites.timezone. '
  'NULLABLE depuis le 02/10/2026 : la colonne n''a plus de défaut depuis '
  '20260905131500 et plus aucun appelant ne l''écrit, donc la contrainte NOT '
  'NULL bloquait TOUT upsert station_config (INSERT ... ON CONFLICT DO UPDATE '
  'valide la ligne proposée, défauts/NULL compris, avant même de vérifier le '
  'conflit) — pas seulement les sites neufs. Colonne conservée le temps que '
  'les lecteurs client migrent ; retrait dans un lot ultérieur.';
