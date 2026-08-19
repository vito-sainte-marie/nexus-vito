// Test — Production journalière, M6 "Robustesse : idempotence, audit,
// corrections versionnées" (18/08/2026, cahier "Audit Inventaire -
// Production, mouvements & réceptions" §10/§11). Couvre les deux ajouts
// réels de ce sprint (l'idempotence des mouvements et l'audit existaient
// déjà depuis M1-M5, seule la correction manager de production_initiale
// était un vrai trou) :
//   1. nexus-inventaire-production-donnees.js::dernierMouvementParType —
//      la nouvelle règle de sélection "append-only, le plus récent gagne"
//      pour les mouvements production_initiale.
//   2. NEXUS-Inventaire-Manager-v1.html — le nouveau type de correction
//      rétroactive corriger_preparation_q1 (chargement + application),
//      extrait via regex comme tous les tests de ce module (jamais réécrit
//      à la main).

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';

// ------------------------------------------------------------
// PARTIE 1 — dernierMouvementParType (fichier .js standalone, require direct)
// ------------------------------------------------------------
global.window = global;
require(path.join(PROJET, 'nexus-inventaire-moteur.js'));
require(path.join(PROJET, 'nexus-inventaire-production-donnees.js'));
const D = global.NexusInventaireProductionDonnees;
assert.ok(D, 'NexusInventaireProductionDonnees non chargé');
assert.strictEqual(typeof D.dernierMouvementParType, 'function', 'dernierMouvementParType doit être exportée');
assert.strictEqual(typeof D.chargerMouvementProductionInitialeActuel, 'function', 'chargerMouvementProductionInitialeActuel doit être exportée');

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.message}`); process.exitCode = 1; }
}

testSync('dernierMouvementParType retient la ligne la plus récente parmi plusieurs production_initiale (correction manager)', () => {
  const mvts = [
    { id: 'm1', type_mouvement: 'production_initiale', quantite: 12, cree_le: '2026-08-19T06:00:00Z', statut_validation: 'valide' },
    { id: 'm2', type_mouvement: 'production_initiale', quantite: 15, cree_le: '2026-08-19T14:00:00Z', statut_validation: 'valide' }, // correction manager plus tardive
  ];
  const r = D.dernierMouvementParType(mvts, 'production_initiale');
  assert.strictEqual(r.id, 'm2');
  assert.strictEqual(r.quantite, 15);
});

testSync('dernierMouvementParType ignore les autres types (ex: production_additionnelle, qui se SOMMENT et ne se remplacent jamais)', () => {
  const mvts = [
    { id: 'm1', type_mouvement: 'production_initiale', quantite: 12, cree_le: '2026-08-19T06:00:00Z' },
    { id: 'f1', type_mouvement: 'production_additionnelle', quantite: 6, cree_le: '2026-08-19T20:00:00Z' },
  ];
  const r = D.dernierMouvementParType(mvts, 'production_initiale');
  assert.strictEqual(r.id, 'm1', 'La fournée (production_additionnelle), même plus récente, ne doit jamais être prise pour la préparation initiale');
});

testSync('dernierMouvementParType renvoie null sur une liste vide ou undefined, jamais une exception', () => {
  assert.strictEqual(D.dernierMouvementParType([], 'production_initiale'), null);
  assert.strictEqual(D.dernierMouvementParType(undefined, 'production_initiale'), null);
});

testSync('dernierMouvementParType exclut les lignes explicitement invalidées (statut_validation renseigné à autre chose que valide)', () => {
  const mvts = [
    { id: 'm1', type_mouvement: 'production_initiale', quantite: 12, cree_le: '2026-08-19T06:00:00Z', statut_validation: 'valide' },
    { id: 'm2', type_mouvement: 'production_initiale', quantite: 99, cree_le: '2026-08-19T14:00:00Z', statut_validation: 'annule' },
  ];
  const r = D.dernierMouvementParType(mvts, 'production_initiale');
  assert.strictEqual(r.id, 'm1', 'Une ligne annulée ne doit jamais être retenue même si plus récente');
});

// ------------------------------------------------------------
// PARTIE 2 — chargerMouvementProductionInitialeActuel (lecture simple, mock chaînable)
// ------------------------------------------------------------
async function main() {
  {
    let capte = null;
    const client = {
      from(table) {
        capte = { table };
        const b = {
          select() { return b; }, eq(k, v) { (capte.eq = capte.eq || {})[k] = v; return b; },
          order() { return b; }, limit() { return b; },
          async maybeSingle() { return { data: { id: 'mvtX', quantite: 20 }, error: null }; },
        };
        return b;
      },
    };
    const r = await D.chargerMouvementProductionInitialeActuel(client, 'p1', 'quartQ1');
    assert.strictEqual(capte.table, 'inventaire_mouvements');
    assert.strictEqual(capte.eq.produit_id, 'p1');
    assert.strictEqual(capte.eq.quart_id, 'quartQ1');
    assert.strictEqual(capte.eq.type_mouvement, 'production_initiale');
    assert.strictEqual(r.id, 'mvtX');
    console.log('OK — chargerMouvementProductionInitialeActuel interroge inventaire_mouvements filtré produit+quart+type, et relit tel quel (Article 11).');
  }

  // ------------------------------------------------------------
  // PARTIE 3 — Extraction de NEXUS-Inventaire-Manager-v1.html : le nouveau
  // type de correction corriger_preparation_q1 (TYPES_MOUVEMENT_MANAGER,
  // typeMouvementValideEnBase, appliquerCorrectionRetroactive).
  // ------------------------------------------------------------
  const html = fs.readFileSync(path.join(PROJET, 'NEXUS-Inventaire-Manager-v1.html'), 'utf8');
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  // Le script applicatif (celui qui contient appliquerCorrectionRetroactive)
  // est le plus long des blocs <script> sans src.
  const script = scriptMatches.reduce((a, b) => (b.length > a.length ? b : a), '');
  assert.ok(script.includes('appliquerCorrectionRetroactive'), 'Bloc script applicatif introuvable');

  function extraireFonction(nomFonction) {
    let debut = script.indexOf(`function ${nomFonction}(`);
    assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
    const prefixe = 'async ';
    if (script.slice(debut - prefixe.length, debut) === prefixe) debut -= prefixe.length;
    let i = script.indexOf('{', debut);
    let profondeur = 1, j = i + 1;
    while (profondeur > 0) {
      if (script[j] === '{') profondeur++;
      else if (script[j] === '}') profondeur--;
      j++;
    }
    return script.slice(debut, j);
  }

  function extraireConst(nomConst) {
    const debut = script.indexOf(`const ${nomConst} = [`);
    assert.ok(debut !== -1, `Constante ${nomConst} introuvable`);
    const fin = script.indexOf('];', debut) + 2;
    return script.slice(debut, fin);
  }

  // Mocks DOM minimalistes : un registre d'éléments avec .value/.textContent/
  // .disabled/.innerHTML, un querySelector pour le radio de propagation.
  function creerDomMock(valeurs) {
    const store = {};
    const els = {};
    function el(id) {
      if (!els[id]) els[id] = { value: valeurs[id] !== undefined ? valeurs[id] : '', disabled: false, textContent: '', innerHTML: '' };
      return els[id];
    }
    return {
      els,
      document: {
        getElementById: (id) => el(id),
        querySelector: () => null, // aucun radio "cascade" côché -> session_seule par défaut
      },
    };
  }

  const srcParts = [
    'let correctionForm = {};',
    'let correctionChargee = null;',
    'let managerCourant = null;',
    'let siteId = null;',
    'let nexusClient = null;',
    'let document = null;',
    'let alert = () => {};',
    'let NexusInventaireManagerDonnees = null;',
    'let NexusInventaireProductionDonnees = null;',
    'function wirerFormulaireCorrection() {}', // câblage DOM réel, hors-scope de ce test logique
    extraireFonction('fmtNum'),
    extraireConst('TYPES_MOUVEMENT_MANAGER'),
    extraireFonction('typeMouvementValideEnBase'),
    extraireFonction('chargerQuart'),
    extraireFonction('chargerComptageActuel'),
    extraireFonction('chargerImpactCorrection'),
    extraireFonction('chargerEtAfficherCorrection'),
    extraireFonction('renderChampsCommunsCorrection'),
    extraireFonction('renderFormulaireCorrectionCorps'),
    extraireFonction('appliquerCorrectionRetroactive'),
    `globalThis.__test = {
      setEnv: (env) => {
        correctionForm = env.correctionForm; correctionChargee = env.correctionChargee;
        managerCourant = env.managerCourant; siteId = env.siteId; nexusClient = env.nexusClient;
        document = env.document; alert = env.alert || (() => {});
        NexusInventaireManagerDonnees = env.NexusInventaireManagerDonnees;
        NexusInventaireProductionDonnees = env.NexusInventaireProductionDonnees;
      },
      getCorrectionChargee: () => correctionChargee,
      TYPES_MOUVEMENT_MANAGER, typeMouvementValideEnBase,
      chargerEtAfficherCorrection, renderFormulaireCorrectionCorps, appliquerCorrectionRetroactive,
    };`,
  ].join('\n\n');

  const ctx = { globalThis: {}, console, Promise, fetch: undefined };
  ctx.globalThis = ctx;
  vm.runInNewContext(srcParts, ctx);
  const T = ctx.__test;

  // --- TYPES_MOUVEMENT_MANAGER / typeMouvementValideEnBase -------------
  {
    const entry = T.TYPES_MOUVEMENT_MANAGER.find(t => t.value === 'production_additionnelle');
    assert.ok(entry, 'production_additionnelle doit être une option du registre "mouvement oublié" (fournée oubliée)');
    assert.strictEqual(entry.sens, 'entrant');
    assert.strictEqual(T.typeMouvementValideEnBase('production_additionnelle'), 'production_additionnelle', 'production_additionnelle est déjà une valeur CHECK valide -- ne doit jamais être remappée');
    console.log('OK — TYPES_MOUVEMENT_MANAGER inclut "Nouvelle préparation (fournée) — oubliée", et typeMouvementValideEnBase la laisse passer sans remap.');
  }

  // --- chargerEtAfficherCorrection('corriger_preparation_q1') ----------
  {
    const { document } = creerDomMock({ correctionResultat: '' });
    const quartMatin = { id: 'quartMatinX', quart: 'matin' };
    const quartSoir = { id: 'quartSoirX', quart: 'soir' };
    const appelsQuart = [];
    const NexusInventaireManagerDonnees = {
      async chargerQuart(client, site, date, quart) {
        appelsQuart.push(quart);
        // chargerEtAfficherCorrection recharge d'abord le quart correspondant
        // au pill affiché (ici "soir", juste pour vérifier que la date a un
        // inventaire) avant de forcer explicitement le matin pour cette
        // correction -- les deux appels doivent rester distincts.
        return quart === 'matin' ? quartMatin : quartSoir;
      },
    };
    const NexusInventaireProductionDonnees = {
      async chargerMouvementProductionInitialeActuel(client, produitId, quartId) {
        assert.strictEqual(produitId, 'prodX');
        assert.strictEqual(quartId, 'quartMatinX');
        return { id: 'mvtActuel', quart_id: 'quartMatinX', produit_id: 'prodX', quantite: 12 };
      },
    };
    T.setEnv({
      correctionForm: { date: '2026-08-19', quart: 'soir', produitId: 'prodX', correctionType: 'corriger_preparation_q1' },
      correctionChargee: null, managerCourant: { id: 'mgr1' }, siteId: 'vito-sainte-marie',
      nexusClient: {}, document, alert: () => {}, NexusInventaireManagerDonnees, NexusInventaireProductionDonnees,
    });
    await T.chargerEtAfficherCorrection();
    const chargee = T.getCorrectionChargee();
    assert.ok(chargee, 'correctionChargee doit être renseigné après chargement');
    assert.deepStrictEqual(appelsQuart, ['soir', 'matin'], 'Doit d\'abord relire le quart du pill affiché (soir), puis explicitement forcer le matin pour cette correction');
    assert.strictEqual(chargee.mouvement.id, 'mvtActuel');
    assert.strictEqual(chargee.quart.id, 'quartMatinX');
    assert.ok(document.getElementById('correctionResultat').innerHTML.includes('12'), 'Le formulaire doit afficher la quantité actuellement retenue (12)');
    console.log('OK — chargerEtAfficherCorrection(corriger_preparation_q1) force toujours le quart matin et relit le mouvement production_initiale actuel via chargerMouvementProductionInitialeActuel.');
  }

  // --- appliquerCorrectionRetroactive('corriger_preparation_q1') -------
  {
    const inserts = [];
    const nexusClient = {
      from(table) {
        return {
          async insert(payload) { inserts.push({ table, payload }); return { data: null, error: null }; },
        };
      },
    };
    const { document } = creerDomMock({
      correctionCommentaire: 'Fournée corrigée après contrôle papier',
      correctionNouvellePreparation: '18',
    });
    const ancien = { id: 'mvtActuel', quart_id: 'quartMatinX', produit_id: 'prodX', quantite: 12 };
    T.setEnv({
      correctionForm: { date: '2026-08-19', quart: 'matin', produitId: 'prodX', correctionType: 'corriger_preparation_q1' },
      correctionChargee: { quart: { id: 'quartMatinX' }, mouvement: ancien, impact: 0 },
      managerCourant: { id: 'mgr1' }, siteId: 'vito-sainte-marie', nexusClient, document, alert: () => {},
    });
    await T.appliquerCorrectionRetroactive();

    const mvtInsert = inserts.find(i => i.table === 'inventaire_mouvements');
    assert.ok(mvtInsert, 'Doit insérer une nouvelle ligne inventaire_mouvements (jamais un update)');
    assert.strictEqual(mvtInsert.payload.type_mouvement, 'production_initiale');
    assert.strictEqual(mvtInsert.payload.quantite, 18, 'La nouvelle quantité saisie doit être écrite telle quelle');
    assert.strictEqual(mvtInsert.payload.quart_id, 'quartMatinX');
    assert.strictEqual(mvtInsert.payload.produit_id, 'prodX');
    assert.strictEqual(mvtInsert.payload.statut_validation, 'valide');

    const corrInsert = inserts.find(i => i.table === 'inventaire_corrections');
    assert.ok(corrInsert, 'Doit tracer la correction dans inventaire_corrections');
    assert.strictEqual(corrInsert.payload.correction_type, 'corriger_preparation_q1');
    assert.strictEqual(corrInsert.payload.old_value, 12);
    assert.strictEqual(corrInsert.payload.new_value, 18);

    const auditInsert = inserts.find(i => i.table === 'inventaire_audit_log');
    assert.ok(auditInsert, 'Doit tracer la correction dans inventaire_audit_log (même convention que les corrections de comptage)');
    assert.strictEqual(auditInsert.payload.entite_type, 'inventaire_mouvements');
    assert.strictEqual(auditInsert.payload.entite_id, 'mvtActuel', 'entite_id doit référencer l\'ANCIENNE ligne, comme preuve du "avant"');
    assert.strictEqual(auditInsert.payload.action, 'correction_preparation_q1');
    // deepStrictEqual évité ici : les objets traversent la frontière vm
    // (contexte séparé), leur Object constructeur diffère donc de celui du
    // process hôte -- comparaison champ par champ, tout aussi stricte.
    assert.strictEqual(auditInsert.payload.ancienne_valeur.quantite, 12);
    assert.strictEqual(auditInsert.payload.nouvelle_valeur.quantite, 18);

    assert.strictEqual(inserts.length, 3, 'Exactement 3 écritures : le nouveau mouvement, la correction, l\'audit -- jamais une modification de la ligne existante');
    console.log('OK — appliquerCorrectionRetroactive(corriger_preparation_q1) insère une NOUVELLE ligne production_initiale (append-only) + inventaire_corrections + inventaire_audit_log, jamais une modification destructive.');
  }

  console.log('\nTous les tests "Production journalière — M6 robustesse" passent.');
}

main().catch(e => { console.error(e); process.exitCode = 1; });
