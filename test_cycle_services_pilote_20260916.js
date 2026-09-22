/*
 * Le cycle de vie des services pendant la phase pilote (16/09/2026).
 * ============================================================================
 * LE FAIT MESURÉ. Au 16/09/2026, la Production portait trois services encore
 * « en_cours » — un ouvert le 14/09, un le 15/09, un quart du matin du 16/09
 * déjà fini — et deux services « termine » dont l'heure de fin avait été
 * FABRIQUÉE par l'ancienne clôture : 2 jours 00 h 24 et 13 h 31 de « présence »
 * pour un employé qui avait simplement rouvert l'application.
 *
 * L'ARBITRAGE (Frédéric Bragance, 16/09/2026). NEXUS est utilisé de façon
 * intermittente. Plutôt que d'exiger le pointage (le trigger
 * `nexus_pointage_exige_service`, qui reste suspendu), le produit tolère
 * l'usage partiel : les services obsolètes se referment seuls, SANS heure de
 * fin, et NEXUS annonce « fin non enregistrée » au lieu d'une durée.
 *
 * CE QUE CETTE ÉPREUVE VÉRIFIE. Que chaque règle MORD — et surtout qu'aucune
 * ne conclut à la place des faits : ni heure inventée, ni quart du soir
 * déclaré fini sans heure de fermeture configurée, ni durée calculée sur une
 * fin absente.
 */
'use strict';
const assert = require('assert');
const R = require('./nexus-pointage-regles.js');

let reussites = 0;
function verifier(nom, fn) { fn(); reussites++; console.log('  ✓ ' + nom); }

// Le jour STATION, par le vrai fuseau du commerce — jamais celui de la machine
// qui joue l'épreuve. La Martinique est à UTC-4 toute l'année.
const jourDeService = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Martinique' }).format(d);

// Contexte de référence : mercredi 16/09/2026, 10:00 heure station, bascule
// vers le quart 2 à 12:40 (régime « normal » de Vito Sainte-Marie).
const SEUIL = 12 * 60 + 40;      // 760
const ctx = (h, j) => ({
  jourStation: j || '2026-09-16',
  jourDeService,
  minutesStation: h,
  seuilBascule: SEUIL,
});

const service = (o) => Object.assign({
  id: 'sh-1', statut: 'en_cours', quart: 'matin',
  heure_debut: '2026-09-16T12:00:00Z',   // 08:00 heure station
  heure_fin: null,
}, o);

console.log('\nServices obsolètes — les deux critères, et pas un de plus');

verifier('un service ouvert un jour précédent est obsolète', () => {
  const r = R.serviceObsolete(service({ heure_debut: '2026-09-14T14:11:50Z' }), ctx(600));
  assert.deepStrictEqual(r, { obsolete: true, motif: 'jour_precedent' });
});

verifier('le jour se compte À LA STATION, pas en UTC', () => {
  // 16/09 02:00 UTC = 15/09 22:00 à la Martinique : c'est la VEILLE là-bas.
  // Un calcul en UTC conclurait « même jour » et laisserait le service ouvert.
  const debut = '2026-09-16T02:00:00Z';
  assert.strictEqual(jourDeService(new Date(debut)), '2026-09-15', 'prémisse du cas');
  assert.strictEqual(R.serviceObsolete(service({ heure_debut: debut }), ctx(600)).motif, 'jour_precedent');
});

verifier('un quart du matin devient obsolète à la bascule, pas avant', () => {
  const s = service({ quart: 'matin' });
  assert.deepStrictEqual(R.serviceObsolete(s, ctx(SEUIL - 1)), { obsolete: false, motif: null }, '12:39 : encore le quart 1');
  assert.deepStrictEqual(R.serviceObsolete(s, ctx(SEUIL)),     { obsolete: true,  motif: 'quart_termine' }, '12:40 : le quart 1 est fini');
  assert.deepStrictEqual(R.serviceObsolete(s, ctx(SEUIL + 1)), { obsolete: true,  motif: 'quart_termine' });
});

verifier('« quart1 » est traité comme « matin » — le planning et l’exécution ne nomment pas pareil', () => {
  assert.strictEqual(R.serviceObsolete(service({ quart: 'quart1' }), ctx(SEUIL)).motif, 'quart_termine');
});

verifier('un quart du SOIR n’est jamais déclaré fini le jour même', () => {
  // `station_config.horaires` ne porte QUE la bascule quart1/quart2 : aucune
  // heure de fermeture n'est configurée. Conclure qu'un quart du soir est
  // terminé exigerait de l'inventer. Il attendra le changement de jour.
  const soir = service({ quart: 'soir', heure_debut: '2026-09-16T17:00:00Z' });
  assert.deepStrictEqual(R.serviceObsolete(soir, ctx(23 * 60 + 59)), { obsolete: false, motif: null });
  // …mais le lendemain, il relève du premier critère.
  assert.strictEqual(R.serviceObsolete(soir, ctx(600, '2026-09-17')).motif, 'jour_precedent');
});

verifier('un service daté du FUTUR reste intact — aucun des deux critères ne mord', () => {
  // LE DÉFAUT (relevé par le parcours S4 le 18/09/2026, corrigé le 18/09/2026).
  // Le critère du jour s'écrivait `jourDuService !== jourStation` : tout jour
  // DIFFÉRENT était refermé, futur compris, sous le motif `jour_precedent`.
  // Ce n'est pas une anomalie d'affichage — la clôture ÉCRIT en base, sans
  // geste humain, au retour dans l'application : un service pris d'avance
  // était détruit en silence.
  const demain     = service({ heure_debut: '2026-09-17T12:00:00Z' });   // 17/09 08:00 station
  const dansUnMois = service({ heure_debut: '2026-10-16T12:00:00Z' });
  const anProchain = service({ heure_debut: '2027-01-04T12:00:00Z' });
  assert.strictEqual(jourDeService(new Date(demain.heure_debut)), '2026-09-17', 'prémisse du cas');

  for (const futur of [demain, dansUnMois, anProchain]) {
    // À l'heure du quart 1 comme après la bascule : le critère 2 compare
    // l'heure du jour COURANT au seuil, il n'a aucun sens ici et ne doit
    // surtout pas conclure « quart_termine » sur un quart non commencé.
    for (const h of [0, 600, SEUIL - 1, SEUIL, SEUIL + 1, 23 * 60 + 59]) {
      assert.deepStrictEqual(R.serviceObsolete(futur, ctx(h)), { obsolete: false, motif: null },
        futur.heure_debut + ' à ' + h + ' min : un service du futur n’a pas commencé');
    }
  }

  // …et il devient obsolète le moment venu, par le MÊME critère, une fois son
  // jour passé. La correction repousse la clôture, elle ne la supprime pas.
  assert.strictEqual(R.serviceObsolete(demain, ctx(600, '2026-09-18')).motif, 'jour_precedent');
});

verifier('la frontière du critère est le jour station, au jour près', () => {
  // La comparaison est lexicographique sur 'AAAA-MM-JJ' : elle doit se
  // comporter comme une comparaison de dates, y compris aux changements de
  // mois et d'année, que `01` < `12` ferait rater si le format dérivait.
  const cas = [
    ['2026-08-31T12:00:00Z', '2026-09-01', 'jour_precedent'],  // veille, mois précédent
    ['2025-12-31T12:00:00Z', '2026-01-01', 'jour_precedent'],  // veille, année précédente
    ['2026-09-01T12:00:00Z', '2026-08-31', null],              // lendemain, mois suivant
    ['2026-01-01T12:00:00Z', '2025-12-31', null],              // lendemain, année suivante
  ];
  for (const [debut, jour, attendu] of cas) {
    // Quart du soir : on isole le critère 1 du critère 2.
    const s = service({ quart: 'soir', heure_debut: debut });
    assert.strictEqual(R.serviceObsolete(s, ctx(600, jour)).motif, attendu, debut + ' vu depuis ' + jour);
  }
});

verifier('sans seuil exploitable, on ne conclut pas « terminé »', () => {
  for (const mauvais of [null, undefined, NaN, 'midi']) {
    const c = Object.assign(ctx(23 * 60), { seuilBascule: mauvais });
    assert.deepStrictEqual(R.serviceObsolete(service(), c), { obsolete: false, motif: null },
      'seuil ' + String(mauvais) + ' : indétermination, pas conclusion');
    // Le critère du jour, lui, reste évaluable sans seuil.
    assert.strictEqual(R.serviceObsolete(service({ heure_debut: '2026-09-14T14:00:00Z' }), c).motif, 'jour_precedent');
  }
});

verifier('un service déjà clos n’est pas « obsolète » — il est clos', () => {
  for (const statut of ['clos_sans_pointage', 'termine', 'legacy']) {
    assert.deepStrictEqual(R.serviceObsolete(service({ statut, heure_debut: '2026-09-10T12:00:00Z' }), ctx(600)),
      { obsolete: false, motif: null }, statut);
  }
});

verifier('aucune entrée douteuse ne produit de conclusion', () => {
  for (const s of [null, undefined, {}, { statut: 'en_cours' }]) {
    assert.deepStrictEqual(R.serviceObsolete(s, ctx(600)), { obsolete: false, motif: null });
  }
  assert.deepStrictEqual(R.serviceObsolete(service(), null), { obsolete: false, motif: null });
  assert.deepStrictEqual(R.serviceObsolete(service(), { jourStation: '2026-09-16' }), { obsolete: false, motif: null },
    'sans jourDeService, aucun jour n’est comparable');
});

verifier('la règle ne rend JAMAIS d’heure de fin', () => {
  // La mutation à craindre n'est pas qu'elle se taise : c'est qu'elle se mette
  // à proposer une heure. La forme du retour l'interdit structurellement.
  const r = R.serviceObsolete(service({ heure_debut: '2026-09-14T14:00:00Z' }), ctx(600));
  assert.deepStrictEqual(Object.keys(r).sort(), ['motif', 'obsolete']);
});

console.log('\nRégularisation en masse — un seul geste du manager');

verifier('servicesObsoletes ne garde que les obsolètes, avec leur motif', () => {
  const veille   = service({ id: 'a', heure_debut: '2026-09-15T14:00:00Z' });
  const matinFini= service({ id: 'b', quart: 'matin' });
  const soirVivant = service({ id: 'c', quart: 'soir', heure_debut: '2026-09-16T17:00:00Z' });
  const dejaClos = service({ id: 'd', statut: 'clos_sans_pointage', heure_debut: '2026-09-11T12:00:00Z' });
  // `e` est daté du LENDEMAIN : il ne doit pas être proposé au manager, et
  // surtout pas dans une régularisation en masse — un seul geste refermerait
  // alors un service qui n'a pas commencé.
  const futur = service({ id: 'e', quart: 'matin', heure_debut: '2026-09-17T12:00:00Z' });
  const r = R.servicesObsoletes([veille, matinFini, soirVivant, dejaClos, futur], ctx(SEUIL));
  assert.deepStrictEqual(r.map(x => x.service.id), ['a', 'b']);
  assert.deepStrictEqual(r.map(x => x.motif), ['jour_precedent', 'quart_termine']);
});

verifier('une liste vide ou absente ne fait rien planter', () => {
  assert.deepStrictEqual(R.servicesObsoletes(null, ctx(600)), []);
  assert.deepStrictEqual(R.servicesObsoletes([], ctx(600)), []);
});

console.log('\nFin non enregistrée — dire l’absence au lieu de la combler');

verifier('chaque motif est un texte unique, qui annonce l’absence', () => {
  const cles = Object.keys(R.MOTIF_CLOTURE_PILOTE).sort();
  assert.deepStrictEqual(cles, ['jour_precedent', 'manager', 'quart_termine']);
  for (const cle of cles) {
    const texte = R.MOTIF_CLOTURE_PILOTE[cle];
    assert.ok(texte.startsWith('Fin non enregistrée — '), cle + ' doit annoncer la fin non enregistrée : ' + texte);
    assert.ok(texte.endsWith('(phase pilote)'), cle + ' doit se dire provisoire : ' + texte);
  }
  assert.strictEqual(new Set(Object.values(R.MOTIF_CLOTURE_PILOTE)).size, 3, 'trois motifs distincts');
});

verifier('tout motif rendu par la règle existe dans le catalogue', () => {
  // Interdit le texte libre : l'appelant ne peut pas écrire son propre libellé.
  for (const [s, c] of [[service({ heure_debut: '2026-09-14T14:00:00Z' }), ctx(600)], [service(), ctx(SEUIL)]]) {
    const motif = R.serviceObsolete(s, c).motif;
    assert.ok(Object.prototype.hasOwnProperty.call(R.MOTIF_CLOTURE_PILOTE, motif), 'motif inconnu : ' + motif);
  }
});

verifier('finNonEnregistree distingue les trois états', () => {
  assert.strictEqual(R.finNonEnregistree(service({ statut: 'clos_sans_pointage', heure_fin: null })), true);
  assert.strictEqual(R.finNonEnregistree(service({ statut: 'termine', heure_fin: '2026-09-16T16:00:00Z' })), false);
  assert.strictEqual(R.finNonEnregistree(service({ statut: 'en_cours', heure_fin: null })), false,
    'un service en cours n’a pas de fin manquante : il n’a pas de fin');
  assert.strictEqual(R.finNonEnregistree(null), false);
});

verifier('aucune durée n’est produite sur une fin absente', () => {
  // La règle du 16/09 : « aucune conclusion de présence à partir d'un usage
  // incomplet ». C'est la contrepartie en JavaScript de ce que la migration
  // P-2 a effacé en base.
  assert.strictEqual(R.dureeServiceMs(service({ statut: 'clos_sans_pointage', heure_fin: null })), null);
  assert.strictEqual(R.dureeServiceMs(service({ statut: 'en_cours' })), null);
  assert.strictEqual(R.dureeServiceMs(null), null);
  assert.strictEqual(R.dureeServiceMs(service({ heure_fin: '2026-09-16T11:00:00Z' })), null,
    'une fin antérieure au début n’est pas une durée courte : c’est une incohérence');
  assert.strictEqual(R.dureeServiceMs(service({ statut: 'termine', heure_fin: '2026-09-16T16:30:00Z' })),
    4.5 * 3600 * 1000, 'une fin réellement pointée se mesure normalement');
});

verifier('la durée de 2 jours écrite en Production n’aurait pas été calculable', () => {
  // Le service 2fdce6a4 : ouvert le 14/09 10:11:50, aucun pointage de départ.
  // Après P-2, il porte heure_fin = null. Un écran qui voudrait afficher
  // « 2 j 00 h 24 » n'obtient plus de nombre.
  const loane = { statut: 'clos_sans_pointage', heure_debut: '2026-09-14T14:11:50Z', heure_fin: null };
  assert.strictEqual(R.dureeServiceMs(loane), null);
  assert.strictEqual(R.finNonEnregistree(loane), true);
});

console.log(`\n${reussites} vérifications passées — un service se ferme sans que sa fin soit inventée.`);
