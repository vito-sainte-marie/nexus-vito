// Guardian QA / Regression — détecte les épreuves qui NE PEUVENT PAS échouer.
//
// POURQUOI. Une épreuve verte prouve quelque chose seulement si elle est
// capable de rougir. Ce dépôt a produit trois fois la même journée (07/09/2026)
// des tests structurellement incapables d'échouer :
//   1. `assert.ok(/2/.test(sortie))` — le motif « 2 » matchait « issue-28 »
//      présent dans la sortie ; l'assertion passait quoi que fasse le code.
//   2. Un aide de test ne capturant que `stdout` alors que le message contrôlé
//      partait sur `stderr` : l'assertion portait sur une chaîne vide.
//   3. Des assertions tautologiques (`assert(true)`, `assert.strictEqual(x, x)`).
// Une suite verte devient alors un mensonge coûteux : elle protège d'autant
// moins qu'on lui fait davantage confiance. Cette garde regarde les épreuves
// elles-mêmes, pas le code qu'elles épreuvent.
//
// CE QU'ELLE N'EST PAS. Ce n'est pas un juge de couverture ni de pertinence :
// elle ne dit jamais « ce test est bon ». Elle ne sait dire qu'une chose,
// mécaniquement : « cette assertion-là ne peut pas échouer ». Quand elle ne
// sait pas conclure, elle se tait — un détecteur bruyant se fait désactiver,
// et un détecteur désactivé ne détecte rien. Chaque règle ci-dessous a donc
// été calibrée sur les ~200 épreuves réelles du dépôt jusqu'à ce que chaque
// finding restant soit défendable devant l'auteur du test.
//
// CE QU'ELLE NE VOIT PAS — à savoir avant de lui faire confiance :
//   - une assertion juste sur la MAUVAISE chose (le bon motif contre la
//     mauvaise variable) : c'est une question de sens, pas de forme ;
//   - un mock qui rend l'attendu, si le mock et l'assertion ne partagent pas
//     le texte de l'appel — la duplication reconnue est textuelle ;
//   - une branche de code jamais atteinte par l'épreuve (couverture) ;
//   - un `it()`/`describe()` vide, ou une épreuve désactivée par un `return`
//     précoce ou un `if (false)` ;
//   - un motif long mais matchant tout de même une entrée que l'épreuve
//     injecte elle-même. La corroboration par les littéraux du fichier a été
//     tentée puis abandonnée : elle rendait 14 à 27 findings sur le dépôt,
//     presque tous parce que le motif retrouvait le TITRE du cas de test, qui
//     n'atteint jamais la sortie observée. Faute de savoir quels littéraux
//     sont réellement injectés, la garde se tait plutôt que d'accuser.
//
// COMMENT ELLE LIT. Par un lexeur maison (pas de dépendance : ce dépôt n'en a
// aucune) qui neutralise commentaires et contenus de chaînes AVANT d'analyser.
// Ce n'est pas un détail : les épreuves de ce dépôt commentent abondamment les
// défauts qu'elles corrigent — un grep naïf se serait dénoncé lui-même en
// trouvant « assert(true) » dans le commentaire qui explique pourquoi il ne
// faut pas l'écrire.
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');

// ── Lexeur : neutraliser ce qui n'est pas du code ───────────────────────
// Rend une vue de MÊME LONGUEUR que la source, où les commentaires et le
// CONTENU des chaînes sont remplacés par des espaces. Les littéraux regex
// sont conservés intacts : ils sont précisément la matière de la règle 1.
// Conserver les longueurs permet de rapporter des offsets exacts et de
// ressortir le texte d'origine par `src.slice()`.
function vueCode(src) {
  // `split('')` et non `Array.from` : ce dernier découpe par POINT DE CODE,
  // alors que `src[i]` et `indexOf` comptent en unités UTF-16. Les 🟢🟡🟠🔴 du
  // vocabulaire d'alertes carburant décalaient donc la vue d'un cran par
  // emoji, et la garde lisait du code au petit bonheur — elle a signalé un
  // fichier « sans assertion » qui en contenait vingt-neuf.
  const out = src.split('');
  const blanchir = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0;
  // Le dernier caractère « significatif » décide si un `/` ouvre une regex ou
  // est une division. Sans cette distinction, `a / b / c` devient une fausse
  // regex et avale le reste de la ligne.
  let precedent = '';
  const NON_REGEX = /[\w$)\]]/; // après un identifiant, un nombre, `)` ou `]` : division
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { let j = src.indexOf('\n', i); if (j < 0) j = src.length; blanchir(i, j); i = j; continue; }
    if (c === '/' && src[i + 1] === '*') { let j = src.indexOf('*/', i + 2); j = j < 0 ? src.length : j + 2; blanchir(i, j); i = j; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) break;
        j++;
      }
      blanchir(i + 1, Math.min(j, src.length));
      i = Math.min(j + 1, src.length);
      precedent = c;
      continue;
    }
    if (c === '/' && !NON_REGEX.test(precedent)) {
      // Littéral regex : on le laisse tel quel, mais il faut en trouver la fin
      // sans se faire piéger par `[/]` ni par `\/`.
      let j = i + 1, classe = false, ferme = false;
      while (j < src.length) {
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '\n') break;                 // pas de regex multiligne : c'était une division
        if (d === '[') classe = true;
        else if (d === ']') classe = false;
        else if (d === '/' && !classe) { ferme = true; break; }
        j++;
      }
      if (ferme) { i = j + 1; precedent = '/'; continue; }
      i++; precedent = c; continue;
    }
    if (!/\s/.test(c)) precedent = c;
    i++;
  }
  return out.join('');
}

function ligneDe(src, offset) {
  let n = 1;
  for (let i = 0; i < offset && i < src.length; i++) if (src[i] === '\n') n++;
  return n;
}

// Parenthèse fermante correspondante, dans la vue neutralisée.
function finAppel(code, ouvrante) {
  let profondeur = 0;
  for (let i = ouvrante; i < code.length; i++) {
    const c = code[i];
    if (c === '(' || c === '[' || c === '{') profondeur++;
    else if (c === ')' || c === ']' || c === '}') { profondeur--; if (profondeur === 0) return i; }
  }
  return -1;
}

function finBloc(code, accolade) {
  return finAppel(code, accolade);
}

// Découpe les arguments de premier niveau (offsets absolus dans la source).
function decouperArguments(code, ouvrante, fermante) {
  const args = [];
  let profondeur = 0, debut = ouvrante + 1;
  for (let i = ouvrante; i < fermante; i++) {
    const c = code[i];
    if (c === '(' || c === '[' || c === '{') profondeur++;
    else if (c === ')' || c === ']' || c === '}') profondeur--;
    else if (c === ',' && profondeur === 1) { args.push([debut, i]); debut = i + 1; }
  }
  args.push([debut, fermante]);
  return args.filter(([a, b]) => code.slice(a, b).trim().length > 0);
}

// ── Recensement des appels d'assertion ──────────────────────────────────
// On accepte `assert(...)`, `assert.ok(...)`, `assert.strictEqual(...)`, ainsi
// que les alias locaux fréquents (`assert2`, `a.ok`) via le préfixe `assert`.
const RE_APPEL_ASSERT = /\bassert(?:\s*\.\s*([A-Za-z]+))?\s*\(/g;

function appelsAssert(src, code) {
  const appels = [];
  RE_APPEL_ASSERT.lastIndex = 0;
  let m;
  while ((m = RE_APPEL_ASSERT.exec(code)) !== null) {
    const ouvrante = code.indexOf('(', m.index + 'assert'.length);
    const fermante = finAppel(code, ouvrante);
    if (fermante < 0) continue;
    appels.push({
      debut: m.index,
      methode: m[1] || 'ok',
      ouvrante,
      fermante,
      args: decouperArguments(code, ouvrante, fermante),
      texte: src.slice(m.index, fermante + 1),
    });
    RE_APPEL_ASSERT.lastIndex = fermante;
  }
  return appels;
}

function normaliser(texte) {
  return texte.replace(/\s+/g, '').trim();
}

// ── Règle 1 : motif trop permissif ──────────────────────────────────────
// Un motif sans ancrage dont la plus longue suite de caractères littéraux est
// très courte matche à peu près n'importe quelle sortie de processus. `/2/`
// contre une sortie où traîne « issue-28 » en est le cas d'école.
//
// CALIBRAGE. Trois garde-fous, appris en passant la garde sur les 209 épreuves
// réelles : (a) on n'inspecte que les motifs appliqués à une sortie de
// processus ou à une chaîne libre — un `/^ok$/` sur un champ typé ne trompe
// personne ; (b) un ancrage (`^`, `$`, `\b`) ou une alternative de mots suffit
// à rendre le motif défendable ; (c) le seuil est à 2 caractères littéraux :
// à 3, la garde protestait contre des motifs comme `/n\/a/` parfaitement nets.
const SEUIL_LITTERAL = 3;

// Extrait la plus longue suite de caractères littéraux consécutifs d'une regex :
// ce qui reste quand on retire classes, groupes, quantificateurs et ancrages.
function pluslongueSuiteLitterale(motif) {
  let max = 0, courant = 0, dansClasse = false;
  for (let i = 0; i < motif.length; i++) {
    const c = motif[i];
    // Le contenu d'une classe ne vaut rien comme littéral : `[0-9]` n'est pas
    // trois caractères choisis, c'est « un chiffre quelconque » — aussi
    // permissif que le `/2/` d'origine. La première version les comptait, et
    // aurait laissé passer `/[0-9]/` contre une sortie de processus.
    if (dansClasse) { if (c === '\\') i++; else if (c === ']') dansClasse = false; courant = 0; continue; }
    if (c === '[') { dansClasse = true; courant = 0; continue; }
    if (c === '\\') {
      const suivant = motif[i + 1];
      // `\.` `\(` `\/` sont des caractères littéraux ; `\d` `\s` `\w` non.
      if (suivant && /[dswDSWbBnrtN0-9]/.test(suivant)) { courant = 0; }
      // `max` doit être mis à jour ICI aussi : sans cela, une suite qui se
      // TERMINE par un caractère échappé (`/\/2\//`, `/commit\(s\)/`) était
      // comptée trop court, et la garde accusait des motifs parfaitement nets.
      else if (++courant > max) max = courant;
      i++;
      continue;
    }
    if ('[](){}|^$*+?.'.includes(c)) { courant = 0; continue; }
    // Un quantificateur qui suit un littéral peut le rendre optionnel :
    // `ab?` n'a qu'un « a » garanti. On reste conservateur et on coupe.
    if (i + 1 < motif.length && '*+?{'.includes(motif[i + 1])) { courant = 0; continue; }
    courant++;
    if (courant > max) max = courant;
  }
  return max;
}

function motifAncre(motif) {
  return /(^|[^\\])[\^$]/.test(motif) || /\\b/.test(motif);
}

// Noms de variables qui, dans ce dépôt, désignent une sortie de processus ou
// un texte libre. C'est le filtre qui a fait passer la règle de « bruyante »
// à « défendable » : sur un identifiant métier, un motif court est un choix,
// pas un accident.
const RE_TEXTE_LIBRE = /\b(sortie|stdout|stderr|out|log|logs|message|msg|texte|contenu|corps|body|html|sql|rapport|resultat\.message)\b/i;

function reglesMotifPermissif(src, code, appels) {
  const findings = [];
  for (const a of appels) {
    // Deux écritures : `assert.match(cible, /re/)` et `assert.ok(/re/.test(cible))`.
    let motif = null, cible = null;
    if (a.methode === 'match' || a.methode === 'doesNotMatch') {
      if (a.args.length < 2) continue;
      cible = src.slice(a.args[0][0], a.args[0][1]);
      const brut = code.slice(a.args[1][0], a.args[1][1]).trim();
      const mm = /^\/(.*)\/[gimsuy]*$/.exec(brut);
      if (mm) motif = mm[1];
    } else if (a.methode === 'ok' || a.methode === 'strictEqual' || a.methode === 'equal') {
      const premier = code.slice(a.args[0][0], a.args[0][1]).trim();
      const mm = /^\/(.*)\/[gimsuy]*\s*\.\s*test\s*\((.*)\)$/.exec(premier);
      if (mm) { motif = mm[1]; cible = mm[2]; }
    }
    if (motif === null || motif === '') continue;
    if (motifAncre(motif)) continue;
    if (!RE_TEXTE_LIBRE.test(cible || '')) continue;
    if (pluslongueSuiteLitterale(motif) >= SEUIL_LITTERAL) continue;
    findings.push({
      code: 'motif_trop_permissif',
      ligne: ligneDe(src, a.debut),
      message: `motif /${motif}/ appliqué à « ${(cible || '').trim()} » : sans ancrage et sans suite littérale d'au moins ${SEUIL_LITTERAL} caractères, il peut matcher n'importe où dans la sortie (c'est le défaut « /2/ contre issue-28 »). Ancrer le motif ou citer la phrase attendue.`,
    });
  }
  return findings;
}

// ── Règle 2 : capture de flux partielle ─────────────────────────────────
// Un test qui affirme « la commande a échoué » et ne lit que `stdout` porte sur
// une chaîne vide : les refus partent sur `stderr`. `execFileSync` a la même
// faiblesse par construction — il ne rend que stdout, et jette sur code ≠ 0,
// donc la valeur de retour n'a jamais vu le message d'erreur.
// CALIBRAGE. La première rédaction ne visait que `spawnSync`, et sa branche
// `execFileSync` exigeait de trouver l'appel DANS l'assertion — elle n'a jamais
// rien vu, parce que dans ce dépôt le lancement vit toujours dans une aide
// (`function lancer(dir) { ... }`) et l'assertion la consomme trois lignes plus
// bas. La question utile ne porte donc pas sur une ligne mais sur le fichier :
// « ce fichier affirme-t-il un échec alors que rien chez lui ne lit stderr ? ».
//
// CALIBRAGE 2. Restée heuristique, la règle accusait `test_guardian_regles_metier`,
// qui ne lit que `stdout` — et qui a raison, parce que la garde qu'il éprouve
// imprime ses findings sur `stdout`. Une garde qui accuse un test correct sera
// désactivée, et alors elle ne verra plus le vrai défaut. On remonte donc à la
// PREUVE : quel programme ce test lance-t-il, et sur quel flux ce programme
// écrit-il ses refus ? Si le programme lancé n'est pas résolvable, on se tait.
const RE_LANCEMENT = /\b(spawnSync|execFileSync|execSync|exec|spawn)\s*\(/;

// `const GARDE = path.join(__dirname, 'outils', 'garde-env-001.js')` — la forme
// que prennent, dans ce dépôt, les chemins vers l'outil sous épreuve.
function constantesChemin(src, code, racine) {
  const chemins = new Map();
  const RE = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*path\s*\.\s*(?:join|resolve)\s*\(/g;
  let m;
  while ((m = RE.exec(code)) !== null) {
    const ouvrante = m.index + m[0].length - 1;
    const fermante = finAppel(code, ouvrante);
    if (fermante < 0) continue;
    const morceaux = [];
    let resoluble = true;
    for (const [a, b] of decouperArguments(code, ouvrante, fermante)) {
      const brut = src.slice(a, b).trim();
      if (brut === '__dirname') { morceaux.push(racine); continue; }
      const litt = /^['"`](.*)['"`]$/.exec(brut);
      if (litt) { morceaux.push(litt[1]); continue; }
      resoluble = false; break;
    }
    if (resoluble && morceaux.length) chemins.set(m[1], path.resolve(...morceaux));
    RE.lastIndex = fermante;
  }
  return chemins;
}

// Le premier élément du tableau d'arguments d'un `spawnSync(node, [X, ...])`.
function scriptLance(src, code, racine) {
  const chemins = constantesChemin(src, code, racine);
  const RE = /\b(?:spawnSync|execFileSync|execSync|spawn|exec)\s*\(/g;
  let m;
  while ((m = RE.exec(code)) !== null) {
    const ouvrante = m.index + m[0].length - 1;
    const fermante = finAppel(code, ouvrante);
    if (fermante < 0) continue;
    RE.lastIndex = fermante;
    const args = decouperArguments(code, ouvrante, fermante);
    if (args.length < 2) continue;
    const exe = src.slice(args[0][0], args[0][1]).trim();
    if (!/process\s*\.\s*execPath|['"`]node['"`]/.test(exe)) continue; // `git`, `bash`… : hors sujet
    const tableau = src.slice(args[1][0], args[1][1]).trim();
    const premier = /^\[\s*([^,\]]+)/.exec(tableau);
    if (!premier) continue;
    const jeton = premier[1].trim();
    if (chemins.has(jeton)) return chemins.get(jeton);
    const litt = /^['"`](.*)['"`]$/.exec(jeton);
    if (litt) return path.resolve(racine, litt[1]);
  }
  return null;
}

function reglesCapturePartielle(src, code, appels, racine) {
  const findings = [];
  if (!RE_LANCEMENT.test(code)) return findings;
  const litStdout = /\.\s*stdout\b/.test(code) || /execFileSync\s*\(/.test(code);
  // `stdio: ['pipe','pipe','pipe']`, `2>&1`, ou une lecture explicite : autant
  // de preuves que l'auteur a pensé au second flux.
  const litStderr = /\bstderr\b/.test(code) || /2>&1/.test(src) || /\bstdio\s*:/.test(code);
  if (!litStdout || litStderr) return findings;
  // Sans affirmation d'échec, ne lire que stdout est parfaitement légitime :
  // c'est le cas d'un test qui contrôle la sortie nominale d'une commande.
  let offEchec = -1;
  for (const a of appels) {
    const t = normaliser(a.texte);
    const affirme = /\.(status|code)\s*[,)]/.test(t) && /,[1-9]/.test(t)
      || /(status|code)(!==|!=|>)0/.test(t)
      || (a.methode === 'notStrictEqual' && /(status|code)/.test(t) && /,0\)/.test(t));
    if (affirme) { offEchec = a.debut; break; }
  }
  if (offEchec < 0) return findings;
  // La preuve : le programme lancé écrit-il vraiment sur stderr ? Sans réponse
  // ferme (script non résolvable, ou muet sur stderr), la garde se tait.
  const script = scriptLance(src, code, racine);
  if (!script || !fs.existsSync(script)) return findings;
  let programme;
  try { programme = fs.readFileSync(script, 'utf8'); } catch (err) { return findings; }
  const codeProgramme = vueCode(programme);
  if (!/console\s*\.\s*error\s*\(|process\s*\.\s*stderr\s*\.\s*write\s*\(/.test(codeProgramme)) return findings;
  findings.push({
    code: 'capture_flux_partielle',
    ligne: ligneDe(src, offEchec),
    message: `ce fichier affirme qu'une commande ÉCHOUE et ne capture que \`stdout\`, alors que ${path.basename(script)} écrit ses refus sur \`stderr\` (\`console.error\`) : les assertions de contenu portent sur une chaîne vide et passent quoi que dise le programme. Lancer avec \`spawnSync\` et concaténer \`stdout\` + \`stderr\`.`,
  });
  return findings;
}

// ── Règle 3 : assertion tautologique ────────────────────────────────────
// `assert(true)` et consorts. Cas subtil et bien plus fréquent : les deux
// arguments comparés sont TEXTUELLEMENT identiques — soit `x === x`, soit
// `f(a) === f(a)`, où l'attendu est recalculé par l'appel même qu'on observe.
// Ce second cas est la règle « attendu calculé par le même appel ».
const CONSTANTES_VRAIES = new Set(['true', '1', '!0', '!!1']);
const COMPARAISONS = new Set(['strictEqual', 'equal', 'deepEqual', 'deepStrictEqual', 'notStrictEqual', 'notEqual']);

function reglesTautologie(src, code, appels) {
  const findings = [];
  for (const a of appels) {
    if (!a.args.length) continue;
    const premier = normaliser(code.slice(a.args[0][0], a.args[0][1]));
    if ((a.methode === 'ok' || a.methode === 'strictEqual') && CONSTANTES_VRAIES.has(premier) && a.methode === 'ok') {
      findings.push({
        code: 'assertion_tautologique',
        ligne: ligneDe(src, a.debut),
        message: `\`${a.texte.split('\n')[0].trim()}\` : la condition est une constante vraie, l'assertion ne peut pas échouer.`,
      });
      continue;
    }
    if (COMPARAISONS.has(a.methode) && a.args.length >= 2) {
      const gauche = normaliser(src.slice(a.args[0][0], a.args[0][1]));
      const droite = normaliser(src.slice(a.args[1][0], a.args[1][1]));
      if (gauche && gauche === droite) {
        const appelle = /\(/.test(gauche);
        findings.push({
          code: appelle ? 'attendu_calcule_par_le_meme_appel' : 'assertion_tautologique',
          ligne: ligneDe(src, a.debut),
          message: appelle
            ? `observé et attendu sont la même expression \`${gauche}\` : l'attendu est recalculé par l'appel qu'on prétend contrôler, l'assertion est vraie même si l'appel est faux.`
            : `\`${gauche}\` comparé à lui-même : l'assertion ne peut pas échouer.`,
        });
      }
    }
  }
  return findings;
}

// Attendu extrait d'une variable dont la valeur vient du même appel que
// l'observé : `const attendu = calc(x); ... assert.strictEqual(calc(x), attendu)`.
function regleAttenduRecalcule(src, code, appels) {
  const findings = [];
  const affectations = new Map();
  const RE_AFFECT = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
  let m;
  while ((m = RE_AFFECT.exec(code)) !== null) {
    const valeur = normaliser(src.slice(m.index + m[0].length - m[2].length, m.index + m[0].length));
    if (/\(/.test(valeur)) affectations.set(m[1], valeur);
  }
  for (const a of appels) {
    if (!COMPARAISONS.has(a.methode) || a.args.length < 2) continue;
    const observe = normaliser(src.slice(a.args[0][0], a.args[0][1]));
    const attendu = normaliser(src.slice(a.args[1][0], a.args[1][1]));
    const source = affectations.get(attendu);
    if (source && source === observe) {
      findings.push({
        code: 'attendu_calcule_par_le_meme_appel',
        ligne: ligneDe(src, a.debut),
        message: `\`${attendu}\` a été calculé par exactement \`${source}\`, l'expression même qui sert d'observé : la comparaison est vraie par construction.`,
      });
    }
  }
  return findings;
}

// ── Règle 4 : épreuve sans aucune assertion ─────────────────────────────
// Un `test_*.js` qui ne peut rien signaler est un script de démonstration.
// On accepte les épreuves qui échouent par `throw` ou par `process.exit(1)` :
// plusieurs harnais du dépôt s'en servent légitimement.
function regleSansAssertion(src, code, appels) {
  if (appels.length) return [];
  if (/\bthrow\b/.test(code)) return [];
  if (/process\s*\.\s*exit\s*\(\s*[1-9]/.test(code)) return [];
  if (/\bexpect\s*\(|\bshould\b|\bmust\b/.test(code)) return [];
  if (normaliser(code).length < 40) return [];
  return [{
    code: 'epreuve_sans_assertion',
    ligne: 1,
    message: 'aucune assertion, aucun `throw`, aucune sortie non nulle : ce fichier ne peut signaler aucune régression — il est vert par construction.',
  }];
}

// ── Règle 5 : assertion neutralisée par un try/catch ────────────────────
// Deux formes, toutes deux des tests qui ne peuvent pas rougir :
//  (a) l'assertion est DANS le `try` et le `catch` avale l'erreur — une
//      assertion ratée jette `AssertionError`, que le catch absorbe ;
//  (b) l'assertion est DANS le `catch` d'un « ça doit jeter », mais le `try`
//      ne se termine pas par `assert.fail()` / `throw` : si l'appel ne jette
//      pas, le catch n'est jamais exécuté et l'épreuve passe en silence.
// Tout effet de bord capable de porter un échec jusqu'au code de sortie. Ce
// n'est pas la même question que « relance-t-il ? » : voir le CALIBRAGE ci-dessous.
const SIGNAUX_ECHEC = [
  /\bthrow\b/,
  /assert\s*\.\s*fail/,
  /process\s*\.\s*exit\s*\(\s*[1-9]/,
  /\bexitCode\b/,
  /\+\+|\+=/,
  /\.\s*push\s*\(/,
  /=\s*(true|1)\b/,
];

function reglesCatch(src, code, appels) {
  const findings = [];
  const RE_TRY = /\btry\s*\{/g;
  let m;
  while ((m = RE_TRY.exec(code)) !== null) {
    const debutTry = code.indexOf('{', m.index);
    const finTry = finBloc(code, debutTry);
    if (finTry < 0) continue;
    const apres = code.slice(finTry + 1, finTry + 200);
    const mc = /^\s*catch\s*(\([^)]*\))?\s*\{/.exec(apres);
    if (!mc) continue;
    const debutCatch = code.indexOf('{', finTry + 1 + mc[0].length - 1);
    const finCatch = finBloc(code, debutCatch);
    if (finCatch < 0) continue;
    const corpsTry = code.slice(debutTry, finTry + 1);
    const corpsCatch = code.slice(debutCatch, finCatch + 1);
    const assertDansTry = appels.some(a => a.debut > debutTry && a.debut < finTry);
    const assertDansCatch = appels.filter(a => a.debut > debutCatch && a.debut < finCatch);
    // CALIBRAGE. Première version : « le catch relance-t-il ? ». Elle a
    // accusé deux épreuves carburant dont le catch fait
    // `console.error(...); process.exitCode = 1;` — un signal d'échec
    // parfaitement valide, simplement pas une relance. La question juste
    // n'est pas « relance-t-il ? » mais « quelque chose ici peut-il encore
    // faire rougir la suite ? ». On accepte donc tout effet de bord capable
    // de porter l'échec : code de sortie, compteur, collecte d'erreurs.
    const catchRelance = SIGNAUX_ECHEC.some(r => r.test(corpsCatch));

    if (assertDansTry && !catchRelance && !assertDansCatch.length) {
      findings.push({
        code: 'assertion_avalee_par_catch',
        ligne: ligneDe(src, m.index),
        message: 'une assertion vit dans ce `try` dont le `catch` ne relance rien : une assertion ratée jette `AssertionError`, que ce `catch` avale — l\'épreuve reste verte. Relancer, ou sortir l\'assertion du `try`.',
      });
      continue;
    }
    if (assertDansCatch.length && !assertDansTry) {
      const tryEchoue = /assert\s*\.\s*fail/.test(corpsTry) || /\bthrow\b/.test(corpsTry)
        || /\b(echoue|aJete|doitJeter|jete)\s*=\s*(true|1)/i.test(corpsTry);
      // L'autre écriture correcte, tout aussi répandue : un témoin levé DANS
      // le catch et contrôlé APRÈS le bloc (`let aJete = false; … catch { aJete
      // = true } … assert.ok(aJete)`). Ne pas la reconnaître ferait accuser
      // une épreuve juste, et une garde qui accuse à tort se fait débrancher.
      const temoins = [...corpsCatch.matchAll(/([A-Za-z_$][\w$]*)\s*(?:=\s*(?:true|1)\b|\+\+)/g)].map(x => x[1]);
      const temoinObserve = temoins.some(nom => {
        const re = new RegExp(`\\b${nom}\\b`);
        return appels.some(a => a.debut > finCatch && re.test(a.texte));
      });
      if (!tryEchoue && !temoinObserve) {
        findings.push({
          code: 'assertion_avalee_par_catch',
          ligne: ligneDe(src, m.index),
          message: 'les assertions sont dans le `catch`, mais rien dans le `try` ne signale l\'absence d\'exception : si l\'appel cesse de jeter, le `catch` n\'est jamais atteint et l\'épreuve passe sans rien contrôler. Terminer le `try` par `assert.fail(...)`.',
        });
      }
    }
  }
  return findings;
}

// ── Analyse d'un fichier ────────────────────────────────────────────────
function analyser(source, nomFichier, racine = RACINE) {
  const code = vueCode(source);
  const appels = appelsAssert(source, code);
  const findings = [
    ...reglesMotifPermissif(source, code, appels),
    ...reglesCapturePartielle(source, code, appels, racine),
    ...reglesTautologie(source, code, appels),
    ...regleAttenduRecalcule(source, code, appels),
    ...regleSansAssertion(source, code, appels),
    ...reglesCatch(source, code, appels),
  ];
  // Dédoublonnage : deux règles peuvent voir le même défaut (l'attendu
  // recalculé est aussi une comparaison d'expressions identiques). Rapporter
  // deux fois la même ligne fait paraître la garde plus bruyante qu'elle
  // n'est, et fait douter des findings voisins.
  const vues = new Set();
  return findings.filter(f => {
    const cle = `${f.code}:${f.ligne}`;
    if (vues.has(cle)) return false;
    vues.add(cle);
    return true;
  }).map(f => ({ guardian: 'QA & Regression', fichier: nomFichier, ...f }));
}

// ── Exécution sur un ensemble de fichiers ───────────────────────────────
// Par défaut : toutes les épreuves versionnées à la racine. Le routeur, lui,
// passera la liste des fichiers réellement changés par le lot.
function fichiersEpreuves(racine) {
  return fs.readdirSync(racine)
    .filter(f => /^test_.*\.js$/.test(f))
    .sort()
    .map(f => path.join(racine, f));
}

function executer({ fichiers, racine = RACINE } = {}) {
  const cibles = (fichiers && fichiers.length ? fichiers : fichiersEpreuves(racine))
    .map(f => (path.isAbsolute(f) ? f : path.join(racine, f)))
    .filter(f => /^test_.*\.js$/.test(path.basename(f)) && fs.existsSync(f));
  const findings = [];
  for (const chemin of cibles) {
    let source;
    try { source = fs.readFileSync(chemin, 'utf8'); }
    catch (err) { continue; } // illisible n'est pas « fautif » : la garde se tait
    findings.push(...analyser(source, path.relative(racine, chemin), racine));
  }
  return { fichiers: cibles.map(f => path.relative(racine, f)), findings };
}

module.exports = { analyser, executer, vueCode, pluslongueSuiteLitterale, fichiersEpreuves };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const { fichiers, findings } = executer({ fichiers: argv });
  if (!findings.length) {
    console.log(`Guardian QA: OK — ${fichiers.length} épreuve(s) analysée(s), 0 finding.`);
    process.exit(0);
  }
  console.log(`Guardian QA: ${findings.length} finding(s) sur ${fichiers.length} épreuve(s).`);
  for (const f of findings) {
    console.log(`  [${f.code}] ${f.fichier}:${f.ligne} — ${f.message}`);
  }
  process.exit(1);
}
