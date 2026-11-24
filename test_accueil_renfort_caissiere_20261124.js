'use strict';
// Lot « accueil Renfort et Caissière, droit Dates courtes selon le poste du jour ».
const assert = require('assert');
const P = require('./nexus-accueil-piste.js');
const M = require('./nexus-menu-accueil.js');
const base = { enService: true, prenom: 'Test', quart: 'matin', heureDebut: '2026-11-24T13:05:00Z', fuseau: 'America/Martinique', missions: { total: 2, faites: 1 }, points: 3 };
const T = {
  'renfort : variante renfort, carte Renfort et photo renfort': () => {
    const v = P.modele(Object.assign({}, base, { roleDuJour: 'renfort' }));
    assert.strictEqual(v.variante, 'renfort'); assert.strictEqual(v.poste.libelle, 'Renfort');
    assert.ok(/poste-renfort\.webp/.test(v.poste.image)); assert.strictEqual(v.bouton, null); assert.strictEqual(v.etapes.length, 0);
  },
  'renfort : pied Changer de poste et Se déconnecter, pas de comptage': () => {
    const h = P.html(P.modele(Object.assign({}, base, { roleDuJour: 'renfort', datesCourtesApplicable: true })));
    assert.ok(/id="apChangerPoste"[^>]*>Changer de poste/.test(h)); assert.ok(/id="apLogout"/.test(h));
    assert.ok(!/Comptage Boutique/.test(h)); assert.ok(/id="apMissions"/.test(h));
  },
  'renfort avec droit : Dates courtes est le bouton principal, avant Missions, sans lien en doublon': () => {
    const v = P.modele(Object.assign({}, base, { roleDuJour: 'renfort', datesCourtesApplicable: true }));
    assert.strictEqual(v.bouton.libelle, 'Relever les dates courtes'); assert.strictEqual(v.bouton.href, 'NEXUS-Dates-Courtes-Releve-v1.html');
    const h = P.html(v);
    assert.ok(/id="apBoutonPrincipal"/.test(h) && /ap-bouton ap-bouton-caisse/.test(h) && !/apDatesCourtes/.test(h));
    assert.ok(h.indexOf('id="apBoutonPrincipal"') < h.indexOf('id="apMissions"') && h.indexOf('id="apMissions"') < h.indexOf('id="apChangerPoste"'));
  },
  'renfort sans droit : pas de lien Dates courtes': () => {
    { const h = P.html(P.modele(Object.assign({}, base, { roleDuJour: 'renfort' }))); assert.ok(!/apDatesCourtes|apBoutonPrincipal|Relever les dates courtes/.test(h)); }
  },
  'caissière : ordre fil, FDJ, Dates courtes, Missions': () => {
    const h = P.html(P.modele(Object.assign({}, base, { roleDuJour: 'caissiere', fdjApplicable: true, datesCourtesApplicable: true })));
    const i = ['apFil', 'apFdj', 'apDatesCourtes', 'apMissions'].map((k) => h.indexOf('id="' + k + '"'));
    assert.ok(i.every((x) => x > -1) && i.every((x, k) => !k || x > i[k - 1]), String(i));
  },
  'FDJ à compter : vrai bouton secondaire vers FDJ, juste après le fil': () => {
    const h = P.html(P.modele(Object.assign({}, base, { roleDuJour: 'caissiere', fdjApplicable: true, fdjFait: false })));
    assert.ok(/<a class="ap-bouton ap-secondaire ap-bouton-fdj" id="apFdj" href="NEXUS-FDJ-v1\.html">FDJ · Il est temps de compter vos jeux de grattage<\/a>/.test(h));
    assert.ok(h.indexOf('id="apFil"') < h.indexOf('id="apFdj"') && h.indexOf('id="apFdj"') < h.indexOf('id="apMissions"'));
    assert.ok(!/✓ FDJ comptée/.test(h));
  },
  'FDJ comptée : plus de bouton, une ligne discrète vers FDJ': () => {
    const h = P.html(P.modele(Object.assign({}, base, { roleDuJour: 'caissiere', fdjApplicable: true, fdjFait: true })));
    assert.ok(/<a class="ap-lien-discret" id="apFdj" href="NEXUS-FDJ-v1\.html">✓ FDJ comptée<\/a>/.test(h));
    assert.ok(!/ap-bouton-fdj|compter vos jeux/.test(h));
  },
  'FDJ non applicable : rien, même si le fait « compté » est donné': () => {
    for (const fait of [true, false]) assert.ok(!/apFdj/.test(P.html(P.modele(Object.assign({}, base, { roleDuJour: 'caissiere', fdjApplicable: false, fdjFait: fait })))));
  },
  'renfort : jamais de bouton FDJ': () => {
    assert.ok(!/apFdj/.test(P.html(P.modele(Object.assign({}, base, { roleDuJour: 'renfort', fdjApplicable: true, fdjFait: false, datesCourtesApplicable: true })))));
  },
  'caissière sans droit : pas de Dates courtes': () => {
    assert.ok(!/apDatesCourtes/.test(P.html(P.modele(Object.assign({}, base, { roleDuJour: 'caissiere' })))));
  },
  'pompiste : jamais Dates courtes à l’accueil ni au menu': () => {
    const v = P.modele(Object.assign({}, base, { roleDuJour: 'pompiste', datesCourtesApplicable: true }));
    assert.ok(!v || !/apDatesCourtes/.test(P.html(v)));
  },
  'menu employé : Dates courtes avant Missions si droit ouvert': () => {
    const g = M.groupes({ enService: true, roleDuJour: 'renfort', datesCourtesApplicable: true }).find((x) => x.code === 'travail').entrees.map((e) => e.code);
    assert.deepStrictEqual(g, ['dates_courtes', 'missions']);
    const s = M.groupes({ enService: true, roleDuJour: 'caissiere' }).find((x) => x.code === 'travail').entrees.map((e) => e.code);
    assert.deepStrictEqual(s, ['missions']);
  },
  'manager et gérant : menu identique avec ou sans le fait': () => {
    for (const r of ['manager', 'gerant']) {
      const f = { estNiveauManager: true, enService: true, roleDuJour: r };
      assert.deepStrictEqual(M.groupes(Object.assign({}, f, { datesCourtesApplicable: true })), M.groupes(f));
      assert.ok(M.groupes(f).some((gr) => gr.entrees.some((e) => e.code === 'index')));
      assert.strictEqual(P.modele(f), null);
    }
  },
  'renfort : Inventaire grisé conservé': () => {
    const e = M.groupes({ enService: true, roleDuJour: 'renfort' }).find((x) => x.code === 'inventaire').entrees[0];
    assert.strictEqual(e.desactive, true);
  },
};
let ko = 0; for (const [n, f] of Object.entries(T)) { try { f(); console.log('ok  - ' + n); } catch (e) { ko++; console.log('KO  - ' + n + ' : ' + e.message); } }
process.exit(ko ? 1 : 0);
