// Refonte Paye (#383, GO 25/11/2026) — « absence justifiée / injustifiée » sur le CHEMIN RÉEL.
//
// LE DÉFAUT QUE CETTE ÉPREUVE INTERDIT. Une première version ne testait que le PDF,
// avec un `detail` construit à la main : elle passait alors que le moteur n'emportait
// jamais `justifiee` jusqu'au rapport. Ici le chemin est entier :
//   client simulé -> chargerRapport -> moteur -> dossierComptable -> PDF.
// Et la base est jouée dans ses deux états : colonne présente, colonne absente (42703).
// Données fictives. Aucune horloge.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['nexus-paye-moteur.js', 'nexus-paye-donnees.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx);
}
ctx.NexusEcartsDonnees = { chargerEcartsConsolides: async () => [] };
const D = ctx.NexusPayeDonnees, M = ctx.NexusPayeMoteur;

const SITE = 'site-fictif';
const PERIODE = '2026-10-01';
const EMPLOYES = [
  { id: 'e1', nom: 'Camille Fictive', role: 'caissier', actif: true, site_id: SITE },
  { id: 'e2', nom: 'Dominique Fictif', role: 'caissier', actif: true, site_id: SITE },
  { id: 'e3', nom: 'Alix Fictif', role: 'caissier', actif: true, site_id: SITE },
];
const REGLAGES = EMPLOYES.map(e => ({ employee_id: e.id, site_id: SITE, inclus_paye: true, mode_presence: 'automatique' }));
const indispo = (id, emp) => ({ id, employee_id: emp, date_debut: '2026-10-12', date_fin: '2026-10-14', type: 'absence',
  commentaire: null, motif: 'autre', confirme_le: '2026-10-15T08:00:00Z', fin_indeterminee: false, date_reprise: null });
const INDISPOS = [indispo('i1', 'e1'), indispo('i2', 'e2'), indispo('i3', 'e3')];

function client({ colonne }) {
  const table = nom => {
    const r = {
      colonnes: '',
      select(c) { this.colonnes = c; return this; },
      eq() { return this; }, gte() { return this; }, lt() { return this; }, lte() { return this; }, order() { return this; },
      maybeSingle() { return this.resoudre(true); },
      resoudre(unique) {
        if (nom === 'employee_indisponibilites' && /\bjustifiee\b/.test(this.colonnes)) {
          if (!colonne) return Promise.resolve({ data: null, error: { code: '42703', message: 'column employee_indisponibilites.justifiee does not exist' } });
          return Promise.resolve({ data: [{ id: 'i1', justifiee: true }, { id: 'i2', justifiee: false }, { id: 'i3', justifiee: null }], error: null });
        }
        const par = { employees: EMPLOYES, nexus_paye_employee_settings: REGLAGES, planning_shifts: [], pointages: [],
          employee_indisponibilites: INDISPOS, audits_caisse: [], nexus_paye_items: [], nexus_paye_periodes: null,
          station_config: { paye_config: {}, horaires: {}, planning_source: 'nexus', planning_google_sheet_url: null, planning_google_sheet_id: null } };
        return Promise.resolve({ data: par[nom], error: null });
      },
      then(ok, ko) { return this.resoudre(false).then(ok, ko); },
    };
    return r;
  };
  return { from: table };
}

// PDF : faux PDFLib qui enregistre les textes.
function pdfTextes(dossier) {
  const j = { textes: [] };
  const fonte = { widthOfTextAtSize: t => String(t).length * 5 };
  const page = { drawText(t) { j.textes.push(String(t)); }, drawRectangle() {}, drawLine() {}, drawImage() {}, drawSvgPath() {}, getSize: () => ({ width: 841.89, height: 595.28 }) };
  const doc = new Proxy({ addPage() { return page; }, async embedFont() { return fonte; }, getPages() { return []; }, getPageCount() { return 1; },
    async save() { return new Uint8Array([37]); } }, { get: (c, p) => (p in c ? c[p] : (typeof p === 'symbol' || p === 'then' ? undefined : () => {})) });
  const faux = {}; faux.window = faux; faux.document = {};
  faux.PDFLib = { PDFDocument: { create: async () => doc }, StandardFonts: { Helvetica: 'H', HelveticaBold: 'HB' }, rgb: () => ({}), PageSizes: { A4: [595.28, 841.89] } };
  for (const f of ['nexus-pdf-moteur.js', 'nexus-paye-dossier-pdf.js']) {
    new Function('window', 'global', 'document', 'PDFLib', fs.readFileSync(path.join(__dirname, f), 'utf8'))(faux, faux, faux.document, faux.PDFLib);
  }
  return faux.NexusPayeDossierPdf.construireDossierPdf(dossier, { site: SITE, nomEntreprise: 'Entreprise Fictive', provisoire: true }).then(() => j.textes);
}

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

(async () => {
  // ── Colonne présente ─────────────────────────────────────────────────────
  const avec = await D.chargerRapport(client({ colonne: true }), SITE, PERIODE);
  verifier('colonne présente : le rapport déclare la justification lisible', avec.justificationLisible === true);
  const dos = M.dossierComptable(avec);
  const det = nom => dos.salaries.find(s => s.nom === nom).variables.autresAbsences.detail;
  verifier('le moteur emporte justifiee=true jusqu\'au dossier', det('Camille Fictive').some(e => e.justifiee === true));
  verifier('le moteur emporte justifiee=false jusqu\'au dossier', det('Dominique Fictif').some(e => e.justifiee === false));
  verifier('sans réponse du manager, justifiee reste null (jamais déduite)', det('Alix Fictif').some(e => e.justifiee === null));
  const t = await pdfTextes(dos);
  verifier('le PDF écrit « Absence justifiée »', t.some(x => /Absence justifiée/.test(x)));
  verifier('le PDF écrit « Absence injustifiée »', t.some(x => /Absence injustifiée/.test(x)));
  verifier('et signale « justification non renseignée » pour l\'absence sans réponse', t.some(x => /justification non renseignée/.test(x)));

  // ── Colonne absente (migration non appliquée) ────────────────────────────
  const sans = await D.chargerRapport(client({ colonne: false }), SITE, PERIODE);
  verifier('colonne absente : le mois se charge quand même', sans && Array.isArray(sans.employes) && sans.employes.length === 3);
  verifier('et le rapport DIT que la justification n\'est pas lisible', sans.justificationLisible === false);
  const t2 = await pdfTextes(M.dossierComptable(sans));
  verifier('sans colonne, le PDF n\'invente ni « justifiée » ni « injustifiée »', !t2.some(x => /Absence (in)?justifiée/.test(x)));

  // ── Écart de caisse sans montant ─────────────────────────────────────────
  const dossierEcart = JSON.parse(JSON.stringify(dos));
  const f = dossierEcart.salaries[0].variables.financier;
  f.ecartsCaisseMois = { boutiqueCentimes: 0, pisteCentimes: 0, fdjCentimes: 0, totalCentimes: 0, sansMontant: 1 };
  const t3 = await pdfTextes(dossierEcart);
  verifier('une ligne d\'écart sans montant ressort « donnée manquante », pas 0 €', t3.some(x => /donnée manquante/i.test(x)));

  console.log(`\n${ok}/${ok} vérifications passées.`);
})().catch(e => { console.error(e); process.exit(1); });
