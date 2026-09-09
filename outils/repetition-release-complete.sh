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

PROD_REF="uzhjpqpctpvxytxpxoqz"
REF="${1:-}"
RELEASE="${2:-}"
VERSION_PROD="${3:-20260904130807}"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
RAPPORT="${NEXUS_RAPPORT:-$HOME/repetition-impact-$RELEASE.txt}"

if [ -z "$REF" ] || [ -z "$RELEASE" ]; then
  echo "Usage : $0 <project-ref> <release> [version-production]" >&2
  exit 2
fi
if [ "$REF" = "$PROD_REF" ]; then
  echo "REFUS : $REF est le projet de PRODUCTION." >&2
  exit 3
fi

MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"
[ -z "$MDP" ] && MDP="${NEXUS_TEST_DB_PASSWORD:-}"
if [ -z "$MDP" ]; then
  echo "Mot de passe introuvable. Ce script ne devine ni ne fabrique de credential." >&2
  exit 4
fi
export PGPASSWORD="$MDP"; unset MDP

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

echo "=== Répétition de release $RELEASE sur $REF ==="
echo "Départ : état Production au $VERSION_PROD. Rapport : $RAPPORT"
echo

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
echo "Mode : PREPROD_REHEARSAL (release $RELEASE)."
echo

echo "[2/8] Reconstruction bornée à ${VERSION_PROD}…"
JUSQUA="$VERSION_PROD" "$RACINE/outils/reconstruire-base-test.sh" "$REF"
echo

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

echo "[6/8] MESURE APRÈS" | tee -a "$RAPPORT"
mesurer | tee -a "$RAPPORT"
echo | tee -a "$RAPPORT"
echo "L'écart entre [4] et [6] est le rapport d'impact : $RAPPORT"
echo

echo "[7/8] Suite, Guardians et répétition carburants…"
( cd "$RACINE"; node run-tests.js; node outils/guardian-qa.js; node outils/repetition-recette-carburants.js )
echo

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
