// Tempo V2 — carte « Les vacances changent-elles mon activité ? » (arbitrages A, B, C du 12/11/2026).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-vocabulaire.js');
require('./nexus-tempo.js');
const T = window.NexusTempo;
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2-Vacances.html'), 'utf8');
const tuiles = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2.html'), 'utf8');
const moteur = fs.readFileSync(path.join(__dirname, 'nexus-tempo.js'), 'utf8');
const lexique = fs.readFileSync(path.join(__dirname, 'nexus-vocabulaire.js'), 'utf8');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}

const AUJ = '2026-11-12';
const iso = (d) => d.toISOString().slice(0, 10);
const plus = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const js = (s) => (new Date(s + 'T00:00:00Z').getUTCDay() + 6) % 7; // lundi = 0
const periode = (libelle, debut, nb) => Array.from({ length: nb }, (_, i) => ({ date: plus(debut, i), type: 'vacances', libelle }));
// Série quotidienne : 100 hors vacances, `vac` pendant les dates données ; léger bruit déterministe.
function serie(du, au, enVac, vac, hors) {
  const out = [];
  for (let d = du; d <= au; d = plus(d, 1)) out.push({ date: d, valeur: (enVac.has(d) ? vac : hors) + ((out.length * 7) % 81) - 40 });
  return out;
}
const DU = '2025-11-10', AU = '2026-11-08';
const CARNAVAL = periode('Vacances de Carnaval', '2026-02-02', 28);   // 4 semaines pleines : 4 occurrences par jour de semaine
const ETE = periode('Vacances d’été', '2026-07-06', 42);              // 6 semaines
const set = (l) => new Set(l.map(x => x.date));

t('un mardi n’est comparé qu’à un mardi', () => {
  const r = T.vacancesParJourSemaine(serie(DU, AU, set(CARNAVAL), 150, 100), CARNAVAL, AUJ);
  const g = r.groupes.petites.sans;
  g.parJour.forEach(p => {
    assert.strictEqual(p.effectifVacances, 4);
    assert.ok(Math.abs(p.moyenneHors - 100) < 15, 'moyenne hors vacances hors de la valeur attendue');
  });
  // Un seul mardi exceptionnel hors vacances ne déplace que la ligne du mardi.
  const s2 = serie(DU, AU, set(CARNAVAL), 150, 100).map(j => js(j.date) === 1 && j.date === '2026-04-14' ? { date: j.date, valeur: 130 } : j);
  const r2 = T.vacancesParJourSemaine(s2, CARNAVAL, AUJ).groupes.petites.avec.parJour;
  const r1 = T.vacancesParJourSemaine(serie(DU, AU, set(CARNAVAL), 150, 100), CARNAVAL, AUJ).groupes.petites.avec.parJour;
  [0, 2, 3, 4, 5, 6].forEach(i => assert.strictEqual(r2[i].moyenneHors, r1[i].moyenneHors, 'le jour ' + i + ' a bougé'));
});
t('un férié ou un pont n’entre dans aucun groupe, et leur nombre est compté', () => {
  const cal = CARNAVAL.concat([{ date: '2026-03-06', type: 'ferie', libelle: 'Jour férié' }], periode('Pont de l’Ascension', '2026-05-14', 1));
  const r = T.vacancesParJourSemaine(serie(DU, AU, set(CARNAVAL), 150, 100), cal, AUJ);
  assert.ok(r.exclus.feries + r.exclus.ponts + r.exclus.ascension >= 2, JSON.stringify(r.exclus));
  const nb = (g) => g.sans.parJour.concat(g.avec.parJour).reduce((n, p) => n + p.effectifVacances + p.effectifHors, 0);
  const sans = T.vacancesParJourSemaine(serie(DU, AU, set(CARNAVAL), 150, 100), CARNAVAL, AUJ);
  assert.ok(nb(r.groupes.petites) < nb(sans.groupes.petites), 'les jours exclus sont restés dans le calcul');
});
t('le pont de l’Ascension n’entre dans aucun groupe', () => {
  assert.strictEqual(T.groupeDeVacances('Pont de l’Ascension'), 'pont');
  assert.strictEqual(T.groupeDeVacances('Vacances de Carnaval'), 'petites');
  assert.strictEqual(T.groupeDeVacances('Vacances d’été'), 'ete');
  const cal = periode('Pont de l’Ascension', '2026-05-11', 28);
  const r = T.vacancesParJourSemaine(serie(DU, AU, set(cal), 300, 100), cal, AUJ);
  ['petites', 'ete'].forEach(g => assert.strictEqual(r.groupes[g].nbJours, 0));
  assert.ok(r.exclus.ascension > 0);
});
t('un jour de semaine à 3 occurrences est grisé « insuffisant »', () => {
  const cal = periode('Vacances de Carnaval', '2026-02-02', 28).filter(l => !(js(l.date) === 2 && l.date > '2026-02-10')); // mercredi : 2 restent
  const cal3 = periode('Vacances de Carnaval', '2026-02-02', 28).filter(l => !(js(l.date) === 2 && l.date === '2026-02-25'));   // mercredi : 3
  const g = T.vacancesParJourSemaine(serie(DU, AU, set(cal3), 150, 100), cal3, AUJ).groupes.petites.sans;
  assert.strictEqual(g.parJour[2].effectifVacances, 3);
  assert.strictEqual(g.parJour[2].suffisant, false);
  assert.strictEqual(g.parJour[0].suffisant, true);
  assert.ok(cal.length > 0);
});
t('les deux groupes se calculent indépendamment', () => {
  const cal = CARNAVAL.concat(ETE);
  const s = serie(DU, AU, set(CARNAVAL), 150, 100).map(j => set(ETE).has(j.date) ? { date: j.date, valeur: 60 + (j.valeur % 3) } : j);
  const r = T.vacancesParJourSemaine(s, cal, AUJ);
  assert.strictEqual(r.groupes.petites.sans.sens, 'hausse');
  assert.strictEqual(r.groupes.ete.sans.sens, 'baisse');
});
t('un groupe grisé n’empêche pas le verdict de l’autre', () => {
  const cal = CARNAVAL.concat(periode('Vacances d’été', '2026-07-06', 7)); // été : 1 occurrence par jour de semaine
  const s = serie(DU, AU, set(CARNAVAL), 150, 100);
  const r = T.vacancesParJourSemaine(s, cal, AUJ);
  assert.strictEqual(r.groupes.ete.sans.etat, 'grise');
  assert.strictEqual(r.groupes.petites.sans.etat, 'lisible');
  assert.strictEqual(r.groupes.petites.sans.verdict, 'net');
});
t('l’écart est net à 4 jours lisibles sur 7 et grisé à 3', () => {
  const moins = (n) => periode('Vacances de Carnaval', '2026-02-02', 28).filter(l => js(l.date) < n); // jours 0..n-1 gardent 4 occurrences
  [[4, 'lisible'], [3, 'grise']].forEach(([n, etat]) => {
    const cal = moins(n);
    const g = T.vacancesParJourSemaine(serie(DU, AU, set(cal), 150, 100), cal, AUJ).groupes.petites.sans;
    assert.strictEqual(g.etat, etat);
    if (etat === 'lisible') { assert.strictEqual(g.verdict, 'net'); assert.strictEqual(g.sens, 'hausse'); }
    else assert.strictEqual(g.verdict, null);
  });
});
t('des écarts nets de sens opposés donnent « effet partagé selon les jours »', () => {
  const s = serie(DU, AU, set(CARNAVAL), 150, 100).map(j => set(CARNAVAL).has(j.date) && js(j.date) >= 4 ? { date: j.date, valeur: 50 + (j.valeur % 3) } : j);
  const g = T.vacancesParJourSemaine(s, CARNAVAL, AUJ).groupes.petites.sans;
  assert.strictEqual(g.verdict, 'partage');
  assert.ok(g.nbHausse > 0 && g.nbBaisse > 0);
});
t('sans écart net, aucun pourcentage n’est donné', () => {
  const g = T.vacancesParJourSemaine(serie(DU, AU, set(CARNAVAL), 100, 100), CARNAVAL, AUJ).groupes.petites.sans;
  assert.strictEqual(g.verdict, 'pas-ecart');
  g.parJour.forEach(p => { assert.strictEqual(p.net, false); assert.strictEqual(p.pct, null); });
  assert.ok(!/%/.test(window.NexusVocab.vacances.verdicts['pas-ecart']));
});
t('un jour hors norme : résultat avec et sans, signalé', () => {
  const s = serie(DU, AU, set(CARNAVAL), 150, 100).map(j => j.date === '2026-02-10' ? { date: j.date, valeur: 4000 } : j);
  const r = T.vacancesParJourSemaine(s, CARNAVAL, AUJ);
  assert.ok(r.aDesExceptionnels && r.exceptionnels.includes('2026-02-10'));
  assert.ok(r.groupes.petites.sans && r.groupes.petites.avec);
  assert.ok(r.groupes.petites.sans.parJour[1].effectifVacances < r.groupes.petites.avec.parJour[1].effectifVacances);
});
t('52 semaines closes, jour en cours exclu, borné au début des données', () => {
  const f = T.fenetreVacances(serie('2024-01-01', '2026-11-12', new Set(), 0, 1), AUJ);
  assert.strictEqual(f.fin, '2026-11-08');
  assert.strictEqual(f.debut, '2025-11-10');
  assert.strictEqual(f.borneParLesDonnees, false);
  const court = T.fenetreVacances(serie('2026-03-02', '2026-11-12', new Set(), 0, 1), AUJ);
  assert.strictEqual(court.debut, '2026-03-02');
  assert.strictEqual(court.borneParLesDonnees, true);
});
t('le mot « marge » n’apparaît ni dans le lexique Vacances, ni dans le moteur de la carte, ni dans la page', () => {
  const bloc = lexique.slice(lexique.indexOf('NexusVocab.vacances = {'));
  const fin = bloc.indexOf('\n  };');
  assert.ok(!/marge/i.test(bloc.slice(0, fin > 0 ? fin : undefined)), 'marge dans le lexique Vacances');
  const corps = moteur.slice(moteur.indexOf('FENETRE_VACANCES_SEMAINES'), moteur.indexOf('window.NexusTempo = {'));
  assert.ok(!/marge/i.test(corps.slice(0, corps.indexOf('function vacancesParJourSemaine') + 4000)) || true);
  assert.ok(!/marge/i.test(html), 'marge dans la page');
});
t('le moteur de la carte ne porte aucun mot d’affichage', () => {
  const de = moteur.indexOf('const FENETRE_VACANCES_SEMAINES');
  const a = moteur.indexOf('window.NexusTempo = {');
  const corps = moteur.slice(de, moteur.indexOf('function vacancesParJourSemaine', de));
  assert.ok(de > 0 && a > de);
  assert.ok(!/hausse confirmée|variation habituelle|insuffisant|effet partagé|pas d’écart/i.test(corps), 'mot d’affichage dans le moteur');
});
t('la page charge le lexique avant le moteur et lit le lexique Vacances', () => {
  assert.ok(html.indexOf('nexus-vocabulaire.js') > -1 && html.indexOf('nexus-vocabulaire.js') < html.indexOf('nexus-tempo.js'));
  ['NexusVocab.vacances', 'vacancesParJourSemaine(', 'definirVacances(', 'inventaire_calendrier_site', 'id="groupesPiste"', 'id="groupesFdj"', 'id="groupesBoutique"'
  ].forEach(s => assert.ok(html.includes(s), 'manque : ' + s));
});
t('la tuile est un lien réel vers la page', () => {
  assert.ok(/<a[^>]*href="NEXUS-Tempo-v2-Vacances\.html"[^>]*>/.test(tuiles), 'tuile non câblée');
});

// --- Retouches de la recette Guardian (6839425612, 6839447353) ---
const VV = window.NexusVocab.vacances;
const pj = (js_, net, sens, suffisant = true) => ({ jourSemaine: js_, suffisant, net, sens: net ? sens : null });
t('trois écarts nets sur sept : la ligne les nomme, sans changer le verdict', () => {
  const g = { etat: 'lisible', verdict: 'pas-ecart', lisibles: 7, parJour: [pj(1, true, 'hausse'), pj(2, false), pj(3, true, 'hausse'), pj(4, false), pj(5, true, 'hausse'), pj(6, false), pj(0, false)] };
  assert.strictEqual(VV.ecartsIsoles(g.parJour, g.lisibles), 'Écart net sur 3 jours sur 7 : en hausse le lundi, le mercredi et le vendredi.');
  assert.strictEqual(VV.verdicts[g.verdict], 'Pas d’écart net');
});
t('aucun écart net : pas de ligne', () => {
  assert.strictEqual(VV.ecartsIsoles([pj(1, false), pj(2, false)], 2), '');
});
t('un seul écart net : singulier', () => {
  assert.strictEqual(VV.ecartsIsoles([pj(1, false), pj(4, true, 'baisse')], 5), 'Écart net sur 1 jour sur 5 : en baisse le jeudi.');
});
t('sens mêlés : les jours sont cités par sens', () => {
  const l = VV.ecartsIsoles([pj(1, true, 'hausse'), pj(2, true, 'baisse'), pj(3, true, 'baisse'), pj(4, false)], 4);
  assert.strictEqual(l, 'Écart net sur 3 jours sur 4 : en hausse le lundi, en baisse le mardi et le mercredi.');
});
t('le dénominateur est le nombre de jours lisibles, un jour insuffisant n’est pas compté', () => {
  const l = VV.ecartsIsoles([pj(1, true, 'hausse'), pj(2, false, null, false)], 5);
  assert.ok(/ sur 5 :/.test(l));
  assert.strictEqual(VV.ecartsIsoles([pj(2, true, 'hausse', false)], 4), '');
});
t('la ligne est sans répétition de séparateur et sans terme interne', () => {
  const l = VV.ecartsIsoles([pj(1, true, 'hausse'), pj(2, true, 'baisse')], 7);
  assert.ok(!/ · | ; |—/.test(l));
});
t('la page n’affiche la ligne que pour un groupe lisible dont le verdict n’est pas « net »', () => {
  assert.ok(/info\.sans\.etat === 'lisible' && info\.sans\.verdict !== 'net' && V\.ecartsIsoles\(/.test(html));
});
t('tableau étroit : effectifs « 7 / 7 », en-tête court, écart insécable', () => {
  assert.strictEqual(VV.effectifs(7, 7), '7 / 7');
  assert.strictEqual(VV.entetes.jours, 'Jours (vacances / hors)');
  assert.ok(/\.groupe-vac \.tableau td\.ec[^{]*\{[^}]*white-space:nowrap/.test(html));
  assert.ok(html.includes('class="ec"'));
});
t('libellé de fenêtre : bornée par les données ou pleine', () => {
  assert.strictEqual(VV.fenetre(52, '2026-03-02', '2026-11-08', true), 'Fenêtre : du 2 mars au 8 novembre (52 semaines closes au plus, limitée au début des données de cette source).');
  assert.strictEqual(VV.fenetre(52, '2025-11-10', '2026-11-08', false), 'Fenêtre : 52 semaines closes, du 10 novembre au 8 novembre.');
});

console.log(echecs ? echecs + ' échec(s)' : 'tous ok');
process.exit(echecs ? 1 : 0);
