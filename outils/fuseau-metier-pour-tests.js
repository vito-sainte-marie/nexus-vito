'use strict';
// Installe sur globalThis les primitives « fuseau de la station » de nexus-auth.js
// (bloc NEXUS-FUSEAU-METIER), extraites telles quelles : les épreuves Node testent
// ainsi le code servi, pas une copie. `nexusClient` peut être fourni (stub).
const fs = require('fs');
const path = require('path');
function installer(client) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'nexus-auth.js'), 'utf8');
  const d = src.indexOf('/* NEXUS-FUSEAU-METIER:DEBUT */');
  const f = src.indexOf('/* NEXUS-FUSEAU-METIER:FIN */');
  if (d < 0 || f < d) throw new Error('bloc NEXUS-FUSEAU-METIER introuvable dans nexus-auth.js');
  const noms = ['nexusFuseauValide', 'nexusRetenirFuseau', 'nexusJourDansFuseau', 'nexusFuseauSite', 'nexusLireFuseauSite', 'nexusAujourdhuiStation', 'nexusDecalerJour'];
  const corps = src.slice(d, f) + '\nreturn {' + noms.join(',') + '};';
  const api = new Function('nexusClient', corps)(client || null);
  Object.assign(globalThis, api);
  return api;
}
// Client minimal dont `sites.timezone` vaut `fuseau` pour tout site : les épreuves
// n'ont pas à simuler la base, seulement à fixer le fuseau de la station fictive.
function installerAvecFuseau(fuseau) {
  const reponse = { data: { timezone: fuseau || 'America/Martinique' }, error: null };
  const req = { select: () => req, eq: () => req, maybeSingle: async () => reponse };
  return installer({ from: () => req });
}
module.exports = { installer, installerAvecFuseau };
