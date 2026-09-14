// Guardian Bible / UX Terrain — « jamais un chiffre inventé ».
//
// POURQUOI. Le premier principe de l'ADN NEXUS, écrit sur la page d'accueil du
// produit, est une promesse faite au lecteur d'écran : « Jamais un chiffre
// inventé. Si une donnée n'existe pas encore, NEXUS le dit clairement plutôt
// que d'afficher un chiffre plausible. » Ce principe est tenu par des humains
// attentifs et trahi par une habitude de programmeur : replier une valeur
// absente sur 0 pour que le code ne casse pas. Le code ne casse pas, en effet.
// C'est le lecteur qui casse : il voit « 0 L » là où la vérité est « pas de
// relevé », et il décide sur un chiffre fabriqué.
//
// CE QU'IL N'EST PAS. Ce n'est pas un détecteur de `|| 0`. Le dépôt en contient
// plus de six cents, et l'écrasante majorité est légitime : une somme qui
// démarre à zéro, un compteur d'occurrences, un index. Un garde qui les
// rapporterait tous serait désactivé dès sa première exécution, et le principe
// resterait sans gardien. Ce garde ne rapporte donc qu'une chose, et refuse de
// conclure ailleurs : une valeur MESURÉE, absente, repliée sur un nombre, qui
// part ENSUITE À L'AFFICHAGE. C'est la seule forme où le repli produit un
// mensonge visible.
//
// CE QUI EST CONFORME ET NE DOIT JAMAIS ÊTRE SIGNALÉ. Un repli vers `'—'`,
// `'non calculable'`, `null`, ou toute autre marque d'absence : c'est
// exactement ce que la doctrine demande. Le garde le reconnaît et se tait.
//
// D'OÙ VIENT SA MATIÈRE. Des fichiers versionnés du dépôt — écrans
// `NEXUS-*.html` et couches `nexus-*.js`. Aucun réseau, aucune base, aucun
// secret : reproductible en CI.
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');

// ── Périmètre ───────────────────────────────────────────────────────────
// Les écrans et les couches de données/moteurs qui les alimentent. Les
// fichiers de test sont hors portée : un jeu d'essai a le droit de fabriquer
// des chiffres, c'est même sa raison d'être.
function fichiersCandidats(racine) {
  return fs.readdirSync(racine)
    .filter(f => /^NEXUS-.*\.html$/.test(f) || (/^nexus-.*\.js$/.test(f) && !f.startsWith('test_')))
    .sort();
}

// ── Neutralisation du texte non exécutable ──────────────────────────────
// Un `|| 0` dans un commentaire ou dans une chaîne n'affiche rien. On masque
// donc commentaires et littéraux de chaîne PAR DES ESPACES, à longueur
// constante, pour que les numéros de ligne restent ceux du fichier réel : un
// garde qui pointe la mauvaise ligne fait perdre plus de temps qu'il n'en fait
// gagner. Les interpolations `${...}` des gabarits sont conservées — c'est
// justement là que vit le chemin d'affichage.
//
// Trois pièges mesurés sur le dépôt réel, pas supposés — un contrôle
// d'équilibre des parenthèses et des accolades les a tous les trois révélés,
// et il dérivait sur 104 fichiers sur 104 avant correction :
//
//   1. Les LITTÉRAUX D'EXPRESSION RÉGULIÈRE. `/\d{2}/` ou `/[({]/` ouvrent des
//      accolades qui ne se ferment jamais, et `/['"]/` ouvre une « chaîne » qui
//      dévore le code suivant. Il faut donc distinguer la division du littéral,
//      par le dernier jeton significatif.
//   2. Les APOSTROPHES DANS LES GABARITS. Le produit est en français :
//      `` `L'écart de ${x} L` `` est partout. Traiter l'apostrophe comme une
//      ouverture de chaîne effaçait l'interpolation qui la suit — donc le
//      chemin d'affichage lui-même. L'état « corps de gabarit » doit être
//      examiné AVANT les guillemets, pas après.
//   3. `${` et `{` se ferment tous deux par `}` : une seule pile.
function neutraliser(source) {
  const out = source.split('');
  const n = source.length;
  const espacer = (a, b) => { for (let k = a; k < b && k < n; k++) if (out[k] !== '\n') out[k] = ' '; };

  // Un `/` ouvre une regex quand ce qui précède ne peut pas être un opérande.
  const MOTS_AVANT_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'do', 'else', 'yield', 'await']);
  let dernierSignificatif = '';
  const regexPossible = () => {
    if (!dernierSignificatif) return true;
    if (/[\w$)\]]/.test(dernierSignificatif.slice(-1))) return MOTS_AVANT_REGEX.has(dernierSignificatif);
    return true;
  };
  const marquerJeton = (txt) => { const t = txt.trim(); if (t) dernierSignificatif = /[\w$]$/.test(t) ? (/[\w$]+$/.exec(t) || [''])[0] : t.slice(-1); };

  const pile = []; // 'gabarit' | 'accolade'
  const dansGabarit = () => pile.length && pile[pile.length - 1] === 'gabarit';
  let i = 0;
  while (i < n) {
    // Corps littéral d'un gabarit : examiné en premier (piège 2).
    if (dansGabarit()) {
      let j = i;
      while (j < n) {
        if (source[j] === '\\') { j += 2; continue; }
        if (source[j] === '`') break;
        if (source[j] === '$' && source[j + 1] === '{') break;
        j++;
      }
      espacer(i, j);
      if (j >= n) { i = n; continue; }
      if (source[j] === '`') { pile.pop(); dernierSignificatif = ')'; i = j + 1; continue; }
      pile.push('accolade'); dernierSignificatif = ''; i = j + 2; continue;
    }
    const c = source[i];
    if (c === '/' && source[i + 1] === '/') {
      const fin = source.indexOf('\n', i); espacer(i, fin < 0 ? n : fin); i = fin < 0 ? n : fin; continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      const fin = source.indexOf('*/', i + 2); const j = fin < 0 ? n : fin + 2; espacer(i, j); i = j; continue;
    }
    if (c === '/' && regexPossible()) {
      let j = i + 1; let classe = false; let ferme = false;
      while (j < n) {
        const d = source[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '\n') break;              // pas de regex multiligne : c'était une division
        if (d === '[') classe = true;
        else if (d === ']') classe = false;
        else if (d === '/' && !classe) { ferme = true; break; }
        j++;
      }
      if (ferme) {
        while (j + 1 < n && /[a-z]/.test(source[j + 1])) j++;  // drapeaux gimsuy
        espacer(i, j + 1); dernierSignificatif = ')'; i = j + 1; continue;
      }
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && source[j] !== c) { if (source[j] === '\\') { j += 2; continue; } if (source[j] === '\n') break; j++; }
      espacer(i, j + 1); dernierSignificatif = ')'; i = j + 1; continue;
    }
    if (c === '`') { pile.push('gabarit'); i++; continue; }
    if (c === '{') { pile.push('accolade'); dernierSignificatif = '{'; i++; continue; }
    if (c === '}') { pile.pop(); dernierSignificatif = '}'; i++; continue; }
    if (!/\s/.test(c)) {
      if (/[\w$]/.test(c)) { let j = i; while (j < n && /[\w$]/.test(source[j])) j++; marquerJeton(source.slice(i, j)); i = j; continue; }
      dernierSignificatif = c;
    }
    i++;
  }
  return out.join('');
}

// Dans un `.html`, seul le contenu des `<script>` est du code. Le reste est
// masqué (à longueur constante, toujours pour les numéros de ligne).
function isolerScripts(source) {
  const out = source.split('').map(ch => (ch === '\n' ? '\n' : ' '));
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(source))) {
    const debut = m.index + m[0].indexOf('>') + 1;
    for (let k = debut; k < debut + m[1].length; k++) out[k] = source[k];
  }
  return out.join('');
}

// ── Contexte syntaxique ─────────────────────────────────────────────────
// Pour chaque position, on veut savoir dans quelles parenthèses et dans
// quelles interpolations on se trouve. Une passe unique construit une pile ;
// les regards en arrière ligne à ligne, eux, confondent `${` d'affichage et
// `${}` de construction de clé — on les a essayés, ils mentent.
function pilesParPosition(code, positions) {
  const resultats = new Map();
  const aExaminer = [...positions].sort((a, b) => a - b);
  let prochain = 0;
  const pile = [];
  const identAvant = (k) => {
    let j = k - 1;
    while (j >= 0 && /\s/.test(code[j])) j--;
    let fin = j + 1;
    while (j >= 0 && /[\w$.]/.test(code[j])) j--;
    const brut = code.slice(j + 1, fin);
    return brut.includes('.') ? brut.slice(brut.lastIndexOf('.') + 1) : brut;
  };
  for (let i = 0; i < code.length; i++) {
    while (prochain < aExaminer.length && aExaminer[prochain] === i) {
      resultats.set(aExaminer[prochain], pile.slice());
      prochain++;
    }
    const c = code[i];
    // `{` de bloc et `${` d'interpolation se ferment tous deux par `}` : ils
    // doivent donc vivre sur la MÊME pile. Les compter séparément faisait
    // dépiler une interpolation à chaque accolade de bloc — le garde croyait
    // alors être dans un gabarit d'affichage à peu près n'importe où.
    if (c === '$' && code[i + 1] === '{') { pile.push({ type: 'interp', nom: '' }); i++; continue; }
    if (c === '{') { pile.push({ type: 'bloc', nom: '' }); continue; }
    if (c === '}') {
      for (let k = pile.length - 1; k >= 0; k--) {
        if (pile[k].type === 'interp' || pile[k].type === 'bloc') { pile.splice(k, 1); break; }
      }
      continue;
    }
    if (c === '(') { pile.push({ type: 'appel', nom: identAvant(i) }); continue; }
    if (c === ')') { for (let k = pile.length - 1; k >= 0; k--) if (pile[k].type === 'appel') { pile.splice(k, 1); break; } continue; }
  }
  while (prochain < aExaminer.length) { resultats.set(aExaminer[prochain], pile.slice()); prochain++; }
  return resultats;
}

// ── Vocabulaire ─────────────────────────────────────────────────────────
// Fonctions de mise en forme réellement utilisées dans le dépôt (fmtNum,
// fmtEuro, fmtL, fmtPct, numFR, formaterEuros…). Un argument qui entre là
// ressort sur un écran : c'est la définition opérationnelle de « affiché ».
const RE_FONCTION_AFFICHAGE = /^(fmt|format|formater|numFR|afficher)/i;
const RE_METHODE_AFFICHAGE = /^\s*\)*\s*\.\s*(toFixed|toLocaleString|toPrecision)\s*\(/;
const RE_ECRITURE_DOM = /\.(textContent|innerHTML|innerText)\s*=[^=]/;

// Fonctions dont l'argument n'est PAS un affichage même si le nom y ressemble
// (mise en forme de date : une date absente ne produit pas « 0 »).
const RE_FONCTION_DATE = /date|jour|heure|instant|semaine|mois/i;

// Accumulation : le 0 est l'élément neutre d'une somme, pas une valeur lue.
// C'est le premier gisement de faux positifs du dépôt (150 occurrences).
const APPELS_ACCUMULATION = new Set(['reduce', 'reduceRight']);

// UNE UNITÉ, PAS UN VOCABULAIRE. Première tentative : une liste de mots
// « mesure » (volume, litre, montant, écart…) à chercher dans le nom du champ.
// Elle marchait sur les cas connus et ratait le plus emblématique de tous,
// `nexus-carburant-demarrage-mois-v1.js:19` — `Math.round(Number(v)||0)
// .toLocaleString('fr-FR')+' L'`, c'est-à-dire littéralement le « 0 L » que la
// doctrine interdit — parce que la valeur s'appelle `v`. Une liste de mots
// français est aussi vouée à devenir aveugle au premier champ nouvellement
// nommé, et sans jamais le dire.
//
// La preuve solide n'est pas dans le NOM de la variable, elle est dans ce que
// l'ÉCRAN met à côté du chiffre. « 0 » suivi de « € », « L », « % » est lu
// comme une quantité mesurée ; c'est exactement là que le zéro ment. On exige
// donc l'unité au point d'affichage.
const RE_UNITE_AFFICHEE = /^\s*(?:&nbsp;|\s)*(€|EUR\b|L\b|%|pts?\b|km\b|kWh|h\b|min\b|u\b|unit)/;

// Un DÉNOMBREMENT, lui, vaut légitimement zéro quand rien n'a été observé :
// « 0 alerte » est vrai, « 0 L » ne l'est pas. On le reconnaît par MOTS, pas
// par sous-chaînes : une version antérieure cherchait `eur\b` et accusait
// `etatMoteur.documents_en_attente` d'être un montant en euros. Un garde qui
// lit « moteur » comme « euro » ne mesure plus rien, il tire au hasard.
const MOTS_DENOMBREMENT = new Set([
  'count', 'nombre', 'nb', 'n', 'length', 'taille', 'idx', 'rang',
  'position', 'page', 'offset', 'limite', 'occurrences', 'cardinal', 'size',
]);

// Découpe `Number(c.cuves[0].capaciteMax)` en mots comparables.
function motsDe(expression) {
  return expression
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Marques d'absence assumée — mais SEULEMENT quand elles sont la valeur de
// repli, pas quand elles décorent la phrase. Le tiret cadratin est le
// séparateur typographique maison (« 3 cuves — capacité totale ») : le
// chercher n'importe où dans la ligne faisait taire le garde sur deux vrais
// findings. On exige donc la forme `? '—'`, `: '—'`, `|| '—'`, `?? '—'`.
const RE_ABSENCE_ASSUMEE = /(?:\?\?|\|\||\?|:)\s*['"`]\s*(?:—|–|-|n\/a|nd|non calculable|non renseign|indisponible|pas de donn|aucune donn)/i;

// ── Extraction de l'opérande replié ─────────────────────────────────────
// On remonte depuis l'opérateur en équilibrant parenthèses et crochets, pour
// récupérer l'expression exacte dont l'absence est masquée. On rend AUSSI sa
// position de départ : sans elle, l'appelant devait la retrouver par une
// recherche arrière dans tout le fichier (voir la note de performance plus
// bas — c'est ce genre de « juste un petit slice » qui a coûté 55 secondes).
function operandeGauche(code, posOperateur) {
  let j = posOperateur - 1;
  while (j >= 0 && ESPACES.has(code[j])) j--;
  const fin = j + 1;
  let prof = 0;
  while (j >= 0) {
    const c = code[j];
    if (c === ')' || c === ']') { prof++; j--; continue; }
    if (c === '(' || c === '[') { if (prof === 0) break; prof--; j--; continue; }
    if (prof === 0 && SEPARATEURS.has(c)) break;
    j--;
  }
  return { texte: code.slice(j + 1, fin).trim(), debut: j + 1 };
}

const ESPACES = new Set([' ', '\t', '\n', '\r', '\f', '\v']);
const SEPARATEURS = new Set([',', ';', '{', '}', '=', '?', ':', '&', '|', '+', '-', '*', '/', '%', '<', '>', '!', '\n']);

// Table des débuts de ligne, construite UNE fois par fichier. La version
// naïve — recompter les `\n` depuis le début du fichier à chaque position —
// est quadratique et devient visible dès que le journal de calibration est
// activé : c'est elle qui faisait passer la suite de tests au-delà du
// budget de 30 s du lanceur.
function tableLignes(source) {
  const debuts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') debuts.push(i + 1);
  return debuts;
}

function ligneDe(debuts, index) {
  let a = 0, b = debuts.length - 1;
  while (a < b) { const m = (a + b + 1) >> 1; if (debuts[m] <= index) a = m; else b = m - 1; }
  return a + 1;
}

function texteLigne(source, index) {
  const a = source.lastIndexOf('\n', index) + 1;
  const b = source.indexOf('\n', index);
  return source.slice(a, b < 0 ? source.length : b).trim();
}

// ── Le contrôle ─────────────────────────────────────────────────────────
const RE_REPLI = /(\|\||\?\?)\s*(?:0(?![\w.])|'0'|"0")/g;

function analyserFichier(nom, source, { journal } = {}) {
  const debuts = tableLignes(source);
  const noter = (motif, p, extra) => { if (journal) journal.push({ fichier: nom, motif, ligne: ligneDe(debuts, p.index), extrait: texteLigne(source, p.index).slice(0, 160), ...extra }); };
  const estHtml = nom.endsWith('.html');
  const code = neutraliser(estHtml ? isolerScripts(source) : source);

  const positions = [];
  RE_REPLI.lastIndex = 0;
  let m;
  while ((m = RE_REPLI.exec(code))) positions.push({ index: m.index, fin: m.index + m[0].length });
  if (!positions.length) return { total: 0, findings: [] };

  const piles = pilesParPosition(code, positions.map(p => p.index));
  const findings = [];
  // La même mesure repliée trois fois sur la même ligne (couleur, signe,
  // valeur) est UN défaut à corriger, pas trois. Rapporter trois fois ce que
  // le lecteur corrigera d'un seul geste, c'est fabriquer du bruit.
  const dejaVu = new Set();

  for (const p of positions) {
    const pile = piles.get(p.index) || [];

    // 1. Le repli part-il à l'affichage ? Sans sink, pas de mensonge visible :
    //    le garde se tait, même si le repli est douteux par ailleurs.
    let sink = null;
    const appels = pile.filter(e => e.type === 'appel');
    const appelDirect = appels.length ? appels[appels.length - 1].nom : '';
    if (RE_METHODE_AFFICHAGE.test(code.slice(p.fin, p.fin + 40))) sink = 'methode_de_mise_en_forme';
    else if (RE_FONCTION_AFFICHAGE.test(appelDirect) && !RE_FONCTION_DATE.test(appelDirect)) sink = `fonction_${appelDirect}`;
    else if (pile.some(e => e.type === 'interp')) sink = 'interpolation_de_gabarit';
    else if (RE_ECRITURE_DOM.test(texteLigne(code, p.index))) sink = 'ecriture_dom';
    if (!sink) { noter('hors_affichage', p); continue; }

    // 1 bis. Être dans un `${}` ne veut pas dire être affiché. Cas mesuré sur
    //   NEXUS-FDJ-v1:1861 : `${(reportTempsReel.caisse_tirages ?? 0) < 0 ?
    //   'actif' : ''}` pilote la classe CSS d'un bouton ± ; la valeur visible,
    //   juste à côté, est `?? ''` — donc parfaitement conforme à la doctrine.
    //   Quand le repli alimente une COMPARAISON, ce qui sort du gabarit est un
    //   drapeau, pas un chiffre. Accuser ici, c'est demander de corriger un
    //   code déjà correct : le meilleur moyen de faire désactiver le garde.
    if (/^\s*\)*\s*(===|!==|==|!=|<=|>=|<|>)/.test(code.slice(p.fin, p.fin + 12))) {
      noter('alimente_une_comparaison', p); continue;
    }

    // 2. Accumulation : le 0 est l'élément neutre d'une somme. Légitime.
    if (appels.some(e => APPELS_ACCUMULATION.has(e.nom))) { noter('accumulation', p); continue; }
    const ligne = texteLigne(code, p.index);
    if (/\+=|-=/.test(ligne)) { noter('accumulation', p); continue; }

    // 3. L'auteur a-t-il déjà dit l'absence ailleurs dans la ligne ? Alors le
    //    repli sert d'autre chose (un calcul intermédiaire) et l'écran, lui,
    //    affiche bien « — ». Ne pas accuser quelqu'un qui a fait le travail.
    if (RE_ABSENCE_ASSUMEE.test(texteLigne(source, p.index))) { noter('absence_deja_dite', p); continue; }

    // 4. Le repli est-il un terme d'addition ? `fmtEuro(ca + (tirages || 0))`
    //    n'invente rien : 0 est l'élément neutre. C'est la même famille que
    //    `reduce`, mais écrite à la main — et c'est le premier gisement de
    //    faux positifs du dépôt.
    //
    //    PERFORMANCE — ces quatre lignes ont coûté 55 secondes de balayage.
    //    La version d'origine écrivait, avec les meilleures intentions :
    //      code.slice(0, debutOperande).replace(/[\s(]+$/, '').slice(-1)
    //    Trois fautes cumulées, mesurées au profileur (99,6 % du temps CPU
    //    dans « RegExp: [\s(]+$ »), pas devinées :
    //      — `code.slice(0, debut)` recopie tout le début du fichier à CHAQUE
    //        candidat : quadratique en la taille du fichier ;
    //      — `[\s(]+$` ancré en fin de chaîne oblige le moteur à tenter le
    //        motif à chaque position de ces 350 ko ;
    //      — le masque remplace tout le texte non exécutable par des ESPACES,
    //        donc `[\s(]+` rencontre des runs de milliers de blancs et
    //        repart en arrière sur chacun. D'où l'anomalie qui a mis sur la
    //        piste : un fichier de 353 ko coûtait 26 s quand un fichier PLUS
    //        GROS de 370 ko n'en coûtait que 11 — le coût suivait la densité
    //        de blancs, pas la taille.
    //    Le remplacement ne lit que quelques caractères autour du repli.
    const { texte: operande, debut } = operandeGauche(code, p.index);
    if (!operande) { noter('operande_illisible', p); continue; }
    let a = debut - 1;
    while (a >= 0 && (ESPACES.has(code[a]) || code[a] === '(')) a--;
    const avant = a >= 0 ? code[a] : '';
    let b = p.fin;
    while (b < code.length && (ESPACES.has(code[b]) || code[b] === ')')) b++;
    const apresZero = b < code.length ? code[b] : '';
    if (avant === '+' || avant === '-' || apresZero === '+' || apresZero === '-') {
      noter('terme_d_addition', p, { operande }); continue;
    }

    // 5. Un dénombrement vaut légitimement zéro. Une mesure, non.
    const mots = motsDe(operande);
    if (mots.some(w => MOTS_DENOMBREMENT.has(w))) { noter('denombrement', p, { operande }); continue; }

    // 6. L'écran met-il une unité à côté du chiffre ? Sans unité, on ne peut
    //    pas affirmer que le lecteur lira « 0 » comme une quantité mesurée —
    //    et le garde ne conclut jamais sur une supposition. Les mises en forme
    //    monétaires et numériques (fmtEur, toLocaleString…) portent l'unité en
    //    elles-mêmes : la preuve y est déjà faite.
    if (sink === 'interpolation_de_gabarit' || sink === 'ecriture_dom') {
      const finInterp = source.indexOf('}', p.fin);
      const apres = finInterp < 0 ? '' : source.slice(finInterp + 1, finInterp + 16);
      if (!RE_UNITE_AFFICHEE.test(apres)) { noter('pas_d_unite_affichee', p, { operande, apres }); continue; }
    }

    // 5. Une mesure vient d'une donnée : un champ, une entrée de table, un
    //    retour de couche. Une variable locale nue a pu être calculée juste
    //    au-dessus et déjà contrôlée — le garde ne sait pas, donc il se tait.
    const estAccesDonnee = /[.[]/.test(operande) || /\b(Number|parseFloat|parseInt)\s*\(/.test(operande);
    if (!estAccesDonnee) { noter('pas_un_acces_donnee', p, { operande }); continue; }

    const ligneSource = ligneDe(debuts, p.index);
    const cle = `${ligneSource}|${operande}`;
    if (dejaVu.has(cle)) continue;
    dejaVu.add(cle);

    findings.push({
      guardian: 'Bible / UX Terrain',
      code: 'chiffre_invente_repli_zero',
      fichier: nom,
      ligne: ligneSource,
      sink,
      expression: operande,
      extrait: texteLigne(source, p.index).slice(0, 200),
      message: `\`${operande}\` est replié sur 0 puis affiché (${sink}) — une mesure absente devient un chiffre plausible. ADN NEXUS : dire l'absence (« — », « non calculable »), jamais 0.`,
    });
  }
  return { total: positions.length, findings };
}

function analyser({ racine = RACINE, fichiers, journal } = {}) {
  // « Aucune liste » et « une liste vide » ne sont PAS la même chose. Confondre
  // les deux — le premier réflexe d'écriture, et le défaut qu'a trouvé
  // l'épreuve d'interface — faisait qu'un diff sans aucun fichier en portée
  // déclenchait un balayage de tout le dépôt : le routeur aurait crié 17 fois
  // sur une migration SQL qui ne touche à aucun écran.
  const liste = Array.isArray(fichiers) ? fichiers : fichiersCandidats(racine);
  const findings = [];
  let total = 0;
  let examines = 0;
  for (const f of liste) {
    const chemin = path.join(racine, f);
    if (!fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) continue;
    let source;
    try { source = fs.readFileSync(chemin, 'utf8'); } catch (err) { continue; }
    examines++;
    const r = analyserFichier(f, source, { journal });
    total += r.total;
    findings.push(...r.findings);
  }
  return { fichiersExamines: examines, replisTotal: total, findings };
}

// Le routeur attend `executer` ; il ne passe que les fichiers du diff. Un
// fichier hors périmètre (ni écran ni couche) est ignoré silencieusement —
// ce garde n'a rien à dire sur une migration SQL ou un workflow.
function executer({ racine = RACINE, fichiers } = {}) {
  const perimetre = fichiers
    ? fichiers.filter(f => /^NEXUS-.*\.html$/.test(f) || (/^nexus-.*\.js$/.test(f) && !f.startsWith('test_')))
    : undefined;
  return analyser({ racine, fichiers: perimetre });
}

module.exports = {
  analyser,
  executer,
  analyserFichier,
  fichiersCandidats,
  neutraliser,
  isolerScripts,
  operandeGauche,
};

if (require.main === module) {
  const r = analyser({});
  if (!r.findings.length) {
    console.log(`Guardian Bible / UX Terrain : OK — ${r.fichiersExamines} fichier(s), ${r.replisTotal} repli(s) vers 0 examiné(s), 0 finding.`);
    process.exit(0);
  }
  console.log(`Guardian Bible / UX Terrain : ${r.findings.length} finding(s) sur ${r.replisTotal} repli(s) examiné(s).`);
  for (const f of r.findings) {
    console.log(`  ${f.fichier}:${f.ligne} [${f.sink}] ${f.expression}`);
    console.log(`      ${f.extrait}`);
  }
  process.exit(1);
}
