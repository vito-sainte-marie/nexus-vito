const assert = require('assert');
const fs = require('fs');

// Le moteur porte la liste des types réservés aux événements RH : la couche
// de données s'appuie dessus, il doit donc être chargé — comme dans l'écran,
// où les deux scripts sont servis ensemble.
require('./nexus-paye-moteur.js');
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
  // Une variable du mois (ici des heures supplémentaires) reste saisissable
  // sur plusieurs journées : c'est bien un fait par jour.
  await D.ajouterItemsManuels(client, {
    siteId: 'site-test', employeeId: 'employe-1', periode: '2026-09-01',
    dates: D.datesInclusives('2026-09-02', '2026-09-04'),
    typeItem: 'heure_supplementaire', libelle: 'Heures supplémentaires validées', impactPaye: true, actorId: 'manager-1',
  });
  assert.strictEqual(lignes.length, 3);
  assert.deepStrictEqual(lignes.map(l => l.date_evenement), ['2026-09-02', '2026-09-03', '2026-09-04']);
  assert.ok(lignes.every(l => l.statut === 'valide' && l.impact_paye === true));
  assert.strictEqual(new Set(lignes.map(l => l.source_cle)).size, 3);

  // En revanche, un congé ne se saisit PLUS journée par journée (03/09/2026) :
  // c'est un événement RH unique, porté par employee_indisponibilites. Ce
  // test encodait auparavant le comportement inverse — il encode désormais
  // le refus, sur tous les motifs concernés.
  for (const type of ['conge_paye', 'arret_maladie', 'conge_maternite', 'formation']) {
    let refuse = false;
    try {
      await D.ajouterItemsManuels(client, {
        siteId: 'site-test', employeeId: 'employe-1', periode: '2026-09-01',
        dates: ['2026-09-02'], typeItem: type, libelle: 'x', impactPaye: true, actorId: 'manager-1',
      });
    } catch (e) { refuse = /événement RH unique/.test(e.message); }
    assert.ok(refuse, `${type} doit être refusé en saisie journalière`);
  }

  // Et si le moteur venait à manquer, le garde-fou ÉCHOUE : il ne se
  // désactive jamais en silence, ce qui rouvrirait la saisie journalière
  // sans que personne s'en aperçoive.
  const moteur = globalThis.NexusPayeMoteur;
  delete globalThis.NexusPayeMoteur;
  let echoueFranchement = false;
  try { D.refuserEvenementRHParJournee('acompte'); }
  catch (e) { echoueFranchement = /Moteur PAYE indisponible/.test(e.message); }
  globalThis.NexusPayeMoteur = moteur;
  assert.ok(echoueFranchement, 'sans moteur, le garde-fou doit échouer, jamais laisser passer');

  console.log('Période manuelle PAYE : saisie inclusive validée, événements RH refusés par journée.');
})().catch(error => { console.error(error); process.exit(1); });
