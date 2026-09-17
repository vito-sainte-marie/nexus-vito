// Test — le front devant un montant MASQUÉ par le serveur (16/09/2026).
//
// CONTEXTE. La migration 20260916210000 fait que `mes_ecarts_caisse()` ne
// renvoie plus `ecart`, `ecart_valide`, `ecart_origine` ni `cause_code` tant
// que `valide_le` est nul. Côté navigateur, un montant absent arrive donc
// désormais pour une raison nouvelle : « on ne vous le communique pas
// encore », et non plus seulement « il n'a jamais été mesuré ».
//
// CE QUE CE FICHIER PROUVE. Que le front ne transforme jamais ce silence en
// information. Deux façons de le trahir, et toutes les deux existaient :
//   1. LE CHIFFRE FABRIQUÉ — `Number(null)` vaut 0 et `x += null` vaut
//      `x + 0`. Un contrôle en cours s'affichait « 0,00 € » et un cumul
//      mensuel entièrement masqué s'annonçait « +0,00 € ». Un employé y
//      lisait un résultat parfait que personne n'avait mesuré.
//   2. LE VERDICT FABRIQUÉ — `estConforme(null)` répond `true`. Un service
//      dont le résultat est inconnu était donc compté « propre » : il
//      prolongeait les séries, gonflait les taux de conformité et pouvait
//      décrocher un badge. Le symétrique aurait été pire encore (punir sur
//      une donnée inexistante), mais les deux sont faux pour la même raison.
//
// LA RÈGLE. Un résultat inconnu n'est ni un succès ni un échec : il vaut
// `null`, et chaque compteur l'EXCLUT explicitement. C'est la règle que
// `serieValideeConforme` appliquait déjà depuis le 03/08/2026 ; ce lot
// l'étend au reste du moteur.
//
// CE QUE CE FICHIER NE PROUVE PAS. Que le serveur masque réellement : c'est
// un test Node, il ne voit pas la base. Cette preuve-là est jouée contre
// Test par outils/recette-acces-hors-service-20260916.js.
//
// DEUX RÉGIMES COEXISTENT, et c'est volontaire. Un manager lit `audits_caisse`
// en brut : les montants provisoires lui sont légitimement visibles, et les
// messages historiques doivent rester intacts pour lui. Seul l'employé, servi
// par la projection, reçoit des montants masqués. Plusieurs assertions
// ci-dessous vérifient explicitement que la vue manager n'a pas bougé.

global.window = global;
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const DIR = __dirname;
require(path.join(DIR, 'nexus-progression.js'));
const N = global.NexusProgression;

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// --- fabriques -------------------------------------------------------------

// Une ligne de projection telle que `mes_ecarts_caisse()` la rend après la
// migration : quand `valide_le` est nul, les quatre colonnes sont masquées.
function ligneProjection({ date, quart = '1', poste = 'piste', ecart = null,
                           valide_le = null, partage = false, audit_id = null }) {
  const masque = valide_le == null;
  return {
    audit_id: audit_id || `${date}-${quart}`,
    site: 'nexus-station-test', date, quart, poste,
    ecart: masque ? null : ecart,
    ecart_valide: masque ? null : ecart,
    ecart_origine: null,
    cause_code: null,
    valide_le,
    poste_partage: partage,
    nb_detenteurs: partage ? 2 : 1,
  };
}

// Un service déjà construit, pour éprouver le moteur sans passer par la
// projection (les compteurs sont testés sur leur propre contrat).
function service({ date, quart = '1', ecartPiste = null, valideLe = null, solo = true }) {
  return {
    id: `${date}-${quart}`, date, quart,
    surPiste: true, surBoutique: false,
    soloPiste: solo, soloBoutique: false,
    ecartPiste, ecartBoutique: null,
    valideLe,
    ecartPisteValide: valideLe ? ecartPiste : null, ecartBoutiqueValide: null,
    commentaireValidation: null,
    ecartPisteOrigine: null, ecartBoutiqueOrigine: null,
    causeCodePiste: null, causeCodeBoutique: null,
  };
}

// =========================================================================
// 1) Le chiffre fabriqué — les deux constructeurs
// =========================================================================

verifier('projection — un montant masqué reste null, jamais 0', () => {
  const s = N.construireServicesCaisseDepuisProjection([
    ligneProjection({ date: '2026-09-15' }),
  ]);
  assert.strictEqual(s.length, 1, 'le contrôle doit rester visible');
  assert.strictEqual(s[0].ecartPiste, null,
    'Number(null) vaut 0 : un contrôle en cours ne doit jamais valoir "0,00 €"');
  assert.strictEqual(s[0].valideLe, null);
});

verifier('projection — un montant validé passe toujours, y compris 0 réel', () => {
  const s = N.construireServicesCaisseDepuisProjection([
    ligneProjection({ date: '2026-09-14', ecart: -12.5, valide_le: '2026-09-15T08:00:00Z' }),
    ligneProjection({ date: '2026-09-13', ecart: 0, valide_le: '2026-09-14T08:00:00Z' }),
  ]);
  const parDate = Object.fromEntries(s.map(x => [x.date, x]));
  assert.strictEqual(parDate['2026-09-14'].ecartPiste, -12.5);
  // Un vrai zéro mesuré n'est pas un montant absent : il doit rester 0.
  assert.strictEqual(parDate['2026-09-13'].ecartPiste, 0,
    'un écart réellement nul est une mesure, pas une absence');
});

verifier('vue manager (lignes brutes) — une colonne NULL ne devient pas 0', () => {
  const s = N.construireServicesCaisse([{
    id: 'a1', date: '2026-09-15', quart: '1',
    employes_piste: ['moi'], employes_boutique: [],
    ecart_piste: null, ecart_boutique: null,
    valide_le: null, ecart_piste_valide: null, ecart_boutique_valide: null,
  }], 'moi');
  assert.strictEqual(s[0].ecartPiste, null,
    'le chemin brut souffrait exactement du même Number(null) === 0');
});

// =========================================================================
// 2) Le verdict fabriqué — serviceEstPropre et ses consommateurs
// =========================================================================

verifier('serviceEstPropre — trois réponses, dont "on ne sait pas"', () => {
  const inconnu = service({ date: '2026-09-15', ecartPiste: null, valideLe: null });
  const propre = service({ date: '2026-09-14', ecartPiste: -0.5, valideLe: '2026-09-15T08:00:00Z' });
  const sale = service({ date: '2026-09-13', ecartPiste: -40, valideLe: '2026-09-14T08:00:00Z' });
  assert.strictEqual(N.serviceEstPropre(inconnu), null,
    'estConforme(null) répond true : sans garde, un résultat inconnu était crédité "propre"');
  assert.strictEqual(N.serviceEstPropre(propre), true);
  assert.strictEqual(N.serviceEstPropre(sale), false);
  assert.strictEqual(N.resultatServiceConnu(inconnu), false);
  assert.strictEqual(N.resultatServiceConnu(propre), true);
});

verifier('serviceEstPropre — après validation, un null reste jugé comme avant', () => {
  // Régression : une colonne jamais renseignée sur un audit VALIDÉ n'est pas
  // un masquage. Le comportement historique (estConforme) ne doit pas changer,
  // sinon des mois entiers de services validés basculeraient en "inconnu".
  const valideSansMontant = service({ date: '2026-09-10', ecartPiste: null, valideLe: '2026-09-11T08:00:00Z' });
  assert.strictEqual(N.serviceEstPropre(valideSansMontant), true,
    'la garde doit viser le masquage (valide_le nul), pas tout montant absent');
});

verifier('nbServicesConformes — un inconnu ne se compte pas', () => {
  const services = [
    service({ date: '2026-09-15', ecartPiste: null, valideLe: null }),
    service({ date: '2026-09-14', ecartPiste: -0.5, valideLe: '2026-09-15T08:00:00Z' }),
  ];
  assert.strictEqual(N.nbServicesConformes(services), 1,
    'le service en cours de contrôle aurait été compté conforme');
});

verifier('meilleureSerieConforme — un inconnu ne prolonge ni ne casse la série', () => {
  const v = d => `2026-09-${d}T08:00:00Z`;
  const services = [
    service({ date: '2026-09-10', ecartPiste: -0.2, valideLe: v(11) }),
    service({ date: '2026-09-11', ecartPiste: -0.1, valideLe: v(12) }),
    service({ date: '2026-09-12', ecartPiste: null, valideLe: null }), // en cours
    service({ date: '2026-09-13', ecartPiste: 0.3, valideLe: v(14) }),
  ];
  const r = N.meilleureSerieConforme(services);
  // Trois services jugés, tous conformes : la série vaut 3. Le contrôle en
  // cours est traversé — le compter propre aurait annoncé 4 (record inventé),
  // le compter sale aurait annoncé 1 (sanction sur une donnée inexistante).
  assert.strictEqual(r.record, 3, 'série record faussée par le contrôle en cours');
  assert.strictEqual(r.enCours, 3, 'série courante faussée par le contrôle en cours');
  assert.strictEqual(r.indetermines, 1, 'le nombre d\'indéterminés doit être rapporté, pas tu');
});

verifier('meilleureSerieConforme — un écart validé casse toujours la série', () => {
  const v = d => `2026-09-${d}T08:00:00Z`;
  const r = N.meilleureSerieConforme([
    service({ date: '2026-09-10', ecartPiste: -0.2, valideLe: v(11) }),
    service({ date: '2026-09-11', ecartPiste: -50, valideLe: v(12) }),
    service({ date: '2026-09-12', ecartPiste: -0.1, valideLe: v(13) }),
  ]);
  assert.strictEqual(r.record, 1, 'non-régression : un vrai écart reste un interrupteur');
  assert.strictEqual(r.enCours, 1);
});

verifier('statutCaisse — un inconnu sort du numérateur ET du dénominateur', () => {
  const v = d => `2026-09-${d}T08:00:00Z`;
  const avecInconnus = N.statutCaisse([
    service({ date: '2026-09-10', ecartPiste: -60, valideLe: v(11) }),
    service({ date: '2026-09-11', ecartPiste: -0.1, valideLe: v(12) }),
    service({ date: '2026-09-12', ecartPiste: null, valideLe: null }),
    service({ date: '2026-09-13', ecartPiste: null, valideLe: null }),
  ]);
  const sansInconnus = N.statutCaisse([
    service({ date: '2026-09-10', ecartPiste: -60, valideLe: v(11) }),
    service({ date: '2026-09-11', ecartPiste: -0.1, valideLe: v(12) }),
  ]);
  // Deux caisses en attente de validation ne doivent RIEN changer au statut :
  // les laisser au dénominateur aurait fait monter le taux de conformité à
  // chaque contrôle en attente — une bonne note produite par l'attente seule.
  assert.deepStrictEqual(avecInconnus, sansInconnus,
    'un contrôle en cours ne doit déplacer aucun statut');
});

verifier('analyserHabitudes — le taux par quart ignore les inconnus', () => {
  const v = d => `2026-09-${String(d).padStart(2, '0')}T08:00:00Z`;
  // Quart 1 : 4 services conformes (100 %). Quart 2 : 3 services avec écart
  // (0 %). L'écart de taux est net, l'habitude est réelle et doit s'afficher.
  const base = [];
  for (let i = 1; i <= 4; i++) base.push(service({ date: `2026-09-0${i}`, quart: 'quart1', ecartPiste: -0.1, valideLe: v(i + 1) }));
  for (let i = 5; i <= 7; i++) base.push(service({ date: `2026-09-0${i}`, quart: 'quart2', ecartPiste: -80, valideLe: v(i + 1) }));
  const attendu = N.analyserHabitudes({ services: base, completionsEmploye: [], catalogueParId: {} });
  assert.ok(/plus performant en caisse le matin/.test(attendu.join(' | ')),
    'le scénario de référence doit produire l\'habitude, sinon le test ne mesure rien : ' + attendu.join(' | '));

  // On ajoute au quart 1 — le quart performant — trente contrôles encore en
  // attente de validation. `serviceEstPropre` les dit inconnus, et `if
  // (propre)` traite un `null` comme un échec : sans l'exclusion explicite,
  // ils entreraient au dénominateur comme autant de services ratés. Le
  // quart 1 tomberait de 100 % à 12 %, passerait derrière le quart 2, et
  // l'habitude réellement observée disparaîtrait de l'écran — effacée par des
  // mesures que personne n'a encore arbitrées.
  const avecEnCours = base.slice();
  for (let i = 1; i <= 30; i++) avecEnCours.push(service({ date: `2026-10-${String(i).padStart(2, '0')}`, quart: 'quart1', ecartPiste: null, valideLe: null }));
  assert.deepStrictEqual(
    N.analyserHabitudes({ services: avecEnCours, completionsEmploye: [], catalogueParId: {} }),
    attendu,
    'des contrôles en attente ne doivent déplacer aucun taux par quart');
});

// =========================================================================
// 3) Les cumuls
// =========================================================================

verifier('agregerMoisCaisse — tout masqué : aucun total, jamais "0,00 €"', () => {
  const a = N.agregerMoisCaisse([
    service({ date: '2026-09-15', ecartPiste: null, valideLe: null }),
    service({ date: '2026-09-14', ecartPiste: null, valideLe: null }),
  ], '2026-09');
  assert.strictEqual(a.caissesEnCours, 2);
  assert.strictEqual(a.ecartProvisoireCumule, null,
    '"x += null" vaut "x + 0" : le cumul provisoire annonçait 0,00 € sur deux montants inconnus');
  assert.strictEqual(a.ecartProvisoireMasque, true);
});

verifier('agregerMoisCaisse — vue manager : les montants provisoires cumulent encore', () => {
  const a = N.agregerMoisCaisse([
    service({ date: '2026-09-15', ecartPiste: -10, valideLe: null }),
    service({ date: '2026-09-14', ecartPiste: -5, valideLe: null }),
  ], '2026-09');
  assert.strictEqual(a.ecartProvisoireCumule, -15, 'non-régression de la vue manager');
  assert.strictEqual(a.ecartProvisoireMasque, false);
});

verifier('agregerMoisCaisse — cumul partiel : le total est signalé incomplet', () => {
  const a = N.agregerMoisCaisse([
    service({ date: '2026-09-15', ecartPiste: -10, valideLe: null }),
    service({ date: '2026-09-14', ecartPiste: null, valideLe: null }),
  ], '2026-09');
  assert.strictEqual(a.ecartProvisoireCumule, -10);
  assert.strictEqual(a.ecartProvisoireMasque, true,
    'un cumul incomplet présenté comme un solde est un mensonge par omission');
});

verifier('agregerMoisCaisse — les cumuls validés restent intacts', () => {
  const a = N.agregerMoisCaisse([
    service({ date: '2026-09-14', ecartPiste: -3.25, valideLe: '2026-09-15T08:00:00Z' }),
  ], '2026-09');
  assert.strictEqual(a.ecartValideCumule, -3.25, 'non-régression du cumul définitif');
  assert.strictEqual(a.ecartProvisoireMasque, false);
});

verifier('pointsForts — le taux de conformité ne se gonfle pas d\'inconnus', () => {
  const v = d => `2026-09-${String(d).padStart(2, '0')}T08:00:00Z`;
  const statuts = {
    statutPonctualiteVal: { statut: 'Insuffisant', nbRetards: 3, total: 10 },
    statutTenueVal: { statut: 'Insuffisant' },
    statutRelationClientVal: { statut: 'Insuffisant' },
  };
  // Six services jugés : 5 conformes, 1 avec écart validé — 83 %, c'est la
  // vérité mesurée. Cinq contrôles en cours s'y ajoutent : comptés conformes
  // (estConforme(null) === true), ils auraient porté l'annonce à 91 %.
  const juges = [];
  for (let i = 1; i <= 5; i++) juges.push(service({ date: `2026-09-0${i}`, ecartPiste: -0.1, valideLe: v(i + 1) }));
  juges.push(service({ date: '2026-09-06', ecartPiste: -90, valideLe: v(7) }));
  const enCours = [];
  for (let i = 10; i <= 14; i++) enCours.push(service({ date: `2026-09-${i}`, ecartPiste: null, valideLe: null }));

  const texte = N.pointsForts(Object.assign({ services: juges.concat(enCours) }, statuts)).join(' | ');
  assert.ok(/83 % de vos services sans écart de caisse/.test(texte),
    'le taux annoncé doit être celui des services réellement arbitrés : ' + texte);
  assert.ok(!/91 %/.test(texte), 'un taux gonflé par des contrôles non arbitrés est une félicitation fabriquée');
  // Et le point fort mérité reste bien annoncé sans les contrôles en cours.
  const seul = N.pointsForts(Object.assign({ services: juges }, statuts)).join(' | ');
  assert.ok(/83 %/.test(seul), 'non-régression : le point fort mérité subsiste');
});

// =========================================================================
// 4) Le discours — la seule phrase autorisée avant validation
// =========================================================================

verifier('la phrase canonique existe, au mot près', () => {
  assert.strictEqual(N.MENTION_CONTROLE_EN_COURS, 'Contrôle de votre caisse en cours.',
    'texte arrêté par Frédéric le 16/09/2026 — ni paraphrase, ni complément');
});

verifier('messageCoachCaisseJour — montant masqué : la phrase, et rien d\'autre', () => {
  const m = N.messageCoachCaisseJour({ statut: 'provisoire', montantEcart: null, serieValideeConformeVal: { enCours: 4 } });
  assert.strictEqual(m, N.MENTION_CONTROLE_EN_COURS);
  // Aucune glose ne doit se glisser dans la phrase : « petit », « rien à
  // faire », « écart » sont autant d'indices sur un résultat non arbitré.
  assert.ok(!/écart|petit|rien à faire|conforme/i.test(m), 'aucune information sur le résultat : ' + m);
});

verifier('messageCoachCaisseJour — vue manager : les messages historiques survivent', () => {
  const avecEcart = N.messageCoachCaisseJour({ statut: 'provisoire', montantEcart: -12.4, serieValideeConformeVal: null });
  assert.ok(/12\.40 €/.test(avecEcart), 'non-régression : le manager voit toujours le montant provisoire');
  const conforme = N.messageCoachCaisseJour({ statut: 'provisoire', montantEcart: -0.1, serieValideeConformeVal: null });
  assert.ok(/en cours de validation par un manager/.test(conforme), 'non-régression du message d\'attente');
});

verifier('les mentions de protection du 03/08/2026 sont préservées', () => {
  assert.ok(/provisoires/.test(N.MENTION_PROTECTION_COURTE));
  assert.ok(/jamais être interprété comme une faute/.test(N.MENTION_PROTECTION_LONGUE));
  assert.strictEqual(N.LIBELLE_STATUT_CAISSE_JOUR.provisoire, 'En cours de contrôle');
});

// =========================================================================
// 5) Les écrans — contrôle statique du rendu
// =========================================================================

const lire = f => fs.readFileSync(path.join(DIR, f), 'utf8');

verifier('Progression — un provisoire attribuable sans montant affiche la phrase', () => {
  const src = lire('NEXUS-Progression-v1.html');
  const i = src.indexOf('const montantHtml = l.montant != null');
  assert.ok(i !== -1, 'rendu du montant introuvable');
  const bloc = src.slice(i, i + 700);
  assert.ok(/l\.statut === 'provisoire'/.test(bloc),
    'sans cette branche, la ligne reste muette : l\'employé croit à un écran cassé');
  assert.ok(/N\.MENTION_CONTROLE_EN_COURS/.test(bloc),
    'la phrase doit venir du moteur, jamais être réécrite dans l\'écran');
});

verifier('Mon évolution — un contrôle en attente reste visible, hors cumul', () => {
  const src = lire('NEXUS-Mon-Evolution-v1.html');
  assert.ok(!/filter\(r => r\.ecart !== null && r\.ecart !== undefined\);/.test(src),
    'ce filtre faisait disparaître de l\'écran tout contrôle non encore validé');
  assert.ok(/\|\| !r\.valide_le\)/.test(src),
    'un contrôle non validé doit rester dans la liste');
  assert.ok(/!l\.partage && l\.ecart != null/.test(src),
    'le cumul ne doit sommer que des montants connus');
  assert.ok(/P\.MENTION_CONTROLE_EN_COURS/.test(src),
    'la phrase doit venir du moteur, jamais être réécrite dans l\'écran');
});

verifier('aucun écran ne réécrit la phrase à la main', () => {
  const coupables = fs.readdirSync(DIR)
    .filter(f => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(f) && f !== 'nexus-progression.js')
    .filter(f => lire(f).includes('Contrôle de votre caisse en cours'));
  assert.deepStrictEqual(coupables, [],
    'une phrase arbitrée recopiée est une phrase qui divergera : ' + coupables.join(', '));
});

console.log(`\n${passes} vérifications passées — un montant masqué n'est ni un zéro, ni un bon résultat.`);
