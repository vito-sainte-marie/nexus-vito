-- ============================================================================
-- FDJ — Vague 1, Phase A (« ÉTENDRE ») — Projection « Ma Progression »
--
-- Relecture finale de la PR #62, point 2 (confidentialité de Ma Progression).
--
-- CE QU'ELLE CORRIGE. `NEXUS-Progression-v1.html` chargeait ses quarts FDJ par
-- `from('fdj_shifts').select('*, fdj_cash_controls(*)')`. L'étoile imbriquée
-- envoyait à l'employé, dans la réponse réseau, TOUTES les colonnes du contrôle
-- de caisse — dont `motif_ecart_texte` (le commentaire interne que le manager
-- écrit au moment de valider, migration 20260916220700 §3.6),
-- `resultat_controle` (le verdict managérial) et `valide_par` / `controle_par`
-- (l'identité du contrôleur). L'écran n'en affichait rien ; la réponse les
-- portait quand même, et c'est la réponse qui compte.
--
-- La RLS ne pouvait pas le refermer : elle filtre des LIGNES, jamais des
-- colonnes — et ces lignes-là sont légitimement celles de l'employé. Un
-- `grant select (colonnes)` ne le pouvait pas davantage : le privilège porte
-- sur le rôle `authenticated`, commun aux employés ET aux managers, et il
-- casserait l'écran Écarts, qui lit précisément `motif_ecart_texte`. La seule
-- fermeture possible est une projection serveur — c'est ce fichier. Il lève du
-- même coup la « DETTE VAGUE 2 » nommée au §2 de la Phase C, et sa condition
-- C5 : la clause `fdj_est_mon_quart` de `select_fdj_cash_controls` n'a plus
-- lieu d'être.
--
-- ---------------------------------------------------------------------------
-- AUCUN PARAMÈTRE D'IDENTITÉ (mandat Vague 1, §4)
-- Comme `mes_ecarts_caisse()` (20260914210000) et `fdj_mes_quarts_fdj()`
-- (20260916220800), cette fonction ne prend ni employee_id ni site : elle ne
-- filtre que sur `auth.uid()`. Modifier l'appel dans la console du navigateur
-- ne donne accès à rien de plus.
--
-- ---------------------------------------------------------------------------
-- CE QU'ELLE RENVOIE, ET POURQUOI EXACTEMENT CELA
-- Exactement les douze champs que `NexusProgression.construireServicesCaisseFdj`
-- consomme, pas un de plus — pas même `site`, que l'écran connaît déjà. La
-- liste n'est pas un choix de confort : tout champ ajouté ici redevient visible
-- dans la réponse réseau de l'employé, et
-- `test_progression_projection_fdj_20260917.js` échoue si elle s'élargit.
--
-- CE QU'ELLE NE RENVOIE JAMAIS
--   - motif_ecart_texte  (commentaire interne du manager)
--   - resultat_controle  (verdict managérial)
--   - valide_par, controle_par, controle_le  (identité et geste du contrôleur)
--   - saisi_par, confirme_par  (identités techniques)
--   - toute ligne d'un autre employé
-- `motif_ecart` RESTE renvoyé : c'est un code énuméré
-- (`erreur_comptage` | `erreur_monnaie` | `autre`) que l'employé choisit
-- lui-même en corrigeant sa caisse (20260901225945), et que Ma Progression
-- affiche déjà sous « Motif ». Ce n'est pas un commentaire libre.
--
-- ---------------------------------------------------------------------------
-- POURQUOI `s.statut = 'valide'` EST CÔTÉ SERVEUR
-- Cahier « FDJ — Audit de consolidation » du 20/08/2026, FDJ-26 : « Coach et
-- Ma progression n'utilisent jamais un brouillon ou un écart provisoire. »
-- Le filtre existait déjà côté navigateur (`s.statut !== 'valide'` → ignoré) ;
-- le porter ici fait qu'un brouillon n'est plus seulement ignoré à l'affichage,
-- il n'est plus transmis. C'est aussi ce qui rend l'état A du §4 sans objet
-- pour cet écran : il ne montre que des quarts clôturés.
--
-- Ce filtre porte sur le QUART, pas sur `confirme_le`. `confirme_le` est une
-- colonne ajoutée par la Vague 1 (20260916220100) : elle est NULL sur les 82
-- contrôles antérieurs, où elle se lit « confirmation historique non tracée »
-- et non « jamais confirmée ». La reprendre comme critère viderait Ma
-- Progression de tout son historique.
--
-- CETTE MIGRATION NE LIT, N'ÉCRIT ET NE CORRIGE AUCUNE DONNÉE EXISTANTE.
-- ============================================================================

create or replace function public.fdj_ma_progression_caisse(p_limite int default 2000)
returns table (
  shift_id              uuid,
  date                  date,
  quart                 text,
  statut_quart          text,
  statut_caisse         text,
  caisse_attendue       numeric,
  caisse_reelle         numeric,
  caisse_reelle_origine numeric,
  ecart                 numeric,
  ecart_origine         numeric,
  motif_ecart           text,
  valide_le             timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with moi as (select (select auth.uid()) as uid)
  select
    s.id,
    s.date,
    s.quart,
    s.statut,
    c.statut,
    c.caisse_attendue,
    c.caisse_reelle,
    c.caisse_reelle_origine,
    c.ecart,
    c.ecart_origine,
    c.motif_ecart,
    c.valide_le
  from public.fdj_shifts s
  join public.fdj_cash_controls c on c.shift_id = s.id
  cross join moi
  where moi.uid is not null
    and s.employee_id = moi.uid
    and s.statut = 'valide'
  order by s.date desc, s.quart desc
  limit greatest(coalesce(p_limite, 2000), 1);
$$;

comment on function public.fdj_ma_progression_caisse(int) is
  'Relecture PR #62, point 2 — quarts FDJ clôturés de l''appelant, pour « Ma '
  'Progression ». Filtre sur auth.uid() uniquement, aucun paramètre d''identité. '
  'Ne renvoie jamais motif_ecart_texte, resultat_controle, valide_par ni '
  'controle_par : ce qui ne doit pas être lu n''est pas envoyé.';

-- ----------------------------------------------------------------------------
-- PRIVILÈGES
-- `revoke ... from public` NE SUFFIT PAS SUR SUPABASE (mesure du 16/09/2026) :
-- il ne retire que l'entrée PUBLIC, jamais le grant nommé dont `anon` dispose.
-- `anon` est donc révoqué explicitement. La fonction serait de toute façon
-- vide pour lui — `where moi.uid is not null` — mais une fonction
-- `security definer` exécutable sans session n'a aucune raison d'exister.
-- ----------------------------------------------------------------------------

revoke all on function public.fdj_ma_progression_caisse(int) from public;
revoke all on function public.fdj_ma_progression_caisse(int) from anon;
grant execute on function public.fdj_ma_progression_caisse(int) to authenticated;
grant execute on function public.fdj_ma_progression_caisse(int) to service_role;

-- ============================================================================
-- RETOUR ARRIÈRE (Phase A)
--
--   drop function if exists public.fdj_ma_progression_caisse(int);
--
-- Condition d'arrêt : sûr tant que le NEXUS-Progression-v1.html réellement
-- SERVI ne l'appelle pas encore. Après la bascule, la supprimer vide l'onglet
-- FDJ de Ma Progression — il faut d'abord rebasculer le front sur la lecture
-- directe, ET rétablir la clause `fdj_est_mon_quart` dans la politique de
-- lecture de fdj_cash_controls si la Phase C a été appliquée.
-- ============================================================================
