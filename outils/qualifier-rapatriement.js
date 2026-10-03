#!/usr/bin/env node
'use strict';
// Qualification d'un rapatriement Claude → rail.
//
// LE MAILLON QUI N'EXISTAIT PAS. Au 30/09/2026, la chaîne allait du rail
// jusqu'à une branche `claude/issue-28-*` verte, et s'arrêtait là. 137 branches
// `claude/*` vivaient sur le dépôt, 64 portaient du travail absent du rail.
// Aucun workflow ne contenait la moindre étape de rapatriement : ni fusion, ni
// PR, ni transport. Ce n'était pas un bug à corriger, c'était un maillon à
// écrire. Le voici — la moitié « décision » ; l'appelant fait la moitié « geste ».
//
// CE QU'IL NE FAIT JAMAIS. Il ne fusionne pas, ne pousse pas, n'ouvre pas de PR,
// ne rebase pas, ne résout aucun conflit. Un mécanisme qui résout est un
// mécanisme qui décide à la place de quelqu'un, et il le fait précisément dans
// les cas où personne ne regarde. Devant une divergence, un conflit, une
// ambiguïté ou une modification hors périmètre : REFUS EXPLICITE.
//
// POURQUOI LE FAST-FORWARD SEUL. C'est le seul transport dont le résultat soit
// entièrement prévisible avant de l'exécuter : l'arbre de destination devient
// exactement l'arbre source, déjà éprouvé par la CI qui vient de passer. Toute
// autre forme — merge, rebase, cherry-pick — produit un arbre que PERSONNE n'a
// testé, et la CI d'après mesure alors autre chose que ce qui a été prouvé.
// « Conflit sémantique entre branches sœurs » : git fusionne proprement deux
// lots qui se contredisent.
//
// L'ORDRE DES CONTRÔLES EST UNE DÉCISION. Les décisions réservées (§7) sont
// évaluées AVANT l'état de préparation. Une tentative de transport vers
// `production` doit être nommée pour ce qu'elle est même si, par ailleurs, tout
// est vert : sinon le rapport dirait « CI rouge » là où il fallait dire « ceci
// appartient à Frédéric ».
//
// LA CAPACITÉ N'EST PAS L'AUTORISATION. Ce module ne prend aucune capacité en
// entrée. `contents: write` prouve que GitHub laissera passer l'écriture ; il ne
// dit rien de ce que NEXUS autorise. L'autorité vient de la mission, par
// `transport-autorise.js`, et de nulle part ailleurs.

const { decider } = require('./transport-autorise.js');
const { etat } = require('./etat-maillon.js');

const MAILLON = 'rapatriement-claude-vers-rail';
const SHA = /^[0-9a-f]{40}$/;

// Fichiers dont la modification EST un geste Production, quelle que soit la
// branche de destination. Ils ne se transportent pas automatiquement.
const SENTINELLES_PRODUCTION = Object.freeze([
  '.github/workflows/deploiement-production.yml',
  'outils/correction-horaires-production-a-executer-par-frederic.sql',
]);

// Marqueurs d'une cible Production INTRODUITE par le diff. Le projet Supabase de
// Production et l'hôte de Production ne s'écrivent pas depuis une branche de run.
const MARQUEURS_PRODUCTION = Object.freeze([
  { nom: 'projet Supabase Production', motif: /uzhjpqpctpvxytxpxoqz/ },
  { nom: 'hôte Production', motif: /app\.nexusconseil\.net/ },
]);

// NOMMER PRODUCTION N'EST PAS LA VISER.
// Mesuré le 01/10/2026 : le commit 119b2f8f a été refusé au transport pour
// cinq lignes ajoutées, dont une cellule de tableau Markdown, un commentaire
// `//`, une phrase adressée à un humain dans un champ `prochaine_action`, et
// une fixture de test. Aucune ne portait d'adresse, de chaîne de connexion ni
// de drapeau d'outil. Le fichier le plus abusivement accusé était
// `outils/garde-ordre-migration-code.js` : la garde qui protège la migration
// Production, refusée au transport pour avoir nommé Production dans un
// commentaire. Le défaut n'est donc pas incident, il est structurel — tout
// travail PORTANT SUR la procédure Production devient non transportable, car
// il doit nommer Production pour exister.
//
// On ne retire rien à la garde : on lui donne l'axe qui lui manquait. Une
// écriture vers Production exige une ADRESSE ou un POINTEUR. Le nom nu du
// projet n'est ni l'un ni l'autre — c'est le vocabulaire sans lequel aucune
// documentation, aucune garde et aucune épreuve ne peut parler de Production.

// 1. FORMES ACTIONNABLES. Le nom devenu adresse, chaîne de connexion ou valeur
// d'un drapeau qui pointe un outil vers Production. Refusées PARTOUT, y compris
// en prose et en commentaire : un commentaire se décommente, une URL se copie.
const FORMES_CIBLE_PRODUCTION = Object.freeze([
  { nom: 'adresse Supabase Production', motif: /\buzhjpqpctpvxytxpxoqz\.supabase\./ },
  { nom: 'adresse Supabase Production', motif: /\bdb\.uzhjpqpctpvxytxpxoqz\./ },
  { nom: 'URL de l’hôte Production', motif: /(https?:)?\/\/app\.nexusconseil\.net/ },
  { nom: 'drapeau pointé vers Production',
    motif: /--(project[-_]ref|project[-_]id|db[-_]url)[=\s]+["'’]?uzhjpqpctpvxytxpxoqz/ },
  { nom: 'réglage pointé vers Production',
    motif: /\b(project[-_]?(ref|id)|SUPABASE_URL|SUPABASE_PROJECT[A-Z_]*|DATABASE_URL|PGHOST|PGDATABASE)\b\s*[:=]\s*["'’]?uzhjpqpctpvxytxpxoqz/i },
]);

// 2. POSITIONS DE PAROLE. Fichiers dont le rôle EST de parler de Production :
// la documentation, les épreuves et les gardes. Une machine ne les lit pas pour
// atteindre Production ; aucune ne porte de secret. Le nom nu y est un mot.
// Ces deux familles sont déjà reconnues comme une classe à part dans ce
// fichier : supprimer un `outils/garde-*.js` ou un `test_*.js` y est déjà un
// affaiblissement. On ne crée pas une exception, on réutilise une distinction.
const POSITIONS_DE_PAROLE = Object.freeze([
  /^docs\//,
  /\.md$/,
  /^test_[^/]*\.js$/,
  /^outils\/garde-[^/]+\.js$/,
]);

// 2bis. CORPUS DE RECONNAISSANCE. Une garde qui reconnaît l'adresse de
// Production doit l'écrire, et l'épreuve qui prouve qu'elle mord doit en porter
// des spécimens. Mesurée sur elle-même le 01/10/2026, cette correction s'est
// refusé son propre transport : `outils/qualifier-rapatriement.js` pour ses cinq
// motifs, `test_cible_production_vs_mention_20261001.js` pour ses quatre
// contre-témoins. C'est exactement la panne qu'elle ferme, d'un étage plus haut
// — et laissée telle quelle, elle rendait sa propre maintenance impossible.
//
// LA LISTE EST CLOSE ET NOMMÉE, jamais un motif. Un motif — `test_*.js`, par
// exemple — laisserait n'importe quelle épreuve future embarquer une vraie
// chaîne de connexion ; deux chemins s'auditent d'un coup d'œil. L'allonger est
// un changement visible de ce fichier, et `test_cible_production_vs_mention_…`
// épingle son contenu exact : une entrée de plus rougit la suite et appelle un
// humain. Ce qui y est toléré n'est pas tu : il sort sous `details.specimens`.
const CORPUS_DE_RECONNAISSANCE = Object.freeze([
  'outils/qualifier-rapatriement.js',
  'test_cible_production_vs_mention_20261001.js',
]);

// 3. Une ligne de commentaire est inerte. Elle ne se refuse que sur une forme
// actionnable, jamais sur une mention.
const LIGNE_COMMENTAIRE = /^\s*(\/\/|\/\*|\*|#|--|<!--)/;

// Motifs d'affaiblissement de garde. Chacun a déjà servi dans ce dépôt : le
// `|| true` neutralise `garde-branches-en-rade.js` depuis des semaines en
// sortant pourtant en 1, et cinq étapes profondes sont passées `skipped`
// pendant des jours le 22/09 sans que rien ne rougisse.
const MOTIFS_AFFAIBLISSEMENT = Object.freeze([
  { nom: 'neutralisation du code de sortie', motif: /\|\|\s*true\b/ },
  { nom: 'échec toléré', motif: /continue-on-error:\s*true/ },
  { nom: 'étape désactivée', motif: /^\s*if:\s*false\b/ },
  { nom: 'épreuve désactivée', motif: /\b(it|test|describe)\.skip\s*\(|\bxit\s*\(|\bxdescribe\s*\(/ },
  { nom: 'contrôle git contourné', motif: /--no-verify\b/ },
]);

// Une ligne de PROSE ne s'exécute pas : elle ne peut pas desserrer une garde,
// seulement en parler. Mesuré le 03/10/2026 : 3e75034 (FDJ-VAGUE1-REPRISE)
// était refusé GARDE_AFFAIBLIE pour une phrase de DECISION.md qui DÉCRIVAIT la
// neutralisation existante de `garde-portee-site.js`. C'est la distinction
// mention / cible déjà tenue plus haut, appliquée ici. Plus étroite que
// POSITIONS_DE_PAROLE à dessein : une épreuve ou une garde s'exécutent, et un
// fichier de `docs/` peut être lu par une garde (JSON). Seul le `.md` est muet.
// La suppression d'une garde ou d'une épreuve reste jugée sur son chemin.
const PROSE = /\.md$/;

// Motifs de secret. On rapporte le FICHIER et la LIGNE, JAMAIS la valeur : un
// détecteur qui cite ce qu'il a trouvé publie le secret qu'il dénonce.
const MOTIFS_SECRET = Object.freeze([
  { nom: 'jeton GitHub', motif: /(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { nom: 'jeton Supabase', motif: /\bsbp_[A-Za-z0-9]{20,}/ },
  { nom: 'clé privée', motif: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { nom: 'URL de base avec mot de passe', motif: /\bpostgres(ql)?:\/\/[^\s:@/]+:[^\s@/]+@/ },
  { nom: 'clé de service Supabase', motif: /\bservice_role\b[^\n]{0,40}\beyJ[A-Za-z0-9._-]{20,}/ },
  { nom: 'jeton JWT en dur', motif: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { nom: 'PIN littéral', motif: /(^|[^A-Za-z])PIN\s*[:=]\s*['"`]?\d{4,}/i },
]);

function vide(v) { return v === undefined || v === null || String(v).trim() === ''; }
function chemins(diff) { return (diff || []).map(d => (typeof d === 'string' ? d : (d && d.chemin))).filter(Boolean); }

// Construit un refus complet. Les six champs exigés par la procédure sont
// remplis ici une fois pour toutes : aucun appelant ne peut en oublier un.
function refus(e, contexte, champs) {
  return etat({
    etat: e,
    maillon: MAILLON,
    code: champs.code,
    condition: champs.condition,
    motif: champs.motif,
    prochaine_action: champs.prochaine_action,
    sha: contexte.head || '(inconnu)',
    branche: contexte.branche || '(inconnue)',
    lot: contexte.lot || '(inconnu)',
    details: champs.details || null,
  });
}

function qualifier(e) {
  const a = e || {};
  const ctx = { head: a.head, branche: a.branche, lot: a.lot };
  const R = (etatMachine, champs) => refus(etatMachine, ctx, champs);

  // ── A. IDENTIFICATION ─────────────────────────────────────────────────────
  // Rien ne se décide sur des désignations approximatives. « Une désignation ne
  // se recalcule pas » : quatre défauts de septembre sont nés d'avoir dérivé du
  // contexte ambiant ce qu'un humain avait nommé ailleurs.
  if (vide(a.rail)) {
    return R('BLOCKED', { code: 'DESTINATION_INCONNUE',
      condition: 'destination rail exacte identifiée',
      motif: 'Aucun rail de destination nommé. Un transport sans destination désignée n’est pas un transport.',
      prochaine_action: 'Déclarer le rail au registre (`node outils/handoff.js declarer-rail`) et relancer le run.' });
  }
  if (!SHA.test(String(a.railSha || ''))) {
    return R('BLOCKED', { code: 'DESTINATION_INCONNUE',
      condition: 'destination rail exacte identifiée',
      motif: `Le rail « ${a.rail} » est nommé mais son SHA n’est pas résolu. Une destination se vérifie par son SHA, pas par son nom.`,
      prochaine_action: `Résoudre \`${a.rail}\` sur origin et relancer.` });
  }
  if (vide(a.baseBranch)) {
    return R('BLOCKED', { code: 'BASE_BRANCH_ABSENTE',
      condition: '`NEXUS_BASE_BRANCH` explicite',
      motif: 'La branche de base n’est pas déclarée. Elle ne se devine pas : un repli silencieux a déjà envoyé quatre runs sur la branche gelée.',
      prochaine_action: 'Reposer la demande avec `NEXUS_BASE_BRANCH=<rail>` dans le corps du message.' });
  }
  if (String(a.baseBranch).trim() !== String(a.rail).trim()) {
    return R('BLOCKED', { code: 'BASE_BRANCH_DISCORDANTE',
      condition: '`NEXUS_BASE_BRANCH` explicite',
      motif: `La demande déclare « ${a.baseBranch} » alors que le rail visé est « ${a.rail} ». Deux désignations qui divergent ne s’arbitrent pas toutes seules.`,
      prochaine_action: 'Faire coïncider la désignation de la demande et le rail du registre, puis relancer.' });
  }
  if (!SHA.test(String(a.head || ''))) {
    return R('BLOCKED', { code: 'HEAD_INCONNU',
      condition: 'HEAD Claude exact identifié',
      motif: 'Le HEAD de la branche de run n’est pas un SHA complet. On ne transporte pas « la dernière version » : on transporte un commit.',
      prochaine_action: 'Résoudre le HEAD de la branche de run et relancer.' });
  }
  if (!SHA.test(String(a.baseSha || ''))) {
    return R('BLOCKED', { code: 'SHA_BASE_INCONNU',
      condition: 'base SHA connue',
      motif: 'Le SHA de base n’est pas connu. Sans lui, « ce que ce travail ajoute » n’est pas une quantité définie.',
      prochaine_action: 'Publier le SHA de base au démarrage du run (`git rev-parse <rail>`) et relancer.' });
  }

  // ── B. DÉCISIONS RÉSERVÉES (§7) ───────────────────────────────────────────
  // Évaluées avant tout état de préparation : un geste réservé doit être nommé
  // pour ce qu'il est, même quand tout le reste est vert.
  const autorite = decider({ destination: a.rail, mission: a.mission });
  if (!autorite.transport) {
    const reserve = autorite.code === 'GATE_HUMAINE';
    return R(reserve ? 'HUMAN_DECISION_REQUIRED' : 'BLOCKED', {
      code: autorite.code,
      condition: 'destination autorisée par la mission',
      motif: autorite.motif,
      prochaine_action: reserve
        ? `Le transport vers « ${a.rail} » appartient à Frédéric. Le dossier se prépare intégralement ; la fusion attend un GO explicite.`
        : 'Faire désigner nommément la destination par la mission, puis relancer.' });
  }

  const touches = chemins(a.diff);
  const sentinelles = touches.filter(c => SENTINELLES_PRODUCTION.includes(c));
  if (sentinelles.length) {
    return R('HUMAN_DECISION_REQUIRED', { code: 'CHANGEMENT_PRODUCTION',
      condition: 'aucun changement Production',
      motif: `Le diff touche ${sentinelles.length} fichier(s) dont la modification EST un geste Production : ${sentinelles.join(', ')}.`,
      prochaine_action: 'Sortir ces fichiers du lot, ou demander un GO Production explicite à Frédéric.',
      details: { fichiers: sentinelles } });
  }

  // « INTRODUITE PAR LE DIFF » N'EST PAS « PRÉSENTE DANS LE FICHIER ».
  // Cette garde lisait le contenu ENTIER de chaque fichier touché. Elle
  // accusait donc une branche d'introduire ce que le rail portait déjà :
  // mesuré le 30/09/2026, deux branches de run sur trois étaient refusées
  // parce que docs/handoff/CURRENT.md nomme le projet Supabase de Production
  // depuis des semaines. Une garde qui refuse toute la documentation du dépôt
  // n'est pas stricte, elle est inutilisable — et une garde inutilisable finit
  // désarmée. On mesure donc les LIGNES AJOUTÉES, ce que la garde a toujours
  // dit mesurer.
  // Le repli reste conservateur : si le relevé ne porte pas les lignes (un
  // appelant qui ne fournit que des chemins), on relit le fichier entier.
  // Une garde qui ne sait pas doit trop refuser, jamais trop peu.
  const lire = typeof a.contenus === 'function' ? a.contenus : () => '';
  const parChemin = new Map((a.diff || [])
    .filter((d) => d && typeof d === 'object')
    .map((d) => [d.chemin, d]));
  const versProduction = [];
  const mentions = [];
  const specimens = [];
  const vu = new Set();
  for (const c of touches) {
    const d = parChemin.get(c);
    const surAjouts = d && Array.isArray(d.lignes_ajoutees);
    const mesure = surAjouts ? 'lignes ajoutées' : 'fichier entier';
    const lignes = surAjouts ? d.lignes_ajoutees : String(lire(c) || '').split('\n');
    const corpus = CORPUS_DE_RECONNAISSANCE.includes(c);
    const parole = corpus || POSITIONS_DE_PAROLE.some((p) => p.test(c));
    for (const ligne of lignes) {
      const texte = String(ligne);
      let actionnable = false;
      for (const f of FORMES_CIBLE_PRODUCTION) {
        if (!f.motif.test(texte)) continue;
        actionnable = true;
        // Dans le corpus de reconnaissance, la forme actionnable est le
        // spécimen que la garde doit savoir reconnaître, pas une adresse visée.
        const cle = corpus ? `specimen|${c}|${f.nom}` : `${c}|${f.nom}`;
        if (vu.has(cle)) continue;
        vu.add(cle);
        (corpus ? specimens : versProduction).push({ chemin: c, marqueur: f.nom, mesure });
      }
      if (actionnable) continue;
      for (const m of MARQUEURS_PRODUCTION) {
        if (!m.motif.test(texte)) continue;
        // Une mention nue est une cible là où une machine exécute la ligne :
        // hors position de parole, et hors commentaire.
        if (!parole && !LIGNE_COMMENTAIRE.test(texte)) {
          const cle = `${c}|${m.nom}`;
          if (!vu.has(cle)) { vu.add(cle); versProduction.push({ chemin: c, marqueur: m.nom, mesure }); }
        } else {
          const cle = `mention|${c}|${m.nom}`;
          if (!vu.has(cle)) { vu.add(cle); mentions.push({ chemin: c, marqueur: m.nom, mesure }); }
        }
      }
    }
  }
  if (versProduction.length) {
    // LE MOTIF NOMME LES FICHIERS. Le 01/10/2026, le refus annonçait
    // « 5 fichier(s) » sans dire lesquels : `details.cibles` n'atteignait que le
    // fichier d'état, et il a fallu rejouer la qualification en local pour
    // savoir quoi corriger. Un refus qui ne désigne pas n'est pas actionnable.
    const nommes = versProduction.map((v) => `${v.chemin} (${v.marqueur})`).join(', ');
    return R('HUMAN_DECISION_REQUIRED', { code: 'CHANGEMENT_PRODUCTION',
      condition: 'aucun changement Production',
      motif: `Le diff introduit une cible Production dans ${versProduction.length} fichier(s) : ${nommes}. Une branche de run n’écrit pas vers Production.`,
      prochaine_action: 'Retirer la cible Production, ou demander un GO Production explicite à Frédéric.',
      details: { cibles: versProduction, mentions, specimens } });
  }

  const affaiblies = [];
  for (const d of (a.diff || [])) {
    const chemin = typeof d === 'string' ? d : d.chemin;
    const statut = typeof d === 'string' ? 'M' : String(d.statut || 'M');
    if (/^D/.test(statut) && /(^|\/)(outils\/garde-[^/]+\.js|test_[^/]+\.js)$/.test(chemin)) {
      affaiblies.push({ chemin, motif: 'garde ou épreuve supprimée' });
      continue;
    }
    if (PROSE.test(chemin)) continue;
    const ajoutees = (typeof d === 'string' ? [] : (d.lignes_ajoutees || []));
    for (const ligne of ajoutees) {
      for (const m of MOTIFS_AFFAIBLISSEMENT) {
        if (m.motif.test(String(ligne))) affaiblies.push({ chemin, motif: m.nom });
      }
    }
    for (const ligne of (typeof d === 'string' ? [] : (d.lignes_supprimees || []))) {
      if (/node\s+outils\/garde-/.test(String(ligne))) affaiblies.push({ chemin, motif: 'appel de garde retiré' });
    }
  }
  if (affaiblies.length) {
    return R('HUMAN_DECISION_REQUIRED', { code: 'GARDE_AFFAIBLIE',
      condition: 'aucun contournement ou affaiblissement de garde',
      motif: `Le diff affaiblit ${affaiblies.length} garde(s) ou épreuve(s). Une garde ne se desserre pas en passant : c’est un arbitrage.`,
      prochaine_action: 'Justifier chaque affaiblissement dans une décision au registre, ou le retirer du lot.',
      details: { gardes: affaiblies } });
  }

  // ── C. RATTACHEMENT AU LOT ────────────────────────────────────────────────
  if (vide(a.lot)) {
    return R('BLOCKED', { code: 'LOT_NON_RATTACHABLE',
      condition: 'branche Claude rattachable sans ambiguïté au lot',
      motif: 'Aucun lot déclaré. Un travail sans lot ne se transporte pas — il se rapporte.',
      prochaine_action: 'Déclarer le lot au registre avant de relancer.' });
  }
  const refs = a.refs || {};
  const porte = (liste) => (liste || []).some(r => r === a.branche || r === `origin/${a.branche}`);
  if (porte(refs.homonymes)) {
    return R('BLOCKED', { code: 'LOT_AMBIGU',
      condition: 'branche Claude rattachable sans ambiguïté au lot',
      motif: `« ${a.branche} » porte un document du MÊME NOM que la demande du lot avec un contenu DIFFÉRENT. Un homonyme parlerait pour le lot.`,
      prochaine_action: 'Rebrancher le run depuis le rail à jour pour qu’il porte les octets de la demande.' });
  }
  if (!porte(refs.memes)) {
    return R('BLOCKED', { code: 'LOT_NON_RATTACHABLE',
      condition: 'branche Claude rattachable sans ambiguïté au lot',
      motif: `« ${a.branche} » ne porte pas les octets de la demande du lot ${a.lot}. Rien ne la rattache à ce travail.`,
      prochaine_action: 'Rebrancher le run depuis le rail, ou inscrire le sort de cette branche au registre.' });
  }

  // ── D. RIEN À FAIRE ───────────────────────────────────────────────────────
  // Un repos légitime n'est pas une panne. Il est nommé, pas silencieux.
  if (a.head === a.railSha || touches.length === 0) {
    return etat({ etat: 'NO_WORK', maillon: MAILLON, code: 'RIEN_A_RAPATRIER',
      branche: a.branche, sha: a.head, lot: a.lot,
      motif: a.head === a.railSha
        ? `« ${a.branche} » est exactement le rail : il n’y a rien à transporter.`
        : `« ${a.branche} » ne modifie aucun fichier par rapport au rail.` });
  }

  // ── E. SÛRETÉ DU CONTENU ──────────────────────────────────────────────────
  const opaques = (a.diff || []).filter(d => typeof d !== 'string' && d.binaire === true).map(d => d.chemin);
  if (opaques.length) {
    return R('BLOCKED', { code: 'DIFF_NON_INSPECTABLE',
      condition: 'diff inspectable et attribuable au lot',
      motif: `${opaques.length} fichier(s) binaires : ${opaques.join(', ')}. Ce qui ne se lit pas ne se qualifie pas.`,
      prochaine_action: 'Sortir les binaires du lot, ou les faire arbitrer par une décision au registre.',
      details: { fichiers: opaques } });
  }
  const secrets = [];
  for (const d of (a.diff || [])) {
    const chemin = typeof d === 'string' ? d : d.chemin;
    const lignes = typeof d === 'string' ? String(lire(chemin) || '').split('\n') : (d.lignes_ajoutees || String(lire(chemin) || '').split('\n'));
    lignes.forEach((ligne, i) => {
      for (const m of MOTIFS_SECRET) {
        // On note le motif et l'emplacement. Jamais la valeur : un détecteur
        // qui cite ce qu'il a trouvé publie le secret qu'il dénonce.
        if (m.motif.test(String(ligne))) secrets.push({ chemin, ligne: i + 1, nature: m.nom });
      }
    });
  }
  if (secrets.length) {
    return R('BLOCKED', { code: 'SECRET_DETECTE',
      condition: 'aucun secret',
      motif: `${secrets.length} emplacement(s) portent la forme d’un secret. La valeur n’est pas reproduite ici, et ne doit l’être nulle part.`,
      prochaine_action: 'Retirer la valeur du diff, la déplacer en secret de dépôt, et considérer la valeur exposée comme à révoquer.',
      details: { emplacements: secrets } });
  }
  const perimetre = Array.isArray(a.perimetre) ? a.perimetre.filter(Boolean) : null;
  if (perimetre && perimetre.length) {
    const dehors = touches.filter(c => !perimetre.some(p => c === p || c.startsWith(p.endsWith('/') ? p : `${p}/`)));
    if (dehors.length) {
      return R('BLOCKED', { code: 'HORS_PERIMETRE',
        condition: 'aucun changement hors périmètre autorisé',
        motif: `${dehors.length} chemin(s) hors du périmètre déclaré du lot : ${dehors.join(', ')}.`,
        prochaine_action: 'Élargir le périmètre par une décision au registre, ou sortir ces chemins du lot.',
        details: { hors_perimetre: dehors, perimetre } });
    }
  }

  // ── F. ÉTAT DE PRÉPARATION ────────────────────────────────────────────────
  // `skipped` n'est pas `success`. Le 22/09, cinq étapes profondes sont passées
  // `skipped` pendant des jours sans qu'aucune alerte ne se déclenche.
  const verifs = (a.ci && Array.isArray(a.ci.verifications)) ? a.ci.verifications : null;
  if (!verifs) {
    return R('BLOCKED', { code: 'CI_NON_MESUREE',
      condition: 'tests déterministes requis verts',
      motif: 'Aucun relevé de CI. Une absence de mesure n’est pas un vert.',
      prochaine_action: 'Attendre la fin de la CI de la branche de run, puis relancer la qualification.' });
  }
  const requis = verifs.filter(v => v.requis !== false);
  if (!requis.length) {
    return R('BLOCKED', { code: 'CI_NON_MESUREE',
      condition: 'tests déterministes requis verts',
      motif: 'Aucune vérification requise n’est déclarée. Zéro contrôle obligatoire, ce n’est pas « tout est vert ».',
      prochaine_action: 'Déclarer les vérifications requises du lot, puis relancer.' });
  }
  const pasVertes = requis.filter(v => String(v.conclusion) !== 'success');
  if (pasVertes.length) {
    return R('BLOCKED', { code: 'CI_NON_VERTE',
      condition: 'tests déterministes requis verts',
      motif: `${pasVertes.length} vérification(s) requise(s) ne sont pas « success » : `
        + pasVertes.map(v => `${v.nom}=${v.conclusion}`).join(', ')
        + '. Un `skipped` n’est pas un `success` : c’est un contrôle qui n’a pas eu lieu.',
      prochaine_action: 'Corriger la cause du rouge sur la branche de run, ou rendre la vérification manquante exécutable.',
      details: { non_vertes: pasVertes } });
  }

  // Ce qui n'est pas requis ne bloque pas — mais doit se VOIR. Le 30/09/2026,
  // `Supabase Preview` arrêtait tout transport vers le rail en étant exigé par
  // aucune autorité ; une fois démoté, l'effacer du dossier remplacerait un faux
  // refus par un silence, et le silence est le défaut le plus coûteux de ce
  // dépôt. Un check tiers qui rougit reste une information : elle voyage.
  const nonRequises = verifs.filter((v) => v.requis === false);

  // ── G. FORME DU TRANSPORT ─────────────────────────────────────────────────
  // UNE QUESTION SANS RÉPONSE N'EST PAS UNE RÉPONSE NÉGATIVE. L'interrogation
  // d'ascendance (`--is-ancestor`) rend 0 pour oui, 1 pour non, et tout autre
  // code pour « je
  // n'ai pas pu répondre » : objet absent, dépôt incomplet, fetch manquant.
  // L'observation remonte alors `null`. Le traduire en « ils ont divergé »
  // fabriquerait une histoire mesurée à partir d'une mesure absente, et le
  // motif se contredirait lui-même (« le rail a avancé de X à X »).
  if (a.railEstAncetre === null || a.railEstAncetre === undefined
    || (a.railEstAncetre !== true && a.baseEstAncetreDuRail !== true && a.baseEstAncetreDuRail !== false)) {
    return R('BLOCKED', { code: 'ASCENDANCE_NON_MESUREE',
      condition: 'absence de divergence incompatible',
      motif: `L’ascendance entre « ${a.branche} » et « ${a.rail} » n’a pas pu être mesurée. `
        + 'Aucune forme de transport ne peut être établie sur une question restée sans réponse.',
      prochaine_action: 'Compléter le dépôt du run (`git fetch origin <rail>` avec l’historique nécessaire) et relancer la qualification.',
      details: { rail_sha: a.railSha, base_sha: a.baseSha, head: a.head,
        rail_est_ancetre: a.railEstAncetre === undefined ? null : a.railEstAncetre,
        base_est_ancetre_du_rail: a.baseEstAncetreDuRail === undefined ? null : a.baseEstAncetreDuRail } });
  }
  if (a.railEstAncetre !== true) {
    const perime = a.baseEstAncetreDuRail === true;
    return R('BLOCKED', {
      code: perime ? 'SHA_BASE_PERIME' : 'DIVERGENCE',
      condition: 'absence de divergence incompatible',
      motif: perime
        ? `Le rail a avancé depuis le départ du run (base ${String(a.baseSha).slice(0, 8)} → rail ${String(a.railSha).slice(0, 8)}) et « ${a.branche} » ne le contient pas. Rebaser automatiquement produirait un arbre que personne n’a testé.`
        : `« ${a.branche} » et « ${a.rail} » ont divergé : le rail n’est pas un ancêtre du HEAD. Aucune résolution automatique ne sera tentée.`,
      prochaine_action: perime
        ? 'Relancer le travail depuis le rail à jour ; le résultat sera de nouveau éprouvé avant transport.'
        : 'Arbitrer la divergence par une décision au registre — elle n’est pas mécanique.',
      details: { rail_sha: a.railSha, base_sha: a.baseSha, head: a.head } });
  }

  // ── H. QUALIFIÉ ───────────────────────────────────────────────────────────
  return etat({ etat: 'EXECUTE', maillon: MAILLON, code: 'FAST_FORWARD',
    branche: a.branche, sha: a.head, lot: a.lot,
    motif: `« ${a.branche} » @ ${String(a.head).slice(0, 8)} contient « ${a.rail} » @ ${String(a.railSha).slice(0, 8)} : `
      + `le transport est un fast-forward, et l’arbre de destination sera exactement celui que la CI vient d’éprouver.`,
    prochaine_action: `Avancer « ${a.rail} » jusqu’à ${String(a.head).slice(0, 8)}, puis vérifier la destination et son SHA.`,
    // La ref RETENUE voyage avec le verdict. Un nom de branche peut désigner deux
    // commits ; dire « on a transporté la branche » ne permet à personne de refaire
    // le geste. Dire de quelle ref le commit a été lu, si.
    details: { mode: 'FAST_FORWARD', destination: a.rail, destination_sha_attendu: a.head,
      ref_head: a.refHead || null, fichiers: touches.length,
      // Les mentions de Production qui n’ont PAS bloqué. Une garde qui
      // laisse passer sans le dire redevient indistinguable d’une garde
      // absente : ce qu’elle a vu et classé comme vocabulaire se publie.
      mentions_production: mentions,
      specimens_reconnaissance: specimens,
      // Qui a exigé quoi, et sous quelle autorité. Sans ces deux listes, un
      // lecteur du dossier ne peut pas distinguer « tout était vert » de
      // « rien n'était exigé » — c'est exactement la confusion qu'on répare.
      ci_requises: requis.map((v) => ({ nom: v.nom, conclusion: v.conclusion,
        autorite: v.autorite || null })),
      ci_non_requises: nonRequises.map((v) => ({ nom: v.nom, conclusion: v.conclusion,
        autorite: v.autorite || null })) } });
}

module.exports = {
  qualifier, MAILLON,
  SENTINELLES_PRODUCTION, MARQUEURS_PRODUCTION, FORMES_CIBLE_PRODUCTION,
  POSITIONS_DE_PAROLE, CORPUS_DE_RECONNAISSANCE, MOTIFS_AFFAIBLISSEMENT, MOTIFS_SECRET, PROSE,
};
