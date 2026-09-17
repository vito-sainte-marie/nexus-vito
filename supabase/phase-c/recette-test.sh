#!/usr/bin/env bash
# =====================================================================
# Recette de la Phase C — joue le fichier EXACT du dépôt sur nexus-test,
# dans une transaction annulée.
#
# POURQUOI CE SCRIPT EXISTE
#
# La Phase C ne part pas avec `supabase db push` : elle s'applique à la
# main, une fois le front basculé (voir LISEZ-MOI.md). Rien ne l'exécute
# donc jamais — ni la CI, qui n'a pas de base, ni le déploiement. Une
# sortie de recette datée du mois dernier ne prouve rien du fichier
# d'aujourd'hui : c'est le fichier EXACT de la tête courante qu'il faut
# avoir rejoué, et c'est tout l'objet de ce script.
#
# CE QU'IL GARANTIT
#
#   · Le fichier du dépôt n'est modifié que sur DEUX lignes : son
#     `begin;` et son `commit;`. La transaction est ouverte et annulée
#     par la recette. Le `diff` est imprimé : il doit faire quatre
#     lignes, deux « < » et deux « > ». Tout le reste est joué tel quel.
#   · L'ancrage est vérifié AVANT la substitution. Si le fichier venait
#     à porter deux `commit;`, ou un `commit;` suivi d'un commentaire sur
#     la même ligne, la substitution laisserait passer un vrai commit :
#     le script s'arrête plutôt que de courir ce risque.
#   · La cible est refusée si elle ressemble à la Production.
#   · Le secret vient du trousseau et n'est jamais affiché ; psql
#     réimprime l'URL dans ses erreurs, la sortie est donc filtrée.
#
# USAGE
#   supabase/phase-c/recette-test.sh                 # corps + mutations
#   supabase/phase-c/recette-test.sh --sans-mutations
#
# La contrepartie statique de cette recette — celle qui, elle, tourne à
# chaque CI et sans base — est `test_phase_c_analysable_20260917.js`.
# =====================================================================
set -euo pipefail

PSQL=${PSQL:-/opt/homebrew/opt/libpq/bin/psql}
REF_TEST=udljdqxerrbbbajxubfn
REF_PROD=uzhjpqpctpvxytxpxoqz
ICI=$(cd "$(dirname "$0")" && pwd)
MIGRATIONS="$ICI/../migrations"
CORPS="$ICI/20260916230000_fdj_rls_definitives_phase_c.sql"
MUTATIONS="$ICI/20260916230000_mutations_de_validation.sql"

AVEC_MUTATIONS=1
[ "${1:-}" = "--sans-mutations" ] && AVEC_MUTATIONS=0

# --- Cible ------------------------------------------------------------
REF=${REF:-$REF_TEST}
if [ "$REF" = "$REF_PROD" ]; then
  echo "REFUS — cette recette ne vise jamais la Production." >&2
  exit 2
fi
[ -x "$PSQL" ] || { echo "psql introuvable : $PSQL" >&2; exit 2; }

# --- Ancrage transactionnel, vérifié avant de toucher quoi que ce soit --
LIGNE_BEGIN=$(grep -n '^begin;$' "$CORPS" | cut -d: -f1)
LIGNE_COMMIT=$(grep -n '^commit;$' "$CORPS" | cut -d: -f1)
NB_BEGIN=$(printf '%s\n' "$LIGNE_BEGIN" | grep -c . || true)
NB_COMMIT=$(printf '%s\n' "$LIGNE_COMMIT" | grep -c . || true)
if [ "$NB_BEGIN" != 1 ] || [ "$NB_COMMIT" != 1 ]; then
  echo "REFUS — ancrage inattendu : $NB_BEGIN « begin; » et $NB_COMMIT « commit; » seuls sur leur ligne." >&2
  echo "        La substitution ne serait plus sûre : la transaction pourrait être validée." >&2
  exit 2
fi
if grep -qi '^[[:space:]]*rollback;' "$CORPS"; then
  echo "REFUS — le corps contient un « rollback; » : seule la recette décide d'annuler." >&2
  exit 2
fi
echo "Ancrage : begin; ligne $LIGNE_BEGIN · commit; ligne $LIGNE_COMMIT · aucun rollback."

# --- Plan de vol ------------------------------------------------------
TRAVAIL=$(mktemp -d)
trap 'rm -rf "$TRAVAIL"' EXIT

sed -e "${LIGNE_BEGIN}s|^begin;\$|-- [RECETTE] begin;  -- la transaction est ouverte par la recette|" \
    -e "${LIGNE_COMMIT}s|^commit;\$|-- [RECETTE] commit;  -- la recette termine par rollback|" \
    "$CORPS" > "$TRAVAIL/corps.sql"

echo "--- diff entre le fichier du dépôt et ce qui va être joué ---"
diff "$CORPS" "$TRAVAIL/corps.sql" || true
NB_DIFF=$(diff "$CORPS" "$TRAVAIL/corps.sql" | grep -c '^[<>]' || true)
# Quatre lignes de diff : deux « < » et deux « > », soit deux lignes substituées.
[ "$NB_DIFF" = 4 ] || { echo "REFUS — $NB_DIFF lignes de diff au lieu de 4 : autre chose que le begin/commit a bougé." >&2; exit 2; }
echo "------------------------------------------------------------"

# Les neuf migrations de la Phase A sont les prérequis du corps (condition
# C1). Sur une base qui ne les a pas encore, on les charge DANS la même
# transaction annulée : le corps est alors joué sur le schéma qu'il attend,
# et rien ne subsiste.
: > "$TRAVAIL/prerequis.sql"
for f in "$MIGRATIONS"/20260916220*.sql; do
  printf '\\ir %s\n' "$f" >> "$TRAVAIL/prerequis.sql"
done

{
  printf '%s\n' \
    'begin;' \
    "select (to_regclass('public.fdj_caisse_evenements') is null) as charger_phase_a \\gset" \
    '\if :charger_phase_a' \
    "\\echo '>> Phase A absente de cette base : chargée dans la transaction.'" \
    "\\ir $TRAVAIL/prerequis.sql" \
    '\else' \
    "\\echo '>> Phase A déjà présente : le corps est joué sur le schéma en place.'" \
    '\endif' \
    "\\ir $TRAVAIL/corps.sql"
  [ "$AVEC_MUTATIONS" = 1 ] && printf '\\ir %s\n' "$MUTATIONS"
  printf '%s\n' 'rollback;'
} > "$TRAVAIL/pilote.sql"

# --- Exécution --------------------------------------------------------
PGPASSWORD=$(security find-generic-password -a nexus -s nexus-test-db -w)
export PGPASSWORD
export PGCONNECT_TIMEOUT=${PGCONNECT_TIMEOUT:-45}
URL="postgresql://postgres@db.$REF.supabase.co:5432/postgres?sslmode=require"

echo ">> psql db.$REF.supabase.co — transaction annulée en fin de course."
# Le code de sortie de psql est pris DIRECTEMENT, pas au bout d'un tube :
# dans « psql | sed », c'est le code de sed qui remonte, et un échec de
# connexion passerait pour un succès. La sortie est écrite dans le fichier
# de travail, filtrée, puis affichée — psql réimprime l'URL, mot de passe
# compris, dans ses messages d'erreur.
set +e
"$PSQL" "$URL" -v ON_ERROR_STOP=1 -f "$TRAVAIL/pilote.sql" > "$TRAVAIL/sortie.txt" 2>&1
CODE=$?
set -e
sed 's/postgres:[^@]*@/postgres:***@/g' "$TRAVAIL/sortie.txt"

if [ "$CODE" != 0 ]; then
  echo "ÉCHEC — la Phase C ne passe pas sur cette base (code $CODE)." >&2
  echo "        La connexion à Supabase est intermittente : si le message parle" >&2
  echo "        de « timeout expired », relancer avant de conclure." >&2
  exit 1
fi
echo "OK — le fichier exact de la Phase C s'exécute, et la transaction a été annulée."
