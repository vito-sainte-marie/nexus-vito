-- La validation Verify n'est plus contrôlée. Rougit : VALIDATION.
select pg_temp.muter('public.audits_caisse_regularisations_controle', 'or (new.valide_le_piste is not null and new.valide_le_piste is distinct from old.valide_le_piste)', '');
