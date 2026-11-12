// Tempo V2 — « Jours forts et faibles » : une seule fonction pour toutes les mesures, jours grisés sous le seuil,
// aucun jour désigné quand les jours se ressemblent, textes pris dans le lexique partagé, jamais de consigne.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-vocabulaire.js');
require('./nexus-tempo.js');
const T = window.NexusTempo;
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2-Jours.html'), 'utf8');
const accueil = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2.html'), 'utf8');
const moteur = fs.readFileSync(path.join(__dirname, 'nexus-tempo.js'), 'utf8');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}
const VERBES = /\b(devez|devriez|faut|faites|faire|essayez|pensez|prévoyez|augmentez|baissez|réduisez|recommand|conseil|agissez|à surveiller|à corriger)\w*/i;
const BORNES = { debut: '2026-08-17', fin: '2026-10-11' }; // huit semaines lundi → dimanche, sans férié
const iso = d => d.toISOString().slice(0, 10);
function serie(valeurDuJour, debut, nb) {
  const out = [];
  for (let i = 0; i < nb; i++) {
    const d = new Date(Date.UTC(2026, 7, 17 + i));
    const js = d.getUTCDay();
    const bruit = ((i * 7) % 5) - 2; // petit écart déterministe
    out.push({ date: iso(d), valeur: valeurDuJour(js) + bruit });
  }
  return out;
}
const SEMAINE = serie(js => (js === 6 ? 2000 : js === 0 ? 800 : 1200), BORNES.debut, 56);
const PLATE = serie(() => 1000, BORNES.debut, 56);

t('un jour nettement au-dessus et un nettement en dessous sont désignés, triés du plus fort au plus faible', () => {
  const r = T.joursFortsFaibles(SEMAINE, BORNES, []);
  assert.strictEqual(r.etat, 'designe');
  assert.strictEqual(r.ordre[0].jourSemaine, 6);
  assert.strictEqual(r.ordre[0].verdict, 'au-dessus');
  assert.strictEqual(r.ordre[6].jourSemaine, 0);
  assert.strictEqual(r.ordre[6].verdict, 'en-dessous');
  for (let i = 1; i < 7; i++) assert.ok(r.ordre[i - 1].moyenne >= r.ordre[i].moyenne);
});
t('des jours qui se ressemblent : aucun désigné, sept moyennes de lundi à dimanche, non triées', () => {
  const r = T.joursFortsFaibles(PLATE, BORNES, []);
  assert.strictEqual(r.etat, 'ressemblent');
  assert.strictEqual(r.designe, false);
  assert.deepStrictEqual(r.ordre.map(p => p.jourSemaine), [1, 2, 3, 4, 5, 6, 0]);
  assert.ok(r.ordre.every(p => p.verdict === 'habituel'));
  assert.strictEqual(T.lignesJours(r, 'piste').constat, 'Les jours se ressemblent');
});
t('moins de quatre occurrences un jour : il est grisé, sans moyenne, et aucun jour n’est désigné', () => {
  const peu = SEMAINE.filter(j => !(new Date(j.date + 'T00:00:00Z').getUTCDay() === 3 && j.date > '2026-09-02'));
  const r = T.joursFortsFaibles(peu, BORNES, []);
  const mer = r.parJour.find(p => p.jourSemaine === 3);
  assert.ok(mer.effectif < 4);
  assert.strictEqual(mer.suffisant, false);
  assert.strictEqual(mer.moyenne, null);
  assert.strictEqual(mer.verdict, 'grise');
  assert.strictEqual(r.designe, false);
  assert.ok(r.parJour.every(p => p.verdict === 'habituel' || p.verdict === 'grise'));
});
t('un férié est écarté et nommé, sans fausser la moyenne de son jour', () => {
  const s = SEMAINE.map(j => j.date === '2026-09-09' ? { date: j.date, valeur: 100 } : j);
  const r = T.joursFortsFaibles(s, BORNES, [{ date: '2026-09-09', type: 'ferie', libelle: 'Jour test' }]);
  const e = r.ecartes.find(x => x.date === '2026-09-09');
  assert.ok(e && e.motif === 'ferie' && e.nom === 'Jour test');
  const mer = r.parJour.find(p => p.jourSemaine === 3);
  assert.ok(mer.moyenne > 1100);
  assert.ok(T.lignesJours(r, 'piste').ecartes.length > 0);
});
t('un jour hors norme pour son jour de semaine est écarté ; le samedi fort ne l’est pas', () => {
  const s = SEMAINE.map(j => j.date === '2026-09-22' ? { date: j.date, valeur: 9000 } : j);
  const r = T.joursFortsFaibles(s, BORNES, []);
  assert.ok(r.ecartes.some(x => x.date === '2026-09-22' && x.motif === 'exceptionnel'));
  assert.ok(!r.ecartes.some(x => new Date(x.date + 'T00:00:00Z').getUTCDay() === 6));
});
t('le jour en cours et les jours hors fenêtre ne comptent pas', () => {
  const r = T.joursFortsFaibles(SEMAINE.concat([{ date: '2026-10-12', valeur: 50000 }, { date: '2026-08-16', valeur: 50000 }]), BORNES, []);
  assert.strictEqual(r.nbJours, 56);
});
t('rien de mesuré : état absent, aucun jour désigné', () => {
  const r = T.joursFortsFaibles([], BORNES, []);
  assert.strictEqual(r.etat, 'absent');
  assert.strictEqual(r.designe, false);
});
t('la même fonction sert Piste, FDJ et boutique ; une seconde mesure boutique donne une seconde série sans code neuf', () => {
  const m = T.joursFortsFaiblesMesures({ piste: SEMAINE, fdj: PLATE, boutique: SEMAINE, marge: null, boutiqueBis: PLATE }, BORNES, []);
  assert.deepStrictEqual(m.map(x => x.cle), ['piste', 'fdj', 'boutique', 'marge', 'boutiqueBis']);
  assert.deepStrictEqual(m.map(x => x.disponible), [true, true, true, false, true]);
  assert.strictEqual(m[0].resultat.etat, 'designe');
  assert.strictEqual(m[1].resultat.etat, 'ressemblent');
  assert.strictEqual(m[4].resultat.etat, 'ressemblent');
  assert.strictEqual(m[3].resultat, null);
  assert.ok(/joursFortsFaiblesMesures/.test(html) && !/joursFortsFaibles\(/.test(html.replace(/joursFortsFaiblesMesures/g, '')), 'la page doit passer par la fonction générique');
});
t('la marge boutique est dite indisponible, sans chiffre', () => {
  const ligne = window.NexusVocab.jours.marge.indisponible;
  assert.ok(ligne.startsWith('Marge par jour : pas encore disponible'));
  assert.ok(!/\d/.test(ligne), 'un chiffre dans la ligne');
  assert.ok(!/Decenium/i.test(JSON.stringify(window.NexusVocab.jours)), 'Decenium à l’écran');
});
t('la boutique précise que c’est le chiffre d’affaires, pas la marge', () => {
  assert.ok(/pas la marge/.test(window.NexusVocab.jours.boutique.precision));
});
t('aucun texte du lexique ne répète un mot-clé, ne contient de tiret cadratin ni de consigne', () => {
  const r = T.joursFortsFaibles(SEMAINE, BORNES, [{ date: '2026-09-09', type: 'ferie', libelle: 'Jour test' }]);
  const l = T.lignesJours(r, 'boutique');
  const texte = [l.constat, l.ecartes].concat(...l.jours.map(j => j.lignes)).join(' ');
  assert.ok(!VERBES.test(texte), 'consigne : ' + texte);
  assert.ok(!/—/.test(texte));
  l.jours.forEach(j => {
    const mots = j.lignes.join(' ').toLowerCase().match(/nettement au-dessus|nettement en dessous|variation habituelle/g) || [];
    assert.ok(mots.length <= 1, 'verdict répété : ' + j.lignes.join(' | '));
  });
});
t('sans lexique, le moteur ne rend rien plutôt que d’inventer', () => {
  const sauve = window.NexusVocab; delete window.NexusVocab;
  try { assert.strictEqual(T.lignesJours(T.joursFortsFaibles(SEMAINE, BORNES, []), 'piste'), null); }
  finally { window.NexusVocab = sauve; }
});
t('le moteur ne porte aucune phrase d’affichage pour les jours', () => {
  const corps = moteur.slice(moteur.indexOf('function joursFortsFaibles('), moteur.indexOf('window.NexusTempo = {')).replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/Nettement|Variation habituelle|se ressemblent|Pas assez|pas encore disponible|écarté/.test(corps), 'mot d’affichage dans le moteur');
});
t('la page charge le lexique avant le moteur, garde manager et forfait, lectures bornées par site, sans products', () => {
  assert.ok(html.indexOf('nexus-vocabulaire.js') > -1 && html.indexOf('nexus-vocabulaire.js') < html.indexOf('nexus-tempo.js'));
  ['nexusEstManager(employee)', "nexusRequireProfessional('NEXUS-Tempo-v2-Jours.html'", "'audits_caisse'", "'view_fdj_daily_summary'",
    'T.joursFortsFaiblesMesures(', 'T.joursCaBoutique(', 'T.joursLitresCompletsPiste(', 'T.joursCaFdjComplets(', 'J.marge.indisponible',
    'id="margeBoutique"', 'id="precisionBoutique"', 'bornes.fin'
  ].forEach(s => assert.ok(html.includes(s), 'manque : ' + s));
  assert.ok((html.match(/\.eq\('site', siteId\)/g) || []).length >= 3, 'lecture sans filtre de site');
  assert.ok(!/from\('products'\)/.test(html));
  assert.ok(!/Decenium/i.test(html));
});
t('la bannière suit la page Mois : une image, srcset, alt vide, repli sur erreur, cadrage', () => {
  ["const b = 'assets/tempo/tempo-jours'", 'class="am-banniere"', 'srcset=', 'alt=""', 'onerror="this.parentNode.remove()"'].forEach(s => assert.ok(html.includes(s), 'manque : ' + s));
  ['800', '1200', '1600'].forEach(w => assert.ok(fs.existsSync(path.join(__dirname, 'assets/tempo/tempo-jours-' + w + '.webp')), 'image ' + w));
});
t('la tuile de l’accueil mène à la page', () => {
  assert.ok(/<a class="tuile croisee disponible" href="NEXUS-Tempo-v2-Jours.html">.*Quels sont mes jours forts et faibles \?/.test(accueil));
});

console.log(echecs ? echecs + ' échec(s)' : 'tous ok');
process.exit(echecs ? 1 : 0);
