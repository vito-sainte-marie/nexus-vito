'use strict';
// O3 — consomme une clôture (decision `closes: true`) déposée par la CI, et rien d'autre.
// GOV-R3-CONSOMMATION-CLOTURE-20261020, decision-1 (APPROVED_WITH_CONDITIONS). Hors workflow, hors hook,
// non câblé : on le lance à la main (ou depuis une session), jamais seul.
//
//   node outils/consommer-clotures-ci.js              rapport : aucune écriture
//   node outils/consommer-clotures-ci.js --appliquer  consomme (handoff.js consommer --cloture) puis commite
//
// Aucun jugement de fond : l'outil ne consomme qu'une clôture dont TOUTES les gardes tiennent ; au
// moindre doute (API muette, empreinte divergente, plusieurs candidats, arbre sale) il s'arrête sans
// rien modifier. Il ne pousse jamais, ne touche à aucun fichier hors du registre handoff.
//
// Sortie : une ligne par constat, code stable en tête.
//   CANDIDAT <lot> | CONFORME <lot> | CONSOMME <lot> | RIEN_A_CONSOMMER | AMBIGUITE <lots>
//   REFUS <CODE> <lot> <détail> | IGNORE <lot> <raison> | VERIFIER_AVANT OK | VERIFIER_APRES OK
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const handoff = require('./handoff.js');
const { verifierSource, contrat, corpsDeLaDecision } = require('./verifier-source-decision.js');

const { HANDOFF, LOTS, ETAT } = handoff.CHEMINS;
const CI = 'github-actions[bot]';
const MODE_CI = 'github_actions_relay';
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const sortie = (l) => console.log(l);

const gitBrut = (...a) => execFileSync('git', a, { cwd: path.dirname(HANDOFF), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const git = (...a) => gitBrut(...a).trim();

// Lecture d'un commentaire de l'issue : l'API de NEXUS_GITHUB_API si elle est posée, sinon `gh api`.
// Synchrone (verifierSource l'exige). Toute erreur — réseau, HTTP ≠ 200, JSON — remonte en exception.
function fetchComment(reference) {
  const m = /^https:\/\/github\.com\/([^/\s#]+)\/([^/\s#]+)\/issues\/\d+#issuecomment-(\d+)$/.exec(reference);
  if (!m) throw new Error(`référence ${reference} non canonique`);
  const chemin = `repos/${m[1]}/${m[2]}/issues/comments/${m[3]}`;
  let json;
  if (process.env.NEXUS_GITHUB_API) {
    const base = process.env.NEXUS_GITHUB_API.replace(/\/$/, '');
    const script = `const u=new URL(process.argv[1]);const lib=require(u.protocol==='https:'?'https':'http');
      const h={'user-agent':'nexus-o3','accept':'application/vnd.github+json'};const t=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;if(t)h.authorization='Bearer '+t;
      const r=lib.get(u,{headers:h,timeout:15000},(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{if(res.statusCode!==200){console.error('HTTP '+res.statusCode);process.exit(1)}process.stdout.write(d)})});
      r.on('timeout',()=>{console.error('délai dépassé');process.exit(1)});r.on('error',e=>{console.error(e.message);process.exit(1)});`;
    json = execFileSync(process.execPath, ['-e', script, `${base}/${chemin}`], { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] });
  } else {
    json = execFileSync('gh', ['api', chemin], { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] });
  }
  const c = JSON.parse(json);
  return { auteur: c && c.user && c.user.login, corps: c && c.body };
}

const handoffCli = (...a) => {
  try { return { code: 0, sortie: execFileSync(process.execPath, [path.join(__dirname, 'handoff.js'), ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env }) }; }
  catch (e) { return { code: e.status || 1, sortie: `${e.stdout || ''}${e.stderr || ''}` }; }
};

function arret(code, lot, detail) { sortie(`REFUS ${code} ${lot} ${detail || ''}`.trim()); return false; }

// Les clôtures « à consommer » : lot non consommé dont la dernière décision est de la main de la
// CI (author ChatGPT) et ferme le lot. Tout le reste est invisible à l'outil.
function candidats(etat) {
  const out = [];
  for (const [lot, v] of Object.entries(etat.lots || {})) {
    if (v.statut === 'DECISION_CONSOMMEE') continue;
    const dec = handoff.dernier(handoff.echanges(lot, 'decision'));
    if (!dec) continue;
    const chemin = path.join(LOTS, lot, dec.fichier);
    const r = handoff.lireEnveloppe(chemin);
    if (!r.env) continue;
    if (String(r.env.author) !== 'ChatGPT') continue;
    if (String(r.env.closes) !== 'true') continue;
    out.push({ lot, dec: dec.fichier, chemin, env: r.env });
  }
  return out;
}

// Les gardes locales, puis la source. Retourne true si la clôture est consommable.
function controler(c) {
  const { lot, dec, chemin, env } = c;
  const prov = env.provenance || {};
  if (prov.mode !== MODE_CI) return arret('NON_ISSUE_DE_LA_CI', lot, `${dec} : provenance.mode ${JSON.stringify(prov.mode)} ≠ ${MODE_CI}.`);
  let committer;
  try { committer = git('log', '-1', '--format=%cn', '--', chemin); } catch (e) { committer = null; }
  if (committer !== CI) return arret('NON_ISSUE_DE_LA_CI', lot, `${dec} : commit déposé par ${JSON.stringify(committer)}, attendu ${CI}.`);
  const active = handoff.dernier(handoff.echanges(lot, 'request'));
  const vise = handoff.demandeVisee(lot, dec);
  if (!active || vise !== active.fichier) return arret('HORS_DEMANDE_ACTIVE', lot, `${dec} répond à ${vise}, la demande active est ${active ? active.fichier : 'aucune'}.`);
  const src = verifierSource({ decisionPath: chemin, fetchComment });
  if (!src.ok) return arret(src.code, lot, src.detail);
  const cs = (() => { const corps = corpsDeLaDecision(fs.readFileSync(chemin, 'utf8')); const o = {}; const i = corps.lastIndexOf('NEXT_ACTION_CONTRACT'); for (const l of corps.slice(i).split('\n')) { const k = /^\s*(DECISION|CONDITIONS|STOP_REQUIRED):\s*(.+?)\s*$/.exec(l); if (k && !(k[1] in o)) o[k[1]] = k[2]; } return o; })();
  const nue = cs.DECISION === 'APPROVED' && String(cs.CONDITIONS || '').toLowerCase() === 'aucune' && String(cs.STOP_REQUIRED || '').toLowerCase() === 'non';
  if (!nue) return arret('CLOTURE_NON_NUE', lot, `${dec} : DECISION ${cs.DECISION}, CONDITIONS ${JSON.stringify(cs.CONDITIONS)}, STOP_REQUIRED ${cs.STOP_REQUIRED} — une clôture ne se consomme que nue.`);
  sortie(`CONFORME ${lot} ${dec} ${src.detail}`);
  return true;
}

function main() {
  const appliquer = process.argv.includes('--appliquer');
  const inconnues = process.argv.slice(2).filter(a => a !== '--appliquer');
  if (inconnues.length) { console.error(`REFUS — option inconnue : ${inconnues.join(', ')}.`); return 1; }
  const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8'));
  const liste = candidats(etat);
  if (!liste.length) { sortie('RIEN_A_CONSOMMER'); return 0; }
  for (const c of liste) sortie(`CANDIDAT ${c.lot} ${c.dec}`);
  if (liste.length > 1) { sortie(`AMBIGUITE ${liste.map(c => c.lot).join(' ')} — plusieurs clôtures candidates : arrêt sans modification.`); return 1; }
  const c = liste[0];
  if (!controler(c)) return 1;
  if (!appliquer) { sortie(`RAPPORT ${c.lot} consommable ; relancer avec --appliquer pour consommer.`); return 0; }

  if (git('status', '--porcelain') !== '') { arret('ARBRE_NON_PROPRE', c.lot, "l'arbre de travail a des modifications : rien n'est consommé."); return 1; }
  const avant = handoffCli('verifier');
  if (avant.code !== 0) { arret('VERIFIER_AVANT_ROUGE', c.lot, avant.sortie.split('\n').filter(Boolean).slice(-3).join(' | ')); return 1; }
  sortie('VERIFIER_AVANT OK');
  const conso = handoffCli('consommer', c.lot, '--cloture');
  if (conso.code !== 0) { arret('CONSOMMATION_REFUSEE', c.lot, conso.sortie.split('\n').filter(Boolean).slice(-2).join(' | ')); return 1; }
  // Périmètre : seuls des fichiers du registre ont bougé.
  const prefixe = path.relative(git('rev-parse', '--show-toplevel'), HANDOFF).split(path.sep).join('/') + '/';
  const touches = gitBrut('status', '--porcelain', '-uall').split('\n').filter(Boolean).map(l => l.slice(3));
  const hors = touches.filter(f => !f.startsWith(prefixe));
  if (hors.length) { arret('PERIMETRE', c.lot, `fichiers hors registre modifiés : ${hors.join(', ')} — aucun commit.`); return 1; }
  const apres = handoffCli('verifier');
  if (apres.code !== 0) { arret('VERIFIER_APRES_ROUGE', c.lot, "verifier rouge après consommation — aucun commit ; l'arbre est laissé pour inspection."); return 1; }
  sortie('VERIFIER_APRES OK');
  const empreinte = sha256(corpsDeLaDecision(fs.readFileSync(c.chemin, 'utf8')));
  const reference = c.env.provenance.reference;
  git('add', '-A', '--', prefixe);
  git('commit', '-q', '-m', `Consommer la clôture ${c.lot}/${c.dec} (O3)\n\nClôture CI consommée par outils/consommer-clotures-ci.js après vérification de la source.\nsha256 ${empreinte}\nsource ${reference}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`);
  sortie(`CONSOMME ${c.lot} ${c.dec} commit ${git('rev-parse', '--short', 'HEAD')} (local, non poussé)`);
  return 0;
}

try { process.exit(main()); }
catch (e) { console.error(`REFUS ERREUR_INATTENDUE — ${e.message}`); process.exit(1); }
