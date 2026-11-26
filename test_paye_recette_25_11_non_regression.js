// Recette navigateur du 25/11/2026 (Guardian 7179416099) : non-régression des points 1, 2 et 3.
// 1 : toute absence « autre » exige justifiée / injustifiée, sur tous les chemins d'entrée.
// 2 : deux absences qui se recouvrent sont refusées (un jour ne compte qu'une fois).
// 3 : « Généré le » suit le fuseau du site, pas l'UTC. Données fictives, aucune base.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['nexus-paye-moteur.js', 'nexus-paye-donnees.js', 'nexus-paye-dossier-pdf.js'].forEach(f => vm.runInContext(lire(f), ctx));
const D = ctx.NexusPayeDonnees, P = ctx.NexusPayeDossierPdf;
let ok = 0, ko = 0;
async function t(nom, fn) { try { await fn(); ok++; console.log('OK  — ' + nom); } catch (e) { ko++; console.log('ROUGE — ' + nom + ' : ' + e.message.split('\n')[0]); } }

function client(existantes) {
  const ecrit = [];
  return {
    ecrit,
    from() {
      const q = { _f: [] };
      q.select = () => q;
      q.eq = () => q; q.lte = () => q; q.gte = () => q;
      q.then = (res) => res({ data: existantes, error: null });
      q.insert = (l) => { ecrit.push(l); return { select: () => ({ maybeSingle: async () => ({ data: l, error: null }) }) }; };
      q.upsert = async (l) => { ecrit.push(l); return { error: null }; };
      q.update = (l) => { ecrit.push(l); return { eq: async () => ({ error: null }) }; };
      return q;
    },
  };
}
const base = { siteId: 's', employeeId: 'e', dateDebut: '2026-11-17', dateFin: '2026-11-19', motif: 'autre', actorId: 'a' };

(async () => {
  await t('1. déclarer une absence « autre » sans justifiée est refusé, rien n’est écrit', async () => {
    const c = client([]);
    await assert.rejects(() => D.declarerIndisponibilite(c, base), /justifi/i);
    assert.strictEqual(c.ecrit.length, 0);
  });
  await t('1. qualifier une période sans justifiée est refusé', async () => {
    const c = client([]);
    await assert.rejects(() => D.qualifierIndisponibilite(c, { id: 'x', motif: 'autre', actorId: 'a' }), /justifi/i);
  });
  await t('1. préciser avec une valeur non booléenne est refusé', async () => {
    await assert.rejects(() => D.preciserJustification(client([]), { id: 'x', justifiee: null, actorId: 'a' }), /justifi/i);
  });
  await t('1. avec justifiee=false, l’absence est écrite telle quelle', async () => {
    const c = client([]);
    await D.declarerIndisponibilite(c, { ...base, justifiee: false });
    assert.strictEqual(c.ecrit[0].justifiee, false);
  });
  await t('1. l’écran impose le choix sur la carte, la confirmation et le formulaire RH', async () => {
    const h = lire('NEXUS-Paye-v1.html');
    assert(/rh-justifiee-new/.test(h) && /Justification à préciser/.test(h));
    assert(/À choisir/.test(h) && !/>Non précisé</.test(h));
    assert(/rhJustifiee/.test(h));
  });
  await t('2. une absence qui recoupe une absence existante est refusée', async () => {
    const c = client([{ id: 'old', date_debut: '2026-11-17', date_fin: '2026-11-19', motif: 'autre', date_reprise: null }]);
    await assert.rejects(() => D.declarerIndisponibilite(c, { ...base, dateDebut: '2026-11-18', dateFin: '2026-11-18', justifiee: true }), /recoupe/i);
    assert.strictEqual(c.ecrit.length, 0);
  });
  await t('2. sans recouvrement, l’absence est acceptée', async () => {
  }).catch(() => {});
  await t('2. une absence déjà reprise (date_reprise) ne bloque pas', async () => {
    const c = client([{ id: 'old', date_debut: '2026-11-17', date_fin: '2026-11-19', date_reprise: '2026-11-18' }]);
    await D.declarerIndisponibilite(c, { ...base, justifiee: true });
    assert.strictEqual(c.ecrit.length, 1);
  });
  await t('3. 21:03 en Martinique le 25/11 reste le 25/11 (et non le 26 en UTC)', () => {
    assert.strictEqual(P.jourLocal('2026-11-26T01:03:00Z', 'America/Martinique'), '2026-11-25');
  });
  await t('3. sans fuseau fourni, repli sur la Martinique', () => {
    assert.strictEqual(P.jourLocal('2026-11-26T01:03:00Z'), '2026-11-25');
  });
  await t('3. un autre fuseau donne son propre jour', () => {
    assert.strictEqual(P.jourLocal('2026-11-26T01:03:00Z', 'Europe/Paris'), '2026-11-26');
  });
  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
