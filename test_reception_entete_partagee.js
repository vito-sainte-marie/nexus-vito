// Test — reprise transporteur/chauffeur/immatriculation/n° BL-facture entre
// carburants d'une même visite camion (14/08/2026, demande de Frédéric).
//
// Reproduit, sans navigateur headless (aucun disponible dans ce sandbox,
// même convention que les tests DOM-mock précédents du projet), le
// scénario réel signalé : l'employé saisit le transporteur/chauffeur/
// immatriculation/n° BL pour le GO, valide, clique "Ajouter un autre
// carburant" pour le GNR — ces 4 champs doivent être déjà remplis, sans
// resaisie. On vérifie aussi que TRANSHYDRO SARL est bien la valeur par
// défaut du tout premier passage, et que "Retour à l'accueil" efface la
// mémoire (pour ne pas polluer une visite camion sans rapport).
//
// Technique : vm.runInContext sur le <script> inline extrait du fichier
// réel, avec un mock DOM minimal (registre d'éléments par id + parsing
// des value="..." injectés dans #content.innerHTML, pour reproduire
// fidèlement le cycle "on écrit le HTML avec la valeur JS courante, puis
// on relit immédiatement ces mêmes champs pour resynchroniser l'état").
// Les `let`/`const` de plus haut niveau du script (entete,
// dernierEnTeteMemorise, carburantChoisi, cuvesDuCarburant, etc.) ne
// deviennent pas des propriétés du contexte vm — seules les déclarations
// `function` le deviennent — d'où le handle `globalThis.__NEXUS_TEST__`
// ajouté à la fin du script exécuté, exposant des getters/setters live.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Carburant-Reception-v1.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Attendu 1 <script> inline, trouvé ${scripts.length}`);
let scriptSrc = scripts[0];

// ------------------------------------------------------------
// Mock DOM minimal
// ------------------------------------------------------------
function fabriquerDocument() {
  const registre = new Map();
  function elementPour(id) {
    if (!registre.has(id)) {
      registre.set(id, {
        id, value: '', textContent: '', disabled: false, checked: false,
        style: {}, dataset: {},
        _innerHTML: '',
        _listeners: {},
        classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
        addEventListener(evt, fn) { this._listeners[evt] = fn; },
        get innerHTML() { return this._innerHTML; },
        set innerHTML(html) {
          this._innerHTML = html;
          // Resynchronise les inputs texte/nombre déclarés dans ce bloc :
          // <input ... id="X" ... value="Y"> — même ordre d'attributs que
          // renderLivraison() dans le fichier réel.
          const re = /id="([\w]+)"[^>]*?value="([^"]*)"/g;
          let m;
          while ((m = re.exec(html))) {
            const el = elementPour(m[1]);
            el.value = m[2];
          }
        },
      });
    }
    return registre.get(id);
  }
  return {
    getElementById: elementPour,
    querySelectorAll() { return []; },
    querySelector() { return null; },
    _registre: registre,
  };
}

const documentMock = fabriquerDocument();
const sandbox = {
  document: documentMock,
  console,
  window: {},
  // nexusRequireAuth().then(...) démarre l'init réel en bas du fichier —
  // on ne veut PAS qu'il s'exécute pour ce test (dépendrait de nexusClient,
  // NexusReceptionMoteur, etc., hors-sujet ici) : une Promise jamais
  // résolue le neutralise sans erreur.
  nexusRequireAuth: () => new Promise(() => {}),
  nexusClient: {},
  NexusReceptionMoteur: {},
  NexusReceptionDonnees: {},
  setInterval: () => 0,
  setTimeout: (fn) => fn && fn(),
  Date,
};
vm.createContext(sandbox);

scriptSrc += `
;globalThis.__NEXUS_TEST__ = {
  get entete(){ return entete; },
  get dernierEnTeteMemorise(){ return dernierEnTeteMemorise; },
  set dernierEnTeteMemorise(v){ dernierEnTeteMemorise = v; },
  get TRANSPORTEUR_DEFAUT(){ return TRANSPORTEUR_DEFAUT; },
  demarrerReception,
  allerEtape,
};
`;
vm.runInContext(scriptSrc, sandbox);
const H = sandbox.__NEXUS_TEST__;

assert.strictEqual(H.TRANSPORTEUR_DEFAUT, 'TRANSHYDRO SARL', 'TRANSPORTEUR_DEFAUT doit être TRANSHYDRO SARL');

// ------------------------------------------------------------
// 1) Premier passage (GO) — aucune mémoire : transporteur par défaut,
//    le reste vide.
// ------------------------------------------------------------
H.demarrerReception('go');
assert.strictEqual(H.entete.transporteur, 'TRANSHYDRO SARL', '1er passage : transporteur par défaut');
assert.strictEqual(H.entete.chauffeur, '', '1er passage : chauffeur vide');
assert.strictEqual(H.entete.immatriculation, '', '1er passage : immatriculation vide');
assert.strictEqual(H.entete.bon_livraison_reference, '', '1er passage : n° BL/facture vide');
assert.strictEqual(H.entete.quantite_bl_l, '', '1er passage : quantité BL vide');
console.log('✓ 1. Premier passage (GO) — transporteur par défaut, reste vide');

// L'employé saisit les infos du camion pour le GO.
H.entete.transporteur = 'TRANSHYDRO SARL';
H.entete.chauffeur = 'Reuperné';
H.entete.immatriculation = 'BX-816-S7';
H.entete.bon_livraison_reference = 'FAC-20260814-042';
H.entete.quantite_bl_l = '16000';

// Simule le clic "Ajouter un autre carburant" (mémorise, sans reprendre
// quantite_bl_l qui est propre au GO).
H.dernierEnTeteMemorise = {
  transporteur: H.entete.transporteur,
  chauffeur: H.entete.chauffeur,
  immatriculation: H.entete.immatriculation,
  bon_livraison_reference: H.entete.bon_livraison_reference,
};

// ------------------------------------------------------------
// 2) Deuxième passage (GNR, même camion) — tout est repris SAUF la
//    quantité BL (propre à chaque carburant).
// ------------------------------------------------------------
H.demarrerReception('gnr');
assert.strictEqual(H.entete.transporteur, 'TRANSHYDRO SARL', '2e passage : transporteur repris');
assert.strictEqual(H.entete.chauffeur, 'Reuperné', '2e passage : chauffeur repris');
assert.strictEqual(H.entete.immatriculation, 'BX-816-S7', '2e passage : immatriculation reprise');
assert.strictEqual(H.entete.bon_livraison_reference, 'FAC-20260814-042', '2e passage : n° BL/facture repris');
assert.strictEqual(H.entete.quantite_bl_l, '', '2e passage : quantité BL NON reprise (propre au GNR)');
console.log('✓ 2. Deuxième passage (GNR, même camion) — transporteur/chauffeur/immat/BL-facture repris, quantité BL vide');

// ------------------------------------------------------------
// 3) "Retour à l'accueil" efface la mémoire — un 3e passage sans mémoire
//    revient au comportement par défaut.
// ------------------------------------------------------------
H.dernierEnTeteMemorise = null;
H.demarrerReception('sp95');
assert.strictEqual(H.entete.transporteur, 'TRANSHYDRO SARL', '3e passage (mémoire effacée) : transporteur par défaut');
assert.strictEqual(H.entete.chauffeur, '', '3e passage (mémoire effacée) : chauffeur vide');
assert.strictEqual(H.entete.immatriculation, '', '3e passage (mémoire effacée) : immatriculation vide');
assert.strictEqual(H.entete.bon_livraison_reference, '', '3e passage (mémoire effacée) : n° BL/facture vide');
console.log('✓ 3. Mémoire effacée ("Retour à l\'accueil") — nouveau passage repart à zéro');

console.log('\nTous les tests reception_entete_partagee passent.');
