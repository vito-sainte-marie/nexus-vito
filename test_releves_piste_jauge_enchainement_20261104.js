// Épreuve — 04/11/2026 (Guardian #160, 6632758608, demande 1) : lecture enchaînée du jaugeage, sans clic.
//   Après un envoi réussi, la file documents_ocr_file est interrogée toutes les 3 s, 90 s au plus, en lecture seule,
//   avec la requête d'« Actualiser la lecture ». Arrêt dès que le statut vaut traite ou erreur, ou quand on quitte l'écran.
//   Pendant l'attente : « Lecture de la photo en cours… ». Sans réponse à 90 s : message dédié, bouton « Actualiser la lecture » mis en avant.
//   fusionnerLecture est inchangée : rien n'est écrasé, la case « Je confirme » reste obligatoire.
// Le code est extrait du vrai NEXUS-Releves-Piste-v1.html et exécuté contre des doublures (client Supabase, horloge simulée).
// Chaque épreuve est contrôlée par une mutation : la même batterie, lancée sur la source mutée, doit rougir.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const HTML = fs.readFileSync(path.join(__dirname, 'NEXUS-Releves-Piste-v1.html'), 'utf8');
const EN_COURS = 'Lecture de la photo en cours…';
const SANS_REPONSE = 'La lecture automatique ne répond pas. Touchez Actualiser plus tard ou saisissez les volumes à la main.';

function extraireFonction(source, nom) {
  const re = new RegExp(`(?:async )?function ${nom}\\(`);
  const m = re.exec(source);
  if (!m) return null;
  assert.ok(!re.test(source.slice(m.index + m[0].length)), `Ancre non unique : ${nom}`);
  let j = source.indexOf('{', m.index) + 1, p = 1;
  while (p > 0 && j < source.length) { if (source[j] === '{') p++; else if (source[j] === '}') p--; j++; }
  return source.slice(m.index, j);
}
function extraireBloc(source, debut, fin) {
  const i = source.indexOf(debut); if (i === -1) return '';
  const j = source.indexOf(fin, i); return source.slice(i, j + fin.length);
}
const ligneEsc = (s) => (/^\s*const esc = .*$/m.exec(s) || [''])[0];
const lectureTotale = (v) => JSON.stringify([
  { produit: 'SP', capacite_m3: 30, volume_l: v[0] }, { produit: 'GO', capacite_m3: 20, volume_l: v[1] },
  { produit: 'GO', capacite_m3: 10, volume_l: v[2] }, { produit: 'GNR', capacite_m3: 30, volume_l: v[3] },
]);

// `reponses(n)` donne l'état de la file à la n-ième interrogation ; au-delà de la liste, le dernier état se répète.
function bac(source, reponses) {
  const noms = ['vueJauge', 'envoyerPhoto', 'actualiserLecture', 'premierChampVide', 'focaliserPremierVide', 'fusionnerLecture', 'rendreEnGardantLeFocus', 'arreterSonde', 'lancerSonde'];
  const fns = {};
  for (const n of noms) fns[n] = extraireFonction(source, n);
  const journal = [], ecritures = [], lectures = [];
  const document = {
    activeElement: null,
    getElementById(id) { return { focus() { journal.push('focus:' + id); }, setSelectionRange() {}, value: '' }; },
    querySelector() { return null; },
  };
  const nexusClient = {
    rpc: async (...a) => { ecritures.push('rpc'); return { data: true, error: null }; },
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    from: (table) => {
      const o = {
        insert: () => { o.ins = true; ecritures.push('insert:' + table); return o; }, update: () => { ecritures.push('update:' + table); return o; }, upsert: () => { ecritures.push('upsert:' + table); return o; }, delete: () => { ecritures.push('delete:' + table); return o; },
        select: () => o, eq: () => o,
        single: async () => {
          if (o.ins || !reponses) return { data: { id: 'doc1' }, error: null };
          const n = lectures.length; lectures.push(table);
          const r = reponses[Math.min(n, reponses.length - 1)];
          return { data: { status: r.status, resultat_texte: r.resultat || null, erreur_message: null, deposited_at: '2026-11-04T06:00:00Z' }, error: null };
        },
      };
      return o;
    },
  };
  // Horloge simulée : setTimeout empile, avancer() exécute dans l'ordre.
  const horloge = { t: 0, file: [], seq: 0 };
  const setTimeout_ = (fn, ms) => { const id = ++horloge.seq; horloge.file.push({ id, t: horloge.t + ms, fn }); return id; };
  const clearTimeout_ = (id) => { horloge.file = horloge.file.filter(x => x.id !== id); };
  const avancer = async (ms) => {
    const fin = horloge.t + ms;
    for (;;) {
      horloge.file.sort((a, b) => a.t - b.t);
      const x = horloge.file[0];
      if (!x || x.t > fin) break;
      horloge.file.shift(); horloge.t = x.t; await x.fn();
    }
    horloge.t = fin;
  };
  const code = `
    let emp = { id: '0d44032a-1b2c-4d3e-8f90-123456789abc', site_id: 'site1' }, date = '2026-11-04', reseau = { ok: true };
    let jauge = { statut: 'aucune', docId: null, photoLe: null, propositions: {}, saisies: {}, existant: null, confirme: false, enregistre: false, message: '' };
    let ecran = 'jauge', sonde = null;
    const SONDE_PAS_MS = ${(/const SONDE_PAS_MS = (\d+)/.exec(source) || [0, 3000])[1]}, SONDE_DUREE_MS = ${(/SONDE_DUREE_MS = (\d+)/.exec(source) || [0, 90000])[1]};
    ${ligneEsc(source)}
    ${extraireBloc(source, 'const CUVES = [', '\n  ];')}
    ${extraireBloc(source, 'const LIB_STATUT = {', '\n  };')}
    const V = { lireEcranVeederRoot: (t) => JSON.parse(t) };
    const R = { extensionPhoto: () => ({ ext: 'jpg', contentType: 'image/jpeg' }), precontrolePompiste: () => ({ ok: true }), causePhoto: () => ({ message: 'x', type: 'autre' }) };
    const window = { NexusCameraPage: { redimensionnerPhoto: async (f) => f }, NexusCaptureGuidee: GUIDEE };
    const nexusFuseauSite = async () => 'UTC';
    const enFil = () => false, filContinuer = () => '';
    const sauverJauge = () => true;
    const rendre = () => { journal.push('rendre'); };
    ${Object.values(fns).filter(Boolean).join('\n')}
    ({ ${noms.map(n => (fns[n] ? n : `${n}: undefined`)).join(', ')}, jauge, set: (c) => eval(c) });
  `;
  const DateSim = class extends Date { static now() { return horloge.t; } };
  const ctx = vm.createContext({ GUIDEE: require('./nexus-capture-guidee.js'), document, nexusClient, journal, Date: DateSim, JSON, Object, Number, String, Array, navigator: { onLine: true }, console, setTimeout: setTimeout_, clearTimeout: clearTimeout_ });
  return { api: vm.runInContext(code, ctx), journal, ecritures, lectures, avancer, horloge };
}

async function lancer(source) {
  const echecs = [];
  const eprouve = async (nom, f) => { try { await f(); } catch (e) { echecs.push(`${nom} — ${e.message.split('\n')[0]}`); } };
  const etat = (api) => /id="jEtat">([^<]*)/.exec(api.vueJauge())[1];
  const bouton = (api) => /<button class="([^"]*)" data-act="jrafraichir"/.exec(api.vueJauge());
  const attente = { status: 'en_attente' };

  await eprouve('P1 attente : « Lecture de la photo en cours… » tant que la file n\'a pas répondu', async () => {
    const b = bac(source, [attente]);
    await b.api.envoyerPhoto({ name: 'p.jpg' });
    assert.strictEqual(etat(b.api), EN_COURS);
    await b.avancer(9000);
    assert.strictEqual(etat(b.api), EN_COURS);
    assert.ok(b.lectures.length >= 3, `interrogations : ${b.lectures.length}`);
  });
  await eprouve('P2 cadence : une interrogation toutes les 3 s, pas avant', async () => {
    const b = bac(source, [attente]);
    await b.api.envoyerPhoto({ name: 'p.jpg' });
    await b.avancer(2999); assert.strictEqual(b.lectures.length, 0, 'interrogation avant 3 s');
    await b.avancer(1); assert.strictEqual(b.lectures.length, 1);
    await b.avancer(3000); assert.strictEqual(b.lectures.length, 2);
  });
  await eprouve('P3 arrêt sur traite : lecture proposée, plus aucune interrogation ensuite', async () => {
    const b = bac(source, [attente, attente, { status: 'traite', resultat: lectureTotale([11000, 9000, 4000, 2500]) }]);
    await b.api.envoyerPhoto({ name: 'p.jpg' });
    await b.avancer(30000);
    assert.strictEqual(b.lectures.length, 3, `interrogations : ${b.lectures.length}`);
    assert.strictEqual(b.api.jauge.statut, 'traite');
    assert.deepStrictEqual({ ...b.api.jauge.saisies }, { 'SP-30': '11000', 'GO-20': '9000', 'GO-10': '4000', 'GNR-30': '2500' });
    assert.strictEqual(b.api.jauge.sondeActive, false);
  });
  await eprouve('P4 arrêt sur erreur : plus aucune interrogation, saisie à la main proposée', async () => {
    const b = bac(source, [attente, { status: 'erreur' }]);
    await b.api.envoyerPhoto({ name: 'p.jpg' });
    await b.avancer(60000);
    assert.strictEqual(b.lectures.length, 2, `interrogations : ${b.lectures.length}`);
    assert.strictEqual(b.api.jauge.statut, 'erreur');
    assert.ok(/Saisissez les quatre volumes/.test(etat(b.api)), etat(b.api));
    assert.strictEqual(b.api.jauge.sondeActive, false);
  });
  await eprouve('P5 délai de 90 s : message dédié, bouton mis en avant, plus d\'interrogation', async () => {
    const b = bac(source, [attente]);
    await b.api.envoyerPhoto({ name: 'p.jpg' });
    await b.avancer(89000);
    assert.strictEqual(etat(b.api), EN_COURS, 'message de délai trop tôt');
    assert.ok(/lien-discret/.test(bouton(b.api)[1]), 'bouton déjà en avant avant 90 s');
    await b.avancer(2000);
    assert.strictEqual(etat(b.api), SANS_REPONSE);
    assert.ok(!/lien-discret/.test(bouton(b.api)[1]) && /btn2/.test(bouton(b.api)[1]), `classe : ${bouton(b.api)[1]}`);
    const n = b.lectures.length;
    assert.ok(n >= 29 && n <= 31, `interrogations sur 90 s : ${n}`);
    await b.avancer(300000);
    assert.strictEqual(b.lectures.length, n, 'interrogation après le délai');
  });
  await eprouve('P6 lecture seule : la sonde n\'écrit rien (ni insert, update, upsert, delete, rpc) ', async () => {
    const b = bac(source, [attente, attente, { status: 'traite', resultat: lectureTotale([1, 2, 3, 4]) }]);
    await b.api.envoyerPhoto({ name: 'p.jpg' });
    const avant = b.ecritures.length; // l'insert d'envoi est déjà compté
    await b.avancer(120000);
    assert.deepStrictEqual(b.ecritures.slice(avant), []);
  });
  await eprouve('P7 saisie intacte : une lecture tardive n\'écrase rien, la confirmation reste à cocher', async () => {
    const b = bac(source, [attente, { status: 'traite', resultat: lectureTotale([11000, 9000, 4000, 2500]) }]);
    await b.api.envoyerPhoto({ name: 'p.jpg' });
    b.api.jauge.saisies = { 'GO-20': '8123' }; b.api.jauge.confirme = true;
    await b.avancer(10000);
    assert.strictEqual(b.api.jauge.saisies['GO-20'], '8123', 'saisie écrasée');
    assert.strictEqual(b.api.jauge.saisies['SP-30'], '11000');
    assert.strictEqual(b.api.jauge.confirme, false, 'confirmation conservée alors que des champs ont été remplis');
  });
  await eprouve('P8 saisie intacte : sans changement de statut, l\'écran n\'est pas réécrit (le curseur reste au pompiste)', async () => {
    const b = bac(source, [attente]);
    await b.api.envoyerPhoto({ name: 'p.jpg' });
    const rendus = b.journal.filter(x => x === 'rendre').length;
    await b.avancer(60000);
    assert.strictEqual(b.journal.filter(x => x === 'rendre').length, rendus, 'écran réécrit pendant une attente inchangée');
  });
  await eprouve('P9 page quittée : plus aucune interrogation', async () => {
    const b = bac(source, [attente]);
    await b.api.envoyerPhoto({ name: 'p.jpg' });
    await b.avancer(7000);
    const n = b.lectures.length;
    b.api.set("ecran = 'choix'");
    await b.avancer(120000);
    assert.ok(b.lectures.length <= n + 1, `interrogations après sortie : ${b.lectures.length - n}`);
    assert.strictEqual(b.api.jauge.sondeActive, false, 'sonde encore active');
  });
  await eprouve('P10 pagehide : la sonde est arrêtée à la fermeture de la page', async () => {
    assert.ok(/addEventListener\('pagehide',\s*arreterSonde\)/.test(source), 'écouteur pagehide absent');
    const b = bac(source, [attente]);
    await b.api.envoyerPhoto({ name: 'p.jpg' });
    b.api.arreterSonde();
    await b.avancer(120000);
    assert.strictEqual(b.lectures.length, 0);
  });
  await eprouve('P11 nouvelle photo : une seule sonde, l\'ancienne est remplacée', async () => {
    const b = bac(source, [attente]);
    await b.api.envoyerPhoto({ name: 'p.jpg' });
    await b.api.envoyerPhoto({ name: 'q.jpg' });
    await b.avancer(30000);
    assert.strictEqual(b.lectures.length, 10, `interrogations : ${b.lectures.length}`);
  });
  return echecs;
}

let n = 0;
function ok(l) { n++; console.log('OK —', l); }

(async () => {
  const echecs = await lancer(HTML);
  if (echecs.length) { echecs.forEach(e => console.error('ROUGE —', e)); console.error(`${echecs.length} épreuve(s) rouge(s) sur la source réelle.`); process.exit(1); }
  ok('la source réelle passe toutes les épreuves (P1–P11)');

  async function muter(nom, de, vers, attendu) {
    const paires = Array.isArray(de) ? de.map((d, i) => [d, vers[i]]) : [[de, vers]];
    let mutant = HTML;
    for (const [d, v] of paires) { assert.ok(mutant.includes(d), `mutation « ${nom} » : ancre introuvable`); mutant = mutant.replace(d, v); }
    assert.notStrictEqual(mutant, HTML);
    const e = await lancer(mutant);
    assert.ok(e.some(x => x.startsWith(attendu)), `mutation « ${nom} » : ${attendu} est restée verte (rouges : ${e.join(' | ') || 'aucun'})`);
    ok(`mutation « ${nom} » → ${attendu} rougit`);
  }
  await muter('libellé d\'attente altéré', "'Lecture de la photo en cours…'", "'Lecture en cours…'", 'P1');
  await muter('sonde jamais lancée', "if (jauge.statut === 'en_attente') lancerSonde();", "", 'P1');
  await muter('pas de 1 s', "SONDE_PAS_MS = 3000", "SONDE_PAS_MS = 1000", 'P2');
  await muter('pas d\'arrêt sur traite', "if (jauge.statut === 'traite' || jauge.statut === 'erreur') { arreterSonde();", "if (jauge.statut === 'erreur') { arreterSonde();", 'P3');
  await muter('pas d\'arrêt sur erreur', "if (jauge.statut === 'traite' || jauge.statut === 'erreur') { arreterSonde();", "if (jauge.statut === 'traite') { arreterSonde();", 'P4');
  await muter('délai porté à 10 min', "SONDE_DUREE_MS = 90000", "SONDE_DUREE_MS = 600000", 'P5');
  await muter('message de délai altéré', "La lecture automatique ne répond pas. Touchez", "La lecture est lente. Touchez", 'P5');
  await muter('bouton jamais mis en avant', "jauge.rattrapage && jauge.statut", "false && jauge.statut", 'P5');
  await muter('la sonde écrit', "await actualiserLecture({ sonde: true });", "await actualiserLecture({ sonde: true }); await nexusClient.from('documents_ocr_file').update({}).eq('id', jauge.docId);", 'P6');
  await muter('fusion qui écrase', "if (!jauge.saisies[c.k] && p && p.volume_l != null)", "if (p && p.volume_l != null)", 'P7');
  await muter('confirmation conservée', "{ jauge.confirme = false; sauverJauge(); }", "{ sauverJauge(); }", 'P7');
  await muter('écran réécrit à chaque tour', "if (opts && opts.sonde && jauge.statut === avant && jauge.message === msgAvant) return;", "", 'P8');
  await muter('sortie d\'écran ignorée', "if (ecran !== 'jauge' || jauge.enregistre) { arreterSonde(); return; }", "", 'P9');
  await muter('pagehide absent', "window.addEventListener('pagehide', arreterSonde);", "", 'P10');
  await muter('ancienne sonde non arrêtée', ["function lancerSonde() {\n    arreterSonde();", "async function envoyerPhoto(fichier) {\n    arreterSonde();", "const tour = async () => {\n      if (sonde !== s) return;"], ["function lancerSonde() {", "async function envoyerPhoto(fichier) {", "const tour = async () => {"], 'P11');
  console.log(`${n} contrôles OK`);
})().catch(e => { console.error(e); process.exit(1); });
