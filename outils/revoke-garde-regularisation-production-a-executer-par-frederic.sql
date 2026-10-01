-- REVOKE EXECUTE SUR public.nexus_garde_regularisation_reception()
-- GO de Frédéric Bragance, 01/10/2026 : « GO pour le revoke sur anon et authenticated ».
--
-- À EXÉCUTER PAR FRÉDÉRIC SUR PRODUCTION. Claude ne l'a pas appliquée : il n'a
-- aucun chemin d'écriture vers Production, et ce refus porte sur le RÉSULTAT,
-- pas sur la commande — il ne se contourne ni par un autre outil, ni par le
-- serveur MCP Supabase, ni en le découpant en morceaux.
--
-- CE N'EST PAS UNE URGENCE, ET IL FAUT LE DIRE. PostgreSQL NE VÉRIFIE PAS
-- `EXECUTE` quand un trigger se déclenche, et une fonction `returns trigger`
-- ne peut pas être appelée autrement : un appel direct par `anon` ou
-- `authenticated` échoue sur « trigger functions can only be called as
-- triggers ». Mesuré le 01/10/2026 sur un banc `supabase/postgres:17.6.1.175`.
-- L'exposition pratique est donc nulle. Ce qui est réel, c'est que la migration
-- `20260919103000` a ÉCRIT l'intention de fermer (`revoke all ... from public`,
-- ligne 141) et que cette intention n'a pas pris effet. On referme parce que
-- l'écart entre ce que le dépôt dit et ce que la base fait est, lui, un vrai
-- défaut — pas parce qu'une porte serait ouverte.
--
-- POURQUOI `from public` NE FERME RIEN. Supabase installe sur le schéma
-- `public` un `alter default privileges ... grant execute on functions to anon,
-- authenticated, service_role`. Les droits de ces rôles sont des GRANTS
-- NOMMÉS ; `revoke ... from public` ne retire que l'entrée du pseudo-rôle
-- PUBLIC et laisse l'ACL inchangée, octet pour octet. Quatrième occurrence du
-- même motif, et la leçon était déjà écrite en prose dans `20260916210000`
-- depuis le 16/09/2026. C'est pourquoi le dépôt porte désormais
-- `outils/garde-revoke-fonction-roles-nommes.js` : la prose n'arrête pas une
-- récurrence, une garde le fait.
--
-- CE QUI RESTE APRÈS. `postgres` et `service_role` conservent EXECUTE. L'ACL
-- attendue est exactement `{postgres=X/postgres,service_role=X/postgres}`.
-- `service_role` est conservé délibérément : la fonction elle-même exempte
-- `auth.role() = 'service_role'` de la règle de régularisation.
--
-- CE QUI NE CHANGE PAS. Le trigger continue de se déclencher et de refuser la
-- régularisation à un employé (42501, « Regulariser une reception passee est
-- reserve au manager ou au gerant du site ») ; le manager régularise toujours ;
-- une saisie `temps_reel` passe toujours. Les quatre témoins ont été rejoués
-- avant ET après le revoke sur le banc.
--
-- CETTE MIGRATION EXISTE AUSSI DANS LE DÉPÔT, sous
-- `supabase/migrations/20261001160000_revoque_garde_regularisation_reception_anon_authenticated.sql`.
-- Ce fichier-ci en est l'équivalent immédiat, à coller dans l'éditeur SQL si
-- vous ne voulez pas attendre la fusion et le déploiement. Les deux sont
-- IDEMPOTENTS : exécuter l'un puis l'autre ne produit aucune erreur.
--
-- ---------------------------------------------------------------------------
-- 1. LECTURE AVANT — ne rien appliquer sans avoir vu l'état de départ.
-- ---------------------------------------------------------------------------
select
  'AVANT' as moment,
  p.proname as fonction,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proacl, ','), '(ACL nulle = droits par defaut)') as acl,
  case
    when p.proacl is null then 'ACL NULLE — cas non attendu ici, arreter et rouvrir le diagnostic'
    when array_to_string(p.proacl, ',') like '%anon=X%'
      or array_to_string(p.proacl, ',') like '%authenticated=X%'
      then 'TROU CONFIRME — le revoke ci-dessous a du travail'
    else 'DEJA FERME — le revoke ci-dessous ne changera rien (et c est normal)'
  end as verdict_avant
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'nexus_garde_regularisation_reception'
  and p.pronargs = 0;

-- ---------------------------------------------------------------------------
-- 2. LE REVOKE — les deux rôles sont NOMMÉS. C'est tout l'enjeu.
--    Le `do` existe parce que la fonction peut être absente d'un environnement
--    où `20260919103000` n'est pas appliquée : dans ce cas il faut un message
--    explicite, pas un succès trompeur.
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

-- ---------------------------------------------------------------------------
-- 3. LECTURE APRÈS — la rubrique se juge elle-même. Un seul mot à lire dans la
--    colonne `verdict_apres`. Toute valeur autre que `FERME` est un échec, y
--    compris l'absence de ligne : zéro ligne ici signifierait que la fonction
--    n'existe pas, donc que la lecture du §1 portait sur autre chose.
-- ---------------------------------------------------------------------------
select
  'APRES' as moment,
  p.proname as fonction,
  coalesce(array_to_string(p.proacl, ','), '(ACL nulle)') as acl,
  case
    when array_to_string(p.proacl, ',') like '%anon=%'          then 'ECHEC — anon detient encore un droit'
    when array_to_string(p.proacl, ',') like '%authenticated=%' then 'ECHEC — authenticated detient encore un droit'
    when array_to_string(p.proacl, ',') not like '%service_role=X%'
      then 'ECHEC — service_role a perdu EXECUTE, ce qui casse l exemption de la fonction'
    when array_to_string(p.proacl, ',') not like '%postgres=X%'
      then 'ECHEC — postgres a perdu EXECUTE'
    else 'FERME'
  end as verdict_apres
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'nexus_garde_regularisation_reception'
  and p.pronargs = 0;

-- ---------------------------------------------------------------------------
-- 4. CONTRÔLE DE NON-RÉGRESSION DU TRIGGER — il doit être toujours là et actif.
--    `tgenabled = 'O'` = activé en mode origine. Le revoke n'y touche pas, et
--    c'est précisément ce qu'il faut vérifier plutôt que croire.
-- ---------------------------------------------------------------------------
select
  t.tgname as trigger,
  c.relname as table_portee,
  t.tgenabled::text as actif,
  case when t.tgenabled = 'O' then 'INTACT' else 'ECHEC — trigger desactive' end as verdict_trigger
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and t.tgname = 'trg_garde_regularisation_reception'
  and not t.tgisinternal;

-- CE QUI RESTE OUVERT APRÈS CE FICHIER. 17 autres fonctions du dépôt portent
-- encore le même silence (18 avant celle-ci). Elles ne sont PAS à refermer en
-- bloc : plusieurs doivent légitimement rester exécutables par `authenticated`
-- (`mes_ecarts_caisse()` est appelée par un écran connecté). Le défaut à
-- réparer est le silence sur l'intention, pas le grant. La garde les compte et
-- rougira si ce compte bouge dans un sens comme dans l'autre.
