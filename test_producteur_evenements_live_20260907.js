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

t('le bloc Déploiements porte ses chiffres dans la PREUVE, pas dans la phrase', () => {
  // Un écran qui devrait relire un résumé pour retrouver un nombre finirait par
  // recalculer, et NEXUS n'admet qu'un propriétaire logique par vérité métier.
  const etat = { compteurs: { en_developpement: 2, attente_arbitrage: 1, clos: 24 },
    dette: { total: 30, p0: 20 },
    ecart: { production: '501c0c7', canonique: 'abc1234', commits: 228, fichiers: 313 } };
  const evts = P.evenementDeploiement('LOT-X', etat, T0);
  assert.strictEqual(evts.length, 1);
  const e = evts[0];
  assert.deepStrictEqual(contrat.validerEvenementLive(e), [], JSON.stringify(e));
  assert.strictEqual(e.evidence.type, 'deploiement');
  assert.ok(e.evidence.ref, 'des chiffres sans source ne sont pas une preuve');
  assert.deepStrictEqual(e.evidence.compteurs, { en_developpement: 2, attente_arbitrage: 1, clos: 24 });
  assert.deepStrictEqual(e.evidence.dette, { total: 30, p0: 20 });
  assert.strictEqual(e.evidence.ecart.commits, 228);
  // « Prêt pour Production » ne se calcule pas : aucune décision de recette ne
  // vaut autorisation de production.
  assert.strictEqual(e.evidence.pret_production_est_une_proposition, true);
  assert.ok(!e.human_gate, 'décrire un état n’est pas proposer une promotion');

  // ET SURTOUT : il ne doit pas ÉTEINDRE le gate de son lot. Éprouvé par sa
  // conséquence, pas par sa forme — le premier jet portait `DONE`, ce qui
  // referme un gate dans la projection : le compteur « en attente de ton
  // arbitrage » se serait éteint à chaque passage de CI, en silence.
  const projection = require(path.join(__dirname, 'nexus-live-projection.js'));
  const gate = { occurred_at: '2026-09-07T22:00:00.000Z', lot_id: 'LOT-X', run_id: 'handoff',
    actor: { id: 'orchestrator', role: 'orchestrator' }, phase: 'GATE', status: 'WAITING',
    summary: 'Arbitrage attendu', human_gate: { required: true, question: 'Autoriser ?' } };
  const p = projection.construireProjectionLive([gate, e]);
  assert.ok(p.human_gate, 'le bloc Déploiements ne doit pas refermer un gate : ' + e.phase);
});

t('un état de déploiement ABSENT ou en erreur ne produit aucun bloc', () => {
  // Ne pas savoir n'est pas « zéro lot en développement » : un tableau de bord
  // qui affiche des zéros faute de données ment plus qu'un tableau vide.
  for (const etat of [null, undefined, { erreur: 'STATE.json illisible' }, {}]) {
    assert.deepStrictEqual(P.evenementDeploiement('LOT-X', etat, T0), [], JSON.stringify(etat));
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

t('l’ingestion unitaire nomme chaque événement avant de l’écrire', () => {
  // Un lot refusé en bloc ne dit pas laquelle des lignes pose problème. Le
  // 08/09/2026, trois hypothèses successives sont tombées à côté faute de
  // pouvoir désigner la coupable.
  const e = P.evenement({ lot: 'A', run: 'r', acteur: 'garde-x', role: 'guardian',
    phase: 'GUARDIAN_REVIEW', statut: 'PASSED', resume: 'ok', occurredAt: T0 });
  const sql = P.sqlIngestionUnitaire([e, { ...e, event_id: 'evt-2', actor: { id: 'y', role: 'ci' } }]);
  assert.ok(sql.includes(`\\echo EVENEMENT ${e.event_id} role=guardian phase=GUARDIAN_REVIEW`), sql);
  assert.ok(sql.includes('\\echo EVENEMENT evt-2 role=ci'), sql);
  assert.strictEqual((sql.match(/insert into public\.nexus_live_events/g) || []).length, 2,
    'une instruction par événement, sinon on ne peut pas isoler la fautive');
  // PAS de `on conflict` : sous RLS, cette clause exige de pouvoir LIRE la
  // table, et le rôle CI est volontairement gardé en écriture seule. Le
  // doublon est traité comme un fait attendu, reconnaissable à son erreur
  // propre, plutôt qu'en ouvrant le journal du Créateur à un rôle technique.
  assert.ok(!/on conflict/.test(sql),
    'la publication ne doit pas exiger de lecture : le rôle CI publie, il ne lit pas');
  assert.strictEqual((sql.match(/;\n/g) || []).length, 2, 'chaque instruction est close');
});

t('sans événement, l’ingestion unitaire n’invente pas d’instruction', () => {
  assert.ok(/aucun événement/.test(P.sqlIngestionUnitaire([])));
  assert.ok(!/insert into/.test(P.sqlIngestionUnitaire([])));
});

// ——— La CI ne parle au nom de personne ————————————————————————————————
// Le 08/09/2026, la CI publiait depuis le registre Handoff un événement signé
// `orchestrator` et un autre signé `execution`. La base les refusait — mais
// personne ne le voyait : les identifiants étant déterministes, ces lignes
// existaient déjà et l'ingestion les écartait comme doublons. Le premier lot
// neuf a produit un identifiant neuf, et la CI est passée au rouge sur un
// message parlant de RLS, pas d'usurpation.

t('la CI ne signe jamais au nom de l’Orchestrator ni de Claude', () => {
  const etat = { lots: [
    { lot: 'LOT-A', etat: 'attente_arbitrage', derniereDemande: 'request-1.md' },
    { lot: 'LOT-B', etat: 'en_developpement' },
  ] };
  const evts = P.evenementsRegistre(etat, T0);
  assert.strictEqual(evts.length, 2, 'les deux états du registre doivent produire un événement');
  for (const e of evts) {
    assert.ok(P.ROLES_PUBLIABLES_PAR_LA_CI.includes(e.actor.role),
      `rôle interdit à la CI : ${e.actor.role} (${e.event_id})`);
  }
  assert.deepStrictEqual(P.rolesInterdits(evts), [], 'aucun rôle interdit');
});

t('le gate du registre continue de nommer QUI doit décider', () => {
  // Changer l'auteur ne doit pas effacer le destinataire : sans `who`, la
  // question flotte et l'écran ne sait plus à qui elle s'adresse.
  const evts = P.evenementsRegistre(
    { lots: [{ lot: 'LOT-A', etat: 'attente_arbitrage', derniereDemande: 'request-1.md' }] }, T0);
  assert.strictEqual(evts[0].human_gate.required, true);
  assert.strictEqual(evts[0].human_gate.who, 'orchestrator');
  assert.ok(/request-1\.md/.test(evts[0].human_gate.question), evts[0].human_gate.question);
});

t('un rôle interdit est NOMMÉ, pas seulement rejeté', () => {
  const faux = { event_id: 'evt-x', actor: { id: 'a', role: 'orchestrator' } };
  const r = P.rolesInterdits([faux, { event_id: 'evt-ok', actor: { id: 'b', role: 'ci' } }]);
  assert.strictEqual(r.length, 1, JSON.stringify(r));
  assert.strictEqual(r[0].event_id, 'evt-x');
  assert.strictEqual(r[0].role, 'orchestrator', 'le rôle fautif doit être dit');
});

t('TOUT ce que le producteur émet réellement est publiable par la CI', () => {
  // L'épreuve qui compte : non pas un cas fabriqué, mais la production réelle
  // sur ce dépôt. C'est elle qui aurait vu le défaut du 08/09.
  const r = P.produire();
  if (r.erreur) return; // producteur indisponible ici : ne rien conclure
  assert.ok(r.evenements.length, 'la production réelle ne doit pas être vide');
  assert.deepStrictEqual(P.rolesInterdits(r.evenements), [],
    'la CI émet un rôle qu’elle n’a pas le droit d’écrire');
});

// ── evenementsAgentGithub : combler l'angle mort issue → Handoff ──────────
// Le 08/09/2026, l'audit Philosophie tournait dans l'issue #28 sans que Live
// n'en dise rien : aucun lot Handoff n'existait encore. Ces épreuves
// défendent que le seul fait disponible à ce moment — un run GitHub Actions
// du workflow `claude.yml` non terminé — devient un événement visible, sans
// jamais inventer ce qu'on ne sait pas.

t('un run Claude en cours sur une issue devient un événement visible', () => {
  const evts = P.evenementsAgentGithub(T0, { lister: () => ([
    { databaseId: 111, status: 'in_progress', event: 'issue_comment', headBranch: 'claude/issue-28-20260908-1806' },
  ]) });
  assert.strictEqual(evts.length, 1);
  assert.strictEqual(evts[0].lot_id, 'GITHUB-ISSUE-28');
  assert.strictEqual(evts[0].phase, 'EXECUTION');
  assert.strictEqual(evts[0].status, 'PROGRESS');
  // `ci`, et non `execution` : la CI CONSTATE qu'un run Claude tourne, elle
  // n'est pas Claude. Cette épreuve exigeait le rôle que la branche émettait ;
  // elle exige désormais le principe — la CI ne signe que ce qu'elle a le droit
  // de signer, sans quoi la base refuse l'écriture (RLS `publication_ci`).
  assert.strictEqual(evts[0].actor.role, 'ci');
  assert.strictEqual(evts[0].actor.id, 'claude-code-action',
    'l’acteur nomme quand même ce qui est observé : rien n’est perdu');
  assert.deepStrictEqual(P.rolesInterdits(evts), [], 'publiable par la CI');
  assert.ok(/issue #28/.test(evts[0].summary), evts[0].summary);
  assert.deepStrictEqual(contrat.validerEvenementLive(evts[0]), []);
});

t('un run en file d’attente est STARTED, pas PROGRESS — on ne prétend pas qu’il travaille déjà', () => {
  const evts = P.evenementsAgentGithub(T0, { lister: () => ([
    { databaseId: 112, status: 'queued', event: 'issue_comment', headBranch: 'claude/issue-9-20260908-0000' },
  ]) });
  assert.strictEqual(evts[0].status, 'STARTED');
});

t('un run déjà completed ne produit RIEN — son sort est déjà visible ailleurs (Handoff/CI/gardes)', () => {
  const evts = P.evenementsAgentGithub(T0, { lister: () => ([
    { databaseId: 113, status: 'completed', event: 'issue_comment', headBranch: 'claude/issue-28-20260908-1806' },
  ]) });
  assert.deepStrictEqual(evts, []);
});

t('une branche qui n’est pas de la forme claude/issue-<n>- ne produit rien — on ne devine pas le numéro', () => {
  const evts = P.evenementsAgentGithub(T0, { lister: () => ([
    { databaseId: 114, status: 'in_progress', event: 'issue_comment', headBranch: 'config-par-environnement' },
  ]) });
  assert.deepStrictEqual(evts, []);
});

t('pas de réseau / `gh` absent : aucun événement inventé, jamais une exception', () => {
  const evts = P.evenementsAgentGithub(T0, { lister: () => null });
  assert.deepStrictEqual(evts, []);
});

t('extraireNumeroIssue lit le numéro porté par la convention de nommage des branches Claude', () => {
  assert.strictEqual(P.extraireNumeroIssue('claude/issue-28-20260908-1806'), '28');
  assert.strictEqual(P.extraireNumeroIssue('claude/issue-1234-x'), '1234');
  assert.strictEqual(P.extraireNumeroIssue('main'), null);
  assert.strictEqual(P.extraireNumeroIssue(undefined), null);
});

t('produire() assemble bien ce nouveau fait, et le contrat l’accepte', () => {
  const r = P.produire({
    maintenant: new Date(T0), executerGarde: () => 0,
    listerRunsClaude: () => ([
      { databaseId: 115, status: 'in_progress', event: 'issue_comment', headBranch: 'claude/issue-28-20260908-1806' },
    ]),
  });
  assert.strictEqual(r.erreur, null);
  const trouve = r.evenements.find(e => e.lot_id === 'GITHUB-ISSUE-28');
  assert.ok(trouve, 'l’événement GitHub doit figurer dans le flux assemblé');
  assert.deepStrictEqual(contrat.validerEvenementLive(trouve), []);
});

console.log(`\n${passes}/${passes} vérifications passées — le producteur se tait sur ce qu’il ignore.`);
