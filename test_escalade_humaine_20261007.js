// Escalade humaine à deux paliers — l'arbitre ne redemande plus ce qui est tranché.
//
// Le 07/10/2026, Frédéric : ChatGPT « a tendance à me redemander des
// arbitrages que j'ai déjà pris ». Mesuré : le réveil Orchestrateur ne lui
// transmettait ni sa délégation ni les décisions rendues, et la liste STOP du
// skill renvoyait à Frédéric des motifs (CI rouge, conflit, preuve manquante)
// qui ne relèvent que de l'arbitre. Doctrine § 3 bis : deux paliers.
//
// Cette épreuve tient quatre propriétés, chacune par une mutation qui mord :
//   A. le registre `docs/handoff/ARBITRAGES-ACQUIS.json` partitionne exactement
//      MOTIFS_STOP_FERMES, et chaque acquis cite une ancre réellement présente ;
//   B. un motif du palier Frédéric le réveille TOUJOURS, quel que soit l'acquis
//      cité — aucun acquis ne délègue la Production ;
//   C. sans motif codé, ou avec un motif inconnu, Frédéric n'est JAMAIS réveillé ;
//   D. le corps du réveil porte réellement le mandat (câblage, pas seulement
//      fonction : la mutation est « débrancher l'appel ») ;
//   E. Fast Track v2 : le réveil, SKILL.md et ARBITRE-CHATGPT.md portent le
//      même NEXT_ACTION_CONTRACT et les mêmes motifs Frédéric, et l'arbitre
//      ne dépose plus lui-même decision-N.md.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const { MOTIFS_STOP_FERMES } = require('./outils/classification-canal.js');
const esc = require('./outils/escalade-humaine.js');
const { corpsReveil } = require('./outils/reveil-orchestrateur.js');

let reussites = 0;
const echecs = [];
function epreuve(nom, f) {
  try { f(); reussites += 1; console.log(`  ✅ ${nom}`); }
  catch (e) { echecs.push({ nom, e }); console.log(`  ❌ ${nom}\n     ${e && e.stack || e}`); }
}

const registre = () => esc.chargerRegistre(RACINE);
const clone = o => JSON.parse(JSON.stringify(o));
const LOT_D4 = 'GOUVERNANCE-REFERENCE-CODE-20261005';

// Une copie jetable de outils/ et du registre, avec UNE substitution dans un
// fichier. L'ancre doit être unique et la copie doit différer : une mutation
// qui ne s'applique pas rendrait un vert sans rien mesurer.
function variante(fichier, avant, apres) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'escalade-'));
  fs.cpSync(path.join(RACINE, 'outils'), path.join(tmp, 'outils'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'docs', 'handoff'), { recursive: true });
  fs.copyFileSync(path.join(RACINE, esc.FICHIER_REGISTRE), path.join(tmp, esc.FICHIER_REGISTRE));
  const cible = path.join(tmp, fichier);
  const s = fs.readFileSync(cible, 'utf8');
  assert.strictEqual(s.split(avant).length - 1, 1, `ancre de mutation non unique ou absente dans ${fichier}`);
  const muté = s.replace(avant, apres);
  assert.notStrictEqual(muté, s, 'mutation sans effet');
  fs.writeFileSync(cible, muté);
  return tmp;
}

function reveil(opts) {
  return corpsReveil({ reveil: true, lots: [{
    lot: LOT_D4, demande: 'request-7.md', branche: 'handoff-continuite-20260920',
    adresse: 'https://example.invalid/issues/28', adresse_source: 'request-7.md',
    refs_reelles: null, motif: 'DEMANDE_NON_ARBITREE', token_mode: 'STANDARD',
  }] }, opts);
}

console.log('A — registre');

epreuve('A — le registre réel est conforme (routage et ancres)', () => {
  assert.deepStrictEqual(esc.verifierRegistre(null, RACINE), []);
});

epreuve('A — chaque motif fermé est routé exactement une fois', () => {
  const r = registre();
  const tous = r.routage.frederic.concat(r.routage.arbitre);
  for (const m of MOTIFS_STOP_FERMES) assert.strictEqual(tous.filter(x => x === m).length, 1, m);
});

epreuve('A — mutation : un motif routé dans les deux paliers rougit', () => {
  const r = clone(registre());
  r.routage.frederic.push(r.routage.arbitre[0]);
  assert.ok(esc.verifierRegistre(r, RACINE).some(d => /routé deux fois/.test(d)));
});

epreuve('A — mutation : un motif fermé retiré du routage rougit', () => {
  const r = clone(registre());
  r.routage.arbitre.pop();
  assert.ok(esc.verifierRegistre(r, RACINE).some(d => /non routé/.test(d)));
});

epreuve('A — mutation : une ancre d’acquis absente de sa source rougit', () => {
  const r = clone(registre());
  r.acquis[0].source.ancre += ' (paraphrasé)';
  assert.ok(esc.verifierRegistre(r, RACINE).some(d => /ancre introuvable/.test(d)));
});

epreuve('A — mutation : un fichier source disparu rougit', () => {
  const r = clone(registre());
  r.acquis[0].source.fichier = 'docs/inexistant.md';
  assert.ok(esc.verifierRegistre(r, RACINE).some(d => /source absente/.test(d)));
});

epreuve('A — mutation : un acquis sans réponse rougit', () => {
  const r = clone(registre());
  delete r.acquis[0].reponse;
  assert.ok(esc.verifierRegistre(r, RACINE).some(d => /sans reponse/.test(d)));
});

console.log('B — le palier Frédéric gagne toujours');

epreuve('B — chaque motif Frédéric réveille Frédéric, même avec chaque acquis cité', () => {
  const r = registre();
  for (const motif of r.routage.frederic) {
    for (const a of [undefined].concat(r.acquis.map(x => x.id))) {
      const v = esc.escalader({ motif, acquis: a, lot: LOT_D4 }, r);
      assert.strictEqual(v.verdict, esc.VERDICTS.ESCALADE_FREDERIC, `${motif} + ${a} → ${JSON.stringify(v)}`);
      assert.strictEqual(v.destinataire, 'Frédéric');
    }
  }
});

epreuve('B — mutation : un acquis qui passe avant le palier Frédéric est détecté', () => {
  const tmp = variante('outils/escalade-humaine.js',
    "  if (motif && frederic.has(motif)) return vers('Frédéric', VERDICTS.ESCALADE_FREDERIC);\n  if (acquis) {",
    "  if (acquis) {");
  const muté = require(path.join(tmp, 'outils', 'escalade-humaine.js'));
  const v = muté.escalader({ motif: 'PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION', acquis: 'COMMIT_PUSH_RAIL_SANS_GO' }, registre());
  assert.notStrictEqual(v.verdict, esc.VERDICTS.ESCALADE_FREDERIC,
    'la mutation devait ouvrir le contournement que B interdit ; sinon B ne mesure rien');
});

console.log('C — rien d’autre n’atteint Frédéric');

epreuve('C — chaque motif arbitre reste chez l’arbitre (ARBITRE_TRANCHE)', () => {
  const r = registre();
  for (const motif of r.routage.arbitre) {
    const v = esc.escalader({ motif }, r);
    assert.strictEqual(v.verdict, esc.VERDICTS.ARBITRE_TRANCHE, motif);
    assert.strictEqual(v.destinataire, 'arbitre');
  }
});

epreuve('C — sans motif codé : SANS_MOTIF_CODE, jamais Frédéric', () => {
  const v = esc.escalader({}, registre());
  assert.deepStrictEqual([v.destinataire, v.verdict], ['arbitre', esc.VERDICTS.SANS_MOTIF_CODE]);
});

epreuve('C — motif en texte libre ou inconnu : MOTIF_INCONNU, jamais Frédéric', () => {
  for (const motif of ['prudence', 'GO request-7', 'production']) {
    const v = esc.escalader({ motif }, registre());
    assert.deepStrictEqual([v.destinataire, v.verdict], ['arbitre', esc.VERDICTS.MOTIF_INCONNU], motif);
  }
});

epreuve('C — un acquis connu répond DEJA_ARBITRE avec sa source', () => {
  const v = esc.escalader({ motif: 'REGRESSION_CI_NOUVELLE_INEXPLIQUEE', acquis: 'COMMIT_PUSH_RAIL_SANS_GO' }, registre());
  assert.strictEqual(v.verdict, esc.VERDICTS.DEJA_ARBITRE);
  assert.ok(v.reponse && v.source && v.source.fichier);
});

epreuve('C — un acquis borné à un lot ne vaut pas ailleurs', () => {
  const r = registre();
  assert.strictEqual(esc.escalader({ acquis: 'D4_HORS_PERIMETRE', lot: LOT_D4 }, r).verdict, esc.VERDICTS.DEJA_ARBITRE);
  assert.strictEqual(esc.escalader({ acquis: 'D4_HORS_PERIMETRE', lot: 'AUTRE-LOT' }, r).verdict, esc.VERDICTS.ACQUIS_INCONNU);
  assert.ok(!esc.blocMandat(r, 'AUTRE-LOT').includes('D4_HORS_PERIMETRE'));
  assert.ok(esc.blocMandat(r, LOT_D4).includes('D4_HORS_PERIMETRE'));
});

console.log('D — le réveil porte le mandat');

epreuve('D — le corps du réveil contient le mandat, chaque code Frédéric et chaque acquis applicable', () => {
  const corps = reveil({ integral: true });
  const r = registre();
  assert.ok(corps.includes('Mandat de l\'arbitre'), 'mandat absent');
  assert.ok(corps.includes('Ta décision tient lieu de GO'));
  const ligne = corps.split('\n').findIndex(l => l.includes('Réveille Frédéric UNIQUEMENT'));
  const codes = corps.split('\n')[ligne + 1];
  for (const m of r.routage.frederic) assert.ok(codes.includes('`' + m + '`'), m);
  for (const m of r.routage.arbitre) assert.ok(!codes.includes(m), `motif arbitre ${m} offert comme motif de réveil de Frédéric`);
  for (const a of r.acquis) assert.ok(corps.includes('`' + a.id + '`'), a.id);
});

epreuve('D — registre illisible : le réveil part quand même et le dit', () => {
  const corps = reveil({ registre: { routage: null } });
  assert.ok(corps.includes('Mandat de l\'arbitre indisponible'));
  assert.ok(corps.includes('Arbitre cette demande'));
});

epreuve('D — mutation : l’appel au mandat débranché est détecté', () => {
  const tmp = variante('outils/reveil-orchestrateur.js', '    mandatArbitre(l, opts),\n', '');
  const { corpsReveil: muté } = require(path.join(tmp, 'outils', 'reveil-orchestrateur.js'));
  const corps = muté({ reveil: true, lots: [{ lot: LOT_D4, demande: 'request-7.md', branche: 'x',
    adresse: 'https://example.invalid/issues/28', adresse_source: 'request-7.md', refs_reelles: null,
    motif: 'DEMANDE_NON_ARBITREE' }] });
  assert.ok(!corps.includes('Mandat de l\'arbitre'), 'la mutation devait retirer le mandat du corps');
});

console.log('E — Fast Track v2 : l’arbitre décide, Claude matérialise');

// Écarts entre le contrat de relais, le corps du réveil et les deux textes
// qui le décrivent. Rendre une liste plutôt que lever permet aux mutations de
// vérifier que l'écart est bien vu, et pas seulement qu'une erreur est levée.
const ARBITRE = 'docs/skills/nexus-handoff-fast-track/ARBITRE-CHATGPT.md';
const SKILL = 'docs/skills/nexus-handoff-fast-track/SKILL.md';
function ecartsV2(corps, champs, r, texteArbitre, skill) {
  const e = [];
  if (!corps.includes('NEXT_ACTION_CONTRACT')) e.push('réveil sans NEXT_ACTION_CONTRACT');
  for (const k of ['DECISION', 'CLOSES', 'OWNER_NEXT', 'ACTION_NEXT', 'STOP_REQUIRED']) {
    if (!champs.some(([c]) => c === k)) e.push(`champ ${k} absent du contrat`);
  }
  for (const [k] of champs) {
    if (!corps.includes(`  ${k}: <`)) e.push(`champ ${k} absent du réveil`);
    if (!skill.includes('`' + k + '`')) e.push(`champ ${k} absent de SKILL.md`);
  }
  for (const m of r.routage.frederic) if (!texteArbitre.includes('`' + m + '`')) e.push(`motif ${m} absent de ARBITRE-CHATGPT.md`);
  if (/Tu déposes `decision-N\.md`/.test(texteArbitre)) e.push('ARBITRE-CHATGPT.md fait encore déposer la décision par l’arbitre');
  return e;
}
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');

epreuve('E — le réveil, le skill et le texte de l’arbitre portent le même contrat et les mêmes motifs', () => {
  assert.deepStrictEqual(ecartsV2(reveil(), esc.CHAMPS_CONTRAT, registre(), lire(ARBITRE), lire(SKILL)), []);
});

epreuve('E — mutation : un champ retiré du contrat est détecté', () => {
  const tmp = variante('outils/escalade-humaine.js', "  ['OWNER_NEXT', 'Claude | Frédéric'],\n", '');
  const muté = require(path.join(tmp, 'outils', 'escalade-humaine.js'));
  assert.ok(ecartsV2(reveil(), muté.CHAMPS_CONTRAT, registre(), lire(ARBITRE), lire(SKILL)).some(x => x.includes('OWNER_NEXT')));
});

epreuve('E — mutation : un motif Frédéric ajouté sans le dire à l’arbitre est détecté', () => {
  const r = clone(registre());
  r.routage.frederic.push('MOTIF_NOUVEAU_NON_TRANSMIS');
  assert.ok(ecartsV2(reveil(), esc.CHAMPS_CONTRAT, r, lire(ARBITRE), lire(SKILL)).some(x => x.includes('MOTIF_NOUVEAU_NON_TRANSMIS')));
});

epreuve('E — mutation : l’ancienne consigne « tu déposes decision-N.md » est détectée', () => {
  const ancien = lire(ARBITRE) + '\nTu déposes `decision-N.md` dans le même lot.\n';
  assert.ok(ecartsV2(reveil(), esc.CHAMPS_CONTRAT, registre(), ancien, lire(SKILL)).some(x => x.includes('déposer')));
});

console.log(`\nEscalade humaine — ${reussites} épreuve(s) passée(s), ${echecs.length} échec(s).`);
if (echecs.length) process.exit(1);
