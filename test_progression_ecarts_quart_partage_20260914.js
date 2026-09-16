// Test — regle du quart partage, arbitrage du 14/09/2026.
// Reecrit le 16/09/2026 pour le lot « projection mes_ecarts_caisse ».
//
// LE DEFAUT D'ORIGINE. NEXUS-Mon-Evolution-v1.html lisait `audits_caisse`,
// gardait toute ligne ou l'employe figurait dans `employes_piste` /
// `employes_boutique`, et additionnait l'ecart correspondant dans « Ecart
// cumule du mois ». Un quart tenu a deux produisait donc, sur l'ecran
// personnel de CHACUN, le montant entier de l'ecart — presente comme le sien.
// NEXUS Progression, lui, ne comptait que les postes tenus seul(e) depuis le
// 27/07/2026 : deux ecrans, deux verites, et celle de Mon Evolution accusait
// sans preuve.
//
// LA REGLE (Frederic, 14/09/2026). Le planning determine la personne
// ATTENDUE ; la prise de poste et la passation determinent la personne
// RESPONSABLE. Quand un quart comporte plusieurs detenteurs successifs de la
// meme caisse, chaque responsabilite doit etre isolee par un COMPTAGE DE
// PASSATION. Sans comptage intermediaire, l'ecart demeure rattache au quart
// partage et necessite un ARBITRAGE MANAGER. Aucune attribution individuelle
// ni repartition automatique sans preuve. Le remplacement en cours de quart
// etant extremement rare aujourd'hui, le comptage n'est pas demande : le
// quart partage est NOTIFIE, pas chiffre contre la personne.
//
// CE QUI A CHANGE LE 16/09/2026, ET POURQUOI CE FICHIER EST REECRIT.
// `mes_ecarts_caisse()` remplace la lecture directe d'`audits_caisse` pour
// les trois ecrans employes. L'ecran ne recoit donc plus de lignes de quart a
// filtrer : il recoit UNE LIGNE PAR POSTE QU'IL A TENU, avec `poste_partage`
// deja calcule par le serveur. La version precedente de cette epreuve jouait
// l'ecran contre `from('audits_caisse')` : ce chemin n'existe plus cote
// employe, et le laisser ici aurait fait passer une epreuve qui ne mesurait
// plus rien de reel.
//
// CE QUE CETTE EPREUVE MORD. Une garde qui lirait le source ne mordrait pas
// (08/09/2026 : trois mutations sur quatre survivaient a une detection
// statique). Elle EXECUTE donc trois niveaux :
//   1. le moteur — `nexus-progression.js`, ou la regle vit ;
//   2. la source — `nexus-caisse-source.js`, le vrai module, non simule ;
//   3. la fonction REELLE de l'ecran — `chargerEcartsCaisse` est extraite du
//      HTML et rejouee contre un faux client Supabase et un faux DOM. Si
//      quelqu'un remet l'addition des quarts partages dans le cumul, ou
//      reintroduit un calcul local au lieu d'appeler le moteur, le cumul
//      mesure change et l'epreuve tombe. Si quelqu'un rouvre la lecture
//      directe d'`audits_caisse`, le faux client leve.

global.window = global;
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const DIR = __dirname;
require(path.join(DIR, 'nexus-ecarts-moteur.js'));
require(path.join(DIR, 'nexus-progression.js'));
require(path.join(DIR, 'nexus-caisse-source.js'));
const P = global.NexusProgression;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// Decor commun. Claire tient la piste seule le 03 (-12,50 €), partage la
// piste avec Malik le 05 (-40,00 €), partage un quart conforme le 07
// (-1,00 €, sous SEUIL_ECART_CONFORME = 2 €) et tient la boutique seule le 11
// pour -0,80 € — un ecart REEL mais conforme, present expres : il fait la
// difference entre « solde du mois » et « liste de points d'attention ».
// ------------------------------------------------------------
const CLAIRE = 'claire-0000-0000-0000-000000000001';
const MALIK  = 'malik-0000-0000-0000-000000000002';

// (1) Lignes brutes d'`audits_caisse` — ce que voit encore un MANAGER qui
// consulte la progression de quelqu'un d'autre.
const ROWS_BRUTS = [
  { id: 'r1', date: '2026-09-03', quart: '1', ecart_piste: -12.50, ecart_boutique: null,
    employes_piste: [CLAIRE], employes_boutique: [] },
  { id: 'r2', date: '2026-09-05', quart: '2', ecart_piste: -40.00, ecart_boutique: null,
    employes_piste: [CLAIRE, MALIK], employes_boutique: [] },
  { id: 'r3', date: '2026-09-07', quart: '1', ecart_piste: -1.00, ecart_boutique: null,
    employes_piste: [CLAIRE, MALIK], employes_boutique: [] },
  { id: 'r4', date: '2026-09-09', quart: '2', ecart_piste: null, ecart_boutique: -87.30,
    employes_piste: [], employes_boutique: [MALIK] },
  { id: 'r5', date: '2026-09-11', quart: '1', ecart_piste: null, ecart_boutique: -0.80,
    employes_piste: [], employes_boutique: [CLAIRE] },
];

// (2) Ce que `mes_ecarts_caisse()` rend a Claire : une ligne par poste TENU.
// Le quart du 09 n'y figure pas du tout — ce n'est plus l'ecran qui l'ecarte,
// c'est le serveur qui ne l'envoie pas. C'est la difference entre « masque a
// l'affichage » et « jamais parti sur le reseau ».
const PROJECTION_CLAIRE = [
  { audit_id: 'r1', date: '2026-09-03', quart: '1', poste: 'piste',
    ecart: -12.50, poste_partage: false, nb_detenteurs: 1 },
  { audit_id: 'r2', date: '2026-09-05', quart: '2', poste: 'piste',
    ecart: -40.00, poste_partage: true, nb_detenteurs: 2 },
  { audit_id: 'r3', date: '2026-09-07', quart: '1', poste: 'piste',
    ecart: -1.00, poste_partage: true, nb_detenteurs: 2 },
  { audit_id: 'r5', date: '2026-09-11', quart: '1', poste: 'boutique',
    ecart: -0.80, poste_partage: false, nb_detenteurs: 1 },
];

// ------------------------------------------------------------
// 1) Le moteur, par le chemin manager (lignes brutes)
// ------------------------------------------------------------
const servicesClaire = P.construireServicesCaisse(ROWS_BRUTS, CLAIRE);
assert.strictEqual(servicesClaire.length, 4, 'Claire figure sur quatre quarts');
ok('construireServicesCaisse ne retient que les quarts ou la personne figure');

const attrib = P.ecartsAttribuables(servicesClaire);
assert.strictEqual(attrib.length, 1, 'un seul ecart attribuable hors seuil');
assert.strictEqual(attrib[0].date, '2026-09-03');
assert.strictEqual(attrib[0].montant, -12.50);
ok('ecartsAttribuables ne retient que le poste tenu seul(e), hors seuil');

const arbitrer = P.ecartsEnAttenteArbitrage(servicesClaire);
assert.strictEqual(arbitrer.length, 1, 'un seul quart partage hors seuil');
assert.strictEqual(arbitrer[0].date, '2026-09-05');
assert.strictEqual(arbitrer[0].montant, -40.00);
assert.strictEqual(arbitrer[0].partage, true);
ok('ecartsEnAttenteArbitrage retient le quart partage hors seuil, et lui seul');

// Le quart partage CONFORME n'est une accusation pour personne : il n'a rien
// a arbitrer. L'oublier gonflerait la notification sans raison.
assert.ok(!arbitrer.some(e => e.date === '2026-09-07'),
  'un quart partage conforme ne demande aucun arbitrage');
ok('un quart partage conforme ne part pas en arbitrage');

// L'invariant qui empeche le double comptage.
const cle = e => `${e.date}|${e.quart}|${e.poste}`;
const clesAttrib = new Set(attrib.map(cle));
assert.ok(arbitrer.every(e => !clesAttrib.has(cle(e))),
  'un meme poste ne peut pas etre a la fois attribuable et en arbitrage');
ok('les deux listes sont disjointes');

// Symetrie : Malik ne recupere pas non plus le quart partage.
const servicesMalik = P.construireServicesCaisse(ROWS_BRUTS, MALIK);
const attribMalik = P.ecartsAttribuables(servicesMalik);
assert.strictEqual(attribMalik.length, 1);
assert.strictEqual(attribMalik[0].montant, -87.30);
assert.ok(!attribMalik.some(e => e.date === '2026-09-05'),
  'le quart partage n\'est pas davantage attribue a l\'autre detenteur');
ok('aucune repartition automatique : le partage n\'est attribue a personne');

assert.ok(typeof P.MENTION_QUART_PARTAGE === 'string' && P.MENTION_QUART_PARTAGE.length > 20,
  'la phrase de notification vit dans le moteur');
ok('la mention du quart partage est dite par le moteur, pas par un ecran');

// ------------------------------------------------------------
// 2) Le moteur, par le chemin employe (projection). Les deux chemins doivent
//    conclure la MEME chose sur les quarts que Claire a tenus : c'est tout
//    l'interet d'avoir une seule regle.
// ------------------------------------------------------------
const servicesProjetes = P.construireServicesCaisseDepuisProjection(PROJECTION_CLAIRE);
const arbitrerProjetes = P.ecartsEnAttenteArbitrage(servicesProjetes);
assert.deepStrictEqual(arbitrerProjetes.map(cle), arbitrer.map(cle),
  'la projection et les lignes brutes doivent designer les memes arbitrages');
assert.deepStrictEqual(
  P.ecartsAttribuables(servicesProjetes).map(cle), attrib.map(cle),
  'la projection et les lignes brutes doivent attribuer les memes ecarts');
ok('projection et lignes brutes rendent le meme verdict sur les memes quarts');

// ------------------------------------------------------------
// 3) L'ecran, execute pour de vrai
// ------------------------------------------------------------
const HTML = fs.readFileSync(path.join(DIR, 'NEXUS-Mon-Evolution-v1.html'), 'utf8');

// L'ecran doit charger le moteur : sans cela il ne peut que redire la regle
// en dur, ce qui est exactement le defaut corrige ici.
assert.ok(/<script src="nexus-progression\.js/.test(HTML),
  'NEXUS-Mon-Evolution doit charger nexus-progression.js');
assert.ok(/<script src="nexus-ecarts-moteur\.js/.test(HTML),
  'NEXUS-Mon-Evolution doit charger nexus-ecarts-moteur.js, dont depend le moteur');
ok('l\'ecran charge le moteur qui porte la regle');

// Extraction de la fonction reelle (accolades equilibrees), puis execution.
function extraireFonction(source, entete) {
  const debut = source.indexOf(entete);
  assert.ok(debut !== -1, `fonction introuvable dans l'ecran : ${entete}`);
  let i = source.indexOf('{', debut), profondeur = 0;
  for (let k = i; k < source.length; k++) {
    if (source[k] === '{') profondeur++;
    else if (source[k] === '}') { profondeur--; if (profondeur === 0) return source.slice(debut, k + 1); }
  }
  throw new Error('accolades non equilibrees');
}
const SRC = extraireFonction(HTML, 'async function chargerEcartsCaisse()');

// `CUMUL_INDISPONIBLE` vit hors de la fonction : on le relit dans l'ecran
// plutot que d'en recopier la valeur ici — un second litteral serait une
// seconde verite. On verifie en revanche qu'il ne s'agit pas d'un montant :
// le remplacer par « 0.00 € » reintroduirait le faux resultat parfait.
const CUMUL_INDISPONIBLE = (HTML.match(/const CUMUL_INDISPONIBLE = '([^']*)';/) || [])[1];
assert.ok(typeof CUMUL_INDISPONIBLE === 'string' && CUMUL_INDISPONIBLE.length > 0,
  'CUMUL_INDISPONIBLE doit exister dans l\'ecran');
assert.ok(!/\d/.test(CUMUL_INDISPONIBLE),
  'un cumul indisponible ne doit pas s\'ecrire avec un chiffre');
ok('l\'absence de mesure ne s\'ecrit pas comme un montant');

function faussElement() {
  return { innerHTML: '', textContent: '', style: {} };
}

// Faux client. `rpc` sert la projection ; `from` LEVE : si quelqu'un rouvre
// la lecture directe d'`audits_caisse` depuis cet ecran employe, l'epreuve
// tombe au lieu de passer en silence.
function faussClientProjection(rows) {
  let nomAppele = null;
  const requete = {
    order: () => requete,
    gte: () => requete,
    range: (debut) => Promise.resolve({ data: debut === 0 ? rows : [], error: null }),
  };
  return {
    client: {
      rpc: nom => { nomAppele = nom; return requete; },
      from: table => {
        throw new Error(`l'ecran employe ne doit plus lire ${table} en clair`);
      },
    },
    nom: () => nomAppele,
  };
}

async function jouerEcran(rows) {
  const liste = faussElement(), cumul = faussElement();
  const faussDocument = { getElementById: id => (id === 'ecartsListe' ? liste : id === 'ecartCumule' ? cumul : faussElement()) };
  const faux = faussClientProjection(rows);
  const fabrique = new Function(
    'document', 'nexusClient', 'NexusCaisseSource', 'CUMUL_INDISPONIBLE',
    'classifierEcart', 'window', 'console',
    `${SRC}; return chargerEcartsCaisse;`
  );
  const fn = fabrique(faussDocument, faux.client, global.NexusCaisseSource,
    CUMUL_INDISPONIBLE, () => 'var(--red)', global.window, console);
  await fn();
  return { liste, cumul, source: faux.nom() };
}

(async () => {
  const vueClaire = await jouerEcran(PROJECTION_CLAIRE);

  assert.strictEqual(vueClaire.source, 'mes_ecarts_caisse',
    'l\'ecran doit passer par la projection, pas par la table');
  ok('l\'ecran lit mes_ecarts_caisse et rien d\'autre');

  // LE CŒUR. -13,30 € = -12,50 (piste, seule) + -0,80 (boutique, seule). Ni
  // -53,30 € — ce serait le quart partage rentre dans le cumul, le defaut
  // d'origine — ni -12,50 € — ce serait `ecartsAttribuables` employe comme
  // source du solde, qui ferait disparaitre les ecarts sous le seuil. Le
  // cumul est un SOLDE du mois, pas une liste de points d'attention.
  assert.strictEqual(vueClaire.cumul.textContent, '-13.30 €',
    `le cumul doit sommer tous les postes tenus seul(e) — obtenu ${vueClaire.cumul.textContent}`);
  ok('le cumul somme les postes tenus seul(e), conformes compris, et eux seuls');

  // Le quart partage est notifie, pas tu.
  assert.ok(vueClaire.liste.innerHTML.includes('-40.00 €'),
    'le quart partage doit rester visible');
  assert.ok(vueClaire.liste.innerHTML.includes('à arbitrer'),
    'le quart partage hors seuil doit etre marque « a arbitrer »');
  assert.ok(vueClaire.liste.innerHTML.includes(P.MENTION_QUART_PARTAGE),
    'la mention d\'arbitrage doit etre affichee sous la liste, avec les mots du moteur');
  ok('l\'ecran notifie le quart partage au lieu de l\'attribuer');

  // Le partage CONFORME est affiche hors cumul, mais sans badge : il n'appelle
  // aucun arbitrage. Un badge pose sur toutes les lignes partagees passerait
  // les assertions precedentes ; celle-ci l'interdit.
  const lignes = vueClaire.liste.innerHTML.split('<div class="ecart-row');
  const ligne07 = lignes.find(b => b.includes('07/09/2026'));
  assert.ok(ligne07, 'la ligne du 07/09 doit etre affichee');
  assert.ok(!ligne07.includes('à arbitrer'),
    'un quart partage conforme ne porte pas le badge « a arbitrer »');
  ok('le badge ne tombe que sur ce qui attend reellement un arbitrage');

  // L'ecart d'un collegue sur un quart ou Claire n'etait pas ne peut pas
  // apparaitre : il n'est jamais entre dans la reponse.
  assert.ok(!vueClaire.liste.innerHTML.includes('-87.30 €'),
    'l\'ecart d\'un collegue ne doit pas apparaitre');
  ok('aucun ecart de collegue sur l\'ecran personnel');

  // Quelqu'un qui n'a tenu que des quarts partages n'a pas un cumul a zero :
  // il n'a pas de cumul du tout. « 0,00 € » se lirait comme un mois parfait.
  const seulementPartage = PROJECTION_CLAIRE.filter(r => r.poste_partage);
  const vuePartage = await jouerEcran(seulementPartage);
  assert.strictEqual(vuePartage.cumul.textContent, CUMUL_INDISPONIBLE,
    'un mois entierement partage ne produit aucun cumul personnel');
  assert.ok(vuePartage.liste.innerHTML.includes('à arbitrer'),
    'le quart partage reste notifie meme quand il est seul');
  ok('un mois entierement partage : aucun cumul, notification conservee');

  // Aucun poste du tout : l'ecran le dit, sans chiffre invente.
  const vueVide = await jouerEcran([]);
  assert.strictEqual(vueVide.cumul.textContent, CUMUL_INDISPONIBLE);
  assert.ok(/Aucun contrôle de caisse enregistré/.test(vueVide.liste.innerHTML),
    'un mois sans controle doit le dire explicitement');
  ok('aucun controle : message explicite, jamais un chiffre invente');

  console.log(`\n${n} vérifications passées.`);
})().catch(e => { console.error('ÉCHEC —', e.message); process.exit(1); });
