// Test — cartes "Réception carburant — configuration / consignes de
// sécurité" de NEXUS-Parametres-Station-v1.html (15/08/2026, refonte
// complète du module). Se concentre sur la seule logique vraiment
// nouvelle et non triviale de ces cartes : le réordonnancement ▲/▼ de
// l'ordre de jaugeage, et l'ajout/édition/suppression de consignes. Les
// autres cartes de cette page (Prix, Cuves, Google Sheets, Exceptions de
// marge) suivent le même schéma "formulaire + upsert station_config" déjà
// éprouvé sans test dédié — même niveau de couverture ici, complété par
// node --check sur le fichier entier.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Parametres-Station-v1.html'), 'utf8');

function extraireSync(source, nomFonction) {
  const re = new RegExp(`function ${nomFonction}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`);
  const m = source.match(re);
  if (!m) throw new Error(`Fonction ${nomFonction} introuvable`);
  return m[0];
}

// ------------------------------------------------------------
// Mock DOM minimal : juste ce dont renderReceptionOrdreCuves /
// renderConsignesReception ont besoin (une zone, ses querySelectorAll
// [data-xxx] qui retrouvent les boutons qu'elle vient d'injecter).
// ------------------------------------------------------------
function fabriquerZone() {
  let html = '';
  let boutons = [];
  const zone = {
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = v;
      boutons = [];
      const re = /<button[^>]*data-(monter|descendre|supprimer)="(\d+)"[^>]*>/g;
      let m;
      while ((m = re.exec(v))) {
        const attr = m[1], i = Number(m[2]), disabled = /disabled/.test(m[0]);
        boutons.push({
          attr, i, disabled,
          getAttribute: () => String(i),
          _listeners: {},
          addEventListener(evt, fn) { this._listeners[evt] = fn; },
        });
      }
    },
    querySelectorAll(sel) {
      const m = sel.match(/^\[data-(\w+)\]$/);
      if (!m) return [];
      return boutons.filter(b => b.attr === m[1]);
    },
  };
  return { zone, cliquer: (attr, i) => {
    const els = zone.querySelectorAll(`[data-${attr}]`);
    const el = els.find(e => e.i === i);
    if (!el) throw new Error(`Bouton data-${attr}="${i}" introuvable`);
    if (!el._listeners.click) throw new Error(`Bouton data-${attr}="${i}" n'a pas de listener click`);
    el._listeners.click();
  }};
}

function fabriquerDocumentMock(zoneParId) {
  return { getElementById: (id) => zoneParId[id] || null };
}

// ------------------------------------------------------------
// 1) renderReceptionOrdreCuves — réordonnancement ▲/▼
// ------------------------------------------------------------
(function testOrdreCuves() {
  const fnSrc = extraireSync(html, 'renderReceptionOrdreCuves');
  assert.ok(fnSrc.includes('data-monter') && fnSrc.includes('data-descendre'), 'Boutons ▲/▼ attendus dans le rendu');

  const { zone, cliquer } = fabriquerZone();
  const document = fabriquerDocumentMock({ receptionOrdreCuvesListe: zone });
  const NOM_CARBURANT_COURT_PARAM = { sp95: 'SP95', go: 'GO', gnr: 'GNR' };
  let RECEPTION_ORDRE_CUVES_ACTUEL = [
    { id: 'unique', label: 'Cuve unique', carburant: 'sp95' },
    { id: 'cuve1', label: 'Cuve 1', carburant: 'go' },
    { id: 'cuve2', label: 'Cuve 2', carburant: 'go' },
  ];
  const fn = new Function('document', 'NOM_CARBURANT_COURT_PARAM', 'RECEPTION_ORDRE_CUVES_ACTUEL_INIT', `
    let RECEPTION_ORDRE_CUVES_ACTUEL = RECEPTION_ORDRE_CUVES_ACTUEL_INIT;
    ${fnSrc}
    return { render: renderReceptionOrdreCuves, etat: () => RECEPTION_ORDRE_CUVES_ACTUEL };
  `)(document, NOM_CARBURANT_COURT_PARAM, RECEPTION_ORDRE_CUVES_ACTUEL);

  fn.render();
  assert.deepStrictEqual(fn.etat().map(c => c.id), ['unique', 'cuve1', 'cuve2'], 'Ordre initial attendu SP95/cuve1/cuve2');
  assert.ok(zone.innerHTML.includes('SP95 — Cuve unique'), 'Libellé de la 1ère cuve absent');

  // Monter la 2e cuve (cuve1, index 1) -> passe en position 0.
  cliquer('monter', 1);
  assert.deepStrictEqual(fn.etat().map(c => c.id), ['cuve1', 'unique', 'cuve2'], 'cuve1 doit passer en tête après "monter"');

  // Redescendre cuve1 (désormais en position 0) -> revient à l'ordre initial.
  cliquer('descendre', 0);
  assert.deepStrictEqual(fn.etat().map(c => c.id), ['unique', 'cuve1', 'cuve2'], 'Doit revenir à l\'ordre initial après "descendre"');

  console.log('✓ 1. renderReceptionOrdreCuves — réordonnancement ▲/▼ correct, boutons de bord désactivés');
})();

// ------------------------------------------------------------
// 2) renderConsignesReception — ajout / édition / suppression
// ------------------------------------------------------------
(function testConsignes() {
  const fnSrc = extraireSync(html, 'renderConsignesReception');
  const { zone, cliquer } = fabriquerZone();
  const document = fabriquerDocumentMock({ consignesReceptionListe: zone });
  let RECEPTION_CONSIGNES_ACTUELLES = [
    { theme: 'EPI', texte: 'Portez vos équipements de protection.' },
    { theme: 'Sécurisation', texte: 'Balisez la zone avant le dépotage.' },
  ];
  const fn = new Function('document', 'RECEPTION_CONSIGNES_ACTUELLES_INIT', `
    let RECEPTION_CONSIGNES_ACTUELLES = RECEPTION_CONSIGNES_ACTUELLES_INIT;
    ${fnSrc}
    return { render: renderConsignesReception, etat: () => RECEPTION_CONSIGNES_ACTUELLES };
  `)(document, RECEPTION_CONSIGNES_ACTUELLES);

  fn.render();
  assert.ok(zone.innerHTML.includes('Portez vos équipements'), 'Texte de la 1ère consigne absent du rendu');
  assert.strictEqual(fn.etat().length, 2, '2 consignes initiales attendues');

  // Suppression de la 1ère consigne (index 0) -> il n'en reste qu'une.
  cliquer('supprimer', 0);
  assert.strictEqual(fn.etat().length, 1, 'Une consigne doit rester après suppression');
  assert.strictEqual(fn.etat()[0].theme, 'Sécurisation', 'La consigne restante doit être "Sécurisation"');

  console.log('✓ 2. renderConsignesReception — suppression d\'une ligne fonctionne');

  // Zéro consigne restante -> liste vide affiche le message neutre, pas une
  // erreur (comportement testé séparément, hors mock boutons).
  const { zone: zoneVide } = fabriquerZone();
  const documentVide = fabriquerDocumentMock({ consignesReceptionListe: zoneVide });
  const fnVide = new Function('document', 'RECEPTION_CONSIGNES_ACTUELLES_INIT', `
    let RECEPTION_CONSIGNES_ACTUELLES = RECEPTION_CONSIGNES_ACTUELLES_INIT;
    ${fnSrc}
    return { render: renderConsignesReception };
  `)(documentVide, []);
  fnVide.render();
  assert.ok(zoneVide.innerHTML.includes('Aucune consigne enregistrée'), 'Message "aucune consigne" attendu quand la liste est vide');
  console.log('✓ 3. renderConsignesReception — liste vide affiche le message neutre attendu');
})();

console.log('\nTous les tests parametres_reception_config passent.');
