-- Après 20261006220000.
do $$ declare v text; begin
  select pg_get_constraintdef(oid) into v from pg_constraint
  where conrelid = 'public.invoices'::regclass and conname = 'invoices_methode_identification_check';
  if v is distinct from 'CHECK ((methode_identification = ANY (ARRAY[''code_client''::text, ''raison_sociale''::text, ''siret''::text, ''contenu''::text, ''email''::text, ''historique''::text, ''manuel''::text, ''nom_decenium''::text])))'
  then raise exception 'ÉCHEC DEF : %', v; end if;
  if (select count(*) from pg_constraint where conrelid = 'public.invoices'::regclass and contype = 'c') <> 2
  then raise exception 'ÉCHEC DEF : nombre de CHECK sur invoices'; end if;
  raise notice 'OK DEF';
end $$;
do $$ begin
  if (select array_agg(coalesce(methode_identification, '∅') order by fichier_hash) from public.invoices where fichier_hash like 'h-%')
     is distinct from array['code_client','contenu','email','historique','manuel','∅','raison_sociale','siret']
  then raise exception 'ÉCHEC HIST : lignes historiques modifiées'; end if;
  raise notice 'OK HIST';
end $$;
-- L'insert du worker, sous le rôle de sa clé (service_role).
set role service_role;
do $$ declare r record; begin
  insert into public.invoices(billing_period_id, client_id, fichier_path, fichier_hash, methode_identification, confiance_identification, statut)
  values ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000c002', 'site-decenium/factures/x.pdf', 'h-decenium', 'nom_decenium', 0.90, 'identifiee')
  returning client_id, methode_identification, confiance_identification, statut into r;
  if r.client_id <> '00000000-0000-0000-0000-00000000c002' or r.methode_identification <> 'nom_decenium'
     or r.confiance_identification <> 0.90 or r.statut <> 'identifiee' then raise exception 'ÉCHEC DECENIUM : %', r; end if;
  raise notice 'OK DECENIUM';
end $$;
reset role;
do $$ begin
  insert into public.invoices(billing_period_id, fichier_hash, methode_identification, statut)
  values ('00000000-0000-0000-0000-00000000b001', 'h-inconnue', 'nom_inconnu', 'a_verifier');
  raise exception 'ÉCHEC REFUS : valeur inconnue acceptée';
exception when check_violation then raise notice 'OK REFUS';
end $$;
do $$ begin
  -- Aucun compte fusionné ni touché : deux comptes distincts, noms intacts.
  if (select array_agg(raison_sociale order by id) from public.clients where site = 'site-decenium')
     is distinct from array['VERT PRE Exemple','VERT PRE Exemple DIVERS']
  then raise exception 'ÉCHEC COMPTES'; end if;
  raise notice 'OK COMPTES';
end $$;
