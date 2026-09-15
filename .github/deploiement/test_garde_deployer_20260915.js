// Test — un événement `pull_request` ne peut pas atteindre le job `deployer`
// (15/09/2026).
//
// POURQUOI CE TEST EXISTE. Le workflow de Production se déclenche désormais
// aussi sur `pull_request`, pour que l'artefact Linux soit mesuré AVANT la
// fusion plutôt qu'après. C'est un déclencheur qui, mal conditionné, publie :
// il suffirait qu'une clause de `deployer` tombe pour qu'une simple PR envoie
// son arbre sur le site de Production. La garantie « `construire` s'exécute,
// `deployer` est ignoré » ne doit donc pas reposer sur la lecture d'un humain
// un jour donné, mais sur une épreuve qui relit le texte du workflow à chaque
// run et refuse s'il a changé de sens.
//
// CE QUI EST MESURÉ. Le fichier YAML réel, jamais une copie : la condition du
// job `deployer` est extraite de
// `.github/workflows/deploiement-production.yml`, puis ÉVALUÉE par un petit
// interpréteur du sous-ensemble d'expressions GitHub qu'elle utilise
// (`&&`, `||`, `!`, `==`, `!=`, parenthèses, littéraux, chemins de contexte).
// Une épreuve qui se contenterait de chercher la sous-chaîne
// `refs/heads/production` serait verte devant `if: false || (…)` comme devant
// la vraie condition ; celle-ci calcule le verdict.
//
// LES DEUX INVARIANTS DE PLATEFORME sur lesquels la preuve s'appuie, et qui
// sont les seules choses ici qui ne se déduisent pas du dépôt :
//   (I1) sur un événement `pull_request`, `github.ref` vaut
//        `refs/pull/<n>/merge` — jamais `refs/heads/<branche>` ;
//   (I2) `inputs.*` n'est renseigné que par `workflow_dispatch` (et
//        `workflow_call`) ; sur tout autre événement, il vaut `null`.
// Chacun est énoncé comme un cas à part, et la preuve est faite TROIS fois :
// sous les deux invariants, puis sous chacun pris seul. La condition est donc
// fermée deux fois indépendamment — retirer une clause ne suffit pas à ouvrir
// la porte, ce que la section « mutation » vérifie explicitement.
//
// ─── CAMPAGNE DE MUTATION DU 15/09/2026 ────────────────────────────────────
// Mutations appliquées au texte extrait (pas au fichier), verdict recalculé :
//   clause de branche retirée            → devant une PR, la porte reste
//                                          fermée : (I2) tient. Mutation
//                                          SURVIVANTE, et c'est la redondance.
//   clause d'origine retirée             → idem, (I1) tient. SURVIVANTE.
//   les DEUX retirées                    → la porte S'OUVRE, et un cas l'exige
//   `==` changé en `!=` sur la branche   → devant une PR, survit encore (I2) ;
//                                          jugée donc là où cette clause décide
//                                          seule — un push hors `production` —
//                                          où elle ouvre bien la porte
//   condition remplacée par `true`       → la porte s'ouvre, mordu
// Les trois survivantes ne sont pas des trous : ce sont deux gardes qui se
// couvrent l'une l'autre, et le cas « les deux retirées » est ce qui empêche
// cette survie d'être une épreuve muette. Aucune mutation ne survit sans
// qu'un cas nomme ce qui la rattrape.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const WORKFLOW = path.join(__dirname, '..', 'workflows', 'deploiement-production.yml');
assert.ok(fs.existsSync(WORKFLOW), '.github/workflows/deploiement-production.yml introuvable');
const LIGNES = fs.readFileSync(WORKFLOW, 'utf8').split('\n');

let total = 0;
const echecs = [];
function cas(intitule, fn) {
  total++;
  try { fn(); process.stdout.write('.'); }
  catch (er) { echecs.push(`${intitule}\n    ${er.message.split('\n')[0]}`); process.stdout.write('x'); }
}

// ── Lecture du YAML ────────────────────────────────────────────────────────
//
// Pas d'analyseur YAML : aucun n'est disponible sans dépendance, et en
// introduire une pour lire un fichier que l'on contrôle serait payer cher une
// généralité dont on n'a pas besoin. Ce qui est lu ici est un bloc à
// indentation fixe, écrit par nous, et dont toute réécriture qui casserait
// cette lecture ferait échouer l'épreuve — jamais passer en silence.

function indentation(ligne) {
  const m = /^( *)/.exec(ligne);
  return m[1].length;
}

function estVide(ligne) {
  return ligne.trim() === '' || ligne.trim().startsWith('#');
}

// Renvoie les lignes du bloc qui suit `entete` (une ligne dont le texte
// exact, indentation comprise, est `entete`) : toutes les lignes plus
// indentées, commentaires et lignes vides compris, jusqu'au premier retour à
// une indentation inférieure ou égale.
function bloc(entete) {
  const debut = LIGNES.findIndex(l => l === entete);
  assert.notStrictEqual(debut, -1, `ligne « ${entete} » absente du workflow`);
  const niveau = indentation(entete);
  const sortie = [];
  for (let i = debut + 1; i < LIGNES.length; i++) {
    const l = LIGNES[i];
    if (estVide(l)) { sortie.push(l); continue; }
    if (indentation(l) <= niveau) break;
    sortie.push(l);
  }
  return sortie;
}

const BLOC_ON = bloc('on:');
const BLOC_DEPLOYER = bloc('  deployer:');
const BLOC_CONSTRUIRE = bloc('  construire:');

// Le scalaire plié `if: >-` : les lignes suivantes, plus indentées, jointes
// par une espace. C'est exactement ce que GitHub reconstitue avant d'évaluer.
function conditionDuJob(blocJob, nomJob) {
  const i = blocJob.findIndex(l => /^ {4}if: *>-? *$/.test(l));
  assert.notStrictEqual(i, -1, `le job ${nomJob} n'a plus de condition « if: >- » repliée`);
  const morceaux = [];
  for (let j = i + 1; j < blocJob.length; j++) {
    const l = blocJob[j];
    if (estVide(l)) break;
    if (indentation(l) <= 4) break;
    morceaux.push(l.trim());
  }
  assert.ok(morceaux.length > 0, `la condition du job ${nomJob} est vide`);
  return morceaux.join(' ');
}

const CONDITION = conditionDuJob(BLOC_DEPLOYER, 'deployer');

// ── Interpréteur du sous-ensemble d'expressions GitHub ─────────────────────

function lexer(source) {
  const jetons = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === "'") {
      let j = i + 1, valeur = '';
      while (j < source.length) {
        if (source[j] === "'" && source[j + 1] === "'") { valeur += "'"; j += 2; continue; }
        if (source[j] === "'") break;
        valeur += source[j++];
      }
      assert.ok(j < source.length, `littéral non fermé dans : ${source}`);
      jetons.push({ type: 'chaine', valeur });
      i = j + 1;
      continue;
    }
    const deux = source.slice(i, i + 2);
    if (deux === '&&' || deux === '||' || deux === '==' || deux === '!=') {
      jetons.push({ type: 'op', valeur: deux });
      i += 2;
      continue;
    }
    if (c === '(' || c === ')') { jetons.push({ type: c }); i++; continue; }
    if (c === '!') { jetons.push({ type: 'op', valeur: '!' }); i++; continue; }
    const m = /^[A-Za-z_][A-Za-z0-9_.\-]*/.exec(source.slice(i));
    assert.ok(m, `caractère inattendu « ${c} » dans : ${source}`);
    jetons.push({ type: 'chemin', valeur: m[0] });
    i += m[0].length;
  }
  return jetons;
}

function analyser(jetons) {
  let p = 0;
  const voir = () => jetons[p];
  const manger = () => jetons[p++];

  function primaire() {
    const t = manger();
    assert.ok(t, 'expression tronquée');
    if (t.type === '(') {
      const e = ou();
      const f = manger();
      assert.ok(f && f.type === ')', 'parenthèse non fermée');
      return e;
    }
    if (t.type === 'chaine') return { sorte: 'litteral', valeur: t.valeur };
    if (t.type === 'op' && t.valeur === '!') return { sorte: 'non', droite: primaire() };
    assert.strictEqual(t.type, 'chemin', `jeton inattendu : ${JSON.stringify(t)}`);
    if (t.valeur === 'true') return { sorte: 'litteral', valeur: true };
    if (t.valeur === 'false') return { sorte: 'litteral', valeur: false };
    if (t.valeur === 'null') return { sorte: 'litteral', valeur: null };
    return { sorte: 'chemin', valeur: t.valeur };
  }

  function egalite() {
    let g = primaire();
    while (voir() && voir().type === 'op' && (voir().valeur === '==' || voir().valeur === '!=')) {
      const op = manger().valeur;
      g = { sorte: op, gauche: g, droite: primaire() };
    }
    return g;
  }

  function et() {
    let g = egalite();
    while (voir() && voir().type === 'op' && voir().valeur === '&&') {
      manger();
      g = { sorte: '&&', gauche: g, droite: egalite() };
    }
    return g;
  }

  function ou() {
    let g = et();
    while (voir() && voir().type === 'op' && voir().valeur === '||') {
      manger();
      g = { sorte: '||', gauche: g, droite: et() };
    }
    return g;
  }

  const e = ou();
  assert.strictEqual(p, jetons.length, `jetons non consommés dans l'expression`);
  return e;
}

// GitHub considère faux : `false`, `0`, la chaîne vide et `null`.
function verite(v) {
  return !(v === false || v === 0 || v === '' || v === null || v === undefined);
}

// Égalité lâche de GitHub, réduite à ce que la condition utilise : `null` est
// converti en chaîne vide face à une chaîne, les chaînes se comparent
// littéralement (la comparaison GitHub est insensible à la casse ; la
// distinction ne change aucun verdict ici et n'est pas simulée).
function egal(a, b) {
  const n = v => (v === null || v === undefined ? '' : v);
  return n(a) === n(b);
}

function resoudre(chemin, contexte) {
  let v = contexte;
  for (const segment of chemin.split('.')) {
    if (v === null || v === undefined || typeof v !== 'object') return null;
    v = segment in v ? v[segment] : null;
  }
  return v === undefined ? null : v;
}

function evaluer(noeud, contexte) {
  switch (noeud.sorte) {
    case 'litteral': return noeud.valeur;
    case 'chemin': return resoudre(noeud.valeur, contexte);
    case 'non': return !verite(evaluer(noeud.droite, contexte));
    case '==': return egal(evaluer(noeud.gauche, contexte), evaluer(noeud.droite, contexte));
    case '!=': return !egal(evaluer(noeud.gauche, contexte), evaluer(noeud.droite, contexte));
    case '&&': return verite(evaluer(noeud.gauche, contexte)) && verite(evaluer(noeud.droite, contexte));
    case '||': return verite(evaluer(noeud.gauche, contexte)) || verite(evaluer(noeud.droite, contexte));
    default: throw new Error(`nœud inconnu : ${noeud.sorte}`);
  }
}

function deploie(expression, contexte) {
  return verite(evaluer(analyser(lexer(expression)), contexte));
}

// Un contexte GitHub réduit à ce que la condition lit. `inputs` vaut `null`
// partout sauf sur `workflow_dispatch` : c'est l'invariant (I2), et il est
// écrit ici une seule fois pour ne pas être oublié dans un cas.
function contexte({ event_name, ref, sha, sha_construit, inputs = null }) {
  return {
    github: { event_name, ref, sha },
    inputs,
    needs: { construire: { outputs: { sha_construit } } },
  };
}

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

// ── 1. Le déclencheur `pull_request` existe, et vise `production` ──────────

cas('Déclencheur · `pull_request` est déclaré dans le bloc `on:`', () => {
  assert.ok(BLOC_ON.some(l => /^ {2}pull_request: *$/.test(l)),
    'le workflow ne se déclenche plus sur `pull_request` : l\'artefact ne sera plus mesuré avant fusion');
});

cas('Déclencheur · `pull_request` est restreint à la base `production`', () => {
  const i = BLOC_ON.findIndex(l => /^ {2}pull_request: *$/.test(l));
  const sousBloc = [];
  for (let j = i + 1; j < BLOC_ON.length; j++) {
    if (estVide(BLOC_ON[j])) continue;
    if (indentation(BLOC_ON[j]) <= 2) break;
    sousBloc.push(BLOC_ON[j].trim());
  }
  assert.ok(sousBloc.some(l => /^branches: *\[ *production *\]$/.test(l)),
    'le déclencheur pull_request n\'est plus limité à la base production : ' + JSON.stringify(sousBloc));
});

cas('Déclencheur · `push` sur `production` est intact', () => {
  const i = BLOC_ON.findIndex(l => /^ {2}push: *$/.test(l));
  assert.notStrictEqual(i, -1, 'le déclencheur `push` a disparu');
  assert.ok(/^ {4}branches: *\[ *production *\]$/.test(BLOC_ON[i + 1]),
    'le déclencheur `push` ne vise plus la seule branche production');
});

cas('Construire · aucune condition de job ne peut l\'empêcher de tourner sur la PR', () => {
  const conditions = BLOC_CONSTRUIRE.filter(l => /^ {4}if:/.test(l));
  assert.deepStrictEqual(conditions, [],
    `le job construire a reçu une condition de job : ${JSON.stringify(conditions)} — il pourrait être ignoré sur la PR`);
});

// ── 2. La condition de `deployer`, telle qu'elle est écrite ────────────────

cas('Condition · la clause de branche est toujours présente dans le texte', () => {
  assert.ok(CONDITION.includes("github.ref == 'refs/heads/production'"),
    `la clause de branche a disparu de la condition : ${CONDITION}`);
});

cas('Condition · elle s\'analyse entièrement (rien d\'inattendu n\'y a été ajouté)', () => {
  const arbre = analyser(lexer(CONDITION));
  assert.ok(arbre && arbre.sorte, 'la condition ne s\'analyse pas');
});

// ── 3. Non-vacuité : l'interpréteur sait dire « oui » ──────────────────────
//
// Sans ces deux cas, tout ce qui suit serait satisfait par un interpréteur qui
// renverrait faux quoi qu'il arrive — une épreuve verte qui ne prouve rien.

cas('Non-vacuité · un push sur production avec le bon SHA déploie', () => {
  assert.strictEqual(
    deploie(CONDITION, contexte({
      event_name: 'push', ref: 'refs/heads/production', sha: SHA_A, sha_construit: SHA_A,
    })),
    true,
    'la condition refuse le cas nominal : ce n\'est plus une garde, c\'est un mur');
});

cas('Non-vacuité · un workflow_dispatch « oui » sur production déploie', () => {
  assert.strictEqual(
    deploie(CONDITION, contexte({
      event_name: 'workflow_dispatch', ref: 'refs/heads/production', sha: SHA_A, sha_construit: SHA_A,
      inputs: { deployer: 'oui', ref_applicatif: '' },
    })),
    true,
    'le chemin manuel approuvé ne passe plus');
});

// ── 4. La preuve : aucun `pull_request` ne peut déployer ───────────────────

const REFS_PR = ['refs/pull/1/merge', 'refs/pull/44/merge', 'refs/pull/9999/merge', 'refs/pull/44/head'];
const SHAS = [SHA_A, SHA_B];

cas('Preuve · sous (I1) et (I2), aucun `pull_request` ne satisfait la condition', () => {
  const ouverts = [];
  for (const ref of REFS_PR) {
    for (const sha of SHAS) {
      for (const sha_construit of SHAS) {
        const ctx = contexte({ event_name: 'pull_request', ref, sha, sha_construit });
        if (deploie(CONDITION, ctx)) ouverts.push({ ref, sha, sha_construit });
      }
    }
  }
  assert.deepStrictEqual(ouverts, [],
    `un événement pull_request atteint deployer : ${JSON.stringify(ouverts)}`);
});

cas('Preuve · (I1) seul suffit : même avec `inputs.deployer` forcé à « oui »', () => {
  const ouverts = [];
  for (const ref of REFS_PR) {
    for (const deployer of ['oui', 'non', '', null]) {
      for (const sha of SHAS) {
        for (const sha_construit of SHAS) {
          const ctx = contexte({
            event_name: 'pull_request', ref, sha, sha_construit,
            inputs: deployer === null ? null : { deployer },
          });
          if (deploie(CONDITION, ctx)) ouverts.push({ ref, deployer, sha, sha_construit });
        }
      }
    }
  }
  assert.deepStrictEqual(ouverts, [],
    `la seule clause de branche ne tient pas : ${JSON.stringify(ouverts)}`);
});

cas('Preuve · (I2) seul suffit : même si la référence était une branche', () => {
  const ouverts = [];
  for (const ref of ['refs/heads/production', 'refs/heads/main', 'refs/pull/44/merge']) {
    for (const sha of SHAS) {
      for (const sha_construit of SHAS) {
        const ctx = contexte({ event_name: 'pull_request', ref, sha, sha_construit, inputs: null });
        if (deploie(CONDITION, ctx)) ouverts.push({ ref, sha, sha_construit });
      }
    }
  }
  assert.deepStrictEqual(ouverts, [],
    `la seule clause d'origine ne tient pas : ${JSON.stringify(ouverts)}`);
});

cas('Preuve · les autres événements de PR (`pull_request_target`) non plus', () => {
  const ouverts = [];
  for (const event_name of ['pull_request_target', 'pull_request_review', 'issue_comment', 'schedule']) {
    for (const ref of [...REFS_PR, 'refs/heads/production']) {
      const ctx = contexte({ event_name, ref, sha: SHA_A, sha_construit: SHA_A });
      if (deploie(CONDITION, ctx)) ouverts.push({ event_name, ref });
    }
  }
  assert.deepStrictEqual(ouverts, [],
    `un événement non prévu atteint deployer : ${JSON.stringify(ouverts)}`);
});

// ── 5. Les autres portes restent fermées ──────────────────────────────────

cas('Fermé · un push sur une autre branche ne déploie pas', () => {
  assert.strictEqual(
    deploie(CONDITION, contexte({
      event_name: 'push', ref: 'refs/heads/infra-deploiement-pages-production', sha: SHA_A, sha_construit: SHA_A,
    })),
    false,
    'une branche autre que production peut publier');
});

cas('Fermé · une répétition `ref_applicatif` (SHA construit ≠ SHA déclencheur) ne déploie pas', () => {
  assert.strictEqual(
    deploie(CONDITION, contexte({
      event_name: 'workflow_dispatch', ref: 'refs/heads/production', sha: SHA_A, sha_construit: SHA_B,
      inputs: { deployer: 'oui', ref_applicatif: 'une-autre-branche' },
    })),
    false,
    'une répétition sur une autre référence peut atteindre le déploiement');
});

cas('Fermé · un workflow_dispatch « non » ne déploie pas', () => {
  assert.strictEqual(
    deploie(CONDITION, contexte({
      event_name: 'workflow_dispatch', ref: 'refs/heads/production', sha: SHA_A, sha_construit: SHA_A,
      inputs: { deployer: 'non', ref_applicatif: '' },
    })),
    false,
    'le choix par défaut « non » déploie quand même');
});

// ── 6. Mutation : ce qui tient la porte, et ce qui ne la tient pas seul ────

const PR_TYPE = contexte({
  event_name: 'pull_request', ref: 'refs/pull/44/merge', sha: SHA_A, sha_construit: SHA_A,
});

const SANS_BRANCHE = "(github.event_name == 'push' || inputs.deployer == 'oui') && " +
  'needs.construire.outputs.sha_construit == github.sha';
const SANS_ORIGINE = "github.ref == 'refs/heads/production' && " +
  'needs.construire.outputs.sha_construit == github.sha';
const SANS_LES_DEUX = 'needs.construire.outputs.sha_construit == github.sha';

cas('Mutation · retirer la clause de branche ne suffit pas à ouvrir (I2 tient)', () => {
  assert.strictEqual(deploie(SANS_BRANCHE, PR_TYPE), false,
    'la mutation « sans branche » ouvre : la redondance annoncée n\'existe pas');
});

cas('Mutation · retirer la clause d\'origine ne suffit pas à ouvrir (I1 tient)', () => {
  assert.strictEqual(deploie(SANS_ORIGINE, PR_TYPE), false,
    'la mutation « sans origine » ouvre : la redondance annoncée n\'existe pas');
});

cas('Mutation · retirer LES DEUX ouvre la porte — c\'est ce qu\'elles tiennent', () => {
  assert.strictEqual(deploie(SANS_LES_DEUX, PR_TYPE), true,
    'retirer les deux clauses ne change rien : l\'épreuve ne mord sur rien et ne prouve rien');
});

// Inverser la clause de branche n'ouvre PAS sur une PR — (I2) tient encore,
// et c'est la même redondance qu'au-dessus. La mutation doit donc être jugée
// là où cette clause est seule à décider : un push sur une autre branche.
// Sinon on écrirait un cas qui ne mord sur rien en croyant l'avoir fait.
cas('Mutation · inverser la clause de branche ouvre la porte à un push hors production', () => {
  const mutee = CONDITION.replace("github.ref == 'refs/heads/production'",
    "github.ref != 'refs/heads/production'");
  assert.notStrictEqual(mutee, CONDITION, 'la mutation n\'a rien remplacé : elle ne vise plus le texte réel');
  const pushAilleurs = contexte({
    event_name: 'push', ref: 'refs/heads/main', sha: SHA_A, sha_construit: SHA_A,
  });
  assert.strictEqual(deploie(CONDITION, pushAilleurs), false, 'la condition réelle laisse déjà passer main');
  assert.strictEqual(deploie(mutee, pushAilleurs), true,
    'inverser la clause de branche ne change pas le verdict : l\'interpréteur ne lit pas cette clause');
  assert.strictEqual(deploie(mutee, PR_TYPE), false,
    'même inversée, la clause de branche laisse (I2) fermer la porte devant une PR — cette redondance est attendue');
});

cas('Mutation · une condition toujours vraie ouvre la porte', () => {
  assert.strictEqual(deploie('true', PR_TYPE), true,
    'l\'interpréteur ne sait pas dire oui : tous les cas ci-dessus sont vides');
});

// ── Verdict ────────────────────────────────────────────────────────────────
console.log(`\n\n${total - echecs.length}/${total} contrôles passent.`);
if (echecs.length) {
  console.log(`\n${echecs.length} en échec :`);
  for (const e of echecs) console.log(`  ${e}`);
  process.exit(1);
}
