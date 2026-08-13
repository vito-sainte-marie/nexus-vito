// Tests unitaires — nexus-fdj-moteur.js :: chaineContinuite / quartPrecedentAttendu (13/08/2026)
//
// Nés d'un signalement direct de Frédéric avec capture d'écran (FDJ Manager,
// panneau Alertes stock) : Samantha ouvre son quart du 13/08 Q1, NEXUS le
// compare au 10/08 Q2 (dernier quart VALIDÉ retrouvé, mais pas le quart
// immédiatement précédent — 11/08 et 12/08 n'ont jamais été comptés). Ça
// génère 15 fausses alertes "stock initial modifié", une par jeu. "NEXUS ne
// compare jamais deux inventaires s'ils ne sont pas consécutifs [...] Avant
// tout calcul FDJ utilisant un stock précédent, vérifier la continuité
// temporelle des quarts." Ce fichier couvre uniquement la détection de
// rupture (aucune dépendance DOM/Supabase — pure logique).

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

// --- quartPrecedentAttendu : Q2 -> Q1 même jour ; Q1 -> Q2 la veille ---
{
  assertEqual(M.quartPrecedentAttendu('2026-08-13', '2'), { date: '2026-08-13', quart: '1' }, 'Q2 -> Q1 même jour');
  assertEqual(M.quartPrecedentAttendu('2026-08-13', '1'), { date: '2026-08-12', quart: '2' }, 'Q1 -> Q2 la veille');
  assertEqual(M.quartPrecedentAttendu('2026-03-01', '1'), { date: '2026-02-28', quart: '2' }, 'Q1 -> Q2 la veille, traverse une fin de mois');
}

// --- quartSuivant : symétrique ---
{
  assertEqual(M.quartSuivant('2026-08-13', '1'), { date: '2026-08-13', quart: '2' }, 'Q1 -> Q2 même jour');
  assertEqual(M.quartSuivant('2026-08-13', '2'), { date: '2026-08-14', quart: '1' }, 'Q2 -> Q1 le lendemain');
}

// --- Scénario exact de Frédéric : Samantha 13/08 Q1, dernier quart validé
// retrouvé = 10/08 Q2 (attendu : 12/08 Q2). 3 jours manquants = 6 quarts. ---
{
  const r = M.chaineContinuite({ date: '2026-08-10', quart: '2' }, { date: '2026-08-13', quart: '1' });
  assert(r.rompue === true, 'chaîne rompue : 10/08 Q2 n\'est pas le quart immédiatement précédent de 13/08 Q1');
  assertEqual(r.manquants, [
    { date: '2026-08-11', quart: '1' }, { date: '2026-08-11', quart: '2' },
    { date: '2026-08-12', quart: '1' }, { date: '2026-08-12', quart: '2' },
  ], '4 quarts manquants entre le 10/08 Q2 (exclu) et le 13/08 Q1 (exclu), dans l\'ordre chronologique');
}

// --- Chaîne intacte : le quart trouvé EST le quart immédiatement précédent (cas normal, aucune alerte) ---
{
  const r1 = M.chaineContinuite({ date: '2026-08-12', quart: '2' }, { date: '2026-08-13', quart: '1' });
  assert(r1.rompue === false, 'Q1 précédé du Q2 de la veille : chaîne intacte');
  assertEqual(r1.manquants, [], 'aucun quart manquant si la chaîne est intacte');

  const r2 = M.chaineContinuite({ date: '2026-08-13', quart: '1' }, { date: '2026-08-13', quart: '2' });
  assert(r2.rompue === false, 'Q2 précédé du Q1 du même jour : chaîne intacte');
}

// --- Aucun quart précédent du tout (tout premier quart jamais compté) : pas une rupture ---
{
  const r = M.chaineContinuite(null, { date: '2026-08-13', quart: '1' });
  assert(r.rompue === false, 'aucun quart précédent trouvé = premier quart FDJ, pas une rupture de chaîne');
  assertEqual(r.manquants, []);
}

// --- Un seul quart manquant (cas le plus fréquent : un quart resté en brouillon) ---
{
  const r = M.chaineContinuite({ date: '2026-08-12', quart: '1' }, { date: '2026-08-13', quart: '1' });
  assert(r.rompue === true, '1 quart manquant (12/08 Q2) suffit à rompre la chaîne');
  assertEqual(r.manquants, [{ date: '2026-08-12', quart: '2' }]);
}

// --- Rupture à cheval sur un changement de mois (jamais fabriquer une date invalide) ---
{
  const r = M.chaineContinuite({ date: '2026-01-30', quart: '2' }, { date: '2026-02-02', quart: '1' });
  assert(r.rompue === true, 'rupture à cheval sur janvier -> février');
  assertEqual(r.manquants, [
    { date: '2026-01-31', quart: '1' }, { date: '2026-01-31', quart: '2' },
    { date: '2026-02-01', quart: '1' }, { date: '2026-02-01', quart: '2' },
  ], 'aucune date invalide (pas de 31 février), enchaînement correct des mois');
}

console.log(`${passed} test(s) réussi(s), ${failed} échec(s).`);
process.exit(failed ? 1 : 0);
