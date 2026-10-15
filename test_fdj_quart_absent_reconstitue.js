// Tests unitaires — nexus-fdj-moteur.js :: qualifierQuartsAbsentsReconstitues (15/10/2026)
// Lot NEXUS-FDJ-STOCK-Q1-ABSENT-20261015. Cas de référence : 14/10/2026, Q1 absent,
// Q2 effectué par Loane. Pure logique, aucune dépendance DOM/Supabase.
global.window = global;
require(__dirname + '/nexus-fdj-moteur.js');
const M = global.NexusFdjMoteur;
let passed = 0, failed = 0;
function assertEqual(a, e, label) {
  if (JSON.stringify(a) === JSON.stringify(e)) passed++;
  else { failed++; console.error('ÉCHEC:', label, '— attendu', JSON.stringify(e), 'obtenu', JSON.stringify(a)); }
}
const man = [{ date: '2026-10-14', quart: '1' }];
const lig = (n, statut = 'reconstitue', quart = '1', date = '2026-10-14') =>
  Array.from({ length: n }, () => ({ date_quart_absent: date, quart_absent: quart, statut }));

// Cas de référence : 29 valeurs reconstituées -> bandeau avec le libellé exact.
let r = M.qualifierQuartsAbsentsReconstitues(man, lig(29));
assertEqual(r.toutReconstitue, true, 'référence : tout reconstitué');
assertEqual(r.quarts[0].nb, 29, 'référence : 29 valeurs');
assertEqual(r.libelle, ['Quart 1 du 14/10/2026 non effectué — stock de chaîne reconstitué à partir du quart suivant'], 'référence : libellé');
assertEqual(r.enConflit, 0, 'référence : aucun conflit');

// Aucune ligne (suivant incomplet / non confirmé : la base n'a rien posé) -> pas de bandeau.
r = M.qualifierQuartsAbsentsReconstitues(man, []);
assertEqual([r.toutReconstitue, r.libelle], [false, []], 'sans ligne : aucun bandeau');

// Aucun manquant -> rien à qualifier, même si des lignes traînent.
r = M.qualifierQuartsAbsentsReconstitues([], lig(29));
assertEqual([r.toutReconstitue, r.quarts, r.libelle], [false, [], []], 'sans manquant : rien');

// Lignes d'un autre quart / d'une autre date : ne comptent pas.
r = M.qualifierQuartsAbsentsReconstitues(man, lig(29, 'reconstitue', '2').concat(lig(29, 'reconstitue', '1', '2026-10-13')));
assertEqual(r.toutReconstitue, false, 'autre quart/date : ignoré');

// Contradiction : les conflits sont comptés, la reconstitution reste affichée.
r = M.qualifierQuartsAbsentsReconstitues(man, lig(27).concat(lig(2, 'en_conflit')));
assertEqual([r.toutReconstitue, r.enConflit, r.quarts[0].enConflit], [true, 2, 2], 'conflits comptés');

// Deux quarts manquants dont un seul reconstitué : toutReconstitue faux, libellé du seul reconstitué.
const man2 = [{ date: '2026-10-13', quart: '2' }, { date: '2026-10-14', quart: '1' }];
r = M.qualifierQuartsAbsentsReconstitues(man2, lig(29));
assertEqual([r.toutReconstitue, r.libelle.length], [false, 1], 'partiel');

// Entrées dégradées.
r = M.qualifierQuartsAbsentsReconstitues(null, undefined);
assertEqual([r.toutReconstitue, r.quarts], [false, []], 'null/undefined');

// Câblage des deux écrans : la fonction du moteur ne sert à rien si l'écran ne l'appelle pas.
const fs = require('fs');
const htmlEmp = fs.readFileSync(__dirname + '/NEXUS-FDJ-v1.html', 'utf8');
const htmlMgr = fs.readFileSync(__dirname + '/NEXUS-FDJ-Manager-v1.html', 'utf8');
assertEqual(/from\('fdj_stock_chaine_reconstitue'\)/.test(htmlEmp) && /qualifierQuartsAbsentsReconstitues\(/.test(htmlEmp) && /id="bandeauQuartReconstitue"/.test(htmlEmp), true, 'écran employé câblé');
assertEqual(/from\('fdj_stock_chaine_reconstitue'\)/.test(htmlMgr) && /qualifierQuartsAbsentsReconstitues\(/.test(htmlMgr) && /id="bandeauReconstitueManager"/.test(htmlMgr), true, 'écran manager câblé');
assertEqual(/Chaîne d'inventaire interrompue/.test(htmlMgr) && /data-completer=/.test(htmlMgr), true, 'manager : absence opérationnelle conservée à côté');
assertEqual(/insert|upsert|\.update\(|\.delete\(/i.test((htmlMgr.match(/chargerStocksReconstitues[\s\S]{0,400}/) || [''])[0]), false, 'manager : lecture seule');

console.log(`qualifierQuartsAbsentsReconstitues : ${passed} OK, ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
