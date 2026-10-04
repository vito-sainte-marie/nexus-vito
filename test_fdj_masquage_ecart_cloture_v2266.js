// Test — v2.266 : rien n'est révélé à l'employé avant qu'il ait figé sa
// déclaration (28/08/2026, demande de Frédéric).
//
// Constat de Frédéric : "si l'employé voit son écart avant d'avoir figé sa
// déclaration, il peut rechercher la valeur attendue, modifier ses
// quantités jusqu'à obtenir un résultat satisfaisant, puis valider — NEXUS
// enregistrerait alors une caisse apparemment parfaite sans connaître la
// première déclaration."
//
// Vague 1 (17/09/2026) — cette règle est CONFIRMÉE par le mandat (§3.3 :
// « avant la première confirmation, aucun résultat présenté comme un écart
// établi »), mais deux choses ont changé autour d'elle :
//
//   • Le mot. « Clôturer » disparaît : l'employé CONFIRME et TRANSMET, il
//     ne clôture ni ne valide (§3.2, « L'employé ne "valide" jamais sa
//     caisse »). Les libellés attendus ici suivent ce renversement.
//   • Le lieu. Le masquage ne tient plus parce qu'un écran s'abstient
//     d'afficher une valeur qu'il a reçue : il tient parce que le SERVEUR
//     ne l'envoie pas (§4, « aucun champ sensible reçu dans le réseau puis
//     simplement masqué dans l'interface »). La partie B ne teste donc plus
//     pointDeClotureHTML — supprimée avec la révélation à la clôture —
//     mais la projection public.fdj_ma_caisse().
//
// Trois familles de vérifications :
//   A) Les écrans de SAISIE ne citent ni écart ni caisse attendue.
//   B) La projection serveur rend null avant confirmation, et seulement
//      après elle un écart nommé.
//   C) L'écran manager garde son vocabulaire à lui (non basculé en Vague 1).

const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync(__dirname + '/NEXUS-FDJ-v1.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  const debut = script.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable dans NEXUS-FDJ-v1.html`);
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j);
}

// ------------------------------------------------------------
// A) Statique — les fonctions de saisie ne révèlent rien.
// ------------------------------------------------------------
const srcCaisse = extraire('renderCaisse');
assert.ok(!srcCaisse.includes('renderCarteEcart'), 'renderCaisse() ne doit plus appeler renderCarteEcart (aperçu écart retiré)');
assert.ok(!srcCaisse.includes('ecartCaisse()'), 'renderCaisse() ne doit plus calculer/afficher l\'écart pendant la saisie');
console.log('OK — renderCaisse() : aucune trace d\'affichage de l\'écart.');

const srcResume = extraire('renderResume');
assert.ok(!srcResume.includes('renderCarteEcart'), 'renderResume() ne doit plus appeler renderCarteEcart');
assert.ok(!srcResume.includes('ecartCaisse()'), 'renderResume() ne doit plus calculer/afficher l\'écart avant confirmation');
assert.ok(!srcResume.includes('caisseAttendue()'), 'renderResume() ne doit plus afficher la caisse attendue (permettrait de déduire l\'écart)');
assert.ok(srcResume.includes('CONFIRMER MA CAISSE ET LA TRANSMETTRE'),
  'Le bouton dit ce qu\'il fait : confirmer et transmettre, jamais clôturer ni valider (§3.2)');
assert.ok(!/CL[ÔO]TURER MA CAISSE/.test(srcResume),
  'Le verbe "clôturer" ne doit plus apparaître dans l\'action de l\'employé (§3.2)');
console.log('OK — renderResume() : ni écart ni caisse attendue, action "confirmer et transmettre".');

const srcModale = extraire('demanderConfirmationCloture');
assert.ok(!srcModale.includes('Écart constaté'), 'La modale ne doit pas révéler l\'écart');
assert.ok(!srcModale.includes('cloture-ecart-valeur'), 'La ligne d\'écart de la modale doit rester absente');
assert.ok(srcModale.includes('Confirmer ma caisse et la transmettre au manager'),
  'Le bouton de la modale porte l\'intitulé exact du §3.2');

// Le texte de la modale vit dans une constante, hors de la fonction de rendu :
// une phrase affichée à l'employé est une donnée, écrite une fois (Article 11).
// C'est donc elle qu'on vérifie, pas une chaîne recopiée dans un template.
const msgModale = script.slice(
  script.indexOf('const messageConfirmationCloture'),
  script.indexOf('function demanderConfirmationCloture'));
assert.ok(/corriger votre saisie/i.test(msgModale),
  'La modale doit dire que la correction reste possible tant que le manager n\'a pas contrôlé (§3.4) : '
  + 'confirmer n\'est pas un point de non-retour, et le lui cacher pousserait à retoucher avant de confirmer');
assert.ok(!/ne pourrez plus la modifier/.test(msgModale),
  'L\'ancienne promesse inverse (« vous ne pourrez plus la modifier vous-même ») contredisait le §3.4');
assert.ok(/cette preuve ne sera jamais remplacée/i.test(msgModale),
  'Ce qui est figé, c\'est la PREUVE de la première confirmation, pas la saisie (§3.2)');
console.log('OK — modale de confirmation : aveugle sur l\'écart, honnête sur la suite.');

// ------------------------------------------------------------
// B) La projection serveur — ce que l'employé REÇOIT, pas ce qu'on lui
//    montre. Lecture du SQL, commentaires retirés : un commentaire qui
//    énumère les champs absents ne doit pas faire passer le test.
//
//    Limite assumée : ce contrôle lit du texte, il n'exécute pas la
//    fonction. Il constate une intention, pas un refus. La preuve
//    exécutée vit dans supabase/phase-c/20260916230000_mutations_de_
//    validation.sql, rejouée sur nexus-test.
// ------------------------------------------------------------
const sqlBrut = fs.readFileSync(__dirname + '/supabase/migrations/20260916220800_fdj_projection_employe.sql', 'utf8');
const sql = sqlBrut.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');

const iA = sql.indexOf("if v_etape in ('saisie_a_commencer', 'brouillon') then");
const iBC = sql.indexOf('return jsonb_build_object(', sql.indexOf('end if;', iA));
assert.ok(iA !== -1 && iBC !== -1, 'Les deux branches de fdj_ma_caisse() doivent rester identifiables');
const brancheAvant = sql.slice(iA, iBC);
const brancheApres = sql.slice(iBC, sql.indexOf('$$;', iBC));

for (const attendu of ["'ecart_etabli', false", "'ecart_provisoire', null", "'libelle_ecart', null"]) {
  assert.ok(brancheAvant.includes(attendu),
    `Avant confirmation, la projection doit rendre ${attendu} — et non une valeur que l'écran masquerait`);
}
assert.ok(!brancheAvant.includes('fdj_libelle_ecart_employe'),
  'Aucun libellé d\'écart n\'est composé avant la confirmation : il n\'y a rien à nommer');
// Une CLÉ nommée « ecart » — donc précédée d'une virgule ou d'une parenthèse
// d'argument, et non d'un « -> » qui désigne une lecture interne. Le calcul de
// travail a le droit d'exister ; c'est son NOM rendu à l'employé qui est réglementé.
assert.ok(!/[(,]\s*'ecart'\s*,/.test(brancheAvant),
  'Avant confirmation, aucune clé nommée « ecart » : les montants de travail sortent sous aide_a_la_saisie');
assert.ok(brancheAvant.includes('total_attendu') && brancheAvant.includes('difference_de_comptage'),
  'L\'aide à la saisie reste fournie — sans elle l\'employé ne peut pas compter (contradiction §3.3 / utilisabilité, '
  + 'arbitrée par le renommage plutôt que par la privation)');
console.log('OK — projection, avant confirmation : aucun écart établi, seulement une aide au comptage.');

assert.ok(brancheApres.includes("'ecart_etabli', true"), 'Après confirmation, l\'écart est établi');
assert.ok(brancheApres.includes("'ecart_provisoire', case when v_valide then null else v_cash.ecart end"),
  'L\'écart est PROVISOIRE tant que le manager n\'a pas validé (§3.3)');
assert.ok(brancheApres.includes("'ecart_retenu',     case when v_valide then v_cash.ecart else null end"),
  'Il ne devient RETENU qu\'après validation manager (§4)');
assert.ok(brancheApres.includes("'confirmation_initiale'"),
  'La première confirmation reste rendue à côté de la valeur courante (§3.2 : preuve non écrasable)');
for (const champ of ['motif_ecart_texte', 'valide_par', 'controle_par', 'resultat_controle']) {
  assert.ok(!brancheApres.includes(champ),
    `${champ} ne doit jamais sortir dans la projection employé (§4) — masquer côté écran ne suffirait pas`);
}
console.log('OK — projection, après confirmation : écart provisoire puis retenu, sans champ du manager.');

// ------------------------------------------------------------
// C) Statique — vocabulaire manager à trois niveaux (NEXUS-FDJ-Manager-v1.html).
//    "Personne ne valide sa propre caisse" : EMPLOYÉ confirme, MANAGER
//    contrôle, NEXUS certifie. Cet écran n'est volontairement PAS basculé en
//    Vague 1 (le mandat porte sur le parcours employé) : ses libellés sont
//    donc vérifiés tels quels, sans changement.
// ------------------------------------------------------------
const htmlManager = fs.readFileSync(__dirname + '/NEXUS-FDJ-Manager-v1.html', 'utf8');
const scriptManager = htmlManager.match(/<script>([\s\S]*)<\/script>/)[1];

function extraireManager(nomFonction) {
  const debut = scriptManager.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable dans NEXUS-FDJ-Manager-v1.html`);
  let i = scriptManager.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (scriptManager[j] === '{') profondeur++;
    else if (scriptManager[j] === '}') profondeur--;
    j++;
  }
  return scriptManager.slice(debut, j);
}

const srcRenderEdition = extraireManager('renderEdition');
assert.ok(srcRenderEdition.includes("'Contrôler la clôture'"), 'Le titre doit rester "Contrôler la clôture" pour un quart existant');
assert.ok(srcRenderEdition.includes("'Certifier le contrôle'"), 'Le bouton doit rester "Certifier le contrôle" pour un quart existant');
assert.ok(srcRenderEdition.includes("'Nouveau quart FDJ'"), 'La création directe manager (pouvoir total, sans confirmation employé) reste un cas distinct');
assert.ok(!srcRenderEdition.includes('Modifier ce quart FDJ'), 'L\'ancien libellé générique ne doit plus être affiché');
assert.ok(!srcRenderEdition.includes('Valider le contrôle du quart'), 'L\'ancien libellé de bouton ne doit plus être affiché');
console.log('OK — NEXUS-FDJ-Manager-v1.html : vocabulaire "Contrôler la clôture" / "Certifier le contrôle" en place.');

console.log('Tous les tests de non-révélation avant confirmation (v2.266) passent.');
