// NEXUS — une mission terminée ce soir compte pour ce soir (18/09/2026).
//
// LE DÉFAUT MESURÉ
// ----------------
// L'écran Missions datait sa journée avec `new Date().toISOString()`, qui rend
// le jour UTC. À 21 h 28 à la Martinique (GMT-4), Greenwich est déjà au
// lendemain. Constaté en recette le 18/09 sur nexus-test : une mission
// réellement validée ce soir-là partait en base au 2026-09-19, le compteur
// affichait « 0 / 2 missions obligatoires terminées », le score restait à
// zéro et le bouton ne passait jamais à « ✓ Validée aujourd'hui ». La
// complétion existait pourtant : c'est la JOURNÉE qui était fausse, pas
// l'enregistrement.
//
// C'est la même classe de défaut que celle corrigée pour l'Accueil par
// `7afbf27` (la date métier suit le site), simplement jamais reportée sur cet
// écran-ci. La règle n'est donc pas réécrite ici : elle est REPRISE.
//
// CE QUE CE TEST EXIGE
// --------------------
//   1. À instant identique, un appareil quelconque date la journée de l'écran
//      comme la STATION la date — affichage, compteur et ENREGISTREMENT.
//   2. La journée suit `sites.timezone` du SITE — l'autorité canonique du
//      fuseau depuis la migration 20260905131500 : déclarer le site à Paris
//      déplace la frontière. Sans ce point, un code qui aurait figé la
//      Martinique en dur serait vert.
//   3. La bascule de minuit se fait SANS rechargement : une session ouverte à
//      cheval sur minuit change de journée toute seule.
//   4. Ce qui a été validé la veille cesse de compter pour aujourd'hui, et
//      n'est pas effacé pour autant.
//
// COMMENT IL LE MESURE
// --------------------
// · LE CODE EXÉCUTÉ EST CELUI QUI EST LIVRÉ. Les primitives de fuseau sont
//   extraites de `nexus-auth.js`, et `jourMetier`, `calculerPotentielJour`,
//   `renderMissionCard`, `cloturerMissionAssignee` sont extraites de
//   `NEXUS-Missions-v1.html`, jamais recopiées. Ce qui est remplacé par une
//   doublure — le client Supabase, les sous-rendus décoratifs — ne porte
//   aucune décision de date.
// · L'HORLOGE DE L'APPAREIL EST CELLE DU PROCESSUS : ce fichier se relance en
//   sous-processus, une fois par fuseau d'appareil éprouvé.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const RACINE = process.env.NEXUS_RACINE || __dirname;
const SRC_AUTH = fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8');
const SRC_ECRAN = fs.readFileSync(path.join(RACINE, 'NEXUS-Missions-v1.html'), 'utf8');

// 21 h 28 à la station le 18, déjà le 19 à Greenwich. C'est l'instant exact du
// constat de recette, pas un cas de laboratoire.
const INSTANT_SOIR = Date.parse('2026-09-19T01:28:00Z');
// Minuit passé de deux minutes à la station : la journée métier a tourné, la
// journée UTC non.
const INSTANT_APRES_MINUIT = Date.parse('2026-09-19T04:02:00Z');
// Dimanche soir à la station, lundi à Greenwich. C'est le pire moment
// de la semaine pour se tromper de journée : la frontière de semaine ISO
// passe entre les deux, et le récapitulatif hebdomadaire se vide d'un coup.
const INSTANT_DIMANCHE_SOIR = Date.parse('2026-09-21T01:28:00Z');

const APPAREILS = ['America/Martinique', 'Europe/Paris', 'Pacific/Auckland'];
const SITE_DE_L_EMPLOYE = 'site-1';

// ---------------------------------------------------------------------------
// OUTILLAGE
// ---------------------------------------------------------------------------

function extraireFonction(entete, source, ou) {
  const i = source.indexOf(entete);
  assert.ok(i !== -1, `« ${entete} » introuvable dans ${ou}`);
  let prof = 0;
  for (let k = source.indexOf('{', i); k < source.length; k++) {
    if (source[k] === '{') prof++;
    else if (source[k] === '}' && --prof === 0) return source.slice(i, k + 1);
  }
  throw new Error(`« ${entete} » n'est pas refermée dans ${ou}`);
}

// Une seule LIGNE du fichier livré, exécutée telle quelle. Sert à l'amorçage :
// si l'écran cesse de charger le fuseau de son site, la ligne disparaît et
// l'extraction rougit, au lieu que le banc la remplace silencieusement.
function extraireLigne(motif, source, ou) {
  const lignes = source.split('\n').filter(l => l.includes(motif));
  assert.strictEqual(lignes.length, 1,
    `« ${motif} » : ${lignes.length} ligne(s) dans ${ou}, attendu 1`);
  return lignes[0].trim();
}

function extraireBloc(debut, fin, source, ou) {
  const i = source.indexOf(debut);
  const j = source.indexOf(fin, i);
  assert.ok(i !== -1 && j !== -1, `bloc « ${debut} » introuvable dans ${ou}`);
  return source.slice(i, j + fin.length);
}

// Horloge du processus figée, et DÉPLAÇABLE : la bascule de minuit se mesure
// en avançant l'heure sur une session déjà montée, sans rien recharger.
function horlogeFigee(etat) {
  const Reel = Date;
  function Fige(...a) {
    if (!new.target) return Reel(...a);
    return a.length ? new Reel(...a) : new Reel(etat.t);
  }
  Fige.prototype = Reel.prototype;
  Fige.now = () => etat.t;
  Fige.parse = Reel.parse;
  Fige.UTC = Reel.UTC;
  return Fige;
}

// Client Supabase de doublure. Il rend le fuseau du site et refuse toute
// écriture non prévue ; les écritures attendues sont journalisées telles
// quelles, c'est sur elles que porte la vérification d'enregistrement.
// `site` est RETENU : la doublure ne répond le fuseau que pour le site de
// l'employé connecté. Un écran qui irait lire le fuseau d'un autre site —
// « vito-sainte-marie » traîne encore en dur dans treize tables — n'obtient
// rien ici, et la journée qu'il en tire diverge aussitôt.
//
// 19/09/2026 — LE FUSEAU SE LIT DANS `sites.timezone`, ET `station_config`
// EST DEVENUE UN PIÈGE. Cette doublure servait le fuseau sur
// `station_config.fuseau_horaire`, colonne que la migration 20260905131500
// déclare DÉPRÉCIÉE au profit de `sites.timezone`. Elle exigeait donc du code
// livré qu'il lise la mauvaise autorité. Elle sert désormais la bonne — et
// répond sur l'ancienne un fuseau qu'aucun appareil ne résout : un lecteur
// qui y reviendrait n'obtiendrait AUCUN jour, et l'épreuve entière rougirait
// au premier scénario. Cette table n'est pas absente du banc, elle y est un
// piège.
function faireClient(fuseauSite, ecrits) {
  return {
    from(table) {
      let siteDemande = null;
      const chaine = {
        select: () => chaine, order: () => chaine, limit: () => chaine,
        eq: (col, val) => { if (col === 'site' || col === 'site_id') siteDemande = val; return chaine; },
        maybeSingle: () => Promise.resolve(
          siteDemande !== SITE_DE_L_EMPLOYE
            ? { data: null, error: null }
            : table === 'sites'
              ? { data: { timezone: fuseauSite }, error: null }
              : table === 'station_config'
                ? { data: { fuseau_horaire: 'Mars/Olympus_Mons' }, error: null }
                : { data: null, error: null }),
        insert: (row) => { ecrits.push({ table, row }); return Promise.resolve({ error: null }); },
        update: (row) => { ecrits.push({ table, row }); return chaine; },
        then: (res, rej) => Promise.resolve({ data: [], error: null }).then(res, rej),
      };
      return chaine;
    },
  };
}

const CATALOGUE = [
  { mission_id: 'M-OBL-1', titre: 'Contrôle des pistes', famille: 'Sécurité', points: 3,
    disponibilite: 'obligatoire', priority: 'haute', checklist: [], role_required: ['caissiere'] },
  { mission_id: 'M-OBL-2', titre: 'Relevé des cuves', famille: 'Carburant', points: 5,
    disponibilite: 'obligatoire', priority: 'normale', checklist: [], role_required: ['caissiere'] },
];

// Monte une session de l'écran, pour un site donné, sur une horloge donnée.
async function monterSession(fuseauSite, etatHorloge, options) {
  const demarrer = !options || options.demarrer !== false;
  const ecrits = [];
  const sandbox = {
    console: { error() {}, log() {}, warn() {} },
    Intl, JSON, Math, Promise, Object, Array, Set, Map, String, Number, Boolean,
    Date: horlogeFigee(etatHorloge),
    nexusClient: faireClient(fuseauSite, ecrits),
    // Contexte de l'employé connecté — fixtures, aucune décision de date.
    employeeId: 'emp-test', SITE_ACTUEL: SITE_DE_L_EMPLOYE,
    completionsCache: [],
    catalogue: CATALOGUE,
    EMPLOYES_SITE: [], presentsState: {}, checkState: {},
    missionsOuvertes: new Set(),
    PALIERS_MISSIONS: [10, 25, 50, 100],
    alerte: null,
    alert(msg) { sandbox.alerte = msg; },
    // Sous-rendus décoratifs et helpers sans date : doublures assumées.
    missionsDuRoleAujourdhui: () => CATALOGUE,
    estMissionControleManager: () => false,
    nbCoches: () => 0,
    priorityBadge: () => '',
    renderChecklist: () => '',
    renderPickerProduit: () => '',
    // L'écriture de complétion est éprouvée ailleurs (mandat 30) : ici on
    // mesure la DATE qu'elle reçoit, donc on la laisse écrire pour de bon
    // dans le client de doublure.
    sauvegarderCompletionSupabase: async (empId, entry) => {
      ecrits.push({ table: 'mission_completions', row: Object.assign({ employee_id: empId }, entry) });
      return { ok: true };
    },
    ecrits,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const source = [
    extraireBloc('/* NEXUS-FUSEAU-METIER:DEBUT */', '/* NEXUS-FUSEAU-METIER:FIN */', SRC_AUTH, 'nexus-auth.js'),
    'let FUSEAU_SITE = null;',
    extraireFonction('function jourMetier(', SRC_ECRAN, 'NEXUS-Missions-v1.html'),
    extraireFonction('function calculerPotentielJour(', SRC_ECRAN, 'NEXUS-Missions-v1.html'),
    extraireFonction('function calculerStatsPersonnelles(', SRC_ECRAN, 'NEXUS-Missions-v1.html'),
    extraireFonction('function toutCoche(', SRC_ECRAN, 'NEXUS-Missions-v1.html'),
    extraireFonction('function renderMissionCard(', SRC_ECRAN, 'NEXUS-Missions-v1.html'),
    extraireFonction('async function cloturerMissionAssignee(', SRC_ECRAN, 'NEXUS-Missions-v1.html'),
    `globalThis.ECRAN = {
       // L'amorçage est la ligne du fichier livré, pas une paraphrase.
       demarrer: async () => { ${extraireLigne('FUSEAU_SITE = await nexusFuseauSite(', SRC_ECRAN, 'NEXUS-Missions-v1.html')} return FUSEAU_SITE; },
       jour: (i) => jourMetier(i),
       potentiel: () => calculerPotentielJour(),
       stats: (c) => calculerStatsPersonnelles(c),
       carte: (m) => renderMissionCard(m, false),
       cloturer: (...a) => cloturerMissionAssignee(...a),
     };`,
  ].join('\n\n');

  vm.runInContext(source, sandbox, { filename: 'ecran-missions-extrait.js' });
  // Exactement ce que fait l'écran au démarrage, dans le même ordre.
  if (demarrer) await sandbox.ECRAN.demarrer();
  return sandbox;
}

// ---------------------------------------------------------------------------
// LES ÉPREUVES
// ---------------------------------------------------------------------------

async function epreuves(appareil) {
  let verts = 0;
  const rouges = [];
  const v = (quoi, fn) => {
    try { fn(); verts++; }
    catch (e) { rouges.push(`${appareil} · ${quoi} : ${e.message}`); }
  };

  // ---- 1. La station est en Martinique, l'appareil est où il veut. --------
  {
    const h = { t: INSTANT_SOIR };
    const s = await monterSession('America/Martinique', h);

    v('le soir du 18, la journée de l’écran est celle de la station', () => {
      assert.strictEqual(s.ECRAN.jour(), '2026-09-18');
    });

    // ENREGISTREMENT — la date écrite en base.
    await s.ECRAN.cloturer('assign-1', 'M-OBL-1', 'Contrôle des pistes', 3);
    const ecrite = s.ecrits.find(e => e.table === 'mission_completions');
    v('la complétion est ENREGISTRÉE au jour de la station', () => {
      assert.ok(ecrite, 'aucune complétion écrite');
      assert.strictEqual(ecrite.row.date, '2026-09-18');
    });

    // AFFICHAGE + COMPTEUR — sur le cache tel que l'écran vient de le remplir.
    v('le COMPTEUR voit la mission du soir', () => {
      const p = s.ECRAN.potentiel();
      assert.strictEqual(p.missionsObligatoiresFaites, 1, 'mission du soir non comptée');
      assert.strictEqual(p.missionsObligatoiresTotal, 2);
      assert.strictEqual(p.pointsValidesAujourdhui, 3, 'points du soir non crédités');
    });
    v('l’AFFICHAGE annonce « ✓ Validée aujourd’hui »', () => {
      assert.ok(/Validée aujourd/.test(s.ECRAN.carte(CATALOGUE[0])),
        'la carte ne montre pas la mission comme validée');
    });
    v('la mission NON faite reste proposée', () => {
      assert.ok(/btn-valider/.test(s.ECRAN.carte(CATALOGUE[1])));
    });

    // La SÉRIE se compte elle aussi en jours de station. Une seule mission,
    // celle de ce soir : la série vaut 1. Sous l'horloge UTC, la journée du
    // jour est déjà le 19, rien n'y figure, et le compteur repart d'un cran
    // en arrière — la mission de ce soir n'allume pas la série du soir.
    v('la SÉRIE compte la journée de station en cours', () => {
      const st = s.ECRAN.stats(s.completionsCache);
      assert.strictEqual(st.streak, 1, 'la mission de ce soir n’allume pas la série');
      assert.strictEqual(st.missionsSemaine, 1);
      assert.strictEqual(st.pointsSemaine, 3);
    });

    // ---- 3. La bascule de minuit, sans rechargement. ---------------------
    h.t = INSTANT_APRES_MINUIT;
    v('passé minuit à la station, la journée tourne sans rechargement', () => {
      assert.strictEqual(s.ECRAN.jour(), '2026-09-19');
    });
    v('la mission de la veille ne compte plus pour aujourd’hui', () => {
      const p = s.ECRAN.potentiel();
      assert.strictEqual(p.missionsObligatoiresFaites, 0);
      assert.strictEqual(p.pointsValidesAujourdhui, 0);
    });
    v('… et elle n’a pas été effacée', () => {
      assert.strictEqual(s.completionsCache.length, 1);
      assert.strictEqual(s.completionsCache[0].date, '2026-09-18');
    });
    // Une série ne se casse pas parce que minuit vient de sonner : la journée
    // d'hier compte encore tant que celle d'aujourd'hui n'a rien.
    v('la série survit au passage de minuit', () => {
      assert.strictEqual(s.ECRAN.stats(s.completionsCache).streak, 1);
    });
  }

  // ---- La fenêtre d'avant-chargement. ------------------------------------
  //
  // Entre l'ouverture de l'écran et la réponse de `sites`, le fuseau du site
  // n'est pas encore connu. Ce n'est pas une hypothèse : c'est une lecture
  // réseau, et l'écran vit pendant ce temps-là.
  //
  // 19/09/2026 — CE QUE CETTE ÉPREUVE EXIGE A CHANGÉ DE SENS. Elle demandait
  // qu'un jour soit quand même rendu dans cet intervalle, « replié sur la
  // station » : un fuseau écrit en dur dans nexus-auth.js, donc une troisième
  // source de vérité, et muette. Un téléphone à Auckland n'ouvrait certes pas
  // l'écran au lendemain — mais un site RÉELLEMENT hors Martinique, lui, se
  // voyait dater sur la Martinique sans que rien ne le dise, et la complétion
  // partait en base avec cette date-là. On exige désormais l'inverse : tant
  // que le fuseau n'est pas lu, il n'y a PAS de journée, et l'écran ne se
  // dessine pas (garde d'initialisation, éprouvée juste en dessous sur le
  // fichier livré).
  {
    const s = await monterSession('America/Martinique', { t: INSTANT_SOIR }, { demarrer: false });
    v('avant que le fuseau du site soit lu, l’écran n’a aucune journée', () => {
      assert.strictEqual(s.ECRAN.jour(), null,
        'une journée est datée avant toute lecture du fuseau : elle ne peut venir que d’un repli');
    });
    await s.ECRAN.demarrer();
    v('… et la journée de la station apparaît une fois le fuseau chargé', () => {
      assert.strictEqual(s.ECRAN.jour(), '2026-09-18');
    });
  }

  // ---- Le dimanche soir, la semaine ne se vide pas. ----------------------
  {
    const s = await monterSession('America/Martinique', { t: INSTANT_DIMANCHE_SOIR });
    s.completionsCache.push(
      { mission_id: 'M-OBL-1', date: '2026-09-14', points: 3 },  // lundi
      { mission_id: 'M-OBL-2', date: '2026-09-20', points: 5 }); // ce dimanche
    v('dimanche soir, la journée est encore le dimanche de la station', () => {
      assert.strictEqual(s.ECRAN.jour(), '2026-09-20');
    });
    v('… donc la semaine écoulée est toujours là', () => {
      const st = s.ECRAN.stats(s.completionsCache);
      assert.strictEqual(st.missionsSemaine, 2, 'la semaine s’est vidée au passage du dimanche');
      assert.strictEqual(st.pointsSemaine, 8);
    });
  }

  // ---- 2. Contre-épreuve : le site déclaré à Paris, même instant. --------
  {
    const s = await monterSession('Europe/Paris', { t: INSTANT_SOIR });
    v('site déclaré à Paris : la frontière se déplace avec le SITE', () => {
      assert.strictEqual(s.ECRAN.jour(), '2026-09-19');
    });
    await s.ECRAN.cloturer('assign-2', 'M-OBL-1', 'Contrôle des pistes', 3);
    const ecrite = s.ecrits.find(e => e.table === 'mission_completions');
    v('… et l’enregistrement suit ce site-là', () => {
      assert.strictEqual(ecrite.row.date, '2026-09-19');
    });
  }

  // ---- Site sans fuseau lisible : aucune journée, et l'écran se tait. ----
  //
  // Deux causes, un seul comportement : `sites` ne rend rien, ou rend un
  // fuseau que cet appareil ne sait pas résoudre. Dans les deux cas l'écran
  // n'a pas de journée — et surtout il ne s'en fabrique pas une. Jusqu'au
  // 19/09 cette boucle exigeait `'2026-09-18'`, c'est-à-dire la Martinique
  // devinée : l'épreuve rendait le repli OBLIGATOIRE pour rester verte.
  for (const cas of [null, 'Mars/Olympus_Mons']) {
    const s = await monterSession(cas, { t: INSTANT_SOIR });
    v(`fuseau du site « ${cas} » : aucune journée, aucune date devinée`, () => {
      assert.strictEqual(s.ECRAN.jour(), null,
        'l’écran date de nouveau sa journée sans savoir dans quel fuseau');
    });
    v(`fuseau du site « ${cas} » : rien n’a été écrit`, () => {
      assert.strictEqual(s.ecrits.length, 0,
        'une écriture est partie alors que la journée est indéterminée');
    });
  }

  // La garde d'initialisation, lue dans le fichier livré. `jourMetier()`
  // irrigue quatorze endroits de cet écran ; ce qui empêche une journée
  // indéterminée de s'y propager n'est pas dans `jourMetier`, c'est cet
  // arrêt-là, posé AVANT `chargerShiftAujourdhui` — sans quoi une panne de
  // lecture du fuseau passerait pour une absence de service et renverrait
  // l'employée vers la prise de poste.
  v('sans fuseau, l’écran refuse de se dessiner', () => {
    const i = SRC_ECRAN.indexOf('FUSEAU_SITE = await nexusFuseauSite(');
    assert.ok(i !== -1, 'l’écran ne lit plus le fuseau de son site');
    // L'APPEL, pas le nom : les commentaires qui expliquent pourquoi la garde
    // précède `chargerShiftAujourdhui` contiennent eux aussi ce nom, et la
    // fenêtre se refermait avant d'atteindre la garde — une garde muette.
    const j = SRC_ECRAN.indexOf('await chargerShiftAujourdhui(', i);
    assert.ok(j !== -1, 'l’écran ne charge plus le service du jour après avoir lu le fuseau');
    const entre = SRC_ECRAN.slice(i, j);
    assert.ok(/if \(!FUSEAU_SITE\) \{/.test(entre),
      'la garde a disparu, ou elle est posée après le chargement du service');
    assert.ok(/return;/.test(entre.slice(entre.indexOf('if (!FUSEAU_SITE) {'))),
      'la garde n’arrête pas l’initialisation : l’écran continue sans journée');
  });

  // ---- Garde de non-retour. ----------------------------------------------
  //
  // L'écran a DEUX circuits d'écriture de `mission_completions` : la clôture
  // d'une mission assignée, éprouvée ci-dessus, et le chemin principal du
  // bouton « Valider », qui vit au milieu d'un écouteur de 200 lignes tissé
  // de DOM et n'est pas extractible sans le réécrire — le réécrire ne
  // prouverait rien. Cette garde-ci est donc une LECTURE DU FICHIER LIVRÉ, et
  // elle est annoncée comme telle : elle atteste que les deux circuits datent
  // par la même règle, elle n'exécute pas le second.
  v('les DEUX circuits d’écriture datent par le jour du site', () => {
    const n = (SRC_ECRAN.match(/date: jourMetier\(\), heure:/g) || []).length;
    assert.strictEqual(n, 2, `attendu 2 écritures de complétion datées par le jour du site, trouvé ${n}`);
  });
  v('aucune journée de l’écran n’est reconstruite sur l’horloge UTC', () => {
    assert.ok(!/const aujISO = new Date\(\)\.toISOString\(\)/.test(SRC_ECRAN),
      'un `aujISO` UTC est réapparu dans l’écran Missions');
  });
  // UNE date UTC subsiste dans cet écran, et elle est TENUE, pas oubliée.
  // `journal_decisions` est écrite par quatre écrans (Cockpit, Scanner,
  // Centre d'Intelligence, Missions) et relue par NEXUS-Journal-v1.html avec
  // la même règle UTC : corriger le seul Missions désynchroniserait le
  // journal au lieu de le réparer. C'est un chantier à part, hors de ce lot.
  // Cette garde en fixe le compte : une troisième date UTC, où qu'elle
  // apparaisse, rougit ici.
  v('la seule date UTC restante est celle, connue, du journal de décisions', () => {
    const lignes = SRC_ECRAN.split('\n')
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => /date: new Date\(\)\.toISOString\(\)/.test(l));
    assert.strictEqual(lignes.length, 1,
      'date(s) UTC inattendue(s) ligne(s) ' + lignes.map(([n]) => n).join(', '));
    const journal = extraireFonction('async function enregistrerJournalDecision(', SRC_ECRAN, 'NEXUS-Missions-v1.html');
    assert.ok(/date: new Date\(\)\.toISOString\(\)/.test(journal),
      'la date UTC restante a quitté enregistrerJournalDecision : elle n’est plus celle qu’on tolère');
  });

  return { verts, rouges };
}

// ---------------------------------------------------------------------------
// LANCEMENT — un sous-processus par fuseau d'appareil.
// ---------------------------------------------------------------------------

if (process.env.NEXUS_APPAREIL) {
  epreuves(process.env.NEXUS_APPAREIL).then(({ verts, rouges }) => {
    rouges.forEach(r => console.log('  ✗ ' + r));
    console.log(`  ${rouges.length === 0 ? '✓' : '✗'} appareil ${process.env.NEXUS_APPAREIL} : ${verts} vert(s), ${rouges.length} rouge(s)`);
    process.exit(rouges.length === 0 ? 0 : 1);
  }).catch(e => { console.log('  ✗ ' + e.stack); process.exit(1); });
} else {
  console.log('NEXUS — la journée de l’écran Missions suit la station (18/09/2026)');
  let echec = 0;
  for (const tz of APPAREILS) {
    try {
      process.stdout.write(execFileSync(process.execPath, [__filename], {
        env: Object.assign({}, process.env, { TZ: tz, NEXUS_APPAREIL: tz }),
        encoding: 'utf8',
      }));
    } catch (e) {
      process.stdout.write((e.stdout || '') + (e.stderr || ''));
      echec = 1;
    }
  }
  console.log(echec ? 'ÉCHEC' : 'Tous les appareils datent la journée comme la station.');
  process.exit(echec);
}
