// Test — aucun identifiant réel dans les recettes de la Vague 1 (17/09/2026)
//
// POURQUOI CE FICHIER EXISTE
//
// La garde sœur `test_phase_c_identifiants_synthetiques_20260917.js` couvre
// `supabase/phase-c/`. Elle a été écrite le 17/09/2026 après qu'on eut
// découvert deux employés RÉELS de `nexus-test` dans les mutations de la
// Phase C. On a cru le dossier clos.
//
// Il ne l'était pas. Les deux recettes de `supabase/recette-vague1/` — qui
// n'étaient pas dans le périmètre de cette première garde — portaient QUATRE
// comptes réels, et non deux : un caissier, un pompiste, un manager et un
// second manager créateur, plus deux emplacements FDJ réels. Soixante-seize
// occurrences au total, dans les deux `.sql` et dans une sortie publiée.
// Le dépôt est public. Ce ne sont pas des secrets d'authentification — on ne
// se connecte avec aucun d'eux — mais des identifiants pseudonymes
// PERSISTANTS : stables, réutilisés par toutes les tables d'acteur, et
// corrélables à une personne dès qu'on dispose d'un autre extrait de la base.
//
// La leçon du 17/09 est donc double : une garde ne protège que le répertoire
// qu'on lui a désigné, et un inventaire arrêté aux identifiants déjà connus
// ne mesure que ce qu'on savait déjà.
//
// CE QU'IL VÉRIFIE, ET COMMENT
//
// La différence avec la garde de la Phase C tient en une phrase : ICI, IL
// N'Y A AUCUNE LISTE. Pas de liste d'interdiction — y inscrire les quatre
// UUID retirés reviendrait à les republier dans le fichier même qui les
// bannit, et la garde ne verrait pas le cinquième. Pas de liste
// d'autorisation non plus — il suffirait d'y ajouter une valeur réelle pour
// la faire taire, et la Phase C ne s'en préserve que par une contrainte de
// forme posée sur sa propre liste.
//
// Le critère est donc la FORME SEULE, et elle est reconnaissable par
// construction :
//
//     <7 fois le même chiffre hex><1 hex>-0000-4000-8000-<11 fois le même><1 hex>
//
// Un identifiant fabriqué par `gen_random_uuid()` — c'est-à-dire tout compte
// réel — a une chance sur ~10^20 d'y répondre. La garde n'a pas besoin de
// savoir ce qu'elle refuse : tout ce qui n'est pas de cette forme est refusé,
// y compris les valeurs qu'on n'a pas encore rencontrées.
//
//   A — tout UUID du dossier est de cette forme.
//   B — le balayage a réellement eu lieu (fichiers, UUID, sorties).
//   C — les identités simulées dans les jetons JWT sont des fixtures.
//   D — le contrôle d'exécution embarqué dans les recettes n'a pas été retiré,
//       et il a laissé sa trace dans les sorties publiées.
//   E — aucune sortie orpheline, aucun chemin local dans le dossier.
//   F — l'auto-morsure : ce que la garde doit refuser, elle le refuse.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DOSSIER = path.join(__dirname, 'supabase', 'recette-vague1');
const REL = f => path.relative(__dirname, f);

// « Synthétique par construction » : un chiffre hexadécimal répété sept fois
// puis un discriminant, le milieu figé à `0000-4000-8000` (version 4,
// variante 8, mais avec des blocs qu'aucun générateur ne produit), puis onze
// fois le même chiffre et un second discriminant. Les discriminants
// permettent d'avoir plusieurs fixtures d'une même famille — quatre employés,
// deux emplacements — sans sortir de la forme.
const FORME_FIXTURE = /^([0-9a-f])\1{6}[0-9a-f]-0000-4000-8000-([0-9a-f])\2{10}[0-9a-f]$/;
const UUID_QUELCONQUE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
const SUB_JWT = /"sub"\s*:\s*"([^"]*)"/g;
// Un chemin absolu de poste de travail n'a rien à faire dans un dossier
// publié : la première sortie engendrée le 17/09 en portait un, dans le
// préfixe `psql:` de chaque NOTICE.
const CHEMIN_LOCAL = /(\/Users\/[A-Za-z0-9._-]+|\/private\/tmp\/[A-Za-z0-9._-]+|\/var\/folders\/[A-Za-z0-9._\/-]+)/g;

function fichiersDe(dossier) {
  const sortie = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) sortie.push(...fichiersDe(p));
    else if (e.isFile()) sortie.push(p);
  }
  return sortie.sort();
}

function uuidsDe(texte) {
  return [...new Set((texte.match(UUID_QUELCONQUE) || []).map(u => u.toLowerCase()))];
}

// Rend la liste des UUID d'un texte qui ne sont pas synthétiques par
// construction. C'est la seule fonction de décision de ce fichier : tout le
// reste ne fait que lui apporter du texte.
function intrus(texte) {
  return uuidsDe(texte).filter(u => !FORME_FIXTURE.test(u));
}

const fichiers = fichiersDe(DOSSIER);
assert.ok(fichiers.length > 0, `Aucun fichier sous ${REL(DOSSIER)} : la garde ne garde rien.`);

const lu = new Map(fichiers.map(f => [f, fs.readFileSync(f, 'utf8')]));

// ─────────────────────────────────────────────────────────────────────────
// A — tout UUID du dossier est synthétique par construction.
// ─────────────────────────────────────────────────────────────────────────
const fautifs = [];
for (const [f, texte] of lu) {
  const mauvais = intrus(texte);
  if (mauvais.length) fautifs.push(`${REL(f)} : ${mauvais.join(', ')}`);
}
assert.deepStrictEqual(fautifs, [],
  'UUID non synthétique dans supabase/recette-vague1/. Le dépôt est public :\n'
  + "l'identifiant d'un employé réel y est une donnée à caractère personnel,\n"
  + "même sans nom ni courriel — il suffit d'un second extrait de la base pour\n"
  + 'le rattacher à quelqu\'un. Fabriquer une fixture de la forme\n'
  + '  <7×X><d>-0000-4000-8000-<11×Y><d>\n'
  + 'et rejouer la recette pour régénérer sa sortie ; ne jamais corriger une\n'
  + 'sortie à la main. Valeurs refusées :\n  ' + fautifs.join('\n  '));

const tous = uuidsDe([...lu.values()].join('\n'));
console.log(`OK — les ${fichiers.length} fichiers de supabase/recette-vague1/ ne portent que des UUID synthétiques (${tous.length} distincts).`);

// ─────────────────────────────────────────────────────────────────────────
// B — le balayage a réellement eu lieu.
//
// Une garde de forme est verte quand elle ne trouve rien à examiner. Les
// quatre fichiers porteurs sont donc nommés, et un plancher est posé sur le
// nombre d'UUID vus : un dossier vidé, un `.sortie.txt` tronqué ou un
// scanner cassé deviennent rouges au lieu de devenir silencieux.
// ─────────────────────────────────────────────────────────────────────────
const PORTEURS = [
  '20260917_preuves_cycle_caisse.sql',
  '20260917_preuves_cycle_caisse.sortie.txt',
  '20260917_preuves_livrets_et_historique.sql',
  '20260917_preuves_livrets_et_historique.sortie.txt',
];
const sansUuid = PORTEURS.filter(n => {
  const p = path.join(DOSSIER, n);
  return !lu.has(p) || uuidsDe(lu.get(p)).length === 0;
});
assert.deepStrictEqual(sansUuid, [],
  'Fichier de recette absent, ou ne portant plus aucun UUID : le balayage de la\n'
  + "partie A n'a alors rien examiné et sa lumière verte ne veut rien dire :\n  "
  + sansUuid.join('\n  '));

const PLANCHER_UUID = 30;
assert.ok(tous.length >= PLANCHER_UUID,
  `Seulement ${tous.length} UUID distincts vus dans le dossier, contre ${PLANCHER_UUID} attendus\n`
  + 'au minimum. Soit les recettes ont beaucoup maigri, soit la reconnaissance\n'
  + 'des UUID est cassée — dans les deux cas la partie A ne garde plus rien.');
console.log(`OK — les ${PORTEURS.length} fichiers porteurs sont là et le balayage a vu ${tous.length} UUID distincts.`);

// ─────────────────────────────────────────────────────────────────────────
// C — les identités simulées.
//
// La recette du cycle de caisse rejoue le rôle `authenticated` en posant
// elle-même le jeton : `set_config('request.jwt.claims', '{"sub":"…"}')`.
// C'est le champ par lequel un identifiant réel était entré, et c'est celui
// qu'une relecture distraite rétablirait en premier — « juste pour vérifier
// avec un vrai compte ». Il est donc contrôlé nommément, en plus du balayage
// général : un `sub` qui ne serait pas un UUID du tout échapperait à A.
// ─────────────────────────────────────────────────────────────────────────
const subs = [];
for (const [f, texte] of lu) {
  for (const m of texte.matchAll(SUB_JWT)) subs.push({ f, v: m[1] });
}
const subsFautifs = subs.filter(s => !FORME_FIXTURE.test(s.v.toLowerCase()));
assert.deepStrictEqual(subsFautifs.map(s => `${REL(s.f)} : "${s.v}"`), [],
  "Le sujet d'un jeton JWT simulé n'est pas une fixture synthétique. La recette\n"
  + "prétendrait alors agir au nom d'une personne réelle :\n  "
  + subsFautifs.map(s => `${REL(s.f)} : "${s.v}"`).join('\n  '));

const PLANCHER_SUB = 8;
assert.ok(subs.length >= PLANCHER_SUB,
  `Seulement ${subs.length} jeton(s) JWT simulé(s) trouvé(s), contre ${PLANCHER_SUB} attendus au\n`
  + "minimum. La recette du cycle de caisse ne rejoue plus le rôle `authenticated`,\n"
  + "ou bien la reconnaissance du champ `sub` est cassée : ce contrôle ne garde\n"
  + 'plus rien.');
const identites = new Set(subs.map(s => s.v.toLowerCase()));
console.log(`OK — les ${subs.length} jetons JWT simulés portent ${identites.size} identités, toutes synthétiques.`);

// ─────────────────────────────────────────────────────────────────────────
// D — le contrôle embarqué n'a pas été retiré.
//
// Les deux recettes se contrôlent elles-mêmes à l'exécution : un balayage
// d'identité avant le `rollback` — qui exige d'abord de tourner sous
// `postgres`, faute de quoi la RLS le rendrait aveugle et vert — puis un
// balayage des 410 colonnes `uuid` du schéma APRÈS le `rollback`, pour
// établir qu'aucune fixture ne subsiste.
//
// Rien de tout cela n'est vérifiable sans base, et la CI n'en a pas. Ce qui
// l'est : que les blocs soient toujours là, et surtout qu'ils aient laissé
// leur trace dans la sortie PUBLIÉE. Un `NOTICE` absent de la sortie signe
// une recette rejouée sans son contrôle — ou une sortie retouchée à la main.
// ─────────────────────────────────────────────────────────────────────────
const ANCRES_SQL = [
  'reset role;',
  'IDENTITE : le controle tourne sous le role',
  'IDENTITE OK :',
  'POST-ROLLBACK OK :',
  'if cols < 100 then',
  '0000-4000-8000-([0-9a-f])',
];
const ANCRES_SORTIE = ['IDENTITE OK :', 'POST-ROLLBACK OK :'];

const manquantes = [];
for (const n of PORTEURS) {
  const p = path.join(DOSSIER, n);
  const texte = lu.get(p) || '';
  for (const a of (n.endsWith('.sql') ? ANCRES_SQL : ANCRES_SORTIE)) {
    if (!texte.includes(a)) manquantes.push(`${n} : « ${a} »`);
  }
}
assert.deepStrictEqual(manquantes, [],
  "Le contrôle d'identité embarqué a disparu d'une recette, ou sa trace a disparu\n"
  + "de la sortie publiée. Une recette qui ne se contrôle plus ne prouve plus rien,\n"
  + 'et une sortie sans le `NOTICE` du contrôle a été rejouée sans lui ou retouchée\n'
  + 'à la main :\n  ' + manquantes.join('\n  '));
console.log(`OK — les ${ANCRES_SQL.length} ancres du contrôle d'identité sont dans les deux recettes, et leur trace dans les deux sorties.`);

// ─────────────────────────────────────────────────────────────────────────
// E — pas de sortie orpheline, pas de chemin local.
//
// Une `.sortie.txt` dont le `.sql` a disparu est une preuve caduque : elle
// atteste d'un fichier qui n'existe plus, et personne ne peut la rejouer.
// C'est exactement ce qu'il fallait retirer le 17/09.
// ─────────────────────────────────────────────────────────────────────────
const orphelines = fichiers
  .filter(f => f.endsWith('.sortie.txt'))
  .filter(f => !fs.existsSync(f.replace(/\.sortie\.txt$/, '.sql')))
  .map(REL);
assert.deepStrictEqual(orphelines, [],
  'Sortie sans recette : cette preuve atteste un fichier qui n\'existe plus et\n'
  + 'personne ne peut la rejouer. La retirer :\n  ' + orphelines.join('\n  '));

const fuites = [];
for (const [f, texte] of lu) {
  const m = [...new Set(texte.match(CHEMIN_LOCAL) || [])];
  if (m.length) fuites.push(`${REL(f)} : ${m.join(', ')}`);
}
assert.deepStrictEqual(fuites, [],
  "Chemin absolu d'un poste de travail dans un dossier publié. La première sortie\n"
  + "engendrée le 17/09 en portait un dans le préfixe `psql:` de ses NOTICE : rejouer\n"
  + "depuis un répertoire de travail et passer un chemin relatif à `-f`, plutôt que de\n"
  + 'raboter la sortie :\n  ' + fuites.join('\n  '));
console.log(`OK — aucune sortie orpheline, aucun chemin de poste de travail dans les ${fichiers.length} fichiers.`);

// ─────────────────────────────────────────────────────────────────────────
// F — l'auto-morsure.
//
// Une garde verte ne prouve rien tant qu'on n'a pas vu ce qui la fait rougir
// (leçon des quatre gardes vertes et inutiles du 08/09). Les valeurs
// ci-dessous sont fabriquées pour ce test seul : ce ne sont NI les quatre
// identifiants retirés le 17/09/2026, NI des identifiants d'aucune base — les
// réécrire ici, fût-ce pour éprouver la garde, reviendrait à les republier
// dans le fichier chargé de les bannir. Ce qui est éprouvé est leur FORME.
//
// Les deux dernières sont le vrai piège : une valeur qui emprunte le début
// d'une fixture, ou son milieu et sa fin. Une garde écrite en « commence par
// 0000000 » ou en « contient -0000-4000-8000- » les laisserait passer.
// ─────────────────────────────────────────────────────────────────────────
const DOIVENT_ROUGIR = [
  ['0e5c2b7a-4f31-4d90-9c18-6a2be8f47d03', 'UUID v4 ordinaire, celui de n\'importe quel compte'],
  ['7b41d9e6-2c58-4a1f-8e73-15d0c4b9a6f2', 'idem, second exemplaire'],
  ['00000001-0000-4000-8000-a1b2c3d4e5f6', 'début de fixture, fin quelconque'],
  ['0e5c2b7a-0000-4000-8000-000000000001', 'milieu et fin de fixture, début quelconque'],
  ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'fixture de la Phase C : synthétique là-bas, pas de cette construction-ci'],
];
for (const [faux, pourquoi] of DOIVENT_ROUGIR) {
  assert.ok(!FORME_FIXTURE.test(faux),
    `La contrainte de forme accepte ${faux} (${pourquoi}) : elle ne distingue plus\n`
    + 'une fixture fabriquée pour la recette d\'un identifiant venu de la base.');
  assert.deepStrictEqual(
    intrus(`perform set_config('request.jwt.claims', '{"sub":"${faux}"}', true);`),
    [faux],
    `La garde laisse passer ${faux} (${pourquoi}) dans un contenu de fichier.`);
}

// Et le contraire : une garde qui refuserait tout serait rouge en partie A,
// donc jamais verte — mais elle pourrait le devenir sur un dossier vide. On
// vérifie donc aussi qu'une fixture régulièrement construite est bien admise.
const DOIT_PASSER = 'fffffff7-0000-4000-8000-33333333333c';
assert.deepStrictEqual(intrus(`insert into public.employees (id) values ('${DOIT_PASSER}');`), [],
  `La garde refuse ${DOIT_PASSER}, qui est pourtant construit selon la règle :\n`
  + 'aucune fixture ne serait plus admissible et le dossier deviendrait inécrivable.');

// Le champ `sub` d'un jeton, lui, doit rougir même sur ce qui n'est pas un
// UUID : la partie A ne verrait rien à examiner dans un nom d'utilisateur.
assert.ok(!FORME_FIXTURE.test('recette-vague1-employe-a'),
  "Un `sub` qui n'est pas un UUID doit être refusé par la partie C : sans cela,\n"
  + "il suffirait d'écrire un identifiant réel sous une autre forme.");

console.log(`OK — la garde refuse les ${DOIVENT_ROUGIR.length} formes d'emprunt éprouvées, et admet une fixture régulière.`);

console.log('Aucun identifiant réel dans les recettes de la Vague 1, et aucune liste ne peut en blanchir un.');
