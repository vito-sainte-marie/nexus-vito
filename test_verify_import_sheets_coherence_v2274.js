// Test — v2.274 (29/08/2026) : nexus-verify-moteur.js —
// verdictCoherenceImportSheets, retour de Frédéric §2/§3 ("vérifier la
// cohérence date + quart + personnel entre les données importées et
// l'audit ouvert. En cas d'incohérence, bloquer l'application automatique
// et proposer directement 'Ouvrir le bon quart'."). Fonction pure
// uniquement — aucun accès Supabase/DOM ici (couvert séparément par
// relecture directe du code de branchement dans NEXUS-Verify-v1.html,
// documenté dans le Data Dictionary).

const path = require('path');
const assert = require('assert');
const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
require(path.join(DIR, 'nexus-verify-moteur.js'));
const M = globalThis.NexusVerifyMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) Rien à signaler : date écrite explicitement, aucun employé "attendu"
// fourni (audit tout juste commencé) -> jamais une fausse alerte.
// ------------------------------------------------------------
{
  const v = M.verdictCoherenceImportSheets({ dateLiteraleSurLaLigne: true, personnel: [] });
  assert.strictEqual(v.bloquer, false);
  assert.deepStrictEqual(v.alertes, []);
  ok('aucune alerte quand tout est cohérent et rien à comparer');
}

// ------------------------------------------------------------
// 2) Date reportée (forward-fill) -> bloque, avec le code attendu.
// ------------------------------------------------------------
{
  const v = M.verdictCoherenceImportSheets({ dateLiteraleSurLaLigne: false, personnel: [] });
  assert.strictEqual(v.bloquer, true);
  assert.strictEqual(v.alertes.length, 1);
  assert.strictEqual(v.alertes[0].code, 'date_reportee');
  ok('date reportée -> bloque avec code date_reportee');
}

// ------------------------------------------------------------
// 3) Personnel différent sur une caisse (déjà un nom enregistré sur ce
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
// 4) Personnel identique (déjà normalisé par l'appelant) -> pas d'alerte.
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
// 5) Rien à comparer (attendu ou importé absent) -> jamais une fausse
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
// 6) Deux alertes cumulées (date reportée ET personnel différent) ->
// les deux remontent, jamais une seule masquant l'autre.
// ------------------------------------------------------------
{
  const v = M.verdictCoherenceImportSheets({
    dateLiteraleSurLaLigne: false,
    personnel: [{ caisse: 'piste', attendu: 'fred', importe: 'marie' }],
  });
  assert.strictEqual(v.bloquer, true);
  assert.strictEqual(v.alertes.length, 2);
  assert.deepStrictEqual(v.alertes.map(a => a.code).sort(), ['date_reportee', 'personnel_different']);
  ok('deux incohérences cumulées -> les deux alertes remontent');
}

console.log(`\n${n} tests passés.`);
