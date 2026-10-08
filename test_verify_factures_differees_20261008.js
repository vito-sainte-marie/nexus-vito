// Épreuve — 08/10/2026, mandat consolidé §4 (B4) : factures différées en
// Boutique. Cas de référence : Sainte-Marie Usine, 06/10 Q2, une facture
// de 58,00 € facturée dans Décenium Back-office et non encaissée sur le
// quart. Exigences : champ dans Boutique avec l'aide (i) exacte ; montant,
// client, n° de facture, justificatif ; pas de soustraction automatique
// (seule une facture dont la présence dans la vente du quart est cochée
// entre dans l'écart) ; refus explicites, mêmes codes que le serveur
// (migration 20261008140000, banc outils/epreuve-factures-differees-20261008).
//
// Le code est extrait du vrai NEXUS-Verify-v1.html : la preuve porte sur
// ce que l'écran calcule et écrit réellement.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Verify-v1.html'), 'utf8');
const moteurSrc = fs.readFileSync(path.join(DIR, 'nexus-verify-moteur.js'), 'utf8');
const migration = fs.readFileSync(path.join(DIR, 'supabase/migrations/20261008140000_audits_caisse_factures_differees.sql'), 'utf8');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function unique(source, motif) {
  const i = source.indexOf(motif);
  assert.ok(i !== -1, `Introuvable : ${motif}`);
  assert.strictEqual(source.indexOf(motif, i + 1), -1, `Ancre non unique : ${motif}`);
  return i;
}
function extraireBloc(source, debutMotif) {
  const debut = unique(source, debutMotif);
  let j = source.indexOf('{', debut) + 1, profondeur = 1;
  while (profondeur > 0) {
    if (source[j] === '{') profondeur++;
    else if (source[j] === '}') profondeur--;
    j++;
  }
  return source.slice(debut, j);
}

const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(moteurSrc, sandbox);
const M = sandbox.NexusVerifyMoteur;

const AIDE = 'Ventes facturées dans Décenium Back-office, non encaissées sur ce quart.';
const facture58 = { numero_facture: 'FAC-2026-2384081', montant: 58, client: 'Client fictif', justificatif: 'Facture Back-office', incluse_dans_ventes: true };

// 1. Moteur : pas de soustraction automatique.
{
  const r = M.controlerFacturesDifferees([facture58], 2432.90);
  assert.strictEqual(r.confirme, 58); assert.strictEqual(r.aVerifier, 0); assert.strictEqual(r.erreurs.length, 0);
  const r2 = M.controlerFacturesDifferees([{ ...facture58, incluse_dans_ventes: false }], 2432.90);
  assert.strictEqual(r2.confirme, 0); assert.strictEqual(r2.aVerifier, 58); assert.strictEqual(r2.erreurs.length, 0);
  ok('une facture confirmée compte 58,00 € ; non confirmée, elle reste « à vérifier » et ne compte pas');
}

// 2. Moteur : mêmes refus que le serveur, mêmes codes.
{
  const codes = lignes => [...new Set(M.controlerFacturesDifferees(lignes, 100).erreurs.map(e => e.code))].sort();
  assert.deepStrictEqual(codes([{ ...facture58, montant: 0 }]), ['FACTURE_MONTANT_INVALIDE']);
  assert.deepStrictEqual(codes([{ ...facture58, montant: -58 }]), ['FACTURE_MONTANT_INVALIDE']);
  assert.deepStrictEqual(codes([{ ...facture58, montant: 58.001 }]), ['FACTURE_MONTANT_INVALIDE']);
  assert.deepStrictEqual(codes([{ ...facture58, montant: null }]), ['FACTURE_MONTANT_INVALIDE']);
  assert.deepStrictEqual(codes([{ ...facture58, client: '  ' }]), ['FACTURE_CLIENT_REQUIS']);
  assert.deepStrictEqual(codes([{ ...facture58, numero_facture: '' }]), ['FACTURE_NUMERO_REQUIS']);
  assert.deepStrictEqual(codes([{ ...facture58, incluse_dans_ventes: undefined }]), ['FACTURE_PRESENCE_NON_DITE']);
  assert.deepStrictEqual(codes([facture58, { ...facture58, numero_facture: ' fac-2026-2384081 ', incluse_dans_ventes: false }]), ['FACTURE_EN_DOUBLE']);
  assert.deepStrictEqual(codes([{ ...facture58, montant: 100.01 }]), ['FACTURES_SUPERIEURES_VENTES']);
  assert.deepStrictEqual(codes([{ ...facture58, montant: 100.01, incluse_dans_ventes: false }]), []);
  for (const code of Object.keys(M.MESSAGES_FACTURES_DIFFEREES)) {
    assert.ok(migration.includes(`[${code}]`), `code absent du serveur : ${code}`);
  }
  const serveur = [...migration.matchAll(/raise exception '\[([A-Z_]+)\]/g)].map(m => m[1]);
  for (const code of serveur.filter(c => c !== 'FACTURE_DEJA_SAISIE' && c !== 'FACTURES_FORMAT')) {
    assert.ok(Object.prototype.hasOwnProperty.call(M.MESSAGES_FACTURES_DIFFEREES, code), `code serveur sans message : ${code}`);
  }
  ok('montant, client, numéro, présence, doublon et plafond refusés avec les codes du serveur ; chaque code serveur a son message');
}

// 3. Messages : un refus serveur se dit, une panne non.
{
  assert.strictEqual(M.messageFactureDifferee('[FACTURE_DEJA_SAISIE] La facture FAC-1 est déjà saisie sur un autre quart de la station.'),
    'Cette facture est déjà saisie sur un autre quart de la station.');
  assert.strictEqual(M.messageFactureDifferee('FACTURE_EN_DOUBLE'), 'La même facture est saisie deux fois sur ce quart.');
  assert.strictEqual(M.messageFactureDifferee('Failed to fetch'), null);
  assert.strictEqual(M.messageFactureDifferee(undefined), null);
  ok('messages explicites pour les refus métier, null pour une panne');
}

// 4. La carte : dans Boutique, aide (i) au texte exact.
{
  const carte = html.slice(unique(html, '<div class="card card-collapsible" id="cardFacturesDifferees">'), html.indexOf('id="cardDepenses"'));
  assert.ok(carte.includes(`title="${AIDE}"`), 'aide (i) : title');
  assert.ok(carte.includes(`<div class="note" id="aideFacturesDifferees" hidden>${AIDE}</div>`), 'aide (i) : texte dépliable');
  assert.ok(carte.includes('class="aide-info" role="button" tabindex="0"'), 'aide (i) accessible au toucher et au clavier');
  assert.ok(/Factures différées \(boutique\)/.test(carte));
  assert.ok(carte.includes('id="btnAddFactureDifferee"'));
  ok('carte « Factures différées (boutique) » avec l’aide (i) exacte du mandat');
}

// 5. lireFacturesDifferees, exécutée depuis le vrai HTML sur un faux DOM.
{
  const src = extraireBloc(html, 'function lireFacturesDifferees() {');
  const ligne = (champs) => ({
    querySelector(sel) {
      const cle = sel.slice(1);
      if (cle === 'incluse-facture') return { checked: !!champs.incluse };
      return { value: champs[cle] || '' };
    },
  });
  const lignes = [
    ligne({ 'montant-facture': '58,00', 'client-facture': ' Client fictif ', 'numero-facture': 'FAC-2026-2384081', 'justificatif-facture': '', incluse: true }),
    ligne({}),
    ligne({ 'montant-facture': '12,5', 'client-facture': 'Autre', 'numero-facture': 'F2', 'justificatif-facture': 'BL 4', incluse: false }),
  ];
  const ctx = { document: { querySelectorAll: sel => { assert.strictEqual(sel, '#facturesDiffereesListe .ligne-facture'); return lignes; } },
    numFR: x => Number(String(x).replace(',', '.')) };
  vm.createContext(ctx);
  vm.runInContext(src + '; this.resultat = lireFacturesDifferees();', ctx);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.resultat)), [
    { numero_facture: 'FAC-2026-2384081', client: 'Client fictif', justificatif: null, montant: 58, incluse_dans_ventes: true },
    { numero_facture: 'F2', client: 'Autre', justificatif: 'BL 4', montant: 12.5, incluse_dans_ventes: false },
  ]);
  ok('lecture de l’écran : ligne vide écartée, montant à la française, aucune clé d’auteur ni d’horodatage');
}

// 6. Câblage du calcul et de l'écriture dans le vrai gestionnaire.
{
  const handler = extraireBloc(html, "document.getElementById('btnCalculer').addEventListener('click', async () => {");
  const iControle = handler.indexOf('NexusVerifyMoteur.controlerFacturesDifferees(lireFacturesDifferees(), vente_boutique)');
  const iRefus = handler.indexOf('if (facturesDifferees.erreurs.length)');
  const iExplique = handler.indexOf('+ depense_boutique + vacataire_boutique + factures_differees_boutique;');
  const iUpsert = handler.indexOf(".from('audits_caisse').upsert(");
  assert.ok(iControle > 0 && iRefus > iControle && iExplique > iRefus && iUpsert > iExplique, 'ordre contrôle → refus → calcul → écriture');
  assert.ok(handler.includes('const factures_differees_boutique = facturesDifferees.confirme;'), 'seules les confirmées entrent dans le calcul');
  // Commentaires retirés : seule compte la clé réellement écrite.
  const upsert = handler.slice(iUpsert, handler.indexOf("{ onConflict: 'site,date,quart' }")).replace(/\/\/[^\n]*/g, '');
  assert.ok(upsert.includes('factures_differees: facturesDifferees.lignes,'));
  assert.ok(!/factures_differees_boutique\s*[:,]/.test(upsert), "la somme n'est jamais envoyée : le serveur la recalcule");
  assert.ok(handler.includes('NexusVerifyMoteur.messageFactureDifferee(error.message)'), 'refus serveur décodé');
  ok('écart boutique = drops + dépenses + vacataire + factures confirmées − attendu ; lignes envoyées, somme recalculée par le serveur');
}

// 7. Le cas de référence : l'écart boutique du quart se lit avant/après.
{
  // Valeurs fictives de forme réelle : seule la différence compte.
  const explique = 2374.90, attendu = 2432.90;
  const avant = Math.round((explique - attendu) * 100) / 100;
  const apres = Math.round((explique + M.controlerFacturesDifferees([facture58], attendu).confirme - attendu) * 100) / 100;
  const nonConfirmee = Math.round((explique + M.controlerFacturesDifferees([{ ...facture58, incluse_dans_ventes: false }], attendu).confirme - attendu) * 100) / 100;
  assert.strictEqual(avant, -58); assert.strictEqual(apres, 0); assert.strictEqual(nonConfirmee, -58);
  ok('un manque de 58,00 € dû à la facture différée tombe à 0,00 € une fois la présence confirmée, pas avant');
}

// 8. Réinitialisation et préremplissage.
{
  const reinit = extraireBloc(html, 'function reinitialiserFormulaireNouveau() {');
  assert.ok(reinit.includes("document.getElementById('facturesDiffereesListe').innerHTML = '';"));
  assert.ok(reinit.includes("'cardFacturesDifferees'"), 'la carte repart fermée');
  const prefill = extraireBloc(html, 'function prefillFormPourModification(a) {');
  assert.ok(prefill.includes('facturesExistantes.forEach(f => ajouterLigneFactureDifferee(f));'));
  assert.ok(prefill.includes("document.getElementById('cardFacturesDifferees'); if (c) c.classList.add('open');"));
  const ajout = extraireBloc(html, 'function ajouterLigneFactureDifferee(f) {');
  assert.ok(ajout.includes('FUSEAU_STATION') && !ajout.includes("toLocaleString('fr-FR')"), 'heures au fuseau de la station seulement');
  ok('nouvelle saisie sans facture héritée ; modification reconstruit les lignes avec leur trace serveur');
}

console.log(`\n${n} vérifications — factures différées B4 conformes.`);
