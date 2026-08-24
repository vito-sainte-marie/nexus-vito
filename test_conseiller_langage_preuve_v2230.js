// Test — Adapter le langage au niveau de preuve (24/08/2026, v2.230, audit
// "NEXUS_Audit_Cockpit_Ameliorations_Developpeur.pdf" §7 "Adapter le
// langage au niveau de preuve" et §7.1 "Saisonnalité" — dernier chantier
// choisi par Frédéric ("adaptation du langage") parmi ceux restés hors
// périmètre après v2.226-v2.229.
//
// §7 — L'audit : "Certaines recommandations commerciales sont trop
// affirmatives lorsque NEXUS ne possède pas le stock ou le facing réel."
// R4-RENFORT-A et R3-HAUSSE (recoAgir/decisionAgir, recoHausse/
// decisionHausse dans LANGAGE_ACTION) sont TOUJOURS des signaux inférés
// depuis les ventes (contribution au CA, progression entre deux
// périodes) — NEXUS n'a, pour ces deux règles, AUCUNE mesure directe du
// facing/stock/support/production/comptoir/présentoir réel. Ce lot
// remplace les formulations qui assertaient l'action physique elle-même
// ("Renforcez", "Sécurisez", "Augmentez", "Garantissez", "Améliorez") par
// des formulations de vérification — exactement le mouvement du tableau
// §7 ("Renforcez le facing" -> "Vérifiez le facing et la disponibilité" ;
// "Sécurisez le réassort" -> "Vérifiez le stock - la demande accélère").
// R2-BAISSE (recoBaisse/decisionBaisse) commençait déjà par "Vérifiez"
// dans les 6 rayons avant ce lot — vérifié explicitement en non-régression
// ci-dessous.
//
// §7.1 — La détection saisonnière (`detecterMotCleSaisonnier`, 28/07/2026)
// n'existait QUE dans `analyserProduitsStrategiques` ("Regard du
// Conseiller") avant ce lot — un article comme "Gobelet Carnaval" pouvait
// donc devenir une carte d'action R2-BAISSE au ton pressant dans "Plan
// d'exploitation" (le VRAI Plan d'action, pas juste l'analyse secondaire)
// sans aucune prudence saisonnière. Ce lot étend la même règle à
// `calculerCandidatsProduits`, testée ici via le pipeline complet
// (calculerCandidatsProduits -> normaliserProduit), pas seulement la
// fonction de détection isolée — pour prouver que la prudence atteint
// bien la carte réellement affichée au manager.

const assert = require('assert');

global.window = global;
require(__dirname + '/nexus-periodes.js');
require(__dirname + '/nexus-conseiller.js');
const C = global.NexusConseiller;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) LANGAGE_ACTION — recoAgir/decisionAgir adoucis pour facing et
//    production (les 2 des 6 rayons qui asseraient l'action physique),
//    non-régression pour les 4 autres (déjà "Vérifiez...").
// ------------------------------------------------------------
{
  const L = C.LANGAGE_ACTION;

  assert.strictEqual(L.facing.decisionAgir('X'), 'Vérifiez le facing et la disponibilité de X.');
  assert.ok(L.facing.recoAgir('X').includes('vérifier le facing et la disponibilité'));
  ok('LANGAGE_ACTION.facing — decisionAgir/recoAgir adoucis, libellé conforme à l\'exemple exact de l\'audit §7');

  assert.strictEqual(L.production.decisionAgir('X'), 'Vérifiez si la quantité commandée ou produite de X correspond au niveau réel de la demande.');
  ok('LANGAGE_ACTION.production — decisionAgir adouci ("Ajustez" -> "Vérifiez si... correspond")');

  // Non-régression : stock/support/comptoir/presentoir avaient déjà un
  // decisionAgir qui commence par "Vérifiez" — inchangé par ce lot.
  assert.ok(L.stock.decisionAgir('X').startsWith('Vérifiez'));
  assert.ok(L.support.decisionAgir('X').startsWith('Vérifiez'));
  assert.ok(L.comptoir.decisionAgir('X').startsWith('Vérifiez'));
  assert.ok(L.presentoir.decisionAgir('X').startsWith('Vérifiez'));
  ok('LANGAGE_ACTION — decisionAgir de stock/support/comptoir/presentoir déjà conforme, non-régression confirmée');
}

// ------------------------------------------------------------
// 2) LANGAGE_ACTION — recoHausse/decisionHausse adoucis pour les 6 rayons
//    (tous assertifs avant ce lot).
// ------------------------------------------------------------
{
  const L = C.LANGAGE_ACTION;
  assert.strictEqual(L.stock.decisionHausse('X'), 'Vérifiez le stock de X — la demande accélère.', 'exemple exact de l\'audit §7 : "Vérifiez le stock - la demande accélère"');
  assert.strictEqual(L.facing.decisionHausse('X'), 'Vérifiez le facing de X — la demande accélère.');
  assert.strictEqual(L.support.decisionHausse('X'), 'Vérifiez le stock de cartes et l\'activation en caisse pour X — la demande accélère.');
  assert.strictEqual(L.production.decisionHausse('X'), 'Vérifiez la quantité commandée ou produite de X — la demande accélère.');
  assert.strictEqual(L.comptoir.decisionHausse('X'), 'Vérifiez la disponibilité au comptoir de X — la demande accélère.');
  assert.strictEqual(L.presentoir.decisionHausse('X'), 'Vérifiez l\'emplacement de X sur le présentoir — la demande accélère.');
  ['facing', 'stock', 'support', 'production', 'comptoir', 'presentoir'].forEach(t => {
    assert.ok(C.LANGAGE_ACTION[t].decisionHausse('X').startsWith('Vérifiez'), `${t}.decisionHausse doit commencer par "Vérifiez" (plus aucune assertion directe)`);
    assert.ok(C.LANGAGE_ACTION[t].recoHausse('X').startsWith('Vérifiez'), `${t}.recoHausse doit commencer par "Vérifiez"`);
  });
  ok('LANGAGE_ACTION — decisionHausse/recoHausse adoucis pour les 6 rayons, "Vérifiez X — la demande accélère" (libellé exact de l\'audit §7)');
}

// ------------------------------------------------------------
// 3) Non-régression — decisionBaisse (R2-BAISSE) déjà conforme dans les 6
//    rayons, jamais touché par ce lot.
// ------------------------------------------------------------
{
  ['facing', 'stock', 'support', 'production', 'comptoir', 'presentoir'].forEach(t => {
    assert.ok(C.LANGAGE_ACTION[t].decisionBaisse('X').startsWith('Vérifiez'), `${t}.decisionBaisse doit rester "Vérifiez..." (déjà conforme avant ce lot)`);
  });
  ok('LANGAGE_ACTION — decisionBaisse des 6 rayons inchangé (déjà "Vérifiez..." avant ce lot)');
}

// ------------------------------------------------------------
// 4) Saisonnalité (§7.1) — pipeline complet calculerCandidatsProduits ->
//    normaliserProduit, sur un article au nom saisonnier en forte baisse.
// ------------------------------------------------------------
function construireRowsBaisse(article, categorie, caActuel, caPrecedent) {
  return [
    { categorie, article, ca: caPrecedent, quantite: 100, marge: caPrecedent * 0.3, periode_debut: '2026-06-01', periode_fin: '2026-06-30' },
    { categorie, article, ca: caActuel, quantite: 20, marge: caActuel * 0.3, periode_debut: '2026-07-01', periode_fin: '2026-07-31' },
  ];
}
{
  // "Gobelet Carnaval" : -80% de CA (bien en-dessous de SEUIL_BAISSE=-30%)
  // -> déclenche R2-BAISSE, comme n'importe quel autre article.
  const rowsSaisonnier = construireRowsBaisse('Gobelet Carnaval', 'Fêtes', 200, 1000);
  const candidatsSaisonnier = C.calculerCandidatsProduits(rowsSaisonnier);
  const r2Saisonnier = candidatsSaisonnier.find(c => c.rule_id === 'R2-BAISSE');
  assert.ok(r2Saisonnier, 'un candidat R2-BAISSE doit bien être généré pour ce déclin');
  assert.strictEqual(r2Saisonnier.motCleSaisonnier, 'Carnaval', 'le mot-clé saisonnier doit être détecté et exposé sur le candidat brut (casse d\'origine de l\'article conservée)');
  ok('calculerCandidatsProduits — motCleSaisonnier détecté et exposé sur le candidat R2-BAISSE brut ("Gobelet Carnaval")');

  const normaliseSaisonnier = C.normaliserProduit(r2Saisonnier);
  assert.ok(normaliseSaisonnier.limites.includes('consonance saisonnière'), 'la carte doit porter la prudence saisonnière dans "limites" (affiché en "À noter" au Cockpit)');
  assert.ok(normaliseSaisonnier.limites.includes('« Carnaval »'), 'le mot-clé détecté doit être cité, jamais une généralité vague');
  assert.ok(normaliseSaisonnier.limites.includes('fin de campagne normale'), 'phrasé conditionnel repris tel quel de "carteSaisonniere" (Cockpit), jamais une conclusion catégorique (Article 5)');
  assert.strictEqual(normaliseSaisonnier.urgence, 'Cette semaine', 'urgence ramenée (pas "Aujourd\'hui") — aucune dramatisation sur une donnée non vérifiable');
  ok('normaliserProduit — prudence saisonnière propagée jusqu\'à la carte réellement affichée (limites + urgence), pas seulement dans "Regard du Conseiller"');

  // Article NON saisonnier, même ampleur de baisse -> aucune mention
  // saisonnière fabriquée, urgence inchangée ("Aujourd'hui").
  const rowsOrdinaire = construireRowsBaisse('Coca 33cl', 'Boissons', 200, 1000);
  const candidatsOrdinaire = C.calculerCandidatsProduits(rowsOrdinaire);
  const r2Ordinaire = candidatsOrdinaire.find(c => c.rule_id === 'R2-BAISSE');
  assert.strictEqual(r2Ordinaire.motCleSaisonnier, null);
  const normaliseOrdinaire = C.normaliserProduit(r2Ordinaire);
  assert.ok(!normaliseOrdinaire.limites.includes('saisonnière'), 'aucune mention saisonnière fabriquée pour un article ordinaire (Article 5)');
  assert.strictEqual(normaliseOrdinaire.urgence, "Aujourd'hui", 'urgence normale conservée quand aucun signal saisonnier ne justifie de la réduire');
  ok('calculerCandidatsProduits/normaliserProduit — non-régression totale pour un article non saisonnier, même ampleur de baisse');
}

console.log(`\n${n}/${n} tests passés — Langage adapté au niveau de preuve (v2.230).`);
