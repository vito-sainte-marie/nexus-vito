// NEXUS — garde de gestion partagée et menu latéral par rôle (lot GARDE-GESTION-EMPLOYE-20261124).
// Ce test EXTRAIT la liste réelle du menu latéral (nexus-desktop.js), le module du menu de l'Accueil et la garde
// de nexus-auth.js, puis les EXÉCUTE. Il ne recopie aucune liste de pages.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = process.env.NEXUS_ROOT || __dirname;
const lire = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

// 1. Le menu latéral complet, tel qu'écrit dans nexus-desktop.js.
const desk = lire('nexus-desktop.js');
const deb = desk.indexOf('const NEXUS_SIDEBAR_GROUPES = [');
const fin = desk.indexOf('\n];', deb);
ok(deb > 0 && fin > deb, 'liste NEXUS_SIDEBAR_GROUPES introuvable');
const complet = vm.runInNewContext(desk.slice(deb, fin + 3).replace('const NEXUS_SIDEBAR_GROUPES', 'NEXUS_SIDEBAR_GROUPES') + ';NEXUS_SIDEBAR_GROUPES', {});
const pages = [].concat(...complet.map((g) => g.items.map((i) => i.href))).map((h) => h.split('?')[0]);
ok(pages.length > 20, 'menu latéral vide ?');

// 2. Le menu employé : UNE seule liste, celle de l'Accueil.
const menu = require(path.join(ROOT, 'nexus-menu-accueil.js'));
const lat = menu.groupesLateraux();
const ouvertes = [].concat(...lat.map((g) => g.entrees.map((e) => e.href.split('?')[0])));
ok(ouvertes.length >= 5, 'menu employé trop court');
ok(!lat.some((g) => g.entrees.some((e) => e.code === 'deconnexion' || e.code === 'fermeture')), 'déconnexion/fermeture dans le menu latéral');
const groupesAccueil = menu.groupes({ estNiveauManager: false, enService: true, roleDuJour: 'caissiere', receptionApplicable: true, fdjApplicable: true, datesCourtesApplicable: true, pointageActif: true });
const dansAccueil = [].concat(...groupesAccueil.map((g) => g.entrees.map((e) => e.href.split('?')[0])));
ouvertes.forEach((h) => ok(dansAccueil.includes(h), 'menu employé hors liste Accueil : ' + h));

// 3. Aucune entrée du menu employé n'est une page de gestion : chacune est soit hors menu de gestion, soit sans garde par conception.
const pagesGestionMenu = pages.filter((p) => !ouvertes.includes(p) && !/NEXUS-App-v1\.html$/.test(p));
ok(pagesGestionMenu.length > 10, 'aucune page de gestion énumérée');
// Pages du menu latéral complet qui sont des écrans employé par conception (aucune garde attendue).
const OUVERTES_PAR_CONCEPTION = ['NEXUS-Inventaire-v1.html', 'NEXUS-Missions-v1.html', 'NEXUS-FDJ-v1.html', 'NEXUS-Carburant-Reception-v1.html',
  'NEXUS-Coach-FDJ-v1.html', 'NEXUS-Documentation-v1.html', 'NEXUS-Pointage-v1.html', 'NEXUS-Progression-v1.html', 'NEXUS-Prise-De-Poste-v1.html',
  'NEXUS-Dates-Courtes-Releve-v1.html', 'NEXUS-Releves-Piste-v1.html'];

// 4. Chaque page de gestion du menu complet porte la garde partagée.
const sansGarde = [];
pages.forEach((p) => {
  if (ouvertes.includes(p) || OUVERTES_PAR_CONCEPTION.includes(p) || /NEXUS-App-v1\.html$/.test(p)) return;
  if (!fs.existsSync(path.join(ROOT, p))) { sansGarde.push(p + ' (absente)'); return; }
  if (!/nexusRequireGestion\s*\(/.test(lire(p))) sansGarde.push(p);
});
assert.deepStrictEqual(sansGarde, [], 'pages de gestion du menu sans garde partagée : ' + sansGarde.join(', '));
n++;

// 5. Cockpit-v2 : la garde précède tout chargement de données.
const cock = lire('NEXUS-Cockpit-v2.html');
const ig = cock.indexOf('nexusRequireGestion(employee, { createur: true })');
ok(ig > 0, 'Cockpit-v2 sans garde');
['chargerJournalDecisions(', 'construirePlansAction(', '.from('].forEach((s) => {
  const i = cock.indexOf(s, cock.indexOf('if (!employee) return;'));
  ok(i < 0 || i > ig, 'Cockpit-v2 : ' + s + ' avant la garde');
});

// 6. Comportement de la garde.
const auth = lire('nexus-auth.js');
const a = auth.indexOf('function nexusRequireGestion');
const b = auth.indexOf('\n}\n', a) + 3;
const estM = auth.match(/function nexusEstManager[\s\S]*?\n}\n/);
ok(estM, 'nexusEstManager introuvable');
function essai(employee, options) {
  const cible = [];
  const ctx = { window: { location: { replace: (u) => cible.push(u) } } };
  vm.runInNewContext(estM[0] + auth.slice(a, b) + ';this.r = nexusRequireGestion(E, O);', Object.assign(ctx, { E: employee, O: options }));
  return { admis: ctx.r, cible };
}
const emp = essai({ role: 'employe' });
ok(emp.admis === false && emp.cible[0] === 'NEXUS-App-v1.html?garde=gestion', 'employé non renvoyé vers l\'Accueil');
ok(essai({ role: 'caissiere' }).admis === false, 'caissière admise');
ok(essai(null).admis === false, 'session vide admise');
ok(essai({ role: 'manager' }).admis === true && essai({ role: 'manager' }).cible.length === 0, 'manager refusé');
ok(essai({ role: 'gerant' }).admis === true, 'gérant refusé');
ok(essai({ role: 'employe', est_createur: true }).admis === false, 'créateur admis sans option');
ok(essai({ role: 'employe', est_createur: true }, { createur: true }).admis === true, 'créateur refusé avec option');
ok(essai({ role: 'employe' }, { createur: true }).admis === false, 'option créateur admet un employé');
ok(/Cet écran est réservé à la gestion/.test(auth), 'message absent');

// 7. nexus-desktop : le menu employé vient du module de l'Accueil, le rôle se lit avant le rendu complet.
ok(/groupesLateraux\(/.test(desk), "nexus-desktop ne lit pas groupesLateraux");
ok(/nexusConstruireSidebarHTML\(\[\]\)/.test(desk), 'le menu complet s\'affiche avant que le rôle soit connu');

console.log('OK test_garde_gestion_employe_20261124 (' + n + ' vérifications, ' + pages.length + ' entrées de menu)');
