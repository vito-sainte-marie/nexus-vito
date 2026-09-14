// Épreuves du briefing d'agent (outils/briefing-agent.js).
//
// L'enjeu tient en une phrase : ce briefing sera la SEULE mémoire que
// recevront des agents qui n'ont pas vécu les incidents. S'il en perd une
// partie en silence, ou s'il paraphrase une règle, personne ne s'en apercevra
// — l'agent travaillera en croyant connaître les règles du projet.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const OUTIL = path.join(__dirname, 'outils', 'briefing-agent.js');
const { construire, rendre, selectionner } = require(OUTIL);

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

const REGLE_A = { id: 'QA-900', scope: ['qa'], trigger: 't', module: 'all', severity: 'advisory', rule: 'Texte exact de la règle A.', source: 'S' };
const REGLE_B = { id: 'SEC-900', scope: ['security'], trigger: 't', module: 'all', severity: 'blocking', rule: 'Texte exact de la règle B.', source: 'S' };
const REGLE_C = { id: 'CAR-900', scope: ['carburants'], trigger: 't', module: 'carburants-performance', severity: 'business', rule: 'Texte exact de la règle C.', source: 'S' };

// Un dépôt jetable : RULES.json + EXPERIENCE.jsonl, rien d'autre.
function depot({ regles = [REGLE_A, REGLE_B, REGLE_C], experiences = [], rulesBrut, experienceBrut } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'briefing-'));
  fs.mkdirSync(path.join(dir, 'docs', 'learning'), { recursive: true });
  if (rulesBrut !== undefined) {
    if (rulesBrut !== null) fs.writeFileSync(path.join(dir, 'docs', 'learning', 'RULES.json'), rulesBrut);
  } else {
    fs.writeFileSync(path.join(dir, 'docs', 'learning', 'RULES.json'),
      JSON.stringify({ schema: 'nexus-rules/1', updated_at: '2026-09-07', rules: regles }, null, 2));
  }
  fs.writeFileSync(path.join(dir, 'docs', 'learning', 'EXPERIENCE.jsonl'),
    experienceBrut !== undefined ? experienceBrut : experiences.map(e => JSON.stringify(e)).join('\n') + (experiences.length ? '\n' : ''));
  return dir;
}

function lancer(dir, args) {
  const r = spawnSync('node', [OUTIL].concat(args || []), {
    encoding: 'utf8', env: { ...process.env, NEXUS_DEPOT: dir },
  });
  return { code: r.status, sortie: (r.stdout || '') + (r.stderr || '') };
}

t('le texte de la règle est rendu à la virgule près, jamais reformulé', () => {
  // Le contrat ARCH-001 de cet outil. Un briefing qui paraphrase devient une
  // seconde vérité, et sa première divergence avec RULES.json passe inaperçue.
  const r = lancer(depot());
  assert.strictEqual(r.code, 0, r.sortie);
  for (const regle of [REGLE_A, REGLE_B, REGLE_C]) {
    assert.ok(r.sortie.includes(regle.rule),
      `le texte de ${regle.id} doit apparaître tel quel :\n${r.sortie}`);
  }
});

t('la portée filtre, et une portée absente ne rend rien plutôt que tout', () => {
  const dir = depot();
  const qa = lancer(dir, ['--portee', 'qa']);
  assert.ok(qa.sortie.includes('QA-900'));
  assert.ok(!qa.sortie.includes('SEC-900'), 'une règle hors portée ne doit pas être rendue');

  const vide = lancer(dir, ['--portee', 'portee-inexistante']);
  assert.ok(!vide.sortie.includes('QA-900') && !vide.sortie.includes('SEC-900'),
    'un filtre qui ne matche rien ne doit pas se rabattre sur « tout »');
  assert.ok(/Élargir la portée/.test(vide.sortie),
    'et il doit inviter à élargir, pas laisser croire qu’il n’y a rien à respecter');
});

t('une règle « module: all » survit au filtrage par module', () => {
  // Sinon cibler un module masquerait précisément les règles transversales,
  // c'est-à-dire celles qui s'appliquent au module ciblé aussi.
  const r = selectionner([REGLE_A, REGLE_C], { module: 'carburants-performance' });
  const ids = r.map(x => x.id);
  assert.ok(ids.includes('CAR-900'), 'la règle du module doit être là');
  assert.ok(ids.includes('QA-900'), 'la règle transversale aussi');
});

t('ce qui bloque est rendu avant ce qui conseille', () => {
  // Un briefing se lit rarement jusqu'au bout : l'ordre décide de ce qui sera
  // lu. `blocking` d'abord, `advisory` en dernier.
  const ids = selectionner([REGLE_A, REGLE_B, REGLE_C]).map(r => r.id);
  assert.deepStrictEqual(ids, ['SEC-900', 'CAR-900', 'QA-900'], 'ordre par sévérité : ' + ids.join(', '));
});

t('l’incident qui a produit une règle est rendu avec elle', () => {
  // Une règle sans son histoire se discute ; la même avec l'incident qui l'a
  // engendrée s'applique.
  const dir = depot({ experiences: [{
    date: '2026-09-07', type: 'x', component: 'c',
    cause: 'cause_precise_de_l_incident', impact: 'consequence_mesuree',
    resolution: 'r', promoted_rule: 'QA-900',
  }] });
  const r = lancer(dir, ['--portee', 'qa']);
  assert.ok(/cause_precise_de_l_incident/.test(r.sortie), r.sortie);
  assert.ok(/consequence_mesuree/.test(r.sortie), r.sortie);
});

t('un RULES.json absent échoue au lieu de rendre un briefing vide', () => {
  // Le mode de panne le plus dangereux : un agent reçoit une page qui a l'air
  // complète, conclut qu'il n'y a pas de règle, et travaille sans mémoire.
  const dir = depot({ rulesBrut: null });
  const r = lancer(dir);
  assert.notStrictEqual(r.code, 0, 'doit sortir non nul');
  assert.ok(/INDISPONIBLE/.test(r.sortie), r.sortie);
  assert.ok(/Ne pas poursuivre en supposant qu'il n'y a pas de règle/.test(r.sortie),
    'et le dire explicitement : ' + r.sortie);
});

t('un RULES.json illisible échoue de la même façon', () => {
  const r = lancer(depot({ rulesBrut: '{ ceci n est pas du json' }));
  assert.notStrictEqual(r.code, 0);
  assert.ok(/INDISPONIBLE/.test(r.sortie), r.sortie);
});

t('une entrée d’expérience illisible est comptée et signalée, jamais perdue', () => {
  // Perdre une leçon en silence est pire que ne pas l'avoir : on croit avoir
  // tout reçu.
  const dir = depot({ experienceBrut: '{"promoted_rule":"QA-900","date":"2026-09-07","cause":"c","impact":"i"}\nligne cassée\n' });
  const b = construire({ racine: dir });
  const r = lancer(dir);
  assert.ok(/1 entrée\(s\) d'EXPERIENCE\.jsonl illisible\(s\)/.test(r.sortie),
    'le briefing doit avouer ce qui lui manque : ' + r.sortie);
  assert.ok(/des leçons manquent/.test(r.sortie), r.sortie);
});

t('sur le dépôt RÉEL, les trois leçons du 07/09 sont transmises', () => {
  // Le test qui compte : ce que recevra réellement un agent lancé demain.
  const r = spawnSync('node', [OUTIL, '--portee', 'qa'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  for (const id of ['QA-002', 'QA-003', 'QA-004']) {
    assert.ok(r.stdout.includes(id), `${id} doit être transmise aux agents`);
  }
  assert.ok(/calibrated against the real repository/.test(r.stdout),
    'la leçon de calibration doit être rendue mot pour mot');
  assert.ok(/must be proven to have actually modified the source/.test(r.stdout),
    'la leçon sur les mutations aussi');
});

console.log(`\n${passes}/${passes} vérifications passées — la mémoire du projet est servie, pas retapée.`);
