/*
 * NEXUS referme ce qu'un jour précédent a laissé ouvert — et n'invente rien.
 * ============================================================================
 * LE FAIT, 16/09/2026, mesuré en Production. Trois services étaient encore
 * `en_cours` : un ouvert le 14/09, un le 15/09, et le quart du matin du 16/09
 * déjà terminé. Aucun départ pointé. `nexusServiceCourant` les VOYAIT depuis
 * le 11/09 — il écrivait même leur nombre dans la console — mais rien ne les
 * refermait. Ils restaient « actifs » indéfiniment.
 *
 * CE QUE CETTE ÉPREUVE VÉRIFIE, et pourquoi elle exécute au lieu de lire.
 * Une assertion par expression régulière aurait confirmé que le code
 * RESSEMBLE à une clôture. Ici le module est chargé pour de bon dans un
 * contexte isolé, avec un faux client qui enregistre chaque requête : ce sont
 * les WRITES RÉELLEMENT ÉMIS qui sont examinés. Un `heure_fin` inventé se
 * verrait, et c'est exactement ce que P-1 et P-2 viennent d'effacer de la
 * base.
 *
 * La règle de ce qui est obsolète n'est pas réimplémentée ici : elle vit dans
 * nexus-pointage-regles.js et y est éprouvée séparément. Ce fichier éprouve
 * le CHEMIN — que la règle soit consultée, que l'écriture soit bornée, et
 * qu'un module absent ne produise aucune clôture improvisée.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const SOURCE = fs.readFileSync(path.join(__dirname, 'nexus-auth.js'), 'utf8');
const REGLES = fs.readFileSync(path.join(__dirname, 'nexus-pointage-regles.js'), 'utf8');

// Les vérifications sont MISES EN FILE, puis exécutées l'une après l'autre
// avec `await`. Première rédaction de ce fichier : `verifier` appelait fn()
// sans attendre, et une assertion posée après une écriture asynchrone passait
// au vert avant que l'écriture n'ait eu lieu. Un vert obtenu ainsi ne mesure
// rien. Le `console.log` n'est émis qu'APRÈS le retour de la vérification.
let passes = 0;
const file = [];
function verifier(nom, fn) { file.push([nom, fn]); }
function titre(t) { file.push([t, null]); }

// ── Le banc d'essai ────────────────────────────────────────────────────────
// Un faux client qui n'invente aucun résultat : on lui DIT ce que la lecture
// rend, et il note ce qu'on lui demande d'écrire.
function banc({ shifts, lignesModifiees, erreurUpdate, avecRegles = true }) {
  const journal = { selects: [], updates: [], erreurs: [], infos: [] };

  const client = {
    from(table) {
      const req = { table, filtres: [] };
      const chaine = {
        select(cols) { req.select = cols; return chaine; },
        update(champs) { req.update = champs; return chaine; },
        eq(col, val) { req.filtres.push([col, val]); return chaine; },
        order() { return chaine; },
        limit() { journal.selects.push(req); return Promise.resolve({ data: shifts, error: null }); },
        then(res) {                        // fin de chaîne d'un UPDATE
          journal.updates.push(req);
          const n = typeof lignesModifiees === 'function'
            ? lignesModifiees(journal.updates.length) : lignesModifiees;
          return Promise.resolve(erreurUpdate
            ? { data: null, error: erreurUpdate }
            : { data: Array.from({ length: n === undefined ? 1 : n }, () => ({ id: 'x' })), error: null }
          ).then(res);
        },
      };
      return chaine;
    },
    auth: { getSession: async () => ({ data: { session: null } }), signOut: async () => {} },
  };

  const ctx = {
    supabase: { createClient: () => client },
    window: { location: { pathname: '/NEXUS-Pointage-v1.html', search: '', href: '' } },
    document: { createElement: () => ({ style: {} }), head: { appendChild() {} }, body: { appendChild() {} },
                addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    console: {
      log() {}, warn() {},
      error: (...a) => journal.erreurs.push(a.join(' ')),
      info:  (...a) => journal.infos.push(a.join(' ')),
    },
    setTimeout, clearTimeout, fetch: async () => { throw new Error('réseau interdit'); },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  if (avecRegles) vm.runInContext(REGLES, ctx);
  vm.runInContext(SOURCE, ctx);
  return { ctx, journal };
}

const EMPLOYE = { id: 'emp-1', site_id: 'vito-sainte-marie' };
// Un service de la veille, tel que la base le rend : heure_fin absente, et
// aucune trace de clôture. La date est fabriquée à partir de MAINTENANT pour
// que l'épreuve ne périme pas au prochain changement de jour.
const HIER = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
const AUJOURD_HUI = new Date(Date.now() - 2 * 60 * 1000).toISOString();
const veille = (o) => Object.assign({ id: 'sh-veille', quart: 'matin', role: 'caissier',
  site_id: 'vito-sainte-marie', statut: 'en_cours', heure_debut: HIER }, o);

titre('── 1 · Le service de la veille est refermé, sans heure de fin ──');
verifier('un UPDATE est émis pour le service d’un jour précédent', async () => {
  const { ctx, journal } = banc({ shifts: [veille()] });
  return ctx.nexusServiceCourant(EMPLOYE).then(r => {
    assert.strictEqual(journal.updates.length, 1, 'exactement une écriture');
    // Pas de deepStrictEqual : l'objet vient du contexte vm, son prototype
    // n'est pas celui de ce realm. On compare ce qui a un sens.
    assert.strictEqual(r.aucun, true, 'un service refermé n’est pas rendu comme courant');
    assert.strictEqual(r.service, undefined);
  });
});

verifier('l’écriture ne porte AUCUNE heure de fin inventée', async () => {
  const { ctx, journal } = banc({ shifts: [veille()] });
  await ctx.nexusServiceCourant(EMPLOYE);
  const u = journal.updates[0].update;
  assert.strictEqual(u.statut, 'clos_sans_pointage');
  assert.strictEqual(u.heure_fin, null, 'heure_fin doit être NULL — c’est la forme de « nous ne savons pas »');
  assert.ok('heure_fin' in u, 'et elle doit être écrite explicitement, pas omise');
});

verifier('la clôture se déclare comme n’ayant aucun auteur humain', async () => {
  const { journal, ctx } = banc({ shifts: [veille()] });
  await ctx.nexusServiceCourant(EMPLOYE);
  const u = journal.updates[0].update;
  assert.strictEqual(u.cloture_source, 'cycle_pilote', 'la source ajoutée par P-3');
  assert.strictEqual(u.cloture_par, null, 'aucun humain n’a demandé cette clôture');
  assert.ok(u.cloture_le, 'le journal de clôture exige cloture_le (shifts_journal_cloture)');
  assert.ok(!Number.isNaN(Date.parse(u.cloture_le)), 'un instant lisible');
});

verifier('le motif vient du catalogue, il n’est pas recopié ici', async () => {
  const { ctx, journal } = banc({ shifts: [veille()] });
  await ctx.nexusServiceCourant(EMPLOYE);
  const attendu = ctx.NexusPointageRegles.MOTIF_CLOTURE_PILOTE.jour_precedent;
  assert.strictEqual(journal.updates[0].update.cloture_motif, attendu);
  assert.ok(/^Fin non enregistrée — /.test(attendu) && /\(phase pilote\)$/.test(attendu));
  // Le texte ne doit exister qu'à un seul endroit — sept copies d'une règle
  // de pointage ont déjà coûté une journée (14/09).
  assert.ok(!SOURCE.includes('Fin non enregistrée'),
    'nexus-auth.js ne doit contenir aucune copie du libellé');
});

titre('── 2 · L’écriture est bornée : jamais plus que ce service, jamais deux fois ──');
verifier('l’UPDATE vise l’identifiant ET le statut en_cours', async () => {
  const { ctx, journal } = banc({ shifts: [veille()] });
  await ctx.nexusServiceCourant(EMPLOYE);
  const f = journal.updates[0].filtres;
  assert.deepStrictEqual(f, [['id', 'sh-veille'], ['statut', 'en_cours']],
    'sans le statut, deux onglets réécriraient une clôture déjà posée');
});

verifier('zéro ligne modifiée est dit, jamais compté comme un succès', async () => {
  const { ctx, journal } = banc({ shifts: [veille()], lignesModifiees: 0 });
  return ctx.nexusServiceCourant(EMPLOYE).then(() => {
    assert.strictEqual(journal.infos.length, 0, 'rien à annoncer : rien n’a été fermé');
    assert.ok(journal.erreurs.some(e => /n’a pas été modifié|refus/.test(e)),
      'le fait mesuré doit être journalisé');
    // On ne tranche pas entre « fermé entre-temps » et « RLS » : les deux
    // donnent zéro ligne sans erreur, et nous n'avons observé ni l'un ni l'autre.
    assert.ok(journal.erreurs.some(e => /entre-temps/.test(e) && /refus/.test(e)),
      'les deux causes possibles doivent être nommées, aucune conclue');
  });
});

verifier('une erreur d’écriture n’empêche pas la lecture de rendre son résultat', async () => {
  const { ctx, journal } = banc({ shifts: [veille()], erreurUpdate: { message: 'boom' } });
  return ctx.nexusServiceCourant(EMPLOYE).then(r => {
    assert.strictEqual(r.aucun, true, 'un ménage raté ne ferme pas l’écran à l’employé');
    assert.strictEqual(r.erreur, undefined);
    assert.ok(journal.erreurs.some(e => /impossible/.test(e)));
  });
});

titre('── 3 · Ce qui ne doit PAS être refermé ──');
verifier('un service du jour est rendu, et rien n’est écrit', async () => {
  const { ctx, journal } = banc({ shifts: [veille({ id: 'sh-jour', heure_debut: AUJOURD_HUI })] });
  return ctx.nexusServiceCourant(EMPLOYE).then(r => {
    assert.strictEqual(journal.updates.length, 0, 'aucune écriture sur un service en cours aujourd’hui');
    assert.strictEqual(r.service.id, 'sh-jour');
  });
});

verifier('un service sans heure_debut n’appartient à aucun jour : il n’est pas refermé', async () => {
  // Il n'est pas « du jour » — donc la soustraction le compterait comme
  // obsolète. La règle, elle, refuse de conclure sans date de début.
  const { ctx, journal } = banc({ shifts: [veille({ id: 'sh-sans-date', heure_debut: null })] });
  return ctx.nexusServiceCourant(EMPLOYE).then(() => {
    assert.strictEqual(journal.updates.length, 0,
      'refermer faute de date serait conclure sur ce qu’on n’a pas mesuré');
  });
});

verifier('un quart du soir du jour même reste actif — le seuil n’est pas fourni ici', async () => {
  const { ctx, journal } = banc({ shifts: [veille({ id: 'sh-soir', quart: 'soir', heure_debut: AUJOURD_HUI })] });
  return ctx.nexusServiceCourant(EMPLOYE).then(() => {
    assert.strictEqual(journal.updates.length, 0);
    // Le contexte passé à la règle n'a volontairement ni minutesStation ni
    // seuilBascule : nexus-station.js n'est pas chargé par tous ces écrans, et
    // un seuil approximatif fermerait des services encore en cours.
    const corps = SOURCE.slice(SOURCE.indexOf('async function nexusServiceCourant'));
    assert.ok(!/seuilBascule/.test(corps.slice(0, corps.indexOf('\n}'))),
      'aucun seuil ne doit être improvisé dans la primitive');
  });
});

titre('── 4 · Sans le module de règles, NEXUS ne devine pas ──');
verifier('module absent : aucune clôture, et le fait est dit', async () => {
  const { ctx, journal } = banc({ shifts: [veille()], avecRegles: false });
  assert.strictEqual(typeof ctx.NexusPointageRegles, 'undefined');
  return ctx.nexusServiceCourant(EMPLOYE).then(() => {
    assert.strictEqual(journal.updates.length, 0, 'rien ne doit être écrit sans la règle');
  });
});

verifier('la fonction dédiée refuse et l’annonce', async () => {
  const { ctx, journal } = banc({ shifts: [], avecRegles: false });
  return ctx.nexusCloturerServicesObsoletes(EMPLOYE, [{ service: { id: 'x' }, motif: 'jour_precedent' }])
    .then(r => {
      assert.strictEqual(r.indisponible, true);
      assert.strictEqual(r.closes, 0);
      assert.strictEqual(journal.updates.length, 0);
      assert.ok(journal.erreurs.some(e => /nexus-pointage-regles\.js/.test(e)),
        'le motif du refus doit nommer ce qui manque');
    });
});

titre('── 5 · Tout écran qui appelle la primitive charge la règle ──');
verifier('les six consommateurs chargent nexus-pointage-regles.js', async () => {
  const ecrans = fs.readdirSync(__dirname).filter(f => /^NEXUS-.*\.html$/.test(f))
    .filter(f => /nexusServiceCourant\(/.test(fs.readFileSync(path.join(__dirname, f), 'utf8')));
  assert.ok(ecrans.length >= 6, 'au moins six écrans consomment la primitive');
  const sans = ecrans.filter(f => !/src="nexus-pointage-regles\.js/
    .test(fs.readFileSync(path.join(__dirname, f), 'utf8')));
  assert.deepStrictEqual(sans, [],
    'ces écrans appelleraient la clôture sans la règle :\n  ' + sans.join('\n  '));
});

(async () => {
  for (const [nom, fn] of file) {
    if (fn === null) { console.log('\n' + nom); continue; }
    await fn();
    passes++;
    console.log('OK — ' + nom);
  }
  console.log(`\n${passes} vérifications passées — NEXUS referme les services oubliés sans inventer leur fin.\n`);
})().catch(e => { console.error('\n✗ ' + (e.message || e) + '\n'); process.exit(1); });
