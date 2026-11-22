-- Retour arrière du lot 2 Dates courtes (recherche de produit). Ne touche à aucune table.
begin;
drop function if exists dates_courtes_rechercher_produit(text, integer);
commit;
