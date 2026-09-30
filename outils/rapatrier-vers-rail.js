'use strict';

/**
 * RAPATRIER UNE BRANCHE DE RUN VERS SON RAIL — LE MAILLON QUI MANQUAIT.
 *
 * LA RUPTURE. La chaîne NEXUS va : demande → réveil → Claude → branche de run
 * → CI → … et s'arrête là. Mesuré le 30/09/2026 : 64 branches `claude/issue-*`
 * sur 137 portent un travail vert que personne n'a jamais ramené sur le rail.
 * Le maillon suivant n'existait pas. Pas « en panne » : absent. Entre la CI
 * verte et le rail, il y avait un humain, et c'est cet humain que la mission
 * demande de retirer des opérations déterministes.
 *
 * CE QUE FAIT CE FICHIER. Il observe — git, GitHub, le réveil — sans rien
 * décider, il confie la décision à `qualifier-rapatriement.js`, il publie
 * l'état par `etat-maillon.js`, et il n'exécute le geste que si la décision
 * est `EXECUTE`. L'observation et la décision sont séparées parce qu'un outil
 * qui décide de ce qu'il observe finit par observer ce qu'il a décidé.
 *
 * CE QU'IL NE FAIT JAMAIS. Il ne fusionne pas, ne rebase pas, ne force pas, ne
 * résout aucun conflit. Le seul geste d'écriture possible est un
 * `git push origin <head>:<rail>` en avance rapide, suivi d'une RELECTURE de
 * la destination : une destination se vérifie par son SHA, pas par le code de
 * retour de la commande qui prétend l'avoir écrite.
 *
 * L'AUTORITÉ NE SE DÉDUIT PAS DE LA CAPACITÉ. `transport-autorise.js` exige
 * que la mission NOMME la destination. Ici, la mission, c'est la phrase que
 * Frédéric a écrite : `NEXUS_BASE_BRANCH=<rail>` dans le commentaire qui a
 * déclenché le run. Quand le rail vient de là — `origine: DECLENCHEUR` — il
 * est l'autorité. Quand il est IMPOSÉ par un appelant, l'autorité doit être
 * déclarée séparément, faute de quoi `MISSION_SANS_AUTORITE` arrête tout :
 * pouvoir désigner une destination ne suffit pas à s'autoriser à y écrire.
 *
 * LA CI, ET LE PIÈGE DU SERPENT QUI SE MORD LA QUEUE. Cette étape tourne DANS
 * un run qui est lui-même un check de la branche. Compter son propre check en
 * cours donnerait `CI_NON_VERTE` à tous les coups. On l'écarte donc par son
 * `GITHUB_RUN_ID`, et le vert du run courant est porté par sa place dans le
 * workflow : l'étape est en dernier et sous `if: success()`. C'est structurel,
 * pas déclaratif — une étape qui suit un échec ne s'exécute pas.
 *
 * CE QUI N'EST PAS MESURÉ ICI, ET QU'IL FAUT SAVOIR. `BASE_BRANCH_DISCORDANTE`
 * ne peut pas mordre dans ce câblage : `baseBranch` et `rail` sortent de la
 * même désignation, donc ils sont égaux par construction. Ce n'est pas une
 * garde décorative pour autant — le même défaut (« le résultat vise un rail
 * dont il ne part pas ») est attrapé plus loin, par `DIVERGENCE` : si le run a
 * été coupé ailleurs, le rail désigné n'est pas un ancêtre de son HEAD.
 */

const { execFileSync } = require('child_process');
const { resoudre } = require('./designation-rail.js');
const { qualifier } = require('./qualifier-rapatriement.js');
const { etat, publier, codeSortie } = require('./etat-maillon.js');

const MAILLON = 'rapatriement-claude-vers-rail';

// ── OBSERVATION ──────────────────────────────────────────────────────────────
// Un exécuteur injectable : les épreuves ne doivent pas avoir besoin d'un
// dépôt, et surtout pas d'un réseau. Il rend `{ code, sortie }` plutôt que de
// jeter, parce qu'ici un code non nul est très souvent une RÉPONSE
// (`--is-ancestor` répond « non » par 1) et pas une panne.
function executeurReel() {
  return (commande, args, options = {}) => {
    try {
      const sortie = execFileSync(commande, args, {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options,
      });
      return { code: 0, sortie: String(sortie) };
    } catch (err) {
      return { code: typeof err.status === 'number' ? err.status : 1,
        sortie: String(err.stdout || ''), erreur: String(err.stderr || err.message || '') };
    }
  };
}

function texte(r) { return r.code === 0 ? r.sortie.trim() : ''; }

// Les commentaires de l'issue, dans la forme attendue par `designation-rail`.
// L'issue n'est pas devinée : elle est inscrite dans le nom de la branche.
function commentairesDeLIssue(exec, issue, depot) {
  const r = exec('gh', ['api', '--paginate',
    `repos/${depot}/issues/${issue}/comments`,
    '--jq', '.[] | {date: .created_at, auteur: .user.login, corps: .body} | tostring']);
  if (r.code !== 0) return null;
  return r.sortie.split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

// Les vérifications du HEAD, moins celles du run courant. Rend `null` quand
// GitHub n'a pas répondu : `null` veut dire « non mesuré », et `qualifier`
// distingue `CI_NON_MESUREE` de `CI_NON_VERTE`. Confondre les deux ferait
// passer une absence de mesure pour un feu vert.
function verificationsDuHead(exec, depot, head, runCourant) {
  const r = exec('gh', ['api', '--paginate',
    `repos/${depot}/commits/${head}/check-runs`,
    '--jq', '.check_runs[] | {nom: .name, conclusion: .conclusion, url: .details_url} | tostring']);
  if (r.code !== 0) return null;
  const toutes = r.sortie.split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
  const aEcarter = runCourant ? new RegExp(`/runs/${runCourant}(/|$)`) : null;
  return toutes
    .filter((v) => !(aEcarter && aEcarter.test(String(v.url || ''))))
    .map((v) => ({ nom: v.nom, conclusion: v.conclusion }));
}

// Le lot auquel ce travail se rattache. On ne le déclare pas : on demande au
// réveil quelles branches portent les OCTETS de la demande de chaque lot. Un
// homonyme — même nom de fichier, contenu différent — n'est pas un
// rattachement, et `qualifier` le refuse comme tel.
function lotDeLaBranche(branche, analyse) {
  const lots = (analyse && Array.isArray(analyse.lots)) ? analyse.lots : [];
  const porte = (liste) => (liste || []).some((r) => r === branche || r === `origin/${branche}`);
  const rattaches = lots.filter((l) => l.refs_reelles && porte(l.refs_reelles.memes));
  if (rattaches.length === 1) return { lot: rattaches[0] };
  if (rattaches.length > 1) return { ambigu: rattaches.map((l) => l.lot) };
  // Aucun rattachement : on rend quand même le lot que le réveil considère
  // en cours, pour que le refus qui suit puisse le nommer.
  return { lot: lots[0] || null, aucun: true };
}

// LE DIFF, ET POURQUOI ON NE SE CONTENTE PAS DES CHEMINS.
// `qualifier` sait refuser une garde affaiblie — mais seulement si on lui donne
// les LIGNES. Lui passer la seule liste des fichiers rendrait ce contrôle muet
// tout en le laissant paraître présent, ce qui est exactement le défaut que ce
// lot ferme ailleurs. On relève donc trois choses en trois lectures : le statut
// (une garde SUPPRIMÉE est un affaiblissement), l'opacité (un binaire ne se
// qualifie pas), et les lignes ajoutées et retirées.
function relever(exec, railSha, head) {
  const plage = `${railSha}..${head}`;
  const par = new Map();
  const obtenir = (chemin) => {
    if (!par.has(chemin)) {
      par.set(chemin, { chemin, binaire: false, statut: 'M', lignes_ajoutees: [], lignes_supprimees: [] });
    }
    return par.get(chemin);
  };

  for (const l of texte(exec('git', ['diff', '--name-status', plage])).split('\n').filter(Boolean)) {
    const champs = l.split('\t');
    const chemin = champs[champs.length - 1];
    if (chemin) obtenir(chemin).statut = champs[0];
  }
  for (const l of texte(exec('git', ['diff', '--numstat', plage])).split('\n').filter(Boolean)) {
    const [ajouts, , chemin] = l.split('\t');
    if (chemin) obtenir(chemin).binaire = ajouts === '-';
  }

  // UN CONTENU PEUT RESSEMBLER À UN EN-TÊTE. La ligne SQL « -- commentaire »
  // arrive dans le diff sous la forme « --- commentaire » et se confondrait
  // avec l'en-tête « --- a/fichier ». On ne lit donc les en-têtes qu'à leur
  // place : entre « diff --git » et le premier « @@ ». Après, tout est contenu.
  let courant = null;
  let dansLesEnTetes = false;
  for (const l of texte(exec('git', ['diff', '--unified=0', plage])).split('\n')) {
    if (l.startsWith('diff --git ')) { courant = null; dansLesEnTetes = true; continue; }
    if (dansLesEnTetes) {
      if (l.startsWith('@@')) { dansLesEnTetes = false; continue; }
      if (l.startsWith('--- ')) {
        const source = l.slice(4).trim();
        if (source !== '/dev/null') courant = obtenir(source.replace(/^a\//, ''));
        continue;
      }
      if (l.startsWith('+++ ')) {
        const cible = l.slice(4).trim();
        if (cible !== '/dev/null') courant = obtenir(cible.replace(/^b\//, ''));
        continue;
      }
      continue;
    }
    if (l.startsWith('@@')) continue;
    if (!courant) continue;
    if (l.startsWith('+')) courant.lignes_ajoutees.push(l.slice(1));
    else if (l.startsWith('-')) courant.lignes_supprimees.push(l.slice(1));
  }

  return [...par.values()];
}

function observer(options = {}) {
  const exec = options.exec || executeurReel();
  const depot = options.depot || process.env.GITHUB_REPOSITORY || 'vito-sainte-marie/nexus-vito';
  const branche = options.branche
    || texte(exec('git', ['rev-parse', '--abbrev-ref', 'HEAD']));

  const pin = resoudre({
    branche,
    commentaires: options.commentaires !== undefined
      ? options.commentaires
      : commentairesDeLIssue(exec, (options.issue || issueDeLaBranche(branche)), depot),
    auteurAutorise: options.auteurAutorise || 'vito-sainte-marie',
    override: options.rail,
  });
  if (!pin.rail) return { refus: pin, branche };

  const rail = pin.rail;
  if (options.fetch !== false) exec('git', ['fetch', '--quiet', 'origin', rail]);

  const head = texte(exec('git', ['rev-parse', branche]));
  const railSha = texte(exec('git', ['rev-parse', `origin/${rail}`]));
  const baseSha = texte(exec('git', ['merge-base', head, `origin/${rail}`]));

  // `--is-ancestor` répond par son code de sortie. 0 = oui, 1 = non, autre =
  // la question n'a pas pu être posée : on ne traduit alors pas « je ne sais
  // pas » en « non ».
  const ancetre = (a, b) => {
    const r = exec('git', ['merge-base', '--is-ancestor', a, b]);
    return r.code === 0 ? true : r.code === 1 ? false : null;
  };

  const diff = relever(exec, railSha, head);

  const rattachement = options.rattachement
    || lotDeLaBranche(branche, options.analyse || analyseDuReveil(options));

  // L'autorité : la phrase de l'humain, ou une déclaration explicite. Jamais
  // la capacité technique d'écrire sur la branche.
  const autorites = pin.origine === 'DECLENCHEUR'
    ? [rail]
    : (options.autorites
      || String(process.env.NEXUS_TRANSPORT_AUTORITES || '').split(',').map((s) => s.trim()).filter(Boolean));

  return {
    branche,
    rail,
    railSha,
    head,
    baseBranch: pin.origine === 'DECLENCHEUR' ? rail : (options.baseBranch || ''),
    baseSha,
    railEstAncetre: ancetre(`origin/${rail}`, head),
    baseEstAncetreDuRail: ancetre(baseSha, `origin/${rail}`),
    diff,
    contenus: (chemin) => texte(exec('git', ['show', `${head}:${chemin}`])),
    ci: { verifications: options.verifications !== undefined
      ? options.verifications
      : verificationsDuHead(exec, depot, head, options.runCourant || process.env.GITHUB_RUN_ID) },
    lot: rattachement.lot ? rattachement.lot.lot : null,
    perimetre: rattachement.lot ? (rattachement.lot.perimetre || null) : null,
    refs: rattachement.lot ? rattachement.lot.refs_reelles : { memes: [], homonymes: [] },
    mission: { autorites },
    _origine: pin.origine,
    _ambigu: rattachement.ambigu || null,
  };
}

function issueDeLaBranche(branche) {
  const m = /^claude\/issue-(\d+)-/.exec(String(branche || ''));
  return m ? Number(m[1]) : null;
}

function analyseDuReveil(options) {
  if (options && options.analyse) return options.analyse;
  try { return require('./reveil-orchestrateur.js').analyser(); }
  catch (_) { return { lots: [] }; }
}

// ── DÉCISION, PUIS GESTE ─────────────────────────────────────────────────────

// Traduit un refus de `designation-rail` en état de maillon. Ces refus arrivent
// AVANT toute observation git : ils n'ont ni SHA ni lot, et les inventer serait
// pire que de les nommer inconnus.
function etatDeRefusDeDesignation(refus, branche) {
  return etat({
    etat: 'BLOCKED', maillon: MAILLON, code: refus.code,
    condition: 'branche Claude rattachable sans ambiguïté au rail déclaré',
    motif: refus.motif,
    sha: '(non résolu — la destination manque)',
    branche: branche || '(inconnue)',
    lot: '(non déterminé)',
    prochaine_action: 'Redéclencher le run avec un commentaire portant '
      + '`NEXUS_BASE_BRANCH=<rail>`. Un rail se désigne, il ne se devine pas.',
  });
}

// Le geste, et sa relecture. `pousser` est séparé de `decider` pour que
// l'épreuve puisse vérifier que RIEN n'est poussé quand la décision refuse :
// c'est la mutation qui compte, pas l'intention affichée dans un commentaire.
function pousser(entree, resultat, exec) {
  const { rail, head, branche, lot } = entree;
  const r = exec('git', ['push', 'origin', `${head}:refs/heads/${rail}`]);
  if (r.code !== 0) {
    return etat({
      etat: 'FAILED', maillon: MAILLON, code: 'TRANSPORT_REFUSE_PAR_ORIGIN',
      condition: 'avance rapide acceptée par origin',
      motif: `origin a refusé l'avance rapide de « ${rail} » vers ${head.slice(0, 8)}. `
        + 'Aucune reprise en force n\'est tentée : un refus d\'avance rapide dit que '
        + 'la destination a bougé, et la remesurer est le seul geste sûr.',
      sha: head, branche, lot: lot || '(inconnu)',
      prochaine_action: `Relancer la qualification : « ${rail} » n'est plus à `
        + `${entree.railSha.slice(0, 8)}.`,
      details: { destination: rail, erreur: (r.erreur || '').slice(0, 400) },
    });
  }

  // Une destination se vérifie. Un `git push` qui rend 0 dit que la commande
  // s'est bien passée, pas que la branche distante porte ce SHA.
  const relu = texte(exec('git', ['ls-remote', 'origin', `refs/heads/${rail}`])).split(/\s+/)[0] || '';
  if (relu !== head) {
    return etat({
      etat: 'FAILED', maillon: MAILLON, code: 'DESTINATION_NON_VERIFIEE',
      condition: 'destination relue au SHA attendu',
      motif: `Après transport, « ${rail} » porte ${relu ? relu.slice(0, 8) : '(rien)'} `
        + `alors que ${head.slice(0, 8)} était attendu. Le geste a rendu 0 et la `
        + 'destination dit autre chose : c\'est la destination qui a raison.',
      sha: head, branche, lot: lot || '(inconnu)',
      prochaine_action: `Constater l'état réel de « ${rail} » sur origin avant tout autre geste.`,
      details: { destination: rail, sha_attendu: head, sha_relu: relu || null },
    });
  }

  return etat({
    etat: 'EXECUTE', maillon: MAILLON, code: 'TRANSPORTE',
    condition: 'destination relue au SHA attendu',
    motif: `« ${rail} » avance jusqu'à ${head.slice(0, 8)} en avance rapide, et la `
      + 'destination relue porte bien ce SHA.',
    sha: head, branche, lot: lot || '(inconnu)',
    prochaine_action: `La CI de « ${rail} » reprend la chaîne à partir de ${head.slice(0, 8)}.`,
    details: { ...(resultat.details || {}), destination: rail, sha_verifie: relu },
  });
}

// L'orchestration. `transporter` est FAUX par défaut : le geste est opt-in.
// Un outil qui écrit par défaut finit par écrire là où personne ne l'a lu.
function rapatrier(options = {}) {
  const exec = options.exec || executeurReel();
  const entree = options.entree || observer({ ...options, exec });

  if (entree.refus) return etatDeRefusDeDesignation(entree.refus, entree.branche);

  if (entree._ambigu) {
    return etat({
      etat: 'BLOCKED', maillon: MAILLON, code: 'LOT_AMBIGU',
      condition: 'diff inspectable et attribuable à un seul lot',
      motif: `« ${entree.branche} » porte la demande de plusieurs lots `
        + `(${entree._ambigu.join(', ')}). Choisir pour l'humain serait décider du lot.`,
      sha: entree.head, branche: entree.branche, lot: entree._ambigu.join(' | '),
      prochaine_action: 'Séparer les demandes, ou désigner le lot explicitement.',
    });
  }

  const resultat = qualifier(entree);
  if (resultat.etat !== 'EXECUTE') return resultat;
  if (!options.transporter) {
    return etat({
      ...resultat, code: 'QUALIFIE_NON_TRANSPORTE',
      motif: `${resultat.motif} Le geste n'a PAS été exécuté : ce passage est une `
        + 'qualification à blanc.',
      maillon: MAILLON,
    });
  }
  return pousser(entree, resultat, exec);
}

module.exports = { MAILLON, observer, rapatrier, pousser, lotDeLaBranche, relever,
  issueDeLaBranche, verificationsDuHead, commentairesDeLIssue, executeurReel };

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
  const r = rapatrier({
    branche: arg('--branche'),
    rail: arg('--rail'),
    depot: arg('--depot'),
    transporter: process.argv.includes('--transporter'),
  });
  publier(r);
  process.exit(codeSortie(r));
}
