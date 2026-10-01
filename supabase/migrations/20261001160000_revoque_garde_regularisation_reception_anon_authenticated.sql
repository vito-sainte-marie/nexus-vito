-- ---------------------------------------------------------------------------
-- FERMER `anon` ET `authenticated` SUR LA GARDE DE REGULARISATION
-- Ecrite le 01/10/2026. HORS DU LOT #65 : migration distincte et tracee.
-- `20260919103000` n'est PAS editee. Elle est appliquee en Production depuis
-- le 01/10/2026 ; une migration appliquee ne se reecrit pas, elle se complete.
--
-- CE QUI A ETE MESURE. La lecture APRES du 01/10/2026 15 h 01 UTC, prise sur
-- Production avec l'identite `nexus_prod_readonly_login`, rend pour
-- `public.nexus_garde_regularisation_reception()` l'ACL :
--
--     {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,
--      service_role=X/postgres}
--
-- `anon` et `authenticated` detiennent donc EXECUTE, alors que
-- `20260919103000` ligne 141 porte deja `revoke all on function ... from
-- public;`. L'intention de fermer etait ecrite ; l'instrument etait faux.
--
-- POURQUOI `from public` NE FERME RIEN ICI. Supabase installe un
-- `alter default privileges ... in schema public grant execute on functions to
-- anon, authenticated, service_role`. Mesure prise le 01/10/2026 sur un banc
-- jetable `supabase/postgres:17.6.1.175`, meme famille de moteur que
-- Production :
--
--     pg_default_acl, objet « f » :
--     {postgres=X/...,anon=X/...,authenticated=X/...,service_role=X/...}
--
-- Les droits d'`anon` et d'`authenticated` sont donc des GRANTS NOMMES, pas
-- l'entree du pseudo-role PUBLIC. Rejoue sur ce banc, le `revoke ... from
-- public` de `20260919103000` laisse l'ACL inchangee, octet pour octet. La
-- lecon etait deja ecrite le 16/09/2026 dans `20260916210000` « apres trois
-- occurrences du meme motif » : celle-ci etait la quatrieme. La prose n'arrete
-- pas une recurrence — `outils/garde-revoke-fonction-roles-nommes.js` le fait.
--
-- POURQUOI LE GESTE EST SUR. Mesure prise sur le meme banc, scenario fidele
-- (table, RLS, trigger et fonction verbatim de `20260919103000`, `auth.role()`
-- reelle de l'image) :
--
--   · AVANT  — `select public.nexus_garde_regularisation_reception()` par
--     `authenticated` echoue sur « trigger functions can only be called as
--     triggers » : le controle d'ACL avait donc ete FRANCHI.
--   · APRES  — le meme appel echoue sur « permission denied for function ».
--     Le revoke mord.
--   · APRES  — l'INSERT `mode_saisie = 'regularisation'` par `authenticated`
--     comme par `anon` est TOUJOURS refuse par la garde elle-meme
--     (« Regulariser une reception passee est reserve au manager ou au gerant
--     du site », errcode 42501). PostgreSQL ne controle pas EXECUTE au
--     declenchement d'un trigger : retirer EXECUTE ne desarme pas la garde.
--   · APRES  — un `manager` regularise toujours, et un `temps_reel` par un
--     employe passe toujours. Le perimetre de la garde est intact.
--
-- CE QUE LE GESTE NE TOUCHE PAS. `postgres` (proprietaire) et `service_role`
-- conservent EXECUTE : le corps de la fonction exempte explicitement
-- `auth.role() = 'service_role'`, et le connecteur ecrit sous ce role.
-- L'ACL visee, mesuree sur le banc apres le geste, est exactement :
--
--     {postgres=X/postgres,service_role=X/postgres}
--
-- IDEMPOTENCE. Rejoue, le revoke rend la meme ACL — mesure, pas suppose.
--
-- POURQUOI LE `do` BLOCK. Le rail `handoff-continuite-20260920` ne porte PAS
-- `20260919103000` : la fonction y est absente. Un `revoke` nu y echouerait.
-- Le bloc ne se tait pas pour autant : il DIT laquelle des deux branches il a
-- prise, pour qu'un journal muet ne puisse pas passer pour un succes.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'nexus_garde_regularisation_reception'
       and p.pronargs = 0
  ) then
    revoke all on function public.nexus_garde_regularisation_reception()
      from anon, authenticated;
    raise notice 'nexus_garde_regularisation_reception : EXECUTE retire a anon et authenticated. ACL restante attendue : postgres, service_role.';
  else
    raise notice 'nexus_garde_regularisation_reception : fonction ABSENTE de cet environnement (20260919103000 non appliquee ici). Aucun droit a retirer. Ce n''est pas un succes de fermeture.';
  end if;
end
$$;

-- nexus-acl-intention: public.nexus_garde_regularisation_reception() ferme anon
-- nexus-acl-intention: public.nexus_garde_regularisation_reception() ferme authenticated
