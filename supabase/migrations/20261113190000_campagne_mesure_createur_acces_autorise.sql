-- Mesure de la compensation : le créateur ne lit les trois tables que pour les sites qui l'y autorisent
-- (même règle que select_campagnes_nexus). Corrige la politique posée par 20261113180000.
do $$
declare t text;
begin
  foreach t in array array['campagne_mesures_produits','campagne_couts','fournisseurs_conditions'] loop
    execute format('drop policy if exists createur_lit_si_autorise on %I', t);
    execute format('create policy createur_lit_si_autorise on %I for select using (je_suis_createur() and exists (select 1 from sites s where s.site_id = %I.site and s.acces_createur_autorise = true))', t, t);
  end loop;
end $$;
