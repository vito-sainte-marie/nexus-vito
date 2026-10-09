-- Une nouvelle validation ne lève pas le drapeau piste. Rougit : RESTITUTION REVALIDATION VERSEMENT.
select pg_temp.muter('public.audits_caisse_revalidation_controle', 'new.revalidation_requise_piste_le := null;   -- validation renouvelée ou retirée', 'new.revalidation_requise_piste_le := old.revalidation_requise_piste_le;');
