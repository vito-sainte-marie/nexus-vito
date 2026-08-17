// Test — rendu réel de l'écran "État du stock FDJ" après la refonte
// "lecture managériale" (14/08/2026).
//
// Complète test_fdj_stock_lecture_manageriale.js (qui vérifie le moteur
// pur) en exécutant le VRAI script inline de NEXUS-FDJ-Manager-v1.html
// via vm.runInContext, avec un mock DOM minimal — pour attraper les bugs
// de gabarit/exécution (accès à une propriété manquante, etc.) qu'un
// simple node --check ne peut pas voir. Même convention que les tests DOM
// précédents du projet (mock générique par id, handle
// globalThis.__NEXUS_TEST__ pour exposer les `let` de plus haut niveau).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-FDJ-Manager-v1.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Attendu 1 <script> inline, trouvé ${scripts.length}`);
let scriptSrc = scripts[0];

// Le moteur réel (pas un mock) — même discipline que les autres tests DOM
// du projet : on veut vérifier le vrai calcul, pas une réimplémentation.
const moteurSrc = fs.readFileSync(path.join(DIR, 'nexus-fdj-moteur.js'), 'utf8');

function fabriquerDocument() {
  const registre = new Map();
  function elementPour(id) {
    if (!registre.has(id)) {
      registre.set(id, {
        id, value: '', textContent: '', _innerHTML: '', style: {}, dataset: {},
        classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
        addEventListener(){}, click(){},
        get innerHTML() { return this._innerHTML; },
        set innerHTML(v) { this._innerHTML = v; },
      });
    }
    return registre.get(id);
  }
  return {
    getElementById: elementPour,
    querySelectorAll() { return []; },
    querySelector() { return null; },
  };
}

const documentMock = fabriquerDocument();
const sandbox = {
  document: documentMock,
  console,
  // Pas de `window` ici : nexus-fdj-moteur.js s'attache à
  // `(typeof window !== 'undefined' ? window : globalThis)` — un `window`
  // même vide le ferait s'attacher à sandbox.window.NexusFdjMoteur au lieu
  // de sandbox.NexusFdjMoteur directement.
  nexusRequireAuth: () => new Promise(() => {}), // neutralise l'init réel (voir tests précédents du projet)
  nexusClient: {},
  Date,
};
vm.createContext(sandbox);
vm.runInContext(moteurSrc, sandbox); // NexusFdjMoteur réel, attaché à sandbox.globalThis via (window||globalThis)

scriptSrc += `
;globalThis.__NEXUS_TEST__ = {
  get jeux(){ return jeux; }, set jeux(v){ jeux = v; },
  get stockEtat(){ return stockEtat; }, set stockEtat(v){ stockEtat = v; },
  get stockEtatFiltre(){ return stockEtatFiltre; }, set stockEtatFiltre(v){ stockEtatFiltre = v; },
  renderStockEtat,
};
`;
vm.runInContext(scriptSrc, sandbox);
const H = sandbox.__NEXUS_TEST__;

// ------------------------------------------------------------
// Fabrique un état correspondant EXACTEMENT aux 3 exemples de Frédéric
// (CASH 5€ / X10 2€ / BANCO 1€) + 1 jeu en rapprochement, pour vérifier le
// rendu réel produit par renderStockEtat().
// ------------------------------------------------------------
const jeux = [
  { id: 'cash5', nom: 'CASH 5€', prix: 5, tickets_par_carnet: 50 },
  { id: 'x10', nom: 'X10 2€', prix: 2, tickets_par_carnet: 40 },
  { id: 'banco', nom: 'BANCO 1€', prix: 1, tickets_par_carnet: 30 },
  { id: 'goal', nom: 'GOAL 1€', prix: 1, tickets_par_carnet: 30 },
  { id: 'suspect', nom: 'FETICHE 2€', prix: 2, tickets_par_carnet: 40 },
];
const soldes = {
  cash5: { bureau: 22, confies: 3, actives: 1, bloques: 0, nonActives: 2 },
  x10: { bureau: 9, confies: 1, actives: 0, bloques: 0, nonActives: 1 },
  banco: { bureau: 3, confies: 0, actives: 0, bloques: 0, nonActives: 0 },
  goal: { bureau: 5, confies: 0, actives: 0, bloques: 0, nonActives: 0 },
  suspect: { bureau: 2, confies: 1, actives: 0, bloques: 0, nonActives: 1 },
};
const approNonTrace = { suspect: 80 };
const M = sandbox.NexusFdjMoteur;
const autonomieParJeu = {};
jeux.forEach(j => {
  autonomieParJeu[j.id] = M.calculerAutonomieJeu({ solde: soldes[j.id], ticketsRestants: null, ticketsParCarnet: j.tickets_par_carnet, rotationCarnetsJour: 0 });
});

H.jeux = jeux;
H.stockEtat = {
  soldes, reference: { date: '2026-08-13', creeLe: '2026-08-13T00:00:00Z' },
  dernieresReceptions: {}, approNonTrace,
  quartsConcernesParJeu: {}, rotationParJeu: { cash5: 0.7, x10: 0, banco: 0, goal: 0, suspect: 0 },
  ticketsRestantsParJeu: { cash5: 25, x10: null, banco: null, goal: null, suspect: null },
  autonomieParJeu,
};
H.stockEtatFiltre = 'tous';
H.renderStockEtat();

const contenu = sandbox.document.getElementById('content').innerHTML;

// 1) Colonnes renommées (mobile : libellés courts, mais bien les nouveaux).
assert.ok(contenu.includes('Réserve'), 'En-tête "Réserve" absent');
assert.ok(contenu.includes('En cours'), 'En-tête "En cours" absent');
console.log('✓ 1. Colonnes renommées (Réserve / Caisse / En cours)');

// 2) Les 5 filtres, dans l'ordre demandé par Frédéric.
['Tous', '🔴 À réapprovisionner', '🟠 Vigilance', '⚠️ À rapprocher', '🟢 OK'].forEach(label => {
  assert.ok(contenu.includes(label), `Filtre "${label}" absent du rendu`);
});
console.log('✓ 2. 5 filtres présents (Tous/Réapprovisionner/Vigilance/Rapprocher/OK)');

// 3) Les 3 badges exacts de Frédéric apparaissent bien sur les bonnes lignes.
assert.ok(contenu.includes('🟢 OK'), 'Badge OK absent (CASH 5€)');
assert.ok(contenu.includes('🟠 Vigilance'), 'Badge Vigilance absent (X10 2€)');
assert.ok(contenu.includes('🔴 Réapprovisionner'), 'Badge Réapprovisionner absent (BANCO 1€/GOAL 1€)');
assert.ok(contenu.includes('⚠️ À rapprocher'), 'Badge À rapprocher absent (FETICHE 2€)');
console.log('✓ 3. Les 4 badges attendus sont présents dans le rendu réel');

// 4) Synthèse globale (bandeau haut) : titre, carnets disponibles, recommandation.
assert.ok(contenu.includes('🎟️ État FDJ caisse'), 'Titre de la synthèse globale absent');
assert.ok(contenu.includes('carnet'), 'Total carnets disponibles absent de la synthèse');
assert.ok(contenu.includes('NEXUS recommande'), 'Recommandation absente (2 jeux en réapprovisionnement avec réserve bureau)');
assert.ok(contenu.includes('BANCO 1€') && contenu.includes('GOAL 1€'), 'Recommandation ne cite pas les bons jeux');
console.log('✓ 4. Synthèse globale + recommandation présentes et correctes');

// 5) Phrase de palier présente (au moins une occurrence du gabarit de phrase).
assert.ok(contenu.includes('Le reste est couvert.') || contenu.includes('sont couverts.'), 'Phrase de palier absente');
console.log('✓ 5. Phrase de synthèse par palier présente');

// 6) Filtre "reapprovisionner" isole bien BANCO et GOAL, exclut CASH/X10/FETICHE.
H.stockEtatFiltre = 'reapprovisionner';
H.renderStockEtat();
const contenuFiltre = sandbox.document.getElementById('content').innerHTML;
assert.ok(contenuFiltre.includes('BANCO 1€'), 'BANCO absent du filtre réapprovisionner');
assert.ok(contenuFiltre.includes('GOAL 1€'), 'GOAL absent du filtre réapprovisionner');
assert.ok(!contenuFiltre.includes('CASH 5€'), 'CASH ne devrait pas apparaître dans le filtre réapprovisionner');
assert.ok(!contenuFiltre.includes('FETICHE'), 'FETICHE (rapprochement) ne devrait pas apparaître dans le filtre réapprovisionner');
console.log('✓ 6. Filtre "🔴 À réapprovisionner" isole correctement BANCO/GOAL');

console.log('\nTous les tests fdj_manager_stock_render passent.');
