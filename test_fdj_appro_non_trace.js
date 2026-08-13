// Tests unitaires — nexus-fdj-moteur.js :: approNonTraceParJeu (13/08/2026)
//
// Nés d'un second signalement direct de Frédéric avec capture d'écran (FDJ
// Manager, écran "État du stock") : après avoir complété les quarts
// manquants du 11 et 12/08 (rattrapage), CASH 5€ affichait toujours "🟢 OK"
// avec 4 non activés en caisse, alors qu'en réalité il n'en restait que 2.
// Cause : l'appro (fdj_shift_counts, compteur TICKETS) saisie en complétant
// un quart après coup n'a pas de mouvement fdj_stock_movements(activation)
// correspondant — contrairement à une activation en direct
// (executerActivationCarnet, NEXUS-FDJ-v1.html), où les deux écritures se
// font toujours ensemble, sur le même shift_id. Périmètre validé avec
// Frédéric : détecter et signaler, jamais reconstruire tout seul. Ce
// fichier couvre uniquement la détection (aucune dépendance DOM/Supabase —
// pure logique).

global.window = global;
const BASE = '/sessions/dazzling-compassionate-ride/mnt/image nexus project/';
require(BASE + 'nexus-fdj-moteur.js');

const M = global.NexusFdjMoteur;

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

const CASH = 'game-cash';
const MMC = 'game-maxi-mots-croises';
const SHIFT_10Q2 = 'shift-10-q2'; // dernier quart validé avant la rupture
const SHIFT_11Q1 = 'shift-11-q1'; // quart complété après coup, sans mouvement
const SHIFT_11Q2 = 'shift-11-q2';
const SHIFT_13Q1 = 'shift-13-q1'; // quart live normal, avec mouvement

// --- Scénario exact de Frédéric : CASH complété sur 2 quarts sans aucun
// mouvement d'activation tracé pour ces shifts précis. ---
{
  const shiftCounts = [
    { shift_id: SHIFT_11Q1, game_id: CASH, appro: 10 }, // backfill, aucun mouvement
    { shift_id: SHIFT_11Q2, game_id: CASH, appro: 10 }, // backfill, aucun mouvement
    { shift_id: SHIFT_13Q1, game_id: CASH, appro: 5 },  // quart live normal, mouvement présent
  ];
  const mouvements = [
    { shift_id: SHIFT_13Q1, game_id: CASH, type_mouvement: 'activation' }, // couvre le quart live
    { shift_id: SHIFT_10Q2, game_id: CASH, type_mouvement: 'activation' }, // couvre un AUTRE quart, jamais confondu
  ];
  const r = M.approNonTraceParJeu(shiftCounts, mouvements);
  assertEqual(r[CASH], 20, 'CASH : 20 tickets non tracés (10+10 des deux quarts backfillés), le quart live (5) est déjà couvert');
}

// --- Aucune appro non tracée : chaîne entièrement couverte par des mouvements ---
{
  const shiftCounts = [{ shift_id: SHIFT_13Q1, game_id: CASH, appro: 5 }];
  const mouvements = [{ shift_id: SHIFT_13Q1, game_id: CASH, type_mouvement: 'activation' }];
  const r = M.approNonTraceParJeu(shiftCounts, mouvements);
  assert(r[CASH] === undefined, 'aucune entrée pour un jeu entièrement couvert (jamais un 0 explicite)');
}

// --- Appro à 0 ou absente : jamais signalée (rien à rapprocher) ---
{
  const shiftCounts = [{ shift_id: SHIFT_11Q1, game_id: CASH, appro: 0 }, { shift_id: SHIFT_11Q2, game_id: CASH, appro: null }];
  const r = M.approNonTraceParJeu(shiftCounts, []);
  assertEqual(r, {}, 'appro nulle/absente : jamais comptée comme "non tracée"');
}

// --- Deux jeux différents, un seul concerné : jamais de confusion croisée entre jeux ---
{
  const shiftCounts = [
    { shift_id: SHIFT_11Q1, game_id: CASH, appro: 10 },
    { shift_id: SHIFT_11Q1, game_id: MMC, appro: 8 },
  ];
  const mouvements = [{ shift_id: SHIFT_11Q1, game_id: MMC, type_mouvement: 'activation' }]; // couvre MMC, pas CASH, même shift
  const r = M.approNonTraceParJeu(shiftCounts, mouvements);
  assertEqual(r, { [CASH]: 10 }, 'MMC couvert par son propre mouvement (même shift que CASH) ; CASH reste non tracé — clé shift_id+game_id, jamais shift_id seul');
}

// --- Un mouvement d'un AUTRE type (transfert, réception…) ne couvre jamais l'appro ---
{
  const shiftCounts = [{ shift_id: SHIFT_11Q1, game_id: CASH, appro: 10 }];
  const mouvements = [{ shift_id: SHIFT_11Q1, game_id: CASH, type_mouvement: 'transfert' }];
  const r = M.approNonTraceParJeu(shiftCounts, mouvements);
  assertEqual(r, { [CASH]: 10 }, 'seul un mouvement type=activation couvre l\'appro — un transfert ne prouve pas une activation');
}

// --- Mouvement sans shift_id (ex. un rapprochement manuel déjà fait, shift_id=null) ne couvre jamais un shift précis ---
{
  const shiftCounts = [{ shift_id: SHIFT_11Q1, game_id: CASH, appro: 10 }];
  const mouvements = [{ shift_id: null, game_id: CASH, type_mouvement: 'activation' }];
  const r = M.approNonTraceParJeu(shiftCounts, mouvements);
  assertEqual(r, { [CASH]: 10 }, 'un mouvement sans shift_id ne couvre aucun quart précis (évite un faux rapprochement)');
}

// --- 13/08/2026 (v2, refonte écran État du stock) : lignesApproNonTracees
// expose maintenant le détail ligne par ligne (pas seulement le total), pour
// afficher "quart(s) concerné(s)" dans le détail dépliable — même détection
// que approNonTraceParJeu (Article 11), juste consommée à un niveau plus fin. ---
{
  const shiftCounts = [
    { shift_id: SHIFT_11Q1, game_id: CASH, appro: 10 },
    { shift_id: SHIFT_11Q2, game_id: CASH, appro: 10 },
    { shift_id: SHIFT_13Q1, game_id: CASH, appro: 5 },
  ];
  const mouvements = [{ shift_id: SHIFT_13Q1, game_id: CASH, type_mouvement: 'activation' }];
  const lignes = M.lignesApproNonTracees(shiftCounts, mouvements);
  assertEqual(lignes, [
    { shift_id: SHIFT_11Q1, game_id: CASH, appro: 10 },
    { shift_id: SHIFT_11Q2, game_id: CASH, appro: 10 },
  ], 'lignesApproNonTracees renvoie les lignes brutes non couvertes (shift_id inclus), pas seulement un total par jeu');

  // approNonTraceParJeu doit rester la somme exacte de ces lignes — une
  // seule vérité, jamais deux calculs qui pourraient diverger.
  const total = M.approNonTraceParJeu(shiftCounts, mouvements);
  const sommeLignes = lignes.filter(l => l.game_id === CASH).reduce((s, l) => s + l.appro, 0);
  assertEqual(total[CASH], sommeLignes, 'approNonTraceParJeu(...) === somme des lignes de lignesApproNonTracees(...) pour le même jeu');
}

console.log(`${passed} test(s) réussi(s), ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
