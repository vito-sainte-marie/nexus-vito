#!/usr/bin/env node
// « NULL ne veut jamais dire à l'heure » — les consommateurs, 19/09/2026.
//
// Compagnon de test_retard_horaire_planifie_20260919.js, qui juge la
// PRODUCTION de `retard_min` (mandat 33, arbitrage b1). Celui-ci juge sa
// CONSOMMATION, et c'est le côté par lequel une erreur devient invisible :
// rendre la colonne nullable ne protège de rien si sept écrans relisent un
// NULL comme un zéro. Le danger n'est pas théorique — jusqu'au 19/09/2026,
// `chargerDomainesRadarHome` comptait TOUTES les arrivées au dénominateur du
// taux d'anomalies alors que son numérateur (`.gt('retard_min', 0)`) écartait
// déjà les NULL : chaque journée sans planning publié aurait donc AMÉLIORÉ la
// note de ponctualité de l'équipe. Une bonne note fabriquée par l'absence de
// mesure est pire qu'une mauvaise note : personne ne va vérifier un chiffre
// qui rassure.
//
// La règle jugée ici, une seule, déclinée partout : un pointage dont le
// retard n'est pas calculable sort des DEUX côtés de toute fraction de
// ponctualité. Il ne compte ni comme retard, ni comme preuve d'assiduité, ni
// comme journée mesurée — mais il reste une PRÉSENCE (l'employé est bien
// venu : la journée reste prouvée, le collaborateur reste actif).
//
// Les §1 à §3 jugent des COMPORTEMENTS, jamais la présence d'un mot dans le
// source : un faux client PostgREST applique réellement les filtres (y
// compris la sémantique SQL de `.gt`, qui écarte les NULL) et les fonctions
// rendent leurs vrais chiffres. Le §4 seul est une garde textuelle, et elle
// ne garde qu'une chose qu'aucun comportement ne peut attraper : l'idiome
// `retard_min || 0`, qui fabrique un zéro avant que le moindre calcul
// commence.
//
// Éprouvé par mutation le 19/09/2026 : 13 mutations, 11 tuées. Les deux
// survivantes sont la même, et elles sont ÉQUIVALENTES — supprimer le garde
// `if (!Number.isFinite(p.retard_min)) return;` de nexus-paye-moteur.js ne
// change aucune sortie, parce que `retard > 0` écarte déjà un NULL et que
// `retardParJour` n'est relue que par un `if (retard)` qui traite 0 comme
// absent. Ce fichier ne prétend donc pas garder cette ligne-là ; il garde ce
// qu'elle documente, vérifié par la mutation qui remonte le garde au-dessus
// de `preuveJour.set` (tuée) et par celle qui fabrique une minute de retard
// depuis un NULL (tuée).

'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
let passes = 0;
let echecs = 0;
function t(nom, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passes++; console.log(`  ✓ ${nom}`); })
    .catch(e => { echecs++; process.exitCode = 1; console.error(`  ✗ ${nom}\n    ${e && e.message}`); });
}

// ── Les modules, chargés tels que le navigateur les charge ────────────────

const g = {};
new Function('window', fs.readFileSync(path.join(RACINE, 'nexus-progression.js'), 'utf8'))(g);
const P = g.NexusProgression;

const gRd = {};
new Function('window', fs.readFileSync(path.join(RACINE, 'nexus-rapport-direction-donnees.js'), 'utf8'))(gRd);
const RD = gRd.NexusRapportDirectionDonnees;

// Ces trois-là se terminent par `})(typeof window !== 'undefined' ? window :
// globalThis)` : l'idiome du dépôt (test_app_donnees_carburants_anti_
// divergence_v2224.js) est de leur donner `global` pour fenêtre.
global.window = global;
require(path.join(RACINE, 'nexus-app-donnees.js'));
require(path.join(RACINE, 'nexus-brief-donnees.js'));
require(path.join(RACINE, 'nexus-risques-donnees.js'));
const AD = global.NexusAppDonnees;
const BD = global.NexusBriefDonnees;
const RID = global.NexusRisquesDonnees;
const PAYE = require(path.join(RACINE, 'nexus-paye-moteur.js')) && global.NexusPayeMoteur;

// ── Un faux PostgREST qui filtre POUR DE VRAI ─────────────────────────────
//
// Reproduire les filtres au lieu de les inspecter est ce qui rend ce fichier
// capable d'attraper une régression : si quelqu'un retire
// `.not('retard_min', 'is', null)` d'un dénominateur, aucun mot ne manque
// nulle part — c'est le CHIFFRE qui change. La seule subtilité reproduite
// fidèlement est la sémantique SQL : un NULL ne satisfait jamais une
// comparaison, donc `.gt('retard_min', 0)` l'écarte déjà de lui-même. C'est
// précisément ce qui rendait l'asymétrie numérateur/dénominateur si discrète.

function estNul(v) { return v === null || v === undefined; }

function faireClient(tables) {
  const journal = [];
  function from(table) {
    const trace = { table, colonnes: null, options: null, filtres: [] };
    journal.push(trace);
    const predicats = [];
    const b = {
      select(colonnes, options) { trace.colonnes = colonnes; trace.options = options || null; return b; },
      eq(c, v) { trace.filtres.push(`eq(${c},${v})`); predicats.push(l => l[c] === v); return b; },
      gt(c, v) { trace.filtres.push(`gt(${c},${v})`); predicats.push(l => !estNul(l[c]) && l[c] > v); return b; },
      gte(c, v) { trace.filtres.push(`gte(${c},${v})`); predicats.push(l => !estNul(l[c]) && l[c] >= v); return b; },
      lte(c, v) { trace.filtres.push(`lte(${c},${v})`); predicats.push(l => !estNul(l[c]) && l[c] <= v); return b; },
      in(c, vs) { trace.filtres.push(`in(${c})`); predicats.push(l => vs.indexOf(l[c]) !== -1); return b; },
      not(c, op, v) {
        trace.filtres.push(`not(${c},${op},${v})`);
        assert.strictEqual(op, 'is', `not() avec l'opérateur ${op} : non reproduit par ce faux client`);
        assert.strictEqual(v, null, 'not(..., is, ...) avec autre chose que null : non reproduit');
        predicats.push(l => !estNul(l[c]));
        return b;
      },
      order() { return b; },
      limit() { return b; },
      range() { return b; },
      then(resoudre, rejeter) {
        const lignes = (tables[table] || []).filter(l => predicats.every(p => p(l)));
        const options = trace.options || {};
        const reponse = options.head
          ? { data: null, count: lignes.length, error: null }
          : { data: lignes, count: options.count ? lignes.length : null, error: null };
        return Promise.resolve(reponse).then(resoudre, rejeter);
      },
    };
    return b;
  }
  return { journal, client: { from } };
}

const AUJOURDHUI = new Date().toISOString().slice(0, 10);

// ── 1 · Ma Progression : un score qui ne se gagne pas par l'absence ───────

console.log('\n── 1 · statutPonctualite / calculerSeriePonctualite ──');

// Cinq journées réellement mesurées (le seuil d'échantillon), plus des
// journées non calculables en nombre.
const CINQ_MESUREES = [
  { date: '2026-09-01', retard_min: 0 },
  { date: '2026-09-02', retard_min: 0 },
  { date: '2026-09-03', retard_min: 12 },
  { date: '2026-09-04', retard_min: 0 },
  { date: '2026-09-05', retard_min: 0 },
];
const NULLS = [
  { date: '2026-09-06', retard_min: null },
  { date: '2026-09-07', retard_min: null },
  { date: '2026-09-08', retard_min: null },
];

const p1 = [
  t('le score de ponctualité ignore les journées non calculables', () => {
    const sans = P.statutPonctualite(CINQ_MESUREES);
    const avec = P.statutPonctualite(CINQ_MESUREES.concat(NULLS));
    assert.strictEqual(avec.score, sans.score,
      'ajouter des journées non mesurées a bougé le score : NULL est relu comme un fait');
    assert.strictEqual(avec.total, 5,
      `total = ${avec.total} : les NULL comptent encore au dénominateur`);
    assert.strictEqual(avec.nbRetards, 1);
    assert.strictEqual(avec.detail, '1 retard(s) sur 5 pointage(s)');
  }),
  t('des NULL ne complètent pas un échantillon insuffisant', () => {
    const r = P.statutPonctualite([
      { date: '2026-09-01', retard_min: 0 },
      { date: '2026-09-02', retard_min: null },
      { date: '2026-09-03', retard_min: null },
      { date: '2026-09-04', retard_min: null },
      { date: '2026-09-05', retard_min: null },
      { date: '2026-09-06', retard_min: null },
    ]);
    assert.strictEqual(r.statut, 'Données insuffisantes',
      'une seule journée mesurée suffirait à prononcer un statut : le seuil est fabriqué par les NULL');
    assert.strictEqual(r.detail, null);
  }),
  t('un seul retard mesuré reste un retard, NULL ou pas autour', () => {
    const r = P.statutPonctualite([
      { date: '2026-09-01', retard_min: 45 },
      { date: '2026-09-02', retard_min: 0 },
      { date: '2026-09-03', retard_min: 0 },
      { date: '2026-09-04', retard_min: 0 },
      { date: '2026-09-05', retard_min: 0 },
      { date: '2026-09-06', retard_min: null },
    ]);
    assert.strictEqual(r.score, 55);
    assert.strictEqual(r.statut, 'À corriger',
      'le retard a été dilué : un NULL ne doit jamais adoucir une mesure');
  }),
  t('la série de ponctualité n\'est ni prolongée ni rompue par un NULL', () => {
    // Trois jours à l'heure, une journée non calculable, deux jours à
    // l'heure. Compter le NULL comme ponctuel décernerait une série de 6
    // jamais constatée ; le compter comme retard casserait une série que
    // rien ne contredit. Il n'existe pas pour cette mesure : 5.
    const serie = P.calculerSeriePonctualite([
      { date: '2026-09-01', retard_min: 0 },
      { date: '2026-09-02', retard_min: 0 },
      { date: '2026-09-03', retard_min: 0 },
      { date: '2026-09-04', retard_min: null },
      { date: '2026-09-05', retard_min: 0 },
      { date: '2026-09-06', retard_min: 0 },
    ]);
    assert.strictEqual(serie.record, 5, `record = ${serie.record} : un NULL a compté comme une journée`);
    assert.strictEqual(serie.enCours, 5);
    assert.strictEqual(serie.total, 5, `total = ${serie.total} : les NULL entrent encore dans la série`);
  }),
  t('un vrai retard rompt toujours la série', () => {
    const serie = P.calculerSeriePonctualite([
      { date: '2026-09-01', retard_min: 0 },
      { date: '2026-09-02', retard_min: 7 },
      { date: '2026-09-03', retard_min: null },
      { date: '2026-09-04', retard_min: 0 },
    ]);
    assert.strictEqual(serie.record, 1);
    assert.strictEqual(serie.enCours, 1, 'le NULL a recollé la série par-dessus un retard constaté');
    assert.strictEqual(serie.total, 3);
  }),
  t('un 0 reste un 0 : la correction n\'a pas emporté les mesures', () => {
    const serie = P.calculerSeriePonctualite([
      { date: '2026-09-01', retard_min: 0 },
      { date: '2026-09-02', retard_min: 0 },
    ]);
    assert.strictEqual(serie.record, 2);
    assert.strictEqual(serie.total, 2);
  }),
];

// ── 2 · Paye : ni retard retenu, ni preuve de ponctualité ────────────────

console.log('\n── 2 · nexus-paye-moteur : la journée reste prouvée, le retard non ──');

const EMPLOYES_PAYE = [{ id: 'e1', nom: 'Salarié', role: 'pompiste', actif: true }];
const SETTINGS_PAYE = [{ employee_id: 'e1', inclus_paye: true, mode_presence: 'automatique' }];
function rapportPaye(overrides) {
  return PAYE.construireRapport(Object.assign({
    periode: '2026-09-01', employees: EMPLOYES_PAYE, settings: SETTINGS_PAYE,
    planning: [], pointages: [], indisponibilites: [], audits: [], items: [], ecarts: [],
    config: {
      jours_heure_supp: [4, 5, 6], minutes_heure_supp: 60,
      activites_heure_supp: ['piste', 'boutique'], quart_exclu_heure_supp: 'renfort',
      retard_max_coherent_min: 180, jours_feries: [],
    },
  }, overrides || {}));
}
const SHIFT_LUNDI = { employee_id: 'e1', date: '2026-09-07', quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache: 'piste' };

const p2 = [
  t('un retard non calculable ne produit aucun item de retard', () => {
    const r = rapportPaye({
      planning: [SHIFT_LUNDI],
      pointages: [{ employee_id: 'e1', date: '2026-09-07', type: 'arrivee', retard_min: null }],
    });
    assert.ok(!r.items.some(i => i.typeItem === 'retard' || i.typeItem === 'retard_incoherent'),
      'un retard a été porté au dossier de paye alors qu\'il n\'a jamais été mesuré');
  }),
  t('la journée reste prouvée par le pointage, retard ou pas', () => {
    const r = rapportPaye({
      planning: [SHIFT_LUNDI],
      pointages: [{ employee_id: 'e1', date: '2026-09-07', type: 'arrivee', retard_min: null }],
    });
    assert.strictEqual(r.employes[0].heuresConfirmees, 7,
      'la présence a disparu avec le retard : un retard non calculable n\'est pas une absence');
    assert.ok(!r.items.some(i => i.typeItem === 'absence_a_verifier'),
      'la journée est remontée en absence à vérifier alors que l\'employé a pointé');
  }),
  t('un retard mesuré est toujours porté au dossier', () => {
    const r = rapportPaye({
      planning: [SHIFT_LUNDI],
      pointages: [{ employee_id: 'e1', date: '2026-09-07', type: 'arrivee', retard_min: 23 }],
    });
    const item = r.items.find(i => i.typeItem === 'retard');
    assert.ok(item, 'le retard mesuré ne remonte plus : la correction a trop pris');
    assert.strictEqual(item.quantiteMinutes, 23);
  }),
  t('un 0 mesuré ne produit pas d\'item — et n\'en produisait pas davantage avant', () => {
    const r = rapportPaye({
      planning: [SHIFT_LUNDI],
      pointages: [{ employee_id: 'e1', date: '2026-09-07', type: 'arrivee', retard_min: 0 }],
    });
    assert.strictEqual(r.items.length, 0);
    assert.strictEqual(r.employes[0].heuresConfirmees, 7);
  }),
];

// ── 3 · Les dénominateurs : ce que voient réellement les écrans ──────────

console.log('\n── 3 · dénominateurs PostgREST : seules les arrivées mesurées ──');

// Dix arrivées : 2 retards mesurés, 2 ponctualités mesurées, 6 journées non
// calculables. Le taux d'anomalies VRAI est 2/4 = 0,5. Compter les NULL au
// dénominateur donnerait 2/10 = 0,2 — deux fois et demie plus flatteur, sans
// qu'aucune minute de retard ait disparu.
const DIX_ARRIVEES = [
  { id: 1, employee_id: 'e1', type: 'arrivee', site: 'site-a', date: AUJOURDHUI, retard_min: 10, employees: { nom: 'Alice' } },
  { id: 2, employee_id: 'e2', type: 'arrivee', site: 'site-a', date: AUJOURDHUI, retard_min: 20, employees: { nom: 'Bob' } },
  { id: 3, employee_id: 'e1', type: 'arrivee', site: 'site-a', date: AUJOURDHUI, retard_min: 0, employees: { nom: 'Alice' } },
  { id: 4, employee_id: 'e2', type: 'arrivee', site: 'site-a', date: AUJOURDHUI, retard_min: 0, employees: { nom: 'Bob' } },
].concat([5, 6, 7, 8, 9, 10].map(id => ({
  id, employee_id: id % 2 ? 'e1' : 'e2', type: 'arrivee', site: 'site-a',
  date: AUJOURDHUI, retard_min: null, employees: { nom: id % 2 ? 'Alice' : 'Bob' },
})));

const p3 = [
  t('accueil (chargerDomainesRadarHome) : taux d\'anomalies sur les mesurées', async () => {
    const { client } = faireClient({ pointages: DIX_ARRIVEES, mission_completions: [] });
    const r = await AD.chargerDomainesRadarHome(client);
    assert.strictEqual(r.totalPointages, 4,
      `totalPointages = ${r.totalPointages} : les journées non calculables gonflent encore le dénominateur`);
    assert.strictEqual(r.nbRetards, 2);
    assert.strictEqual(r.tauxAnomalies, 0.5,
      `taux = ${r.tauxAnomalies} au lieu de 0,5 : l'absence de mesure améliore la note`);
    assert.strictEqual(r.equipeScore, 0);
  }),
  t('brief (chargerDomaineEquipe) : les DEUX fenêtres comptent les mesurées', async () => {
    // Fenêtre courante 13→19/09, fenêtre précédente 06→12/09.
    const lignes = [
      { id: 1, employee_id: 'e1', type: 'arrivee', date: '2026-09-15', retard_min: 30 },
      { id: 2, employee_id: 'e2', type: 'arrivee', date: '2026-09-16', retard_min: 15 },
      { id: 3, employee_id: 'e1', type: 'arrivee', date: '2026-09-17', retard_min: 0 },
      { id: 4, employee_id: 'e2', type: 'arrivee', date: '2026-09-18', retard_min: 0 },
      { id: 5, employee_id: 'e1', type: 'arrivee', date: '2026-09-14', retard_min: null },
      { id: 6, employee_id: 'e2', type: 'arrivee', date: '2026-09-14', retard_min: null },
      { id: 7, employee_id: 'e1', type: 'arrivee', date: '2026-09-13', retard_min: null },
      { id: 8, employee_id: 'e1', type: 'arrivee', date: '2026-09-09', retard_min: 40 },
      { id: 9, employee_id: 'e2', type: 'arrivee', date: '2026-09-10', retard_min: 0 },
      { id: 10, employee_id: 'e1', type: 'arrivee', date: '2026-09-11', retard_min: null },
      { id: 11, employee_id: 'e2', type: 'arrivee', date: '2026-09-12', retard_min: null },
    ];
    const { client } = faireClient({ pointages: lignes });
    const r = await BD.chargerDomaineEquipe(client, '2026-09-19');
    assert.strictEqual(r.totalPointages, 4,
      `fenêtre courante : ${r.totalPointages} au dénominateur au lieu de 4`);
    assert.strictEqual(r.totalAnomalies, 2);
    assert.strictEqual(r.tauxAnomalies, 0.5);
    assert.strictEqual(r.totalPointagesPeriodePrecedente, 2,
      `fenêtre précédente : ${r.totalPointagesPeriodePrecedente} au dénominateur au lieu de 2`);
    assert.strictEqual(r.totalAnomaliesPeriodePrecedente, 1);
    assert.strictEqual(r.tauxAnomaliesPeriodePrecedente, 0.5,
      'la comparaison d\'une fenêtre à l\'autre repose sur deux dénominateurs différents');
  }),
  t('risques : la taille d\'échantillon par collaborateur ne compte que les mesurées', async () => {
    const { client } = faireClient({ pointages: DIX_ARRIVEES });
    const r = await RID.chargerPonctualiteCollaborateursAQualifier(client, 'site-a', 14);
    assert.strictEqual(r.e1.totalPointages, 2,
      `e1 : ${r.e1.totalPointages} pointages au dénominateur au lieu de 2 — un signal serait qualifié sur du vent`);
    assert.strictEqual(r.e1.nbRetards, 1);
    assert.strictEqual(r.e2.totalPointages, 2);
    assert.strictEqual(r.e2.nbRetards, 1);
  }),
  t('rapport de direction : taux de ponctualité sur les mesurées', async () => {
    const { client } = faireClient({ pointages: DIX_ARRIVEES, mission_assignments: [] });
    const r = await RD.chargerEquipePeriode(client, 'site-a', { debut: AUJOURDHUI, fin: AUJOURDHUI });
    assert.strictEqual(r.nbPointages, 4,
      `nbPointages = ${r.nbPointages} : le couple publié au PDF repose sur un dénominateur non mesuré`);
    assert.strictEqual(r.nbRetards, 2);
    assert.strictEqual(r.tauxPonctualite, 0.5,
      `taux = ${r.tauxPonctualite} : l'axe de formation (< 0,85) ne se déclencherait plus`);
  }),
  t('rapport de direction : la PRÉSENCE, elle, compte toutes les arrivées', async () => {
    // Le point le plus facile à casser en corrigeant : un retard non
    // calculable reste un employé venu travailler. Le bloc doit rester
    // disponible et les collaborateurs actifs se compter sur les arrivées.
    const { client } = faireClient({ pointages: DIX_ARRIVEES, mission_assignments: [] });
    const r = await RD.chargerEquipePeriode(client, 'site-a', { debut: AUJOURDHUI, fin: AUJOURDHUI });
    assert.strictEqual(r.collaborateursActifs, 2);
    assert.strictEqual(r.disponible, true);
  }),
  t('rapport de direction : que des NULL = aucun taux, pas un 100 %', async () => {
    const nulles = DIX_ARRIVEES.filter(l => l.retard_min === null);
    const { client } = faireClient({ pointages: nulles, mission_assignments: [] });
    const r = await RD.chargerEquipePeriode(client, 'site-a', { debut: AUJOURDHUI, fin: AUJOURDHUI });
    assert.strictEqual(r.nbPointages, 0);
    assert.strictEqual(r.tauxPonctualite, null,
      'une période entièrement non mesurée est annoncée comme ponctuelle');
    assert.strictEqual(r.disponible, true, 'les arrivées ont disparu avec les retards');
  }),
  t('le faux client reproduit bien la sémantique SQL de .gt sur un NULL', async () => {
    // Garde de la garde : si `.gt` laissait passer les NULL, tous les tests
    // ci-dessus deviendraient vides de sens sans jamais rougir.
    const { client } = faireClient({ pointages: DIX_ARRIVEES });
    const { data } = await client.from('pointages').select('id').gt('retard_min', 0);
    assert.strictEqual(data.length, 2);
  }),
];

// ── 4 · Garde de dépôt : l'idiome qui fabrique un zéro ───────────────────

console.log('\n── 4 · aucun `retard_min || 0` nulle part dans le dépôt ──');

function fichiersSurveilles(dossier, acc) {
  acc = acc || [];
  fs.readdirSync(dossier, { withFileTypes: true }).forEach(e => {
    if (e.name.startsWith('.') || e.name === 'node_modules') return;
    const complet = path.join(dossier, e.name);
    if (e.isDirectory()) { fichiersSurveilles(complet, acc); return; }
    if (/\.(js|html)$/.test(e.name)) acc.push(complet);
  });
  return acc;
}

const p4 = [
  t('aucun fichier ne relit un retard absent comme un zéro', () => {
    // Le motif est assemblé plutôt qu'écrit d'un bloc : la garde doit
    // pouvoir s'appliquer à elle-même sans se dénoncer.
    const interdit = new RegExp('retard_min' + '\\s*(\\|\\||\\?\\?)\\s*0');
    const moi = path.basename(__filename);
    const coupables = [];
    fichiersSurveilles(RACINE).forEach(f => {
      if (path.basename(f) === moi) return;
      const lignes = fs.readFileSync(f, 'utf8').split('\n');
      lignes.forEach((ligne, i) => {
        if (interdit.test(ligne)) coupables.push(`${path.relative(RACINE, f)}:${i + 1}`);
      });
    });
    assert.deepStrictEqual(coupables, [],
      'un retard non calculable y devient « 0 minute de retard », donc « à l\'heure » :\n      '
      + coupables.join('\n      '));
  }),
  t('la garde sait mordre (elle voit l\'idiome quand il est là)', () => {
    const interdit = new RegExp('retard_min' + '\\s*(\\|\\||\\?\\?)\\s*0');
    assert.ok(interdit.test('const x = p.retard_min || 0;'));
    assert.ok(interdit.test('total += (p.retard_min ?? 0);'));
    assert.ok(!interdit.test('retard_min: Number.isFinite(p.retard_min) ? p.retard_min : null,'));
    assert.ok(!interdit.test('if (p.retard_min > 0) {'));
  }),
  t('l\'import de pointages locaux écrit « non calculable », pas 0', () => {
    // NEXUS-Debug-v1.html est le seul chemin d'ÉCRITURE de `retard_min` en
    // dehors du pointage lui-même : il reprend des pointages sauvegardés en
    // localStorage. Un retard absent de la sauvegarde n'a jamais été mesuré.
    const src = fs.readFileSync(path.join(RACINE, 'NEXUS-Debug-v1.html'), 'utf8');
    assert.ok(/retard_min: Number\.isFinite\(p\.retard_min\) \? p\.retard_min : null/.test(src),
      'la reprise localStorage n\'écrit plus « non calculable » pour un retard absent');
  }),
];

Promise.all([].concat(p1, p2, p3, p4)).then(() => {
  console.log(`\n${echecs ? '✗' : '✓'} ${passes} réussite(s), ${echecs} échec(s)`);
});
