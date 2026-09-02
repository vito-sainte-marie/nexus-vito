const assert = require('assert');
const fs = require('fs');

require('./nexus-paye-donnees.js');

const D = globalThis.NexusPayeDonnees;
const ecran = fs.readFileSync('NEXUS-Paye-v1.html', 'utf8');

assert.ok(ecran.includes('id="manualDateDebut"') && ecran.includes('id="manualDateFin"'));
assert.ok(ecran.includes('id="manualPeriodSummary"') && ecran.includes('Ajouter ${dates.length} jours et valider'));
assert.ok(ecran.includes("Un montant en euros doit être rattaché à une seule date"));

assert.deepStrictEqual(D.datesInclusives('2026-09-02', '2026-09-02'), ['2026-09-02']);
assert.deepStrictEqual(D.datesInclusives('2026-09-28', '2026-10-02'), [
  '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02',
]);
assert.throws(() => D.datesInclusives('2026-09-06', '2026-09-02'), /précède/);
assert.throws(() => D.datesInclusives('2026-02-30', '2026-03-02'), /invalide/);

(async () => {
  let lignes = null;
  const client = {
    from(table) {
      assert.strictEqual(table, 'nexus_paye_items');
      return {
        async upsert(payload) { lignes = payload; return { error: null }; },
      };
    },
  };
  await D.ajouterItemsManuels(client, {
    siteId: 'site-test', employeeId: 'employe-1', periode: '2026-09-01',
    dates: D.datesInclusives('2026-09-02', '2026-09-04'),
    typeItem: 'conge_paye', libelle: 'Congé validé', impactPaye: true, actorId: 'manager-1',
  });
  assert.strictEqual(lignes.length, 3);
  assert.deepStrictEqual(lignes.map(l => l.date_evenement), ['2026-09-02', '2026-09-03', '2026-09-04']);
  assert.ok(lignes.every(l => l.statut === 'valide' && l.impact_paye === true));
  assert.strictEqual(new Set(lignes.map(l => l.source_cle)).size, 3);
  console.log('Période manuelle PAYE : génération inclusive et écriture groupée validées.');
})().catch(error => { console.error(error); process.exit(1); });
