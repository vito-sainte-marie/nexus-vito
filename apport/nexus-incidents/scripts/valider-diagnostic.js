#!/usr/bin/env node
// Validateur du diagnostic standard de nexus-incidents. LECTURE SEULE.
//
// Un diagnostic sépare ce qui est prouvé de ce qui est supposé. Ce fichier
// refuse un rapport qui mélange les deux, qui requalifie un arrêt à la place
// de classerArret, ou qui déclare RESOLU sur la seule foi d'un run vert.
//
// Usage : node valider-diagnostic.js <diagnostic.json> [--depot <racine du dépôt>]
// Codes de sortie : 0 conforme, 2 non conforme, 1 panne.
'use strict';

const fs = require('fs');
const path = require('path');

const ETATS = Object.freeze(['NOUVEAU', 'EN_COURS', 'BLOQUE', 'A_VERIFIER', 'RESOLU']);
const URGENCES = Object.freeze(['U0', 'U1', 'U2', 'U3']);
const CAUSES = Object.freeze(['DEMONTREE', 'INDETERMINEE']);
const TYPES_SOURCE = Object.freeze(['fichier', 'commit', 'run', 'journal', 'issue', 'pr', 'api']);
const EXECUTANTS_SPECIAUX = Object.freeze(['aucun', 'frederic']);

const vide = v => v === undefined || v === null || String(v).trim() === '';

// d : le diagnostic ; ctx : { famille(code) -> nom, canaux: [], capacites: [] }
function valider(d, ctx) {
  const x = d || {};
  const c = ctx || {};
  const err = [];
  const e = m => err.push(m);

  if (!/^INC-[0-9a-f]{12}$|^INC-\d{8}-\d{3}$/.test(String(x.incident || ''))) e('incident : identifiant absent ou hors motif');
  if (!ETATS.includes(x.etat)) e(`etat « ${x.etat} » hors de ${ETATS.join(', ')}`);

  // 1. Faits prouvés : chacun a un id et au moins une source typée et datée.
  const faits = Array.isArray(x.faits) ? x.faits : [];
  if (!faits.length) e('faits : aucun fait prouvé');
  const ids = new Set();
  for (const f of faits) {
    if (vide(f.id)) { e('fait sans id'); continue; }
    if (ids.has(f.id)) e(`fait ${f.id} en double`);
    ids.add(f.id);
    if (vide(f.enonce)) e(`fait ${f.id} sans énoncé`);
    const s = f.source || {};
    if (!TYPES_SOURCE.includes(s.type) || vide(s.ref)) e(`fait ${f.id} sans source vérifiable (type ∈ ${TYPES_SOURCE.join('/')}, ref obligatoire)`);
    if (vide(f.horodatage)) e(`fait ${f.id} sans horodatage`);
    if (/\b(probablement|sans doute|semble|peut-être|vraisemblablement)\b/i.test(String(f.enonce || ''))) {
      e(`fait ${f.id} formulé comme une hypothèse : le déplacer dans hypotheses`);
    }
  }

  // 2. Hypothèses : jamais présentées comme prouvées, et chacune dit comment la vérifier.
  for (const h of Array.isArray(x.hypotheses) ? x.hypotheses : []) {
    if (vide(h.enonce) || vide(h.verification)) e(`hypothèse ${h.id || '?'} sans énoncé ou sans moyen de vérification`);
  }

  // 3. Cause racine : démontrée par des faits, ou explicitement indéterminée.
  const cr = x.cause_racine || {};
  if (!CAUSES.includes(cr.statut)) e(`cause_racine.statut « ${cr.statut} » hors de ${CAUSES.join(', ')}`);
  if (cr.statut === 'DEMONTREE') {
    const refs = Array.isArray(cr.faits) ? cr.faits : [];
    if (!refs.length) e('cause DEMONTREE sans fait cité');
    for (const r of refs) if (!ids.has(r)) e(`cause racine cite un fait inconnu : ${r}`);
    if (vide(cr.enonce) || vide(cr.maillon)) e('cause DEMONTREE sans énoncé ou sans maillon');
  }
  if (cr.statut === 'INDETERMINEE' && vide(cr.manque)) e('cause INDETERMINEE sans dire ce qui manque pour conclure');

  // 4. Classification : la famille est celle de classerArret, jamais requalifiée ici.
  const cl = x.classification || {};
  if (vide(cl.code)) e('classification.code absent');
  if (typeof c.famille === 'function' && !vide(cl.code) && cl.famille !== c.famille(cl.code)) {
    e(`classification.famille « ${cl.famille} » différente de classerArret (« ${c.famille(cl.code)} ») : ce skill ne requalifie pas`);
  }
  if (!URGENCES.includes(cl.urgence)) e(`urgence « ${cl.urgence} » hors de U0..U3`);
  if (vide(cl.priorite)) e('priorite absente (ordre de développement, distinct de l\'urgence)');

  // 5. Action suivante : un exécutant du registre, une capacité du registre, une preuve attendue.
  const a = x.action_suivante || {};
  if (vide(a.action)) e('action_suivante.action absente');
  if (vide(a.preuve_attendue)) e('action_suivante.preuve_attendue absente');
  if (Array.isArray(c.canaux) && !c.canaux.includes(a.executant) && !EXECUTANTS_SPECIAUX.includes(String(a.executant))) {
    e(`executant « ${a.executant} » absent de CAPACITES-CANAL.json`);
  }
  if (Array.isArray(c.capacites) && !vide(a.capacite) && a.capacite !== 'AUCUNE' && !c.capacites.includes(a.capacite)) {
    e(`capacite « ${a.capacite} » absente de CAPACITES-CANAL.json`);
  }

  // 6. État RESOLU : jamais sur un run vert seul.
  if (x.etat === 'RESOLU') {
    const preuve = faits.find(f => f.preuve_attendue_verifiee === true);
    if (!preuve) e('RESOLU sans fait marqué preuve_attendue_verifiee : un workflow vert ne prouve pas la résolution');
    if (vide(x.experience) || vide(x.regle)) e('RESOLU sans lien EXPERIENCE.jsonl et règle RULES.json (GOV-002)');
  }
  return { conforme: err.length === 0, erreurs: err };
}

function chargerContexte(racine) {
  const ctx = {};
  try { ctx.famille = require(path.join(racine, 'outils', 'watchdog-stagnation.js')).famille; } catch (e) { /* hors dépôt */ }
  try {
    const cap = JSON.parse(fs.readFileSync(path.join(racine, 'docs', 'handoff', 'CAPACITES-CANAL.json'), 'utf8'));
    ctx.canaux = Object.keys(cap.canaux || {});
    ctx.capacites = Object.keys(cap.capacites || {});
  } catch (e) { /* hors dépôt */ }
  return ctx;
}

function principal(argv) {
  const fichier = argv.find(a => !a.startsWith('--'));
  const i = argv.indexOf('--depot');
  if (!fichier) { console.error('usage : valider-diagnostic.js <diagnostic.json> [--depot <racine>]'); return 1; }
  const racine = i >= 0 ? argv.at(i + 1) : path.resolve(__dirname, '..', '..', '..', '..');
  const r = valider(JSON.parse(fs.readFileSync(fichier, 'utf8')), chargerContexte(racine));
  if (r.conforme) { console.log(`conforme : ${fichier}`); return 0; }
  console.log(`NON CONFORME : ${fichier}`);
  for (const m of r.erreurs) console.log(`  - ${m}`);
  return 2;
}

module.exports = { valider, chargerContexte, ETATS, URGENCES, CAUSES };
if (require.main === module) process.exitCode = principal(process.argv.slice(2));
