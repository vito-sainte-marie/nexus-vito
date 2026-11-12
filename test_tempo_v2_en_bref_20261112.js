// Tempo V2 — synthèse « En bref » : mots pris dans le lexique partagé, aucune répétition, trois phrases au plus, jamais de consigne.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-vocabulaire.js');
require('./nexus-tempo.js');
const T = window.NexusTempo;
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2.html'), 'utf8');
const moteur = fs.readFileSync(path.join(__dirname, 'nexus-tempo.js'), 'utf8');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}
const trois = (p, b, f) => [{ nom: 'Piste', evol: p }, { nom: 'Boutique', evol: b }, { nom: 'FDJ', evol: f }];
const PER = { debut: '2026-09-17', fin: '2026-11-11' };
const IMP = { debut: '2026-10-05', fin: '2026-11-09' };
const STABLE = 'Variation habituelle';
const MASQ = { activite: 'Piste', type: 'masquee', sens: 'baisse', titre: 'SP95 en baisse de 207 L par jour (−6,6 %)' };
const VERBES = /\b(devez|devriez|faut|faites|faire|essayez|pensez|prévoyez|augmentez|baissez|réduisez|recommand|conseil|agissez|à surveiller|à corriger)\w*/i;
const INTERNES = /découverte retenue|variation masquée|découplage|detail|Côté |« |»/i;
const phrases = txt => txt.split(/(?<=[.!?])\s+(?=[A-ZÀÉÈÊ])/).filter(Boolean);
const rendu = (o) => T.syntheseEnBref(Object.assign({ periode: PER, importBoutique: IMP, faible: false }, o));

// Aucune répétition : ni verbe conjugué, ni parenthèses consécutives, ni séparateurs d'écran.
function sansRepetition(txt) {
  const verbes = txt.match(/\b(maintient|progresse|progressent|recule|reculent|mérite)\b/g) || [];
  assert.strictEqual(new Set(verbes).size, verbes.length, 'verbe répété : ' + verbes.join(', '));
  assert.ok(!/\)\s*\(/.test(txt), 'parenthèses consécutives');
  assert.ok(!/ · /.test(txt), 'séparateur « · »');
  assert.ok(!/ ; /.test(txt), 'séparateur « ; »');
  assert.ok(!/—/.test(txt), 'tiret cadratin');
  assert.ok(!INTERNES.test(txt), 'terme interne dans le texte');
  const noms = txt.match(/\b(volumes|marge|chiffre d’affaires)\b/g) || [];
  assert.ok(noms.length <= 3, 'trop de noms porteurs : ' + noms.length);
  // Un nom d'évolution ne revient jamais, d'où qu'il vienne (titre de la découverte ou lexique).
  const evol = (txt.match(/\b(baisse|hausse|recul|progression|stable|stables|marge|volume|volumes)\b/gi) || []).map(x => x.toLowerCase());
  ['baisse', 'hausse', 'recul', 'progression', 'stable', 'stables'].forEach(m => {
    assert.ok(evol.filter(x => x === m).length <= 1, 'nom répété : ' + m);
  });
}

t('le rendu validé par Guardian, mot pour mot, sur les valeurs de Sainte-Marie', () => {
  const r = rendu({ activites: trois(STABLE, STABLE, '+20,9 % · Hausse confirmée'), decouverte: MASQ });
  assert.strictEqual(r.periode, 'Du 17 septembre au 11 novembre 2026.');
  assert.strictEqual(r.texte, 'La station maintient ses volumes de carburant et sa marge boutique (import du 5 octobre au 9 novembre 2026), tandis que le chiffre d’affaires FDJ progresse de 20,9 %. Un changement mérite toutefois votre attention : SP95 en baisse de 207 L par jour (−6,6 %), un recul que le volume total de la piste masque en partie.');
  assert.strictEqual(r.note, '');
  sansRepetition(r.texte);
});
t('une activité stable ne reçoit jamais de pourcentage', () => {
  const r = rendu({ activites: trois('+1,0 % · Variation habituelle', '−0,4 % · Variation habituelle', '+20,9 % · Hausse confirmée') });
  assert.ok(!/1,0|0,4/.test(r.texte));
  assert.ok(/progresse de 20,9 %/.test(r.texte));
});
t('marge boutique en recul, ventes en hausse : un verbe par sens, jamais répété', () => {
  const r = rendu({ activites: trois(STABLE, 'Marge en baisse', '+3,2 % · Hausse confirmée') });
  const p = phrases(r.texte);
  assert.ok(p[0].startsWith('La station maintient ses volumes de carburant, tandis que '));
  assert.ok(/la marge boutique \(import du 5 octobre au 9 novembre 2026\) recule/.test(p[0]));
  assert.ok(/le chiffre d’affaires FDJ progresse de 3,2 %/.test(p[0]));
  sansRepetition(r.texte);
});
t('deux activités qui bougent dans le même sens partagent un seul verbe, sans pourcentage', () => {
  const r = rendu({ activites: trois(STABLE, '+8,0 % · Hausse confirmée', '+5,0 % · Hausse confirmée') });
  assert.ok(/la marge boutique .* et le chiffre d’affaires FDJ progressent\./.test(r.texte));
  assert.ok(!/8,0|5,0/.test(r.texte));
  sansRepetition(r.texte);
});
t('une activité sans comparaison est dite telle, une seule fois', () => {
  const r = rendu({ activites: trois(STABLE, 'Tendance non déterminée', STABLE) });
  assert.ok(/, mais aucune comparaison n’est disponible pour la marge boutique/.test(r.texte));
  assert.strictEqual((r.texte.match(/aucune comparaison/g) || []).length, 1);
  sansRepetition(r.texte);
});
t('une réserve propre à une activité rejoint la même parenthèse que l’import', () => {
  const r = rendu({ activites: [{ nom: 'Piste', evol: STABLE }, { nom: 'Boutique', evol: STABLE, reserve: 'deux mois seulement' }, { nom: 'FDJ', evol: STABLE }] });
  assert.ok(r.texte.includes('(import du 5 octobre au 9 novembre 2026, deux mois seulement)'));
  assert.ok(!/\)\s*\(/.test(r.texte));
});
t('la note de prudence reste à part, sans toucher au texte', () => {
  const r = rendu({ faible: true, activites: trois(STABLE, STABLE, STABLE) });
  assert.strictEqual(r.note, 'La comparaison avec la période précédente reste fragile. Ces évolutions sont à interpréter avec prudence.');
  assert.ok(!/fragile|prudence/.test(r.texte));
});
t('la découverte masquée suit le signe du carburant : une hausse aussi', () => {
  const r = rendu({ activites: trois(STABLE, STABLE, STABLE), decouverte: Object.assign({}, MASQ, { sens: 'hausse', titre: 'Gazole en hausse de 90 L par jour (+3,1 %)' }) });
  assert.ok(r.texte.includes('une progression que le volume total de la piste masque en partie'));
});
t('une découverte d’un autre type ne reçoit pas la clause de la piste', () => {
  const r = rendu({ activites: trois(STABLE, STABLE, STABLE), decouverte: { activite: 'Boutique', type: 'decrochage', sens: 'baisse', titre: 'Chiffre d’affaires en hausse, marge en baisse' } });
  assert.ok(r.texte.includes('Un changement mérite toutefois votre attention : chiffre d’affaires en hausse, marge en baisse.'));
  assert.ok(!/masque/.test(r.texte));
});
t('trois phrases au plus, et aucune consigne', () => {
  const r = rendu({ activites: trois(STABLE, 'Marge en baisse', '+3,2 % · Hausse confirmée'), decouverte: MASQ, decouverte2: { activite: 'FDJ', type: 'variation', titre: 'Les jeux à gratter progressent de 12 %' } });
  const p = phrases(r.texte);
  assert.ok(p.length <= 3, p.length + ' phrases');
  assert.ok(p[2].startsWith('À noter aussi : les jeux à gratter'));
  assert.ok(!VERBES.test(r.texte));
});
t('sans lexique, le moteur ne rend rien plutôt que d’inventer', () => {
  const sauve = window.NexusVocab; delete window.NexusVocab;
  try { assert.strictEqual(T.syntheseEnBref({ activites: trois(STABLE, STABLE, STABLE), periode: PER }).texte, ''); }
  finally { window.NexusVocab = sauve; }
});
t('le moteur ne porte plus de phrase en dur', () => {
  const corps = moteur.slice(moteur.indexOf('function syntheseEnBref'), moteur.indexOf('window.NexusTempo = {'));
  assert.ok(!/restent stables|mérite|tandis que|progresse|recule|aucune comparaison|À noter/.test(corps), 'mot d’affichage dans le moteur');
  assert.ok(!/SUJETS_EN_BREF|MOTIF_EN_BREF/.test(moteur));
});
t('la page charge le lexique avant le moteur et branche l’encadré', () => {
  assert.ok(html.indexOf('nexus-vocabulaire.js') > -1 && html.indexOf('nexus-vocabulaire.js') < html.indexOf('nexus-tempo.js'));
  ['id="enBrefTexte"', 'id="enBrefPeriode"', 'id="enBrefNote"', 'window.NexusTempo.syntheseEnBref(',
    'enBrefEtat.faible = comp.faible', 'enBrefEtat.importBoutique = { debut: mi.debut, fin: mi.fin }',
    'enBrefEtat.periode = { debut: bornes.debut, fin: bornes.fin }', 'if (slot === 0) { enBrefEtat.decouverte = {'
  ].forEach(s => assert.ok(html.includes(s), 'manque : ' + s));
  assert.ok(/enBrefEtat\.decouverte = \{[^}]*sens: c\.sens/.test(html), 'le sens de la découverte n’est pas transmis');
  assert.ok(!/detail: \(f\.lignes/.test(html), 'la ligne brute de la fiche ne doit plus être transmise');
});

console.log(echecs ? echecs + ' échec(s)' : 'tous ok');
process.exit(echecs ? 1 : 0);
