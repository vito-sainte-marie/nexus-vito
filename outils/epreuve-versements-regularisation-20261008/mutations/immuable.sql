-- Retire l'immuabilité des versements. Rougit : IMMUABLE.
drop trigger evr_immuable on public.ecarts_versements_regularisation;
drop trigger evr_immuable_truncate on public.ecarts_versements_regularisation;
