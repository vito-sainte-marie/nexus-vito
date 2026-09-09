#!/usr/bin/env bash
# NEXUS — répétition de release COMPLÈTE, exécutée de bout en bout.
#
# CE QUE CETTE SÉQUENCE ÉTABLIT, ET QUE LES PRÉCÉDENTES N'ÉTABLISSAIENT PAS.
# La répétition du 09/09/2026 a prouvé que les migrations s'appliquent sur une
# base VIDE. C'est nécessaire, et ce n'est pas la question : Production a quatre
# mois d'histoire, un site fantôme, des colonnes divergentes et des services
# restés ouverts. Une migration qui passe sur du vide peut se comporter
# autrement sur ces formes-là.
#
# Cette séquence rejoue donc une HISTOIRE. Elle reconstruit Test à l'état que
# Production sert aujourd'hui, y sème les cas mesurés, MESURE, applique les
# migrations de promotion, MESURE À NOUVEAU — et l'écart entre les deux est le
# rapport d'impact, la seule chose que Frédéric doit lire avant d'autoriser.
#
# ELLE REND TEST À SON USAGE À LA FIN, et ce n'est pas une politesse : un
# nexus-test laissé en répétition ferait mentir toutes les recettes suivantes,
# qui jugeraient des données structurées pour d'autres cas EN RESTANT VERTES.
#
# ELLE NE TOUCHE JAMAIS PRODUCTION et ne lit aucune de ses données : les volumes
# reproduits ont été relevés une fois, le 08/09, et vivent dans le jeu.
#
# Usage :
#   outils/repetition-release-complete.sh <project-ref> <release> [version-production]
# Exemple :
#   outils/repetition-release-complete.sh udljdqxerrbbbajxubfn 2026.09.1 20260904130807

set -euo pipefail

# S'EXÉCUTER DEPUIS UNE COPIE FIGÉE — ajouté le 09/09/2026, après l'avoir cassé.
#
# CE QUI S'EST PASSÉ. Bash ne charge pas un script en entier : il le relit au
# fil de l'exécution, à la position d'octet où il en est. Une reconstruction
# dure dix minutes ; pendant celle de Frédéric, j'ai modifié ce fichier deux
# fois. Les octets se sont décalés, et bash a repris sa lecture au milieu d'un
# mot :
#
#   repetition-release-complete.sh: line 164: syntax error near unexpected token `('
#
# Le fichier était syntaxiquement bon. C'est l'exécution EN COURS que mes
# éditions ont corrompue, et Frédéric a repayé dix minutes de migrations pour
# une faute qui n'avait rien à voir avec sa release.
#
# La promesse de « faire attention » ne vaut rien face à une séquence qui dure
# assez longtemps pour donner envie de travailler pendant. Le script se recopie
# donc dans un fichier temporaire et s'y relance : à partir de là, éditer
# l'original est sans effet sur la course en cours.
if [ -z "${NEXUS_REPETITION_FIGEE:-}" ]; then
  # `mktemp -t nom` fonctionne sur macOS mais GNU refuse un gabarit sans
  # XXXXXX (« too few X's in template ») : le script mourait au démarrage sur
  # le runner Linux, en passant sur le poste de Frédéric. Gabarit explicite,
  # accepté par les deux.
  COPIE="$(mktemp "${TMPDIR:-/tmp}/repetition-release.XXXXXX")" || {
    echo "Impossible de créer la copie figée du script." >&2; exit 1; }
  cat "$0" > "$COPIE"
  # L'original est transmis : `dirname $0` pointerait sinon vers /var/folders,
  # et RACINE — donc TOUS les chemins du dépôt — serait faux.
  NEXUS_REPETITION_FIGEE="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
  export NEXUS_REPETITION_FIGEE
  trap 'rm -f "$COPIE"' EXIT
  bash "$COPIE" "$@"
  exit $?
fi

ORIGINE="$NEXUS_REPETITION_FIGEE"

PROD_REF="uzhjpqpctpvxytxpxoqz"
REF="${1:-}"
RELEASE="${2:-}"
VERSION_PROD="${3:-20260904130807}"
RACINE="$(cd "$(dirname "$ORIGINE")/.." && pwd)"
RAPPORT="${NEXUS_RAPPORT:-$HOME/repetition-impact-$RELEASE.txt}"

if [ -z "$REF" ] || [ -z "$RELEASE" ]; then
  echo "Usage : $ORIGINE <project-ref> <release> [version-production]" >&2
  exit 2
fi
if [ "$REF" = "$PROD_REF" ]; then
  echo "REFUS : $REF est le projet de PRODUCTION." >&2
  exit 3
fi

# LE TROUSSEAU N'EST EXIGÉ QUE S'IL EST LE SEUL RECOURS.
#
# Constat canonisé le 09/09/2026 (request-5), puis RECONFIRMÉ le même jour sur
# ce script précis : le trousseau macOS était réclamé AVANT même de regarder
# si `NEXUS_TEST_DB_URL` était fournie. Sur un runner Linux il n'existe pas —
# la reconstruction mourait donc en `exit 4` alors qu'une URL Test parfaitement
# valide était disponible. Le script refusait de travailler faute d'un moyen
# dont il n'avait pas besoin.
#
# L'ordre est donc RÉELLEMENT inversé : `security` n'est même tenté que si
# `NEXUS_TEST_DB_URL` est absente. Quand elle est fournie, elle porte son
# propre moyen d'authentification, ou `PGPASSWORD` est déjà dans
# l'environnement.
#
# CE QUI N'EST PAS ASSOUPLI : le refus de la référence Production reste AVANT
# toute tentative de connexion, et une connexion qui échoue échoue — on ne
# devine aucun mot de passe et on n'en fabrique aucun.
MDP=""
if [ -z "${NEXUS_TEST_DB_URL:-}" ]; then
  MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"
  if [ -z "$MDP" ]; then
    MDP="${NEXUS_TEST_DB_PASSWORD:-}"
  fi
fi
if [ -z "$MDP" ] && [ -z "${NEXUS_TEST_DB_URL:-}" ]; then
  echo "Aucun moyen de se connecter : ni NEXUS_TEST_DB_URL, ni mot de passe." >&2
  echo "Fournir l'URL, ou déposer le mot de passe avec :" >&2
  echo "  security add-generic-password -a nexus -s nexus-test-db -w" >&2
  exit 4
fi
if [ -n "$MDP" ]; then
  export PGPASSWORD="$MDP"
fi
unset MDP

POOLER="aws-0-us-east-1.pooler.supabase.com"
URL_DIRECTE="postgresql://postgres@db.${REF}.supabase.co:5432/postgres?sslmode=require"
URL_POOLER="postgresql://postgres.${REF}@${POOLER}:5432/postgres?sslmode=require"
if [ -n "${NEXUS_TEST_DB_URL:-}" ]; then URL="$NEXUS_TEST_DB_URL"
elif psql "$URL_DIRECTE" -tAc "select 1" >/dev/null 2>&1; then URL="$URL_DIRECTE"
elif psql "$URL_POOLER" -tAc "select 1" >/dev/null 2>&1; then URL="$URL_POOLER"
else echo "AUCUNE connexion possible à $REF." >&2; exit 6; fi
export NEXUS_TEST_DB_URL="$URL"

# Les quatre mesures qui décident. Elles sont écrites ICI, une seule fois, et
# rejouées à l'identique avant et après : deux requêtes différentes ne se
# comparent pas, et l'écart qu'elles montreraient serait le leur, pas celui des
# migrations.
MESURES="select 'missions divergentes' as forme, count(*)::text as n from public.mission_catalog where site is distinct from site_id
union all select 'services divergents', count(*)::text from public.shifts where site is distinct from site_id
union all select 'services en_cours', count(*)::text from public.shifts where statut = 'en_cours'
union all select 'services clos_sans_pointage', count(*)::text from public.shifts where statut = 'clos_sans_pointage'
order by 1"

mesurer() { psql "$URL" --quiet --no-psqlrc -tA -F' : ' -c "$MESURES"; }

# SORTIR DE LA RÉPÉTITION, QUOI QU'IL ARRIVE.
#
# Quand la séquence s'arrête entre les étapes 3 et 7, Test RESTE en
# `PREPROD_REHEARSAL` avec des données de répétition. C'est voulu : l'état
# fautif doit pouvoir être examiné avant d'être effacé. Mais tant qu'il dure,
# toute recette lancée sur cette base juge des données structurées pour
# reproduire des cas Production — et resterait verte en le faisant.
#
# Le laisser sans dire comment en sortir, c'est laisser un piège. On imprime
# donc la manœuvre à chaque arrêt anormal, et une seule fois.
# Le drapeau n'est levé QUE lorsque la base est réellement passée en
# répétition. Sans lui, ce message s'afficherait sur une simple erreur d'usage
# — en lisant au passage des variables non encore définies — et annoncerait un
# état où Test n'est jamais entré.
EN_REPETITION=0
sortie_anormale() {
  local code=$?
  [ "$code" -eq 0 ] && return 0
  [ "${EN_REPETITION:-0}" -eq 1 ] || return 0
  echo >&2
  echo "──────────────────────────────────────────────────────────────" >&2
  echo "TEST RESTE EN PREPROD_REHEARSAL. Ce n'est pas un état où le laisser." >&2
  echo "Tant qu'il dure, toute recette juge des données de répétition — en" >&2
  echo "restant verte. Pour rendre Test à son usage :" >&2
  echo >&2
  echo "  NEXUS_TEST_DB_URL=\"\$NEXUS_TEST_DB_URL\" DEPUIS_ETAPE=8 \\" >&2
  echo "    $ORIGINE $REF $RELEASE" >&2
  echo >&2
  echo "Pour reprendre la répétition après correctif, sans repayer la" >&2
  echo "reconstruction : DEPUIS_ETAPE=3. Avec reconstruction : DEPUIS_ETAPE=2." >&2
  echo "──────────────────────────────────────────────────────────────" >&2
}
trap sortie_anormale EXIT

# REPRISE À L'ÉTAPE — `DEPUIS_ETAPE=3` saute tout ce qui précède.
#
# L'étape 2 rejoue 241 migrations et prend une dizaine de minutes. Le 09/09/2026,
# quatre tentatives se sont arrêtées APRÈS elle — sur un point de suspension
# collé à une variable, puis sur une colonne que la release apporte — et chacune
# a fait repayer la reconstruction pour un défaut situé ailleurs.
#
# Reprendre à 3 est SÛR parce que l'étape 2 est déterministe et laisse toujours
# la base au même état : la borne, rien de plus. On ne saute donc pas un travail
# incertain, on évite de refaire à l'identique un travail déjà fait.
#
# On ne reprend PAS à 5 ou plus : le semis et la mesure AVANT sont ce qui donne
# un sens à la mesure APRÈS. Sauter l'un des deux produirait un rapport d'impact
# comparant deux états sans rapport.
DEPUIS="${DEPUIS_ETAPE:-1}"
case "$DEPUIS" in
  1|2|3|4) ;;
  # 8 est le RETOUR SEUL : rendre Test à son usage sans rien répéter. Ce n'est
  # pas une reprise de répétition, c'est son démontage — d'où l'exception.
  8) ;;
  *) echo "DEPUIS_ETAPE doit valoir 1 à 4, ou 8 pour le seul retour en TEST_NORMAL (lu : $DEPUIS)." >&2
     echo "Entre 5 et 7, la mesure AVANT manquerait et le rapport d'impact ne voudrait rien dire." >&2
     exit 5 ;;
esac
faire() { [ "$1" -ge "$DEPUIS" ]; }
if [ "$DEPUIS" -gt 1 ]; then
  echo "REPRISE demandée à l'étape $DEPUIS — les étapes précédentes sont sautées."
  echo "La base est supposée déjà reconstruite à la borne $VERSION_PROD."
  echo
fi

echo "=== Répétition de release $RELEASE sur $REF ==="
echo "Départ : état Production au $VERSION_PROD. Rapport : $RAPPORT"
echo

if faire 1; then
  echo "[1/8] Ouverture du cycle et déclaration du mode…"
  # REPRENABLE. Un cycle déjà ouvert POUR LA MÊME RELEASE n'est pas une faute :
  # c'est une tentative précédente interrompue, et il y en a eu quatre le
  # 09/09/2026. On le reprend. Un cycle ouvert pour une AUTRE release, en
  # revanche, est un vrai conflit : deux répétitions ne partagent pas une base.
  node -e '
  const fs=require("fs"),p=process.argv[1],r=JSON.parse(fs.readFileSync(p,"utf8"));
  const rel=process.argv[2], ouvert=r.cycles.find(c=>!c.detruit_le);
  if(ouvert && ouvert.release!==rel){
    console.error(`Un cycle est ouvert pour une AUTRE release (${ouvert.release}) : le fermer d abord.`);
    process.exit(1);
  }
  if(ouvert){ console.log(`Cycle déjà ouvert pour ${rel} — reprise d une tentative interrompue.`); }
  else {
    r.cycles.push({projet_ref:process.argv[3],release:rel,cree_le:new Date().toISOString(),detruit_le:null});
    fs.writeFileSync(p,JSON.stringify(r,null,2)+"\n");
  }
  ' "$RACINE/docs/handoff/PREPROD-CYCLE.json" "$RELEASE" "$REF"
  psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -c \
    "update public.nexus_environnement_mode set mode='PREPROD_REHEARSAL', release='$RELEASE', depuis=now(), motif='Répétition de release.'"
  EN_REPETITION=1
  echo "Mode : PREPROD_REHEARSAL (release $RELEASE)."
  echo
else
  echo "[1/8] sauté (reprise)."
fi


if faire 2; then
  echo "[2/8] Reconstruction bornée à ${VERSION_PROD}…"
  JUSQUA="$VERSION_PROD" "$RACINE/outils/reconstruire-base-test.sh" "$REF"
  echo
else
  echo "[2/8] sauté (reprise)."
fi


if faire 3; then
  echo "[3/8] Semis de la recette puis des cas Production…"
  psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -f "$RACINE/outils/semer-recette-test.sql"
  # Le mode a été effacé avec le schéma : sa table n'existe qu'après sa migration,
  # postérieure à la borne. On le repose donc ici, avant le semis qui l'exige.
  psql "$URL" --quiet --no-psqlrc -c "create table if not exists public.nexus_environnement_mode (
    mode_unique boolean primary key default true, mode text not null default 'TEST_NORMAL',
    depuis timestamptz not null default now(), release text, motif text)" >/dev/null
  psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -c \
    "insert into public.nexus_environnement_mode (mode_unique, mode, release) values (true,'PREPROD_REHEARSAL','$RELEASE')
     on conflict (mode_unique) do update set mode=excluded.mode, release=excluded.release" >/dev/null
  EN_REPETITION=1
  psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -f "$RACINE/outils/jeu-preprod-cas-production.sql"

  # ET ON RETIRE L'ÉCHAFAUDAGE. La table ci-dessus n'était qu'un appui pour semer :
  # la laisser en place ferait tomber la migration [5/8] qui la crée sur un
  # `create table if not exists` déjà satisfait. Elle afficherait OK sans rien
  # faire, et ses deux contraintes — mode contraint à deux valeurs, release
  # obligatoire en répétition — ne seraient jamais éprouvées. Une répétition qui
  # valide une migration inerte est précisément le défaut qu'elle sert à trouver.
  psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 \
    -c "drop table if exists public.nexus_environnement_mode" >/dev/null
  echo "  Échafaudage du mode retiré : sa migration devra le créer pour de vrai."
  echo

  # LA MESURE DE RÉFÉRENCE DOIT ÊTRE FRAÎCHE.
  #
  # Le 09/09/2026, `services_ouverts` valait 13 la veille et 17 le jour même :
  # Production en accumule deux à quatre par jour. Un jeu semé d'après un
  # instantané périmé mesure l'impact d'hier, et le rapport reste vert en le
  # disant. On refuse donc au-delà de trois jours — la fenêtre courte est le
  # principe, pas une commodité : une répétition sert à décider MAINTENANT.
  node -e '
  const fs=require("fs"), m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  const jours=Math.floor((Date.now()-Date.parse(m.mesure_le))/86400000);
  if(!Number.isFinite(jours)){console.error("Mesure sans date lisible : on refuse de conclure.");process.exit(1);}
  if(jours>3){
    console.error(`REFUS — volumes Production mesurés le ${m.mesure_le}, il y a ${jours} jours.`);
    console.error("Production est vivante : ces nombres ont bougé. Re-mesurer en lecture seule avant de répéter.");
    process.exit(1);
  }
  console.log(`Volumes de référence : mesurés le ${m.mesure_le} (il y a ${jours} jour(s)).`);
  ' "$RACINE/docs/recettes/volumes-production-mesures.json"
  echo
else
  echo "[3/8] sauté (retour seul)."
fi

if faire 4; then
  echo "[4/8] MESURE AVANT" | tee "$RAPPORT"
  mesurer | tee -a "$RAPPORT"
  echo | tee -a "$RAPPORT"

  echo "[5/8] Application des migrations de promotion (> $VERSION_PROD)…"
  n=0
  for f in "$RACINE"/supabase/migrations/*.sql; do
    nom="$(basename "$f")"; version="${nom%%_*}"
    [ "$version" \> "$VERSION_PROD" ] || continue
    n=$((n+1)); printf "  [%02d] %-70s " "$n" "${nom:0:70}"
    if sortie="$(psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -f "$f" 2>&1)"; then
      echo "OK"
    else
      echo "ÉCHEC"; echo "$sortie" | grep -E '^psql:|ERROR' | head -10 | sed 's/^/      /'
      echo "La répétition s'arrête ici. Test reste en PREPROD_REHEARSAL : c'est voulu," >&2
      echo "l'état fautif doit pouvoir être examiné avant d'être effacé." >&2
      exit 7
    fi
  done
  echo "  ${n} migration(s) de promotion appliquée(s)."

  # La migration du mode vient de reposer la table à son état par défaut,
  # TEST_NORMAL. On est pourtant toujours en répétition, et un cycle est ouvert :
  # laisser ça mentirait à la garde, qui verrait un cycle orphelin. On redéclare —
  # et si les contraintes de la migration sont bonnes, cette écriture passe ; si
  # elles sont mauvaises, elle échoue ICI, ce qui est le but.
  psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -c \
    "update public.nexus_environnement_mode
        set mode='PREPROD_REHEARSAL', release='${RELEASE}', depuis=now(),
            motif='Répétition en cours, mode reposé après migration.'" >/dev/null
  node "$RACINE/outils/garde-mode-environnement.js" \
    "$(psql "$URL" --quiet --no-psqlrc -tAc 'select mode from public.nexus_environnement_mode')"
  echo

  # CE QUI COMPTE POUR L'ÉQUIPE, AVANT CE QUI COMPTE POUR LE RAPPORT.
  # Les migrations sont passées ; reste à savoir si le geste quotidien fonctionne
  # encore. On le REJOUE plutôt que de le déduire du code.
  echo "[6/8] Parcours employé : prise de poste après un quart laissé ouvert…"
  psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 \
    -f "$RACINE/outils/verifier-prise-de-poste-apres-migrations.sql"
  echo

  echo "[6/8] MESURE APRÈS" | tee -a "$RAPPORT"
  mesurer | tee -a "$RAPPORT"
  echo | tee -a "$RAPPORT"
  echo "L'écart entre [4] et [6] est le rapport d'impact : $RAPPORT"
  echo

  echo "[7/8] Suite, Guardians et répétition carburants…"
  ( cd "$RACINE"; node run-tests.js; node outils/guardian-qa.js; node outils/repetition-recette-carburants.js )
  echo
else
  echo "[4-7/8] sautées (retour seul) : aucune mesure, aucun rapport."
fi

echo "[8/8] Retour en TEST_NORMAL — obligatoire."
"$RACINE/outils/reconstruire-base-test.sh" "$REF"
psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -f "$RACINE/outils/semer-recette-test.sql"
psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -c \
  "update public.nexus_environnement_mode set mode='TEST_NORMAL', release=null, depuis=now(), motif='Retour après répétition.'"
node -e '
const fs=require("fs"),p=process.argv[1],r=JSON.parse(fs.readFileSync(p,"utf8"));
const c=r.cycles.filter(c=>!c.detruit_le).pop();
if(c) c.detruit_le=new Date().toISOString();
fs.writeFileSync(p,JSON.stringify(r,null,2)+"\n");
' "$RACINE/docs/handoff/PREPROD-CYCLE.json"
echo "Test rendu à son usage, cycle fermé."
echo
echo "=== Répétition $RELEASE terminée. Rapport d'impact : $RAPPORT ==="
