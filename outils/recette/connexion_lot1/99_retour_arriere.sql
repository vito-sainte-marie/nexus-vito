-- Retour arrière de l'étape 1 : restaure les e-mails Auth et l'ancienne RPC (username). Test uniquement tant que rien n'est promu.
update auth.users u set email = s.email_avant, updated_at = now() from nexus_connexion.sauvegarde_auth s where s.user_id = u.id;
update auth.identities i set identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(s.identity_email_avant)), updated_at = now()
from nexus_connexion.sauvegarde_auth s where s.user_id = i.user_id and i.provider = 'email' and s.identity_email_avant is not null;
create or replace function public.nexus_identifiant_de_connexion(p_prenom text) returns text
language sql stable security definer set search_path to 'public', 'pg_temp' as
$$ select case when count(*) = 1 then min(e.username) end from public.employees e
   where (e.actif = true or e.compte_test = true) and lower(btrim(e.nom)) = lower(btrim(coalesce(p_prenom, ''))) $$;
-- Les objets du schéma nexus_connexion sont conservés (sauvegarde) ; les supprimer est un geste distinct.
