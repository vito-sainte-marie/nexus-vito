// NEXUS — analyseur d'équilibrage des blocs PL/pgSQL (17/09/2026).
//
// POURQUOI CE MODULE EXISTE
//
// Le fichier `supabase/phase-c/20260916230000_fdj_rls_definitives_phase_c.sql`
// ne vit pas sous `supabase/migrations/`. Aucun outil du dépôt ne le regardait
// donc, et la CI n'a pas de base de données : elle ne référence aucun secret et
// aucun test n'ouvre de connexion réseau — une propriété que `tests.yml` énonce
// et qu'il faut préserver. Un script inexécutable pouvait ainsi être relu,
// approuvé et fusionné sans que rien ne le dise.
//
// Compter des mots-clés ne suffit pas. `drop policy if exists` contient un `if`
// qui n'ouvre aucun bloc ; `case when … then … end` est une EXPRESSION dont le
// `end` ne ferme pas un `begin` ; `for … in … loop` ouvre un bloc sans être en
// début d'instruction. Une garde qui additionne les occurrences se trompe dans
// les deux sens : elle rougit sur du SQL valide et reste verte sur du SQL cassé.
//
// Ce module tokenise donc réellement : il retire les commentaires `--` et les
// blocs `/* */` (imbriqués), il retire les littéraux `'…'`, il isole les corps
// `$tag$ … $tag$` et les analyse avec une PILE typée. Un `end if` doit dépiler
// un `if`, un `end loop` un `loop` — pas n'importe quoi.
//
// UN ARBITRAGE EXPLICITE SUR `case`. L'instruction `case … end case` et
// l'expression `case … end` s'écrivent pareil et ne se distinguent par aucun
// contexte : `v := case when a then case when b then 1 else 2 end else 3 end;`
// (migration 20260901225945) place une EXPRESSION juste après `then`, là où la
// grammaire autorise aussi une INSTRUCTION. Un premier jet exigeait `end case`
// dans ce cas et rougissait sur du SQL parfaitement valide. Le `case` est donc
// empilé sans type et accepte les deux fermetures. On renonce ainsi à
// dénoncer un `end case` oublié — que PostgreSQL attrape de toute façon — pour
// ne jamais crier au loup : une garde qui se trompe est une garde qu'on
// désactive.
//
// Ce que ce module NE fait PAS : valider la sémantique. Il ne sait pas si une
// table existe ni si une politique a du sens. Il répond à une seule question —
// « ce fichier peut-il seulement être avalé par PostgreSQL ? » — et c'est
// exactement la question qui n'était posée nulle part.

'use strict';

const MOT = /[A-Za-z_][A-Za-z0-9_$]*/y;

// Les contextes après lesquels un mot-clé commence une INSTRUCTION. C'est ce
// qui distingue le `if` de `if v is null then` de celui de `drop policy if
// exists`, et le `case` instruction du `case` expression.
const DEBUT_INSTRUCTION = new Set([
  null, ';', 'begin', 'then', 'else', 'loop', 'declare', 'exception',
]);

/**
 * Découpe un texte SQL en retirant commentaires et littéraux, et en isolant
 * les corps dollar-quotés. Rend { code, corps: [{ texte, ligne }] }.
 * `code` conserve les positions de ligne (les zones retirées deviennent des
 * espaces et des sauts de ligne) pour que les numéros restent exacts.
 */
function decouper(sql) {
  const corps = [];
  let code = '';
  let i = 0;
  let ligne = 1;
  const blanchir = (texte) => texte.replace(/[^\n]/g, ' ');

  while (i < sql.length) {
    const c = sql[i];

    // Commentaire de fin de ligne.
    if (c === '-' && sql[i + 1] === '-') {
      const fin = sql.indexOf('\n', i);
      const bout = fin === -1 ? sql.slice(i) : sql.slice(i, fin);
      code += blanchir(bout);
      i += bout.length;
      continue;
    }

    // Commentaire encadré, imbricable — PostgreSQL les imbrique vraiment.
    if (c === '/' && sql[i + 1] === '*') {
      let profondeur = 1;
      let j = i + 2;
      while (j < sql.length && profondeur > 0) {
        if (sql[j] === '/' && sql[j + 1] === '*') { profondeur++; j += 2; continue; }
        if (sql[j] === '*' && sql[j + 1] === '/') { profondeur--; j += 2; continue; }
        j++;
      }
      if (profondeur > 0) throw new ErreurSql('commentaire /* non refermé', ligne);
      const bout = sql.slice(i, j);
      code += blanchir(bout);
      ligne += (bout.match(/\n/g) || []).length;
      i = j;
      continue;
    }

    // Littéral simple. '' à l'intérieur n'est pas une fin.
    if (c === "'") {
      let j = i + 1;
      for (;;) {
        if (j >= sql.length) throw new ErreurSql("littéral ' non refermé", ligne);
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") { j += 2; continue; }
          j++; break;
        }
        j++;
      }
      const bout = sql.slice(i, j);
      code += "''" + blanchir(bout).slice(2);
      ligne += (bout.match(/\n/g) || []).length;
      i = j;
      continue;
    }

    // Identifiant entre guillemets — jamais un mot-clé.
    if (c === '"') {
      const fin = sql.indexOf('"', i + 1);
      if (fin === -1) throw new ErreurSql('identifiant " non refermé', ligne);
      code += blanchir(sql.slice(i, fin + 1));
      i = fin + 1;
      continue;
    }

    // Corps dollar-quoté : $$ … $$ ou $tag$ … $tag$.
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m) {
        const marque = m[0];
        const debut = i + marque.length;
        const fin = sql.indexOf(marque, debut);
        if (fin === -1) throw new ErreurSql(`corps ${marque} non refermé`, ligne);
        const interieur = sql.slice(debut, fin);
        corps.push({ texte: interieur, ligne: ligne + (marque.match(/\n/g) || []).length });
        // Le corps disparaît du code de premier niveau, remplacé par un jeton
        // neutre : `create function … as <corps> ;` reste une instruction.
        const bout = sql.slice(i, fin + marque.length);
        code += blanchir(bout);
        ligne += (bout.match(/\n/g) || []).length;
        i = fin + marque.length;
        continue;
      }
    }

    if (c === '\n') ligne++;
    code += c;
    i++;
  }
  return { code, corps };
}

/**
 * Analyse le SQL de premier niveau (hors corps PL/pgSQL). Même pile, à une
 * exception près : `begin;` et `commit;` y sont du CONTRÔLE DE TRANSACTION et
 * n'ouvrent aucun bloc.
 */
function analyserNiveauSql(code) {
  return analyserJetons(tokeniser(code), 0, { beginEstTransaction: true });
}

class ErreurSql extends Error {
  constructor(message, ligne) {
    super(`ligne ${ligne} — ${message}`);
    this.ligne = ligne;
  }
}

/** Tokenise du code déjà débarrassé des commentaires et littéraux. */
function tokeniser(code) {
  const jetons = [];
  let ligne = 1;
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '\n') { ligne++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    MOT.lastIndex = i;
    const m = MOT.exec(code);
    if (m) {
      jetons.push({ v: m[0].toLowerCase(), mot: true, ligne });
      i += m[0].length;
      continue;
    }
    jetons.push({ v: c, mot: false, ligne });
    i++;
  }
  return jetons;
}

/**
 * Analyse un corps PL/pgSQL. Lève ErreurSql au premier déséquilibre.
 * Rend le nombre de blocs ouverts (pour information).
 */
function analyserCorps(texte, ligneBase) {
  const { code, corps } = decouper(texte);
  // Un corps peut lui-même contenir un corps dollar-quoté (fonction créée par
  // une fonction). On l'analyse aussi.
  corps.forEach(c => analyserCorps(c.texte, ligneBase + c.ligne - 1));

  return analyserJetons(tokeniser(code), ligneBase - 1, { beginEstTransaction: false });
}

/**
 * Le cœur : une pile typée sur les jetons.
 * `decalage` s'ajoute aux numéros de ligne pour les replacer dans le fichier.
 */
function analyserJetons(jetons, decalage, options) {
  const pile = [];
  let precedent = null;
  let blocs = 0;

  for (let k = 0; k < jetons.length; k++) {
    const j = jetons[k];
    const L = decalage + j.ligne;

    if (!j.mot) { precedent = j.v; continue; }

    switch (j.v) {
      case 'begin': {
        const suivant = jetons[k + 1];
        if (options.beginEstTransaction && suivant && !suivant.mot && suivant.v === ';') break;
        pile.push({ type: 'begin', ligne: L });
        blocs++;
        break;
      }

      case 'if':
        // `if` n'ouvre un bloc que s'il commence une instruction.
        if (DEBUT_INSTRUCTION.has(precedent)) { pile.push({ type: 'if', ligne: L }); blocs++; }
        break;

      case 'case':
        // Instruction ou expression : indiscernables (voir l'en-tête). Le bloc
        // accepte `end` comme `end case`.
        pile.push({ type: 'case', ligne: L });
        blocs++;
        break;

      case 'loop':
        // `loop`, `while … loop`, `for … loop` ouvrent tous. Le `loop` d'un
        // `end loop` est consommé par la branche `end` ci-dessous et ne
        // parvient jamais ici.
        pile.push({ type: 'loop', ligne: L });
        blocs++;
        break;

      case 'end': {
        const suivant = jetons[k + 1];
        let attendu;
        if (suivant && suivant.mot && (suivant.v === 'if' || suivant.v === 'loop' || suivant.v === 'case')) {
          attendu = suivant.v;
          k++; // consommer le mot de fermeture
        } else {
          attendu = null; // `end` nu : ferme un begin ou une expression case
        }
        const haut = pile.pop();
        if (!haut) throw new ErreurSql(`\`end${attendu ? ' ' + attendu : ''}\` sans bloc ouvert`, L);
        if (attendu === null) {
          if (haut.type !== 'begin' && haut.type !== 'case') {
            throw new ErreurSql(
              `\`end\` ferme un bloc \`${haut.type}\` ouvert ligne ${haut.ligne} — il manque \`end ${haut.type}\``, L);
          }
        } else if (haut.type !== attendu) {
          throw new ErreurSql(
            `\`end ${attendu}\` ferme un bloc \`${haut.type}\` ouvert ligne ${haut.ligne}`, L);
        }
        break;
      }

      default:
        break;
    }
    precedent = j.v;
  }

  if (pile.length) {
    const haut = pile[pile.length - 1];
    throw new ErreurSql(`bloc \`${haut.type}\` ouvert ligne ${haut.ligne} jamais refermé`, haut.ligne);
  }
  return blocs;
}

/**
 * Analyse un fichier SQL entier. Rend { corps, blocs } ou lève ErreurSql.
 */
function analyserFichier(sql) {
  const { code, corps } = decouper(sql);
  let blocs = 0;
  corps.forEach(c => { blocs += analyserCorps(c.texte, c.ligne); });
  // Le premier niveau s'analyse avec la même pile : une vue peut parfaitement
  // porter un `case … end` en expression, et un `end` y reste une fermeture
  // qui doit trouver son ouverture.
  blocs += analyserNiveauSql(code);
  return { nbCorps: corps.length, blocs };
}

/**
 * Le contrôle de transaction de premier niveau, repéré par LIGNE — c'est ce
 * qui rend l'exécution réversible possible : la recette de Test substitue ces
 * deux lignes-là et rien d'autre, et le diff le prouve.
 */
function ancrageTransaction(sql) {
  const lignes = sql.split('\n');
  const trouve = { begin: [], commit: [], rollback: [] };
  lignes.forEach((l, n) => {
    const m = /^(begin|commit|rollback);\s*$/.exec(l);
    if (m) trouve[m[1]].push(n + 1);
  });
  return trouve;
}

module.exports = { analyserFichier, analyserCorps, analyserNiveauSql, ancrageTransaction, decouper, tokeniser, ErreurSql };
