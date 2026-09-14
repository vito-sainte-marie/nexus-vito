/*
 * La clôture de pause au départ se compte par SERVICE, pas par journée.
 * ============================================================================
 * LE DÉFAUT, relevé le 13/09/2026 au soir en relisant le chemin du départ.
 * Le matin même, la relecture anti-doublon du pointage principal et le rejeu de
 * la file avaient quitté la portée « par journée » pour la portée « par
 * service ». Une troisième relecture était restée en arrière :
 *
 *     .eq('employee_id', employee.id).eq('date', today).eq('type', 'pause_fin')
 *
 * Elle garde l'écriture de la fin de pause posée à l'heure du départ (règle 6).
 * Sur deux services du même employé le même jour, le premier ayant sa pause
 * refermée, elle retrouvait CETTE fin-là, concluait « déjà fait » et sautait
 * l'écriture. Le départ s'enregistrait seul. La pause du second service restait
 * ouverte pour toujours, et rien ne le disait : la journée close montrait trois
 * pointages pour quatre gestes.
 *
 * Même famille que les défauts corrigés dans 1ef8e14 : une règle changée dans
 * l'écran, pas partout où elle s'applique.
 *
 * CETTE ÉPREUVE NE LIT PAS SEULEMENT LA SOURCE, ELLE LA JOUE. Le bloc de
 * clôture est extrait de l'écran et exécuté contre une base simulée qui
 * applique vraiment les filtres demandés, l'unicité
 * `pointages_un_par_service_et_type` et le refus `nexus_pointage_exige_service`.
 * Un filtre par date trouve la fin du premier service et n'écrit rien : le §1
 * échoue alors, sans qu'aucun motif de texte n'ait à être devine.
 *
 * TÉMOIN DE MUTATION : NEXUS_SOURCE_POINTAGE=<fichier> node ce-test.js
 * rejoue l'épreuve sur une autre version de l'écran. Sur le fichier d'avant
 * correction, le §1 doit échouer. Une garde qui ne distingue pas les deux
 * versions ne garde rien.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CHEMIN = process.env.NEXUS_SOURCE_POINTAGE
  ? path.resolve(process.env.NEXUS_SOURCE_POINTAGE)
  : path.join(__dirname, 'NEXUS-Pointage-v1.html');
const SOURCE = fs.readFileSync(CHEMIN, 'utf8');

let reussites = 0, echecs = 0;
function verifier(nom, condition, detail) {
  if (condition) { reussites++; console.log(`  ✓ ${nom}`); }
  else { echecs++; console.log(`  ✗ ${nom}${detail ? '\n      ' + detail : ''}`); }
}

// ── Le bloc réel, extrait de l'écran ────────────────────────────────────────
// L'ancre de fin est le désarmement final, indenté de six espaces : celui qui
// est à l'intérieur du traitement d'erreur en porte dix et ne peut pas être
// confondu avec lui.
const BLOC = SOURCE.match(
  /if \(type === 'depart' && cloturerPauseAuDepart\) \{[\s\S]*?\n      cloturerPauseAuDepart = false;\n    \}/);

console.log('\n── 0 · Le bloc de clôture est bien là où on le joue ──');
verifier('le bloc de clôture de pause au départ est extractible', !!BLOC,
  'sans lui, les sections suivantes ne prouveraient rien');
if (!BLOC) {
  console.log('\n✗ bloc introuvable : épreuve interrompue\n');
  process.exit(1);
}

const jouerBloc = new Function(
  'nexusClient', 'employee', 'today', 'type', 'siteId', 'heure', 'serviceDuJour',
  'identifiantTentative', 'document', 'console', 'cloturerPauseAuDepart',
  `return (async () => { ${BLOC[0]} return { poursuite: true, desarme: cloturerPauseAuDepart }; })();`);

// ── La base simulée ─────────────────────────────────────────────────────────
// Elle applique les filtres reçus, pas ceux qu'on aurait souhaités. C'est tout
// l'intérêt : le code décide quoi demander, la base répond à la question posée.
function base(pointages) {
  const journal = { requetes: [], insertions: [] };
  const client = {
    from() {
      const filtres = {};
      const req = {
        select() { return req; },
        eq(colonne, valeur) { filtres[colonne] = valeur; return req; },
        limit() {
          journal.requetes.push({ ...filtres });
          const data = pointages.filter(p =>
            Object.entries(filtres).every(([c, v]) => p[c] === v));
          return Promise.resolve({ data, error: null });
        },
        insert(ligne) {
          journal.insertions.push(ligne);
          // `nexus_pointage_exige_service` (11/09) : sans service, refus sec.
          if (!ligne.service_id) {
            return Promise.resolve({ error: { code: '23502', message: 'service_id NOT NULL' } });
          }
          // `pointages_un_par_service_et_type` (11/09).
          const collision = pointages.some(p => p.service_id === ligne.service_id
            && p.employee_id === ligne.employee_id && p.type === ligne.type);
          if (collision) {
            return Promise.resolve({ error: { code: '23505', message: 'doublon service/type' } });
          }
          pointages.push({ ...ligne });
          return Promise.resolve({ error: null });
        },
      };
      return req;
    },
  };
  return { client, journal, pointages };
}

const EMPLOYE = { id: 'emp-test-b' };
const JOUR = '2026-09-13';
const SERVICE_A = 'service-du-midi';
const SERVICE_B = 'service-du-soir';
const bandeau = { textContent: '', className: '' };
const faussDocument = { getElementById: () => bandeau };
const silence = { error() {}, log() {}, warn() {} };

function departAvecPauseOuverte(pointages, service) {
  const { client, journal } = base(pointages);
  return jouerBloc(client, EMPLOYE, JOUR, 'depart', 'site-test', '21:45:00',
    service, () => 'evenement-client-neuf', faussDocument, silence, true)
    .then(sortie => ({ sortie, journal, pointages }));
}

(async () => {
  // ── 1 · LE DÉFAUT LUI-MÊME ────────────────────────────────────────────────
  console.log('\n── 1 · Deux services le même jour, une pause refermée sur le premier ──');
  // Exactement la forme mesurée sur Test le 13/09 : un service du midi clos
  // avec sa pause refermée, puis un second service ouvert dont la pause court
  // encore. Le départ est pointé sur le second.
  const journee = [
    { employee_id: EMPLOYE.id, service_id: SERVICE_A, type: 'arrivee', date: JOUR, heure: '12:27:58' },
    { employee_id: EMPLOYE.id, service_id: SERVICE_A, type: 'pause_debut', date: JOUR, heure: '12:29:00' },
    { employee_id: EMPLOYE.id, service_id: SERVICE_A, type: 'pause_fin', date: JOUR, heure: '12:31:00' },
    { employee_id: EMPLOYE.id, service_id: SERVICE_A, type: 'depart', date: JOUR, heure: '12:32:05' },
    { employee_id: EMPLOYE.id, service_id: SERVICE_B, type: 'arrivee', date: JOUR, heure: '19:50:13' },
    { employee_id: EMPLOYE.id, service_id: SERVICE_B, type: 'pause_debut', date: JOUR, heure: '19:50:27' },
  ];
  const cas1 = await departAvecPauseOuverte(journee, { id: SERVICE_B, quart: 'matin' });
  const finsB = cas1.pointages.filter(p => p.service_id === SERVICE_B && p.type === 'pause_fin');

  verifier('la fin de pause du SECOND service est bien écrite', finsB.length === 1,
    'la pause_fin du premier service a été prise pour celle du second : '
    + 'la pause resterait ouverte derrière un départ enregistré');
  verifier('elle porte le service du départ, pas celui du midi',
    finsB.length === 1 && finsB[0].service_id === SERVICE_B);
  verifier('elle porte l’heure du départ, aucune durée supposée',
    finsB.length === 1 && finsB[0].heure === '21:45:00');
  verifier('le départ peut suivre : le bloc ne coupe pas le chemin',
    cas1.sortie.poursuite === true);
  verifier('la fin de pause du premier service est intacte',
    cas1.pointages.filter(p => p.service_id === SERVICE_A && p.type === 'pause_fin').length === 1);
  verifier('la relecture a interrogé le service, pas la date',
    cas1.journal.requetes.length === 1
    && cas1.journal.requetes[0].service_id === SERVICE_B
    && cas1.journal.requetes[0].date === undefined,
    'filtres réellement envoyés : ' + JSON.stringify(cas1.journal.requetes));

  // ── 2 · Ce que la correction ne doit pas casser ────────────────────────────
  console.log('\n── 2 · Une pause déjà refermée sur CE service n’est pas refermée deux fois ──');
  const dejaFermee = [
    { employee_id: EMPLOYE.id, service_id: SERVICE_B, type: 'arrivee', date: JOUR, heure: '19:50:13' },
    { employee_id: EMPLOYE.id, service_id: SERVICE_B, type: 'pause_debut', date: JOUR, heure: '19:50:27' },
    { employee_id: EMPLOYE.id, service_id: SERVICE_B, type: 'pause_fin', date: JOUR, heure: '20:10:00' },
  ];
  const cas2 = await departAvecPauseOuverte(dejaFermee, { id: SERVICE_B, quart: 'matin' });
  verifier('aucune seconde fin de pause n’est écrite',
    cas2.pointages.filter(p => p.type === 'pause_fin').length === 1);
  verifier('rien n’a été tenté en écriture', cas2.journal.insertions.length === 0,
    'une tentative aurait été refusée par l’unicité, et le départ perdu avec elle');
  verifier('le départ peut suivre', cas2.sortie.poursuite === true);

  console.log('\n── 3 · Le parcours de ce soir : un seul service, pause ouverte ──');
  const cas3 = await departAvecPauseOuverte([
    { employee_id: EMPLOYE.id, service_id: SERVICE_B, type: 'arrivee', date: JOUR, heure: '19:50:13' },
    { employee_id: EMPLOYE.id, service_id: SERVICE_B, type: 'pause_debut', date: JOUR, heure: '19:50:27' },
  ], { id: SERVICE_B, quart: 'matin' });
  const fin3 = cas3.pointages.find(p => p.type === 'pause_fin');
  verifier('la fin de pause est écrite', !!fin3);
  verifier('elle porte le quart du service, jamais un quart inventé',
    !!fin3 && fin3.quart === 'matin');
  verifier('elle porte un client_event_id', !!fin3 && !!fin3.client_event_id);
  verifier('elle ne porte aucune photo et aucun retard',
    !!fin3 && fin3.photo_url === null && fin3.retard_min === 0
    && fin3.photo_echec_technique === false);
  verifier('elle est écrite AVANT le départ',
    cas3.journal.insertions.length === 1 && cas3.journal.insertions[0].type === 'pause_fin');

  console.log('\n── 4 · Si la base refuse la fin de pause, le départ n’est pas pointé ──');
  // Règle 6 : mieux vaut un départ à repointer qu'une pause laissée ouverte
  // derrière un départ enregistré. On force le refus en retirant le service.
  const cas4 = await departAvecPauseOuverte([
    { employee_id: EMPLOYE.id, service_id: SERVICE_B, type: 'pause_debut', date: JOUR, heure: '19:50:27' },
  ], { id: null, quart: 'matin' });
  verifier('le bloc interrompt le chemin du départ', cas4.sortie.poursuite === undefined,
    'sortie obtenue : ' + JSON.stringify(cas4.sortie));
  verifier('l’employée est prévenue que son départ n’est pas pointé',
    /départ n'a pas été pointé/.test(bandeau.textContent), bandeau.textContent);
  verifier('le bandeau est rendu visible', /show/.test(bandeau.className), bandeau.className);

  // ── 5 · La règle est la même sur les trois chemins d’écriture ─────────────
  console.log('\n── 5 · Une seule portée, trois chemins d’écriture ──');
  verifier('la relecture de la fin de pause cible (employé, service, type)',
    /\.eq\('employee_id', employee\.id\)\.eq\('service_id', serviceDuJour\.id\)\.eq\('type', 'pause_fin'\)/.test(SOURCE),
    'c’est le défaut de cette épreuve : elle ciblait la date');
  verifier('la relecture du pointage principal cible le service',
    /\.eq\('employee_id', employee\.id\)\.eq\('service_id', serviceDuJour\.id\)\.eq\('type', type\)/.test(SOURCE));
  verifier('le rejeu de la file cible le service',
    /\.eq\('service_id', entree\.ligne\.service_id\)\.eq\('type', entree\.ligne\.type\)/.test(SOURCE));
  verifier('la file déduplique par service',
    /e\.ligne\.service_id === ligne\.service_id && e\.ligne\.type === ligne\.type/.test(SOURCE));
  verifier('aucun chemin d’écriture ne déduplique plus par (date, type)',
    !/\.eq\('date', today\)\.eq\('type'/.test(SOURCE),
    'il en reste un : ' + (SOURCE.match(/\.eq\('date', today\)\.eq\('type'[^\n]*/) || [''])[0]);

  console.log('\n── 6 · Ce qui reste lu par journée l’est volontairement ──');
  // L'historique affiché est celui de la journée, et doit le rester : c'est le
  // contexte que l'employée veut voir. Ce qui est « déjà fait », lui, se compte
  // par service. Les deux lectures coexistent et ne se confondent pas.
  verifier('l’historique du jour est toujours chargé par date',
    /\.eq\('employee_id', employee\.id\)\.eq\('date', today\)/.test(SOURCE));
  verifier('mais « déjà fait » reste filtré sur le service courant',
    /\.filter\(p => serviceCourant && p\.service_id === serviceCourant\.id\)/.test(SOURCE));

  console.log(`\n${echecs === 0 ? '✓' : '✗'} ${reussites} réussite(s), ${echecs} échec(s)`);
  console.log(`   source jouée : ${path.basename(CHEMIN)}\n`);
  // Sortie d'échec explicite, jamais cachée dans un ternaire : Guardian QA lit
  // ce code sans l'exécuter, et il a raison de l'exiger.
  if (echecs > 0) process.exit(1);
})().catch(e => {
  console.error('\n✗ épreuve interrompue :', e && e.stack ? e.stack : e, '\n');
  process.exit(1);
});
