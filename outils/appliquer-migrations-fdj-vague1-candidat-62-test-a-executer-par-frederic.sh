#!/usr/bin/env bash
# VÉHICULE — appliquer durablement les 12 migrations FDJ du candidat 9ffee7e
# (20260916220000 → 20260916221100) SUR nexus-test, ET SUR RIEN D'AUTRE.
#
# À EXÉCUTER PAR FRÉDÉRIC OU L'ORCHESTRATOR, DEPUIS UN CHECKOUT DE LA BRANCHE
# CANDIDATE `rebuild/fdj-62-20260922` (commit 9ffee7e). Le canal GitHub Issue
# qui a rédigé ce véhicule (`@claude` sur l'issue #28) mesure explicitement
# `NEXUS_TEST_DB_AVAILABLE=0` : aucune variable de connexion Test, aucun
# trousseau, par construction — constat inchangé depuis le 06/09/2026 pour ce
# type de déclenchement, et confirmé à nouveau ici le 04/10/2026. Ce véhicule
# n'a donc pu être ni exécuté ni testé en conditions réelles par Claude : il
# est écrit pour être lancé par une session qui a l'accès.
#
# CE QUE `decision-2.md` DE `FDJ-VAGUE1-REPRISE-20261003` AUTORISE, ET RIEN
# D'AUTRE
#
# Option A choisie par Frédéric Bragance le 04/10/2026, en réponse à
# `request-2.md` (§3) : appliquer durablement les 12 migrations sur
# `nexus-test`, dans une transaction unique, puis exécuter la recette FDJ
# Cas 1 à 5 sur l'alias du candidat. Ce véhicule couvre uniquement la première
# moitié (l'application des 12 migrations et la preuve `schema_migrations`) —
# la recette Cas 1 à 5 exige un navigateur réel contre l'alias Cloudflare
# Pages, hors du périmètre d'un véhicule `psql`, et reste à exécuter après
# coup, séparément (voir le pied de ce fichier).
#
# POURQUOI UN VÉHICULE, ET PAS DOUZE LIGNES DE psql À LA MAIN
#
# Standard NEXUS depuis le 01/10/2026 (voir
# `outils/appliquer-migration-ecriture-bornee-station-config-test-a-executer-par-frederic.sh`) :
# un véhicule mesure sa cible avant d'écrire, et refuse plutôt que de
# supposer. Celui-ci en reprend la forme, avec deux différences imposées par
# la nature du geste :
#
#  §1 DOUZE FICHIERS, UNE SEULE TRANSACTION. Les migrations ne portent chacune
#     aucun `begin`/`commit` (convention Supabase : chaque fichier est rejoué
#     seul par la CLI officielle, qui gère sa propre transaction). Ce véhicule
#     les enveloppe toutes les douze dans UN SEUL `begin ... commit`, exactement
#     la condition posée par `decision-2.md`. Si la 7e échoue, les 6
#     précédentes de CETTE exécution sont défaites avec elle — rien n'est
#     laissé à moitié. C'est la même transaction que l'essai à blanc du
#     geste 2 de `request-2.md`, simplement poussée jusqu'au `commit` au lieu
#     d'un `rollback` déjà décidé à l'avance.
#
#  §2 AUCUN ROLLBACK INVENTÉ. Si `psql` s'arrête en cours de route
#     (`-v ON_ERROR_STOP=1`), la transaction reste ouverte et non validée ;
#     la fermeture de la connexion la défait automatiquement — c'est le
#     mécanisme natif de PostgreSQL, pas un script de sens inverse. Ce
#     véhicule n'écrit donc aucune migration DOWN : il n'y en a pas, et
#     `decision-2.md` interdit d'en inventer une.
#
# Pour le reste — refus du pooler par nom d'hôte, refus de la référence
# Production par nom, refus de l'identité `nexus_ci_recette` (écrire des
# fonctions/triggers/RLS exige la propriété, pas des lignes), secret jamais
# affiché, verdict tiré d'une MESURE après coup et non d'un code de sortie —
# ce véhicule suit exactement la même discipline que son prédécesseur.
#
# SANS `--appliquer`, IL MESURE ET S'ARRÊTE : combien des 12 versions sont
# déjà dans `schema_migrations`, et l'état des 6 colonnes de préflight.
#
# CODES DE SORTIE
#   0  préflight conforme (mesure seule), ou les 12 migrations ont été
#      appliquées ET les 12 versions sont vérifiées présentes dans
#      schema_migrations après coup
#   1  USAGE
#   2  PSQL_INTROUVABLE
#   3  SECRET_ABSENT
#   4  ARTEFACT_INTROUVABLE          (un des 12 fichiers manque au checkout)
#   5  CIBLE_INATTENDUE              (refusé AVANT toute connexion)
#   6  CONNEXION_IMPOSSIBLE
#   7  PREFLIGHT_REFUS
#   8  ETAT_DEJA_PARTIEL             (une des 12 versions existe déjà — refus
#                                     de réappliquer une migration non idempotente)
#  30  MIGRATIONS_NON_APPLIQUEES     — aucune des 12 versions présente après coup
#  31  MIGRATIONS_INCOMPLETES        — certaines présentes, pas les 12
#  33  ETAT_FINAL_ABSENT_OU_IMPREVU  — JAMAIS un succès
#
# AUTORISATION HUMAINE, verbatim, 04/10/2026 — Frédéric Bragance, en réponse
# à `request-2.md` de `FDJ-VAGUE1-REPRISE-20261003` :
# « Je choisis l'option A recommandée, strictement sur nexus-test. »
# Conditions cumulatives posées dans le même arbitrage et reprises ici :
# vérifier l'identité du projet avant écriture (STOP si ambiguë), aucun
# rollback inventé (STOP avec preuve exacte si l'application échoue), mesurer
# schema_migrations après coup et prouver les 12 versions présentes.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"

VERSIONS=(
  20260916220000
  20260916220100
  20260916220200
  20260916220300
  20260916220400
  20260916220500
  20260916220600
  20260916220700
  20260916220800
  20260916220900
  20260916221000
  20260916221100
)
FICHIERS=(
  "$REPO_ROOT/supabase/migrations/20260916220000_fdj_quart_relie_a_la_prise_de_poste.sql"
  "$REPO_ROOT/supabase/migrations/20260916220100_fdj_caisse_cycle_de_vie_colonnes.sql"
  "$REPO_ROOT/supabase/migrations/20260916220200_fdj_caisse_journal_evenements.sql"
  "$REPO_ROOT/supabase/migrations/20260916220300_fdj_demandes_correction_apres_validation.sql"
  "$REPO_ROOT/supabase/migrations/20260916220400_fdj_mouvements_auteur_et_date_effet.sql"
  "$REPO_ROOT/supabase/migrations/20260916220500_fdj_commande_ouverture_quart.sql"
  "$REPO_ROOT/supabase/migrations/20260916220600_fdj_commandes_caisse_employe.sql"
  "$REPO_ROOT/supabase/migrations/20260916220700_fdj_commandes_caisse_manager.sql"
  "$REPO_ROOT/supabase/migrations/20260916220800_fdj_projection_employe.sql"
  "$REPO_ROOT/supabase/migrations/20260916220900_fdj_projection_progression.sql"
  "$REPO_ROOT/supabase/migrations/20260916221000_fdj_commandes_activations_et_mouvements.sql"
  "$REPO_ROOT/supabase/migrations/20260916221100_fdj_commande_saisie_caisse_manager.sql"
)

REF_ATTENDUE="udljdqxerrbbbajxubfn"   # nexus-test, et uniquement nexus-test.
REF_PRODUCTION="uzhjpqpctpvxytxpxoqz" # nommée ICI pour être refusée, jamais visée.

APPLIQUER=0
for arg in "$@"; do
  case "$arg" in
    --appliquer) APPLIQUER=1 ;;
    *) echo "Usage : $0 [--appliquer]" >&2
       echo "  sans --appliquer : mesure la cible et l'état des 12 versions, n'écrit rien." >&2
       exit 1 ;;
  esac
done

PSQL="$(command -v psql || true)"
[ -n "$PSQL" ] || PSQL=/opt/homebrew/opt/libpq/bin/psql
if [ ! -x "$PSQL" ]; then
  echo "REFUS : psql introuvable (ni dans PATH, ni au repli /opt/homebrew/opt/libpq/bin/psql)." >&2
  exit 2
fi

if [ "$APPLIQUER" = "1" ]; then
  for f in "${FICHIERS[@]}"; do
    if [ ! -f "$f" ]; then
      echo "REFUS : ARTEFACT_INTROUVABLE — $f absent." >&2
      echo "Ce véhicule ne réécrit jamais les migrations : il exige un checkout de" >&2
      echo "rebuild/fdj-62-20260922 (commit 9ffee7e) où les 12 fichiers existent déjà." >&2
      exit 4
    fi
  done
fi

# ── Le secret : variable d'environnement, puis trousseau. Jamais affiché. ──
UTILISATEUR_ECRITURE="${NEXUS_TEST_DB_USER_WRITE:-postgres}"

URL="${NEXUS_TEST_DB_URL_WRITE:-}"
if [ -z "$URL" ]; then
  SECRET="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"
  if [ -n "$SECRET" ]; then
    case "$SECRET" in
      postgres://*|postgresql://*)
        URL="$SECRET" ;;
      *)
        export PGPASSWORD="$SECRET"
        URL="postgresql://${UTILISATEUR_ECRITURE}@db.${REF_ATTENDUE}.supabase.co:5432/postgres?sslmode=require&connect_timeout=12" ;;
    esac
  fi
  SECRET=""; unset SECRET
fi

if [ -z "$URL" ]; then
  echo "REFUS : SECRET_ABSENT — ni \$NEXUS_TEST_DB_URL_WRITE, ni l'entrée de trousseau" >&2
  echo "  nexus-test-db (compte nexus) n'a rendu quoi que ce soit." >&2
  echo "\$SUPABASE_TEST_DB_URL_WRITE n'est JAMAIS lu — il authentifie nexus_ci_recette," >&2
  echo "qui ne peut pas créer les fonctions/triggers/politiques de ces 12 migrations." >&2
  exit 3
fi

# ── Refus AVANT toute connexion. Trois, par nom. ──────────────────────────
case "$URL" in
  *pooler.supabase.com*)
    echo "REFUS : CIBLE_INATTENDUE — l'URL désigne le pooler Supabase." >&2
    echo "L'hôte direct db.<ref>.supabase.co est la seule cible admise ici." >&2
    exit 5 ;;
esac

case "$URL" in
  *"$REF_PRODUCTION"*)
    echo "REFUS : CIBLE_INATTENDUE — l'URL nomme la référence PRODUCTION." >&2
    echo "Ce véhicule n'applique des migrations que sur nexus-test. Arrêt." >&2
    exit 5 ;;
esac

case "$URL" in
  *"db.$REF_ATTENDUE.supabase.co"*) : ;;
  *)
    echo "REFUS : CIBLE_INATTENDUE — l'URL ne désigne pas db.$REF_ATTENDUE.supabase.co." >&2
    echo "Une cible se mesure, elle ne se compose pas." >&2
    exit 5 ;;
esac

case "$URL" in
  *nexus_ci_recette*)
    echo "REFUS : CIBLE_INATTENDUE — l'URL authentifie nexus_ci_recette." >&2
    echo "Ce rôle n'est ni propriétaire ni superutilisateur : il ne peut pas créer les" >&2
    echo "fonctions, triggers et politiques que ces 12 migrations créent. Il faut une" >&2
    echo "connexion postgres." >&2
    exit 5 ;;
esac

filtre() { sed -E 's#postgres[^:]*:[^@]*@#postgres:***@#g'; }

# ── La mesure de la cible, cinq colonnes, mises en mots ───────────────────
REQUETE_MESURE="select current_database(), current_user, \
case when current_setting('transaction_read_only') = 'on' then 'LECTURE_SEULE' else 'ECRITURE_POSSIBLE' end, \
case when pg_is_in_recovery() then 'REPLICA' else 'PRIMAIRE' end, \
coalesce((select case when rolsuper then 'SUPERUSER_OUI' else 'SUPERUSER_NON' end \
          from pg_roles where rolname = current_user), 'ROLE_INCONNU');"

MESURE="$("$PSQL" "$URL" -At -F'|' --quiet --no-psqlrc -c "$REQUETE_MESURE" 2>&1 | filtre)" || {
  echo "REFUS : CONNEXION_IMPOSSIBLE — la cible est bien nexus-test, mais psql n'a rien mesuré." >&2
  echo "Rappel de transport : db.$REF_ATTENDUE.supabase.co est joignable en IPv6 seulement" >&2
  echo "et peut expirer ; si ce véhicule tourne sur un runner GitHub Actions sans IPv6," >&2
  echo "utiliser le pooler IPv4 via le secret dédié, pas cette URL directe." >&2
  exit 6
}

IFS='|' read -r BASE IDENTITE LECTURE_SEULE RECUPERATION SUPERUSER <<<"$MESURE"
if [ -z "$BASE" ] || [ -z "$IDENTITE" ] || [ -z "$LECTURE_SEULE" ] || [ -z "$RECUPERATION" ] || [ -z "$SUPERUSER" ]; then
  echo "REFUS : CONNEXION_IMPOSSIBLE — la mesure n'a pas rendu ses cinq colonnes." >&2
  printf '%s\n' "$MESURE" >&2
  exit 6
fi

echo "Mesure — base : $BASE | identité : $IDENTITE | $LECTURE_SEULE | $RECUPERATION | $SUPERUSER"

if [ "$BASE" != "postgres" ]; then
  echo "REFUS : PREFLIGHT_REFUS — la base atteinte est « $BASE », pas « postgres »." >&2
  exit 7
fi
if [ "$LECTURE_SEULE" != "ECRITURE_POSSIBLE" ]; then
  echo "REFUS : PREFLIGHT_REFUS — la connexion est en lecture seule." >&2
  exit 7
fi
if [ "$RECUPERATION" != "PRIMAIRE" ]; then
  echo "REFUS : PREFLIGHT_REFUS — la cible est un réplica." >&2
  exit 7
fi
if [ "$SUPERUSER" != "SUPERUSER_OUI" ] && [ "$IDENTITE" != "postgres" ]; then
  echo "REFUS : PREFLIGHT_REFUS — $IDENTITE n'est ni superutilisateur ni « postgres »." >&2
  echo "Ces 12 migrations créent des fonctions, triggers et politiques RLS : il faut" >&2
  echo "la propriété complète du schéma public, pas un rôle borné." >&2
  exit 7
fi

# ── État des 12 versions avant toute écriture ─────────────────────────────
mesurer_versions() {
  local liste; liste="$(printf "'%s'," "${VERSIONS[@]}")"; liste="${liste%,}"
  set +e
  PRESENTES="$("$PSQL" "$URL" -At --quiet --no-psqlrc -c \
    "select coalesce(string_agg(version, ',' order by version), '') from supabase_migrations.schema_migrations where version in ($liste);" 2>&1 | filtre)"
  set -e
}

mesurer_versions
echo "Versions des 12 déjà présentes dans schema_migrations avant ce geste : ${PRESENTES:-"(aucune)"}"

if [ "$APPLIQUER" != "1" ]; then
  echo "PREFLIGHT_CONFORME — base $BASE, identité $IDENTITE, écriture possible, non-réplica."
  echo "Aucune écriture effectuée. Relancez avec --appliquer pour appliquer les 12 migrations."
  exit 0
fi

if [ -n "$PRESENTES" ]; then
  echo "REFUS : ETAT_DEJA_PARTIEL — ${PRESENTES} déjà présente(s)." >&2
  echo "Ces migrations ne portent pas de garde IF NOT EXISTS systématique : les" >&2
  echo "réappliquer sur un état partiel romprait, plutôt que de le réparer. Ce" >&2
  echo "véhicule refuse plutôt que de deviner ce qui peut être rejoué sans risque." >&2
  exit 8
fi

# ── Application : un seul fichier généré, une seule transaction ──────────
TMP_SQL="$(mktemp "${TMPDIR:-/tmp}/fdj-vague1-candidat-62.XXXXXX.sql")"
trap 'rm -f "$TMP_SQL"' EXIT
{
  echo "\\set ON_ERROR_STOP on"
  echo "begin;"
  for f in "${FICHIERS[@]}"; do
    printf '\\i %s\n' "$f"
  done
  echo "commit;"
} > "$TMP_SQL"

echo "Application des 12 migrations FDJ (candidat 9ffee7e) sur $BASE ($REF_ATTENDUE), en tant que ${IDENTITE}, transaction unique…"
set +e
SORTIE="$("$PSQL" "$URL" -v ON_ERROR_STOP=1 --quiet --no-psqlrc --pset=pager=off -f "$TMP_SQL" 2>&1 | filtre)"
CODE_PSQL=$?
set -e
printf '%s\n' "$SORTIE"
echo "(code de sortie psql : $CODE_PSQL)"

if [ "$CODE_PSQL" != "0" ]; then
  echo "VEHICULE_ETAT_FINAL: MIGRATIONS_NON_APPLIQUEES — psql s'est arrêté en cours de route." >&2
  echo "Aucun rollback inventé : la transaction, restée ouverte à l'échec, est défaite" >&2
  echo "automatiquement par PostgreSQL à la fermeture de la connexion. Relire la sortie" >&2
  echo "ci-dessus pour la migration exacte et le message d'erreur exacts, puis STOP —" >&2
  echo "conformément à decision-2.md : ne pas rejouer sans arbitrage sur la cause." >&2
  mesurer_versions
  echo "Versions des 12 présentes après cet échec : ${PRESENTES:-"(aucune — rollback confirmé)"}" >&2
  exit 30
fi

# ── Le verdict : une mesure après coup, jamais l'écho de psql ─────────────
mesurer_versions
if [ -z "$PRESENTES" ]; then
  echo "VEHICULE_ETAT_FINAL: ETAT_FINAL_ABSENT_OU_IMPREVU — psql a rendu 0, mais" >&2
  echo "schema_migrations ne porte aucune des 12 versions. Ce n'est JAMAIS un succès." >&2
  exit 33
fi

NB_PRESENTES="$(printf '%s' "$PRESENTES" | tr ',' '\n' | grep -c .)"
if [ "$NB_PRESENTES" != "12" ]; then
  echo "VEHICULE_ETAT_FINAL: MIGRATIONS_INCOMPLETES — $NB_PRESENTES/12 versions présentes : $PRESENTES" >&2
  exit 31
fi

echo "VEHICULE_ETAT_FINAL: MIGRATIONS_APPLIQUEES — les 12 versions sont présentes dans schema_migrations : $PRESENTES"
echo "Divergence Test/rail à consigner (condition 4 de decision-2.md) : nexus-test porte" >&2
echo "désormais 12 migrations FDJ absentes de handoff-continuite-20260920, jusqu'à ce que" >&2
echo "le lot atteigne le rail." >&2
echo "Suite : exécuter la recette FDJ Cas 1 à 5 (request-1.md, §6) sur l'alias" >&2
echo "https://rebuild-fdj-62-20260922.nexus-test-ddf.pages.dev/ — hors du périmètre de" >&2
echo "ce véhicule (navigateur requis, pas psql)." >&2
exit 0
