-- Ouvre la lecture des versements à tout authentifié. Rougit : SITES.
drop policy lecture_manager_meme_site on public.ecarts_versements_regularisation;
create policy lecture_ouverte on public.ecarts_versements_regularisation for select to authenticated using (true);
