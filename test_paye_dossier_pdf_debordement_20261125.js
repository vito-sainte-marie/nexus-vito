// Défaut P1 — PDF « Dossier comptable » : une cellule trop longue recouvrait son
// libellé et sortait de la page. pdf-lib vient d'un CDN : on substitue un faux
// PDFLib qui ENREGISTRE chaque texte dessiné (x, y, taille), et on fait tourner
// le VRAI moteur et le VRAI construireDossierPdf. Données entièrement fictives.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const RACINE = __dirname;
let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

const LARGEUR_CAR = 5; // largeur fictive d'un caractère, à la taille 9 (proportionnelle à la taille)
function fausseFonte() { return { widthOfTextAtSize: (t, s) => String(t).length * LARGEUR_CAR * (s / 9) }; }
function fauxPdfLib(journal) {
  const page = () => ({
    drawText(t, o) { journal.textes.push({ t: String(t), x: o.x, y: o.y, size: o.size, page: journal.pages }); },
    drawRectangle() {}, drawLine() {}, drawImage() {}, drawSvgPath() {},
    getSize: () => ({ width: 595.28, height: 841.89 }),
  });
  const doc = new Proxy({
    addPage() { journal.pages++; return page(); },
    async embedFont() { return fausseFonte(); },
    getPages() { return []; }, getPageCount() { return journal.pages; },
    async save() { return new Uint8Array([37, 80, 68, 70]); },
  }, { get: (c, p) => (p in c ? c[p] : (typeof p === 'symbol' || p === 'then' ? undefined : () => {})) });
  return { PDFDocument: { create: async () => doc }, StandardFonts: { Helvetica: 'H', HelveticaBold: 'HB' }, rgb: () => ({}) };
}

function charger(journal) {
  const faux = {};
  faux.window = faux;
  faux.PDFLib = fauxPdfLib(journal);
  faux.document = {};
  const f = (fichier) => new Function('window', 'global', 'document', 'PDFLib', fs.readFileSync(path.join(RACINE, fichier), 'utf8'))(faux, faux, faux.document, faux.PDFLib);
  f('nexus-pdf-moteur.js');
  f('nexus-paye-dossier-pdf.js');
  return faux;
}

function dossierFictif(nbJours) {
  const detailJours = [];
  for (let i = 1; i <= nbJours; i++) detailJours.push({ date: `2026-10-${String(i).padStart(2, '0')}`, normales: 7, supplementaires: i % 3 === 0 ? 1 : 0 });
  const vide = { jours: 0, detail: [] };
  return {
    periode: '2026-10-01', genereLe: '2026-11-01T10:00:00Z', statutGlobal: 'pret',
    ecartsNonAttribues: 0,
    synthese: { salaries: 1, prets: 1, aVerifier: 0, donneeManquante: 0, joursTravailles: nbJours, heuresConfirmees: nbJours * 7,
      joursCongesPayes: 0, joursMaladieMaternite: 0, joursAbsenceNonDeclaree: 0, joursFeries: 0, heuresSupplementaires: 10,
      retardsMinutes: 0, acompteCentimes: 0, detteCentimes: 0 },
    salaries: [{
      nom: 'Salarié Fictif', role: 'employe', statut: 'pret', statutLibelle: 'Prêt',
      variables: {
        elementsEnAttente: 0,
        presence: { jours: nbJours, heures: nbJours * 7 + 10, heuresNormales: nbJours * 7, detailJours, joursMesures: nbJours, joursReconstitues: 0, joursPlanifies: 0, heuresParDefaut: 0 },
        absence: { jours: 0 }, congesPayes: vide, maladieMaternite: vide, autresAbsences: vide,
        retards: { occurrences: 0, minutes: 0, detail: [] },
        heuresSupplementaires: { heures: 10, enAttente: 0, heuresDejaIncluses: 0 },
        joursFeries: { jours: 3, dates: Array.from({ length: 12 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`) },
        financier: { acompteCentimes: 0, detteCentimes: 0, retenueEcartCentimes: 0, ecartsCaisseMois: [], ecartsInformatifs: 0, lignes: [] },
      },
    }],
  };
}

(async () => {
  const journal = { textes: [], pages: 0 };
  const faux = charger(journal);
  await faux.NexusPayeDossierPdf.construireDossierPdf(dossierFictif(31), { site: 'site-fictif' });
  const M = faux.NexusPdfMoteur;
  const LARG_P = M.A4.hauteur, HAUT_P = M.A4.largeur, MG = 28; // dossier : A4 paysage, marge 28
  const droite = LARG_P - MG;

  verifier('aucun texte ne sort de la page (marge gauche et droite) avec 31 jours de détail', () => {
    const fautifs = journal.textes.filter(e => e.x < MG - 0.01 || e.x + e.t.length * LARGEUR_CAR * (e.size / 9) > droite + 0.01);
    assert.strictEqual(fautifs.length, 0, 'textes hors page : ' + JSON.stringify(fautifs.slice(0, 3)));
  });
  verifier('aucun décalage négatif : x jamais inférieur à la marge', () => {
    assert.ok(journal.textes.every(e => e.x >= MG));
  });
  verifier('toutes les lignes restent dans la page verticalement', () => {
    assert.ok(journal.textes.every(e => e.y > 0 && e.y < HAUT_P));
  });

  // Moteur seul : cellule trop longue, tous alignements, mot insécable plus large que la colonne.
  const j2 = { textes: [], pages: 0 };
  const f2 = charger(j2);
  const rapport = await f2.NexusPdfMoteur.creerRapport({ titre: 't' });
  const long = 'mot ' + 'x'.repeat(200) + ' ' + Array.from({ length: 40 }, (_, i) => `2026-10-${i} 7 h`).join(' ; ');
  rapport.tableau([{ label: 'A', cle: 'a', largeur: 0.5 }, { label: 'B', cle: 'b', largeur: 0.5, align: 'droite' }], [{ a: long, b: long }, { a: 'court', b: 'court' }]);
  verifier('moteur : cellule démesurée (gauche et droite) reste dans sa colonne', () => {
    const M2 = f2.NexusPdfMoteur;
    const col = 0.5 * M2.LARGEUR_UTILE;
    for (const e of j2.textes.filter(e => e.t !== 'A' && e.t !== 'B')) {
      const w = e.t.length * LARGEUR_CAR * (e.size / 9);
      const debutCol = e.x < M2.MARGE + col ? M2.MARGE : M2.MARGE + col;
      assert.ok(e.x >= debutCol + 6 - 0.01 && e.x + w <= debutCol + col - 6 + 0.01, `débordement : ${e.t.slice(0, 30)} x=${e.x} w=${w}`);
    }
  });
  verifier('moteur : une ligne qui tient garde sa hauteur d’origine (15,5)', () => {
    const j3 = { textes: [], pages: 0 };
    return charger(j3).NexusPdfMoteur.creerRapport({ titre: 't' }).then(r => {
      const y0 = r.y;
      r.tableau([{ label: 'A', cle: 'a', largeur: 1 }], [{ a: 'court' }, { a: 'court' }]);
      assert.strictEqual(Math.round((y0 - r.y) * 100) / 100, 15.5 * 3 + 8);
    });
  });
  console.log(`\n${passes} vérifications réussies`);
})().catch(e => { console.error('ÉCHEC —', e.message); process.exit(1); });
