// Épreuve — 30/10/2026, lot MENU-ACCUEIL-EMPLOYE-20261030 (menu ☰ de l'Accueil).
// Exigences (decision-1) : entrées du menu selon le poste ; ni Jaugeage ni Index pour les employés ; recherche réservée au manager et au gérant ;
// aucune colonne ni migration ; l'exclusion `roleDuJour !== 'renfort'` et les contrôles Inventaire de l'Accueil restent inchangés.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const charger = (src) => { const m = { exports: {} }; new Function('module', 'self', src)(m, undefined); return m.exports; };
const SRC = lire('nexus-menu-accueil.js');
const APP = lire('NEXUS-App-v1.html');

const codes = (M, f) => [].concat(...M.groupes(f).map((g) => g.entrees.map((e) => e.code)));
const emp = (role, o) => Object.assign({ estNiveauManager: false, enService: true, roleDuJour: role, receptionApplicable: false, fdjApplicable: false }, o);

const EPREUVES = {
  'pompiste : Réception seulement si applicable, Inventaire, Missions, Pointage, Moi': (M) => {
    const c = codes(M, emp('pompiste', { receptionApplicable: true }));
    ['reception', 'inventaire', 'missions', 'pointage', 'progression', 'changer_poste', 'deconnexion'].forEach((x) => assert(c.includes(x), x));
    assert(!c.includes('coach_fdj') && !c.includes('fdj'));
    assert(!codes(M, emp('pompiste')).includes('reception'));
  },
  'aucun employé n\'a Jaugeage ni Index': (M) => {
    ['pompiste', 'caissiere', 'renfort', 'polyvalent'].forEach((r) => {
      const c = codes(M, emp(r, { receptionApplicable: true, fdjApplicable: true }));
      assert(!c.includes('jaugeage') && !c.includes('index'), r);
    });
  },
  'caissière : Coach FDJ, FDJ si applicable, pas de Réception': (M) => {
    const c = codes(M, emp('caissiere', { fdjApplicable: true }));
    assert(c.includes('coach_fdj') && c.includes('fdj') && c.includes('inventaire') && !c.includes('reception'));
    assert(!codes(M, emp('caissiere')).includes('fdj') && codes(M, emp('caissiere')).includes('coach_fdj'));
  },
  'renfort : Inventaire présent mais grisé, sans lien, avec « Désactivé par le manager » ; pas de Coach FDJ': (M) => {
    const gs = M.groupes(emp('renfort'));
    const c = codes(M, emp('renfort'));
    assert(c.includes('inventaire') && c.includes('missions') && c.includes('pointage') && !c.includes('coach_fdj'));
    const e = [].concat(...gs.map((g) => g.entrees)).find((x) => x.code === 'inventaire');
    assert(e.desactive === true && !e.href && e.mention === 'Désactivé par le manager');
    const h = M.html(gs);
    assert(h.includes('aria-disabled="true"') && h.includes('Désactivé par le manager') && !h.includes('NEXUS-Inventaire-v1.html'));
  },
  'les autres postes gardent le lien Inventaire actif, sans mention': (M) => {
    ['pompiste', 'caissiere', 'polyvalent'].forEach((r) => {
      const e = [].concat(...M.groupes(emp(r)).map((g) => g.entrees)).find((x) => x.code === 'inventaire');
      assert(!e.desactive && e.href === 'NEXUS-Inventaire-v1.html', r);
      assert(!M.html(M.groupes(emp(r))).includes('Désactivé par le manager'), r);
    });
    const m = [].concat(...M.groupes({ estNiveauManager: true, enService: false, roleDuJour: 'renfort' }).map((g) => g.entrees)).find((x) => x.code === 'inventaire');
    assert(!m.desactive && m.href);
  },
  'manager et gérant : toutes les entrées, Jaugeage et Index compris': (M) => {
    const c = codes(M, { estNiveauManager: true, enService: false, roleDuJour: 'gerant', fdjApplicable: true });
    ['reception', 'jaugeage', 'index', 'inventaire', 'missions', 'pointage', 'coach_fdj', 'fdj', 'progression', 'changer_poste', 'deconnexion'].forEach((x) => assert(c.includes(x), x));
  },
  'employé hors service : pas de menu': (M) => { assert.deepStrictEqual(M.groupes(emp('pompiste', { enService: false })), []); },
  'recherche : manager et gérant la gardent, pompiste, caisse et renfort non': (M) => {
    assert(M.rechercheVisible({ estNiveauManager: true, roleDuJour: 'manager' }));
    assert(M.rechercheVisible({ estNiveauManager: true, roleDuJour: 'gerant' }));
    ['pompiste', 'caissiere', 'renfort'].forEach((r) => assert(!M.rechercheVisible(emp(r)), r));
  },
  'le HTML échappe et nomme les entrées de déconnexion et de changement de poste': (M) => {
    const h = M.html(M.groupes(emp('pompiste')));
    assert(h.includes('id="menuLogout"') && h.includes('id="menuChangerPoste"') && h.includes('NEXUS-Prise-De-Poste-v1.html'));
  },
  'l\'App branche le menu, garde l\'exclusion du renfort et ne touche ni colonne ni migration': () => {
    assert(APP.includes('nexus-menu-accueil.js') && APP.includes('id="menuAccueilBouton"') && APP.includes('monterMenuAccueil('));
    assert(/const inventaireApplicable = enService && roleDuJour !== 'renfort';/.test(APP));
  },
};

let ko = 0;
Object.keys(EPREUVES).forEach((nom) => {
  try { EPREUVES[nom](charger(SRC)); console.log('ok  - ' + nom); } catch (e) { ko++; console.log('KO  - ' + nom + ' : ' + e.message); }
});
// Mutations : chaque exigence doit rougir si le module est abîmé.
const MUTANTS = [
  ['carburant manager', (s) => s.replace("if (manager) {\n      carburant.push({ code: 'jaugeage'", "if (true) {\n      carburant.push({ code: 'jaugeage'")],
  ['coach caisse', (s) => s.replace("role === 'caissiere')", "role === 'renfort')")],
  ['recherche renfort', (s) => s.replace("['pompiste', 'caissiere', 'renfort']", "['pompiste']")],
  ['inventaire renfort actif', (s) => s.replace("role === 'renfort' && !manager", 'false')],
  ['mention retirée', (s) => s.replace("'Désactivé par le manager'", "''")],
  ['hors service', (s) => s.replace('!f.enService', 'false')],
];
MUTANTS.forEach(([nom, mut]) => {
  const src = mut(SRC); assert(src !== SRC, 'mutant sans effet : ' + nom);
  let rouge = false;
  Object.keys(EPREUVES).forEach((n) => { try { EPREUVES[n](charger(src)); } catch (e) { rouge = true; } });
  if (!rouge) { ko++; console.log('KO  - mutant survivant : ' + nom); } else console.log('ok  - mutant tué : ' + nom);
});
process.exit(ko ? 1 : 0);
