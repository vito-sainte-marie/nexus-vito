// Test — brouillon local de la réception carburant (04/11/2026, demande
// Guardian 6638491022). Écran seul : aucune écriture serveur ajoutée.
//
// Couvre : sauvegarde à chaque étape, reprise après rechargement simulé avec
// valeurs identiques, même idempotencyKey, effacement après succès, brouillon
// de plus de 12 h ignoré, stockage indisponible (la page marche, bandeau
// affiché), « ‹ Précédent » qui recule d'une étape, et aucun appel serveur
// supplémentaire. Technique : vm.runInContext sur le <script> inline réel.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Carburant-Reception-v1.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Attendu 1 <script> inline, trouvé ${scripts.length}`);
const moteurSrc = fs.readFileSync(path.join(DIR, 'nexus-reception-moteur.js'), 'utf8');
const authSrc = fs.readFileSync(path.join(DIR, 'nexus-auth.js'), 'utf8').match(/function nexusEstManager\([\s\S]*?\n}/)[0];

function fabriquerDocument() {
  const registre = new Map();
  function elementPour(id) {
    if (!registre.has(id)) {
      registre.set(id, {
        id, value: '', textContent: '', disabled: false, checked: false, style: {}, dataset: {},
        _innerHTML: '', _listeners: {},
        classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
        offsetWidth: 0,
        addEventListener(evt, fn) { (this._listeners[evt] = this._listeners[evt] || []).push(fn); },
        get innerHTML() { return this._innerHTML; },
        set innerHTML(v) { this._innerHTML = v; },
      });
    }
    return registre.get(id);
  }
  return { getElementById: elementPour, querySelectorAll() { return []; }, querySelector() { return null; }, addEventListener() {}, visibilityState: 'visible', _registre: registre };
}

const configFixture = {
  cuvesOrdonnees: [{ id: 'unique', label: 'Cuve unique', capacite: 30000, carburant: 'sp95' }],
  cuvesCarburants: { sp95: { actif: true, cuves: [{ id: 'unique', label: 'Cuve unique', capacite: 30000 }] }, go: { actif: false, cuves: [] }, gnr: { actif: false, cuves: [] } },
  nombreCompartimentsDefaut: 2, seuilEcartCompartimentsPct: 2, seuilEcartMesurePct: 2, consignesSecurite: [], contactManager: {},
};

function fabriquerStockage({ refuse = false } = {}) {
  const m = new Map();
  return {
    _m: m,
    getItem(k) { if (refuse) throw new Error('SecurityError'); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (refuse) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem(k) { if (refuse) throw new Error('SecurityError'); m.delete(k); },
  };
}

// Charge la page comme après un (re)chargement du navigateur, sur un stockage donné.
async function chargerPage(stockage) {
  const appels = { soumissions: 0 };
  const documentMock = fabriquerDocument();
  const fenetre = { NexusHeaderNav: { surRetour: null }, addEventListener() {} };
  const sandbox = {
    document: documentMock, window: fenetre, localStorage: stockage, console,
    nexusRequireAuth: () => Promise.resolve({ id: 'emp1', nom: 'Loane', site_id: 'site-test' }),
    nexusClient: { from() { return { select(){return this;}, eq(){return this;}, in(){return this;}, then(r){ r({ data: [], error: null }); } }; } },
    setInterval: () => 0, Date,
    alert: (msg) => { throw new Error(`alert() inattendu : ${msg}`); },
    confirm: () => { throw new Error('confirm() natif interdit sur Recommencer'); },
    crypto: { randomUUID: () => require('crypto').randomUUID() },
  };
  sandbox.window = sandbox; sandbox.NexusHeaderNav = fenetre.NexusHeaderNav; sandbox.addEventListener = fenetre.addEventListener;
  vm.createContext(sandbox);
  vm.runInContext(moteurSrc, sandbox);
  sandbox.NexusReceptionDonnees = {
    async chargerConfigReception() { return configFixture; },
    async chargerHistoriqueEcartsRatio() { return []; },
    async soumettreVisiteComplete() { appels.soumissions++; return { data: { id: 'v1' } }; },
  };
  vm.runInContext(authSrc, sandbox);
  vm.runInContext(scripts[0] + `
;globalThis.__NEXUS_TEST__ = {
  get etape(){ return etape; }, get visite(){ return visite; }, get lignes(){ return lignes; },
  get idempotencyKey(){ return idempotencyKey; }, get brouillonEnAttente(){ return brouillonEnAttente; },
  get regularisation(){ return regularisation; },
  demarrerVisite, allerEtape, sauvegarderBrouillon, effacerBrouillon, restaurerBrouillon, cleBrouillon,
};`, sandbox);
  for (let i = 0; i < 40 && !(sandbox.__NEXUS_TEST__ && sandbox.__NEXUS_TEST__.etape); i++) await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
  const H = sandbox.__NEXUS_TEST__;
  H.contenu = () => documentMock.getElementById('content');
  H.cliquer = (id) => (documentMock.getElementById(id)._listeners.click || []).forEach(f => f());
  H.retour = () => fenetre.NexusHeaderNav.surRetour();
  H.fenetre = fenetre; fenetre.NexusHeaderNav = sandbox.NexusHeaderNav; H.appels = appels; H.sandbox = sandbox;
  return H;
}

(async () => {
  // 1) Sauvegarde à chaque étape.
  const st = fabriquerStockage();
  let H = await chargerPage(st);
  assert.strictEqual(st._m.size, 0, 'Rien n\'est enregistré avant le début d\'une réception');
  H.demarrerVisite();
  const cle = H.cleBrouillon();
  assert.ok(/^nexus_reception_brouillon_emp1_site-test_\d{4}-\d{2}-\d{2}$/.test(cle), `clé inattendue : ${cle}`);
  for (const e of ['livraison', 'jaugeage_avant', 'compartiments', 'reception', 'jaugeage_final']) {
    H.allerEtape(e);
    const b = JSON.parse(st.getItem(cle));
    assert.strictEqual(b.etape, e, `étape ${e} enregistrée`);
    assert.strictEqual(b.v, 1, 'version de format');
    assert.strictEqual(b.idempotencyKey, H.idempotencyKey);
  }
  assert.ok(/Enregistré sur cet appareil à \d{2}:\d{2}/.test(H.contenu().innerHTML), 'Texte honnête sous le stepper');
  assert.ok(!/envoy|serveur/i.test(H.contenu().innerHTML.match(/brouillonEtat[^<]*</)[0]), 'Ne suggère jamais un envoi serveur');
  console.log('✓ 1. Sauvegarde à chaque étape, clé versionnée, texte « Enregistré sur cet appareil »');

  // 2) Saisie (événement input) + reprise après rechargement simulé.
  H.allerEtape('livraison');
  H.visite.chauffeur = 'Jean Dupont'; H.visite.immatriculation = 'AB-123-CD';
  (H.contenu()._listeners.input || []).forEach(f => f());
  const cleAvant = H.idempotencyKey;
  const H2 = await chargerPage(st); // « rechargement » : nouveau contexte, même stockage
  assert.strictEqual(H2.etape, 'accueil');
  assert.ok(H2.brouillonEnAttente, 'Brouillon proposé');
  assert.ok(/Une réception commencée à \d+ h \d{2} \(étape : Livraison attendue\) n'est pas terminée/.test(H2.contenu().innerHTML), H2.contenu().innerHTML);
  assert.ok(/id="btnReprendre"/.test(H2.contenu().innerHTML) && /id="btnRecommencer"/.test(H2.contenu().innerHTML));
  H2.cliquer('btnReprendre');
  assert.strictEqual(H2.etape, 'livraison');
  assert.strictEqual(H2.visite.chauffeur, 'Jean Dupont');
  assert.strictEqual(H2.visite.immatriculation, 'AB-123-CD');
  console.log('✓ 2. Reprise après rechargement : étape et valeurs identiques');

  // 3) Même idempotencyKey.
  assert.strictEqual(H2.idempotencyKey, cleAvant, 'idempotencyKey conservée à la reprise');
  console.log('✓ 3. Même idempotencyKey après reprise');

  // 4) Recommencer : confirmation dans la page (pas de confirm natif), puis effacement.
  const H3 = await chargerPage(st);
  H3.cliquer('btnRecommencer');
  assert.ok(/id="btnConfirmerRecommencer"/.test(H3.contenu().innerHTML), 'Confirmation dans la page');
  assert.ok(st.getItem(cle), 'Rien n\'est effacé avant confirmation');
  H3.cliquer('btnConfirmerRecommencer');
  assert.strictEqual(st.getItem(cle), null, 'Brouillon effacé après confirmation');
  assert.strictEqual(H3.brouillonEnAttente, null);
  console.log('✓ 4. Recommencer : confirmation dans la page puis effacement');

  // 5) Effacé après succès (soumission réelle de bout en bout non rejouée :
  //    le chemin « succes » appelle effacerBrouillon, et l'étape succès ne réécrit rien).
  const H4 = await chargerPage(fabriquerStockage());
  H4.demarrerVisite();
  const cle4 = H4.cleBrouillon();
  const st4 = H4.sandbox.localStorage;
  assert.ok(st4.getItem(cle4));
  H4.effacerBrouillon(); H4.allerEtape('succes');
  assert.strictEqual(st4.getItem(cle4), null, 'Rien n\'est réécrit à l\'écran de succès');
  assert.ok(/effacerBrouillon\(\);\s*allerEtape\('succes'\)/.test(scripts[0]), 'soumettreVisite efface le brouillon juste avant le succès');
  console.log('✓ 5. Brouillon effacé après succès');

  // 6) Brouillon de plus de 12 h ignoré (et purgé).
  const st6 = fabriquerStockage();
  const H5 = await chargerPage(st6);
  H5.demarrerVisite();
  const cle6 = H5.cleBrouillon();
  const b6 = JSON.parse(st6.getItem(cle6));
  b6.sauvegarde_le = new Date(Date.now() - 13 * 3600 * 1000).toISOString();
  st6.setItem(cle6, JSON.stringify(b6));
  const H6 = await chargerPage(st6);
  assert.strictEqual(H6.brouillonEnAttente, null, 'Brouillon de 13 h ignoré');
  assert.ok(!/btnReprendre/.test(H6.contenu().innerHTML));
  b6.sauvegarde_le = new Date(Date.now() - 11 * 3600 * 1000).toISOString();
  st6.setItem(cle6, JSON.stringify(b6));
  assert.ok((await chargerPage(st6)).brouillonEnAttente, 'Brouillon de 11 h repris');
  console.log('✓ 6. Brouillon > 12 h ignoré, < 12 h repris');

  // 7) Stockage indisponible : la page fonctionne, bandeau discret.
  const H7 = await chargerPage(fabriquerStockage({ refuse: true }));
  assert.ok(/Sauvegarde automatique indisponible sur cet appareil/.test(H7.contenu().innerHTML), 'Bandeau à l\'accueil');
  H7.demarrerVisite();
  assert.strictEqual(H7.etape, 'livraison', 'La réception démarre quand même');
  assert.ok(/Sauvegarde automatique indisponible sur cet appareil/.test(H7.contenu().innerHTML), 'Bandeau pendant la réception');
  H7.allerEtape('jaugeage_avant');
  assert.strictEqual(H7.etape, 'jaugeage_avant');
  console.log('✓ 7. Stockage indisponible : page utilisable + bandeau');

  // 8) « ‹ Précédent » recule d'une étape, quitte la page seulement à l'accueil.
  const H8 = await chargerPage(fabriquerStockage());
  assert.strictEqual(H8.retour(), false, 'À l\'accueil : on laisse l\'historique faire');
  H8.demarrerVisite();
  H8.allerEtape('reception');
  assert.strictEqual(H8.retour(), true); assert.strictEqual(H8.etape, 'compartiments');
  assert.strictEqual(H8.retour(), true); assert.strictEqual(H8.etape, 'jaugeage_avant');
  assert.strictEqual(H8.retour(), true); assert.strictEqual(H8.etape, 'livraison');
  assert.strictEqual(H8.retour(), true); assert.strictEqual(H8.etape, 'accueil');
  assert.ok(H8.brouillonEnAttente, 'Le brouillon reste proposé en revenant à l\'accueil');
  assert.strictEqual(H8.retour(), false);
  console.log('✓ 8. « ‹ Précédent » recule d\'une étape ; quitte la page seulement à l\'accueil');

  // 9) Aucun appel serveur ajouté.
  assert.strictEqual([H, H2, H3, H4, H5, H6, H7, H8].reduce((n, h) => n + h.appels.soumissions, 0), 0, 'Aucune soumission déclenchée par le brouillon');
  console.log('✓ 9. Aucune écriture serveur ajoutée');

  console.log('\nTous les tests reception_brouillon_local passent.');
})().catch(e => { console.error(e); process.exit(1); });
