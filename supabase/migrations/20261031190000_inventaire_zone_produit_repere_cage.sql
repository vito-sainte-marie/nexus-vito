-- INVENTAIRE-GAZ-CAGE-20261031 (decision-1, option A).
-- Réglage optionnel du repère de cage par produit : où commencer à compter.
-- jsonb nullable, NULL = aucun repère. Réglage {nb_cages, capacite}, jamais une quantité.
-- Colonne ajoutée : site_id, RLS et grants de la table sont inchangés.
alter table public.inventaire_zone_produit
  add column if not exists repere_cage jsonb;

comment on column public.inventaire_zone_produit.repere_cage is
  'Configuration du repère de cage : {"nb_cages": n, "capacite": n}. La cage 1 est la première vendue. Jamais une quantité de stock. NULL = aucun repère.';
