#!/usr/bin/env node
'use strict';
// PROGRESS_FINGERPRINT — un réveil ne se répète pas sans progrès.
//
// LE DÉFAUT QUE CECI SUPPRIME. La règle 11 du skill Fast Track et le
// PROGRESS_FINGERPRINT qui la mesure existaient depuis des semaines, en prose
// seulement : « LOT + REQUEST + HEAD + GATE_STATE + BLOCKER + ACTION_NEXT. Le
// même fingerprint deux fois de suite donne FAST_TRACK_STALL. » Une recherche
// dans `outils/` le 09/10/2026 n'en a trouvé aucune trace : ni fonction, ni
// garde, ni épreuve. La règle reposait donc entièrement sur l'attention de
// l'agent qui la lisait — et GOV-001 dit déjà pourquoi cela ne suffit pas :
// « ne jamais réveiller Claude deux fois pour la même décision canonique ».
// Entre-temps, la seule protection câblée était l'empreinte du CORPS du réveil
// (`<!-- nexus-reveil: … -->`), qui ne mord que sur un corps rigoureusement
// identique. Il suffisait qu'une ref de plus porte la demande — le corps liste
// les branches où la lire — pour que l'empreinte change et que le même réveil
// reparte, alors que rien n'avait avancé dans le Handoff.
//
// CE QUE CE MODULE AJOUTE. Une empreinte de l'ÉTAT, et non du texte. Deux
// réveils dont l'état est identique portent la même empreinte même si leurs
// corps diffèrent ; deux réveils dont l'état a bougé portent des empreintes
// différentes même si leurs corps se ressemblent. La marque voyage dans le
// commentaire publié, donc l'historique du canal suffit à répondre : ce relais
// a-t-il déjà eu lieu sans que rien ne bouge depuis ?
//
// CE QUE `HEAD` DÉSIGNE ICI, ET POURQUOI. Pris comme le SHA du push, `HEAD`
// changerait à chaque commit, l'empreinte aussi, et la garde ne mordrait
// jamais : un commit sur un écran Paye relancerait un réveil Handoff inchangé.
// L'appelant fournit donc le SHA du dernier commit touchant le DOMAINE du
// handoff (`docs/handoff/**`). Ce n'est pas un assouplissement inventé ici :
// c'est la règle PROOF_CACHE du même skill, qui invalide une preuve par
// domaine et dit en propres termes que « `docs/handoff/**` n'invalide pas une
// preuve Paye ou FDJ ». Le choix est porté au contrat, pas caché dans un
// script : l'épreuve le fixe, et la demande le soumet à l'arbitre.
//
// CE MODULE NE DÉCIDE PAS DE PUBLIER. Il rend un état. La publication reste à
// l'étape CI, qui sait rendre un `BLOCKED` exploitable par `etat-maillon.js` —
// un STALL est un arrêt légitime, pas une panne, et il ne rougit pas.

const crypto = require('crypto');

// L'ORDRE EST CELUI DE LA DOCTRINE. Il est aussi normatif que la liste : deux
// implémentations qui ordonnent différemment rendraient deux empreintes pour un
// même état, et la garde se croirait devant un progrès.
const CHAMPS_EMPREINTE = Object.freeze(['lot', 'request', 'head', 'gate_state', 'blocker', 'action_next']);

const MARQUE_PREFIXE = 'nexus-empreinte';
const LONGUEUR = 16;

// Combien d'occurrences ANTÉRIEURES sont tolérées avant de publier. Zéro, et
// c'est la lettre de la règle 11 : « le même fingerprint DEUX FOIS DE SUITE
// donne FAST_TRACK_STALL ». Publier alors qu'une occurrence existe déjà ferait
// précisément la deuxième.
const ANTERIEURES_TOLEREES = 0;

const ABSENT = '(absent)';

function vide(v) { return v === undefined || v === null || String(v).trim() === ''; }

// Normalise sans écraser : espaces repliés, bords coupés. Pas de minuscules —
// `request-3.md` et `REQUEST-3.md` ne sont pas le même fichier, et masquer la
// différence serait inventer un progrès ou en effacer un.
function normaliser(v) {
  return vide(v) ? ABSENT : String(v).trim().replace(/\s+/g, ' ');
}

/**
 * Empreinte des six champs doctrinaux.
 * @param {object} champs — lot, request, head, gate_state, blocker, action_next.
 * @returns {string} 16 caractères hexadécimaux.
 */
function empreinte(champs) {
  const c = champs || {};
  // `lot` est exigé : une empreinte qui ne sait pas de quel lot elle parle
  // regrouperait deux chantiers sous le même état et bloquerait le mauvais.
  if (vide(c.lot)) throw new Error('Une empreinte de progression doit nommer son lot.');
  const canonique = CHAMPS_EMPREINTE.map(k => `${k}=${normaliser(c[k])}`).join('\n');
  return crypto.createHash('sha256').update(canonique, 'utf8').digest('hex').slice(0, LONGUEUR);
}

function marque(e) { return `<!-- ${MARQUE_PREFIXE}: ${e} -->`; }

// Toutes les empreintes présentes dans un texte — typiquement la concaténation
// des commentaires du canal. Rend un tableau, doublons compris : compter est le
// but, dédupliquer ferait disparaître la répétition qu'on cherche.
function empreintesDuTexte(texte) {
  if (vide(texte)) return [];
  const re = new RegExp(`<!--\\s*${MARQUE_PREFIXE}:\\s*([0-9a-f]{${LONGUEUR}})\\s*-->`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(String(texte))) !== null) out.push(m[1]);
  return out;
}

/**
 * Faut-il publier ce réveil, ou est-ce un STALL ?
 * @param {object} champs — les six champs.
 * @param {string} texteCanal — l'historique du canal (corps des commentaires).
 * @returns {{etat:'PUBLIER'|'FAST_TRACK_STALL', empreinte:string, marque:string,
 *            anterieures:number, champs:object}}
 */
function decider(champs, texteCanal) {
  const e = empreinte(champs);
  const anterieures = empreintesDuTexte(texteCanal).filter(x => x === e).length;
  return Object.freeze({
    etat: anterieures > ANTERIEURES_TOLEREES ? 'FAST_TRACK_STALL' : 'PUBLIER',
    empreinte: e,
    marque: marque(e),
    anterieures,
    champs: Object.freeze(CHAMPS_EMPREINTE.reduce((o, k) => (o[k] = normaliser(champs[k]), o), {})),
  });
}

// ── PORTE D'ENTRÉE EN LIGNE DE COMMANDE ──────────────────────────────────────
//   node outils/empreinte-progression.js --lot L --request R --head H \
//        [--gate-state G] [--blocker B] [--action-next A] [--marques -] [--json]
// `--marques -` lit l'historique du canal sur l'entrée standard. Même raison
// que pour `etat-maillon.js` : l'appelant est une étape `run:` en bash, qui ne
// peut pas `require` ce module.
function principal(argv, stdin) {
  const champs = {};
  let marques = '';
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const cle = argv[i].slice(2).replace(/-/g, '_');
    if (cle === 'json') { json = true; continue; }
    const val = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : '';
    if (cle === 'marques') marques = val === '-' ? (stdin || '') : val;
    else champs[cle] = val;
  }
  const r = decider(champs, marques);
  if (json) process.stdout.write(JSON.stringify(r) + '\n');
  else {
    process.stdout.write(`${r.etat} — empreinte ${r.empreinte}, ${r.anterieures} occurrence(s) antérieure(s)\n`);
    for (const k of CHAMPS_EMPREINTE) process.stdout.write(`  ${k} : ${r.champs[k]}\n`);
  }
  if (process.env.GITHUB_OUTPUT) {
    require('fs').appendFileSync(process.env.GITHUB_OUTPUT,
      `empreinte=${r.empreinte}\nempreinte_etat=${r.etat}\nempreinte_anterieures=${r.anterieures}\n`);
  }
  return 0;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const lireStdin = argv.includes('--marques') && argv[argv.indexOf('--marques') + 1] === '-';
  const stdin = lireStdin && !process.stdin.isTTY ? require('fs').readFileSync(0, 'utf8') : '';
  try {
    process.exitCode = principal(argv, stdin);
  } catch (err) {
    process.stdout.write(`::error::empreinte de progression incalculable — ${err.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  CHAMPS_EMPREINTE, MARQUE_PREFIXE, ANTERIEURES_TOLEREES, ABSENT,
  empreinte, marque, empreintesDuTexte, decider, normaliser,
};
