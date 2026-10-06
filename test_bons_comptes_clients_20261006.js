// ============================================================================
// BONS DES COMPTES CLIENTS (06/10/2026)
//
// Un client ne recevait plus ses bons depuis août. Un bon déposé dans la Boîte
// de réception naît sans client (client_id null) ; l'étape 6bis de
// nexus-envoyer-facture ne cherche que les bons du client et de la période de
// la facture ; elle ne trouvait donc rien, et la facture partait seule avec un
// « envoi_reussi ». Aucun écran ne montrait qu'un bon n'avait pas de client.
//
// Cette épreuve EXÉCUTE l'étape 6bis (extraite de la fonction, base simulée)
// au lieu d'y chercher des mots : un refus doit se constater par la réponse
// rendue, pas par la présence d'une chaîne. Puis elle vérifie que la Boîte de
// réception charge TOUS les bons sans client et les affiche à part.
// ============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const unique = (src, motif, nom) => {
  const n = src.split(motif).length - 1;
  assert.strictEqual(n, 1, `${nom} : ancre attendue une fois, trouvée ${n} fois`);
  return src.indexOf(motif);
};

let echecs = 0;
const cas = async (nom, fn) => {
  try { await fn(); console.log('  ✓ ' + nom); }
  catch (e) { echecs++; console.log('  ✗ ' + nom + '\n      ' + e.message); }
};

// ── 1. Edge Function : l'étape 6bis, exécutée ─────────────────────────────
const ts = lire('nexus-envoyer-facture-index.ts');
const debut = unique(ts, '  const attachments', 'début 6bis');
const fin = unique(ts, '  // 7) Message', 'fin 6bis');
const bloc = ts.slice(debut, fin)
  .replace(/const attachments:[^=]+=/, 'const attachments =')
  .replace('let motifSansBons: string | null =', 'let motifSansBons =');
assert.ok(!/:\s*(string|Uint8Array|Record)\b/.test(bloc), 'annotation TypeScript restée dans le bloc extrait');

// Rend { status, corps } si le bloc a arrêté l'envoi, { attachments,
// motifSansBons } s'il laisse passer.
const etape6bis = new Function('supabase', 'client', 'invoice', 'nomFichier', 'fichierBuffer', 'jsonResponse', 'console', 'envoyerSansBons',
  `return (async () => { ${bloc}\n return { attachments, motifSansBons }; })();`);

function baseSimulee({ pref = { bons_joindre_email: true }, ePref = null, bons = [], eBons = null, illisibles = [] } = {}) {
  const appels = [];
  const chaine = (resultat) => {
    const q = { filtres: {} };
    q.select = () => q;
    q.eq = (c, v) => { q.filtres[c] = v; return q; };
    q.maybeSingle = async () => resultat(q);
    q.then = (ok, ko) => Promise.resolve(resultat(q)).then(ok, ko);
    return q;
  };
  return {
    appels,
    from(table) {
      appels.push(table);
      if (table === 'client_preferences') return chaine(() => ({ data: pref, error: ePref }));
      if (table === 'supporting_documents') return chaine(q => {
        appels.push('filtres:' + JSON.stringify(q.filtres));
        return { data: bons, error: eBons };
      });
      throw new Error('table inattendue ' + table);
    },
    storage: { from: () => ({ download: async p => illisibles.includes(p)
      ? { data: null, error: { message: 'introuvable' } }
      : { data: { arrayBuffer: async () => new ArrayBuffer(3) }, error: null } }) },
  };
}
const jsonResponse = (corps, status) => ({ status, corps });
const silence = { error() {}, log() {} };
const lancer = (base, invoice = { billing_period_id: 'p-aout' }, envoyerSansBons = false) =>
  etape6bis(base, { id: 'c1' }, invoice, 'F-2026-08.pdf', new Uint8Array(1), jsonResponse, silence, envoyerSansBons);

(async () => {
  console.log('Edge Function nexus-envoyer-facture — étape 6bis');

  await cas('bons attendus, AUCUN bon rattaché → arrêt 409 BONS_MANQUANTS (le défaut d\'août)', async () => {
    const r = await lancer(baseSimulee({ bons: [] }));
    assert.ok(r.status, 'le bloc a laissé passer une facture sans ses bons');
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.corps.code, 'BONS_MANQUANTS');
    assert.match(r.corps.error, /non envoyée/);
    assert.match(r.corps.error, /Boîte de réception/);
  });

  await cas('bons attendus, facture sans période → arrêt 409 BONS_MANQUANTS sans interroger les bons', async () => {
    const base = baseSimulee({ bons: [{ fichier_path: 's/b1.pdf' }] });
    const r = await lancer(base, { billing_period_id: null });
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.corps.code, 'BONS_MANQUANTS');
    assert.ok(!base.appels.includes('supporting_documents'), 'les bons ont été cherchés sans période');
  });

  await cas('bons attendus, un bon illisible → refus, rien n\'est joint à moitié', async () => {
    const r = await lancer(baseSimulee({ bons: [{ fichier_path: 's/b1.pdf' }, { fichier_path: 's/b2.pdf' }], illisibles: ['s/b2.pdf'] }));
    assert.strictEqual(r.status, 500, 'un bon illisible a été sauté en silence');
    assert.match(r.corps.error, /b2\.pdf/);
  });

  await cas('lecture des bons en erreur → refus 500', async () => {
    const r = await lancer(baseSimulee({ eBons: { message: 'x' } }));
    assert.strictEqual(r.status, 500);
  });

  await cas('lecture des préférences en erreur → refus 500 (jamais « pas de préférence »)', async () => {
    const r = await lancer(baseSimulee({ pref: null, ePref: { message: 'x' } }));
    assert.strictEqual(r.status, 500);
  });

  await cas('confirmé, aucun bon → la facture part seule, avec le motif de la trace', async () => {
    const r = await lancer(baseSimulee({ bons: [] }), undefined, true);
    assert.ok(r.attachments, 'confirmation ignorée : ' + JSON.stringify(r.corps));
    assert.strictEqual(r.attachments.length, 1);
    assert.match(r.motifSansBons || '', /Aucun bon rattaché/);
  });

  await cas('confirmé, facture sans période → part seule, motif « sans période », bons non cherchés', async () => {
    const base = baseSimulee({ bons: [{ fichier_path: 's/b1.pdf' }] });
    const r = await lancer(base, { billing_period_id: null }, true);
    assert.ok(r.attachments);
    assert.strictEqual(r.attachments.length, 1);
    assert.match(r.motifSansBons || '', /sans période/);
    assert.ok(!base.appels.includes('supporting_documents'));
  });

  await cas('la confirmation ne force jamais une panne : bon illisible, lecture des bons ou des préférences en échec', async () => {
    const illisible = await lancer(baseSimulee({ bons: [{ fichier_path: 's/b1.pdf' }], illisibles: ['s/b1.pdf'] }), undefined, true);
    assert.strictEqual(illisible.status, 500);
    assert.strictEqual((await lancer(baseSimulee({ eBons: { message: 'x' } }), undefined, true)).status, 500);
    assert.strictEqual((await lancer(baseSimulee({ pref: null, ePref: { message: 'x' } }), undefined, true)).status, 500);
  });

  await cas('confirmé mais bons présents → ils sont joints, aucune trace « sans bons »', async () => {
    const r = await lancer(baseSimulee({ bons: [{ fichier_path: 's/b1.pdf' }] }), undefined, true);
    assert.strictEqual(r.attachments.length, 2);
    assert.strictEqual(r.motifSansBons, null);
  });

  await cas('la confirmation exige un vrai booléen, et la trace « envoi_sans_bons » suit l\'envoi réussi', async () => {
    assert.match(ts, /const envoyerSansBons = body\.envoyerSansBons === true;/);
    const posTrace = unique(ts, 'action: "envoi_sans_bons"', 'trace sans bons');
    assert.ok(posTrace > ts.indexOf('action: "envoi_reussi"') && posTrace > ts.indexOf('.sendMail({'), 'trace écrite avant l\'envoi');
    const garde = ts.slice(ts.lastIndexOf('if (motifSansBons)', posTrace), posTrace);
    assert.ok(garde.length > 0 && garde.length < 400, 'la trace n\'est pas conditionnée au motif');
  });

  await cas('bons attendus et rattachés → facture + tous les bons, filtrés par client, période et type', async () => {
    const base = baseSimulee({ bons: [{ fichier_path: 's/b1.pdf' }, { fichier_path: 's/b2.pdf' }] });
    const r = await lancer(base);
    assert.ok(r.attachments, 'refus inattendu : ' + JSON.stringify(r.corps));
    assert.deepStrictEqual(r.attachments.map(a => a.filename), ['F-2026-08.pdf', 'b1.pdf', 'b2.pdf']);
    const f = base.appels.find(a => a.startsWith('filtres:'));
    assert.deepStrictEqual(JSON.parse(f.slice(8)), { client_id: 'c1', billing_period_id: 'p-aout', type_document: 'bon' });
  });

  await cas('client sans préférence de bons → facture seule, comme avant', async () => {
    for (const pref of [null, { bons_joindre_email: false }]) {
      const r = await lancer(baseSimulee({ pref }));
      assert.ok(r.attachments, 'refus pour un client qui n\'attend pas de bons');
      assert.strictEqual(r.attachments.length, 1);
    }
  });

  await cas('le refus précède tout envoi et toute trace « envoi_reussi »', async () => {
    const posRefus = unique(ts, "aucun bon n'est rattaché", 'message de refus');
    for (const apres of ['.sendMail({', 'action: "envoi_reussi"']) {
      const p = ts.indexOf(apres);
      assert.ok(p > posRefus, `${apres} apparaît avant la garde (ou est absent)`);
    }
  });

  // ── 2. Boîte de réception : les bons sans client sont visibles ──────────
  console.log('Boîte de réception — bons sans client');
  const html = lire('NEXUS-Boite-Reception-v1.html');

  await cas('tous les bons sans client sont chargés par une requête dédiée, hors de la liste tronquée à 20', async () => {
    const i = unique(html, ".eq('type_document', 'bon').is('client_id', null)", 'requête des bons sans client');
    const charg = html.slice(html.indexOf('async function chargerDocumentsRecents'), html.indexOf('documentsRecents = [...facturesFmt'));
    assert.ok(charg.includes(".is('client_id', null)"), 'la requête n\'est pas dans chargerDocumentsRecents');
    assert.ok(i > 0);
    assert.match(html, /bonsSansClient = \(orphelins \|\| \[\]\)\.map\(formaterBon\);/);
    assert.ok(!/bonsSansClient = [^;]*\.slice\(/.test(html), 'les bons sans client sont tronqués');
  });

  await cas('la section « bons sans client » est rendue avant les documents récents, avec le compte', async () => {
    const posSection = unique(html, '${sectionSansClient}', 'insertion de la section');
    assert.ok(posSection < html.indexOf('📋 Documents récents'), 'section rendue après la liste récente');
    assert.match(html, /\$\{bonsSansClient\.length\} bon/);
    assert.match(html, /ne partira pas avec la facture/);
  });

  await cas('un bon déposé n\'est plus annoncé en vert « client à confirmer »', async () => {
    const g = html.slice(html.indexOf('const lignes = resultats.map'), html.indexOf("const clientTxt = r.clientTrouve"));
    assert.match(g, /if \(r\.type === 'bon'\)[\s\S]*var\(--amber\)/, 'le dépôt d\'un bon n\'a pas sa note ambre');
  });

  // ── 3. Comptes clients : le compteur Anomalies mesure les bons manquants ─
  console.log('Comptes clients — compteur Anomalies');
  const cc = lire('NEXUS-Comptes-Clients-v1.html');
  const dA = unique(cc, '  function facturesEnAttente(c)', 'début des règles');
  const fA = unique(cc, '  function clientsFiltres()', 'fin des règles');
  const regles0 = new Function('clientsListe', 'bonsLisibles', 'tracesSansBonsLisibles',
    `${cc.slice(dA, fA)}\n return { facturesSansBons, factureEnvoyeeSansBons, calculerKpis };`);
  const regles = (l, b, t = true) => regles0(l, b, t);
  const pref = v => ({ bons_joindre_email: v });
  const RMSJ = { actif: true, preferences: pref(true), bons: [], factures: [{ id: 'f8', statut: 'en_attente', billing_period_id: 'p-aout' }] };

  await cas('bons attendus, facture à envoyer, aucun bon rattaché → 1 anomalie (le cas d\'août)', async () => {
    const r = regles([RMSJ], true);
    assert.strictEqual(r.calculerKpis().anomalies, 1);
    assert.deepStrictEqual(r.facturesSansBons(RMSJ).map(f => f.id), ['f8']);
  });

  await cas('bon rattaché pour la période → plus d\'anomalie ; bon d\'une autre période → toujours une', async () => {
    const ok = { ...RMSJ, bons: [{ billing_period_id: 'p-aout' }] };
    const autre = { ...RMSJ, bons: [{ billing_period_id: 'p-juillet' }] };
    assert.strictEqual(regles([ok], true).calculerKpis().anomalies, 0);
    assert.strictEqual(regles([autre], true).calculerKpis().anomalies, 1);
  });

  await cas('facture sans période → anomalie (l\'envoi la refuse aussi)', async () => {
    const c = { ...RMSJ, factures: [{ id: 'fx', statut: 'en_attente', billing_period_id: null }] };
    assert.strictEqual(regles([c], true).calculerKpis().anomalies, 1);
  });

  await cas('pas d\'anomalie : facture déjà envoyée, client sans bons par e-mail, client inactif', async () => {
    const envoyee = { ...RMSJ, factures: [{ id: 'f8', statut: 'envoyee', billing_period_id: 'p-aout' }] };
    const sansBons = { ...RMSJ, preferences: pref(false) };
    const inactif = { ...RMSJ, actif: false };
    const sansPref = { ...RMSJ, preferences: null };
    assert.strictEqual(regles([envoyee, sansBons, inactif, sansPref], true).calculerKpis().anomalies, 0);
  });

  await cas('lecture des bons en échec → « ? », jamais 0', async () => {
    assert.strictEqual(regles([RMSJ], false).calculerKpis().anomalies, '?');
  });

  await cas('le filtre Anomalies liste les clients concernés, la carte et la facture le disent', async () => {
    assert.ok(!/\['prets', 'anomalies'\]\.includes/.test(cc), 'le filtre Anomalies rend encore une liste vide');
    assert.match(cc, /filtreActif === 'anomalies'\) liste = liste\.filter\(c => facturesSansBons\(c\)\.length > 0\)/);
    assert.match(cc, /facturesSansBons\(c\)\.length > 0\) return \{ couleur: 'rouge'/);
    assert.match(cc, /l'envoi vous demandera confirmation/);
    assert.match(cc, /facturesSansBons\(c\)\.includes\(f\)/);
    const ch = cc.slice(cc.indexOf('async function chargerClients'), cc.indexOf('async function journaliser'));
    assert.match(ch, /from\('supporting_documents'\)[^;]*\.eq\('type_document', 'bon'\)/, 'les bons ne sont pas chargés');
    assert.match(ch, /bonsLisibles = !eB;/);
  });

  console.log('Comptes clients — KPI « Factures envoyées sans bons » et confirmation');
  const envoyee = (id, periode) => ({ id, statut: 'envoyee', billing_period_id: periode });

  await cas('août : facture envoyée, bons attendus, aucun bon rattaché → comptée (3 clients → 3)', async () => {
    const c = id => ({ actif: true, preferences: pref(true), bons: [], envoisSansBons: [], factures: [envoyee(id, 'p-aout')] });
    assert.strictEqual(regles([c('a'), c('b'), c('c')], true).calculerKpis().envoyeesSansBons, 3);
  });

  await cas('envoi confirmé sans bons → compté même si un bon est rattaché ensuite, ou la préférence changée', async () => {
    const c = { actif: true, preferences: pref(false), bons: [{ billing_period_id: 'p-sept' }], envoisSansBons: ['f9'], factures: [envoyee('f9', 'p-sept')] };
    assert.strictEqual(regles([c], true).calculerKpis().envoyeesSansBons, 1);
  });

  await cas('non compté : bon rattaché, client sans bons par e-mail, facture pas encore envoyée', async () => {
    const avecBon = { preferences: pref(true), bons: [{ billing_period_id: 'p-aout' }], envoisSansBons: [], factures: [envoyee('f1', 'p-aout')] };
    const sansPref = { preferences: pref(false), bons: [], envoisSansBons: [], factures: [envoyee('f2', 'p-aout')] };
    const enAttente = { actif: true, preferences: pref(true), bons: [], envoisSansBons: [], factures: [{ id: 'f3', statut: 'en_attente', billing_period_id: 'p-aout' }] };
    const r = regles([avecBon, sansPref, enAttente], true);
    assert.strictEqual(r.calculerKpis().envoyeesSansBons, 0);
    assert.strictEqual(r.calculerKpis().anomalies, 1, 'la facture en attente reste une anomalie, pas un envoi sans bons');
    assert.strictEqual(r.factureEnvoyeeSansBons(enAttente, enAttente.factures[0]), false, 'repère « Envoyée sans ses bons » sur une facture pas encore envoyée');
  });

  await cas('bons ou traces illisibles → « ? », jamais 0', async () => {
    const c = { preferences: pref(true), bons: [], envoisSansBons: [], factures: [envoyee('f1', 'p-aout')] };
    assert.strictEqual(regles([c], false).calculerKpis().envoyeesSansBons, '?');
    assert.strictEqual(regles([c], true, false).calculerKpis().envoyeesSansBons, '?');
  });

  await cas('le KPI, son filtre, le repère de facture et la lecture des traces sont câblés', async () => {
    assert.match(cc, /Factures envoyées sans bons<\/div><div class="kv">\$\{kpis\.envoyeesSansBons\}/);
    assert.match(cc, /filtreActif === 'envoyees_sans_bons'\) liste = liste\.filter\(c => facturesEnvoyeesSansBons\(c\)\.length > 0\)/);
    assert.match(cc, /\{ id: 'envoyees_sans_bons', label: 'Envoyées sans bons' \}/);
    assert.ok(!/Remis en main propre<\/div>/.test(cc), 'la tuile « Remis en main propre » est revenue (retirée à la demande de Frédéric)');
    assert.match(cc, /factureEnvoyeeSansBons\(c, f\) \? `<div[^`]*Envoyée sans ses bons/);
    const ch = cc.slice(cc.indexOf('async function chargerClients'), cc.indexOf('async function journaliser'));
    assert.match(ch, /from\('client_comptes_audit_logs'\)\.select\('client_id, entite_id'\)\.eq\('action', 'envoi_sans_bons'\)/);
    assert.match(ch, /tracesSansBonsLisibles = !eT;/);
    assert.match(ch, /envoisSansBons: tracesSansBons\.filter\(x => x\.client_id === c\.id\)\.map\(x => x\.entite_id\)/);
  });

  // envoyerFacture exécutée : réseau, confirm et alert simulés.
  const dE = unique(cc, '  async function envoyerFacture(', 'début envoyerFacture');
  const fE = unique(cc, '  // FORMULAIRE — création', 'fin envoyerFacture');
  const fabriquerEnvoi = new Function('fetch', 'confirm', 'alert', 'nexusClient', 'NEXUS_SUPABASE_URL', 'NEXUS_SUPABASE_ANON_KEY', 'chargerClients', 'render', 'console',
    `${cc.slice(dE, fE)}\n return envoyerFacture;`);
  async function simulerEnvoi(reponses, confirmations) {
    const corps = [], questions = [], alertes = [];
    const fetch = async (_u, o) => { corps.push(JSON.parse(o.body)); const [status, data] = reponses.shift(); return { ok: status < 300, status, json: async () => data }; };
    const confirm = q => { questions.push(q); return confirmations.shift(); };
    const nexusClient = { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } };
    let recharge = 0;
    const envoyer = fabriquerEnvoi(fetch, confirm, m => alertes.push(m), nexusClient, 'u', 'k', async () => { recharge++; }, () => {}, silence);
    await envoyer('f8', { disabled: false, textContent: 'Envoyer' });
    return { corps, questions, alertes, recharge };
  }
  const BM = [409, { code: 'BONS_MANQUANTS', error: 'aucun bon' }];

  await cas('bons manquants, confirmé → second appel avec envoyerSansBons: true', async () => {
    const r = await simulerEnvoi([BM, [200, { success: true }]], [true, true]);
    assert.deepStrictEqual(r.corps, [{ invoiceId: 'f8' }, { invoiceId: 'f8', envoyerSansBons: true }]);
    assert.strictEqual(r.questions.length, 2);
    assert.match(r.questions[1], /SANS ses bons/);
    assert.match(r.questions[1], /aucun bon/);
    assert.strictEqual(r.recharge, 1);
    assert.strictEqual(r.alertes.length, 0);
  });

  await cas('bons manquants, refusé → un seul appel, rien d\'envoyé ni d\'alerte', async () => {
    const r = await simulerEnvoi([BM], [true, false]);
    assert.deepStrictEqual(r.corps, [{ invoiceId: 'f8' }]);
    assert.strictEqual(r.alertes.length, 0);
    assert.strictEqual(r.recharge, 0);
  });

  await cas('un 409 sans code, ou un refus après confirmation, ne relance jamais', async () => {
    const sansCode = await simulerEnvoi([[409, { error: 'autre' }]], [true, true]);
    assert.strictEqual(sansCode.corps.length, 1);
    assert.strictEqual(sansCode.alertes.length, 1);
    const boucle = await simulerEnvoi([BM, BM], [true, true, true]);
    assert.strictEqual(boucle.corps.length, 2, 'relance en boucle');
    assert.strictEqual(boucle.alertes.length, 1);
  });

  console.log(echecs ? `\n${echecs} échec(s)` : '\nToutes les épreuves passent.');
  process.exit(echecs ? 1 : 0);
})();
