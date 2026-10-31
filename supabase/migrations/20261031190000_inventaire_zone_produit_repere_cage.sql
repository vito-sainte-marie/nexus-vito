-- INVENTAIRE-GAZ-CAGE-20261031 (decision-1, option A).
-- Réglage optionnel du repère de cage par produit : où commencer à compter.
-- jsonb nullable, NULL = aucun repère. Pas de quantité attendue dans ce réglage.
-- Colonne ajoutée : site_id, RLS et grants de la table sont inchangés.
alter table public.inventaire_zone_produit
  add column if not exists repere_cage jsonb;

comment on column public.inventaire_zone_produit.repere_cage is
  'Repère de cage affiché à la clôture : {"texte": "...", "date": "AAAA-MM-JJ"}. Jamais une quantité. NULL = aucun repère.';
