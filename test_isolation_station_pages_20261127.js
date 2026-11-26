// Lot A2b — les cinq pages (Radar-Manager, Centre-Intelligence, Résultats-Équipe, Journal, Debug)
// ne lisent plus employees / mission_completions / pointages sans filtre de station,
// et chargent nexus-site-requis.js. Épreuve statique : chaque chaîne .from('<table>') est lue jusqu'à son ';'.
'use strict';
const fs = require('fs'), path = require('path');
const COL = { employees: 'site_id', mission_completions: 'site_id', pointages: 'site' };
const PAGES = ['NEXUS-Radar-Manager-v1.html','NEXUS-Centre-Intelligence-v1.html','NEXUS-Resultats-Equipe-v1.html','NEXUS-Journal-v1.html','NEXUS-Debug-v1.html'];
let passes = 0, echecs = 0;
function t(nom, fn) { try { fn(); passes++; console.log('  ✓ ' + nom); } catch (e) { echecs++; process.exitCode = 1; console.error('  ✗ ' + nom + '\n    ' + e.message); } }
for (const page of PAGES) {
  const src = fs.readFileSync(path.join(__dirname, page), 'utf8');
  t(`${page} charge nexus-site-requis.js avant son code`, () => {
    if (!/<script src="nexus-site-requis\.js\?v=[^"]+"><\/script>/.test(src)) throw new Error('script absent');
  });
  t(`${page} appelle NexusSiteRequis.exiger`, () => {
    if (!/NexusSiteRequis\.exiger\(/.test(src)) throw new Error('garde absente');
  });
  const re = /\.from\('(employees|mission_completions|pointages)'\)/g;
  let m, n = 0;
  while ((m = re.exec(src))) {
    const table = m[1];
    const fin = src.indexOf(';', m.index);
    const chaine = src.slice(m.index, fin === -1 ? m.index + 600 : fin);
    if (/\.(insert|update|delete|upsert)\(/.test(chaine) && !/\.select\(/.test(chaine)) continue; // écriture ciblée par id
    n++;
    t(`${page} : lecture ${table} #${n} filtrée par ${COL[table]}`, () => {
      if (!new RegExp(`\\.eq\\('${COL[table]}'`).test(chaine)) throw new Error('filtre de station absent : ' + chaine.slice(0, 120).replace(/\s+/g, ' '));
    });
  }
}
console.log(`${passes} réussites, ${echecs} échecs`);
