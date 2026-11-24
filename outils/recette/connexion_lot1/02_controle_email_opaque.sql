-- Contrôle réutilisable (lecture seule) : tout compte Auth lié à un employé doit avoir un e-mail opaque
-- <32 hex>@vito-nexus.local ET égal à nexus_connexion_email_de(id), dans auth.users ET auth.identities.
-- À lancer après CHAQUE création ou réinitialisation de compte, avec le rôle service_role ou postgres.
-- Résultat attendu : 0 ligne. Toute ligne est un compte qui ne pourra pas se connecter (ou qui expose son identifiant).
select e.id as employee_id, e.nom,
       case
         when u.id is null then 'employé sans compte Auth'
         when u.email !~ '^[0-9a-f]{32}@vito-nexus\.local$' then 'e-mail non opaque'
         when u.email <> public.nexus_connexion_email_de(e.id) then 'e-mail opaque mais différent de l''alias attendu'
         when i.identity_data->>'email' is distinct from u.email then 'identité Auth désaccordée'
       end as defaut
from public.employees e
left join auth.users u on u.id = e.id
left join auth.identities i on i.user_id = u.id and i.provider = 'email'
where (e.actif = true or e.compte_test = true)
  and u.id is not null  -- un employé sans compte Auth n'est pas un défaut de connexion ; retirer cette ligne pour le lister
  and (u.email !~ '^[0-9a-f]{32}@vito-nexus\.local$'
       or u.email <> public.nexus_connexion_email_de(e.id)
       or i.identity_data->>'email' is distinct from u.email);
