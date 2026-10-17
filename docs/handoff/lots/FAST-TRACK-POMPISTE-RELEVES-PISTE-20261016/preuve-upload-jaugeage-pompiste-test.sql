-- Preuve de la politique d'envoi des photos de jaugeage Veeder-Root (Test).
-- TOUT est dans une transaction terminée par ROLLBACK : la politique n'est PAS installée.
begin;
create temp table res(n text, r text);
grant all on res to authenticated;

-- ===== POLITIQUE SOUMISE (additive ; ne touche à aucune politique existante) =====
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
-- ===== FIN DE LA POLITIQUE =====

select id as pomp from employees where role='pompiste' and site_id='nexus-station-test' limit 1 \gset
select id as autre from employees where site_id='site-fantome-test' limit 1 \gset
select id as mgr from employees where role='manager' and site_id='nexus-station-test' limit 1 \gset
select id as caiss from employees where role='caissier' and site_id='nexus-station-test' limit 1 \gset
-- un quart de pompiste en cours aujourd'hui (rollback) pour que « pompiste du jour » soit vrai
insert into shifts(employee_id, site, site_id, role, statut, heure_debut) values(:'pomp','nexus-station-test','nexus-station-test','pompiste','en_cours', now()), (:'autre','site-fantome-test','site-fantome-test','pompiste','en_cours', now());
set local role authenticated;

create or replace function pg_temp.essai(lbl text, sub text, nom text, attendu text) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub',sub,'role','authenticated')::text, true);
  begin
    insert into storage.objects(bucket_id,name,owner) values('documents-a-traiter',nom,sub::uuid);
    insert into res values(lbl, 'ACCEPTE (attendu '||attendu||')');
  exception when others then insert into res values(lbl, 'REFUSE (attendu '||attendu||') : '||left(sqlerrm,60)); end;
end $f$;
grant execute on function pg_temp.essai(text,text,text,text) to authenticated;

-- 1. Cas accepté : pompiste du jour, son site, dossier jaugeage, nom conforme
select pg_temp.essai('1 accepte: pompiste du jour, bon chemin', :'pomp', 'nexus-station-test/jaugeage_veeder_root/2026-10-17_'||:'pomp'||'_1.jpg', 'ACCEPTE');
-- 2. Autre site
select pg_temp.essai('2 refus: autre site', :'pomp', 'site-fantome-test/jaugeage_veeder_root/2026-10-17_'||:'pomp'||'_2.jpg', 'REFUSE');
-- 3. Chemin non autorisé (autre dossier)
select pg_temp.essai('3 refus: autre dossier', :'pomp', 'nexus-station-test/factures/2026-10-17_'||:'pomp'||'_3.jpg', 'REFUSE');
select pg_temp.essai('3b refus: sous-dossier', :'pomp', 'nexus-station-test/jaugeage_veeder_root/x/2026-10-17_'||:'pomp'||'_3.jpg', 'REFUSE');
-- 4. Extension non image
select pg_temp.essai('4 refus: extension pdf', :'pomp', 'nexus-station-test/jaugeage_veeder_root/2026-10-17_'||:'pomp'||'_4.pdf', 'REFUSE');
-- 5. Nom ne portant pas l''identité de l''appelant
select pg_temp.essai('5 refus: nom sans uid', :'pomp', 'nexus-station-test/jaugeage_veeder_root/2026-10-17_autre_5.jpg', 'REFUSE');
-- 6. Utilisateur non habilité (caissière / sans quart pompiste)
select pg_temp.essai('6 refus: caissiere', :'caiss', 'nexus-station-test/jaugeage_veeder_root/2026-10-17_'||:'caiss'||'_6.jpg', 'REFUSE');
-- 7. Autre pompiste (autre site) visant le site Test
select pg_temp.essai('7 refus: pompiste autre site', :'autre', 'nexus-station-test/jaugeage_veeder_root/2026-10-17_'||:'autre'||'_7.jpg', 'REFUSE');
-- 8. Remplacement (UPDATE) et suppression (DELETE) : aucune politique -> 0 ligne
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',:'pomp','role','authenticated')::text, true);
with u as (update storage.objects set name = name where bucket_id='documents-a-traiter' returning 1) insert into res select '8 refus: UPDATE', 'lignes modifiees='||count(*) from u;
-- DELETE direct SQL interdit par le trigger storage.protect_delete (API Storage seule) ; on prouve l'absence de politique DELETE pour authenticated :
insert into res select '9 refus: DELETE (politiques DELETE pour authenticated)', count(*)::text from pg_policies where schemaname='storage' and tablename='objects' and cmd in ('DELETE','ALL') and 'authenticated'=any(roles) and qual like '%documents-a-traiter%';
-- 10. Lecture : le pompiste ne gagne aucune lecture
insert into res select '10 lecture pompiste (aucun droit SELECT neuf)', 'lignes visibles='||count(*) from storage.objects where bucket_id='documents-a-traiter';
reset role;
select n, r from res order by n;
rollback;
-- Contrôle : la politique n'existe plus après rollback
select count(*) as politique_installee from pg_policies where policyname='documents_a_traiter_jaugeage_pompiste';
