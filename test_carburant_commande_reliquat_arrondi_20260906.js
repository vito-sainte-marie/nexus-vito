// CARB-004 — le camion se remplit jusqu'à sa cible quand c'est sûr et absorbable.
//
// CE QUI PLAFONNAIT À 35 000 L n'était aucune garde métier. L'optimiseur
// atteint réellement 36 000 L — cas mesuré : sp95 28 761 + go 7 239. C'est
// l'arrondi au millier INFÉRIEUR, appliqué carburant par carburant, qui
// rabotait chacun et faisait retomber le total. Le filet de rattrapage
// existant ne regardait que le `minimum_camion_litres` : au-dessus du
// minimum, le reliquat disparaissait en silence.
//
// `maximum_camion_litres` est une CIBLE, jamais un volume obligatoire : ce
// test vérifie autant les cas où le complément est refusé que celui où il est
// accordé.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const RACINE = __dirname;
const ctx = { window: {}, console, Math, Date, Object, Array, JSON, Number, String, Boolean, isNaN, parseFloat, parseInt };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RACINE, 'nexus-carburant-commande-moteur.js'), 'utf8'), ctx);
const M = ctx.window.NexusCarburantCommandeMoteur
  || Object.values(ctx.window).find(v => v && v.optimiserCommandeMultiCarburant);
assert.ok(M, 'moteur de commande introuvable');

const CONFIG = { minimum_camion_litres: 10000, maximum_camion_litres: 36000 };
const evaluer = (parCarburant, capacitesDisponiblesL, opts = {}) =>
  M.construireEvaluationGlobale({
    evaluationsParCarburant: parCarburant, config: CONFIG, capacitesDisponiblesL,
    viserCamionComplet: opts.viserCamionComplet !== undefined ? opts.viserCamionComplet : true,
  }).commandeRecommandee;

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// Le cas de référence de decision-4.md, aux valeurs réelles mesurées.
const CAS_REFERENCE = {
  sp95: { etat: 'securite',    besoinMinimumSecuriteL: 11000, joursAvantBesoin: 0,  consommationMoyenneJour: 3200, stockPrevuLivraisonL: 500 },
  go:   { etat: 'confortable', besoinMinimumSecuriteL: 0,     joursAvantBesoin: 15, consommationMoyenneJour: 2800, stockPrevuLivraisonL: 8000 },
};

verifier('cas de référence — le reliquat d’arrondi est récupéré, 35 000 → 36 000 L', () => {
  const c = evaluer(CAS_REFERENCE, { sp95: 28761, go: 28553 });
  assert.strictEqual(c.total, 36000, `36 000 L attendus, obtenu ${c.total}`);
  assert.strictEqual(c.reliquatArrondi.recupereL, 1000, 'exactement un compartiment récupéré');
  // sp95 est prioritaire mais sa capacité arrondie (28 000) interdit un pas de
  // plus : le compartiment va donc au go, jamais au carburant prioritaire par
  // principe.
  assert.strictEqual(c.volumes.sp95, 28000);
  assert.strictEqual(c.volumes.go, 8000);
});

// Besoins fractionnaires et MODESTES : l'arrondi perd un compartiment, mais
// le camion est loin d'être plein. C'est le fixture qui distingue « récupérer
// ce que l'arrondi a retiré » de « remplir le camion ».
const CAS_MODESTE = {
  sp95: { etat: 'securite',    besoinMinimumSecuriteL: 11500, joursAvantBesoin: 0, consommationMoyenneJour: 3200, stockPrevuLivraisonL: 500 },
  go:   { etat: 'securite',    besoinMinimumSecuriteL: 8700,  joursAvantBesoin: 1, consommationMoyenneJour: 2800, stockPrevuLivraisonL: 800 },
};

verifier('jamais au-delà de ce que l’optimiseur a jugé nécessaire', () => {
  // L'invariant est calculé, pas écrit en dur : le total recommandé ne dépasse
  // jamais le millier inférieur du besoin que l'optimiseur avait retenu. On
  // récupère ce que l'arrondi a retiré ; on n'invente pas un besoin.
  //
  // RÉSERVE HONNÊTE : cette borne est une ceinture. En mode camion complet,
  // `completerVersCamionPlein` a déjà porté `optim.total` à la cible, et les
  // plafonds de capacité et d'autonomie bordent ensuite chaque pas. La borne
  // n'est donc pas indépendamment observable — sa suppression ne change aucun
  // résultat mesuré. Elle est conservée parce qu'elle garantit la propriété
  // par construction, pas parce qu'un test la démontre.
  for (const cap of [{ sp95: 28761, go: 28553 }, { sp95: 11900, go: 9900 }]) {
    const optim = M.optimiserCommandeMultiCarburant({
      parCarburant: CAS_MODESTE, minimumCamionL: CONFIG.minimum_camion_litres,
      maximumCamionL: CONFIG.maximum_camion_litres, capacitesDisponiblesL: cap,
      viserCamionComplet: true,
    });
    const c = evaluer(CAS_MODESTE, cap);
    const borne = Math.floor((optim.total || 0) / 1000) * 1000;
    assert.ok(c.total <= borne,
      `total ${c.total} L au-delà du besoin optimisé arrondi ${borne} L`);
  }
});

verifier('hors mode camion complet, aucune récupération', () => {
  // Rétrocompatibilité stricte : le comportement historique s'arrête au
  // besoin, même quand l'arrondi a manifestement laissé un compartiment.
  const c = evaluer(CAS_MODESTE, { sp95: 28761, go: 28553 }, { viserCamionComplet: false });
  assert.strictEqual(c.reliquatArrondi.recupereL, 0,
    `aucune récupération hors mode camion complet, obtenu ${c.reliquatArrondi.recupereL} L`);
});

verifier('complément physiquement impossible → on reste sous la cible, avec motif', () => {
  // Capacités arrondies exactement égales aux volumes retenus : aucun
  // compartiment de plus ne rentre.
  const c = evaluer(CAS_REFERENCE, { sp95: 28761, go: 7999 });
  assert.ok(c.total < 36000, `le total doit rester sous la cible, obtenu ${c.total}`);
  assert.strictEqual(c.reliquatArrondi.recupereL, 0);
  const motifs = Object.values(c.reliquatArrondi.motifs).join(' | ');
  assert.ok(/[Cc]apacité disponible/.test(motifs),
    'le motif doit nommer la capacité, pas rester muet : ' + motifs);
});

verifier('complément possible mais NON absorbable → refus, avec motif chiffré', () => {
  // go consomme très peu : un compartiment de plus le pousserait bien au-delà
  // du plafond d'autonomie, alors que la place physique existe.
  const c = evaluer({
    sp95: { etat: 'securite',    besoinMinimumSecuriteL: 11000, joursAvantBesoin: 0,  consommationMoyenneJour: 3200, stockPrevuLivraisonL: 500 },
    go:   { etat: 'confortable', besoinMinimumSecuriteL: 0,     joursAvantBesoin: 30, consommationMoyenneJour: 100,  stockPrevuLivraisonL: 8000 },
  }, { sp95: 28761, go: 28553 });
  assert.strictEqual(c.reliquatArrondi.parCarburant.go, undefined, 'le go ne doit pas être complété');
  const motif = c.reliquatArrondi.motifs.go || '';
  assert.ok(/absorbable/.test(motif), 'le motif doit dire l’absorption : ' + motif);
  assert.ok(/\d+ j de stock/.test(motif), 'le motif doit être chiffré, pas générique : ' + motif);
});

verifier('rotation inconnue → rien n’est inventé', () => {
  // La décision est explicite : « le moteur n'invente pas de ventes futures ».
  // Cette phase est donc PLUS prudente que completerVersCamionPlein, qui
  // autorise la capacité seule quand la consommation est inconnue.
  const c = evaluer({
    sp95: { etat: 'securite',    besoinMinimumSecuriteL: 11000, joursAvantBesoin: 0,  consommationMoyenneJour: 3200, stockPrevuLivraisonL: 500 },
    go:   { etat: 'confortable', besoinMinimumSecuriteL: 0,     joursAvantBesoin: 15, consommationMoyenneJour: null, stockPrevuLivraisonL: null },
  }, { sp95: 28761, go: 28553 });
  assert.strictEqual(c.reliquatArrondi.parCarburant.go, undefined, 'aucun complément sur une rotation inconnue');
  assert.ok(/[Rr]otation prévisionnelle inconnue/.test(c.reliquatArrondi.motifs.go || ''),
    'le motif doit dire l’incertitude : ' + c.reliquatArrondi.motifs.go);
});

verifier('le plafond camion reste un plafond dur', () => {
  const c = evaluer(CAS_REFERENCE, { sp95: 40000, go: 40000 });
  assert.ok(c.total <= 36000, `jamais au-dessus du maximum camion, obtenu ${c.total}`);
});

verifier('tous les volumes restent des multiples de 1000 L', () => {
  for (const cas of [{ cap: { sp95: 28761, go: 28553 } }, { cap: { sp95: 40000, go: 40000 } }, { cap: { sp95: 28761, go: 7999 } }]) {
    const c = evaluer(CAS_REFERENCE, cas.cap);
    for (const [carburant, v] of Object.entries(c.volumes)) {
      assert.strictEqual(v % 1000, 0, `${carburant} = ${v} L n’est pas un multiple de 1000`);
    }
  }
});

verifier('aucune règle Sainte-Marie en dur dans la récupération', () => {
  const src = fs.readFileSync(path.join(RACINE, 'nexus-carburant-commande-moteur.js'), 'utf8');
  const i = src.indexOf('RÉCUPÉRATION DU RELIQUAT');
  assert.ok(i !== -1, 'bloc de récupération introuvable');
  const bloc = src.slice(i, src.indexOf('Plafond camion', i));
  assert.ok(!/vito-sainte-marie|sainte.marie/i.test(bloc), 'aucun site codé en dur');
  assert.ok(/config && config\.maximum_camion_litres/.test(bloc), 'la cible vient de la configuration du site');
  assert.ok(/SEUIL_AUTONOMIE_MAX_JOURS_COMPLETION/.test(bloc),
    'le plafond d’absorption réutilise la garde existante, il ne la réinvente pas');
});

console.log(`\n${passes} vérifications passées — le camion vise sa cible sans jamais forcer.`);
