-- Retour arrière de 20261127171000_objectifs_a4_1b_marge_cible.sql.
-- Les versions 'valide' déjà écrites dans tarif_seuils par valider_marge_cible
-- restent (registre versionné, sans suppression) : les annuler une à une si besoin.
-- Les propositions (ouvertes ou closes) sont perdues avec la table : les exporter avant si utile.
drop function if exists public.retirer_marge_cible(uuid, text);
drop function if exists public.valider_marge_cible(uuid);
drop function if exists public.proposer_marge_cible(text, text, text, numeric, text);
drop table if exists public.marge_cible_propositions;
