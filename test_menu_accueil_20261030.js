// Épreuve — 30/10/2026, lot MENU-ACCUEIL-EMPLOYE-20261030 (menu ☰ de l'Accueil).
// Exigences (decision-1) : entrées du menu selon le poste ; ni Jaugeage ni Index pour les employés ; recherche réservée au manager et au gérant ;
// aucune colonne ni migration ; l'exclusion `roleDuJour !== 'renfort'` et les contrôles Inventaire de l'Accueil restent inchangés.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const charger = (src) => { const m = { exports: {} }; new Function('module', 'self', src)(m, undefined); return m.exports; };
const SRC = lire('nexus-menu-accueil.js');
const APP = lire('NEXUS-App-v1.html');

const codes = (M, f) => [].concat(...M.groupes(f).map((g) => g.entrees.map((e) => e.code)));
const emp = (role, o) => Object.assign({ estNiveauManager: false, enService: true, roleDuJour: role, receptionApplicable: false, fdjApplicable: false, pointageActif: true }, o);

const EPREUVES = {
  'pompiste : Réception seulement si applicable, Inventaire, Missions, Pointage, Moi': (M) => {
    const c = codes(M, emp('pompiste', { receptionApplicable: true }));
    ['reception', 'inventaire', 'missions', 'pointage', 'progression', 'changer_poste', 'deconnexion'].forEach((x) => assert(c.includes(x), x));
    assert(!c.includes('coach_fdj') && !c.includes('fdj'));
    assert(!codes(M, emp('pompiste')).includes('reception'));
  },
  'aucun employé n\'a le Jaugeage ; seul le pompiste du jour a « Relevés d\'index » (écran de choix, sans moment)': (M) => {
    ['caissiere', 'renfort', 'polyvalent'].forEach((r) => {
      assert(!codes(M, emp(r, { receptionApplicable: true, fdjApplicable: true })).includes('index'), 'index absent : ' + r);
      assert(!codes(M, emp(r)).includes('jaugeage'), r);
    });
    ['pompiste'].forEach((r) => {
      const gs = M.groupes(emp(r, { receptionApplicable: true, fdjApplicable: true }));
      const c = codes(M, emp(r, { receptionApplicable: true, fdjApplicable: true }));
      assert(!c.includes('jaugeage'), r);
      const e = [].concat(...gs.map((g) => g.entrees)).find((x) => x.code === 'index');
      assert(e && e.href === 'NEXUS-Releves-Piste-v1.html' && e.libelle === 'Relevés d\'index', r);
      assert(gs.find((g) => g.code === 'carburant').entrees.includes(e), r);
    });
    assert(!codes(M, emp('pompiste', { enService: false })).includes('index'));
  },
  'caissière : Coach FDJ, FDJ si applicable, pas de Réception': (M) => {
    const c = codes(M, emp('caissiere', { fdjApplicable: true }));
    assert(c.includes('coach_fdj') && c.includes('fdj') && c.includes('inventaire') && !c.includes('reception'));
    assert(!codes(M, emp('caissiere')).includes('fdj') && codes(M, emp('caissiere')).includes('coach_fdj'));
  },
  'renfort : plus d\'entrée Inventaire (ni grisée) ; Missions et Pointage restent ; pas de Coach FDJ': (M) => {
    const gs = M.groupes(emp('renfort'));
    const c = codes(M, emp('renfort'));
    assert(!c.includes('inventaire') && c.includes('missions') && c.includes('pointage') && !c.includes('coach_fdj'));
    const h = M.html(gs);
    assert(!h.includes('aria-disabled') && !h.includes('mm-desactive') && !h.includes('Non prévu pour le poste') && !h.includes('NEXUS-Inventaire-v1.html'));
  },
  'les autres postes gardent le lien Inventaire actif, sans mention': (M) => {
    ['pompiste', 'caissiere', 'polyvalent'].forEach((r) => {
      const e = [].concat(...M.groupes(emp(r)).map((g) => g.entrees)).find((x) => x.code === 'inventaire');
      assert(!e.desactive && e.href === 'NEXUS-Inventaire-v1.html', r);
    });
    const m = [].concat(...M.groupes({ estNiveauManager: true, enService: false, roleDuJour: 'renfort' }).map((g) => g.entrees)).find((x) => x.code === 'inventaire');
    assert(!m.desactive && m.href);
  },
  'manager et gérant : toutes les entrées, Jaugeage et Index compris': (M) => {
    const c = codes(M, { estNiveauManager: true, enService: false, roleDuJour: 'gerant', fdjApplicable: true, pointageActif: true });
    ['reception', 'jaugeage', 'index', 'inventaire', 'missions', 'pointage', 'coach_fdj', 'fdj', 'progression', 'changer_poste', 'deconnexion'].forEach((x) => assert(c.includes(x), x));
  },
  'manager et gérant : le menu reste identique, index compris, quel que soit le poste du jour': (M) => {
    ['manager', 'gerant', 'renfort', 'caissiere', 'pompiste'].forEach((r) => {
      const gs = M.groupes({ estNiveauManager: true, enService: false, roleDuJour: r, receptionApplicable: false, fdjApplicable: true, pointageActif: true });
      const idx = [].concat(...gs.map((g) => g.entrees)).find((x) => x.code === 'index');
      assert(idx && idx.href === 'NEXUS-Releves-Piste-v1.html', 'index ' + r);
      assert(codes(M, { estNiveauManager: true, roleDuJour: r }).includes('jaugeage'), 'jaugeage ' + r);
    });
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
  'pointage absent du menu quand la station l\'a désactivé, présent quand actif (employé et manager)': (M) => {
    ['pompiste', 'caissiere', 'renfort', 'polyvalent'].forEach((r) => {
      assert(!codes(M, emp(r, { pointageActif: false })).includes('pointage'), r + ' sans pointage actif');
      assert(!codes(M, emp(r, { pointageActif: undefined })).includes('pointage'), r + ' fait absent');
      assert(codes(M, emp(r)).includes('pointage'), r + ' avec pointage actif');
    });
    assert(!codes(M, emp('manager', { estNiveauManager: true, pointageActif: false })).includes('pointage'));
    assert(codes(M, emp('manager', { estNiveauManager: true })).includes('pointage'));
  },
  'bouton ☰ blanc, à l\'extrême gauche de l\'en-tête, Pointage branché sur pointage_actif': () => {
    const css = (APP.match(/\.menu-accueil-bouton\{[^}]*\}/) || [''])[0];
    assert(/color:var\(--ap-text\)/.test(css) && !/color:var\(--cyan\)/.test(css), 'bouton blanc');
    assert(/position:absolute/.test(css) && /left:12px/.test(css), 'bouton à gauche');
    assert(/pointageActif: pointageActifSite === true/.test(APP) && /pointageActif: pointageActifManager === true/.test(APP));
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
  ['jaugeage employé', (s) => s.replace("if (manager) carburant.push({ code: 'jaugeage'", "if (true) carburant.push({ code: 'jaugeage'")],
  ['index absent pour l\'employé', (s) => s.replace("if (manager || (f.enService && !f.fermetureLien && role === 'pompiste')) carburant.push({ code: 'index'", "if (manager) carburant.push({ code: 'index'")],
  ['index ouvert à tout employé', (s) => s.replace(" && role === 'pompiste')) carburant.push", "))  carburant.push")],
  ['index vers un moment', (s) => s.replace("index: 'NEXUS-Releves-Piste-v1.html',", "index: 'NEXUS-Releves-Piste-v1.html?moment=debut_q1',")],
  ['coach caisse', (s) => s.replace("role === 'caissiere')", "role === 'renfort')")],
  ['recherche renfort', (s) => s.replace("['pompiste', 'caissiere', 'renfort']", "['pompiste']")],
  ['inventaire renfort revenu', (s) => s.replace("role !== 'renfort'", 'true')],
  ['pointage toujours affiché', (s) => s.replace("f.pointageActif === true", 'true')],
  ['hors service', (s) => s.replace('!f.enService', 'false')],
];
MUTANTS.forEach(([nom, mut]) => {
  const src = mut(SRC); assert(src !== SRC, 'mutant sans effet : ' + nom);
  let rouge = false;
  Object.keys(EPREUVES).forEach((n) => { try { EPREUVES[n](charger(src)); } catch (e) { rouge = true; } });
  if (!rouge) { ko++; console.log('KO  - mutant survivant : ' + nom); } else console.log('ok  - mutant tué : ' + nom);
});
process.exit(ko ? 1 : 0);
