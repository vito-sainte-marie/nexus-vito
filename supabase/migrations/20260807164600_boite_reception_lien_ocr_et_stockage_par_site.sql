-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260807164600 · boite_reception_lien_ocr_et_stockage_par_site
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Boîte de réception (07/08/2026) : lien explicite entre un bon déposé
-- (supporting_documents) et sa demande de traitement dans la file OCR
-- (documents_ocr_file) — permet de retrouver le résultat une fois le
-- worker passé, sans avoir à deviner par le chemin de fichier.
alter table public.supporting_documents
  add column if not exists documents_ocr_file_id uuid references public.documents_ocr_file(id);

comment on column public.supporting_documents.documents_ocr_file_id is 'Référence vers la demande de traitement OCR correspondante (documents_ocr_file) — null tant que le document n''a pas encore été mis en file.';

-- Correction du bucket documents-a-traiter (07/08/2026) : les politiques
-- posées ce matin restreignaient l'accès au seul déposant (1er dossier du
-- chemin = son propre uid) — bloquant pour une équipe où plusieurs
-- managers d'un même site doivent voir la même boîte de réception. On
-- repasse sur un découpage par site (1er dossier = site_id), même principe
-- que documents_ocr_file/moteur_documentaire_etat.
drop policy if exists "documents_a_traiter_lecture_proprietaire" on storage.objects;
drop policy if exists "documents_a_traiter_ecriture_proprietaire" on storage.objects;

create policy "documents_a_traiter_lecture_site" on storage.objects for select
  using (bucket_id = 'documents-a-traiter' and public.nexus_clients_lecture_ok((storage.foldername(name))[1]));

create policy "documents_a_traiter_ecriture_site" on storage.objects for insert
  with check (bucket_id = 'documents-a-traiter' and public.nexus_clients_ecriture_ok((storage.foldername(name))[1]));
