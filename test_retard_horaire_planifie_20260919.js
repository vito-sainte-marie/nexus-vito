#!/usr/bin/env node
// Le retard se mesure, ou se tait — 19/09/2026 (mandat 33, arbitrage b1).
//
// DEUX ERREURS SUCCESSIVES, et cette épreuve garde la porte entre les deux.
// Le 11/09, NEXUS mesurait le retard contre `shifts.heure_debut` : un service
// ouvert d'un clic porte `heure_debut = created_at`, d'où « Retard constaté :
// 1028 min » pour une arrivée de 10 h 33. Le 18/09, on a figé `retard_min: 0`
// — ce qui a remplacé un faux retard par un faux « à l'heure », aussi menteur
// et plus difficile à voir, puisqu'il se fond dans les statistiques de
// ponctualité des sept écrans qui relisent cette colonne.
//
// LA RÈGLE, désormais : Paramètres Station = horaires du site ; Planning =
// affectation réelle de la journée ; Pointage = heure constatée ; retard =
// rapprochement des trois. `0` et `> 0` sont des retards MESURÉS ; `null` dit
// « non calculable » et ne doit JAMAIS être relu comme « à l'heure ».
//
// CE QUE CETTE ÉPREUVE JUGE : la règle pure du module, puis la chaîne réelle
// de l'écran — extraite de NEXUS-Pointage-v1.html et exécutée sur un faux
// client — enfin la parité entre la règle des jours étendus côté JS et celle
// que la migration écrit en base. Chaque « non calculable » y est vérifié
// pour lui-même : c'est là que se cacherait un 0 inventé.

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
new Function('window', 'document', fs.readFileSync(path.join(RACINE, 'nexus-station.js'), 'utf8'))
  (g, { getElementById: () => null, createElement: () => ({ style: {}, setAttribute() {} }) });
const S = g.NexusStation;
const R = require(path.join(RACINE, 'nexus-pointage-regles.js'));

const POINTAGE = fs.readFileSync(path.join(RACINE, 'NEXUS-Pointage-v1.html'), 'utf8');

// ── 1 · La règle pure : ce qui a une heure attendue, et ce qui n'en a pas ──

console.log('\n── 1 · retardDuPointage : mesurer, ou dire qu\'on ne sait pas ──');

const ctx = (attendues, pointage) => ({ minutesAttendues: attendues, minutesPointage: pointage });

const p1 = [
  t('une arrivée à l\'heure vaut 0 — un 0 MESURÉ', () => {
    assert.strictEqual(R.retardDuPointage({ type: 'arrivee' }, ctx(345, 345)), 0);
  }),
  t('une arrivée en retard vaut les minutes écoulées', () => {
    assert.strictEqual(R.retardDuPointage({ type: 'arrivee' }, ctx(345, 363)), 18);
  }),
  t('une arrivée en avance vaut 0, jamais un retard négatif', () => {
    assert.strictEqual(R.retardDuPointage({ type: 'arrivee' }, ctx(345, 330)), 0,
      'un retard négatif se soustrairait aux retards réels dans les moyennes');
  }),
  t('un départ, un début et une fin de pause n\'ont pas d\'heure attendue', () => {
    for (const type of ['depart', 'pause_debut', 'pause_fin']) {
      assert.strictEqual(R.retardDuPointage({ type }, ctx(345, 999)), null,
        `${type} rend une valeur : une heure attendue lui a été inventée`);
    }
  }),
  t('une heure attendue absente rend null, pas 0', () => {
    assert.strictEqual(R.retardDuPointage({ type: 'arrivee' }, ctx(null, 345)), null);
    assert.strictEqual(R.retardDuPointage({ type: 'arrivee' }, ctx(undefined, 345)), null);
    assert.strictEqual(R.retardDuPointage({ type: 'arrivee' }, ctx(NaN, 345)), null);
  }),
  t('une heure de pointage absente rend null, pas 0', () => {
    assert.strictEqual(R.retardDuPointage({ type: 'arrivee' }, ctx(345, null)), null);
    assert.strictEqual(R.retardDuPointage({ type: 'arrivee' }, ctx(345, NaN)), null);
  }),
  t('minuit attendu reste une heure attendue, et non « rien »', () => {
    assert.strictEqual(R.retardDuPointage({ type: 'arrivee' }, ctx(0, 5)), 5,
      '0 minute depuis minuit a été confondu avec une absence d\'horaire');
  }),
  t('sans contexte du tout, on ne conclut pas', () => {
    assert.strictEqual(R.retardDuPointage({ type: 'arrivee' }, undefined), null);
    assert.strictEqual(R.retardDuPointage(null, ctx(345, 345)), null);
  }),
];

// ── 2 · L'affectation du jour, telle que le Planning la déclare ────────────

console.log('\n── 2 · affectationDuJour : une seule journée travaillée, ou rien ──');

const L = (statut, quart, extra) => Object.assign(
  { statut, quart, site_id: 'vito-sainte-marie', site_transfert: null }, extra || {});

const p2 = [
  t('une seule ligne travaillée donne son quart et son site', () => {
    assert.deepStrictEqual(R.affectationDuJour([L('travail_normal', 'quart1')]),
      { quart: 'quart1', site: 'vito-sainte-marie' });
  }),
  t('les quatre statuts travaillés de la base sont reconnus', () => {
    for (const statut of ['travail_normal', 'manager', 'renfort', 'transfert_site']) {
      assert.ok(R.affectationDuJour([L(statut, 'quart2')]),
        `${statut} n'ouvre plus de journée travaillée`);
    }
  }),
  t('un transfert applique le site RÉELLEMENT travaillé', () => {
    assert.deepStrictEqual(
      R.affectationDuJour([L('transfert_site', 'quart1', { site_transfert: 'vito-autre' })]),
      { quart: 'quart1', site: 'vito-autre' },
      'les Paramètres Station du site d\'origine seraient appliqués à un quart fait ailleurs');
  }),
  t('repos et congé n\'ouvrent aucune heure attendue', () => {
    // La Production porte bien des lignes `repos/quart1` et `conge/quart2` :
    // leur `quart` rendrait un horaire si on le passait au moteur.
    assert.strictEqual(R.affectationDuJour([L('repos', 'quart1')]), null);
    assert.strictEqual(R.affectationDuJour([L('conge', 'quart2')]), null);
    assert.strictEqual(R.affectationDuJour([L('repos', 'quart1'), L('repos', 'quart2')]), null);
  }),
  t('un statut inconnu tombe du côté « non calculable »', () => {
    assert.strictEqual(R.affectationDuJour([L('formation', 'quart1')]), null,
      'une liste négative laisserait un statut ajouté demain produire un faux retard');
  }),
  t('deux journées travaillées le même jour ne se départagent pas', () => {
    assert.strictEqual(
      R.affectationDuJour([L('travail_normal', 'quart1'), L('renfort', 'renfort')]), null);
  }),
  t('aucune ligne — planning non publié, ou journée absente — rend null', () => {
    assert.strictEqual(R.affectationDuJour([]), null);
    assert.strictEqual(R.affectationDuJour(null), null);
    assert.strictEqual(R.affectationDuJour(undefined), null);
  }),
  t('une ligne sans quart ou sans site ne fait pas une affectation', () => {
    assert.strictEqual(R.affectationDuJour([L('travail_normal', null)]), null);
    assert.strictEqual(R.affectationDuJour([L('travail_normal', 'quart1', { site_id: null })]), null);
  }),
];

// ── 3 · La chaîne réelle de l'écran, sur un faux client ───────────────────

console.log('\n── 3 · La chaîne de NEXUS-Pointage-v1.html, de bout en bout ──');

const DEBUT = POINTAGE.indexOf('const fuseauxDeStation = new Map();');
const FIN = POINTAGE.indexOf('function demarrerHorloge()');
assert.ok(DEBUT > 0 && FIN > DEBUT, 'la chaîne du retard est introuvable — l\'épreuve ne juge plus rien');
const SRC_CHAINE = POINTAGE.slice(DEBUT, FIN);
assert.ok(/async function retardDeLArrivee\(/.test(SRC_CHAINE),
  'retardDeLArrivee n\'est plus dans le bloc extrait : l\'épreuve juge autre chose');

const TZ = 'America/Martinique'; // UTC−4 toute l'année : aucun changement d'heure.
const JOUR = '2026-09-19';
const utc = hhmmss => new Date(`${JOUR}T${hhmmss}Z`);

/**
 * Instancie la chaîne de l'écran avec un faux client et un faux fuseau.
 * `journal` compte les appels : un refus doit refuser TÔT, sans lire la base.
 */
function chaine({ planning = [], erreurPlanning = null, horaires = [], erreurHoraires = null,
                  fuseau = TZ } = {}) {
  const journal = { planning: 0, rpc: 0, fuseau: 0, rpcArgs: null, fuseauSites: [] };
  const requete = resultat => {
    const b = {
      select: () => b, eq: () => b,
      then: (ok, ko) => Promise.resolve(resultat).then(ok, ko),
    };
    return b;
  };
  const nexusClient = {
    from: table => {
      // `v_planning_officiel` et RIEN D'AUTRE. Lire `planning_shifts`
      // rendrait la génération NEXUS et l'import Google Sheets pour la même
      // journée : le retard se calculerait contre un planning qui ne faisait
      // pas foi ce jour-là. Cette égalité est la garde de ce contrat.
      assert.strictEqual(table, 'v_planning_officiel',
        `la chaîne du retard lit ${table} : une source non prévue par le contrat`);
      journal.planning++;
      return requete({ data: planning, error: erreurPlanning });
    },
    rpc: (nom, args) => {
      assert.strictEqual(nom, 'calculer_horaires_quart',
        `la chaîne du retard appelle ${nom} : un second moteur d'horaires`);
      journal.rpc++;
      journal.rpcArgs = args;
      return Promise.resolve({ data: horaires, error: erreurHoraires });
    },
  };
  const NexusStation = Object.assign({}, S, {
    fuseauDeLaStation: async site => {
      journal.fuseau++;
      journal.fuseauSites.push(site);
      return fuseau ? { timezone: fuseau } : { indetermine: 'configuration' };
    },
  });
  const bruit = { error: () => {}, warn: () => {}, log: () => {} };
  const retardDeLArrivee = new Function(
    'nexusClient', 'NexusStation', 'NexusPointageRegles', 'console',
    `${SRC_CHAINE}\nreturn retardDeLArrivee;`
  )(nexusClient, NexusStation, R, bruit);
  return { retardDeLArrivee, journal };
}

const PLANNING_QUART1 = [{ statut: 'travail_normal', quart: 'quart1',
                           site_id: 'vito-sainte-marie', site_transfert: null }];
const HORAIRE_0545 = [{ heure_debut: '05:45:00', heure_fin: '13:00:00', duree_heures: 7.25 }];
const EMPLOYE = { id: 'e1', site_id: 'vito-sainte-marie' };

const p3 = [
  t('arrivée à l\'heure de la station → 0', async () => {
    const c = chaine({ planning: PLANNING_QUART1, horaires: HORAIRE_0545 });
    // 09:45 UTC = 05:45 à la Martinique.
    assert.strictEqual(await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('09:45:00')), 0);
    assert.deepStrictEqual(c.journal.rpcArgs,
      { p_site: 'vito-sainte-marie', p_quart: 'quart1', p_date: JOUR });
  }),
  t('arrivée en retard → les minutes réellement écoulées', async () => {
    const c = chaine({ planning: PLANNING_QUART1, horaires: HORAIRE_0545 });
    assert.strictEqual(await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('10:03:00')), 18);
  }),
  t('arrivée en avance → 0, et non un retard négatif', async () => {
    const c = chaine({ planning: PLANNING_QUART1, horaires: HORAIRE_0545 });
    assert.strictEqual(await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('09:30:00')), 0);
  }),
  t('l\'habillage n\'est pas une tolérance : l\'heure attendue est celle du moteur', async () => {
    // `heure_debut` inclut déjà l'habillage — l'ouverture au public est
    // décalée APRÈS. Une arrivée à l'heure d'ouverture publique est donc en
    // retard des 15 minutes d'habillage, et cette épreuve l'exige.
    const c = chaine({ planning: PLANNING_QUART1, horaires: HORAIRE_0545 });
    assert.strictEqual(await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('10:00:00')), 15);
  }),
  t('départ, début et fin de pause : null, sans même lire la base', async () => {
    for (const type of ['depart', 'pause_debut', 'pause_fin']) {
      const c = chaine({ planning: PLANNING_QUART1, horaires: HORAIRE_0545 });
      assert.strictEqual(await c.retardDeLArrivee(type, EMPLOYE, JOUR, utc('09:45:00')), null);
      assert.strictEqual(c.journal.planning, 0, `${type} interroge le planning pour rien`);
    }
  }),
  t('planning non publié — zéro ligne — → null, et aucun horaire n\'est demandé', async () => {
    const c = chaine({ planning: [], horaires: HORAIRE_0545 });
    assert.strictEqual(await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('09:45:00')), null);
    assert.strictEqual(c.journal.rpc, 0, 'un horaire a été demandé sans affectation connue');
  }),
  t('deux journées travaillées → null', async () => {
    const c = chaine({
      planning: PLANNING_QUART1.concat([{ statut: 'renfort', quart: 'renfort',
                                          site_id: 'vito-sainte-marie', site_transfert: null }]),
      horaires: HORAIRE_0545,
    });
    assert.strictEqual(await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('09:45:00')), null);
  }),
  t('repos ou congé → null', async () => {
    for (const statut of ['repos', 'conge']) {
      const c = chaine({ planning: [{ statut, quart: 'quart1',
                                      site_id: 'vito-sainte-marie', site_transfert: null }],
                         horaires: HORAIRE_0545 });
      assert.strictEqual(await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('09:45:00')), null,
        `${statut} produit un retard : une journée non travaillée a reçu une heure attendue`);
    }
  }),
  t('un renfort sans horaire déclaré → null, jamais une heure de repli', async () => {
    const c = chaine({
      planning: [{ statut: 'renfort', quart: 'renfort',
                   site_id: 'vito-sainte-marie', site_transfert: null }],
      horaires: [], // le moteur ne rend aucune ligne : horaire non déclaré.
    });
    assert.strictEqual(await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('09:45:00')), null);
    assert.strictEqual(c.journal.rpcArgs.p_quart, 'renfort');
  }),
  t('un transfert interroge les Paramètres ET le fuseau du site travaillé', async () => {
    const c = chaine({
      planning: [{ statut: 'transfert_site', quart: 'quart1',
                   site_id: 'vito-sainte-marie', site_transfert: 'vito-autre' }],
      horaires: HORAIRE_0545,
    });
    await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('09:45:00'));
    assert.strictEqual(c.journal.rpcArgs.p_site, 'vito-autre',
      'les horaires du site d\'origine ont été appliqués à un quart fait ailleurs');
    assert.deepStrictEqual(c.journal.fuseauSites, ['vito-autre'],
      'l\'arrivée est jugée dans le fuseau d\'un site où l\'employé n\'était pas');
  }),
  t('un fuseau indéterminé → null', async () => {
    const c = chaine({ planning: PLANNING_QUART1, horaires: HORAIRE_0545, fuseau: null });
    assert.strictEqual(await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('09:45:00')), null);
  }),
  t('jour de l\'appareil ≠ jour de la station → null', async () => {
    // 2026-09-20T02:00Z = encore le 19 à 22 h à la Martinique. L'appareil
    // aurait daté ce pointage du 20 et lu le planning du 20 : les deux côtés
    // de la soustraction ne parlent pas de la même journée.
    const c = chaine({ planning: PLANNING_QUART1, horaires: HORAIRE_0545 });
    assert.strictEqual(
      await c.retardDeLArrivee('arrivee', EMPLOYE, '2026-09-20', new Date('2026-09-20T02:00:00Z')),
      null);
    assert.strictEqual(c.journal.rpc, 0, 'un horaire a été demandé pour une journée non concordante');
  }),
  t('une lecture de planning en erreur → null, jamais 0', async () => {
    const c = chaine({ erreurPlanning: { message: 'RLS' }, horaires: HORAIRE_0545 });
    assert.strictEqual(await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('09:45:00')), null);
  }),
  t('un moteur d\'horaires en erreur → null, jamais 0', async () => {
    const c = chaine({ planning: PLANNING_QUART1, erreurHoraires: { message: 'boom' } });
    assert.strictEqual(await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('09:45:00')), null);
  }),
  t('une heure de début nulle ou illisible → null', async () => {
    for (const horaires of [[{ heure_debut: null }], [{ heure_debut: 'x' }], [null], null]) {
      const c = chaine({ planning: PLANNING_QUART1, horaires });
      assert.strictEqual(await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('09:45:00')), null,
        `une heure attendue a été fabriquée à partir de ${JSON.stringify(horaires)}`);
    }
  }),
  t('une exception ne vaut pas « à l\'heure »', async () => {
    const c = chaine({ planning: PLANNING_QUART1, horaires: HORAIRE_0545 });
    const explose = { id: null, get site_id() { throw new Error('boum'); } };
    Object.defineProperty(explose, 'id', { get() { throw new Error('boum'); } });
    assert.strictEqual(await c.retardDeLArrivee('arrivee', explose, JOUR, utc('09:45:00')), null);
  }),
  t('le fuseau d\'un site n\'est demandé qu\'une fois', async () => {
    const c = chaine({ planning: PLANNING_QUART1, horaires: HORAIRE_0545 });
    await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('09:45:00'));
    await c.retardDeLArrivee('arrivee', EMPLOYE, JOUR, utc('09:46:00'));
    assert.strictEqual(c.journal.fuseau, 1, 'le cache de fuseaux ne sert plus à rien');
  }),
];

// ── 4 · Une seule règle de jours étendus, des deux côtés ──────────────────

console.log('\n── 4 · JOURS_ETENDUS (JS) ≡ le régime du jour (SQL) ──');

const MIGRATIONS = path.join(RACINE, 'supabase', 'migrations');
const FICHIER_MOTEUR = fs.readdirSync(MIGRATIONS)
  .filter(f => /horaires_moteur_unique_et_retard_nullable\.sql$/.test(f))
  .sort().pop();

const p4 = [
  t('la migration du moteur unique est bien celle qui tranche le régime', () => {
    assert.ok(FICHIER_MOTEUR, 'la migration du moteur unique a disparu du lot');
    const sql = fs.readFileSync(path.join(MIGRATIONS, FICHIER_MOTEUR), 'utf8');
    assert.ok(/create or replace function public\.calculer_horaires_quart/.test(sql),
      'la migration ne redéfinit plus le moteur unique');
    assert.ok(/set search_path to 'public'/.test(sql),
      'le search_path figé le 28/07 n\'est plus reconduit : la fonction changerait de résolution de noms');
  }),
  t('les jours étendus du JS sont exactement ceux que le SQL déclare', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, FICHIER_MOTEUR), 'utf8');
    const m = sql.match(/v_dow in \(([^)]*)\)/);
    assert.ok(m, 'le régime étendu ne se lit plus dans la migration : la parité n\'est plus vérifiable');
    const dowSql = m[1].split(',').map(s => Number(s.trim())).sort();
    // `extract(dow …)` : 0 = dimanche … 6 = samedi.
    const dowJs = [];
    for (let d = 0; d < 7; d++) {
      // 2026-09-13 est un dimanche ; midi UTC pour rester loin des bords.
      const jour = new Date(Date.UTC(2026, 8, 13 + d, 12, 0, 0));
      assert.strictEqual(jour.getUTCDay(), d, 'la table de jours de l\'épreuve est fausse');
      if (S.cleHoraireDuJour('UTC', jour) === 'etendu') dowJs.push(d);
    }
    assert.deepStrictEqual(dowJs.sort(), dowSql,
      `JOURS_ETENDUS (${S.JOURS_ETENDUS.join(', ')}) et le SQL ne désignent plus les mêmes jours : ` +
      'deux moteurs, donc deux vérités possibles');
  }),
  t('la sémantique nullable est écrite dans la base, pas seulement dans le code', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, FICHIER_MOTEUR), 'utf8');
    assert.ok(/alter column retard_min drop not null/.test(sql),
      'retard_min reste NOT NULL : écrire « non calculable » ferait échouer l\'insertion');
    assert.ok(/alter column retard_min drop default/.test(sql),
      'le défaut 0 subsiste : une absence de valeur redeviendrait un faux « à l\'heure »');
    assert.ok(/NULL ne signifie JAMAIS/.test(sql),
      'le commentaire de colonne n\'avertit plus les consommateurs de la sémantique de NULL');
  }),
];

Promise.all([].concat(p1, p2, p3, p4)).then(() => {
  console.log(`\n${echecs ? '✗' : '✓'} ${passes} réussite(s), ${echecs} échec(s)`);
});
