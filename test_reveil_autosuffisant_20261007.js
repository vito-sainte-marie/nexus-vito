// Le réveil porte le texte intégral de la demande — 07/10/2026.
//
// FAST-TRACK-ANTI-PAUSE-1-20261007 : le réveil posté sur #28 ne nommait que
// `request-1.md`. L'arbitre, qui ne lit pas le dépôt, a répondu « une demande
// attend » — sans verdict ni contrat. Et la consigne « dépose la décision dans
// le même lot » contredisait le mandat (« tu ne déposes aucun fichier »).
//
// Les épreuves tournent sur un registre jetable (`opts.lots`) : le registre
// réel n'est jamais lu ni touché. La mutation débranche l'aide (on retire
// l'appel à `blocDemande` dans `corpsReveil`) : l'épreuve principale doit rougir.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const LOT = 'LOT-EPREUVE-REVEIL-20261007';
const APPEL = '    integral ? blocDemande(l, opts) : blocPointeur(l),\n';

let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}

function registre(texte) {
  const lots = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reveil-')));
  fs.mkdirSync(path.join(lots, LOT));
  if (texte !== null) fs.writeFileSync(path.join(lots, LOT, 'request-1.md'), texte);
  return lots;
}
function lot(extra) {
  return { lot: LOT, demande: 'request-1.md', branche: 'handoff-epreuve',
    adresse: 'https://example.invalid/issues/28', adresse_source: 'request-1.md',
    refs_reelles: null, motif: 'DEMANDE_NON_ARBITREE', token_mode: 'STANDARD', ...extra };
}
const blob = s => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(s)}\0`).update(s).digest('hex');

function module_(mutation, remplacement) {
  if (!mutation) return require('./outils/reveil-orchestrateur.js');
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reveil-mut-')));
  fs.cpSync(path.join(RACINE, 'outils'), path.join(tmp, 'outils'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'docs', 'handoff'), { recursive: true });
  fs.copyFileSync(path.join(RACINE, 'docs', 'handoff', 'ARBITRAGES-ACQUIS.json'), path.join(tmp, 'docs', 'handoff', 'ARBITRAGES-ACQUIS.json'));
  const cible = path.join(tmp, 'outils', 'reveil-orchestrateur.js');
  const s = fs.readFileSync(cible, 'utf8');
  assert.strictEqual(s.split(mutation).length, 2, `ancre de mutation non unique : ${JSON.stringify(mutation)}`);
  fs.writeFileSync(cible, s.replace(mutation, remplacement || ''));
  return require(cible);
}

// ── A. Le cas du 07/10 ────────────────────────────────────────────────────
const DEMANDE = '---\nkind: request\n---\n\n# Mesure\n\nUn bloc ```js\nx\n``` et une suite ```` de quatre.\n\nPHRASE-TEMOIN-UNIQUE\n';
function preuvePrincipale(m) {
  const lots = registre(DEMANDE);
  const c = m.corpsReveil({ reveil: true, lots: [lot()] }, { lots, mention: false, integral: true });
  assert.ok(c.includes('PHRASE-TEMOIN-UNIQUE'), 'le texte de la demande doit être dans le réveil');
  assert.ok(c.includes(`\`${blob(DEMANDE)}\``), 'l\'empreinte blob git doit identifier les octets recopiés');
  // La clôture dépasse la plus longue suite de backticks (4) : le texte ne
  // peut pas refermer le bloc.
  assert.ok(c.includes('\n`````markdown\n'), c);
  const debut = c.indexOf('`````markdown\n') + '`````markdown\n'.length;
  assert.strictEqual(c.slice(debut, c.indexOf('\n`````', debut)), DEMANDE.replace(/\n$/, ''), 'recopie intégrale, octet pour octet');
}
epreuve('A1 — le réveil intégral recopie la demande entière, avec son empreinte, dans une clôture sûre', () => preuvePrincipale(module_()));

epreuve('A2 — la consigne exige un verdict et un contrat, et n\'ordonne plus de déposer', () => {
  const c = module_().corpsReveil({ reveil: true, lots: [lot()] }, { lots: registre(DEMANDE), mention: false });
  assert.ok(c.includes('Arbitre cette demande'), c);
  assert.ok(c.includes('NEXT_ACTION_CONTRACT'), c);
  assert.ok(c.includes('Ne signale pas qu\'elle attend'), c);
  assert.ok(!/dépose la\s+décision/.test(c), 'la consigne de dépôt contredit le mandat');
  assert.ok(c.includes('Tu ne déposes aucun'), c);
});

epreuve('A3 — l\'empreinte calculée est celle de `git hash-object` sur le rail', () => {
  const lots = registre(DEMANDE);
  const attendu = execFileSync('git', ['hash-object', path.join(lots, LOT, 'request-1.md')], { encoding: 'utf8' }).trim();
  assert.ok(module_().blocDemande(lot(), { lots }).includes(attendu));
});

// ── B. Les refus : jamais d'extrait ───────────────────────────────────────
epreuve('B1 — au-delà de la limite, aucun extrait : l\'empreinte et un renvoi', () => {
  const m = module_();
  const long = 'x'.repeat(m.LIMITE_DEMANDE + 1);
  const b = m.blocDemande(lot(), { lots: registre(long) });
  assert.ok(!b.includes('xxxxxxxxxx'), 'aucun fragment du texte');
  assert.ok(/ne décide jamais sur un extrait/.test(b), b);
  assert.ok(b.includes(blob(long)), b);
});
epreuve('B2 — fichier illisible : dit, jamais inventé', () => {
  const b = module_().blocDemande(lot(), { lots: registre(null) });
  assert.ok(/Non recopié : fichier illisible/.test(b), b);
  assert.ok(!/Empreinte/.test(b), b);
});
epreuve('B3 — demande non poussée : rien recopié, attendre le push', () => {
  const m = module_();
  for (const extra of [{ non_publiee: true }, { refs_reelles: { memes: [], homonymes: [], lisible_a_distance: false } }]) {
    const b = m.blocDemande(lot(extra), { lots: registre(DEMANDE) });
    assert.ok(!b.includes('PHRASE-TEMOIN-UNIQUE'), b);
    assert.ok(/pas encore poussée/.test(b), b);
  }
});
epreuve('B4 — une demande qui cite @claude ne rend pas le corps publié re-déclenchant', () => {
  const texte = 'Relancer @claude puis @Claude.\n';
  const c = module_().corpsReveil({ reveil: true, lots: [lot()] }, { lots: registre(texte), mention: false, integral: true });
  assert.ok(!/@claude/i.test(c), 'la garde CI MENTION_REDECLENCHANTE rougirait sur ce corps');
  assert.ok(/2 mention\(s\) de Claude neutralisée\(s\)/.test(c), c);
  assert.ok(c.includes(blob(texte)), 'l\'empreinte reste celle des octets du rail');
});
epreuve('B5 — le corps réel du rail tient sous le plafond d\'un commentaire GitHub', () => {
  const sortie = execFileSync('node', [path.join(RACINE, 'outils', 'reveil-orchestrateur.js'), '--message', '--sans-mention'], { cwd: RACINE, encoding: 'utf8' });
  assert.ok(sortie.length < 65536, `${sortie.length} caractères`);
});

// ── P. Le pointeur, par défaut depuis le 08/10/2026 ───────────────────────
// Le connecteur GitHub de ChatGPT lit le rail : le réveil publié ou collé ne
// recopie plus rien, il dit quoi lire et où. La recopie intégrale reste celle
// du relais par API, qui ne lit pas le dépôt.
function preuvePointeur(m) {
  const c = m.corpsReveil({ reveil: true, lots: [lot()] }, { lots: registre(DEMANDE), mention: false });
  assert.ok(!c.includes('PHRASE-TEMOIN-UNIQUE'), 'le réveil par défaut ne doit plus recopier la demande');
  assert.ok(!c.includes(blob(DEMANDE)), 'ni son empreinte');
  for (const x of [`\`docs/handoff/lots/${LOT}/request-1.md\``, '`docs/handoff/STATE.json`',
                   '`docs/handoff/ARBITRAGES-ACQUIS.json`', 'jamais sur `main`', '`RAIL_LU:', 'NEXT_ACTION_CONTRACT',
                   'n\'arbitre jamais\nsur ce seul pointeur']) {
    assert.ok(c.includes(x), `pointeur incomplet : ${x}\n${c}`);
  }
  const acquis = JSON.parse(fs.readFileSync(path.join(RACINE, 'docs', 'handoff', 'ARBITRAGES-ACQUIS.json'), 'utf8')).acquis;
  for (const a of acquis) assert.ok(!c.includes('`' + a.id + '` — '), `acquis recopié dans le pointeur : ${a.id}`);
}
epreuve('P1 — par défaut, le réveil pointe vers le rail sans rien recopier', () => preuvePointeur(module_()));

epreuve('P2 — la publication poste le pointeur, le relais par API envoie le réveil intégral', () => {
  const wf = fs.readFileSync(path.join(RACINE, '.github', 'workflows', 'tests.yml'), 'utf8');
  const appels = wf.split('\n').filter(x => /CORPS=\$\(node outils\/reveil-orchestrateur\.js --message/.test(x));
  assert.strictEqual(appels.length, 2, appels.join('\n'));
  assert.ok(!appels[0].includes('--integral'), 'la publication sur l\'issue doit rester un pointeur : ' + appels[0]);
  assert.ok(appels[1].includes('--integral'), 'le relais par API ne lit pas le dépôt, il lui faut le texte : ' + appels[1]);
});

// ── M. Débrancher l'aide ──────────────────────────────────────────────────
epreuve('M1 — sans l\'appel à `blocDemande` dans `corpsReveil`, A1 rougit', () => {
  let rouge = false;
  try { preuvePrincipale(module_(APPEL)); }
  catch (e) { rouge = /texte de la demande doit être dans le réveil/.test(e.message); if (!rouge) throw e; }
  assert.ok(rouge, 'la mutation est restée verte : l\'épreuve ne mesure pas le câblage');
});

epreuve('M2 — si le réveil par défaut redevient intégral, P1 rougit', () => {
  let rouge = false;
  try { preuvePointeur(module_(APPEL, '    blocDemande(l, opts),\n')); }
  catch (e) { rouge = /ne doit plus recopier la demande/.test(e.message); if (!rouge) throw e; }
  assert.ok(rouge, 'la mutation est restée verte : P1 ne mesure pas le mode par défaut');
});

console.log(`\n${total - echecs}/${total} épreuves passent`);
process.exit(echecs ? 1 : 0);
