-- Ne pose jamais le drapeau piste. Rougit : DRAPEAU ECRAN ETAT RESTITUTION REVALIDATION UPSERT VERSEMENT.
select pg_temp.muter('public.audits_caisse_revalidation_controle', 'new.revalidation_requise_piste_le := now();', 'null;');
