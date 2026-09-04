-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260807191800 · creer_categorie_petits_articles_caisse_gaz_boutique
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 07/08/2026, demande de Frédéric : les produits Gaz zonés "boutique"
-- (Cartouche Campingaz, Sodastream) doivent être comptés en fin de trajet,
-- près de la caisse, alors que la catégorie "Gaz" (bouteilles piste,
-- gérées par le pompiste) doit rester tôt dans l'ordre. Comme
-- ordre_affichage vit au niveau de la catégorie (partagée entre zones),
-- impossible de distinguer les deux avec une seule catégorie "Gaz" — on
-- crée donc une catégorie dédiée "Petits articles caisse", positionnée
-- juste après Cigarettes, et on y déplace uniquement ces deux produits.
-- La catégorie "Gaz" d'origine n'est pas touchée : les 3 bouteilles piste
-- y restent, à leur position actuelle (ordre_affichage 2).
insert into public.inventaire_categories (site, nom, ordre_affichage, actif)
values ('vito-sainte-marie', 'Petits articles caisse', 12, true);

update public.inventaire_categories set ordre_affichage = 13
where site = 'vito-sainte-marie' and nom = 'Jaugeage Carburant';

update public.inventaire_zone_produit set categorie_id = (
  select id from public.inventaire_categories where site = 'vito-sainte-marie' and nom = 'Petits articles caisse'
), ordre_affichage = 1
where id = '284db7ee-3f77-40c4-b7e8-29799522d2ac'; -- Cartouche Campingaz

update public.inventaire_zone_produit set categorie_id = (
  select id from public.inventaire_categories where site = 'vito-sainte-marie' and nom = 'Petits articles caisse'
), ordre_affichage = 2
where id = '3dc33f81-16a8-4055-8bc5-2210d49181c9'; -- Sodastream;
