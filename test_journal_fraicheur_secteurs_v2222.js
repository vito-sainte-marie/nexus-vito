// Test — Traçabilité minimale du fallback (23/08/2026, v2.222, audit
// "Anti-dégradation temporelle" §9.2/§10).
//
// L'audit demande de journaliser fallback_used, fallback_source_version,
// fallback_age_days et replaced_at à chaque calcul de fraîcheur, pour que
// la décision reste explicable et reconstructible a posteriori — jusqu'ici
// cette info ne vivait qu'en mémoire le temps du calcul (limite documentée
// depuis v2.219/v2.220 dans NEXUS-Data-Dictionary-v2.md).
//
// Ce test couvre deux niveaux :
//  1. La fonction pure `NexusCarburantMoteur.resoudreEntreeJournalFraicheur`
//     — traduit un objet `fraicheur` en la forme minimale à journaliser,
//     aucun accès Supabase.
//  2. `NexusBriefDonnees.enregistrerFraicheurSecteur` — orchestration
//     lire-l'existant/upsert sur la table journal_fraicheur_secteurs, avec
//     un mock Supabase en mémoire (même esprit que enregistrerObservation
//     dans nexus-risques-donnees.js) : jamais de doublon d'historique pour
//     un état inchangé, replaced_at posé uniquement à la transition
//     fallback_used true -> false, et surtout : une erreur Supabase ne doit
//     JAMAIS remonter à l'appelant (best-effort, ne doit jamais casser le
//     Brief).

const assert = require('assert');
const path = require('path');
const PROJET = __dirname;

global.window = global;
require(path.join(PROJET, 'nexus-carburant-moteur.js'));
require(path.join(PROJET, 'nexus-brief-donnees.js'));
const M = global.NexusCarburantMoteur;
const BD = global.NexusBriefDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// Mock Supabase minimal — une seule table en mémoire, assez pour couvrir
// exactement les 3 chaînes utilisées par enregistrerFraicheurSecteur :
// select().eq().eq().maybeSingle() / insert().select().maybeSingle() /
// update().eq().select().maybeSingle().
// ------------------------------------------------------------
function creerMockClient(lignesInitiales) {
  let lignes = lignesInitiales ? [...lignesInitiales] : [];
  let prochainId = 1;
  const client = {
    from(table) {
      assert.strictEqual(table, 'journal_fraicheur_secteurs');
      return {
        _filtres: {},
        eq(champ, val) { this._filtres[champ] = val; return this; },
        async maybeSingle() {
          if (this._pending === 'insert') {
            const ligne = { id: String(prochainId++), ...this._payload };
            lignes.push(ligne);
            return { data: ligne, error: null };
          }
          if (this._pending === 'update') {
            const idx = lignes.findIndex(l => l.id === this._filtres.id);
            if (idx === -1) return { data: null, error: { message: 'introuvable' } };
            lignes[idx] = { ...lignes[idx], ...this._payload };
            return { data: lignes[idx], error: null };
          }
          // select
          const trouvee = lignes.find(l => Object.entries(this._filtres).every(([k, v]) => l[k] === v));
          return { data: trouvee || null, error: null };
        },
        select() { return this; },
        insert(payload) { this._pending = 'insert'; this._payload = payload; return this; },
        update(payload) { this._pending = 'update'; this._payload = payload; return this; },
      };
    },
  };
  return { client, lecture: () => lignes };
}

async function main() {
  // ------------------------------------------------------------
  // 1) resoudreEntreeJournalFraicheur — fonction pure.
  // ------------------------------------------------------------
  {
    const jour = M.resoudreEntreeJournalFraicheur({ fraicheur: { mode: 'jour' }, signalCritique: false });
    assert.deepStrictEqual(jour, { fallbackUsed: false, fallbackMode: 'jour', fallbackSourceVersion: null, fallbackAgeDays: null, signalCritique: false });

    const fallback = M.resoudreEntreeJournalFraicheur({ fraicheur: { mode: 'fallback', dateReference: '2026-08-21', joursEcoules: 2 }, signalCritique: false });
    assert.deepStrictEqual(fallback, { fallbackUsed: true, fallbackMode: 'fallback', fallbackSourceVersion: '2026-08-21', fallbackAgeDays: 2, signalCritique: false });

    const perime = M.resoudreEntreeJournalFraicheur({ fraicheur: { mode: 'perime', dateReference: '2026-08-10', joursEcoules: 13 }, signalCritique: false });
    assert.strictEqual(perime.fallbackUsed, true, 'perime compte aussi comme fallback_used=true (score non courant, mais un fallback a bien été tenté)');

    const signalCritique = M.resoudreEntreeJournalFraicheur({ fraicheur: { mode: 'jour' }, signalCritique: true });
    assert.strictEqual(signalCritique.signalCritique, true, 'signalCritique traverse tel quel, même en mode jour forcé');

    const sansArgument = M.resoudreEntreeJournalFraicheur();
    assert.strictEqual(sansArgument.fallbackUsed, false, 'appel sans argument -> mode jour par défaut, jamais une exception (Article 5)');
    ok('resoudreEntreeJournalFraicheur traduit fidèlement chaque mode de fraîcheur (jour/fallback/perime) + signalCritique');
  }

  // ------------------------------------------------------------
  // 2) enregistrerFraicheurSecteur — première observation (insert).
  // ------------------------------------------------------------
  const { client, lecture } = creerMockClient();
  const entree = M.resoudreEntreeJournalFraicheur({ fraicheur: { mode: 'fallback', dateReference: '2026-08-21', joursEcoules: 2 }, signalCritique: false });
  {
    const resultat = await BD.enregistrerFraicheurSecteur(client, 'vito-sainte-marie', 'carburants', entree);
    assert.strictEqual(resultat.fallback_used, true);
    assert.strictEqual(resultat.fallback_source_version, '2026-08-21');
    assert.strictEqual(resultat.fallback_age_days, 2);
    assert.strictEqual(resultat.replaced_at, null, 'premier enregistrement -> jamais de replaced_at');
    assert.strictEqual(resultat.historique_transitions.length, 1);
    assert.strictEqual(lecture().length, 1, 'une seule ligne créée pour ce site/secteur');
    ok('enregistrerFraicheurSecteur : première observation -> insert, replaced_at=null, historique à 1 entrée');
  }

  // ------------------------------------------------------------
  // 3) Deuxième appel avec exactement le même état (même mode, même
  // source) -> update, mais AUCUNE nouvelle entrée d'historique (jamais de
  // bruit pour un "toujours pareil").
  // ------------------------------------------------------------
  {
    const resultat2 = await BD.enregistrerFraicheurSecteur(client, 'vito-sainte-marie', 'carburants', entree);
    assert.strictEqual(resultat2.historique_transitions.length, 1, 'état inchangé -> historique ne grandit pas');
    ok('enregistrerFraicheurSecteur : état inchangé -> update sans nouvelle entrée d\'historique (jamais de doublon)');
  }

  // ------------------------------------------------------------
  // 4) Troisième appel : le fallback est remplacé par un état à nouveau
  // courant (mode 'jour') -> replaced_at doit être posé, historique
  // grandit d'une entrée (audit §9.2 : "replaced_at").
  // ------------------------------------------------------------
  {
    const entreeJour = M.resoudreEntreeJournalFraicheur({ fraicheur: { mode: 'jour' }, signalCritique: false });
    const resultat3 = await BD.enregistrerFraicheurSecteur(client, 'vito-sainte-marie', 'carburants', entreeJour);
    assert.strictEqual(resultat3.fallback_used, false);
    assert.ok(resultat3.replaced_at, 'replaced_at posé au moment précis où le fallback est remplacé par un état courant');
    assert.strictEqual(resultat3.historique_transitions.length, 2, 'la transition fallback->jour ajoute une entrée d\'historique');
    ok('enregistrerFraicheurSecteur : transition fallback_used true->false -> replaced_at posé, historique +1');
  }

  // ------------------------------------------------------------
  // 5) Un site/secteur différent ne doit jamais lire/écraser la ligne d'un
  // autre (unique site_id+secteur_id, jamais un secteur qui en écrase un
  // autre).
  // ------------------------------------------------------------
  {
    const { client: clientFdj, lecture: lectureFdj } = creerMockClient(lecture());
    const entreeFdj = M.resoudreEntreeJournalFraicheur({ fraicheur: { mode: 'perime', dateReference: '2026-08-10', joursEcoules: 13 }, signalCritique: false });
    await BD.enregistrerFraicheurSecteur(clientFdj, 'vito-sainte-marie', 'fdj', entreeFdj);
    const parSecteur = lectureFdj().reduce((acc, l) => { acc[l.secteur_id] = (acc[l.secteur_id] || 0) + 1; return acc; }, {});
    assert.strictEqual(parSecteur.carburants, 1);
    assert.strictEqual(parSecteur.fdj, 1);
    ok('enregistrerFraicheurSecteur : Carburants et FDJ restent deux lignes distinctes pour le même site (unique site_id+secteur_id)');
  }

  // ------------------------------------------------------------
  // 6) Best-effort : un client dont .from() explose ne doit JAMAIS faire
  // remonter d'exception à l'appelant — un incident d'écriture sur ce
  // journal ne doit jamais casser le Brief.
  // ------------------------------------------------------------
  {
    const clientCasse = { from() { throw new Error('panne réseau simulée'); } };
    const resultatCasse = await BD.enregistrerFraicheurSecteur(clientCasse, 'vito-sainte-marie', 'carburants', entree);
    assert.strictEqual(resultatCasse, null, 'client cassé -> null proprement, jamais une exception qui remonte');
    ok('enregistrerFraicheurSecteur : panne du client Supabase absorbée (best-effort), jamais propagée au Brief');
  }

  console.log(`\n${n}/${n} tests passés — Traçabilité minimale du fallback (v2.222).`);
}

main().catch(e => { console.error(e); process.exit(1); });
