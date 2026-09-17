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
# CE QU'IL CONSERVE, ET POURQUOI
#
# Une exécution qui ne laisse aucune trace ne se prouve pas. L'absence de
# migration Phase A sur `nexus-test` établit qu'aucune écriture n'a
# survécu — elle n'établit pas qu'une recette a tourné : une recette
# jamais lancée laisserait exactement le même état. Affirmer le contraire,
# c'est affirmer le conséquent.
#
# Le script écrit donc, à chaque exécution, un fichier de preuve daté sous
# `supabase/phase-c/preuves/`, qui porte : la date UTC, le commit testé,
# l'état du dépôt au lancement, la cible, les empreintes SHA-256 et les
# blobs git des trois fichiers joués, la commande expurgée, le diff exact,
# la sortie complète expurgée, le code de retour et la dernière
# instruction de la transaction. Trois choses distinctes y sont dites
# séparément : que la recette a été EXÉCUTÉE, qu'elle s'est terminée par
# un ROLLBACK, et qu'elle n'a laissé AUCUN effet durable.
#
# Avant d'écrire, le fichier est relu et refusé s'il contient le secret du
# trousseau ; le contrôle se fait en bash, sans jamais passer le mot de
# passe en argument d'une commande — `ps` le verrait.
#
#   PREUVE=non  supabase/phase-c/recette-test.sh   # n'écrit aucune preuve
#   PREUVE=/chemin/fichier.md                      # écrit là
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

SCRIPT="$ICI/recette-test.sh"

AVEC_MUTATIONS=1
[ "${1:-}" = "--sans-mutations" ] && AVEC_MUTATIONS=0

# --- Contexte, mesuré AVANT toute écriture ----------------------------
# L'état du dépôt est relevé maintenant : la preuve elle-même est écrite
# à la fin, et la mesurer après se salirait toute seule.
DATE_UTC=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
HORODATAGE=$(date -u '+%Y%m%dT%H%M%SZ')
COMMIT=$(git -C "$ICI" rev-parse HEAD)
BRANCHE=$(git -C "$ICI" rev-parse --abbrev-ref HEAD)
RACINE=$(git -C "$ICI" rev-parse --show-toplevel)
PORCELAIN=$(git -C "$ICI" status --porcelain)
if [ -z "$PORCELAIN" ]; then ETAT_DEPOT="propre"; else ETAT_DEPOT="SALE"; fi

# Empreinte du contenu, et blob git du même fichier à HEAD : la première
# décrit ce qui a été joué, le second rattache ce contenu au commit. Deux
# blobs identiques entre deux commits, c'est le même octet pour octet.
empreinte()   { shasum -a 256 "$1" | cut -d' ' -f1; }
blob_a_head() { git -C "$ICI" ls-tree HEAD -- "$(basename "$1")" | awk '{print $3}'; }

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

DIFF_TEXTE=$(diff "$CORPS" "$TRAVAIL/corps.sql" || true)
echo "--- diff entre le fichier du dépôt et ce qui va être joué ---"
printf '%s\n' "$DIFF_TEXTE"
NB_DIFF=$(printf '%s\n' "$DIFF_TEXTE" | grep -c '^[<>]' || true)
# Quatre lignes de diff : deux « < » et deux « > », soit deux lignes substituées.
[ "$NB_DIFF" = 4 ] || { echo "REFUS — $NB_DIFF lignes de diff au lieu de 4 : autre chose que le begin/commit a bougé." >&2; exit 2; }
echo "------------------------------------------------------------"

# Les douze migrations de la Phase A sont les prérequis du corps (condition
# C1). Sur une base qui ne les a pas encore, on les charge DANS la même
# transaction annulée : le corps est alors joué sur le schéma qu'il attend,
# et rien ne subsiste.
#
# Le motif est `2026091622*` et non `20260916220*` : les deux dernières
# migrations (`…221000`, commandes d'activation et de mouvement, et
# `…221100`, commande de saisie managériale) sortaient de la seconde forme
# sans que rien ne le signale — un glob trop étroit ne se plaint pas, il
# charge moins.
#
# Chaque prérequis s'annonce lui-même dans la sortie du serveur. C'est
# délibéré : sans cela, la preuve ne porterait que l'affirmation du script
# qu'il a tout chargé, et seules les migrations ayant émis un NOTICE
# laisseraient une trace. Un glob trop étroit resterait invisible dans le
# fichier même censé l'empêcher.
: > "$TRAVAIL/prerequis.sql"
NB_PREREQUIS=0
PREREQUIS_TABLE=""
for f in "$MIGRATIONS"/2026091622*.sql; do
  [ -e "$f" ] || continue
  NB_PREREQUIS=$((NB_PREREQUIS + 1))
  PREREQUIS_TABLE="$PREREQUIS_TABLE| $NB_PREREQUIS | \`$(basename "$f")\` | \`$(empreinte "$f")\` |
"
  printf "\\\\echo '>> prerequis %02d/NB : %s'\n" "$NB_PREREQUIS" "$(basename "$f")" >> "$TRAVAIL/prerequis.sql"
  printf '\\ir %s\n' "$f" >> "$TRAVAIL/prerequis.sql"
done
if [ "$NB_PREREQUIS" = 0 ]; then
  echo "REFUS — aucun prérequis de la Phase A sous $MIGRATIONS (motif 2026091622*.sql)." >&2
  echo "        Le corps serait joué sur un schéma incomplet, et rien ne le dirait." >&2
  exit 2
fi
# Le total n'est connu qu'une fois la boucle finie : on le substitue après coup.
sed -i '' "s|/NB :|/$NB_PREREQUIS :|g" "$TRAVAIL/prerequis.sql"
echo ">> $NB_PREREQUIS migrations de la Phase A prêtes, chargées seulement si la base ne les a pas."

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

# Le pilote est le seul artefact réellement soumis à psql : c'est lui qui
# choisit les prérequis, leur ordre, et qui porte le `rollback;` final.
# L'empreindre ne suffit pas — il contient un chemin temporaire qui change à
# chaque exécution, donc son empreinte brute n'est reproductible par
# personne. Il est donc reproduit en clair dans la preuve, expurgé, et c'est
# le texte expurgé qui est empreint : celui-là, un relecteur peut le refaire.
PILOTE_EXPURGE=$(sed -e "s|$TRAVAIL/|<travail>/|g" -e "s|$RACINE/||g" "$TRAVAIL/pilote.sql")
PILOTE_SHA=$(printf '%s\n' "$PILOTE_EXPURGE" | shasum -a 256 | cut -d' ' -f1)

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
COMMANDE_EXPURGEE="$PSQL 'postgresql://postgres:***@db.$REF.supabase.co:5432/postgres?sslmode=require' -v ON_ERROR_STOP=1 -f pilote.sql"
set +e
"$PSQL" "$URL" -v ON_ERROR_STOP=1 -f "$TRAVAIL/pilote.sql" > "$TRAVAIL/sortie.txt" 2>&1
CODE=$?
set -e
# Trois expurgations, pour trois raisons différentes. Le mot de passe, parce
# que psql réimprime l'URL entière dans ses erreurs. Le chemin du dépôt et
# celui du fichier de travail, parce que la preuve est versée dans un dépôt
# PUBLIC : le chemin absolu d'un poste n'y apprend rien sur la Phase C, et
# des chemins relatifs rendent la preuve lisible par quelqu'un d'autre.
SORTIE=$(sed -e 's/postgres:[^@]*@/postgres:***@/g' \
             -e "s|$TRAVAIL/|<travail>/|g" \
             -e "s|$RACINE/||g" "$TRAVAIL/sortie.txt")
printf '%s\n' "$SORTIE"

# Dernière instruction réellement rendue par le serveur. C'est elle, et non
# l'absence de trace, qui atteste que la transaction a été annulée.
DERNIERE=$(printf '%s\n' "$SORTIE" | grep -v '^[[:space:]]*$' | tail -1 || true)

# --- Preuve durable ---------------------------------------------------
PREUVE=${PREUVE:-"$ICI/preuves/${HORODATAGE}_recette-phase-c_${REF}.md"}
if [ "$PREUVE" != non ]; then
  mkdir -p "$(dirname "$PREUVE")"
  {
    printf '%s\n' \
      "# Preuve d'exécution — recette de la Phase C sur nexus-test" \
      "" \
      "Fichier **engendré** par \`supabase/phase-c/recette-test.sh\`. Ne pas le" \
      "modifier à la main : il ne vaut que parce que personne ne l'a écrit." \
      "" \
      "## 1. Quand, quoi, où" \
      "" \
      "| | |" \
      "|---|---|" \
      "| Date UTC | \`$DATE_UTC\` |" \
      "| Commit testé | \`$COMMIT\` |" \
      "| Branche | \`$BRANCHE\` |" \
      "| État du dépôt au lancement | **$ETAT_DEPOT** (mesuré avant l'écriture de cette preuve) |" \
      "| Cible | nexus-test — projet \`$REF\` — \`db.$REF.supabase.co:5432\` |" \
      "| Production | \`$REF_PROD\` — jamais visée, refus câblé dans le script |" \
      "| Mutations de validation | $([ "$AVEC_MUTATIONS" = 1 ] && printf 'jouées' || printf 'écartées (--sans-mutations)') |" \
      "| Prérequis Phase A disponibles | $NB_PREREQUIS fichiers (motif \`2026091622*.sql\`) — chargés seulement si la base ne les a pas ; voir §3 et §7 |" \
      "" \
      "## 2. Empreintes des fichiers joués" \
      "" \
      "| fichier | SHA-256 du contenu | blob git à HEAD |" \
      "|---|---|---|" \
      "| \`supabase/phase-c/$(basename "$CORPS")\` | \`$(empreinte "$CORPS")\` | \`$(blob_a_head "$CORPS")\` |" \
      "| \`supabase/phase-c/$(basename "$MUTATIONS")\` | \`$(empreinte "$MUTATIONS")\` | \`$(blob_a_head "$MUTATIONS")\` |" \
      "| \`supabase/phase-c/$(basename "$SCRIPT")\` | \`$(empreinte "$SCRIPT")\` | \`$(blob_a_head "$SCRIPT")\` |" \
      "" \
      "$([ "$ETAT_DEPOT" = propre ] \
        && printf 'Le dépôt était propre : le contenu empreint et le blob du commit sont le même octet.' \
        || printf 'ATTENTION — le dépôt était SALE. Le contenu empreint est celui du disque ; il peut différer du blob du commit, qui est celui de `%s`.' "$COMMIT")" \
      "" \
      "## 3. Prérequis de la Phase A retenus par le script" \
      "" \
      "Ce que le glob a trouvé, dans l'ordre de chargement. Ce tableau dit ce" \
      "que le script **a l'intention** de charger ; le §7 dit ce qui a" \
      "**réellement** été chargé, chaque fichier s'y annonçant lui-même." \
      "" \
      "| # | fichier de \`supabase/migrations/\` | SHA-256 |" \
      "|---|---|---|"
    printf '%s' "$PREREQUIS_TABLE"
    printf '%s\n' \
      "" \
      "## 4. Le pilote réellement soumis à psql (expurgé)" \
      "" \
      "Aucun des fichiers ci-dessus n'est joué seul : psql reçoit ce pilote, et" \
      "lui seul. Il est reproduit ici en entier — c'est lui qui ouvre la" \
      "transaction, décide de charger ou non la Phase A, appelle le corps, les" \
      "mutations, et termine par \`rollback;\`." \
      "" \
      '```' \
      "$PILOTE_EXPURGE" \
      '```' \
      "" \
      "SHA-256 de ce texte expurgé : \`$PILOTE_SHA\`. Le fichier" \
      "\`<travail>/prerequis.sql\` qu'il inclut est exactement la liste du §3," \
      "dans cet ordre, chaque entrée précédée d'un \`\\echo\` qui la nomme." \
      "" \
      "## 5. Commande exécutée (expurgée)" \
      "" \
      '```'
    printf '%s\n' "$COMMANDE_EXPURGEE"
    printf '%s\n' \
      '```' \
      "" \
      "Le mot de passe ne figure jamais sur la ligne de commande : il est lu au" \
      "trousseau et passé à psql par l'environnement (\`PGPASSWORD\`)." \
      "" \
      "## 6. Diff appliqué au corps — $NB_DIFF lignes" \
      "" \
      "Deux lignes substituées, le \`begin;\` et le \`commit;\`. Le script refuse" \
      "de continuer si ce diff n'en fait pas exactement quatre." \
      "" \
      '```diff'
    printf '%s\n' "$DIFF_TEXTE"
    printf '%s\n' \
      '```' \
      "" \
      "## 7. Sortie complète de psql (expurgée)" \
      "" \
      '```'
    printf '%s\n' "$SORTIE"
    printf '%s\n' \
      '```' \
      "" \
      "## 8. Verdict" \
      "" \
      "| | |" \
      "|---|---|" \
      "| Code de retour de psql | \`$CODE\` |" \
      "| Dernière instruction rendue | \`$DERNIERE\` |" \
      "" \
      "## 9. Portée — trois choses distinctes" \
      "" \
      "1. **L'exécution** est établie par les §1 à §7 : une commande datée, une" \
      "   cible nommée, les empreintes des fichiers joués, le pilote intégral," \
      "   la sortie complète du serveur et un code de retour." \
      "2. **Le \`ROLLBACK\`** est établi par le §8 : la dernière instruction rendue" \
      "   par le serveur. Le script refuse de conclure si ce n'en est pas une." \
      "3. **L'absence d'effet durable** n'est **pas** établie par ce fichier, et" \
      "   ne peut pas l'être : il est écrit par le processus qui vient de" \
      "   tourner, pas par la base. Elle se vérifie hors d'ici, en interrogeant" \
      "   la base APRÈS coup — migrations de la Phase A, tables, fonctions," \
      "   politiques, triggers — et en comparant à un relevé pris AVANT." \
      "   **Ce fichier ne dit rien du résultat de cette comparaison** : écrire" \
      "   ici « rien n'a persisté » serait une phrase que ce script imprimerait" \
      "   à l'identique dans le cas contraire. Le raisonnement inverse," \
      "   conclure de l'absence de trace que la recette a tourné, affirmerait le" \
      "   conséquent : une recette jamais lancée laisserait exactement le même" \
      "   état."
  } > "$PREUVE"

  # Le fichier est relu et refusé s'il porte le secret. Le mot de passe
  # n'est comparé qu'en bash : le passer à grep le rendrait visible à `ps`.
  CONTENU_PREUVE=$(cat "$PREUVE")
  if [ -n "${PGPASSWORD:-}" ] && [[ "$CONTENU_PREUVE" == *"$PGPASSWORD"* ]]; then
    rm -f "$PREUVE"
    echo "REFUS — la preuve contenait le secret du trousseau ; elle a été détruite." >&2
    exit 2
  fi
  echo ">> preuve écrite : $PREUVE"
fi

if [ "$CODE" != 0 ]; then
  echo "ÉCHEC — la Phase C ne passe pas sur cette base (code $CODE)." >&2
  echo "        La connexion à Supabase est intermittente : si le message parle" >&2
  echo "        de « timeout expired », relancer avant de conclure." >&2
  exit 1
fi
if [ "$DERNIERE" != ROLLBACK ]; then
  echo "ÉCHEC — psql a rendu 0 mais la dernière instruction est « $DERNIERE »," >&2
  echo "        pas « ROLLBACK ». L'annulation de la transaction n'est pas établie." >&2
  exit 1
fi
echo "OK — le fichier exact de la Phase C s'exécute, et la transaction a été annulée."
