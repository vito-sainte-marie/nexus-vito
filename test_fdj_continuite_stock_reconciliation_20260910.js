// Test — Continuité de stock FDJ : une alerte ne survit pas à sa cause
// (10/09/2026)
//
// Constat de Frédéric sur la Production : le quart 2 du 09/09/2026
// affichait encore « Continuité de stock à vérifier » alors que les deux
// compteurs avaient été remis d'accord la veille — et l'écran affichait
// EN MÊME TEMPS « Chaîne continue ».
//
// Cause démontrée : `reconcilierAlertesChaine` commence par
// `if (a.type !== 'chaine_interrompue') continue;`. Elle peut donc POSER
// des alertes 'continuite_stock_a_verifier', jamais les rouvrir. Aucun
// autre chemin ne le faisait : une alerte de stock restait ouverte à vie,
// quelle que soit la réalité des compteurs.
//
// Ce test exécute les VRAIES fonctions de l'écran (extraites par comptage
// d'accolades, comme tous les tests de ce module) contre un faux Supabase
// en mémoire, et le VRAI nexus-fdj-moteur.js (require direct, aucun mock
// du calcul).

const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const CHEMIN_BASE = __dirname;
require(`${CHEMIN_BASE}/nexus-fdj-moteur.js`);
const NexusFdjMoteur = global.NexusFdjMoteur;

const html = fs.readFileSync(`${CHEMIN_BASE}/NEXUS-FDJ-Manager-v1.html`, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  const iAsync = script.indexOf(`async function ${nomFonction}(`);
  const debut = iAsync !== -1 ? iAsync : script.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable dans l'écran`);
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j);
}

// ------------------------------------------------------------
// FAUX CLIENT SUPABASE — même esprit que test_fdj_continuite_auto_recalcul.js,
// avec en plus `.is(colonne, null)` (utilisé par les chargeurs d'alertes
// ouvertes) et un `maybeSingle()` qui respecte tous les filtres posés.
// ------------------------------------------------------------
function creerNexusClientFake(tables, options) {
  const opts = options || {};
  function correspond(ligne, filtres) {
    return filtres.every(([type, c, v]) => {
      if (type === 'is') return ligne[c] === null || ligne[c] === undefined;
      return ligne[c] === v;
    });
  }
  function from(table) {
    tables[table] = tables[table] || [];
    return {
      select() {
        const filtres = [];
        let inFiltre = null, limiteN = null;
        const lire = () => {
          let lignes = tables[table].filter(l => correspond(l, filtres));
          if (inFiltre) lignes = lignes.filter(l => inFiltre[1].includes(l[inFiltre[0]]));
          if (limiteN) lignes = lignes.slice(0, limiteN);
          return lignes;
        };
        const api = {
          eq(c, v) { filtres.push(['eq', c, v]); return api; },
          is(c) { filtres.push(['is', c, null]); return api; },
          in(c, v) { inFiltre = [c, v]; return api; },
          order() { return api; },
          limit(n) { limiteN = n; return api; },
          maybeSingle() {
            if (opts.echecLecture && opts.echecLecture(table)) return Promise.resolve({ data: null, error: { message: 'lecture refusée' } });
            return Promise.resolve({ data: lire()[0] || null, error: null });
          },
          single() {
            const l = lire()[0];
            return Promise.resolve({ data: l || null, error: l ? null : { message: 'introuvable' } });
          },
          then(resolve) { resolve({ data: lire(), error: null }); },
        };
        return api;
      },
      update(patch) {
        const filtres = [];
        const api = {
          eq(c, v) { filtres.push(['eq', c, v]); return api; },
          then(resolve) {
            tables[table] = tables[table].map(l => correspond(l, filtres) ? Object.assign(l, patch) : l);
            resolve({ data: null, error: null });
          },
        };
        return api;
      },
      insert(entree) {
        const arr = Array.isArray(entree) ? entree : [entree];
        const inserees = arr.map(l => ({ id: l.id || `id-${Math.random().toString(36).slice(2, 8)}`, ...l }));
        tables[table].push(...inserees);
        return Promise.resolve({ data: inserees, error: null });
      },
    };
  }
  return { from };
}

// Faux DOM minimal : `renderDetailContinuiteStock` écrit dans #content et
// pose des écouteurs. On capture le HTML produit — c'est la preuve de ce
// que le manager voit réellement, pas une reconstitution à la main.
function creerDocumentFake(capture) {
  const noeud = (id) => ({
    set innerHTML(v) { capture[id] = v; },
    get innerHTML() { return capture[id] || ''; },
    set textContent(v) { capture[id] = v; },
    get textContent() { return capture[id] || ''; },
    addEventListener() {},
  });
  const cache = {};
  return {
    getElementById(id) { cache[id] = cache[id] || noeud(id); return cache[id]; },
    querySelectorAll() { return []; },
  };
}

function nouveauContexte(tables, jeuxInitiaux, employes, capture, options) {
  const ctx = {
    console, NexusFdjMoteur,
    siteId: 'vito-sainte-marie',
    jeux: jeuxInitiaux || [],
    employesSite: employes || [],
    vue: 'liste',
    detailContinuite: null,
    nexusClient: creerNexusClientFake(tables, options),
    document: creerDocumentFake(capture || {}),
    renderAccueil: () => {},
    ouvrirDepuisParametresUrl: async () => {},
    chargerJeux: async () => ctx.jeux,
    chargerEmployesSite: async () => ctx.employesSite,
  };
  ctx.globalThis = ctx;
  const noms = [
    'fmtNum', 'nomJeu', 'nomEmploye', 'libelleQuart',
    'chargerAlertesContinuiteStockOuvertes', 'mesurerContinuiteStockAlerte',
    'reconcilierAlertesContinuiteStock', 'synchroniserRelevesApresRetablissementChaine',
    'ouvrirDetailContinuiteStock', 'renderDetailContinuiteStock', 'renderLigneContinuiteStock',
    'calculerIntegriteQuart', 'badgeIntegrite',
  ];
  const src = noms.map(extraire).join('\n\n') + '\n\n'
    + noms.map(n => `globalThis.__${n} = ${n};`).join('\n');
  vm.runInNewContext(src, ctx);
  return ctx;
}

// ------------------------------------------------------------
const JEUX = [
  { id: 'jeu-patrimoine', nom: 'MISSION PATRIMOINE 15€', prix: 15 },
  { id: 'jeu-cash', nom: 'CASH 5€', prix: 5 },
  { id: 'jeu-fetiche', nom: 'FETICHE 2€', prix: 2 },
];
const EMPLOYES = [{ id: 'emp-1', nom: 'Employé Q1' }, { id: 'emp-2', nom: 'Employé Q2' }];
const Q1 = { id: 'shift-q1', site: 'vito-sainte-marie', date: '2026-09-09', quart: '1', employee_id: 'emp-1', statut: 'valide' };
const Q2 = { id: 'shift-q2', site: 'vito-sainte-marie', date: '2026-09-09', quart: '2', employee_id: 'emp-2', statut: 'valide' };

function alerte(id, gameId, valPrec, valAct, extra) {
  return Object.assign({
    id, site: 'vito-sainte-marie', type: 'continuite_stock_a_verifier',
    shift_id: Q2.id, shift_precedent_id: Q1.id, game_id: gameId,
    valeur_quart_precedent: valPrec, valeur_saisie: valAct,
    employee_id: 'emp-2', vue: false, vue_par: null, vue_le: null,
    created_at: '2026-09-09T21:20:06.185Z', motif: null, quarts_manquants: null,
    resolue_automatiquement: false, resolue_le: null,
  }, extra || {});
}
function compteur(shiftId, gameId, champs) {
  return Object.assign({ id: `c-${shiftId}-${gameId}`, site: 'vito-sainte-marie', shift_id: shiftId, game_id: gameId,
    stock_initial: null, appro: 0, stock_final: null, stock_initial_auto: false }, champs || {});
}

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

(async () => {
  // ── Épreuve 1 — écart toujours présent : l'alerte est maintenue ───────
  {
    const tables = {
      fdj_shifts: [{ ...Q1 }, { ...Q2 }],
      fdj_alertes: [alerte('a1', 'jeu-patrimoine', 0, 1)],
      fdj_shift_counts: [
        compteur(Q1.id, 'jeu-patrimoine', { stock_final: 0 }),
        compteur(Q2.id, 'jeu-patrimoine', { stock_initial: 1 }),
      ],
      fdj_audit_log: [], fdj_releves_cloture: [], fdj_reports: [], fdj_cash_controls: [],
    };
    const ctx = nouveauContexte(tables, JEUX, EMPLOYES, {});
    const ouvertes = await ctx.__chargerAlertesContinuiteStockOuvertes();
    const mutations = await ctx.__reconcilierAlertesContinuiteStock(ouvertes);
    const a = tables.fdj_alertes[0];
    verifier('un écart réel laisse l’alerte ouverte', a.resolue_automatiquement === false && a.resolue_le === null);
    verifier('… et aucune écriture n’est signalée à l’écran', mutations === false);
    verifier('… et aucun comptage humain n’est réécrit',
      tables.fdj_shift_counts.find(c => c.shift_id === Q2.id).stock_initial === 1);
  }

  // ── Épreuve 2 — valeurs redevenues égales : résolution automatique ────
  // Le cas exact de la Production : l'alerte porte 0 / 1, mais les deux
  // compteurs valent 0 aujourd'hui.
  {
    const tables = {
      fdj_shifts: [{ ...Q1 }, { ...Q2 }],
      fdj_alertes: [alerte('a1', 'jeu-patrimoine', 0, 1)],
      fdj_shift_counts: [
        compteur(Q1.id, 'jeu-patrimoine', { stock_final: 0 }),
        compteur(Q2.id, 'jeu-patrimoine', { stock_initial: 0 }),
      ],
      fdj_audit_log: [], fdj_releves_cloture: [], fdj_reports: [], fdj_cash_controls: [],
    };
    const ctx = nouveauContexte(tables, JEUX, EMPLOYES, {});
    const mutations = await ctx.__reconcilierAlertesContinuiteStock(await ctx.__chargerAlertesContinuiteStockOuvertes());
    const a = tables.fdj_alertes[0];
    verifier('un écart devenu nul résout l’alerte automatiquement', a.resolue_automatiquement === true);
    verifier('… avec un horodatage de résolution', typeof a.resolue_le === 'string' && !Number.isNaN(Date.parse(a.resolue_le)));
    verifier('… et l’écran est prévenu qu’il doit relire les alertes', mutations === true);
    verifier('… sans jamais toucher au moindre comptage',
      tables.fdj_shift_counts.every(c => c.stock_final === 0 || c.stock_initial === 0));
    verifier('… et « vu » reste ce qu’il était : un accusé de lecture, pas une résolution', a.vue === false);
  }

  // ── Épreuve 3 — plusieurs jeux : résolution jeu par jeu ───────────────
  {
    const tables = {
      fdj_shifts: [{ ...Q1 }, { ...Q2 }],
      fdj_alertes: [
        alerte('a-patrimoine', 'jeu-patrimoine', 0, 1),
        alerte('a-cash', 'jeu-cash', 18, 17),
        alerte('a-fetiche', 'jeu-fetiche', 35, 30),
      ],
      fdj_shift_counts: [
        compteur(Q1.id, 'jeu-patrimoine', { stock_final: 0 }), compteur(Q2.id, 'jeu-patrimoine', { stock_initial: 0 }),
        compteur(Q1.id, 'jeu-cash', { stock_final: 18 }), compteur(Q2.id, 'jeu-cash', { stock_initial: 18 }),
        compteur(Q1.id, 'jeu-fetiche', { stock_final: 35 }), compteur(Q2.id, 'jeu-fetiche', { stock_initial: 30 }),
      ],
      fdj_audit_log: [], fdj_releves_cloture: [], fdj_reports: [], fdj_cash_controls: [],
    };
    const ctx = nouveauContexte(tables, JEUX, EMPLOYES, {});
    await ctx.__reconcilierAlertesContinuiteStock(await ctx.__chargerAlertesContinuiteStockOuvertes());
    const par = Object.fromEntries(tables.fdj_alertes.map(a => [a.id, a]));
    verifier('les deux jeux redevenus cohérents sont résolus',
      par['a-patrimoine'].resolue_automatiquement === true && par['a-cash'].resolue_automatiquement === true);
    verifier('… et le jeu encore en écart reste ouvert, seul',
      par['a-fetiche'].resolue_automatiquement === false && par['a-fetiche'].resolue_le === null);
  }

  // ── Épreuve 4 — origines et emplacement : le détail ne devine rien ────
  // « Deux emplacements différents » : la continuité de stock porte, par
  // construction, sur le compteur de tickets de la CAISSE — le Bureau
  // n'est jamais compté par quart (voir emplacementContinuiteStock).
  // Ce qui varie réellement d'un jeu à l'autre, et que le détail doit
  // distinguer, c'est l'ORIGINE de chaque valeur : héritée ou humaine.
  {
    const herite = NexusFdjMoteur.detailContinuiteStock({
      alerte: alerte('a1', 'jeu-cash', 18, 17), jeuNom: 'CASH 5€',
      mesure: { shiftPrecedentId: Q1.id, stockFinalPrecedent: 18, stockInitialActuel: 17 },
      quartPrecedent: Q1, quartActuel: Q2, employePrecedent: 'Employé Q1', employeActuel: 'Employé Q2',
      stockInitialAuto: true,
    });
    const humain = NexusFdjMoteur.detailContinuiteStock({
      alerte: alerte('a2', 'jeu-fetiche', 35, 30), jeuNom: 'FETICHE 2€',
      mesure: { shiftPrecedentId: Q1.id, stockFinalPrecedent: 35, stockInitialActuel: 30 },
      quartPrecedent: Q1, quartActuel: Q2, employePrecedent: 'Employé Q1', employeActuel: 'Employé Q2',
      stockInitialAuto: false,
    });
    verifier('l’emplacement est nommé, et c’est la caisse',
      herite.emplacement.cle === 'caisse' && herite.emplacement.libelle === 'Caisse');
    verifier('une valeur héritée est annoncée comme héritée', herite.suivant.origine.cle === 'heritee');
    verifier('une valeur confirmée par un humain est annoncée comme telle', humain.suivant.origine.cle === 'saisie_humaine');
    verifier('le stock final du quart précédent est toujours d’origine humaine', humain.precedent.origine.cle === 'saisie_humaine');
    verifier('chaque quart porte sa date, son numéro et son employé',
      herite.precedent.date === '2026-09-09' && herite.precedent.quart === '1' && herite.precedent.employe === 'Employé Q1'
      && herite.suivant.date === '2026-09-09' && herite.suivant.quart === '2' && herite.suivant.employe === 'Employé Q2');
    verifier('l’écart affiché est celui recalculé maintenant, pas celui figé dans l’alerte',
      herite.ecart === 1 && humain.ecart === 5);
  }

  // ── Épreuve 5 — donnée manquante : aucune résolution abusive ──────────
  {
    const cas = [
      { nom: 'stock final du quart précédent absent', counts: [compteur(Q1.id, 'jeu-cash', { stock_final: null }), compteur(Q2.id, 'jeu-cash', { stock_initial: 0 })] },
      { nom: 'stock initial du quart suivant absent', counts: [compteur(Q1.id, 'jeu-cash', { stock_final: 0 }), compteur(Q2.id, 'jeu-cash', { stock_initial: null })] },
      { nom: 'aucune ligne de comptage', counts: [] },
    ];
    for (const c of cas) {
      const tables = {
        fdj_shifts: [{ ...Q1 }, { ...Q2 }], fdj_alertes: [alerte('a1', 'jeu-cash', 18, 17)],
        fdj_shift_counts: c.counts, fdj_audit_log: [], fdj_releves_cloture: [], fdj_reports: [], fdj_cash_controls: [],
      };
      const ctx = nouveauContexte(tables, JEUX, EMPLOYES, {});
      await ctx.__reconcilierAlertesContinuiteStock(await ctx.__chargerAlertesContinuiteStockOuvertes());
      verifier(`donnée manquante (${c.nom}) : l’alerte reste ouverte`, tables.fdj_alertes[0].resolue_automatiquement === false);
    }
    // Le quart précédent lui-même inconnu
    {
      const tables = {
        fdj_shifts: [{ ...Q2 }], fdj_alertes: [alerte('a1', 'jeu-cash', 18, 17, { shift_precedent_id: null })],
        fdj_shift_counts: [compteur(Q2.id, 'jeu-cash', { stock_initial: 0 })],
        fdj_audit_log: [], fdj_releves_cloture: [], fdj_reports: [], fdj_cash_controls: [],
      };
      const ctx = nouveauContexte(tables, JEUX, EMPLOYES, {});
      await ctx.__reconcilierAlertesContinuiteStock(await ctx.__chargerAlertesContinuiteStockOuvertes());
      verifier('quart précédent non rattaché : l’alerte reste ouverte', tables.fdj_alertes[0].resolue_automatiquement === false);
    }
    // Une LECTURE en échec n'est pas une donnée absente — et surtout pas
    // une égalité : dans le doute, on ne conclut rien.
    {
      const tables = {
        fdj_shifts: [{ ...Q1 }, { ...Q2 }], fdj_alertes: [alerte('a1', 'jeu-cash', 18, 17)],
        fdj_shift_counts: [compteur(Q1.id, 'jeu-cash', { stock_final: 0 }), compteur(Q2.id, 'jeu-cash', { stock_initial: 0 })],
        fdj_audit_log: [], fdj_releves_cloture: [], fdj_reports: [], fdj_cash_controls: [],
      };
      const ctx = nouveauContexte(tables, JEUX, EMPLOYES, {}, { echecLecture: (t) => t === 'fdj_shift_counts' });
      await ctx.__reconcilierAlertesContinuiteStock(await ctx.__chargerAlertesContinuiteStockOuvertes());
      verifier('lecture des compteurs en échec : aucune résolution', tables.fdj_alertes[0].resolue_automatiquement === false);
    }
  }

  // ── Épreuve 6 — idempotence ──────────────────────────────────────────
  {
    const tables = {
      fdj_shifts: [{ ...Q1 }, { ...Q2 }], fdj_alertes: [alerte('a1', 'jeu-patrimoine', 0, 1)],
      fdj_shift_counts: [compteur(Q1.id, 'jeu-patrimoine', { stock_final: 0 }), compteur(Q2.id, 'jeu-patrimoine', { stock_initial: 0 })],
      fdj_audit_log: [], fdj_releves_cloture: [], fdj_reports: [], fdj_cash_controls: [],
    };
    const ctx = nouveauContexte(tables, JEUX, EMPLOYES, {});
    await ctx.__reconcilierAlertesContinuiteStock(await ctx.__chargerAlertesContinuiteStockOuvertes());
    const resolueLe1 = tables.fdj_alertes[0].resolue_le;
    const auditApres1 = tables.fdj_audit_log.length;
    const ouvertes2 = await ctx.__chargerAlertesContinuiteStockOuvertes();
    const mutations2 = await ctx.__reconcilierAlertesContinuiteStock(ouvertes2);
    verifier('une alerte déjà résolue n’est plus rechargée', ouvertes2.length === 0);
    verifier('… le second passage n’écrit rien', mutations2 === false && tables.fdj_audit_log.length === auditApres1);
    verifier('… et l’horodatage de résolution n’est pas réécrit', tables.fdj_alertes[0].resolue_le === resolueLe1);
  }

  // ── Épreuve 7 — historique et audit conservés ────────────────────────
  {
    const tables = {
      fdj_shifts: [{ ...Q1 }, { ...Q2 }], fdj_alertes: [alerte('a1', 'jeu-patrimoine', 0, 1)],
      fdj_shift_counts: [compteur(Q1.id, 'jeu-patrimoine', { stock_final: 0 }), compteur(Q2.id, 'jeu-patrimoine', { stock_initial: 0 })],
      fdj_audit_log: [], fdj_releves_cloture: [], fdj_reports: [], fdj_cash_controls: [],
    };
    const ctx = nouveauContexte(tables, JEUX, EMPLOYES, {});
    await ctx.__reconcilierAlertesContinuiteStock(await ctx.__chargerAlertesContinuiteStockOuvertes());
    const a = tables.fdj_alertes[0];
    verifier('l’alerte n’est jamais supprimée', tables.fdj_alertes.length === 1);
    verifier('… et conserve intactes les valeurs détectées à l’époque',
      Number(a.valeur_quart_precedent) === 0 && Number(a.valeur_saisie) === 1 && a.created_at === '2026-09-09T21:20:06.185Z');
    const trace = tables.fdj_audit_log.find(l => l.action === 'fdj_continuite_stock_retablie_automatiquement');
    verifier('une trace d’audit est écrite', !!trace && trace.entite_id === 'a1' && trace.entite_type === 'fdj_alerte');
    verifier('… qui porte l’avant ET l’après, dont l’écart recalculé',
      trace.ancienne_valeur.resolue_automatiquement === false
      && Number(trace.ancienne_valeur.valeur_saisie) === 1
      && trace.nouvelle_valeur.resolue_automatiquement === true
      && trace.nouvelle_valeur.ecart_recalcule === 0
      && trace.nouvelle_valeur.stock_final_precedent_constate === 0);
    verifier('… et n’est attribuée à aucun humain (acteur_id null)', trace.acteur_id === null);
  }

  // ── Épreuve 8 — le badge disparaît une fois l'alerte résolue ─────────
  {
    const tables = {
      fdj_shifts: [{ ...Q1 }, { ...Q2 }], fdj_alertes: [alerte('a1', 'jeu-patrimoine', 0, 1)],
      fdj_shift_counts: [compteur(Q1.id, 'jeu-patrimoine', { stock_final: 0 }), compteur(Q2.id, 'jeu-patrimoine', { stock_initial: 0 })],
      fdj_audit_log: [], fdj_releves_cloture: [], fdj_reports: [], fdj_cash_controls: [],
    };
    const ctx = nouveauContexte(tables, JEUX, EMPLOYES, {});
    const ensemble = [{ ...Q1 }, { ...Q2 }];
    const shiftQ2 = { ...Q2, cash: { statut: 'conforme' } };

    const avant = ctx.__calculerIntegriteQuart(shiftQ2, ensemble, tables.fdj_alertes);
    verifier('avant correction, le badge « Continuité de stock à vérifier » est bien posé',
      avant.integrite === 'PARTIELLE' && avant.motif === 'continuite_stock_a_verifier');
    verifier('… et il est CLIQUABLE, porteur du quart concerné',
      ctx.__badgeIntegrite(avant, shiftQ2).includes(`data-detail-continuite-stock="${Q2.id}"`));

    await ctx.__reconcilierAlertesContinuiteStock(await ctx.__chargerAlertesContinuiteStockOuvertes());
    // L'écran relit les alertes « à traiter » : celles-ci excluent les
    // alertes résolues automatiquement (chargerAlertesNonVues).
    const alertesApres = tables.fdj_alertes.filter(a => a.resolue_automatiquement === false && a.vue === false);
    const apres = ctx.__calculerIntegriteQuart(shiftQ2, ensemble, alertesApres);
    verifier('après résolution, le badge jaune disparaît de la vue courante',
      apres.integrite === 'OK' && ctx.__badgeIntegrite(apres, shiftQ2) === '');
  }

  // ── Épreuve 9 — le clic sur le badge ouvre un détail complet ─────────
  {
    const tables = {
      fdj_shifts: [{ ...Q1 }, { ...Q2 }],
      fdj_alertes: [alerte('a1', 'jeu-patrimoine', 0, 1)],
      fdj_shift_counts: [
        compteur(Q1.id, 'jeu-patrimoine', { stock_final: 3 }),
        compteur(Q2.id, 'jeu-patrimoine', { stock_initial: 1, stock_initial_auto: true }),
      ],
      fdj_audit_log: [], fdj_releves_cloture: [], fdj_reports: [], fdj_cash_controls: [],
    };
    const capture = {};
    const ctx = nouveauContexte(tables, JEUX, EMPLOYES, capture);
    await ctx.__ouvrirDetailContinuiteStock(Q2.id);
    const vu = capture.content || '';
    verifier('le détail nomme le jeu', vu.includes('MISSION PATRIMOINE 15€'));
    verifier('… et l’emplacement concerné', vu.includes('Emplacement') && vu.includes('Caisse'));
    verifier('… et les deux quarts, avec date, numéro et employé',
      vu.includes('Quart précédent') && vu.includes('Quart suivant')
      && vu.includes('09/09/2026 · Quart 1') && vu.includes('09/09/2026 · Quart 2')
      && vu.includes('Employé Q1') && vu.includes('Employé Q2'));
    verifier('… les deux quantités réelles et l’écart',
      vu.includes('Stock final') && vu.includes('Stock initial') && vu.includes('Écart actuel'));
    verifier('… l’origine de chaque valeur',
      vu.includes('héritée automatiquement du quart précédent') && vu.includes('saisie humaine (comptage de fin de quart)'));
    verifier('… et les deux liens de navigation demandés',
      vu.includes('Voir le quart précédent') && vu.includes('Voir le quart suivant')
      && vu.includes(`data-voir-quart="${Q1.date}|1"`) && vu.includes(`data-voir-quart="${Q2.date}|2"`));
    verifier('… en signalant que les valeurs ont bougé depuis la détection',
      vu.includes('Valeurs au moment de la détection'));
  }

  // ── Épreuve 9 bis — le détail d'une alerte résolue porte la phrase ────
  {
    const resolueLe = '2026-09-10T14:35:00.000Z';
    const tables = {
      fdj_shifts: [{ ...Q1 }, { ...Q2 }],
      fdj_alertes: [alerte('a1', 'jeu-patrimoine', 0, 1, { resolue_automatiquement: true, resolue_le: resolueLe })],
      fdj_shift_counts: [compteur(Q1.id, 'jeu-patrimoine', { stock_final: 0 }), compteur(Q2.id, 'jeu-patrimoine', { stock_initial: 0 })],
      fdj_audit_log: [], fdj_releves_cloture: [], fdj_reports: [], fdj_cash_controls: [],
    };
    const capture = {};
    const ctx = nouveauContexte(tables, JEUX, EMPLOYES, capture);
    await ctx.__ouvrirDetailContinuiteStock(Q2.id);
    verifier('l’historique conserve « Continuité de stock rétablie automatiquement le … »',
      (capture.content || '').includes('Continuité de stock rétablie automatiquement le 10/09/2026'));
  }

  // ── Épreuve 10 — isolation stricte par site ──────────────────────────
  {
    const tables = {
      fdj_shifts: [{ ...Q1 }, { ...Q2 }],
      fdj_alertes: [
        alerte('a-ici', 'jeu-patrimoine', 0, 1),
        alerte('a-ailleurs', 'jeu-patrimoine', 0, 1, { id: 'a-ailleurs', site: 'autre-station' }),
      ],
      fdj_shift_counts: [compteur(Q1.id, 'jeu-patrimoine', { stock_final: 0 }), compteur(Q2.id, 'jeu-patrimoine', { stock_initial: 0 })],
      fdj_audit_log: [], fdj_releves_cloture: [], fdj_reports: [], fdj_cash_controls: [],
    };
    const ctx = nouveauContexte(tables, JEUX, EMPLOYES, {});
    const ouvertes = await ctx.__chargerAlertesContinuiteStockOuvertes();
    verifier('seules les alertes du site courant sont chargées',
      ouvertes.length === 1 && ouvertes[0].id === 'a-ici');
    await ctx.__reconcilierAlertesContinuiteStock(ouvertes);
    const ailleurs = tables.fdj_alertes.find(a => a.id === 'a-ailleurs');
    verifier('… et l’alerte d’un autre site n’est jamais touchée',
      ailleurs.resolue_automatiquement === false && ailleurs.resolue_le === null);
    const traceAilleurs = tables.fdj_audit_log.filter(l => l.entite_id === 'a-ailleurs');
    verifier('… ni auditée sous notre site', traceAilleurs.length === 0);
  }

  // ── Le défaut d'origine, encodé : la réconciliation de chaîne ne
  //    traitera jamais ces alertes, et c'est pour ça qu'il en fallait une.
  {
    const source = extraire('reconcilierAlertesChaine');
    verifier('reconcilierAlertesChaine ignore toujours explicitement ce type (cause d’origine)',
      /if \(a\.type !== 'chaine_interrompue'\) continue;/.test(source));
    verifier('… et la fonction dédiée ne réécrit aucun comptage',
      !/from\('fdj_shift_counts'\)[\s\S]{0,200}\.update\(/.test(extraire('reconcilierAlertesContinuiteStock')));
  }

  console.log(`\nContinuité de stock FDJ — réconciliation automatique : ${ok}/${ok} vérifications passent.`);
})().catch(e => { console.error(e); process.exit(1); });
