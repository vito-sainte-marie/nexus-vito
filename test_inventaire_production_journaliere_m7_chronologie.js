// Test — Production journalière, M7 "Vue manager : chronologie produit +
// résumé production/écoulement" (19/08/2026). Couvre les deux ajouts réels
// de ce sprint (la synthèse elle-même, syntheseProductionJournee, et son
// chargeur chargerHistoriqueProductionProduit, existaient déjà avant M7 —
// seule l'exposition manager était manquante) :
//   1. nexus-inventaire-production-donnees.js::chargerProduitsProfilProductionJournaliere
//      — nouvelle fonction (require direct, mock chaînable).
//   2. NEXUS-Inventaire-Manager-v1.html — la nouvelle section "Chronologie
//      d'un produit" (chargerEtAfficherChronologie, renderChronologieCorps,
//      renderLigneFournees, renderSectionChronologieProduit), extraite par
//      regex comme tous les tests de ce module, jamais réécrite à la main.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}
async function testAsync(nom, fn) {
  try { await fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

// ------------------------------------------------------------
// PARTIE 1 — nexus-inventaire-production-donnees.js (require direct)
// ------------------------------------------------------------
global.window = global;
require(path.join(PROJET, 'nexus-inventaire-moteur.js'));
require(path.join(PROJET, 'nexus-inventaire-production-donnees.js'));
const D = global.NexusInventaireProductionDonnees;
assert.ok(D, 'NexusInventaireProductionDonnees non chargé');
assert.strictEqual(typeof D.chargerProduitsProfilProductionJournaliere, 'function', 'chargerProduitsProfilProductionJournaliere doit être exportée');

function mockClientDeuxTables(reponseRegles, reponseProduits) {
  const appels = [];
  return {
    appels,
    from(table) {
      appels.push(table);
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        in() { return chain; },
        order() { return chain; },
        then(resolve, reject) {
          const r = table === 'inventaire_regles_produit' ? reponseRegles : reponseProduits;
          return Promise.resolve(r).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

(async function main() {
  await testAsync('chargerProduitsProfilProductionJournaliere : aucune règle "production_journaliere" -> [] sans interroger les fiches produit', async () => {
    const client = mockClientDeuxTables({ data: [], error: null }, { data: null, error: null });
    const r = await D.chargerProduitsProfilProductionJournaliere(client, 'vito');
    assert.deepStrictEqual(r, []);
    assert.deepStrictEqual(client.appels, ['inventaire_regles_produit'], 'Aucun produit_id -> ne doit jamais interroger inventaire_zone_produit (requête inutile)');
  });

  await testAsync('chargerProduitsProfilProductionJournaliere : règles trouvées -> relit les fiches produit correspondantes', async () => {
    const client = mockClientDeuxTables(
      { data: [{ produit_id: 'p1' }, { produit_id: 'p2' }], error: null },
      { data: [{ id: 'p1', designation: 'Croissant' }, { id: 'p2', designation: 'Pain au chocolat' }], error: null },
    );
    const r = await D.chargerProduitsProfilProductionJournaliere(client, 'vito');
    assert.strictEqual(r.length, 2);
    assert.strictEqual(r[0].designation, 'Croissant');
    assert.deepStrictEqual(client.appels, ['inventaire_regles_produit', 'inventaire_zone_produit']);
  });

  await testAsync('chargerProduitsProfilProductionJournaliere : erreur sur les règles -> [] proprement, jamais une exception', async () => {
    const client = mockClientDeuxTables({ data: null, error: { message: 'boom' } }, { data: null, error: null });
    const r = await D.chargerProduitsProfilProductionJournaliere(client, 'vito');
    assert.deepStrictEqual(r, []);
  });

  await testAsync('chargerProduitsProfilProductionJournaliere : erreur sur les fiches produit -> [] proprement', async () => {
    const client = mockClientDeuxTables({ data: [{ produit_id: 'p1' }], error: null }, { data: null, error: { message: 'boom' } });
    const r = await D.chargerProduitsProfilProductionJournaliere(client, 'vito');
    assert.deepStrictEqual(r, []);
  });

  console.log('\n--- PARTIE 1 (nexus-inventaire-production-donnees.js) terminée ---\n');

  // ------------------------------------------------------------
  // PARTIE 2 — NEXUS-Inventaire-Manager-v1.html : extraction par regex
  // ------------------------------------------------------------
  const html = fs.readFileSync(path.join(PROJET, 'NEXUS-Inventaire-Manager-v1.html'), 'utf8');
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const script = scriptMatches.reduce((a, b) => (b.length > a.length ? b : a), '');
  assert.ok(script.includes('renderChronologieCorps'), 'Bloc script applicatif introuvable');

  function extraireFonction(nomFonction) {
    let debut = script.indexOf(`function ${nomFonction}(`);
    assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
    const prefixe = 'async ';
    if (script.slice(debut - prefixe.length, debut) === prefixe) debut -= prefixe.length;
    // Le paramètre peut lui-même être une destructuration ({ histo }) — il
    // faut d'abord sauter la liste de paramètres (parenthèses équilibrées)
    // avant de chercher l'accolade d'ouverture du CORPS de la fonction,
    // sinon la première "{" rencontrée est celle de la destructuration.
    const parenOuvrante = script.indexOf('(', debut);
    let profondeurParen = 1, k = parenOuvrante + 1;
    while (profondeurParen > 0) {
      if (script[k] === '(') profondeurParen++;
      else if (script[k] === ')') profondeurParen--;
      k++;
    }
    let i = script.indexOf('{', k);
    let profondeur = 1, j = i + 1;
    while (profondeur > 0) {
      if (script[j] === '{') profondeur++;
      else if (script[j] === '}') profondeur--;
      j++;
    }
    return script.slice(debut, j);
  }

  function creerDomMock(valeurs) {
    const els = {};
    function el(id) {
      if (!els[id]) els[id] = { value: valeurs[id] !== undefined ? valeurs[id] : '', innerHTML: '' };
      return els[id];
    }
    return { els, document: { getElementById: (id) => el(id) } };
  }

  const srcParts = [
    'let chronologieForm = {};',
    'let chronologieChargee = null;',
    'let produitsChronologie = [];',
    'let siteId = null;',
    'let nexusClient = null;',
    'let document = null;',
    'let NexusInventaireProductionDonnees = null;',
    'function dateISO() { return "2026-08-19"; }',
    extraireFonction('fmtNum'),
    extraireFonction('renderLigneFournees'),
    extraireFonction('renderChronologieCorps'),
    extraireFonction('renderSectionChronologieProduit'),
    extraireFonction('chargerEtAfficherChronologie'),
    `globalThis.__test = {
      setEnv: (env) => {
        chronologieForm = env.chronologieForm; chronologieChargee = env.chronologieChargee;
        produitsChronologie = env.produitsChronologie || []; siteId = env.siteId;
        nexusClient = env.nexusClient; document = env.document;
        NexusInventaireProductionDonnees = env.NexusInventaireProductionDonnees;
      },
      getChronologieChargee: () => chronologieChargee,
      renderLigneFournees, renderChronologieCorps, renderSectionChronologieProduit, chargerEtAfficherChronologie,
    };`,
  ].join('\n\n');

  const ctx = { globalThis: {}, console, Date, Promise };
  ctx.globalThis = ctx;
  vm.runInNewContext(srcParts, ctx);
  const T = ctx.__test;

  testSync('renderLigneFournees : liste vide -> chaîne vide (aucun bruit)', () => {
    assert.strictEqual(T.renderLigneFournees([]), '');
    assert.strictEqual(T.renderLigneFournees(null), '');
  });

  testSync('renderLigneFournees : fournées listées avec quantité et heure', () => {
    const html = T.renderLigneFournees([
      { quantite: 6, cree_le: '2026-08-19T09:15:00.000Z' },
      { quantite: 4, cree_le: '2026-08-19T11:30:00.000Z' },
    ]);
    assert.ok(html.includes('2 fournées supplémentaires'));
    assert.ok(html.includes('6') && html.includes('4'));
    assert.ok(html.includes('à '), 'Doit inclure l\'heure de chaque fournée');
  });

  testSync('renderChronologieCorps : chaque étape retenue est celle déjà persistée, "—" si une valeur manque (Article 5)', () => {
    const histo = {
      prepInitialeMvt: { quantite: 20 },
      fourneesQ1: [{ quantite: 6, cree_le: '2026-08-19T09:00:00.000Z' }],
      fourneesQ2: [],
      clotureQ1: { quantite: 8 },
      clotureQ2: null, // pas encore compté au soir
      synthese: {
        disponibleQ1: 26, ecoulementQ1: 18, disponibleQ2: 8, ecoulementQ2: null,
        productionTotale: 26, ecoulementJournee: null, nbFourneesSupplementaires: 1,
      },
    };
    const html = T.renderChronologieCorps({ histo });
    assert.ok(html.includes('Quart 1 — Matin') && html.includes('Quart 2 — Soir') && html.includes('Résumé de la journée'));
    assert.ok(html.includes('20'), 'Préparation initiale doit apparaître');
    assert.ok(html.includes('26'), 'Disponible Q1 / production totale doivent apparaître');
    assert.ok(html.includes('—'), 'Écoulement Q2 et écoulement journée sont null (clôture Q2 non faite) -> "—", jamais un faux 0');
  });

  testSync('renderChronologieCorps : synthèse indisponible (moteur non chargé) -> message explicite, jamais une exception', () => {
    const html = T.renderChronologieCorps({ histo: { synthese: null } });
    assert.ok(html.includes('Synthèse indisponible'));
  });

  testSync('renderSectionChronologieProduit : aucun produit au profil -> message explicite dans le select', () => {
    T.setEnv({ chronologieForm: { date: '2026-08-19', produitId: '' }, chronologieChargee: null, produitsChronologie: [] });
    const html = T.renderSectionChronologieProduit();
    assert.ok(html.includes('Aucun produit'));
  });

  testSync('renderSectionChronologieProduit : produits groupés par catégorie (optgroup)', () => {
    T.setEnv({
      chronologieForm: { date: '2026-08-19', produitId: 'p1' }, chronologieChargee: null,
      produitsChronologie: [
        { id: 'p1', designation: 'Croissant', inventaire_categories: { nom: 'Viennoiserie' } },
        { id: 'p2', designation: 'Pain', inventaire_categories: { nom: 'Boulangerie' } },
      ],
    });
    const html = T.renderSectionChronologieProduit();
    assert.ok(html.includes('<optgroup label="Viennoiserie">') && html.includes('<optgroup label="Boulangerie">'));
    assert.ok(html.includes('selected'), 'Le produit déjà choisi doit rester sélectionné après un re-rendu');
  });

  await testAsync('chargerEtAfficherChronologie : aucun produit choisi -> message "Choisissez un produit", jamais de requête réseau', async () => {
    const { document } = creerDomMock({ chronologieResultat: '' });
    let appele = false;
    const NexusInventaireProductionDonnees = { async chargerHistoriqueProductionProduit() { appele = true; return null; } };
    T.setEnv({ chronologieForm: { date: '2026-08-19', produitId: '' }, chronologieChargee: { x: 1 }, siteId: 'vito', nexusClient: {}, document, NexusInventaireProductionDonnees });
    await T.chargerEtAfficherChronologie();
    assert.ok(document.getElementById('chronologieResultat').innerHTML.includes('Choisissez un produit'));
    assert.strictEqual(appele, false, 'Ne doit jamais interroger le chargeur si aucun produit n\'est choisi');
    assert.strictEqual(T.getChronologieChargee(), null, 'chronologieChargee doit être réinitialisé');
  });

  await testAsync('chargerEtAfficherChronologie : aucun quart trouvé pour cette date -> message explicite', async () => {
    const { document } = creerDomMock({ chronologieResultat: '' });
    const NexusInventaireProductionDonnees = { async chargerHistoriqueProductionProduit() { return { quarts: [], mouvements: [], comptages: [], synthese: null }; } };
    T.setEnv({ chronologieForm: { date: '2026-08-19', produitId: 'p1' }, chronologieChargee: null, produitsChronologie: [], siteId: 'vito', nexusClient: {}, document, NexusInventaireProductionDonnees });
    await T.chargerEtAfficherChronologie();
    assert.ok(document.getElementById('chronologieResultat').innerHTML.includes('Aucun inventaire trouvé'));
    assert.strictEqual(T.getChronologieChargee(), null);
  });

  await testAsync('chargerEtAfficherChronologie : données trouvées -> rend la chronologie et mémorise chronologieChargee', async () => {
    const { document } = creerDomMock({ chronologieResultat: '' });
    let capte = null;
    const NexusInventaireProductionDonnees = {
      async chargerHistoriqueProductionProduit(client, site, produitId, date) {
        capte = { site, produitId, date };
        return {
          quarts: [{ id: 'q1', quart: 'matin' }, { id: 'q2', quart: 'soir' }],
          prepInitialeMvt: { quantite: 20 }, fourneesQ1: [], fourneesQ2: [],
          clotureQ1: { quantite: 8 }, clotureQ2: { quantite: 0 },
          synthese: { disponibleQ1: 20, ecoulementQ1: 12, disponibleQ2: 8, ecoulementQ2: 8, productionTotale: 20, ecoulementJournee: 20, nbFourneesSupplementaires: 0 },
        };
      },
    };
    T.setEnv({
      chronologieForm: { date: '2026-08-19', produitId: 'p1' }, chronologieChargee: null,
      produitsChronologie: [{ id: 'p1', designation: 'Croissant' }],
      siteId: 'vito', nexusClient: { marqueur: true }, document, NexusInventaireProductionDonnees,
    });
    await T.chargerEtAfficherChronologie();
    assert.deepStrictEqual(capte, { site: 'vito', produitId: 'p1', date: '2026-08-19' }, 'Doit interroger le chargeur avec le site, le produit et la date choisis');
    const rendu = document.getElementById('chronologieResultat').innerHTML;
    assert.ok(rendu.includes('Quart 1 — Matin') && rendu.includes('Résumé de la journée'));
    assert.strictEqual(T.getChronologieChargee().produit.designation, 'Croissant');
    console.log('OK — chargerEtAfficherChronologie interroge chargerHistoriqueProductionProduit(site, produit, date) et rend la chronologie sans recalcul (Article 11).');
  });

  console.log('\nTous les tests "Production journalière — M7 chronologie produit" passent.');
})();
