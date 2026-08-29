// Test — v2.268-B2 (28/08/2026), cadrage "Analyse des écarts" de Frédéric
// (Audit_NEXUS_Analyse_des_Ecarts_Verify_FDJ_PAYE.pdf) : NEXUS Verify pose
// désormais la même question structurée "Pourquoi cet écart ?" que FDJ
// (v2.267), mais avec un vocabulaire propre à Verify (piste/boutique),
// pilotée par le moteur transversal canonique NexusEcartsMoteur
// (nexus-ecarts-moteur.js, Article 11 — "une seule vérité").
//
// Trois situations, jamais un choix forcé quand il n'y a rien à
// expliquer :
//   - 'aucun_ecart'    : aucun bloc motif affiché.
//   - 'corrige_a_zero' : menu déroulant Verify (Erreur de comptage /
//     saisie / montant caisse / Vente ou article non enregistré +
//     Remboursement conditionnel au manque), motif obligatoire à
//     l'enregistrement.
//   - 'restant'        : bandeau factuel "Excédent/Manque non expliqué",
//     jamais un choix forcé — cause_code posé automatiquement à
//     'non_explique'.
//
// Fonctions extraites du vrai code (Article 11, jamais recopiées à la
// main) — même convention que test_carburant_commande_confirmer_verify_relies_v2263.js.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Verify-v1.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const ecartsMoteurSrc = fs.readFileSync(path.join(DIR, 'nexus-ecarts-moteur.js'), 'utf8');
const verifyMoteurSrc = fs.readFileSync(path.join(DIR, 'nexus-verify-moteur.js'), 'utf8');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function extraire(source, nomFonction) {
  const debut = source.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  let i = source.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (source[j] === '{') profondeur++;
    else if (source[j] === '}') profondeur--;
    j++;
  }
  return source.slice(debut, j);
}

// ------------------------------------------------------------
// Contexte : les VRAIS moteurs (nexus-ecarts-moteur.js +
// nexus-verify-moteur.js) sont chargés tels quels, exactement comme les
// <script src> de NEXUS-Verify-v1.html les charge dans le navigateur.
// ------------------------------------------------------------
function construireContexte() {
  const ctx = { console };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(ecartsMoteurSrc, ctx);
  vm.runInContext(verifyMoteurSrc, ctx);

  const src = [
    extraire(script, 'numFR'),
    extraire(script, 'blocMotifValidationHtml'),
    extraire(script, 'majBlocMotifValidation'),
    extraire(script, 'renderFormValidationCaisse'),
    'globalThis.__test = { numFR, blocMotifValidationHtml, majBlocMotifValidation, renderFormValidationCaisse };',
  ].join('\n\n');

  // Mock DOM minimal : un registre d'éléments par id, chacun capable de
  // porter un dataset, une value et un innerHTML — juste assez pour
  // majBlocMotifValidation() (lit l'input, réécrit la zone motif).
  const elements = {};
  function fabriquerElement(id) {
    return elements[id] || (elements[id] = { id, dataset: {}, value: '', _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; } });
  }
  ctx.document = { getElementById: (id) => elements[id] || null, __fabriquerElement: fabriquerElement };
  vm.runInContext(src, ctx);
  return { ctx, elements, fabriquerElement };
}

// ------------------------------------------------------------
// 1) blocMotifValidationHtml — les 3 situations
// ------------------------------------------------------------
{
  const { ctx } = construireContexte();
  const { blocMotifValidationHtml } = ctx.__test;

  // 'aucun_ecart' : écart final nul, pas d'origine connue non nulle.
  assert.strictEqual(blocMotifValidationHtml('piste', 0, 0, null), '', 'aucun bloc motif quand il n\'y a rien à expliquer');
  assert.strictEqual(blocMotifValidationHtml('piste', 0, 0, 0), '', 'aucun bloc motif quand origine et final sont tous deux nuls');

  // 'corrige_a_zero' : écart initial +12,00€ corrigé à 0 -> menu Verify
  // propre, PAS de "Remboursement" (excédent, pas manque).
  const h1 = blocMotifValidationHtml('piste', 3, 0, 12);
  assert.ok(h1.includes('Écart initial (+12,00 €) corrigé après vérification'), 'bandeau récap de l\'écart initial attendu : ' + h1);
  assert.ok(h1.includes('id="causeCode-piste-3"'), 'select motif attendu avec id précis (type+index) : ' + h1);
  assert.ok(h1.includes('Erreur de comptage') && h1.includes('Erreur de saisie') && h1.includes('Erreur sur le montant caisse') && h1.includes('Vente ou article non enregistré'), 'les 4 causes Verify attendues : ' + h1);
  assert.ok(!h1.includes('Remboursement'), 'pas de "Remboursement" pour un écart initial positif (excédent) : ' + h1);
  assert.ok(!h1.includes('rapport FDJ'), 'jamais le vocabulaire FDJ dans le menu Verify : ' + h1);

  // 'corrige_a_zero' avec écart initial NÉGATIF (manque) -> "Remboursement"
  // proposé en plus.
  const h2 = blocMotifValidationHtml('boutique', 5, 0, -8);
  assert.ok(h2.includes('Écart initial (-8,00 €) corrigé après vérification'), 'signe négatif correctement affiché : ' + h2);
  assert.ok(h2.includes('Remboursement'), '"Remboursement" proposé quand l\'écart initial était un manque : ' + h2);

  // 'restant' : écart final non nul (positif) -> bandeau "Excédent non
  // expliqué", AUCUN select, jamais un choix forcé.
  const h3 = blocMotifValidationHtml('piste', 7, 15, 15);
  assert.ok(h3.includes('🟢 Excédent non expliqué'), 'libellé exact "Excédent non expliqué" attendu (jamais "faute"/"dette"/"anomalie employé") : ' + h3);
  assert.ok(!h3.includes('<select'), 'aucun menu déroulant pour un écart restant : jamais un choix forcé : ' + h3);

  // 'restant' négatif -> "Manque non expliqué".
  const h4 = blocMotifValidationHtml('boutique', 2, -9, -9);
  assert.ok(h4.includes('🔴 Manque non expliqué'), 'libellé exact "Manque non expliqué" attendu : ' + h4);

  ok('blocMotifValidationHtml — 3 situations conformes au cadrage (aucun bloc / menu Verify propre + remboursement conditionnel / bandeau factuel jamais forcé)');
}

// ------------------------------------------------------------
// 2) renderFormValidationCaisse — le formulaire initial embarque le bloc
// motif ET pose data-origine sur le champ écart (valeur immuable relue
// plus tard par majBlocMotifValidation).
// ------------------------------------------------------------
{
  const { ctx } = construireContexte();
  const { renderFormValidationCaisse } = ctx.__test;

  const auditCorrige = { id: 'abc', ecart_piste: 0, ecart_piste_origine: 12 };
  const out1 = renderFormValidationCaisse(auditCorrige, 3, 'piste');
  assert.ok(out1.includes('data-origine="12"'), 'origine immuable posée en attribut data pour relecture live : ' + out1);
  assert.ok(out1.includes('id="motifValidation-piste-3"'), 'conteneur du bloc motif attendu (recalculé en direct) : ' + out1);
  assert.ok(out1.includes('id="causeCode-piste-3"'), 'menu motif déjà présent au premier rendu (pas seulement après un input) : ' + out1);

  // Audit sans origine connue (créé avant la migration v2.268) : jamais
  // 'corrige_a_zero' fabriqué, data-origine vide plutôt qu\'une fausse
  // valeur (Article 5).
  const auditLegacy = { id: 'legacy', ecart_boutique: 0 };
  const out2 = renderFormValidationCaisse(auditLegacy, 1, 'boutique');
  assert.ok(out2.includes('data-origine=""'), 'pas d\'origine connue -> attribut vide, jamais une valeur fabriquée : ' + out2);
  assert.ok(!out2.includes('id="causeCode-'), 'aucun motif forcé pour un audit legacy sans origine, écart final nul : ' + out2);

  // Écart restant (non nul), origine inconnue -> bandeau auto affiché
  // malgré tout (situation = 'restant' dès que le final est non nul).
  const auditRestantLegacy = { id: 'legacy2', ecart_piste: 6 };
  const out3 = renderFormValidationCaisse(auditRestantLegacy, 2, 'piste');
  assert.ok(out3.includes('Excédent non expliqué'), 'écart restant toujours signalé même sans origine connue : ' + out3);

  ok('renderFormValidationCaisse — bloc motif intégré au rendu initial, origine immuable posée en attribut, jamais de fausse précision sur les audits antérieurs à la migration');
}

// ------------------------------------------------------------
// 3) majBlocMotifValidation — recalcul en direct quand le manager modifie
// le champ "Écart définitif" (comme majResume() côté FDJ v2.267). Le
// manager tape une correction complète (écart définitif = 0), revient en
// arrière, puis corrige un manque.
// ------------------------------------------------------------
{
  const { ctx, fabriquerElement } = construireContexte();
  const { majBlocMotifValidation } = ctx.__test;

  const input = fabriquerElement('val-piste-4');
  input.dataset.origine = '12';
  input.value = '0';
  const zone = fabriquerElement('motifValidation-piste-4');
  zone.innerHTML = '';

  majBlocMotifValidation('piste', 4);
  assert.ok(zone.innerHTML.includes('Écart initial (+12,00 €) corrigé après vérification'), 'le bloc motif "corrigé" apparaît dès que le manager tape 0 dans le champ écart définitif : ' + zone.innerHTML);

  // Le manager revient sur sa saisie et retape 12,00 (aucune correction
  // finalement) -> le bloc motif redevient vide (situation 'restant', pas
  // 'corrige_a_zero' puisque final=origine=12 ≠ 0).
  input.value = '12,00';
  majBlocMotifValidation('piste', 4);
  assert.ok(zone.innerHTML.includes('Excédent non expliqué'), 'en repassant à 12,00 (= origine), la situation redevient "restant" (écart non nul) : ' + zone.innerHTML);

  // Virgule française acceptée (numFR).
  input.dataset.origine = '-8';
  input.value = '0';
  majBlocMotifValidation('piste', 4);
  assert.ok(zone.innerHTML.includes('Remboursement'), 'virgule/format FR correctement interprété par numFR, "Remboursement" proposé pour un manque corrigé : ' + zone.innerHTML);

  ok('majBlocMotifValidation — recalcul en direct correct à chaque modification du champ écart définitif, y compris retour en arrière');
}

console.log(`\n${n} tests passés.`);
