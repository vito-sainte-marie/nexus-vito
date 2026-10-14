// Hiérarchie des KPI de « Analyse des écarts » : Manques validés d'abord et principal,
// Solde opérationnel secondaire, bulles (i) accessibles, manques non validés séparés.
const fs = require('fs'); const assert = require('assert');
const html = fs.readFileSync(__dirname + '/NEXUS-Analyse-Ecarts-v1.html', 'utf8');
let n = 0; const ok = (c, m) => { assert.ok(c, 'ÉCHEC : ' + m); n++; };
ok(html.indexOf('id="kpiCardRetenu"') < html.indexOf('id="kpiCardSolde"'), 'Manques validés avant Solde opérationnel');
ok(/class="kpi-card large montant-retenu principal" id="kpiCardRetenu"/.test(html), 'carte principale');
ok(/class="kpi-card large secondaire" id="kpiCardSolde"/.test(html), 'carte secondaire');
ok(/\.kpi-card\.principal \.kpi-valeur\{font-size:34px/.test(html) && /\.kpi-card\.secondaire \.kpi-valeur\{font-size:15px/.test(html), 'tailles hiérarchisées');
ok(html.includes("Total des manques confirmés sur la période. Les excédents ne les compensent pas. Ce montant n'est pas une dette automatique du salarié."), 'texte (i) manques validés');
ok(html.includes("Résultat signé de tous les écarts constatés, positifs et négatifs, validés ou non. Sert à l'analyse globale et ne représente pas le solde restant à régulariser."), 'texte (i) solde');
ok((html.match(/<button type="button" class="info-i"[^>]*aria-controls=/g) || []).length === 2, 'deux boutons (i) clavier');
ok((html.match(/role="tooltip"/g) || []).length === 2, 'deux bulles role=tooltip');
ok(/stopPropagation/.test(html) && /Escape/.test(html), 'clic isolé de la carte, Échap ferme');
ok(/kpiNonValides/.test(html) && /statut === 'a_verifier' && l\.ecartFinal != null && l\.ecartFinal < 0/.test(html), 'non validés sommés sur les lignes, sans soustraction');
for (const id of ['kpiCardPositifs', 'kpiCardNegatifs', 'kpiCardInvestiguer', 'kpiCardVolume']) ok(html.includes('id="' + id + '"'), id + ' conservée');
console.log(n + ' vérifications OK');
