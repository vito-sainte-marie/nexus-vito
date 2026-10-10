#!/usr/bin/env node
// Stade (a) de l'arbitrage autonome — 09/10/2026.
//
// AUTORISÉ PAR FRÉDÉRIC BRAGANCE LE 09/10/2026 (« autorise le stade (a) »).
// Jusqu'ici le relais POSTAIT la réponse de l'arbitre sur l'issue du réveil,
// et s'arrêtait là (stade b) : le commentaire, posté avec GITHUB_TOKEN, ne
// déclenche aucun workflow, donc aucun Claude ne venait la matérialiser.
// FAST-TRACK-ROUTAGE-CAPACITES-1 l'a mesuré : verdict rendu à 17:57, déposé
// à la main à 22:44.
//
// Cet outil fait la moitié pure du geste : il lit la réponse déjà validée par
// le relais, la confronte au REGISTRE (pas au réveil, qui peut avoir vieilli
// entre-temps), et compose le corps de `decision-N`. Il n'écrit ni dans le
// registre ni dans git, et n'a aucune voie vers GitHub : c'est l'étape CI qui
// appelle `handoff.js decision`, commite et pousse. Le texte venu d'OpenAI
// n'est jamais lu par un code qui tient un jeton.
//
// Ce que la matérialisation NE fait PAS, et que le corps dit en toutes
// lettres : vérifier les CONDITIONS du verdict. Elles lient l'exécutant
// suivant, comme toute décision.
//
// Sorties : 0 = corps écrit, JSON {lot, request, decision, closes, rail} sur
// stdout ; 2 = refus (JSON {refus: [...]}) ; 4 = la décision relève d'un
// humain et n'est pas déposée (elle reste postée) ; 3 = rien à faire (la demande
// n'attend plus de décision : déjà matérialisée, ou dépassée).
'use strict';
const fs = require('fs');
const path = require('path');
const { lireContrat, valider } = require('./relais-arbitre-openai');

const RACINE = path.resolve(__dirname, '..');
const RAIL_ADMIS = /^handoff-[a-z0-9][a-z0-9-]*$/;
const INTERDITS = ['main', 'production'];

const sansBacktick = s => String(s || '').replace(/`/g, '').trim();

// ── Prouver la lecture du rail, ou son substitut — 10/10/2026 ──────────────
// `request-1.md` du lot ARMEMENT-ARBITRAGE-AUTONOME-1-20261008 l'écrivait :
// « refuse si `RAIL_LU` n'est ni `INACCESSIBLE` ni égal à `GITHUB_SHA` ». Sa
// `decision-1.md` l'a retenu comme condition de l'accord favorable au stade
// (a) — « comparaison des SHA ». Rien ne le codait. Et le registre portait
// déjà le cas : la `decision-2.md` du même lot est `RAIL_LU: INACCESSIBLE`,
// `HEAD: INACCESSIBLE` et `PROOF_STATE: PROOF_VALID`, admise parce que le
// substitut avait été vérifié À LA MAIN, en prose, dans le corps déposé. Une
// preuve qui ne vit que dans la prose d'un fichier ne protège pas le dépôt
// suivant.
//
// Deux voies, toutes deux déjà écrites, aucune nouvelle :
//   - l'arbitre a lu le rail : il rend le SHA, qui doit être celui du run dont
//     le corps de réveil est tiré ;
//   - il ne pouvait pas le lire (relais intégral par l'API) : il rend
//     `INACCESSIBLE`, et le substitut que `decision-2.md` invoque doit tenir —
//     le SHA du run égale la tête du rail au moment de la matérialisation. Si
//     le rail a bougé pendant le run, le verdict porte sur un registre dépassé
//     et se matérialise à la main, pas tout seul.
//
// Un SHA absent est un refus, jamais un laissez-passer : une garde qui
// s'efface quand sa donnée manque ne garde rien.
const FORME_SHA = /^[0-9a-f]{7,40}$/;
const INACCESSIBLE = 'INACCESSIBLE';

// `RAIL_LU` ne vit PAS dans le contrat. Le réveil demande de l'écrire « juste
// avant le contrat » (`reveil-orchestrateur.js`, blocPointeur), et les deux
// décisions réelles du lot ARMEMENT-ARBITRAGE-AUTONOME-1-20261008 l'écrivent
// bien avant la ligne `NEXT_ACTION_CONTRACT` : `lireContrat`, qui ne lit que
// les lignes suivantes, ne le voit jamais. Une garde qui l'aurait cherché dans
// le contrat aurait refusé tout verdict authentique — et se serait fait
// désarmer dans la semaine. On le lit donc dans le texte entier, ce qui couvre
// aussi un arbitre qui le placerait dans le contrat.
//
// Ancrée en fin de ligne, comme `lireContrat` : la prose qui CITE le champ
// (« `RAIL_LU: INACCESSIBLE` était attendu, puisque… », decision-2.md:21)
// n'est pas une valeur. La dernière occurrence gagne : c'est celle qui touche
// le contrat.
function lireRailLu(texte) {
  let lu = null;
  for (const ligne of String(texte || '').split('\n')) {
    const m = ligne.replace(/^[\s>*`-]+/, '').match(/^RAIL_LU\s*:\s*([^\s`*]+)[\s`*]*$/);
    if (m) lu = m[1];
  }
  return lu;
}

// Deux écritures du même commit, l'une pouvant être abrégée. Jamais deux vides.
function memeSha(a, b) {
  const x = String(a || '').toLowerCase(), y = String(b || '').toLowerCase();
  if (!FORME_SHA.test(x) || !FORME_SHA.test(y)) return false;
  const n = Math.min(x.length, y.length);
  return x.slice(0, n) === y.slice(0, n);
}

function lectureDuRail(texte, c, opts) {
  const refus = [], run = opts.shaDuRun, tete = opts.shaDuRail;
  const annonce = { RAIL_LU: lireRailLu(texte), HEAD: c.HEAD };
  for (const champ of ['RAIL_LU', 'HEAD']) {
    const v = sansBacktick(annonce[champ]);
    if (!v) { refus.push(`${champ} absent de la réponse : la lecture du rail n'est pas prouvée`); continue; }
    if (v.toUpperCase() === INACCESSIBLE) {
      if (!run || !tete) {
        refus.push(`${champ} vaut ${INACCESSIBLE} et le substitut ne peut pas être contrôlé : SHA du run ou tête du rail non fournis`);
      } else if (!memeSha(run, tete)) {
        refus.push(`${champ} vaut ${INACCESSIBLE} et le substitut ne tient pas : le rail est à ${tete}, le corps arbitré venait de ${run}`);
      }
      continue;
    }
    if (!FORME_SHA.test(v.toLowerCase())) { refus.push(`${champ} = ${v} : ni un SHA ni ${INACCESSIBLE}`); continue; }
    if (!run) { refus.push(`${champ} annonce un SHA et le SHA du run n'est pas fourni : rien à comparer`); continue; }
    if (!memeSha(v, run)) refus.push(`${champ} = ${v} ≠ SHA du run ${run} : l'arbitre n'a pas lu le corps arbitré`);
  }
  return refus;
}

// ── Un verdict qui demande un humain ne se dépose pas tout seul ────────────
// Même `request-1.md` : « refuse tout `OWNER_NEXT: Frédéric` / `BLOCKED` :
// ces décisions restent à un humain, elles sont seulement postées ». Le relais
// contrôlait la COHÉRENCE du couple — Frédéric exige BLOCKED — mais personne
// ne refusait le DÉPÔT. Code 4 et non 2 : le verdict est juste, ce n'est pas
// une panne. La CI le dit en `HUMAN_DECISION_REQUIRED`, s'arrête, et ne rougit
// pas : rougir sur un verdict correct apprend à ignorer le rouge.
const SANS_STOP = /^(non|aucune?s?)$/i;

function relaieUnHumain(c) {
  const motifs = [];
  if (sansBacktick(c.DECISION) === 'BLOCKED') motifs.push('DECISION BLOCKED');
  if (sansBacktick(c.OWNER_NEXT) === 'Frédéric') motifs.push('OWNER_NEXT Frédéric');
  const stop = sansBacktick(c.STOP_REQUIRED);
  if (stop && !SANS_STOP.test(stop)) motifs.push(`STOP_REQUIRED ${stop}`);
  return motifs;
}

function juger(texte, etat, opts = {}) {
  const c = lireContrat(texte);
  if (!c) return { code: 2, refus: ['aucun NEXT_ACTION_CONTRACT dans la réponse'] };
  const lot = sansBacktick(c.LOT), request = sansBacktick(c.REQUEST);
  const v = valider(texte, { lot, request });
  if (!v.ok) return { code: 2, refus: v.refus };
  const fiche = etat && etat.lots && etat.lots[lot];
  if (!fiche) return { code: 2, refus: [`lot ${lot} inconnu au registre`] };
  if (fiche.derniere_demande !== request) {
    return { code: fiche.statut === 'ATTENTE_DECISION' ? 2 : 3,
      refus: [`le registre attend une décision sur ${fiche.derniere_demande}, la réponse vise ${request}`] };
  }
  if (fiche.statut !== 'ATTENTE_DECISION') {
    return { code: 3, refus: [`${lot} est au statut ${fiche.statut} : plus aucune décision n'est attendue sur ${request}`] };
  }
  // Une décision déjà déposée sur cette demande (closes:false, laissée à
  // l'exécutant) n'en appelle pas une seconde : rien à faire, pas un refus.
  const repondues = typeof opts.repondues === 'function' ? opts.repondues(lot) : [];
  if (repondues.includes(request)) {
    return { code: 3, refus: [`une décision répond déjà à ${request} dans ${lot}`] };
  }
  const rail = fiche.rail;
  if (!RAIL_ADMIS.test(String(rail || '')) || INTERDITS.includes(rail)) {
    return { code: 2, refus: [`rail ${JSON.stringify(rail)} hors forme handoff-* : la CI n'écrit que sur un rail Handoff`] };
  }
  if (opts.railDuRun !== undefined && opts.railDuRun !== rail) {
    return { code: 2, refus: [`le run porte ${JSON.stringify(opts.railDuRun)}, le lot vit sur ${rail}`] };
  }
  // Avant la preuve de lecture : un verdict qui revient à Frédéric n'a pas à
  // être qualifié de non conforme — il n'est simplement pas pour la CI.
  const humain = relaieUnHumain(c);
  if (humain.length) {
    return { code: 4, lot, request, refus: [`${humain.join(' et ')} : cette décision reste à un humain, la CI ne la dépose pas — le texte de l'arbitre est déjà posté`] };
  }
  const sansPreuve = lectureDuRail(texte, c, opts);
  if (sansPreuve.length) return { code: 2, refus: sansPreuve };
  return { code: 0, lot, request, decision: c.DECISION, closes: c.CLOSES, rail, contrat: c };
}

function corps(texte, j, prov = {}) {
  const c = j.contrat;
  const conditions = sansBacktick(c.CONDITIONS);
  const lignes = [
    `# Décision sur ${j.request} — ${j.decision}${j.closes === 'true' ? ', lot clos' : ''}`,
    '',
    `_Provenance : verdict rendu par ChatGPT via l'API OpenAI${prov.run ? ` (run ${prov.run})` : ''}` +
      `${prov.commentaire ? `, posté sur ${prov.commentaire}` : ''}. Matérialisé par la CI (stade (a), ` +
      'autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. ' +
      'Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._',
    '',
    '## Ce que la CI a contrôlé',
    '',
    '- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).',
    `- \`LOT\` = \`${j.lot}\`, \`REQUEST\` = \`${j.request}\` : c'est la demande en attente au registre (\`ATTENTE_DECISION\`).`,
    `- Rail \`${j.rail}\` : celui du lot au registre, de forme \`handoff-*\` ; ni \`main\` ni \`production\`.`,
    `- Lecture du rail : \`RAIL_LU\` = \`${sansBacktick(lireRailLu(texte))}\`, \`HEAD\` = \`${sansBacktick(c.HEAD)}\`` +
      `${prov.shaDuRun ? `, SHA du run \`${prov.shaDuRun}\`` : ''}${prov.shaDuRail ? `, tête du rail \`${prov.shaDuRail}\`` : ''}.` +
      ` Un SHA doit être celui du run ; \`INACCESSIBLE\` (relais intégral) n'est admis que si le run est la tête du rail.`,
    '- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.',
    '',
    '## Ce que la CI n\'a PAS contrôlé',
    '',
    `- Les conditions du verdict${conditions && !/^aucune?s?$/i.test(conditions) ? ` (« ${conditions} »)` : ''}. Elles lient l'exécutant suivant (\`${sansBacktick(c.EXECUTANT_NEXT) || 'non désigné'}\`), qui les vérifie avant d'agir.`,
    '- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.',
    '',
    '## Texte de l\'arbitre',
    '',
    texte.trimEnd(),
    '',
  ];
  return lignes.join('\n');
}

// Les demandes auxquelles une décision du lot répond déjà (`in_reply_to`).
function reponduesDansLeLot(lot) {
  const dossier = path.join(RACINE, 'docs', 'handoff', 'lots', lot);
  if (!fs.existsSync(dossier)) return [];
  return fs.readdirSync(dossier).filter(f => /^decision-\d+\.md$/.test(f)).map(f => {
    const m = /^in_reply_to:\s*(\S+)\s*$/m.exec(fs.readFileSync(path.join(dossier, f), 'utf8'));
    return m ? m[1] : null;
  }).filter(Boolean);
}

function principal(argv) {
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const reponse = opt('--reponse'), sortie = opt('--sortie');
  if (!reponse || !sortie) { console.error('usage : materialiser-decision-ci.js --reponse <f> --sortie <corps.md> [--rail-du-run R] [--sha-du-run SHA] [--sha-du-rail SHA] [--run ID] [--commentaire URL]'); return 2; }
  const texte = fs.readFileSync(reponse, 'utf8');
  const etat = JSON.parse(fs.readFileSync(path.join(RACINE, 'docs', 'handoff', 'STATE.json'), 'utf8'));
  const j = juger(texte, etat, { railDuRun: opt('--rail-du-run'), shaDuRun: opt('--sha-du-run'),
    shaDuRail: opt('--sha-du-rail'), repondues: reponduesDansLeLot });
  if (j.code !== 0) {
    // Un refus de forme ne connaît pas son lot ; un palier humain, si. On ne
    // publie que ce qui est su : un `lot` vide serait pire qu'absent.
    const quoi = j.lot ? { refus: j.refus, lot: j.lot, request: j.request } : { refus: j.refus };
    process.stdout.write(JSON.stringify(quoi) + '\n');
    return j.code;
  }
  fs.writeFileSync(sortie, corps(texte, j, { run: opt('--run'), commentaire: opt('--commentaire'),
    shaDuRun: opt('--sha-du-run'), shaDuRail: opt('--sha-du-rail') }));
  const { contrat, code, ...publie } = j;
  process.stdout.write(JSON.stringify(publie) + '\n');
  return 0;
}

module.exports = { juger, corps, reponduesDansLeLot, lectureDuRail, lireRailLu, relaieUnHumain, memeSha };
if (require.main === module) process.exitCode = principal(process.argv.slice(2));
