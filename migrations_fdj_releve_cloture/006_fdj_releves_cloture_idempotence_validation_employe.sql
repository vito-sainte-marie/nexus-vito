-- Migration : fdj_releves_cloture_idempotence_validation_employe (16/08/2026)
-- Sécurisation structurelle demandée par Frédéric, point 5 : "Garantir
-- côté base qu'il ne puisse exister qu'une validation employé originale
-- par quart."
--
-- Un index unique PARTIEL (portant uniquement sur les lignes
-- type_version='validation_employe') interdit structurellement à deux
-- lignes "version 1 / validation employé" de coexister pour un même
-- shift_id — même en cas de double-clic, de rejeu réseau, ou d'un futur
-- retry mal synchronisé (voir 005_fdj_shifts_releve_cloture_statut.sql).
-- Les régularisations manager et les recalculs automatiques restent
-- illimités en nombre (version_num croissant), seule la version 1 est
-- verrouillée à l'unicité.

create unique index if not exists fdj_releves_cloture_une_validation_employe_par_quart
  on fdj_releves_cloture (shift_id)
  where type_version = 'validation_employe';

-- Note applicative : une violation de cet index (code Postgres 23505)
-- n'est PAS traitée comme une erreur par validerQuart()/
-- reessayerReleveClotureManquant() — une validation employé existe déjà
-- pour ce quart, c'est le résultat recherché, jamais un incident.
