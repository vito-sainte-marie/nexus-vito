// La protection de la branche Production a TROIS états, pas deux.
//
// Le 08/09/2026, `outils/etat-deploiement.js` écrivait `brancheProtegee = false`
// chaque fois que `gh` échouait — sans jeton en CI, par exemple. Le journal Live
// a donc annoncé deux fois, à 14:35 puis à 18:59, que la branche Production
// était « SANS protection : un push direct l'atteint », alors qu'un ruleset
// actif la tenait (pull_request, required_status_checks, non_fast_forward,
// deletion). Vérifié le soir même : la protection existait depuis le 07/09.
//
// C'est le défaut SYMÉTRIQUE de ceux corrigés le même jour côté écrans, et il
// est aussi grave. Un affichage rassurant cache un problème ; une alarme
// permanente détruit la capacité à croire l'alarme. Le jour où Production sera
// réellement ouverte, le message sera identique à celui de la veille.
'use strict';
const path = require('path');
const assert = require('assert');

const P = require(path.join(__dirname, 'outils', 'producteur-evenements-live.js'));
const PROJ = require(path.join(__dirname, 'nexus-live-projection.js'));
const contrat = require(path.join(__dirname, 'nexus-live-evenement.js'));

const T0 = '2026-09-08T22:00:00.000Z';
let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

const barriere = (b) => P.evenementBarriere('LOT', { barrieres: Object.assign({ lu: true }, b) }, T0);

t('protection LUE et tenue : aucun risque, et les règles sont nommées', () => {
  const [e] = barriere({ brancheProtegee: true, reglesEffectives: ['pull_request', 'non_fast_forward'] });
  assert.strictEqual(e.status, 'WAITING');
  assert.ok(/tenue \(pull_request, non_fast_forward\)/.test(e.summary), e.summary);
  assert.deepStrictEqual(contrat.validerEvenementLive(e), []);
  assert.deepStrictEqual(PROJ.risquesStructurels([e]), []);
});

t('protection LUE et absente : c’est un risque structurel, et il le reste', () => {
  const [e] = barriere({ brancheProtegee: false, reglesEffectives: [] });
  assert.strictEqual(e.status, 'BLOCKED');
  const r = PROJ.risquesStructurels([e]);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].code, 'PRODUCTION_NON_PROTEGEE');
});

t('protection NON LISIBLE : ni accusation, ni conformité', () => {
  const [e] = barriere({ brancheProtegee: null, motifNonVerifie: 'gh: GH_TOKEN absent' });
  assert.notStrictEqual(e.status, 'BLOCKED', 'ne pas savoir n’est pas une accusation');
  assert.ok(/NON VÉRIFIÉE/.test(e.summary), e.summary);
  assert.ok(/Ne rien conclure/.test(e.summary), e.summary);
  assert.ok(/gh: GH_TOKEN absent/.test(e.summary), 'la RAISON doit être dite : ' + e.summary);
  assert.deepStrictEqual(contrat.validerEvenementLive(e), []);

  const r = PROJ.risquesStructurels([e]);
  assert.strictEqual(r.length, 1, 'le silence doit avoir une signification explicite');
  assert.strictEqual(r[0].code, 'PROTECTION_NON_VERIFIEE');
  assert.ok(!/PRODUCTION_NON_PROTEGEE/.test(JSON.stringify(r)),
    'une lecture impossible ne doit JAMAIS produire le risque « non protégée »');
});

t('les trois états sont DISTINCTS — sinon le défaut est seulement déplacé', () => {
  const codes = [
    barriere({ brancheProtegee: true, reglesEffectives: ['pull_request'] }),
    barriere({ brancheProtegee: false, reglesEffectives: [] }),
    barriere({ brancheProtegee: null }),
  ].map(([e]) => (PROJ.risquesStructurels([e])[0] || { code: 'AUCUN' }).code);
  assert.deepStrictEqual(codes, ['AUCUN', 'PRODUCTION_NON_PROTEGEE', 'PROTECTION_NON_VERIFIEE']);
});

t('barrières ILLISIBLES : aucun événement du tout', () => {
  // Distinct du cas ci-dessus : ici NEXUS ne sait même pas qu'il devait
  // regarder. Émettre quoi que ce soit reviendrait à inventer une observation.
  assert.deepStrictEqual(P.evenementBarriere('LOT', { barrieres: { lu: false } }, T0), []);
  assert.deepStrictEqual(P.evenementBarriere('LOT', {}, T0), []);
});

t('l’état le plus RÉCENT fait foi, pas le plus alarmant', () => {
  // Le journal réel du 08/09 porte les deux : BLOCKED à 14:35 et 18:59 (faux),
  // puis WAITING « tenue » à 20:24 (vrai, une fois le jeton donné). Un écran qui
  // retiendrait le pire au lieu du dernier resterait rouge pour toujours.
  const faux = { evidence: { type: 'protection', ref: 'refs/heads/production' },
    status: 'BLOCKED', occurred_at: '2026-09-08T18:59:24Z', summary: 'SANS protection' };
  const vrai = { evidence: { type: 'protection', ref: 'refs/heads/production' },
    status: 'WAITING', occurred_at: '2026-09-08T20:24:29Z', summary: 'Branche production tenue (…)' };
  assert.deepStrictEqual(PROJ.risquesStructurels([faux, vrai]), [],
    'la lecture la plus récente doit l’emporter');
  assert.deepStrictEqual(PROJ.risquesStructurels([vrai, faux]), [],
    'et l’ordre du TABLEAU ne doit rien y changer : seul l’horodatage décide');

  // La preuve que c'est bien l'horodatage qui tranche, et non une préférence
  // pour le calme : si le BLOCKED est le plus récent, il gagne.
  const fauxPlusRecent = Object.assign({}, faux, { occurred_at: '2026-09-08T21:00:00Z' });
  assert.deepStrictEqual(PROJ.risquesStructurels([vrai, fauxPlusRecent]).map(r => r.code),
    ['PRODUCTION_NON_PROTEGEE'], 'un problème plus récent qu’un état sain doit ressortir');
});

t('LA LIGNE FAUTIVE ELLE-MÊME : gh injoignable ne rend PAS « non protégée »', () => {
  // Les épreuves ci-dessus injectaient l'état ; elles ne le PRODUISAIENT pas.
  // La ligne qui a causé le défaut du 08/09 restait donc non couverte, et sa
  // mutation survivait. Ici on prive réellement le processus de `gh`, comme la
  // CI l'était sans jeton, et on lit ce que `barrieresProduction` conclut.
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const os = require('os');

  // Un PATH qui contient `git` et RIEN D'AUTRE. Vider le PATH entièrement ne
  // marchait pas : `git` échouait aussi, la fonction sortait AVANT le `catch`,
  // et l'épreuve croyait mesurer la ligne fautive sans jamais l'atteindre.
  // C'est l'assertion sur le motif qui l'a révélé. Et `/usr/bin` ne convient
  // pas non plus : `gh` y est présent sur un runner GitHub.
  const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-sans-gh-'));
  fs.symlinkSync(execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim(),
    path.join(bac, 'git'));

  const script = "const b = require('" + path.join(__dirname, 'outils', 'etat-deploiement.js').replace(/\\/g, '\\\\')
    + "').barrieresProduction(); console.log(JSON.stringify({p: b.brancheProtegee, lu: b.lu, motif: !!b.motifNonVerifie}));";
  const sortie = execFileSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { PATH: bac }),
    cwd: __dirname,
  });
  const r = JSON.parse(sortie.trim().split('\n').pop());
  assert.notStrictEqual(r.p, false,
    'gh injoignable ne doit JAMAIS produire « branche non protégée » — c’est le défaut du 08/09/2026');
  assert.strictEqual(r.p, null, 'il doit produire « je ne sais pas »');
  assert.ok(r.motif, 'et la raison doit être conservée pour être affichée');
});

console.log(`\n${n}/${n} vérifications passées — ne pas savoir n’est ni une faute, ni une conformité.`);
