-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260829195220 · inventaire_mission_rules
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- NEXUS Inventaire V2 — Sprint 1 (29/08/2026, doctrine "Inventaire V2" de Frédéric)
-- Table de configuration durable du site : QUI doit compter QUOI, À QUEL
-- MOMENT, avec quelle stratégie de repli — jamais codé en dur dans le
-- moteur ou les écrans (Article 11, "aucune règle métier de Sainte-Marie
-- codée dans le JavaScript"). Une ligne = une "mission de contrôle"
-- configurée par le manager depuis Paramètres → Inventaire, consommée par
-- le futur générateur de missions (Sprint 2) — cette migration ne touche
-- ni inventaire_plans_comptage ni inventaire_plan_items (Sprint 1 : "aucune
-- évolution complexe du rapprochement à ce stade").
create table if not exists inventaire_mission_rules (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  nom text not null,
  actif boolean not null default true,
  -- Vocabulaire de rôle RÉUTILISÉ depuis employees.role (pompiste/caissier/
  -- renfort/manager/gerant/vacataire, déjà en usage réel) — jamais un
  -- second référentiel de rôles créé ici (Article 11). Pas de contrainte
  -- CHECK ici pour la même raison que employees.role n'en a pas : le
  -- référentiel réel peut évoluer sans migration de schéma.
  role_code text not null,
  role_repli text,
  -- Vocabulaire de quart RÉUTILISÉ depuis inventaire_quarts/
  -- inventaire_plans_comptage ('matin'/'soir', vérifié sur données réelles
  -- le 29/08/2026 — DIFFÉRENT du vocabulaire '1'/'2' de Verify/audits_caisse,
  -- jamais mélangé). null = règle applicable aux deux quarts.
  quart text check (quart is null or quart in ('matin', 'soir')),
  -- Moment NEXUS Core (doctrine §5/§37) : DEBUT/PENDANT/FIN — un concept
  -- générique, jamais un horaire Sainte-Marie codé en dur.
  moment_code text not null check (moment_code in ('debut', 'pendant', 'fin')),
  -- Catégories/zones ciblées (uuid[], référencent inventaire_categories.id /
  -- inventaire_zones.id — pas de FK PostgreSQL sur un tableau, cohérence
  -- vérifiée côté applicatif, même choix que employes_piste/
  -- employes_boutique sur audits_caisse qui ne sont pas non plus des FK
  -- tableau). null/vide = pas de restriction sur cette dimension.
  categorie_ids uuid[],
  zone_ids uuid[],
  -- Mode de sélection (doctrine §6 "Type") — 'complet' : toutes les
  -- références éligibles de la catégorie ; 'tournant' : quota plafonné par
  -- nombre_references, en réutilisant la sélection tournante déjà existante
  -- de construirePlanComptage (Sprint 2 branchera dessus, jamais un second
  -- algorithme de tirage) ; 'cible' : liste figée plus restreinte.
  mode_selection text not null default 'complet' check (mode_selection in ('complet', 'tournant', 'cible')),
  nombre_references integer,
  -- Stratégie de repli (doctrine §9) si role_code est absent ce quart-là ET
  -- que role_repli est soit absent soit lui-même absent ce quart-là. Valeur
  -- descriptive seulement dans ce lot (Sprint 1) — c'est le moteur de
  -- génération de missions (Sprint 2) qui l'EXÉCUTERA réellement.
  strategie_repli text check (strategie_repli is null or strategie_repli in ('reporter_quart_suivant', 'reduire_perimetre', 'reporter_prochain_jour_disponible', 'aucune')),
  priorite text not null default 'normale' check (priorite in ('normale', 'sensible')),
  ordre_affichage integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventaire_mission_rules_site on inventaire_mission_rules(site);

alter table inventaire_mission_rules enable row level security;

-- Même politique que inventaire_categories (Article 11) : tout employé du
-- site peut LIRE la configuration (elle gouverne ce qu'il doit compter),
-- seul manager/gerant du site peut l'écrire.
create policy select_inventaire_mission_rules on inventaire_mission_rules
  for select using (site = (select current_employee_site_id()));

create policy ecriture_inventaire_mission_rules on inventaire_mission_rules
  for all
  using (current_employee_role() = any(array['manager','gerant']) and site = (select current_employee_site_id()))
  with check (current_employee_role() = any(array['manager','gerant']) and site = (select current_employee_site_id()));
