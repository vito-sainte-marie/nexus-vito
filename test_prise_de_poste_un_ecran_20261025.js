// Prise de poste en un écran (lot PRISE-DE-POSTE-UN-ECRAN-20261025).
//
// Contrat gardé ici, sans réseau :
//  - trois cartes Piste, Caisse, Renfort, aucune présélectionnée ;
//  - UN SEUL appui : le clic d'une carte appelle l'unique écriture, puis
//    ouvre la suite (jaugeage du fil pour Piste, Missions pour les autres) ;
//  - le rappel de sécurité est dans le HTML initial, sans appui, texte inchangé ;
//  - le manager garde son arrivée ;
//  - « Ma progression » reste visible et ne crée ni service, ni pointage, ni retard.
// Chaque garde est suivie d'une mutation qui doit la faire rougir.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const R = __dirname;
const lire = f => fs.readFileSync(path.join(R, f), 'utf8');
const MOD = lire('nexus-prise-de-poste.js');
const APP = lire('NEXUS-App-v1.html');
const PAGE = lire('NEXUS-Prise-De-Poste-v1.html');

function corps(src, debut) {
  const i = src.indexOf(debut);
  assert.ok(i !== -1, `${debut} introuvable`);
  const o = src.indexOf('{', src.indexOf(')', i));
  let d = 0;
  for (let k = o; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(o, k + 1);
  }
  throw new Error('accolades déséquilibrées');
}

const GARDES = [];
function garde(nom, test, mutation) { GARDES.push({ nom, test, mutation }); }

// 1. Trois cartes, aucune présélection.
garde('trois cartes Piste, Caisse, Renfort',
  m => /label: 'Piste'/.test(m) && /label: 'Caisse'/.test(m) && /label: 'Renfort'/.test(m),
  m => m.replace("label: 'Caisse'", "label: 'Boutique'"));
garde('aucune carte présélectionnée',
  m => { const f = corps(m, 'function renderChoixPoste()'); return !/selected|checked|aria-pressed="true"/.test(f); },
  m => m.replace('class="pdp-carte" data-role', 'class="pdp-carte selected" data-role'));

// 2. Un seul appui.
garde('le clic d’une carte appelle directement la prise de poste',
  m => /addEventListener\('click', \(\) => confirmerPriseDePoste\(el\.dataset\.role, el\)\)/.test(m),
  m => m.replace("confirmerPriseDePoste(el.dataset.role, el)", "renderResume(el.dataset.role)"));
garde('aucun bouton « Continuer » entre la carte et la suite',
  m => { const c = corps(m, 'async function confirmerPriseDePoste('); const f = corps(m, 'function renderChoixPoste()');
    return !/Continuer/.test(c) && !/Continuer/.test(f) && !/id="btnConfirmer"/.test(m); },
  m => m.replace('<p class="pdp-sous">', '<button id="btnConfirmer">Continuer</button><p class="pdp-sous">'));
garde('Piste ouvre le jaugeage du fil, les autres Missions',
  m => { const f = corps(m, 'function destinationApresPriseDePoste()');
    return /roleChoisi !== 'pompiste'\) return 'NEXUS-Missions-v1\.html'/.test(f) && /return NexusFilDebutQuart\.ACCUEIL_DEMARRAGE/.test(f); },
  m => m.replace("return NexusFilDebutQuart.ACCUEIL_DEMARRAGE;", "return 'NEXUS-Missions-v1.html';"));
garde('une seule écriture : nexus_changer_de_quart',
  m => (m.match(/\.rpc\('nexus_changer_de_quart'/g) || []).length === 1 && !/\.from\('(shifts|pointages)'\)\s*\.(insert|upsert|update)/.test(m),
  m => m.replace("function preparer(", "async function ecrire(){ await nexusClient.from('shifts').insert({}); }\n  function preparer("));

// 3. Rappel de sécurité sans appui, texte inchangé.
garde('le rappel de sécurité est dans le rendu initial des cartes',
  m => { const f = corps(m, 'function renderChoixPoste()');
    return /\$\{rappelSecurite\}/.test(f) && /id="rappelSecurite"/.test(m) && /Strictement interdit/.test(m) && /N\\'utilisez jamais NEXUS ni votre téléphone à la vue d\\'un client/.test(m); },
  m => m.replace('Strictement interdit', 'Interdit'));

// 3 bis. Recette Guardian du 25/10 : forme de la maquette, pas d'écran intermédiaire pour Piste.
garde('sous-titres de la maquette',
  m => /Service carburant et contrôles/.test(m) && /Encaissement et accueil client/.test(m) && /Appui à l\\?'équipe/.test(m),
  m => m.replace('Encaissement et accueil client', 'Caisse'));
garde('« Poste le plus fréquent » / « Dernier poste » rétablis, sous la seule carte concernée',
  m => /return `Poste le plus fréquent, \$\{pf\.retenus\} sur \$\{pf\.eligibles\}`/.test(m) && /return 'Dernier poste'/.test(m)
    && /r\.value === posteFrequent\.poste \? `<span class="pdp-badge"/.test(corps(m, 'function renderChoixPoste()')),
  m => m.replace('return `Poste le plus fréquent, ${pf.retenus} sur ${pf.eligibles}`', "return ''"));
garde('le badge n\'est jamais une présélection',
  m => !/pdp-avant/.test(corps(m, 'function renderChoixPoste()')),
  m => m.replace('class="pdp-carte" data-role', 'class="pdp-carte pdp-avant" data-role'));
garde('dégradé CSS du fond de carte sur la photo, sans image retouchée',
  m => /\.pdp-visuel::after\{[^}]*linear-gradient\(to right,#141B22 0%,rgba\(20,27,34,0\) (4\d|50)%\)/.test(m)
    && /<span class="pdp-visuel"><img class="pdp-image"/.test(m) && /\.pdp-carte\.pdp-avant\{border:2px solid #4FC3D9/.test(m),
  m => m.replace('rgba(20,27,34,0) 50%', 'rgba(20,27,34,0) 80%'));
garde('cartes basses : texte à gauche, photo à droite',
  m => /\.pdp-carte\{display:flex/.test(m) && /\.pdp-visuel\{[^}]*order:2/.test(m) && !/\.pdp-carte\{[^}]*min-height:(1[5-9]|[2-9])\d\dpx/.test(m),
  m => m.replace('.pdp-visuel{position:relative;display:block;order:2;', '.pdp-visuel{position:relative;display:block;'));
garde('le pompiste ne reçoit aucun message FDJ en cadre rouge',
  m => /if \(roleChoisi === 'pompiste'\) return;\s*if \(data\.conflit\)/.test(m),
  m => m.replace("if (roleChoisi === 'pompiste') return;", ''));

// 4. Manager inchangé.
garde('le manager garde son arrivée (Manager-App, pas de choix forcé)',
  m => /if \(estNiveauManagerCourant\(\)\) return 'NEXUS-App-v1\.html'/.test(corps(m, 'function destinationApresPriseDePoste()')),
  m => m.replace("'NEXUS-App-v1.html'", "'NEXUS-Missions-v1.html'"));

// 5. Accueil : pas de redirection d'office, « Ma progression » visible et sans écriture.
function gardesApp(app) {
  const f = corps(app, 'function renderPrisePoste(');
  return {
    monte: /NexusPriseDePoste\.monter\(hote, employee\)/.test(f),
    manager: /if \(estNiveauManager\)[\s\S]*?cheminService/.test(f),
    sansEcriture: !/\.(insert|upsert|update|delete)\(|\.rpc\(/.test(f),
    libelleProgression: /<b>Ma progression<\/b>/.test(app),
    progressionVisible: /id="maProgressionMini"/.test(app) && /sans-service > :not\(#maProgressionMini\)/.test(app),
    enTeteUneLigne: /body:has\(#pdpChoix\) \.header-brandrow\{display:flex;/.test(app) && /body:has\(#pdpChoix\) \.header-sitewrap\{border:1px solid/.test(app),
    sansCoachNiDoublon: /#pdpChoix\) #taglineRole,/.test(app) && /#pdpChoix\) \.session-bonjour\{display:none;\}/.test(app),
    deconnexionDiscrete: /<a href="#" id="logout"/.test(app) && /body:has\(#pdpChoix\) #sessionInfo a\{color:var\(--text-dim\)/.test(app),
    termine: /Votre service est terminé/.test(app) && /hotePdp\.style\.display = 'none'/.test(app),
    rechercheApresPremierChoix: /id="zoneRecherche"/.test(app) && /zoneRecherche\.style\.display = 'none'/.test(app) && /closest\('\.pdp-carte'\)\) montrerRecherche\(\)/.test(app),
    sansEcouteurMiniProgression: !/miniProgression/.test(app),
    scriptRecherche: /<script src="nexus-recherche\.js"><\/script>/.test(app),
    termineSansPointage: /const journeeFinie = journeeTerminee \|\| !!serviceTermineDuJour;/.test(app)
      && /nexusDernierServiceTermine\(employee\)/.test(app)
      && /serviceDuJourSeulement\(\s*\(serviceTermineRows/.test(app)
      && /if \(journeeFinie && !serviceCourant\)/.test(app)
      && /const phraseService = journeeFinie/.test(app),
    pasDeRedirection: !/location\.(href|replace)\s*=[^;]*Prise-De-Poste/.test(app),
  };
}

let ok = 0;
for (const g of GARDES) {
  assert.ok(g.test(MOD), `garde rouge : ${g.nom}`);
  const mut = g.mutation(MOD);
  assert.notStrictEqual(mut, MOD, `mutation sans effet : ${g.nom}`);
  let rougit;
  try { rougit = !g.test(mut); } catch (e) { rougit = true; }
  assert.ok(rougit, `la mutation ne fait pas rougir : ${g.nom}`);
  console.log('OK  —', g.nom); ok++;
}

const base = gardesApp(APP);
for (const [k, v] of Object.entries(base)) { assert.ok(v, `Accueil : ${k}`); console.log('OK  — Accueil :', k); ok++; }

const mutApp = {
  monte: APP.replace('NexusPriseDePoste.monter(hote, employee)', 'void 0'),
  sansEcriture: APP.replace("NexusPriseDePoste.monter(hote, employee).catch(() => {});", "nexusClient.from('shifts').insert({});"),
  progressionVisible: APP.replace('sans-service > :not(#maProgressionMini)', 'sans-service > :not(#autre)'),
  libelleProgression: APP.replace('<b>Ma progression</b>', 'Points'),
  termine: APP.replace("hotePdp.style.display = 'none'", 'void 0'),
  manager: APP.replace('cheminService', 'autreId'),
  termineSansPointage: APP.replace('if (journeeFinie && !serviceCourant)', 'if (journeeTerminee && !serviceCourant)'),
  rechercheApresPremierChoix: APP.replace("zoneRecherche.style.display = 'none';", 'void 0;'),
  sansEcouteurMiniProgression: APP.replace("zoneRecherche.style.display = 'none';", "const miniProgression = 1; zoneRecherche.style.display = 'none';"),
  scriptRecherche: APP.replace('<script src="nexus-recherche.js"></script>', ''),
  enTeteUneLigne: APP.replace('body:has(#pdpChoix) .header-brandrow{display:flex;', 'body:has(#pdpChoix) .header-brandrow{display:grid;'),
  sansCoachNiDoublon: APP.replace('body:has(#pdpChoix) #taglineRole,', 'body:has(#pdpChoix) #taglineRoleX,'),
  deconnexionDiscrete: APP.replace('<a href="#" id="logout"', '<a href="#" id="deco"'),
};
for (const [k, src] of Object.entries(mutApp)) {
  assert.notStrictEqual(src, APP, `mutation Accueil sans effet : ${k}`);
  assert.ok(!gardesApp(src)[k], `mutation Accueil ne fait pas rougir : ${k}`);
  console.log('OK  — mutation Accueil rougit :', k); ok++;
}

// 6. Nulle part ailleurs que dans le module on n'écrit un service, un pointage ou un retard.
const fichiers = fs.readdirSync(R).filter(f => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(f) && f !== 'nexus-prise-de-poste.js' && !/^nexus-(build|config)/.test(f));
const ECRIT = /\.from\('(shifts|pointages|retards)'\)\s*\.(insert|upsert)\(/;
const fautifs = fichiers.filter(f => ECRIT.test(lire(f)));
console.log('INFO — fichiers écrivant shifts/pointages/retards hors module :', fautifs.join(', ') || 'aucun');
assert.ok(!fautifs.includes('NEXUS-Progression-v1.html') && !fautifs.includes('NEXUS-App-v1.html'), '« Ma progression » et l’Accueil ne créent ni service ni pointage ni retard');
ok++;
assert.ok(ECRIT.test("x.from('shifts').insert({})"), 'mutation de la garde d’écriture');
assert.ok(PAGE.includes('nexus-prise-de-poste.js'), 'la page charge le module');

// 7. Ma progression change de page : la zone de recherche doit y être, en haut,
//    pour l'employé, et câblée sur le MÊME module que l'Accueil.
const PROG = lire('NEXUS-Progression-v1.html');
function gardesProgression(h) {
  const iZone = h.indexOf('id="zoneRecherche"');
  const iApp = h.indexOf('id="app"');
  return {
    scriptRecherche: /<script src="nexus-recherche\.js"><\/script>/.test(h),
    zoneEnHaut: iZone !== -1 && iApp !== -1 && iZone < iApp,
    champ: /id="rechercheNexusInput"/.test(h) && /id="rechercheNexusResultats"/.test(h),
    libelle: /Que cherchez-vous à faire \?/.test(h),
    employeSeulement: /if \(zoneRecherche && !estNiveauManager\)\s*\{\s*zoneRecherche\.style\.display = '';/.test(h),
    memeModule: /NexusRecherche\.initRechercheNexus\(employee, false,/.test(h),
  };
}
const mutProg = {
  scriptRecherche: PROG.replace('<script src="nexus-recherche.js"></script>', ''),
  zoneEnHaut: PROG.replace('id="zoneRecherche"', 'id="zoneX"').replace('id="app">', 'id="app"></div><div id="zoneRecherche">'),
  champ: PROG.replace('id="rechercheNexusInput"', 'id="autre"'),
  libelle: PROG.split('Que cherchez-vous à faire ?').join('Rechercher'),
  employeSeulement: PROG.replace('if (zoneRecherche && !estNiveauManager)', 'if (zoneRecherche)'),
  memeModule: PROG.replace('NexusRecherche.initRechercheNexus(employee, false,', 'void (employee, false,'),
};
for (const [k, v] of Object.entries(gardesProgression(PROG))) { assert.ok(v, `Progression : ${k}`); console.log('OK  — Progression :', k); ok++; }
for (const [k, src] of Object.entries(mutProg)) {
  assert.notStrictEqual(src, PROG, `mutation Progression sans effet : ${k}`);
  assert.ok(!gardesProgression(src)[k], `mutation Progression ne fait pas rougir : ${k}`);
  console.log('OK  — mutation Progression rougit :', k); ok++;
}

// 8. Le vrai changement de page : le module partagé, chargé comme sur la page
//    Progression (document neuf), câble le champ et trouve les pages de l'employé.
{
  const vm = require('vm');
  const champ = { placeholder: '', ecouteurs: {}, value: '', addEventListener(t, f) { this.ecouteurs[t] = f; } };
  const liste = { innerHTML: '', classList: { add() {}, remove() {} }, querySelectorAll() { return []; } };
  const doc = { getElementById: id => (id === 'rechercheNexusInput' ? champ : id === 'rechercheNexusResultats' ? liste : null) };
  const ctx = { document: doc }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(lire('nexus-recherche.js'), ctx);
  ctx.NexusRecherche.initRechercheNexus({ est_createur: false }, false, true, true, false, 'pompiste', false, () => {});
  assert.ok(champ.ecouteurs.input, 'le champ est câblé');
  champ.value = 'progression'; champ.ecouteurs.input();
  assert.ok(/NEXUS-Progression-v1\.html/.test(liste.innerHTML), 'la recherche trouve Ma progression');
  champ.value = 'cockpit'; champ.ecouteurs.input();
  assert.ok(!/NEXUS-Cockpit-v2\.html/.test(liste.innerHTML), 'un employé ne voit pas les pages manager');
  champ.value = 'pointage'; champ.ecouteurs.input();
  assert.ok(!/NEXUS-Pointage-v1\.html/.test(liste.innerHTML), 'Pointage exclu sans lecture de l’interrupteur');
  console.log('OK  — module partagé câblé comme sur la page Progression'); ok++;
}

console.log(`\n${ok} vérifications passées.`);
