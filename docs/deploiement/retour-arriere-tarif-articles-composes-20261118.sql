-- Retour arrière de 20261118140000_articles_composes.sql : ne retire que ses trois objets. Aucun autre objet T2 n'est touché ; produits_nature_reference reste intact.
-- Perd les articles déclarés composés : les exporter avant (hors dépôt).
-- Export en lecture seule, à jouer et conserver AVANT le retrait :
select * from articles_composes;
begin;
drop function if exists declarer_articles_composes(jsonb);
drop table if exists articles_composes;
drop function if exists articles_composes_normaliser(text);
commit;
