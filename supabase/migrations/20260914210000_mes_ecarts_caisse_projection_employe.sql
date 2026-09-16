-- Un employe lit son poste, pas le quart de son collegue.
-- ============================================================================
-- CE QUI EST VRAI AVANT CETTE MIGRATION. Le hotfix du 14/09/2026
-- (20260914200000) a ferme la fuite de LIGNES : un employe ne lit plus que les
-- lignes d'`audits_caisse` ou son identifiant figure. Il ne ferme pas la fuite
-- de COLONNES, et aucune policy RLS ne le peut : la RLS filtre des lignes,
-- jamais des champs. Sur chacune des lignes qu'il lit, l'employe recoit encore
-- l'UUID de la personne de l'autre poste, l'ecart de l'autre poste,
-- l'ecart_total du quart, l'identite du validateur et le commentaire manager.
--
-- `GRANT`/`REVOKE` par colonne ne peut pas separer managers et employes : les
-- deux s'authentifient sous le meme role Postgres `authenticated`. Un `revoke`
-- frapperait Cockpit, Verify, Ecarts, Paye et Journal avec.
--
-- ARBITRAGE METIER DU 14/09/2026 (Frederic Bragance). Une ligne d'audit couvre
-- le quart, mais la responsabilite et l'affichage employe se calculent PAR
-- POSTE. L'appariement normal piste + boutique ne constitue PAS un poste
-- partage : ce sont deux responsabilites individuelles. Un poste devient
-- partage uniquement lorsque plusieurs employes tiennent ce meme poste,
-- successivement ou simultanement ; sans comptage de passation son ecart reste
-- hors cumul personnel et a arbitrer. Un employe sans audit associe recoit un
-- etat vide explicite, jamais un resultat nul simule.
--
-- CE QUE FAIT CETTE MIGRATION, EN DEUX GESTES INDISSOCIABLES.
--
--   1. `public.mes_ecarts_caisse()` — une projection `security definer` qui
--      rend UNE LIGNE PAR POSTE TENU PAR L'APPELANT. Elle ne rend aucun UUID,
--      aucun `valide_par*`, aucun `commentaire*`, pas d'`ecart_total`, et
--      rien du poste que l'appelant n'a pas tenu. Le seul filtre est
--      `auth.uid()` : la fonction ne prend aucun parametre d'identite, donc
--      aucun appelant ne peut demander les postes d'un autre.
--
--   2. `select_audits_caisse` revient aux managers, gerants et createur. Les
--      employes n'ont plus d'acces direct aux lignes brutes.
--
-- LES DEUX GESTES DOIVENT ATTERRIR ENSEMBLE : fermer l'acces direct sans la
-- projection aveuglerait Progression, Apprentissage et Mon Evolution ; poser
-- la projection sans fermer l'acces direct ne retirerait rien du reseau.
--
-- POURQUOI UNE FONCTION ET PAS UNE VUE. Une vue `security_invoker = false`
-- ferait le meme travail, mais le linter Supabase la signale en
-- `security_definer_view` — un avertissement legitime, puisqu'une vue de ce
-- type expose tout ce qu'on y met sans qu'aucun `grant` ne rattrape l'oubli.
-- Une fonction porte sa garde dans son corps, se teste seule, et son
-- `search_path` vide interdit la capture par un schema tiers.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS.
--   * Les managers et gerants gardent `audits_caisse` en entier, y compris la
--     vue manager d'un employe (`?employe=<id>` dans Progression et
--     Apprentissage) : Cockpit, Verify, Carburants, Paye, Ecarts, Tempo,
--     Journal, Campagne et Centre Intelligence sont inchanges.
--   * Les policies d'ecriture (`ecriture_manager_meme_site`,
--     `modification_manager_meme_site`) ne sont pas touchees : elles etaient
--     deja reservees aux managers. Verify ecrit et relit comme avant.
--   * Le comptage de passation reste hors perimetre. `poste_partage` signale
--     le cas et `nb_detenteurs` le mesure ; l'ecart d'un poste partage sort du
--     cumul personnel cote ecran et attend un arbitrage manager.
--
-- MESURE DU 14/09/2026 EN PRODUCTION, avant application : 116 lignes, toutes a
-- exactement un employe piste et un employe boutique ; zero poste partage ;
-- zero ligne ou la meme personne tient les deux postes ; aucun `employes_*`
-- nul ou non-tableau.
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
  with moi as (select (select auth.uid())::text as uid)
  select a.id, a.site, a.date, a.quart,
         'piste'::text,
         a.ecart_piste, a.ecart_piste_valide, a.ecart_piste_origine,
         a.cause_code_piste,
         coalesce(a.valide_le_piste, a.valide_le),
         jsonb_array_length(coalesce(a.employes_piste, '[]'::jsonb)) > 1,
         jsonb_array_length(coalesce(a.employes_piste, '[]'::jsonb))
    from public.audits_caisse a, moi
   where moi.uid is not null
     and coalesce(a.employes_piste, '[]'::jsonb) ? moi.uid
  union all
  select a.id, a.site, a.date, a.quart,
         'boutique'::text,
         a.ecart_boutique, a.ecart_boutique_valide, a.ecart_boutique_origine,
         a.cause_code_boutique,
         coalesce(a.valide_le_boutique, a.valide_le),
         jsonb_array_length(coalesce(a.employes_boutique, '[]'::jsonb)) > 1,
         jsonb_array_length(coalesce(a.employes_boutique, '[]'::jsonb))
    from public.audits_caisse a, moi
   where moi.uid is not null
     and coalesce(a.employes_boutique, '[]'::jsonb) ? moi.uid;
$$;

comment on function public.mes_ecarts_caisse() is
  'Ecarts de caisse de l''appelant, une ligne par poste tenu. Aucun UUID de '
  'collegue, aucun validateur, aucun commentaire manager, pas d''ecart de '
  'quart ni du poste non tenu. Filtre sur auth.uid() uniquement : la fonction '
  'ne prend aucun parametre d''identite. Arbitrage du 14/09/2026.';

-- ---------------------------------------------------------------------------
-- Privileges. `from public` NE SUFFIT PAS SUR SUPABASE — mesure du 16/09/2026.
-- ---------------------------------------------------------------------------
-- Ce bloc ne portait d'abord qu'un `revoke ... from public`. Appliqué tel quel
-- sur le projet de Test, il a laissé l'ACL suivante :
--   {postgres=X/postgres, anon=X/postgres, authenticated=X/postgres,
--    service_role=X/postgres}
-- `anon` y figure par un GRANT NOMMÉ, posé par l'`alter default privileges`
-- que Supabase installe sur le schéma `public` : toute fonction créée par
-- `postgres` y naît exécutable par `anon`, `authenticated` et `service_role`.
-- Or `revoke ... from public` ne retire que l'entrée PUBLIC — celle du
-- pseudo-rôle, écrite `=X/postgres`, grantee vide. Il ne touche aucun grant
-- nommé. La garde visait donc à côté de sa cible.
--
-- Ce que cela exposait exactement, mesuré sous `set local role anon`, avec et
-- sans `request.jwt.claims` : la fonction était APPELABLE
-- (`has_function_privilege` = true) et rendait ZÉRO ligne. Le corps refuse de
-- lui-même — `where moi.uid is not null` — donc aucune donnée n'est jamais
-- partie. Ce n'est pas une fuite : c'est une surface d'appel inutile, et un
-- commentaire qui promettait une fermeture que le SQL ne faisait pas.
--
-- C'est le même motif que les deux révocations hors bande du 11/09/2026 sur
-- `nexus_stock_lire_etat_donnees` et `run_scheduled_inventory_reviews`. Il est
-- donc nommé ici, dans le fichier, plutôt que réparé une troisième fois à la
-- main sur un environnement.
--
-- La preuve `outils/preuve-projection-mes-ecarts-caisse.js` contrôle ce point
-- par une mutation (contrôle 13) : une garde qu'aucune tentative d'appel ne
-- met à l'épreuve n'est pas une garde.
revoke all on function public.mes_ecarts_caisse() from public;
revoke all on function public.mes_ecarts_caisse() from anon;
grant execute on function public.mes_ecarts_caisse() to authenticated;

-- ---------------------------------------------------------------------------
-- Fermeture de l'acces direct des employes aux lignes brutes.
-- ---------------------------------------------------------------------------
-- Verification prealable (14/09/2026, lecture statique du depot) : hors
-- Progression, Apprentissage et Mon Evolution — les trois ecrans bascules sur
-- la projection — aucun chemin atteignable par un employe ne lit
-- `audits_caisse`. L'accueil ne l'interroge que dans `initPosteManager()` ;
-- Inventaire et Reception carburant n'appellent que des fonctions de
-- `nexus-carburant-donnees.js` qui ne touchent pas la table ; les couches
-- `nexus-carburants-p0-*` ne sont injectees que sur Pilotage, Brief et
-- Reception.

drop policy if exists select_audits_caisse on public.audits_caisse;

create policy select_audits_caisse on public.audits_caisse
  for select to authenticated
  using (
    (
      site = (select public.current_employee_site_id())
      and (select public.current_employee_role()) in ('manager', 'gerant')
    )
    or (
      (select public.je_suis_createur())
      and exists (
        select 1 from public.sites s
         where s.site_id = audits_caisse.site
           and s.acces_createur_autorise = true
      )
    )
  );
