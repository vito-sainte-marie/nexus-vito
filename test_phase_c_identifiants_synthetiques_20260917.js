// Test — aucun identifiant réel dans les fichiers de la Phase C (17/09/2026)
//
// POURQUOI CE FICHIER EXISTE
//
// `supabase/phase-c/20260916230000_mutations_de_validation.sql` jouait ses
// treize mutations sous le jeton de deux employés RÉELS de `nexus-test` :
// leurs UUID y apparaissaient vingt et dix-huit fois, et l'un d'eux avait
// déjà essaimé dans une preuve versionnée. Le dépôt est public.
//
// Ce ne sont pas des secrets d'authentification — on ne se connecte avec
// aucun d'eux. Ce sont des identifiants pseudonymes PERSISTANTS : stables
// dans le temps, réutilisés par toutes les tables d'acteur, et corrélables
// à une personne dès qu'on dispose d'un autre extrait de la base. Les
// masquer dans la seule preuve n'aurait rien réglé, puisque le fichier
// source les portait vingt fois.
//
// La correction a remplacé ces deux comptes par des identités ENTIÈREMENT
// synthétiques, créées et démontées dans la transaction annulée. Ce fichier
// est ce qui empêche le retour en arrière : ni une réécriture distraite du
// SQL, ni une preuve fraîchement engendrée ne peuvent réintroduire un
// identifiant réel sans le faire rougir.
//
// CE QU'IL VÉRIFIE, ET COMMENT
//
// A. Tout UUID trouvé dans `supabase/phase-c/` — SQL, script, LISEZ-MOI et
//    preuves comprises — doit figurer dans la liste des fixtures déclarées
//    ci-dessous. Toute autre valeur est refusée, sans exception ni liste
//    d'exemptions : un dossier de recette n'a aucune raison de nommer un
//    identifiant qu'il n'a pas lui-même fabriqué.
//
// B. La liste déclarée elle-même est contrainte de FORME. Sans cela la
//    garde serait circulaire : il suffirait d'ajouter le vrai UUID à la
//    liste pour la faire taire. Une fixture doit être un « repdigit » —
//    un seul chiffre hexadécimal répété partout, aux variantes 4 et 8
//    près, imposées par la forme d'un UUID v4. Un identifiant réel ne peut
//    pas prendre cette forme : l'ajouter à la liste échoue ici même.
//
// C. Et comme une garde verte ne prouve rien tant qu'on n'a pas vu ce qui
//    la fait rougir (leçon des quatre gardes vertes et inutiles du 08/09),
//    la partie C lui soumet les deux UUID réellement retirés le 17/09/2026
//    — en contenu de fichier, puis en tentative d'ajout à la liste. Les
//    deux voies doivent être refusées.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DOSSIER = path.join(__dirname, 'supabase', 'phase-c');

// ─────────────────────────────────────────────────────────────────────────
// Les fixtures synthétiques. Toute valeur ajoutée ici doit passer la
// contrainte de forme de la partie B — c'est ce qui rend la liste
// inutilisable pour blanchir un identifiant réel.
// ─────────────────────────────────────────────────────────────────────────
const FIXTURES = [
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', // employé synthétique
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', // manager synthétique
  '11111111-1111-4111-8111-111111111111', // quart employé, brouillon
  '22222222-2222-4222-8222-222222222222', // quart manager, brouillon
  '33333333-3333-4333-8333-333333333333', // caisse du quart 1111
  '44444444-4444-4444-8444-444444444444', // caisse du quart 2222
  '55555555-5555-4555-8555-555555555555', // quart sans caisse
  '66666666-6666-4666-8666-666666666666', // quart clôturé
  '77777777-7777-4777-8777-777777777777', // caisse validée du 6666
  '88888888-8888-4888-8888-888888888888', // jeu de recette
  '99999999-9999-4999-8999-999999999999', // emplacement de caisse
];

// Un chiffre hexadécimal, répété partout : 8-4-4-4-12, avec le `4` de
// version et le `8` de variante aux places imposées.
const FORME_FIXTURE = /^([0-9a-f])\1{7}-\1{4}-4\1{3}-8\1{3}-\1{12}$/;
const UUID_QUELCONQUE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;

function fichiersDe(dossier) {
  const sortie = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) sortie.push(...fichiersDe(p));
    else if (e.isFile()) sortie.push(p);
  }
  return sortie.sort();
}

// Rend la liste des UUID d'un texte qui ne sont pas dans `autorises`.
function intrus(texte, autorises) {
  const vus = new Set();
  for (const u of texte.match(UUID_QUELCONQUE) || []) {
    if (!autorises.has(u.toLowerCase())) vus.add(u);
  }
  return [...vus];
}

// ─────────────────────────────────────────────────────────────────────────
// B — la liste déclarée, avant de s'en servir.
//
// L'ordre compte : contrôler la forme AVANT de l'utiliser comme critère
// d'autorisation. Une liste contrôlée après coup n'aurait jamais empêché
// l'ajout qu'elle est censée interdire.
// ─────────────────────────────────────────────────────────────────────────
const malFormees = FIXTURES.filter(u => !FORME_FIXTURE.test(u));
assert.deepStrictEqual(malFormees, [],
  'Une fixture déclarée n\'a pas la forme « un seul chiffre hexadécimal répété ».\n'
  + 'Ce n\'est donc pas une valeur fabriquée pour la recette, et la liste ne peut\n'
  + 'pas l\'autoriser :\n  ' + malFormees.join('\n  '));

assert.strictEqual(new Set(FIXTURES).size, FIXTURES.length,
  'Doublon dans la liste des fixtures déclarées.');
console.log(`OK — les ${FIXTURES.length} fixtures déclarées sont toutes synthétiques par construction.`);

const AUTORISES = new Set(FIXTURES.map(u => u.toLowerCase()));

// ─────────────────────────────────────────────────────────────────────────
// A — le contenu du dossier.
// ─────────────────────────────────────────────────────────────────────────
const fichiers = fichiersDe(DOSSIER);
assert.ok(fichiers.length > 0, `Aucun fichier sous ${DOSSIER} : la garde ne garde rien.`);

const fautifs = [];
const rencontres = new Set();
for (const f of fichiers) {
  const texte = fs.readFileSync(f, 'utf8');
  for (const u of texte.match(UUID_QUELCONQUE) || []) rencontres.add(u.toLowerCase());
  const mauvais = intrus(texte, AUTORISES);
  if (mauvais.length) {
    fautifs.push(`${path.relative(__dirname, f)} : ${mauvais.join(', ')}`);
  }
}
assert.deepStrictEqual(fautifs, [],
  'UUID non déclaré dans supabase/phase-c/. Le dépôt est public : un identifiant\n'
  + 'd\'employé réel y est une donnée à caractère personnel, même sans nom ni\n'
  + 'courriel. Utiliser une fixture synthétique, ou retirer la valeur :\n  '
  + fautifs.join('\n  '));
console.log(`OK — les ${fichiers.length} fichiers de supabase/phase-c/ ne portent que des UUID déclarés.`);

// Une liste d'autorisation qui déclare plus que ce que le dossier contient
// finit par autoriser des choses que personne ne relit.
const jamaisVues = FIXTURES.filter(u => !rencontres.has(u));
assert.deepStrictEqual(jamaisVues, [],
  'Fixture déclarée mais absente du dossier : la liste doit décrire ce qui existe,\n'
  + 'pas ouvrir un droit d\'avance :\n  ' + jamaisVues.join('\n  '));
console.log(`OK — les ${FIXTURES.length} fixtures déclarées sont toutes réellement employées.`);

// ─────────────────────────────────────────────────────────────────────────
// C — ce qui doit la faire rougir.
//
// Les deux valeurs ci-dessous sont fabriquées pour ce test seul : ce ne
// sont NI les identifiants retirés du dossier le 17/09/2026, NI des
// identifiants d'aucune base — les réécrire ici, fût-ce pour éprouver la
// garde, reviendrait à les republier. Ce qui est éprouvé est leur FORME :
// un UUID v4 ordinaire, celle qu'a n'importe quel compte réel, et que la
// garde doit refuser des deux côtés.
// ─────────────────────────────────────────────────────────────────────────
const FORME_REELLE = [
  '0e5c2b7a-4f31-4d90-9c18-6a2be8f47d03',
  '7b41d9e6-2c58-4a1f-8e73-15d0c4b9a6f2',
];

for (const faux of FORME_REELLE) {
  assert.deepStrictEqual(
    intrus(`perform set_config('request.jwt.claims', '{"sub":"${faux}"}', true);`, AUTORISES),
    [faux],
    `La garde laisse passer un UUID d'apparence réelle dans un contenu de fichier : ${faux}`);

  assert.ok(!FORME_FIXTURE.test(faux),
    `La contrainte de forme accepterait ${faux} dans la liste des fixtures :\n`
    + 'il suffirait alors de déclarer un identifiant réel pour faire taire la garde.');
}
console.log(`OK — la garde refuse les ${FORME_REELLE.length} UUID d'apparence réelle, en contenu comme en déclaration.`);

console.log('Aucun identifiant réel dans la Phase C, et la liste des fixtures ne peut pas en blanchir un.');
