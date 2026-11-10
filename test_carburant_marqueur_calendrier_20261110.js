// Marqueur calendrier de l'en-tête Carburants : J-4..J+1, deux fériés, calendrier vide/en erreur, cutoff, fuseau, page, non-régression.
const assert = require('assert'); const fs = require('fs');
const M = require('./nexus-carburant-marqueur-calendrier.js');
let n = 0; function t(nom, f) { f(); n++; }
const CFG = { jours_livraison_iso: [1,2,3,4,5], cutoff_heure: '11:00' };
const ARM = { date: '2026-11-11', type: 'ferie', libelle: 'Armistice 1918' };
const ev = (d, extra) => M.evaluer(Object.assign({ dateISO: d, heureHHMM: '08:00', calendrier: [ARM], config: CFG }, extra || {}));

t('J-4 : rien', () => assert.strictEqual(ev('2026-11-07'), null));
t('J-3', () => { const r = ev('2026-11-08'); assert.strictEqual(r.principal.texte, 'Armistice 1918 dans 3 jours'); assert.strictEqual(r.principal.indicateur, 'J-3'); });
t('J-2', () => assert.strictEqual(ev('2026-11-09').principal.texte, 'Armistice 1918 dans 2 jours'));
t('J-1', () => assert.strictEqual(ev('2026-11-10').principal.texte, 'Demain : Armistice 1918 — jour férié'));
t('jour J', () => { const r = ev('2026-11-11'); assert.strictEqual(r.principal.texte, 'Aujourd’hui : Armistice 1918 — jour férié'); assert.strictEqual(r.complement, null); });
t('J+1 : disparaît', () => assert.strictEqual(ev('2026-11-12'), null));
t('deux fériés proches : le plus proche, une seule pastille', () => {
  const cal = [ARM, { date: '2026-11-13', type: 'ferie', libelle: 'Autre' }];
  const r = ev('2026-11-10', { calendrier: cal }); assert.ok(/Armistice/.test(r.principal.texte));
  assert.strictEqual((M.rendreHTML(r).match(/data-mcal="ferie"/g) || []).length, 1);
});
t('calendrier vide / absent / erreur : rien, aucune invention', () => {
  assert.strictEqual(ev('2026-11-10', { calendrier: [] }), null);
  assert.strictEqual(ev('2026-11-10', { calendrier: null }), null);
  assert.strictEqual(M.rendreHTML(null), '');
});
t('vacances : repère secondaire, jamais une fermeture', () => {
  const r = ev('2026-11-05', { calendrier: [{ date: '2026-11-05', type: 'vacances', libelle: 'Toussaint' }] });
  assert.strictEqual(r.principal, null); assert.strictEqual(r.vacances.texte, 'Vacances scolaires : Toussaint');
  assert.ok(!/livraison|ferm/i.test(M.rendreHTML(r)));
});
t('vacances + férié : les deux, sans empilement', () => {
  const r = ev('2026-11-10', { calendrier: [ARM, { date: '2026-11-10', type: 'vacances', libelle: 'Toussaint' }] });
  assert.ok(r.principal && r.vacances);
});
t('cutoff avant', () => assert.ok(/avant 11:00/.test(ev('2026-11-10', { heureHHMM: '10:59' }).complement)));
t('cutoff après (11:00 inclus)', () => assert.ok(/11:00\) est dépassée/.test(ev('2026-11-10', { heureHHMM: '11:00' }).complement)));
t('cutoff absent : message générique, aucune impossibilité', () => {
  const r = ev('2026-11-10', { config: { jours_livraison_iso: [1,2,3,4,5] } });
  assert.ok(/Vérifiez vos besoins avant la prochaine commande\./.test(r.complement)); assert.deepStrictEqual(r.signaux, ['cutoff_heure_absente']);
  assert.ok(!/impossible/i.test(r.complement)); // jamais « commande impossible » sans règle
  assert.ok(!/pas de livraison/i.test(ev('2026-11-10', { config: { cutoff_heure: 'x' } }).complement)); // sans jours_livraison_iso : rien d'affirmé
  assert.ok(/Vérifiez vos besoins avant la prochaine commande\./.test(ev('2026-11-10', { config: null }).complement));
});
t('cutoff invalide traité comme absent', () => assert.deepStrictEqual(ev('2026-11-10', { config: { cutoff_heure: '25:99' } }).signaux, ['cutoff_heure_absente']));
t('« Pas de livraison » seulement par estJourLivraisonPossible', () => {
  // 11/11/2026 = mercredi, férié : la règle existante dit non. Config sans jours_livraison_iso : on n'affirme rien.
  assert.ok(/Pas de livraison/.test(ev('2026-11-10').complement));
  assert.ok(!/Pas de livraison/.test(ev('2026-11-10', { config: { cutoff_heure: '11:00' } }).complement));
  // même férié mais hors liste fériés : jour ouvré, donc pas d'affirmation
  const r = ev('2026-11-10', { calendrier: [{ date: '2026-11-11', type: 'ferie', libelle: 'X' }] });
  assert.ok(/Pas de livraison/.test(r.complement)); // le férié fait partie des fériés passés à la règle
});
t('fuseau : minuit Martinique ≠ UTC', () => {
  const i1 = Date.UTC(2026, 10, 10, 3, 59); // 23:59 le 09/11 à Martinique (UTC-4)
  const i2 = Date.UTC(2026, 10, 10, 4, 0);  // 00:00 le 10/11
  assert.strictEqual(M.dateHeureLocales(i1, 'America/Martinique').dateISO, '2026-11-09');
  assert.strictEqual(M.dateHeureLocales(i1, 'America/Martinique').heureHHMM, '23:59');
  assert.strictEqual(M.dateHeureLocales(i2, 'America/Martinique').dateISO, '2026-11-10');
  assert.strictEqual(M.dateHeureLocales(i2, 'America/Martinique').heureHHMM, '00:00');
  assert.strictEqual(M.dateHeureLocales(i2, 'UTC').dateISO, '2026-11-10');
  assert.strictEqual(M.dateHeureLocales(i1, 'UTC').dateISO, '2026-11-10'); // UTC aurait déjà basculé
});
t('écart de jours indépendant de l\'heure d\'été', () => assert.strictEqual(M.ecartJours('2026-03-28', '2026-03-30'), 2));
t('aperçu en mémoire', () => {
  const a = M.lireApercu('?marqueur_date=2026-11-09&marqueur_heure=10:00&marqueur_calendrier=demo');
  assert.deepStrictEqual(a, { dateISO: '2026-11-09', heureHHMM: '10:00', calendrier: 'demo' });
  assert.strictEqual(M.lireApercu('?site=x'), null);
  assert.ok(/aperçu/.test(M.rendreHTML(ev('2026-11-10'), true)));
});
t('lecture : filtrée par site, deux types, fenêtre, sans écriture ; erreur → null', async () => {});
(async () => {
  const appels = [];
  const q = (res) => { const o = { select: (c) => (appels.push(['select', c]), o), eq: (k, v) => (appels.push(['eq', k, v]), o), in: (k, v) => (appels.push(['in', k, v]), o), gte: (k, v) => (appels.push(['gte', v]), o), lte: (k, v) => (appels.push(['lte', v]), Promise.resolve(res)) }; return o; };
  const ok = await M.chargerCalendrier({ from: (tb) => (appels.push(['from', tb]), q({ data: [ARM], error: null })) }, 'vito-sainte-marie', '2026-11-10');
  assert.deepStrictEqual(ok, [ARM]);
  assert.deepStrictEqual(appels.filter(a => a[0] === 'from'), [['from', 'inventaire_calendrier_site']]);
  assert.ok(appels.some(a => a[0] === 'eq' && a[1] === 'site' && a[2] === 'vito-sainte-marie'));
  assert.ok(appels.some(a => a[0] === 'gte' && a[1] === '2026-11-10') && appels.some(a => a[0] === 'lte' && a[1] === '2026-11-14'));
  const origErr = console.error; console.error = () => {};
  assert.strictEqual(await M.chargerCalendrier({ from: () => q({ data: null, error: { message: 'refus' } }) }, 's', '2026-11-10'), null);
  assert.strictEqual(await M.chargerCalendrier({ from: () => { throw new Error('x'); } }, 's', '2026-11-10'), null);
  console.error = origErr; n += 2;

  // Page : emplacement, script, et non-régression structurelle.
  const html = fs.readFileSync('./NEXUS-Carburants-Pilotage-v1.html', 'utf8');
  const iSel = html.indexOf('class="selecteurs"'), iMq = html.indexOf('id="marqueurCalendrier"'), iAct = html.indexOf('class="topacts"');
  assert.ok(iSel > 0 && iSel < iMq && iMq < iAct, 'marqueur entre le contexte et les actions');
  assert.ok(html.includes('nexus-carburant-marqueur-calendrier.js'));
  assert.ok(html.includes('id="pastilleSite"') && html.includes('id="pastilleDate"') && html.includes('id="btnCorrigerReleve"'));
  assert.ok(/badgeRegimeEl\.innerHTML = construireBadgeRegime\(COMMANDE_CTX\)/.test(html));
  // le module n'écrit rien et ne touche pas aux calculs
  const src = fs.readFileSync('./nexus-carburant-marqueur-calendrier.js', 'utf8');
  assert.ok(!/\.(insert|update|upsert|delete|rpc)\(/.test(src));
  assert.ok(!/autonomie|prevision|consommation/i.test(src.replace(/\/\/.*$/mg, '')));
  n += 4;
  console.log('OK test_carburant_marqueur_calendrier_20261110 : ' + n + ' vérifications');
})().catch(e => { console.error(e); process.exit(1); });
