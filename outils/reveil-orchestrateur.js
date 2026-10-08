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
// AMENDEMENT DU 30/09/2026 — le paragraphe ci-dessus décrit l'état de son
// écriture, et deux de ses faits ont depuis changé. `issues: write` a été
// accordée le 26/09/2026 : la variante n'attend plus rien, le réveil est
// réellement publié en commentaire sur #28. Et `contents: write` a été accordée
// le 30/09/2026 pour le seul rapatriement vers le rail — le jeton ne garde donc
// plus `contents: read`. Ce que ce paragraphe affirmait du TRANSPORT DU RÉVEIL
// reste exact et c'est son sujet : l'écriture dans `$GITHUB_STEP_SUMMARY` ne
// coûte aucune permission. L'autorité, le périmètre et la date de chacune des
// trois permissions sont inscrits dans `.github/workflows/tests.yml`, qui est
// la source unique sur ce point ; ce commentaire-ci n'en est pas une.
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
  //
  // `distants` garde la LISTE, pas seulement le fait qu'elle soit non vide :
  // le déclencheur de retour doit nommer une branche, et un booléen ne nomme
  // rien. Recalculer cette liste ailleurs, c'est mesurer deux fois.
  const distants = !distantes ? null : memes.filter(r => distantes.has(r));
  const lisible_a_distance = !distantes ? null
    : memes.length === 0 ? null
    : distants.length > 0;
  return { memes, homonymes, distants, identifiable: empreinte !== null, lisible_a_distance };
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
//
// RÉSOLUTION — FAST-TRACK-ANTI-PAUSE-1-20261007.
//
// `wake_to` est délibérément une adresse LIBRE (PROTOCOL.md) : « ChatGPT »,
// « Claude », une URL. C'est un rôle lisible par un humain, pas forcément un
// canal postable. Or l'étape CI qui publie le réveil (tests.yml, « Réveil
// Orchestrateur — publication au destinataire déclaré ») n'accepte qu'une
// adresse de la forme exacte `<serveur>/<dépôt>/issues/<numéro>` — tout le
// reste tombe dans son refus `ADRESSE_HORS_DEPOT`, qui ne rougit pas (c'est un
// arrêt légitime, pas une panne) mais qui, surtout, NE PUBLIE RIEN sur
// l'issue : le réveil reste cantonné au résumé du run, que personne ne lit
// sans savoir qu'il faut l'y chercher. C'est exactement ce qui a stoppé
// `GOUVERNANCE-REFERENCE-CODE-20261005/request-6.md` (`wake_to: ChatGPT`,
// 07/10/2026) : une limitation de CANAL, pas un blocage réel — le canal de
// l'issue existe et fonctionne, seule la traduction du rôle vers son adresse
// manquait.
//
// `docs/handoff/CANAUX.json` porte cette traduction comme un FAIT ÉCRIT DANS
// LE RAIL (PROTOCOL.md : « aucun outil ne code de destinataire en dur »). Ce
// fichier ne fait que la LIRE ; changer de canal reste une édition de ce
// fichier, jamais de ce code. Absent, illisible, ou sans entrée pour le rôle
// déclaré : la résolution échoue proprement et l'adresse brute est rendue
// inchangée — exactement le comportement d'avant cette correction, jamais
// une régression silencieuse.
function canauxConnus() {
  try {
    const brut = JSON.parse(fs.readFileSync(path.join(handoff.CHEMINS.HANDOFF, 'CANAUX.json'), 'utf8'));
    return (brut && typeof brut.canaux === 'object' && brut.canaux) || {};
  } catch (e) { return {}; }
}

// Pure et testable séparément : donne l'adresse déclarée, dit si elle a été
// résolue, et ne perd jamais le rôle d'origine — `corpsReveil` en a besoin
// pour rester lisible par un humain (« Adressé à: ChatGPT » reste vrai même
// une fois résolu vers une URL).
function resoudreCanal(adresseBrute) {
  if (!adresseBrute) return { adresse: adresseBrute, role: null, resolue: false };
  const cle = String(adresseBrute).trim();
  const canaux = canauxConnus();
  if (canaux[cle] && String(canaux[cle]).trim()) {
    return { adresse: String(canaux[cle]).trim(), role: cle, resolue: true };
  }
  return { adresse: cle, role: null, resolue: false };
}

function adresseReveil(lot) {
  // La déclaration du registre se lit dans outils/handoff.js, seul lecteur du
  // registre (ARCH-001) — ce fichier la rescannait pour son compte, et le
  // validateur ignorait donc qu'elle pouvait manquer. Une seule lecture, deux
  // consommateurs : `handoff.js verifier` avertit quand un lot en attente n'a
  // pas d'adresse, et ce réveil l'utilise. Ils ne peuvent plus diverger.
  const declaree = handoff.adresseDeReveil(lot);
  if (declaree.adresse) {
    const r = resoudreCanal(declaree.adresse);
    return { adresse: r.adresse, source: declaree.source, role: r.role, resolue: r.resolue };
  }
  const env = process.env.NEXUS_HANDOFF_WAKE_TO;
  if (env && env.trim()) {
    const r = resoudreCanal(env.trim());
    return { adresse: r.adresse, source: 'NEXUS_HANDOFF_WAKE_TO', role: r.role, resolue: r.resolue };
  }
  return { adresse: null, source: null, role: null, resolue: false };
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
      adresse_role: ou.role,
      adresse_resolue: ou.resolue,
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

// Le déclencheur de RETOUR, sens Orchestrateur → Claude.
//
// Mesuré le 26/09/2026 : le réveil nommait la branche où LIRE, et jamais la
// désignation que le déclencheur de retour doit porter. Le 25/09 à 13 h 10, le
// commentaire de réponse est arrivé sans `NEXUS_BASE_BRANCH`. Le workflow a
// refusé — c'est exactement son rôle, un rail ne se devine pas — mais il a
// refusé à sa PREMIÈRE étape, donc avant toute étape capable de répondre : le
// refus n'est revenu nulle part. Vingt-cinq heures de silence pour une ligne
// absente, et un silence qui ne se distingue pas d'un rail mort.
//
// Ce bloc ne devine aucun rail. Il redit, dans la syntaxe que le workflow
// exige, la branche distante DÉJÀ MESURÉE comme portant ce document. S'il n'y
// en a pas exactement une, il ne tranche pas — il le dit et rend la main.
// Une branche de run Claude n'est JAMAIS un rail : elle naît d'un run, personne
// ne la fusionne, elle expire. Et elle porte le MÊME document que le rail —
// elle en descend — donc l'empreinte ne la distingue pas : seule sa PROVENANCE
// le fait. Sans ce filtre, le premier run publié fait deux candidats, l'arbitrage
// refuse de trancher (à raison), et le réveil cesse de nommer le rail de retour.
// Le défaut se referme alors tout seul, un run plus tard, sans que rien rougisse.
const BRANCHE_DE_RUN = /^claude\//;

function railDeRetour(l) {
  const r = l.refs_reelles;
  if (!r || !r.distants || !r.distants.length) return null;
  // Nom court d'une ref de `refs/remotes` : le premier segment est le remote.
  const noms = [...new Set(r.distants.map(x => x.replace(/^[^/]+\//, '')))]
    .filter(n => !BRANCHE_DE_RUN.test(n));
  return noms.length === 1 ? noms[0] : null;
}

// `mention: false` retire la mention `@`+`claude` du corps. Ce n'est pas une
// coquetterie : `claude.yml` se déclenche sur TOUT commentaire qui la contient,
// sans filtre d'auteur. Un réveil publié par la CI qui la porterait relancerait
// Claude, qui pousserait une branche, qui relancerait la CI, qui republierait.
// Aujourd'hui seule une propriété de plateforme (GitHub n'enchaîne pas les
// workflows déclenchés par `github.token`) empêche la boucle — invisible, et
// qui tombe le jour où quelqu'un pose un PAT. Le filtre d'auteur a sa place
// dans `claude.yml`, sur `main` ; tant qu'il n'y est pas, le corps publié ne
// porte pas la mention et dit pourquoi.
function blocRetour(l, opts) {
  const mention = !opts || opts.mention !== false;
  const entete = 'Pour me répondre, le déclencheur doit NOMMER le rail :';
  const rail = railDeRetour(l);
  if (!rail) {
    return [entete,
      'aucune branche distante ne porte ce document de façon univoque. Ce réveil',
      'ne dicte donc pas de désignation : nomme le rail toi-même. Sans une ligne',
      '`NEXUS_BASE_BRANCH=<branche>`, le workflow refuse à sa première étape et',
      'ce refus ne revient nulle part.'].join('\n');
  }
  return [entete,
    '```text',
    (mention ? '@claude ' : '') + 'NEXUS_BASE_BRANCH=`' + rail + '`',
    '<ta décision, ou la consigne qui suit>',
    '```',
    mention ? null
      : 'Préfixe cette ligne de la mention `@`+`claude` en la postant : elle est ' +
        'retirée ici parce qu\'un commentaire publié par la CI qui la porterait ' +
        'redéclencherait Claude en boucle. Le filtre d\'auteur qui rendrait ce ' +
        'retrait inutile vit dans `claude.yml`, sur `main`.',
    'À poster depuis le compte `vito-sainte-marie` : le workflow ne répond à',
    'aucun autre acteur. Sans cette ligne le job meurt avant d\'avoir de quoi',
    'répondre — le silence qui suit n\'est pas un rail mort, c\'est un refus muet.']
    .filter(x => x !== null).join('\n');
}

// Le corps du réveil. Factuel : il nomme le lot, le fichier, la branche où le
// lire, et il rappelle les interdits permanents. Il ne RÉSUME pas la demande —
// un résumé écrit par le demandeur est une façon polie de décider à la place
// de celui qui arbitre. Depuis le 07/10/2026 il la RECOPIE, intégralement
// (voir `blocDemande`) : copier n'est pas résumer. Depuis le 08/10/2026 cette
// recopie n'est faite que sur demande (`integral`) ; par défaut le réveil
// pointe vers le rail (voir `blocPointeur`).
// Le mandat de l'arbitre. Mesuré le 07/10/2026 : sans lui, l'arbitre ne
// recevait que « Arbitre cette demande » et redemandait à Frédéric des
// arbitrages déjà rendus. Il est GÉNÉRÉ depuis ARBITRAGES-ACQUIS.json, jamais
// écrit ici — ce n'est donc pas une seconde source de vérité. Un registre
// illisible ne bloque pas le réveil : il le dit.
function mandatArbitre(l, opts) {
  try {
    const { blocMandat } = require('./escalade-humaine.js');
    return blocMandat(opts && opts.registre, l.lot, !(opts && opts.integral));
  } catch (e) {
    return `⚠️ Mandat de l'arbitre indisponible (\`docs/handoff/ARBITRAGES-ACQUIS.json\` illisible : ${e.message}). ` +
      'Consulte ce fichier avant de solliciter Frédéric.';
  }
}

// Le texte intégral de la demande. Mesuré le 07/10/2026 sur FAST-TRACK
// request-1 : le réveil ne portait que son NOM. L'arbitre, qui ne lit pas le
// dépôt, ne pouvait que constater « une demande attend » — et c'est ce qu'il a
// répondu, sans verdict ni contrat. Un réveil qui oblige à aller chercher ce
// qu'il faut juger n'est pas une demande d'arbitrage, c'est une notification.
//
// Trois refus plutôt qu'un extrait : un texte trop long, illisible, ou pas
// encore lisible à distance n'est JAMAIS tronqué — décider sur un extrait,
// c'est arbitrer autre chose que la demande. L'empreinte (blob git) permet à
// l'arbitre comme au matérialisateur de vérifier qu'il s'agit des octets du rail.
const LIMITE_DEMANDE = 45000; // caractères ; un commentaire GitHub plafonne à 65 536
function blocDemande(l, opts) {
  const titre = `--- Texte intégral de \`${l.demande}\` ---`;
  if (l.non_publiee || (l.refs_reelles && l.refs_reelles.lisible_a_distance === false)) {
    return [titre, 'Non recopié : cette demande n\'est pas encore poussée. Attends le push — n\'arbitre rien en attendant.'].join('\n');
  }
  const fichier = path.join((opts && opts.lots) || handoff.CHEMINS.LOTS, l.lot, l.demande);
  let octets;
  try { octets = fs.readFileSync(fichier); }
  catch (e) {
    return [titre, `Non recopié : fichier illisible ici (${e.code || e.message}). Lis-le sur la branche indiquée ; ne décide jamais sur un extrait.`].join('\n');
  }
  const empreinte = require('crypto').createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${octets.length}\0`), octets])).digest('hex');
  const texte = octets.toString('utf8');
  if (texte.length > LIMITE_DEMANDE) {
    return [titre, `Empreinte (blob git): \`${empreinte}\``,
      `Non recopié : ${texte.length} caractères, au-delà de ${LIMITE_DEMANDE}. Lis-la sur la branche indiquée ; ne décide jamais sur un extrait.`].join('\n');
  }
  // Une clôture plus longue que toute suite de backticks du texte : la demande
  // ne peut pas refermer le bloc elle-même.
  const plusLongue = Math.max(2, ...(texte.match(/`+/g) || []).map(x => x.length));
  const cloture = '`'.repeat(plusLongue + 1);
  // Une demande qui cite `@claude` relancerait Claude sur son propre réveil
  // (et la CI refuse ce corps : MENTION_REDECLENCHANTE). On casse la mention
  // par une espace de largeur nulle, et on le DIT : le texte recopié n'est plus
  // octet pour octet celui de l'empreinte, qui reste celle du rail.
  let neutralisees = 0;
  const recopie = texte.replace(/\n$/, '').replace(/@(claude)/gi, (_, m) => { neutralisees++; return '@\u200b' + m; });
  return [titre, `Empreinte (blob git): \`${empreinte}\``,
    neutralisees ? `${neutralisees} mention(s) de Claude neutralisée(s) par une espace de largeur nulle après l'arobase ; rien d'autre n'est modifié.` : null,
    '', cloture + 'markdown', recopie, cloture].filter(x => x !== null).join('\n');
}

// Le pointeur. 08/10/2026 (GO de Frédéric « raccourcir le réveil ») : depuis
// que le connecteur GitHub de ChatGPT lit le rail, recopier la demande, le
// mandat complet et les acquis ne fait que doubler ce qu'il lit à la source —
// et une copie peut vieillir, la source non. Le réveil ne dit plus que QUOI
// lire et OÙ ; le texte intégral reste disponible (`--integral`) pour qui ne
// lit pas le dépôt : le relais par API, ou une recopie sans connecteur.
function blocPointeur(l) {
  return [
    'Lis, sur la branche indiquée ci-dessus et jamais sur `main`, avec ton',
    'connecteur GitHub :',
    `- \`docs/handoff/lots/${l.lot}/${l.demande}\` — la demande à arbitrer ;`,
    '- `docs/handoff/STATE.json` — il prime sur la prose de la demande ;',
    '- `docs/handoff/ARBITRAGES-ACQUIS.json` — les arbitrages déjà rendus.',
    'Écris `RAIL_LU: <SHA complet du rail lu>` juste avant le contrat. Si ton',
    'connecteur ne lit pas le rail, écris `RAIL_LU: INACCESSIBLE`, rends',
    '`DECISION: NEEDS_EVIDENCE` et demande le réveil intégral : n\'arbitre jamais',
    'sur ce seul pointeur.',
  ].join('\n');
}

function corpsReveil(r, opts) {
  if (!r.reveil) return r.message;
  const l = r.lots[0];
  const integral = !!(opts && opts.integral);
  return [
    'NEXUS Orchestrator — réveil Handoff (sens Claude → Orchestrateur).',
    '',
    l.adresse
      ? (l.adresse_resolue
          ? `Adressé à: ${l.adresse_role} (résolu vers \`${l.adresse}\`, voir \`docs/handoff/CANAUX.json\`)  _(déclaré par \`${l.adresse_source}\`)_`
          : `Adressé à: ${l.adresse}  _(déclaré par \`${l.adresse_source}\`)_`)
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
    // L'ancienne ligne disait « dépose la décision dans le même lot » : une
    // consigne que le mandat interdit (« tu ne déposes aucun fichier »). Entre
    // deux consignes contradictoires, l'arbitre a choisi la troisième voie :
    // ne rien trancher.
    'Arbitre cette demande maintenant, avec le protocole `nexus-handoff/2`' +
      (integral ? ' : son texte intégral est ci-dessous.' : '.'),
    'Ne signale pas qu\'elle attend — rends un verdict et termine par le',
    'NEXT_ACTION_CONTRACT rempli. Tu ne déposes aucun fichier : Claude',
    'matérialise ta décision.',
    '',
    integral ? blocDemande(l, opts) : blocPointeur(l),
    '',
    mandatArbitre(l, opts),
    '',
    blocRetour(l, opts),
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

module.exports = { analyser, examiner, corpsReveil, blocDemande, blocPointeur, LIMITE_DEMANDE, blocRetour, railDeRetour, blobsParRef, classerRefs, refsDistantes, resoudreCanal, canauxConnus, adresseReveil };

if (require.main === module) {
  const r = analyser();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else if (process.argv.includes('--message')) {
    // `--sans-mention` : le corps destiné à être PUBLIÉ par la CI.
    const mention = !process.argv.includes('--sans-mention');
    // `--integral` : la demande, le mandat et les acquis recopiés, pour un
    // arbitre qui ne lit pas le dépôt (relais par API, recopie sans connecteur).
    console.log(corpsReveil(r, { mention, integral: process.argv.includes('--integral') }));
  }
  else {
    console.log(r.message);
    for (const l of r.lots) console.log(`  - ${l.lot} : ${l.demande} (${l.motif}), branche ${l.branche || '?'}, statut ${l.statut_registre}`);
  }
  ecrireSortieActions(r);
  // Toujours 0, pour la même raison que son jumeau : c'est une question, pas
  // une garde. Un code d'erreur ferait passer « rien à faire » pour une panne.
  process.exit(0);
}
