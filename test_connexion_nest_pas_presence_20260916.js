// ============================================================================
// CONNEXION ≠ PRÉSENCE (16/09/2026)
//
// « Aucun service ne peut être créé implicitement par le login, le chargement
//   d'un écran, une redirection ou la consultation d'une donnée. »
//
// Une règle de navigation, même bien centralisée, ne suffit pas à garantir
// cela : elle décide où l'on va, pas ce que l'écran fait en arrivant. Cette
// épreuve regarde l'autre moitié — les ÉCRITURES. Elle établit, pour les
// quatre seules écritures de présence du dépôt (une sur `shifts`, trois sur
// `pointages`), qu'aucune n'est atteignable depuis le chemin de chargement
// d'un écran, et que chacune l'est depuis un geste explicite.
//
// La méthode est une atteignabilité, pas une recherche de motif. On part des
// RACINES exécutées au chargement — le code de premier niveau du script, et
// les rappels de DOMContentLoaded / load — et on suit les appels de fonction
// de proche en proche. Les corps des rappels d'événements (click, submit, …)
// sont retirés des racines : ce sont précisément les gestes explicites.
//
// Pourquoi ainsi, et pas en cherchant `addEventListener` autour de l'insert :
// un insert peut être à trois appels de distance d'un gestionnaire, et une
// fonction peut être appelée des deux côtés. Seul le graphe le dit.
// ============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');

// ── Outillage d'analyse ───────────────────────────────────────────────────

// Le script d'un écran : tout le JS inline, sans les balises à `src`.
function scriptsDe(html) {
  const morceaux = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) { if (!/\bsrc=/i.test(m[1])) morceaux.push(m[2]); }
  return morceaux.join('\n');
}

// LES COMMENTAIRES NE SONT PAS DU CODE. Le premier jet l'a appris de la
// pire façon : l'analyseur voyait dans « // traiterPhotoPointage (10/08/2026) »
// un appel à traiterPhotoPointage, au premier niveau du script — et déclarait
// donc atteignable au chargement une fonction qui n'est appelée que sur clic.
// Un rouge, mais pour une raison fausse : exactement aussi trompeur qu'un vert
// pour une raison fausse.
//
// On les remplace par des espaces plutôt que de les supprimer : les positions
// de tout le reste du texte restent alors celles du code d'origine, et l'on
// peut continuer de situer une écriture par son décalage.
function masquerCommentaires(code) {
  const out = code.split('');
  let i = 0;
  const blanchir = (d, f) => { for (let k = d; k < f && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '; };
  while (i < code.length) {
    const c = code[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < code.length && code[i] !== q) { if (code[i] === '\\') i++; i++; }
      i++;
    } else if (c === '/' && code[i + 1] === '/') {
      let j = code.indexOf('\n', i); if (j === -1) j = code.length;
      blanchir(i, j); i = j;
    } else if (c === '/' && code[i + 1] === '*') {
      let j = code.indexOf('*/', i); j = j === -1 ? code.length : j + 2;
      blanchir(i, j); i = j;
    } else i++;
  }
  return out.join('');
}

function finDuBloc(code, iAccolade) {
  let p = 1, j = iAccolade + 1;
  while (p > 0 && j < code.length) {
    const c = code[j];
    if (c === '{') p++; else if (c === '}') p--;
    j++;
  }
  return j;
}

function finDesParentheses(code, iParenthese) {
  let p = 1, j = iParenthese + 1;
  while (p > 0 && j < code.length) {
    const c = code[j];
    if (c === '(') p++; else if (c === ')') p--;
    j++;
  }
  return j;
}

// Les fonctions nommées de l'écran : déclarations et fonctions affectées à
// une constante (les deux formes employées dans NEXUS).
function fonctionsDe(code) {
  const fonctions = new Map();
  const re = /(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\s*)?\([^)]*\)\s*(?:=>\s*)?\{/g;
  let m;
  while ((m = re.exec(code))) {
    const nom = m[1] || m[2];
    const iAccolade = code.indexOf('{', m.index + m[0].length - 1);
    if (iAccolade === -1) continue;
    const fin = finDuBloc(code, iAccolade);
    if (!fonctions.has(nom)) fonctions.set(nom, { debut: m.index, fin, corps: code.slice(iAccolade, fin) });
  }
  return fonctions;
}

// ── Le vocabulaire des événements, en trois familles ─────────────────────
//
// Deux familles ne suffisaient pas. Le premier jet opposait « chargement » à
// « tout le reste », ce qui rangeait `online` parmi les gestes explicites : or
// personne ne clique sur « online ». Le réseau qui revient déclenche ce rappel
// sans que l'utilisateur ait rien fait — le compter comme un geste aurait
// blanchi d'avance une écriture déclenchée toute seule.
const EVENEMENTS_DE_CHARGEMENT = ['DOMContentLoaded', 'load', 'pageshow', 'readystatechange'];
// Un geste : un doigt, une touche, un formulaire envoyé. Rien d'autre.
const GESTES_EXPLICITES = ['click', 'dblclick', 'submit', 'change', 'input',
                           'keydown', 'keyup', 'keypress', 'pointerdown', 'touchstart'];
// Tout ce qui n'est ni l'un ni l'autre (online, visibilitychange, storage,
// message, popstate…) part sans geste : on le traite comme du chargement.
// C'est volontairement pessimiste — l'oubli ferme, il n'ouvre pas.
function familleEvenement(type) {
  if (EVENEMENTS_DE_CHARGEMENT.includes(type)) return 'chargement';
  if (GESTES_EXPLICITES.includes(type)) return 'geste';
  return 'automatique';
}

// Les rappels d'événements d'un fragment, chacun avec sa famille et ses bornes.
function rappelsDe(fragment) {
  const rappels = [];
  const re = /addEventListener\s*\(\s*['"]([a-zA-Z]+)['"]/g;
  let m;
  while ((m = re.exec(fragment))) {
    const iParenthese = fragment.indexOf('(', m.index);
    const fin = finDesParentheses(fragment, iParenthese);
    rappels.push({
      type: m[1], famille: familleEvenement(m[1]),
      debut: m.index, fin, corps: fragment.slice(iParenthese, fin),
    });
  }
  return rappels;
}

// Découpe un fragment en retirant des tranches [début, fin].
function retirer(fragment, tranches) {
  tranches = tranches.slice().sort((a, b) => a[0] - b[0]);
  let reste = '', curseur = 0;
  for (const [d, f] of tranches) {
    if (d >= curseur) { reste += fragment.slice(curseur, d); curseur = f; }
    else if (f > curseur) curseur = f;
  }
  return reste + fragment.slice(curseur);
}

// CE QU'UN FRAGMENT EXÉCUTE SANS GESTE. C'est la primitive de toute
// l'épreuve, et c'est là que le premier jet se trompait : elle n'était
// appliquée qu'au premier niveau du script. Descendu d'un cran, le graphe
// ramassait les appels écrits DANS les gestionnaires de clic — et déclarait
// « appelée au chargement » une fonction qui n'est appelée qu'au clic.
// Un gestionnaire reste un gestionnaire à n'importe quelle profondeur.
function sansGeste(fragment) {
  const aRetirer = [];
  for (const r of rappelsDe(fragment)) if (r.famille === 'geste') aRetirer.push([r.debut, r.fin]);
  return retirer(fragment, aRetirer);
}

// Les racines du chargement : le code de premier niveau, MOINS les corps de
// fonctions (qui ne s'exécutent que si on les appelle) et MOINS les gestes ;
// PLUS les corps des rappels de chargement et des rappels automatiques.
function racinesDuChargement(code, fonctions) {
  const aRetirer = [];
  for (const f of fonctions.values()) aRetirer.push([f.debut, f.fin]);
  const ajouts = [];
  for (const r of rappelsDe(code)) {
    if (r.famille === 'geste') aRetirer.push([r.debut, r.fin]);
    else ajouts.push(r.corps);
  }
  return retirer(code, aRetirer) + '\n' + ajouts.join('\n');
}

// Les fonctions qu'un fragment peut déclencher. Une RÉFÉRENCE NUE compte
// autant qu'un appel : `addEventListener('click', confirmerPriseDePoste)` ne
// porte aucune parenthèse, et c'est pourtant par là que passe la seule
// création de service du dépôt. Chercher « nom( » l'aurait manquée — et une
// épreuve qui manque le déclencheur qu'elle cherche est verte pour rien.
function appelsDans(fragment, fonctions) {
  const noms = new Set();
  const re = /([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(fragment))) if (fonctions.has(m[1])) noms.add(m[1]);
  return noms;
}

// Fonctions atteignables depuis le chargement, de proche en proche. On garde
// le parent de chacune : sans lui, un rouge ne dit pas PAR OÙ l'on est
// arrivé, et l'on ne peut pas distinguer une vraie trouvaille d'un défaut de
// l'analyseur. C'est ce qui a manqué au premier jet.
function atteignablesAuChargement(codeBrut) {
  const code = masquerCommentaires(codeBrut);
  const fonctions = fonctionsDe(code);
  const parent = new Map();
  const vues = new Set();
  const file = [];
  for (const n of appelsDans(racinesDuChargement(code, fonctions), fonctions)) {
    parent.set(n, '<chargement>'); file.push(n);
  }
  while (file.length) {
    const nom = file.shift();
    if (vues.has(nom)) continue;
    vues.add(nom);
    for (const suivant of appelsDans(sansGeste(fonctions.get(nom).corps), fonctions))
      if (!vues.has(suivant) && !parent.has(suivant)) { parent.set(suivant, nom); file.push(suivant); }
  }
  return { fonctions, vues, parent, net: code };
}

// Le chemin d'appel qui mène à une fonction, pour que tout rouge soit lisible.
function chemin(parent, nom) {
  const pile = [];
  let n = nom;
  while (n && n !== '<chargement>' && !pile.includes(n)) { pile.unshift(n); n = parent.get(n); }
  return ['<chargement>'].concat(pile).join(' → ');
}

// Quelle fonction contient cette position ? La PLUS INTERNE qui la couvre.
function fonctionContenant(fonctions, position) {
  let meilleure = null;
  for (const [nom, f] of fonctions)
    if (f.debut <= position && position < f.fin)
      if (!meilleure || f.debut > fonctions.get(meilleure).debut) meilleure = nom;
  return meilleure;
}

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// ── 1. Le recensement lui-même est gardé ─────────────────────────────────

const ECRITURES_ATTENDUES = {
  'NEXUS-Prise-De-Poste-v1.html': { table: 'shifts', nombre: 1 },
  'NEXUS-Pointage-v1.html': { table: 'pointages', nombre: 3 },
};

function ecrituresDePresence(f) {
  const src = lire(f);
  const positions = [];
  const re = /from\('(shifts|pointages)'\)\s*\.\s*(insert|upsert)/g;
  let m;
  while ((m = re.exec(src))) positions.push({ position: m.index, table: m[1], verbe: m[2] });
  return positions;
}

t('seuls deux écrans du dépôt écrivent une présence', () => {
  const ecrivains = {};
  for (const f of fs.readdirSync(RACINE).filter(n => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(n))) {
    const e = ecrituresDePresence(f);
    if (e.length) ecrivains[f] = e.length;
  }
  const attendu = {};
  for (const [f, v] of Object.entries(ECRITURES_ATTENDUES)) attendu[f] = v.nombre;
  assert.deepStrictEqual(ecrivains, attendu,
    'un nouvel écran écrit une présence — il doit passer par cette épreuve avant :\n' +
    JSON.stringify(ecrivains, null, 2));
});

// ── 2. Aucune de ces écritures n'est atteignable au chargement ───────────

// UNE SEULE exception, et elle est nommée. `viderLaFile` insère bien des
// pointages au chargement de NEXUS-Pointage-v1.html — mais elle ne les
// FABRIQUE pas : elle rejoue des lignes qu'un geste antérieur a déposées dans
// la file locale quand le réseau manquait. Refuser ce rejeu perdrait des
// pointages réellement effectués ; l'élargir en assouplissant la règle
// générale ouvrirait la porte à tout le reste. On la nomme donc, et on
// éprouve séparément les trois propriétés qui la rendent légitime.
const REJEU_HORS_LIGNE = { fichier: 'NEXUS-Pointage-v1.html', fonction: 'viderLaFile' };

t('le rejeu hors ligne reste la seule écriture admise au chargement, et le reste', () => {
  const code = scriptsDe(lire(REJEU_HORS_LIGNE.fichier));
  const { fonctions, vues, parent } = atteignablesAuChargement(code);
  const corps = fonctions.get(REJEU_HORS_LIGNE.fonction);
  assert.ok(corps, 'viderLaFile a disparu : le rejeu hors ligne a changé de forme, réexaminer');

  // (a) Elle n'insère jamais une ligne construite sur place : uniquement ce
  //     que la file contient déjà.
  const inserts = corps.corps.match(/from\('pointages'\)\s*\.\s*insert\(([^)]*)\)/g) || [];
  assert.deepStrictEqual(inserts, ["from('pointages').insert(entree.ligne)"],
    'viderLaFile construit une ligne de pointage au lieu de rejouer la file');

  // (b) Ce qui ALIMENTE la file, lui, ne doit pas partir au chargement —
  //     sinon la légitimité du rejeu serait circulaire.
  assert.ok(!vues.has('fileAjouter'),
    'fileAjouter est appelée au chargement : la file se remplirait toute seule,\n' +
    '    et le rejeu deviendrait une fabrique de pointages.\n' +
    '    Chemin : ' + chemin(parent, 'fileAjouter'));

  // (c) Elle ne vit que sur l'écran de pointage — jamais sur un écran que la
  //     consultation peut atteindre.
  for (const f of fs.readdirSync(RACINE).filter(n => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(n))) {
    if (f === REJEU_HORS_LIGNE.fichier) continue;
    assert.ok(!/function\s+viderLaFile/.test(lire(f)),
      `${f} porte un rejeu de file : l'exception doit rester sur l'écran de pointage`);
  }
});

t('aucune autre écriture de présence n\'est atteignable depuis le chargement d\'un écran', () => {
  for (const f of Object.keys(ECRITURES_ATTENDUES)) {
    const code = scriptsDe(lire(f));
    const { fonctions, vues, parent } = atteignablesAuChargement(code);
    for (const e of ecrituresDePresence(f)) {
      // La position est relative au fichier ; on la retrouve dans le script.
      const extrait = lire(f).slice(e.position, e.position + 60);
      const dansScript = code.indexOf(extrait);
      assert.ok(dansScript !== -1, `${f} : écriture hors <script> inline ?`);
      const porteuse = fonctionContenant(fonctions, dansScript);
      assert.ok(porteuse, `${f} : écriture sur ${e.table} au premier niveau du script — ` +
        'elle s\'exécuterait au chargement de la page');
      if (f === REJEU_HORS_LIGNE.fichier && porteuse === REJEU_HORS_LIGNE.fonction) continue;
      assert.ok(!vues.has(porteuse),
        `${f} : « ${porteuse} » écrit sur ${e.table} ET est appelée au chargement.\n` +
        '    Ouvrir l\'écran créerait une présence — c\'est exactement ce que la règle interdit.\n' +
        '    Chemin : ' + chemin(parent, porteuse));
    }
  }
});

t('chaque écriture de présence descend d\'un geste explicite de l\'utilisateur', () => {
  for (const f of Object.keys(ECRITURES_ATTENDUES)) {
    const src = lire(f);
    const code = scriptsDe(src);
    const { fonctions } = atteignablesAuChargement(code);
    for (const e of ecrituresDePresence(f)) {
      const porteuse = fonctionContenant(fonctions, code.indexOf(src.slice(e.position, e.position + 60)));
      // Atteignable depuis un gestionnaire ? On remonte : l'ensemble des
      // fonctions citées dans un rappel d'événement explicite, transitivement.
      const gestes = new Set();
      for (const r of rappelsDe(code)) {
        if (r.famille !== 'geste') continue;
        for (const n of appelsDans(r.corps, fonctions)) gestes.add(n);
      }
      for (const m2 of src.matchAll(/\son(?:click|submit|change)\s*=\s*["']([^"']*)["']/gi))
        for (const n of appelsDans(m2[1], fonctions)) gestes.add(n);
      // fermeture transitive
      const file = [...gestes];
      while (file.length) {
        const nom = file.shift();
        for (const suivant of appelsDans(fonctions.get(nom).corps, fonctions))
          if (!gestes.has(suivant)) { gestes.add(suivant); file.push(suivant); }
      }
      assert.ok(gestes.has(porteuse),
        `${f} : « ${porteuse} » écrit sur ${e.table} sans descendre d'aucun geste explicite.\n` +
        '    Une écriture que rien ne déclenche est soit morte, soit déclenchée autrement —\n' +
        '    dans les deux cas elle doit être expliquée avant d\'être acceptée.');
    }
  }
});

// ── 3. Les cinq cas nommés par l'arbitrage du 16/09/2026 ────────────────

t('cas 1 — un manager qui consulte ne crée aucun service', () => {
  // Cockpit, Verify, carburants, employés, résultats, administration : la
  // mission les nomme un par un. Aucun n'écrit de présence, et cela ne tient
  // pas à une garde qu'on pourrait désarmer — le code n'existe pas.
  for (const f of ['NEXUS-Cockpit-v2.html', 'NEXUS-Verify-v1.html',
                   'NEXUS-Carburants-Pilotage-v1.html', 'NEXUS-Resultats-Equipe-v1.html',
                   'NEXUS-Evaluation-Employe-v1.html', 'NEXUS-Planning-v1.html',
                   'NEXUS-Paye-v1.html', 'NEXUS-Parametres-Station-v1.html']) {
    assert.deepStrictEqual(ecrituresDePresence(f), [],
      `${f} écrit une présence : consulter y vaudrait pointage`);
  }
});

t('cas 2 — un employé qui consulte ses écarts ne crée aucun service', () => {
  for (const f of ['NEXUS-App-v1.html', 'NEXUS-Mon-Evolution-v1.html',
                   'NEXUS-Progression-v1.html', 'NEXUS-Apprentissage-v1.html',
                   'NEXUS-Mon-Planning-v1.html', 'NEXUS-Boite-Reception-v1.html']) {
    assert.deepStrictEqual(ecrituresDePresence(f), [],
      `${f} écrit une présence`);
  }
});

t('cas 3 et 4 — ni l\'actualisation ni la reconnexion ne pointent', () => {
  // Actualiser une page et revenir sur une session valide empruntent le même
  // chemin : nexusRequireAuth(). C'est le seul code que TOUS les écrans
  // exécutent au chargement — s'il écrivait, tout écran écrirait.
  const auth = lire('nexus-auth.js');
  assert.deepStrictEqual(ecrituresDePresence('nexus-auth.js'), [],
    'nexus-auth.js écrit une présence : chaque chargement d\'écran en créerait une');
  assert.ok(!/from\('(shifts|pointages)'\)[\s\S]{0,80}\.(insert|upsert|update|delete)/.test(auth),
    'le chemin commun d\'authentification modifie shifts ou pointages');
  // Et le rétablissement de session ne passe par aucune écriture.
  for (const f of ['nexus-session.js', 'nexus-supabase.js']) {
    if (fs.existsSync(path.join(RACINE, f)))
      assert.deepStrictEqual(ecrituresDePresence(f), [], `${f} écrit une présence`);
  }
});

t('cas 5 — seul le bouton de prise de poste ouvre un service', () => {
  const src = lire('NEXUS-Prise-De-Poste-v1.html');
  const code = scriptsDe(src);
  const { fonctions, vues, parent } = atteignablesAuChargement(code);
  const e = ecrituresDePresence('NEXUS-Prise-De-Poste-v1.html')[0];
  const porteuse = fonctionContenant(fonctions, code.indexOf(src.slice(e.position, e.position + 60)));
  assert.strictEqual(porteuse, 'confirmerPriseDePoste',
    'l\'unique création de service a changé de porteuse : réexaminer son déclenchement');
  assert.ok(!vues.has(porteuse),
    'confirmerPriseDePoste est appelée au chargement. Chemin : ' + chemin(parent, porteuse));
  const cite = rappelsDe(code).some(r => r.type === 'click' && /confirmerPriseDePoste/.test(r.corps));
  assert.ok(cite, 'plus aucun clic n\'appelle confirmerPriseDePoste');
});

console.log(`\n${passes} vérifications passées — se connecter, consulter, actualiser : rien de tout cela ne fabrique une présence.`);
