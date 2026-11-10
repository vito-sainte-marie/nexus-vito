// Guardian 6769932054 (10/11/2026) : calendrier du site — unicité par type, académie, fériés 2026-2027,
// vacances officielles, workflows silencieux, Tempo lisant la table.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
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
const C = require('./nexus-calendrier-site.js');
const MIG = 'supabase/migrations/';
const mUnicite = lire(MIG + '20261110100000_calendrier_site_unicite_par_type.sql');
const mAcademie = lire(MIG + '20261110110000_station_config_academie_scolaire.sql');
const mFeries = lire(MIG + '20261110120000_calendrier_site_feries_2026_2027.sql');
const mVacances = lire(MIG + '20261110130000_calendrier_site_vacances_martinique.sql');

// --- 1. Contrainte (site, date, type) ---
const regleUnicite = c => /drop constraint[^;]*inventaire_calendrier_site_site_date_key/.test(c) && /unique \(site, date, type\)/.test(c) && /pg_constraint/.test(c);
t('migration : unique (site, date) devient unique (site, date, type), gardée par pg_constraint', () => { assert.ok(regleUnicite(mUnicite)); });
garde('migration : la nouvelle unicité porte le type', mUnicite, regleUnicite, 'unique (site, date, type)', 'unique (site, date)');

// --- 2. Académie ---
const regleAcademie = c => /add column[^;]*academie_scolaire text/.test(c) && /station_config_academie_scolaire_check/.test(c) && /'Martinique'/.test(c) && /where site = 'vito-sainte-marie'/.test(c);
t('migration : academie_scolaire texte, liste fermée, Martinique pour vito-sainte-marie', () => { assert.ok(regleAcademie(mAcademie)); });
t('migration : la liste fermée reprend les 36 académies de la source', () => {
  assert.strictEqual(C.ACADEMIES.length, 36);
  C.ACADEMIES.forEach(a => assert.ok(mAcademie.indexOf("'" + a + "'") >= 0, 'académie absente : ' + a));
});
garde('migration : la valeur ne s\'écrase pas', mAcademie, c => /where site = 'vito-sainte-marie' and academie_scolaire is null;/.test(c), 'and academie_scolaire is null;', 'and true;');

// --- 3. Fériés ---
t('Pâques 2026 à 2030 contre une référence', () => {
  const ref = { 2026: '2026-04-05', 2027: '2027-03-28', 2028: '2028-04-16', 2029: '2029-04-01', 2030: '2030-04-21' };
  Object.keys(ref).forEach(a => assert.strictEqual(new Date(C.paquesUTC(+a)).toISOString().slice(0, 10), ref[a]));
});
t('14 fériés par an, 2026 à 2030, dates distinctes et triées', () => {
  for (let a = 2026; a <= 2030; a++) {
    const l = C.feriesSite(a);
    assert.strictEqual(l.length, 14);
    assert.strictEqual(new Set(l.map(x => x.date)).size, 14);
    assert.deepStrictEqual(l.map(x => x.date), l.map(x => x.date).slice().sort());
    l.forEach(x => assert.ok(x.libelle && x.date.startsWith(String(a))));
  }
});
t('2026 : Vendredi saint, Lundi de Pâques, Ascension, Pentecôte, Victor Schœlcher', () => {
  const m = {}; C.feriesSite(2026).forEach(x => { m[x.libelle] = x.date; });
  assert.strictEqual(m['Vendredi saint'], '2026-04-03');
  assert.strictEqual(m['Lundi de Pâques'], '2026-04-06');
  assert.strictEqual(m['Ascension'], '2026-05-14');
  assert.strictEqual(m['Lundi de Pentecôte'], '2026-05-25');
  assert.strictEqual(m['Victor Schœlcher'], '2026-07-21');
});
t('la migration des fériés 2026-2027 = le calcul partagé (28 lignes, type ferie)', () => {
  [2026, 2027].forEach(a => C.feriesSite(a).forEach(j => assert.ok(mFeries.indexOf("'" + j.date + "', 'ferie', '" + j.libelle.replace(/'/g, "''") + "'") >= 0, 'manque ' + j.date)));
  assert.strictEqual((mFeries.match(/'ferie'/g) || []).length, 28);
  assert.ok(!/created_by/.test(mFeries));
});
const regleIdem = c => /on conflict \(site, date, type\) do nothing;/.test(c) && /exists \(select 1 from public\.sites where site_id = 'vito-sainte-marie'\)/.test(c);
t('idempotence : chaque migration de données ignore les doublons et attend le site', () => { assert.ok(regleIdem(mFeries) && regleIdem(mVacances)); });
garde('idempotence : fériés', mFeries, regleIdem, 'do nothing;', 'do update set libelle = excluded.libelle;');
t('sqlInsertCalendrier : vide si aucune ligne, doublon ignoré sinon', () => {
  assert.strictEqual(C.sqlInsertCalendrier('s', []), '');
  assert.ok(/on conflict \(site, date, type\) do nothing;$/.test(C.sqlInsertCalendrier('s', [{ date: '2026-01-01', type: 'ferie', libelle: "L'an" }])));
  assert.ok(C.sqlInsertCalendrier('s', [{ date: '2026-01-01', type: 'ferie', libelle: "L'an" }]).indexOf("'L''an'") > 0);
});

// --- 4. Source et filtre d'académie ---
const SRC = [
  { location: 'Martinique', population: '-', description: 'Vacances de Noël', start_date: '2026-12-18T23:00:00+00:00', end_date: '2027-01-03T23:00:00+00:00' },
  { location: 'Martinique', population: 'Enseignants', description: 'Pré-rentrée', start_date: '2026-08-24T04:00:00+00:00', end_date: '2026-08-25T04:00:00+00:00' },
  { location: 'Guadeloupe', population: '-', description: 'Vacances de Noël', start_date: '2026-12-18T23:00:00+00:00', end_date: '2027-01-03T23:00:00+00:00' },
  { location: 'Martinique', population: 'Élèves', description: 'Grandes vacances', start_date: '2027-07-02T04:00:00+00:00', end_date: null },
  { location: 'Martinique', population: '-', description: 'Vacances de Noël', start_date: '2026-12-18T23:00:00+00:00', end_date: '2027-01-03T23:00:00+00:00' }
];
t('source : dates Paris, fin inclusive, doublon fusionné, autre académie et Enseignants exclus', () => {
  const p = C.periodesDepuisSource(SRC, 'Martinique');
  assert.deepStrictEqual(p, [{ libelle: 'Vacances de Noël', debut: '2026-12-19', fin: '2027-01-04' }]);
});
t('source : une période sans fin publiée n\'est jamais inscrite', () => {
  assert.ok(!C.periodesDepuisSource(SRC, 'Martinique').some(p => p.libelle === 'Grandes vacances'));
  assert.ok(!/2027-07-0[2-9]/.test(mVacances) || !/Grandes vacances \(été 2027\)/.test(mVacances));
});
t('source : une fin avant le début est ignorée', () => {
  assert.deepStrictEqual(C.periodesDepuisSource([{ location: 'X', description: 'a', start_date: '2026-05-02T00:00:00+00:00', end_date: '2026-05-01T00:00:00+00:00' }], 'X'), []);
});
t('jours des périodes : une ligne par jour, début et fin inclus, type vacances', () => {
  const l = C.joursDesPeriodes([{ libelle: 'V', debut: '2026-12-30', fin: '2027-01-02' }]);
  assert.deepStrictEqual(l.map(x => x.date), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.ok(l.every(x => x.type === 'vacances' && x.libelle === 'V'));
});
t('fenêtre : seules les périodes qui la touchent', () => {
  const ps = [{ libelle: 'a', debut: '2025-01-01', fin: '2025-01-05' }, { libelle: 'b', debut: '2026-12-30', fin: '2027-01-05' }];
  assert.deepStrictEqual(C.periodesDansFenetre(ps, '2026-01-01', '2027-12-31').map(p => p.libelle), ['b']);
});
t('migration des vacances : 181 lignes type vacances, bornes 2025-12-20 et 2027-05-10, source citée', () => {
  assert.strictEqual((mVacances.match(/'vacances'/g) || []).length, 181);
  assert.ok(mVacances.indexOf("'2025-12-20', 'vacances'") > 0 && mVacances.indexOf("'2027-05-10', 'vacances'") > 0);
  assert.ok(/data\.education\.gouv\.fr/.test(mVacances) && /2026-11-10/.test(mVacances));
  assert.ok(!/created_by/.test(mVacances));
});
t('migration des vacances = la source figée du 10/11/2026 (aucune date estimée)', () => {
  const rec = JSON.parse(lire('cal_mq_fixture.json')).results;
  const attendu = C.joursDesPeriodes(C.periodesDansFenetre(C.periodesDepuisSource(rec, 'Martinique'), '2026-01-01', '2027-12-31'));
  assert.strictEqual(attendu.length, 181);
  attendu.forEach(l => assert.ok(mVacances.indexOf("'" + l.date + "', 'vacances', '" + l.libelle.replace(/'/g, "''") + "'") >= 0, 'manque ' + l.date));
});

// --- 5. Lecteurs multi-types ---
const DON = lire('nexus-inventaire-production-donnees.js');
const regleLecture = c => /from\('inventaire_calendrier_site'\)\.select\('\*'\)\.eq\('site', site\)\.eq\('date', dateISO\),/.test(c) && /find\(l => l && l\.type === 'ferie'\) \|\| lignesJour\[0\]/.test(c);
t('Inventaire : lit toutes les lignes du jour, le férié l\'emporte', () => { assert.ok(regleLecture(DON)); });
garde('Inventaire : pas de maybeSingle sur le calendrier', DON, regleLecture, "eq('date', dateISO),\n    ]);", "eq('date', dateISO).maybeSingle(),\n    ]);");
garde('Inventaire : le férié passe avant les vacances', DON, regleLecture, "l.type === 'ferie'", "l.type === 'vacances'");
t('Inventaire : Tempo ne sert que si la table est muette', () => { assert.ok(/!jourCalendrierEffectif && global\.NexusTempo/.test(DON)); });
t('aucun lecteur ne suppose encore une seule ligne par jour', () => {
  ['NEXUS-Parametres-Inventaire-v1.html', 'nexus-carburant-commande-donnees-core.js', 'nexus-inventaire-production-donnees.js'].forEach(f => {
    assert.ok(!/inventaire_calendrier_site'\)[^;]{0,200}maybeSingle/.test(lire(f).replace(/\n/g, ' ')), f);
  });
  assert.ok(/select\('date'\)\.eq\('site', siteId\)\.eq\('type', 'ferie'\)/.test(lire('nexus-carburant-commande-donnees-core.js')));
});
const PAR = lire('NEXUS-Parametres-Inventaire-v1.html');
t('Paramètres Inventaire : tri date puis type, doublon (23505) expliqué par le type', () => {
  assert.ok(/\.order\('date'\)\.order\('type'\)/.test(PAR));
  assert.ok(/même type/.test(PAR));
});

// --- 6. Station ---
const STA = lire('NEXUS-Parametres-Station-v1.html');
const regleCarte = c => /src="nexus-calendrier-site\.js/.test(c) && /<select id="academieScolaire"/.test(c) && /from\('station_config'\)\.upsert\(\s*\{ site: employee\.site_id, academie_scolaire: v/.test(c) && /sel\.dataset\.avant = v;/.test(c);
t('Station : carte académie (liste de la source, upsert, retour arrière)', () => { assert.ok(regleCarte(STA)); });
garde('Station : liste fermée chargée depuis le module', STA, regleCarte, 'src="nexus-calendrier-site.js', 'src="nexus-autre.js');
garde('Station : la valeur précédente est mémorisée', STA, regleCarte, 'sel.dataset.avant = v;', '');
t('Station : texte et accessibilité (étiquette liée, cible 44 px)', () => {
  assert.ok(/<label[^>]*for="academieScolaire"/.test(STA) && /min-height:44px/.test(STA.split('id="academieScolaire"')[1].slice(0, 200)));
});

// --- 7. Tempo lit la table ---
const TEM = lire('nexus-tempo.js');
function tempo(lignes) {
  const w = { NexusJoursFeries: require('./nexus-jours-feries.js') };
  const g = { window: w, NexusJoursFeries: w.NexusJoursFeries, console };
  vm.runInNewContext(TEM, g);
  const T = g.window.NexusTempo || g.NexusTempo;
  if (lignes) T.definirVacances(lignes);
  return T;
}
t('Tempo : sans injection, la liste figée sert de repli', () => {
  const T = tempo();
  assert.strictEqual(T.estVacancesScolaires('2026-12-25').vacances, true);
  assert.strictEqual(T.definirVacances([]), 0);
  assert.strictEqual(T.estVacancesScolaires('2026-12-25').vacances, true);
});
t('Tempo : la table fait foi dès qu\'elle est injectée', () => {
  const T = tempo([{ date: '2026-12-25', type: 'vacances', libelle: 'Noël' }, { date: '2026-12-26', type: 'ferie', libelle: 'x' }]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.estVacancesScolaires('2026-12-25'))), { vacances: true, nom: 'Noël' });
  assert.strictEqual(T.estVacancesScolaires('2026-12-26').vacances, false);
  assert.strictEqual(T.estVacancesScolaires('2026-10-30').vacances, false);
});
// Équivalence 2025-2027 : la table reprend la liste figée, hormis les écarts documentés (source officielle).
const ECARTS = {
  // jours que la liste figée de Tempo déclare en vacances et que la source ne publie pas
  tempoSeul: ['2027-04-20..2027-05-03', '2027-07-03..2027-12-31'],
  // jours que la source publie et que la liste figée ne couvre pas (ponts de l'Ascension)
  sourceSeule: ['2026-05-14..2026-05-18', '2026-09-01', '2027-05-06..2027-05-10']
};
function jours(du, au) { const r = []; for (let d = Date.UTC(+du.slice(0, 4), +du.slice(5, 7) - 1, +du.slice(8)); d <= Date.UTC(+au.slice(0, 4), +au.slice(5, 7) - 1, +au.slice(8)); d += 86400000) r.push(new Date(d).toISOString().slice(0, 10)); return r; }
function etendre(l) { return l.reduce((a, s) => a.concat(s.indexOf('..') > 0 ? jours(s.split('..')[0], s.split('..')[1]) : [s]), []); }
t('Tempo : équivalence 2026-2027 avec la liste figée, écarts documentés', () => {
  const lignes = []; const re = /\('vito-sainte-marie', '(\d{4}-\d{2}-\d{2})', 'vacances', '((?:[^']|'')*)'\)/g; let m;
  while ((m = re.exec(mVacances))) lignes.push({ date: m[1], type: 'vacances', libelle: m[2].replace(/''/g, "'") });
  assert.strictEqual(lignes.length, 181);
  const fige = tempo(), table = tempo(lignes);
  const tempoSeul = new Set(etendre(ECARTS.tempoSeul)), sourceSeule = new Set(etendre(ECARTS.sourceSeule));
  jours('2026-01-01', '2027-12-31').forEach(d => {
    const a = fige.estVacancesScolaires(d).vacances, b = table.estVacancesScolaires(d).vacances;
    if (a === b) return;
    if (a && !b) assert.ok(tempoSeul.has(d), 'écart non documenté (liste figée seule) : ' + d);
    else assert.ok(sourceSeule.has(d), 'écart non documenté (table seule) : ' + d);
  });
});
const HT = lire('NEXUS-Tempo-v1.html');
t('page Tempo : charge les vacances de la table, repli sur la liste figée si la lecture échoue', () => {
  assert.ok(/from\('inventaire_calendrier_site'\)/.test(HT) && /definirVacances\(/.test(HT) && /eq\('type', ?'vacances'\)/.test(HT));
});

// --- 8. Workflows silencieux ---
const WF = { feries: lire('.github/workflows/calendrier-feries.yml'), vacances: lire('.github/workflows/calendrier-vacances.yml') };
Object.keys(WF).forEach(k => {
  const w = WF[k];
  t('workflow ' + k + ' : cron, PR depuis production, [Vigie] sur #160, silencieux si rien à faire', () => {
    assert.ok(k === 'feries' ? /cron: '0 10 1 1 \*'/.test(w) : /cron: '0 10 1 \* \*'/.test(w));
    assert.ok(/ref: production/.test(w) && /gh pr create --base production/.test(w));
    assert.ok(/if: steps\.calcul\.outputs\.fichier != ''/.test(w), 'étape PR/commentaire non conditionnée');
    assert.ok(/gh issue comment 160 --body "\[Vigie\] À Claude et Guardian/.test(w));
  });
  t('workflow ' + k + ' : aucune mention de robot, aucune notification à Frédéric, aucune base jointe', () => {
    assert.ok(!/@claude/i.test(w) && !/@fredericbragance|@fred/i.test(w), 'mention interdite');
    assert.ok(!/SUPABASE|psql|apply_migration/i.test(w), 'accès base');
    assert.ok(!/--reviewer|--assignee/.test(w));
  });
  t('workflow ' + k + ' : actions épinglées par SHA, même calcul que l\'épreuve', () => {
    assert.ok(/actions\/checkout@[0-9a-f]{40}/.test(w) && /actions\/setup-node@[0-9a-f]{40}/.test(w));
    assert.ok(/outils\/calendrier-site-cli\.js (feries|vacances)/.test(w));
  });
});
garde('workflow fériés : étape conditionnelle', WF.feries, c => /if: steps\.calcul\.outputs\.fichier != ''/.test(c), "if: steps.calcul.outputs.fichier != ''", 'if: always()');
const CLI = lire('outils/calendrier-site-cli.js');
t('CLI : une seule source de calcul, aucune connexion à une base, silencieux si rien de neuf', () => {
  assert.ok(/require\('\.\.\/nexus-calendrier-site\.js'\)/.test(CLI));
  assert.ok(!/createClient|supabase-js|SUPABASE_|https?:\/\/[^'"]*supabase/i.test(CLI.replace(/\/\/.*$/gm, '')));
  assert.ok(/déjà présents/.test(CLI) && /aucune période nouvelle/.test(CLI));
});
t('CLI : fériés déjà migrés = aucun fichier, aucune sortie de PR', () => {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [path.join(__dirname, 'outils/calendrier-site-cli.js'), 'feries', '2027'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(JSON.parse(r.stdout).fichier, null);
});
console.log(n + ' épreuves OK');
