// Épreuves du producteur d'événements Live (outils/producteur-evenements-live.js).
//
// Ce que ces épreuves défendent tient en une phrase : un écran de pilotage
// ment de deux façons, et les deux sont graves. Il ment en affichant une
// activité qui n'a pas eu lieu, et il ment en restant vide quand il ne sait
// pas — parce qu'un écran vide se lit « tout va bien ».
//
// Le producteur doit donc se taire sur ce qu'il ignore ET ne jamais combler
// un trou. Les épreuves ci-dessous vérifient les deux, plus le fait qu'il
// n'est pas juge de sa propre production : c'est le contrat d'événement qui
// tranche, et il doit pouvoir le refuser.
'use strict';
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const OUTIL = path.join(__dirname, 'outils', 'producteur-evenements-live.js');
const P = require(OUTIL);
const contrat = require(path.join(__dirname, 'nexus-live-evenement.js'));

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

const T0 = '2026-09-07T22:00:00.000Z';

t('tout événement produit est accepté par le contrat, pas seulement par nous', () => {
  // Le producteur n'est pas juge de sa propre production. Si un jour il émet
  // un événement que `nexus-live-evenement.js` refuse, c'est le producteur qui
  // a tort — jamais le contrat qu'on assouplirait pour le laisser passer.
  const r = P.produire({ maintenant: new Date(T0), executerGarde: () => 0 });
  assert.strictEqual(r.erreur, null);
  assert.ok(r.evenements.length > 0, 'le dépôt réel doit produire des événements');
  for (const e of r.evenements) {
    assert.deepStrictEqual(contrat.validerEvenementLive(e), [],
      'événement refusé par le contrat : ' + JSON.stringify(e));
  }
});

t('les identifiants sont déterministes — rejouer ne duplique pas', () => {
  // Sans cela, chaque exécution gonflerait le journal d'un doublon, et
  // l'ingestion devrait tenir un état de son côté pour s'en protéger.
  const a = P.produire({ maintenant: new Date(T0), executerGarde: () => 0 });
  const b = P.produire({ maintenant: new Date('2026-09-08T09:00:00.000Z'), executerGarde: () => 0 });
  const ida = a.evenements.map(e => e.event_id).sort();
  const idb = b.evenements.map(e => e.event_id).sort();
  assert.deepStrictEqual(ida, idb,
    'le même état doit produire les mêmes identifiants, quelle que soit l’heure');
});

t('un garde qui ne s’exécute pas ne produit AUCUN événement', () => {
  // Et surtout pas un « PASSED » par défaut. Un tableau de bord qui affiche
  // « gardes : conformes » parce qu'il n'a pas pu les lancer est exactement le
  // mensonge que ce fichier existe pour empêcher.
  const evts = P.evenementsGardes('LOT-X', T0, { executer: () => null });
  assert.deepStrictEqual(evts, [], 'aucun fait, aucun événement');
});

t('un garde NON bloquant qui signale n’est pas un ÉCHEC', () => {
  // La distinction porte la lisibilité de l'écran : une dette connue et
  // rapportée n'est pas une régression. Les confondre ferait crier au feu tous
  // les jours, et on cesserait de regarder.
  const evts = P.evenementsGardes('LOT-X', T0, { executer: () => 1 });
  const parNom = new Map(evts.map(e => [e.actor.id, e.status]));
  assert.strictEqual(parNom.get('guardian-qa'), 'FAILED', 'un garde bloquant qui sort non nul échoue');
  assert.strictEqual(parNom.get('guardian-bible'), 'BLOCKED', 'un garde de rapport signale, il n’échoue pas');
});

t('un lot dont la décision attend Claude n’attend PAS un arbitrage', () => {
  // C'est la distinction qui décide du compteur « en attente de ton
  // arbitrage » : s'il clignote pour du travail qui n'a besoin de personne,
  // il ne veut plus rien dire.
  const etat = {
    lots: [
      { lot: 'A', etat: 'attente_arbitrage', derniereDemande: 'request-1.md' },
      { lot: 'B', etat: 'en_developpement', derniereDemande: 'request-1.md' },
    ],
  };
  const evts = P.evenementsRegistre(etat, T0);
  const a = evts.find(e => e.lot_id === 'A');
  const b = evts.find(e => e.lot_id === 'B');
  assert.strictEqual(a.phase, 'GATE');
  assert.ok(a.human_gate && a.human_gate.required === true, 'A attend un humain');
  assert.strictEqual(b.phase, 'EXECUTION');
  assert.ok(!b.human_gate, 'B n’attend personne : aucun gate ne doit être posé');
});

t('un gate qui réclame un humain dit QUELLE question il pose', () => {
  // « Autorisation requise » sans objet ne se traite pas. Le contrat l'exige,
  // et le producteur s'y est plié plutôt que de contourner.
  const evts = P.evenementsRegistre(
    { lots: [{ lot: 'A', etat: 'attente_arbitrage', derniereDemande: 'request-3.md' }] }, T0);
  assert.ok(/request-3\.md/.test(evts[0].human_gate.question), evts[0].human_gate.question);
  assert.deepStrictEqual(contrat.validerEvenementLive(evts[0]), []);
});

t('l’état de la barrière Production ne pose PAS de gate', () => {
  // Décrire une barrière n'est pas proposer une promotion. Marquer
  // « autorisation requise » en l'absence de toute demande allumerait le
  // compteur de Frédéric en permanence.
  const evts = P.evenementBarriere('LOT-X',
    { barrieres: { lu: true, brancheProtegee: true, reglesEffectives: ['pull_request'] } }, T0);
  assert.strictEqual(evts.length, 1);
  assert.ok(!evts[0].human_gate, 'aucun gate tant que rien n’est proposé');
  assert.deepStrictEqual(contrat.validerEvenementLive(evts[0]), []);
});

t('des barrières illisibles ne produisent aucun événement', () => {
  assert.deepStrictEqual(P.evenementBarriere('LOT-X', { barrieres: { lu: false } }, T0), [],
    'ne pas savoir n’est pas une information à afficher');
});

t('une branche Production sans protection est signalée BLOCKED', () => {
  const evts = P.evenementBarriere('LOT-X',
    { barrieres: { lu: true, brancheProtegee: false, reglesEffectives: [] } }, T0);
  assert.strictEqual(evts[0].status, 'BLOCKED');
  assert.ok(/push direct/.test(evts[0].summary), evts[0].summary);
});

t('des branches en rade allument un gate qui NOMME les branches', () => {
  // Le signal fait de silence. « Il y a des branches en rade » ne se traite
  // pas : il faut savoir lesquelles, sinon on les relit toutes à chaque fois.
  const evts = P.evenementBranchesEnRade('LOT-X', T0, { controler: () => ({
    total: 20,
    signalements: [
      { code: 'EN_RADE', bloquant: true, branche: 'claude/a', texte: '…' },
      { code: 'CLASSEMENT_INUTILE', bloquant: false, branche: 'claude/b', texte: '…' },
    ],
  }) });
  assert.strictEqual(evts.length, 1);
  assert.strictEqual(evts[0].phase, 'GATE');
  assert.strictEqual(evts[0].status, 'WAITING');
  assert.ok(/claude\/a/.test(evts[0].summary), evts[0].summary);
  assert.ok(!/claude\/b/.test(evts[0].summary),
    'un avertissement de rangement n’est pas une branche en rade : ' + evts[0].summary);
  assert.ok(evts[0].human_gate && evts[0].human_gate.required === true);
  assert.ok(/claude\/a/.test(evts[0].human_gate.question), evts[0].human_gate.question);
  assert.deepStrictEqual(contrat.validerEvenementLive(evts[0]), []);
});

t('aucune branche en rade ne pose PAS de gate', () => {
  // Sinon le compteur « en attente de ton arbitrage » clignoterait en
  // permanence, et cesserait de vouloir dire quelque chose.
  const evts = P.evenementBranchesEnRade('LOT-X', T0, { controler: () => ({ total: 20, signalements: [] }) });
  assert.strictEqual(evts.length, 1);
  assert.strictEqual(evts[0].status, 'PASSED');
  assert.ok(!evts[0].human_gate, 'rien n’attend personne');
  assert.deepStrictEqual(contrat.validerEvenementLive(evts[0]), []);
});

t('une garde INDISPONIBLE ne produit AUCUN événement, surtout pas rassurant', () => {
  // Ne pas savoir doit se lire « je ne sais pas ». Un « aucune branche en
  // rade » produit par une garde qui n'a rien pu regarder serait exactement
  // le mensonge tranquille que ce fichier existe pour empêcher.
  for (const r of [{ indisponible: 'clone superficiel' }, null,
    () => { throw new Error('git absent'); }]) {
    const evts = P.evenementBranchesEnRade('LOT-X', T0,
      { controler: typeof r === 'function' ? r : () => r });
    assert.deepStrictEqual(evts, [], JSON.stringify(r));
  }
});

t('le CLI rend du JSONL relisible, une ligne par événement', () => {
  const r = spawnSync('node', [OUTIL], { encoding: 'utf8', cwd: __dirname });
  assert.strictEqual(r.status, 0, r.stderr);
  const lignes = r.stdout.split('\n').filter(Boolean);
  assert.ok(lignes.length > 0, 'le CLI doit produire quelque chose');
  for (const l of lignes) {
    const e = JSON.parse(l);
    assert.strictEqual(e.protocol, 'nexus-execution-event/1');
    assert.deepStrictEqual(contrat.validerEvenementLive(e), []);
  }
});


t('un événement non conforme est REJETÉ, jamais publié', () => {
  // L'épreuve qui manquait. « Tout événement produit est accepté par le
  // contrat » passait trivialement, puisque le dépôt réel n'en produit que des
  // valides : une mutation supprimant le refus y survivait entièrement. Un
  // chemin de rejet jamais emprunté par une épreuve n'est pas un garde.
  const valide = P.evenement({
    lot: 'A', run: 'r', acteur: 'claude', role: 'execution',
    phase: 'TEST', statut: 'PASSED', resume: 'ok', occurredAt: T0,
  });
  const casses = [
    { nom: 'phase inventée', evt: { ...valide, phase: 'DEPLOIEMENT' } },
    { nom: 'résumé vide', evt: { ...valide, summary: '   ' } },
    { nom: 'rôle d’acteur inconnu', evt: { ...valide, actor: { id: 'x', role: 'humain' } } },
    { nom: 'protocole étranger', evt: { ...valide, protocol: 'autre/1' } },
  ];
  for (const c of casses) {
    const r = P.filtrer([c.evt]);
    assert.deepStrictEqual(r.evenements, [], `${c.nom} ne doit jamais être publié`);
    assert.strictEqual(r.rejetes.length, 1, `${c.nom} doit être compté comme rejeté`);
  }
  // Et le valide passe : sans cela, l'épreuve serait verte avec un filtre qui
  // refuse tout.
  assert.strictEqual(P.filtrer([valide]).evenements.length, 1);
});

t('un doublon exact est écarté, pas publié deux fois', () => {
  const e = P.evenement({
    lot: 'A', run: 'r', acteur: 'claude', role: 'execution',
    phase: 'TEST', statut: 'PASSED', resume: 'ok', occurredAt: T0,
  });
  const r = P.filtrer([e, e]);
  assert.strictEqual(r.evenements.length, 1, 'un seul exemplaire publié');
  assert.deepStrictEqual(r.rejetes[0].erreurs, ['doublon']);
});

console.log(`\n${passes}/${passes} vérifications passées — le producteur se tait sur ce qu’il ignore.`);
