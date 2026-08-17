// Tests unitaires — nexus-fdj-analyse-donnees.js :: chargerJoursSansComptage (13/08/2026)
//
// Née de la demande directe de Frédéric : "les caisses de ces derniers
// jours n'ont pas été faites, ou plutôt les employés n'ont pas fait les
// inventaires" — NEXUS FDJ Pilotage doit pouvoir pointer ces quarts
// précisément (2 quarts fixes par jour, Quart 1/Quart 2), et
// NEXUS-FDJ-Manager-v1.html doit pouvoir ouvrir directement l'édition d'un
// quart précis via ?date=&quart=. Ce fichier couvre uniquement la fonction
// de détection des trous (aucune dépendance DOM — pure logique + mock
// Supabase), même convention que test_carburant_rattrapage.js.

global.window = global;
const BASE = __dirname + '/';
require(BASE + 'nexus-fdj-analyse-donnees.js');

const D = global.NexusFdjAnalyseDonnees;

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.error('ÉCHEC:', label); }
}
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; }
  else { failed++; console.error('ÉCHEC:', label, '— attendu', JSON.stringify(expected), 'obtenu', JSON.stringify(actual)); }
}

// Mock Supabase minimal, même convention que test_carburant_rattrapage.js :
// `.maybeSingle()` renvoie le PREMIER élément du tableau fourni pour cette
// table ; toute chaîne sans `.maybeSingle()` se résout comme une promesse
// renvoyant le tableau complet (la fonction testée fait ensuite elle-même
// toute l'agrégation locale par date/quart).
function mockClient(tables) {
  return {
    from(table) {
      const builder = {
        select() { return this; }, eq() { return this; }, gt() { return this; },
        gte() { return this; }, lte() { return this; }, lt() { return this; },
        order() { return this; }, limit() { return this; },
        maybeSingle: async () => ({ data: (tables[table] && tables[table][0]) || null, error: null }),
        then(resolve) { resolve({ data: tables[table] || [], error: null }); },
      };
      return builder;
    },
  };
}
function mockClientEchecAppel(n) {
  let compteur = 0;
  return {
    from() {
      compteur++;
      const echoue = compteur === n;
      return {
        select() { return this; }, eq() { return this; }, gte() { return this; }, lt() { return this; },
        order() { return this; }, limit() { return this; },
        maybeSingle: async () => echoue ? { data: null, error: { message: 'boom' } } : { data: null, error: null },
        then(resolve) { resolve(echoue ? { data: null, error: { message: 'boom' } } : { data: [], error: null }); },
      };
    },
  };
}

(async () => {
  // --- Site jamais démarré : rien à rattraper ---
  {
    const c = mockClient({ fdj_shifts: [] });
    const r = await D.chargerJoursSansComptage(c, 'site-test', '2026-08-13');
    assertEqual(r.jours, [], 'site sans aucun comptage : aucun jour "manquant" (Article 5 — pas encore commencé ≠ oubli)');
    assertEqual(r.premierJour, null, 'site sans aucun comptage : premierJour = null');
  }

  // Couverture complète d'une plage de jours (les deux quarts validés
  // chaque jour), pour isoler un scénario précis sans que les autres jours
  // de la fenêtre par défaut (14j) ne polluent le résultat attendu.
  function couvertureComplete(du, au) {
    const shifts = [];
    const cursor = new Date(`${du}T00:00:00`);
    const limite = new Date(`${au}T00:00:00`);
    while (cursor <= limite) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      shifts.push({ date: iso, quart: '1', statut: 'valide' }, { date: iso, quart: '2', statut: 'valide' });
      cursor.setDate(cursor.getDate() + 1);
    }
    return shifts;
  }

  // --- Scénario exact de Frédéric : 3 jours consécutifs sans AUCUN comptage (les 2 quarts manquent) ---
  {
    const shifts = couvertureComplete('2026-08-01', '2026-08-09');
    // trou : 10, 11, 12 août — aucune ligne fdj_shifts
    const c = mockClient({ fdj_shifts: shifts });
    const r = await D.chargerJoursSansComptage(c, 'site-test', '2026-08-13');
    assertEqual(r.jours, [
      { date: '2026-08-10', quarts: [{ quart: '1', statut: 'absent' }, { quart: '2', statut: 'absent' }] },
      { date: '2026-08-11', quarts: [{ quart: '1', statut: 'absent' }, { quart: '2', statut: 'absent' }] },
      { date: '2026-08-12', quarts: [{ quart: '1', statut: 'absent' }, { quart: '2', statut: 'absent' }] },
    ], '3 jours consécutifs sans aucun comptage, détectés dans le bon ordre avec les 2 quarts absents');
    assertEqual(r.premierJour, '2026-08-01', 'premier jour de suivi du site correctement identifié');
  }

  // --- Un seul quart manquant sur un jour, l'autre est fait : jamais les deux confondus ---
  {
    const shifts = couvertureComplete('2026-08-01', '2026-08-12')
      .filter(s => !(s.date === '2026-08-10' && s.quart === '2')); // retire uniquement le quart 2 du 10/08
    const c = mockClient({ fdj_shifts: shifts });
    const r = await D.chargerJoursSansComptage(c, 'site-test', '2026-08-13');
    assertEqual(r.jours, [{ date: '2026-08-10', quarts: [{ quart: '2', statut: 'absent' }] }], 'un seul quart manquant sur le jour : le quart déjà validé n\'apparaît jamais');
  }

  // --- Quart commencé mais jamais validé (brouillon) : distingué de "absent" (Article 5) ---
  {
    const shifts = couvertureComplete('2026-08-01', '2026-08-12')
      .map(s => (s.date === '2026-08-10' && s.quart === '1') ? { ...s, statut: 'brouillon' } : s);
    const c = mockClient({ fdj_shifts: shifts });
    const r = await D.chargerJoursSansComptage(c, 'site-test', '2026-08-13');
    assertEqual(r.jours, [{ date: '2026-08-10', quarts: [{ quart: '1', statut: 'brouillon' }] }], 'quart ouvert mais jamais validé : signalé "brouillon", jamais confondu avec "absent"');
  }

  // --- Aucun trou : rien à afficher ---
  {
    const shifts = [{ date: '2026-08-01', quart: '1', statut: 'valide' }];
    for (let d = 1; d <= 12; d++) {
      const iso = `2026-08-${String(d).padStart(2, '0')}`;
      shifts.push({ date: iso, quart: '1', statut: 'valide' });
      shifts.push({ date: iso, quart: '2', statut: 'valide' });
    }
    const c = mockClient({ fdj_shifts: shifts });
    const r = await D.chargerJoursSansComptage(c, 'site-test', '2026-08-13');
    assertEqual(r.jours, [], 'aucun trou dans la fenêtre : liste vide, jamais un faux positif');
  }

  // --- Site tout juste onboardé : jamais de jour "manquant" avant le premier comptage réel ---
  {
    const shifts = [{ date: '2026-08-11', quart: '1', statut: 'valide' }]; // premier comptage, 2 jours avant dateDuJour
    const c = mockClient({ fdj_shifts: shifts });
    const r = await D.chargerJoursSansComptage(c, 'site-test', '2026-08-13');
    assertEqual(r.jours, [
      { date: '2026-08-11', quarts: [{ quart: '2', statut: 'absent' }] },
      { date: '2026-08-12', quarts: [{ quart: '1', statut: 'absent' }, { quart: '2', statut: 'absent' }] },
    ], 'onboardé le 11/08 : rien signalé avant cette date, même si la fenêtre par défaut (14j) la dépasse largement');
    assertEqual(r.premierJour, '2026-08-11', 'premierJour = date du tout premier comptage, pas la borne de la fenêtre');
  }

  // --- Fenêtre personnalisée (fenetreJours) borne bien la recherche ---
  {
    const shifts = [{ date: '2026-07-01', quart: '1', statut: 'valide' }]; // premier comptage ancien, hors de propos ici
    const c = mockClient({ fdj_shifts: shifts });
    const r = await D.chargerJoursSansComptage(c, 'site-test', '2026-08-13', 2); // ne regarde que les 2 derniers jours
    assertEqual(r.jours, [
      { date: '2026-08-11', quarts: [{ quart: '1', statut: 'absent' }, { quart: '2', statut: 'absent' }] },
      { date: '2026-08-12', quarts: [{ quart: '1', statut: 'absent' }, { quart: '2', statut: 'absent' }] },
    ], 'fenetreJours=2 : seuls les 2 derniers jours sont vérifiés, pas au-delà');
  }

  // --- Aujourd'hui n'est jamais considéré comme "manquant" (le quart peut encore être en cours) ---
  {
    const shifts = [{ date: '2026-08-01', quart: '1', statut: 'valide' }];
    const c = mockClient({ fdj_shifts: shifts });
    const r = await D.chargerJoursSansComptage(c, 'site-test', '2026-08-13');
    assert(!r.jours.some(j => j.date === '2026-08-13'), "aujourd'hui (dateDuJour) n'apparaît jamais dans les jours manquants — la borne est strictement exclusive");
  }

  // --- Gestion d'erreur : échec sur la requête "premier jour" ---
  {
    const c = mockClientEchecAppel(1);
    const r = await D.chargerJoursSansComptage(c, 'site-test', '2026-08-13');
    assertEqual(r.jours, [], 'erreur sur la requête du premier jour de suivi : repli sûr, liste vide, pas de crash');
    assertEqual(r.premierJour, null, 'erreur sur la requête du premier jour de suivi : premierJour = null');
  }

  // --- Gestion d'erreur : échec sur la requête des quarts de la fenêtre (le premier jour, lui, a bien été trouvé) ---
  {
    const c = {
      calls: 0,
      from(table) {
        this.calls++;
        const echoueSecondAppel = this.calls === 2;
        return {
          select() { return this; }, eq() { return this; }, gte() { return this; }, lt() { return this; },
          order() { return this; }, limit() { return this; },
          maybeSingle: async () => ({ data: { date: '2026-07-01' }, error: null }),
          then(resolve) { resolve(echoueSecondAppel ? { data: null, error: { message: 'boom' } } : { data: [], error: null }); },
        };
      },
    };
    const r = await D.chargerJoursSansComptage(c, 'site-test', '2026-08-13');
    assertEqual(r.jours, [], 'erreur sur la requête des quarts de la fenêtre : repli sûr, liste vide');
    assertEqual(r.premierJour, '2026-07-01', 'mais premierJour reste renseigné (déjà obtenu avant l\'erreur)');
  }

  console.log(`${passed} test(s) réussi(s), ${failed} échec(s).`);
  process.exit(failed ? 1 : 0);
})();
