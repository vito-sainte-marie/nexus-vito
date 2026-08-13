// Tests unitaires — nexus-fdj-moteur.js :: evaluerAccesQuart / quartDansFenetreAcces (13/08/2026)
//
// Nés de la spécification de Frédéric "Règle d'accès aux quarts FDJ — V1" :
// un quart devient accessible 30 minutes avant son heure officielle
// (paramétrable par station) ; dès qu'un employé s'engage réellement dans
// un quart (validation du stock de départ), ce quart est verrouillé pour
// lui pour le reste de la journée, l'autre devient inaccessible sans
// dérogation manager tracée. Ce fichier couvre uniquement la décision
// d'accès (aucune dépendance DOM/Supabase — pure logique) ; le verrou
// lui-même (table fdj_employee_shift_locks) est vérifié côté base par la
// contrainte UNIQUE(employee_id, date_service) et les policies RLS, pas ici.

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

// --- minutesDepuisMinuit ---
{
  assertEqual(M.minutesDepuisMinuit('06:00'), 360, '06:00 -> 360 minutes');
  assertEqual(M.minutesDepuisMinuit('05:45'), 345, '05:45 -> 345 minutes (horaire réel Vito Sainte-Marie)');
  assertEqual(M.minutesDepuisMinuit('00:00'), 0, 'minuit -> 0');
  assertEqual(M.minutesDepuisMinuit(null), null, 'horaire absent -> null, jamais 0 par défaut');
  assertEqual(M.minutesDepuisMinuit(undefined), null, 'horaire undefined -> null');
}

// --- quartDansFenetreAcces : exemple exact de Frédéric, Quart 1 à 06:00 ---
{
  assert(M.quartDansFenetreAcces(360, '06:00', 30) === true, 'pile à l\'heure officielle (06:00) : accessible');
  assert(M.quartDansFenetreAcces(330, '06:00', 30) === true, '05:30 (30 min avant pile) : accessible — borne incluse');
  assert(M.quartDansFenetreAcces(329, '06:00', 30) === false, '05:29 (31 min avant) : pas encore accessible');
  assert(M.quartDansFenetreAcces(600, '06:00', 30) === true, '10:00, bien après l\'heure officielle : toujours accessible (aucune fenêtre de fin)');
  assert(M.quartDansFenetreAcces(0, '06:00', 30) === false, 'minuit : trop tôt');
}

// --- quartDansFenetreAcces : Quart 2 à 14:00 (exemple de Frédéric) ---
{
  assert(M.quartDansFenetreAcces(810, '14:00', 30) === true, '13:30 : Quart 2 devient accessible');
  assert(M.quartDansFenetreAcces(809, '14:00', 30) === false, '13:29 : Quart 2 pas encore accessible');
}

// --- quartDansFenetreAcces : horaire inconnu ne bloque jamais (vérité avant certitude) ---
{
  assert(M.quartDansFenetreAcces(0, null, 30) === true, 'horaire du quart inconnu : jamais bloquant, même à minuit');
  assert(M.quartDansFenetreAcces(null, '06:00', 30) === true, 'heure actuelle inconnue (appelant sans horloge) : jamais bloquant');
}

// --- quartDansFenetreAcces : fenêtre par défaut = 30 min si non précisée ---
{
  assert(M.quartDansFenetreAcces(330, '06:00', undefined) === true, 'fenêtre non précisée -> 30 min par défaut, 05:30 accessible');
  assert(M.quartDansFenetreAcces(329, '06:00', undefined) === false, 'fenêtre non précisée -> 30 min par défaut, 05:29 encore fermé');
}

// --- evaluerAccesQuart : scénario exact de Frédéric — Samantha ouvre Q1 à 06:10 ---
{
  // Avant tout engagement (aucun verrou) : Q1 accessible dans sa fenêtre, Q2 pas encore (trop tôt).
  const accesQ1 = M.evaluerAccesQuart('1', 370 /* 06:10 */, '06:00', 30, null);
  assertEqual(accesQ1, { accessible: true, motif: null }, 'Q1 accessible à 06:10 sans verrou (dans sa fenêtre)');
  const accesQ2AvantEngagement = M.evaluerAccesQuart('2', 370 /* 06:10 */, '14:00', 30, null);
  assertEqual(accesQ2AvantEngagement, { accessible: false, motif: 'hors_fenetre' }, 'Q2 hors fenêtre à 06:10 (accessible seulement à partir de 13:30)');
}

// --- evaluerAccesQuart : après engagement (verrou posé sur Q1), Q2 devient verrouillé même dans sa fenêtre ---
{
  const verrou = { quart: '1', locked_at: '2026-08-13T06:15:00Z', source_lock: 'validation_stock_depart' };
  const accesQ2 = M.evaluerAccesQuart('2', 810 /* 13:30, Q2 est pourtant dans sa fenêtre */, '14:00', 30, verrou);
  assertEqual(accesQ2, { accessible: false, motif: 'verrouille_autre_quart' }, 'Q2 verrouillé pour Samantha même à 13:30 (dans sa propre fenêtre) — elle est engagée sur Q1');
  const accesQ1Verrouille = M.evaluerAccesQuart('1', 1200 /* 20:00, largement après le début officiel de Q1 */, '06:00', 30, verrou);
  assertEqual(accesQ1Verrouille, { accessible: true, motif: null }, 'Q1 reste accessible à Samantha à 20:00 : c\'est SON quart verrouillé, la fenêtre horaire ne s\'applique plus à lui');
}

// --- evaluerAccesQuart : dérogation manager (verrou avec quart différent de l'engagement initial) ---
{
  // Le manager a changé le verrou de Samantha vers Q2 (override) — Q2 devient son quart accessible, Q1 se ferme.
  const verrouApresDerogation = { quart: '2', locked_at: '2026-08-13T13:35:00Z', source_lock: 'override_manager', override_manager_id: 'manager-uuid' };
  const accesQ2ApresDerogation = M.evaluerAccesQuart('2', 815, '14:00', 30, verrouApresDerogation);
  assertEqual(accesQ2ApresDerogation, { accessible: true, motif: null }, 'après dérogation manager, Q2 devient le quart accessible pour l\'employé');
  const accesQ1ApresDerogation = M.evaluerAccesQuart('1', 815, '06:00', 30, verrouApresDerogation);
  assertEqual(accesQ1ApresDerogation, { accessible: false, motif: 'verrouille_autre_quart' }, 'et Q1 se ferme — le verrou (quel qu\'il soit) fait toujours autorité, jamais deux quarts ouverts en même temps');
}

console.log(`${passed} test(s) réussi(s), ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
