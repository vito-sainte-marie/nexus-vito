-- BROUILLON, NON APPLIQUÉ. Schéma isolé « recette_scanner » pour importer sur Test l'export Production du 17/11/2026.
-- À n'appliquer sur Test qu'avec le GO écrit de Guardian, après GO du pilote. Ne touche à aucune table de « public ».
-- Garde : le script s'arrête (exception dans le même lot) si le projet n'est pas Test (identifiant système 7678069749886157684).
-- Exécuter d'un seul bloc (apply_migration / execute_sql) ou avec : psql -v ON_ERROR_STOP=1 --single-transaction -f ce_fichier
do $garde$
declare v text;
begin
  select system_identifier::text into v from pg_control_system();
  if v is distinct from '__ID_ATTENDU__' then
    raise exception 'GARDE PROJET TEST : identifiant système % différent de l''attendu __ID_ATTENDU__. Rien n''est écrit.', v;
  end if;
end
$garde$;

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
  periode_debut text, periode_fin text, categorie text, article text, code_barres text,
  quantite text, prix_achat text, prix_vente text, tva text, ca text, marge text,
  primary key (lot_id, jeu, ligne)
);
create table recette_scanner.stock_brut (
  lot_id uuid not null references recette_scanner.lots(lot_id),
  numero_ligne int not null, texte text not null,
  categorie text, libelle text, pa_net_ht text, stock_actuel text, stock_date text, valeur_stock_ht text, mouvements text,
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

-- Lecture seule d'un lot posé : RLS active, aucune politique, aucun droit pour anon ni authenticated (le schéma n'est pas exposé à l'API).
alter table recette_scanner.lots enable row level security;
alter table recette_scanner.ventes enable row level security;
alter table recette_scanner.stock_brut enable row level security;
alter table recette_scanner.declarations enable row level security;
alter table recette_scanner.jeux enable row level security;
revoke all on all tables in schema recette_scanner from public, anon, authenticated;

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
