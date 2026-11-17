-- Preuve reproductible de concordance entre les fichiers gelés et le SQL exécuté sur Test. LECTURE SEULE (une requête SELECT).
-- Pour chaque migration T2 : empreinte du texte enregistré par Supabase, et empreinte de ce texte suivi d'un saut de ligne.
-- Attendu : migrations 1 à 3, sha256_stocke = empreinte du fichier ; migration 4, sha256_stocke_plus_un_saut = empreinte du fichier
-- (01dfda31...), car le fichier gelé se termine par une ligne vide que l'envoi n'a pas transmise.
select name, version, octet_length(statements[1]) octets, array_length(statements, 1) nb_elements,
  encode(sha256(convert_to(statements[1], 'UTF8')), 'hex') sha256_stocke,
  encode(sha256(convert_to(statements[1] || E'\n', 'UTF8')), 'hex') sha256_stocke_plus_un_saut
from supabase_migrations.schema_migrations
where name like 'tarif\_registres%' order by version;
