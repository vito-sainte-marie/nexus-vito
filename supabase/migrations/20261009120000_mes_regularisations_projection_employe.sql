-- Un employe voit les memes montants que son manager pour ses propres ecarts.
-- ============================================================================
-- CE QUI EST VRAI AVANT CETTE MIGRATION. Le manager calcule la synthese des
-- regularisations (ecarts constates, regularisations encaissees, solde restant)
-- dans `nexus-paye-regularisations.js`, a partir des lignes brutes
-- d'`audits_caisse` et de `fdj_shifts`/`fdj_cash_controls`, normalisees par
-- `nexus-ecarts-donnees.js`, et des deux tables de regularisation. L'employe
-- n'a acces a aucune de ces tables (RLS `lecture_manager_meme_site`) et
-- `mes_ecarts_caisse()` ne rend ni versement ni restitution : il ne peut donc
-- pas voir son solde, ou devrait le recalculer autrement.
--
-- ARBITRAGE (complement G3 du 09/10/2026, Frederic). « Un employe doit voir
-- les memes montants que son manager pour ses propres ecarts. Il ne doit
-- exister ni formule differente, ni calcul parallele, ni decalage inexplique
-- entre les deux interfaces. » Memes droits qu'avant : l'employe ne voit que
-- ses propres ecarts, et aucun montant avant controle (arbitrage du 16/09).
--
-- CE QUE FAIT LA FONCTION. Elle ne calcule rien. Elle rend, pour l'appelant
-- seul, les lignes SOURCES dans la forme exacte que lit deja l'ecran manager,
-- pour que l'ecran employe appelle les MEMES fonctions de normalisation et de
-- synthese. Aucune somme, aucun solde n'est calcule ici : un calcul SQL serait
-- precisement le calcul parallele que l'arbitrage interdit.
--
--   audits        un objet par (audit, poste) dont l'appelant est le SEUL
--                 detenteur et dont le poste est controle (`valide_le_<poste>`
--                 non nul) ; colonnes `ecart_<poste>`, `_valide`, `_origine`,
--                 `valide_le_<poste>`, `cause_code_<poste>`, et
--                 `employes_<poste>` = [appelant].
--   fdj           les quarts FDJ dont l'appelant est l'employe et dont la
--                 caisse porte un verdict (`resultat_controle` non vide) ;
--                 `resultat_controle` est rendu comme le marqueur 'controle',
--                 jamais son texte.
--   versements    les versements et restitutions rattaches a ces ecarts-la,
--   restitutions  et a aucun autre.
--
-- POURQUOI CES DEUX FILTRES. Ce sont exactement ceux de l'ecran manager filtre
-- sur l'employe :
--   * `resoudreEmployeCaisseVerify` n'attribue un poste qu'a un detenteur
--     unique (`filter(Boolean)`, longueur 1) ; un poste partage est
--     « collectif non impute » et n'apparait sous aucun employe. Le compte
--     SQL ecarte donc les elements nuls et vides, et rien d'autre.
--   * la synthese ne somme que les ecarts clotures (`valide_le_<poste>` pour
--     Verify, `resultat_controle` pour FDJ) ; les autres vont dans « en
--     attente ». L'employe ne recoit pas les ecarts non clotures : c'est la
--     seule difference avec le manager, et elle est voulue (16/09).
--
-- CE QUI N'EST JAMAIS RENDU. Aucun UUID de collegue, aucun validateur, aucun
-- auteur de saisie, aucun commentaire, aucun justificatif. `auteur_id`,
-- `valide_par` et `annule_par` valent la sentinelle 'manager' quand ils sont
-- renseignes ; `employee_id` d'une operation vaut l'appelant s'il a lui-meme
-- verse, la sentinelle 'tiers' sinon. Le rendu affiche alors « saisi par
-- manager » et « verse par un tiers » : les montants sont identiques, seuls
-- les noms different, et c'est une difference de droits, pas de calcul.
-- `motif_annulation` est rendu : c'est l'historique de validation demande.
--
-- Filtre sur auth.uid() uniquement : la fonction ne prend aucun parametre
-- d'identite.
-- ============================================================================

create or replace function public.mes_regularisations()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with moi as (select (select auth.uid()) as uid),
  postes as (
    select a.id as audit_id, a.date, a.quart, t.poste, t.ecart, t.ecart_valide,
           t.ecart_origine, t.valide_le, t.cause_code
      from public.audits_caisse a
      cross join moi
      cross join lateral (values
        ('piste'::text, a.ecart_piste, a.ecart_piste_valide, a.ecart_piste_origine,
         a.valide_le_piste, a.cause_code_piste, a.employes_piste),
        ('boutique'::text, a.ecart_boutique, a.ecart_boutique_valide, a.ecart_boutique_origine,
         a.valide_le_boutique, a.cause_code_boutique, a.employes_boutique)
      ) as t(poste, ecart, ecart_valide, ecart_origine, valide_le, cause_code, employes)
     where moi.uid is not null
       and t.ecart is not null
       and t.valide_le is not null
       and (select count(*)
              from jsonb_array_elements_text(
                     case when jsonb_typeof(t.employes) = 'array' then t.employes else '[]'::jsonb end) e
             where e is not null and e <> '') = 1
       and t.employes ? (moi.uid)::text
  ),
  caisses as (
    select s.date, s.quart, c.id as cash_id, c.ecart, c.ecart_origine, c.motif_ecart, c.valide_le
      from public.fdj_shifts s
      join public.fdj_cash_controls c on c.shift_id = s.id
      cross join moi
     where moi.uid is not null
       and s.employee_id = moi.uid
       and c.ecart is not null
       and coalesce(c.resultat_controle, '') <> ''
  ),
  versements as (
    select v.* from public.ecarts_versements_regularisation v
     where (v.module_origine = 'fdj' and v.fdj_cash_control_id in (select cash_id from caisses))
        or (v.module_origine = 'verify'
            and (v.audit_id, v.caisse_origine) in (select audit_id, poste from postes))
  ),
  restitutions as (
    select r.* from public.ecarts_restitutions_trop_percu r
     where (r.module_origine = 'fdj' and r.fdj_cash_control_id in (select cash_id from caisses))
        or (r.module_origine = 'verify'
            and (r.audit_id, r.caisse_origine) in (select audit_id, poste from postes))
  )
  select jsonb_build_object(
    'audits', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.audit_id, 'date', p.date, 'quart', p.quart,
               'ecart_' || p.poste, p.ecart,
               'ecart_' || p.poste || '_valide', p.ecart_valide,
               'ecart_' || p.poste || '_origine', p.ecart_origine,
               'valide_le_' || p.poste, p.valide_le,
               'cause_code_' || p.poste, p.cause_code,
               'employes_' || p.poste, jsonb_build_array((select (uid)::text from moi)))
             order by p.date, p.quart, p.poste)
        from postes p), '[]'::jsonb),
    'fdj', coalesce((
      select jsonb_agg(jsonb_build_object(
               'date', c.date, 'quart', c.quart, 'employee_id', (select uid from moi),
               'fdj_cash_controls', jsonb_build_object(
                 'id', c.cash_id, 'ecart', c.ecart, 'ecart_origine', c.ecart_origine,
                 'resultat_controle', 'controle', 'motif_ecart', c.motif_ecart,
                 'valide_le', c.valide_le))
             order by c.date, c.quart)
        from caisses c), '[]'::jsonb),
    'versements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'module_origine', v.module_origine, 'audit_id', v.audit_id,
               'caisse_origine', v.caisse_origine, 'fdj_cash_control_id', v.fdj_cash_control_id,
               'montant', v.montant, 'mode_encaissement', v.mode_encaissement,
               'destination', v.destination, 'encaisse_le', v.encaisse_le,
               'employee_id', case when v.employee_id = (select uid from moi)
                                   then (v.employee_id)::text else 'tiers' end,
               'auteur_id', case when v.auteur_id is not null then 'manager' end,
               'annule_le', v.annule_le,
               'annule_par', case when v.annule_par is not null then 'manager' end,
               'motif_annulation', v.motif_annulation)
             order by v.encaisse_le, v.id)
        from versements v), '[]'::jsonb),
    'restitutions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'module_origine', r.module_origine, 'audit_id', r.audit_id,
               'caisse_origine', r.caisse_origine, 'fdj_cash_control_id', r.fdj_cash_control_id,
               'montant', r.montant, 'mode_restitution', r.mode_restitution,
               'source', r.source, 'restitue_le', r.restitue_le,
               'employee_id', case when r.employee_id = (select uid from moi)
                                   then (r.employee_id)::text else 'tiers' end,
               'valide_par', case when r.valide_par is not null then 'manager' end,
               'annule_le', r.annule_le,
               'annule_par', case when r.annule_par is not null then 'manager' end,
               'motif_annulation', r.motif_annulation)
             order by r.restitue_le, r.id)
        from restitutions r), '[]'::jsonb)
  );
$$;

comment on function public.mes_regularisations() is
  'Lignes sources des regularisations de l''appelant, dans la forme que lit '
  'l''ecran manager : audits dont il est seul detenteur et controles, quarts '
  'FDJ a verdict, versements et restitutions rattaches. Aucun calcul : l''ecran '
  'employe appelle les memes fonctions de synthese que le manager. Aucun UUID '
  'de collegue ni de manager (sentinelles ''manager'' et ''tiers''), aucun '
  'justificatif. Filtre sur auth.uid() uniquement. Complement G3 du 09/10/2026.';

-- ---------------------------------------------------------------------------
-- Privileges — ecrits, jamais herites (lecon du 16/09/2026, cf.
-- 20260916210000) : `create or replace` d'une fonction neuve recoit
-- `anon = X` par les default privileges de Supabase, et `revoke from public`
-- ne retire pas ce grant nomme.
-- Soit exactement : {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- ---------------------------------------------------------------------------
revoke all on function public.mes_regularisations() from public;
revoke all on function public.mes_regularisations() from anon;
grant execute on function public.mes_regularisations() to authenticated;
grant execute on function public.mes_regularisations() to service_role;

-- ============================================================================
-- RETOUR ARRIERE
--
--   drop function if exists public.mes_regularisations();
--
-- Sur tant que la page « Ma Progression » servie ne l'appelle pas. Apres, la
-- supprimer fait afficher a l'employe « synthese indisponible », sans rien
-- ecrire ni rien fausser : aucune table n'est modifiee par cette migration.
-- ============================================================================
