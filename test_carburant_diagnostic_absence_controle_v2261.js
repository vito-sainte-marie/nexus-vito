// Test — v2.261 (28/08/2026, retour de Frédéric sur une capture d'écran
// réelle) : le modal "Relevé de contrôle" affichait le MÊME texte générique
// "Aucun contrôle posé pour cette date — jaugeage pas encore saisi, ou
// écriture de contrôle en attente/échouée" pour 3 situations en réalité très
// différentes — vérifié directement sur les données réelles (Supabase,
// vito-sainte-marie, 28/08/2026) : un jaugeage SAISI par un pompiste terrain
// (`carburant_releves.origine='terrain_pompiste'`) attend simplement d'être
// ouvert et enregistré par un manager sur NEXUS-Carburants-v1.html (seul cet
// écran écrit la preuve dans carburant_controles) — ce n'est pas une panne.
//
// Ce fichier teste :
// 1) NexusCarburantMoteur.diagnosticAbsenceControle (fonction pure, moteur) —
//    les 4 branches (aucun relevé / écriture échouée / en attente de
//    validation terrain / cas résiduel honnête).
// 2) renderReleveControleModal (NEXUS-Carburants-Pilotage-v1.html) — les 3
//    messages distincts + badge "À valider"/"Échec" réellement affichés.
// 3) renderStatutReleveDuJour (même fichier) — le signal visible sur l'écran
//    principal (pas seulement dans le modal), sans avoir à l'ouvrir.
//
// Fonctions extraites du vrai fichier (Article 11, jamais recopiées à la
// main) — mêmes conventions d'extraction que test_carburant_pilotage_releve_
// controle.js (regex sur function/const) pour la partie écran.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Carburants-Pilotage-v1.html'), 'utf8');
const moteurCarburantSrc = fs.readFileSync(path.join(DIR, 'nexus-carburant-moteur.js'), 'utf8');

function extraireSync(source, nomFonction) {
  const re = new RegExp(`function ${nomFonction}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`);
  const m = source.match(re);
  if (!m) throw new Error(`Fonction ${nomFonction} introuvable`);
  return m[0];
}
function extraireConstMultiligne(source, nomConst) {
  const re = new RegExp(`const ${nomConst} = \\{[\\s\\S]*?\\n  \\};`);
  const m = source.match(re);
  if (!m) throw new Error(`Constante ${nomConst} introuvable`);
  return m[0];
}
function extraireConstLigne(source, nomConst) {
  const re = new RegExp(`const ${nomConst} = \\{[^\\n]*\\};`);
  const m = source.match(re);
  if (!m) throw new Error(`Constante ${nomConst} introuvable`);
  return m[0];
}

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// Charge le VRAI moteur (pas de mock) — diagnosticAbsenceControle doit
// rester la seule vérité (Article 11).
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(moteurCarburantSrc, sandbox);
const M = sandbox.NexusCarburantMoteur;

// ------------------------------------------------------------
// 1) diagnosticAbsenceControle — fonction pure
// ------------------------------------------------------------
{
  const r1 = M.diagnosticAbsenceControle(null);
  assert.strictEqual(r1.cas, 'aucun_jaugeage');
  assert.strictEqual(r1.niveau, 'attente');
  assert.strictEqual(r1.texte, 'Aucun jaugeage saisi pour cette date.');
  ok('diagnosticAbsenceControle(null) -> aucun_jaugeage, niveau neutre, texte honnête');
}
{
  const r2 = M.diagnosticAbsenceControle({ controle_statut: 'erreur', origine: 'manager' });
  assert.strictEqual(r2.cas, 'ecriture_echouee');
  assert.strictEqual(r2.niveau, 'alerte');
  assert.ok(r2.texte.includes('échoué'), 'texte doit mentionner l\'échec réel : ' + r2.texte);
  ok('diagnosticAbsenceControle({controle_statut:erreur}) -> ecriture_echouee, niveau alerte (rouge), jamais confondu avec une absence normale');
}
{
  // Cas réel vérifié sur Supabase (vito-sainte-marie, 28/08/2026) : jaugeage
  // saisi par le terrain (controle_statut au défaut DB 'en_attente', jamais
  // 'erreur' pour ce chemin — le pompiste n'écrit jamais carburant_controles).
  const r3 = M.diagnosticAbsenceControle({ controle_statut: 'en_attente', origine: 'terrain_pompiste', created_at: '2026-08-28T09:52:22.923454+00' });
  assert.strictEqual(r3.cas, 'en_attente_validation');
  assert.strictEqual(r3.niveau, 'attention');
  assert.ok(r3.texte.includes('terrain') && r3.texte.includes('manager'), 'texte doit expliquer le flux terrain->manager : ' + r3.texte);
  assert.ok(!r3.texte.toLowerCase().includes('échou'), 'jamais présenté comme un échec — ce n\'est pas une panne : ' + r3.texte);
  ok('diagnosticAbsenceControle({origine:terrain_pompiste}) -> en_attente_validation, niveau attention (amber), jamais confondu avec une panne (reproduit le cas réel signalé par Frédéric)');
}
{
  // erreur prioritaire même si origine était historiquement terrain (cas
  // en pratique quasi impossible — le chemin terrain n'écrit jamais
  // 'erreur' — mais l'ordre des conditions doit rester sûr si jamais cela
  // arrivait, Article 5).
  const r4 = M.diagnosticAbsenceControle({ controle_statut: 'erreur', origine: 'terrain_pompiste' });
  assert.strictEqual(r4.cas, 'ecriture_echouee');
  ok('diagnosticAbsenceControle — controle_statut=erreur prioritaire sur origine=terrain_pompiste (ordre des conditions sûr)');
}
{
  // Cas résiduel honnête : relevé manager, ni en échec, ni terrain non
  // validé, mais toujours pas de contrôle -> jamais une fausse certitude,
  // repli sur l'ancien texte générique plutôt qu'un choix arbitraire.
  const r5 = M.diagnosticAbsenceControle({ controle_statut: 'en_attente', origine: 'manager' });
  assert.strictEqual(r5.cas, 'aucun_jaugeage');
  assert.ok(r5.texte.includes('Aucun contrôle posé pour cette date'), 'repli honnête sur l\'ancien texte générique : ' + r5.texte);
  ok('diagnosticAbsenceControle — cas résiduel non identifié -> repli honnête, jamais une cause devinée arbitrairement');
}

// ------------------------------------------------------------
// 2) renderReleveControleModal — les 3 cas réellement affichés à l'écran
// ------------------------------------------------------------
const constNomCarburant = extraireConstLigne(html, 'NOM_CARBURANT');
const constNiveauCouleur = extraireConstMultiligne(html, 'NIVEAU_COULEUR');
const constLibelleReferenceType = extraireConstLigne(html, 'LIBELLE_REFERENCE_TYPE');
const fnFmtLSrc = extraireSync(html, 'fmtL');
const fnFormaterDateSrc = extraireSync(html, 'formaterDateFrCourt');
const fnControleModalSrc = extraireSync(html, 'renderReleveControleModal');

function fabriquerModal() {
  return { _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; }, querySelectorAll: () => [] };
}
function fabriquerStubGenerique() {
  return { addEventListener() {}, style: {} };
}
function construireRenderControleModal(modal) {
  const prelude = `
    ${constNomCarburant}
    ${constNiveauCouleur}
    ${constLibelleReferenceType}
    ${fnFmtLSrc}
    ${fnFormaterDateSrc}
    let CONTROLE_MODAL_PDF_REFS = {};
    function fermerControleModal() {}
    function genererEtAfficherPdfCarburant() {}
    function construireReleveControlePdf() {}
    return (${fnControleModalSrc});
  `;
  return new Function('document', 'NexusCarburantMoteur', prelude)(
    { getElementById: (id) => (id === 'controleModal' ? modal : fabriquerStubGenerique()) },
    M
  );
}

{
  const modal = fabriquerModal();
  const render = construireRenderControleModal(modal);
  const releveTerrainNonValide = { controle_statut: 'en_attente', origine: 'terrain_pompiste', created_at: '2026-08-28T09:52:22.923454+00' };
  render('2026-08-28', { go: null, sp95: null, gnr: null }, { go: [], sp95: [], gnr: [] }, ['go', 'sp95', 'gnr'], null, releveTerrainNonValide);
  const out = modal.innerHTML;
  assert.ok(out.includes('en attente de validation par un manager'), 'texte "en attente de validation" attendu pour les 3 carburants (releve terrain non validé) : ' + out);
  assert.ok(out.includes('À valider'), 'badge "À valider" attendu : ' + out);
  assert.ok(!out.includes('Échec'), 'jamais le badge "Échec" pour une saisie terrain simplement non validée : ' + out);
  ok('renderReleveControleModal — jaugeage terrain non validé -> "en attente de validation par un manager" + badge "À valider" (reproduit exactement le cas signalé par Frédéric)');
}
{
  const modal = fabriquerModal();
  const render = construireRenderControleModal(modal);
  const releveEnErreur = { controle_statut: 'erreur', origine: 'manager', created_at: '2026-08-28T09:52:22.923454+00' };
  render('2026-08-28', { go: null, sp95: null, gnr: null }, { go: [], sp95: [], gnr: [] }, ['go', 'sp95', 'gnr'], null, releveEnErreur);
  const out = modal.innerHTML;
  assert.ok(out.includes('échoué'), 'texte d\'échec réel attendu : ' + out);
  assert.ok(out.includes('Échec'), 'badge "Échec" attendu : ' + out);
  assert.ok(!out.includes('À valider'), 'jamais le badge "À valider" pour une vraie panne : ' + out);
  ok('renderReleveControleModal — écriture de contrôle en échec -> texte + badge "Échec", jamais confondu avec une saisie terrain en attente');
}
{
  const modal = fabriquerModal();
  const render = construireRenderControleModal(modal);
  render('2026-08-28', { go: null, sp95: null, gnr: null }, { go: [], sp95: [], gnr: [] }, ['go', 'sp95', 'gnr'], null, null);
  const out = modal.innerHTML;
  assert.ok(out.includes('Aucun jaugeage saisi pour cette date.'), 'aucun relevé du tout -> texte neutre honnête : ' + out);
  assert.ok(!out.includes('À valider') && !out.includes('Échec'), 'jamais de badge quand rien n\'a été saisi (situation normale, pas une action en attente) : ' + out);
  ok('renderReleveControleModal — aucun relevé pour cette date -> texte neutre, aucun badge (distinct des 2 cas précédents)');
}

// ------------------------------------------------------------
// 3) renderStatutReleveDuJour — signal visible sur l'écran principal, sans
//    avoir à ouvrir le modal "Relevé de contrôle" (point 2/2 du retour de
//    Frédéric : "signal visible sur Pilotage").
// ------------------------------------------------------------
const constLibelleMotif = extraireConstMultiligne(html, 'LIBELLE_MOTIF_JAUGEAGE_IMPOSSIBLE');
const fnStatutReleveSrc = extraireSync(html, 'renderStatutReleveDuJour');

function construireRenderStatutReleve(el) {
  const prelude = `
    ${constLibelleMotif}
    let CUVES_CONFIG = { go: { actif: true }, sp95: { actif: true }, gnr: { actif: true } };
    return (${fnStatutReleveSrc});
  `;
  return new Function('document', 'NexusCarburantMoteur', prelude)(
    { getElementById: (id) => (id === 'releveStatutJour' ? el : null) },
    M
  );
}
function fabriquerSpan() { return { textContent: '', className: '' }; }

{
  const el = fabriquerSpan();
  const render = construireRenderStatutReleve(el);
  render({
    aucunReleve: false,
    releveDuJour: { origine: 'terrain_pompiste', created_at: '2026-08-28T09:52:22.923454+00' },
    parCarburant: { go: { stockPhysiqueAffiche: 10496 }, sp95: { stockPhysiqueAffiche: 20479 }, gnr: { stockPhysiqueAffiche: 4373 } },
  });
  assert.ok(el.textContent.includes('à valider'), 'statut doit signaler "à valider" pour une saisie terrain, sans ouvrir le modal : ' + el.textContent);
  assert.strictEqual(el.className, 'relever-statut a-valider');
  ok('renderStatutReleveDuJour — jaugeage terrain non validé -> "Saisi à HH:MM — à valider" (amber), signal visible sans ouvrir "Relevé de contrôle"');
}
{
  const el = fabriquerSpan();
  const render = construireRenderStatutReleve(el);
  render({
    aucunReleve: false,
    releveDuJour: { origine: 'manager', created_at: '2026-08-27T14:10:49.514+00' },
    parCarburant: { go: { stockPhysiqueAffiche: 13250 }, sp95: { stockPhysiqueAffiche: 24066 }, gnr: { stockPhysiqueAffiche: 4373 } },
  });
  assert.ok(!el.textContent.includes('à valider'), 'un relevé déjà validé par un manager reste "Saisi" simple, jamais "à valider" : ' + el.textContent);
  assert.strictEqual(el.className, 'relever-statut saisi');
  ok('renderStatutReleveDuJour — jaugeage manager (déjà validé) -> "Saisi à HH:MM" (vert), comportement inchangé');
}

console.log(`\n${n} tests passés.`);
