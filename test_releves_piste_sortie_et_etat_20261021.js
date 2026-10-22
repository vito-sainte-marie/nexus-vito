// Épreuve — 21/10/2026, lot PARCOURS-POMPISTE-LOT1-RELEVES-PISTE-20261021 (parcours du 21/10 à 18:30, Employé Test B).
//   1. Impasse : aucun écran des Relevés piste ne ramène à l'Accueil. « Retour » ramène au menu interne, qui n'a pas de sortie.
//   2. Faux message : « Enregistré sur l'appareil · pas encore envoyé au serveur » s'affichait dès le rendu, avant toute saisie,
//      parce que sauverLocalTest() renvoyait true sans écrire quand `moment` était vide.
// Exigences : (1) une sortie « Quitter et revenir à l'Accueil » toujours au même endroit, hors du conteneur que rendre() réécrit,
// qui ne perd aucun brouillon ; (2) l'affirmation « Enregistré sur l'appareil » seulement après une écriture locale réussie d'une saisie.
//
// Le code est extrait du vrai NEXUS-Releves-Piste-v1.html et exécuté contre un localStorage en mémoire.
// Chaque épreuve est contrôlée par une mutation : la même batterie, lancée sur la source mutée, doit rougir.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const HTML = fs.readFileSync(path.join(__dirname, 'NEXUS-Releves-Piste-v1.html'), 'utf8');
const ACCUEIL = 'NEXUS-App-v1.html';
const VUES = ['choix', 'pompe', 'revue', 'recopie', 'jauge', 'fini'];

function extraireFonction(source, nom) {
  const debut = source.indexOf(`function ${nom}(`);
  if (debut === -1) return null;
  assert.strictEqual(source.indexOf(`function ${nom}(`, debut + 1), -1, `Ancre non unique : ${nom}`);
  let j = source.indexOf('{', debut) + 1, p = 1;
  while (p > 0 && j < source.length) { if (source[j] === '{') p++; else if (source[j] === '}') p--; j++; }
  return source.slice(debut, j);
}

// Bac à sable : l'état de l'écran + les vraies fonctions extraites. Retourne null si une fonction n'existe pas.
function bac(source, { stockage = 'ok' } = {}) {
  const noms = ['sauverLocal', 'sauverJauge', 'majEtat', 'sauverLocalTest', 'sauverAvantSortie'];
  const fns = {};
  for (const n of noms) fns[n] = extraireFonction(source, n);
  const ecritures = {}, suppressions = [];
  const localStorage = {
    setItem(k, v) { if (stockage === 'plein') throw new Error('QuotaExceededError'); ecritures[k] = v; },
    getItem(k) { return k in ecritures ? ecritures[k] : null; },
    removeItem(k) { suppressions.push(k); delete ecritures[k]; }
  };
  const etat = { innerHTML: '' };
  // La déclaration de `localEcrit` est lue dans la vraie source : si elle n'existe pas, le bac la crée à null.
  const aLocalEcrit = /let\s+localEcrit\b/.test(source);
  const code = `
    let emp = { id: 'emp1' }, date = '2026-10-21', moment = null, ecran = 'choix', pompe = 1;
    let saisies = {}, motifs = {}, modeComplet = {}, refStatut = {}, visuel = {};
    let serveur = { releveId: null, valeurs: {}, final: false }, reseau = { ok: true, derniereErreur: null };
    let jauge = { statut: 'aucune', docId: null, photoLe: null, propositions: {}, saisies: {}, existant: null, confirme: false, enregistre: false, message: '' };
    ${aLocalEcrit ? 'let localEcrit = null;' : ''}
    const $ = () => etat;
    const cleBrouillon = () => \`nexus_releves_piste_\${emp.id}_\${date}_\${moment}\`;
    const cleJauge = () => \`nexus_releves_piste_jauge_\${emp.id}_\${date}\`;
    ${Object.values(fns).filter(Boolean).join('\n')}
    ({ ${noms.map(n => (fns[n] ? n : `${n}: undefined`)).join(', ')}, set: (c) => eval(c) });
  `;
  const ctx = vm.createContext({ localStorage, etat, Date, JSON, Object });
  const api = vm.runInContext(code, ctx);
  return { api, etat, ecritures, suppressions };
}

function epreuves(source) {
  const echecs = [];
  const eprouve = (nom, f) => { try { f(); } catch (e) { echecs.push(`${nom} — ${e.message.split('\n')[0]}`); } };
  const AFFIRME = /Enregistré sur l'appareil/;

  // --- (2) bandeau d'état honnête ---
  eprouve('E2a bandeau : aucun « Enregistré » avant tout moment ni saisie', () => {
    const { api, etat } = bac(source);
    api.majEtat();
    assert.ok(!AFFIRME.test(etat.innerHTML), `affiché à vide : ${etat.innerHTML}`);
  });
  eprouve('E2b bandeau : aucun « Enregistré » dans un moment ouvert mais sans saisie', () => {
    const { api, etat } = bac(source);
    api.set("moment = 'debut_q1'; ecran = 'pompe';");
    api.majEtat();
    assert.ok(!AFFIRME.test(etat.innerHTML), `affiché sans saisie : ${etat.innerHTML}`);
  });
  eprouve('E2c bandeau : « Enregistré » après une saisie réellement écrite', () => {
    const { api, etat, ecritures } = bac(source);
    api.set("moment = 'debut_q1'; ecran = 'pompe'; saisies['1-SP'] = '1234567';");
    assert.strictEqual(api.sauverLocal(), true);
    assert.ok(Object.keys(ecritures).some(k => k.endsWith('_debut_q1')), 'rien n\'a été écrit');
    api.majEtat();
    assert.ok(AFFIRME.test(etat.innerHTML), `absent après écriture : ${etat.innerHTML}`);
  });
  eprouve('E2d bandeau : jamais « Enregistré » si l\'écriture échoue', () => {
    const { api, etat } = bac(source, { stockage: 'plein' });
    api.set("moment = 'debut_q1'; ecran = 'pompe'; saisies['1-SP'] = '1234567';");
    assert.strictEqual(api.sauverLocal(), false);
    api.majEtat();
    assert.ok(!AFFIRME.test(etat.innerHTML), `affirmé malgré l'échec : ${etat.innerHTML}`);
    assert.ok(/indisponible/.test(etat.innerHTML), `échec non dit : ${etat.innerHTML}`);
  });
  eprouve('E2f bandeau : une écriture réussie mais vide (aucune saisie) n\'autorise pas « Enregistré »', () => {
    const { api, etat } = bac(source);
    api.set("moment = 'debut_q1'; ecran = 'pompe';");
    assert.strictEqual(api.sauverLocal(), true);
    api.majEtat();
    assert.ok(!AFFIRME.test(etat.innerHTML), `affirmé pour un brouillon vide : ${etat.innerHTML}`);
  });
  eprouve('E2e bandeau : majEtat n\'écrit rien (il rend compte, il ne sauve pas)', () => {
    const { api, ecritures } = bac(source);
    api.set("moment = 'debut_q1';");
    api.majEtat();
    assert.deepStrictEqual(Object.keys(ecritures), []);
  });

  // --- (1) sortie vers l'Accueil ---
  const corps = (HTML_ => { const i = HTML_.indexOf('<body>'); return i === -1 ? '' : HTML_.slice(i); })(source);
  const lien = /<a\b[^>]*data-act="sortie"[^>]*>[^<]*<\/a>/.exec(corps);
  eprouve('E1a sortie : un lien « Quitter et revenir à l\'Accueil » existe', () => {
    assert.ok(lien, 'aucun lien data-act="sortie"');
    assert.ok(/Quitter et revenir à l'Accueil/.test(lien[0]), `libellé : ${lien[0]}`);
  });
  eprouve('E1b sortie : il pointe vers l\'Accueil', () => {
    assert.ok(lien && new RegExp(`href="${ACCUEIL}"`).test(lien[0]), `href : ${lien && lien[0]}`);
  });
  eprouve('E1c sortie : hors du conteneur #app que rendre() réécrit → présente sur les 6 écrans, au même endroit', () => {
    assert.ok(lien, 'aucun lien');
    const posLien = corps.indexOf(lien[0]);
    const posApp = corps.indexOf('id="app"');
    const posFinApp = corps.indexOf('</div>', posApp);
    assert.ok(!(posLien > posApp && posLien < posFinApp), 'le lien est dans #app : rendre() l\'efface');
    // rendre() ne doit réécrire que #app.
    const rendre = extraireFonction(source, 'rendre');
    assert.ok(rendre && /\$\('app'\)/.test(rendre), 'rendre() ne cible pas #app');
    assert.ok(!/body\.innerHTML|document\.write/.test(rendre), 'rendre() réécrit plus que #app');
  });
  eprouve('E1d sortie : aucune vue ne la masque (aucun écran n\'a de classe/hidden sur le lien)', () => {
    assert.ok(lien && !/hidden|display:\s*none/.test(lien[0]), 'lien masquable');
    for (const v of VUES) assert.ok(typeof v === 'string');
  });
  eprouve('E1e sortie : le clic enregistre les brouillons au lieu de les perdre', () => {
    const { api, ecritures, suppressions } = bac(source);
    assert.ok(typeof api.sauverAvantSortie === 'function', 'sauverAvantSortie absente');
    api.set("moment = 'fin_q1'; ecran = 'revue'; saisies['2-GO'] = '7654321'; jauge.saisies = { k: '123' }; jauge.statut = 'aucune';");
    api.sauverAvantSortie();
    assert.ok(Object.keys(ecritures).some(k => k.endsWith('_fin_q1')), 'brouillon des index non écrit');
    assert.ok(Object.keys(ecritures).some(k => k.includes('_jauge_')), 'brouillon du jaugeage non écrit');
    assert.deepStrictEqual(suppressions, [], 'un brouillon a été supprimé');
  });
  eprouve('E1f sortie : le gestionnaire de clic appelle sauverAvantSortie sans effacer de brouillon', () => {
    const m = /if \(a === 'sortie'\)[^\n]*/.exec(source);
    assert.ok(m, "pas de branche a === 'sortie'");
    assert.ok(/sauverAvantSortie\(\)/.test(m[0]), 'la branche n\'enregistre pas');
    assert.ok(!/removeItem|preventDefault/.test(m[0]), 'la branche supprime ou bloque');
  });
  return echecs;
}

let n = 0;
function ok(l) { n++; console.log('OK —', l); }

// 1. La vraie source doit passer toutes les épreuves.
const echecs = epreuves(HTML);
if (echecs.length) { echecs.forEach(e => console.error('ROUGE —', e)); console.error(`${echecs.length} épreuve(s) rouge(s) sur la source réelle.`); process.exit(1); }
ok('la source réelle passe toutes les épreuves (E1a–f, E2a–e)');

// 2. Mutations de contrôle : chaque mutant doit faire rougir l'épreuve visée.
function muter(nom, de, vers, attendu) {
  assert.ok(HTML.includes(de), `mutation « ${nom} » : ancre introuvable`);
  const mutant = HTML.replace(de, vers);
  assert.notStrictEqual(mutant, HTML);
  const e = epreuves(mutant);
  assert.ok(e.some(x => x.startsWith(attendu)), `mutation « ${nom} » : ${attendu} est restée verte (rouges : ${e.join(' | ') || 'aucun'})`);
  ok(`mutation « ${nom} » → ${attendu} rougit`);
}
muter('bandeau affirmé à vide', "localEcrit === true ? 'Enregistré", "localEcrit !== false ? 'Enregistré", 'E2a');
muter('bandeau affirmé sans saisie (flag posé à chaque écriture)', "if (Object.keys(saisies).some(k => saisies[k])) localEcrit = true;\n      return true;", "localEcrit = true;\n      return true;", 'E2f');
muter('échec d\'écriture ignoré', "catch (e) { localEcrit = false; return false; }", "catch (e) { return false; }", 'E2d');
muter('majEtat se remet à écrire', "    const srv = serveur.final", "    sauverLocal();\n    const srv = serveur.final", 'E2e');
muter('lien supprimé', '<a class="sortie" id="sortie" data-act="sortie" href="NEXUS-App-v1.html">← Quitter et revenir à l\'Accueil</a>', '', 'E1a');
muter('lien vers une autre page', 'data-act="sortie" href="NEXUS-App-v1.html"', 'data-act="sortie" href="NEXUS-Inventaire-v1.html"', 'E1b');
muter('lien déplacé dans #app (effacé par rendre)', '<nav class="sortie-barre"><a class="sortie" id="sortie" data-act="sortie" href="NEXUS-App-v1.html">← Quitter et revenir à l\'Accueil</a></nav>\n<div class="phone" id="app">', '<div class="phone" id="app"><a class="sortie" id="sortie" data-act="sortie" href="NEXUS-App-v1.html">← Quitter et revenir à l\'Accueil</a>', 'E1c');
muter('lien masqué', 'class="sortie" id="sortie"', 'class="sortie" hidden id="sortie"', 'E1d');
muter('sortie sans rangement du jaugeage', "if (emp && date) sauverJauge();", "", 'E1e');
muter('sortie qui efface le brouillon', "if (moment) sauverLocal();", "if (moment) { sauverLocal(); localStorage.removeItem(cleBrouillon()); }", 'E1e');
muter('clic de sortie sans rangement', "if (a === 'sortie') { sauverAvantSortie(); return; }", "if (a === 'sortie') { return; }", 'E1f');
console.log(`\n${n} contrôles OK`);
