#!/usr/bin/env bash
# VÉHICULE — remise en service du login Production (migration 20260904175747)
#
# À EXÉCUTER PAR FRÉDÉRIC SUR PRODUCTION. Claude n'a aucun chemin d'écriture
# vers Production et n'en cherche pas : ce fichier n'est ni exécuté ni testé
# contre une vraie base Production par Claude, seulement contre des leurres
# et des connexions mortes (voir test_vehicule_migration_login_production_20261001.js).
#
# POURQUOI CE FICHIER EXISTE. La procédure demandait jusqu'ici de lancer à la
# main :
#
#   psql "$URL_PRODUCTION" -v ON_ERROR_STOP=1 -f outils/migration-login-production-a-executer-par-frederic.sql
#
# Le 01/10/2026, `$URL_PRODUCTION` n'avait jamais été défini. `psql` a reçu une
# chaîne vide, ce qui ne lève AUCUNE erreur de variable manquante : psql se
# rabat sur ses paramètres par défaut (socket local, utilisateur courant) et
# rend une erreur de connexion qui ne nomme ni la cause ni la cible visée. Le
# défaut n'était pas dans l'artefact SQL — il a six contrôles de précondition,
# une transaction, une relecture terminale hors transaction (voir
# migration-login-production-a-executer-par-frederic.sql et la procédure) —
# il était dans la phrase de documentation qui PRESCRIVAIT une variable que
# personne n'avait définie nulle part. Un script qui implémente une phrase de
# documentation n'a mesuré personne (leçon déjà écrite le 01/10 dans
# docs/deploiement/README.md, pour un défaut de la même famille).
#
# CE QUE CE VÉHICULE FAIT DE DIFFÉRENT :
#
#   1. il réutilise le contrat déjà éprouvé par
#      outils/lecture-apres-migration-20260919103000.sh — lecture du
#      trousseau, distinction URL / mot de passe, composition explicite de
#      l'URL, contrôle de la référence projet AVANT connexion — sans inventer
#      un second mécanisme de secret ;
#   2. il ne fait AUCUNE écriture par défaut. Sans `--appliquer`, il mesure et
#      s'arrête ;
#   3. avant toute possibilité d'écriture, il mesure : la cible
#      (uzhjpqpctpvxytxpxoqz), current_database(), current_user,
#      transaction_read_only, pg_is_in_recovery(), et
#      has_schema_privilege(current_user,'public','CREATE'). Il refuse un
#      rôle en lecture seule, un réplica, une identité sans CREATE, et toute
#      cible qui ne nomme pas le projet attendu (pooler générique compris) ;
#   4. l'écriture n'a lieu qu'avec l'opt-in explicite `--appliquer` ;
#   5. l'artefact SQL canonique n'est ni recréé ni réécrit : il est joué tel
#      quel, à l'identique (outils/migration-login-production-a-executer-par-frederic.sql) ;
#   6. le code de sortie reflète la DERNIÈRE ligne `ETAT_FINAL …` que
#      l'artefact écrit lui-même, APRÈS son `commit;` — jamais le code de
#      sortie de `psql`, qui vaut 0 même sur un refus sans `-v ON_ERROR_STOP=1`
#      (mesuré le 01/10, voir la procédure §6). Ce véhicule appelle donc
#      délibérément `psql` SANS `-v ON_ERROR_STOP=1` : avec cette option,
#      `psql` s'arrêterait AVANT la section 6 sur un refus et la dernière
#      ligne ne serait jamais écrite. Le véhicule décide sur le TEXTE, jamais
#      sur le code de sortie de son client.
#
# CODES DE SORTIE :
#   1  USAGE            — argument inconnu.
#   2  PSQL_INTROUVABLE — ni psql ni le repli Homebrew ne sont exécutables.
#   3  SECRET_ABSENT    — ni NEXUS_PROD_DB_URL_WRITE, ni le trousseau
#                         `nexus-prod-db-write` ne fournissent de quoi se
#                         connecter. `$URL_PRODUCTION` n'est JAMAIS lu : cette
#                         variable est celle qui a piégé le 01/10/2026, et ce
#                         véhicule ne la consulte pas, qu'elle soit vide,
#                         absente ou définie.
#   4  ARTEFACT_INTROUVABLE — `--appliquer` demandé mais le fichier SQL
#                         canonique est absent du disque.
#   5  CIBLE_INATTENDUE  — l'URL/l'identité ne désigne pas explicitement
#                         uzhjpqpctpvxytxpxoqz, ou nomme un rôle de lecture
#                         seule connu, refusé AVANT toute connexion.
#   6  CONNEXION_IMPOSSIBLE — la sonde de mesure n'a pas pu s'exécuter.
#   7  PREFLIGHT_REFUS   — connecté, mais la mesure refuse : rôle en lecture
#                         seule, réplica, ou absence de CREATE sur `public`.
#   0  soit la mesure seule est conforme (sans `--appliquer`, rien n'est
#      écrit), soit l'artefact a été joué et sa dernière ligne dit
#      `ETAT_FINAL MIGRATION_LOGIN_APPLIQUEE`.
#   30 ETAT_FINAL MIGRATION_LOGIN_NON_APPLIQUEE — refusé, base intacte.
#   31 ETAT_FINAL MIGRATION_LOGIN_INCOMPLETE    — état mi-chemin constaté.
#   32 ETAT_FINAL MIGRATION_LOGIN_INCOHERENTE   — fonction présente, vue disparue.
#   33 ETAT_FINAL absent ou imprévu — JAMAIS traité comme un succès, même si
#      `psql` est sorti avec le code 0.
#
# LE SECRET NE SORT PAS. Rien n'affiche `$URL`, `$PGPASSWORD` ni le contenu du
# trousseau ; toute sortie de `psql` est filtrée.
#
# Usage :   bash outils/appliquer-migration-login-production-a-executer-par-frederic.sh [--appliquer]
#   sans argument   : préflight — mesure la cible, refuse ou confirme, n'écrit rien.
#   avec --appliquer : si le préflight passe, joue l'artefact canonique et
#                      rend le verdict réel.
set -euo pipefail

ARTEFACT="outils/migration-login-production-a-executer-par-frederic.sql"
REF_ATTENDUE="uzhjpqpctpvxytxpxoqz"   # Production, et uniquement Production.

APPLIQUER=0
for arg in "$@"; do
  case "$arg" in
    --appliquer) APPLIQUER=1 ;;
    *)
      echo "Usage : $0 [--appliquer]" >&2
      echo "Sans --appliquer : préflight et mesure seuls, aucune écriture." >&2
      exit 1 ;;
  esac
done

PSQL="$(command -v psql || true)"
[ -n "$PSQL" ] || PSQL=/opt/homebrew/opt/libpq/bin/psql
if [ ! -x "$PSQL" ]; then
  echo "psql introuvable. Sur macOS : brew install libpq" >&2
  exit 2
fi

if [ "$APPLIQUER" = "1" ] && [ ! -f "$ARTEFACT" ]; then
  echo "ARTEFACT_INTROUVABLE — $ARTEFACT est absent de ce répertoire de travail." >&2
  echo "L'artefact canonique n'est jamais recréé par ce véhicule : il doit exister tel quel." >&2
  exit 4
fi

# ---------------------------------------------------------------------------
# RÉSOLUTION DU SECRET D'ÉCRITURE — même contrat que la lecture seule :
# l'URL complète prime, à défaut le trousseau peut contenir soit l'URL
# complète soit le seul mot de passe (forme réellement constatée le
# 01/10/2026 pour l'entrée de lecture seule : rien ne garantit que l'entrée
# d'écriture sera différente). `$URL_PRODUCTION` n'est JAMAIS consulté.
# ---------------------------------------------------------------------------
UTILISATEUR_ECRITURE="${NEXUS_PROD_DB_USER_WRITE:-postgres}"

URL="${NEXUS_PROD_DB_URL_WRITE:-}"
if [ -z "$URL" ]; then
  SECRET="$(security find-generic-password -a nexus -s nexus-prod-db-write -w 2>/dev/null || true)"
  if [ -n "$SECRET" ]; then
    case "$SECRET" in
      postgres://*|postgresql://*)
        URL="$SECRET" ;;
      *)
        export PGPASSWORD="$SECRET"
        URL="postgresql://${UTILISATEUR_ECRITURE}@db.${REF_ATTENDUE}.supabase.co:5432/postgres?sslmode=require" ;;
    esac
  fi
  SECRET=""
  unset SECRET
fi
if [ -z "$URL" ]; then
  echo "SECRET_ABSENT — aucun moyen de se connecter en écriture à Production." >&2
  echo "Attendu : NEXUS_PROD_DB_URL_WRITE, ou l'entrée de trousseau « nexus-prod-db-write »" >&2
  echo "(compte « nexus »), contenant SOIT l'URL complète, SOIT son seul mot de passe" >&2
  echo "(l'URL est alors composée ici avec l'utilisateur postgres, ou NEXUS_PROD_DB_USER_WRITE)." >&2
  echo "Note : \$URL_PRODUCTION n'est pas lu par ce véhicule, quelle que soit sa valeur —" >&2
  echo "c'est la variable qui a piégé le 01/10/2026 en étant passée vide à psql." >&2
  exit 3
fi

# ---------------------------------------------------------------------------
# REFUS AVANT CONNEXION — la cible, et les identités de lecture seule connues.
# Une capacité constatée après coup n'excuse pas d'avoir visé la mauvaise
# chose : ce contrôle porte sur ce qui a été COMPOSÉ, avant tout aller-retour
# réseau. Un pooler générique qui ne nomme pas le projet est refusé ici,
# puisqu'il ne contient jamais la référence attendue.
# ---------------------------------------------------------------------------
case "$URL" in
  *"$REF_ATTENDUE"*) : ;;
  *) echo "CIBLE_INATTENDUE — l'URL fournie ne désigne pas le projet Production attendu" >&2
     echo "($REF_ATTENDUE). Un pooler générique qui ne nomme pas le projet est refusé ici." >&2
     exit 5 ;;
esac
case "$URL" in
  *nexus_prod_readonly_login*|*nexus_prod_readonly*)
    echo "CIBLE_INATTENDUE — identité de lecture seule refusée avant toute connexion :" >&2
    echo "ce véhicule applique une migration, il ne peut pas se connecter en lecture seule." >&2
    exit 5 ;;
esac

filtre() { sed -E 's#postgres[^:]*:[^@]*@#postgres:***@#g'; }

# ---------------------------------------------------------------------------
# MESURE — la seule question qui compte : cette identité peut-elle écrire,
# et sur la bonne cible ? Chaque colonne est mise en mots explicites plutôt
# que castée en texte brut, pour ne dépendre d'aucune convention de
# représentation booléenne de PostgreSQL.
# ---------------------------------------------------------------------------
REQUETE_MESURE="select current_database(), current_user, \
case when current_setting('transaction_read_only') = 'on' then 'LECTURE_SEULE' else 'ECRITURE_POSSIBLE' end, \
case when pg_is_in_recovery() then 'REPLICA' else 'PRIMAIRE' end, \
case when has_schema_privilege(current_user, 'public', 'CREATE') then 'CREATE_OUI' else 'CREATE_NON' end;"

MESURE="$("$PSQL" "$URL" -At -F'|' --quiet --no-psqlrc -c "$REQUETE_MESURE" 2>&1 | filtre)" || {
  echo "CONNEXION_IMPOSSIBLE — la sonde de mesure a échoué. Message du serveur (filtré) :" >&2
  echo "$MESURE" >&2
  echo "Note : db.<ref>.supabase.co est joignable en IPv6 seulement et peut expirer." >&2
  exit 6
}

IFS='|' read -r BASE IDENTITE LECTURE_SEULE RECUPERATION PEUT_CREER <<<"$MESURE"
if [ -z "$BASE" ] || [ -z "$IDENTITE" ] || [ -z "$LECTURE_SEULE" ] || [ -z "$RECUPERATION" ] || [ -z "$PEUT_CREER" ]; then
  echo "CONNEXION_IMPOSSIBLE — la sonde de mesure n'a pas rendu les 5 colonnes attendues." >&2
  echo "Sortie brute (filtrée) : $MESURE" >&2
  exit 6
fi

echo "Mesure — base : $BASE | identité : $IDENTITE | $LECTURE_SEULE | $RECUPERATION | $PEUT_CREER"

if [ "$LECTURE_SEULE" != "ECRITURE_POSSIBLE" ]; then
  echo "PREFLIGHT_REFUS — l'identité « $IDENTITE » est en lecture seule" \
       "(transaction_read_only=on). Rien n'est appliqué." >&2
  exit 7
fi
if [ "$RECUPERATION" != "PRIMAIRE" ]; then
  echo "PREFLIGHT_REFUS — cette cible est un réplica (pg_is_in_recovery()=true)." \
       "On n'écrit jamais sur un réplica. Rien n'est appliqué." >&2
  exit 7
fi
if [ "$PEUT_CREER" != "CREATE_OUI" ]; then
  echo "PREFLIGHT_REFUS — l'identité « $IDENTITE » n'a pas CREATE sur le schéma public." \
       "La migration créerait une fonction ; sans ce droit, elle échouerait. Rien n'est appliqué." >&2
  exit 7
fi

if [ "$APPLIQUER" != "1" ]; then
  echo "PREFLIGHT_CONFORME — base $BASE, identité $IDENTITE, écriture possible, non-réplica, CREATE présent."
  echo "Aucune écriture effectuée. Relancez avec --appliquer pour exécuter la migration."
  exit 0
fi

# ---------------------------------------------------------------------------
# APPLICATION — DÉLIBÉRÉMENT SANS -v ON_ERROR_STOP=1. L'artefact porte sa
# propre transaction et sa propre relecture terminale (section 6) APRÈS le
# commit ; `ON_ERROR_STOP` ferait sortir psql AVANT cette relecture sur un
# refus, et la dernière ligne ne serait jamais écrite. Le verdict de CE
# véhicule vient du TEXTE de cette dernière ligne, jamais du code de sortie
# de psql — qui vaut 0 même sur un refus sans cette option (mesuré le
# 01/10/2026, voir docs/deploiement/procedure-migration-login-production.md §6).
# ---------------------------------------------------------------------------
echo "Application de $ARTEFACT sur $BASE (identité $IDENTITE)…"
# `set +e` le temps de CETTE commande : sous `set -e`, une affectation dont le
# membre droit est une substitution de commande qui échoue termine le script
# immédiatement (pipefail compris), AVANT que la ligne ci-dessous puisse
# décider quoi que ce soit. Le véhicule doit pouvoir lire une transcription
# même quand psql sort en échec — c'est précisément le cas qui doit produire
# ABSENT_OU_IMPREVU (33), pas un code de sortie brut de psql qui pourrait, par
# coïncidence, recouvrir un des codes déjà attribués ci-dessus (ex. 2).
set +e
SORTIE="$("$PSQL" "$URL" --quiet --no-psqlrc --pset=pager=off -f "$ARTEFACT" 2>&1 | filtre)"
set -e
printf '%s\n' "$SORTIE"

ETAT="$(printf '%s\n' "$SORTIE" | grep -oE 'ETAT_FINAL [A-Z_]+' | tail -n1 | awk '{print $2}' || true)"

case "$ETAT" in
  MIGRATION_LOGIN_APPLIQUEE)
    echo "VEHICULE_ETAT_FINAL: $ETAT"
    exit 0 ;;
  MIGRATION_LOGIN_NON_APPLIQUEE)
    echo "VEHICULE_ETAT_FINAL: $ETAT" >&2
    exit 30 ;;
  MIGRATION_LOGIN_INCOMPLETE)
    echo "VEHICULE_ETAT_FINAL: $ETAT" >&2
    exit 31 ;;
  MIGRATION_LOGIN_INCOHERENTE)
    echo "VEHICULE_ETAT_FINAL: $ETAT" >&2
    exit 32 ;;
  *)
    echo "VEHICULE_ETAT_FINAL: ABSENT_OU_IMPREVU — aucune ligne ETAT_FINAL reconnue." >&2
    echo "Ce n'est JAMAIS un succès : relire la sortie ci-dessus avant de rejouer quoi que ce soit." >&2
    exit 33 ;;
esac
