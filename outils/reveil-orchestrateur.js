#!/usr/bin/env node
'use strict';
// Réveil de l'Orchestrateur — l'autre moitié du rail.
//
// POURQUOI. `outils/reveil-handoff.js` répond à « reste-t-il une décision que
// personne n'a consommée ? ». C'est la moitié Claude du cycle. La moitié
// symétrique n'avait aucun outil : « reste-t-il une demande que personne n'a
// arbitrée ? ». Tant qu'elle manque, Frédéric sert de facteur dans l'autre
// sens — il doit aller dire à l'Orchestrateur qu'un `request-N.md` l'attend,
// exactement le rôle que la gouvernance v2 lui refuse (« ne doit pas servir de
// facteur entre agents pour les problèmes déterministes »).
//
// Le cas qui a motivé ce fichier : le 21/09/2026, `request-2.md` du lot
// NEXUS-CONTINUITE-TERRAIN-1-20260920 était déposé, conforme et complet sur
// une branche `claude/issue-28-…`, et rien au monde n'en avertissait
// l'Orchestrateur. La demande n'était pas perdue : elle était invisible.
//
// CE QU'IL FAIT. Il lit le registre et il conclut. Il ne réveille personne.
//
// ÉTAT RÉEL AU 21/09/2026 : OUTIL PRÊT, AUCUN DÉCLENCHEUR ACTIF, ET LE
// TRANSPORT N'EXISTE PAS. Le jeton de `tests.yml` porte `contents: read` et
// `actions: read` — il ne peut pas écrire un commentaire d'issue. Lui ajouter
// `issues: write` serait un élargissement de sa surface, donc un geste humain
// (CLAUDE.md) que Claude ne peut pas s'accorder. Et `schedule` ne vit que sur
// la branche par défaut, fermée par `decision-1.md` du lot
// NEXUS-ORCHESTRATION-AUTONOMIE-1-20260907. Le réveil de l'Orchestrateur bute
// donc sur exactement le même mur qu'ORCH-001, pour les mêmes raisons.
//
// Jusqu'à ce qu'un control-plane externe existe, ce fichier sert à une seule
// chose, qui n'est pas rien : rendre le geste humain COURT et EXACT. Personne
// n'a plus à reconstituer de tête quel lot attend quoi et sur quelle branche.
// Il ne doit être présenté nulle part comme « un réveil automatique ».
//
//   node outils/reveil-orchestrateur.js            # texte lisible, sortie 0
//   node outils/reveil-orchestrateur.js --json     # objet complet
//   node outils/reveil-orchestrateur.js --message  # corps du réveil, prêt à poster
//
// Sortie GitHub Actions : `reveil=true|false`, `motif=…`, `lot=<LOT_ID>` dans
// $GITHUB_OUTPUT quand la variable existe.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Même emprunt que son jumeau : la lecture du registre appartient à
// handoff.js (ARCH-001). Deux lectures divergeraient au premier changement.
const handoff = require(path.join(__dirname, 'handoff.js'));

const RACINE_GIT = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'],
      { cwd: __dirname, encoding: 'utf8' }).trim() || null;
  } catch (e) { return null; }
})();

function etatRegistre() {
  const chemin = handoff.CHEMINS.ETAT;
  if (!fs.existsSync(chemin)) return null;
  try { return JSON.parse(fs.readFileSync(chemin, 'utf8')); } catch (e) { return { illisible: e.message }; }
}

// Où la demande se lit VRAIMENT.
//
// L'enveloppe porte un champ `branch`, mais c'est une intention : la branche
// sur laquelle Claude pensait travailler. Un run Claude déposé par GitHub
// pousse en réalité sur une ref `claude/issue-N-…`, et l'enveloppe continue de
// nommer l'autre. Le 21/09/2026, `request-2.md` déclarait
// `handoff-continuite-20260920` alors que la seule ref qui le contenait était
// `origin/claude/issue-28-20260921-1051`.
//
// Un réveil qui envoie l'Orchestrateur sur la branche déclarée lui fait ouvrir
// un dossier vide et conclure « rien à arbitrer ». On demande donc à git, qui
// sait, plutôt qu'à l'enveloppe, qui croit.
//
// Rien n'est codé en dur ici : ni le nom du remote (toutes les refs locales et
// distantes sont interrogées), ni le chemin des lots (déduit de CHEMINS.LOTS,
// et à défaut retrouvé par suffixe). Un dépôt qui renommerait son remote ou
// déplacerait `docs/handoff` n'aurait pas à modifier ce fichier.
function git(args, opts) {
  return execFileSync('git', args, Object.assign({ cwd: RACINE_GIT, encoding: 'utf8' }, opts || {}));
}

// Chemin de la demande tel que git le connaît, ou null si le registre lu n'est
// pas celui du dépôt (cas d'un NEXUS_HANDOFF_DIR pointant ailleurs).
function cheminGit(lot, fichier) {
  if (!RACINE_GIT) return null;
  const rel = path.relative(RACINE_GIT, path.join(handoff.CHEMINS.LOTS, lot, fichier));
  return rel.startsWith('..') || path.isAbsolute(rel) ? null : rel.split(path.sep).join('/');
}

function refsContenant(lot, fichier) {
  if (!RACINE_GIT) return null;
  const direct = cheminGit(lot, fichier);
  const suffixe = `/lots/${lot}/${fichier}`;
  try {
    const refs = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes'])
      .split('\n').map(x => x.trim()).filter(Boolean);
    const trouvees = [];
    for (const r of refs) {
      let present = false;
      if (direct) {
        try { git(['cat-file', '-e', `${r}:${direct}`], { stdio: 'ignore' }); present = true; }
        catch (e) { /* absente de cette ref : c'est une réponse, pas une panne */ }
      } else {
        // Registre hors dépôt : on retrouve le fichier par son suffixe plutôt
        // que de présumer où les lots vivent.
        try {
          present = git(['ls-tree', '-r', '--name-only', r]).split('\n')
            .some(l => l.endsWith(suffixe));
        } catch (e) { present = false; }
      }
      if (present) trouvees.push(r);
    }
    return trouvees;
  } catch (e) {
    return null; // pas de git sous la main : on se taira plutôt que d'inventer
  }
}

// À qui adresser le réveil.
//
// L'adresse n'est PAS dans ce fichier, et c'est le point. Elle est donnée par
// l'ordre : Claude la pose en ouvrant le lot, ou l'Orchestrateur la (re)pose
// dans une décision, via le champ d'enveloppe `wake_to`. L'outil prend la plus
// récente déclaration du lot, demandes et décisions confondues. Changer de
// canal — autre issue, autre dépôt, autre transport — est alors un fait écrit
// dans le rail, jamais une modification de code.
//
// Si le lot ne dit rien, NEXUS_HANDOFF_WAKE_TO peut router sans toucher aux
// fichiers. Si personne ne dit rien, l'outil l'annonce et n'invente pas
// d'adresse : un réveil envoyé au hasard réveille le mauvais agent.
function adresseReveil(lot) {
  // echanges(lot) sans genre ne rend que les décisions : on demande les deux
  // familles, et on les remet dans l'ordre où le rail les produit —
  // request-1, decision-1, request-2, decision-2… — pour que « la plus
  // récente déclaration » veuille bien dire ce qu'elle dit.
  const rang = e => e.seq * 2 + (e.kind === 'decision' ? 1 : 0);
  const tous = []
    .concat(handoff.echanges(lot, 'request').map(e => Object.assign({ kind: 'request' }, e)))
    .concat(handoff.echanges(lot, 'decision').map(e => Object.assign({ kind: 'decision' }, e)))
    .sort((a, b) => rang(b) - rang(a));
  for (const e of tous) {
    const env = handoff.lireEnveloppe(path.join(handoff.CHEMINS.LOTS, lot, e.fichier));
    const v = env && env.env && env.env.wake_to;
    if (v && String(v).trim()) return { adresse: String(v).trim(), source: e.fichier };
  }
  const env = process.env.NEXUS_HANDOFF_WAKE_TO;
  if (env && env.trim()) return { adresse: env.trim(), source: 'NEXUS_HANDOFF_WAKE_TO' };
  return { adresse: null, source: null };
}

// Une demande appelle l'Orchestrateur quand elle est la dernière du lot et
// qu'aucune décision ne lui répond. Le critère est `in_reply_to`, pas le
// numéro : une décision peut répondre à une demande ancienne alors qu'une plus
// récente attend toujours — c'est le cas DEMANDE_DEPASSEE ci-dessous, qui est
// une attente réelle et non un lot au repos.
function examiner(etat) {
  const attentes = [];
  for (const [lot, v] of Object.entries((etat && etat.lots) || {})) {
    const active = handoff.dernier(handoff.echanges(lot, 'request'));
    if (!active) continue;

    const derniere = handoff.dernier(handoff.echanges(lot, 'decision'));
    let repond = null;
    if (derniere) {
      const env = handoff.lireEnveloppe(path.join(handoff.CHEMINS.LOTS, lot, derniere.fichier));
      repond = env && env.env && env.env.in_reply_to
        ? path.basename(String(env.env.in_reply_to).trim()) : null;
    }
    if (repond && repond === active.fichier) continue; // arbitrée : rien à demander

    const env = handoff.lireEnveloppe(path.join(handoff.CHEMINS.LOTS, lot, active.fichier));
    const refs = refsContenant(lot, active.fichier);
    const ou = adresseReveil(lot);
    const declaree = (env && env.env && env.env.branch) || null;
    attentes.push({
      lot,
      demande: active.fichier,
      branche: declaree,
      refs_reelles: refs,
      adresse: ou.adresse,
      adresse_source: ou.source,
      // Vrai seulement si git a répondu ET qu'aucune ref portant la branche
      // déclarée ne contient le fichier. `null` (git muet) n'est pas un écart.
      branche_declaree_trompeuse: refs === null ? null
        : !refs.some(r => r === declaree || r === `origin/${declaree}`),
      token_mode: (env && env.env && env.env.token_mode) || null,
      statut_enveloppe: (env && env.env && env.env.status) || null,
      statut_registre: v.statut || null,
      derniere_decision: derniere ? derniere.fichier : null,
      motif: derniere ? 'DEMANDE_DEPASSEE' : 'DEMANDE_NON_ARBITREE',
    });
  }
  return attentes;
}

function analyser() {
  const etat = etatRegistre();
  if (!etat) return { reveil: false, motif: 'REGISTRE_ABSENT', lots: [],
    message: 'docs/handoff/STATE.json absent — rien à réveiller, mais rien ne va bien non plus.' };
  if (etat.illisible) return { reveil: false, motif: 'REGISTRE_ILLISIBLE', lots: [],
    message: `STATE.json illisible (${etat.illisible}) — un réveil sur un registre corrompu ferait plus de mal que de bien.` };

  const attentes = examiner(etat);
  if (!attentes.length) {
    return { reveil: false, motif: 'RIEN_A_FAIRE', lots: [],
      message: "Rien à réveiller : aucune demande n'attend d'arbitrage." };
  }
  const premier = attentes[0];
  return { reveil: true, motif: premier.motif, lot: premier.lot, demande: premier.demande,
    branche: premier.branche, lots: attentes,
    message: `Réveil Orchestrateur : ${premier.lot}/${premier.demande} attend un arbitrage.` +
      (attentes.length > 1 ? ` (${attentes.length} lots concernés ; le premier est traité.)` : '') };
}

// Le corps du réveil. Volontairement factuel et court : il nomme le lot, le
// fichier, la branche où le lire, et il rappelle les interdits permanents.
// Il ne résume PAS la demande — un résumé écrit par le demandeur est une
// façon polie de décider à la place de celui qui arbitre.
function corpsReveil(r) {
  if (!r.reveil) return r.message;
  const l = r.lots[0];
  return [
    'NEXUS Orchestrator — réveil Handoff (sens Claude → Orchestrateur).',
    '',
    l.adresse
      ? `Adressé à: ${l.adresse}  _(déclaré par \`${l.adresse_source}\`)_`
      : "Adressé à: **non déclaré** — aucun échange du lot ne porte `wake_to`, et NEXUS_HANDOFF_WAKE_TO n'est pas posé. Ce réveil n'a pas de destinataire : il ne doit pas être publié au hasard.",
    '',
    `LOT_ID: \`${l.lot}\``,
    `Demande en attente: \`${l.demande}\``,
    l.refs_reelles && l.refs_reelles.length
      ? `Branche où la lire: ${l.refs_reelles.map(r => '`' + r + '`').join(' , ')}`
      : `Branche où la lire: \`${l.branche || '(non déclarée)'}\``,
    l.branche_declaree_trompeuse
      ? `⚠️ L'enveloppe déclare \`branch: ${l.branche}\`, qui ne contient pas ce fichier. Ne cherche pas là.`
      : null,
    `Motif: \`${l.motif}\`` + (l.derniere_decision ? ` (dernière décision \`${l.derniere_decision}\`, qui ne lui répond pas)` : ''),
    l.token_mode ? `token_mode demandé: \`${l.token_mode}\`` : null,
    '',
    'Arbitre cette demande avec le protocole `nexus-handoff/2` et dépose la',
    'décision correspondante dans le même lot.',
    '',
    // Pas d'invariants récités ici. Ils appartiennent au lot et à la
    // gouvernance, pas à l'outil qui transporte le réveil : les recopier en
    // dur, c'est créer une seconde source de vérité qui vieillira seule.
    'Les invariants applicables sont ceux du lot et de la gouvernance en',
    'vigueur. Ce réveil ne les réécrit pas et ne décide rien.',
  ].filter(x => x !== null).join('\n');
}

function ecrireSortieActions(r) {
  const fichier = process.env.GITHUB_OUTPUT;
  if (!fichier) return;
  fs.appendFileSync(fichier, [`reveil=${r.reveil}`, `motif=${r.motif}`, `lot=${r.lot || ''}`].join('\n') + '\n');
}

module.exports = { analyser, examiner, corpsReveil };

if (require.main === module) {
  const r = analyser();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else if (process.argv.includes('--message')) console.log(corpsReveil(r));
  else {
    console.log(r.message);
    for (const l of r.lots) console.log(`  - ${l.lot} : ${l.demande} (${l.motif}), branche ${l.branche || '?'}, statut ${l.statut_registre}`);
  }
  ecrireSortieActions(r);
  // Toujours 0, pour la même raison que son jumeau : c'est une question, pas
  // une garde. Un code d'erreur ferait passer « rien à faire » pour une panne.
  process.exit(0);
}
