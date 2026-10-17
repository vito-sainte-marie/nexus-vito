-- 20261017120000 — Envoi de la photo Veeder-Root par le pompiste du jour (TEST SEULEMENT).
-- Autorisé par GO humain du 17/10/2026 après request-7 (preuves de refus :
-- docs/handoff/lots/FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016/preuve-upload-jaugeage-pompiste-test.sql).
-- Politique INSERT additive : aucune politique existante modifiée, aucun SELECT/UPDATE/DELETE ajouté.
begin;
create policy documents_a_traiter_jaugeage_pompiste on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents-a-traiter'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = public.current_employee_site_id()
    and (storage.foldername(name))[2] = 'jaugeage_veeder_root'
    and public.est_pompiste_du_jour((storage.foldername(name))[1])
    and storage.filename(name) like '____-__-__\_' || auth.uid()::text || '\_%'
    and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','heic')
  );
commit;
