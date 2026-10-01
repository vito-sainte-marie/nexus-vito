#!/usr/bin/env node
'use strict';
//
// GARDE — une RPC appelée par le front doit être prouvable sur la cible.
//
// Pourquoi elle existe, et ce qu'elle aurait arrêté le 01/10/2026 :
//
//   Le 28/09, le commit 55974ae a porté sur le candidat #65 un écran de
//   connexion qui appelle `public.nexus_identifiant_de_connexion(p_prenom)`.
//   La migration qui crée cette fonction — `20260904175747_login_non_enumerable`
//   — est restée sur le rail. Le 01/10 à 13 h 49 UTC, la fusion #65 a porté le
//   front sur `production`. GitHub Pages sert cet arbre brut : le déploiement
//   n'emporte AUCUNE migration. Résultat mesuré : la fonction est absente du
//   catalogue Production, l'appel rend une erreur PostgREST, et l'écran affiche
//   « Connexion au serveur impossible ». Plus personne ne se connecte.
//
//   Aucune garde ne regardait cet écart, parce qu'aucune ne rapproche les deux
//   moitiés : ce que le front APPELLE, et ce que la cible sait PROUVER.
//
// Ce qu'elle mesure, exactement :
//
//   appels(candidat)   = les `.rpc("…")` des écrans du candidat
//   prouvables(cible)  = les fonctions créées par une migration présente sur la
//                        branche cible, PLUS celles déclarées hors-bande
//
//   Un appel qui n'est pas prouvable est classé selon qu'il est NOUVEAU ou
//   PRÉEXISTANT, parce que les deux ne disent pas la même chose :
//
//     BLOCK  le candidat INTRODUIT l'appel et la cible ne peut pas le prouver.
//            C'est le cas #65. Le déploiement casserait un écran.
//     WARN   l'appel existe déjà sur la cible et n'est pas prouvable. L'écran
//            fonctionne peut-être depuis des mois : la fonction est alors en
//            base sans migration au dépôt. Ce n'est pas une panne, c'est un
//            silence — à déclarer, pas à refermer en bloc.
//     INFO   l'appel est déjà déclaré hors-bande, avec une mesure datée.
//
// CE QU'ELLE NE PEUT PAS FAIRE, et qui doit être dit :
//
//   Elle ne lit AUCUN catalogue. Elle n'a pas de chemin de lecture vers
//   Production et ne doit pas en chercher un. « Prouvable » veut donc dire
//   « démontrable depuis le dépôt », jamais « constatée en base ». Une fonction
//   créée hors-bande est invisible pour elle : c'est précisément pourquoi le
//   préexistant ne bloque pas, et pourquoi la déclaration existe.
//
// Variables d'environnement :
//   NEXUS_DEPOT        racine du dépôt (défaut : la racine du projet)
//   NEXUS_RPC_CANDIDAT ref du candidat (défaut : HEAD)
//   NEXUS_RPC_CIBLE    ref de la cible — AUCUN défaut, voir ci-dessous
//
// La cible ne se devine pas. Un repli silencieux vers `production` ferait
// mesurer une cible que personne n'a désignée, et rendrait un verdict crédible
// sur la mauvaise question. Absente, la garde refuse.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = process.env.NEXUS_DEPOT ? path.resolve(process.env.NEXUS_DEPOT) : path.resolve(__dirname, '..');
const DECLARATION = path.join('docs', 'deploiement', 'rpc-hors-bande-constatees.json');

const SEVERITES = { BLOCK: 'BLOCK', WARN: 'WARN', INFO: 'INFO' };

const CODES = {
  CIBLE_NON_DESIGNEE: 'cible_non_designee',
  OPTION_INCONNUE: 'option_inconnue',
  OPTION_SANS_VALEUR: 'option_sans_valeur',
  REF_INTROUVABLE: 'ref_introuvable',
  MESURE_IMPOSSIBLE_MIGRATIONS: 'mesure_impossible_aucune_migration',
  MESURE_IMPOSSIBLE_APPELS: 'mesure_impossible_aucun_appel',
  DECLARATION_NON_RECEVABLE: 'declaration_non_recevable',
  RPC_INTROUVABLE_SUR_LA_CIBLE: 'rpc_introuvable_sur_la_cible',
  MIGRATION_CANONIQUE_NON_APPLIQUEE: 'migration_canonique_non_appliquee',
  RPC_HORS_BANDE_DECLAREE: 'rpc_hors_bande_declaree'
};

// Un écran est ce qu'un humain ouvre. L'outillage et les épreuves appellent
// aussi des RPC, mais un outil cassé n'empêche personne de travailler : il ne
// peut pas valoir BLOCK, sinon la garde devient un veto sur son propre banc.
//
// Le sens de la définition est choisi, pas subi : est écran TOUT fichier qui
// n'est pas prouvablement de l'outillage. L'inverse — une liste fermée de ce
// qui est un écran — ferait qu'un écran d'un type non prévu passerait en WARN
// au lieu de BLOCK, c'est-à-dire exactement le silence qui a laissé partir le
// déploiement du 01/10. Un faux positif est bruyant et se corrige en une ligne ;
// un faux négatif est une panne terrain.
const OUTILLAGE_PREFIXES = ['outils/', 'docs/', '.github/', 'simulations/', 'node_modules/'];
const OUTILLAGE_BASENAMES = ['run-tests.js'];
const OUTILLAGE_DEBUTS = ['test_', 'recette_', 'simulation_'];

function estEcranReel(chemin) {
  if (OUTILLAGE_PREFIXES.some((p) => chemin.startsWith(p))) return false;
  const base = path.basename(chemin);
  if (OUTILLAGE_BASENAMES.includes(base)) return false;
  if (OUTILLAGE_DEBUTS.some((d) => base.startsWith(d))) return false;
  return true;
}

function git(racine, args) {
  return execFileSync('git', args, { cwd: racine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

// Une ref absente est un cas PRÉVU : c'est le refus `ref_introuvable`. Le
// stderr de git est donc tu, sinon un « fatal: Needed a single revision »
// s'imprime à côté d'un refus propre, et celui qui lit le journal croit à une
// panne de l'outil là où la garde a simplement répondu.
function resoudre(racine, ref) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`],
      { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_) { return null; }
}

// On extrait l'arbre une fois plutôt que d'interroger git fichier par fichier :
// à 500 fichiers et 280 migrations par ref, la différence n'est pas cosmétique.
function extraireArbre(racine, ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-rpc-'));
  const tar = path.join(dir, 'arbre.tar');
  execFileSync('git', ['archive', '--format=tar', '-o', tar, ref], { cwd: racine });
  const cible = path.join(dir, 'arbre');
  fs.mkdirSync(cible);
  execFileSync('tar', ['-xf', tar, '-C', cible]);
  fs.rmSync(tar, { force: true });
  return { dir, cible };
}

function parcourir(racine, filtre) {
  const trouves = [];
  (function descendre(rel) {
    const abs = path.join(racine, rel);
    let entrees;
    try { entrees = fs.readdirSync(abs, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entrees) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        descendre(r);
      } else if (e.isFile() && filtre(r)) {
        trouves.push(r);
      }
    }
  })('');
  return trouves.sort();
}

// `\s` couvre les sauts de ligne : une signature écrite sur deux lignes reste
// reconnue. Sans cela, une migration mise en forme autrement deviendrait
// invisible et la garde accuserait un écran qui va bien.
const RE_DEFINITION = /create\s+(?:or\s+replace\s+)?function\s+(?:public\s*\.\s*)?([A-Za-z0-9_]+)\s*\(/gi;

// Une définition COMMENTÉE n'est pas une preuve. Sans ce retrait, la ligne
// `-- create function public.f()` dans une note d'intention suffirait à faire
// passer un déploiement : la garde prouverait une intention, pas un objet.
// Les chaînes littérales ne sont pas traitées : une définition entre quotes
// resterait comptée. C'est un écart assumé — il penche vers le REFUS, pas vers
// le laissez-passer, puisqu'il ne peut qu'ajouter des fonctions prouvables sur
// les DEUX arbres à la fois.
function sansCommentairesSql(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}
const RE_APPEL = /\.rpc\(\s*['"`]([A-Za-z0-9_]+)['"`]/g;

function fonctionsDefinies(arbre) {
  const migrations = parcourir(arbre, (f) => f.startsWith('supabase/migrations/') && f.endsWith('.sql'));
  const definies = new Map();
  for (const f of migrations) {
    const txt = sansCommentairesSql(fs.readFileSync(path.join(arbre, f), 'utf8'));
    let m;
    RE_DEFINITION.lastIndex = 0;
    while ((m = RE_DEFINITION.exec(txt)) !== null) {
      if (!definies.has(m[1])) definies.set(m[1], f);
    }
  }
  return { definies, nombreMigrations: migrations.length };
}

function appelsRpc(arbre) {
  const fichiers = parcourir(arbre, (f) => f.endsWith('.html') || f.endsWith('.js'));
  const appels = new Map();
  for (const f of fichiers) {
    const txt = fs.readFileSync(path.join(arbre, f), 'utf8');
    let m;
    RE_APPEL.lastIndex = 0;
    while ((m = RE_APPEL.exec(txt)) !== null) {
      if (!appels.has(m[1])) appels.set(m[1], new Set());
      appels.get(m[1]).add(f);
    }
  }
  return appels;
}

// Lue sur le CANDIDAT : une connaissance datée doit pouvoir lever un avertissement
// sur une cible ancienne. Elle ne déclasse que le préexistant (voir controler),
// donc un candidat ne peut pas s'exempter d'un appel qu'il introduit lui-même.
// Une déclaration incomplète est refusée, pas ignorée. Une entrée sans date ni
// environnement de mesure ne déclare rien : elle fabrique une exemption en
// ayant l'air d'une preuve.
function lireDeclaration(arbre) {
  const p = path.join(arbre, DECLARATION);
  if (!fs.existsSync(p)) return { declarees: new Map(), anomalies: [] };
  let brut;
  try { brut = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) {
    return { declarees: new Map(), anomalies: [{ code: CODES.DECLARATION_NON_RECEVABLE, detail: `${DECLARATION} illisible : ${e.message}` }] };
  }
  const declarees = new Map();
  const anomalies = [];
  const liste = Array.isArray(brut.fonctions) ? brut.fonctions : null;
  if (!liste) {
    anomalies.push({ code: CODES.DECLARATION_NON_RECEVABLE, detail: `${DECLARATION} : champ « fonctions » absent ou non tabulaire.` });
    return { declarees, anomalies };
  }
  for (const [i, e] of liste.entries()) {
    const manquants = ['fonction', 'constatee_le', 'environnement_mesure', 'motif'].filter((c) => !e || typeof e[c] !== 'string' || !e[c].trim());
    if (manquants.length) {
      anomalies.push({ code: CODES.DECLARATION_NON_RECEVABLE, detail: `${DECLARATION} entrée ${i} : champ(s) manquant(s) ou vide(s) — ${manquants.join(', ')}.` });
      continue;
    }
    declarees.set(e.fonction, e);
  }
  return { declarees, anomalies };
}

function controler(options = {}) {
  const racine = options.racine ? path.resolve(options.racine) : RACINE;
  const refCandidat = options.candidat || 'HEAD';
  const refCible = options.cible;

  if (!refCible || !String(refCible).trim()) {
    return {
      ok: false,
      verdict: 'RPC_FRONT_REFUS',
      constats: [{
        severite: SEVERITES.BLOCK,
        code: CODES.CIBLE_NON_DESIGNEE,
        detail: 'Aucune cible de déploiement désignée. Passez --cible <ref> ou NEXUS_RPC_CIBLE. Aucun repli n\'est appliqué : une cible se désigne, elle ne se devine pas.'
      }]
    };
  }

  const shaCandidat = resoudre(racine, refCandidat);
  const shaCible = resoudre(racine, refCible);
  const introuvables = [];
  if (!shaCandidat) introuvables.push(`candidat « ${refCandidat} »`);
  if (!shaCible) introuvables.push(`cible « ${refCible} »`);
  if (introuvables.length) {
    return {
      ok: false,
      verdict: 'RPC_FRONT_REFUS',
      constats: [{ severite: SEVERITES.BLOCK, code: CODES.REF_INTROUVABLE, detail: `Référence(s) non résolue(s) : ${introuvables.join(', ')}.` }]
    };
  }

  const arbreCandidat = extraireArbre(racine, shaCandidat);
  const arbreCible = extraireArbre(racine, shaCible);
  try {
    const appelsCandidat = appelsRpc(arbreCandidat.cible);
    const appelsCible = appelsRpc(arbreCible.cible);
    const { definies, nombreMigrations } = fonctionsDefinies(arbreCible.cible);
    const { declarees, anomalies } = lireDeclaration(arbreCandidat.cible);
    const surLeCandidat = fonctionsDefinies(arbreCandidat.cible).definies;

    const constats = anomalies.map((a) => ({ severite: SEVERITES.BLOCK, ...a }));

    // Une garde qui ne mesure rien doit refuser, pas passer. Zéro migration ou
    // zéro appel veut dire que le motif a dérivé ou que l'arbre n'est pas celui
    // qu'on croit — dans les deux cas le vert serait un vert par défaut.
    if (nombreMigrations === 0) {
      constats.push({ severite: SEVERITES.BLOCK, code: CODES.MESURE_IMPOSSIBLE_MIGRATIONS, detail: `Aucune migration lue sur la cible ${refCible}. La garde ne peut rien prouver : refus.` });
    }
    if (appelsCandidat.size === 0) {
      constats.push({ severite: SEVERITES.BLOCK, code: CODES.MESURE_IMPOSSIBLE_APPELS, detail: `Aucun appel « .rpc("…") » trouvé sur le candidat ${refCandidat}. Motif de détection probablement dérivé : refus.` });
    }

    for (const [nom, fichiers] of [...appelsCandidat].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (definies.has(nom)) continue;

      const ecrans = [...fichiers].filter(estEcranReel).sort();
      const tous = [...fichiers].sort();
      const nouveau = !appelsCible.has(nom);
      const declaree = declarees.get(nom);
      const migrationCandidat = surLeCandidat.get(nom);

      // LE CAS DÉCISIF, et le seul qui dise quoi faire : une définition
      // canonique existe sur le candidat, et la cible ne l'a pas. Que l'appel
      // soit neuf ou déjà en place ne change rien — c'est #65, à venir ou en
      // cours. L'âge de l'appel ne fait pas la gravité : une moitié d'ordre
      // non exécutée reste non exécutée le lendemain.
      if (migrationCandidat && ecrans.length) {
        constats.push({
          severite: SEVERITES.BLOCK,
          code: CODES.MIGRATION_CANONIQUE_NON_APPLIQUEE,
          fonction: nom,
          migration: migrationCandidat,
          detail: `${nom} — appelée par ${ecrans.join(', ')}, non prouvable sur ${refCible}. Le candidat porte « ${path.basename(migrationCandidat)} » qui la crée : CETTE MIGRATION DOIT ÊTRE APPLIQUÉE À LA CIBLE AVANT le déploiement. ${nouveau ? 'Appel introduit par ce candidat.' : 'Appel DÉJÀ présent sur la cible : si l\'écran est en panne aujourd\'hui, c\'est cette migration qui manque.'}`
        });
        continue;
      }

      if (nouveau && ecrans.length) {
        constats.push({
          severite: SEVERITES.BLOCK,
          code: CODES.RPC_INTROUVABLE_SUR_LA_CIBLE,
          fonction: nom,
          detail: `${nom} — appel INTRODUIT par ce candidat (${ecrans.join(', ')}), non prouvable sur ${refCible}, et aucune migration du dépôt ne la crée : la fonction n'existe nulle part. L'écran appellerait dans le vide.`
        });
        continue;
      }

      if (declaree && !nouveau) {
        constats.push({
          severite: SEVERITES.INFO,
          code: CODES.RPC_HORS_BANDE_DECLAREE,
          fonction: nom,
          detail: `${nom} — aucune migration au dépôt, mais déclarée hors-bande (constatée le ${declaree.constatee_le} sur ${declaree.environnement_mesure}). ${declaree.motif}`
        });
        continue;
      }

      constats.push({
        severite: SEVERITES.WARN,
        code: CODES.RPC_INTROUVABLE_SUR_LA_CIBLE,
        fonction: nom,
        detail: nouveau
          ? `${nom} — appel introduit par ce candidat, mais par de l'outillage seulement (${tous.join(', ')}). Non prouvable sur ${refCible} : un outil cassé n'arrête pas un déploiement.`
          : `${nom} — appel PRÉEXISTANT sur ${refCible} (${tous.join(', ')}), non prouvable au dépôt et non déclaré. Si l'écran fonctionne, la fonction est en base hors-bande : à DÉCLARER dans ${DECLARATION}, pas à refermer.`
      });
    }

    const bloquants = constats.filter((c) => c.severite === SEVERITES.BLOCK);
    return {
      ok: bloquants.length === 0,
      verdict: bloquants.length === 0 ? 'RPC_FRONT_CONFORME' : 'RPC_FRONT_REFUS',
      candidat: { ref: refCandidat, sha: shaCandidat },
      cibleMesuree: { ref: refCible, sha: shaCible, migrations: nombreMigrations, fonctions: definies.size, declarees: declarees.size },
      appels: appelsCandidat.size,
      constats
    };
  } finally {
    fs.rmSync(arbreCandidat.dir, { recursive: true, force: true });
    fs.rmSync(arbreCible.dir, { recursive: true, force: true });
  }
}

// Une option non reconnue n'est pas ignorée : ignorée en silence, elle laisse
// croire que le verdict porte sur ce qu'on a demandé.
function lireArguments(argv) {
  const opts = {
    candidat: process.env.NEXUS_RPC_CANDIDAT || 'HEAD',
    cible: process.env.NEXUS_RPC_CIBLE || null
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--candidat' || a === '--cible') {
      const v = argv[i + 1];
      if (!v || v.startsWith('--')) return { code: CODES.OPTION_SANS_VALEUR, erreur: `L'option ${a} attend une valeur.` };
      opts[a === '--candidat' ? 'candidat' : 'cible'] = v;
      i += 1;
      continue;
    }
    return { code: CODES.OPTION_INCONNUE, erreur: `Option inconnue : « ${a} ». Formes acceptées : --candidat <ref> --cible <ref>.` };
  }
  return { opts };
}

if (require.main === module) {
  const lu = lireArguments(process.argv.slice(2));
  if (lu.erreur) {
    console.error(`REFUS [${lu.code}] ${lu.erreur}`);
    process.exit(1);
  }
  const r = controler(lu.opts);
  console.log('── Garde RPC front / cible ─────────────────────────────────────');
  if (r.cibleMesuree) {
    console.log(`  candidat : ${r.candidat.ref} (${r.candidat.sha.slice(0, 12)}) — ${r.appels} RPC appelée(s)`);
    console.log(`  cible    : ${r.cibleMesuree.ref} (${r.cibleMesuree.sha.slice(0, 12)}) — ${r.cibleMesuree.migrations} migration(s), ${r.cibleMesuree.fonctions} fonction(s) prouvable(s), ${r.cibleMesuree.declarees} déclarée(s) hors-bande`);
  }
  console.log('');
  for (const ordre of [SEVERITES.BLOCK, SEVERITES.WARN, SEVERITES.INFO]) {
    for (const c of r.constats.filter((x) => x.severite === ordre)) {
      console.log(`  [${c.severite}] ${c.detail}`);
    }
  }
  if (!r.constats.length) console.log('  Aucun écart : chaque RPC appelée est créée par une migration de la cible.');
  console.log('');
  console.log(`VERDICT : ${r.verdict}`);
  process.exit(r.ok ? 0 : 1);
}

module.exports = { controler, appelsRpc, fonctionsDefinies, estEcranReel, sansCommentairesSql, lireArguments, SEVERITES, CODES, DECLARATION };
