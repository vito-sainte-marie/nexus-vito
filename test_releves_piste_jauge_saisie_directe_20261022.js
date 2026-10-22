// Épreuve — 22/10/2026, lot JAUGEAGE-SAISIE-DIRECTE-20261022 (écran jaugeage des Relevés piste, et lui seul).
//   Constat : la lecture automatique n'est pas fiable ; l'écran la présentait comme le chemin normal (« elle peut tarder »,
//   « La lecture automatique a échoué »), un gros bouton « Actualiser la lecture », et une lecture tardive ne servait qu'à proposer.
// Exigences :
//   (1) après la photo : « Photo enregistrée. Saisissez les quatre volumes affichés sur l'écran du Veeder-Root. »
//       et le curseur dans le premier champ vide ;
//   (2) jamais « elle peut tarder », jamais « échec/échoué » sur cet écran ;
//   (3) « Actualiser la lecture » est un lien discret (plus un bouton plein) ;
//   (4) une lecture tardive ne remplit que les champs vides, n'écrase jamais une saisie, décoche la confirmation
//       quand elle a rempli quelque chose, et ne vole pas le curseur du pompiste.
//
// Le code est extrait du vrai NEXUS-Releves-Piste-v1.html et exécuté contre des doublures (client Supabase, DOM minimal).
// Chaque épreuve est contrôlée par une mutation : la même batterie, lancée sur la source mutée, doit rougir.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const HTML = fs.readFileSync(path.join(__dirname, 'NEXUS-Releves-Piste-v1.html'), 'utf8');
const PHRASE = 'Photo enregistrée. Saisissez les quatre volumes affichés sur l\'écran du Veeder-Root.';
const INTERDIT = /tarder|échec|échou/i;

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

// Bac à sable. `lecture` : { status, resultat } renvoyé par la table documents_ocr_file.
function bac(source, { lecture = null, actif = null } = {}) {
  const noms = ['vueJauge', 'envoyerPhoto', 'actualiserLecture', 'premierChampVide', 'focaliserPremierVide', 'fusionnerLecture', 'rendreEnGardantLeFocus'];
  const fns = {};
  for (const n of noms) fns[n] = extraireFonction(source, n);
  const journal = [];
  const document = {
    activeElement: actif ? { id: actif } : null,
    getElementById(id) { return { focus() { journal.push('focus:' + id); }, setSelectionRange() {}, value: '' }; },
    querySelector(sel) { const m = /\[data-j="([^"]+)"\]/.exec(sel); return m ? document.getElementById('j' + m[1]) : null; },
  };
  const nexusClient = {
    rpc: async () => ({ data: true, error: null }),
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    from: () => {
      const o = {
        insert: () => o, select: () => o, eq: () => o,
        single: async () => (lecture ? { data: { status: lecture.status, resultat_texte: lecture.resultat, erreur_message: null, deposited_at: '2026-10-22T06:00:00Z' }, error: null } : { data: { id: 'doc1' }, error: null }),
      };
      return o;
    },
  };
  const code = `
    let emp = { id: 'emp1', site_id: 'site1' }, date = '2026-10-22', reseau = { ok: true };
    let jauge = { statut: 'aucune', docId: null, photoLe: null, propositions: {}, saisies: {}, existant: null, confirme: false, enregistre: false, message: '' };
    ${ligneEsc(source)}
    ${extraireBloc(source, 'const CUVES = [', '\n  ];')}
    ${extraireBloc(source, 'const LIB_STATUT = {', '\n  };')}
    const V = { lireEcranVeederRoot: (t) => JSON.parse(t) };
    const R = { extensionPhoto: () => ({ ext: 'jpg', contentType: 'image/jpeg' }), precontrolePompiste: () => ({ ok: true }), causePhoto: () => ({ message: 'x', type: 'autre' }) };
    const window = { NexusCameraPage: { redimensionnerPhoto: async (f) => f } };
    const enFil = () => false, filContinuer = () => '';
    let sauvegardes = 0;
    const sauverJauge = () => { sauvegardes++; return true; };
    const rendre = () => { journal.push('rendre'); };
    ${Object.values(fns).filter(Boolean).join('\n')}
    ({ ${noms.map(n => (fns[n] ? n : `${n}: undefined`)).join(', ')}, jauge, LIB_STATUT, get sauvegardes() { return sauvegardes; }, set: (c) => eval(c) });
  `;
  const ctx = vm.createContext({ document, nexusClient, journal, Date, JSON, Object, Number, String, Array, navigator: { onLine: true }, console });
  return { api: vm.runInContext(code, ctx), journal };
}

const lectureTotale = (v) => JSON.stringify([
  { produit: 'SP', capacite_m3: 30, volume_l: v[0] }, { produit: 'GO', capacite_m3: 20, volume_l: v[1] },
  { produit: 'GO', capacite_m3: 10, volume_l: v[2] }, { produit: 'GNR', capacite_m3: 30, volume_l: v[3] },
]);

async function lancer(source) {
  const echecs = [];
  const eprouve = async (nom, f) => { try { await f(); } catch (e) { echecs.push(`${nom} — ${e.message.split('\n')[0]}`); } };

  // --- (1) message et curseur après la photo ---
  await eprouve('E1a message : après la photo, la phrase exacte est affichée', async () => {
    const { api } = bac(source);
    await api.envoyerPhoto({ name: 'p.jpg' });
    assert.strictEqual(api.jauge.statut, 'en_attente');
    const html = api.vueJauge();
    assert.ok(html.includes(PHRASE), `phrase absente : ${/id="jEtat">([^<]*)/.exec(html) && /id="jEtat">([^<]*)/.exec(html)[1]}`);
  });
  await eprouve('E1b curseur : premier champ vide après la photo (rien de saisi → SP-30)', async () => {
    const { api, journal } = bac(source);
    await api.envoyerPhoto({ name: 'p.jpg' });
    assert.ok(journal.includes('focus:jSP-30'), `journal : ${journal.join(',')}`);
  });
  await eprouve('E1c curseur : saute les champs déjà saisis', async () => {
    const { api, journal } = bac(source);
    api.jauge.saisies = { 'SP-30': '12000', 'GO-20': '8000' };
    await api.envoyerPhoto({ name: 'p.jpg' });
    assert.ok(journal.includes('focus:jGO-10'), `journal : ${journal.join(',')}`);
    assert.ok(!journal.includes('focus:jSP-30'), 'focus sur un champ déjà saisi');
  });
  await eprouve('E1d curseur : posé après le rendu (le rendu réécrit le champ)', async () => {
    const { api, journal } = bac(source);
    await api.envoyerPhoto({ name: 'p.jpg' });
    const iF = journal.lastIndexOf('focus:jSP-30'), iR = journal.lastIndexOf('rendre');
    assert.ok(iF > iR && iR >= 0, `ordre : ${journal.join(',')}`);
  });
  await eprouve('E1e curseur : aucun focus quand les quatre champs sont pleins', async () => {
    const { api, journal } = bac(source);
    api.jauge.saisies = { 'SP-30': '1', 'GO-20': '2', 'GO-10': '3', 'GNR-30': '4' };
    await api.envoyerPhoto({ name: 'p.jpg' });
    assert.ok(!journal.some(x => x.startsWith('focus:')), `focus inutile : ${journal.join(',')}`);
  });

  // --- (2) vocabulaire ---
  await eprouve('E2a vocabulaire : aucun libellé d\'état ne dit « tarder » ni « échec/échoué »', async () => {
    const { api } = bac(source);
    for (const [k, v] of Object.entries(api.LIB_STATUT)) assert.ok(!INTERDIT.test(v), `LIB_STATUT.${k} : ${v}`);
  });
  await eprouve('E2b vocabulaire : aucune vue du jaugeage ne le dit, quel que soit l\'état', async () => {
    const { api } = bac(source);
    api.jauge.docId = 'doc1';
    for (const s of ['aucune', 'envoi', 'en_attente', 'en_cours', 'traite', 'erreur', 'hors_ligne']) {
      api.jauge.statut = s;
      const m = /id="jEtat">([^<]*)/.exec(api.vueJauge());
      assert.ok(m && !INTERDIT.test(m[1]), `état ${s} : ${m && m[1]}`);
    }
  });
  await eprouve('E2c vocabulaire : le code de l\'écran jaugeage n\'écrit nulle part « tarder » ni « échec/échoué »', async () => {
    const bloc = source.slice(source.indexOf('// ---- Jaugeage Veeder-Root'), source.indexOf('function vueFini'));
    assert.ok(bloc.length > 1000, 'bloc jaugeage introuvable');
    const m = bloc.split('\n').filter(l => INTERDIT.test(l.replace(/\/\/.*$/, '')) && !/console\.error/.test(l));
    assert.deepStrictEqual(m.map(l => l.trim().slice(0, 100)), []);
  });
  await eprouve('E2d vocabulaire : l\'état « erreur » invite à saisir les quatre volumes', async () => {
    const { api } = bac(source);
    assert.ok(/Saisissez les quatre volumes/.test(api.LIB_STATUT.erreur), api.LIB_STATUT.erreur);
  });

  // --- (3) lien discret ---
  await eprouve('E3a lien : « Actualiser la lecture » est un lien discret, pas un bouton plein', async () => {
    const { api } = bac(source);
    api.jauge.docId = 'doc1';
    const m = /<(\w+)\b[^>]*data-act="jrafraichir"[^>]*>([^<]*)</.exec(api.vueJauge());
    assert.ok(m, 'élément jrafraichir absent');
    assert.ok(/Actualiser la lecture/.test(m[2]), `libellé : ${m[2]}`);
    assert.ok(/class="lien-discret"/.test(m[0]), `classe : ${m[0]}`);
    assert.ok(!/\bbtn2?\b/.test(m[0]), `style de bouton plein : ${m[0]}`);
  });
  await eprouve('E3b lien : le style .lien-discret existe et n\'est pas un aplat plein', async () => {
    const css = /\.lien-discret\{[^}]*\}/.exec(source);
    assert.ok(css, 'règle .lien-discret absente');
    assert.ok(/background:\s*none|background:\s*transparent/.test(css[0]), css[0]);
    assert.ok(/min-height:\s*44px/.test(css[0]), 'cible tactile < 44 px : ' + css[0]);
  });
  await eprouve('E3c lien : absent tant qu\'aucune photo n\'est partie', async () => {
    const { api } = bac(source);
    assert.ok(!/jrafraichir/.test(api.vueJauge()), 'lien affiché sans photo');
  });

  // --- (4) lecture tardive ---
  await eprouve('E4a fusion : une lecture tardive remplit les champs vides', async () => {
    const { api } = bac(source, { lecture: { status: 'traite', resultat: lectureTotale([11000, 9000, 4000, 2500]) } });
    api.jauge.docId = 'doc1';
    await api.actualiserLecture();
    assert.deepStrictEqual({ ...api.jauge.saisies }, { 'SP-30': '11000', 'GO-20': '9000', 'GO-10': '4000', 'GNR-30': '2500' });
  });
  await eprouve('E4b fusion : n\'écrase jamais une saisie', async () => {
    const { api } = bac(source, { lecture: { status: 'traite', resultat: lectureTotale([11000, 9000, 4000, 2500]) } });
    api.jauge.docId = 'doc1';
    api.jauge.saisies = { 'GO-20': '8123' };
    await api.actualiserLecture();
    assert.strictEqual(api.jauge.saisies['GO-20'], '8123', 'saisie écrasée');
    assert.strictEqual(api.jauge.saisies['SP-30'], '11000', 'champ vide non rempli');
  });
  await eprouve('E4c fusion : la confirmation est décochée quand la lecture a rempli un champ', async () => {
    const { api } = bac(source, { lecture: { status: 'traite', resultat: lectureTotale([11000, 9000, 4000, 2500]) } });
    api.jauge.docId = 'doc1';
    api.jauge.saisies = { 'SP-30': '1', 'GO-20': '2', 'GO-10': '3' }; api.jauge.confirme = false;
    await api.actualiserLecture();
    assert.strictEqual(api.jauge.confirme, false);
    const b = bac(source, { lecture: { status: 'traite', resultat: lectureTotale([11000, 9000, 4000, 2500]) } });
    b.api.jauge.docId = 'doc1';
    b.api.jauge.saisies = { 'SP-30': '1', 'GO-20': '2' }; b.api.jauge.confirme = true;
    await b.api.actualiserLecture();
    assert.strictEqual(b.api.jauge.confirme, false, 'confirmation conservée malgré des champs remplis');
  });
  await eprouve('E4d fusion : rien à remplir → la saisie et la confirmation restent', async () => {
    const { api } = bac(source, { lecture: { status: 'traite', resultat: lectureTotale([11000, 9000, 4000, 2500]) } });
    api.jauge.docId = 'doc1';
    api.jauge.saisies = { 'SP-30': '1', 'GO-20': '2', 'GO-10': '3', 'GNR-30': '4' }; api.jauge.confirme = true;
    await api.actualiserLecture();
    assert.deepStrictEqual({ ...api.jauge.saisies }, { 'SP-30': '1', 'GO-20': '2', 'GO-10': '3', 'GNR-30': '4' });
    assert.strictEqual(api.jauge.confirme, true);
  });
  await eprouve('E4e fusion : un volume illisible (null) ne remplit rien', async () => {
    const { api } = bac(source, { lecture: { status: 'traite', resultat: lectureTotale([null, 9000, null, 2500]) } });
    api.jauge.docId = 'doc1';
    await api.actualiserLecture();
    assert.deepStrictEqual({ ...api.jauge.saisies }, { 'GO-20': '9000', 'GNR-30': '2500' });
  });
  await eprouve('E4f fusion : une saisie vide compte pour vide, "0" pour une saisie', async () => {
    const { api } = bac(source, { lecture: { status: 'traite', resultat: lectureTotale([11000, 9000, 4000, 2500]) } });
    api.jauge.docId = 'doc1';
    api.jauge.saisies = { 'SP-30': '', 'GO-20': '0' };
    await api.actualiserLecture();
    assert.strictEqual(api.jauge.saisies['SP-30'], '11000');
    assert.strictEqual(api.jauge.saisies['GO-20'], '0');
  });
  await eprouve('E4g fusion : le brouillon local est écrit après la fusion', async () => {
    const { api } = bac(source, { lecture: { status: 'traite', resultat: lectureTotale([11000, 9000, 4000, 2500]) } });
    api.jauge.docId = 'doc1';
    const avant = api.sauvegardes;
    await api.actualiserLecture();
    assert.ok(api.sauvegardes > avant, 'sauverJauge non appelée');
  });
  await eprouve('E4h curseur : la fusion ne déplace pas le curseur du pompiste', async () => {
    const { api, journal } = bac(source, { actif: 'jGO-10', lecture: { status: 'traite', resultat: lectureTotale([11000, 9000, 4000, 2500]) } });
    api.jauge.docId = 'doc1';
    await api.actualiserLecture();
    const f = journal.filter(x => x.startsWith('focus:'));
    assert.deepStrictEqual(f, ['focus:jGO-10'], `focus : ${f.join(',')}`);
    assert.ok(journal.lastIndexOf('focus:jGO-10') > journal.lastIndexOf('rendre'), 'focus avant le rendu');
  });
  await eprouve('E4i lecture non traitée : aucune saisie touchée', async () => {
    const { api } = bac(source, { lecture: { status: 'en_cours', resultat: null } });
    api.jauge.docId = 'doc1'; api.jauge.saisies = { 'SP-30': '5' }; api.jauge.confirme = true;
    api.jauge.propositions = { 'GO-20': { volume_l: 900 } };
    await api.actualiserLecture();
    assert.deepStrictEqual({ ...api.jauge.saisies }, { 'SP-30': '5' });
    assert.strictEqual(api.jauge.confirme, true);
  });
  return echecs;
}

let n = 0;
function ok(l) { n++; console.log('OK —', l); }

(async () => {
  // 1. La vraie source doit passer toutes les épreuves.
  const echecs = await lancer(HTML);
  if (echecs.length) { echecs.forEach(e => console.error('ROUGE —', e)); console.error(`${echecs.length} épreuve(s) rouge(s) sur la source réelle.`); process.exit(1); }
  ok('la source réelle passe toutes les épreuves (E1a–e, E2a–d, E3a–c, E4a–i)');

  // 2. Mutations de contrôle : chaque mutant doit faire rougir l'épreuve visée.
  async function muter(nom, de, vers, attendu) {
    assert.ok(HTML.includes(de), `mutation « ${nom} » : ancre introuvable`);
    const mutant = HTML.replace(de, vers);
    assert.notStrictEqual(mutant, HTML);
    const e = await lancer(mutant);
    assert.ok(e.some(x => x.startsWith(attendu)), `mutation « ${nom} » : ${attendu} est restée verte (rouges : ${e.join(' | ') || 'aucun'})`);
    ok(`mutation « ${nom} » → ${attendu} rougit`);
  }
  await muter('phrase altérée', 'Photo enregistrée. Saisissez les quatre volumes affichés', 'Photo reçue. Saisissez les quatre volumes affichés', 'E1a');
  await muter('focus oublié après la photo', "if (jauge.statut === 'en_attente') focaliserPremierVide();", "", 'E1b');
  await muter('focus toujours sur le premier champ', "const c = CUVES.find(c => !jauge.saisies[c.k]); return c ? c.k : null;", "const c = CUVES[0]; return c ? c.k : null;", 'E1c');
  await muter('focus avant le rendu', "rendre(); if (jauge.statut === 'en_attente') focaliserPremierVide();", "if (jauge.statut === 'en_attente') focaliserPremierVide(); rendre();", 'E1d');
  await muter('focus sur un champ plein', "const k = premierChampVide(); if (!k) return;", "const k = premierChampVide() || CUVES[3].k;", 'E1e');
  await muter('« elle peut tarder » rétabli', "en_attente: 'Photo enregistrée. Saisissez les quatre volumes affichés sur l\\'écran du Veeder-Root.'", "en_attente: 'Photo envoyée. La lecture automatique est différée : elle peut tarder.'", 'E2a');
  await muter('« échoué » rétabli (état erreur)', "erreur: 'Lecture automatique indisponible.", "erreur: 'La lecture automatique a échoué.", 'E2a');
  await muter('« échec » dans un texte de l\'écran', "Cadrez uniquement l'écran du Veeder-Root, rien d'autre.", "En cas d'échec, cadrez l'écran du Veeder-Root.", 'E2c');
  await muter('état erreur sans invitation à saisir', "erreur: 'Lecture automatique indisponible. Saisissez les quatre volumes", "erreur: 'Lecture automatique indisponible. Reprenez les volumes", 'E2d');
  await muter('lien redevenu bouton plein', 'class="lien-discret" data-act="jrafraichir"', 'class="btn2" data-act="jrafraichir"', 'E3a');
  await muter('style lien sans cible tactile', 'min-height:44px;background:none', 'min-height:20px;background:none', 'E3b');
  await muter('lien affiché sans photo', "${jauge.docId ? '<button class=\"lien-discret\"", "${true ? '<button class=\"lien-discret\"", 'E3c');
  await muter('fusion absente', "fusionnerLecture();\n      }", "}", 'E4a');
  await muter('fusion qui écrase', "if (!jauge.saisies[c.k] && p && p.volume_l != null)", "if (p && p.volume_l != null)", 'E4b');
  await muter('confirmation conservée', "{ jauge.confirme = false; sauverJauge(); }", "{ sauverJauge(); }", 'E4c');
  await muter('confirmation décochée sans rien remplir', "if (remplis.length) { jauge.confirme = false;", "if (true) { jauge.confirme = false;", 'E4d');
  await muter('illisible rempli', "p && p.volume_l != null) { jauge.saisies", "p) { jauge.saisies", 'E4e');
  await muter('« 0 » traité comme vide', "!jauge.saisies[c.k] && p &&", "!Number(jauge.saisies[c.k]) && p &&", 'E4f');
  await muter('brouillon non écrit après fusion', "{ jauge.confirme = false; sauverJauge(); }", "{ jauge.confirme = false; }", 'E4g');
  await muter('focus rendu au premier champ vide', "document.activeElement && document.activeElement.id", "premierChampVide() && 'j' + premierChampVide()", 'E4h');
  await muter('fusion hors du cas « traité »', "        fusionnerLecture();\n      }\n    } catch", "      }\n      fusionnerLecture();\n    } catch", 'E4i');
  console.log(`\n${n} contrôles OK`);
})().catch(e => { console.error(e); process.exit(1); });
