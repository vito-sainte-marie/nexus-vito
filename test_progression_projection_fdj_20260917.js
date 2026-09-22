// Test — Ma Progression : l'employé ne reçoit plus les colonnes du manager
// (17/09/2026, relecture de la PR #62, point 2).
//
// POURQUOI CE FICHIER EXISTE
//
// `NEXUS-Progression-v1.html` chargeait ses quarts FDJ par
// `from('fdj_shifts').select('*, fdj_cash_controls(*)')`. L'étoile imbriquée
// faisait arriver, dans la réponse réseau de l'EMPLOYÉ, le commentaire interne
// du manager (`motif_ecart_texte`), son verdict (`resultat_controle`) et
// l'identité du contrôleur (`valide_par`, `controle_par`). Aucun rendu ne les
// affichait. C'est sans importance : la fuite est dans la réponse, pas dans le
// rendu — un onglet Réseau suffit à la lire.
//
// La RLS ne pouvait rien y faire : elle filtre des LIGNES, jamais des colonnes,
// et ces lignes-là sont légitimement celles de l'employé. La fermeture est donc
// une projection serveur, `fdj_ma_progression_caisse()` (migration
// 20260916220900), et ce test garde les trois maillons de la bascule :
//
//   A — le CONTRAT SQL : la projection déclare douze colonnes, son corps en
//       sélectionne douze, et aucune des deux listes ne touche une colonne
//       réservée au manager. La liste des colonnes réservées n'est pas écrite
//       à la main : elle est DÉDUITE du schéma réel de `fdj_cash_controls`,
//       moins les douze autorisées. Une colonne ajoutée demain à la table est
//       donc réservée d'office, sans que personne ait à y penser.
//   B — la BASCULE DU FRONT : plus aucune étoile imbriquée dans l'écran
//       employé, et le choix de la source passe par `NexusCaisseSource`.
//   C — l'ÉQUIVALENCE : la projection produit exactement les mêmes services
//       que la lecture brute, sans quoi la bascule changerait l'affichage.
//
// ET SURTOUT — chaque partie porte SA MUTATION. Une garde verte ne prouve rien
// tant qu'on n'a pas vu ce qui la fait rougir. La partie A rejoue donc trois
// versions fautives de la projection, dont la plus sournoise : celle qui
// DÉCLARE `motif_ecart` et SÉLECTIONNE `c.motif_ecart_texte`. L'en-tête reste
// irréprochable, la charge utile est le commentaire du manager. Un contrôle
// qui ne lirait que la déclaration la laisserait passer.
//
// Ce que ce fichier ne fait PAS : ouvrir une connexion. La CI n'a pas de base
// et n'en aura pas. La preuve exécutée — la liste des colonnes réellement
// renvoyées par le serveur — est jouée à la main sur nexus-test et consignée
// dans DOSSIER-FDJ-VAGUE1-20260917.md.

const fs = require('fs');
const assert = require('assert');

const M = __dirname + '/supabase/migrations/';
const sqlProjection = fs.readFileSync(M + '20260916220900_fdj_projection_progression.sql', 'utf8');

// Un commentaire qui décrit la règle ne doit jamais faire passer le test à la
// place du code qui l'applique.
const sansCommentaires = (s) => s.split('\n').map(l => {
  const i = l.indexOf('--');
  return i === -1 ? l : l.slice(0, i);
}).join('\n');

// Contenu d'une paire de parenthèses, à partir de la parenthèse ouvrante.
function entreParentheses(s, iOuvrante) {
  let profondeur = 1, j = iOuvrante + 1;
  while (profondeur > 0) {
    if (s[j] === '(') profondeur++;
    else if (s[j] === ')') profondeur--;
    else if (s[j] === undefined) assert.fail('Parenthèse jamais refermée');
    j++;
  }
  return s.slice(iOuvrante + 1, j - 1);
}

// Découpe une liste au seul niveau 0 de parenthèses : un `check (...)` ou un
// `numeric(10,2)` compte pour un élément, pas pour deux.
function decouper(liste) {
  const parts = [];
  let profondeur = 0, courant = '', enChaine = false;
  for (let k = 0; k < liste.length; k++) {
    const c = liste[k];
    if (enChaine) { courant += c; if (c === "'") enChaine = false; continue; }
    if (c === "'") { enChaine = true; courant += c; continue; }
    if (c === '(') profondeur++;
    if (c === ')') profondeur--;
    if (c === ',' && profondeur === 0) { parts.push(courant.trim()); courant = ''; continue; }
    courant += c;
  }
  if (courant.trim()) parts.push(courant.trim());
  return parts.filter(p => p.length);
}

// ════════════════════════════════════════════════════════════════════
// Le schéma réel de fdj_cash_controls, lu dans les migrations.
// ════════════════════════════════════════════════════════════════════

const MOTS_NON_COLONNES = new Set(['constraint', 'primary', 'unique', 'check', 'foreign', 'exclude', 'like']);

function colonnesDeLaTable(table) {
  const noms = new Set();
  const fichiers = fs.readdirSync(M).filter(f => f.endsWith('.sql')).sort();
  for (const f of fichiers) {
    const sql = sansCommentaires(fs.readFileSync(M + f, 'utf8'));

    const iCreate = sql.indexOf(`create table public.${table} (`);
    if (iCreate !== -1) {
      const corps = entreParentheses(sql, sql.indexOf('(', iCreate));
      for (const part of decouper(corps)) {
        const mot = part.trim().split(/\s+/)[0].toLowerCase();
        if (!MOTS_NON_COLONNES.has(mot) && /^[a-z_][a-z0-9_]*$/.test(mot)) noms.add(mot);
      }
    }

    // `alter table [public.]<table> ... add column [if not exists] x`
    const re = new RegExp(`alter\\s+table\\s+(?:public\\.)?${table}\\b([\\s\\S]*?);`, 'g');
    let m;
    while ((m = re.exec(sql)) !== null) {
      const reCol = /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/g;
      let c;
      while ((c = reCol.exec(m[1])) !== null) noms.add(c[1]);
    }
  }
  return noms;
}

const COLONNES_TABLE = colonnesDeLaTable('fdj_cash_controls');
// Repère : le lot Vague 1 en ajoute huit, le schéma d'origine en portait dix-neuf.
assert.ok(COLONNES_TABLE.size >= 25,
  `Seulement ${COLONNES_TABLE.size} colonnes trouvées sur fdj_cash_controls : la lecture du `
  + 'schéma a échoué, et un contrôle qui ne voit aucune colonne réservée est vert pour rien.');
for (const attendue of ['motif_ecart_texte', 'resultat_controle', 'valide_par', 'controle_par',
                        'controle_le', 'saisi_par', 'confirme_par', 'motif_ecart', 'ecart']) {
  assert.ok(COLONNES_TABLE.has(attendue),
    `La colonne ${attendue} doit figurer dans le schéma lu — sinon la déduction est fausse.`);
}

// Les douze colonnes que l'employé a le droit de recevoir, dans l'ordre du
// contrat. Cinq viennent de fdj_shifts, sept de fdj_cash_controls.
const CONTRAT = [
  ['shift_id',              's.id'],
  ['date',                  's.date'],
  ['quart',                 's.quart'],
  ['statut_quart',          's.statut'],
  ['statut_caisse',         'c.statut'],
  ['caisse_attendue',       'c.caisse_attendue'],
  ['caisse_reelle',         'c.caisse_reelle'],
  ['caisse_reelle_origine', 'c.caisse_reelle_origine'],
  ['ecart',                 'c.ecart'],
  ['ecart_origine',         'c.ecart_origine'],
  ['motif_ecart',           'c.motif_ecart'],
  ['valide_le',             'c.valide_le'],
];
const AUTORISEES_CASH = new Set(CONTRAT.filter(([, src]) => src.startsWith('c.')).map(([, src]) => src.slice(2)));
const RESERVEES = new Set([...COLONNES_TABLE].filter(n => !AUTORISEES_CASH.has(n)));
for (const doitEtreReservee of ['motif_ecart_texte', 'resultat_controle', 'valide_par', 'controle_par']) {
  assert.ok(RESERVEES.has(doitEtreReservee),
    `${doitEtreReservee} doit être déduite RÉSERVÉE — c'est nommément l'une des trois fuites du point 2.`);
}
console.log(`OK — schéma lu : ${COLONNES_TABLE.size} colonnes sur fdj_cash_controls, `
  + `${AUTORISEES_CASH.size} autorisées, ${RESERVEES.size} réservées au manager.`);

// ════════════════════════════════════════════════════════════════════
// A) Le contrat SQL de la projection
// ════════════════════════════════════════════════════════════════════

// A1. Ce que la fonction DÉCLARE renvoyer.
function colonnesDeclarees(sql) {
  const propre = sansCommentaires(sql);
  const i = propre.indexOf('returns table (');
  assert.ok(i !== -1, 'fdj_ma_progression_caisse doit déclarer un `returns table (`');
  return decouper(entreParentheses(propre, propre.indexOf('(', i)))
    .map(p => p.trim().split(/\s+/)[0]);
}

// A2. Ce que son CORPS sélectionne réellement, entre le `select` et le `from`.
//     C'est la seule liste qui décide de ce qui part sur le réseau : la
//     déclaration ne fait que nommer des positions.
function colonnesSelectionnees(sql) {
  const propre = sansCommentaires(sql);
  const iCorps = propre.indexOf('as $$');
  assert.ok(iCorps !== -1, 'Le corps dollar-quoté de la projection doit exister');
  const corps = propre.slice(iCorps, propre.indexOf('$$;', iCorps + 5));
  // Le `select` de la liste, pas celui du `with moi as (select auth.uid())`.
  const iSelect = corps.indexOf('select', corps.indexOf(') as uid') + 1);
  assert.ok(iSelect !== -1, 'La requête de projection doit suivre la CTE `moi`');
  const iFrom = corps.indexOf('\n  from ', iSelect);
  assert.ok(iFrom !== -1, 'La requête de projection doit avoir un `from` au premier niveau');
  return decouper(corps.slice(iSelect + 6, iFrom)).map(p => p.trim());
}

function controlerProjection(sql) {
  const declarees = colonnesDeclarees(sql);
  const selectionnees = colonnesSelectionnees(sql);

  assert.strictEqual(declarees.length, selectionnees.length,
    `La projection déclare ${declarees.length} colonnes et en sélectionne ${selectionnees.length} : `
    + 'les positions ne correspondent plus, et une colonne peut arriver sous le nom d\'une autre.');
  assert.deepStrictEqual(declarees, CONTRAT.map(c => c[0]),
    'La liste déclarée par fdj_ma_progression_caisse s\'est élargie ou réordonnée. '
    + 'Tout champ ajouté ici redevient visible dans la réponse réseau de l\'employé.');
  assert.deepStrictEqual(selectionnees, CONTRAT.map(c => c[1]),
    'Le corps de fdj_ma_progression_caisse ne sélectionne plus exactement les douze sources '
    + 'attendues. Une déclaration propre ne dit rien de ce qui est réellement envoyé.');

  // Le contrôle qui mord vraiment : aucune source `c.<colonne réservée>`,
  // quel que soit le nom sous lequel elle serait déclarée.
  for (const expr of selectionnees) {
    const m = /^c\.([a-z_][a-z0-9_]*)$/.exec(expr);
    if (!m) continue;
    assert.ok(!RESERVEES.has(m[1]),
      `La projection employé sélectionne ${expr}, colonne réservée au manager. `
      + 'C\'est exactement la fuite que le point 2 de la relecture demandait de fermer.');
  }
  return { declarees, selectionnees };
}

const { declarees } = controlerProjection(sqlProjection);
console.log(`OK — contrat de fdj_ma_progression_caisse : ${declarees.length} colonnes, `
  + 'aucune réservée au manager, déclaration et corps alignés position par position.');

// A3. Aucun paramètre d'identité — comme mes_ecarts_caisse() et
//     fdj_mes_quarts_fdj(). Le filtre est auth.uid(), et lui seul.
const propreProjection = sansCommentaires(sqlProjection);
const signature = entreParentheses(propreProjection,
  propreProjection.indexOf('(', propreProjection.indexOf('create or replace function public.fdj_ma_progression_caisse')));
assert.strictEqual(signature.trim(), 'p_limite int default 2000',
  'fdj_ma_progression_caisse ne doit prendre AUCUN paramètre d\'identité : '
  + 'un p_employee_id rendrait la console du navigateur suffisante pour lire un collègue.');
assert.ok(/and s\.employee_id = moi\.uid\b/.test(propreProjection),
  'Le filtre doit porter sur s.employee_id = auth.uid().');
assert.ok(/and s\.statut = 'valide'/.test(propreProjection),
  'Le filtre FDJ-26 (« jamais un brouillon ») doit être côté serveur.');
assert.ok(/security definer/.test(propreProjection) && /set search_path = ''/.test(propreProjection),
  'La projection doit être security definer avec un search_path vide.');
assert.ok(/revoke all on function public\.fdj_ma_progression_caisse\(int\) from anon;/.test(propreProjection),
  'Le 16/09/2026 a mesuré que `revoke ... from public` ne retire pas le grant nommé d\'anon : '
  + 'la révocation d\'anon doit être explicite.');
console.log('OK — aucun paramètre d\'identité, filtre auth.uid(), anon explicitement révoqué.');

// A4. LES MUTATIONS. Trois versions fautives, trois rougeurs attendues.
const MUTATIONS_A = [
  {
    nom: 'le commentaire du manager ajouté au contrat (déclaration + corps)',
    muter: (s) => s
      .replace('  motif_ecart           text,', '  motif_ecart           text,\n  motif_ecart_texte     text,')
      .replace('    c.motif_ecart,', '    c.motif_ecart,\n    c.motif_ecart_texte,'),
  },
  {
    nom: 'une source ajoutée au corps sans toucher à la déclaration (décalage de positions)',
    muter: (s) => s.replace('    c.motif_ecart,', '    c.resultat_controle,\n    c.motif_ecart,'),
  },
  {
    nom: 'la plus sournoise — déclare motif_ecart, sélectionne motif_ecart_texte',
    muter: (s) => s.replace('    c.motif_ecart,', '    c.motif_ecart_texte,'),
  },
];
for (const { nom, muter } of MUTATIONS_A) {
  const mute = muter(sqlProjection);
  assert.notStrictEqual(mute, sqlProjection,
    `MUTATION INOPÉRANTE (${nom}) : le texte n'a pas changé, la mutation vise à côté du code.`);
  let detectee = false;
  try { controlerProjection(mute); } catch (e) { detectee = e instanceof assert.AssertionError; }
  assert.ok(detectee,
    `MUTATION NON DÉTECTÉE — ${nom}. Le contrôle de la partie A est donc inutile.`);
  console.log(`OK — mutation détectée : ${nom}.`);
}

// ════════════════════════════════════════════════════════════════════
// B) La bascule du front
// ════════════════════════════════════════════════════════════════════

const htmlProgression = fs.readFileSync(__dirname + '/NEXUS-Progression-v1.html', 'utf8');
const jsSource = fs.readFileSync(__dirname + '/nexus-caisse-source.js', 'utf8');

// Le code, commentaires retirés : l'en-tête de la bascule cite forcément
// l'étoile qu'elle supprime, et un contrôle qui la relirait serait rouge pour
// une raison fausse.
const sansCommentairesJs = (s) => s.split('\n').map(l => {
  const i = l.indexOf('//');
  return i === -1 ? l : l.slice(0, i);
}).join('\n');

const codeProgression = sansCommentairesJs(htmlProgression);
assert.ok(!/fdj_cash_controls\s*\(\s*\*\s*\)/.test(codeProgression),
  'NEXUS-Progression-v1.html ne doit plus demander `fdj_cash_controls(*)` : '
  + 'l\'étoile imbriquée est la fuite elle-même.');
assert.ok(!/\.from\(\s*'fdj_shifts'\s*\)/.test(codeProgression),
  'L\'écran employé ne doit plus lire fdj_shifts en direct : le choix de la source '
  + 'appartient à nexus-caisse-source.js, sans quoi un quatrième écran le réécrira de travers.');
assert.ok(/NexusCaisseSource\.chargerServicesCaisseFdj\(\{/.test(codeProgression),
  'La progression FDJ doit passer par NexusCaisseSource.chargerServicesCaisseFdj.');
assert.ok(/<script src="nexus-caisse-source\.js/.test(htmlProgression),
  'NEXUS-Progression-v1.html doit charger nexus-caisse-source.js.');
console.log('OK — Ma Progression : plus d\'étoile imbriquée, plus de lecture directe de fdj_shifts.');

// Le module : le chemin employé appelle la projection, le chemin manager garde
// les lignes brutes — mais avec une liste de colonnes explicite, jamais `*`.
const codeSource = sansCommentairesJs(jsSource);
assert.ok(/rpc\('fdj_ma_progression_caisse'\)/.test(codeSource),
  'Le chemin employé doit appeler fdj_ma_progression_caisse().');
assert.ok(!/SELECT_FDJ_SHIFTS_BRUT[\s\S]{0,400}?\*/.test(codeSource.slice(codeSource.indexOf('SELECT_FDJ_SHIFTS_BRUT'))),
  'SELECT_FDJ_SHIFTS_BRUT ne doit contenir aucune étoile : `select(\'*\')` sur une table de '
  + 'montants finit toujours par transporter la colonne de trop.');

// Et le chemin manager, qui LIT légitimement les lignes brutes, ne demande
// pourtant rien de plus que ce que l'écran consomme.
const iSel = codeSource.indexOf('SELECT_FDJ_SHIFTS_BRUT = ');
const litteral = codeSource.slice(iSel, codeSource.indexOf(';', iSel));
const colonnesImbriquees = entreParentheses(litteral, litteral.indexOf('fdj_cash_controls(') + 'fdj_cash_controls'.length)
  .replace(/['"+\s]|\n/g, '').split(',').filter(Boolean);
assert.deepStrictEqual(colonnesImbriquees, CONTRAT.filter(([, s]) => s.startsWith('c.')).map(([, s]) => s.slice(2)),
  'Le chemin manager doit lire exactement les mêmes sept colonnes de fdj_cash_controls que la '
  + 'projection employé : les deux chemins alimentent le même constructeur, et une divergence '
  + 'ferait dépendre l\'affichage de qui regarde.');
console.log('OK — nexus-caisse-source.js : projection pour soi, colonnes explicites pour le manager.');

// B bis. LA MUTATION DU FRONT — on remet l'étoile, le contrôle doit rougir.
function controlerFront(html) {
  const code = sansCommentairesJs(html);
  assert.ok(!/fdj_cash_controls\s*\(\s*\*\s*\)/.test(code), 'étoile imbriquée');
  assert.ok(!/\.from\(\s*'fdj_shifts'\s*\)/.test(code), 'lecture directe de fdj_shifts');
}
const htmlMute = htmlProgression.replace(
  'NexusCaisseSource.chargerServicesCaisseFdj({',
  "nexusClient.from('fdj_shifts').select('*, fdj_cash_controls(*)'); NexusCaisseSource.chargerServicesCaisseFdj({");
assert.notStrictEqual(htmlMute, htmlProgression, 'MUTATION INOPÉRANTE : le front n\'a pas changé.');
let frontDetecte = false;
try { controlerFront(htmlMute); } catch (e) { frontDetecte = e instanceof assert.AssertionError; }
assert.ok(frontDetecte,
  'MUTATION NON DÉTECTÉE : le retour à la lecture directe passerait le contrôle de la partie B.');
console.log('OK — mutation détectée : le retour de l\'étoile imbriquée dans Ma Progression.');

// ════════════════════════════════════════════════════════════════════
// C) L'équivalence des deux chemins
// ════════════════════════════════════════════════════════════════════

global.window = global.window || {};
require(__dirname + '/nexus-progression.js');
const N = global.window.NexusProgression;
assert.ok(typeof N.construireServicesCaisseFdjDepuisProjection === 'function',
  'construireServicesCaisseFdjDepuisProjection doit être exportée.');

// Une ligne brute telle que le serveur la renvoyait AVANT la bascule : avec les
// champs manager, puisque c'est précisément ce qui arrivait.
//
// `quart` vaut '1' ou '2', et pas 'matin' / 'soir' : c'est le domaine réel,
// tenu par la contrainte `fdj_shifts_quart_check` (mesurée sur nexus-test le
// 17/09/2026). Les assertions ci-dessous n'en dépendent pas — raison de plus
// pour ne pas laisser une fixture inventer un domaine que la base refuse.
const brut = [
  {
    id: 's1', date: '2026-09-10', quart: '1', statut: 'valide',
    fdj_cash_controls: {
      statut: 'valide_avec_ecart',
      caisse_attendue: '100.50', caisse_reelle: '99.50', caisse_reelle_origine: '98.00',
      ecart: '-1.00', ecart_origine: '-2.50', motif_ecart: 'erreur_monnaie',
      valide_le: '2026-09-11T08:00:00Z',
      motif_ecart_texte: 'Compte deux fois la même liasse, revu avec lui.',
      resultat_controle: 'a_regulariser', valide_par: 'manager-1', controle_par: 'manager-1',
    },
  },
  // Un brouillon : jamais une progression (FDJ-26).
  { id: 's2', date: '2026-09-11', quart: '2', statut: 'brouillon',
    fdj_cash_controls: { statut: 'provisoire', ecart: '3.00' } },
];
// La même vérité, telle que la projection la renvoie : le brouillon n'est plus
// transmis du tout, et les champs manager n'existent pas.
const projete = [
  {
    shift_id: 's1', date: '2026-09-10', quart: '1',
    statut_quart: 'valide', statut_caisse: 'valide_avec_ecart',
    caisse_attendue: '100.50', caisse_reelle: '99.50', caisse_reelle_origine: '98.00',
    ecart: '-1.00', ecart_origine: '-2.50', motif_ecart: 'erreur_monnaie',
    valide_le: '2026-09-11T08:00:00Z',
  },
];

const parLectureBrute = N.construireServicesCaisseFdj(brut);
const parProjection = N.construireServicesCaisseFdjDepuisProjection(projete);
assert.deepStrictEqual(parProjection, parLectureBrute,
  'La bascule doit être invisible à l\'affichage : les deux chemins doivent produire '
  + 'exactement les mêmes services.');
assert.strictEqual(parProjection.length, 1, 'Le brouillon ne doit produire aucun service.');

// L'écart PROVISOIRE reste visible après confirmation, le résultat DÉFINITIF
// après validation : les deux exigences explicites du point 2.
const s = parProjection[0];
assert.strictEqual(s.ecartOrigine, -2.5,
  'L\'écart d\'origine — celui que l\'employé a constaté et confirmé — doit rester visible.');
assert.strictEqual(s.ecart, -1,
  'L\'écart définitif, après régularisation manager, doit rester visible.');
assert.strictEqual(s.motifEcart, 'erreur_monnaie',
  'Le motif codé, choisi par l\'employé lui-même (20260901225945), reste visible.');
assert.strictEqual(N.statutCaisseJourFdj(s), N.statutCaisseJourFdj(parLectureBrute[0]),
  'Le statut affiché ne doit pas dépendre de la source.');

// Rien, dans le service produit, ne porte un champ réservé au manager — ni sous
// son nom SQL, ni sous une graphie JS.
//
// Une réserve, et elle est de fond : `id`, `date`, `quart`, `statut`, `site`
// sont portés par les DEUX tables. Un contrôle par nom ne peut pas dire si la
// clé `id` du service vient du quart (légitime, c'est l'identifiant de ligne de
// l'écran) ou du contrôle de caisse (qui n'a rien à y faire). Nommer ces cas
// plutôt que les supposer : ils sont exclus ici, et c'est l'appariement
// positionnel de la partie A — `shift_id ← s.id`, jamais `c.id` — qui les
// tranche. Les colonnes qui portent vraiment la fuite (`motif_ecart_texte`,
// `resultat_controle`, `valide_par`, `controle_par`) n'existent que sur
// `fdj_cash_controls` : pour elles, le nom suffit et le contrôle mord.
const COLONNES_SHIFTS = colonnesDeLaTable('fdj_shifts');
const AMBIGUES = new Set([...RESERVEES].filter(n => COLONNES_SHIFTS.has(n)));
const ATTRIBUABLES = [...RESERVEES].filter(n => !AMBIGUES.has(n));
for (const doitMordre of ['motif_ecart_texte', 'resultat_controle', 'valide_par', 'controle_par']) {
  assert.ok(ATTRIBUABLES.includes(doitMordre),
    `${doitMordre} doit rester attribuable par son nom, sans quoi ce contrôle ne prouve rien.`);
}
const enJs = (n) => n.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
for (const reservee of ATTRIBUABLES) {
  for (const cle of Object.keys(s)) {
    assert.notStrictEqual(cle, enJs(reservee),
      `Le service produit porte ${cle}, qui vient de la colonne réservée ${reservee}.`);
  }
}
console.log(`OK — ${ATTRIBUABLES.length} colonnes réservées attribuables par leur nom, `
  + `${AMBIGUES.size} ambiguës (portées aussi par fdj_shifts, tranchées par la partie A) : `
  + 'aucune dans la sortie employé.');
assert.ok(!JSON.stringify(parProjection).includes('liasse'),
  'Le commentaire interne du manager ne doit apparaître nulle part dans la sortie employé.');
console.log('OK — équivalence des deux chemins, écart provisoire et définitif conservés, '
  + 'aucun champ manager dans la sortie employé.');

console.log('Ma Progression : la projection employé tient son contrat, mutations comprises.');
