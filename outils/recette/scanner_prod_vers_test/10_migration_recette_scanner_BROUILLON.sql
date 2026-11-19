-- BROUILLON, NON APPLIQUÉ. SCHÉMA DE RECETTE (pas une migration produit) « recette_scanner » : importe sur Test l'export Production du 17/11/2026.
-- À jouer UNIQUEMENT par execute_sql (ou psql --single-transaction), JAMAIS par apply_migration : rien ne doit être inscrit dans supabase_migrations de Test.
-- À n'appliquer sur Test qu'avec le GO écrit de Guardian, après GO du pilote. Ne touche à aucune table de « public ».
-- Garde en dur, première instruction, comme les migrations T2 et T3 : identifiant système du projet Test 7678069749886157684 (udljdqxerrbbbajxubfn)
-- et présence des deux sites de recette. Toute autre base, Production comprise, est refusée avant la moindre écriture.
-- Exécuter d'un seul bloc atomique : psql -v ON_ERROR_STOP=1 --single-transaction -f ce_fichier
do $garde$
declare v bigint := (select system_identifier from pg_control_system());
begin
  if v is distinct from 7678069749886157684 then
    raise exception 'garde_projet_test : identifiant système % : ce n est pas le projet Supabase Test udljdqxerrbbbajxubfn. Rien n est écrit.', v;
  end if;
  if (select count(*) from public.sites where site_id in ('site-fantome-test', 'nexus-station-test')) <> 2 then
    raise exception 'garde_projet_test : sites de recette absents. Rien n est écrit.';
  end if;
end $garde$;

create schema recette_scanner;
revoke all on schema recette_scanner from public, anon, authenticated;
alter default privileges in schema recette_scanner revoke all on tables from public, anon, authenticated;

create table recette_scanner.lots (
  lot_id uuid primary key default gen_random_uuid(),
  cree_le timestamptz not null default now(),
  site text not null,
  export_nom text not null,
  export_sha256 text not null,
  manifeste_sha256 text not null,
  source_projet text not null,
  source_identifiant_systeme text not null,
  lu_le timestamptz not null,
  note text
);
create table recette_scanner.ventes (
  lot_id uuid not null references recette_scanner.lots(lot_id),
  jeu text not null, ligne int not null, texte text not null,
  primary key (lot_id, jeu, ligne)
);
create table recette_scanner.stock_brut (
  lot_id uuid not null references recette_scanner.lots(lot_id),
  numero_ligne int not null, texte text not null,
  primary key (lot_id, numero_ligne)
);
create table recette_scanner.declarations (
  lot_id uuid not null references recette_scanner.lots(lot_id),
  registre text not null, rang int not null, donnees jsonb not null,
  primary key (lot_id, registre, rang)
);
create table recette_scanner.jeux (
  lot_id uuid not null references recette_scanner.lots(lot_id),
  jeu text not null, n int not null, md5_manifeste text not null, lot_import jsonb,
  primary key (lot_id, jeu)
);

-- Colonnes dérivées de la ligne brute (séparateur tabulation) : on ne stocke que « texte », les colonnes sont lues par ces vues (volume divisé par deux).
create view recette_scanner.v_ventes with (security_invoker = true) as
select lot_id, jeu, ligne, texte,
  split_part(texte, E'\t', 1) as periode_debut, split_part(texte, E'\t', 2) as periode_fin, split_part(texte, E'\t', 3) as categorie,
  split_part(texte, E'\t', 4) as article, split_part(texte, E'\t', 5) as code_barres, split_part(texte, E'\t', 6) as quantite,
  split_part(texte, E'\t', 7) as prix_achat, split_part(texte, E'\t', 8) as prix_vente, split_part(texte, E'\t', 9) as tva,
  split_part(texte, E'\t', 10) as ca, split_part(texte, E'\t', 11) as marge
from recette_scanner.ventes;
create view recette_scanner.v_stock_brut with (security_invoker = true) as
select lot_id, numero_ligne, texte,
  split_part(texte, E'\t', 2) as categorie, split_part(texte, E'\t', 3) as libelle, split_part(texte, E'\t', 4) as pa_net_ht,
  split_part(texte, E'\t', 5) as stock_actuel, split_part(texte, E'\t', 6) as stock_date, split_part(texte, E'\t', 7) as valeur_stock_ht,
  split_part(texte, E'\t', 8) as mouvements
from recette_scanner.stock_brut;

-- Lecture seule d'un lot posé : RLS active, aucune politique, aucun droit pour anon ni authenticated (le schéma n'est pas exposé à l'API).
alter table recette_scanner.lots enable row level security;
alter table recette_scanner.ventes enable row level security;
alter table recette_scanner.stock_brut enable row level security;
alter table recette_scanner.declarations enable row level security;
alter table recette_scanner.jeux enable row level security;
revoke all on all tables in schema recette_scanner from public, anon, authenticated; -- tables et vues

-- Ajout seul : aucune modification ni suppression ni TRUNCATE d'un lot posé. Un nouvel import crée un nouveau lot_id.
create function recette_scanner.refuser_modification() returns trigger language plpgsql set search_path = '' as $f$
begin raise exception 'recette_scanner est en ajout seul (% sur %)', tg_op, tg_table_name; end $f$;
revoke all on function recette_scanner.refuser_modification() from public, anon, authenticated;
do $t$
declare t text;
begin
  foreach t in array array['lots','ventes','stock_brut','declarations','jeux'] loop
    execute format('create trigger %I before update or delete on recette_scanner.%I for each row execute function recette_scanner.refuser_modification()', t||'_ajout_seul', t);
    execute format('create trigger %I before truncate on recette_scanner.%I for each statement execute function recette_scanner.refuser_modification()', t||'_sans_truncate', t);
  end loop;
end $t$;
