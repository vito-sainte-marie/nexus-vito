// Test — régularisation d'une réception passée à partir d'un relevé terrain
// manuscrit (19/09/2026), dans NEXUS-Carburant-Reception-v1.html.
//
// Le cas qui a motivé ce parcours : une livraison a bien eu lieu, elle a
// bien été jaugée, mais sur papier — le pompiste n'avait pas accès à son
// rôle au moment du dépotage, et la saisie NEXUS n'a pu être faite que
// plusieurs jours après. Le risque n'est pas de perdre les chiffres : c'est
// que NEXUS laisse croire qu'ils ont été relevés électroniquement le jour
// même. Ce test vérifie donc surtout que les TROIS dates restent
// distinctes de bout en bout :
//   1. la livraison réelle          -> heure_debut / heure_fin / date_visite
//   2. les mesures terrain          -> jaugeage_avant_le / jaugeage_apres_le
//   3. la saisie dans NEXUS         -> regularisation_le (et created_at, posé
//                                      par la base, jamais envoyé d'ici)
//
// Même harnais que test_reception_visite_render.js (vrai script inline
// exécuté dans un contexte vm avec un mock DOM), mais instancié plusieurs
// fois : le rôle de l'employé connecté change d'un scénario à l'autre.
//
// Scénarios :
//  1) Droits : un pompiste ne voit pas l'entrée "Régulariser une réception
//     passée" ; un manager la voit — et l'appel direct ne le contourne pas.
//  2) Étape Livraison du cas du 18/09 (valeurs fictives) : BL GO 16 000 L
//     + SP95 12 000 L, date réelle saisie, motif obligatoire.
//  3) Garde chronologique : NEXUS refuse une suite d'heures impossible au
//     lieu de la corriger en silence.
//  4) Calcul BL vs mesuré, reconstruit par la méthode normale.
//  5) Soumission : les trois dates, la provenance, l'auteur, et la date de
//     mesure transmise au pont de stock (18/09, jamais le jour de saisie).
//  6) Non-régression du temps réel : aucun champ de régularisation, aucune
//     date de mesure imposée au pont.
//  7) Doublon : une réception déjà enregistrée à la date saisie bloque le
//     parcours et s'affiche ; une lecture en échec bloque aussi. Le temps
//     réel n'est pas concerné.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Carburant-Reception-v1.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Attendu 1 <script> inline, trouvé ${scripts.length}`);
const scriptSrc = scripts[0];
const moteurSrc = fs.readFileSync(path.join(DIR, 'nexus-reception-moteur.js'), 'utf8');

// ------------------------------------------------------------
// Mock DOM générique (identique à test_reception_visite_render.js)
// ------------------------------------------------------------
function parseAttrs(attrStr) {
  const out = {};
  const re = /([a-zA-Z_-][\w-]*)(?:="([^"]*)")?/g;
  let m;
  while ((m = re.exec(attrStr))) out[m[1]] = m[2] !== undefined ? m[2] : '';
  return out;
}
function fabriquerStub(attrs, indexer) {
  return {
    _attrs: attrs,
    value: attrs.value !== undefined ? attrs.value : '',
    textContent: '', _innerHTML: '',
    disabled: 'disabled' in attrs,
    style: {}, dataset: {},
    classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
    _listeners: {},
    addEventListener(evt, fn) { this._listeners[evt] = fn; },
    getAttribute(n) { return this._attrs[n] !== undefined ? this._attrs[n] : null; },
    click() { if (this._listeners.click) this._listeners.click(); },
    dispatchEvent(evt) { const fn = this._listeners[evt]; if (fn) fn({ target: this }); },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = v; if (indexer) indexer(v, { reset: false }); },
  };
}
function fabriquerDocument() {
  let byId = {};
  let byAttr = {};
  const registreExterne = new Map();
  function indexerFragment(htmlStr, { reset }) {
    if (reset) { byId = {}; byAttr = {}; }
    const reTag = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z_-][\w-]*(?:="[^"]*")?)*)\s*\/?>/g;
    let m;
    while ((m = reTag.exec(htmlStr))) {
      const attrs = parseAttrs(m[2]);
      const stub = fabriquerStub(attrs, indexerFragment);
      if (attrs.id) byId[attrs.id] = stub;
      Object.keys(attrs).forEach(a => {
        if (a.startsWith('data-')) { byAttr[a] = byAttr[a] || []; byAttr[a].push(stub); }
      });
    }
  }
  const contentStub = {
    classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
    offsetWidth: 0,
    get innerHTML() { return this._html || ''; },
    set innerHTML(v) { this._html = v; indexerFragment(v, { reset: true }); },
  };
  function elementExterne(id) {
    if (!registreExterne.has(id)) {
      registreExterne.set(id, {
        id, value: '', textContent: '', _innerHTML: '', style: {},
        classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
        addEventListener(){}, click(){},
        get innerHTML() { return this._innerHTML; },
        set innerHTML(v) { this._innerHTML = v; },
      });
    }
    return registreExterne.get(id);
  }
  return {
    getElementById(id) {
      if (id === 'content') return contentStub;
      if (byId[id]) return byId[id];
      return elementExterne(id);
    },
    querySelectorAll(selector) {
      const m = selector.match(/^\[([\w-]+)\]$/);
      if (!m) return [];
      return byAttr[m[1]] || [];
    },
    querySelector() { return null; },
  };
}

const configFixture = {
  cuvesOrdonnees: [
    { id: 'unique', label: 'Cuve unique', capacite: 30000, carburant: 'sp95' },
    { id: 'cuve1', label: 'Cuve 1', capacite: 20000, carburant: 'go' },
    { id: 'cuve2', label: 'Cuve 2', capacite: 10000, carburant: 'go' },
  ],
  cuvesCarburants: {
    sp95: { actif: true, cuves: [{ id: 'unique', label: 'Cuve unique', capacite: 30000 }] },
    go: { actif: true, cuves: [{ id: 'cuve1', label: 'Cuve 1', capacite: 20000 }, { id: 'cuve2', label: 'Cuve 2', capacite: 10000 }] },
  },
  nombreCompartimentsDefaut: 3,
  seuilEcartCompartimentsPct: 2,
  seuilEcartMesurePct: 2,
  consignesSecurite: [{ theme: 'EPI', texte: 'Portez vos équipements de protection.' }],
  contactManager: { nom: 'Frédéric', telephone: '06 00 00 00 00' },
};

// Chaque scénario a son propre contexte : le rôle de l'employé connecté
// décide de ce que l'écran propose, et il est lu une seule fois à l'init.
function construireApp({ role, nom = 'Manager Test', visitesExistantes = [] }) {
  const documentMock = fabriquerDocument();
  const capture = { soumission: null, pont: null, datesVerifiees: [] };
  const nexusClientMock = {
    from(table) {
      if (table === 'employees') {
        return { select() { return this; }, eq() { return this; }, in() { return this; },
          then(resolve) { resolve({ data: [{ id: 'mgr1', nom: 'Loane' }], error: null }); } };
      }
      throw new Error(`Table non mockée dans ce test : ${table}`);
    },
  };
  const sandbox = {
    document: documentMock,
    console,
    nexusRequireAuth: () => Promise.resolve({ id: 'emp1', nom, role, site_id: 'site-test' }),
    nexusClient: nexusClientMock,
    setInterval: () => 0,
    Date,
    alert: (msg) => { throw new Error(`alert() appelé de façon inattendue : ${msg}`); },
    confirm: () => true,
    crypto: { randomUUID: () => require('crypto').randomUUID() },
  };
  vm.createContext(sandbox);
  vm.runInContext(moteurSrc, sandbox);
  sandbox.NexusReceptionDonnees = {
    async chargerConfigReception() { return configFixture; },
    async chargerHistoriqueEcartsRatio() { return []; },
    // Réceptions déjà enregistrées à la date saisie. `null` signifie « lecture
    // impossible » : l'écran ne doit surtout pas le confondre avec « aucune ».
    async chargerVisitesDeLaDate(client, siteId, date) {
      capture.datesVerifiees.push(date);
      return visitesExistantes;
    },
    async soumettreVisiteComplete(client, visite, lignes, compartiments, mesures, anomalies) {
      capture.soumission = { visite, lignes, compartiments, mesures, anomalies };
      return { data: { id: 'visite-test-regul', ...visite } };
    },
  };
  // Le pont vers carburant_releves : c'est lui qui décide quelle ligne de
  // stock la réception vient alimenter, et avec quelle date de mesure.
  sandbox.NexusCarburantDonnees = {
    async enregistrerReleveDepuisReceptionLivraison(client, siteId, payload) {
      capture.pont = { siteId, payload };
      return { ok: true };
    },
  };
  // L'ecran charge nexus-auth.js avant son propre <script> (balise en tete du
  // HTML) : la sandbox execute donc la VRAIE definition de `nexusEstManager`,
  // extraite du fichier, plutot qu'une enieme copie de la regle de role.
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-auth.js'), 'utf8')
    .match(/function nexusEstManager\([\s\S]*?\n}/)[0], sandbox);
  vm.runInContext(scriptSrc + `
;globalThis.__NEXUS_TEST__ = {
  get etape(){ return etape; },
  get modeSaisie(){ return modeSaisie; },
  get lignes(){ return lignes; },
  get compartiments(){ return compartiments; },
  get compartimentOuvert(){ return compartimentOuvert; }, set compartimentOuvert(v){ compartimentOuvert = v; },
  get resultatsParCarburant(){ return resultatsParCarburant; },
  get jaugeageLe(){ return jaugeageLe; },
  get derogationsParCompartiment(){ return derogationsParCompartiment; },
  allerEtape, demarrerVisite, renderFicheCompartiment, renderFicheReception, soumettreVisite,
};
`, sandbox);
  return { sandbox, capture, doc: documentMock };
}

async function attendreInit(app) {
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 0));
    if (app.sandbox.__NEXUS_TEST__ && app.sandbox.__NEXUS_TEST__.etape) return app.sandbox.__NEXUS_TEST__;
  }
  throw new Error('Initialisation jamais terminée');
}

// La garde anti-doublon lit la base : elle est asynchrone, et l'écran reste
// volontairement bloqué tant qu'elle n'a pas répondu.
async function attendreVerificationDoublon(app) {
  for (let i = 0; i < 40; i++) await new Promise(r => setTimeout(r, 0));
  return app.doc.getElementById('content').innerHTML;
}

// Gestes communs du parcours (identiques en temps réel et en régularisation
// — c'est précisément ce qui doit rester vrai : la régularisation n'est pas
// un second parcours, c'est le même avec des dates saisies).
function assignerCompartiment(app, H, numero, carburant, quantiteLitres, cuveId) {
  H.compartimentOuvert = numero;
  H.renderFicheCompartiment();
  app.doc.querySelectorAll('[data-carb]').find(el => el.getAttribute('data-carb') === carburant)._listeners.click();
  const qte = app.doc.getElementById('fQteCompartiment');
  qte.value = String(quantiteLitres / 1000); qte._listeners.input({ target: qte });
  const cuve = app.doc.getElementById('fCuveCompartiment');
  cuve.value = cuveId; cuve._listeners.change({ target: cuve });
  app.doc.getElementById('btnValiderCompartiment')._listeners.click();
}

(async () => {
  // ------------------------------------------------------------
  // 1) Droits — qui peut régulariser (test obligatoire n°10)
  // ------------------------------------------------------------
  {
    const appPompiste = construireApp({ role: 'pompiste', nom: 'Pompiste Test' });
    await attendreInit(appPompiste);
    const accueilPompiste = appPompiste.doc.getElementById('content').innerHTML;
    assert.ok(accueilPompiste.includes('Démarrons ensemble'), 'Le pompiste doit garder la réception normale');
    assert.ok(!accueilPompiste.includes('Régulariser une réception passée'),
      'Un pompiste ne doit pas se voir proposer de régulariser une réception passée');

    const appManager = construireApp({ role: 'manager' });
    await attendreInit(appManager);
    const accueilManager = appManager.doc.getElementById('content').innerHTML;
    assert.ok(accueilManager.includes('Régulariser une réception passée'),
      'Le manager doit pouvoir régulariser une réception passée');

    // Défense en profondeur : même en appelant directement la fonction, un
    // pompiste ne bascule pas en mode régularisation (l'écran ne fait pas
    // confiance à son propre bouton — la base non plus, via son trigger).
    appPompiste.sandbox.__NEXUS_TEST__.demarrerVisite('regularisation');
    assert.strictEqual(appPompiste.sandbox.__NEXUS_TEST__.modeSaisie, 'temps_reel',
      'Un pompiste qui déclenche le mode régularisation doit retomber en temps réel');
    console.log('✓ 1. Droits — régularisation réservée au manager/gérant, y compris en contournant le bouton');
  }

  // ------------------------------------------------------------
  // 2) Parcours complet — le cas du 18/09 rejoué avec des valeurs fictives
  //    (tests obligatoires n°2, 3, 4, 5, 6)
  // ------------------------------------------------------------
  const app = construireApp({ role: 'manager' });
  const H = await attendreInit(app);
  const doc = app.doc;

  H.demarrerVisite('regularisation');
  assert.strictEqual(H.modeSaisie, 'regularisation');
  assert.strictEqual(H.etape, 'livraison');

  let contenu = doc.getElementById('content').innerHTML;
  assert.ok(contenu.includes('Date et heure réelles de la livraison'),
    'En régularisation, la date de livraison doit être saisie et non pré-remplie à maintenant');
  assert.ok(doc.getElementById('fHeureDebut').value === '' || !doc.getElementById('fHeureDebut').value,
    'Aucune date ne doit être proposée par défaut : NEXUS ne devine pas la date d\'une réception passée');

  // BL du camion : GO 16 000 L, SP95 12 000 L (saisie en m³).
  doc.querySelectorAll('[data-toggle]').find(el => el.getAttribute('data-toggle') === 'sp95')._listeners.click();
  doc.querySelectorAll('[data-toggle]').find(el => el.getAttribute('data-toggle') === 'go')._listeners.click();
  const qteSp95 = doc.querySelectorAll('[data-qte]').find(el => el.getAttribute('data-qte') === 'sp95');
  qteSp95.value = '12'; qteSp95._listeners.input({ target: qteSp95 });
  const qteGo = doc.querySelectorAll('[data-qte]').find(el => el.getAttribute('data-qte') === 'go');
  qteGo.value = '16'; qteGo._listeners.input({ target: qteGo });

  const champHeureDebut = doc.getElementById('fHeureDebut');
  champHeureDebut.value = '2026-09-18T09:30';
  champHeureDebut._listeners.input();

  // Tant que le motif manque, la régularisation ne peut pas continuer : une
  // réception saisie après coup sans explication serait indéfendable.
  assert.strictEqual(doc.getElementById('btnContinuerLivraison').disabled, true,
    'Sans motif de régularisation, "Continuer" doit rester bloqué');
  const champControle = doc.getElementById('fControleTerrain');
  champControle.value = 'Angélique (contrôle terrain)'; champControle._listeners.input();
  const champMotif = doc.getElementById('fMotifRegul');
  champMotif.value = "Saisie NEXUS impossible au moment du dépotage (accès au rôle pompiste indisponible). Jaugeages relevés manuellement.";
  champMotif._listeners.input();
  await attendreVerificationDoublon(app);
  assert.deepStrictEqual(app.capture.datesVerifiees.slice(0, 1), ['2026-09-18'],
    'La garde anti-doublon doit interroger la date réelle de la livraison, pas celle du jour');
  assert.ok(doc.getElementById('zoneDoublonReception').innerHTML.includes('Aucune réception n\'est encore enregistrée'),
    'Le manager doit voir que la date a bien été vérifiée, et non deviner');
  assert.strictEqual(doc.getElementById('btnContinuerLivraison').disabled, false,
    'Motif et date renseignés, aucune réception à cette date : la régularisation peut continuer');
  doc.getElementById('btnContinuerLivraison')._listeners.click();
  console.log('✓ 2. Étape Livraison — date réelle saisie, motif obligatoire, contrôle terrain nommé');

  // --- Jaugeage avant, tel qu'écrit sur le relevé manuscrit -------------
  assert.strictEqual(H.etape, 'jaugeage_avant');
  contenu = doc.getElementById('content').innerHTML;
  assert.ok(contenu.includes('telles qu\'écrites sur le relevé') || contenu.includes('Date et heure du jaugeage avant'),
    'Le jaugeage régularisé doit demander sa propre date terrain');

  // Garde chronologique (test obligatoire implicite : ne rien inventer).
  const champJaugeAvant = doc.getElementById('fJaugeageLe');
  champJaugeAvant.value = '2026-09-17T08:00'; champJaugeAvant._listeners.input();
  // Jaugeages d'avant-dépotage, recopiés du relevé manuscrit.
  doc.querySelectorAll('[data-cuve]').forEach(el => { el.value = '3000'; el._listeners.input(); });
  assert.strictEqual(doc.getElementById('btnContinuerJaugeage').disabled, true,
    'Un jaugeage antérieur à la livraison doit bloquer, pas être corrigé en silence');
  assert.ok(/antérieur à la livraison/.test(doc.getElementById('noteChronoJaugeage').textContent),
    'NEXUS doit dire pourquoi il refuse');

  champJaugeAvant.value = '2026-09-18T09:25'; champJaugeAvant._listeners.input();
  assert.strictEqual(doc.getElementById('btnContinuerJaugeage').disabled, true,
    'Un jaugeage avant la livraison de quelques minutes reste antérieur : blocage attendu');
  champJaugeAvant.value = '2026-09-18T09:35'; champJaugeAvant._listeners.input();
  assert.strictEqual(doc.getElementById('btnContinuerJaugeage').disabled, false,
    'Chronologie cohérente : la saisie peut continuer');
  doc.getElementById('btnContinuerJaugeage')._listeners.click();
  console.log('✓ 3. Garde chronologique — un jaugeage antérieur à la livraison est refusé, jamais rattrapé');

  // --- Compartiments : la répartition du camion, identique au temps réel ---
  assert.strictEqual(H.etape, 'compartiments');
  assignerCompartiment(app, H, 1, 'sp95', 12000, 'unique');
  assignerCompartiment(app, H, 2, 'go', 10000, 'cuve1');
  assignerCompartiment(app, H, 3, 'go', 6000, 'cuve2');
  assert.strictEqual(doc.getElementById('btnContinuerCompartiments').disabled, false,
    'Compartiments conformes au BL : aucune dérogation ne doit être exigée');
  doc.getElementById('btnContinuerCompartiments')._listeners.click();

  // --- Réception compartiment par compartiment -------------------------
  assert.strictEqual(H.etape, 'reception');
  [1, 2, 3].forEach(n => {
    H.compartimentOuvert = n;
    H.renderFicheReception();
    doc.getElementById('btnMarquerReceptionne')._listeners.click();
  });
  assert.strictEqual(doc.getElementById('btnContinuerReception').disabled, false);
  doc.getElementById('btnContinuerReception')._listeners.click();

  // --- Jaugeage final, lui aussi daté du terrain -----------------------
  assert.strictEqual(H.etape, 'jaugeage_final');
  const champJaugeApres = doc.getElementById('fJaugeageLe');
  assert.ok(champJaugeApres, 'Le jaugeage final régularisé doit porter sa propre date terrain');
  champJaugeApres.value = '2026-09-18T11:15'; champJaugeApres._listeners.input();
  // Valeurs manuscrites : SP95 3000 -> 14950 (+11 950 pour 12 000 au BL),
  // GO cuve1 3000 -> 12980 (+9 980), GO cuve2 3000 -> 8990 (+5 990),
  // soit 15 970 L de GO mesurés pour 16 000 L au BL. Aucune de ces valeurs
  // n'est calculée par NEXUS : elles viennent du papier.
  const valeursApres = { 'sp95__unique': '14950', 'go__cuve1': '12980', 'go__cuve2': '8990' };
  doc.querySelectorAll('[data-cuve]').forEach(el => {
    el.value = valeursApres[el.getAttribute('data-cuve')];
    el._listeners.input();
  });
  assert.strictEqual(doc.getElementById('btnContinuerJaugeage').disabled, false);
  doc.getElementById('btnContinuerJaugeage')._listeners.click();

  // --- Calcul : exactement la même méthode qu'en temps réel ------------
  // (test obligatoire n°5 — BL vs réel)
  assert.strictEqual(H.etape, 'calcul');
  assert.strictEqual(H.resultatsParCarburant.go.attenduL, 16000, 'Le BL reste la quantité théorique GO');
  assert.strictEqual(H.resultatsParCarburant.go.mesureL, 15970, 'La quantité mesurée vient des jaugeages manuscrits');
  assert.strictEqual(H.resultatsParCarburant.go.ecartMesureL, -30, 'Écart BL/mesuré GO reconstruit normalement');
  assert.strictEqual(H.resultatsParCarburant.go.statut, 'coherente');
  assert.strictEqual(H.resultatsParCarburant.sp95.attenduL, 12000, 'Le BL reste la quantité théorique SP95');
  assert.strictEqual(H.resultatsParCarburant.sp95.mesureL, 11950);
  assert.strictEqual(H.resultatsParCarburant.sp95.statut, 'coherente');
  console.log('✓ 4. Calcul BL vs mesuré — reconstruit par la méthode normale, sans valeur inventée');

  // --- Soumission : ce que NEXUS écrit réellement ----------------------
  const avantSoumission = Date.now();
  await H.soumettreVisite();
  const apresSoumission = Date.now();
  assert.ok(app.capture.soumission, 'La visite régularisée doit être soumise');
  const visite = app.capture.soumission.visite;

  // Date 1 — la livraison réelle (test obligatoire n°3).
  assert.strictEqual(visite.date_visite, '2026-09-18',
    'La réception doit rester datée du jour réel de la livraison');
  assert.strictEqual(visite.heure_debut, new Date('2026-09-18T09:30').toISOString());
  assert.strictEqual(visite.heure_fin, new Date('2026-09-18T11:15').toISOString(),
    'La fin de visite est l\'instant du jaugeage final terrain, pas celui de la saisie');

  // Date 2 — les mesures terrain, et leur provenance (test n°6).
  const mesures = app.capture.soumission.mesures;
  assert.strictEqual(mesures.length, 3, '3 cuves mesurées');
  mesures.forEach(m => {
    assert.strictEqual(m.source, 'releve_manuscrit',
      'Chaque jaugeage régularisé doit se déclarer comme venant du relevé manuscrit');
    assert.strictEqual(m.jaugeage_avant_le, new Date('2026-09-18T09:35').toISOString());
    assert.strictEqual(m.jaugeage_apres_le, new Date('2026-09-18T11:15').toISOString());
  });

  // Date 3 — la saisie NEXUS (test obligatoire n°4). Elle est distincte,
  // postérieure, et n'écrase jamais les deux premières.
  assert.strictEqual(visite.mode_saisie, 'regularisation');
  const tRegul = new Date(visite.regularisation_le).getTime();
  assert.ok(tRegul >= avantSoumission && tRegul <= apresSoumission,
    'regularisation_le doit être l\'instant réel de la saisie NEXUS');
  assert.ok(tRegul > new Date(visite.heure_fin).getTime(),
    'La saisie NEXUS est forcément postérieure à la livraison qu\'elle régularise');
  assert.ok(!('created_at' in visite),
    'created_at appartient à la base : le client ne doit jamais le fabriquer');

  // Qui, et pourquoi.
  assert.strictEqual(visite.regularisation_par, 'emp1');
  assert.strictEqual(visite.regularisation_par_nom, 'Manager Test');
  assert.strictEqual(visite.controle_terrain_par, 'Angélique (contrôle terrain)',
    'La personne ayant réalisé le contrôle terrain doit être conservée');
  assert.ok(/rôle pompiste/.test(visite.regularisation_motif),
    'Le motif de régularisation doit être conservé tel que saisi');

  // Anti-double-comptage (tests n°8 et 9) : le relevé reconstruit porte la
  // date de la livraison et l'instant du jaugeage terrain. S'il portait
  // l'instant de la saisie, la ligne du 18/09 deviendrait la mesure la plus
  // récente du site et absorberait les ventes du 19/09.
  assert.ok(app.capture.pont, 'Le pont vers carburant_releves doit être appelé');
  assert.strictEqual(app.capture.pont.payload.date, '2026-09-18',
    'Le relevé reconstruit appartient au 18/09, jamais au jour de la saisie');
  assert.strictEqual(app.capture.pont.payload.mesureLe, visite.heure_fin,
    'mesure_le doit être l\'instant du jaugeage terrain, sinon la fenêtre de ventes du 18/09 déborderait sur le 19/09');
  assert.ok(new Date(app.capture.pont.payload.mesureLe).getTime() < tRegul,
    'La mesure ne peut pas être postérieure à sa propre régularisation');

  // Écran de succès : il doit dire ce qui s'est passé (test n°6).
  assert.strictEqual(H.etape, 'succes');
  const succes = doc.getElementById('content').innerHTML;
  assert.ok(/régularisée/.test(succes), 'L\'écran final doit dire "régularisée", pas "réception effectuée"');
  assert.ok(succes.includes('18/09'), 'L\'écran final doit rappeler la date réelle de la réception');
  assert.ok(/manuscrit/.test(succes), 'L\'écran final doit rappeler la provenance');
  assert.ok(!/undefined|NaN|null/.test(succes), 'Aucune valeur non résolue dans l\'écran final');
  console.log('✓ 5. Soumission — trois dates distinctes, provenance, auteur, motif, pont daté du 18/09');

  // ------------------------------------------------------------
  // 6) Non-régression du temps réel (test obligatoire n°1)
  // ------------------------------------------------------------
  {
    const tr = construireApp({ role: 'manager' });
    const T = await attendreInit(tr);
    const d = tr.doc;
    T.demarrerVisite('temps_reel');
    assert.strictEqual(T.modeSaisie, 'temps_reel');
    const accueilTr = d.getElementById('content').innerHTML;
    assert.ok(!accueilTr.includes('Date et heure réelles de la livraison'),
      'En temps réel, l\'écran garde son libellé habituel');
    assert.ok(d.getElementById('fHeureDebut').value,
      'En temps réel, l\'heure de début reste pré-remplie à maintenant');
    assert.ok(!accueilTr.includes('fMotifRegul'),
      'Aucun champ de régularisation ne doit apparaître en temps réel');

    d.querySelectorAll('[data-toggle]').find(el => el.getAttribute('data-toggle') === 'go')._listeners.click();
    const qte = d.querySelectorAll('[data-qte]').find(el => el.getAttribute('data-qte') === 'go');
    qte.value = '16'; qte._listeners.input({ target: qte });
    d.getElementById('btnContinuerLivraison')._listeners.click();

    assert.strictEqual(T.etape, 'jaugeage_avant');
    assert.ok(!d.getElementById('content').innerHTML.includes('fJaugeageLe'),
      'En temps réel, aucune date de jaugeage n\'est demandée : c\'est maintenant');
    d.querySelectorAll('[data-cuve]').forEach(el => { el.value = '3000'; el._listeners.input(); });
    d.getElementById('btnContinuerJaugeage')._listeners.click();

    assignerCompartiment(tr, T, 1, 'go', 6000, 'cuve1');
    assignerCompartiment(tr, T, 2, 'go', 6000, 'cuve1');
    assignerCompartiment(tr, T, 3, 'go', 4000, 'cuve2');
    assert.strictEqual(d.getElementById('btnContinuerCompartiments').disabled, false);
    d.getElementById('btnContinuerCompartiments')._listeners.click();

    [1, 2, 3].forEach(n => {
      T.compartimentOuvert = n;
      T.renderFicheReception();
      const btn = d.getElementById('btnMarquerReceptionne');
      if (btn && btn._listeners.click) btn._listeners.click();
    });
    d.getElementById('btnContinuerReception')._listeners.click();

    assert.strictEqual(T.etape, 'jaugeage_final');
    // GO : cuve1 3000 -> 14990 (+11 990), cuve2 3000 -> 6990 (+3 990),
    // soit 15 980 L mesurés pour 16 000 L au BL.
    const apresTr = { 'go__cuve1': '14990', 'go__cuve2': '6990' };
    d.querySelectorAll('[data-cuve]').forEach(el => {
      const v = apresTr[el.getAttribute('data-cuve')];
      if (v) { el.value = v; el._listeners.input(); }
    });
    d.getElementById('btnContinuerJaugeage')._listeners.click();
    assert.strictEqual(T.etape, 'calcul');

    const avantTr = Date.now();
    await T.soumettreVisite();
    const vTr = tr.capture.soumission.visite;
    assert.strictEqual(vTr.mode_saisie, 'temps_reel');
    ['regularisation_motif', 'regularisation_par', 'regularisation_par_nom',
     'regularisation_le', 'controle_terrain_par', 'justificatif_url'].forEach(champ => {
      assert.ok(!(champ in vTr), `Une réception temps réel ne doit porter aucun champ de régularisation (${champ} présent)`);
    });
    tr.capture.soumission.mesures.forEach(m => {
      assert.strictEqual(m.source, 'saisie_nexus', 'Une mesure temps réel est bien saisie dans NEXUS');
      assert.ok(new Date(m.jaugeage_apres_le).getTime() >= avantTr - 1000,
        'En temps réel, l\'instant du jaugeage reste celui de la saisie');
    });
    assert.ok(!('mesureLe' in tr.capture.pont.payload),
      'En temps réel, le pont garde son propre new Date() : rien ne doit lui être imposé');
    const succesTr = tr.doc.getElementById('content').innerHTML;
    assert.ok(!/régularis/i.test(succesTr) && !/manuscrit/i.test(succesTr),
      'Une réception normale ne doit jamais se présenter comme une régularisation');
    console.log('✓ 6. Temps réel inchangé — aucun champ de régularisation, aucune date imposée au pont');
  }

  // ------------------------------------------------------------
  // 7) Doublon silencieux impossible (test obligatoire n°7)
  //
  //    L'idempotence ne couvre pas ce cas : `idempotencyKey` est régénérée
  //    à chaque `demarrerVisite`, et test_reception_idempotence.js pose
  //    explicitement (cas 4) qu'un second geste avec une nouvelle clé DOIT
  //    créer une visite distincte. C'est correct pour deux vraies
  //    livraisons ; c'est exactement le piège pour deux régularisations de
  //    la même. Seule une lecture de la date saisie peut le voir.
  // ------------------------------------------------------------
  async function ouvrirEtapeLivraisonRegularisee(app) {
    const H2 = await attendreInit(app);
    H2.demarrerVisite('regularisation');
    const d = app.doc;
    d.querySelectorAll('[data-toggle]').find(el => el.getAttribute('data-toggle') === 'go')._listeners.click();
    const q = d.querySelectorAll('[data-qte]').find(el => el.getAttribute('data-qte') === 'go');
    q.value = '16'; q._listeners.input({ target: q });
    const h = d.getElementById('fHeureDebut');
    h.value = '2026-09-18T09:30'; h._listeners.input();
    d.getElementById('fControleTerrain').value = 'Angélique (contrôle terrain)';
    d.getElementById('fControleTerrain')._listeners.input();
    d.getElementById('fMotifRegul').value = 'Relevé manuscrit régularisé après coup.';
    d.getElementById('fMotifRegul')._listeners.input();
    await attendreVerificationDoublon(app);
    return H2;
  }

  {
    // a) Une réception existe déjà au 18/09 : blocage, et on la montre.
    //    La référence de BL est un champ libre : elle doit ressortir
    //    échappée, l'écran n'ayant aucun rendu de texte sûr par défaut.
    const dejaLa = construireApp({ role: 'manager', visitesExistantes: [
      { id: 'v-existante', date_visite: '2026-09-18', heure_debut: '2026-09-18T09:30:00.000Z',
        bon_livraison_reference: 'BL-<script>x</script>-7741', statut: 'terminee' },
    ] });
    await ouvrirEtapeLivraisonRegularisee(dejaLa);
    assert.deepStrictEqual(dejaLa.capture.datesVerifiees.slice(0, 1), ['2026-09-18']);
    const encart = dejaLa.doc.getElementById('zoneDoublonReception').innerHTML;
    assert.ok(/déjà enregistrée à cette date/.test(encart),
      'Le manager doit voir la réception déjà enregistrée, pas la découvrir après coup');
    assert.ok(encart.includes('BL-&lt;script&gt;x&lt;/script&gt;-7741'),
      'La référence de BL est un champ libre : elle doit être échappée');
    assert.ok(!encart.includes('<script>x</script>'), 'Aucune balise ne doit sortir telle quelle d\'un champ libre');
    assert.strictEqual(dejaLa.doc.getElementById('btnContinuerLivraison').disabled, true,
      'Tant que le doublon n\'est pas confirmé comme une autre livraison, la régularisation reste bloquée');

    // b) Confirmation explicite : deux livraisons le même jour, ça existe.
    //    NEXUS ne l'interdit pas — il interdit de le faire sans le voir.
    const caseConfirm = dejaLa.doc.getElementById('fConfirmerDoublon');
    caseConfirm.checked = true;
    caseConfirm._listeners.change();
    assert.strictEqual(dejaLa.doc.getElementById('btnContinuerLivraison').disabled, false,
      'Après confirmation explicite, une seconde livraison du même jour doit rester possible');

    // c) Lecture impossible : « je ne sais pas » n'est pas « il n'y en a pas ».
    const aveugle = construireApp({ role: 'manager', visitesExistantes: null });
    await ouvrirEtapeLivraisonRegularisee(aveugle);
    const encartAveugle = aveugle.doc.getElementById('zoneDoublonReception').innerHTML;
    assert.ok(/Vérification impossible/.test(encartAveugle),
      'Une lecture en échec doit être dite, pas silencieusement assimilée à « aucune réception »');
    assert.strictEqual(aveugle.doc.getElementById('btnContinuerLivraison').disabled, true,
      'Sans vérification aboutie, la régularisation doit rester bloquée');

    // d) Le temps réel n'est pas concerné : cette garde ne doit pas gêner
    //    la réception du jour, qui est le parcours nominal.
    const tempsReel = construireApp({ role: 'pompiste', nom: 'Pompiste Test' });
    const Htr = await attendreInit(tempsReel);
    Htr.demarrerVisite('temps_reel');
    const dtr = tempsReel.doc;
    dtr.querySelectorAll('[data-toggle]').find(el => el.getAttribute('data-toggle') === 'go')._listeners.click();
    const qtr = dtr.querySelectorAll('[data-qte]').find(el => el.getAttribute('data-qte') === 'go');
    qtr.value = '16'; qtr._listeners.input({ target: qtr });
    await attendreVerificationDoublon(tempsReel);
    assert.deepStrictEqual(tempsReel.capture.datesVerifiees, [],
      'La réception du jour ne doit déclencher aucune vérification de doublon');
    assert.strictEqual(dtr.getElementById('btnContinuerLivraison').disabled, false,
      'La garde anti-doublon ne doit pas bloquer une réception temps réel');
    console.log('✓ 7. Doublon — une réception déjà enregistrée à cette date bloque, se voit, et ne se contourne que sciemment');
  }

  console.log('\nTous les tests reception_regularisation passent.');
})().catch(e => { console.error(e); process.exit(1); });
