// FAST TRACK MÉTIER — colonne RENFORT du tableau des recettes importée dans Verify.
// Règle : Q1 retenu, Q2 ignoré et dit, cellule vide sans aucun effet, jamais de salarié créé.
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
let n = 0;
const verifier = (m, c) => { assert.ok(c, m); n++; console.log('OK   ' + m); };
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Verify-v1.html'), 'utf8');
const ctx = {}; ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-verify-moteur.js'), 'utf8'), ctx);
const R = ctx.NexusVerifyMoteur.renfortDepuisCellule;

// 1. la règle
verifier('Q1 : le nom est retenu', JSON.stringify(R('Angélique', '1').noms) === '["Angélique"]');
verifier('Q2 : rien retenu, et le motif est dit', R('Angélique', '2').noms.length === 0 && R('Angélique', '2').ignore === 'quart_2');
verifier('cellule vide, espaces, null, undefined : aucun effet, aucun motif',
  ['', '   ', null, undefined].every(v => R(v, '1').noms.length === 0 && R(v, '1').ignore === null));
verifier('cellule vide en Q2 : rien non plus, sans motif d’ignorance',
  R('', '2').noms.length === 0 && R('', '2').ignore === null);
verifier('plusieurs noms séparés par , ; / + & et « et »',
  JSON.stringify(R('Ana, Bob; Cy / Di + Ed & Flo et Gus', '1').noms) === '["Ana","Bob","Cy","Di","Ed","Flo","Gus"]');
verifier('le marqueur « vérrouillée » du classeur réel n’est ni un nom ni un motif, en Q1 comme en Q2',
  ['vérrouillée', 'verrouillée', 'Vérouillée', ' VERROUILLEE '].every(v => ['1', '2'].every(q => R(v, q).noms.length === 0 && R(v, q).ignore === null)));
verifier('les prénoms seuls du classeur réel sont retenus en Q1 (Angelique, Loane, Ruddy, Samantha)',
  ['Angelique', 'Loane', 'Ruddy', 'Samantha'].every(v => R(v, '1').noms[0] === v));
verifier('un même nom répété n’est retenu qu’une fois (pas de double renfort)', R('Ana, ANA', '1').noms.length === 1);
verifier('le quart peut arriver en nombre', R('Ana', 1).noms.length === 1 && R('Ana', 2).noms.length === 0);

// 2. le câblage de l’import
const colonnes = html.match(/function trouverColonnes\(headerRow\) \{[\s\S]*?\n    \}\n/)[0];
const normaliserTexte = (v) => String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const trouverColonnes = new Function('normaliserTexte', colonnes + '; return trouverColonnes;')(normaliserTexte);
const c = trouverColonnes(['Date', 'QUART', 'POMPISTE', 'CAISSIER', 'RENFORT']);
verifier('l’en-tête RENFORT est reconnu', c.renfort === 4 && c.quart === 1 && c.pompiste === 2 && c.caissier === 3);
verifier('sans colonne RENFORT, rien ne change', trouverColonnes(['Date', 'QUART', 'POMPISTE']).renfort === undefined);
verifier('RENFORT n’écrase aucune colonne voisine', trouverColonnes(['RENFORT', 'QUART', 'POMPISTE']).quart === 1);
verifier('l’import ne crée aucun salarié pour un renfort',
  !/renfortLu\.noms\.forEach[\s\S]{0,300}trouverOuCreerEmploye/.test(html) && /renfortLu\.noms\.forEach[\s\S]{0,200}trouverEmployeParNom/.test(html));
verifier('un renfort inconnu est dit introuvable, jamais fabriqué',
  /const emp = trouverEmployeParNom\(nom\);\s*if \(emp\) \{ employesSelectionnes\.renfort\.add\(emp\.id\)[^\n]*\n\s*else messagesEmp\.push\(`Renfort : "\$\{nom\}" introuvable/.test(html));
verifier('sans la colonne déployée, le renfort lu n’est pas appliqué mais dit',
  /if \(!COLONNE_RENFORT_DISPONIBLE\) \{\s*messagesEmp\.push\(`Renfort : [^`]*non appliqué/.test(html));
verifier('l’aperçu montre le renfort Q1 et le motif d’un Q2 ignoré',
  /Renfort \(Q1, 7 h\)/.test(html) && /ignoré : le renfort ne s'applique qu'au quart 1/.test(html));
verifier('la règle vient du moteur, pas d’un test de quart recopié dans l’écran',
  /NexusVerifyMoteur\.renfortDepuisCellule\(g\('renfort'\), quartStr\)/.test(html));

// 3. le croisement renfort / poste le même jour (cas Ruddy, 02/10/2026) est dit à la synchro
const X = ctx.NexusVerifyMoteur.croisementsRenfortPoste;
const jourRuddy = [{ quart: '1', renfort: 'Ruddy', pompiste: 'Kecy', caissier: 'Angelique' }, { quart: '2', renfort: 'vérrouillée', pompiste: 'Ruddy', caissier: 'Samantha' }];
verifier('Ruddy renfort Q1 et pompiste Q2 : le croisement est rendu avec le poste et le quart',
  JSON.stringify(X(jourRuddy)) === '[{"nom":"Ruddy","poste":"pompiste","quartPoste":"2"}]');
verifier('même nom sans accent ni casse : croisement trouvé', X([{ quart: '1', renfort: 'ÉLODIE' }, { quart: '1', caissier: 'elodie' }]).length === 1);
verifier('renfort et caisse sur le même quart : croisement trouvé', X([{ quart: '1', renfort: 'Angelique', caissier: 'Angelique' }]).length === 1);
verifier('personnes différentes : aucun croisement', X([{ quart: '1', renfort: 'Loane', pompiste: 'Ruddy', caissier: 'Madeleine' }]).length === 0);
verifier('renfort inscrit au quart 2 (ignoré) : aucun croisement inventé', X([{ quart: '2', renfort: 'Ruddy', pompiste: 'Ruddy' }]).length === 0);
verifier('cellules vides ou jour vide : aucun croisement', X([{ quart: '1' }]).length === 0 && X([]).length === 0 && X(null).length === 0);
verifier('l’import lit les lignes du même jour, autre quart compris, et pousse le croisement dans l’aperçu ET le message',
  /croisementsRenfortPoste\(joursLignes\)/.test(html) && /croisements\.forEach\(c => previewChamps\.push/.test(html) && /croisements\.forEach\(c => messagesEmp\.push\(`À vérifier/.test(html));
verifier('le message dit que le renfort n’est pas additionné', /sans additionner le renfort/.test(html));
console.log('\n' + n + ' vérifications passées.');
