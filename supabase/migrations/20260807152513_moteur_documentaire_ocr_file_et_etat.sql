-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260807152513 · moteur_documentaire_ocr_file_et_etat
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Moteur documentaire OCR — file d'attente + état du worker (07/08/2026,
-- demande de Frédéric — voir NEXUS-Moteur-Documentaire-OCR-Note-Conception.md).
-- Le code métier NEXUS ne parle jamais au moteur OCR directement : il dépose
-- une ligne ici et lit le résultat plus tard. Le worker (Python, hors
-- Supabase, sur l'iMac en V1) tire son travail par polling avec la clé
-- service_role — il ne dépend d'aucune politique RLS ci-dessous, qui ne
-- concernent que les futurs écrans NEXUS (boîte de réception, tâches 84-89).
create table if not exists public.documents_ocr_file (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  fichier_path text not null,
  type_document text,
  status text not null default 'en_attente' check (status in ('en_attente','en_cours','traite','erreur')),
  moteur_utilise text,
  resultat_texte text,
  resultat_json jsonb,
  erreur_message text,
  depose_par uuid references public.employees(id),
  deposited_at timestamptz not null default now(),
  traite_at timestamptz
);

comment on table public.documents_ocr_file is 'File d''attente du moteur documentaire OCR — NEXUS y dépose un document (fichier_path dans le bucket documents-a-traiter) et lit resultat_texte/resultat_json une fois status=traite. Le worker externe (local sur iMac en V1, cloud en V2) est le seul à faire passer status de en_attente à en_cours puis traite/erreur, via la clé service_role — jamais modifié en direct par le code métier.';

alter table public.documents_ocr_file enable row level security;

create policy select_documents_ocr_file on public.documents_ocr_file for select
  using (
    site = (select public.current_employee_site_id())
    or (
      (select public.je_suis_createur())
      and exists (select 1 from public.sites s where s.site_id = documents_ocr_file.site and s.acces_createur_autorise = true)
    )
  );

create policy insert_documents_ocr_file on public.documents_ocr_file for insert
  with check (
    site = (select public.current_employee_site_id())
    and depose_par = (select auth.uid())
  );

create policy suppression_manager_meme_site_documents_ocr_file on public.documents_ocr_file for delete
  using (
    (select public.current_employee_role()) = any (array['manager','gerant'])
    and site = (select public.current_employee_site_id())
  );

-- État du worker — une ligne par site, mise à jour uniquement par le worker
-- (clé service_role, qui contourne la RLS). Aucune politique d'écriture pour
-- les utilisateurs authentifiés : ni un employé ni un manager ne doit
-- pouvoir modifier son propre "je suis en ligne".
create table if not exists public.moteur_documentaire_etat (
  site text primary key,
  dernier_battement timestamptz,
  mode text,
  hote text,
  moteur_actif text,
  documents_en_attente integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.moteur_documentaire_etat is 'Battement de cœur du worker OCR (mis à jour toutes les ~30s par le worker externe) — permet à NEXUS d''afficher un avertissement si dernier_battement date de plus de quelques minutes (voir NEXUS-Moteur-Documentaire-OCR-Note-Conception.md, §7).';

alter table public.moteur_documentaire_etat enable row level security;

create policy select_moteur_documentaire_etat on public.moteur_documentaire_etat for select
  using (
    site = (select public.current_employee_site_id())
    or (
      (select public.je_suis_createur())
      and exists (select 1 from public.sites s where s.site_id = moteur_documentaire_etat.site and s.acces_createur_autorise = true)
    )
  );

-- Bucket dédié aux documents à traiter (factures, bons de livraison…) —
-- distinct de preuves-missions (photos de preuve d'action), privé, avec les
-- mêmes garde-fous : dossier de premier niveau = uid du déposant.
insert into storage.buckets (id, name, public)
values ('documents-a-traiter', 'documents-a-traiter', false)
on conflict (id) do nothing;

create policy "documents_a_traiter_lecture_proprietaire" on storage.objects for select
  using (bucket_id = 'documents-a-traiter' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy "documents_a_traiter_ecriture_proprietaire" on storage.objects for insert
  with check (bucket_id = 'documents-a-traiter' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy "documents_a_traiter_service_role_tout_acces" on storage.objects for all
  using (bucket_id = 'documents-a-traiter' and auth.role() = 'service_role')
  with check (bucket_id = 'documents-a-traiter' and auth.role() = 'service_role');
