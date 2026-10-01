#!/usr/bin/env node
'use strict';
// Garde ORDRE-MIGRATION-CODE — « une PR qui introduit une migration dont le
// code dépend ne peut pas être déclarée prête à fusionner tant que l'état de
// la base cible et l'ordre `migration → code` n'ont pas été explicitement
// qualifiés. »
//
// POURQUOI CETTE GARDE EXISTE. Le 30/09/2026, la PR #65 était verte sur toutes
// ses gates et déclarée prête. Elle introduisait
// `20260919103000_carburant_reception_regularisation_releve_manuscrit.sql`, et
// son écran envoie `mode_saisie` et `source` SANS CONDITION à chaque
// enregistrement de réception. Fusionner le code avant d'appliquer la
// migration n'aurait pas dégradé une fonction nouvelle : cela aurait cassé
// TOUTE réception de carburant en Production. Rien, dans aucune gate, ne
// mesurait cet ordre. `deploiement-production.yml` ne prononce le mot
// « migration » qu'une fois, en prose.
//
// CE QUE LA MESURE DU 30/09 A APPRIS, ET QUI EST CÂBLÉ ICI. On a d'abord
// conclu « la migration n'est pas appliquée » en lisant le registre
// `supabase_migrations.schema_migrations`. Puis le schéma de Test a été
// interrogé : les sept colonnes, les deux contraintes, la fonction et le
// trigger étaient TOUS là — alors que l'estampille 20260919103000 est ABSENTE
// du registre de Test. Et 286 des 287 lignes de ce registre ont `statements` à
// NULL : chercher du DDL dedans ne prouve rien.
//
//   → Un registre dit ce qu'un outil a bien voulu y inscrire.
//     Seul le CATALOGUE dit ce qui existe.
//
// C'est pourquoi cette garde REFUSE une qualification dont la mesure vient du
// registre seul. Ce n'est pas un excès de zèle : c'est exactement l'erreur que
// nous avons commise, mécanisée pour ne pas la recommettre.
//
// ET POURQUOI « DÉJÀ APPLIQUÉE » NE DISPENSE PAS DE MESURER. La migration #65
// est idempotente (`add column if not exists`, `exception when
// duplicate_object`, `create or replace`, `drop trigger if exists`). On pourrait
// croire que l'état inconnu est sans danger puisqu'un rejeu ne casse rien.
// C'est l'inverse : `if not exists` passe en SILENCE sur une colonne qui existe
// déjà AVEC UNE AUTRE DÉFINITION. L'idempotence ne rend pas l'état inconnu
// sûr — elle le rend MUET. D'où « état inconnu = refus fermé ».
//
// LES CINQ ÉTATS, et ce que la garde exige de chacun :
//
//   migration_deja_appliquee
//       mesure sur le catalogue + `objets_constates` citant chaque objet que
//       la migration crée. Une affirmation nue est refusée.
//   additive_compatible_avant_code
//       aucun DDL destructif, et le code de la CIBLE ne nomme aucun des
//       identifiants introduits (sinon la cible est déjà dépendante : ce
//       n'est plus un choix d'ordre, c'est une panne en cours).
//   exige_code_d_abord
//       `procedure` désignant un fichier qui existe. L'ordre inverse ne
//       s'improvise pas dans un champ de texte.
//   atomique_ou_procedure_speciale
//       idem : `procedure` existante. Exigé d'office dès qu'un DDL destructif
//       est détecté.
//   etat_inconnu  (et tout état absent, vide ou non reconnu)
//       REFUS FERMÉ. C'est le défaut par construction.
//
// CE QU'ELLE NE FAIT PAS. Elle ne se connecte à aucune base, ne lit aucun
// secret, n'exécute aucun SQL, ne touche à rien. Elle lit des refs Git et un
// fichier de qualification, et sort 0 ou 1. La mesure du catalogue est un
// geste humain ou de CI ; la garde vérifie seulement qu'il a été fait, qu'il
// portait sur le bon objet et qu'il est récent.
//
//   node outils/garde-ordre-migration-code.js <ref-candidate> <ref-cible>
//
// Variables d'environnement :
//   NEXUS_DEPOT                répertoire du dépôt (défaut : racine du projet)
//   NEXUS_QUALIFICATION        chemin du fichier de qualification
//                              (défaut : docs/deploiement/qualification-ordre-migration-code.json)
//   NEXUS_QUALIFICATION_HEURES fraîcheur maximale d'une mesure (défaut : 72)
//
// FORME DU FICHIER DE QUALIFICATION :
//   {
//     "migrations": {
//       "20260919103000": {
//         "etat": "additive_compatible_avant_code",
//         "mesure": {
//           "source": "catalogue",          // "registre" seul = REFUS
//           "le": "2026-09-30T14:00:00Z",
//           "cible": "uzhjpqpctpvxytxpxoqz",
//           "par": "frederic"
//         },
//         "objets_constates": ["mode_saisie", "..."],   // si deja_appliquee
//         "procedure": "docs/deploiement/....md",       // si code_d_abord / atomique
//         "justification": "une phrase qui dit pourquoi"
//       }
//     }
//   }

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = process.env.NEXUS_DEPOT || path.resolve(__dirname, '..');
const FICHIER_DEFAUT = path.join('docs', 'deploiement', 'qualification-ordre-migration-code.json');

const ETATS = {
  DEJA_APPLIQUEE: 'migration_deja_appliquee',
  ADDITIVE_AVANT_CODE: 'additive_compatible_avant_code',
  EXIGE_CODE_D_ABORD: 'exige_code_d_abord',
  ATOMIQUE: 'atomique_ou_procedure_speciale',
  INCONNU: 'etat_inconnu',
};
const ETATS_RECONNUS = new Set(Object.values(ETATS));

// Une mesure prise sur le registre des migrations ne qualifie RIEN : mesuré le
// 30/09/2026 sur Test, schéma complet et estampille absente.
const SOURCES_DE_MESURE_ACCEPTEES = new Set(['catalogue', 'schema', 'schéma']);

function git(args, depot) {
  return execFileSync('git', ['-C', depot || RACINE, ...args], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
}

function gitTolerant(args, depot) {
  try { return git(args, depot); } catch { return ''; }
}

// Ensembles, jamais des cardinaux : le 30/09, compter 277 contre 276 avait
// laissé croire à un écart d'un fichier sans dire LEQUEL.
function migrationsDe(ref, depot) {
  const sortie = gitTolerant(['ls-tree', '-r', '--name-only', ref, 'supabase/migrations/'], depot);
  return sortie.split('\n').filter(Boolean);
}

function estampilleDe(chemin) {
  const m = /\/(\d{14})_/.exec(chemin);
  return m ? m[1] : null;
}

const MOTIFS_OBJETS = [
  ['colonne',    /\badd\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi],
  ['contrainte', /\badd\s+constraint\s+([a-z_][a-z0-9_]*)/gi],
  ['fonction',   /\bcreate\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi],
  ['trigger',    /\bcreate\s+(?:constraint\s+)?trigger\s+([a-z_][a-z0-9_]*)/gi],
  ['table',      /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi],
  ['vue',        /\bcreate\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi],
  ['policy',     /\bcreate\s+policy\s+([a-z_][a-z0-9_]*)/gi],
];

// Un `drop trigger if exists X` suivi d'un `create trigger X` dans le MÊME
// fichier est un remplacement, pas une destruction. Une garde qui crie au loup
// là-dessus serait désactivée dans la semaine, et une garde désactivée
// protège moins que pas de garde : elle rassure.
const MOTIFS_DESTRUCTIFS = [
  ['drop_column',   /\bdrop\s+column\b/i],
  ['drop_table',    /\bdrop\s+table\b/i],
  ['alter_type',    /\balter\s+column\s+[a-z_][a-z0-9_]*\s+(?:set\s+data\s+)?type\b/i],
  ['set_not_null',  /\balter\s+column\s+[a-z_][a-z0-9_]*\s+set\s+not\s+null\b/i],
  ['rename',        /\brename\s+(?:column|to|constraint)\b/i],
  ['truncate',      /\btruncate\b/i],
  ['delete_from',   /\bdelete\s+from\b/i],
];

function extraireObjets(sql) {
  const objets = [];
  for (const [genre, motif] of MOTIFS_OBJETS) {
    // Un littéral global porte son `lastIndex` : on le reconstruit à chaque
    // usage plutôt que de le partager entre deux fichiers.
    const re = new RegExp(motif.source, motif.flags);
    let m;
    while ((m = re.exec(sql)) !== null) objets.push({ genre, nom: m[1] });
  }

  const recrees = new Set(objets.map(o => o.nom.toLowerCase()));
  const destructifs = [];
  for (const [code, motif] of MOTIFS_DESTRUCTIFS) {
    if (!motif.test(sql)) continue;
    if (code === 'drop_column' || code === 'drop_table') { destructifs.push(code); continue; }
    destructifs.push(code);
  }
  for (const genre of ['trigger', 'policy', 'fonction', 'vue']) {
    const re = new RegExp('\\bdrop\\s+' + (genre === 'fonction' ? 'function' : genre === 'vue' ? 'view' : genre)
      + '\\s+(?:if\\s+exists\\s+)?(?:public\\.)?([a-z_][a-z0-9_]*)', 'gi');
    let m;
    while ((m = re.exec(sql)) !== null) {
      if (!recrees.has(m[1].toLowerCase())) destructifs.push('drop_' + genre + ':' + m[1]);
    }
  }

  // Une colonne NOT NULL sans défaut échoue sur une table non vide : ce n'est
  // pas « additif », c'est une procédure.
  const sansDefaut = [];
  const reNN = /\badd\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)([^,;]*)/gi;
  let n;
  while ((n = reNN.exec(sql)) !== null) {
    const suite = n[2] || '';
    if (/\bnot\s+null\b/i.test(suite) && !/\bdefault\b/i.test(suite)) sansDefaut.push(n[1]);
  }

  return { objets, destructifs: [...new Set(destructifs)], colonnesNotNullSansDefaut: sansDefaut };
}

function codeQuiNomme(ref, identifiants, depot) {
  const trouves = [];
  for (const id of identifiants) {
    const sortie = gitTolerant(
      ['grep', '-l', '-F', '-e', id, ref, '--', '*.html', '*.js'], depot);
    const fichiers = sortie.split('\n').filter(Boolean);
    if (fichiers.length) trouves.push({ identifiant: id, fichiers });
  }
  return trouves;
}

function lireQualification(chemin) {
  if (!fs.existsSync(chemin)) return { absent: true, migrations: {} };
  let brut;
  try { brut = JSON.parse(fs.readFileSync(chemin, 'utf8')); }
  catch (e) { return { illisible: String(e.message), migrations: {} }; }
  const migrations = (brut && typeof brut.migrations === 'object' && brut.migrations) || {};
  return { migrations };
}

function mesureValide(mesure, maintenant, heures) {
  if (!mesure || typeof mesure !== 'object') return { ok: false, code: 'MESURE_ABSENTE' };
  const source = String(mesure.source || '').toLowerCase().trim();
  if (!source) return { ok: false, code: 'MESURE_ABSENTE' };
  if (!SOURCES_DE_MESURE_ACCEPTEES.has(source)) {
    return { ok: false, code: 'MESURE_NON_RECEVABLE', source };
  }
  const le = Date.parse(mesure.le || '');
  if (!Number.isFinite(le)) return { ok: false, code: 'MESURE_SANS_DATE' };
  const ageHeures = (maintenant - le) / 3600000;
  if (ageHeures > heures) return { ok: false, code: 'MESURE_PERIMEE', ageHeures: Math.round(ageHeures) };
  if (ageHeures < -1) return { ok: false, code: 'MESURE_DANS_LE_FUTUR' };
  if (!String(mesure.cible || '').trim()) return { ok: false, code: 'MESURE_SANS_CIBLE' };
  return { ok: true, ageHeures: Math.round(ageHeures) };
}

function classer({ estampille, fiche, analyse, nommePar, nommeParCible, racine, maintenant, heures }) {
  const sortie = { estampille, etat: null, refus: null, notes: [] };
  if (!fiche || typeof fiche !== 'object') {
    sortie.refus = { code: 'MIGRATION_NON_QUALIFIEE' };
    return sortie;
  }
  const etat = String(fiche.etat || '').toLowerCase().trim();
  sortie.etat = etat || '(absent)';
  if (!etat || etat === ETATS.INCONNU) {
    sortie.refus = { code: 'ETAT_INCONNU' };
    return sortie;
  }
  if (!ETATS_RECONNUS.has(etat)) {
    sortie.refus = { code: 'ETAT_NON_RECONNU', etat };
    return sortie;
  }

  const m = mesureValide(fiche.mesure, maintenant, heures);
  if (!m.ok) { sortie.refus = m; return sortie; }
  sortie.notes.push('mesure sur « ' + fiche.mesure.source + ' », ' + m.ageHeures + ' h, cible ' + fiche.mesure.cible);

  const procedureExigee = (etat === ETATS.EXIGE_CODE_D_ABORD || etat === ETATS.ATOMIQUE);
  if (procedureExigee) {
    const p = String(fiche.procedure || '').trim();
    if (!p) { sortie.refus = { code: 'PROCEDURE_ABSENTE', etat }; return sortie; }
    if (!fs.existsSync(path.resolve(racine, p))) {
      sortie.refus = { code: 'PROCEDURE_INTROUVABLE', procedure: p }; return sortie;
    }
    sortie.notes.push('procédure : ' + p);
  }

  if (analyse.destructifs.length && etat === ETATS.ADDITIVE_AVANT_CODE) {
    sortie.refus = { code: 'ADDITIVE_IMPOSSIBLE_DDL_DESTRUCTIF', destructifs: analyse.destructifs };
    return sortie;
  }
  if (analyse.colonnesNotNullSansDefaut.length && etat === ETATS.ADDITIVE_AVANT_CODE) {
    sortie.refus = { code: 'ADDITIVE_IMPOSSIBLE_NOT_NULL_SANS_DEFAUT', colonnes: analyse.colonnesNotNullSansDefaut };
    return sortie;
  }

  if (etat === ETATS.ADDITIVE_AVANT_CODE && nommeParCible.length) {
    sortie.refus = {
      code: 'CIBLE_DEJA_DEPENDANTE',
      identifiants: nommeParCible.map(t => t.identifiant),
      fichiers: [...new Set(nommeParCible.flatMap(t => t.fichiers))].slice(0, 6),
    };
    return sortie;
  }

  if (etat === ETATS.DEJA_APPLIQUEE) {
    const attendus = analyse.objets.map(o => o.nom.toLowerCase());
    const constates = new Set((fiche.objets_constates || []).map(s => String(s).toLowerCase()));
    const manquants = [...new Set(attendus)].filter(a => !constates.has(a));
    if (manquants.length) {
      sortie.refus = { code: 'OBJETS_NON_CONSTATES', manquants };
      return sortie;
    }
    sortie.notes.push(attendus.length + ' objet(s) constaté(s) un par un');
  }

  if (etat === ETATS.EXIGE_CODE_D_ABORD && nommePar.length === 0) {
    sortie.notes.push('AVERTISSEMENT — aucun code du candidat ne nomme les objets de cette migration : « code d’abord » est peu vraisemblable, la procédure doit le justifier.');
  }
  if (etat === ETATS.ADDITIVE_AVANT_CODE && nommePar.length) {
    sortie.notes.push('le code du candidat dépend de ' + nommePar.length
      + ' identifiant(s) : l’ordre est donc STRICT, migration puis code.');
  }
  return sortie;
}

// Noms d'options reconnus. Une clé hors de cette liste n'est pas tolérée : la
// garde a déjà rendu un REFUS plausible pour avoir reçu `candidat` au lieu de
// `candidate` — l'option inconnue était ignorée en silence, le candidat
// retombait sur `HEAD`, et le rouge obtenu ne parlait pas de la PR jugée. Un
// verdict pour la mauvaise raison coûte plus cher qu'une panne : un appel mal
// nommé doit donc être incapable de produire un verdict, vert OU rouge.
const OPTIONS_RECONNUES = new Set([
  'candidat', 'candidate', 'cible', 'depot', 'qualification', 'maintenant', 'heures',
]);

function controler(options = {}) {
  const inconnues = Object.keys(options).filter(k => !OPTIONS_RECONNUES.has(k));
  if (inconnues.length) {
    throw new Error('garde-ordre-migration-code : option(s) non reconnue(s) : '
      + inconnues.join(', ') + '. Attendu : ' + [...OPTIONS_RECONNUES].join(', ')
      + '. Refus d\u2019\u00e9mettre un verdict sur un appel mal nomm\u00e9.');
  }
  const { candidat, candidate, cible, depot, qualification, maintenant, heures } = options;
  if (candidat !== undefined && candidate !== undefined && candidat !== candidate) {
    throw new Error('garde-ordre-migration-code : `candidat` et `candidate` re\u00e7us '
      + 'avec des valeurs diff\u00e9rentes (' + candidat + ' / ' + candidate
      + '). Un candidat ne se devine pas entre deux orthographes.');
  }
  const racine = depot || RACINE;
  const refCandidate = candidat || candidate || 'HEAD';
  const refCible = cible || 'origin/production';
  const fichier = qualification
    || process.env.NEXUS_QUALIFICATION
    || path.join(racine, FICHIER_DEFAUT);
  const maxHeures = Number(heures || process.env.NEXUS_QUALIFICATION_HEURES || 72);
  const instant = maintenant || Date.now();

  const surCandidate = new Set(migrationsDe(refCandidate, racine));
  const surCible = new Set(migrationsDe(refCible, racine));
  const nouvelles = [...surCandidate].filter(f => !surCible.has(f)).sort();
  const retirees = [...surCible].filter(f => !surCandidate.has(f)).sort();

  const lignes = [];
  lignes.push('── Garde ORDRE-MIGRATION-CODE ' + '─'.repeat(42));
  lignes.push('  candidat : ' + refCandidate + '   cible : ' + refCible);
  lignes.push('  migrations : candidat ' + surCandidate.size + ', cible ' + surCible.size
    + ' — ' + nouvelles.length + ' nouvelle(s), ' + retirees.length + ' retirée(s)');

  if (retirees.length) {
    lignes.push('');
    lignes.push('  REFUS — des migrations de la cible ont DISPARU du candidat :');
    retirees.slice(0, 8).forEach(f => lignes.push('    · ' + path.basename(f)));
    lignes.push('    Un candidat doit être un sur-ensemble de sa cible.');
    return { ok: false, code: 'MIGRATION_RETIREE', fichiers: retirees, message: lignes.join('\n') };
  }

  if (!nouvelles.length) {
    lignes.push('');
    lignes.push('  Aucune migration nouvelle : l’ordre migration → code ne se pose pas.');
    return { ok: true, code: 'AUCUNE_MIGRATION_NOUVELLE', migrations: [], message: lignes.join('\n') };
  }

  const q = lireQualification(fichier);
  if (q.illisible) {
    lignes.push('');
    lignes.push('  REFUS — fichier de qualification illisible : ' + q.illisible);
    lignes.push('  Une référence illisible ne conclut RIEN, elle ne vaut pas « conforme ».');
    return { ok: false, code: 'QUALIFICATION_ILLISIBLE', message: lignes.join('\n') };
  }

  const resultats = [];
  for (const chemin of nouvelles) {
    const estampille = estampilleDe(chemin);
    const sql = gitTolerant(['show', refCandidate + ':' + chemin], racine);
    const analyse = extraireObjets(sql);
    const identifiants = [...new Set(analyse.objets.map(o => o.nom))];
    const nommePar = codeQuiNomme(refCandidate, identifiants, racine);
    const nommeParCible = codeQuiNomme(refCible, identifiants, racine);
    const fiche = estampille ? q.migrations[estampille] : null;
    const verdict = classer({
      estampille, fiche, analyse, nommePar, nommeParCible,
      racine, maintenant: instant, heures: maxHeures,
    });
    resultats.push({ chemin, estampille, analyse, nommePar, nommeParCible, ...verdict });
  }

  for (const r of resultats) {
    lignes.push('');
    lignes.push('  ' + path.basename(r.chemin));
    lignes.push('    objets : ' + (r.analyse.objets.length
      ? r.analyse.objets.map(o => o.genre + ' ' + o.nom).join(', ')
      : '(aucun identifiant extrait)'));
    if (r.analyse.destructifs.length) lignes.push('    DDL destructif : ' + r.analyse.destructifs.join(', '));
    lignes.push('    code du candidat qui en dépend : ' + (r.nommePar.length
      ? r.nommePar.map(t => t.identifiant).join(', ') : '(aucun)'));
    lignes.push('    état déclaré : ' + r.etat);
    r.notes.forEach(n => lignes.push('      · ' + n));
    if (r.refus) lignes.push('    REFUS [' + r.refus.code + '] ' + explique(r.refus));
  }

  const refuses = resultats.filter(r => r.refus);
  lignes.push('');
  if (refuses.length) {
    lignes.push('  ' + refuses.length + ' migration(s) non qualifiée(s) — cette PR ne peut pas être'
      + ' déclarée prête à fusionner.');
    lignes.push('  Qualification attendue dans : ' + path.relative(racine, fichier));
    return { ok: false, code: refuses[0].refus.code, migrations: resultats, message: lignes.join('\n') };
  }
  lignes.push('  Ordre migration → code qualifié pour ' + resultats.length + ' migration(s).');
  return { ok: true, code: 'QUALIFIE', migrations: resultats, message: lignes.join('\n') };
}

function explique(refus) {
  switch (refus.code) {
    case 'MIGRATION_NON_QUALIFIEE':
      return 'aucune fiche pour cette estampille. État inconnu = refus fermé.';
    case 'ETAT_INCONNU':
      return 'état déclaré inconnu. C’est un refus, pas une attente.';
    case 'ETAT_NON_RECONNU':
      return '« ' + refus.etat + ' » n’est pas un des cinq états.';
    case 'MESURE_ABSENTE':
      return 'l’état de la base cible n’a pas été mesuré.';
    case 'MESURE_NON_RECEVABLE':
      return 'mesure prise sur « ' + refus.source + ' ». Le registre des migrations ne '
        + 'qualifie pas un schéma : mesuré le 30/09/2026, Test portait les objets et pas '
        + 'l’estampille, et 286/287 lignes du registre ont statements à NULL. '
        + 'Source attendue : catalogue.';
    case 'MESURE_SANS_DATE':   return 'mesure sans date : une mesure est datée ou n’est pas une mesure.';
    case 'MESURE_PERIMEE':     return 'mesure vieille de ' + refus.ageHeures + ' h. Une base bouge.';
    case 'MESURE_DANS_LE_FUTUR': return 'mesure datée dans le futur.';
    case 'MESURE_SANS_CIBLE':  return 'mesure sans cible : on ne sait pas QUELLE base a été lue.';
    case 'PROCEDURE_ABSENTE':  return 'l’état « ' + refus.etat + ' » exige une procédure écrite.';
    case 'PROCEDURE_INTROUVABLE': return 'procédure déclarée mais absente du dépôt : ' + refus.procedure;
    case 'ADDITIVE_IMPOSSIBLE_DDL_DESTRUCTIF':
      return 'déclarée additive alors qu’elle contient : ' + refus.destructifs.join(', ');
    case 'ADDITIVE_IMPOSSIBLE_NOT_NULL_SANS_DEFAUT':
      return 'colonne(s) NOT NULL sans défaut : ' + refus.colonnes.join(', ')
        + ' — échoue sur une table non vide.';
    case 'CIBLE_DEJA_DEPENDANTE':
      return 'le code DÉJÀ en cible nomme ' + refus.identifiants.join(', ')
        + ' (' + refus.fichiers.join(', ') + ') : la cible est déjà dépendante, '
        + 'ce n’est pas un choix d’ordre mais une panne en cours.';
    case 'OBJETS_NON_CONSTATES':
      return 'déclarée déjà appliquée sans avoir constaté : ' + refus.manquants.join(', ');
    default: return '';
  }
}

module.exports = { controler, extraireObjets, classer, mesureValide, ETATS };

if (require.main === module) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const r = controler({ candidate: args[0], cible: args[1] });
  if (r.ok) { console.log(r.message); process.exit(0); }
  console.error(r.message);
  process.exit(1);
}
