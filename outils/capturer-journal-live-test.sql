-- NEXUS — capture du journal Live, SÉPARÉE de la ligne de recette.
--
-- Séparée le 09/09/2026 pour une raison apprise à la dure : une
-- reconstruction interrompue laisse `public.nexus_live_events` ABSENTE (sa
-- migration arrive tard dans la séquence). PostgreSQL refuse alors la requête
-- entière à l'analyse, même protégée par un CASE — une table inexistante n'est
-- pas une valeur nulle, c'est une erreur de compilation. La capture de la ligne
-- de recette échouait donc AUSSI, et le script devenait impossible à relancer
-- exactement quand on en avait le plus besoin.
--
-- L'appelant vérifie l'existence de la table avant de lancer ce fichier.

-- 4) public.nexus_live_events — LE JOURNAL LIVE, dans son intégralité.
--
-- POURQUOI IL DOIT SURVIVRE. La table est recréée par la migration
-- 20260907222249_creer_nexus_live_events_test.sql : après reconstruction, le
-- schéma revient, VIDE. Les lignes, elles, ne reviennent pas — et deux d'entre
-- elles sont irremplaçables : les autorisations accordées par Frédéric en
-- personne (`actor_role = 'human'`), le 08/09/2026 à 18:33 sur les branches en
-- rade, et le 09/09/2026 à 10:12 sur request-4 du lot de readiness. Ce sont les
-- seules traces qu'un humain a décidé quelque chose, à cette heure-là, en
-- réponse à cette question-là.
--
-- La CI republiera ses propres événements au run suivant, mais elle ne
-- republiera jamais ceux-là. Les perdre ne serait pas une remise à zéro : ce
-- serait effacer une décision humaine — exactement ce que le registre Handoff
-- interdit en étant append-only, et ce que la Bible refuse en interdisant de
-- fabriquer un passé plausible.
--
-- `id` est IDENTITY ALWAYS et n'est pas rejoué : c'est un numéro de séquence,
-- pas un fait. `event_id` porte l'identité réelle, et son unicité rend le rejeu
-- idempotent. `created_at` est repris tel quel — l'heure d'écriture est un fait
-- au même titre que `occurred_at`, et la laisser se recalculer à la
-- restauration daterait l'histoire du jour où on l'a restaurée.
select coalesce(string_agg(
  format(
    'insert into public.nexus_live_events (%s) values (%s) on conflict (event_id) do nothing;',
    cols, vals
  ),
  E'\n' order by v.occurred_at, v.event_id
), '-- aucun événement Live à préserver')
from public.nexus_live_events v
cross join lateral (
  select
    string_agg(quote_ident(kv.cle), ', ' order by kv.cle) as cols,
    string_agg(quote_nullable(kv.valeur), ', ' order by kv.cle) as vals
  from jsonb_each_text(to_jsonb(v)) as kv(cle, valeur)
  where kv.cle <> 'id'
) x;

