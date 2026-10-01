'use strict';
// Épreuve de la garde RPC-FRONT-DÉFINIE-SUR-LA-CIBLE
// (outils/garde-rpc-front-definie-sur-la-cible.js).
//
// CE QUE CETTE ÉPREUVE DOIT PROUVER. La garde naît d'une panne terrain
// mesurée. Le 28/09/2026, le commit 55974ae a porté sur le candidat #65 un
// écran de connexion appelant `public.nexus_identifiant_de_connexion`. La
// migration qui crée cette fonction est restée sur le rail. Le 01/10/2026 à
// 13 h 49 UTC, la fusion #65 a publié le front sur `production` — et GitHub
// Pages sert cet arbre BRUT : un déploiement n'emporte aucune migration.
// Résultat : fonction absente du catalogue Production, erreur PostgREST,
// « Connexion au serveur impossible ». Plus personne ne se connecte.
//
// Aucune garde ne regardait cet écart. Le contrôle qui manquait est un
// rapprochement : ce que le front APPELLE contre ce que la cible sait PROUVER.
//
// POURQUOI CHAQUE CONTRÔLE EST UN COUPLE. Une garde verte ne prouve rien : le
// 08/09/2026 quatre gardes étaient vertes et inutiles. Chaque cas est donc
// écrit deux fois — la forme qui doit passer, et la MUTATION MINIMALE de cette
// même forme, qui doit être refusée avec son code exact. Si la garde cessait
// de mordre, ce sont les secondes moitiés qui rougiraient.
//
// POURQUOI DES DÉPÔTS JETABLES, ET AUCUN SHA RÉEL. La garde lit des refs git.
// Encoder `adee9bb` ici rendrait l'épreuve dépendante de la profondeur de
// clone de la CI : un `fetch-depth` court la ferait échouer pour une raison
// qui n'est pas celle qu'elle mesure, et un `skipped` silencieux passerait
// pour un succès. Chaque cas construit donc son propre dépôt, avec les seuls
// fichiers qu'il décrit. La mesure sur les refs réelles est consignée dans le
// dossier de déploiement comme MESURE DATÉE, pas comme épreuve de CI.
//
// LES MUTATIONS SONT ISOLÉES. Deux mutations concurrentes dans le même bac ne
// mesurent rien : l'une restaure ce que l'autre a cassé, et le vert ressemble
// alors au vrai défaut (leçon du 23/09/2026).

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const garde = require('./outils/garde-rpc-front-definie-sur-la-cible.js');
const { controler, estEcranReel, sansCommentairesSql, lireArguments, SEVERITES, CODES } = garde;

let n = 0;
function ok(quoi) { n++; console.log('  ✅ ' + quoi); }

const DEFINITION = (nom) => `-- migration jetable\ncreate or replace function public.${nom}(p text)\nreturns text language sql as $$ select p $$;\n`;
const APPEL = (nom) => `<html><script>const r = await client.rpc("${nom}", { p: x });</script></html>\n`;

// Un dépôt jetable à deux états : la cible, puis le candidat qui en descend.
// Les deux arbres sont écrits en entier à chaque fois — pas de reliquat d'un
// cas précédent, et donc pas de preuve empruntée au voisin.
const bacs = [];
function bac(arbreCible, arbreCandidat) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-rpcgarde-'));
  bacs.push(d);
  const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'pipe' });
  g('init', '-q', '--initial-branch=cible');
  g('config', 'user.email', 'banc@nexus.local');
  g('config', 'user.name', 'Banc NEXUS');
  const ecrire = (arbre) => {
    for (const e of fs.readdirSync(d)) if (e !== '.git') fs.rmSync(path.join(d, e), { recursive: true, force: true });
    for (const [nom, contenu] of Object.entries(arbre)) {
      fs.mkdirSync(path.join(d, path.dirname(nom)), { recursive: true });
      fs.writeFileSync(path.join(d, nom), contenu);
    }
    g('add', '-A');
    g('commit', '-q', '--allow-empty', '-m', 'etat');
  };
  ecrire(arbreCible);
  ecrire(arbreCandidat);
  g('branch', 'candidat');
  g('checkout', '-q', 'cible');
  g('reset', '-q', '--hard', 'HEAD~1');
  return d;
}
function juger(arbreCible, arbreCandidat, options = {}) {
  return controler({ racine: bac(arbreCible, arbreCandidat), candidat: 'candidat', cible: 'cible', ...options });
}
function constat(r, code) { return r.constats.find((c) => c.code === code); }
function parSeverite(r, s) { return r.constats.filter((c) => c.severite === s); }

// ------------------------------------------------------------------
// C1 — le cas nominal, et la mutation qui retire la preuve.
// ------------------------------------------------------------------
{
  const mig = { 'supabase/migrations/20260101000000_f.sql': DEFINITION('ma_fonction') };
  const front = { 'NEXUS-Ecran-v1.html': APPEL('ma_fonction') };

  const vert = juger({ ...mig, ...front }, { ...mig, ...front });
  assert.strictEqual(vert.verdict, 'RPC_FRONT_CONFORME');
  assert.strictEqual(vert.constats.length, 0, 'un arbre cohérent ne doit produire aucun constat');
  ok('C1 — une RPC créée par une migration de la cible ne produit aucun constat');

  // MUTATION : la migration reste sur le candidat, la cible ne l'a pas. C'est
  // exactement la forme de #65.
  const rouge = juger(front, { ...mig, ...front });
  assert.strictEqual(rouge.verdict, 'RPC_FRONT_REFUS');
  const c = constat(rouge, CODES.MIGRATION_CANONIQUE_NON_APPLIQUEE);
  assert.ok(c, 'la migration non appliquée doit porter son code propre');
  assert.ok(c.detail.includes('20260101000000_f.sql'),
    'le refus doit NOMMER la migration à appliquer : un refus qui ne dit pas quoi faire renvoie à l\'enquête');
  ok('C1 muté — la migration restée sur le candidat est refusée, et le refus nomme le fichier à appliquer');
}

// ------------------------------------------------------------------
// C2 — #65 reproduit : l'appel est NOUVEAU et la cible ne peut pas le prouver.
// Le contre-témoin est le MÊME banc avec la migration déjà sur la cible : si
// le vert de C1 et le rouge d'ici venaient d'autre chose que de la présence de
// la migration, ce couple ne pourrait pas donner deux réponses opposées.
// ------------------------------------------------------------------
{
  const mig = { 'supabase/migrations/20260904175747_login_non_enumerable.sql': DEFINITION('nexus_identifiant_de_connexion') };
  const avant = { 'NEXUS-Login-v1.html': '<html><script>client.from("employees_public").select()</script></html>\n',
                  'supabase/migrations/20260101000000_socle.sql': DEFINITION('autre_chose'),
                  'NEXUS-Autre-v1.html': APPEL('autre_chose') };
  const apres = { ...avant, 'NEXUS-Login-v1.html': APPEL('nexus_identifiant_de_connexion'), ...mig };

  const r = juger(avant, apres);
  assert.strictEqual(r.verdict, 'RPC_FRONT_REFUS');
  const c = constat(r, CODES.MIGRATION_CANONIQUE_NON_APPLIQUEE);
  assert.ok(c && c.fonction === 'nexus_identifiant_de_connexion');
  assert.ok(c.detail.includes('NEXUS-Login-v1.html'), 'le refus doit nommer l\'écran qui tomberait');
  assert.strictEqual(parSeverite(r, SEVERITES.BLOCK).length, 1,
    'un seul bloquant : `autre_chose` est prouvable et ne doit pas être accusée');
  ok('C2 — le déploiement du 01/10 est refusé, et un seul appel est accusé');

  // CONTRE-TÉMOIN : la migration est déjà sur la cible. Même banc, verdict inverse.
  const contre = juger({ ...avant, ...mig }, apres);
  assert.strictEqual(contre.verdict, 'RPC_FRONT_CONFORME',
    'si la cible porte la migration, le même candidat doit passer — sinon le rouge de C2 est un rouge constant');
  ok('C2 contre-témoin — la migration appliquée à la cible rend le même candidat conforme');
}

// ------------------------------------------------------------------
// C3 — l'appel dans le vide : aucune migration, nulle part.
// ------------------------------------------------------------------
{
  const socle = { 'supabase/migrations/20260101000000_socle.sql': DEFINITION('socle'), 'NEXUS-A-v1.html': APPEL('socle') };
  const r = juger(socle, { ...socle, 'NEXUS-B-v1.html': APPEL('fantome') });
  const c = constat(r, CODES.RPC_INTROUVABLE_SUR_LA_CIBLE);
  assert.strictEqual(r.verdict, 'RPC_FRONT_REFUS');
  assert.strictEqual(c.severite, SEVERITES.BLOCK);
  assert.ok(/n'existe nulle part/.test(c.detail));
  ok('C3 — une RPC que ni la cible ni le candidat ne définissent est refusée');

  const r2 = juger(socle, { ...socle, 'NEXUS-B-v1.html': APPEL('socle') });
  assert.strictEqual(r2.verdict, 'RPC_FRONT_CONFORME');
  ok('C3 muté — le même écran neuf appelant une RPC prouvable passe');
}

// ------------------------------------------------------------------
// C4 — c'est l'ÉCRAN qui fait la gravité, pas l'appel. Un outil cassé n'empêche
// personne de travailler ; il ne doit pas pouvoir veto un déploiement, sinon la
// garde devient un veto sur son propre banc.
// ------------------------------------------------------------------
{
  const socle = { 'supabase/migrations/20260101000000_socle.sql': DEFINITION('socle'), 'NEXUS-A-v1.html': APPEL('socle') };
  for (const porteur of ['test_truc.js', 'recette_truc_20260907.js', 'outils/truc.js', 'run-tests.js', 'simulations/truc.js', 'docs/truc.js']) {
    const r = juger(socle, { ...socle, [porteur]: APPEL('fantome') });
    assert.strictEqual(r.verdict, 'RPC_FRONT_CONFORME', `${porteur} ne doit pas bloquer un déploiement`);
    const c = constat(r, CODES.RPC_INTROUVABLE_SUR_LA_CIBLE);
    assert.ok(c, `${porteur} doit tout de même être signalé`);
    assert.strictEqual(c.severite, SEVERITES.WARN, `${porteur} doit avertir, pas bloquer`);
  }
  ok('C4 — six formes d\'outillage avertissent sans bloquer');

  // UN CAS À PART, et il faut le dire : les chemins CACHÉS ne sont pas de
  // l'outillage silencieux, ils sont HORS ARTEFACT. `upload-pages-artifact`
  // n'emballe ni `node_modules` ni les chemins commençant par un point : ce
  // qui est écrit là n'est jamais servi, et la garde ne le lit pas du tout.
  // L'épreuve l'écrit explicitement pour que la différence entre « averti » et
  // « invisible » ne se découvre pas un jour en production.
  for (const horsArtefact of ['.github/workflows/truc.js', 'node_modules/paquet/index.js']) {
    const r = juger(socle, { ...socle, [horsArtefact]: APPEL('fantome') });
    assert.strictEqual(r.verdict, 'RPC_FRONT_CONFORME');
    assert.strictEqual(r.constats.length, 0,
      `${horsArtefact} n'est pas servi : la garde ne doit pas même le voir`);
  }
  ok('C4 bis — un chemin caché ou `node_modules` est hors artefact : non pas averti, invisible');

  // MUTATION : le MÊME contenu, porté par un écran. Seul le nom change.
  const r = juger(socle, { ...socle, 'NEXUS-Ecran-v1.html': APPEL('fantome') });
  assert.strictEqual(r.verdict, 'RPC_FRONT_REFUS');
  ok('C4 muté — le même appel, porté par un écran, bloque : la gravité tient au porteur');

  assert.strictEqual(estEcranReel('NEXUS-Login-v1.html'), true);
  assert.strictEqual(estEcranReel('nexus-page.js'), true);
  assert.strictEqual(estEcranReel('outils/garde.js'), false);
  ok('C4 ter — la frontière écran/outillage est ouverte : est écran ce qui n\'est pas prouvablement un outil');
}

// ------------------------------------------------------------------
// C5 — un appel PRÉEXISTANT non prouvable avertit, il ne bloque pas : l'écran
// tourne peut-être depuis des mois, la fonction est alors en base hors bande.
// Trois cas réels de ce genre existent depuis juillet 2026.
// ------------------------------------------------------------------
{
  const socle = { 'supabase/migrations/20260101000000_socle.sql': DEFINITION('socle') };
  const front = { 'NEXUS-A-v1.html': APPEL('socle') + APPEL('venue_hors_bande') };
  const r = juger({ ...socle, ...front }, { ...socle, ...front });
  assert.strictEqual(r.verdict, 'RPC_FRONT_CONFORME');
  const c = constat(r, CODES.RPC_INTROUVABLE_SUR_LA_CIBLE);
  assert.strictEqual(c.severite, SEVERITES.WARN);
  assert.ok(/DÉCLARER/.test(c.detail), 'l\'avertissement doit dire quoi faire : déclarer, pas refermer');
  ok('C5 — un appel préexistant non prouvable avertit et laisse passer');

  // MUTATION : le même appel, mais introduit par le candidat.
  const r2 = juger(socle, { ...socle, ...front });
  assert.strictEqual(r2.verdict, 'RPC_FRONT_REFUS');
  ok('C5 muté — le même appel, s\'il est NEUF, bloque : l\'ancienneté est le discriminant');
}

// ------------------------------------------------------------------
// C6 — la déclaration hors bande déclasse en INFO, et une déclaration
// incomplète est REFUSÉE, pas ignorée : une exemption sans date ni
// environnement de mesure fabrique une preuve.
// ------------------------------------------------------------------
{
  const socle = { 'supabase/migrations/20260101000000_socle.sql': DEFINITION('socle') };
  const front = { 'NEXUS-A-v1.html': APPEL('socle') + APPEL('venue_hors_bande') };
  const decl = (entree) => ({ 'docs/deploiement/rpc-hors-bande-constatees.json': JSON.stringify({ fonctions: [entree] }) });
  const complete = { fonction: 'venue_hors_bande', constatee_le: '2026-10-01 17:31:53 UTC', environnement_mesure: 'Test', motif: 'creee hors bande' };

  const r = juger({ ...socle, ...front }, { ...socle, ...front, ...decl(complete) });
  assert.strictEqual(r.verdict, 'RPC_FRONT_CONFORME');
  const c = constat(r, CODES.RPC_HORS_BANDE_DECLAREE);
  assert.strictEqual(c.severite, SEVERITES.INFO);
  assert.ok(c.detail.includes('2026-10-01 17:31:53 UTC') && c.detail.includes('Test'),
    'l\'INFO doit porter la date et l\'environnement de la mesure, sinon elle n\'est pas une mesure');
  ok('C6 — une déclaration complète déclasse l\'avertissement en INFO daté');

  for (const champ of ['fonction', 'constatee_le', 'environnement_mesure', 'motif']) {
    const amputee = { ...complete }; delete amputee[champ];
    const rr = juger({ ...socle, ...front }, { ...socle, ...front, ...decl(amputee) });
    assert.strictEqual(rr.verdict, 'RPC_FRONT_REFUS', `une déclaration sans « ${champ} » doit être refusée`);
    assert.ok(constat(rr, CODES.DECLARATION_NON_RECEVABLE));
  }
  ok('C6 muté — une déclaration privée de l\'un de ses quatre champs est refusée, pas ignorée');

  const illisible = juger({ ...socle, ...front },
    { ...socle, ...front, 'docs/deploiement/rpc-hors-bande-constatees.json': '{ ceci n\'est pas du JSON' });
  assert.ok(constat(illisible, CODES.DECLARATION_NON_RECEVABLE));
  const sansTable = juger({ ...socle, ...front },
    { ...socle, ...front, 'docs/deploiement/rpc-hors-bande-constatees.json': '{"objet":"rien"}' });
  assert.ok(constat(sansTable, CODES.DECLARATION_NON_RECEVABLE));
  ok('C6 bis — un fichier de déclaration illisible ou sans table de fonctions est refusé');

  // MUTATION DÉCISIVE : une déclaration ne doit PAS pouvoir exempter un appel
  // que le candidat introduit. Sinon n'importe quel candidat s'autorise lui-même.
  const neuf = juger(socle, { ...socle, ...front, ...decl(complete) });
  assert.strictEqual(neuf.verdict, 'RPC_FRONT_REFUS',
    'une déclaration ne doit jamais exempter un appel introduit par le candidat');
  ok('C6 ter — un candidat ne peut pas s\'exempter d\'un appel neuf en le déclarant');
}

// ------------------------------------------------------------------
// C7 — une définition COMMENTÉE n'est pas une preuve. Le défaut est réel : il a
// été trouvé en écrivant ce banc, pas en relisant la garde. Une intention
// laissée en commentaire dans une migration — « -- create function … » — avait
// la même valeur probante qu'une fonction réellement créée.
//
// La mutation est minimale au sens strict : DEUX TIRETS ajoutés devant la
// signature, dans les deux arbres à la fois. Rien d'autre ne bouge, pas même
// l'appel. Si la garde cessait de retirer les commentaires, ce couple rendrait
// deux fois le même vert.
// ------------------------------------------------------------------
{
  const front = { 'NEXUS-A-v1.html': APPEL('ma_fonction') };
  const socle = { 'supabase/migrations/20260101000000_socle.sql': DEFINITION('socle'), 'NEXUS-Z-v1.html': APPEL('socle') };

  const definie = { 'supabase/migrations/20260102000000_f.sql': 'create or replace\n  function public.ma_fonction(p text) returns text language sql as $$ select p $$;\n' };
  const vert = juger({ ...socle, ...definie }, { ...socle, ...definie, ...front });
  assert.strictEqual(vert.verdict, 'RPC_FRONT_CONFORME');
  ok('C7 — une signature écrite sur deux lignes est reconnue : un écran neuf qui l\'appelle passe');

  for (const [forme, sql] of [
    ['ligne', '-- create or replace\n--   function public.ma_fonction(p text) returns text language sql as $$ select p $$;\nselect 1;\n'],
    ['bloc', '/* create or replace function public.ma_fonction(p text) returns text language sql as $$ select p $$; */\nselect 1;\n']
  ]) {
    const mutee = { 'supabase/migrations/20260102000000_f.sql': sql };
    const r = juger({ ...socle, ...mutee }, { ...socle, ...mutee, ...front });
    assert.strictEqual(r.verdict, 'RPC_FRONT_REFUS', `une définition en commentaire ${forme} ne prouve rien`);
    assert.ok(constat(r, CODES.RPC_INTROUVABLE_SUR_LA_CIBLE));
  }
  ok('C7 muté — la même signature mise en commentaire (ligne ou bloc) ne vaut plus preuve');

  assert.ok(!/create/.test(sansCommentairesSql('-- create function f()')));
  assert.ok(!/create/.test(sansCommentairesSql('/* create function f() */')));
  assert.ok(/create/.test(sansCommentairesSql('create function f() -- commentaire en fin de ligne')));
  ok('C7 bis — le retrait des commentaires SQL est mesuré directement, et ne mange pas le code qui les précède');
}

// C8 — une garde qui ne mesure rien doit REFUSER, pas passer. Zéro migration
// ou zéro appel veut dire que le motif a dérivé ou que l'arbre n'est pas celui
// qu'on croit : dans les deux cas le vert serait un vert par défaut.
// ------------------------------------------------------------------
{
  const r = juger({ 'NEXUS-A-v1.html': APPEL('socle') }, { 'NEXUS-A-v1.html': APPEL('socle') });
  assert.ok(constat(r, CODES.MESURE_IMPOSSIBLE_MIGRATIONS), 'zéro migration lue sur la cible doit refuser');
  assert.strictEqual(r.verdict, 'RPC_FRONT_REFUS');
  ok('C8 — zéro migration lue sur la cible : refus fermé, pas un laissez-passer');

  const socle = { 'supabase/migrations/20260101000000_socle.sql': DEFINITION('socle') };
  const r2 = juger(socle, { ...socle, 'NEXUS-A-v1.html': '<html>aucun appel</html>' });
  assert.ok(constat(r2, CODES.MESURE_IMPOSSIBLE_APPELS), 'zéro appel trouvé doit refuser : le motif a dérivé');
  ok('C8 bis — zéro appel « .rpc() » trouvé sur le candidat : refus fermé');
}

// ------------------------------------------------------------------
// C9 — la cible se DÉSIGNE. Un repli silencieux ferait mesurer une cible que
// personne n'a nommée, et rendrait un verdict crédible sur une autre question.
// ------------------------------------------------------------------
{
  const socle = { 'supabase/migrations/20260101000000_socle.sql': DEFINITION('socle'), 'NEXUS-A-v1.html': APPEL('socle') };
  const racine = bac(socle, socle);

  for (const cible of [undefined, null, '', '   ']) {
    const r = controler({ racine, candidat: 'candidat', cible });
    assert.strictEqual(r.verdict, 'RPC_FRONT_REFUS');
    assert.ok(constat(r, CODES.CIBLE_NON_DESIGNEE), `cible « ${JSON.stringify(cible)} » doit refuser`);
  }
  ok('C9 — absente, nulle, vide ou blanche, la cible non désignée produit un refus fermé');

  const src = fs.readFileSync(path.join(__dirname, 'outils', 'garde-rpc-front-definie-sur-la-cible.js'), 'utf8');
  for (const repli of ["cible || 'production'", 'cible || "production"', "cible: 'production'", "|| 'origin/production'"]) {
    assert.ok(!src.includes(repli), `aucun repli silencieux vers « ${repli} » ne doit exister`);
  }
  ok('C9 bis — la source ne contient aucun repli codé en dur vers une cible');

  for (const [ref, quoi] of [['refs/n-existe-pas', 'cible'], [undefined, 'candidat']]) {
    const r = quoi === 'cible'
      ? controler({ racine, candidat: 'candidat', cible: ref })
      : controler({ racine, candidat: 'refs/pouet', cible: 'cible' });
    assert.ok(constat(r, CODES.REF_INTROUVABLE), `une ${quoi} non résoluble doit refuser`);
  }
  ok('C9 ter — une ref non résoluble, candidat ou cible, produit un refus fermé');
}

// ------------------------------------------------------------------
// C10 — une option non reconnue est REFUSÉE, pas ignorée. Ignorée en silence,
// elle laisse croire que le verdict porte sur ce qu'on a demandé (leçon du
// 01/10/2026 : une option inconnue rend un verdict crédible).
// ------------------------------------------------------------------
{
  assert.strictEqual(lireArguments(['--profondeur', '1']).code, CODES.OPTION_INCONNUE);
  assert.strictEqual(lireArguments(['--cible']).code, CODES.OPTION_SANS_VALEUR);
  assert.strictEqual(lireArguments(['--candidat', '--cible', 'x']).code, CODES.OPTION_SANS_VALEUR);
  assert.strictEqual(lireArguments(['candidat']).code, CODES.OPTION_INCONNUE);
  assert.ok(!lireArguments(['--candidat', 'a', '--cible', 'b']).erreur);
  assert.strictEqual(lireArguments(['--candidat', 'a', '--cible', 'b']).opts.cible, 'b');
  ok('C10 — chaque forme d\'appel mal nommée porte son code distinct, et la forme correcte passe');
}

// ------------------------------------------------------------------
// C11 — contrat de surface. La garde lit git, donc elle ouvre un sous-processus :
// c'est assumé et c'est tout ce qu'elle a le droit d'ouvrir. Ni secret, ni
// réseau, ni base — sinon elle deviendrait un chemin d'accès déguisé et ne
// pourrait plus tourner en CI sur une branche quelconque.
// ------------------------------------------------------------------
{
  const src = fs.readFileSync(path.join(__dirname, 'outils', 'garde-rpc-front-definie-sur-la-cible.js'), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const interdit of ['PGPASSWORD', 'psql', 'SUPABASE_', 'DB_URL', 'service_role', 'security', 'https://']) {
    assert.ok(!code.includes(interdit), 'la garde ne doit pas contenir `' + interdit + '` hors commentaire');
  }
  assert.ok(!/require\(['"](https?|net|tls|dns)['"]\)/.test(code), 'la garde ne doit ouvrir aucun réseau');
  const binaires = [...code.matchAll(/execFileSync\(\s*'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepStrictEqual([...new Set(binaires)].sort(), ['git', 'tar'],
    'la garde ne doit lancer que `git` et `tar` : tout autre binaire élargirait sa surface');
  for (const sous of [...code.matchAll(/execFileSync\(\s*'git',\s*\[\s*'([a-z-]+)'/g)].map((m) => m[1])) {
    assert.ok(['rev-parse', 'archive'].includes(sous), `sous-commande git inattendue : ${sous}`);
  }
  ok('C11 — la garde ne lance que `git rev-parse`, `git archive` et `tar` : aucun secret, aucun réseau, aucune écriture');

  // Et elle ne laisse rien derrière elle : les arbres extraits sont des bacs
  // temporaires, pas des reliquats qui feraient mesurer un arbre périmé.
  const avant = fs.readdirSync(os.tmpdir()).filter((e) => e.startsWith('nexus-rpc-')).length;
  const socle = { 'supabase/migrations/20260101000000_socle.sql': DEFINITION('socle'), 'NEXUS-A-v1.html': APPEL('socle') };
  juger(socle, socle);
  assert.strictEqual(fs.readdirSync(os.tmpdir()).filter((e) => e.startsWith('nexus-rpc-')).length, avant,
    'chaque arbre extrait doit être supprimé : un reliquat ferait mesurer un arbre périmé');
  ok('C11 bis — aucun arbre extrait ne survit à la mesure');
}

for (const d of bacs) fs.rmSync(d, { recursive: true, force: true });
console.log(`\n${n} tests passés.`);
