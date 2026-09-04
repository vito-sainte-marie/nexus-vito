-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260819165723 · progression_site_settings_series
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- "Mes séries" (Ma progression) — Paramètres manager, volet P8 du cadrage
-- NEXUS_Ma_Progression_Series_Recompenses_Cadrage_Developpeur.pdf (§13).
--
-- Portée volontairement limitée : paliers (seuil/points/code) et
-- activation par domaine (Caisse/Inventaire), + délai de grâce Inventaire.
-- La "tolérance caisse" mentionnée au §3.1 du cadrage N'EST PAS reprise ici :
-- elle existe déjà comme source unique dans nexus-progression.js
-- (SEUIL_ECART_CONFORME, utilisé par estConforme/statutCaisseJour dont
-- dépend toute la page Mon évolution, pas seulement les séries). La rendre
-- configurable par site est un chantier plus large et transverse, hors
-- périmètre de ce lot — décision consciente pour ne pas créer une 2e
-- source de vérité partielle (Article 11). De même, aucun toggle
-- "classement public" n'est ajouté : aucun écran ne consomme ce concept
-- aujourd'hui, l'ajouter serait une fausse précision (Article 5).
--
-- Une ligne par site, même pattern que fdj_site_settings (upsert onConflict
-- site, valeurs par défaut fusionnées côté client si la ligne n'existe pas
-- encore).

create table public.progression_site_settings (
  site text primary key,
  series_caisse_actif boolean not null default true,
  series_caisse_paliers jsonb not null default '[
    {"code":"caisse_x5","seuil":5,"points":25,"label":"Caisse Maîtrisée"},
    {"code":"caisse_x10","seuil":10,"points":50,"label":"Caisse Fiable"},
    {"code":"caisse_x20","seuil":20,"points":100,"label":"Caisse Référence"}
  ]'::jsonb,
  series_inventaire_actif boolean not null default true,
  series_inventaire_delai_grace_jours integer not null default 7,
  series_inventaire_paliers jsonb not null default '[
    {"code":"inventaire_x5","seuil":5,"points":25,"label":"Inventaire Maîtrisé"},
    {"code":"inventaire_x10","seuil":10,"points":50,"label":"Inventaire Fiable"},
    {"code":"inventaire_x20","seuil":20,"points":100,"label":"Inventaire Référence"}
  ]'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.employees(id) on delete set null,
  constraint progression_site_settings_delai_grace_check check (series_inventaire_delai_grace_jours >= 0),
  constraint progression_site_settings_caisse_paliers_is_array check (jsonb_typeof(series_caisse_paliers) = 'array'),
  constraint progression_site_settings_inventaire_paliers_is_array check (jsonb_typeof(series_inventaire_paliers) = 'array')
);

comment on table public.progression_site_settings is 'Paramètres manager pour "Mes séries" (badges/points Caisse et Inventaire) — Ma progression. Une ligne par site. Voir NEXUS_Ma_Progression_Series_Recompenses_Cadrage_Developpeur.pdf §13. La tolérance caisse reste SEUIL_ECART_CONFORME (nexus-progression.js), non dupliquée ici.';

alter table public.progression_site_settings enable row level security;

-- Lecture : tout employé du site (l'écran Ma progression est consulté par
-- l'employé lui-même, pas seulement le manager) + créateur si site autorisé.
create policy select_progression_site_settings on public.progression_site_settings
  for select
  using (
    site = (select public.current_employee_site_id())
    or (
      (select public.je_suis_createur())
      and exists (select 1 from public.sites s where s.site_id = progression_site_settings.site and s.acces_createur_autorise = true)
    )
  );

-- Écriture : manager/gérant du site uniquement (réutilise la fonction déjà
-- posée pour inventaire_regles_produit — même doctrine "Paramètres manager").
create policy ecriture_progression_site_settings on public.progression_site_settings
  for all
  using (public.nexus_clients_ecriture_ok(site))
  with check (public.nexus_clients_ecriture_ok(site));
