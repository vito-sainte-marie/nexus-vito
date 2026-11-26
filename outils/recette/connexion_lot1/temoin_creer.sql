-- Compte témoin de connexion (Production). À lancer par Guardian, APRÈS les 14 migrations, AVANT la bascule de la page (étape 5).
-- Un seul paramètre : le hash bcrypt littéral, calculé hors canal (aucun code ici). Pas de métacommande psql.
do $c$
declare
  v_id uuid := gen_random_uuid();
  v_hash text := :'hash';
  v_email text;
begin
  if v_hash !~ '^\$2[aby]\$[0-9]{2}\$.{53}$' then raise exception 'témoin : hash bcrypt invalide'; end if;
  if exists (select 1 from public.employees where username = 'temoin-connexion') then raise exception 'témoin : déjà présent'; end if;
  insert into public.employees (id, username, nom, role, actif, est_createur, site_id, compte_test)
  values (v_id, 'temoin-connexion', 'Temoinconnexion', 'vacataire', true, false, 'vito-sainte-marie', true);
  v_email := public.nexus_connexion_email_de(v_id);
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email, v_hash, now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, 'email',
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), now(), now());
  insert into nexus_connexion.compte (user_id, etat, echeance)
  values (v_id, 'a_migrer', now() + make_interval(days => (select migration_jours from nexus_connexion.parametres where id = 1)))
  on conflict (user_id) do nothing;
  if (select etat from nexus_connexion.compte where user_id = v_id) <> 'a_migrer'
     or v_email !~ '^[0-9a-f]{32}@vito-nexus\.local$' then raise exception 'témoin : état ou e-mail non conforme'; end if;
  raise notice 'TEMOIN_ID=%', v_id;
end $c$;
select e.id as temoin_id, e.nom, e.role, e.site_id, e.compte_test, c.etat,
       (select count(*) from auth.users where id = e.id) as auth_users,
       (select count(*) from auth.identities where user_id = e.id) as auth_identities
from public.employees e join nexus_connexion.compte c on c.user_id = e.id where e.username = 'temoin-connexion';
-- attendu : 1 ligne (temoin_id = l'id à noter), etat a_migrer, auth_users 1, auth_identities 1.
