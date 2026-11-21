-- Retour arrière de 20261121100000_tarif_annulation_createur : rétablit la policy d'annulation d'origine (gérant, ou manager pour sa saisie).
-- Ne touche aucune donnée. Les annulations déjà faites par un créateur restent (lignes figées).
do $$
declare
  t text;
  manager text := 'site = (select current_employee_site_id()) and (select current_employee_role()) in (''manager'',''gerant'')';
  gerant text := 'site = (select current_employee_site_id()) and (select current_employee_role()) = ''gerant''';
begin
  foreach t in array array['tarif_anomalies_verifications','tarif_anomalies_reevaluations'] loop
    execute format('drop policy if exists annulation_roles_meme_site on %I', t);
    execute format('create policy annulation_roles_meme_site on %I for update to authenticated using (((%s) or (%s and saisi_par = (select auth.uid()))) and annule_le is null) with check (annule_le is not null and annule_par = (select auth.uid()))', t, gerant, manager);
  end loop;
end $$;
