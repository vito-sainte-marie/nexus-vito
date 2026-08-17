-- Migration : fdj_releves_cloture_caractere_et_recalcul_auto (16/08/2026)
-- Demande de Frédéric : "le relevé doit connaître la qualité de la chaîne
-- [...] Chaîne continue → Relevé définitif. Chaîne interrompue / donnée
-- manquante → Relevé provisoire — continuité à régulariser [...]
-- lorsque le quart manquant est complété : recalcul automatique, création
-- d'une nouvelle version, ancienne version conservée, statut final mis
-- à jour."

-- `caractere` : dimension orthogonale à `statut` — confiance dans les
-- données du snapshot (chaîne intacte + aucune anomalie de stock ouverte,
-- ou non), indépendante du fait qu'il y ait ou non un écart de caisse.
alter table fdj_releves_cloture
  add column if not exists caractere text not null default 'definitif'
    check (caractere in ('definitif', 'provisoire'));

-- `type_version` élargi pour accepter un acteur système (jamais un humain) :
-- un recalcul automatique déclenché par le rétablissement de la chaîne.
alter table fdj_releves_cloture
  drop constraint if exists fdj_releves_cloture_type_version_check;
alter table fdj_releves_cloture
  add constraint fdj_releves_cloture_type_version_check
    check (type_version in ('validation_employe', 'regularisation_manager', 'recalcul_automatique_chaine'));
