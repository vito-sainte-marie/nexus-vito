#!/usr/bin/env bash
# APPLIQUER 20261003190000 — l'écriture bornée du rôle CI sur station_config,
# avec la lecture que `excluded.*` exige et l'exécution que les contraintes
# CHECK exigent (rejoue et complète 20261003170000 puis 20261003180000) —
# SUR nexus-test, ET SUR RIEN D'AUTRE.
#
# À EXÉCUTER PAR FRÉDÉRIC SUR nexus-test. Ce geste exige une connexion
# `postgres` à la base Test : la migration ne contient que des `grant` et des
# `create policy` sur `public.station_config`, table dont le propriétaire est
# `postgres`. Le 03/10/2026, le classifieur de Claude a refusé l'exécution de
# cette application, refus daté et non contourné ; et la mesure a montré
# qu'aucun maillon automatique ne pourrait la jouer à sa place (voir §2).
#
# POURQUOI UN VÉHICULE, ET PAS UNE LIGNE DE psql À LA MAIN
#
# Le 01/10/2026, la procédure Production prescrivait un geste à la main et
# nommait une variable qui n'existait nulle part. `psql` a reçu une chaîne vide
# — ce qui ne lève AUCUNE erreur de variable manquante — s'est rabattu sur ses
# paramètres par défaut, et a rendu un message qui ne nommait ni la cause ni la
# cible visée. La correction est devenue le standard NEXUS : un véhicule
# mesure sa cible avant d'écrire, et refuse plutôt que de supposer.
#
# Ce fichier rejoue la forme de
# `outils/appliquer-migration-login-production-a-executer-par-frederic.sh`,
# propriété par propriété, sans inventer un second mécanisme. Il en diffère sur
# cinq points, tous imposés par la mesure :
#
#  §1 LA CIBLE EST TEST, ET PRODUCTION EST REFUSÉE NOMMÉMENT. `REF_ATTENDUE`
#     vaut la référence de `nexus-test`. Une URL qui nomme la référence
#     Production est refusée AVANT toute connexion, par son nom, avec un
#     message qui le dit — ce véhicule n'a aucune raison de pouvoir se tromper
#     de base.
#
#  §2 UNE IDENTITÉ `nexus_ci_recette` EST REFUSÉE AVANT CONNEXION. Le dépôt
#     porte un secret nommé `SUPABASE_TEST_DB_URL_WRITE` : il écrit des
#     LIGNES, en tant que `nexus_ci_recette`. Il ne peut pas écrire des
#     DROITS — `rolsuper = f`, non propriétaire de `public.station_config`, et
#     un rôle ne peut pas se GRANT ce qu'il ne détient pas. Un secret nommé
#     « WRITE » est nommé pour sa direction, pas pour sa puissance. Ce
#     véhicule refuse donc cette identité par son nom, pour que personne ne
#     redésigne ce maillon-là.
#
#  §3 LE PRÉFLIGHT SONDE LA PROPRIÉTÉ DE LA TABLE, PAS `CREATE` SUR LE SCHÉMA.
#     Le véhicule Production vérifie `has_schema_privilege(…,'public','CREATE')`
#     parce que son artefact crée une fonction. Ici, chaque instruction est un
#     `grant` ou un `create policy` sur une table existante : le droit
#     réellement nécessaire est d'en être propriétaire (ou superutilisateur).
#     Copier le contrôle du précédent aurait rendu un vert pour la mauvaise
#     raison.
#
#  §4 LE VERDICT EST UNE MESURE DE L'ÉTAT, PAS LA LECTURE D'UN ÉCHO. Le
#     véhicule Production lit la dernière ligne `ETAT_FINAL …` que son artefact
#     écrit lui-même, et il a raison : son artefact en écrit une. Le mien n'en
#     écrit pas — c'est un unique bloc `do $$ … $$;`. Je ne transporte donc PAS
#     son omission délibérée de `-v ON_ERROR_STOP=1` : avec un bloc unique, la
#     première erreur DOIT arrêter. Et surtout, le verdict de ce véhicule ne
#     vient ni du code de sortie de `psql` ni d'un marqueur de texte : il vient
#     d'une SECONDE MESURE de l'état réel des droits et des politiques, prise
#     après le `commit`, et comparée aux bornes attendues.
#
#  §5 IL REFUSE LE POOLER PAR NOM D'HÔTE. `*pooler.supabase.com*` est refusé
#     avant même le contrôle de référence, et la base visée doit être
#     `postgres`. Le standard NEXUS exige ce refus ; le véhicule Production ne
#     le porte pas encore nommément, et c'est une dette tracée, pas un modèle
#     à recopier.
#
# SANS `--appliquer`, IL MESURE ET S'ARRÊTE. Aucune écriture n'est possible
# sans cette option explicite. En mode mesure seule il rapporte en plus
# l'ÉTAT DES BORNES courant : c'est ce qui permet de savoir si la migration est
# déjà appliquée sans rien tenter.
#
# LE SECRET NE SORT PAS. Rien n'affiche `$URL`, `$PGPASSWORD` ni le contenu du
# trousseau ; toute sortie de `psql` est filtrée, stderr comprise — c'est
# précisément dans ses messages d'erreur que psql réimprime l'URL.
#
# AUCUNE PRODUCTION. Ce véhicule ne lit aucune variable Production, ne consulte
# aucun secret Production, et refuse la référence Production par son nom.
#
# CODES DE SORTIE
#   0  préflight conforme (mesure seule), ou migration appliquée ET bornes
#      vérifiées conformes ET estampille enregistrée
#   1  USAGE
#   2  PSQL_INTROUVABLE
#   3  SECRET_ABSENT
#   4  ARTEFACT_INTROUVABLE
#   5  CIBLE_INATTENDUE            (refusé AVANT toute connexion)
#   6  CONNEXION_IMPOSSIBLE
#   7  PREFLIGHT_REFUS
#  30  ECRITURE_BORNEE_NON_APPLIQUEE   — rien n'a été accordé
#  31  ECRITURE_BORNEE_INCOMPLETE      — une partie seulement
#  32  ECRITURE_BORNEE_DEBORDANTE      — ce qui a été accordé DÉPASSE les bornes
#  33  ETAT_FINAL_ABSENT_OU_IMPREVU    — JAMAIS un succès
#  34  ECRITURE_BORNEE_SANS_ESTAMPILLE — bornes justes, traçabilité manquante
#
# AUTORISATION HUMAINE, verbatim, 03/10/2026 — Frédéric Bragance :
# « Frédéric autorise une capacité d'écriture TEST strictement minimale
#   permettant à l'épreuve request-20 d'exécuter ses deux cas synthétiques sur
#   public.station_config. » Bornée aux deux identifiants synthétiques
#   `nexus-test-repro-23502-neuf` / `nexus-test-repro-23502-existant`, sans
#   aucun droit sur `nexus-station-test` ni sur un site réel, sans élargissement
#   général de `nexus_ci_recette`, traçable par migration.

set -euo pipefail

# 20261003180000 rejoue toute la borne de 20261003170000 et y ajoute
# `select (horaires, updated_at)` : un `on conflict … do update set
# col = excluded.col` LIT `col`, et le run Tests 37143142272 (tentative 2) a
# rendu 42501 tant que ces deux colonnes manquaient. Le véhicule vise donc la
# migration la plus récente ; 20261003170000, déjà estampillée, n'est pas
# rejouée sous son propre numéro.
#
# 20261003190000 rejoue à son tour 20261003180000 et y ajoute `grant execute`
# sur `public.planning_mappage_est_valide(jsonb)` : deux contraintes CHECK de
# station_config l'appellent avec les droits de l'ÉCRIVAIN, et le run Tests
# 37144179897 a rendu `42501 permission denied for function
# planning_mappage_est_valide` tant que ce droit manquait. Même règle : le
# véhicule vise la plus récente, et le verdict mesure ce droit (8e colonne).
ARTEFACT="supabase/migrations/20261003190000_execute_mappage_station_config_recette_23502.sql"
VERSION="20261003190000"
NOM_MIGRATION="execute_mappage_station_config_recette_23502"

REF_ATTENDUE="udljdqxerrbbbajxubfn"   # nexus-test, et uniquement nexus-test.
REF_PRODUCTION="uzhjpqpctpvxytxpxoqz" # nommée ICI pour être refusée, jamais visée.

# Les bornes attendues après application — colonnes triées, comme la mesure les
# rend. Ce sont les constantes qui font du verdict une comparaison et non une
# impression.
INSERT_ATTENDU="fuseau_horaire,horaires,prix_carburants,site,updated_at"
UPDATE_ATTENDU="horaires,prix_carburants,updated_at"
SELECT_ATTENDU="carburant_commande_config,cuves_carburants,fuseau_horaire,horaires,prix_carburants,site,updated_at"
POLITIQUES_ATTENDUES="7"   # 4 préexistantes + 3 de cette migration.
MIENNES_ATTENDUES="3"

APPLIQUER=0
for arg in "$@"; do
  case "$arg" in
    --appliquer) APPLIQUER=1 ;;
    *) echo "Usage : $0 [--appliquer]" >&2
       echo "  sans --appliquer : mesure la cible et l'état des bornes, n'écrit rien." >&2
       exit 1 ;;
  esac
done

PSQL="$(command -v psql || true)"
[ -n "$PSQL" ] || PSQL=/opt/homebrew/opt/libpq/bin/psql
if [ ! -x "$PSQL" ]; then
  echo "REFUS : psql introuvable (ni dans PATH, ni au repli /opt/homebrew/opt/libpq/bin/psql)." >&2
  exit 2
fi

if [ "$APPLIQUER" = "1" ] && [ ! -f "$ARTEFACT" ]; then
  echo "REFUS : ARTEFACT_INTROUVABLE — $ARTEFACT absent depuis $(pwd)." >&2
  echo "Ce véhicule ne réécrit jamais l'artefact : il le joue tel qu'il est versionné." >&2
  exit 4
fi

# ── Le secret : variable d'environnement, puis trousseau. Jamais affiché. ──
# L'entrée de trousseau peut porter soit une URL complète, soit un simple mot
# de passe — les deux formes ont été réellement constatées sur ce poste, et la
# documentation n'en décrit qu'une. On accepte les deux plutôt que de postuler.
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
  echo "Aucune autre variable n'est consultée. En particulier :" >&2
  echo "  - \$URL_PRODUCTION n'est JAMAIS lu — c'est la variable qui a piégé le 01/10/2026 ;" >&2
  echo "  - \$SUPABASE_TEST_DB_URL_WRITE n'est JAMAIS lu — il authentifie nexus_ci_recette," >&2
  echo "    qui ne peut pas s'accorder des droits sur une table dont postgres est propriétaire." >&2
  exit 3
fi

# ── Refus AVANT toute connexion. Trois, par nom. ──────────────────────────
# §5 — le pooler d'abord : il ne nomme jamais le projet, donc le contrôle de
# référence le refuserait déjà, mais avec un message qui ne dirait pas pourquoi.
case "$URL" in
  *pooler.supabase.com*)
    echo "REFUS : CIBLE_INATTENDUE — l'URL désigne le pooler Supabase." >&2
    echo "Le standard NEXUS exige qu'un véhicule refuse *pooler.supabase.com* par nom d'hôte :" >&2
    echo "l'hôte direct db.<ref>.supabase.co est la seule cible admise ici." >&2
    exit 5 ;;
esac

case "$URL" in
  *"$REF_PRODUCTION"*)
    echo "REFUS : CIBLE_INATTENDUE — l'URL nomme la référence PRODUCTION." >&2
    echo "Ce véhicule n'applique une migration que sur nexus-test. Arrêt." >&2
    exit 5 ;;
esac

case "$URL" in
  *"db.$REF_ATTENDUE.supabase.co"*) : ;;
  *)
    echo "REFUS : CIBLE_INATTENDUE — l'URL ne désigne pas db.$REF_ATTENDUE.supabase.co." >&2
    echo "Une cible se mesure, elle ne se compose pas : toute URL qui ne nomme pas" >&2
    echo "explicitement l'hôte direct du projet attendu est refusée ici." >&2
    exit 5 ;;
esac

# §2 — l'identité du secret CI, refusée par son nom.
case "$URL" in
  *nexus_ci_recette*)
    echo "REFUS : CIBLE_INATTENDUE — l'URL authentifie nexus_ci_recette." >&2
    echo "Ce rôle n'est pas propriétaire de public.station_config et n'est pas" >&2
    echo "superutilisateur : il ne peut pas s'accorder les droits que cette migration" >&2
    echo "accorde. Un secret nommé « WRITE » est nommé pour sa direction, pas pour sa" >&2
    echo "puissance. Il faut une connexion postgres." >&2
    exit 5 ;;
esac

filtre() { sed -E 's#postgres[^:]*:[^@]*@#postgres:***@#g'; }

# ── La mesure de la cible, six colonnes, mises en mots ────────────────────
# Chaque colonne est rendue en MOTS plutôt que castée, pour ne dépendre
# d'aucune convention de représentation booléenne de PostgreSQL.
REQUETE_MESURE="select current_database(), current_user, \
case when current_setting('transaction_read_only') = 'on' then 'LECTURE_SEULE' else 'ECRITURE_POSSIBLE' end, \
case when pg_is_in_recovery() then 'REPLICA' else 'PRIMAIRE' end, \
coalesce((select case when pg_get_userbyid(c.relowner) = current_user \
                        or (select rolsuper from pg_roles where rolname = current_user) \
                      then 'PROPRIETAIRE_OUI' else 'PROPRIETAIRE_NON' end \
          from pg_class c join pg_namespace n on n.oid = c.relnamespace \
          where n.nspname = 'public' and c.relname = 'station_config'), 'TABLE_ABSENTE'), \
coalesce((select 'ROLE_PRESENT' from pg_roles where rolname = 'nexus_ci_recette'), 'ROLE_ABSENT');"

MESURE="$("$PSQL" "$URL" -At -F'|' --quiet --no-psqlrc -c "$REQUETE_MESURE" 2>&1 | filtre)" || {
  echo "REFUS : CONNEXION_IMPOSSIBLE — la cible est bien nexus-test, mais psql n'a rien mesuré." >&2
  echo "Rappel de transport : db.$REF_ATTENDUE.supabase.co est joignable en IPv6" >&2
  echo "seulement et peut expirer ; l'URL composée ici porte connect_timeout=12." >&2
  exit 6
}

IFS='|' read -r BASE IDENTITE LECTURE_SEULE RECUPERATION PROPRIETE ROLE_CI <<<"$MESURE"
if [ -z "$BASE" ] || [ -z "$IDENTITE" ] || [ -z "$LECTURE_SEULE" ] || [ -z "$RECUPERATION" ] \
   || [ -z "$PROPRIETE" ] || [ -z "$ROLE_CI" ]; then
  echo "REFUS : CONNEXION_IMPOSSIBLE — la mesure n'a pas rendu ses six colonnes." >&2
  printf '%s\n' "$MESURE" >&2
  exit 6
fi

echo "Mesure — base : $BASE | identité : $IDENTITE | $LECTURE_SEULE | $RECUPERATION | $PROPRIETE | $ROLE_CI"

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
if [ "$PROPRIETE" = "TABLE_ABSENTE" ]; then
  echo "REFUS : PREFLIGHT_REFUS — public.station_config n'existe pas sur cette base." >&2
  echo "Ce n'est pas nexus-test, ou ce n'est pas la base attendue. Arrêt." >&2
  exit 7
fi
if [ "$PROPRIETE" != "PROPRIETAIRE_OUI" ]; then
  echo "REFUS : PREFLIGHT_REFUS — $IDENTITE n'est ni propriétaire de" >&2
  echo "public.station_config ni superutilisateur. Chaque instruction de cette" >&2
  echo "migration est un grant ou un create policy : ils exigent la propriété." >&2
  echo "Un rôle ne peut pas s'accorder ce qu'il ne détient pas." >&2
  exit 7
fi
if [ "$ROLE_CI" != "ROLE_PRESENT" ]; then
  echo "REFUS : PREFLIGHT_REFUS — le rôle nexus_ci_recette est absent de cette base." >&2
  echo "La migration s'y ignorerait d'elle-même : l'appliquer ici n'aurait aucun sens," >&2
  echo "et appeler cela un succès serait un vert pour la mauvaise raison." >&2
  exit 7
fi

# ── L'état des bornes : huit colonnes, la seule source du verdict ─────────
# La 7e mesure l'EXECUTE de la fonction appelée par les CHECK. `to_regprocedure`
# d'abord : sur une base où la fonction n'existe pas, `has_function_privilege`
# lèverait une erreur et rendrait toute la mesure illisible.
REQUETE_BORNES="select \
case when has_table_privilege('nexus_ci_recette','public.station_config','select') \
       or has_table_privilege('nexus_ci_recette','public.station_config','insert') \
       or has_table_privilege('nexus_ci_recette','public.station_config','update') \
       or has_table_privilege('nexus_ci_recette','public.station_config','delete') \
       or has_table_privilege('nexus_ci_recette','public.station_config','truncate') \
     then 'DROIT_DE_TABLE_PRESENT' else 'AUCUN_DROIT_DE_TABLE' end, \
coalesce((select string_agg(a.attname, ',' order by a.attname) from pg_attribute a, aclexplode(a.attacl) x \
  where a.attrelid = 'public.station_config'::regclass and x.grantee = 'nexus_ci_recette'::regrole \
    and x.privilege_type = 'INSERT'), '-'), \
coalesce((select string_agg(a.attname, ',' order by a.attname) from pg_attribute a, aclexplode(a.attacl) x \
  where a.attrelid = 'public.station_config'::regclass and x.grantee = 'nexus_ci_recette'::regrole \
    and x.privilege_type = 'UPDATE'), '-'), \
coalesce((select string_agg(a.attname, ',' order by a.attname) from pg_attribute a, aclexplode(a.attacl) x \
  where a.attrelid = 'public.station_config'::regclass and x.grantee = 'nexus_ci_recette'::regrole \
    and x.privilege_type = 'SELECT'), '-'), \
(select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'station_config'), \
(select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'station_config' \
   and policyname in ('ecriture_recette_23502_insert','ecriture_recette_23502_update','lecture_recette_23502_select')), \
case when to_regprocedure('public.planning_mappage_est_valide(jsonb)') is null then 'FONCTION_MAPPAGE_ABSENTE' \
     when has_function_privilege('nexus_ci_recette','public.planning_mappage_est_valide(jsonb)','execute') \
     then 'EXECUTE_MAPPAGE_PRESENT' else 'EXECUTE_MAPPAGE_ABSENT' end, \
case when to_regclass('supabase_migrations.schema_migrations') is null then 'REGISTRE_ABSENT' \
     when exists (select 1 from supabase_migrations.schema_migrations where version = '$VERSION') \
     then 'ESTAMPILLE_PRESENTE' else 'ESTAMPILLE_ABSENTE' end;"

# `deborde LISTE ATTENDUE` → vrai si LISTE contient un élément hors de ATTENDUE.
# C'est le contrôle qui distingue « il manque quelque chose » de « on a accordé
# plus que les bornes » : les deux sont rouges, mais pas du même rouge.
deborde() {
  local liste="$1" attendue="$2" element
  [ "$liste" = "-" ] && return 1
  for element in $(printf '%s\n' "$liste" | tr ',' ' '); do
    case ",$attendue," in
      *",$element,"*) : ;;
      *) return 0 ;;
    esac
  done
  return 1
}

# Rend le verdict dans $VERDICT à partir des huit colonnes mesurées.
juger_bornes() {
  local t="$1" ins="$2" upd="$3" sel="$4" pol="$5" miennes="$6" exe="$7" est="$8"

  if [ "$t" != "AUCUN_DROIT_DE_TABLE" ]; then
    VERDICT="ECRITURE_BORNEE_DEBORDANTE"
    MOTIF="un droit de TABLE est présent : la borne est le niveau colonne, jamais la table"
    return
  fi
  if deborde "$ins" "$INSERT_ATTENDU" || deborde "$upd" "$UPDATE_ATTENDU" \
     || deborde "$sel" "$SELECT_ATTENDU"; then
    VERDICT="ECRITURE_BORNEE_DEBORDANTE"
    MOTIF="une colonne accordée est hors des bornes attendues"
    return
  fi
  if [ "$pol" -gt "$POLITIQUES_ATTENDUES" ] 2>/dev/null; then
    VERDICT="ECRITURE_BORNEE_DEBORDANTE"
    MOTIF="$pol politiques sur station_config, $POLITIQUES_ATTENDUES attendues"
    return
  fi
  if [ "$ins" = "-" ] && [ "$upd" = "-" ] && [ "$miennes" = "0" ]; then
    VERDICT="ECRITURE_BORNEE_NON_APPLIQUEE"
    MOTIF="aucun droit d'écriture, aucune politique de recette : rien n'a été accordé"
    return
  fi
  if [ "$ins" = "$INSERT_ATTENDU" ] && [ "$upd" = "$UPDATE_ATTENDU" ] \
     && [ "$sel" = "$SELECT_ATTENDU" ] && [ "$pol" = "$POLITIQUES_ATTENDUES" ] \
     && [ "$miennes" = "$MIENNES_ATTENDUES" ] && [ "$exe" = "EXECUTE_MAPPAGE_PRESENT" ]; then
    if [ "$est" = "ESTAMPILLE_PRESENTE" ]; then
      VERDICT="ECRITURE_BORNEE_APPLIQUEE"
      MOTIF="bornes exactes sur les deux axes, estampille enregistrée"
    else
      VERDICT="ECRITURE_BORNEE_SANS_ESTAMPILLE"
      MOTIF="bornes exactes, mais la traçabilité manque ($est)"
    fi
    return
  fi
  VERDICT="ECRITURE_BORNEE_INCOMPLETE"
  MOTIF="insert=[$ins] update=[$upd] select=[$sel] politiques=$pol miennes=$miennes execute=[$exe]"
}

mesurer_bornes() {
  # Sous `set -e`, une affectation dont le membre droit est une substitution de
  # commande qui échoue termine le script immédiatement (pipefail compris),
  # AVANT que la ligne suivante puisse décider quoi que ce soit. D'où la
  # fenêtre `set +e` : ici, un échec de mesure doit être JUGÉ, pas fatal.
  set +e
  BORNES="$("$PSQL" "$URL" -At -F'|' --quiet --no-psqlrc -c "$REQUETE_BORNES" 2>&1 | filtre)"
  set -e
  IFS='|' read -r B_TABLE B_INS B_UPD B_SEL B_POL B_MIENNES B_EXEC B_EST <<<"$BORNES"
  if [ -z "${B_TABLE:-}" ] || [ -z "${B_EST:-}" ] || [ -z "${B_MIENNES:-}" ] || [ -z "${B_EXEC:-}" ]; then
    VERDICT="ETAT_FINAL_ABSENT_OU_IMPREVU"
    MOTIF="la mesure des bornes n'a pas rendu ses huit colonnes"
    return 1
  fi
  juger_bornes "$B_TABLE" "$B_INS" "$B_UPD" "$B_SEL" "$B_POL" "$B_MIENNES" "$B_EXEC" "$B_EST"
  return 0
}

# ── Mode mesure seule ─────────────────────────────────────────────────────
if [ "$APPLIQUER" != "1" ]; then
  if mesurer_bornes; then
    echo "ETAT_DES_BORNES: $VERDICT — $MOTIF"
    if [ "$VERDICT" = "ECRITURE_BORNEE_APPLIQUEE" ]; then
      echo "La migration est DÉJÀ appliquée et conforme : --appliquer serait sans effet."
    fi
  else
    echo "ETAT_DES_BORNES: ILLISIBLE — $MOTIF" >&2
    printf '%s\n' "${BORNES:-}" >&2
  fi
  echo "PREFLIGHT_CONFORME — base $BASE, identité $IDENTITE, écriture possible, non-réplica, propriétaire de station_config."
  echo "Aucune écriture effectuée. Relancez avec --appliquer pour appliquer la migration."
  exit 0
fi

# ── Application ───────────────────────────────────────────────────────────
# `-v ON_ERROR_STOP=1`, et c'est un écart ASSUMÉ avec le véhicule Production.
# Celui-ci l'omet délibérément parce que son artefact est une épreuve en
# plusieurs parties dont certaines doivent échouer, et parce qu'il décide sur la
# ligne ETAT_FINAL que l'artefact écrit lui-même. Le mien est un unique bloc
# `do $$ … $$;` : la première erreur doit arrêter, et le verdict ne vient de
# toute façon pas d'ici — il vient de la mesure qui suit le commit.
echo "Application de $ARTEFACT sur $BASE ($REF_ATTENDUE), en tant que ${IDENTITE}…"
set +e
SORTIE="$("$PSQL" "$URL" -v ON_ERROR_STOP=1 --quiet --no-psqlrc --pset=pager=off -f "$ARTEFACT" 2>&1 | filtre)"
CODE_PSQL=$?
set -e
printf '%s\n' "$SORTIE"
echo "(code de sortie psql : $CODE_PSQL — il n'est PAS le verdict, voir §4)"

# ── Estampille — composée APRÈS avoir mesuré les colonnes du registre ─────
# Le registre de Test n'a pas partout le même schéma : on lit ses colonnes
# plutôt que de postuler la forme de l'insert.
set +e
COLONNES_REGISTRE="$("$PSQL" "$URL" -At --quiet --no-psqlrc -c \
  "select coalesce(string_agg(column_name, ',' order by column_name), '') from information_schema.columns where table_schema = 'supabase_migrations' and table_name = 'schema_migrations';" 2>&1 | filtre)"
set -e
case ",${COLONNES_REGISTRE}," in
  *",name,"*)
    case ",${COLONNES_REGISTRE}," in
      *",statements,"*)
        REQUETE_ESTAMPILLE="insert into supabase_migrations.schema_migrations (version, name, statements) values ('$VERSION', '$NOM_MIGRATION', array[]::text[]) on conflict (version) do nothing;" ;;
      *)
        REQUETE_ESTAMPILLE="insert into supabase_migrations.schema_migrations (version, name) values ('$VERSION', '$NOM_MIGRATION') on conflict (version) do nothing;" ;;
    esac ;;
  *)
    REQUETE_ESTAMPILLE="insert into supabase_migrations.schema_migrations (version) values ('$VERSION') on conflict (version) do nothing;" ;;
esac
set +e
"$PSQL" "$URL" --quiet --no-psqlrc -c "$REQUETE_ESTAMPILLE" 2>&1 | filtre
set -e

# ── Le verdict : une mesure, jamais un écho ───────────────────────────────
if ! mesurer_bornes; then
  echo "VEHICULE_ETAT_FINAL: $VERDICT — $MOTIF" >&2
  echo "Ce n'est JAMAIS un succès, même si psql est sorti avec le code 0 :" >&2
  echo "relire la sortie ci-dessus avant de rejouer quoi que ce soit." >&2
  exit 33
fi

echo "Bornes mesurées — table : $B_TABLE | insert : $B_INS | update : $B_UPD | select : $B_SEL | politiques : $B_POL (dont $B_MIENNES de recette) | $B_EXEC | $B_EST"

case "$VERDICT" in
  ECRITURE_BORNEE_APPLIQUEE)
    echo "VEHICULE_ETAT_FINAL: $VERDICT — $MOTIF"
    echo "L'épreuve request-20 peut maintenant être rejouée dans la CI, sous nexus_ci_recette."
    exit 0 ;;
  ECRITURE_BORNEE_NON_APPLIQUEE)
    echo "VEHICULE_ETAT_FINAL: $VERDICT — $MOTIF" >&2 ; exit 30 ;;
  ECRITURE_BORNEE_INCOMPLETE)
    echo "VEHICULE_ETAT_FINAL: $VERDICT — $MOTIF" >&2 ; exit 31 ;;
  ECRITURE_BORNEE_DEBORDANTE)
    echo "VEHICULE_ETAT_FINAL: $VERDICT — $MOTIF" >&2
    echo "C'est le rouge le plus grave : l'écriture a dépassé l'autorisation humaine." >&2
    exit 32 ;;
  ECRITURE_BORNEE_SANS_ESTAMPILLE)
    echo "VEHICULE_ETAT_FINAL: $VERDICT — $MOTIF" >&2
    echo "Les droits sont justes, mais l'autorisation exige que ce soit traçable." >&2
    exit 34 ;;
  *)
    echo "VEHICULE_ETAT_FINAL: ETAT_FINAL_ABSENT_OU_IMPREVU — verdict « $VERDICT » non reconnu." >&2
    exit 33 ;;
esac
