// INVENTAIRE-RELECTURES-20261024 — `shifts` et `sites` ne sont plus lus deux fois.
//
// Mesure Claude Guardian (Test, ee426fe, Employé Test B) : `shifts` ×2 (requête
// identique, 533 puis 975 ms) et `sites` ×2 (fuseau, 649 puis 975 ms). Ce test
// monte le code LIVRÉ de nexus-auth.js et nexus-station.js (extraction par
// accolades) et compte les lectures. `station_config` n'est PAS regroupé :
// pointage et paramètres d'inventaire ne lisent pas la même chose.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const SRC_AUTH = fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8');
const SRC_STATION = fs.readFileSync(path.join(RACINE, 'nexus-station.js'), 'utf8');

function extraire(entete, source) {
  const i = source.indexOf(entete);
  assert.ok(i !== -1, `« ${entete} » introuvable`);
  let prof = 0;
  for (let k = source.indexOf('{', i); k < source.length; k++) {
    if (source[k] === '{') prof++;
    else if (source[k] === '}' && --prof === 0) return source.slice(i, k + 1);
  }
  throw new Error(`« ${entete} » non refermée`);
}

function monde(srcAuth, srcStation, opts = {}) {
  const lectures = { shifts: 0, sites: 0, station_config: 0 };
  let maintenant = Date.UTC(2026, 9, 24, 13, 30);
  const Reel = Date;
  function DateFige(...a) { return a.length ? new Reel(...a) : new Reel(maintenant); }
  DateFige.prototype = Reel.prototype;
  DateFige.now = () => maintenant;
  DateFige.parse = Reel.parse;
  DateFige.UTC = Reel.UTC;
  const client = {
    from(table) {
      const ch = {
        select: () => ch, eq: () => ch, order: () => ch, limit: () => ch,
        maybeSingle() {
          lectures[table] = (lectures[table] || 0) + 1;
          if (table === 'sites') {
            if (opts.sitesErreur) return Promise.resolve({ data: null, error: { message: 'réseau' } });
            if (opts.sitesVide) return Promise.resolve({ data: { timezone: null }, error: null });
            return new Promise(r => setTimeout(() => r({ data: { timezone: 'Europe/Paris' }, error: null }), 5));
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(res, rej) {
          lectures[table] = (lectures[table] || 0) + 1;
          const data = table === 'shifts' && !opts.aucunService
            ? [{ id: 'svc-1', role: 'pompiste', quart: 'soir', heure_debut: '2026-10-24T13:00:00Z', site_id: 's1', statut: 'en_cours' }]
            : [];
          const err = table === 'shifts' && opts.shiftsErreur ? { message: 'x' } : null;
          return new Promise(r => setTimeout(() => r({ data: err ? null : data, error: err }), 5)).then(res, rej);
        },
      };
      return ch;
    },
  };
  const nexusCloturerServicesObsoletes = async () => ({ closes: 0, tentees: 0, refuses: 0 });
  const NexusPointageRegles = { quartDuService: () => 'soir', jourStationDe: () => '2026-10-24' };
  const corps = [
    'const nexusFuseauxSite = new Map();',
    'const nexusFuseauxEnCours = new Map();',
    extraire('function nexusFuseauValide(', srcAuth),
    extraire('function nexusRetenirFuseau(', srcAuth),
    extraire('function nexusJourDansFuseau(', srcAuth),
    extraire('async function nexusFuseauSite(', srcAuth),
    extraire('async function nexusLireFuseauSite(', srcAuth),
    srcAuth.slice(srcAuth.indexOf('const NEXUS_SERVICE_COURANT_TTL_MS'), srcAuth.indexOf('function nexusServiceCourant(')),
    extraire('function nexusServiceCourant(', srcAuth),
    extraire('async function nexusServiceCourantSansMemo(', srcAuth),
    'const NexusStation = {};',
    extraire('async function fuseauDeLaStation(', srcStation),
    'return { nexusServiceCourant, nexusInvaliderServiceCourant, nexusFuseauSite, fuseauDeLaStation };',
  ].join('\n');
  const api = new Function('Date', 'console', 'nexusClient', 'NexusPointageRegles', 'nexusCloturerServicesObsoletes', corps)(
    DateFige, { error() {}, warn() {}, info() {} },
    client, NexusPointageRegles, nexusCloturerServicesObsoletes);
  return { api, lectures, avancer: ms => { maintenant += ms; } };
}

const emp = { id: 'e1', site_id: 's1' };
const cas = [];
const t = (nom, f) => cas.push([nom, f]);

t('S1 · porte d\'accès puis rôle du jour : `shifts` lu une seule fois', async src => {
  const m = monde(src.auth, src.station);
  const [a, b] = await Promise.all([m.api.nexusServiceCourant(emp), m.api.nexusServiceCourant(emp)]);
  assert.ok(a.service && b.service, 'les deux appelants reçoivent le service');
  assert.strictEqual(m.lectures.shifts, 1, `shifts lu ${m.lectures.shifts} fois`);
  assert.strictEqual(m.lectures.sites, 1, `sites lu ${m.lectures.sites} fois`);
});
t('S2 · un autre employé ou un autre site relit', async src => {
  const m = monde(src.auth, src.station);
  await m.api.nexusServiceCourant(emp);
  await m.api.nexusServiceCourant({ id: 'e2', site_id: 's1' });
  await m.api.nexusServiceCourant({ id: 'e1', site_id: 's2' });
  assert.strictEqual(m.lectures.shifts, 3, `shifts lu ${m.lectures.shifts} fois`);
});
t('S3 · passé 3 secondes, on relit', async src => {
  const m = monde(src.auth, src.station);
  await m.api.nexusServiceCourant(emp);
  m.avancer(3500);
  await m.api.nexusServiceCourant(emp);
  assert.strictEqual(m.lectures.shifts, 2, `shifts lu ${m.lectures.shifts} fois`);
});
t('S4 · une erreur de lecture n\'est jamais gardée', async src => {
  const m = monde(src.auth, src.station, { shiftsErreur: true });
  const a = await m.api.nexusServiceCourant(emp);
  await m.api.nexusServiceCourant(emp);
  assert.ok(a.erreur, 'l\'erreur est rendue');
  assert.strictEqual(m.lectures.shifts, 2, `shifts lu ${m.lectures.shifts} fois`);
});
t('S5 · « aucun service » n\'est jamais gardé', async src => {
  const m = monde(src.auth, src.station, { aucunService: true });
  const a = await m.api.nexusServiceCourant(emp);
  await m.api.nexusServiceCourant(emp);
  assert.ok(a.aucun, 'aucun service');
  assert.strictEqual(m.lectures.shifts, 2, `shifts lu ${m.lectures.shifts} fois`);
});
t('S6 · l\'invalidation oblige à relire', async src => {
  const m = monde(src.auth, src.station);
  await m.api.nexusServiceCourant(emp);
  m.api.nexusInvaliderServiceCourant();
  await m.api.nexusServiceCourant(emp);
  assert.strictEqual(m.lectures.shifts, 2, `shifts lu ${m.lectures.shifts} fois`);
});
t('S7 · fuseau : auth et station partagent une seule lecture de `sites`', async src => {
  const m = monde(src.auth, src.station);
  const [f1, f2] = await Promise.all([m.api.nexusFuseauSite('s1'), m.api.fuseauDeLaStation('s1')]);
  assert.strictEqual(f1, 'Europe/Paris');
  assert.deepStrictEqual(f2, { timezone: 'Europe/Paris' });
  assert.strictEqual(m.lectures.sites, 1, `sites lu ${m.lectures.sites} fois`);
});
t('S8 · fuseau : station d\'abord, auth ensuite, toujours une lecture', async src => {
  const m = monde(src.auth, src.station);
  await m.api.fuseauDeLaStation('s1');
  await m.api.nexusFuseauSite('s1');
  assert.strictEqual(m.lectures.sites, 1, `sites lu ${m.lectures.sites} fois`);
});
t('S9 · fuseau : la raison de l\'échec reste distinguée (aucun fuseau deviné)', async src => {
  const r = monde(src.auth, src.station, { sitesErreur: true });
  assert.deepStrictEqual(await r.api.fuseauDeLaStation('s1'), { indetermine: 'reseau' });
  const c = monde(src.auth, src.station, { sitesVide: true });
  assert.deepStrictEqual(await c.api.fuseauDeLaStation('s1'), { indetermine: 'configuration' });
});
t('S10 · `station_config` n\'est pas regroupé (aucune lecture ajoutée ni retirée ici)', async src => {
  const m = monde(src.auth, src.station);
  await m.api.nexusServiceCourant(emp);
  await m.api.fuseauDeLaStation('s1');
  assert.strictEqual(m.lectures.station_config, 0, 'ni auth ni station ne lisent station_config pour ces deux besoins');
});
t('S11 · la clôture de services obsolètes invalide le mémo', async src => {
  const corps = extraire('async function nexusAppliquerCloturePilote(', src.auth);
  assert.ok(/nexusInvaliderServiceCourant\(\)/.test(corps), 'nexusAppliquerCloturePilote (point commun des clôtures automatique et manager) doit invalider');
});

async function jouer(src, filtre) {
  const rouges = [];
  for (const [nom, f] of cas) {
    if (filtre && !filtre.test(nom)) continue;
    try { await f(src); if (!filtre) console.log('  ✓ ' + nom); }
    catch (e) { rouges.push(nom + ' — ' + e.message); if (!filtre) console.log('  ✗ ' + nom + '\n      ' + e.message); }
  }
  return rouges;
}

const mutants = [
  ['shifts sans mémo', s => s.auth.replace(/if\(memo && \(Date\.now\(\) - memo\.t\) < NEXUS_SERVICE_COURANT_TTL_MS\) return memo\.promesse;/, ''), null],
  ['mémo éternel', s => s.auth.replace(/\(Date\.now\(\) - memo\.t\) < NEXUS_SERVICE_COURANT_TTL_MS/, 'true'), null],
  ['clé sans site', s => s.auth.replace("employee.id + '|' + employee.site_id", 'employee.id'), null],
  ['erreur gardée', s => s.auth.replace(/if\(!\(r && r\.service\) && nexusServiceCourantMemo/, 'if(false && nexusServiceCourantMemo'), null],
  ['invalidation sans effet', s => s.auth.replace('function nexusInvaliderServiceCourant(){ nexusServiceCourantMemo.clear(); }', 'function nexusInvaliderServiceCourant(){}'), null],
  ['clôture sans invalidation', s => s.auth.replace("if(closes>0 && typeof nexusInvaliderServiceCourant==='function') nexusInvaliderServiceCourant();", ''), null],
  ['fuseau sans partage de la requête en vol', s => s.auth.replace(/if\(nexusFuseauxEnCours\.has\(siteId\)\) return nexusFuseauxEnCours\.get\(siteId\);/, ''), null],
  ['station relit sites', null, s => s.station.replace("if (typeof nexusFuseauSite === 'function') {", 'if (false) {')],
];

(async () => {
  const src = { auth: SRC_AUTH, station: SRC_STATION };
  console.log('— INVENTAIRE-RELECTURES-20261024 : `shifts` et `sites` lus une fois —');
  const rouges = await jouer(src);
  let ko = rouges.length > 0;
  console.log('\n  Mutations (chacune doit rougir) :');
  for (const [nom, fa, fs_] of mutants) {
    const m = { auth: fa ? fa(src) : SRC_AUTH, station: fs_ ? fs_(src) : SRC_STATION };
    if ((fa && m.auth === SRC_AUTH) || (fs_ && m.station === SRC_STATION)) { console.log('  ✗ mutant « ' + nom + ' » : motif introuvable'); ko = true; continue; }
    let r;
    try { r = await jouer(m, /./); } catch (e) { r = ['exception ' + e.message]; }
    if (r.length) console.log('  ✓ « ' + nom + ' » rougit (' + r.length + ')');
    else { console.log('  ✗ « ' + nom + ' » reste VERT : l\'épreuve ne mord pas'); ko = true; }
  }
  console.log(ko ? '\nROUGE.' : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
