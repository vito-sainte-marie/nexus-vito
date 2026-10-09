-- Verrouiller les RPC de lecture du stock sur le site du compte appelant
-- (04/09/2026).
--
-- FAILLE CONSTATÉE PAR APPEL RÉEL, sur la recette Cloudflare et avec la
-- seule clé publiable — publique par nature, servie dans nexus-config.js :
--
--   POST /rest/v1/rpc/nexus_stock_lire_etat_json  {"p_site":"vito-sainte-marie"}
--   → 200, 119 lignes : désignations, codes-barres, catégories, stocks.
--
-- Sans aucune authentification. Les deux fonctions cumulaient trois
-- propriétés dont chacune est légitime isolément et dont la réunion ouvre
-- la base entière :
--   1. SECURITY DEFINER — elles s'exécutent avec les droits du propriétaire ;
--   2. row_security = off — elles ignorent délibérément la RLS, pour tenir
--      le budget de 8 s sur une requête qui balaie huit tables ;
--   3. EXECUTE accordé à PUBLIC (donc anon) — et le site lu était pris dans
--      le PARAMÈTRE de l'appelant, jamais confronté à son compte.
--
-- Le paramètre `p_site` était donc une clé d'accès universelle : il suffisait
-- de le changer pour lire le stock de n'importe quel commerce. Sur un produit
-- multi-sites, c'est la fuite d'un client vers un autre.
--
-- CORRECTION, en deux temps plutôt qu'en un :
--
--   a. La garde `nexus_site_autorise()` refuse tout appel anonyme et tout
--      site qui n'est pas celui du compte — avec la seule exception déjà
--      admise ailleurs dans le schéma (politiques `sites`, `pointages`,
--      `mission_progress`) : le créateur, sur les sites qui l'ont
--      explicitement autorisé. Elle LÈVE une exception au lieu de renvoyer
--      un ensemble vide : un refus doit se voir, pas se confondre avec un
--      stock à zéro.
--
--   b. Le corps de calcul est déplacé sous `nexus_stock_lire_etat_donnees`,
--      dont l'exécution est retirée à anon et à authenticated. Il n'est plus
--      atteignable que par la fonction publique, qui passe la garde d'abord.
--      Renommer plutôt que réécrire : le corps — 60 lignes de CTE — n'est pas
--      retouché ici, et ne peut donc pas être abîmé par ce correctif.
--
-- row_security reste à off : la garde rend la RLS superflue sur ce chemin,
-- et son coût sur huit tables était la raison d'être du réglage.
--
-- ORDRE DE PROMOTION — cette migration est compatible avec le code servi
-- aujourd'hui : `nexus-stock-moteur.js` appelle déjà la RPC avec le site du
-- compte connecté. Aucun écran n'appelle la RPC sans authentification.

-- 1. La garde, seule règle d'accès désormais.
create or replace function public.nexus_site_autorise(p_site text)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_site_du_compte text;
begin
  if auth.uid() is null then
    raise exception 'Lecture du stock refusée : aucun compte authentifié.'
      using errcode = '42501';
  end if;

  if p_site is null or btrim(p_site) = '' then
    raise exception 'Lecture du stock refusée : site non précisé.'
      using errcode = '42501';
  end if;

  v_site_du_compte := public.current_employee_site_id();

  if v_site_du_compte is not null and v_site_du_compte = p_site then
    return p_site;
  end if;

  if public.je_suis_createur()
     and exists (select 1 from public.sites s
                 where s.site_id = p_site and s.acces_createur_autorise = true) then
    return p_site;
  end if;

  raise exception 'Lecture du stock refusée : le site demandé n''est pas celui de votre compte.'
    using errcode = '42501';
end;
$$;

comment on function public.nexus_site_autorise(text) is
  'Garde d''isolation : renvoie p_site si le compte appelant a le droit de le lire, lève 42501 sinon.';

-- 2. Le corps de calcul passe hors d'atteinte directe.
alter function public.nexus_stock_lire_etat(text)
  rename to nexus_stock_lire_etat_donnees;

revoke all on function public.nexus_stock_lire_etat_donnees(text) from public;
revoke all on function public.nexus_stock_lire_etat_donnees(text) from anon;
revoke all on function public.nexus_stock_lire_etat_donnees(text) from authenticated;

-- 3. La fonction publique : garde, puis calcul.
create or replace function public.nexus_stock_lire_etat(p_site text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '8s'
as $$
begin
  perform public.nexus_site_autorise(p_site);
  return public.nexus_stock_lire_etat_donnees(p_site);
end;
$$;

-- 4. Même garde sur la variante JSON, dont le corps tient en une requête.
create or replace function public.nexus_stock_lire_etat_json(p_site text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
begin
  perform public.nexus_site_autorise(p_site);
  return (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.designation), '[]'::jsonb)
    from public.nexus_stock_etat_v3 x
    where x.site = p_site
  );
end;
$$;

-- 5. Plus aucun appel anonyme, sur aucune des deux entrées.
revoke all on function public.nexus_stock_lire_etat(text) from public;
revoke all on function public.nexus_stock_lire_etat(text) from anon;
revoke all on function public.nexus_stock_lire_etat_json(text) from public;
revoke all on function public.nexus_stock_lire_etat_json(text) from anon;
revoke all on function public.nexus_site_autorise(text) from public;
revoke all on function public.nexus_site_autorise(text) from anon;

grant execute on function public.nexus_stock_lire_etat(text) to authenticated;
grant execute on function public.nexus_stock_lire_etat_json(text) to authenticated;
grant execute on function public.nexus_site_autorise(text) to authenticated;
