-- ============================================================================
-- Jeu de recette — fil « Mon début de quart », étape 3 (gaz, glaçons, écailles)
-- Lot PARCOURS-POMPISTE-LOT2-FIL-DEBUT-DE-QUART-20261021
--
-- NEXUS TEST UNIQUEMENT, site `nexus-station-test` (compte « Employé Test B »).
-- Ce n'est PAS une migration : rien ici n'est inscrit dans schema_migrations
-- et rien ne part avec `supabase db push`. Aucune écriture en Production : la
-- catégorie « Écailles » du catalogue Production sera une demande séparée,
-- soumise au GO de Frédéric.
--
-- Idempotent : on peut le rejouer sans doublon (clés uniques site+nom,
-- site+code, site+désignation ; ON CONFLICT DO NOTHING).
-- Gardé : s'arrête sans rien écrire si le site `nexus-station-test` n'existe
-- pas dans la base (cas de la Production).
--
--   psql "$URL_TEST" -X -v ON_ERROR_STOP=1 -f supabase/recette-jeux/20261021_jeu_recette_fil_debut_quart.sql
--
-- Contenu : les trois catégories du fil (Gaz, Glaçons, Écailles) ET deux
-- catégories que le fil ne compte pas (Huiles, Lave-glace), pour que la
-- recette puisse constater qu'elles ne sont jamais proposées au pompiste.
-- ============================================================================
begin;

do $$
begin
  if not exists (select 1 from public.sites where site_id = 'nexus-station-test') then
    raise exception 'site nexus-station-test absent : ce jeu de recette ne se joue que sur NEXUS Test';
  end if;
end $$;

insert into public.inventaire_zones (site, code, nom, ordre_affichage) values
  ('nexus-station-test', 'piste',    'Piste',    1),
  ('nexus-station-test', 'boutique', 'Boutique', 2)
on conflict (site, code) do nothing;

insert into public.inventaire_categories (site, nom, ordre_affichage, actif) values
  ('nexus-station-test', 'Gaz',                                    2, true),
  ('nexus-station-test', 'Glaçons',                                3, true),
  ('nexus-station-test', 'Écailles',                               4, true),
  ('nexus-station-test', 'Huiles',                                 5, true),
  ('nexus-station-test', 'Lave-glace & Liquide de refroidissement', 6, true)
on conflict (site, nom) do nothing;

insert into public.inventaire_zone_produit (site, designation, source, categorie_id, zone_id, unite, sensible, ordre_affichage, actif)
select 'nexus-station-test', v.designation, 'catalogue', c.id, z.id, 'unité', false, v.ordre, true
from (values
  ('Gaz 12,5KG',                  'Gaz',                                    1),
  ('Gaz 3KG',                     'Gaz',                                    2),
  ('Glaçons recette',             'Glaçons',                                3),
  ('Écailles recette',            'Écailles',                               4),
  ('Huile moteur recette',        'Huiles',                                 5),
  ('Lave-glace recette',          'Lave-glace & Liquide de refroidissement', 6)
) as v(designation, categorie, ordre)
join public.inventaire_categories c on c.site = 'nexus-station-test' and c.nom = v.categorie
join public.inventaire_zones z on z.site = 'nexus-station-test' and z.code = 'piste'
on conflict (site, designation) do nothing;

commit;
