#!/usr/bin/env node
'use strict';
// Briefing d'agent — rendre lisible la mémoire que personne ne lisait.
//
// POURQUOI. Le 07/09/2026, trois agents ont produit du bon travail parce que
// leurs consignes contenaient, RECOPIÉES À LA MAIN, les leçons durement
// apprises de la journée : calibrer un détecteur sur le vrai dépôt avant de le
// câbler, vérifier qu'une mutation a réellement mordu avant de lire son
// résultat. Le troisième a appliqué la seconde à une hypothèse de Claude et a
// évité d'optimiser le mauvais endroit.
//
// Or ces leçons vivent déjà dans `docs/learning/RULES.json`, gardé
// mécaniquement par `outils/verifier-apprentissage.js`. Le manque n'était pas
// un système de mémoire : c'était que personne ne la lisait au démarrage. Cet
// outil rend le briefing depuis les fichiers canoniques, pour qu'un agent
// reçoive la mémoire du projet sans qu'un humain la retape.
//
// CE QU'IL NE FAIT PAS — et c'est délibéré :
//
//   Il ne reformule aucune règle. Il rend le TEXTE de `RULES.json`, à la
//   virgule près. Un outil qui paraphraserait la mémoire deviendrait une
//   seconde vérité, et la première divergence passerait inaperçue (ARCH-001).
//
//   Il n'invente aucune règle absente des fichiers. Une leçon qui mérite
//   d'être transmise se PROMEUT dans `RULES.json` (GOV-002), elle ne se code
//   pas ici.
//
// POURQUOI IL FILTRE. Un briefing qui déverse seize règles se survole. Un
// agent qui travaille sur les Carburants n'a pas besoin des règles de
// handoff ; celui qui écrit un détecteur a besoin de QA-002 et QA-003, pas de
// CARB-001. Le filtrage par portée n'est pas du confort, c'est ce qui décide
// qu'une règle sera lue ou sautée.
//
// POURQUOI IL JOINT LES INCIDENTS. Une règle sans son histoire s'écarte
// facilement — « ça ne s'applique sans doute pas à mon cas ». La même règle
// accompagnée de l'incident qui l'a produite se discute autrement. Chaque
// règle promue depuis `EXPERIENCE.jsonl` est donc rendue avec le fait qui l'a
// engendrée.
//
//   node outils/briefing-agent.js                          # tout
//   node outils/briefing-agent.js --portee qa,development   # ciblé
//   node outils/briefing-agent.js --module carburants-performance
//   node outils/briefing-agent.js --severite blocking
//   node outils/briefing-agent.js --portee qa --json        # pour un outil

const fs = require('fs');
const path = require('path');

const RACINE = process.env.NEXUS_DEPOT ? path.resolve(process.env.NEXUS_DEPOT) : path.resolve(__dirname, '..');
const RULES = path.join(RACINE, 'docs', 'learning', 'RULES.json');
const EXPERIENCE = path.join(RACINE, 'docs', 'learning', 'EXPERIENCE.jsonl');

// Le rang de sévérité n'est pas cosmétique : ce qui bloque doit être lu en
// premier, parce qu'un briefing se lit rarement jusqu'au bout.
const RANG_SEVERITE = { blocking: 0, human_gate: 1, business: 2, advisory: 3 };

function lireRegles() {
  if (!fs.existsSync(RULES)) return { erreur: `RULES.json introuvable : ${RULES}`, regles: [] };
  let doc;
  try { doc = JSON.parse(fs.readFileSync(RULES, 'utf8')); }
  catch (e) { return { erreur: `RULES.json illisible : ${e.message}`, regles: [] }; }
  return { regles: Array.isArray(doc.rules) ? doc.rules : [], majLe: doc.updated_at || null };
}

// Une ligne illisible n'est pas ignorée en silence : elle est comptée et
// signalée. Un briefing qui perd discrètement une leçon est pire qu'un
// briefing absent — on croit avoir tout reçu.
function lireExperiences() {
  if (!fs.existsSync(EXPERIENCE)) return { entrees: [], illisibles: 0 };
  const entrees = [];
  let illisibles = 0;
  for (const ligne of fs.readFileSync(EXPERIENCE, 'utf8').split('\n')) {
    if (!ligne.trim()) continue;
    try { entrees.push(JSON.parse(ligne)); } catch (e) { illisibles++; }
  }
  return { entrees, illisibles };
}

function selectionner(regles, { portee, module: mod, severite } = {}) {
  return regles.filter(r => {
    if (portee && portee.length) {
      const scopes = Array.isArray(r.scope) ? r.scope : [];
      if (!portee.some(p => scopes.includes(p))) return false;
    }
    // `module: 'all'` s'applique partout — l'exclure quand on cible un module
    // reviendrait à masquer précisément les règles transversales, celles qui
    // valent pour tout le dépôt.
    if (mod && r.module !== 'all' && r.module !== mod) return false;
    if (severite && r.severity !== severite) return false;
    return true;
  }).sort((a, b) => {
    const d = (RANG_SEVERITE[a.severity] ?? 9) - (RANG_SEVERITE[b.severity] ?? 9);
    return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
  });
}

function incidentsParRegle(entrees) {
  const parRegle = new Map();
  for (const e of entrees) {
    if (!e.promoted_rule) continue;
    if (!parRegle.has(e.promoted_rule)) parRegle.set(e.promoted_rule, []);
    parRegle.get(e.promoted_rule).push(e);
  }
  return parRegle;
}

function construire(options = {}) {
  const { erreur, regles, majLe } = lireRegles();
  const { entrees, illisibles } = lireExperiences();
  const retenues = selectionner(regles, options);
  const incidents = incidentsParRegle(entrees);
  return {
    erreur: erreur || null,
    majLe,
    total: regles.length,
    retenues: retenues.map(r => ({ ...r, incidents: incidents.get(r.id) || [] })),
    experiencesIllisibles: illisibles,
  };
}

function rendre(b, options = {}) {
  const lignes = [];
  if (b.erreur) {
    // Fail-closed : un briefing vide qui se présente comme complet ferait
    // travailler un agent en croyant connaître les règles du projet.
    lignes.push('# Briefing NEXUS — INDISPONIBLE', '', b.erreur, '',
      'Ne pas poursuivre en supposant qu\'il n\'y a pas de règle : il y en a, elles sont illisibles.');
    return lignes.join('\n');
  }
  const filtres = [];
  if (options.portee && options.portee.length) filtres.push(`portée ${options.portee.join(', ')}`);
  if (options.module) filtres.push(`module ${options.module}`);
  if (options.severite) filtres.push(`sévérité ${options.severite}`);

  lignes.push('# Briefing NEXUS — mémoire du projet');
  lignes.push('');
  lignes.push(`${b.retenues.length} règle(s) sur ${b.total}` +
    (filtres.length ? ` — ${filtres.join(' · ')}` : ' — aucun filtre') +
    (b.majLe ? ` · registre au ${b.majLe}` : ''));
  lignes.push('');
  lignes.push('Rendu depuis `docs/learning/RULES.json` et `EXPERIENCE.jsonl`, sans reformulation.');
  lignes.push('Une leçon qui manque ici se promeut dans ces fichiers (GOV-002), pas dans un prompt.');

  if (b.experiencesIllisibles) {
    lignes.push('');
    lignes.push(`⚠ ${b.experiencesIllisibles} entrée(s) d'EXPERIENCE.jsonl illisible(s) — des leçons manquent à ce briefing.`);
  }

  if (!b.retenues.length) {
    lignes.push('', 'Aucune règle ne correspond à ce filtre. Élargir la portée plutôt que conclure qu\'il n\'y a rien à respecter.');
    return lignes.join('\n');
  }

  let severiteCourante = null;
  for (const r of b.retenues) {
    if (r.severity !== severiteCourante) {
      severiteCourante = r.severity;
      lignes.push('', `## ${severiteCourante}`);
    }
    lignes.push('');
    lignes.push(`### ${r.id} — ${(Array.isArray(r.scope) ? r.scope : []).join(', ')}${r.module && r.module !== 'all' ? ` · ${r.module}` : ''}`);
    lignes.push('');
    lignes.push(r.rule);
    if (r.source) lignes.push('', `*Source : ${r.source}*`);
    for (const i of r.incidents) {
      lignes.push('', `*Incident du ${i.date} — ${i.cause}. Conséquence : ${i.impact}.*`);
    }
  }
  return lignes.join('\n');
}

module.exports = { construire, rendre, selectionner, lireRegles, lireExperiences, RANG_SEVERITE };

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--portee') options.portee = String(args[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (args[i] === '--module') options.module = args[++i];
    else if (args[i] === '--severite') options.severite = args[++i];
    else if (args[i] === '--json') json = true;
    else { console.error(`Option inconnue : ${args[i]}`); process.exit(1); }
  }
  const b = construire(options);
  console.log(json ? JSON.stringify(b, null, 2) : rendre(b, options));
  process.exit(b.erreur ? 1 : 0);
}
