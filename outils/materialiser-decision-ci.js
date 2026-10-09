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
// stdout ; 2 = refus (JSON {refus: [...]}) ; 3 = rien à faire (la demande
// n'attend plus de décision : déjà matérialisée, ou dépassée).
'use strict';
const fs = require('fs');
const path = require('path');
const { lireContrat, valider } = require('./relais-arbitre-openai');

const RACINE = path.resolve(__dirname, '..');
const RAIL_ADMIS = /^handoff-[a-z0-9][a-z0-9-]*$/;
const INTERDITS = ['main', 'production'];

const sansBacktick = s => String(s || '').replace(/`/g, '').trim();

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
  if (!reponse || !sortie) { console.error('usage : materialiser-decision-ci.js --reponse <f> --sortie <corps.md> [--rail-du-run R] [--run ID] [--commentaire URL]'); return 2; }
  const texte = fs.readFileSync(reponse, 'utf8');
  const etat = JSON.parse(fs.readFileSync(path.join(RACINE, 'docs', 'handoff', 'STATE.json'), 'utf8'));
  const j = juger(texte, etat, { railDuRun: opt('--rail-du-run'), repondues: reponduesDansLeLot });
  if (j.code !== 0) { process.stdout.write(JSON.stringify({ refus: j.refus }) + '\n'); return j.code; }
  fs.writeFileSync(sortie, corps(texte, j, { run: opt('--run'), commentaire: opt('--commentaire') }));
  const { contrat, code, ...publie } = j;
  process.stdout.write(JSON.stringify(publie) + '\n');
  return 0;
}

module.exports = { juger, corps, reponduesDansLeLot };
if (require.main === module) process.exitCode = principal(process.argv.slice(2));
