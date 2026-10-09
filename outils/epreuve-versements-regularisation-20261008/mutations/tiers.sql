-- Retire l'exigence d'autorisation d'un tiers. Rougit : TIERS.
select pg_temp.muter('public.enregistrer_restitution_trop_percu', $m$length(btrim(coalesce(p_autorisation_tiers, ''))) < 5$m$, 'false');
