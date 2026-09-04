-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260807032033 · creer_module_comptes_clients
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- ============================================================
-- NEXUS COMPTES CLIENTS — schéma initial (07/08/2026)
-- ============================================================

-- 1) CLIENTS
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  code_client text,
  raison_sociale text not null,
  nom_commercial text,
  siret text,
  actif boolean not null default true,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_clients_site on clients(site);
create unique index if not exists idx_clients_site_code on clients(site, code_client) where code_client is not null;

-- 2) CLIENT_CONTACTS
create table if not exists client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  prenom text,
  nom text,
  fonction text,
  telephone text,
  email_principal text,
  email_secondaire text,
  email_cc text,
  civilite text not null default 'neutre' check (civilite in ('neutre','monsieur','madame','prenom','personnalisee')),
  formule_personnalisee text,
  est_contact_principal boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_contacts_client on client_contacts(client_id);

-- 3) CLIENT_PREFERENCES
create table if not exists client_preferences (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references clients(id) on delete cascade,
  facture_envoi_email boolean not null default true,
  facture_remise_main_propre boolean not null default false,
  bons_joindre_email boolean not null default true,
  bons_ne_pas_envoyer boolean not null default false,
  bons_remise_main_propre boolean not null default false,
  controle_auto_bons boolean not null default true,
  bloquer_envoi_si_anomalie boolean not null default true,
  validation_manager_obligatoire boolean not null default true,
  preferences_particulieres text,
  updated_at timestamptz not null default now()
);

-- 4) BILLING_PERIODS
create table if not exists billing_periods (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  mois int not null check (mois between 1 and 12),
  annee int not null check (annee between 2020 and 2100),
  statut text not null default 'en_cours' check (statut in ('en_cours','pret','envoye','cloture')),
  created_at timestamptz not null default now(),
  unique(site, mois, annee)
);

-- 5) INVOICES
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  billing_period_id uuid not null references billing_periods(id) on delete cascade,
  client_id uuid references clients(id),
  reference text,
  date_facture date,
  date_echeance date,
  siret_detecte text,
  email_detecte text,
  montant_total numeric(12,2),
  fichier_path text,
  fichier_hash text,
  methode_identification text check (methode_identification in ('code_client','raison_sociale','siret','contenu','email','historique','manuel')),
  confiance_identification numeric(5,2),
  statut text not null default 'importee' check (statut in ('importee','identifiee','a_verifier','rapprochee','prete','envoyee','bloquee')),
  created_at timestamptz not null default now()
);
create index if not exists idx_invoices_period on invoices(billing_period_id);
create index if not exists idx_invoices_client on invoices(client_id);
create index if not exists idx_invoices_hash on invoices(fichier_hash);

-- 6) INVOICE_LINES
create table if not exists invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  date_operation date,
  reference_article text,
  type_carburant text,
  type_carburant_normalise text,
  immatriculation text,
  immatriculation_normalisee text,
  quantite numeric(10,3),
  prix_unitaire numeric(10,4),
  montant numeric(12,2),
  texte_source text,
  created_at timestamptz not null default now()
);
create index if not exists idx_invoice_lines_invoice on invoice_lines(invoice_id);
create index if not exists idx_invoice_lines_immat on invoice_lines(immatriculation_normalisee);

-- 7) SUPPORTING_DOCUMENTS
create table if not exists supporting_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  billing_period_id uuid references billing_periods(id),
  type_document text not null default 'bon' check (type_document in ('bon','facture','autre')),
  fichier_path text not null,
  fichier_hash text,
  nb_pages int,
  statut_extraction text not null default 'en_attente' check (statut_extraction in ('en_attente','extrait','echec')),
  created_at timestamptz not null default now()
);
create index if not exists idx_supporting_documents_period on supporting_documents(billing_period_id);
create index if not exists idx_supporting_documents_hash on supporting_documents(fichier_hash);

-- 8) VOUCHER_EXTRACTIONS
create table if not exists voucher_extractions (
  id uuid primary key default gen_random_uuid(),
  supporting_document_id uuid not null references supporting_documents(id) on delete cascade,
  page_numero int,
  client_detecte_id uuid references clients(id),
  date_detectee date,
  date_confiance numeric(5,2),
  immatriculation_detectee text,
  immatriculation_normalisee text,
  immatriculation_confiance numeric(5,2),
  carburant_detecte text,
  carburant_normalise text,
  carburant_confiance numeric(5,2),
  volume_detecte numeric(10,3),
  volume_confiance numeric(5,2),
  montant_detecte numeric(12,2),
  montant_confiance numeric(5,2),
  signature_presente boolean,
  statut text not null default 'a_verifier' check (statut in ('conforme','a_verifier','rejete')),
  corrige_manuellement boolean not null default false,
  corrige_par uuid references employees(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_voucher_extractions_doc on voucher_extractions(supporting_document_id);
create index if not exists idx_voucher_extractions_immat on voucher_extractions(immatriculation_normalisee);

-- 9) DOCUMENT_MATCHES
create table if not exists document_matches (
  id uuid primary key default gen_random_uuid(),
  invoice_line_id uuid references invoice_lines(id) on delete cascade,
  voucher_extraction_id uuid references voucher_extractions(id) on delete cascade,
  type_correspondance text not null check (type_correspondance in (
    'conforme','ecart_montant','ecart_volume','ecart_immatriculation','ecart_date',
    'bon_manquant','bon_non_facture','doublon_bon','doublon_facturation','lecture_incertaine','ambigu'
  )),
  ecart_montant numeric(12,2),
  ecart_volume numeric(10,3),
  score_confiance numeric(5,2),
  statut_validation text not null default 'en_attente' check (statut_validation in ('en_attente','valide','corrige','rejete')),
  valide_par uuid references employees(id),
  valide_le timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_document_matches_line on document_matches(invoice_line_id);
create index if not exists idx_document_matches_voucher on document_matches(voucher_extraction_id);

-- 10) EMAIL_TEMPLATES
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  nom text not null default 'Modèle par défaut',
  objet text not null,
  corps text not null,
  corps_supplement_bons text,
  est_defaut boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_email_templates_site on email_templates(site);

-- 11) EMAIL_BATCHES
create table if not exists email_batches (
  id uuid primary key default gen_random_uuid(),
  billing_period_id uuid not null references billing_periods(id) on delete cascade,
  statut text not null default 'preparation' check (statut in ('preparation','pret','envoye_partiel','envoye','annule')),
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);

-- 12) EMAIL_MESSAGES
create table if not exists email_messages (
  id uuid primary key default gen_random_uuid(),
  email_batch_id uuid not null references email_batches(id) on delete cascade,
  client_id uuid not null references clients(id),
  invoice_id uuid references invoices(id),
  destinataire text,
  cc text,
  objet text,
  corps text,
  pieces_jointes_count int not null default 0,
  statut text not null default 'brouillon' check (statut in ('brouillon','pret','bloque','envoye','echec')),
  motif_blocage text,
  check1_compte_facture boolean,
  check2_email_client boolean,
  check3_periode_lot boolean,
  check4_bons_facture boolean,
  check5_pieces_meme_client boolean,
  check6_pas_deja_envoye boolean,
  check7_valide_manager boolean,
  valide_par uuid references employees(id),
  valide_le timestamptz,
  envoye_le timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_email_messages_batch on email_messages(email_batch_id);
create index if not exists idx_email_messages_client on email_messages(client_id);

-- 13) DELIVERY_RECORDS
create table if not exists delivery_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  billing_period_id uuid references billing_periods(id),
  documents_remis text not null check (documents_remis in ('facture','bons','facture_et_bons')),
  remis_par uuid references employees(id),
  remis_le timestamptz not null default now(),
  observation text
);
create index if not exists idx_delivery_records_client on delivery_records(client_id);

-- 14) AUDIT_LOGS (Comptes Clients)
create table if not exists client_comptes_audit_logs (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  client_id uuid references clients(id),
  entite_type text not null,
  entite_id uuid,
  action text not null,
  ancienne_valeur text,
  nouvelle_valeur text,
  acteur_id uuid references employees(id),
  date_action timestamptz not null default now(),
  motif text
);
create index if not exists idx_client_comptes_audit_client on client_comptes_audit_logs(client_id);
create index if not exists idx_client_comptes_audit_site on client_comptes_audit_logs(site);

-- 15) CLIENT_COMPTES_PARAMETRES
create table if not exists client_comptes_parametres (
  site text primary key references sites(site_id),
  nom_etablissement text,
  expediteur_nom text,
  expediteur_fonction text default 'Manager',
  telephone text,
  adresse text,
  signature_texte text,
  formule_appel_defaut text not null default 'neutre' check (formule_appel_defaut in ('neutre','monsieur','madame','prenom','personnalisee')),
  tolerance_montant numeric(6,2) not null default 0.01,
  tolerance_volume numeric(6,2) not null default 0.02,
  tolerance_date_jours int not null default 0,
  seuil_confiance_pct numeric(5,2) not null default 97,
  pieces_jointes_obligatoires boolean not null default true,
  validation_manager_obligatoire boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 16) NORMALISATION_ALIAS
create table if not exists normalisation_alias (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  type_alias text not null check (type_alias in ('carburant','immatriculation')),
  valeur_brute text not null,
  valeur_normalisee text not null,
  cree_par uuid references employees(id),
  created_at timestamptz not null default now(),
  unique(site, type_alias, valeur_brute)
);
