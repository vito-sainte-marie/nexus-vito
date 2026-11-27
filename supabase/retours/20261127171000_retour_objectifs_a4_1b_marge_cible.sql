-- Retour arrière de 20261127171000_objectifs_a4_1b_marge_cible.sql.
-- Les versions de tarif_seuils déjà écrites par ces fonctions restent (registre
-- versionné, sans suppression) : les annuler une à une par annulation si besoin.
drop function if exists public.valider_marge_cible(uuid);
drop function if exists public.proposer_marge_cible(text, text, text, numeric, text);
