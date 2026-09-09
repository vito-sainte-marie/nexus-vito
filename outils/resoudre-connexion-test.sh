# NEXUS — résolution UNIQUE de la connexion PostgreSQL Test (09/09/2026).
#
# Sourcé par outils/reconstruire-base-test.sh et
# outils/repeter-lot-production-readiness-test.sh. Avant ce fichier, les deux
# construisaient chacun leur propre URL vers `db.<ref>.supabase.co` : une
# duplication qui aurait divergé le jour où l'un des deux aurait dû apprendre
# un second mode sans que l'autre suive — la même famille de défaut que la
# collision NexusStock (ARCH-002).
#
# Exporte PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD/PGSSLMODE : tout appel
# `psql` qui suit se fait SANS argument de connexion, jamais avec un secret
# sur la ligne de commande (visible dans la liste des processus).
#
# Deux modes, choisis par l'appelant :
#
#   nexus_resoudre_connexion_test <project-ref>
#     Mode historique (04/09/2026) : mot de passe lu dans le trousseau
#     macOS, hôte direct db.<ref>.supabase.co. Inchangé.
#
#   nexus_resoudre_connexion_test <project-ref> --url-env NOM_VARIABLE
#     Mode rail CI (09/09/2026). L'hôte direct ne publie plus qu'une adresse
#     IPv6 depuis le 08/09/2026 (cf. .github/workflows/tests.yml, étape
#     « Préparer la connexion PostgreSQL Test en écriture ») — les runners
#     GitHub Actions n'ont pas d'IPv6, cette URL y échouerait
#     systématiquement. Ce mode consomme à la place une URL déjà fournie
#     (pooler, IPv4) par le NOM d'une variable d'environnement déjà
#     positionnée par l'appelant — jamais un nouveau secret : la même valeur
#     que le secret Test existant (`SUPABASE_TEST_DB_URL_WRITE`), transmise
#     sous le nom que l'appelant lui a donné.
#
# Fail closed dans les deux cas : la référence de PRODUCTION est refusée si
# elle apparaît où que ce soit (hôte ou utilisateur) dans l'URL fournie, et
# la référence attendue doit apparaître dans l'un des deux — sinon,
# ambiguïté, arrêt. Aucune valeur de mot de passe n'est jamais imprimée ;
# sous GitHub Actions (`GITHUB_ACTIONS=true`), elle est explicitement
# masquée (`::add-mask::`) avant tout risque d'apparaître dans un journal.

PROD_REF="uzhjpqpctpvxytxpxoqz"

nexus_resoudre_connexion_test() {
  local ref="${1:-}"
  local mode="${2:-}"
  local url_env_name="${3:-}"

  if [ -z "$ref" ]; then
    echo "nexus_resoudre_connexion_test : référence de projet manquante." >&2
    return 2
  fi
  if [ "$ref" = "$PROD_REF" ]; then
    echo "REFUS : $ref est le projet de PRODUCTION." >&2
    return 3
  fi

  if [ -n "$mode" ] && [ "$mode" != "--url-env" ]; then
    echo "nexus_resoudre_connexion_test : option « $mode » inconnue (seule --url-env est acceptée)." >&2
    return 2
  fi

  if [ "$mode" = "--url-env" ]; then
    if [ -z "$url_env_name" ]; then
      echo "nexus_resoudre_connexion_test --url-env : nom de variable manquant." >&2
      return 2
    fi
    local url_brute="${!url_env_name:-}"
    if [ -z "$url_brute" ]; then
      echo "REFUS : variable d'environnement « $url_env_name » absente ou vide — aucune connexion possible." >&2
      return 6
    fi

    local exports
    if ! exports="$(URL="$url_brute" python3 - <<'PY'
import os, shlex
from urllib.parse import urlparse, unquote

u = urlparse(os.environ['URL'])
if u.scheme not in ('postgresql', 'postgres'):
    raise SystemExit("Schéma d'URL PostgreSQL invalide")
if not all((u.hostname, u.username, u.password, u.path)):
    raise SystemExit("URL PostgreSQL incomplète")

valeurs = {
    'PGHOST': u.hostname,
    'PGPORT': str(u.port or 5432),
    'PGDATABASE': u.path.lstrip('/') or 'postgres',
    'PGUSER': unquote(u.username),
    'PGPASSWORD': unquote(u.password),
}
for cle, valeur in valeurs.items():
    print(f'{cle}={shlex.quote(valeur)}')
PY
)"; then
      echo "REFUS : URL PostgreSQL fournie par « $url_env_name » invalide ou incomplète." >&2
      return 8
    fi

    eval "$exports"
    export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD
    export PGSSLMODE=require
    if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
      echo "::add-mask::$PGPASSWORD"
    fi

    local cible_minuscule
    cible_minuscule="$(printf '%s %s' "${PGHOST:-}" "${PGUSER:-}" | tr '[:upper:]' '[:lower:]')"
    if printf '%s' "$cible_minuscule" | grep -qF "$(printf '%s' "$PROD_REF" | tr '[:upper:]' '[:lower:]')"; then
      echo "REFUS : la référence de PRODUCTION ($PROD_REF) apparaît dans l'hôte ou l'utilisateur de l'URL fournie." >&2
      unset PGPASSWORD
      return 3
    fi
    if ! printf '%s' "$cible_minuscule" | grep -qF "$(printf '%s' "$ref" | tr '[:upper:]' '[:lower:]')"; then
      echo "REFUS : la référence « $ref » n'apparaît ni dans l'hôte ni dans l'utilisateur de l'URL fournie — ambiguïté, arrêt." >&2
      unset PGPASSWORD
      return 7
    fi
  else
    local mdp
    mdp="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"
    if [ -z "$mdp" ]; then
      echo "Mot de passe introuvable dans le trousseau (compte « nexus », service « nexus-test-db »)." >&2
      echo "Le déposer avec :  security add-generic-password -a nexus -s nexus-test-db -w" >&2
      return 4
    fi
    export PGHOST="db.${ref}.supabase.co"
    export PGPORT=5432
    export PGDATABASE=postgres
    export PGUSER=postgres
    export PGPASSWORD="$mdp"; unset mdp
    export PGSSLMODE=require
  fi

  return 0
}
