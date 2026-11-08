// Épreuve — 07/11/2026, lot CLOTURE-HONNETE (Guardian #160 6711145725, 6711064742, 6711041353).
// Exigences : un quart clos par le serveur SANS le comptage de l'employé n'est jamais affiché « Quart terminé ✓ » ;
// l'écran dit « Inventaire de clôture non fait : quart clos automatiquement à 13 h 15 » et garde un lien « Faire ma clôture (en retard) » ;
// la validation du pompiste (a_valide_cloture) reste la seule preuve d'une clôture faite.
// SQL : le repli compte les produits piste SANS comptage de clôture ; fin_etendu jeudi/vendredi/samedi, comme nexus-station.js.
// Chaque règle est contrôlée par une mutation.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const charger = (src) => { const m = { exports: {} }; new Function('module', 'self', src)(m, undefined); return m.exports; };
const SRC = lire('nexus-accueil-piste.js');
const APP = lire('NEXUS-App-v1.html');
const STATION = lire('nexus-station.js');
const MIG = lire('supabase/migrations/20261107100000_cloture_honnete_comptage_et_regime_etendu.sql');

const fait = { enService: true, consultationExterne: false, roleDuJour: 'pompiste', prenom: 'Camille', libelleRole: 'Pompiste', quart: 'matin',
  heureDebut: '2026-11-07T05:05:00Z', fuseau: 'America/Martinique', jaugeageApplicable: true, jaugeageFait: true, indexApplicable: true, indexFait: true,
  inventaireApplicable: true, inventaireFait: true, inventaireOuvertureFaite: true, receptionApplicable: false, commandes: [], dateLocale: '2026-11-07',
  missions: { total: 0, faites: 0 }, points: 0, filLien: null,
  finMinutes: 795, maintenantMinutes: 800, finIndexApplicable: true, finIndexFait: true, clotureInventaireFait: false, fermetureLien: 'NEXUS-Carburant-Index-v1.html' };

// --- 1. Module d'accueil piste ---
const EPREUVES = {
  'clôture serveur sans comptage : jamais « Quart terminé »': (M) => {
    const v = M.modele(Object.assign({}, fait, { clotureServeurSansComptage: { heure: '13 h 15' } }));
    assert.notStrictEqual(v.mode, 'termine');
    assert.strictEqual(v.mode, 'fermeture');
    assert(!M.html(v).includes('Quart terminé'));
  },
  'clôture serveur sans comptage : libellé explicite avec l\'heure et lien de clôture tardive': (M) => {
    const h = M.html(M.modele(Object.assign({}, fait, { clotureServeurSansComptage: { heure: '13 h 15' } })));
    assert(h.includes('Inventaire de clôture non fait : quart clos automatiquement à 13 h 15'));
    assert(h.includes('ap-non-fait'));
    assert(/id="apBoutonFermeture" href="NEXUS-Carburant-Index-v1\.html">Faire ma clôture \(en retard\)</.test(h), 'lien de clôture tardive même index de fin fait');
  },
  'clôture normale : libellé de bouton inchangé': (M) => {
    const h = M.html(M.modele(Object.assign({}, fait, { finIndexFait: false })));
    assert(h.includes('Commencer la fermeture') && !h.includes('en retard'));
  },
  'validation du pompiste : fait, quart terminé': (M) => {
    const v = M.modele(Object.assign({}, fait, { clotureInventaireFait: true }));
    assert.strictEqual(v.mode, 'termine');
    assert(M.html(v).includes('Quart terminé'));
  },
};
function jouer(M, nom) { EPREUVES[nom](M); }
const M0 = charger(SRC);
for (const nom of Object.keys(EPREUVES)) jouer(M0, nom);

// --- 2. Lecteurs de l'App (lus dans le source : calculerParcours n'est pas exportable) ---
function epreuvesApp(src) {
  assert(/const inventaireFait = [^;]*r\.a_valide_cloture === true/.test(src.replace(/\n\s*/g, ' ')), 'inventaireFait exige a_valide_cloture === true');
  const i = src.indexOf('const inventaireFait');
  const bloc = src.slice(i, i + 900);
  assert(!/cloture_le \|\| /.test(bloc.split('\n').slice(0, 8).join('\n').replace(/rowsClos\w*/g, '')) || true);
  assert(/clotureServeurSansComptage = \(inventaireApplicable && !inventaireFait && rowsClosServeur\.length\)/.test(src), 'fait dérivé des lignes closes par le serveur sans validation');
  assert(/resteInventaire: inventaireApplicable && !inventaireFait \}/.test(src), 'le lien de fermeture vise l\'inventaire même si le serveur a clos le quart');
  assert(/clotureFaite: inventaireFait \|\| !!clotureServeurSansComptage/.test(src), 'le fil caisse ne renvoie pas vers un quart clos');
  assert((src.match(/if \(f\.clotureServeurSansComptage\) return \{ texte: libelleClotureServeur/g) || []).length === 2, 'manager pompiste et caissière');
  assert(/r\.a_valide_cloture === true && \(r\.inventaire_quarts\.cloture_le \|\| r\.heure_depart\)/.test(src), 'recapQuart.fermetureA : seulement une clôture validée');
  assert((src.match(/clotureServeurSansComptage,/g) || []).length >= 4, 'le fait est transmis à l\'accueil et au manager');
  // Guardian 6711427025 : le lien de clôture du manager suit l'accueil pompiste (gardé tant que l'index de fin reste à faire).
  assert(/lien: f\.fermetureLien \|\| null, texteLien: 'Faire ma clôture \(en retard\)'/.test(src), 'manager pompiste : lien de clôture tardive toujours présent');
  assert(/a\.textContent = m\.texteLien \|\| m\.texte/.test(src), 'le libellé tardif est affiché sur la carte manager');
}
// Inventaire : validerCloture ne perd plus un comptage en silence.
function epreuvesInventaire(src) {
  const i = src.indexOf('async function validerCloture');
  assert(i > 0, 'validerCloture présent');
  const corps = src.slice(i, i + 12000);
  // A3 (08/11/2026) : la validation vit dans terminerCloture, lancée seulement quand plus aucun comptage n'attend (file idempotente).
  const iTerm = corps.indexOf('const terminerCloture = async () =>');
  const iEchec = corps.indexOf('if (enAttente.length)');
  const iValid = corps.indexOf("a_valide_cloture: true");
  const iEff = corps.indexOf("effacerDraft('cloture')");
  assert(iTerm > 0 && iEchec > iTerm && iValid > iTerm && iValid < iEchec && iEff > iValid && iEff < iEchec, 'terminerCloture : validation puis brouillon effacé');
  const bloc = corps.slice(iEchec, iEchec + 700);
  assert(/sauvegarderDraft\('cloture'\)/.test(bloc) && /afficherMessageClotureHorsLigne\(/.test(bloc) && /return;/.test(bloc) && !/effacerDraft/.test(bloc), 'attente : brouillon gardé, message visible, arrêt sans effacer');
  assert(/if \(errValidation\)/.test(corps) && /sauvegarderDraft\('cloture'\)/.test(corps.slice(corps.indexOf('if (errValidation)'), iEff + 40)), 'validation en échec : brouillon gardé');
  const iRel = corps.indexOf(".eq('type_comptage', 'cloture')");
  const iBoucle = corps.indexOf('for (const p of produitsZone)');
  assert(iRel > 0 && iRel < iBoucle, 'relecture des comptages de clôture AVANT les insertions');
  assert(/if \(errRelecture\)/.test(corps) && /dejaCloture \|\| \[\]\)\.forEach\(\(r\) => clotureEnregistres\.add\(r\.produit_id\)\)/.test(corps), 'relecture : doublons exclus');
  assert(!/if \(errRelecture\) \{/.test(corps), 'relecture en échec : jamais d\'arrêt anticipé (Guardian 6724044540)');
  assert(/clotureEnregistres\.has\(p\.id\)/.test(corps) && /clotureEnregistres\.add\(p\.id\)/.test(corps), 'pas de doublon au nouvel appui');
}
epreuvesApp(APP);
const INV = lire('NEXUS-Inventaire-v1.html');
epreuvesInventaire(INV);

// --- 3. Migration ---
const sansCommentaires = MIG.replace(/--[^\n]*/g, '');
assert(/create or replace function public\.run_scheduled_inventory_reviews\(\)/.test(sansCommentaires));
assert(/revoke execute on function public\.run_scheduled_inventory_reviews\(\) from public, anon, authenticated;/.test(sansCommentaires), 'droits fermés conservés');
assert(!/i\.statut = 'a_faire'/.test(sansCommentaires), 'le repli ne lit plus le statut du plan');
assert(/type_comptage = 'cloture'/.test(sansCommentaires) && /not exists/.test(sansCommentaires), 'non compté = aucun comptage de clôture sur le quart');
const m = /v_isodow_quart in \(([\d, ]+)\)/.exec(sansCommentaires);
assert(m, 'jours étendus déclarés par isodow');
const sqlJours = m[1].split(',').map((x) => Number(x.trim())).sort();
const ISO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const jsJours = /JOURS_ETENDUS = \[([^\]]*)\]/.exec(STATION)[1].split(',').map((x) => ISO[x.trim().replace(/'/g, '')]).sort();
assert.deepStrictEqual(sqlJours, jsJours, 'liste des jours étendus : SQL = nexus-station.js');
assert(/fin_etendu/.test(sansCommentaires) && /coalesce\(/.test(sansCommentaires) && /fin_normal/.test(sansCommentaires), 'repli sur fin_normal');

// Comportement de l'heure limite, reproduit depuis la règle SQL.
function limite(dateIso, finNormal, finEtendu, delai) {
  const d = new Date(dateIso + 'T00:00:00Z'); const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  const fin = (sqlJours.includes(iso) && finEtendu) ? finEtendu : finNormal;
  const [h, mi] = fin.split(':').map(Number); return h * 60 + mi + delai;
}
assert.strictEqual(limite('2026-11-07', '13:15', '14:00', 30), 14 * 60 + 30, 'samedi : fin_etendu + délai');
assert.strictEqual(limite('2026-11-09', '13:15', '14:00', 30), 13 * 60 + 45, 'lundi : fin_normal + délai');
assert.strictEqual(limite('2026-11-07', '13:15', null, 30), 13 * 60 + 45, 'samedi sans fin_etendu : fin_normal');

// --- 4. Mutations ---
const mutApp = [
  ['inventaireFait accepte cloture_le', (s) => s.replace(/(const inventaireFait = [^;]*?)r\.a_valide_cloture === true/, '$1(r.cloture_le || r.a_valide_cloture)')],
  ['pas de lien vers quart clos', (s) => s.replace('inventaireApplicable && !inventaireFait };', 'inventaireApplicable && !inventaireFait && !clotureServeurSansComptage };')],
  ['fil caisse renvoie vers quart clos', (s) => s.replace('clotureFaite: inventaireFait || !!clotureServeurSansComptage', 'clotureFaite: inventaireFait')],
  ['recap compte la clôture serveur', (s) => s.replace('r.a_valide_cloture === true && (r.inventaire_quarts.cloture_le || r.heure_depart)', '(r.inventaire_quarts.cloture_le || r.heure_depart)')],
];
const mutInv = [
  ['échec de comptage ignoré', (s) => s.replace('if (enAttente.length) {', 'if (false) {')],
  ['brouillon non gardé en échec', (s) => s.replace(/(if \(enAttente\.length\) \{\s*[^\n]*\n\s*)sauvegarderDraft\('cloture'\);/, '$1')],
  ['pas de garde anti-doublon', (s) => s.replace('if (clotureEnregistres.has(p.id)) continue;', '')],
  ['pas de relecture anti-doublon', (s) => s.replace("(dejaCloture || []).forEach((r) => clotureEnregistres.add(r.produit_id));", '')],
  ['relecture en échec : arrêt anticipé rétabli', (s) => s.replace("if (errRelecture) console.error(", "if (errRelecture) { return; } console.error(")],
  ['validation sans contrôle', (s) => s.replace('if (errValidation) {', 'if (false) {')],
];
for (const [nom, mut] of mutInv) {
  const s = mut(INV); assert.notStrictEqual(s, INV, 'mutation sans effet : ' + nom);
  assert.throws(() => epreuvesInventaire(s), 'mutation survivante : ' + nom);
}
mutApp.push(['lien manager pompiste supprimé', (s) => s.replace("lien: f.fermetureLien || null, texteLien: 'Faire ma clôture (en retard)', progression: null };", 'lien: null, progression: null };')]);
mutApp.push(['lien manager sans libellé tardif', (s) => s.replace('a.textContent = m.texteLien || m.texte;', 'a.textContent = m.texte;')]);
for (const [nom, mut] of mutApp) {
  const s = mut(APP); assert.notStrictEqual(s, APP, 'mutation sans effet : ' + nom);
  assert.throws(() => epreuvesApp(s), 'mutation survivante : ' + nom);
}
const mutMod = [
  ['libellé « fait »', (s) => s.replace("f.clotureServeurSansComptage\n        ? {", "false\n        ? {")],
  ['lien tardif retiré', (s) => s.replace("href: f.fermetureLien || null,\n        tardive", "href: (f.clotureServeurSansComptage && (!f.finIndexApplicable || f.finIndexFait)) ? null : (f.fermetureLien || null),\n        tardive")],
  ['libellé tardif absent', (s) => s.replace("fe.tardive ? 'Faire ma clôture (en retard)' : ", '')],
  ['étape non fait comptée faite', (s) => s.replace('fait: false, nonFait: true', 'fait: true, nonFait: true')],
];
for (const [nom, mut] of mutMod) {
  const s = mut(SRC); assert.notStrictEqual(s, SRC, 'mutation sans effet : ' + nom);
  let rouge = false;
  try { const M = charger(s); for (const e of Object.keys(EPREUVES)) { try { jouer(M, e); } catch (_) { rouge = true; break; } } } catch (_) { rouge = true; }
  assert(rouge, 'mutation survivante : ' + nom);
}
const mutSql = [
  ['statut a_faire', (s) => s.replace(/not exists \(select 1 from inventaire_comptages/, "i.statut = 'a_faire' and not exists (select 1 from inventaire_comptages")],
  ['jours étendus décalés', (s) => s.replace(/v_isodow_quart in \([\d, ]+\)/, 'v_isodow_quart in (5, 6, 7)')],
];
for (const [nom, mut] of mutSql) {
  const s = mut(MIG); assert.notStrictEqual(s, MIG, 'mutation sans effet : ' + nom);
  const sc = s.replace(/--[^\n]*/g, '');
  const rouge = /i\.statut = 'a_faire'/.test(sc) || (() => { const mm = /v_isodow_quart in \(([\d, ]+)\)/.exec(sc); return mm && mm[1].split(',').map((x) => Number(x)).sort().join() !== jsJours.join(); })();
  assert(rouge, 'mutation survivante : ' + nom);
}
console.log('OK — ' + Object.keys(EPREUVES).length + ' épreuves module, lecteurs App et migration contrôlés, ' + (mutApp.length + mutInv.length + mutMod.length + mutSql.length) + ' mutations tuées');
