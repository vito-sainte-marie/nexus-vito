// Épreuve — 03/11/2026, lot INVENTAIRE-CAISSE-RENFORT : Accueil de la caissière en service, pilote ou non (décision de Frédéric du 03/11 13:44).
// Pilote : bouton vers le fil. Autre caissière : bouton vers l'Inventaire classique, sans fil. Refus : autre rôle, hors service, consultation externe → aucun modèle (l'Accueil actuel reste). Pompiste inchangé.
// Aucun bloc piste ; le bouton mène à filCaisseLien ; le module ne lit ni n'écrit rien. Chaque épreuve est contrôlée par une mutation.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const charger = (src) => { const m = { exports: {} }; new Function('module', 'self', src)(m, undefined); return m.exports; };
const SRC = lire('nexus-accueil-piste.js'); const APP = lire('NEXUS-App-v1.html');
const base = { enService: true, consultationExterne: false, roleDuJour: 'caissiere', piloteCaisse: true, prenom: 'Awa', quart: 'soir',
  heureDebut: '2026-11-03T10:00:00Z', fuseau: 'Indian/Reunion', finMinutes: 20 * 60, inventaireApplicable: true, inventaireOuvertureFaite: false, inventaireFait: false,
  receptionApplicable: true, jaugeageApplicable: true, indexApplicable: true, missions: { total: 2, faites: 0 }, points: 0,
  filCaisseLien: 'NEXUS-Inventaire-v1.html?fil=caisse&etape=2&plan=2.3', inventaireLien: 'NEXUS-Inventaire-v1.html', fdjApplicable: true };
const EPREUVES = {
  'pilote en service : bandeau Caisse, photo, quart, fin, étape 1 sur 1': (M) => {
    const h = M.html(M.modele(base));
    assert(h.includes('>Caisse<') && h.includes('poste-caissiere.webp') && h.includes('Quart du soir') && h.includes('fin à 20 h 00'));
    assert(h.includes('Comptage Boutique') && h.includes('Comptage d’entrée') && h.includes('0 sur 1'));
  },
  'bouton unique « Commencer l’inventaire → » vers filCaisseLien': (M) => {
    const h = M.html(M.modele(base));
    assert.strictEqual((h.match(/class="ap-bouton ap-bouton-caisse"/g) || []).length, 1);
    assert(h.includes('href="NEXUS-Inventaire-v1.html?fil=caisse&amp;etape=2&amp;plan=2.3"') && h.includes('Commencer l’inventaire →'));
  },
  'raccourcis Missions, FDJ (si applicable), Progression ; aucun bloc piste': (M) => {
    const v = M.modele(base); const h = M.html(v);
    assert(v.reception === null && v.finQuart === null && v.fermeture === null);
    assert(h.includes('apMissions') && h.includes('apFdj') && h.includes('apProgression'));
    assert(!h.includes('apReception') && !h.includes('Jaugeage') && !h.includes('index') && !h.includes('Réception'));
    assert(!M.html(M.modele(Object.assign({}, base, { fdjApplicable: false }))).includes('apFdj'));
  },
  'non pilote : même affichage, bouton vers l’Inventaire classique, sans fil': (M) => {
    for (const p of [false, undefined]) {
      const v = M.modele(Object.assign({}, base, { piloteCaisse: p, filCaisseLien: null })); const h = M.html(v);
      assert(v && v.variante === 'caisse' && v.poste.libelle === 'Caisse');
      assert(h.includes('Comptage Boutique') && h.includes('Commencer l’inventaire →') && h.includes('href="NEXUS-Inventaire-v1.html"'));
      assert(!h.includes('fil=caisse'));
    }
  },
  'non pilote : jamais le lien du fil, même si le fait en est donné': (M) => {
    const h = M.html(M.modele(Object.assign({}, base, { piloteCaisse: false })));
    assert(!h.includes('fil=caisse'));
  },
  'non pilote, comptage fait : étape cochée, pas de bouton': (M) => {
    const v = M.modele(Object.assign({}, base, { piloteCaisse: false, inventaireFait: true }));
    assert.strictEqual(v.faites, 1); assert.strictEqual(v.bouton, null);
  },
  'renfort, manager, polyvalent, même pilote : aucun modèle': (M) => { for (const r of ['renfort', 'manager', 'polyvalent']) assert.strictEqual(M.modele(Object.assign({}, base, { roleDuJour: r })), null); },
  'hors service ou consultation externe : aucun modèle': (M) => {
    assert.strictEqual(M.modele(Object.assign({}, base, { enService: false })), null);
    assert.strictEqual(M.modele(Object.assign({}, base, { consultationExterne: true })), null);
  },
  'pompiste inchangé, même avec piloteCaisse': (M) => {
    const v = M.modele(Object.assign({}, base, { roleDuJour: 'pompiste', piloteCaisse: true, filLien: 'NEXUS-Carburant-Jaugeage-v1.html' }));
    assert(v && v.variante !== 'caisse' && v.poste.libelle === 'Pompiste' && v.reception);
  },
  'comptage fait : étape cochée, pas de bouton sans lien': (M) => {
    const v = M.modele(Object.assign({}, base, { inventaireOuvertureFaite: true, filCaisseLien: null }));
    assert.strictEqual(v.faites, 1); assert.strictEqual(v.bouton, null); assert(!M.html(v).includes('apBoutonPrincipal'));
  },
};
const jouer = (M, nom) => EPREUVES[nom](M);
const M0 = charger(SRC);
for (const nom of Object.keys(EPREUVES)) { jouer(M0, nom); console.log('  ✓ ' + nom); }
const MUTATIONS = [
  ['pilote exigé pour l’affichage', (s) => s.replace("f.roleDuJour === 'caissiere') return modeleCaisse", "f.roleDuJour === 'caissiere' && f.piloteCaisse === true) return modeleCaisse")],
  ['rôle caissière non exigé', (s) => s.replace("f.roleDuJour === 'caissiere') return modeleCaisse", ') return modeleCaisse')],
  ['fil donné au non pilote', (s) => s.replace('const pilote = f.piloteCaisse === true;', 'const pilote = true;')],
  ['non pilote sans lien classique', (s) => s.replace("href: f.inventaireLien }", "href: f.filCaisseLien }")],
  ['hors service admis', (s) => s.replace("if (f && f.enService && !f.consultationExterne && f.roleDuJour === 'caissiere'", "if (f && !f.consultationExterne && f.roleDuJour === 'caissiere'")],
  ['bouton hors filCaisseLien', (s) => s.replace('href: f.filCaisseLien }', "href: 'NEXUS-Missions-v1.html' }")],
  ['libellé du bouton', (s) => s.replace("'Commencer l’inventaire →'", "'Reprendre mon début de quart →'")],
  ['photo pompiste', (s) => s.replace('image: IMAGES_POSTE.caissiere', 'image: IMAGES_POSTE.pompiste')],
  ['réception en caisse', (s) => s.replace('reception: null, finQuart', "reception: { href: URL_RECEPTION, livraison: null }, finQuart")],
  ['FDJ toujours', (s) => s.replace('fdj: f.fdjApplicable === true', 'fdj: true')],
];
for (const [nom, mut] of MUTATIONS) {
  const src = mut(SRC); assert.notStrictEqual(src, SRC, 'mutation sans effet : ' + nom);
  let rouge = false;
  try { const M = charger(src); for (const e of Object.keys(EPREUVES)) { try { jouer(M, e); } catch (_) { rouge = true; break; } } } catch (_) { rouge = true; }
  assert(rouge, 'mutation survivante : ' + nom);
}
// Câblage : l'Accueil donne les faits déjà chargés, sans nouvelle lecture ; le libellé du fil caisse remplace celui du pompiste.
assert(/piloteCaisse: piloteCaisse === true, filCaisseLien, fdjApplicable,\s*\n\s*inventaireLien: inventaireApplicable \? 'NEXUS-Inventaire-v1.html' : null/.test(APP), 'App ne câble pas la variante');
assert(APP.includes("const FIL_CAISSE_LIEN_TEXTE = 'Commencer l’inventaire →'") && /ctx\.filLien \? FIL_LIEN_TEXTE : ctx\.filCaisseLien \? FIL_CAISSE_LIEN_TEXTE/.test(APP));
assert(/roleDuJour === NexusFilCaisse\.ROLE && fuseauStation && \(quartDuJour === 'matin' \|\| quartDuJour === 'soir'\)\) \{\s*\n\s*finMinutes = NexusStation\.finDuQuartMinutes/.test(APP), 'App ne charge pas la fin de quart de la caissière');
console.log('OK — ' + Object.keys(EPREUVES).length + ' épreuves, ' + MUTATIONS.length + ' mutations tuées, câblage vérifié');
