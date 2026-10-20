'use strict';
// Épreuves de falsification P5 — provenance des décisions humaines (voie A).
// GOV-R1-IDENTITES-PROVENANCE-20261019, decision-3 : E1 à E5, plus le cas de
// contrôle qui doit rester vert. Rédigées contre
// docs/handoff/lots/GOV-R1-IDENTITES-PROVENANCE-20261019/epreuves-falsification-provenance.md
// et le texte de decision-3.md. Vues ROUGES avant tout code (outils/provenance.js
// et le câblage de outils/handoff.js n'existaient pas), VERTES après.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'handoff.js');
const prov = require('./outils/provenance.js');
const handoff = require('./outils/handoff.js');

let passes = 0, total = 0;
function t(nom, fn) {
  total++;
  try { fn(); passes++; console.log(`  ok  ${nom}`); }
  catch (e) { console.error(`  ECHEC  ${nom}\n        ${e.stack || e.message}`); process.exitCode = 1; }
}

function bac() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-provenance-'));
  fs.mkdirSync(path.join(dir, 'lots'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({ protocol: 'nexus-handoff/2', lot_actif: null, lots: {} }, null, 2) + '\n');
  return dir;
}
function corps(dir, nom, texte) { const f = path.join(dir, nom); fs.writeFileSync(f, texte); return f; }
function lancer(dir, args, envPlus) {
  try {
    const sortie = execFileSync('node', [OUTIL].concat(args),
      { cwd: RACINE, encoding: 'utf8', env: Object.assign({}, process.env, { NEXUS_HANDOFF_DIR: dir }, envPlus || {}) });
    return { code: 0, sortie, erreur: '' };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, sortie: String(e.stdout || ''), erreur: String(e.stderr || '') };
  }
}
const demande = (dir, lot, f) => lancer(dir, ['demande', lot, f]);
const decision = (dir, lot, f, args, envPlus) => lancer(dir, ['decision', lot, f].concat(args || []), envPlus);

console.log('\nP5 — épreuves de falsification de la provenance (E1-E5 + cas de contrôle)\n');

// ── E1 — un nom d'auteur n'est pas une preuve ──────────────────────────────
t('E1 : --auteur "Frédéric Bragance" sans aucune preuve est refusé au dépôt', () => {
  const dir = bac(), lot = 'EPREUVE-P5-E1';
  demande(dir, lot, corps(dir, 'c1.md', '# Demande\n'));
  const r = decision(dir, lot, corps(dir, 'd1.md', '# Décision\n'),
    ['--decision', 'APPROVED', '--closes', 'false', '--auteur', 'Frédéric Bragance']);
  assert.notStrictEqual(r.code, 0, 'le dépôt aurait dû être refusé');
  assert.ok(/PROVENANCE_NON_ETABLIE/.test(r.erreur), r.erreur);
  assert.ok(!fs.existsSync(path.join(dir, 'lots', lot, 'decision-1.md')), 'aucun fichier ne doit avoir été écrit');
});

t('E1 (contre-épreuve) : le même dépôt avec niveau et référence explicites passe', () => {
  const dir = bac(), lot = 'EPREUVE-P5-E1-OK';
  demande(dir, lot, corps(dir, 'c1.md', '# Demande\n'));
  const r = decision(dir, lot, corps(dir, 'd1.md', '# Décision\n'),
    ['--decision', 'APPROVED', '--closes', 'false', '--auteur', 'Frédéric Bragance',
     '--provenance-niveau', '2', '--provenance-reference', 'conversation Claude Code, 20/10/2026']);
  assert.strictEqual(r.code, 0, r.erreur);
  const texte = fs.readFileSync(path.join(dir, 'lots', lot, 'decision-1.md'), 'utf8');
  assert.ok(/provenance:\n\s+niveau: 2\n\s+mode: declared\n\s+reference: conversation Claude Code/.test(texte), texte);
  const env = handoff.lireEnveloppe(path.join(dir, 'lots', lot, 'decision-1.md')).env;
  assert.deepStrictEqual(env.provenance, { niveau: '2', mode: 'declared', reference: 'conversation Claude Code, 20/10/2026' });
});

// ── E4 — le compte partagé seul ne suffit pas ──────────────────────────────
t('E4 : une décision humaine qui revendique le niveau 3 est insuffisante', () => {
  const r = prov.exigenceDeclaree('Frédéric Bragance', { niveau: '3', mode: 'declared', reference: 'commit sous vito-sainte-marie' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'PROVENANCE_INSUFFISANTE');
});
t('E4 : au dépôt, --provenance-niveau 3 est refusé (le compte partagé ne prouve jamais le niveau 3)', () => {
  const dir = bac(), lot = 'EPREUVE-P5-E4';
  demande(dir, lot, corps(dir, 'c1.md', '# Demande\n'));
  const r = decision(dir, lot, corps(dir, 'd1.md', '# Décision\n'),
    ['--decision', 'APPROVED', '--closes', 'false', '--auteur', 'Frédéric Bragance',
     '--provenance-niveau', '3', '--provenance-reference', 'commit sous vito-sainte-marie']);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/PROVENANCE_INSUFFISANTE/.test(r.erreur), r.erreur);
});
t('E4 (contre-épreuve) : un compte qui n’est pas vito-sainte-marie n’est pas davantage exempté — seule la déclaration de niveau compte', () => {
  // L'identité attendue est un élément à prouver, pas un nom de compte exclu :
  // sans déclaration de niveau, N'IMPORTE quel auteur humain est refusé.
  const r = prov.exigenceDeclaree('Un Tiers Quelconque', null);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'PROVENANCE_NON_ETABLIE');
});

// ── E2 — une preuve altérée ou d'un autre compte est rejetée ───────────────
const ATTENDU = { LOT: 'L', REQUEST: 'request-1.md', DECISION: 'APPROVED', CLOSES: 'false' };
const COMMENTAIRE_OK = {
  user: { login: 'github-actions[bot]', type: 'Bot' },
  body: [
    'Réponse de l\'arbitre (ChatGPT, via l\'API, run 39412471899).',
    'RAIL_LU: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'NEXT_ACTION_CONTRACT',
    'DECISION: APPROVED',
    'CLOSES: false',
    'LOT: L',
    'REQUEST: request-1.md',
  ].join('\n'),
};
const JOBS_OK = { jobs: [{ steps: [{ name: 'Réveil Orchestrateur — relais vers l\'arbitre (API OpenAI)', conclusion: 'success' }] }] };
const REF_OK = 'https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-123456';

t('E2a : un octet modifié dans le contrat (CLOSES altéré) est rejeté', () => {
  const commentaireAltere = Object.assign({}, COMMENTAIRE_OK, { body: COMMENTAIRE_OK.body.replace('CLOSES: false', 'CLOSES: true') });
  const appelApi = (chemin) => /comments\//.test(chemin) ? commentaireAltere : JOBS_OK;
  const r = prov.verifierGithubActionsRelay({ mode: prov.MODE_RELAIS_CI, reference: REF_OK }, ATTENDU, { appelApi });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'PROVENANCE_INVALIDE');
});
t('E2b : une preuve valide mais émise par un autre compte est rejetée, avec le compte constaté', () => {
  const commentaireAutreCompte = Object.assign({}, COMMENTAIRE_OK, { user: { login: 'un-agent-quelconque', type: 'User' } });
  const appelApi = (chemin) => /comments\//.test(chemin) ? commentaireAutreCompte : JOBS_OK;
  const r = prov.verifierGithubActionsRelay({ mode: prov.MODE_RELAIS_CI, reference: REF_OK }, ATTENDU, { appelApi });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'PROVENANCE_INVALIDE');
  assert.ok(/un-agent-quelconque/.test(r.motif), r.motif);
});
t('E2c : une référence qui ne désigne rien est rejetée', () => {
  const appelApi = () => { const e = new Error('404 Not Found'); throw e; };
  const r = prov.verifierGithubActionsRelay({ mode: prov.MODE_RELAIS_CI, reference: REF_OK }, ATTENDU, { appelApi });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'PROVENANCE_INVALIDE');
});

// ── E3 — pas de preuve vérifiable : arrêt explicite, jamais de silence ─────
t('E3 : une API injoignable produit un arrêt explicite, jamais un passage silencieux', () => {
  const appelApi = () => { throw new Error('ETIMEDOUT: connexion refusée'); };
  const r = prov.verifierGithubActionsRelay({ mode: prov.MODE_RELAIS_CI, reference: REF_OK }, ATTENDU, { appelApi });
  assert.strictEqual(r.ok, false, 'une API indisponible ne doit jamais être lue comme un succès');
  assert.strictEqual(r.arret, true, 'l’arrêt doit être explicitement marqué');
  assert.ok(/indéterminé/.test(r.motif), r.motif);
});
t('E3 : handoff.verifierProvenanceDecision relaie l’arrêt sans jamais consommer', () => {
  const env = { author: 'ChatGPT', provenance: { niveau: '2', mode: prov.MODE_RELAIS_CI, reference: REF_OK }, decision: 'APPROVED', closes: 'false' };
  const appelApi = () => { throw new Error('ENOTFOUND api.github.com'); };
  const g = handoff.verifierProvenanceDecision('L', { fichier: 'decision-1.md', seq: 1 }, env, 'deadbeef', { appelApi, committer: () => 'github-actions[bot]', request: 'request-1.md' });
  assert.strictEqual(g.ok, false);
  assert.strictEqual(g.arret, true);
});

// ── E5 — author: ChatGPT déposé par un agent est refusé ────────────────────
t('E5 : une décision ChatGPT déposée directement par un agent (commit sous une autre identité) est refusée à la consommation', () => {
  const env = { author: 'ChatGPT', decision: 'APPROVED', closes: 'false' }; // aucune provenance : dépôt direct
  const g = handoff.verifierProvenanceDecision('L', { fichier: 'decision-1.md', seq: 1 }, env, 'deadbeef', { committer: () => 'claude[bot]', request: 'request-1.md' });
  assert.strictEqual(g.ok, false);
  assert.strictEqual(g.code, 'PROVENANCE_NON_ETABLIE');
});
t('E5 (cas de contrôle) : la même forme, committée par github-actions[bot], passe', () => {
  const env = { author: 'ChatGPT', decision: 'APPROVED', closes: 'false' };
  const g = handoff.verifierProvenanceDecision('L', { fichier: 'decision-1.md', seq: 1 }, env, 'deadbeef', { committer: () => 'github-actions[bot]', request: 'request-1.md' });
  assert.strictEqual(g.ok, true);
});
t('E5 (cas de contrôle) : une décision ChatGPT matérialisée par la CI (provenance + API conforme) passe', () => {
  const env = { author: 'ChatGPT', provenance: { niveau: '2', mode: prov.MODE_RELAIS_CI, reference: REF_OK }, decision: 'APPROVED', closes: 'false' };
  const appelApi = (chemin) => /comments\//.test(chemin) ? COMMENTAIRE_OK : JOBS_OK;
  const g = handoff.verifierProvenanceDecision('L', { fichier: 'decision-1.md', seq: 1 }, env, 'deadbeef', { appelApi, committer: () => 'quelqu-un-d-autre', request: 'request-1.md' });
  assert.strictEqual(g.ok, true, JSON.stringify(g));
  assert.strictEqual(g.niveau, 2);
});
t('E5 : au dépôt, --auteur ChatGPT sans référence disponible n’écrit aucune provenance (le repli à la consommation s’appliquera)', () => {
  const dir = bac(), lot = 'EPREUVE-P5-E5-DEPOT';
  demande(dir, lot, corps(dir, 'c1.md', '# Demande\n'));
  const r = decision(dir, lot, corps(dir, 'd1.md', '# Décision\n'),
    ['--decision', 'APPROVED', '--closes', 'false', '--auteur', 'ChatGPT']);
  assert.strictEqual(r.code, 0, r.erreur); // le dépôt reste permissif : la garde forte vit à la consommation
  const texte = fs.readFileSync(path.join(dir, 'lots', lot, 'decision-1.md'), 'utf8');
  assert.ok(!/provenance:/.test(texte), 'sans COMMENTAIRE ni --provenance-reference, aucun champ ne doit être inventé');
});
t('E5 : au dépôt, --auteur ChatGPT avec COMMENTAIRE (celui que la CI exporte) écrit la forme prescrite par decision-3', () => {
  const dir = bac(), lot = 'EPREUVE-P5-E5-DEPOT-OK';
  demande(dir, lot, corps(dir, 'c1.md', '# Demande\n'));
  const r = decision(dir, lot, corps(dir, 'd1.md', '# Décision\n'),
    ['--decision', 'APPROVED', '--closes', 'false', '--auteur', 'ChatGPT'], { COMMENTAIRE: REF_OK });
  assert.strictEqual(r.code, 0, r.erreur);
  const env = handoff.lireEnveloppe(path.join(dir, 'lots', lot, 'decision-1.md')).env;
  assert.deepStrictEqual(env.provenance, { niveau: '2', mode: 'github_actions_relay', reference: REF_OK });
});

// ── Forme de l'enveloppe : objet imbriqué, relu tel quel ───────────────────
t('lireEnveloppe lit un champ provenance comme un objet (pas une liste)', () => {
  const dir = bac();
  const f = path.join(dir, 'd.md');
  fs.writeFileSync(f, ['---', 'protocol: nexus-handoff/2', 'kind: decision', 'lot_id: L', 'seq: 1',
    'author: ChatGPT', 'branch: handoff-x', 'decision: APPROVED', 'closes: false', 'in_reply_to: request-1.md',
    'provenance:', '  niveau: 2', '  mode: github_actions_relay', `  reference: ${REF_OK}`,
    '---', '', 'Corps.', ''].join('\n'));
  const env = handoff.lireEnveloppe(f).env;
  assert.deepStrictEqual(env.provenance, { niveau: '2', mode: 'github_actions_relay', reference: REF_OK });
});

console.log(`\n${passes}/${total} épreuves passent.`);
if (passes !== total) process.exit(1);
