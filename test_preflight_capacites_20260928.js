#!/usr/bin/env node
'use strict';
// Épreuves — un préflight qui déclare passerait ici ; un préflight qui exécute, non.
// Ces épreuves montent de VRAIS dépôts nus locaux : un qui accepte, un qui refuse.
// Aucune n'atteint `origin`.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { verifier, lirePreuve, masquer, NAMESPACE } = require('./outils/preflight-capacites.js');

let passees = 0; const echecs = [];
const ep = (titre, f) => { try { f(); passees++; } catch (e) { echecs.push(`${titre} — ${e.message}`); } };
const g = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// Un bac : un dépôt de travail avec un commit, et deux dépôts nus.
const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-'));
const travail = path.join(bac, 'travail');
const ouvert = path.join(bac, 'ouvert.git');
const ferme = path.join(bac, 'ferme.git');
fs.mkdirSync(travail);
g(['init', '-q', '-b', 'principale'], travail);
g(['config', 'user.email', 'epreuve@local'], travail);
g(['config', 'user.name', 'Épreuve'], travail);
fs.writeFileSync(path.join(travail, 'a.txt'), 'a\n');
g(['add', 'a.txt'], travail); g(['commit', '-qm', 'socle'], travail);
for (const nu of [ouvert, ferme]) g(['init', '-q', '--bare', nu], bac);
// Le dépôt fermé refuse toute écriture, comme un jeton sans `contents: write`.
const hook = path.join(ferme, 'hooks', 'pre-receive');
fs.writeFileSync(hook, '#!/bin/sh\necho "refus: droit d\'ecriture absent" >&2\nexit 1\n');
fs.chmodSync(hook, 0o755);
g(['remote', 'add', 'ouvert', ouvert], travail);
g(['remote', 'add', 'ferme', ferme], travail);

ep('LE PRÉFLIGHT EXÉCUTE — un refus RÉEL du distant est rapporté comme refus', () => {
  const r = verifier({ remote: 'ferme', cwd: travail, id: 'ep-refus' });
  assert.strictEqual(r.capable, false, 'un distant qui refuse doit produire capable=false');
  assert.ok(/droit d'ecriture absent/.test(r.sortie),
    'le refus rapporté doit être CELUI DU DISTANT, pas un message fabriqué : ' + r.sortie);
});

ep('un distant qui accepte produit une capacité établie', () => {
  const r = verifier({ remote: 'ouvert', cwd: travail, id: 'ep-ok' });
  assert.strictEqual(r.capable, true, r.sortie);
});

ep('la mesure ne LAISSE RIEN derrière elle', () => {
  verifier({ remote: 'ouvert', cwd: travail, id: 'ep-trace' });
  const refs = g(['ls-remote', 'ouvert'], travail);
  assert.ok(!refs.includes(NAMESPACE),
    'la ref jetable doit être supprimée — mesurer ne doit pas modifier ce qu’on mesure');
});

ep('la ref jetable ne touche AUCUN espace de branche', () => {
  const r = verifier({ remote: 'ouvert', cwd: travail, id: 'ep-ns' });
  assert.ok(r.ref.startsWith('refs/preflight/'), r.ref);
  assert.ok(!r.ref.startsWith('refs/heads/'), 'jamais dans refs/heads : un préflight ne crée pas de branche');
});

ep('la preuve NOMME la commande et la date qui l’ont établie', () => {
  const r = verifier({ remote: 'ferme', cwd: travail, id: 'ep-preuve' });
  assert.ok(/^git push ferme HEAD:refs\/preflight\//.test(r.commande), r.commande);
  assert.ok(!Number.isNaN(Date.parse(r.date)), 'la date doit être lisible : ' + r.date);
});

ep('une impossibilité SANS commande est irrecevable', () => {
  const v = lirePreuve({ capable: false, date: '2026-09-28T00:00:00Z' });
  assert.strictEqual(v.recevable, false);
  assert.ok(/commande/.test(v.pourquoi));
});

ep('une impossibilité SANS date est irrecevable', () => {
  for (const d of [undefined, '', 'hier']) {
    const v = lirePreuve({ capable: false, commande: 'git push origin …', date: d });
    assert.strictEqual(v.recevable, false, `date « ${d} » ne doit pas passer`);
    assert.ok(/dat/.test(v.pourquoi));
  }
});

ep('une preuve qui ne CONCLUT pas est irrecevable', () => {
  assert.strictEqual(lirePreuve({ commande: 'x', date: '2026-09-28T00:00:00Z' }).recevable, false);
  assert.strictEqual(lirePreuve(null).recevable, false);
  assert.strictEqual(lirePreuve('capable').recevable, false);
});

ep('aucun secret ne sort dans la sortie rapportée', () => {
  const sale = 'remote: https://x-access-token:ghp_AAAABBBBCCCCDDDDEEEEFFFF@github.com/o/d.git refusé';
  const propre = masquer(sale);
  assert.ok(!propre.includes('ghp_AAAABBBBCCCCDDDDEEEEFFFF'), propre);
  assert.ok(propre.includes('https://***@github.com'),
    'l’identifiant doit être remplacé, l’URL rester lisible : ' + propre);
  assert.ok(!/\/\/x-access-token/.test(propre), propre);
  // Un jeton n’apparaît pas toujours dans une URL : git le recopie aussi dans
  // ses messages. Sans ce cas, la règle d’URL couvrait le jeton par accident et
  // la règle de jeton n’était mesurée par rien.
  const hors = masquer('remote: le jeton ghp_AAAABBBBCCCCDDDDEEEEFFFF n’a pas le droit workflow');
  assert.ok(!hors.includes('ghp_AAAABBBBCCCCDDDDEEEEFFFF'),
    'un jeton hors URL doit être masqué lui aussi : ' + hors);
  assert.ok(hors.includes('***'), hors);
  assert.ok(!masquer('github_pat_11ABCDEF0123456789').includes('0123456789'),
    'les jetons fins (github_pat_) sont masqués aussi');
});

ep('le DÉFAUT exécute — rien ne permet un préflight muet sans le dire', () => {
  const src = fs.readFileSync('./outils/preflight-capacites.js', 'utf8');
  assert.ok(/git = executerGit/.test(src),
    'l’injection de git doit avoir execFileSync pour défaut : sinon un appelant obtient un préflight qui ne pousse rien');
  assert.ok(/execFileSync/.test(src), 'l’outil doit réellement lancer git');
});

fs.rmSync(bac, { recursive: true, force: true });

console.log(echecs.length
  ? `ROUGE — ${echecs.length} échec(s) sur ${passees + echecs.length}\n  · ${echecs.join('\n  · ')}`
  : `VERT — ${passees}/${passees} : une capacité exercée est un fait, une capacité déclarée est une opinion.`);
process.exit(echecs.length ? 1 : 0);
