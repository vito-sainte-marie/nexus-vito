// B0-perf-6a : les signaux persistés et le jour de la station partent AVANT la grande vague.
const fs = require('fs'); const assert = require('assert');
const h = fs.readFileSync(__dirname + '/NEXUS-Brief-v1.html', 'utf8');
const iSig = h.indexOf('const signauxPersistesPromise = NexusRisquesDonnees.chargerSignauxSite(');
const iJour = h.indexOf('const jourStationPromise = nexusAujourdhuiStation(');
const iVague = h.indexOf('await Promise.all([', iJour);
const iAttente = h.indexOf('const [signauxPersistes, jourStation] = await Promise.all([signauxPersistesPromise, jourStationPromise]);');
assert(iSig > 0 && iJour > iSig, 'lancement des signaux et du jour');
assert(iVague > iJour, 'la grande vague vient après le lancement');
assert(iAttente > iVague, 'attente seulement après la vague');
assert(/signauxPersistesPromise\.catch\(/.test(h) && /jourStationPromise\.catch\(/.test(h), 'gardes anti-rejet non géré');
assert(!/^\s*NexusRisquesDonnees\.chargerSignauxSite\(nexusClient, SITE_ACTUEL, \{ statut: 'surveille' \}\),/m.test(h), 'plus de lancement tardif');
console.log('OK signaux avant la vague');
