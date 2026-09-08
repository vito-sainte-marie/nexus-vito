#!/usr/bin/env node
'use strict';
// Répétition locale de la recette Carburants — avant de pousser, pas après.
//
// CE QU'ELLE CORRIGE. Dans la nuit du 07 au 08/09/2026, faire fonctionner un
// seul semis a demandé quatre commits et quatre passages de CI de six minutes,
// parce que la CI était le SEUL endroit où l'environnement réel pouvait être
// exercé — et qu'elle ne révèle qu'un obstacle à la fois. Chaque contrôle
// local passait ; chaque échec coûtait un aller-retour. Ce n'est pas de
// l'étourderie, c'est une boucle de retour trop lente et trop étroite.
//
// Pire : le scénario avait été calibré contre les cuves de vito-sainte-marie
// (SP95 limite 28 761 L) puis semé dans la station Test (23 750 L). Il était
// « prouvé » localement ET faux en réalité, parce que RIEN ne comparait la
// configuration du banc à celle de la station. Un banc qui ne partage pas ses
// hypothèses avec le terrain ne prouve que lui-même.
//
// CE QU'ELLE FAIT. Elle rejoue le scénario à travers la VRAIE chaîne
// (nexus-carburant-moteur -> commande-moteur -> donnees-core -> P0) en lisant
// ses hypothèses dans `docs/recettes/config-station-test.json` — le même
// fichier dont la CI vérifie qu'il correspond toujours à la base Test. En
// quelques secondes, sans réseau et sans base, elle répond à la question qui
// coûtait un cycle de CI : « ce scénario tiendra-t-il ? »
//
// Elle vérifie les SEPT jours de la semaine, parce que la fenêtre de vente
// avant livraison en dépend (1 jour du lundi au jeudi, 3 le vendredi et le
// samedi, 2 le dimanche) et qu'un scénario juste un mardi peut être faux un
// vendredi — c'est exactement ce qui a périmé la version précédente.
//
// ELLE NE REMPLACE PAS LA RECETTE NAVIGATEUR. Elle exerce le moteur, pas
// l'écran ni la base. Un vert ici veut dire « le scénario est cohérent avec
// la configuration connue de la station », jamais « la preuve UI est faite ».
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RACINE = path.join(__dirname, '..');
const CONFIG = path.join(RACINE, 'docs', 'recettes', 'config-station-test.json');

// Le scénario, dérivé du semis `outils/recette-carburants-test.sql`. Ces
// valeurs sont les mêmes des deux côtés — si elles divergeaient, la répétition
// prouverait un scénario que la base ne contient pas.
const SCENARIO = {
  consoSp95Q1: 770, consoSp95Q2: 630,   // 1 400 L/j
  consoGoQ1: 477, consoGoQ2: 423,       //   900 L/j
  margeSp95L: 400,                      // stock sp95 projeté à la livraison
  stockGoProjeteL: 4500,                // ~5 jours, donc arrondi vers le BAS
};
const ATTENDU = { total: 36000, sp95: 23000, go: 13000, reliquatL: 1000, credite: 'go', refuse: 'sp95' };
// Bande utile mesurée le 08/09/2026 : au-delà de 750 L la signature disparaît
// (22 000 + 13 000, aucun reliquat) ; au-dessous de 0 on entre dans le cas
// dégénéré CARB-006 où la capacité dépasse la limite physique de la cuve.
const BANDE_SP95 = { min: 1, max: 750 };
const FENETRE_PAR_JOUR = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 3, 6: 3, 7: 2 };

function charger(sandbox, fichier) {
  vm.runInContext(fs.readFileSync(path.join(RACINE, fichier), 'utf8'), sandbox);
}

function limiteTotale(cuves) {
  return (cuves.cuves || []).reduce((s, c) => s + (c.limite_remplissage || 0), 0);
}

function faireClient(config, histo, quart1) {
  // Table VIDE pour tout ce qui n'est pas explicitement peuplé. Le premier jet
  // renvoyait ici la ligne de ventes du jour, capturée par fermeture, à
  // n'importe quelle table interrogée : le moteur y lisait une commande en
  // cours fantôme et rallongeait la fenêtre de trois jours. La répétition
  // rendait alors 5 jours sur 7 en échec sur un scénario que la CI réelle
  // validait — un banc qui se trompe est pire qu'un banc absent, parce qu'on
  // le croit.
  const tableVide = () => { const c = { select() { return c; }, eq() { return c; }, gte() { return c; },
    lt() { return c; }, in() { return c; }, neq() { return c; }, order() { return c; }, limit() { return c; },
    insert() { return c; }, async maybeSingle() { return { data: null, error: null }; },
    then(r) { return Promise.resolve({ data: [], error: null }).then(r); } }; return c; };
  const tableVentes = () => { let plage = false, filtreQuart = false;
    const c = { select() { return c; }, eq(k) { if (k === 'quart') filtreQuart = true; return c; },
      gte() { plage = true; return c; }, lt() { plage = true; return c; }, in() { return c; },
      neq() { return c; }, order() { return c; }, limit() { return c; }, insert() { return c; },
      async maybeSingle() { return { data: null, error: null }; },
      then(r) { return Promise.resolve({ data: filtreQuart ? [] : (plage ? histo : quart1), error: null }).then(r); } };
    return c; };
  return { from(t) {
    if (t === 'station_config') {
      const data = { carburant_commande_config: config.carburant_commande_config,
        cuves_carburants: config.cuves_carburants, horaires: config.horaires };
      const c = { select() { return c; }, eq() { return c; }, async maybeSingle() { return { data, error: null }; } };
      return c;
    }
    if (t === 'audits_caisse') return tableVentes();
    return tableVide();
  } };
}

function jourDecale(dateISO, n) {
  const d = new Date(dateISO + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// LE JUGEMENT, séparé de l'exécution du moteur pour être éprouvable règle par
// règle. Tant qu'il vivait à l'intérieur de `repeterUnJour`, trois mutations y
// survivaient : les contrôles se couvraient mutuellement, et supprimer l'un
// d'eux laissait les autres crier à sa place. Une épreuve qui constate « un
// échec survient » ne prouve pas QUEL contrôle l'a produit.
function verifierJour({ commande, capaciteSp95, config }) {
  const echecs = [];
  if (!commande) {
    echecs.push('aucune commande recommandée — le scénario ne déclenche plus de commande.');
    return echecs;
  }
  const limiteSp95 = limiteTotale(config.cuves_carburants.sp95);
  const limiteGo = limiteTotale(config.cuves_carburants.go);
  const c = commande;
  const rel = c.reliquatArrondi || {};

  if (c.total !== ATTENDU.total) echecs.push(`total ${c.total} L, attendu ${ATTENDU.total} L`);
  if (c.volumes.sp95 !== ATTENDU.sp95) echecs.push(`sp95 ${c.volumes.sp95} L, attendu ${ATTENDU.sp95} L`);
  if (c.volumes.go !== ATTENDU.go) echecs.push(`go ${c.volumes.go} L, attendu ${ATTENDU.go} L`);
  if (rel.recupereL !== ATTENDU.reliquatL) {
    echecs.push(`reliquat récupéré ${rel.recupereL} L, attendu ${ATTENDU.reliquatL} L — sans lui, un total juste ne prouverait pas CARB-004.`);
  }
  if (!rel.parCarburant || rel.parCarburant[ATTENDU.credite] !== ATTENDU.reliquatL) {
    echecs.push(`le compartiment récupéré doit être crédité à ${ATTENDU.credite}, vu ${JSON.stringify(rel.parCarburant)}`);
  }
  if (!rel.motifs || !/[Cc]apacité disponible/.test(rel.motifs[ATTENDU.refuse] || '')) {
    echecs.push(`${ATTENDU.refuse} doit porter un motif de refus nommant la capacité, vu ${JSON.stringify(rel.motifs)}`);
  }
  // Physiquement recevable — la vérification qui manquait le 07/09.
  if (c.volumes.sp95 > limiteSp95) echecs.push(`sp95 ${c.volumes.sp95} L dépasse la limite de remplissage ${limiteSp95} L — physiquement impossible.`);
  if (c.volumes.go > limiteGo) echecs.push(`go ${c.volumes.go} L dépasse la limite de remplissage ${limiteGo} L — physiquement impossible.`);
  if (capaciteSp95 == null) {
    echecs.push('capacité sp95 inconnue — ne rien conclure de cette absence.');
    return echecs;
  }
  if (capaciteSp95 > limiteSp95) echecs.push(`capacité sp95 ${Math.round(capaciteSp95)} L supérieure à la limite ${limiteSp95} L — cas dégénéré CARB-006, stock projeté négatif.`);
  const stockPrevuSp95 = limiteSp95 - capaciteSp95;
  if (stockPrevuSp95 < BANDE_SP95.min || stockPrevuSp95 > BANDE_SP95.max) {
    echecs.push(`stock sp95 projeté ${Math.round(stockPrevuSp95)} L hors de la bande utile [${BANDE_SP95.min}, ${BANDE_SP95.max}] — le scénario n'exercerait pas CARB-004.`);
  }
  return echecs;
}

async function repeterUnJour(config, dateISO) {
  const isoDow = ((new Date(dateISO + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;
  const fenetre = FENETRE_PAR_JOUR[isoDow];
  const consoSp = SCENARIO.consoSp95Q1 + SCENARIO.consoSp95Q2;
  const consoGo = SCENARIO.consoGoQ1 + SCENARIO.consoGoQ2;
  const jaugeSp95 = consoSp * fenetre + SCENARIO.margeSp95L;
  const jaugeGo = consoGo * fenetre + SCENARIO.stockGoProjeteL;

  const histo = [];
  for (let i = 28; i >= 1; i--) {
    const d = jourDecale(dateISO, -i);
    histo.push({ date: d, quart: '1', litrage_sp95: SCENARIO.consoSp95Q1, litrage_gazole: SCENARIO.consoGoQ1, litrage_gnr: null });
    histo.push({ date: d, quart: '2', litrage_sp95: SCENARIO.consoSp95Q2, litrage_gazole: SCENARIO.consoGoQ2, litrage_gnr: null });
  }
  const quart1 = [{ date: dateISO, quart: '1', litrage_sp95: SCENARIO.consoSp95Q1, litrage_gazole: SCENARIO.consoGoQ1, litrage_gnr: null }];

  // LE VRAI `console`, jamais un faux partiel. Un stub auquel il manque une
  // méthode fait échouer le moteur dans un catch silencieux, et la
  // répétition rend alors un résultat qui n'a rien à voir — défaut déjà
  // rencontré le 06/09/2026 (un balayage rendait « 0 combinaison » parce que
  // le faux console n'avait pas `.info`). Ici il a produit un écart de trois
  // jours de consommation, soit un scénario entièrement faux.
  const sandbox = { console, window: undefined };
  vm.createContext(sandbox); sandbox.window = sandbox;
  charger(sandbox, 'nexus-carburant-moteur.js');
  sandbox.NexusCarburantDonnees = { chargerControleJour: async () => ({ aucunReleve: false,
    releveDuJour: { date: dateISO, mesure_le: dateISO + 'T09:30:00.000Z', origine: 'manager' }, dernierReleve: null,
    parCarburant: { sp95: { reelDuJour: jaugeSp95, dernierReel: jaugeSp95 + 1500, statut: 'Sous contrôle' },
                    go: { reelDuJour: jaugeGo, dernierReel: jaugeGo + 1500, statut: 'Sous contrôle' } } }) };
  charger(sandbox, 'nexus-carburant-commande-moteur.js');
  charger(sandbox, 'nexus-carburant-commande-donnees-core.js');
  charger(sandbox, 'nexus-carburants-p0-fixes.js');
  if (!sandbox.NexusCarburantsP0 || sandbox.NexusCarburantsP0.actif !== true) {
    return { dateISO, fenetre, echecs: ['La couche P0 n\'est pas installée — cette répétition n\'exercerait pas la chaîne réelle.'] };
  }

  const r = await sandbox.NexusCarburantCommandeDonnees.evaluerCommandeCarburantSite(
    faireClient(config, histo, quart1), config.site,
    { timezone: config.fuseau_horaire, dateISO, heureHHMM: '09:00', maintenant: dateISO + 'T13:00:00.000Z' });

  const echecs = verifierJour({ commande: r && r.commandeRecommandee,
    capaciteSp95: r && r.parCarburant && r.parCarburant.sp95 ? r.parCarburant.sp95.capaciteDisponibleL : null,
    config });
  const limiteSp95 = limiteTotale(config.cuves_carburants.sp95);
  const c = (r && r.commandeRecommandee) || null;
  const capaSp95 = r && r.parCarburant && r.parCarburant.sp95 ? r.parCarburant.sp95.capaciteDisponibleL : null;
  const stockPrevuSp95 = capaSp95 == null ? null : limiteSp95 - capaSp95;
  if (!c) return { dateISO, fenetre, echecs };
  return { dateISO, fenetre, stockPrevuSp95: stockPrevuSp95 == null ? null : Math.round(stockPrevuSp95),
    volumes: c.volumes, reliquatL: (c.reliquatArrondi || {}).recupereL, echecs };
}

// Les sept jours, à partir d'un lundi connu.
const LUNDI_REFERENCE = '2026-09-07';
async function repeter(config) {
  const jours = [];
  for (let i = 0; i < 7; i++) jours.push(await repeterUnJour(config, jourDecale(LUNDI_REFERENCE, i)));
  return jours;
}

// Dérive de l'instantané. Un banc qui calibre contre un fichier périmé refait
// exactement le défaut du 07/09 : « prouvé » ici, faux en réalité. La CI
// compare donc l'instantané à la station Test à chaque passage.
//
// Comparaison des seuls champs dont le scénario DÉPEND — cuves, configuration
// de commande, fuseau. Comparer tout le `station_config` ferait crier la garde
// à chaque réglage d'inventaire sans rapport, et une garde qui crie pour rien
// finit désactivée.
const CHAMPS_SUIVIS = ['fuseau_horaire', 'cuves_carburants', 'carburant_commande_config'];

function comparerInstantane(instantane, vivant) {
  const ecarts = [];
  if (!vivant || typeof vivant !== 'object') {
    return ['Configuration vivante illisible — ne rien conclure de cette absence.'];
  }
  const normaliser = (v) => JSON.stringify(v, Object.keys(v || {}).sort ? undefined : undefined);
  for (const champ of CHAMPS_SUIVIS) {
    const a = JSON.stringify(trier(instantane[champ]));
    const b = JSON.stringify(trier(vivant[champ]));
    if (a !== b) ecarts.push(`${champ} a dérivé.\n      instantané : ${a}\n      station    : ${b}`);
  }
  void normaliser;
  return ecarts;
}

// Tri récursif des clés : deux objets identiques écrits dans un ordre différent
// ne sont pas une dérive, et les signaler ferait perdre confiance dans ceux qui
// en sont une.
function trier(v) {
  if (Array.isArray(v)) return v.map(trier);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = trier(v[k]);
    return out;
  }
  return v;
}

function lireConfig() {
  if (!fs.existsSync(CONFIG)) {
    return { erreur: `${path.relative(RACINE, CONFIG)} introuvable — sans instantané de la station, ne rien conclure.` };
  }
  try { return { config: JSON.parse(fs.readFileSync(CONFIG, 'utf8')) }; }
  catch (e) { return { erreur: `${path.relative(RACINE, CONFIG)} illisible : ${e.message}` }; }
}

module.exports = { repeter, repeterUnJour, verifierJour, limiteTotale, comparerInstantane, trier, CHAMPS_SUIVIS, lireConfig, SCENARIO, ATTENDU, BANDE_SP95, FENETRE_PAR_JOUR, CONFIG };

if (require.main === module && process.argv.includes('--comparer')) {
  // Mode comparaison : la configuration vivante arrive sur l'entrée standard,
  // extraite de la base Test par la CI. Aucune connexion ici — cet outil ne
  // parle jamais à une base.
  let brut = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => { brut += d; });
  process.stdin.on('end', () => {
    const { config, erreur } = lireConfig();
    if (erreur) { console.error('Comparaison INDISPONIBLE — ' + erreur); process.exit(1); }
    let vivant;
    try { vivant = JSON.parse(brut); }
    catch (e) { console.error('Comparaison INDISPONIBLE — configuration vivante illisible : ' + e.message); process.exit(1); }
    const ecarts = comparerInstantane(config, vivant);
    if (ecarts.length) {
      console.error('L\'instantané docs/recettes/config-station-test.json a DÉRIVÉ de la station Test :');
      for (const e of ecarts) console.error('  · ' + e);
      console.error('\nLe scénario de recette est calibré sur cet instantané. Tant qu\'il ment,');
      console.error('la recette cherchera un défaut imaginaire dans le moteur — c\'est exactement');
      console.error('ce qui est arrivé le 07/09/2026.');
      process.exit(1);
    }
    console.log(`Instantané conforme à la station Test (${CHAMPS_SUIVIS.join(', ')}).`);
    process.exit(0);
  });
} else if (require.main === module) {
  const NOMS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const { config, erreur } = lireConfig();
  if (erreur) { console.error('Répétition INDISPONIBLE — ' + erreur); process.exit(1); }
  repeter(config).then(jours => {
    let mauvais = 0;
    jours.forEach((j, i) => {
      if (j.echecs.length) {
        mauvais++;
        console.error(`${NOMS[i].padEnd(10)} fenêtre ${j.fenetre} j — ÉCHEC`);
        for (const e of j.echecs) console.error('    · ' + e);
      } else {
        console.log(`${NOMS[i].padEnd(10)} fenêtre ${j.fenetre} j — ${j.volumes.sp95} + ${j.volumes.go} = 36 000 L,`
          + ` reliquat ${j.reliquatL} L, stock sp95 projeté ${j.stockPrevuSp95} L`);
      }
    });
    if (mauvais) {
      console.error(`\n${mauvais} jour(s) sur 7 en échec — ne pas pousser : la CI trouverait la même chose six minutes plus tard.`);
      process.exit(1);
    }
    console.log('\n7/7 jours conformes — scénario cohérent avec la configuration connue de la station Test.');
    console.log('Ceci n\'est PAS la preuve UI : seule la recette navigateur juge l\'écran et la base réelle.');
    process.exit(0);
  }).catch(e => { console.error('Répétition INDISPONIBLE — ' + e.message); process.exit(1); });
}
