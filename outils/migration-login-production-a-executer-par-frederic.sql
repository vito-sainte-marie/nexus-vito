-- MIGRATION LOGIN NEXUS SUR PRODUCTION — 20260904175747_login_non_enumerable
-- Remise en service de l'écran de connexion, en panne depuis le déploiement #65.
--
-- À EXÉCUTER PAR FRÉDÉRIC SUR PRODUCTION (uzhjpqpctpvxytxpxoqz). Claude ne l'a
-- pas appliquée : il n'a aucun chemin d'écriture vers Production, et ce refus
-- porte sur le RÉSULTAT, pas sur la commande — il ne se contourne ni par un
-- autre outil, ni par le serveur MCP Supabase, ni en le découpant en morceaux.
--
-- CE QUI S'EST PASSÉ. Le 04/09/2026 à 10h51, `20260904105148` a retiré à `anon`
-- tous les droits d'ÉCRITURE sur la vue `public.employees_public`, et a gardé le
-- SELECT en l'écrivant noir sur blanc : « On ne conserve QUE le SELECT, dont
-- l'écran de connexion a besoin — provisoirement, cette vue devant être
-- remplacée par une authentification non énumérable. » Six heures plus tard,
-- `20260904175747` a écrit ce remplacement : une fonction qui traduit un prénom
-- en identifiant sans permettre d'énumérer, et la fermeture du SELECT anonyme.
-- Son en-tête prescrit l'ordre, lignes 72 à 76 : « Les deux vont ensemble, dans
-- cet ordre : code promu, puis migration appliquée. »
--
-- La moitié a été faite. Le 01/10/2026 à 13h49, la fusion de #65 a promu le
-- code : `NEXUS-Login-v1.html` appelle désormais la fonction, ligne 146, et ne
-- lit plus la vue. La migration, elle, n'a jamais été appliquée. L'écran appelle
-- donc dans le vide et rend « Connexion au serveur impossible ».
--
-- UN SEUL GESTE FERME DEUX CHOSES. La panne et la fuite ont la même cause : la
-- moitié manquante. Appliquer cette migration rend la connexion ET referme le
-- SELECT anonyme laissé ouvert « provisoirement » depuis 27 jours.
--
-- CE QUI A ÉTÉ MESURÉ DANS LE DÉPÔT, PAS SUPPOSÉ. Sur l'arbre servi par
-- Production (adee9bbcb6fd7e0af7632730ede185e655d04580), aucun fichier de front
-- ne nomme `employees_public` : ni écran, ni module. Retirer le SELECT anonyme
-- ne casse donc aucun appel existant. C'est la condition qui manquait le
-- 04/09/2026 et qui est remplie aujourd'hui.
--
-- CE QUI N'A PAS ÉTÉ MESURÉ, ET QUI SE MESURE ICI. L'état réel du catalogue
-- Production n'a pas été lu par Claude : il n'y a pas accès. La section 0
-- refuse d'appliquer quoi que ce soit si l'état de départ n'est pas celui
-- décrit ci-dessus. Si elle s'arrête, le diagnostic est faux et il faut le
-- reprendre, pas forcer le passage.
--
-- CE QUI RESTE OUVERT APRÈS, ET CE N'EST PAS UN OUBLI. `authenticated` garde le
-- SELECT sur `employees_public` : la migration ne le retire pas. Ce reste est
-- largement neutralisé par `security_invoker = true`, qui fait repasser la vue
-- sous la RLS de l'appelant au lieu des droits du propriétaire. Et la fonction
-- ne ferme pas tout : on ne peut plus LISTER les employés, on peut encore
-- CONFIRMER un prénom deviné. La porte est rétrécie, pas condamnée — le
-- remplacement définitif (Edge Function, limitation atomique des tentatives,
-- verrouillage de compte) reste un lot à part.
--
-- CE QUE CE FICHIER NE FAIT PAS. Il n'inscrit pas l'estampille
-- `20260904175747` au registre des migrations. Le fichier de migration vit sur
-- le rail `handoff-continuite-20260920` et pas sur l'arbre `production` :
-- inscrire l'estampille ferait croire qu'un fichier absent a été joué. Production
-- portera donc l'effet sans l'estampille, exactement comme pour
-- `20261001160000`. C'est une divergence NOMMÉE, qui se résorbe quand le rail
-- est fusionné, pas un oubli.
--
-- POURQUOI UNE TRANSACTION ET PAS DES `raise exception` EN VRAC. Un
-- `raise exception` dans un fichier multi-instructions n'arrête pas le fichier :
-- sans `ON_ERROR_STOP` le client enchaîne les instructions suivantes et sort
-- avec le code 0. `ON_ERROR_STOP` corrigerait cela, mais c'est une option de
-- `psql`, et ce fichier ne doit pas dépendre du client qui le joue. La
-- transaction est la seule garde indépendante du client : si la section 5
-- refuse, le `commit` n'arrive jamais et RIEN n'est appliqué.
--
-- Ce n'était pas une supposition : le 01/10/2026, ce fichier a été joué sur un
-- banc jetable (image `supabase/postgres:17.6.1.175`, qui porte les vrais rôles
-- `anon`, `authenticated`, `service_role` et les default privileges de Supabase),
-- sur un état reproduisant celui décrit ci-dessus. Sept passages : le nominal et
-- six mutations isolées, chacune sur un bac remis à neuf. Résultat mesuré sur
-- refus : la base ressort intacte — la fonction reste absente — et le code de
-- sortie de `psql` vaut malgré tout 0. D'où la section 6.
--
-- LANCEZ-LE AVEC `-v ON_ERROR_STOP=1` SI VOUS LE POUVEZ. Ce n'est pas requis
-- pour la sûreté de la base, qui est assurée par la transaction, mais cela fait
-- échouer le shell quand le fichier refuse, au lieu de le laisser annoncer un
-- succès. Sans cette option, lisez la DERNIÈRE ligne : la section 6 l'écrit.
--
-- CE QUE LES `grant execute` DU CORPS NE PROUVENT PAS. Mesure du même banc :
-- une fonction créée dans le schéma `public` d'une base Supabase porte DÉJÀ
-- `anon=X` et `authenticated=X` dans son ACL avant tout `grant`, par les default
-- privileges du schéma. Les deux `grant execute` de la section 2 sont donc
-- redondants sur cette cible : les retirer laisse la fonction appelable, et
-- l'artefact l'a constaté sans rien refuser. Ils ne sont pas inutiles — ils
-- rendent le droit explicite et survivraient à un changement de default
-- privileges — mais leur absence serait INDÉTECTABLE par lecture de `proacl`.
-- C'est pourquoi la section 5 interroge `has_function_privilege` et non le texte
-- de l'ACL : chercher `anon=X` dans `proacl` aurait été une garde verte pour la
-- mauvaise raison. Même famille que le `revoke … from public` qui ne ferme pas
-- `anon` : à chaque fois, c'est le rôle nommé qu'il faut interroger.
--
-- ---------------------------------------------------------------------------
begin;

-- ---------------------------------------------------------------------------
-- 0. GARDE DE PRÉCONDITION — refuser plutôt que d'appliquer à l'aveugle.
--    Chaque contrôle décrit l'état que le diagnostic affirme. Si l'un est
--    faux, le diagnostic est faux.
-- ---------------------------------------------------------------------------
do $garde$
declare
  v_manquantes text;
begin
  -- a. La fonction doit être ABSENTE. C'est le trou que l'on vient combler.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'nexus_identifiant_de_connexion'
  ) then
    raise exception 'ARRET — public.nexus_identifiant_de_connexion EXISTE DEJA sur cette base. Le trou diagnostique est donc refermé, et la panne de connexion a une AUTRE cause qu''il faut chercher ailleurs. Rien n''est appliqué.';
  end if;

  -- b. La vue visée par la partie 2 doit exister.
  if to_regclass('public.employees_public') is null then
    raise exception 'ARRET — la vue public.employees_public est introuvable. Ce n''est pas la base attendue, ou le schéma a divergé au-delà de ce que ce fichier sait traiter.';
  end if;

  -- c. La table lue par la fonction doit porter les quatre colonnes nommées
  --    dans son corps. Sans elles, on créerait une fonction cassée.
  select string_agg(c.attendue, ', ')
    into v_manquantes
  from (values ('username'), ('nom'), ('actif'), ('compte_test')) as c(attendue)
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employees'
      and column_name = c.attendue
  );
  if v_manquantes is not null then
    raise exception 'ARRET — public.employees ne porte pas la ou les colonnes suivantes, que le corps de la fonction interroge : %. Créer la fonction ici la rendrait cassée.', v_manquantes;
  end if;

  -- d. `anon` doit ENCORE avoir le SELECT sur la vue. C'est ce que la partie 2
  --    retire. S'il ne l'a plus, quelqu'un est déjà passé hors bande et l'état
  --    de départ n'est pas celui décrit : on s'arrête pour qu'un humain regarde.
  if not has_table_privilege('anon', 'public.employees_public', 'SELECT') then
    raise exception 'ARRET — `anon` n''a DEJA plus le SELECT sur public.employees_public, alors que la fonction est absente. Cet état mi-chemin n''est pas celui décrit par le diagnostic : une intervention hors bande a eu lieu. Rien n''est appliqué.';
  end if;

  raise notice 'Section 0 — précondition conforme : fonction absente, vue présente, 4 colonnes présentes, SELECT anonyme encore ouvert.';
end
$garde$;

-- ---------------------------------------------------------------------------
-- 1. LECTURE AVANT — ne rien appliquer sans avoir vu l'état de départ.
--    Aucune donnée personnelle n'est affichée : des comptes se comptent, ils
--    ne se listent pas.
-- ---------------------------------------------------------------------------
select
  'AVANT' as moment,
  current_database() as base,
  current_user as identite,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'nexus_identifiant_de_connexion')
    as fonction_login_presente,
  has_table_privilege('anon', 'public.employees_public', 'SELECT')
    as anon_lit_la_vue,
  coalesce(
    (select 'oui' from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'employees_public'
        and c.reloptions @> array['security_invoker=true']),
    'non') as vue_sous_rls_appelant,
  (select count(*) from public.employees where actif = true or compte_test = true)
    as comptes_joignables;

-- ---------------------------------------------------------------------------
-- 2. LA MIGRATION — corps repris À L'IDENTIQUE de
--    supabase/migrations/20260904175747_login_non_enumerable.sql, lignes 78 à
--    101. Rien n'est recréé de mémoire : ce bloc est extrait du fichier.
-- ---------------------------------------------------------------------------

-- 1. La seule question que la connexion a le droit de poser.
create or replace function public.nexus_identifiant_de_connexion(p_prenom text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select case when count(*) = 1 then min(e.username) end
  from public.employees e
  where (e.actif = true or e.compte_test = true)
    and lower(btrim(e.nom)) = lower(btrim(coalesce(p_prenom, '')));
$$;

comment on function public.nexus_identifiant_de_connexion(text) is
  'Écran de connexion : traduit un prénom en identifiant technique. Renvoie NULL si le prénom est inconnu ou porté par plusieurs comptes. Ne permet aucune énumération.';

revoke all on function public.nexus_identifiant_de_connexion(text) from public;
grant execute on function public.nexus_identifiant_de_connexion(text) to anon;
grant execute on function public.nexus_identifiant_de_connexion(text) to authenticated;

-- 2. La vue cesse d'être une porte anonyme et repasse sous RLS.
revoke select on public.employees_public from anon;
alter view public.employees_public set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- 3. LECTURE APRÈS — ce que la base dit d'elle-même, une fois la migration
--    appliquée et AVANT le commit. La section 5 décide ; celle-ci montre.
-- ---------------------------------------------------------------------------
select
  'APRES' as moment,
  p.prosecdef as security_definer,
  p.proconfig as reglages,
  pg_get_function_identity_arguments(p.oid) as signature,
  array_to_string(p.proacl, ',') as acl_fonction
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'nexus_identifiant_de_connexion';

select
  'APRES' as moment,
  has_table_privilege('anon', 'public.employees_public', 'SELECT')
    as anon_lit_encore_la_vue,
  has_table_privilege('authenticated', 'public.employees_public', 'SELECT')
    as authenticated_lit_la_vue,
  coalesce(
    (select 'oui' from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'employees_public'
        and c.reloptions @> array['security_invoker=true']),
    'non') as vue_sous_rls_appelant;

-- ---------------------------------------------------------------------------
-- 4. CONTRÔLE DE NON-RÉGRESSION — la fonction doit RÉPONDRE, et le refus doit
--    REFUSER. Lire une ACL ne prouve ni l'un ni l'autre : on exerce les deux.
--    Aucun prénom ni identifiant n'est affiché, seulement la conformité.
-- ---------------------------------------------------------------------------
do $recette$
declare
  v_cle        text;
  v_attendu    text;
  v_obtenu     text;
  v_lignes     bigint;
  v_unique_mesure boolean := false;
begin
  -- a. Un prénom porté par un SEUL compte joignable doit rendre son identifiant.
  --    Le prénom est choisi par la base, pas écrit ici.
  select lower(btrim(e.nom)), min(e.username)
    into v_cle, v_attendu
  from public.employees e
  where e.actif = true or e.compte_test = true
  group by lower(btrim(e.nom))
  having count(*) = 1
  limit 1;

  if v_cle is null then
    raise notice 'Contrôle 4a NON MESURÉ — aucun prénom n''est porté par un seul compte joignable sur cette base.';
  else
    v_obtenu := public.nexus_identifiant_de_connexion(v_cle);
    if v_obtenu is null then
      raise exception 'ARRET — la fonction rend NULL pour un prénom pourtant porté par un seul compte joignable. L''écran de connexion resterait en panne. Transaction annulée.';
    end if;
    if v_obtenu is distinct from v_attendu then
      raise exception 'ARRET — la fonction ne rend pas l''identifiant attendu pour un prénom unique. Transaction annulée. (Les valeurs ne sont pas affichées : ce sont des données nominatives.)';
    end if;
    v_unique_mesure := true;
    raise notice 'Contrôle 4a OK — un prénom unique rend bien son identifiant.';
  end if;

  -- b. Un prénom inconnu doit rendre NULL, pas une erreur et pas une liste.
  if public.nexus_identifiant_de_connexion('prenom-qui-n-existe-pas-20261001') is not null then
    raise exception 'ARRET — la fonction rend une valeur pour un prénom inconnu. Transaction annulée.';
  end if;
  raise notice 'Contrôle 4b OK — un prénom inconnu rend NULL.';

  -- c. `anon` ne doit PLUS pouvoir interroger la vue. Et attention : sous RLS,
  --    un refus se déguise en « 0 ligne ». Zéro n'est pas un refus. On exige
  --    l'erreur 42501, pas un résultat vide.
  begin
    set local role anon;
  exception when others then
    raise exception 'ARRET — ce rôle ne peut pas prendre le rôle `anon` (SET ROLE). Rejouez ce fichier avec le rôle `postgres` du connecteur : sans cela les contrôles 4c et 4d ne sont pas mesurables, et une ACL lue ne les remplace pas.';
  end;

  begin
    select count(*) into v_lignes from public.employees_public;
    reset role;
    raise exception 'ARRET — `anon` a pu INTERROGER public.employees_public sans erreur (% ligne(s) visible(s)). Le SELECT n''a pas été retiré. Un 0 n''est pas un refus. Transaction annulée.', v_lignes;
  exception
    when insufficient_privilege then
      reset role;
      raise notice 'Contrôle 4c OK — `anon` est refusé sur employees_public par un vrai 42501, pas par une liste vide.';
  end;

  -- d. Et pourtant `anon` doit POUVOIR appeler la fonction : c'est tout l'objet
  --    du correctif. Un `revoke all ... from public` suivi de grants qui
  --    n'auraient pas pris laisserait la connexion en panne autrement.
  begin
    set local role anon;
  exception when others then
    raise exception 'ARRET — impossible de reprendre le rôle `anon` pour le contrôle 4d.';
  end;

  begin
    perform public.nexus_identifiant_de_connexion('prenom-qui-n-existe-pas-20261001');
    reset role;
    raise notice 'Contrôle 4d OK — `anon` peut appeler la fonction : la connexion a de nouveau son chemin.';
  exception
    when insufficient_privilege then
      reset role;
      raise exception 'ARRET — `anon` ne peut PAS appeler public.nexus_identifiant_de_connexion. Les grants n''ont pas pris et l''écran de connexion resterait en panne. Transaction annulée.';
  end;

  if not v_unique_mesure then
    raise notice 'ATTENTION — 3 contrôles sur 4 mesurés. Le 4a n''a pas pu l''être, faute de prénom unique.';
  end if;
end
$recette$;

-- ---------------------------------------------------------------------------
-- 5. VERDICT QUI ENGAGE — la section 3 affiche, celle-ci décide. Si un seul
--    contrôle dévie, le commit n'arrive jamais et la base ressort intacte.
-- ---------------------------------------------------------------------------
do $verdict$
declare
  v_acl   text;
  v_conf  text[];
begin
  select array_to_string(p.proacl, ','), p.proconfig
    into v_acl, v_conf
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'nexus_identifiant_de_connexion';

  if v_acl is null then
    raise exception 'ARRET — ACL nulle sur la fonction : aucun droit explicite ne subsiste, y compris ceux de postgres. Ce n''est pas l''état voulu. Transaction annulée.';
  end if;
  -- Le test porte sur le privilege EFFECTIF, pas sur le texte de l'ACL.
  -- Mesure du 01/10 sur l'image Supabase : une fonction creee dans `public`
  -- porte deja `anon=X` et `authenticated=X` par default privileges, AVANT tout
  -- `grant`. Lire `proacl` a la recherche de `anon=X` serait donc vert meme si
  -- les deux `grant execute` du corps avaient disparu. `has_function_privilege`
  -- repond a la seule question qui compte : l'ecran de connexion peut-il appeler.
  if not has_function_privilege('anon', 'public.nexus_identifiant_de_connexion(text)', 'EXECUTE') then
    raise exception 'ARRET — `anon` n''a pas EXECUTE sur la fonction. ACL : %. L''écran de connexion resterait en panne. Transaction annulée.', v_acl;
  end if;
  if not has_function_privilege('authenticated', 'public.nexus_identifiant_de_connexion(text)', 'EXECUTE') then
    raise exception 'ARRET — `authenticated` n''a pas EXECUTE sur la fonction. ACL : %. Transaction annulée.', v_acl;
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'nexus_identifiant_de_connexion'
      and p.prosecdef
  ) then
    raise exception 'ARRET — la fonction n''est pas `security definer`. Elle ne pourrait pas lire employees pour un appelant anonyme. Transaction annulée.';
  end if;
  if v_conf is null or not ('search_path=public' = any(v_conf)) then
    raise exception 'ARRET — `search_path` n''est pas figé à `public` sur la fonction : %. Une fonction `security definer` sans search_path figé est détournable. Transaction annulée.', coalesce(array_to_string(v_conf, ','), '(aucun)');
  end if;

  if has_table_privilege('anon', 'public.employees_public', 'SELECT') then
    raise exception 'ARRET — `anon` conserve le SELECT sur public.employees_public. La fuite d''annuaire resterait ouverte. Transaction annulée.';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'employees_public'
      and c.reloptions @> array['security_invoker=true']
  ) then
    raise exception 'ARRET — la vue employees_public n''est pas passée en `security_invoker = true`. Elle resterait une porte ouverte par les droits de son propriétaire. Transaction annulée.';
  end if;

  raise notice 'MIGRATION_LOGIN_APPLIQUEE — fonction présente, security definer, search_path figé, EXECUTE effectif pour anon et authenticated, SELECT anonyme refermé, vue sous RLS de l''appelant.';
end
$verdict$;

commit;

-- ---------------------------------------------------------------------------
-- APRÈS LE COMMIT — ce qui reste à faire, et qui n'est pas du SQL.
--
-- 1. La recette réelle de connexion, décrite dans
--    docs/deploiement/procedure-migration-login-production.md. Tant qu'un
--    humain ne s'est pas connecté, la remise en service n'est pas constatée :
--    un commit vert prouve l'état de la base, pas le parcours de l'écran.
--
-- 2. L'estampille `20260904175747` n'est PAS au registre, délibérément. Elle y
--    entrera quand le rail sera fusionné et que le fichier de migration vivra
--    sur l'arbre `production`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 6. RELECTURE TERMINALE, HORS TRANSACTION — la dernière ligne à l'écran.
--
--    Mesure du 01/10 sur banc : quand un `raise exception` ci-dessus annule la
--    transaction, la base ressort bien intacte — mais `psql` sort avec le code
--    0 si `ON_ERROR_STOP` ne lui a pas été passé. Le refus défile alors hors de
--    l'écran et le shell annonce un succès. Cette section-ci s'exécute dans
--    TOUS les cas, refus compris, parce qu'elle est APRÈS le `commit;` (qui,
--    sur une transaction annulée, est un rollback et rend la session utilisable
--    de nouveau). Elle rend l'état réel en clair, en dernier.
--
--    Elle ne décide rien : c'est la section 5 qui décide. Elle constate.
-- ---------------------------------------------------------------------------
select
  case
    when to_regprocedure('public.nexus_identifiant_de_connexion(text)') is null
      then 'ETAT_FINAL MIGRATION_LOGIN_NON_APPLIQUEE — la fonction est absente. Remontez l''écran : un ARRET dit pourquoi. La base est intacte.'
    when to_regclass('public.employees_public') is null
      then 'ETAT_FINAL MIGRATION_LOGIN_INCOHERENTE — la fonction est présente mais la vue employees_public a disparu.'
    when has_table_privilege('anon', 'public.employees_public', 'SELECT')
      then 'ETAT_FINAL MIGRATION_LOGIN_INCOMPLETE — fonction présente, mais le SELECT anonyme sur employees_public est encore ouvert.'
    when not has_function_privilege('anon', 'public.nexus_identifiant_de_connexion(text)', 'EXECUTE')
      then 'ETAT_FINAL MIGRATION_LOGIN_INCOMPLETE — fonction présente, mais `anon` ne peut pas l''appeler : l''écran resterait en panne.'
    else 'ETAT_FINAL MIGRATION_LOGIN_APPLIQUEE — la connexion a son chemin, et la vue n''est plus une porte anonyme.'
  end as etat_final;
