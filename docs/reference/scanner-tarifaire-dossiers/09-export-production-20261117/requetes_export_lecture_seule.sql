-- Requêtes exécutées le 17/11/2026 sur Supabase Production (uzhjpqpctpvxytxpxoqz), chacune dans une transaction
-- read only terminée par rollback. Site vito-sainte-marie uniquement. Aucune colonne d'auteur. Texte de référence
-- pour l'outil d'export que Claude Code versionnera sous outils/recette/scanner_prod_vers_test/.

-- Ventes (une requête par période : '2026-09-19' puis '2026-10-05')
begin transaction read only;
with l as (select concat_ws(E'\t', periode_debut, periode_fin, categorie, article, coalesce(code_barres,''), quantite, prix_achat, prix_vente, tva, ca, marge) t,
                  article, coalesce(code_barres,'') cb, id
           from products where site='vito-sainte-marie' and periode_debut='2026-10-05')
select count(*) n, md5(string_agg(t, E'\n' order by article, cb, id)) md5, string_agg(t, E'\n' order by article, cb, id) donnees from l;
rollback;

-- Relevé de stock du 10/11 : lignes brutes du lot publié, sept clés seulement
begin transaction read only;
with b as (select id from import_batches where id='a9489b7c-dc34-4ba4-babc-e2ebae95e7a8' and site='vito-sainte-marie'),
l as (select r.numero_ligne,
             concat_ws(E'\t', r.numero_ligne, r.donnees->>'Catégorie', r.donnees->>'Libellé', r.donnees->>'PA net HT', r.donnees->>'Stock actuel',
                       r.donnees->>'Stock date', r.donnees->>'Valeur stock HT', r.donnees->>'Mouvements') t,
             (select count(*) from jsonb_object_keys(r.donnees) k where k not in ('Catégorie','Libellé','PA net HT','Stock actuel','Stock date','Valeur stock HT','Mouvements')) cles_inattendues
      from import_rows_raw r join b on r.batch_id=b.id)
select count(*) n, sum(cles_inattendues) cles_inattendues, md5(string_agg(t, E'\n' order by numero_ligne)) md5, string_agg(t, E'\n' order by numero_ligne) donnees from l;
rollback;

-- Registres déclaratifs : produits_justifications_marge, produits_nature_reference, produits_tva_confirmations,
-- produits_appel, marge_exceptions ; colonnes métier et dates, sans colonne d'auteur, filtre site='vito-sainte-marie'.
