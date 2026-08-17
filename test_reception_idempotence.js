// Test — idempotence de soumettreVisiteComplete (Sprint C4 "Réception",
// audit Carburants — chaîne de preuve, 17/08/2026).
//
// Vérifie le comportement attendu par le scénario C04 du plan de tests de
// l'audit ("Double clic validation livraison → Une seule réception
// comptabilisée"), sans navigateur — un mock minimal de client Supabase
// (chaînable .from().insert().select().single() / .eq().maybeSingle() /
// .eq().select(..., {count}) ) reproduisant les 3 cas réels :
//   1. Premier appel : insertion normale, aucun conflit.
//   2. Retry après succès complet (double clic, réponse perdue en route) :
//      conflit 23505 sur idempotency_key, visite déjà complète -> succès
//      idempotent immédiat, AUCUNE ligne/compartiment/mesure réinséré.
//   3. Retry après échec partiel (coupure réseau avant la fin de la
//      séquence d'inserts) : conflit 23505, visite existante mais SANS
//      lignes -> la soumission complète la même visite plutôt que d'en
//      créer une seconde.
//   4. Un vrai second geste (nouvelle idempotency_key) doit toujours créer
//      une nouvelle visite distincte — l'idempotence ne doit jamais fusionner
//      deux réceptions réellement différentes.
//
// Convention : chemin relatif (__dirname), comme les tests FDJ/Carburants
// déjà durcis (v2.108 et suivants).

const assert = require('assert');
require(__dirname + '/nexus-reception-donnees.js');
const D = global.NexusReceptionDonnees;

function fabriquerClientMock({ visitesExistantes = [], lignesExistantes = {} } = {}) {
  const visites = [...visitesExistantes];
  const lignesParVisite = { ...lignesExistantes };
  const appelsInsertLignes = [];
  let prochainId = visites.length + 1;

  function tableVisites() {
    return {
      insert(row) {
        return {
          select() {
            return {
              async single() {
                const conflit = visites.find(v => v.idempotency_key != null && v.idempotency_key === row.idempotency_key);
                if (conflit) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
                const v = { id: `visite-${prochainId++}`, ...row };
                visites.push(v);
                return { data: v, error: null };
              },
            };
          },
        };
      },
      select() {
        let filtreKey = null;
        return {
          eq(col, val) {
            if (col === 'idempotency_key') filtreKey = val;
            return this;
          },
          async maybeSingle() {
            const v = visites.find(x => x.idempotency_key === filtreKey);
            return { data: v || null, error: null };
          },
        };
      },
      delete() {
        return { eq: (col, val) => { const i = visites.findIndex(v => v.id === val); if (i >= 0) visites.splice(i, 1); return Promise.resolve({ error: null }); } };
      },
    };
  }

  return {
    _visites: visites,
    _appelsInsertLignes: appelsInsertLignes,
    from(table) {
      if (table === 'carburant_reception_visites') return tableVisites();
      if (table === 'carburant_reception_visite_lignes') {
        return {
          select(_cols, opts) {
            let visiteId = null;
            const builder = {
              eq(col, val) { if (col === 'visite_id') visiteId = val; return builder; },
              async then(resolve) {
                if (opts && opts.head) { resolve({ count: (lignesParVisite[visiteId] || []).length, error: null }); return; }
                resolve({ data: lignesParVisite[visiteId] || [], error: null });
              },
            };
            return builder;
          },
          insert(rows) {
            appelsInsertLignes.push(rows);
            const visiteId = rows[0] && rows[0].visite_id;
            lignesParVisite[visiteId] = (lignesParVisite[visiteId] || []).concat(rows);
            return Promise.resolve({ error: null });
          },
        };
      }
      // compartiments / mesures / anomalies : succès trivial, non testés ici.
      return { insert: () => Promise.resolve({ error: null }) };
    },
  };
}

async function main() {
  // ------------------------------------------------------------
  // 1) Premier appel — insertion normale.
  // ------------------------------------------------------------
  {
    const client = fabriquerClientMock();
    const visite = { site: 'site-test', idempotency_key: 'aaaa-1' };
    const { data, error, idempotent } = await D.soumettreVisiteComplete(client, visite, [{ carburant: 'go' }], [], [], []);
    assert.ok(!error, 'Premier appel ne doit jamais échouer');
    assert.ok(data && data.id, 'Une visite doit être créée');
    assert.ok(!idempotent, 'Le premier appel n\'est pas un rejeu idempotent');
    assert.strictEqual(client._visites.length, 1, 'Une seule visite en base');
    console.log('✓ 1. Premier appel — insertion normale, une seule visite créée');
  }

  // ------------------------------------------------------------
  // 2) Retry après succès complet — conflit 23505, visite déjà complète.
  // ------------------------------------------------------------
  {
    const client = fabriquerClientMock({
      visitesExistantes: [{ id: 'visite-existante', site: 'site-test', idempotency_key: 'bbbb-2' }],
      lignesExistantes: { 'visite-existante': [{ carburant: 'go', visite_id: 'visite-existante' }] },
    });
    const visite = { site: 'site-test', idempotency_key: 'bbbb-2' };
    const { data, error, idempotent } = await D.soumettreVisiteComplete(client, visite, [{ carburant: 'go' }], [], [], []);
    assert.ok(!error, 'Un retry après succès complet ne doit jamais être traité comme une erreur');
    assert.strictEqual(data.id, 'visite-existante', 'Doit retourner la visite déjà existante, pas en recréer une');
    assert.ok(idempotent, 'Doit être signalé comme un succès idempotent');
    assert.strictEqual(client._visites.length, 1, 'Toujours une seule visite en base — jamais un double comptage (audit C04)');
    assert.strictEqual(client._appelsInsertLignes.length, 0, 'Aucune ligne réinsérée — la soumission précédente était déjà complète');
    console.log('✓ 2. Retry après succès complet — même visite renvoyée, aucun doublon, aucune ligne réinsérée (scénario C04 de l\'audit)');
  }

  // ------------------------------------------------------------
  // 3) Retry après échec partiel — conflit 23505, visite SANS lignes.
  // ------------------------------------------------------------
  {
    const client = fabriquerClientMock({
      visitesExistantes: [{ id: 'visite-incomplete', site: 'site-test', idempotency_key: 'cccc-3' }],
      lignesExistantes: {}, // aucune ligne n'a jamais été écrite pour cette visite
    });
    const visite = { site: 'site-test', idempotency_key: 'cccc-3' };
    const { data, error, idempotent } = await D.soumettreVisiteComplete(client, visite, [{ carburant: 'sp95' }], [], [], []);
    assert.ok(!error, 'Un retry après échec partiel doit pouvoir compléter la visite existante');
    assert.strictEqual(data.id, 'visite-incomplete', 'Doit compléter la visite déjà créée, pas en créer une seconde');
    assert.ok(!idempotent, 'Ce n\'est pas un succès idempotent immédiat — la soumission a réellement fait le travail restant');
    assert.strictEqual(client._visites.length, 1, 'Toujours une seule visite en base');
    assert.strictEqual(client._appelsInsertLignes.length, 1, 'Les lignes manquantes doivent être insérées cette fois');
    console.log('✓ 3. Retry après échec partiel — complète la même visite plutôt que d\'en créer une seconde');
  }

  // ------------------------------------------------------------
  // 4) Deux gestes réellement différents (clés distinctes) -> 2 visites.
  // ------------------------------------------------------------
  {
    const client = fabriquerClientMock();
    await D.soumettreVisiteComplete(client, { site: 'site-test', idempotency_key: 'dddd-4' }, [{ carburant: 'go' }], [], [], []);
    await D.soumettreVisiteComplete(client, { site: 'site-test', idempotency_key: 'eeee-5' }, [{ carburant: 'go' }], [], [], []);
    assert.strictEqual(client._visites.length, 2, 'Deux clés distinctes = deux vraies réceptions, jamais fusionnées');
    console.log('✓ 4. Deux visites avec des clés distinctes restent deux visites distinctes');
  }

  console.log('\nTous les tests "Réception carburant — idempotence (Sprint C4)" passent.');
}

main().catch(e => { console.error(e); process.exit(1); });
