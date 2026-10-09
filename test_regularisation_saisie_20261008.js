// Épreuve — 08/10/2026, mandat consolidé B7 (P3) : écran manager des
// versements de régularisation, restitutions de trop-perçu et transferts
// vers le coffre (nexus-regularisation-saisie.js), ouvert depuis Analyse
// des écarts. Les règles restent au serveur (bancs P2, B3, B5) ; ici on
// prouve ce que l'écran doit garantir seul :
//   - les paramètres envoyés aux RPC (coffre sans date ni quart, transfert
//     depuis le tiroir qui a reçu, tiers seulement s'il est coché) ;
//   - « aucun double » : la clé d'idempotence survit à un refus, à une
//     coupure et à un double appui ;
//   - des erreurs explicites (code serveur → message + conseil) ;
//   - aucun formulaire pour un non-manager, la raison exacte d'un blocage ;
//   - le câblage réel dans NEXUS-Analyse-Ecarts-v1.html.
// Chaque vérification du module est rejouée sur des mutants : une
// vérification qui reste verte sur son mutant ne garde rien.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { webcrypto } = require('crypto');

const DIR = __dirname;
const SRC = fs.readFileSync(path.join(DIR, 'nexus-regularisation-saisie.js'), 'utf8');
const HTML = fs.readFileSync(path.join(DIR, 'NEXUS-Analyse-Ecarts-v1.html'), 'utf8');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function unique(source, motif) {
  const i = source.indexOf(motif);
  assert.ok(i !== -1, `Introuvable : ${motif}`);
  assert.strictEqual(source.indexOf(motif, i + 1), -1, `Ancre non unique : ${motif}`);
  return i;
}
function uniqueRe(source, re) {
  const trouves = [...source.matchAll(re)];
  assert.strictEqual(trouves.length, 1, `Attendu une seule occurrence de ${re}, trouvé ${trouves.length}`);
  return trouves[0].index;
}
function extraireBloc(source, debutMotif) {
  const debut = unique(source, debutMotif);
  let j = source.indexOf('{', debut) + 1, profondeur = 1;
  while (profondeur > 0) {
    assert.ok(j < source.length, `Bloc non fermé : ${debutMotif}`);
    if (source[j] === '{') profondeur++;
    else if (source[j] === '}') profondeur--;
    j++;
  }
  return source.slice(debut, j);
}

function charger(src, cryptoImpl = webcrypto) {
  const bac = { crypto: cryptoImpl, console, Uint8Array };
  vm.createContext(bac);
  vm.runInContext(src, bac);
  return bac.NexusRegularisationSaisie;
}
const tick = () => new Promise(r => setImmediate(r));
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// ---------------------------------------------------------------- bancs

const LIGNE_PISTE = { sourceModule: 'verify', sourceControlId: 'a-1', activite: 'piste', ecartFinal: -40 };
const LIGNE_FDJ = { sourceModule: 'fdj', sourceControlId: 'f-1', activite: 'fdj', ecartFinal: -12 };
const ETAT_OUVERT = { cloture: true, revalidation_requise: false, sans_responsable: false, deficit: 40, versements: 0, restitutions: 0, reste_du: 40, trop_percu: 0, statut_regularisation: 'OUVERT' };
const DOSSIER_VIDE = { etat: ETAT_OUVERT, versements: [], restitutions: [], transferts: [] };

// Formulaire minimal : ce que soumettre() et brancherLieu() lisent vraiment.
function fauxFormulaire(type, valeurs, extra = {}) {
  const bouton = { disabled: false, textContent: 'Enregistrer' };
  const zone = { hidden: true, innerHTML: '' };
  const form = {
    dataset: { form: type, cle: 'cle-du-formulaire', ...extra },
    elements: Object.entries(valeurs).map(([name, value]) => ({ name, type: typeof value === 'boolean' ? 'checkbox' : 'text', value, checked: value })),
    querySelector(sel) { return sel === '.regul-envoyer' ? bouton : sel === '.regul-erreur' ? zone : null; },
    addEventListener(t, fn) { if (t === 'submit') this.soumettre = () => fn({ preventDefault() {} }); },
  };
  return { form, bouton, zone };
}
function fauxConteneur({ forms = [], annuler = [] } = {}) {
  return {
    querySelectorAll(sel) {
      if (sel === 'form.regul-form') return forms;
      if (sel === '.regul-annuler') return annuler;
      return [];
    },
  };
}
function fauxClient(reponses) {
  const appels = [];
  return {
    appels,
    rpc(nom, params) {
      appels.push({ nom, params });
      const r = reponses.shift();
      return typeof r === 'function' ? r() : Promise.resolve(r || { data: { id: 'x' }, error: null });
    },
  };
}
const VALEURS_VERSEMENT = { montant: '15,50', mode: 'especes', justificatif: '', emplacement: 'tiroir_verify_piste', date: '2026-10-08', quart: '2', correctionDatation: '' };

// ------------------------------------------------- vérifications du module

const VERIFICATIONS = {
  origine(M) {
    assert.deepStrictEqual({ ...M.origineDepuisLigne(LIGNE_PISTE) }, { p_audit_id: 'a-1', p_caisse: 'piste', p_fdj_cash_control_id: null });
    assert.deepStrictEqual({ ...M.origineDepuisLigne({ ...LIGNE_PISTE, activite: 'boutique' }) }, { p_audit_id: 'a-1', p_caisse: 'boutique', p_fdj_cash_control_id: null });
    assert.deepStrictEqual({ ...M.origineDepuisLigne(LIGNE_FDJ) }, { p_audit_id: null, p_caisse: null, p_fdj_cash_control_id: 'f-1' });
    assert.strictEqual(M.origineDepuisLigne({ sourceModule: 'verify', activite: 'lavage' }), null);
    assert.strictEqual(M.origineDepuisLigne({ sourceModule: 'carburant' }), null);
  },
  montant(M) {
    assert.strictEqual(M.lireMontant('12,5'), 12.5);
    assert.strictEqual(M.lireMontant(' 1 639,60 '), 1639.6);
    for (const x of ['0', '0,00', '-3', '1,234', 'abc', '', null, '1e3']) assert.strictEqual(M.lireMontant(x), null, `refus de ${x}`);
  },
  erreurs(M) {
    const e = M.lireErreur({ message: '[QUART_RECEPTEUR_CLOTURE] le tiroir du 2026-10-07 Q2 est validé' });
    assert.strictEqual(e.code, 'QUART_RECEPTEUR_CLOTURE');
    assert.ok(e.message.includes('2026-10-07 Q2'));
    assert.ok(/quart encore ouvert/.test(e.conseil));
    const r = M.lireErreur(new TypeError('Load failed'));
    assert.strictEqual(r.code, 'RESEAU');
    assert.ok(/jamais enregistrée deux fois/.test(r.conseil));
    const b = M.lireErreur({ message: 'permission denied for function x' });
    assert.strictEqual(b.code, null);
    assert.ok(b.message.includes('permission denied'));
  },
  controleVersement(M) {
    const p = (s, o) => M.controlerVersement({ ...VALEURS_VERSEMENT, ...s }, ETAT_OUVERT, { aujourdhui: '2026-10-08', ...o }).problemes;
    assert.deepStrictEqual([...p({})], []);
    assert.ok(p({ montant: '40,01' }).some(x => /dépasse le reste dû \(40,00 €\)/.test(x)), 'plafond au reste dû');
    assert.deepStrictEqual([...p({ montant: '40' })], [], 'le reste dû exact passe');
    assert.ok(p({ mode: 'autre' }).some(x => /autre/.test(x)), 'autre sans justification');
    assert.deepStrictEqual([...p({ mode: 'autre', justificatif: 'Ticket restaurant' })], []);
    assert.ok(p({ date: '2026-10-09' }).some(x => /futur/.test(x)), 'date future');
    assert.ok(p({ quart: '' }).some(x => /quart/.test(x)));
    assert.ok(p({ date: '' }).some(x => /date/.test(x)));
    assert.deepStrictEqual([...p({ emplacement: 'coffre', date: '', quart: '' })], [], 'le coffre n\'a ni date ni quart');
    assert.ok(p({ correctionDatation: 'abc' }).some(x => /datation/.test(x)));
    assert.ok(p({ emplacement: 'poche' }).length > 0);
  },
  controleRestitution(M) {
    const base = { montant: '5', mode: 'especes', justification: 'Double versement', emplacement: 'coffre', tiers: false };
    const p = s => M.controlerRestitution({ ...base, ...s }, { trop_percu: 5 }, {}).problemes;
    assert.deepStrictEqual([...p({})], []);
    assert.ok(p({ montant: '5,01' }).some(x => /trop-perçu/.test(x)));
    assert.ok(p({ justification: 'abc' }).length === 1);
    assert.strictEqual(p({ tiers: true }).length, 2, 'tiers coché : nom et autorisation exigés');
    assert.deepStrictEqual([...p({ tiers: true, beneficiaireTiers: 'Mme X', autorisationTiers: 'SMS du payeur 08/10' })], []);
  },
  controleTransfert(M) {
    const v = { reste_au_tiroir: 10 };
    assert.deepStrictEqual([...M.controlerTransfert({ montant: '10', motif: 'Mise au coffre' }, v).problemes], []);
    assert.ok(M.controlerTransfert({ montant: '10,01', motif: 'Mise au coffre' }, v).problemes.length === 1);
    assert.ok(M.controlerTransfert({ montant: '1', motif: 'abc' }, v).problemes.length === 1);
  },
  parametres(M) {
    const o = M.origineDepuisLigne(LIGNE_PISTE);
    const pv = M.parametresVersement(o, VALEURS_VERSEMENT, 15.5, 'k');
    assert.deepStrictEqual({ ...pv }, { p_audit_id: 'a-1', p_caisse: 'piste', p_fdj_cash_control_id: null, p_montant: 15.5, p_mode: 'especes', p_justificatif: null, p_destination: 'tiroir_verify_piste', p_recepteur_date: '2026-10-08', p_recepteur_quart: '2', p_idempotency_key: 'k', p_correction_datation: null });
    const pc = M.parametresVersement(o, { ...VALEURS_VERSEMENT, emplacement: 'coffre' }, 15.5, 'k');
    assert.strictEqual(pc.p_recepteur_date, null, 'coffre : date nulle (contrainte serveur)');
    assert.strictEqual(pc.p_recepteur_quart, null, 'coffre : quart nul');
    const pr = M.parametresRestitution(o, { montant: '5', mode: 'cheque', justification: ' Double ', emplacement: 'tiroir_verify_piste', date: '2026-10-08', quart: '1', tiers: false, beneficiaireTiers: 'ignoré', autorisationTiers: 'ignoré' }, 5, 'k2');
    assert.strictEqual(pr.p_beneficiaire_tiers, null, 'tiers non coché : rien envoyé');
    assert.strictEqual(pr.p_justification, 'Double');
    assert.strictEqual(pr.p_source_quart, '1');
    const pt = M.parametresTransfert({ id: 'v-1', destination: 'tiroir_fdj', recepteur_date: '2026-10-07', recepteur_quart: '2' }, { motif: ' Coffre ' }, 3, 'k3');
    assert.deepStrictEqual({ ...pt }, { p_source: 'tiroir_fdj', p_source_date: '2026-10-07', p_source_quart: '2', p_montant: 3, p_versement_id: 'v-1', p_motif: 'Coffre', p_idempotency_key: 'k3' });
  },
  annotation(M) {
    const [a, b, c] = M.annoterVersements([
      { id: 'v1', montant: '20', destination: 'tiroir_verify_piste' },
      { id: 'v2', montant: '10', destination: 'coffre' },
      { id: 'v3', montant: '8', destination: 'tiroir_fdj', annule_le: '2026-10-08' },
    ], [
      { versement_id: 'v1', montant: '7.5' },
      { versement_id: 'v1', montant: '5', annule_le: '2026-10-08' },
    ]);
    assert.strictEqual(a.reste_au_tiroir, 12.5, 'un transfert annulé ne sort rien');
    assert.strictEqual(a.transferable, true);
    assert.strictEqual(b.transferable, false, 'un versement au coffre ne se transfère pas');
    assert.strictEqual(c.transferable, false, 'un versement annulé ne se transfère pas');
  },
  blocage(M) {
    assert.strictEqual(M.blocage(ETAT_OUVERT), null);
    assert.strictEqual(M.blocage({ ...ETAT_OUVERT, revalidation_requise: true, cloture: false }).code, 'ECART_A_REVALIDER');
    assert.strictEqual(M.blocage({ ...ETAT_OUVERT, cloture: false }).code, 'ECART_NON_CLOTURE');
    assert.strictEqual(M.blocage({ ...ETAT_OUVERT, sans_responsable: true }).code, 'ECART_SANS_RESPONSABLE');
  },
  cleSansRandomUUID(M, src) {
    // Safari iOS < 15.4 : pas de randomUUID, seulement getRandomValues.
    const M2 = charger(src, { getRandomValues: b => webcrypto.getRandomValues(b) });
    const a = M2.nouvelleCle(), b = M2.nouvelleCle();
    assert.ok(UUID_V4.test(a), a);
    assert.notStrictEqual(a, b);
    // Octets imposés : sur un tirage aléatoire, un repli qui oublie la version
    // passe une fois sur seize (le quartet tiré vaut 4 par hasard) et le
    // contre-témoin rougissait la CI au hasard (run 37920029490). 0x00 et 0xff
    // n'ont jamais par hasard ni la version 4 ni la variante 10xx.
    for (const octet of [0x00, 0xff]) {
      const M3 = charger(src, { getRandomValues: t => t.fill(octet) });
      const c = M3.nouvelleCle();
      assert.ok(UUID_V4.test(c), `octets ${octet} : ${c}`);
    }
  },
  renduManager(M) {
    const html = M.renderDossier(DOSSIER_VIDE, LIGNE_PISTE, { estManager: true, aujourdhui: '2026-10-08' });
    assert.ok(html.includes('data-form="versement"'));
    assert.ok(!html.includes('data-form="restitution"'), 'pas de trop-perçu, pas de restitution');
    assert.ok(html.includes("Versement volontaire de régularisation d&#39;un écart antérieur"));
    assert.ok(/<option value="tiroir_verify_piste" selected>/.test(html), 'destination par défaut : le tiroir de la caisse');
    assert.ok(html.includes('max="2026-10-08"'), 'date plafonnée au jour de la station');
    const cle = /data-cle="([^"]+)"/.exec(html)[1];
    assert.ok(UUID_V4.test(cle), 'une clé par formulaire');
    // Chaque (i) ouvre un texte qui existe.
    const ids = [...html.matchAll(/aria-controls="([^"]+)"/g)].map(m => m[1]);
    assert.ok(ids.length >= 4);
    for (const id of ids) assert.ok(html.includes(`id="${id}" hidden`), `aide ${id}`);
    const fdj = M.renderDossier(DOSSIER_VIDE, LIGNE_FDJ, { estManager: true });
    assert.ok(/<option value="tiroir_fdj" selected>/.test(fdj));
  },
  renduNonManager(M) {
    const d = { ...DOSSIER_VIDE, versements: M.annoterVersements([{ id: 'v1', montant: 10, destination: 'tiroir_verify_piste', mode_encaissement: 'especes' }], []) };
    const html = M.renderDossier(d, LIGNE_PISTE, { estManager: false });
    assert.ok(!html.includes('<form'), 'aucun formulaire');
    assert.ok(!html.includes('regul-annuler'), 'aucune annulation');
    assert.ok(!html.includes('regul-ouvrir-transfert'), 'aucun transfert');
    assert.ok(html.includes('réservés aux managers et gérants'));
  },
  renduBloque(M) {
    const html = M.renderDossier({ ...DOSSIER_VIDE, etat: { ...ETAT_OUVERT, revalidation_requise: true } }, LIGNE_PISTE, { estManager: true });
    assert.ok(!html.includes('<form'));
    assert.ok(html.includes('data-code="ECART_A_REVALIDER"'));
    assert.ok(html.includes('validez de nouveau'), 'le conseil accompagne le blocage');
  },
  renduSoldeEtTropPercu(M) {
    const solde = M.renderDossier({ ...DOSSIER_VIDE, etat: { ...ETAT_OUVERT, reste_du: 0, statut_regularisation: 'SOLDE' } }, LIGNE_PISTE, { estManager: true });
    assert.ok(!solde.includes('<form') && solde.includes('Écart soldé'));
    const tp = M.renderDossier({ ...DOSSIER_VIDE, etat: { ...ETAT_OUVERT, reste_du: 0, trop_percu: 5 } }, LIGNE_PISTE, { estManager: true });
    assert.ok(tp.includes('data-form="restitution"') && !tp.includes('data-form="versement"'));
    assert.ok(tp.includes('Trop-perçu à restituer'));
  },
  renduOperations(M) {
    const versements = M.annoterVersements([
      { id: 'v1', montant: 20, destination: 'tiroir_verify_piste', recepteur_date: '2026-10-08', recepteur_quart: '1', mode_encaissement: 'carte_bancaire', justificatif: '<img src=x onerror=alert(1)>' },
      { id: 'v2', montant: 5, destination: 'coffre', mode_encaissement: 'especes', annule_le: '2026-10-08', motif_annulation: 'Saisie en double' },
    ], []);
    const html = M.renderDossier({ ...DOSSIER_VIDE, versements }, LIGNE_PISTE, { estManager: true });
    assert.ok(!html.includes('<img'), 'texte libre échappé');
    assert.ok(html.includes('data-id="v1">Transférer au coffre (reste 20,00 €)'));
    assert.ok(html.includes('class="regul-op annulee" data-op="versement" data-id="v2"'), 'un annulé reste visible');
    assert.ok(html.includes('Annulé : Saisie en double'));
    assert.strictEqual((html.match(/data-rpc="annuler_versement_regularisation"/g) || []).length, 1, 'pas d\'annulation d\'un annulé');
  },
  async soumissionRefusPuisReprise(M) {
    const client = fauxClient([
      { data: null, error: { message: '[QUART_RECEPTEUR_CLOTURE] tiroir validé' } },
      () => Promise.reject(new TypeError('Failed to fetch')),
      { data: { id: 'v' }, error: null },
    ]);
    let succes = 0;
    const { form, bouton, zone } = fauxFormulaire('versement', VALEURS_VERSEMENT);
    M.brancherDossier(fauxConteneur({ forms: [form] }), { client, origine: M.origineDepuisLigne(LIGNE_PISTE), dossier: DOSSIER_VIDE, aujourdhui: '2026-10-08', apresSucces: async () => { succes++; } });
    form.soumettre(); await tick();
    assert.strictEqual(zone.hidden, false);
    assert.ok(zone.innerHTML.includes('quart encore ouvert') && zone.innerHTML.includes('QUART_RECEPTEUR_CLOTURE'), 'refus : message, conseil et code');
    assert.strictEqual(bouton.disabled, false, 'bouton rendu après un refus');
    form.soumettre(); await tick();
    assert.ok(zone.innerHTML.includes('connexion a été perdue'));
    form.soumettre(); await tick();
    assert.strictEqual(succes, 1);
    assert.strictEqual(client.appels.length, 3);
    assert.ok(client.appels.every(a => a.nom === 'enregistrer_versement_regularisation'));
    assert.ok(client.appels.every(a => a.params.p_idempotency_key === 'cle-du-formulaire'), 'même clé à chaque reprise');
    assert.strictEqual(client.appels[0].params.p_montant, 15.5);
  },
  async doubleAppui(M) {
    let liberer;
    const client = fauxClient([() => new Promise(r => { liberer = () => r({ data: {}, error: null }); })]);
    const { form, bouton } = fauxFormulaire('versement', VALEURS_VERSEMENT);
    M.brancherDossier(fauxConteneur({ forms: [form] }), { client, origine: M.origineDepuisLigne(LIGNE_PISTE), dossier: DOSSIER_VIDE, apresSucces: async () => {} });
    form.soumettre(); form.soumettre();
    assert.strictEqual(bouton.disabled, true);
    assert.strictEqual(bouton.textContent, 'Enregistrement…');
    liberer(); await tick();
    assert.strictEqual(client.appels.length, 1, 'un double appui n\'envoie qu\'une fois');
  },
  async controleLocalSansAppel(M) {
    const client = fauxClient([]);
    const { form, zone } = fauxFormulaire('versement', { ...VALEURS_VERSEMENT, montant: '99' });
    M.brancherDossier(fauxConteneur({ forms: [form] }), { client, origine: M.origineDepuisLigne(LIGNE_PISTE), dossier: DOSSIER_VIDE, apresSucces: async () => {} });
    form.soumettre(); await tick();
    assert.strictEqual(client.appels.length, 0);
    assert.ok(zone.innerHTML.includes('reste dû (40,00 €)'));
  },
  async transfertDepuisLeTiroir(M) {
    const client = fauxClient([]);
    const versements = M.annoterVersements([{ id: 'v1', montant: 20, destination: 'tiroir_verify_boutique', recepteur_date: '2026-10-07', recepteur_quart: '2' }], []);
    const dossier = { ...DOSSIER_VIDE, versements };
    const { form } = fauxFormulaire('transfert', { montant: '20,00', motif: 'Mise en sécurité' }, { versement: 'v1' });
    M.brancherDossier(fauxConteneur({ forms: [form] }), { client, origine: null, dossier, apresSucces: async () => {} });
    form.soumettre(); await tick();
    assert.strictEqual(client.appels[0].nom, 'enregistrer_transfert_coffre');
    assert.strictEqual(client.appels[0].params.p_source, 'tiroir_verify_boutique');
    assert.strictEqual(client.appels[0].params.p_versement_id, 'v1');
  },
  async annulation(M) {
    const client = fauxClient([]);
    const alertes = [];
    const motifs = ['abc', 'Saisie en double'];
    const handlers = {};
    const mk = (rpc, id) => ({ dataset: { rpc, id }, disabled: false, addEventListener(t, fn) { handlers[rpc] = fn; } });
    const btns = [mk('annuler_versement_regularisation', 'v1'), mk('annuler_restitution_trop_percu', 'r1'), mk('annuler_transfert_coffre', 't1')];
    let succes = 0;
    M.brancherDossier(fauxConteneur({ annuler: btns }), { client, dossier: DOSSIER_VIDE, apresSucces: async () => { succes++; }, demanderMotif: () => motifs.shift() || 'Erreur de saisie', alerter: m => alertes.push(m) });
    await handlers.annuler_versement_regularisation();
    assert.strictEqual(client.appels.length, 0, 'motif trop court : rien n\'est envoyé');
    assert.strictEqual(alertes.length, 1);
    await handlers.annuler_versement_regularisation();
    await handlers.annuler_restitution_trop_percu();
    await handlers.annuler_transfert_coffre();
    assert.deepStrictEqual(client.appels.map(a => Object.keys(a.params)[0]), ['p_versement_id', 'p_restitution_id', 'p_transfert_id']);
    assert.strictEqual(client.appels[0].params.p_motif, 'Saisie en double');
    assert.strictEqual(succes, 3);
  },
  async chargement(M) {
    const journal = [];
    const requete = table => {
      const q = { table, filtres: [], select() { return q; }, eq(c, v) { q.filtres.push(`${c}=${v}`); return q; }, in(c, v) { q.filtres.push(`${c} in ${v}`); return q; },
        order() { journal.push(q); return Promise.resolve({ data: table === 'ecarts_versements_regularisation' && q.avecVersement ? [{ id: 'v1', montant: 5, destination: 'coffre' }] : [], error: null }); } };
      return q;
    };
    let avecVersement = false;
    const client = { rpc: async () => ({ data: ETAT_OUVERT, error: null }), from: t => { const q = requete(t); q.avecVersement = avecVersement; return q; } };
    await M.chargerDossier(client, M.origineDepuisLigne(LIGNE_FDJ));
    assert.deepStrictEqual(journal.map(q => q.filtres.join('&')), ['fdj_cash_control_id=f-1', 'fdj_cash_control_id=f-1']);
    assert.ok(!journal.some(q => q.table === 'caisse_transferts_coffre'), 'sans versement, aucune lecture des transferts');
    journal.length = 0; avecVersement = true;
    const d = await M.chargerDossier(client, M.origineDepuisLigne(LIGNE_PISTE));
    assert.deepStrictEqual(journal.slice(0, 2).map(q => q.filtres.join('&')), ['audit_id=a-1&caisse_origine=piste', 'audit_id=a-1&caisse_origine=piste']);
    assert.ok(journal.some(q => q.table === 'caisse_transferts_coffre' && q.filtres[0] === 'versement_id in v1'));
    assert.strictEqual(d.versements[0].transferable, false);
    const enErreur = { rpc: async () => ({ data: null, error: { message: '[ACCES_REFUSE] réservé aux managers' } }), from: () => { throw new Error('ne doit pas lire'); } };
    await assert.rejects(M.chargerDossier(enErreur, M.origineDepuisLigne(LIGNE_PISTE)), e => M.lireErreur(e).code === 'ACCES_REFUSE');
  },
};

async function verifier(src) {
  const M = charger(src);
  const echecs = [];
  for (const [nom, f] of Object.entries(VERIFICATIONS)) {
    try { await f(M, src); } catch (e) { echecs.push({ nom, e }); }
  }
  return echecs;
}

// Chaque mutant désigne la vérification qui doit le voir.
const MUTANTS = [
  ['clé régénérée à chaque envoi', 'const cle = form.dataset.cle;', 'const cle = nouvelleCle();', 'soumissionRefusPuisReprise'],
  ['double appui non gardé', "    if (bouton.disabled) return;\n    const s = lireForm(form);", '    const s = lireForm(form);', 'doubleAppui'],
  ['plafond au reste dû retiré', 'else if (etat && etat.reste_du != null && montant > Number(etat.reste_du))', 'else if (false)', 'controleVersement'],
  ['coffre daté', 'p_recepteur_date: coffre ? null : s.date,', 'p_recepteur_date: s.date,', 'parametres'],
  ['transfert depuis le coffre', 'p_source: versement.destination,', "p_source: 'coffre',", 'parametres'],
  ['tiers envoyé sans case', "p_beneficiaire_tiers: s.tiers ? String(s.beneficiaireTiers || '').trim() : null,", "p_beneficiaire_tiers: String(s.beneficiaireTiers || '').trim() || null,", 'parametres'],
  ['formulaire montré au non-manager', '    if (!estManager) {\n', '    if (false) {\n', 'renduNonManager'],
  ['blocage ignoré', "    if (etat.revalidation_requise) return { code: 'ECART_A_REVALIDER'", "    if (false) return { code: 'ECART_A_REVALIDER'", 'renduBloque'],
  ['erreur non rendue au bouton', 'bouton.disabled = false; bouton.textContent = texte;', 'bouton.textContent = texte;', 'soumissionRefusPuisReprise'],
  ['texte libre non échappé', '${v.justificatif ? `<div class="regul-op-note">${esc(v.justificatif)}</div>`', '${v.justificatif ? `<div class="regul-op-note">${v.justificatif}</div>`', 'renduOperations'],
  ['transfert annulé décompté', '.filter(t => t.versement_id === v.id && !t.annule_le)', '.filter(t => t.versement_id === v.id)', 'annotation'],
  ['motif d\'annulation non contrôlé', "if (String(motif).trim().length < 5) { (ctx.alerter", "if (false) { (ctx.alerter", 'annulation'],
  ['repli Safari sans version 4', 'b[6] = (b[6] & 0x0f) | 0x40;', '', 'cleSansRandomUUID'],
  ['repli Safari sans variante', ' b[8] = (b[8] & 0x3f) | 0x80;', '', 'cleSansRandomUUID'],
  ['réseau sans conseil', "const reseau = /Failed to fetch|NetworkError|Load failed/i.test(brut);", 'const reseau = false;', 'erreurs'],
  ['site FDJ filtré par audit', "? requete.eq('fdj_cash_control_id', origine.p_fdj_cash_control_id)", "? requete.eq('audit_id', origine.p_audit_id)", 'chargement'],
];

// ------------------------------------------ intégration dans Analyse des écarts

function integration(html) {
  // Le module est chargé après le relevé Paye et avant le script de l'écran.
  // Le paramètre `?v=` est réécrit par outils/build.sh avant la suite (la CI
  // mesure l'arbre construit) : on ancre sur le nom du module, pas sur sa version.
  const iPaye = uniqueRe(html, /<script src="nexus-paye-regularisations\.js\?v=[^"]+"><\/script>/g);
  const iSaisie = uniqueRe(html, /<script src="nexus-regularisation-saisie\.js\?v=[^"]+"><\/script>/g);
  assert.ok(iPaye < iSaisie && iSaisie < unique(html, 'let EMPLOYEE_ID_COURANT = null;'));
  assert.ok(html.includes('NEXUS · Analyse des écarts — v2.271'));
  assert.ok(/\.aide-info\{[^}]*background:transparent; border:none/.test(html), 'le (i) est un vrai bouton, sans fond');
  assert.ok(/\.regul-champ input\[type=text\][^{]*\{[^}]*font-size:16px/.test(html), 'Safari iOS ne zoome pas sous 16 px');
  // EST_MANAGER vient de nexusEstManager, jamais d'un rôle recodé à l'écran.
  unique(html, 'EST_MANAGER = nexusEstManager(employee);');
  assert.ok(/LIGNES_COMPOSITION = triees;[\s\S]{0,400}triees\.map\(renderLigneComposition\)/.test(html), 'les lignes sont indexées avant le rendu');
  assert.ok(/brancherQualification\(document\.getElementById\('pdCorps'\)\);\s*brancherRegul\(document\.getElementById\('pdCorps'\)\);/.test(html));
  assert.ok(extraireBloc(html, 'function renderLigneComposition(l) {').includes('${regulBouton(l)}'));

  // Le bouton, exécuté : ni pour un non-manager, ni sur un excédent, ni hors Verify/FDJ.
  const bac = { NexusRegularisationSaisie: charger(SRC), EST_MANAGER: true, LIGNES_COMPOSITION: [] };
  vm.createContext(bac);
  vm.runInContext(extraireBloc(html, 'function regulBouton(l) {'), bac);
  const lignes = [LIGNE_PISTE, { ...LIGNE_PISTE, ecartFinal: 3 }, { sourceModule: 'carburant', ecartFinal: -9 }, LIGNE_FDJ];
  bac.LIGNES_COMPOSITION = lignes;
  assert.strictEqual(bac.regulBouton(lignes[0]), '<button type="button" class="btn-regul" data-regul-ligne="0">Versement de régularisation</button>');
  assert.strictEqual(bac.regulBouton(lignes[1]), '', 'excédent : rien à régulariser');
  assert.strictEqual(bac.regulBouton(lignes[2]), '', 'origine inconnue');
  assert.ok(bac.regulBouton(lignes[3]).includes('data-regul-ligne="3"'));
  bac.EST_MANAGER = false;
  assert.strictEqual(bac.regulBouton(lignes[0]), '', 'non-manager');

  // Le dossier s'ouvre sur l'origine de la ligne, au jour de la station, et
  // se rouvre après un succès sur l'état que le serveur vient de calculer.
  const ouvrir = extraireBloc(html, 'async function ouvrirDossierRegularisation(l) {');
  assert.ok(ouvrir.includes('NexusRegularisationSaisie.chargerDossier(nexusClient, origine)'));
  assert.ok(ouvrir.includes('NexusStation.dateLocaleStation(FUSEAU_STATION, new Date())'));
  assert.ok(/apresSucces: async \(\) => \{ await rechargerEtRafraichir\(\); await ouvrirDossierRegularisation\(l\); \}/.test(ouvrir));
  assert.ok(ouvrir.includes('estManager: EST_MANAGER'));
  assert.ok(ouvrir.includes('NexusRegularisationSaisie.lireErreur(e)'), 'un refus de lecture s\'explique');
}

(async () => {
  const echecs = await verifier(SRC);
  for (const { nom, e } of echecs) console.error(`ÉCHEC — ${nom} : ${e.message}`);
  assert.strictEqual(echecs.length, 0, 'le module réel doit tout passer');
  for (const nom of Object.keys(VERIFICATIONS)) ok(nom);

  for (const [libelle, avant, apres, attendu] of MUTANTS) {
    unique(SRC, avant);
    const e = await verifier(SRC.replace(avant, apres));
    assert.ok(e.some(x => x.nom === attendu), `mutant « ${libelle} » non vu par ${attendu}`);
    ok(`contre-témoin : ${libelle} → ${attendu} rougit`);
  }

  integration(HTML);
  ok('intégration Analyse des écarts v2.271');
  // Contre-témoin d'intégration : bouton offert sans contrôle du rôle.
  const sansRole = HTML.replace('if (!EST_MANAGER || !(l.ecartFinal < 0)', 'if (!(l.ecartFinal < 0)');
  assert.notStrictEqual(sansRole, HTML);
  assert.throws(() => integration(sansRole), /non-manager/);
  ok('contre-témoin : bouton sans contrôle du rôle → intégration rougit');

  console.log(`\n${n} vérifications — régularisation saisie (B7) verte.`);
})().catch(e => { console.error(e); process.exit(1); });
