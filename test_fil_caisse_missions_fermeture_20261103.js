// Épreuve — 03/11/2026, lot INVENTAIRE-CAISSE-RENFORT-20261102, L1 incrément 3 : entrée depuis Missions + étape 3 (fermeture) dans Inventaire.
// Exigences (decision-4) : pilote + caissière en service seulement ; lectures seules filtrées par site/employé ; erreur = aucun lien ;
// aucune écriture nouvelle ; le changement de quart n'est pas câblé. SRC_MUTE (chargeur), PAGE_MUTE (Missions), INV_MUTE (Inventaire).
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const lire = (f) => fs.readFileSync(path.resolve(__dirname, f), 'utf8');
const charger = (f) => { const m = { exports: {} }; new Function('module', 'self', lire(f))(m, undefined); return m.exports; };
const C = charger('nexus-fil-caisse.js');
const P = charger('nexus-pilotes-inventaire.js');
const L = charger(process.env.SRC_MUTE || 'nexus-fil-caisse-lecture.js');
let ok = 0;
const cas = async (nom, f) => { await f(); ok++; console.log('  ✓ ' + nom); };

const FUSEAU = 'Europe/Paris';
const S = {
  dateLocaleStation: () => '2026-11-03',
  finDuQuartMinutes: () => 1320,
  minutesLocalesStation: () => S.maintenant,
  maintenant: 600,
};
const G = { NexusFilCaisse: C, NexusPilotesInventaire: P, NexusStation: S };
const PILOTE = 'emp-pilote';
function client({ pilotes = [PILOTE], erreurConfig = false, erreurRows = false, rows = [] } = {}) {
  const journal = [];
  return {
    journal,
    from(table) {
      const q = { table, filtres: {} };
      const b = {
        select(c) { q.cols = c; return b; },
        eq(k, v) { q.filtres[k] = v; return b; },
        maybeSingle() { journal.push(q); return Promise.resolve(erreurConfig ? { data: null, error: { message: 'x' } } : { data: { parametres_inventaire: { pilotesCaisse: pilotes }, horaires: {} }, error: null }); },
        then(res) { journal.push(q); return Promise.resolve(erreurRows ? { data: null, error: { message: 'x' } } : { data: rows, error: null }).then(res); },
      };
      return b;
    },
  };
}
const ctx = (cl, over) => Object.assign({ client: cl, employee: { id: PILOTE, site_id: 'site-a' }, roleDuJour: 'caissiere', enService: true, quartDuJour: 'soir', fuseau: FUSEAU }, over);
const ouverte = [{ a_valide_ouverture: true, inventaire_quarts: { date: '2026-11-03', quart: 'soir', statut: 'ouvert', cloture_le: null, is_simulation: false } }];
const ETAPE2 = 'NEXUS-Inventaire-v1.html?fil=caisse&etape=2&plan=2';

(async () => {
  await cas('pilote caissière en service → lien étape 2 ; lectures filtrées par site et par employé', async () => {
    const cl = client();
    assert.strictEqual(await L.lienEntree(ctx(cl), G), ETAPE2);
    assert.deepStrictEqual(cl.journal.map((q) => [q.table, q.filtres]), [['station_config', { site: 'site-a' }], ['inventaire_quart_employes', { employee_id: PILOTE }]]);
  });
  await cas('non-pilote ou pilote d\'un autre site → aucun lien, aucune lecture d\'inventaire', async () => {
    const cl = client({ pilotes: ['autre'] });
    assert.strictEqual(await L.lienEntree(ctx(cl), G), null);
    assert.strictEqual(cl.journal.filter((q) => q.table === 'inventaire_quart_employes').length, 0);
  });
  await cas('autre rôle ou hors service → aucune lecture du tout', async () => {
    for (const o of [{ roleDuJour: 'pompiste' }, { roleDuJour: 'renfort' }, { roleDuJour: 'manager' }, { roleDuJour: 'polyvalent' }, { enService: false }, { fuseau: null }]) {
      const cl = client();
      assert.strictEqual(await L.lienEntree(ctx(cl, o), G), null);
      assert.strictEqual(cl.journal.length, 0);
    }
  });
  await cas('erreur de lecture (config ou inventaire) → aucun lien', async () => {
    assert.strictEqual(await L.lienEntree(ctx(client({ erreurConfig: true })), G), null);
    assert.strictEqual(await L.lienEntree(ctx(client({ erreurRows: true })), G), null);
  });
  await cas('étape 3 OUVERTE : FERMETURE_OUVERTE vrai ; le lien de fermeture n\'apparaît qu\'à l\'heure due', async () => {
    assert.strictEqual(C.FERMETURE_OUVERTE, true);
    S.maintenant = 600;
    const tot = await L.lienEntree(ctx(client({ rows: ouverte })), G);
    assert.ok(!/etape=3/.test(String(tot)), 'pas de fermeture avant l\'heure due : ' + tot);
    S.maintenant = 1280;
    const tard = await L.lienEntree(ctx(client({ rows: ouverte })), G);
    assert.strictEqual(tard, 'NEXUS-Inventaire-v1.html?fil=caisse&etape=3&plan=3');
    S.maintenant = 600;
  });
  await cas('quart partagé (preuve de la relecture) : le quart clos par le pompiste rend clotureFaite vrai pour la caissière, et inversement', async () => {
    const closParAutre = [{ a_valide_ouverture: true, inventaire_quarts: { date: '2026-11-03', quart: 'soir', statut: 'cloture', cloture_le: '2026-11-03T22:00:00Z', is_simulation: false } }];
    const f = C.faitsInventaire(closParAutre, '2026-11-03', 'soir');
    assert.strictEqual(f.clotureFaite, true);
    assert.strictEqual(f.ouvertureFaite, false);
    S.maintenant = 1280;
    assert.strictEqual(C.lienEntree(true, 'caissiere', true, { ouvertureFaite: f.ouvertureFaite, clotureFaite: f.clotureFaite, fermetureDue: true }), null);
    S.maintenant = 600;
  });
  await cas('logique de l\'étape 3 conservée à l\'état dormant (ouverte:true) : due à l\'heure, ouverture faite → plan [3]', async () => {
    S.maintenant = 1280;
    const due = C.fermetureDueEnService({ station: S, horaires: {}, quartDuJour: 'soir', fuseau: FUSEAU, ouverte: true });
    assert.strictEqual(due, true);
    assert.strictEqual(C.lienEntree(true, 'caissiere', true, { ouvertureFaite: true, clotureFaite: false, fermetureDue: due }), 'NEXUS-Inventaire-v1.html?fil=caisse&etape=3&plan=3');
    S.maintenant = 600;
  });
  await cas('fermeture : quart du soir seulement (le matin ne compte pas à sa sortie), même fonction pour l\'Accueil et Missions', async () => {
    S.maintenant = 1280;
    assert.strictEqual(C.fermetureDueEnService({ station: S, horaires: {}, quartDuJour: 'matin', fuseau: FUSEAU, ouverte: true }), false);
    assert.strictEqual(C.fermetureDueEnService({ station: S, horaires: {}, quartDuJour: 'soir', fuseau: FUSEAU, ouverte: true }), true);
    assert.strictEqual(C.fermetureDueEnService({ station: S, horaires: null, quartDuJour: 'soir', fuseau: FUSEAU, ouverte: true }), false);
    const matin = [{ a_valide_ouverture: true, inventaire_quarts: { date: '2026-11-03', quart: 'matin', statut: 'ouvert', cloture_le: null, is_simulation: false } }];
    assert.strictEqual(await L.lienEntree(ctx(client({ rows: matin }), { quartDuJour: 'matin' }), G), null);
    S.maintenant = 600;
    const A = lire('NEXUS-App-v1.html');
    assert.ok(/NexusFilCaisse\.fermetureDueEnService\(/.test(A) && /NexusFilCaisse\.quartConcerneParFermeture\(quartDuJour\)/.test(A));
    assert.ok(/C\.fermetureDueEnService\(/.test(lire(process.env.SRC_MUTE || 'nexus-fil-caisse-lecture.js')));
    assert.ok(!/quart1/.test(A.slice(A.indexOf('fermetureCaisseDue'), A.indexOf('const filCaisseLien'))));
  });
  await cas('plan sans étape 1 : « Étape 1 sur 2 » pour le comptage', () => {
    assert.deepStrictEqual(C.planPour({ pilote: true, roleDuJour: 'caissiere', comptageFait: false, fermetureDue: true, fermetureFaite: false }), [2, 3]);
    assert.strictEqual(C.libelleProgression(2, [2, 3]), 'Étape 1 sur 2');
    assert.strictEqual(C.libelleProgression(3, [2, 3]), 'Étape 2 sur 2');
    assert.deepStrictEqual(C.planDe(''), [2, 3]);
  });
  await cas('la source du chargeur ne contient aucune écriture', () => {
    assert.ok(!/\.(insert|update|upsert|delete|rpc)\(/.test(lire(process.env.SRC_MUTE || 'nexus-fil-caisse-lecture.js')));
  });

  const M = lire(process.env.PAGE_MUTE || 'NEXUS-Missions-v1.html');
  await cas('Missions : scripts chargés dans l\'ordre, appel après la prise de poste, jamais en consultation externe', () => {
    const i = (t) => M.indexOf(t);
    assert.ok(i('<script src="nexus-station.js') > 0 && i('<script src="nexus-pilotes-inventaire.js') > i('<script src="nexus-station.js'));
    assert.ok(i('<script src="nexus-fil-caisse.js') > i('<script src="nexus-pilotes-inventaire.js') && i('<script src="nexus-fil-caisse-lecture.js') > i('<script src="nexus-fil-caisse.js'));
    const a = M.indexOf('NexusFilCaisseLecture.lienEntree({'), b = M.indexOf("shiftIdActif = shiftDuJour.id;"), c = M.indexOf('} else {\n      roleDuJour = \'manager\'');
    assert.ok(b > 0 && a > b && a < c, 'dans la branche hors consultation externe, après le shift');
    assert.ok(/enService: true, quartDuJour, fuseau: FUSEAU_SITE/.test(M));
    assert.ok(M.includes('id="filCaisseEntreeSection"'));
  });

  const I = lire(process.env.INV_MUTE || 'NEXUS-Inventaire-v1.html');
  await cas('Inventaire : étape 3 = clôture existante, progression sur le plan, sortie sans écriture neuve', () => {
    assert.ok(/etapeCaisse === 2 \|\| etapeCaisse === 3/.test(I));
    assert.ok(/etapeCaisse === 3\)[\s\S]{0,300}filCaisseActiver\(3\)[\s\S]{0,800}demarrerCloture\(\)/.test(I));
    assert.ok(/sauvegarderDraft\(etape === 3 \? 'cloture' : 'ouverture'\)/.test(I));
    assert.ok(/filCaisseEnCours \? window\.NexusFilCaisse\.LIBELLE_TERMINER/.test(I));
  });
  await cas('aucun câblage du changement de quart dans le fil', () => {
    assert.ok(!/changement[-_ ]de[-_ ]quart|changerQuart|echangeQuart/i.test(lire('nexus-fil-caisse.js') + lire('nexus-fil-caisse-lecture.js')));
  });
  console.log(ok + ' vérifications OK');
})().catch((e) => { console.error(e); process.exit(1); });
