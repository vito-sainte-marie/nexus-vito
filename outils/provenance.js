// P5 — contrôle de provenance des décisions à palier humain (voie A).
// GOV-R1-IDENTITES-PROVENANCE-20261019, decision-3 : aucun mécanisme
// automatique n'authentifie une décision humaine sous la voie A ; l'outil
// exige donc une déclaration EXPLICITE (niveau, jamais 3) plutôt que
// d'accepter un nom d'auteur nu (E1, E4). Pour `author: ChatGPT`, la seule
// provenance qui s'authentifie réellement est la matérialisation par la CI :
// un commentaire posté par github-actions[bot], citant un run de tests.yml
// dont l'étape de relais a réussi, au contrat identique à la décision (E5).
// « Les valeurs de l'enveloppe ne suffisent jamais seules » (decision-3) :
// chaque contrôle relit l'API, jamais la seule déclaration (E2, E3).
'use strict';
const { execFileSync } = require('child_process');

const CODES = ['PROVENANCE_NON_ETABLIE', 'PROVENANCE_INVALIDE', 'PROVENANCE_INSUFFISANTE'];
// Identités qui ne revendiquent aucune personne précise : l'outil lui-même
// (défaut historique) et l'agent qui dépose ses propres décisions. Aucune des
// deux ne prétend être Frédéric ou l'arbitre ChatGPT : rien à prouver.
const IDENTITES_EXEMPTEES = ['NEXUS Orchestrator', 'Claude'];
const NIVEAUX_DECLARABLES = ['1', '2'];
const MODE_RELAIS_CI = 'github_actions_relay';

function formeValide(prov) {
  if (prov === undefined || prov === null) return 'absente';
  if (typeof prov !== 'object' || Array.isArray(prov)) return 'doit être un objet (niveau, mode, reference)';
  for (const champ of ['niveau', 'mode', 'reference']) {
    if (!prov[champ] || !String(prov[champ]).trim()) return `provenance.${champ} manquant`;
  }
  return null;
}

// E1 / E4 — une décision humaine (ni ChatGPT, ni une identité exemptée) doit
// déclarer explicitement son niveau. Sous la voie A, rien ne peut
// l'authentifier : le niveau 3 n'est donc JAMAIS recevable ici, quelle que
// soit la déclaration — un compte partagé seul ne prouve jamais plus qu'un
// niveau 2 rapporté (E4), et l'absence totale de déclaration est un
// PROVENANCE_NON_ETABLIE (E1), jamais un passage silencieux.
function exigenceDeclaree(auteur, prov) {
  if (IDENTITES_EXEMPTEES.includes(auteur)) return { ok: true };
  if (!prov) return { ok: false, code: 'PROVENANCE_NON_ETABLIE', motif: `author ${JSON.stringify(auteur)} sans aucune preuve de provenance — un nom d'auteur n'est pas une preuve.` };
  const err = formeValide(prov);
  if (err) return { ok: false, code: 'PROVENANCE_INVALIDE', motif: `provenance malformée (${err}).` };
  if (!NIVEAUX_DECLARABLES.includes(String(prov.niveau).trim())) {
    return { ok: false, code: 'PROVENANCE_INSUFFISANTE', motif: `niveau ${JSON.stringify(prov.niveau)} déclaré pour ${JSON.stringify(auteur)} — sous la voie A, le niveau 3 n'est jamais atteignable pour une décision humaine, compte partagé ou non.` };
  }
  return { ok: true, niveau: Number(prov.niveau) };
}

function analyserReferenceCommentaire(reference) {
  const m = String(reference || '').trim().match(/^https:\/\/github\.com\/([^/\s#]+)\/([^/\s#]+)\/issues\/(\d+)#issuecomment-(\d+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], issue: m[3], commentId: m[4] };
}

// `gh api` lit GH_TOKEN/GITHUB_TOKEN de l'environnement ; aucun jeton n'est
// jamais manipulé ni tracé par ce module.
function appelApiDefaut(chemin) {
  const sortie = execFileSync('gh', ['api', chemin], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(sortie);
}

const sansBacktick = s => String(s || '').replace(/`/g, '').trim();

// E5 (cas de contrôle) / E2 / E3 — la seule provenance qui s'authentifie
// réellement sous la voie A. `opts.appelApi` est injectable pour l'épreuve ;
// par défaut, `gh api`.
function verifierGithubActionsRelay(prov, attendu, opts) {
  opts = opts || {};
  const appel = opts.appelApi || appelApiDefaut;
  const ref = analyserReferenceCommentaire(prov && prov.reference);
  if (!ref) return { ok: false, code: 'PROVENANCE_INVALIDE', motif: `référence ${JSON.stringify(prov && prov.reference)} ne désigne pas un commentaire GitHub canonique (.../issues/N#issuecomment-M).` };
  let commentaire;
  try {
    commentaire = appel(`repos/${ref.owner}/${ref.repo}/issues/comments/${ref.commentId}`);
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/\b404\b|Not Found/i.test(msg)) return { ok: false, code: 'PROVENANCE_INVALIDE', motif: `la référence ${prov.reference} ne désigne aucun commentaire (404).` };
    return { ok: false, code: 'PROVENANCE_NON_ETABLIE', arret: true, motif: `arrêt explicite — API GitHub indisponible pour vérifier ${prov.reference} (${msg}) ; niveau atteint : indéterminé.` };
  }
  const login = commentaire && commentaire.user && commentaire.user.login;
  const type = commentaire && commentaire.user && commentaire.user.type;
  if (login !== 'github-actions[bot]' || type !== 'Bot') {
    return { ok: false, code: 'PROVENANCE_INVALIDE', motif: `le commentaire ${prov.reference} est posté par ${JSON.stringify(login)} (type ${JSON.stringify(type)}), attendu github-actions[bot].` };
  }
  const corps = String(commentaire.body || '');
  const runId = (corps.match(/\brun\D{0,3}(\d{5,})\b/) || [])[1];
  if (!runId) return { ok: false, code: 'PROVENANCE_INVALIDE', motif: `le commentaire ${prov.reference} ne cite aucun run de tests.yml.` };
  let jobs;
  try {
    jobs = appel(`repos/${ref.owner}/${ref.repo}/actions/runs/${runId}/jobs`);
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/\b404\b|Not Found/i.test(msg)) return { ok: false, code: 'PROVENANCE_INVALIDE', motif: `le run ${runId} cité par ${prov.reference} n'existe pas.` };
    return { ok: false, code: 'PROVENANCE_NON_ETABLIE', arret: true, motif: `arrêt explicite — API GitHub indisponible pour lire le run ${runId} (${msg}) ; niveau atteint : indéterminé.` };
  }
  const etapes = ((jobs && jobs.jobs) || []).flatMap(j => j.steps || []);
  const etapeRelais = etapes.find(s => /relais vers l.arbitre/i.test(s.name || ''));
  if (!etapeRelais || etapeRelais.conclusion !== 'success') {
    return { ok: false, code: 'PROVENANCE_INVALIDE', motif: `le run ${runId} ne porte aucune étape de relais réussie (${etapeRelais ? etapeRelais.conclusion : 'étape absente'}).` };
  }
  const { lireContrat } = require('./relais-arbitre-openai.js');
  const contrat = lireContrat(corps);
  if (!contrat) return { ok: false, code: 'PROVENANCE_INVALIDE', motif: `le commentaire ${prov.reference} ne porte aucun NEXT_ACTION_CONTRACT.` };
  for (const [champ, val] of Object.entries(attendu || {})) {
    if (val === undefined || val === null) continue;
    if (sansBacktick(contrat[champ]) !== String(val)) {
      return { ok: false, code: 'PROVENANCE_INVALIDE', motif: `le contrat du commentaire porte ${champ}=${JSON.stringify(contrat[champ])}, la décision déposée porte ${champ}=${JSON.stringify(val)}.` };
    }
  }
  return { ok: true, niveau: 2 };
}

// Repli sans API : l'identité git du commit qui dépose la décision. Plus
// faible que la vérification par API (elle ne relit ni contrat ni run), mais
// non falsifiable sans les identifiants mêmes de l'étape de matérialisation —
// un dépôt direct par un agent commite sous SA PROPRE identité, jamais sous
// github-actions[bot]. Limite consignée (decision-3) : un job claude.yml
// partageant le même jeton y échapperait ; renvoyé à R2 et à la voie B.
function verifierCommitteurCi(committer) {
  if (committer === 'github-actions[bot]') return { ok: true, niveau: 2 };
  return { ok: false, code: 'PROVENANCE_NON_ETABLIE', motif: `author ChatGPT sans référence de matérialisation CI, et le commit est committé par ${JSON.stringify(committer)} (attendu github-actions[bot]) — une décision ChatGPT ne se consomme que matérialisée par la CI.` };
}

// Point d'entrée unique côté consommation. `decisionEnv` est l'enveloppe lue
// (author, provenance éventuelle) ; `attendu` = {LOT, REQUEST, DECISION,
// CLOSES} tels que le registre les porte déjà pour cette décision ; `opts` =
// {appelApi, committer} injectables pour l'épreuve.
function verifierALaConsommation(decisionEnv, attendu, opts) {
  opts = opts || {};
  const auteur = decisionEnv.author;
  if (IDENTITES_EXEMPTEES.includes(auteur)) return { ok: true };
  if (auteur === 'ChatGPT') {
    const prov = decisionEnv.provenance;
    if (prov && prov.mode === MODE_RELAIS_CI) return verifierGithubActionsRelay(prov, attendu, opts);
    const committer = typeof opts.committer === 'function' ? opts.committer() : opts.committer;
    return verifierCommitteurCi(committer);
  }
  return exigenceDeclaree(auteur, decisionEnv.provenance);
}

module.exports = {
  CODES, IDENTITES_EXEMPTEES, NIVEAUX_DECLARABLES, MODE_RELAIS_CI,
  formeValide, exigenceDeclaree, analyserReferenceCommentaire,
  verifierGithubActionsRelay, verifierCommitteurCi, verifierALaConsommation, appelApiDefaut,
};
