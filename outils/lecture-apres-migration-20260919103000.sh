#!/usr/bin/env bash
# LECTURE APRÈS — migration 20260919103000 (#65, régularisation réception carburant)
#
# À EXÉCUTER PAR FRÉDÉRIC SUR PRODUCTION. Claude ne l'a pas exécutée : la
# lecture de la base Production lui est refusée par le harnais, et ce refus
# porte sur le résultat, pas sur la commande — il ne se contourne ni par un
# autre outil, ni par le serveur MCP Supabase.
#
# CE QUE CE SCRIPT FAIT : il lit le CATALOGUE, et rien d'autre. Aucune
# écriture, aucune lecture de donnée métier, aucun `count(*)` sur une table.
# Il répond à une seule question : les 13 objets annoncés au §1 du préflight
# existent-ils en Production, et avec la définition mesurée au §12 ?
#
# POURQUOI IL NE REJOUE PAS LE §12 TEL QUEL. Le bloc du §12 hérite du §10,
# écrit pour l'identité qui applique la migration. Sous le rôle de lecture
# seule il est doublement faux :
#   · sa rubrique « volume » fait `count(*)` sur deux tables que
#     `nexus_prod_readonly` n'a pas le droit de lire : la requête entière
#     meurt en `permission denied`, et rien n'est mesuré ;
#   · sa rubrique « colonne » interroge `information_schema.columns`, qui ne
#     montre que les objets sur lesquels le rôle courant détient un
#     privilège. Sous ce rôle elle rend ZÉRO LIGNE que la migration soit
#     appliquée ou non. C'est le faux négatif du 29/09, à l'envers.
# Les deux rubriques sont donc refaites sur `pg_catalog`, qui n'est pas
# filtré par les privilèges, et le volume se lit par `n_live_tup`.
#
# TÉMOIN DE CAPACITÉ. Une rubrique vide ne prouve rien tant que la requête
# n'a pas démontré qu'elle sait rendre du non-vide. Le script compte d'abord
# les colonnes TOTALES des deux tables : si ce compte est nul, la lecture est
# aveugle (mauvaise base, table absente) et le script s'arrête sans verdict.
#
# LE SECRET NE SORT PAS. Le trousseau fournit soit l'URL complète, soit le
# seul mot de passe (forme réellement constatée le 01/10/2026) ; dans ce cas
# il passe par PGPASSWORD et l'URL est composée ici. Rien n'est affiché, et
# toute sortie est filtrée.
#
# L'IDENTITÉ EST VÉRIFIÉE APRÈS CONNEXION, pas seulement choisie avant : le
# script refuse de lire si le serveur l'accepte sous une autre identité.
#
# Usage :   bash outils/lecture-apres-migration-20260919103000.sh
set -euo pipefail

PSQL="$(command -v psql || true)"
[ -n "$PSQL" ] || PSQL=/opt/homebrew/opt/libpq/bin/psql
if [ ! -x "$PSQL" ]; then
  echo "psql introuvable. Sur macOS : brew install libpq" >&2
  exit 4
fi

# RÉPÉTITION SUR TEST. Un verdict vert pour la mauvaise raison ne se voit pas.
# « --repetition-test » fait jouer EXACTEMENT la même lecture sur nexus-test,
# où la migration est appliquée depuis le 30/09 : elle doit y rendre 13/13.
# Sans cette répétition, un script incapable de lire quoi que ce soit rendrait
# « 0/13 », et on le prendrait pour « migration non appliquée ».
REF_ATTENDUE="uzhjpqpctpvxytxpxoqz"   # Production
CIBLE="Production"
if [ "${1:-}" = "--repetition-test" ]; then
  REF_ATTENDUE="udljdqxerrbbbajxubfn"   # nexus-test
  CIBLE="TEST (repetition - aucun verdict Production ne sort d ici)"
fi

# L'IDENTITÉ DE CONNEXION EST DÉCLARÉE, JAMAIS DEVINÉE — et surtout jamais
# repliée sur `postgres`. Le document de rôle (garantie 7, 11/09/2026) nomme
# l'identité qui s'est réellement connectée : `nexus_prod_readonly_login`,
# hôte direct. Toute autre valeur est refusée AVANT la connexion.
UTILISATEUR_PROD="${NEXUS_PROD_DB_USER:-nexus_prod_readonly_login}"
case "$UTILISATEUR_PROD" in
  nexus_prod_readonly_login|nexus_prod_readonly) : ;;
  *) echo "Identité « $UTILISATEUR_PROD » refusée. Ce script ne se connecte qu'avec" >&2
     echo "un rôle de lecture seule documenté : nexus_prod_readonly_login." >&2
     exit 5 ;;
esac
IDENTITE_ATTENDUE="$UTILISATEUR_PROD"

URL="${NEXUS_PROD_DB_URL_READONLY:-}"
if [ "${1:-}" = "--repetition-test" ]; then
  IDENTITE_ATTENDUE="postgres"
  URL="${NEXUS_TEST_DB_URL:-}"
  if [ -z "$URL" ]; then
    MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"
    if [ -n "$MDP" ]; then export PGPASSWORD="$MDP"; fi
    unset MDP
    URL="postgresql://postgres@db.${REF_ATTENDUE}.supabase.co:5432/postgres?sslmode=require"
  fi
fi

# CE QUE CONTIENT L'ENTRÉE DE TROUSSEAU N'EST PAS CE QUI ÉTAIT ÉCRIT.
# Le document de rôle annonçait « contenant l'URL complète ». Mesuré le
# 01/10/2026 : l'entrée contient un MOT DE PASSE — 43 caractères, aucun « @ »,
# aucun « :// ». Le script lisait le contrat au lieu de la réalité, et son
# refus de projet se déclenchait sur une valeur qui ne pouvait désigner aucun
# projet. Les DEUX formes sont désormais acceptées, et c'est la forme qui
# décide, jamais une convention supposée.
if [ -z "$URL" ]; then
  SECRET="$(security find-generic-password -a nexus -s nexus-prod-db-readonly -w 2>/dev/null || true)"
  if [ -n "$SECRET" ]; then
    case "$SECRET" in
      postgres://*|postgresql://*)
        URL="$SECRET" ;;
      *)
        export PGPASSWORD="$SECRET"
        URL="postgresql://${UTILISATEUR_PROD}@db.${REF_ATTENDUE}.supabase.co:5432/postgres?sslmode=require" ;;
    esac
  fi
  SECRET=""
  unset SECRET
fi
if [ -z "$URL" ]; then
  echo "Aucun moyen de lire Production en lecture seule." >&2
  echo "Attendu : l'entrée de trousseau « nexus-prod-db-readonly » (compte « nexus »)," >&2
  echo "contenant SOIT l'URL complète du rôle nexus_prod_readonly_login," >&2
  echo "SOIT son seul mot de passe (l'URL est alors composée ici)." >&2
  exit 4
fi

# REFUS AVANT CONNEXION : ce script ne doit jamais viser Test par mégarde.
case "$URL" in
  *"$REF_ATTENDUE"*) : ;;
  *) echo "L'URL fournie ne désigne pas le projet attendu ($REF_ATTENDUE). Arrêt." >&2
     echo "Si elle vient du trousseau, vérifier qu'elle désigne bien ce projet ;" >&2
     echo "une entrée réduite au mot de passe est acceptée et compose l'URL ici." >&2
     exit 5 ;;
esac
echo "Cible : $CIBLE - lecture du catalogue seule, aucune ecriture."

filtre() { sed -E 's#postgres[^:]*:[^@]*@#postgres:***@#g'; }

# GARDE D'IDENTITÉ — MESURÉE, PAS DÉCLARÉE. Composer une URL ne prouve pas
# sous quelle identité le serveur nous accepte. On la demande, et on refuse de
# lire quoi que ce soit si elle n'est pas celle attendue. Cette sonde sert
# aussi de test de connexion : son message d'erreur, filtré, dit pourquoi.
IDENTITE_REELLE="$("$PSQL" "$URL" -At --quiet --no-psqlrc \
  -c 'select current_user' 2>&1 | filtre)" || {
  echo "Connexion impossible. Message du serveur (filtré) :" >&2
  echo "$IDENTITE_REELLE" >&2
  echo "Note : db.<ref>.supabase.co est joignable en IPv6 seulement et peut expirer." >&2
  exit 6
}
if [ "$IDENTITE_REELLE" != "$IDENTITE_ATTENDUE" ]; then
  echo "Identité connectée « $IDENTITE_REELLE » au lieu de « $IDENTITE_ATTENDUE »." >&2
  echo "Arrêt avant toute lecture : une capacité constatée n'est pas une autorisation." >&2
  exit 7
fi
echo "Identite connectee : $IDENTITE_REELLE (conforme a l'attendu)."

SQL=$(cat <<'REQ'
\set ON_ERROR_STOP on
set default_transaction_read_only = on;
set statement_timeout = '60s';

\echo '== 0. Identité de la lecture =========================================='
select current_user                           as role_courant,
       current_database()                     as base,
       current_setting('server_version')      as moteur,
       current_setting('default_transaction_read_only') as lecture_seule,
       now()                                  as lu_le;

\echo ''
\echo '== 1. Témoin de capacité — la lecture voit-elle quelque chose ? ======='
select c.relname                                        as table_vue,
       count(*) filter (where a.attnum > 0 and not a.attisdropped) as colonnes_totales
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attribute a on a.attrelid = c.oid
 where n.nspname = 'public'
   and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
 group by c.relname
 order by c.relname;

\echo ''
\echo '== 2. Volume (n_live_tup — jamais count(*), jamais reltuples) ========='
select relname as table_vue, n_live_tup as lignes_estimees
  from pg_stat_user_tables
 where schemaname = 'public'
   and relname in ('carburant_reception_visites','carburant_reception_mesures')
 order by relname;

\echo ''
\echo '== 3. Les 8 colonnes attendues (pg_attribute, non filtré) ============='
select c.relname || '.' || a.attname                       as colonne,
       format_type(a.atttypid, a.atttypmod)                as type,
       case when a.attnotnull then 'NO' else 'YES' end     as null_autorise,
       coalesce(pg_get_expr(d.adbin, d.adrelid), '-')      as defaut
  from pg_attribute a
  join pg_class     c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
 where n.nspname = 'public'
   and not a.attisdropped and a.attnum > 0
   and ( (c.relname = 'carburant_reception_visites'
          and a.attname in ('mode_saisie','regularisation_motif','regularisation_par',
                            'regularisation_par_nom','regularisation_le',
                            'controle_terrain_par','justificatif_url'))
      or (c.relname = 'carburant_reception_mesures' and a.attname = 'source') )
 order by c.relname, a.attname;

\echo ''
\echo '== 4. Les 3 contraintes attendues (noms vérifiés sur la migration) ===='
select c.relname || ' : ' || k.conname          as contrainte,
       k.convalidated                           as validee,
       pg_get_constraintdef(k.oid)              as definition
  from pg_constraint k
  join pg_class     c on c.oid = k.conrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
   and k.conname in ('carburant_reception_visites_mode_saisie_check',
                     'carburant_reception_visites_regularisation_coherente_check',
                     'carburant_reception_mesures_source_check')
 order by k.conname;

\echo ''
\echo '== 5. La fonction de garde ============================================'
select p.proname                                          as fonction,
       p.prosecdef                                        as security_definer,
       coalesce(array_to_string(p.proconfig, ','), '-')   as reglages,
       coalesce(p.proacl::text, 'DEFAUT(null)')           as acl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'nexus_garde_regularisation_reception';

\echo ''
\echo '== 6. Le trigger, ET la fonction réellement appelée ============='
select t.tgname                                   as trigger_nom,
       c.relname                                  as sur_table,
       t.tgenabled = 'O'                          as actif,
       p.proname                                  as appelle,
       pg_get_triggerdef(t.oid)                   as definition
  from pg_trigger   t
  join pg_class     c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc      p on p.oid = t.tgfoid
 where n.nspname = 'public'
   and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
   and not t.tgisinternal
 order by c.relname, t.tgname;

\echo ''
\echo '== 7. VERDICT ========================================================='
with capacite as (
  select count(*) as tables_vues
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname='public'
     and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
),
cols as (
  select count(*) as n
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname='public' and not a.attisdropped and a.attnum > 0
     and ( (c.relname='carburant_reception_visites'
            and a.attname in ('mode_saisie','regularisation_motif','regularisation_par',
                              'regularisation_par_nom','regularisation_le',
                              'controle_terrain_par','justificatif_url'))
        or (c.relname='carburant_reception_mesures' and a.attname='source') )
),
contraintes as (
  select count(*) as n
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname='public'
     and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
     and k.conname in ('carburant_reception_visites_mode_saisie_check',
                       'carburant_reception_visites_regularisation_coherente_check',
                       'carburant_reception_mesures_source_check')
     and k.convalidated
),
fonction as (
  select count(*) as n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='nexus_garde_regularisation_reception'
     and p.prosecdef and p.proconfig @> array['search_path=public']
),
trig as (
  select count(*) as n
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
   where n.nspname='public' and c.relname='carburant_reception_visites'
     and t.tgname='trg_garde_regularisation_reception'
     and not t.tgisinternal and t.tgenabled='O'
     and p.proname='nexus_garde_regularisation_reception'
)
select capacite.tables_vues              as tables_vues_sur_2,
       cols.n                            as colonnes_sur_8,
       contraintes.n                     as contraintes_validees_sur_3,
       fonction.n                        as fonction_sur_1,
       trig.n                            as trigger_cable_sur_1,
       cols.n + contraintes.n + fonction.n + trig.n as objets_sur_13,
       case
         when capacite.tables_vues <> 2 then 'LECTURE_AVEUGLE — les deux tables ne sont pas vues. Ne rien conclure.'
         when cols.n + contraintes.n + fonction.n + trig.n = 13 then 'MIGRATION_APPLIQUEE — 13/13.'
         when cols.n + contraintes.n + fonction.n + trig.n = 0  then 'MIGRATION_NON_APPLIQUEE — 0/13.'
         else 'ETAT_PARTIEL — STOP. Ni appliquée ni absente : arbitrage requis.'
       end                               as verdict
  from capacite, cols, contraintes, fonction, trig;
REQ
)

printf '%s\n' "$SQL" | "$PSQL" "$URL" --quiet --no-psqlrc --pset=pager=off 2>&1 | filtre
