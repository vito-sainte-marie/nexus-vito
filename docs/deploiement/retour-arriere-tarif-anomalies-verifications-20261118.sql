-- Retour arrière de 20261118120000_tarif_anomalies_verifications.sql : ne retire que ses quatre objets. Aucun autre objet T2 n'est touché.
-- Perd les vérifications et réévaluations saisies : les exporter avant si elles comptent.
begin;
drop function if exists tarif_enregistrer_reevaluations(jsonb);
drop function if exists tarif_marquer_verifie(jsonb);
drop table if exists tarif_anomalies_reevaluations;
drop table if exists tarif_anomalies_verifications;
commit;
