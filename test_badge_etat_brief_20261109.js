// Lot 3 des emojis, vague 1 (Guardian 6750743048) : composant partagé nexus-badge-etat.js, appliqué au Brief seul.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const SRC = lire('nexus-badge-etat.js');
const BRIEF = lire('NEXUS-Brief-v1.html');
const E = require('./nexus-etats-conseiller.js');
const B = require('./nexus-badge-etat.js');
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

// 1. Une clé -> le bon axe, le bon libellé, le bon pictogramme
const CAS = [
  ['🔥 À AGIR', 'action', 'agir', 'À faire : agir', false],
  ['🔴 À DÉCIDER', 'action', 'decider', 'À faire : décider', false],
  ['🟡 À SURVEILLER', 'action', 'surveiller', 'À faire : surveiller', false],
  ['📈 OPPORTUNITÉ', 'qualification', 'opportunite', 'Opportunité', false],
  ['💡 RECOMMANDATION', 'qualification', 'recommandation', 'Recommandation', false],
  ['🟡 À VÉRIFIER', 'gravite', 'a-verifier', 'À vérifier', true],
  ['🔴 CRITIQUE', 'gravite', 'critique', 'Critique', true],
  ['🚫 EXCLU', 'traitement', 'exclu', 'Exclu', true]
];
CAS.forEach(([etat, axe, cle, libelle, picto]) => t(etat + ' -> ' + axe + '/' + cle, () => {
  const h = B.rendu(etat);
  assert.ok(h.indexOf('data-axe="' + axe + '"') >= 0, 'axe');
  assert.ok(h.indexOf('data-etat="' + cle + '"') >= 0, 'clé');
  assert.ok(h.indexOf(libelle) >= 0, 'libellé');
  assert.strictEqual(/<svg[^>]*aria-hidden="true"/.test(h), picto, 'pictogramme aria-hidden');
  assert.ok(!EMOJI.test(h), 'aucun emoji dans le rendu');
}));
t('critique : l\'action Vérifier seulement si la carte offre le geste', () => {
  assert.ok(B.rendu('🔴 CRITIQUE').indexOf('data-axe="action"') < 0);
  const h = B.rendu('🔴 CRITIQUE', { verifierOffert: true, geste: { clicable: true } });
  assert.ok(/<button[^>]*data-etat="verifier"/.test(h));
});
t('TEMPO, SIGNAL, stock et inconnu : rendu neutre sans emoji', () => {
  ['🗓️ TEMPO', '📋 SIGNAL', '📦 À SURVEILLER', '📌 RAPPEL', '❓ INCONNU'].forEach(e => {
    const h = B.rendu(e);
    assert.ok(h.indexOf('data-axe="neutre"') >= 0, e);
    assert.ok(!EMOJI.test(h), e);
  });
  assert.strictEqual(B.rendu(null), '');
});
t('action cliquable = <button> ; non cliquable = texte, jamais une fausse pastille', () => {
  assert.ok(/^<button type="button" class="nbe-action nbe-action-agir"/.test(B.action('agir', { clicable: true })));
  const s = B.action('agir', {});
  assert.ok(/^<span class="nbe-consigne/.test(s) && s.indexOf('nbe-action ') < 0 && s.indexOf('<button') < 0);
});
t('priorité : rang en texte, jamais une couleur', () => {
  assert.ok(B.priorite(0, true).indexOf('① PRIORITÉ') >= 0);
  assert.ok(B.priorite(1, false).indexOf('#2') >= 0);
  assert.ok(!/style=|color/.test(B.priorite(2, false)));
});

// 2. Rang, ordre et totaux : identiques avant/après sur un jeu figé
const JEU = [
  { etat: '🔥 À AGIR', impact_eur: 1200 }, { etat: '🔴 CRITIQUE', impact_eur: 800 },
  { etat: '📈 OPPORTUNITÉ', impact_eur: 500 }, { etat: '💡 RECOMMANDATION', impact_eur: 300 },
  { etat: '🟡 À VÉRIFIER', impact_eur: 150 }, { etat: '🗓️ TEMPO', impact_eur: 0 }
];
t('grouper : chaque carte garde son rang et l\'ordre relatif, rien n\'est perdu', () => {
  const g = B.grouper(JEU);
  assert.deepStrictEqual(g.gains.map(x => x.i), [0, 2, 3]);
  assert.deepStrictEqual(g.risques.map(x => x.i), [1, 4, 5]);
  assert.strictEqual(g.gains.length + g.risques.length, JEU.length);
  g.gains.concat(g.risques).forEach(x => assert.strictEqual(x.p, JEU[x.i]));
});
t('totaux gain / risque identiques avant et après regroupement', () => {
  const avant = k => JEU.filter(p => E.gain(p.etat) === k).reduce((s, p) => s + p.impact_eur, 0);
  const g = B.grouper(JEU), somme = a => a.reduce((s, x) => s + x.p.impact_eur, 0);
  assert.strictEqual(somme(g.gains), avant(true));
  assert.strictEqual(somme(g.risques), avant(false));
  assert.strictEqual(somme(g.gains), 2000);
  assert.strictEqual(somme(g.risques), 950);
});

// 3. Câblage du Brief
const regleBrief = c => /<script src="nexus-badge-etat\.js"><\/script>/.test(c) && /\$\{NexusBadgeEtat\.priorite\(i, estPriorite\)\}/.test(c) && /NexusBadgeEtat\.rendu\(p\.etat\)/.test(c) && /NexusBadgeEtat\.grouper\(brief\.decisions\)/.test(c);
t('Brief : charge le composant et rend rang, badge et groupes par lui', () => { assert.ok(regleBrief(BRIEF)); });
t('Brief : plus d\'emoji d\'état dans la carte de décision', () => {
  const m = /function decisionCardHTML[\s\S]*?\n  }\n/.exec(BRIEF);
  assert.ok(m, 'fonction introuvable');
  const tete = m[0].split('decision-body')[0];
  assert.ok(!EMOJI.test(tete), 'emoji dans l\'en-tête de carte');
  assert.ok(!/p\.etat\}/.test(tete.replace('NexusBadgeEtat.rendu(p.etat)', '')), 'état brut interpolé');
});
t('Brief : écritures journal_decisions et calculs inchangés', () => {
  assert.ok(/etat: plan\.etat/.test(BRIEF));
  assert.strictEqual((BRIEF.match(/NexusEtatsConseiller\.gain\(/g) || []).length, 4);
});
t('Brief : sections Gains et Risques', () => { assert.ok(/groupe\('Gains', g\.gains\) \+ groupe\('Risques', g\.risques\)/.test(BRIEF)); });
t('Autres pages : aucune ne charge le composant (vague 1 = Brief seul)', () => {
  fs.readdirSync(__dirname).filter(f => /^NEXUS-.*\.html$/.test(f) && f !== 'NEXUS-Brief-v1.html').forEach(f => {
    assert.ok(lire(f).indexOf('nexus-badge-etat') < 0, f);
  });
});

// 4. Gardes mutées sur le composant
const regleCss = c => /\.nbe-badge\{[^}]*height:30px[^}]*border-radius:8px/.test(c) && /\.nbe-action\{[^}]*border-radius:999px/.test(c);
const regleJour = c => /:root\[data-theme="jour"\]\{--nbe-attente:#52677B;--nbe-verifier:#865000;--nbe-conforme:#146445;--nbe-critique:#A82A3F/.test(c);
const regleNuit = c => /--nbe-attente:#AAC3D7;--nbe-verifier:#FFC668;--nbe-conforme:#64DAB1;--nbe-critique:#FF8998/.test(c);
const regleTactile = c => /@media \(max-width:600px\)\{button\.nbe-action\{min-height:44px/.test(c);
const regleBouton = c => /if \(opts\.clicable\) \{\s*return '<button type="button"/.test(c);
const regleConsigne = c => />À faire : ' \+ lib/.test(c) && /nbe-consigne/.test(c);
garde('badge 30 px, rayon 8 ; pastille rayon 999', SRC, regleCss, 'height:30px;padding:0 10px', 'height:24px;padding:0 10px');
garde('pastille ronde', SRC, regleCss, 'border-radius:999px', 'border-radius:4px');
garde('jeu de couleurs Nuit', SRC, regleNuit, '--nbe-critique:#FF8998', '--nbe-critique:#F0575A');
garde('jeu de couleurs Jour', SRC, regleJour, '--nbe-critique:#A82A3F', '--nbe-critique:#FF8998');
garde('cible tactile 44 px', SRC, regleTactile, 'min-height:44px', 'min-height:30px');
garde('action cliquable = bouton', SRC, regleBouton, `return '<button type="button"`, `return '<span type="button"`);
garde('consigne écrite pour l\'action sans geste', SRC, regleConsigne, ">À faire : ' + lib", ">' + lib");
garde('pictogramme masqué aux lecteurs d\'écran', SRC, c => (c.match(/aria-hidden="true"/g) || []).length >= 1, 'aria-hidden="true"', 'aria-hidden="false"');
garde('Brief : composant chargé', BRIEF, regleBrief, '<script src="nexus-badge-etat.js"></script>', '');
garde('Brief : rang rendu par le composant', BRIEF, regleBrief, '${NexusBadgeEtat.priorite(i, estPriorite)}', '${i}');
garde('Brief : badge rendu par le composant', BRIEF, regleBrief, 'NexusBadgeEtat.rendu(p.etat)', 'p.etat');
garde('Brief : regroupement par le composant', BRIEF, regleBrief, 'NexusBadgeEtat.grouper(brief.decisions)', 'brief.decisions');
console.log(n + ' épreuves OK');
