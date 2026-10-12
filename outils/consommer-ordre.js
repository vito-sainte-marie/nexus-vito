// NEXUS-EXECUTOR-SUPABASE-1, E4 — consommation d'un ordre par l'exécutant habilité.
//
// Ce module ne contient AUCUN accès base et AUCUN écrivain : il reçoit un `lecteur` (lecture seule) et, pour le
// seul mode `reel`, un `ecrivain` injecté par la session habilitée (connecteur). En mode `blanc` l'écrivain n'est
// jamais appelé, même s'il est fourni. Tout écart (GO, hash, projet, blob, précondition, rejeu, concurrence) refuse
// AVANT toute écriture. Une interruption ou un résultat ambigu donne EXECUTION_INCERTAINE, jamais un rejeu aveugle.
// PREFLIGHT-REEL-1 : le mode `reel` exige en plus une preuve émise par `preflight` (outils/preflight-reel.js) et un
// répertoire de verrous persistants ; l'écrivain reçoit le SQL prouvé, et le verrou n'est levé que sur issue connue.
'use strict';
const fs = require('fs'), path = require('path');
const O = require('./ordre-execution');
const P = require('./preflight-reel');

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
  } catch (e) { return { erreur: court(e) }; }
}
// Mode réel : le projet et le blob viennent de la PREUVE de preflight (témoins, git), jamais d'une déclaration du lecteur.
function lireMesures(lecteur, ordre, preuve) {
  try { return { reel: { project_ref: preuve.project_ref, blob: preuve.blob, mesures: mesurer(lecteur, ordre) } }; } catch (e) { return { erreur: court(e) }; }
}
const court = (e) => String(e && e.message || e).slice(0, 200);

// Toutes les gardes, puis (réel) prise du verrou persistant. Rend { resultat } (refus ou APTE) ou { ctx } verrou tenu.
function ouvrir({ ordre, go, lecteur, ecrivain, etat, habilites, mode = 'blanc', executant, maintenant = new Date(), preuve, dirVerrous }) {
  const debut = (maintenant instanceof Date ? maintenant : new Date(maintenant)).toISOString();
  const refus = (codes, detail, avant) => ({ resultat: {
    verdict: 'REFUS', mode, ecritures: 0,
    execution: { operation_hash: ordre && ordre.operation_hash, etat: 'REFUSE', refus: codes[0], codes, detail, executant, go: go || null,
      mesures_avant: avant || {}, mesures_apres: avant || {}, debut, fin: debut,
      reprise: { prochaine_action: 'aucune écriture n\'a eu lieu ; corriger l\'écart nommé puis redéposer une demande' } },
  } });
  if (mode !== 'blanc' && mode !== 'reel') throw new Error(`mode inconnu : ${mode}`);
  if (mode === 'reel' && typeof ecrivain !== 'function') return refus(['ORDRE_MALFORME'], 'mode reel sans écrivain injecté');
  if (mode === 'reel' && !dirVerrous) return refus(['ORDRE_MALFORME'], 'mode reel sans répertoire de verrous : la concurrence ne serait gardée que dans ce processus');
  const pre = O.valider(ordre, { maintenant });
  if (pre.length) return refus(pre);
  if (mode === 'reel' && !P.preuveAuthentique(preuve, ordre)) return refus(['PREFLIGHT_ABSENT'], 'aucune preuve de preflight émise pour cet ordre : identité du projet et provenance non prouvées');
  const lu = mode === 'reel' ? lireMesures(lecteur, ordre, preuve) : lireReel(lecteur, ordre);
  if (lu.erreur) return refus(['PRECONDITION_FAUSSE'], `lecture impossible : ${lu.erreur}`);
  const avant = { ...lu.reel.mesures };
  const ref = ordre.cible.project_ref;
  const etatR = mode === 'reel' ? { ...etat, verrou: P.lireVerrou(dirVerrous, ref) } : etat;
  const codes = O.peutExecuter(ordre, go, lu.reel, etatR, { habilites, maintenant });
  if (codes.length) return refus(codes, etatR.verrou && codes[0] === 'EXECUTION_CONCURRENTE' ? `verrou persistant tenu sur ${ref}${etatR.verrou.illisible ? ' (illisible : tenu par prudence)' : ` par ${etatR.verrou.operation_hash}`}` : undefined, avant);
  if (mode === 'blanc') return { resultat: { verdict: 'APTE', mode, ecritures: 0, mesures_avant: avant,
    note: 'essai à blanc : toutes les gardes passent, aucune écriture n\'a été tentée' } };
  const v = P.prendreVerrou(dirVerrous, { project_ref: ref, operation_hash: ordre.operation_hash, executant });
  if (v.codes) return refus(v.codes, `verrou pris sur ${ref} entre la lecture et la prise : une autre exécution est en cours`, avant);
  // Réel : AUTORISE → EXECUTION_EN_COURS ; l'écrivain est appelé une seule fois, avec le SQL prouvé.
  O.transition('AUTORISE', 'demarre');
  return { ctx: { ordre, go, lecteur, executant, mode, debut, avant, dirVerrous, preuve, ref, hash: ordre.operation_hash } };
}

// EXECUTE libère le verrou ; toute autre issue le GARDE (seules une réconciliation ou une libération humaine le lèvent).
function clore(ctx, etatFinal, apres, detail, issue) {
  if (etatFinal === 'EXECUTE') P.libererVerrou(ctx.dirVerrous, ctx.ref, { operation_hash: ctx.hash, motif: 'EXECUTE', par: ctx.executant });
  else if (issue) P.noterIssue(ctx.dirVerrous, ctx.ref, ctx.hash, { ...issue, le: new Date().toISOString() });
  const execution = { operation_hash: ctx.hash, etat: etatFinal, executant: ctx.executant, go: ctx.go, mesures_avant: ctx.avant, mesures_apres: apres, debut: ctx.debut, fin: new Date().toISOString(),
    preflight: { temoins: ctx.preuve.temoins, blob: ctx.preuve.blob, ref_provenance: ctx.preuve.ref_provenance },
    reprise: { prochaine_action: etatFinal === 'EXECUTE' ? 'constat passif puis demande suivante' : 'ne pas rejouer : le verrou reste tenu ; réconcilier en lecture seule (reconcilierVerrou) dès que l\'issue de l\'écrivain est acquise' } };
  if (detail) execution.detail = detail;
  if (etatFinal !== 'EXECUTE') execution.verrou = 'tenu';
  return { verdict: etatFinal === 'EXECUTE' ? 'EXECUTE' : 'INCERTAIN', mode: ctx.mode, ecritures: 1, execution };
}
const incertain = (ctx, detail, issue) => clore(ctx, O.transition('EXECUTION_EN_COURS', 'interrompu'), {}, detail, issue);

// L'écrivain a rendu : relire, puis seule une réconciliation APPLIQUEE conclut.
function constater(ctx) {
  let apres = {}, detail;
  try { apres = mesurer(ctx.lecteur, ctx.ordre); } catch (e) { detail = `relecture impossible : ${court(e)}`; }
  const c = O.reconcilier(ctx.ordre, apres);
  if (c === 'APPLIQUEE') return clore(ctx, O.transition('EXECUTION_EN_COURS', 'termine'), apres, detail);
  return clore(ctx, O.transition('EXECUTION_EN_COURS', 'interrompu'), apres, detail || `postconditions non constatées (${c})`, { issue: 'retour', reconciliation: c });
}

// Issue tardive d'un écrivain non attendu : consignée dès qu'elle arrive, verrou toujours tenu. Le rejet est capté.
function suivreIssueTardive(ctx, promesse) {
  const noter = (issue) => { try { return P.noterIssue(ctx.dirVerrous, ctx.ref, ctx.hash, { ...issue, le: new Date().toISOString(), tardive: true }); } catch (e) { return false; } };
  return Promise.resolve(promesse).then(() => noter({ issue: 'resolu' }), (e) => noter({ issue: 'rejete', erreur: court(e) }));
}

function consommer(args) {
  const o = ouvrir(args);
  if (o.resultat) return o.resultat;
  const ctx = o.ctx;
  let retour;
  try { retour = args.ecrivain(ctx.ordre, ctx.preuve.sql); } catch (e) { return incertain(ctx, `écriture interrompue : ${court(e)}`, { issue: 'exception', erreur: court(e) }); }
  // Un écrivain asynchrone (connecteur MCP) n'est pas attendu ici : relire maintenant constaterait un état
  // intermédiaire. L'issue est inconnue → EXECUTION_INCERTAINE ; elle sera consignée à son arrivée (issueTardive).
  if (retour && typeof retour.then === 'function') {
    const r = incertain(ctx, 'écrivain asynchrone non attendu : issue inconnue, réconcilier en lecture seule');
    r.issueTardive = suivreIssueTardive(ctx, retour);
    return r;
  }
  return constater(ctx);
}

// Entrée asynchrone : l'écrivain est attendu au plus `delaiMs`. Passé ce délai, EXECUTION_INCERTAINE verrou tenu,
// et l'issue tardive est consignée quand elle arrive. Jamais de relecture avant que l'écrivain ait rendu.
async function consommerAsync(args) {
  const { delaiMs } = args;
  if (!(Number.isFinite(delaiMs) && delaiMs > 0)) throw new Error('consommerAsync exige un délai (delaiMs > 0)');
  const o = ouvrir({ ...args, mode: 'reel' });
  if (o.resultat) return o.resultat;
  const ctx = o.ctx;
  let retour;
  try { retour = args.ecrivain(ctx.ordre, ctx.preuve.sql); } catch (e) { return incertain(ctx, `écriture interrompue : ${court(e)}`, { issue: 'exception', erreur: court(e) }); }
  const DELAI = {};
  let minuteur;
  const issue = Promise.resolve(retour).then((v) => ({ ok: v }), (e) => ({ err: e }));
  const gagnant = await Promise.race([issue, new Promise((r) => { minuteur = setTimeout(() => r(DELAI), delaiMs); })]);
  clearTimeout(minuteur);
  if (gagnant === DELAI) {
    const r = incertain(ctx, `écrivain sans issue après ${delaiMs} ms : issue inconnue, réconcilier en lecture seule`);
    r.issueTardive = suivreIssueTardive(ctx, retour);
    return r;
  }
  if (gagnant.err) return incertain(ctx, `écriture rejetée : ${court(gagnant.err)}`, { issue: 'rejete', erreur: court(gagnant.err) });
  return constater(ctx);
}

// Réconciliation d'un verrou tenu, en LECTURE SEULE. Refuse de conclure tant que l'issue de l'écrivain n'est pas acquise.
function reconcilierVerrou({ ordre, lecteur, dirVerrous }) {
  const ref = ordre.cible.project_ref, v = P.lireVerrou(dirVerrous, ref);
  if (!v) return { verdict: 'SANS_VERROU', detail: `aucun verrou tenu sur ${ref}` };
  if (v.illisible || v.operation_hash !== ordre.operation_hash) return { verdict: 'VERROU_ETRANGER', verrou: 'tenu', detail: 'le verrou ne nomme pas cet ordre : seule une libération humaine habilitée le lève' };
  const issue = P.lireIssue(dirVerrous, ref, ordre.operation_hash);
  if (!issue) return { verdict: 'ISSUE_NON_ACQUISE', verrou: 'tenu', detail: 'l\'écrivain n\'a pas rendu d\'issue : relire maintenant pourrait constater un état intermédiaire' };
  let m;
  try { m = mesurer(lecteur, ordre); } catch (e) { return { verdict: 'INDETERMINE', verrou: 'tenu', issue, detail: `relecture impossible : ${court(e)}` }; }
  const c = O.reconcilier(ordre, m);
  if (c === 'APPLIQUEE') { P.libererVerrou(dirVerrous, ref, { operation_hash: ordre.operation_hash, motif: 'EXECUTE' }); return { verdict: 'EXECUTE', etat: O.transition('EXECUTION_INCERTAINE', 'reconcilie_appliquee'), issue, mesures: m }; }
  if (c === 'NON_APPLIQUEE') { P.libererVerrou(dirVerrous, ref, { operation_hash: ordre.operation_hash, motif: 'NON_APPLIQUEE' }); return { verdict: 'NON_APPLIQUEE', etat: O.transition('EXECUTION_INCERTAINE', 'reconcilie_non_appliquee'), issue, mesures: m }; }
  return { verdict: 'INDETERMINE', verrou: 'tenu', etat: O.transition('EXECUTION_INCERTAINE', 'reconcilie_indetermine'), issue, mesures: m };
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

module.exports = { consommer, consommerAsync, reconcilierVerrou, etatDepuisLot, deposerExecution };

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
