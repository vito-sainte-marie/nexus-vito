// Marqueur calendrier de l'en-tête Carburants : J-4..J+1, deux fériés, calendrier vide/en erreur, cutoff, fuseau, page, non-régression.
const assert = require('assert'); const fs = require('fs');
const M = require('./nexus-carburant-marqueur-calendrier.js');
let n = 0; function t(nom, f) { f(); n++; }
const CFG = { jours_livraison_iso: [1,2,3,4,5], cutoff_heure: '11:00' };
const ARM = { date: '2026-11-11', type: 'ferie', libelle: 'Armistice 1918' };
const ev = (d, extra) => M.evaluer(Object.assign({ dateISO: d, heureHHMM: '08:00', calendrier: [ARM], config: CFG }, extra || {}));

t('J-4 : rien', () => assert.strictEqual(ev('2026-11-07'), null));
t('badge J-3 : une seule ligne, année retirée', () => { const r = ev('2026-11-08'); assert.strictEqual(r.principal.texte, 'Dans 3 jours : Armistice — mer. 11 nov.'); });
t('badge J-2', () => assert.strictEqual(ev('2026-11-09').principal.texte, 'Dans 2 jours : Armistice — mer. 11 nov.'));
t('badge J-1', () => assert.strictEqual(ev('2026-11-10').principal.texte, 'Demain : Armistice — mer. 11 nov.'));
t('badge jour J : un seul « Aujourd’hui », aucun message', () => {
  const r = ev('2026-11-11'); assert.strictEqual(r.principal.texte, 'Aujourd’hui : Armistice — mer. 11 nov.'); assert.strictEqual(r.complement, null);
  const h = M.rendreHTML(r); assert.strictEqual((h.match(/Aujourd’hui/g) || []).length, 1);
});
t('J+1 : disparaît', () => assert.strictEqual(ev('2026-11-12'), null));
t('année retirée à l\'affichage seulement', () => {
  assert.strictEqual(M.nomAffiche('Armistice 1918'), 'Armistice'); assert.strictEqual(M.nomAffiche('Victoire 1945'), 'Victoire');
  assert.strictEqual(M.nomAffiche('Abolition de l\'esclavage (Martinique)'), 'Abolition de l\'esclavage (Martinique)');
  assert.strictEqual(M.nomAffiche('1918'), '1918');
  assert.strictEqual(ARM.libelle, 'Armistice 1918'); ev('2026-11-10'); assert.strictEqual(ARM.libelle, 'Armistice 1918');
});
t('plus de puce séparée ni « jour férié »', () => {
  for (const d of ['2026-11-08', '2026-11-10', '2026-11-11']) { const h = M.rendreHTML(ev(d)); assert.ok(!/mcal-j/.test(h)); assert.ok(!/jour férié/i.test(h)); assert.ok(!/J-\d/.test(h)); }
});
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
t('vacances : libellé court, repère secondaire, jamais une fermeture', () => {
  const r = ev('2026-11-05', { calendrier: [{ date: '2026-11-05', type: 'vacances', libelle: 'Vacances de la Toussaint' }] });
  assert.strictEqual(r.principal, null); assert.strictEqual(r.vacances.texte, 'Vacances scolaires : Toussaint');
  assert.ok(!/livraison|ferm/i.test(M.rendreHTML(r)));
  assert.strictEqual(M.vacancesCourt('Vacances de Noël'), 'Noël'); assert.strictEqual(M.vacancesCourt('Vacances de Carnaval'), 'Carnaval');
  assert.strictEqual(M.vacancesCourt('Vacances d\'été'), 'Été'); assert.strictEqual(M.vacancesCourt('Vacances de l\'Ascension'), 'Ascension');
  assert.strictEqual(M.vacancesCourt('Toussaint'), 'Toussaint'); assert.strictEqual(M.vacancesCourt('Pâques'), 'Pâques');
});
t('vacances + férié : les deux, sans empilement', () => {
  const r = ev('2026-11-10', { calendrier: [ARM, { date: '2026-11-10', type: 'vacances', libelle: 'Vacances de la Toussaint' }] });
  assert.ok(r.principal && r.vacances);
});
const MSG_AVANT = 'Anticipez vos besoins en carburant. Vérifiez vos stocks et vos commandes avant 11 h.';
const MSG_APRES = 'L’heure limite habituelle de commande (11 h) est dépassée. Vérifiez vos approvisionnements à venir.';
const MSG_ABSENT = 'Anticipez vos besoins en carburant. Vérifiez vos besoins avant la prochaine commande.';
t('un seul message, J-3 à J-1, aucun le jour J', () => {
  for (const d of ['2026-11-08', '2026-11-09', '2026-11-10']) { const h = M.rendreHTML(ev(d)); assert.strictEqual((h.match(/data-mcal="complement"/g) || []).length, 1); assert.ok(!/Armistice/.test(M.evaluer({ dateISO: d, heureHHMM: '08:00', calendrier: [ARM], config: CFG }).complement)); }
  assert.strictEqual(M.rendreHTML(ev('2026-11-11')).includes('data-mcal="complement"'), false);
});
t('cutoff avant', () => assert.strictEqual(ev('2026-11-10', { heureHHMM: '10:59' }).complement, MSG_AVANT));
t('cutoff après (11:00 inclus)', () => { assert.strictEqual(ev('2026-11-10', { heureHHMM: '11:00' }).complement, MSG_APRES); assert.strictEqual(ev('2026-11-10', { heureHHMM: '13:00' }).complement, MSG_APRES); });
t('cutoff absent ou invalide : n\'affirme rien sur l\'heure', () => {
  for (const config of [{ jours_livraison_iso: [1,2,3,4,5] }, null, { cutoff_heure: 'x' }, { cutoff_heure: '25:99' }]) {
    const r = ev('2026-11-10', { config }); assert.strictEqual(r.complement, MSG_ABSENT); assert.deepStrictEqual(r.signaux, ['cutoff_heure_absente']);
    assert.ok(!/\d ?h|dépassée|impossible/i.test(r.complement));
  }
});
t('format de l\'heure : « 11 h » et « 11 h 30 », jamais en dur', () => {
  assert.strictEqual(M.heureFr('11:00'), '11 h'); assert.strictEqual(M.heureFr('11:30'), '11 h 30'); assert.strictEqual(M.heureFr('09:05'), '9 h 05');
  const c = { cutoff_heure: '11:30' };
  assert.strictEqual(ev('2026-11-10', { config: c, heureHHMM: '11:29' }).complement, 'Anticipez vos besoins en carburant. Vérifiez vos stocks et vos commandes avant 11 h 30.');
  assert.strictEqual(ev('2026-11-10', { config: c, heureHHMM: '11:30' }).complement, 'L’heure limite habituelle de commande (11 h 30) est dépassée. Vérifiez vos approvisionnements à venir.');
  assert.ok(/avant 14 h\./.test(ev('2026-11-10', { config: { cutoff_heure: '14:00' } }).complement));
});
t('aucun « Pas de livraison » dans le marqueur', () => {
  for (const d of ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']) for (const heureHHMM of ['08:00', '15:00']) for (const config of [CFG, null, { cutoff_heure: '11:30' }]) {
    const h = M.rendreHTML(ev(d, { heureHHMM, config })); assert.ok(!/pas de livraison|livraison/i.test(h));
  }
});
t('date courte : jour de semaine et mois français', () => {
  assert.strictEqual(M.dateCourte('2026-11-11'), 'mer. 11 nov.'); assert.strictEqual(M.dateCourte('2026-12-25'), 'ven. 25 déc.'); assert.strictEqual(M.dateCourte('2027-01-01'), 'ven. 1 janv.');
});
t('démo alignée sur les dates réelles : Toussaint du 20/10 au 02/11', () => {
  const cal = (d) => { const a = M.evaluer({ dateISO: d, heureHHMM: '08:00', calendrier: M.calendrierDemo(d), config: CFG }); return a; };
  assert.strictEqual(cal('2026-11-02').vacances.texte, 'Vacances scolaires : Toussaint');
  assert.strictEqual(cal('2026-10-20').vacances.texte, 'Vacances scolaires : Toussaint');
  assert.strictEqual(cal('2026-11-03'), null); assert.strictEqual(cal('2026-11-07'), null);
  assert.strictEqual(cal('2026-11-10').vacances, null); assert.ok(cal('2026-11-10').principal);
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
  assert.ok(!/pas de livraison|estJourLivraisonPossible/i.test(src));
  n += 5;
  console.log('OK test_carburant_marqueur_calendrier_20261110 : ' + n + ' vérifications');
})().catch(e => { console.error(e); process.exit(1); });
