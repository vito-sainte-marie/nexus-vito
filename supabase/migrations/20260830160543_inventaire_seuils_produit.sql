-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830160543 · inventaire_seuils_produit
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 30/08/2026 — Chantier convergence Inventaire V2, branchement du seuil
-- d'écart (Frédéric : "écart brut → seuil effectif catégorie/produit/site").
-- Sprint 5 (20/08/2026) n'avait posé que la cascade catégorie->site ;
-- ce lot ajoute le niveau produit, sans toucher aux lignes existantes
-- (toutes déjà scoped par catégorie, produit_id restera NULL pour elles).
alter table inventaire_seuils add column if not exists produit_id uuid references inventaire_zone_produit(id);

-- Une ligne est scoped catégorie OU produit, jamais les deux à la fois
-- (ambiguïté interdite — sinon quel niveau primerait ne serait plus
-- lisible dans la table elle-même).
alter table inventaire_seuils add constraint inventaire_seuils_categorie_ou_produit_exclusif
  check (categorie_id is null or produit_id is null);

-- Unicité (site, produit_id, cle) — symétrique de la contrainte catégorie
-- déjà en place. NULL ne viole jamais une contrainte UNIQUE Postgres :
-- les lignes scoped catégorie (produit_id NULL) ne sont donc jamais
-- concernées par cette contrainte.
alter table inventaire_seuils add constraint inventaire_seuils_site_produit_cle_key
  unique (site, produit_id, cle);

comment on column inventaire_seuils.produit_id is 'Override du seuil d''écart au niveau PRODUIT (exception ponctuelle) — prime sur categorie_id si les deux existaient, mais categorie_id et produit_id ne sont jamais renseignés simultanément sur une même ligne (voir contrainte inventaire_seuils_categorie_ou_produit_exclusif). NULL+NULL n''est pas utilisé par l''application (le défaut site vit dans station_config.parametres_inventaire, jamais dans cette table).';
