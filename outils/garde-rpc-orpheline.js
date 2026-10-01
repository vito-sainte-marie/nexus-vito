#!/usr/bin/env node
'use strict';
// Garde RPC-ORPHELINE — « le front n'appelle aucune fonction que son propre
// arbre de migrations ne définit pas. »
//
// POURQUOI CETTE GARDE EXISTE. Le 01/10/2026, après le déploiement #65
// (merge `adee9bb`), la connexion NEXUS est tombée en Production : « Connexion
// au serveur impossible ». Cause retrouvée par lecture d'historique, pas par
// hypothèse : le 28/09/2026, un port (`55974ae`, « fix(login): porter le
// contrat pre-auth non enumerable (04/09) sur le candidat #65 ») a recopié
// `NEXUS-Login-v1.html` — qui appelle `public.nexus_identifiant_de_connexion`
// — sur la branche candidate de #65 (`reception-regularisation-20260919`,
// tête `5dcdaaa5`), SANS porter la migration qui définit cette fonction
// (`20260904175747_login_non_enumerable.sql`, créée le 04/09/2026 sur une
// toute autre branche). Vérifié : cette migration est absente de l'arbre du
// candidat #65, absente de `origin/production` après fusion, et le commit de
// port le cite pourtant lui-même dans son propre message. Le front appelait
// une fonction qu'aucune migration de son propre arbre ne créait.
//
// CE QUE `garde-ordre-migration-code.js` NE VOIT PAS. Cette garde-sœur compare
// les migrations NOUVELLES d'un candidat contre une cible, et vérifie l'ordre
// migration → code pour celles-là. Elle est aveugle à ce cas précis : la
// migration manquante n'était NI dans le candidat NI dans la cible — rien à
// comparer, rien à qualifier, aucune des deux listes ne la contient. Le trou
// n'est pas un défaut d'ORDRE entre deux refs, c'est un défaut de COMPLÉTUDE
// À L'INTÉRIEUR d'une seule ref : le front cite une fonction, aucun fichier de
// `supabase/migrations/` de ce même arbre ne la crée. Les deux gardes restent
// séparées et ne se citent pas l'une l'autre, pour la même raison que
// `docs/deploiement/README.md` l'explique déjà pour sa propre paire d'axes.
//
// CE QU'ELLE FAIT. Pour une ref donnée : extrait chaque appel `.rpc("nom", …)`
// des fichiers front (`*.html`, `*.js` à la racine du dépôt — le périmètre
// réellement publié par `deploiement-production.yml`, qui exclut `supabase/`,
// `outils/`, `docs/` de l'artefact Pages), extrait chaque fonction créée par
// `supabase/migrations/*.sql` de la MÊME ref, et refuse si un nom appelé
// n'est créé par aucun fichier.
//
// CE QU'ELLE NE FAIT PAS. Elle ne se connecte à aucune base, ne lit aucun
// secret, n'exécute aucun SQL, n'a aucun accès réseau. Elle lit une ref Git et
// rend 0 ou 1. Elle ne dit pas si la fonction existe RÉELLEMENT sur une cible
// Production ou Test — seulement si le candidat est auto-cohérent. L'état
// réel d'une base reste une mesure catalogue séparée, au même titre que pour
// `garde-ordre-migration-code.js`.
//
// LIMITE ASSUMÉE. Un nom de fonction passé par variable plutôt que par
// littéral de chaîne (`.rpc(variable, …)`) échappe à l'extraction statique.
// Mesuré sur ce dépôt le 01/10/2026 : zéro occurrence de cette forme parmi
// les 10 appels RPC distincts du front. Si une telle forme apparaît un jour,
// cette garde doit refuser plutôt que de l'ignorer en silence — voir
// `RPC_DYNAMIQUE_NON_VERIFIABLE` ci-dessous.
//
//   node outils/garde-rpc-orpheline.js <ref-candidate>   # défaut : HEAD

const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = process.env.NEXUS_DEPOT || path.resolve(__dirname, '..');

function git(args, depot) {
  return execFileSync('git', ['-C', depot || RACINE, ...args], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
}

function gitTolerant(args, depot) {
  try { return git(args, depot); } catch { return ''; }
}

// Le périmètre front est celui réellement publié par
// `deploiement-production.yml` : les fichiers `.html`/`.js` à la racine, à
// l'exclusion de `supabase/`, `outils/`, `docs/` et des fichiers de test —
// jamais déployés sur Pages.
function fichiersFront(ref, depot) {
  const tous = gitTolerant(['ls-tree', '-r', '--name-only', ref], depot).split('\n').filter(Boolean);
  return tous.filter((f) => {
    if (f.includes('/')) return false; // racine seulement
    if (!/\.(html|js)$/i.test(f)) return false;
    if (/^test_/.test(f)) return false;
    if (f === 'run-tests.js') return false;
    return true;
  });
}

function fichiersMigrations(ref, depot) {
  return gitTolerant(['ls-tree', '-r', '--name-only', ref, 'supabase/migrations/'], depot)
    .split('\n').filter(Boolean);
}

// Couvre `function public.nom(`, `function "public"."nom"(` et
// `function nom(` (sans schéma) — les trois formes réellement présentes dans
// ce dépôt (mesuré le 01/10/2026 : le dump baseline Supabase cite le schéma
// entre guillemets doubles, les migrations manuscrites ne le font pas).
const MOTIF_DEFINITION = /create\s+(?:or\s+replace\s+)?function\s+(?:"?public"?\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
const MOTIF_APPEL = /\.rpc\(\s*(["'])([a-zA-Z0-9_]+)\1|\.rpc\(\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*[,)]/g;

function fonctionsDefinies(ref, fichiers, depot) {
  const defs = new Map(); // nom -> [fichiers]
  for (const chemin of fichiers) {
    const sql = gitTolerant(['show', ref + ':' + chemin], depot);
    const re = new RegExp(MOTIF_DEFINITION.source, MOTIF_DEFINITION.flags);
    let m;
    while ((m = re.exec(sql)) !== null) {
      const nom = m[1].toLowerCase();
      if (!defs.has(nom)) defs.set(nom, []);
      defs.get(nom).push(chemin);
    }
  }
  return defs;
}

function appelsRpc(ref, fichiers, depot) {
  const appels = new Map(); // nom (ou null si dynamique) -> [fichiers]
  const dynamiques = [];
  for (const chemin of fichiers) {
    const src = gitTolerant(['show', ref + ':' + chemin], depot);
    const re = new RegExp(MOTIF_APPEL.source, MOTIF_APPEL.flags);
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m[2]) {
        const nom = m[2].toLowerCase();
        if (!appels.has(nom)) appels.set(nom, []);
        appels.get(nom).push(chemin);
      } else if (m[3]) {
        dynamiques.push({ expression: m[3], fichier: chemin });
      }
    }
  }
  return { appels, dynamiques };
}

function controler({ candidate, depot } = {}) {
  const racine = depot || RACINE;
  const refCandidate = candidate || 'HEAD';

  const front = fichiersFront(refCandidate, racine);
  const migrations = fichiersMigrations(refCandidate, racine);
  const defs = fonctionsDefinies(refCandidate, migrations, racine);
  const { appels, dynamiques } = appelsRpc(refCandidate, front, racine);

  const lignes = [];
  lignes.push('── Garde RPC-ORPHELINE ' + '─'.repeat(42));
  lignes.push('  candidat : ' + refCandidate);
  lignes.push('  fichiers front scannés : ' + front.length
    + '   migrations scannées : ' + migrations.length);
  lignes.push('  appels RPC distincts : ' + appels.size
    + '   fonctions définies : ' + defs.size);

  const orphelins = [];
  for (const [nom, fichiers] of appels) {
    if (!defs.has(nom)) orphelins.push({ nom, fichiers: [...new Set(fichiers)] });
  }

  if (dynamiques.length) {
    lignes.push('');
    lignes.push('  AVERTISSEMENT — appel(s) RPC à nom non littéral, non vérifiables statiquement :');
    dynamiques.slice(0, 8).forEach((d) => lignes.push('    · ' + d.expression + ' (' + d.fichier + ')'));
  }

  if (orphelins.length) {
    lignes.push('');
    lignes.push('  REFUS — le front appelle une fonction qu’aucune migration de ce même arbre'
      + ' ne définit :');
    for (const o of orphelins) {
      lignes.push('    · ' + o.nom + '  appelée par ' + o.fichiers.join(', '));
    }
    lignes.push('  Une migration absente de cette ref ne protège personne : c’est exactement le');
    lignes.push('  défaut qui a cassé la connexion en Production après le déploiement #65.');
    return {
      ok: false, code: 'RPC_SANS_MIGRATION', orphelins, dynamiques,
      message: lignes.join('\n'),
    };
  }

  lignes.push('');
  lignes.push('  Chaque appel RPC du front est couvert par une migration de ce même arbre.');
  return { ok: true, code: 'RPC_COUVERTES', dynamiques, message: lignes.join('\n') };
}

module.exports = { controler, fichiersFront, fichiersMigrations, fonctionsDefinies, appelsRpc };

if (require.main === module) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const r = controler({ candidate: args[0] });
  if (r.ok) { console.log(r.message); process.exit(0); }
  console.error(r.message);
  process.exit(1);
}
