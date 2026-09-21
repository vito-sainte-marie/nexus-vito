-- Avant validation, un montant n'est pas une information : c'est une accusation.
-- ============================================================================
-- CE QUI EST VRAI AVANT CETTE MIGRATION. `20260914210000` a donne a l'employe
-- une projection qui ne rend plus ni l'UUID du collegue, ni l'ecart du
-- collegue, ni l'`ecart_total` du quart, ni le validateur, ni le commentaire
-- manager. Elle rend en revanche, DES LA CREATION DE LA LIGNE et avant tout
-- controle, l'`ecart` brut du poste, son `ecart_origine` et son `cause_code`.
--
-- Un ecart brut n'est pas un resultat. C'est une difference entre un theorique
-- et un compte, avant qu'un manager ait regarde si la difference vient de la
-- caisse, d'une remise mal saisie, d'un bon non enregistre ou d'une erreur de
-- releve. Le montant provisoire d'un poste peut changer du tout au tout a la
-- validation — c'est precisement ce que `ecart_origine` et `ecart_valide`
-- servent a tracer. Le publier a l'employe avant ce controle, c'est lui
-- annoncer un manquant qui n'existe peut-etre pas.
--
-- ARBITRAGE. Tant qu'un poste n'est pas valide, la seule information due a
-- l'employe est qu'un controle est en cours. Ni montant, ni cause, ni origine.
--
-- CETTE MIGRATION NE REECRIT PAS `20260914210000`. Ce fichier-la est deja
-- enregistre sur le projet de Test ; le reecrire sur place laisserait Test et
-- Production porter le meme numero pour deux textes differents, et personne ne
-- le verrait jamais. La correction est donc additive et porte son propre
-- numero.
--
-- CE QUI CHANGE, EXACTEMENT. La signature ne bouge pas — memes colonnes,
-- memes types, meme absence de parametre d'identite. Quatre colonnes
-- deviennent nulles tant que `valide_le` est nul :
--
--     ecart           le montant brut du poste
--     ecart_valide    le montant retenu apres controle
--     ecart_origine   le montant d'avant correction
--     cause_code      la cause retenue
--
-- `ecart_valide` est masque avec les autres bien qu'il soit deja nul dans ce
-- cas : une garde qui repose sur le fait qu'une autre colonne est nulle n'est
-- pas une garde, c'est une coincidence. Si une ecriture future remplissait
-- `ecart_*_valide` avant `valide_le_*`, la fuite reviendrait en silence.
--
-- CE QUI NE CHANGE PAS. `audit_id`, `site`, `date`, `quart`, `poste`,
-- `valide_le`, `poste_partage` et `nb_detenteurs` restent rendus dans tous les
-- cas : l'employe doit savoir QUELS postes il a tenus et lesquels attendent
-- encore un controle — c'est ce qui rend la phrase « Controle de votre caisse
-- en cours. » rattachable a un poste precis. Aucune de ces colonnes ne nomme
-- un collegue ni ne chiffre quoi que ce soit.
--
-- LE MASQUAGE EST DANS LA SOURCE, PAS DANS L'ECRAN. Un `if` dans
-- `nexus-progression.js` cacherait le montant a l'affichage et le laisserait
-- dans la reponse reseau, lisible dans l'onglet Reseau du navigateur par
-- l'employe lui-meme. Ce qui ne doit pas etre lu ne doit pas etre envoye.
-- ============================================================================

create or replace function public.mes_ecarts_caisse()
returns table (
  audit_id       uuid,
  site           text,
  date           date,
  quart          text,
  poste          text,
  ecart          numeric,
  ecart_valide   numeric,
  ecart_origine  numeric,
  cause_code     text,
  valide_le      timestamptz,
  poste_partage  boolean,
  nb_detenteurs  integer
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Les colonnes du CTE portent un prefixe : sans lui, `ecart` designerait a
  -- la fois la colonne du CTE et le parametre OUT de meme nom, et le masquage
  -- se lirait comme une tautologie.
  with moi as (select (select auth.uid())::text as uid),
  postes as (
    select a.id                                                          as p_audit_id,
           a.site                                                        as p_site,
           a.date                                                        as p_date,
           a.quart                                                       as p_quart,
           'piste'::text                                                 as p_poste,
           a.ecart_piste                                                 as p_ecart,
           a.ecart_piste_valide                                          as p_ecart_valide,
           a.ecart_piste_origine                                         as p_ecart_origine,
           a.cause_code_piste                                            as p_cause_code,
           coalesce(a.valide_le_piste, a.valide_le)                      as p_valide_le,
           jsonb_array_length(coalesce(a.employes_piste, '[]'::jsonb)) > 1 as p_partage,
           jsonb_array_length(coalesce(a.employes_piste, '[]'::jsonb))   as p_detenteurs
      from public.audits_caisse a, moi
     where moi.uid is not null
       and coalesce(a.employes_piste, '[]'::jsonb) ? moi.uid
    union all
    select a.id,
           a.site,
           a.date,
           a.quart,
           'boutique'::text,
           a.ecart_boutique,
           a.ecart_boutique_valide,
           a.ecart_boutique_origine,
           a.cause_code_boutique,
           coalesce(a.valide_le_boutique, a.valide_le),
           jsonb_array_length(coalesce(a.employes_boutique, '[]'::jsonb)) > 1,
           jsonb_array_length(coalesce(a.employes_boutique, '[]'::jsonb))
      from public.audits_caisse a, moi
     where moi.uid is not null
       and coalesce(a.employes_boutique, '[]'::jsonb) ? moi.uid
  )
  select p_audit_id,
         p_site,
         p_date,
         p_quart,
         p_poste,
         case when p_valide_le is not null then p_ecart          end,
         case when p_valide_le is not null then p_ecart_valide   end,
         case when p_valide_le is not null then p_ecart_origine  end,
         case when p_valide_le is not null then p_cause_code     end,
         p_valide_le,
         p_partage,
         p_detenteurs
    from postes;
$$;

comment on function public.mes_ecarts_caisse() is
  'Ecarts de caisse de l''appelant, une ligne par poste tenu. Aucun UUID de '
  'collegue, aucun validateur, aucun commentaire manager, pas d''ecart de '
  'quart ni du poste non tenu. Tant que valide_le est nul, le montant, son '
  'origine et sa cause sont nuls : avant controle, la seule information due a '
  'l''employe est qu''un controle est en cours. Filtre sur auth.uid() '
  'uniquement : la fonction ne prend aucun parametre d''identite. '
  'Arbitrages du 14/09/2026 et du 16/09/2026.';

-- ---------------------------------------------------------------------------
-- Privileges — repetes, et non supposes acquis.
-- ---------------------------------------------------------------------------
-- `create or replace` conserve l'ACL d'une fonction qui existe deja, donc ces
-- trois lignes ne changent rien sur Test. Elles comptent pour l'environnement
-- ou la fonction n'existe PAS encore : la, `create or replace` la cree, et
-- l'`alter default privileges` installe par Supabase sur le schema `public`
-- lui donne aussitot `anon = X`. Une migration qui ne les repete pas ouvrirait
-- `anon` en croyant ne rien faire.
--
-- `revoke ... from public` seul ne suffit pas : il ne retire que l'entree du
-- pseudo-role PUBLIC, jamais un grant nomme. La lecon est du 16/09/2026, apres
-- trois occurrences du meme motif.
--
-- 16/09/2026 — l'ACL finale est ECRITE, pas heritee. Sans la ligne
-- `service_role` ci-dessous, la fonction gardait ce droit sur Test et en
-- Production parce qu'elle y preexistait (`create or replace` conserve l'ACL),
-- et ne l'aurait PAS eu sur une base neuve. L'ACL dependait donc de l'histoire
-- de la base, pas de la migration. Les quatre lignes qui suivent la rendent
-- identique partout.
--
-- Propriete attendue apres cette migration, dans TOUS les environnements :
--   postgres      = EXECUTE  (proprietaire)
--   authenticated = EXECUTE  (l'employe qui consulte ses propres ecarts)
--   service_role  = EXECUTE  (role technique serveur : il contourne deja la
--                             RLS et sa cle ne quitte jamais le serveur ;
--                             le retirer casserait des chemins serveur sans
--                             rien refermer cote navigateur)
--   anon          = AUCUN
--   PUBLIC        = AUCUN
--
-- Soit exactement : {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke all on function public.mes_ecarts_caisse() from public;
revoke all on function public.mes_ecarts_caisse() from anon;
grant execute on function public.mes_ecarts_caisse() to authenticated;
grant execute on function public.mes_ecarts_caisse() to service_role;
