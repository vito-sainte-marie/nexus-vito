-- NEXUS Moteur Commande Carburant — schéma (24/08/2026)
-- Cahier fonctionnel/technique transmis par Frédéric ("NEXUS — Moteur
-- Commande Carburant"). Réutilise au maximum l'existant (Article 11) :
-- station_config.cuves_carburants pour les capacités (déjà la source
-- unique consommée par nexus-carburant-donnees.js::chargerCuvesConfig),
-- station_config.horaires/fuseau_horaire pour le calendrier d'ouverture,
-- inventaire_calendrier_site pour les jours fériés (table déjà générique
-- "Jours de vacances scolaires / fériés configurés par le manager pour ce
-- site", pas seulement Inventaire malgré son nom -- jamais une deuxième
-- table de jours fériés dupliquée ici), carburant_reception_visites pour
-- le rapprochement livraison (§34).
--
-- Appliquée le 24/08/2026 sur le projet Supabase uzhjpqpctpvxytxpxoqz via
-- apply_migration (nom : carburant_commande_schema_v1). Ce fichier est une
-- copie de traçabilité locale.

-- ============================================================
-- 1. Capacités réelles des cuves (§3 du cahier) -- additive : ajoute
-- `limite_remplissage` À CHAQUE cuve déjà présente dans cuves_carburants,
-- sans toucher `id`/`label`/`capacite` (capacite reste la capacité
-- NOMINALE, déjà utilisée ailleurs -- ex. pourcentageRemplissage --
-- jamais remplacée silencieusement par la limite réelle, qui est une
-- notion nouvelle et distincte introduite par ce cahier).
-- GNR passé à actif=false (pompe indisponible, décision explicite de
-- Frédéric) -- la structure/logique GNR reste posée dans le moteur, prête
-- à être réactivée le jour où la pompe fonctionne (§3 du cahier).
-- ============================================================
update station_config
set cuves_carburants = jsonb_build_object(
  'sp95', jsonb_build_object(
    'actif', true, 'label', 'Sans plomb (SP95)',
    'cuves', jsonb_build_array(
      jsonb_build_object('id','unique','label', cuves_carburants->'sp95'->'cuves'->0->>'label', 'capacite', 30276, 'limite_remplissage', 28761)
    )
  ),
  'go', jsonb_build_object(
    'actif', true, 'label', 'Gasoil (GO)',
    'cuves', jsonb_build_array(
      jsonb_build_object('id','cuve1','label', cuves_carburants->'go'->'cuves'->0->>'label', 'capacite', 20020, 'limite_remplissage', 19019),
      jsonb_build_object('id','cuve2','label', cuves_carburants->'go'->'cuves'->1->>'label', 'capacite', 10036, 'limite_remplissage', 9534)
    )
  ),
  'gnr', jsonb_build_object(
    'actif', false, 'label', 'Gasoil non routier (GNR)',
    'cuves', jsonb_build_array(
      jsonb_build_object('id','unique','label', cuves_carburants->'gnr'->'cuves'->0->>'label', 'capacite', 30000, 'limite_remplissage', 28500)
    )
  )
)
where site = 'vito-sainte-marie' and cuves_carburants is not null;

-- ============================================================
-- 2. Paramètres de commande carburant (§4/§5/§6 du cahier) -- une colonne
-- de plus sur station_config (Article 11, une seule table de config par
-- site, comme horaires/fuseau_horaire/prix_carburants/cuves_carburants
-- déjà en place) plutôt qu'une nouvelle table. Défaut = règles validées
-- par Frédéric dans le cahier lui-même (cutoff 11h, livraison lun-ven,
-- minimum camion 10 000 L, réserve de sécurité 3 jours). Pas d'écran
-- Paramètres dédié dans ce lot (non demandé explicitement) -- modifiable
-- directement en base par Frédéric ou via un futur lot Paramètres Station.
-- ============================================================
alter table station_config
  add column if not exists carburant_commande_config jsonb not null default jsonb_build_object(
    'cutoff_heure', '11:00',
    'jours_livraison_iso', jsonb_build_array(1,2,3,4,5),
    'minimum_camion_litres', 10000,
    'compartiments_disponibles_litres', jsonb_build_array(2000,5000,7000),
    'stock_securite_jours', 3
  );

update station_config
set carburant_commande_config = jsonb_build_object(
  'cutoff_heure', '11:00',
  'jours_livraison_iso', jsonb_build_array(1,2,3,4,5),
  'minimum_camion_litres', 10000,
  'compartiments_disponibles_litres', jsonb_build_array(2000,5000,7000),
  'stock_securite_jours', 3
)
where site = 'vito-sainte-marie';

-- ============================================================
-- 3. Commandes carburant (§10, 31-34 du cahier) -- une ligne par
-- proposition/commande, quel que soit son statut. `carburants` porte le
-- détail par carburant (volume, état au moment de la proposition) en
-- jsonb -- au plus 3 clés (sp95/go/gnr), jamais assez volumineux pour
-- justifier une table de lignes séparée (même choix que
-- carburant_stock_reference_lignes aurait pu éviter si le cahier de
-- l'époque avait autorisé le jsonb -- ici assumé dès le départ).
-- ============================================================
create table if not exists public.carburant_commandes (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  statut text not null default 'proposee'
    check (statut = any (array['proposee','validee','modifiee','reportee','hors_nexus','annulee','livree'])),
  carburants jsonb not null,
  volume_total_l numeric not null,
  raison text,
  confidence text not null default 'a_confirmer'
    check (confidence = any (array['fiable','a_confirmer','non_calculable'])),
  cutoff_deadline timestamptz,
  livraison_prevue_le date,
  livree_le date,
  visite_reception_id uuid references public.carburant_reception_visites(id),
  motif_report text,
  motif_report_categorie text
    check (motif_report_categorie is null or motif_report_categorie = any (array['commande_hors_nexus','fournisseur_indisponible','decision_tresorerie','volume_a_modifier','autre'])),
  source text not null default 'nexus' check (source = any (array['nexus','hors_nexus'])),
  proposee_le timestamptz not null default now(),
  valide_par uuid references public.employees(id),
  valide_le timestamptz,
  created_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);

comment on table public.carburant_commandes is 'Propositions et commandes carburant NEXUS (moteur Commande Carburant, cahier 24/08/2026) -- chaîne recommandation -> commande -> livraison prévue -> réception (visite_reception_id), une ligne par proposition/commande quel que soit son statut, jamais réécrite silencieusement (nouvelle ligne si modifiée après validation).';

alter table public.carburant_commandes enable row level security;

create policy select_carburant_commandes on public.carburant_commandes
  for select using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from public.sites s where s.site_id = carburant_commandes.site and s.acces_createur_autorise = true))
  );

create policy ecriture_manager_carburant_commandes on public.carburant_commandes
  for insert with check (
    (select current_employee_role()) = any (array['manager','gerant'])
    and site = (select current_employee_site_id())
  );

create policy modification_manager_carburant_commandes on public.carburant_commandes
  for update using (
    (select current_employee_role()) = any (array['manager','gerant'])
    and site = (select current_employee_site_id())
  );

create index if not exists idx_carburant_commandes_site_statut on public.carburant_commandes (site, statut);
