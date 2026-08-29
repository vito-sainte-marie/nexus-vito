// Test — v2.274/v2.276 (29/08/2026) : nexus-verify-moteur.js —
// verdictCoherenceImportSheets + estReportDateRisque, retour de Frédéric
// §2/§3 ("vérifier la cohérence date + quart + personnel entre les
// données importées et l'audit ouvert. En cas d'incohérence, bloquer
// l'application automatique et proposer directement 'Ouvrir le bon
// quart'."), affiné en v2.276 après un test réel de Frédéric sur 28/08
// Quart 2 (voir estReportDateRisque). Fonctions pures uniquement — aucun
// accès Supabase/DOM ici (couvert séparément par relecture directe du
// code de branchement dans NEXUS-Verify-v1.html, documenté dans le Data
// Dictionary).

const path = require('path');
const assert = require('assert');
const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
require(path.join(DIR, 'nexus-verify-moteur.js'));
const M = globalThis.NexusVerifyMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) Rien à signaler : date écrite explicitement sur la ligne elle-même,
// aucun employé "attendu" fourni (audit tout juste commencé) -> jamais
// une fausse alerte.
// ------------------------------------------------------------
{
  const v = M.verdictCoherenceImportSheets({ dateLiteraleSurLaLigne: true, personnel: [] });
  assert.strictEqual(v.bloquer, false);
  assert.deepStrictEqual(v.alertes, []);
  ok('aucune alerte quand tout est cohérent et rien à comparer');
}

// ------------------------------------------------------------
// 2) v2.276 — Report d'UNE seule ligne (distance 1, ex: Quart 2 juste
// sous Quart 1, cellule Date fusionnée) -> PAS de blocage, c'est la
// structure normale d'un classeur, pas un risque réel (retour de
// Frédéric, test du 28/08 Quart 2).
// ------------------------------------------------------------
{
  const v = M.verdictCoherenceImportSheets({ dateLiteraleSurLaLigne: false, distanceDepuisDateLiterale: 1, personnel: [] });
  assert.strictEqual(v.bloquer, false);
  assert.deepStrictEqual(v.alertes, []);
  ok('report d\'une seule ligne (Quart 1/Quart 2 même jour) -> aucune alerte');
}

// ------------------------------------------------------------
// 3) v2.276 — Report sur PLUSIEURS lignes (distance > 1, ex: jour ou
// quart manquant dans le classeur) -> bloque, c'est le vrai risque déjà
// vécu par Frédéric (01/06 demandé, données du 02/06 utilisées).
// ------------------------------------------------------------
{
  const v = M.verdictCoherenceImportSheets({ dateLiteraleSurLaLigne: false, distanceDepuisDateLiterale: 3, personnel: [] });
  assert.strictEqual(v.bloquer, true);
  assert.strictEqual(v.alertes.length, 1);
  assert.strictEqual(v.alertes[0].code, 'date_reportee');
  ok('report sur plusieurs lignes -> bloque avec code date_reportee');
}

// ------------------------------------------------------------
// 4) v2.276 — Distance inconnue (non transmise) -> traité comme un
// risque (repli prudent, jamais l'inverse : Article 5, en cas de doute on
// ne masque pas un risque potentiel).
// ------------------------------------------------------------
{
  const v = M.verdictCoherenceImportSheets({ dateLiteraleSurLaLigne: false, personnel: [] });
  assert.strictEqual(v.bloquer, true);
  assert.strictEqual(v.alertes[0].code, 'date_reportee');
  ok('distance inconnue -> traité comme un risque (repli prudent)');
}

// ------------------------------------------------------------
// 5) estReportDateRisque isolée — les mêmes règles, testées directement.
// ------------------------------------------------------------
{
  assert.strictEqual(M.estReportDateRisque(true, 1), false, 'date littérale sur la ligne -> jamais un risque, peu importe la distance');
  assert.strictEqual(M.estReportDateRisque(false, 1), false, 'distance 1 -> pas un risque');
  assert.strictEqual(M.estReportDateRisque(false, 2), true, 'distance 2 -> un risque');
  assert.strictEqual(M.estReportDateRisque(false, null), true, 'distance inconnue -> un risque (repli prudent)');
  ok('estReportDateRisque — règle isolée conforme (littérale > distance <= 1 > distance inconnue)');
}

// ------------------------------------------------------------
// 6) Personnel différent sur une caisse (déjà un nom enregistré sur ce
// quart, le classeur en propose un autre) -> bloque, avec la caisse et
// les deux noms dans le message.
// ------------------------------------------------------------
{
  const v = M.verdictCoherenceImportSheets({
    dateLiteraleSurLaLigne: true,
    personnel: [
      { caisse: 'piste', caisseLabel: 'Piste', attendu: 'fred', attenduLabel: 'Fred', importe: 'marie', importeLabel: 'Marie' },
    ],
  });
  assert.strictEqual(v.bloquer, true);
  assert.strictEqual(v.alertes.length, 1);
  assert.strictEqual(v.alertes[0].code, 'personnel_different');
  assert.strictEqual(v.alertes[0].caisse, 'piste');
  assert.ok(v.alertes[0].message.includes('Fred') && v.alertes[0].message.includes('Marie'), 'les deux noms doivent apparaître dans le message');
  ok('personnel différent sur une caisse -> bloque avec code personnel_different');
}

// ------------------------------------------------------------
// 7) Personnel identique (déjà normalisé par l'appelant) -> pas d'alerte.
// ------------------------------------------------------------
{
  const v = M.verdictCoherenceImportSheets({
    dateLiteraleSurLaLigne: true,
    personnel: [
      { caisse: 'boutique', attendu: 'angelique', importe: 'angelique' },
    ],
  });
  assert.strictEqual(v.bloquer, false);
  assert.deepStrictEqual(v.alertes, []);
  ok('personnel identique -> aucune alerte');
}

// ------------------------------------------------------------
// 8) Rien à comparer (attendu ou importé absent) -> jamais une fausse
// alerte, même si l'un des deux est renseigné.
// ------------------------------------------------------------
{
  const v1 = M.verdictCoherenceImportSheets({ dateLiteraleSurLaLigne: true, personnel: [{ caisse: 'piste', attendu: null, importe: 'marie' }] });
  const v2 = M.verdictCoherenceImportSheets({ dateLiteraleSurLaLigne: true, personnel: [{ caisse: 'piste', attendu: 'fred', importe: null }] });
  assert.strictEqual(v1.bloquer, false);
  assert.strictEqual(v2.bloquer, false);
  ok('rien à comparer (un des deux noms absent) -> jamais une fausse alerte');
}

// ------------------------------------------------------------
// 9) Deux alertes cumulées (report de date risqué ET personnel
// différent) -> les deux remontent, jamais une seule masquant l'autre.
// ------------------------------------------------------------
{
  const v = M.verdictCoherenceImportSheets({
    dateLiteraleSurLaLigne: false,
    distanceDepuisDateLiterale: 4,
    personnel: [{ caisse: 'piste', attendu: 'fred', importe: 'marie' }],
  });
  assert.strictEqual(v.bloquer, true);
  assert.strictEqual(v.alertes.length, 2);
  assert.deepStrictEqual(v.alertes.map(a => a.code).sort(), ['date_reportee', 'personnel_different']);
  ok('deux incohérences cumulées -> les deux alertes remontent');
}

console.log(`\n${n} tests passés.`);
