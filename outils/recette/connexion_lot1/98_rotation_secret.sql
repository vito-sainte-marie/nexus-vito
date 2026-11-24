-- Rotation du secret HMAC de la connexion (NE PAS lancer sans GO du gérant ; pas rejouée sur Test à ce jour).
-- Effet : tous les alias changent, donc TOUS les e-mails Auth sont réécrits dans la même transaction.
-- Pendant la transaction les connexions attendent ; après COMMIT elles utilisent le nouvel alias. Aucune session ouverte n'est coupée.
-- À lancer avec le rôle postgres (éditeur SQL du projet) : seul ce rôle et service_role lisent le schéma nexus_connexion.
begin;
create table if not exists nexus_connexion.sauvegarde_secret (fait_le timestamptz primary key default now(), cle bytea not null);
insert into nexus_connexion.sauvegarde_secret (cle) select cle from nexus_connexion.secret where id = 1;
update nexus_connexion.secret set cle = gen_random_bytes(32) where id = 1;
update auth.users u set email = public.nexus_connexion_email_de(u.id), updated_at = now()
 where u.id in (select id from public.employees) and u.email like '%@vito-nexus.local';
update auth.identities i set identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(u.email)), updated_at = now()
 from auth.users u where u.id = i.user_id and i.provider = 'email' and u.id in (select id from public.employees);
-- garde : zéro défaut au contrôle 02
do $$ begin
  if exists (select 1 from auth.users u join public.employees e on e.id=u.id
             where u.email <> public.nexus_connexion_email_de(u.id)) then
    raise exception 'rotation : un e-mail ne correspond pas au nouvel alias';
  end if;
end $$;
commit;
-- Retour arrière de la rotation : remettre la clé de nexus_connexion.sauvegarde_secret (la plus récente) dans nexus_connexion.secret,
-- puis relancer les deux UPDATE ci-dessus.
