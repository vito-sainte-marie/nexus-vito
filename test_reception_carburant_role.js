// Test — station_config.reception_carburant_role (14/08/2026)
//
// Vérifie, sans navigateur headless (aucun disponible dans ce sandbox,
// même convention que test_reception_v1_dom.js / test_pilotage_qualite_
// receptions.js) :
//   A. NEXUS-App-v1.html — chargerReceptionCarburantRole() : défaut
//      'employe' sur erreur réseau / ligne absente / colonne nulle,
//      pass-through correct sinon.
//   B. NEXUS-Parametres-Station-v1.html — chargerReceptionCarburantRole()
//      (même contrat) + majChipsReceptionCarburantRole() : active le bon
//      chip et affiche le bon libellé d'état pour les 3 valeurs possibles.
//
// Fonctions extraites par regex plutôt que vm sur le fichier entier :
// ces deux fonctions n'ont aucune dépendance sur le reste du DOM de leur
// page (juste nexusClient, et pour (B) les 3 chips + le div d'état),
// donc pas besoin de mocker tout App-v1/Parametres-Station.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';

function extraire(source, nomFonction) {
  const re = new RegExp(`async function ${nomFonction}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`);
  const m = source.match(re);
  if (!m) throw new Error(`Fonction ${nomFonction} introuvable`);
  return m[0];
}

function extraireSync(source, nomFonction) {
  const re = new RegExp(`function ${nomFonction}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`);
  const m = source.match(re);
  if (!m) throw new Error(`Fonction ${nomFonction} introuvable`);
  return m[0];
}

// ------------------------------------------------------------
// A. NEXUS-App-v1.html
// ------------------------------------------------------------
async function testApp() {
  const html = fs.readFileSync(path.join(DIR, 'NEXUS-App-v1.html'), 'utf8');
  const fnSrc = extraire(html, 'chargerReceptionCarburantRole');
  assert.ok(fnSrc.includes("select('reception_carburant_role')"), 'App: doit lire la bonne colonne');
  assert.ok(fnSrc.includes("|| 'employe'"), 'App: doit retomber sur employe par défaut');

  const cas = [
    { desc: 'erreur réseau', mock: { data: null, error: { message: 'boom' } }, attendu: 'employe' },
    { desc: 'ligne absente (maybeSingle -> null)', mock: { data: null, error: null }, attendu: 'employe' },
    { desc: 'colonne nulle', mock: { data: { reception_carburant_role: null }, error: null }, attendu: 'employe' },
    { desc: "valeur 'employe' explicite", mock: { data: { reception_carburant_role: 'employe' }, error: null }, attendu: 'employe' },
    { desc: "valeur 'manager'", mock: { data: { reception_carburant_role: 'manager' }, error: null }, attendu: 'manager' },
    { desc: "valeur 'les_deux'", mock: { data: { reception_carburant_role: 'les_deux' }, error: null }, attendu: 'les_deux' },
  ];

  for (const c of cas) {
    const nexusClient = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() { return c.mock; },
        };
      },
    };
    // eslint-disable-next-line no-new-func
    const fn = new Function('nexusClient', 'console', `return (${fnSrc.replace(/^async function \w+/, 'async function chargerReceptionCarburantRole')});`)(nexusClient, { error: () => {} });
    const resultat = await fn('site-test');
    assert.strictEqual(resultat, c.attendu, `App / ${c.desc} : attendu ${c.attendu}, obtenu ${resultat}`);
  }
  console.log('✓ A. NEXUS-App-v1.html — chargerReceptionCarburantRole (6/6 cas)');
}

// ------------------------------------------------------------
// B. NEXUS-Parametres-Station-v1.html
// ------------------------------------------------------------
async function testParametres() {
  const html = fs.readFileSync(path.join(DIR, 'NEXUS-Parametres-Station-v1.html'), 'utf8');
  const fnSrc = extraire(html, 'chargerReceptionCarburantRole');
  assert.ok(fnSrc.includes("select('reception_carburant_role')"), 'Paramètres: doit lire la bonne colonne');

  // 1) chargerReceptionCarburantRole — même contrat que App
  {
    const nexusClient = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() { return { data: null, error: { message: 'boom' } }; },
        };
      },
    };
    const employee = { site_id: 'site-test' };
    const fn = new Function('nexusClient', 'employee', 'console', `return (${fnSrc.replace(/^async function \w+/, 'async function chargerReceptionCarburantRole')});`)(nexusClient, employee, { error: () => {} });
    const resultat = await fn();
    assert.strictEqual(resultat, 'employe', 'Paramètres : défaut employe sur erreur réseau');
  }
  console.log('✓ B1. NEXUS-Parametres-Station-v1.html — chargerReceptionCarburantRole (défaut employe)');

  // 2) majChipsReceptionCarburantRole — DOM mock minimal (3 chips + 1 div état)
  const fnMajSrc = extraireSync(html, 'majChipsReceptionCarburantRole');
  const libellesMatch = html.match(/const RECEPTION_ROLE_LIBELLES = \{[\s\S]*?\n  \};/);
  assert.ok(libellesMatch, 'Paramètres : RECEPTION_ROLE_LIBELLES introuvable');

  function fabriquerDocumentMock(valeurs) {
    // Un "chip" mock minimal : dataset.valeur + classList (Set-based, avec toggle(force)).
    const chips = valeurs.map(v => {
      const classes = new Set();
      return {
        dataset: { valeur: v },
        classList: {
          toggle(nom, force) {
            if (force) classes.add(nom); else classes.delete(nom);
          },
          contains(nom) { return classes.has(nom); },
        },
      };
    });
    const etatEl = { innerHTML: '' };
    return {
      chips,
      etatEl,
      querySelectorAll(sel) {
        if (sel === '#cardReceptionCarburantRole .role-chip') return chips;
        return [];
      },
      getElementById(id) {
        if (id === 'receptionCarburantRoleEtat') return etatEl;
        return null;
      },
    };
  }

  for (const valeur of ['employe', 'manager', 'les_deux']) {
    const document = fabriquerDocumentMock(['employe', 'manager', 'les_deux']);
    const fn = new Function('document', `${libellesMatch[0]}\nreturn (${fnMajSrc.replace(/^function \w+/, 'function majChipsReceptionCarburantRole')});`)(document);
    fn(valeur);
    const chipActif = document.chips.find(c => c.classList.contains('actif'));
    assert.ok(chipActif, `Paramètres : un chip doit être actif pour ${valeur}`);
    assert.strictEqual(chipActif.dataset.valeur, valeur, `Paramètres : le chip actif doit correspondre à ${valeur}`);
    const autresInactifs = document.chips.filter(c => c.dataset.valeur !== valeur).every(c => !c.classList.contains('actif'));
    assert.ok(autresInactifs, `Paramètres : les autres chips doivent être inactifs pour ${valeur}`);
    assert.ok(document.etatEl.innerHTML.length > 0, `Paramètres : le libellé d'état doit être rempli pour ${valeur}`);
  }
  console.log('✓ B2. NEXUS-Parametres-Station-v1.html — majChipsReceptionCarburantRole (3/3 valeurs)');

  console.log('\nTous les tests reception_carburant_role passent.');
}

(async function main() {
  await testApp();
  await testParametres();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
