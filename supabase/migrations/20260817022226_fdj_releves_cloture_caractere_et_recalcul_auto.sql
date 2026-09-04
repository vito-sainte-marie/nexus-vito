-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260817022226 · fdj_releves_cloture_caractere_et_recalcul_auto
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 16/08/2026, suite directe à la demande de Frédéric : "le relevé doit
-- connaître la qualité de la chaîne. Si un quart précédent manque, je ne
-- veux pas qu'un relevé soit présenté comme totalement définitif alors que
-- ses stocks sont peut-être dépendants d'une chaîne interrompue [...]
-- Chaîne continue → Relevé définitif. Chaîne interrompue / donnée
-- manquante → Relevé provisoire — continuité à régulariser. Puis, lorsque
-- le quart manquant est complété : recalcul automatique, création d'une
-- nouvelle version, ancienne version conservée, statut final mis à jour."
--
-- `caractere` est volontairement une dimension SÉPARÉE de `statut` :
-- `statut` parle de l'écart (conforme/valide_avec_ecart/regularise),
-- `caractere` parle de la CONFIANCE dans les données au moment du snapshot
-- (definitif = chaîne intacte et aucune anomalie de stock encore ouverte ;
-- provisoire = chaîne rompue OU une anomalie continuite_stock_a_verifier
-- encore active sur ce quart). Un relevé peut donc être "valide_avec_ecart"
-- ET "definitif" en même temps (écart réel, mais donnée fiable).
alter table fdj_releves_cloture
  add column caractere text not null default 'definitif' check (caractere in ('definitif', 'provisoire'));

comment on column fdj_releves_cloture.caractere is
  'definitif = chaîne de continuité intacte et aucune anomalie de stock ouverte au moment de ce snapshot. provisoire = chaîne rompue ou anomalie continuite_stock_a_verifier encore active — ce relevé sera automatiquement remplacé par une nouvelle version dès que la situation se régularise (voir type_version=recalcul_automatique_chaine).';

-- Nouveau type_version : recalcul_automatique_chaine — posé par NEXUS lui-
-- même (jamais par une action humaine directe) quand une chaîne rompue au
-- moment de la validation employé se rétablit ensuite (quart manquant
-- complété, correction rétroactive) — voir
-- NEXUS-FDJ-Manager-v1.html::reconcilierAlertesChaine /
-- synchroniserRelevesApresRetablissementChaine.
alter table fdj_releves_cloture drop constraint fdj_releves_cloture_type_version_check;
alter table fdj_releves_cloture add constraint fdj_releves_cloture_type_version_check
  check (type_version in ('validation_employe', 'regularisation_manager', 'recalcul_automatique_chaine'));
