-- Retour arrière de 20261127170000_objectifs_r2_rpc.sql (R1 reste en place).
drop function if exists public.revoquer_droit_objectif(text, uuid, text);
drop function if exists public.accorder_droit_objectif(text, uuid, text);
drop function if exists public.retirer_objectif(uuid, text);
drop function if exists public.valider_objectif(uuid, text);
drop function if exists public.proposer_objectif(text, text, text, date, numeric, text, text);
