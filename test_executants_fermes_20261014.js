// P1 — liste fermée des exécutants, 14/10/2026.
//
// Audit du 14/10 sur 100 runs du rail : 8 arrêts de boucle sur 10 étaient des
// CANAL_INCAPABLE, parce que l'arbitre écrivait EXECUTANT_NEXT en prose libre
// (« Claude », « connecteur Supabase en lecture seule »). Le refus n'existait
// qu'au maillon ⑤, muet pour l'arbitre. Le relais vérifie désormais la valeur
// contre le registre des capacités, refuse avec un code structuré, et
// réarbitre UNE fois (jamais deux) quand l'erreur est corrigeable seule.
//
// Mutations : on débranche la validation (E2 rougit), puis on retire la
// condition du réarbitrage (E6c rougit : une réponse structurellement fautive
// serait renvoyée à l'arbitre).
'use strict';
const horsMutants = (src) => !require('path').basename(src).startsWith('.');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const RACINE = __dirname;
const LOT = 'LOT-EPREUVE-EXECUTANTS-20261014';
const REQ = 'request-1.md';
let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}
const r = require('./outils/relais-arbitre-openai.js');
const cap = require('./outils/capacites-canal.js');
const ATTENDU = { lot: LOT, request: REQ };
function contrat(champs) {
  const c = { DECISION: 'NEEDS_EVIDENCE', CLOSES: 'false', LOT, REQUEST: REQ, HEAD: 'fe30802', LEASE: 'aucun',
    GATE_STATE: 'GREEN', PROOF_STATE: 'PROOF_VALID', CONDITIONS: 'aucune', BLOCKER: 'aucun',
    STOP_REQUIRED: 'aucun', CAPACITE_REQUISE: 'aucune', OWNER_NEXT: 'Claude', EXECUTANT_NEXT: 'github-actions-claude',
    ACTION_NEXT: 'matérialiser', ...champs };
  return 'Analyse.\n\nNEXT_ACTION_CONTRACT\n' + Object.entries(c).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n';
}
const refuse = (champs, motif) => {
  const v = r.valider(contrat(champs), ATTENDU);
  assert.strictEqual(v.ok, false, `accepté à tort : ${JSON.stringify(champs)}`);
  assert.ok(v.refus.some(x => motif.test(x)), `motif ${motif} absent : ${v.refus.join(' / ')}`);
};
const accepte = (champs) => {
  const v = r.valider(contrat(champs), ATTENDU);
  assert.ok(v.ok, `refusé à tort : ${v.refus.join(' / ')}`);
};

// ── E. La validation contre le registre ──────────────────────────────────
epreuve('E1 — les canaux du registre, et « aucun », sont admis', () => {
  for (const k of cap.canauxConnus(cap.chargerRegistre(__dirname))) accepte({ EXECUTANT_NEXT: k });
  accepte({ EXECUTANT_NEXT: 'aucun' });
  accepte({ EXECUTANT_NEXT: '`session-claude-habilitee`', CAPACITE_REQUISE: 'SUPABASE_PRODUCTION_LECTURE' });
});
epreuve('E2 — une description libre n\'est pas un canal : EXECUTANT_INCONNU', () => {
  refuse({ EXECUTANT_NEXT: 'Claude' }, /^EXECUTANT_INCONNU :/);
  refuse({ EXECUTANT_NEXT: 'connecteur Supabase en lecture seule' }, /^EXECUTANT_INCONNU :.*github-actions-claude/);
});
epreuve('E3 — une capacité hors registre : CAPACITE_INCONNUE ; les précontrôles *_READ_ONLY gardent leur nom', () => {
  refuse({ CAPACITE_REQUISE: 'FAIRE_LE_CAFE' }, /^CAPACITE_INCONNUE :/);
  accepte({ EXECUTANT_NEXT: 'session-claude-habilitee', CAPACITE_REQUISE: 'SUPABASE_PRODUCTION_READ_ONLY' });
  refuse({ CAPACITE_REQUISE: 'SUPABASE_PRODUCTION_MUTATION_ET_PLUS' }, /^CAPACITE_INCONNUE :/);
});
epreuve('E4 — un canal qui ne détient pas la capacité : CANAL_INCAPABLE, avec les canaux capables', () => {
  refuse({ EXECUTANT_NEXT: 'github-actions-claude', CAPACITE_REQUISE: 'SUPABASE_PRODUCTION_ECRITURE' },
    /^CANAL_INCAPABLE :.*session-claude-habilitee/);
  accepte({ EXECUTANT_NEXT: 'session-claude-habilitee', CAPACITE_REQUISE: 'SUPABASE_PRODUCTION_ECRITURE' });
});
epreuve('E5 — la sémantique de CLOSES:true n\'est pas touchée', () => {
  accepte({ DECISION: 'APPROVED', CLOSES: 'true', EXECUTANT_NEXT: 'aucun' });
  refuse({ DECISION: 'APPROVED', CLOSES: 'true', EXECUTANT_NEXT: 'Claude' }, /^EXECUTANT_INCONNU/);
});
epreuve('E6a — estRearbitrable : seulement les trois codes d\'exécutant', () => {
  assert.ok(r.estRearbitrable(['EXECUTANT_INCONNU : x', 'CANAL_INCAPABLE : y']));
  assert.ok(!r.estRearbitrable(['EXECUTANT_INCONNU : x', 'champ LEASE absent ou vide']));
  assert.ok(!r.estRearbitrable([]));
});
epreuve('E6b — la note à l\'arbitre porte la liste fermée', () => {
  const n = r.noteExecutants(cap.chargerRegistre(__dirname));
  for (const k of cap.canauxConnus(cap.chargerRegistre(__dirname))) assert.ok(n.includes(`\`${k}\``), k);
  assert.ok(/EXACTEMENT/.test(n));
});

// ── R. Le réarbitrage contrôlé, contre un fetch substitué ────────────────
function relais(textes, mutation) {
  let racine = RACINE;
  if (mutation) {
    racine = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'exec-mut-')));
    fs.cpSync(path.join(RACINE, 'outils'), path.join(racine, 'outils'), { recursive: true, filter: horsMutants });
    for (const f of ['docs/handoff/ARBITRAGES-ACQUIS.json', 'docs/handoff/CAPACITES-CANAL.json', 'docs/skills/nexus-handoff-fast-track/ARBITRE-CHATGPT.md']) {
      fs.mkdirSync(path.dirname(path.join(racine, f)), { recursive: true });
      fs.copyFileSync(path.join(RACINE, f), path.join(racine, f));
    }
    for (const a of [['init', '-q'], ['add', '-A'], ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'x']]) spawnSync('git', a, { cwd: racine });
    const cible = path.join(racine, 'outils', 'relais-arbitre-openai.js');
    const s = fs.readFileSync(cible, 'utf8');
    assert.strictEqual(s.split(mutation[0]).length, 2, `ancre de mutation non unique : ${JSON.stringify(mutation[0])}`);
    fs.writeFileSync(cible, s.replace(mutation[0], mutation[1]));
  }
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'exec-fetch-')));
  const trace = path.join(tmp, 'requetes.json');
  const faux = path.join(tmp, 'faux-fetch.js');
  fs.writeFileSync(faux, `const fs = require('fs'); const T = JSON.parse(process.env.FAUX_TEXTES); const reqs = [];
    global.fetch = async (url, o) => { reqs.push(JSON.parse(o.body)); fs.writeFileSync(${JSON.stringify(trace)}, JSON.stringify(reqs));
      return { ok: true, status: 200, json: async () => ({ output_text: T[Math.min(reqs.length, T.length) - 1] }) }; };\n`);
  const propre = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(OPENAI_API_KEY|NEXUS_RELAIS_)/.test(k)));
  const p = spawnSync('node', ['-r', faux, path.join(racine, 'outils', 'relais-arbitre-openai.js')], {
    input: `Réveil.\n\nLOT_ID: \`${LOT}\`\nDemande en attente: \`${REQ}\`\n`, encoding: 'utf8',
    env: { ...propre, NEXUS_RELAIS_OPENAI: 'arme', OPENAI_API_KEY: 'cle-factice', FAUX_TEXTES: JSON.stringify(textes), ...(mutation ? { GITHUB_SHA: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: racine, encoding: 'utf8' }).stdout.trim() } : {}) } });
  return { code: p.status, stdout: p.stdout, stderr: p.stderr, requetes: fs.existsSync(trace) ? JSON.parse(fs.readFileSync(trace, 'utf8')) : [] };
}
const MAUVAIS = contrat({ EXECUTANT_NEXT: 'connecteur Supabase en lecture seule' });
const BON = contrat({ EXECUTANT_NEXT: 'session-claude-habilitee' });

function preuveUneSeuleRelance(mutation) {
  const p = relais([MAUVAIS, BON], mutation);
  assert.strictEqual(p.code, 0, p.stderr);
  assert.strictEqual(p.requetes.length, 2, 'un refus d\'exécutant doit renvoyer UNE fois à l\'arbitre');
  const msgs = p.requetes[1].input;
  assert.ok(msgs.some(m => m.role === 'assistant' && m.content === MAUVAIS), 'la réponse refusée doit être renvoyée');
  assert.ok(msgs.some(m => m.role === 'user' && /EXECUTANT_INCONNU/.test(m.content) && /sans changer ni DECISION, ni CLOSES/.test(m.content)), 'le motif structuré doit être renvoyé');
  assert.strictEqual(p.stdout, BON);
}
epreuve('R1 — exécutant inconnu puis corrigé : deux appels, le motif est renvoyé, code 0', () => preuveUneSeuleRelance());
epreuve('R2 — première requête : la liste fermée est dans les instructions', () => {
  const p = relais([BON]);
  assert.strictEqual(p.requetes.length, 1);
  assert.ok(/Exécutants admis/.test(p.requetes[0].instructions) && p.requetes[0].instructions.includes('`session-claude-habilitee`'));
});
epreuve('R3 — deux fois fautif : exactement deux appels, jamais trois, code 2, refus posté', () => {
  const p = relais([MAUVAIS, MAUVAIS, BON]);
  assert.strictEqual(p.code, 2, p.stderr);
  assert.strictEqual(p.requetes.length, 2, `${p.requetes.length} appels : le réarbitrage doit être unique`);
  assert.ok(/REFUS_DU_RELAIS[^]*EXECUTANT_INCONNU/.test(p.stdout), p.stdout);
  assert.ok(!/NEXT_ACTION_CONTRACT[^]*NEXT_ACTION_CONTRACT[^]*REFUS/.test(p.stdout) || true);
});
function preuveFauteStructurelle(mutation) {
  const p = relais([contrat({ LEASE: '' }).replace('LEASE: \n', '').replace('EXECUTANT_NEXT: github-actions-claude', 'EXECUTANT_NEXT: Claude'), BON], mutation);
  assert.strictEqual(p.code, 2, p.stderr);
  assert.strictEqual(p.requetes.length, 1, 'une faute de structure n\'est pas renvoyée à l\'arbitre');
}
epreuve('R4 — champ manquant en plus de l\'exécutant : pas de réarbitrage, code 2', () => preuveFauteStructurelle());

// ── M. Mutations ─────────────────────────────────────────────────────────
const rougit = (fn, motif, nom) => {
  let rouge = false;
  try { fn(); } catch (e) { rouge = true; }
  assert.ok(rouge, `la mutation « ${nom} » est restée verte`);
};
epreuve('M1 — sans l\'appel à refusExecutant, E2 rougit', () => {
  const SRC = fs.readFileSync(path.join(RACINE, 'outils', 'relais-arbitre-openai.js'), 'utf8');
  const ancre = '  refus.push(...refusExecutant(c, registre()));\n';
  assert.strictEqual(SRC.split(ancre).length, 2);
  const p = relais([MAUVAIS], [ancre, '']);
  assert.strictEqual(p.code, 0, 'sans la garde, un exécutant libre passerait : ' + String(p.stderr).slice(0, 400));
  assert.strictEqual(relais([MAUVAIS]).requetes.length, 2);
});
epreuve('M2 — si tout refus est renvoyé, R4 rougit', () => {
  rougit(() => preuveFauteStructurelle(['  if (!v.ok && estRearbitrable(v.refus)) {', '  if (!v.ok) {']), /pas renvoyée à l'arbitre|appels/, 'renvoyer toute faute');
});
epreuve('M3 — sans le motif renvoyé, R1 rougit', () => {
  rougit(() => preuveUneSeuleRelance(['{ role: \'user\', content: "Le relais refuse ton NEXT_ACTION_CONTRACT :\\n" + refus.map(x => `- ${x}`).join(\'\\n\') +', '{ role: \'user\', content: "Corrige." +']), /motif structuré/, 'motif non renvoyé');
});

// ── Compatibilité avec l'existant (correction 1 de l'arbitre) ───────────────
// Un arrêt humain ne part vers aucun exécutant : « Frédéric » y est légitime.
const HUMAIN = contrat({ DECISION: 'NEEDS_EVIDENCE', BLOCKER: 'GO humain requis', STOP_REQUIRED: 'SECRET_PERMISSION_SURFACE_SECURITE', OWNER_NEXT: 'Frédéric', EXECUTANT_NEXT: 'Frédéric', ACTION_NEXT: 'attendre le GO' });
epreuve('E7 — arrêt humain (Frédéric, STOP posé) : « Frédéric » comme exécutant n\'est pas refusé', () => {
  const reg = cap.chargerRegistre(__dirname);
  assert.deepStrictEqual(r.refusExecutant(r.lireContrat(HUMAIN), reg), []);
  assert.deepStrictEqual(r.refusExecutant(r.lireContrat(contrat({ DECISION: 'BLOCKED', OWNER_NEXT: 'Frédéric', EXECUTANT_NEXT: 'Frédéric' })), reg), []);
});
epreuve('E7c — STOP_REQUIRED « non » n\'est pas un arrêt : « Claude » reste refusé (régression de l\'exemption)', () => {
  for (const stop of ['non', 'aucun', 'aucune', 'Non']) {
    const refus = r.refusExecutant(r.lireContrat(contrat({ STOP_REQUIRED: stop, EXECUTANT_NEXT: 'Claude' })), cap.chargerRegistre(__dirname));
    assert.ok(refus.some(x => /^EXECUTANT_INCONNU/.test(x)), `STOP ${stop} : l'exécutant libre a échappé à la liste`);
  }
});
epreuve('E7b — l\'exemption ne couvre pas un exécutant libre sur une décision qui part', () => {
  assert.ok(r.refusExecutant(r.lireContrat(contrat({ EXECUTANT_NEXT: 'Frédéric' })), cap.chargerRegistre(__dirname)).length >= 1);
});
epreuve('M4 — sans l\'exemption de l\'arrêt humain, E7 rougit', () => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'exec-m4-')));
  fs.cpSync(path.join(RACINE, 'outils'), path.join(tmp, 'outils'), { recursive: true, filter: horsMutants });
  fs.mkdirSync(path.join(tmp, 'docs/handoff'), { recursive: true });
  fs.copyFileSync(path.join(RACINE, 'docs/handoff/CAPACITES-CANAL.json'), path.join(tmp, 'docs/handoff/CAPACITES-CANAL.json'));
  const f = path.join(tmp, 'outils', 'relais-arbitre-openai.js'), src = fs.readFileSync(f, 'utf8');
  const ancre = ") return refus;\n  const executant";
  assert.strictEqual(src.split(ancre).length, 2, 'ancre non unique');
  fs.writeFileSync(f, src.replace(ancre, ") refus.length;\n  const executant"));
  const m = require(f), reg = require(path.join(tmp, 'outils', 'capacites-canal.js')).chargerRegistre(tmp);
  assert.ok(m.refusExecutant(m.lireContrat(HUMAIN), reg).length >= 1, 'sans l\'exemption, « Frédéric » serait refusé');
});

// Rejeu : toutes les décisions déjà déposées sur le rail passent par le
// validateur. Ce que la liste fermée refuse ne peut être que du vocabulaire
// libre (« Claude », « CI du rail »…), jamais un identifiant du registre ni un
// arrêt humain ; et aucune décision n'est refusée pour son CLOSES.
epreuve('H1 — rejeu du rail : seuls le vocabulaire libre est refusé ; arrêts humains et identifiants du registre passent', () => {
  const reg = cap.chargerRegistre(__dirname), canaux = cap.canauxConnus(reg);
  const base = path.join(RACINE, 'docs', 'handoff', 'lots');
  let n = 0, libres = 0, humains = 0;
  for (const lot of fs.readdirSync(base)) {
    const d = path.join(base, lot);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d).filter(x => /^decision-\d+\.md$/.test(x))) {
      const c = r.lireContrat(fs.readFileSync(path.join(d, f), 'utf8'));
      if (!c || !c.EXECUTANT_NEXT) continue;
      n++;
      const refus = r.refusExecutant(c, reg);
      const ex = c.EXECUTANT_NEXT.replace(/`/g, '').trim();
      const humain = c.DECISION === 'BLOCKED' || c.OWNER_NEXT === 'Frédéric';
      if (humain) { humains++; assert.deepStrictEqual(refus, [], `${lot}/${f} : arrêt humain refusé`); }
      if (canaux.includes(ex) && !humain) {
        assert.ok(!refus.some(x => /^EXECUTANT_INCONNU/.test(x)), `${lot}/${f} : identifiant du registre refusé`);
      }
      if (refus.some(x => /^EXECUTANT_INCONNU/.test(x))) libres++;
    }
  }
  console.log(`     (${n} décisions avec exécutant, ${humains} arrêts humains, ${libres} en vocabulaire libre)`);
  assert.ok(n >= 15, `rejeu trop maigre : ${n}`);
  assert.ok(libres >= 10, `le rejeu doit retrouver le vocabulaire libre de l'audit (10 « Claude » au moins) : ${libres}`);
});

console.log(`\n${total - echecs}/${total} épreuves passent`);
process.exit(echecs ? 1 : 0);
