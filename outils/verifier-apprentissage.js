// Vérification mécanique de la mémoire d'apprentissage (Gouvernance Autonome
// v2, §7 ; ADR-0002, point 6).
//
// POURQUOI. RULES.json et EXPERIENCE.jsonl n'ont aucune valeur si leur
// intégrité dépend de la discipline de qui les édite : un id dupliqué rend
// le filtrage par règle ambigu, un `promoted_rule` orphelin fait croire
// qu'un apprentissage a été mécanisé alors qu'il ne l'a jamais été. Ce
// contrôle ne rédige aucune règle métier à la place d'un humain — il ne
// fait que refuser un registre incohérent, et signaler mécaniquement la
// règle GOV-002 : « un problème résolu deux fois doit être promu avant une
// troisième analyse humaine identique ».
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const RULES_PATH = path.join(RACINE, 'docs', 'learning', 'RULES.json');
const EXPERIENCE_PATH = path.join(RACINE, 'docs', 'learning', 'EXPERIENCE.jsonl');
const ADR_DIR = path.join(RACINE, 'docs', 'adr');
const RE_ADR = /^ADR-(\d+)$/;

const ID_VALIDE = /^[A-Z][A-Z0-9]*-\d{3}$/;
const SEVERITES_CONNUES = ['blocking', 'human_gate', 'advisory', 'business'];
const CHAMPS_REGLE = ['id', 'scope', 'trigger', 'module', 'severity', 'rule', 'source'];
const CHAMPS_EXPERIENCE = ['date', 'type', 'component', 'cause', 'impact', 'resolution'];

function erreur(liste, message) { liste.push(message); }

function validerRules(cheminRules) {
  const erreurs = [];
  const avertissements = [];
  if (!fs.existsSync(cheminRules)) { erreur(erreurs, `RULES.json introuvable : ${cheminRules}`); return { erreurs, avertissements, regles: [] }; }
  let doc;
  try { doc = JSON.parse(fs.readFileSync(cheminRules, 'utf8')); }
  catch (err) { erreur(erreurs, `RULES.json n'est pas un JSON valide : ${err.message}`); return { erreurs, avertissements, regles: [] }; }
  if (doc.schema !== 'nexus-rules/1') erreur(erreurs, `schema attendu "nexus-rules/1", trouvé ${JSON.stringify(doc.schema)}`);
  if (!Array.isArray(doc.rules)) { erreur(erreurs, 'rules doit être une liste'); return { erreurs, avertissements, regles: [] }; }

  const idsVus = new Map();
  for (const [i, r] of doc.rules.entries()) {
    const ou = `rules[${i}]${r && r.id ? ` (${r.id})` : ''}`;
    for (const champ of CHAMPS_REGLE) {
      if (r[champ] === undefined || r[champ] === null || r[champ] === '') erreur(erreurs, `${ou} : champ "${champ}" manquant`);
    }
    if (r.id && !ID_VALIDE.test(r.id)) erreur(erreurs, `${ou} : id ${JSON.stringify(r.id)} ne respecte pas le format PREFIXE-NNN`);
    if (r.id) {
      if (idsVus.has(r.id)) erreur(erreurs, `id dupliqué : ${r.id} (rules[${idsVus.get(r.id)}] et ${ou})`);
      else idsVus.set(r.id, i);
    }
    if (r.scope !== undefined && !Array.isArray(r.scope)) erreur(erreurs, `${ou} : scope doit être une liste`);
    if (r.severity && !SEVERITES_CONNUES.includes(r.severity)) {
      avertissements.push(`${ou} : severity ${JSON.stringify(r.severity)} hors vocabulaire connu (${SEVERITES_CONNUES.join('|')}) — vérifier qu'il ne s'agit pas d'une faute de frappe.`);
    }
  }
  return { erreurs, avertissements, regles: doc.rules };
}

function numerosAdrExistants(dossierAdr) {
  if (!fs.existsSync(dossierAdr)) return new Set();
  const numeros = new Set();
  for (const f of fs.readdirSync(dossierAdr)) {
    const m = /^(\d+)-/.exec(f);
    if (m) numeros.add(m[1]);
  }
  return numeros;
}

// `promoted_rule` désigne soit un id de RULES.json (règle mécanisable),
// soit une décision structurante matérialisée en ADR (`ADR-000N`) — les deux
// sont des promotions légitimes de l'expérience au sens de la Gouvernance
// Autonome v2 §7 ; seule une référence introuvable dans les deux registres
// est une erreur.
function promotionValide(valeur, idsRegles, numerosAdr) {
  if (idsRegles.has(valeur)) return true;
  const m = RE_ADR.exec(valeur);
  if (m) return numerosAdr.has(m[1].padStart(4, '0')) || numerosAdr.has(m[1]);
  return false;
}

function validerExperience(cheminExperience, idsRegles, numerosAdr = numerosAdrExistants(ADR_DIR)) {
  const erreurs = [];
  const avertissements = [];
  if (!fs.existsSync(cheminExperience)) return { erreurs, avertissements, entrees: [] };
  const lignes = fs.readFileSync(cheminExperience, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  const entrees = [];
  lignes.forEach((ligne, i) => {
    let obj;
    try { obj = JSON.parse(ligne); }
    catch (err) { erreur(erreurs, `EXPERIENCE.jsonl ligne ${i + 1} : JSON invalide (${err.message})`); return; }
    const ou = `EXPERIENCE.jsonl ligne ${i + 1}`;
    for (const champ of CHAMPS_EXPERIENCE) {
      if (!obj[champ]) erreur(erreurs, `${ou} : champ "${champ}" manquant`);
    }
    if (obj.date && Number.isNaN(Date.parse(obj.date))) erreur(erreurs, `${ou} : date ${JSON.stringify(obj.date)} illisible`);
    if (obj.promoted_rule && !promotionValide(obj.promoted_rule, idsRegles, numerosAdr)) {
      erreur(erreurs, `${ou} : promoted_rule ${JSON.stringify(obj.promoted_rule)} ne correspond ni à un id de RULES.json ni à un ADR existant — apprentissage annoncé comme mécanisé mais introuvable.`);
    }
    entrees.push(obj);
  });

  // GOV-002, version mécanique : (component, cause) identiques deux fois
  // sans promoted_rule sur au moins une des occurrences => à promouvoir.
  const compte = new Map();
  for (const e of entrees) {
    if (!e.component || !e.cause) continue;
    const cle = `${e.component}::${e.cause}`;
    if (!compte.has(cle)) compte.set(cle, []);
    compte.get(cle).push(e);
  }
  for (const [cle, occ] of compte) {
    if (occ.length >= 2 && !occ.some(e => e.promoted_rule)) {
      avertissements.push(`récurrence non promue (GOV-002) : "${cle}" apparaît ${occ.length} fois sans qu'aucune occurrence ne porte promoted_rule — chercher une règle/garde/runbook avant une nouvelle analyse identique.`);
    }
  }
  return { erreurs, avertissements, entrees };
}

function verifier() {
  const { erreurs: eR, avertissements: aR, regles } = validerRules(RULES_PATH);
  const idsRegles = new Set(regles.map(r => r.id).filter(Boolean));
  const { erreurs: eE, avertissements: aE } = validerExperience(EXPERIENCE_PATH, idsRegles);
  return {
    erreurs: [...eR, ...eE],
    avertissements: [...aR, ...aE],
    nbRegles: regles.length,
  };
}

module.exports = { validerRules, validerExperience, verifier, ID_VALIDE, SEVERITES_CONNUES };

if (require.main === module) {
  const { erreurs, avertissements, nbRegles } = verifier();
  if (!erreurs.length && !avertissements.length) {
    console.log(`Apprentissage : OK — ${nbRegles} règle(s), aucun doublon, aucun id invalide, aucune récurrence non promue.`);
    process.exit(0);
  }
  for (const a of avertissements) console.log(`  AVERTISSEMENT  ${a}`);
  for (const e of erreurs) console.log(`  ERREUR         ${e}`);
  process.exit(erreurs.length ? 1 : 0);
}
