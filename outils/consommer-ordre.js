// NEXUS-EXECUTOR-SUPABASE-1, E4 — consommation d'un ordre par l'exécutant habilité.
//
// Ce module ne contient AUCUN accès base et AUCUN écrivain : il reçoit un `lecteur` (lecture seule) et, pour le
// seul mode `reel`, un `ecrivain` injecté par la session habilitée (connecteur). En mode `blanc` l'écrivain n'est
// jamais appelé, même s'il est fourni. Tout écart (GO, hash, projet, blob, précondition, rejeu, concurrence) refuse
// AVANT toute écriture. Une interruption ou un résultat ambigu donne EXECUTION_INCERTAINE, jamais un rejeu aveugle.
'use strict';
const fs = require('fs'), path = require('path');
const O = require('./ordre-execution');

const mesurer = (lecteur, ordre) => {
  const noms = [...new Set([...Object.keys(ordre.preconditions), ...Object.keys(ordre.postconditions)])];
  return lecteur.mesures(noms);
};

// État de rejeu/incertitude dérivé des execution-*.json déjà déposés dans le lot (aucune autre source).
// Échoue FERMÉ : un retour illisible ou sans hash peut être celui qui consomme l'ordre ; l'ignorer rouvrirait le rejeu.
function etatDepuisLot(dir) {
  const etat = { consommes: [], verrou: null, incertains: [] };
  if (!fs.existsSync(dir)) return etat;
  for (const f of fs.readdirSync(dir).filter((x) => /^execution-.*\.json$/.test(x)).sort()) {
    let e; try { e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (x) { throw new Error(`${f} illisible : état de rejeu indéterminable, aucune exécution possible (${String(x && x.message || x).slice(0, 120)})`); }
    if (!e || typeof e !== 'object' || typeof e.operation_hash !== 'string' || !e.operation_hash) throw new Error(`${f} sans operation_hash : état de rejeu indéterminable, aucune exécution possible`);
    if (e.etat === 'EXECUTE') etat.consommes.push(e.operation_hash);
    else if (e.etat === 'EXECUTION_INCERTAINE') etat.incertains.push(e.operation_hash);
  }
  etat.incertains = etat.incertains.filter((h) => !etat.consommes.includes(h));
  return etat;
}

function lireReel(lecteur, ordre) {
  try {
    return { reel: { project_ref: lecteur.projet(), blob: lecteur.blob(ordre.artefact && ordre.artefact.chemin), mesures: mesurer(lecteur, ordre) } };
  } catch (e) { return { erreur: String(e && e.message || e).slice(0, 200) }; }
}

function consommer({ ordre, go, lecteur, ecrivain, etat, habilites, mode = 'blanc', executant, maintenant = new Date() }) {
  const debut = (maintenant instanceof Date ? maintenant : new Date(maintenant)).toISOString();
  const refus = (codes, detail, avant) => ({
    verdict: 'REFUS', mode, ecritures: 0,
    execution: { operation_hash: ordre && ordre.operation_hash, etat: 'REFUSE', refus: codes[0], codes, detail, executant, go: go || null,
      mesures_avant: avant || {}, mesures_apres: avant || {}, debut, fin: debut,
      reprise: { prochaine_action: 'aucune écriture n\'a eu lieu ; corriger l\'écart nommé puis redéposer une demande' } },
  });
  if (mode !== 'blanc' && mode !== 'reel') throw new Error(`mode inconnu : ${mode}`);
  if (mode === 'reel' && typeof ecrivain !== 'function') return refus(['ORDRE_MALFORME'], 'mode reel sans écrivain injecté');
  const pre = O.valider(ordre, { maintenant });
  if (pre.length) return refus(pre);
  const lu = lireReel(lecteur, ordre);
  if (lu.erreur) return refus(['PRECONDITION_FAUSSE'], `lecture impossible : ${lu.erreur}`);
  const avant = { ...lu.reel.mesures };
  const codes = O.peutExecuter(ordre, go, lu.reel, etat, { habilites, maintenant });
  if (codes.length) return refus(codes, undefined, avant);
  if (mode === 'blanc') return { verdict: 'APTE', mode, ecritures: 0, mesures_avant: avant,
    note: 'essai à blanc : toutes les gardes passent, aucune écriture n\'a été tentée' };

  // Réel : AUTORISE → EXECUTION_EN_COURS ; l'écrivain est appelé une seule fois.
  O.transition('AUTORISE', 'demarre');
  let ecritures = 0, etatFinal, apres = {}, detail;
  try {
    ecritures = 1; const retour = ecrivain(ordre);
    // Un écrivain asynchrone (connecteur MCP) n'est pas attendu ici : relire maintenant constaterait un état
    // intermédiaire. L'issue est inconnue → EXECUTION_INCERTAINE, et le rejet éventuel est capté, pas perdu.
    if (retour && typeof retour.then === 'function') {
      if (typeof retour.catch === 'function') retour.catch(() => {});
      etatFinal = O.transition('EXECUTION_EN_COURS', 'interrompu'); detail = 'écrivain asynchrone non attendu : issue inconnue, réconcilier en lecture seule';
    }
  } catch (e) {
    etatFinal = O.transition('EXECUTION_EN_COURS', 'interrompu'); detail = `écriture interrompue : ${String(e && e.message || e).slice(0, 200)}`;
  }
  if (!etatFinal) {
    try { apres = mesurer(lecteur, ordre); } catch (e) { detail = `relecture impossible : ${String(e && e.message || e).slice(0, 200)}`; }
    const c = O.reconcilier(ordre, apres);
    etatFinal = c === 'APPLIQUEE' ? O.transition('EXECUTION_EN_COURS', 'termine') : O.transition('EXECUTION_EN_COURS', 'interrompu');
    if (c !== 'APPLIQUEE') detail = detail || `postconditions non constatées (${c})`;
  }
  const fin = new Date().toISOString();
  const execution = { operation_hash: ordre.operation_hash, etat: etatFinal, executant, go, mesures_avant: avant, mesures_apres: apres, debut, fin,
    reprise: { prochaine_action: etatFinal === 'EXECUTE' ? 'constat passif puis demande suivante' : 'ne pas rejouer : réconcilier en lecture seule (O.reconcilier) avant toute décision' } };
  if (detail) execution.detail = detail;
  return { verdict: etatFinal === 'EXECUTE' ? 'EXECUTE' : 'INCERTAIN', mode, ecritures, execution };
}

// Le dépôt local ne voit pas les décisions du lot : il ne contrôle que l'environnement et l'habilitation.
// L'existence d'une décision citant le hash est exigée par `handoff.js execution` / `verifier`, qui relisent le lot.
function deposerExecution(dir, seq, k, execution, ordre, suffixe = '') {
  const e = O.validerExecution(execution, ordre, { hashesApprouves: [ordre.operation_hash] });
  if (execution.etat === 'EXECUTE' && e.length) throw new Error(`retour execution refusé : ${e.join(',')}`);
  const f = path.join(dir, `execution-${seq}-${k}${suffixe}.json`);
  if (fs.existsSync(f)) throw new Error(`${f} existe déjà : un retour ne s'écrase pas`);
  fs.writeFileSync(f, JSON.stringify(execution, null, 2) + '\n');
  return f;
}

module.exports = { consommer, etatDepuisLot, deposerExecution };

// CLI : essai à blanc seulement. `blanc <order.json> --reel <reel.json> [--go <go.json>]`
// reel.json = {project_ref, blob, mesures} relevé en LECTURE SEULE par la session habilitée. Aucune écriture, jamais.
if (require.main === module) {
  const [cmd, fichier, ...rest] = process.argv.slice(2);
  const opt = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
  if (cmd !== 'blanc' || !fichier || !opt('--reel')) { console.error('usage : consommer-ordre.js blanc <order.json> --reel <reel.json> [--go <go.json>]'); process.exit(2); }
  const lire = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const ordre = lire(fichier), reel = lire(opt('--reel')), go = opt('--go') ? lire(opt('--go')) : null;
  const r = consommer({ ordre, go, mode: 'blanc', executant: 'essai-a-blanc', etat: etatDepuisLot(path.dirname(fichier)),
    habilites: O.HABILITES,
    lecteur: { projet: () => reel.project_ref, blob: () => reel.blob, mesures: (n) => Object.fromEntries(n.map((k) => [k, (reel.mesures || {})[k]])) } });
  console.log(JSON.stringify(r.verdict === 'APTE' ? { verdict: r.verdict, ecritures: 0, mesures_avant: r.mesures_avant } : { verdict: r.verdict, ecritures: 0, codes: r.execution.codes, detail: r.execution.detail }, null, 2));
  process.exit(r.verdict === 'APTE' ? 0 : 1);
}
