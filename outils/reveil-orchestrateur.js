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
// ÉTAT RÉEL AU 25/09/2026 : LE TRANSPORT EXISTE, LE DÉCLENCHEUR RESTE HUMAIN.
//
// Ce qui manquait tenait en quatre maillons. La demande se dépose (1), ce
// fichier la détecte (2), il sait désormais l'ADRESSER (3, corrigé le 25/09 —
// `wake_to` n'avait aucun écrivain : PROTOCOL.md demandait à Claude de poser
// une adresse dans un champ qu'aucun outil conforme ne savait émettre), et
// quelque chose la PORTE hors du dépôt (4). Le quatrième était le vrai trou,
// et cette section disait à juste titre qu'il n'existait pas.
//
// IL EXISTE MAINTENANT, et sans rien élargir : `tests.yml` publie le corps
// du réveil dans `$GITHUB_STEP_SUMMARY`. C'est une écriture de FICHIER —
// aucune permission supplémentaire. Le jeton garde `contents: read` et
// `actions: read`, et `test_permissions_workflow_20260908.js` continue de
// refuser toute permission en écriture. Publier en commentaire d'issue
// exigerait `issues: write`, c'est-à-dire un élargissement de la surface du
// jeton : un geste humain (CLAUDE.md) que Claude ne peut pas s'accorder. La
// variante est préparée et attend ce geste, elle n'est pas câblée.
//
// CE N'EST DONC PAS UN RÉVEIL AUTOMATIQUE, et il ne doit être présenté nulle
// part comme tel. `schedule` ne vit toujours que sur la branche par défaut,
// fermée par `decision-1.md` du lot NEXUS-ORCHESTRATION-AUTONOMIE-1-20260907.
// Ce que ce fichier fait, et ce n'est pas rien : rendre le geste humain COURT
// et EXACT. Le corps est déjà rédigé, déjà adressé, et il attend à l'endroit
// où l'on regarde déjà quand un run se termine. Personne n'a plus à
// reconstituer de tête quel lot attend quoi et sur quelle branche.
//
// L'ADRESSE NE VIT PAS ICI. `wake_to` se déclare dans le rail, jamais dans du
// code (PROTOCOL.md) : aucun outil ne code de destinataire en dur, et changer
// de canal doit rester un fait écrit. Sans adresse déclarée, le corps le dit
// et refuse de nommer quelqu'un au hasard.
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

// Un nom de fichier n'est pas une identité.
//
// Les runs d'agent branchent sur le rail, déposent `request-N.md`, poussent
// leur propre branche — et personne ne les rapatrie. Le même nom finit donc
// porté par plusieurs refs avec des contenus DIFFÉRENTS. Mesuré le 25/09/2026
// sur le lot 2 : sept documents en quatre à cinq versions incompatibles, dont
// une décision, et `request-18.md` en cinq exemplaires distincts.
//
// Répondre « voici les branches qui portent ce nom » revient alors à envoyer
// l'arbitre lire un AUTRE document que celui qu'on lui annonce — et rien n'a
// l'air faux : la ligne est bien formée, la branche existe, le fichier s'y
// trouve. C'est la mauvaise livraison la plus silencieuse qui soit. On compare
// donc l'empreinte du document, jamais son nom.
//
// Trois réponses distinctes, là où il n'y en avait qu'une :
//   memes       — refs portant CE document (mêmes octets) : à lire.
//   homonymes   — refs portant ce NOM avec un autre contenu : à ne pas lire.
//   ni l'un ni l'autre — le document n'est sur aucune ref : rien à lire ailleurs.
// La plomberie : quel objet chaque ref porte-t-elle À CE CHEMIN ?
//
// Séparée du classement ci-dessous, et prenant sa racine en argument, pour
// qu'une épreuve puisse la lancer sur un dépôt jetable où l'on a FABRIQUÉ deux
// branches portant le même nom de fichier avec des contenus différents. Le
// défaut corrigé le 25/09/2026 vivait ici — dans une requête qui demandait
// « ce chemin existe-t-il ? » au lieu de « que vaut-il ? ». Une garde qui ne
// peut pas rejouer ce défaut-là ne garde rien.
function blobsParRef(racine, chemin, suffixe) {
  const gitLa = (args, opts) => execFileSync('git', args,
    Object.assign({ cwd: racine, encoding: 'utf8' }, opts || {}));
  const trouves = new Map();
  const refs = gitLa(['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes'])
    .split('\n').map(x => x.trim()).filter(Boolean);
  for (const r of refs) {
    let ou = chemin;
    if (!ou && suffixe) {
      // Registre hors dépôt : on retrouve le fichier par son suffixe plutôt
      // que de présumer où les lots vivent.
      try {
        ou = gitLa(['ls-tree', '-r', '--name-only', r]).split('\n')
          .find(l => l.endsWith(suffixe)) || null;
      } catch (e) { ou = null; }
    }
    if (!ou) continue;
    // stderr muet : « absent de cette ref » est une réponse attendue, pas une
    // panne — la laisser parler noierait le réveil sous des `fatal:`.
    try {
      const blob = gitLa(['rev-parse', `${r}:${ou}`], { stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (blob) trouves.set(r, blob);
    } catch (e) { /* absente de cette ref : c'est une réponse, pas une panne */ }
  }
  return trouves;
}

// Le classement : un nom de fichier n'est pas une identité.
//
// Les runs d'agent branchent sur le rail, déposent `request-N.md`, poussent
// leur propre branche — et personne ne les rapatrie. Le même nom finit donc
// porté par plusieurs refs avec des contenus DIFFÉRENTS. Mesuré le 25/09/2026
// sur le lot 2 : sept documents en quatre à cinq versions incompatibles, dont
// une décision, et `request-18.md` en cinq exemplaires distincts.
//
// Répondre « voici les branches qui portent ce nom » revient alors à envoyer
// l'arbitre lire un AUTRE document que celui qu'on lui annonce — et rien n'a
// l'air faux : la ligne est bien formée, la branche existe, le fichier s'y
// trouve. C'est la mauvaise livraison la plus silencieuse qui soit.
//
// Trois réponses distinctes, là où il n'y en avait qu'une :
//   memes       — refs portant CE document (mêmes octets) : à lire.
//   homonymes   — refs portant ce NOM avec d'autres octets : à ne pas lire.
//   ni l'un ni l'autre — le document n'est sur aucune ref : rien à lire ailleurs.
// Quelles refs l'Orchestrateur peut-il réellement atteindre ?
//
// « Lisible ici » n'est pas « lisible là où l'arbitre se tient ». Une ref
// locale non poussée porte bien le document — et l'Orchestrateur, qui lit
// GitHub, ne trouvera rien à l'adresse qu'on lui donne. C'est le même défaut
// que l'homonymie, vu de l'autre bout : une désignation qui résout d'un côté
// et pas de l'autre. Mesuré le 25/09/2026 : `request-18.md` commité sur le
// rail local, absent d'`origin/handoff-continuite-20260920`.
function refsDistantes(racine) {
  const sortie = execFileSync('git',
    ['for-each-ref', '--format=%(refname:short)', 'refs/remotes'],
    { cwd: racine, encoding: 'utf8' });
  return new Set(sortie.split('\n').map(x => x.trim()).filter(Boolean));
}

function classerRefs(empreinte, blobs, distantes) {
  const memes = [];
  const homonymes = [];
  for (const [ref, blob] of blobs) {
    // Empreinte inconnue : on ne sait pas distinguer, donc on n'accuse
    // personne d'être un homonyme. Le dire vaut mieux que le deviner.
    if (empreinte === null) memes.push(ref);
    else if (blob === empreinte) memes.push(ref);
    else homonymes.push(ref);
  }
  // `distantes` absent : on ne sait pas, donc on ne dit rien — `null`, jamais
  // un `false` qui alarmerait à tort.
  const lisible_a_distance = !distantes ? null
    : memes.length === 0 ? null
    : memes.some(r => distantes.has(r));
  return { memes, homonymes, identifiable: empreinte !== null, lisible_a_distance };
}

function refsContenant(lot, fichier) {
  if (!RACINE_GIT) return null;
  const direct = cheminGit(lot, fichier);

  // L'empreinte du document tel qu'il est ICI, commité ou non : `hash-object`
  // répond sur un fichier du répertoire de travail.
  let empreinte = null;
  try {
    empreinte = git(['hash-object', '--', path.join(handoff.CHEMINS.LOTS, lot, fichier)]).trim();
  } catch (e) { empreinte = null; }

  try {
    return classerRefs(empreinte,
      blobsParRef(RACINE_GIT, direct, `/lots/${lot}/${fichier}`),
      refsDistantes(RACINE_GIT));
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
  // La déclaration du registre se lit dans outils/handoff.js, seul lecteur du
  // registre (ARCH-001) — ce fichier la rescannait pour son compte, et le
  // validateur ignorait donc qu'elle pouvait manquer. Une seule lecture, deux
  // consommateurs : `handoff.js verifier` avertit quand un lot en attente n'a
  // pas d'adresse, et ce réveil l'utilise. Ils ne peuvent plus diverger.
  const declaree = handoff.adresseDeReveil(lot);
  if (declaree.adresse) return declaree;
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
    // La demande visée se demande au registre (handoff.demandeVisee), elle ne
    // se recalcule pas ici : quand un humain a retenu la désignation par
    // dérogation, la recalculer depuis l'enveloppe rendait `null` et cette
    // boucle réveillait Claude sur une demande déjà arbitrée.
    const repond = derniere ? handoff.demandeVisee(lot, derniere.fichier) : null;
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
      // Vrai seulement si le document est lisible sur AU MOINS une ref et que
      // la branche déclarée n'en fait pas partie. `null` (git muet) n'est pas un
      // écart — et « sur aucune ref » n'est pas une déclaration trompeuse : c'est
      // une demande pas encore poussée, ce que dit la ligne `non_publiee`.
      branche_declaree_trompeuse: refs === null ? null
        : refs.memes.length > 0
          && !refs.memes.some(r => r === declaree || r === `origin/${declaree}`),
      non_publiee: refs === null ? null : refs.memes.length === 0,
      // Trois états, pas deux : lisible à distance, lisible seulement en
      // local, ou indéterminé (`null`) quand git est muet ou qu'aucune ref
      // ne la porte — auquel cas c'est `non_publiee` qui parle.
      lisible_a_distance: refs === null ? null : refs.lisible_a_distance,
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
    l.refs_reelles && l.refs_reelles.memes.length
      ? `Branche où la lire: ${l.refs_reelles.memes.map(r => '`' + r + '`').join(' , ')}`
      : `Branche où la lire: \`${l.branche || '(non déclarée)'}\``,
    l.branche_declaree_trompeuse
      ? `⚠️ L'enveloppe déclare \`branch: ${l.branche}\`, qui ne contient pas ce fichier. Ne cherche pas là.`
      : null,
    // Pas encore poussée n'est pas « à chercher ailleurs ». Le dire évite
    // d'envoyer l'arbitre fouiller des branches qui ne peuvent pas l'avoir.
    l.non_publiee
      ? `⚠️ Cette demande n'est sur aucune ref : elle n'est pas encore poussée. Rien à lire ailleurs — attends le push.`
      : null,
    // Et le même défaut vu de l'autre bout : le document existe, mais
    // seulement là où JE me tiens. L'annoncer sans le dire envoie l'arbitre
    // à une adresse qui, pour lui, est vide.
    l.refs_reelles && l.refs_reelles.lisible_a_distance === false
      ? `⚠️ Ce document n'existe que sur une ref LOCALE, non poussée. Tu ne peux pas le lire depuis GitHub : attends le push avant d'arbitrer.`
      : null,
    // Et surtout : nommer les homonymes plutôt que de les offrir comme lieux de
    // lecture. Même nom, autres octets — les lire, c'est arbitrer autre chose.
    l.refs_reelles && l.refs_reelles.homonymes.length
      ? `⚠️ ${l.refs_reelles.homonymes.length} ref(s) portent un fichier du MÊME NOM avec un contenu DIFFÉRENT. Ne pas les lire pour cette demande : ${l.refs_reelles.homonymes.map(r => '`' + r + '`').join(' , ')}`
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

module.exports = { analyser, examiner, corpsReveil, blobsParRef, classerRefs, refsDistantes };

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
