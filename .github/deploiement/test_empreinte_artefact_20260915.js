// Test — l'empreinte de l'artefact mesure bien l'artefact (15/09/2026).
//
// POURQUOI CE TEST EXISTE. Une empreinte est une garde comme une autre, avec
// la même façon de ne pas mordre : si elle ne change pas quand l'artefact
// change, elle autorise à promouvoir autre chose que ce qui a été éprouvé, et
// personne ne s'en aperçoit puisqu'elle est verte. L'inverse est aussi grave :
// si elle change quand l'artefact ne change pas — une date de fichier, un
// ordre de lecture, une locale de runner — elle refuse à tort, et le jour où
// elle gêne quelqu'un la débranche.
//
// Chaque cas ci-dessous nomme donc une MUTATION précise et dit ce que
// l'empreinte doit en faire : bouger, ou ne pas bouger. Le dernier tiers
// recalcule l'empreinte par un chemin de code indépendant : sans cela, un
// outil qui hacherait autre chose que ce qu'il annonce resterait vert contre
// lui-même.
//
// ─── CAMPAGNE DE MUTATION DU 15/09/2026 ────────────────────────────────────
// Défaut remis dans `.github/deploiement/empreinte-artefact.js`, épreuve rejouée. Ce qui
// est mordu, et par quel cas :
//   chemins cachés comptés dans l'empreinte  → 4 cas (périmètre + arbre réel)
//   tri par collation au lieu d'octets       → Ordre
//   manifeste sans les chemins               → renommé, déplacé, Indépendant
//   arbre vide accepté                       → Fermé · arbre vide
//   saut de ligne dans un nom accepté        → Fermé · saut de ligne
//   `--attendu` non confronté à la mesure    → CLI · --attendu différent
//   liens symboliques suivis, ou plus aucune
//   garde de type                            → Fermé · lien symbolique
//
// DEUX MUTATIONS ONT SURVÉCU, et c'est une information, pas un trou : retirer
// la SEULE règle des liens symboliques, ou la SEULE vérification d'existence
// de la racine, ne change rien au verdict — une seconde garde reprend derrière
// (l'entrée de type inattendu ; l'arbre vide). Il faut retirer les deux pour
// faire tomber le cas, ce qui a été vérifié. Une redondance, pas une garde
// muette : la mutation visait hors du contrat, pas l'épreuve à côté.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

// L'outil est désormais un voisin : `.github/deploiement/` réunit le rail de
// déploiement et ses deux épreuves. La racine du dépôt — ce que mesurent les
// cas « Réel » — est deux niveaux au-dessus.
const OUTIL = path.join(__dirname, 'empreinte-artefact.js');
assert.ok(fs.existsSync(OUTIL), '.github/deploiement/empreinte-artefact.js introuvable');
const RACINE_DEPOT = path.join(__dirname, '..', '..');
const { empreinte, inventorier } = require(OUTIL);

const BAC = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-empreinte-'));
let numeroArbre = 0;

// `fichiers` est un objet { chemin relatif → contenu }. L'ordre des clés est
// l'ordre de création : plusieurs cas s'en servent pour vérifier que
// l'empreinte n'en dépend pas. La valeur `undefined` retire une entrée de
// BASE — c'est ainsi que se disent « renommé » et « retiré ».
function arbre(fichiers) {
  const racine = path.join(BAC, `cas-${++numeroArbre}`);
  fs.mkdirSync(racine, { recursive: true });
  for (const [nom, contenu] of Object.entries(fichiers)) {
    if (contenu === undefined) continue;
    const cible = path.join(racine, nom);
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.writeFileSync(cible, contenu);
  }
  return racine;
}

// L'arbre minimal servi : un écran, un script, une ressource.
const BASE = {
  'index.html': '<!doctype html><html><body>NEXUS</body></html>\n',
  'nexus-auth.js': 'const a = 1;\n',
  'assets/fond.png': 'octets\n',
};

function e(racine) {
  const m = empreinte(racine);
  assert.ok(m.ok, `empreinte non mesurée : ${m.arret.join(' ')}`);
  return m.empreinte;
}

let total = 0;
const echecs = [];
function cas(intitule, fn) {
  total++;
  try { fn(); process.stdout.write('.'); }
  catch (er) { echecs.push(`${intitule}\n    ${er.message.split('\n')[0]}`); process.stdout.write('x'); }
}

// Deux arbres, une mutation entre eux, et le verdict attendu.
function mutation(intitule, modifie, doitBouger) {
  cas(intitule, () => {
    const avant = e(arbre({ ...BASE }));
    const apres = e(arbre(modifie));
    if (doitBouger) assert.notStrictEqual(apres, avant, 'l\'empreinte n\'a pas bougé alors que l\'artefact a changé');
    else assert.strictEqual(apres, avant, 'l\'empreinte a bougé alors que l\'artefact servi est le même');
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CE QUI DOIT FAIRE BOUGER L'EMPREINTE
// ═══════════════════════════════════════════════════════════════════════════
// Si l'une de ces mutations passe inaperçue, « promouvoir exactement le même
// artefact » ne veut plus rien dire.

mutation('Bouge · un octet changé dans un script',
  { ...BASE, 'nexus-auth.js': 'const a = 2;\n' }, true);

mutation('Bouge · un fichier ajouté',
  { ...BASE, 'nexus-verify.js': 'const v = 1;\n' }, true);

mutation('Bouge · un fichier retiré',
  { 'index.html': BASE['index.html'], 'assets/fond.png': BASE['assets/fond.png'] }, true);

mutation('Bouge · un fichier renommé, contenu identique',
  { ...BASE, 'nexus-auth.js': undefined, 'nexus-authentification.js': 'const a = 1;\n' }, true);

mutation('Bouge · un fichier déplacé d\'un dossier à l\'autre',
  { ...BASE, 'assets/fond.png': undefined, 'images/fond.png': 'octets\n' }, true);

mutation('Bouge · un fichier vidé n\'est pas un fichier absent',
  { ...BASE, 'nexus-auth.js': '' }, true);

// Le cas qui distingue une vraie empreinte d'arbre d'une simple somme de
// hachages : deux fichiers qui échangent leur contenu. L'ensemble des
// hachages est identique ; l'artefact, lui, est différent — le navigateur
// demande `nexus-auth.js` par son nom.
cas('Bouge · deux fichiers qui échangent leur contenu', () => {
  const avant = e(arbre({ 'a.js': 'contenu A\n', 'b.js': 'contenu B\n' }));
  const apres = e(arbre({ 'a.js': 'contenu B\n', 'b.js': 'contenu A\n' }));
  assert.notStrictEqual(apres, avant, 'le chemin n\'est pas lié à son contenu dans le manifeste');
});

// ═══════════════════════════════════════════════════════════════════════════
// CE QUI NE DOIT PAS LA FAIRE BOUGER
// ═══════════════════════════════════════════════════════════════════════════
// Une empreinte qui bouge sans raison est pire qu'inutile : elle transforme
// chaque déploiement en enquête, et finit par être ignorée.

cas('Stable · deux mesures du même arbre', () => {
  const racine = arbre({ ...BASE });
  assert.strictEqual(e(racine), e(racine), 'deux mesures du même arbre diffèrent');
});

cas('Stable · même contenu, ordre de création inversé', () => {
  const direct = e(arbre({ 'a.js': 'A\n', 'b.js': 'B\n', 'c/d.js': 'D\n' }));
  const inverse = e(arbre({ 'c/d.js': 'D\n', 'b.js': 'B\n', 'a.js': 'A\n' }));
  assert.strictEqual(inverse, direct, 'l\'empreinte dépend de l\'ordre de lecture du système de fichiers');
});

cas('Stable · une date de modification changée', () => {
  const racine = arbre({ ...BASE });
  const avant = e(racine);
  const vieux = new Date('2020-01-01T00:00:00Z');
  fs.utimesSync(path.join(racine, 'nexus-auth.js'), vieux, vieux);
  assert.strictEqual(e(racine), avant, 'l\'empreinte dépend des dates de fichiers');
});

// Le périmètre de l'empreinte doit être celui de l'emballage :
// `upload-pages-artifact` v4+ n'emballe aucun chemin caché. Une empreinte qui
// les compterait changerait sans que le site change — et ne pourrait donc
// jamais être confrontée à ce que sert l'URL réelle.
mutation('Stable · un fichier caché à la racine — hors emballage, hors empreinte',
  { ...BASE, '.artefact-public': 'marqueur\n' }, false);

mutation('Stable · un dossier caché en profondeur',
  { ...BASE, '.git/objects/ab/cdef': 'objet\n', '.github/workflows/x.yml': 'on: push\n' }, false);

mutation('Stable · un fichier caché en profondeur d\'un dossier servi',
  { ...BASE, 'assets/.DS_Store': 'bruit\n' }, false);

// ═══════════════════════════════════════════════════════════════════════════
// L'ORDRE EST UN ORDRE D'OCTETS, PAS UNE COLLATION
// ═══════════════════════════════════════════════════════════════════════════
// `localeCompare` classe `a-b.js` avant ou après `ab.js` selon la locale de la
// machine. Un manifeste trié ainsi donnerait deux empreintes différentes pour
// le même arbre sur deux runners — et l'artefact éprouvé ne serait jamais
// « exactement le même » que l'artefact promu, sans que rien n'ait changé.
cas('Ordre · le manifeste est trié en ordre d\'octets', () => {
  const noms = ['ab.js', 'a-b.js', 'a_b.js', 'A.js', 'a.js', 'Z.js', 'é.js', 'é.js'];
  const racine = arbre(Object.fromEntries(noms.map(n => [n, `x ${n}\n`])));
  const { fichiers } = inventorier(racine);
  const attendu = [...fichiers].sort((x, y) =>
    Buffer.compare(Buffer.from(x, 'utf8'), Buffer.from(y, 'utf8')));
  assert.deepStrictEqual(fichiers, attendu, 'l\'inventaire n\'est pas en ordre d\'octets');
  // `localeCompare` donnerait un ordre différent sur ce jeu : si les deux
  // coïncidaient, ce cas ne prouverait rien.
  const collation = [...fichiers].sort((x, y) => x.localeCompare(y));
  assert.notDeepStrictEqual(collation, attendu,
    'le jeu de noms ne distingue plus collation et octets : ce cas ne mord plus');
});

// ═══════════════════════════════════════════════════════════════════════════
// ÉCHEC FERMÉ — ce qui ne peut pas être mesuré n'est pas mesuré
// ═══════════════════════════════════════════════════════════════════════════

cas('Fermé · un arbre vide n\'a pas d\'empreinte', () => {
  const m = empreinte(arbre({}));
  assert.strictEqual(m.ok, false, 'un arbre vide a reçu une empreinte');
});

cas('Fermé · un lien symbolique arrête la mesure', () => {
  const racine = arbre({ ...BASE });
  fs.symlinkSync(path.join(racine, 'nexus-auth.js'), path.join(racine, 'lien.js'));
  const m = empreinte(racine);
  assert.strictEqual(m.ok, false, 'un lien symbolique a été mesuré comme un fichier');
  assert.ok(m.arret.join(' ').includes('lien.js'), 'le lien fautif doit être nommé');
});

// Un saut de ligne dans un nom de fichier casserait le manifeste : la ligne
// se scinderait, et deux arbres différents pourraient produire la même
// empreinte. Le cas est rare ; c'est exactement pour cela qu'il doit être
// refusé plutôt que deviné.
cas('Fermé · un nom contenant un saut de ligne arrête la mesure', () => {
  const racine = arbre({ ...BASE });
  let pose = true;
  try { fs.writeFileSync(path.join(racine, 'a\nb.js'), 'x\n'); }
  catch (er) { pose = false; }
  if (!pose) { assert.ok(true); return; }  // système de fichiers qui refuse déjà : tant mieux
  const m = empreinte(racine);
  assert.strictEqual(m.ok, false, 'un nom avec saut de ligne a été mesuré');
});

// ═══════════════════════════════════════════════════════════════════════════
// L'OUTIL NE DOIT PAS SE CROIRE SUR PAROLE
// ═══════════════════════════════════════════════════════════════════════════
// Recalcul par un chemin de code indépendant, qui n'appelle rien de l'outil.
// Si l'outil hachait autre chose que ce qu'il annonce — le manifeste sans les
// chemins, les contenus concaténés, un sel quelconque — il resterait vert
// contre lui-même, mais pas contre celui-ci. C'est aussi ce qui garantit que
// la recette en clair de l'en-tête (`find | sort | shasum`) donne bien la
// même valeur.
cas('Indépendant · l\'empreinte est le sha256 du manifeste annoncé', () => {
  const racine = arbre({ ...BASE, 'sous/dossier/x.css': 'body{}\n' });
  const listes = [];
  (function marcher(rel) {
    for (const d of fs.readdirSync(path.join(racine, rel || '.'), { withFileTypes: true })) {
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (d.name.startsWith('.')) continue;
      if (d.isDirectory()) marcher(r); else listes.push(r);
    }
  })('');
  listes.sort((x, y) => Buffer.compare(Buffer.from(x, 'utf8'), Buffer.from(y, 'utf8')));
  const texte = listes.map(r =>
    `${crypto.createHash('sha256').update(fs.readFileSync(path.join(racine, r))).digest('hex')}  ${r}\n`).join('');
  const attendu = crypto.createHash('sha256').update(texte).digest('hex');
  assert.strictEqual(e(racine), attendu, 'l\'empreinte n\'est pas le sha256 du manifeste décrit');
});

// ═══════════════════════════════════════════════════════════════════════════
// LA LIGNE DE COMMANDE — le contrat vu du workflow
// ═══════════════════════════════════════════════════════════════════════════

function lancer(options) {
  const r = spawnSync(process.execPath, [OUTIL, ...options], { encoding: 'utf8' });
  return { code: r.status, sortie: `${r.stdout}${r.stderr}` };
}

// `--arbre-source=` est désormais explicite dans tous les cas CLI. Il l'était
// implicitement — le dossier courant — et la provenance des migrations ayant
// été rendue fermée, ce dossier courant est devenu porteur : lancer l'épreuve
// depuis ailleurs que la racine du dépôt aurait fait échouer des cas qui ne
// parlent pas de migrations. Une épreuve ne doit pas dépendre d'où on
// l'appelle.
cas('CLI · --attendu conforme : accepté', () => {
  const racine = arbre({ ...BASE });
  const { code, sortie } = lancer([`--racine=${racine}`, `--arbre-source=${RACINE_DEPOT}`, `--attendu=${e(racine)}`]);
  assert.strictEqual(code, 0, `attendu : acceptation.\n${sortie}`);
});

// Le contrôle qui rend « promouvoir exactement le même artefact » exécutable
// plutôt que déclaratif.
cas('CLI · --attendu différent : refus', () => {
  const racine = arbre({ ...BASE });
  const { code, sortie } = lancer([`--racine=${racine}`, `--arbre-source=${RACINE_DEPOT}`, `--attendu=${'0'.repeat(64)}`]);
  assert.strictEqual(code, 1, `attendu : refus.\n${sortie}`);
  assert.ok(sortie.includes('attendu'), 'le refus doit montrer les deux valeurs');
});

cas('CLI · une racine absente ne produit pas d\'empreinte', () => {
  const { code } = lancer([`--racine=${path.join(BAC, 'nulle-part')}`]);
  assert.strictEqual(code, 1, 'une racine absente a produit un code 0');
});

// L'empreinte vit DEHORS. Si l'outil écrivait quoi que ce soit dans l'arbre
// mesuré — un fichier d'empreinte, par exemple — il changerait ce qu'il
// mesure, et la valeur annoncée ne serait plus celle de ce qui est servi.
cas('CLI · mesurer ne modifie pas l\'arbre mesuré', () => {
  const racine = arbre({ ...BASE, 'supabase/migrations/0001_socle.sql': 'create table t();\n' });
  const avant = e(racine);
  const journal = path.join(BAC, 'journal-hors-arbre.txt');
  const { code, sortie } = lancer([`--racine=${racine}`, `--arbre-source=${racine}`, `--journal=${journal}`]);
  assert.strictEqual(code, 0, `mesure en échec :\n${sortie}`);
  assert.ok(fs.existsSync(journal), 'le journal n\'a pas été écrit');
  assert.strictEqual(e(racine), avant, 'l\'outil a modifié l\'arbre qu\'il mesure');
  assert.ok(fs.readFileSync(journal, 'utf8').includes(avant), 'le journal ne porte pas l\'empreinte mesurée');
});

// ═══════════════════════════════════════════════════════════════════════════
// LA PROVENANCE DES MIGRATIONS — elle doit échouer FERMÉE
// ═══════════════════════════════════════════════════════════════════════════
// Ces cas ne mesurent pas une empreinte : ils vérifient qu'aucune release ne
// peut emporter une provenance de migrations silencieusement vide. Le défaut
// corrigé le 15/09/2026 était exactement là — dossier absent, dossier sans
// migration et sous-dossier renvoyaient « 0 / aucune » avec un code 0, c'est-
// à-dire une provenance fausse portée par un rail vert.
//
// Chaque cas exige le code 1 ET un fragment du diagnostic : un `echouer()` qui
// se déclencherait pour une autre raison passerait un contrôle qui ne regarde
// que le code de sortie.

// Un artefact quelconque, juste pour que la mesure ait quelque chose à mesurer
// avant d'arriver à la provenance.
function artefactQuelconque() { return arbre({ ...BASE }); }

function provenance(intitule, fichiersSource, codeAttendu, fragment, apres) {
  cas(intitule, () => {
    const source = arbre(fichiersSource);
    if (apres) apres(source);
    const journal = path.join(BAC, `journal-prov-${numeroArbre}.txt`);
    const { code, sortie } = lancer([
      `--racine=${artefactQuelconque()}`, `--arbre-source=${source}`, `--journal=${journal}`,
    ]);
    assert.strictEqual(code, codeAttendu, `code inattendu.\n${sortie}`);
    assert.ok(sortie.includes(fragment), `diagnostic attendu absent — « ${fragment} » :\n${sortie}`);
    if (codeAttendu === 1) {
      assert.ok(!fs.existsSync(journal), 'un journal a été écrit malgré la provenance en échec');
    }
  });
}

provenance('Fermé · `supabase/migrations` absent : la provenance s\'arrête',
  { 'lisez-moi.md': 'aucun dossier supabase ici\n' },
  1, 'absent ou illisible');

// `readdirSync` sur un fichier lève ENOTDIR : « illisible » ne se limite pas
// aux droits, c'est tout ce qui n'ouvre pas.
provenance('Fermé · `supabase/migrations` n\'est pas un dossier (ENOTDIR)',
  { 'supabase/migrations': 'ceci est un fichier, pas un dossier\n' },
  1, 'absent ou illisible');

provenance('Fermé · dossier vide : zéro migration canonique arrête tout',
  { 'lisez-moi.md': 'x\n' },
  1, 'Aucune migration canonique',
  (source) => fs.mkdirSync(path.join(source, 'supabase/migrations'), { recursive: true }));

// Zéro `.sql` malgré des entrées : le compte d'entrées lues doit apparaître,
// sinon le diagnostic ne distingue pas « dossier vide » de « dossier plein de
// fichiers qui ne sont pas des migrations ».
provenance('Fermé · que des fichiers non-SQL : toujours zéro migration canonique',
  { 'supabase/migrations/lisez-moi.md': 'notes\n', 'supabase/migrations/schema.txt': 'x\n' },
  1, 'Aucune migration canonique');

provenance('Fermé · un sous-dossier dans `supabase/migrations` : type inattendu',
  {
    'supabase/migrations/0001_socle.sql': 'create table t();\n',
    'supabase/migrations/archives/0000_vieux.sql': 'select 1;\n',
  },
  1, 'sous-dossier');

provenance('Fermé · un lien symbolique dans `supabase/migrations` : type inattendu',
  { 'supabase/migrations/0001_socle.sql': 'create table t();\n' },
  1, 'lien symbolique',
  (source) => fs.symlinkSync(
    path.join(source, 'supabase/migrations/0001_socle.sql'),
    path.join(source, 'supabase/migrations/0002_alias.sql')));

// Le témoin. Sans lui, les six cas ci-dessus seraient satisfaits par un outil
// qui refuse tout.
cas('Provenance · deux migrations canoniques : mesurées, chemin complet, empreinte', () => {
  const source = arbre({
    'supabase/migrations/0002_ensuite.sql': 'alter table t add c int;\n',
    'supabase/migrations/0001_socle.sql': 'create table t();\n',
    'supabase/migrations/.DS_Store': 'bruit macOS\n',
    'supabase/migrations/lisez-moi.md': 'ce n\'est pas une migration\n',
    'requete-de-travail.sql': 'select 1;\n',
    'supabase/retours/0001_retour.sql': 'drop table t;\n',
  });
  const journal = path.join(BAC, 'journal-provenance-temoin.txt');
  const { code, sortie } = lancer([
    `--racine=${artefactQuelconque()}`, `--arbre-source=${source}`, `--journal=${journal}`,
  ]);
  assert.strictEqual(code, 0, `la provenance aurait dû passer.\n${sortie}`);
  assert.ok(/migrations_source_nombre\s*: 2\b/.test(sortie),
    `deux migrations attendues, ni le SQL de la racine ni \`supabase/retours/\` :\n${sortie}`);
  const m = sortie.match(/migrations_source_empreinte\s*: ([0-9a-f]{64})/);
  assert.ok(m, `empreinte de provenance mal formée :\n${sortie}`);

  const texte = fs.readFileSync(journal, 'utf8');
  assert.ok(texte.includes('supabase/migrations/0001_socle.sql'), 'le manifeste n\'énumère pas la première migration');
  assert.ok(texte.includes('supabase/migrations/0002_ensuite.sql'), 'le manifeste n\'énumère pas la seconde migration');
  // Les lignes de manifeste seulement : l'en-tête du journal CITE
  // `supabase/retours/` pour dire qu'il est exclu, et un `includes` naïf sur
  // le fichier entier confondrait l'exclusion avec une inclusion.
  const lignes = texte.split('\n').filter(l => /^[0-9a-f]{64} {2}/.test(l));
  assert.ok(!lignes.some(l => l.endsWith('requete-de-travail.sql')), 'un SQL de la racine est entré dans la provenance');
  assert.ok(!lignes.some(l => l.includes('supabase/retours/')), 'un SQL de `supabase/retours/` est entré dans la provenance');
  assert.ok(!lignes.some(l => l.endsWith('.md')), 'un fichier non-SQL est entré dans la provenance');
  assert.ok(!lignes.some(l => l.includes('.DS_Store')), 'un fichier caché est entré dans la provenance');
  assert.ok(!texte.includes('(aucune)'), 'le repli « (aucune) » subsiste alors que zéro migration est un échec');

  // Le chemin complet, pas le nom nu : deux dossiers de migrations qui
  // partageraient un nom de fichier produiraient sinon le même manifeste.
  const ligne = texte.split('\n').find(l => l.endsWith('supabase/migrations/0001_socle.sql'));
  assert.ok(/^[0-9a-f]{64} {2}supabase\/migrations\/0001_socle\.sql$/.test(ligne),
    `ligne de manifeste mal formée : « ${ligne} »`);
});

// Un `.sql` caché n'est pas une migration — même règle qu'à l'emballage — mais
// sa présence ne doit pas non plus arrêter le rail.
cas('Provenance · un `.sql` caché est ignoré sans arrêter la mesure', () => {
  const source = arbre({
    'supabase/migrations/0001_socle.sql': 'create table t();\n',
    'supabase/migrations/.0000_brouillon.sql': 'oups\n',
  });
  const { code, sortie } = lancer([`--racine=${artefactQuelconque()}`, `--arbre-source=${source}`]);
  assert.strictEqual(code, 0, `le rail s'est arrêté sur un fichier caché.\n${sortie}`);
  assert.ok(/migrations_source_nombre\s*: 1\b/.test(sortie), `une seule migration attendue :\n${sortie}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// L'ARBRE RÉEL — la mesure doit passer sur ce qui sera réellement servi
// ═══════════════════════════════════════════════════════════════════════════
// Une garde calibrée sur des arbres fabriqués peut parfaitement échouer sur le
// seul arbre qui compte. Mesuré le 15/09/2026 : la règle de clôture des
// références avait refusé l'arbre réel sur douze faux positifs, alors que sa
// suite de mutation était verte.
cas('Réel · l\'arbre de cette branche reçoit une empreinte', () => {
  const m = empreinte(RACINE_DEPOT);
  assert.ok(m.ok, `l'arbre réel n'a pas pu être mesuré : ${m.arret.join(' ')}`);
  assert.ok(/^[0-9a-f]{64}$/.test(m.empreinte), 'empreinte mal formée');
  assert.ok(m.fichiers.length > 500, `inventaire invraisemblable : ${m.fichiers.length} fichier(s)`);
  assert.ok(!m.fichiers.some(f => f.split('/').some(s => s.startsWith('.'))),
    'un chemin caché est entré dans l\'empreinte alors qu\'il ne sera pas emballé');
});

// La provenance est écrite ici en clair : ces deux valeurs ne dépendent que de
// `supabase/migrations/*.sql`, jamais de ce fichier — les y inscrire ne crée
// donc aucune circularité. (Ce qu'un fichier ne peut pas nommer, c'est sa
// propre empreinte d'artefact, et ce n'est pas ce qui est mesuré ici.)
//
// Ce fichier est un point de conflit PROGRAMMÉ : chaque lot qui ajoute une
// migration déplace ce compteur, donc chaque fusion le rouvre. La valeur de
// `production` est RECALCULÉE sur l'arbre fusionné après chaque pas — jamais
// recopiée depuis une branche, jamais additionnée de tête.
//
// Imputation au 16/09/2026, pas à pas du train :
//
//   240  ligne `production`
//   + 3  lot Pointage (#47/#54)
//   +21  lot Inventaire (#50) : 21 migrations DÉJÀ APPLIQUÉES en Production
//        dont le fichier manquait au dépôt — le dépôt rejoint la base, il ne
//        la devance pas
//   - 2  RECOUVREMENT Pointage∩Inventaire, blobs identiques sur `lot1`,
//        `lot8` et `lot4` : la fusion n'arbitre rien
//   + 1  lot Projection (#53) : `20260914210000_mes_ecarts_caisse_projection_employe.sql`
//   + 3  lot Cycle des services en phase pilote (#60, 16/09/2026) :
//        `20260916193000_prise_de_poste_ninvente_plus_la_fin.sql`,
//        `20260916194000_regularisation_fins_inventees_prise_de_poste.sql`,
//        `20260916195000_cloture_source_cycle_pilote.sql`
//   + 1  lot Accès hors service (#61) :
//        `20260916210000_mes_ecarts_caisse_masque_le_provisoire.sql` — additive,
//        elle ne réécrit pas la projection du 14/09 déjà estampillée sur Test
//   ───
//    267
//
//   16/09/2026 — l'empreinte a bougé sans que le NOMBRE bouge : la migration
//   `20260916210000` a été rouverte pour écrire son ACL en toutes lettres
//   (`grant execute … to service_role`, jusque-là hérité et donc indéterminé).
//   Un contenu qui change à nombre constant est exactement ce que cette
//   empreinte est là pour rendre visible.
//
//   16/09/2026, intégration de la tête de `production` dans #61 — #60 et #61
//   sont deux branches sœurs issues du même point : leurs quatre migrations
//   sont disjointes, aucun recouvrement à retrancher. 263 + 3 + 1 = 267, et
//   ce 267 est MESURÉ (`node .github/deploiement/empreinte-artefact.js
//   --arbre-source=.`), pas déduit de l'addition ci-dessus.
//
//   17/09/2026 — lot FDJ Vague 1, cycle de vie de la caisse :
//   + 9  `20260916220000_fdj_quart_relie_a_la_prise_de_poste.sql` à
//        `20260916220800_fdj_projection_employe.sql` — neuf migrations
//        strictement additives : colonnes de cycle de vie, journal
//        d'événements, demandes de correction après validation, auteur et date
//        d'effet des mouvements, cinq lots de commandes serveur, projection
//        employé. Aucune ne réécrit une migration déjà estampillée, aucune ne
//        recouvre un lot antérieur : il n'y a rien à retrancher.
//   ───
//    276
//
//   17/09/2026 — relecture finale de la PR #62, trois migrations de plus :
//   + 3  `20260916220900_fdj_projection_progression.sql` (l'écran employé ne
//        lit plus la table de caisse en clair),
//        `20260916221000_fdj_commandes_activations_et_mouvements.sql` (auteur,
//        employé, site, quart et date d'effet déduits côté serveur) et
//        `20260916221100_fdj_commande_saisie_caisse_manager.sql` (la saisie
//        managériale, sans laquelle refermer les politiques aurait cassé un
//        usage réel au lieu d'une faille). Additives elles aussi.
//
//        L'empreinte change également à cause de
//        `20260916220700_fdj_commandes_caisse_manager.sql`, rouverte pour
//        étendre deux signatures : un contenu qui bouge à l'intérieur d'une
//        migration déjà estampillée ne se voit QUE par cette empreinte, pas
//        par le compteur.
//   ───
//    279
//
// 243 + 21 = 264 aurait été le chiffre déduit, et il aurait été faux : c'est
// précisément pourquoi ce compteur se mesure.
//
// Les deux valeurs sont MESURÉES (`node
// .github/deploiement/empreinte-artefact.js --arbre-source=.`) : une mise à
// jour de ces constantes sans ajout correspondant dans `supabase/migrations/`
// serait un aveu.
const MIGRATIONS_REELLES_NOMBRE = 279;
const MIGRATIONS_REELLES_EMPREINTE = '9a2ff308105bae27722d074f2b127b9212ac1a7f4424a07a44c7cbb9a3051168';

cas(`Réel · la provenance des migrations annonce ${MIGRATIONS_REELLES_NOMBRE} et garde son empreinte`, () => {
  const { code, sortie } = lancer([`--racine=${arbre({ ...BASE })}`, `--arbre-source=${RACINE_DEPOT}`]);
  assert.strictEqual(code, 0, `la provenance de l'arbre réel a échoué.\n${sortie}`);
  assert.ok(sortie.includes(`migrations_source_nombre   : ${MIGRATIONS_REELLES_NOMBRE}`),
    `l'inventaire réel n'annonce plus ${MIGRATIONS_REELLES_NOMBRE} migrations :\n${sortie}`);
  assert.ok(sortie.includes(`migrations_source_empreinte: ${MIGRATIONS_REELLES_EMPREINTE}`),
    `l'empreinte des migrations réelles a changé :\n${sortie}`);
});

// ── Verdict ────────────────────────────────────────────────────────────────
fs.rmSync(BAC, { recursive: true, force: true });
console.log(`\n\n${total - echecs.length}/${total} contrôles passent.`);
if (echecs.length) {
  console.log(`\n${echecs.length} en échec :`);
  for (const e of echecs) console.log(`  ${e}`);
  process.exit(1);
}
