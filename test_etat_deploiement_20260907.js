// Épreuves de l'état de déploiement (outils/etat-deploiement.js).
//
// Deux enjeux, et le second est le plus important.
//
// D'abord la justesse des trois compteurs : ils seront lus en cinq secondes,
// et un chiffre faux dans un tableau de bord ne se discute pas — il se croit.
//
// Ensuite l'impuissance. Cet outil alimentera un écran portant un bouton
// « Autoriser la mise en Production ». Il doit être incapable, par
// construction, de déployer, de fusionner ou d'autoriser quoi que ce soit.
// L'épreuve de contrat de source ci-dessous existe pour que quiconque
// voudrait lui faire franchir cette ligne doive d'abord la faire sauter.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const OUTIL = path.join(__dirname, 'outils', 'etat-deploiement.js');
const { analyser, classer, fermePar, gestesHumains } = require(OUTIL);

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

function depot({ lots = {}, decisions = {}, stateBrut } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploiement-'));
  fs.mkdirSync(path.join(dir, 'docs', 'handoff', 'lots'), { recursive: true });
  for (const [lot, fichiers] of Object.entries(decisions)) {
    fs.mkdirSync(path.join(dir, 'docs', 'handoff', 'lots', lot), { recursive: true });
    for (const [nom, contenu] of Object.entries(fichiers)) {
      fs.writeFileSync(path.join(dir, 'docs', 'handoff', 'lots', lot, nom), contenu);
    }
  }
  if (stateBrut !== undefined) {
    if (stateBrut !== null) fs.writeFileSync(path.join(dir, 'docs', 'handoff', 'STATE.json'), stateBrut);
  } else {
    fs.writeFileSync(path.join(dir, 'docs', 'handoff', 'STATE.json'),
      JSON.stringify({ protocol: 'nexus-handoff/2', lots }, null, 2));
  }
  return dir;
}

function lancer(dir, args) {
  const r = spawnSync('node', [OUTIL].concat(args || []), {
    encoding: 'utf8', env: { ...process.env, NEXUS_DEPOT: dir },
  });
  return { code: r.status, sortie: (r.stdout || '') + (r.stderr || '') };
}

t('une décision DÉPOSÉE mais non consommée n’attend pas Frédéric', () => {
  // La distinction qui fait la valeur du compteur. Ce lot attend CLAUDE, pas
  // un arbitrage. Les confondre ferait clignoter « en attente de toi » pour du
  // travail qui n'a besoin de personne — et un compteur qui crie à tort finit
  // par ne plus être regardé du tout.
  assert.strictEqual(
    classer({ statut: 'ATTENTE_DECISION', derniere_decision: null }, ['decision-1.md']),
    'en_developpement');
  assert.strictEqual(
    classer({ statut: 'ATTENTE_DECISION', derniere_decision: 'decision-1.md' }, ['decision-1.md']),
    'attente_arbitrage');
  assert.strictEqual(
    classer({ statut: 'ATTENTE_DECISION', derniere_decision: null }, []),
    'attente_arbitrage', 'aucune décision déposée : celui-là attend bien un arbitrage');
});

t('les trois compteurs comptent ce qu’ils annoncent', () => {
  const dir = depot({
    lots: {
      'LOT-A': { statut: 'ATTENTE_DECISION', derniere_demande: 'request-1.md' },
      'LOT-B': { statut: 'DECISION_CONSOMMEE', derniere_decision: 'decision-1.md' },
      'LOT-C': { statut: 'ATTENTE_CONSOMMATION_DECISION' },
    },
  });
  const e = spawnSync('node', [OUTIL, '--json'], { encoding: 'utf8', env: { ...process.env, NEXUS_DEPOT: dir } });
  const r = JSON.parse(e.stdout);
  assert.strictEqual(r.compteurs.attente_arbitrage, 1);
  assert.strictEqual(r.compteurs.en_developpement, 1);
  assert.strictEqual(r.compteurs.clos, 1);
});

t('« ferme le lot » se lit dans la décision, pas dans le statut', () => {
  const dir = depot({
    lots: { 'LOT-A': { statut: 'DECISION_CONSOMMEE', derniere_decision: 'decision-1.md' } },
    decisions: { 'LOT-A': { 'decision-1.md': '---\ncloses: true\n---\n' } },
  });
  const e = JSON.parse(spawnSync('node', [OUTIL, '--json'],
    { encoding: 'utf8', env: { ...process.env, NEXUS_DEPOT: dir } }).stdout);
  assert.strictEqual(e.lots[0].ferme, true);

  const dir2 = depot({
    lots: { 'LOT-A': { statut: 'DECISION_CONSOMMEE', derniere_decision: 'decision-1.md' } },
    decisions: { 'LOT-A': { 'decision-1.md': '---\ncloses: false\n---\n' } },
  });
  const e2 = JSON.parse(spawnSync('node', [OUTIL, '--json'],
    { encoding: 'utf8', env: { ...process.env, NEXUS_DEPOT: dir2 } }).stdout);
  assert.strictEqual(e2.lots[0].ferme, false, 'closes:false ne ferme pas un lot');
});

t('un STATE.json absent échoue au lieu d’afficher « rien en cours »', () => {
  // Le mode de panne d'un tableau de bord : afficher zéro partout et laisser
  // conclure que tout est calme.
  const r = lancer(depot({ stateBrut: null }));
  assert.notStrictEqual(r.code, 0);
  assert.ok(/INDISPONIBLE/.test(r.sortie), r.sortie);
  assert.ok(/Ne rien conclure de cette absence/.test(r.sortie), r.sortie);
});

t('un STATE.json illisible échoue de la même façon', () => {
  const r = lancer(depot({ stateBrut: '{ pas du json' }));
  assert.notStrictEqual(r.code, 0);
  assert.ok(/INDISPONIBLE/.test(r.sortie), r.sortie);
});

t('CONTRAT — l’outil est incapable d’écrire, de fusionner ou de déployer', () => {
  // Il alimentera un écran portant un bouton « Autoriser la mise en
  // Production ». Son impuissance doit être structurelle, pas promise.
  const source = fs.readFileSync(OUTIL, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  const interdits = [
    /['"]push['"]/, /['"]merge['"]/, /['"]-X['"]/, /['"]workflow['"]/,
    /['"]commit['"]/, /['"]checkout['"]/, /writeFileSync/, /appendFileSync/, /rmSync/, /unlinkSync/,
  ];
  const trouves = interdits.filter(re => re.test(source)).map(re => re.source);
  assert.deepStrictEqual(trouves, [],
    'aucun verbe d’écriture ne doit exister dans cet outil : ' + trouves.join(', '));
});

t('sur le dépôt RÉEL, l’absence de barrière est dite, pas tue', () => {
  // Au 07/09/2026 `production` n'a ni protection de branche ni environnement
  // d'approbation. Un état de déploiement qui tairait cela transformerait un
  // tableau de bord en fausse assurance.
  const r = spawnSync('node', [OUTIL], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(/Barrières techniques devant Production/.test(r.stdout), r.stdout);
  assert.ok(/branche `production` protégée/.test(r.stdout), r.stdout);
  assert.ok(/PROPOSITION/.test(r.stdout),
    '« prêt pour Production » ne doit jamais se lire comme une autorisation');
  if (/protégée : NON/.test(r.stdout)) {
    assert.ok(/un simple `git push` atteint Production/.test(r.stdout),
      'quand la barrière manque, il faut le dire en clair : ' + r.stdout);
  }
});


// ── Les gestes qui n'appartiennent qu'à Frédéric ────────────────────────
// Ce jugement est le seul de l'outil qui décide s'il faut déranger un humain.
// Il n'avait aucune épreuve jusqu'au 08/09/2026, faute d'être injectable — et
// c'est précisément lui qui s'est trompé : il a continué de réclamer une
// rotation déjà accomplie, parce qu'il surveillait le nom du secret partagé
// plutôt que ce que la recette exige réellement.
//
// Un rappel qui a tort une fois cesse d'être lu, et emporte avec lui ceux qui
// ont raison. C'est pour cela que ces épreuves existent.

const AVANT = '2026-09-06T00:00:00Z';   // antérieur à la divulgation du 07/09
const APRES = '2026-09-08T02:10:00Z';   // postérieur
const geste = (g, code) => g.find(x => x.code === code);

t('des PIN créés après la divulgation ferment le geste, même sans rotation de l’ancien', () => {
  // Le cas réel du 08/09 : Frédéric n'a pas fait tourner NEXUS_TEST_PIN, il a
  // donné à chaque profil le sien. Le geste est fait — autrement, et mieux.
  const g = gestesHumains({ lireSecrets: () => [
    { name: 'SUPABASE_TEST_DB_URL_WRITE', updatedAt: APRES },
    { name: 'NEXUS_TEST_MANAGER_PIN', updatedAt: APRES },
    { name: 'NEXUS_TEST_CREATEUR_PIN', updatedAt: APRES },
  ] });
  assert.strictEqual(geste(g, 'PIN_RECETTE').fait, true, JSON.stringify(g));
});

t('un seul PIN antérieur à la divulgation rouvre le geste, et il est NOMMÉ', () => {
  // « Un des PIN est vieux » ne se traite pas : il faut savoir lequel ouvrir.
  const g = gestesHumains({ lireSecrets: () => [
    { name: 'NEXUS_TEST_MANAGER_PIN', updatedAt: APRES },
    { name: 'NEXUS_TEST_CREATEUR_PIN', updatedAt: AVANT },
  ] });
  const p = geste(g, 'PIN_RECETTE');
  assert.strictEqual(p.fait, false);
  assert.ok(/NEXUS_TEST_CREATEUR_PIN/.test(p.texte), p.texte);
  assert.ok(!/NEXUS_TEST_MANAGER_PIN/.test(p.texte),
    'ne pas accuser le secret qui est en règle : ' + p.texte);
});

t('un PIN exigé par la recette mais absent des secrets rouvre le geste', () => {
  const g = gestesHumains({ lireSecrets: () => [{ name: 'NEXUS_TEST_MANAGER_PIN', updatedAt: APRES }] });
  const p = geste(g, 'PIN_RECETTE');
  assert.strictEqual(p.fait, false);
  assert.ok(/NEXUS_TEST_CREATEUR_PIN/.test(p.texte), p.texte);
});

t('le secret partagé résiduel est signalé tant qu’il existe, puis se tait', () => {
  // Il n'a plus d'usage actif, mais il porte encore la valeur divulguée et
  // reste injectable dans n'importe quel workflow. Le supprimer est un geste
  // sur un secret : il n'appartient qu'à Frédéric.
  const avec = gestesHumains({ lireSecrets: () => [
    { name: 'NEXUS_TEST_MANAGER_PIN', updatedAt: APRES },
    { name: 'NEXUS_TEST_CREATEUR_PIN', updatedAt: APRES },
    { name: 'NEXUS_TEST_PIN', updatedAt: AVANT },
  ] });
  assert.strictEqual(geste(avec, 'PIN_PARTAGE_RESIDUEL').fait, false);
  const sans = gestesHumains({ lireSecrets: () => [
    { name: 'NEXUS_TEST_MANAGER_PIN', updatedAt: APRES },
    { name: 'NEXUS_TEST_CREATEUR_PIN', updatedAt: APRES },
  ] });
  assert.strictEqual(geste(sans, 'PIN_PARTAGE_RESIDUEL').fait, true);
});

t('des secrets illisibles ne concluent RIEN — surtout pas que les gestes sont faits', () => {
  // Le mode de défaillance qui compte : ne pas savoir doit se lire « je ne
  // sais pas », jamais « tout va bien ».
  const g = gestesHumains({ lireSecrets: () => { throw new Error('gh absent'); } });
  assert.strictEqual(g.length, 1);
  assert.strictEqual(g[0].code, 'SECRETS_ILLISIBLES');
  assert.strictEqual(g[0].fait, null);
});

t('un PIN daté de l’instant EXACT de la divulgation reste périmé', () => {
  // Survivante de mutation : `<=` remplacé par `<` passait toutes les épreuves,
  // parce qu'aucune ne posait de date sur la borne. Un secret enregistré à la
  // seconde même de la divulgation n'est pas un secret renouvelé — dans le
  // doute, on redemande le geste plutôt que de le déclarer fait.
  const BORNE = '2026-09-07T12:00:00Z';   // = PIN_DIVULGUE_LE
  const g = gestesHumains({ lireSecrets: () => [
    { name: 'NEXUS_TEST_MANAGER_PIN', updatedAt: BORNE },
    { name: 'NEXUS_TEST_CREATEUR_PIN', updatedAt: APRES },
  ] });
  const p = geste(g, 'PIN_RECETTE');
  assert.strictEqual(p.fait, false, 'la borne elle-même ne vaut pas renouvellement');
  assert.ok(/NEXUS_TEST_MANAGER_PIN/.test(p.texte), p.texte);
});

t('une recette qui n’exige plus aucun PIN ne conclut RIEN', () => {
  // Survivante de mutation : sans ce cas, supprimer la garde `length === 0`
  // faisait répondre « geste fait » à une recette qui ne surveille plus rien.
  // Un tableau vide satisfait trivialement « aucun périmé » — c'est la forme
  // la plus discrète du faux vert.
  const g = gestesHumains({ secretsRequis: ['NEXUS_TEST_URL'], lireSecrets: () => [] });
  const p = geste(g, 'PIN_RECETTE');
  assert.strictEqual(p.fait, null, 'ne pas conclure : ' + JSON.stringify(p));
  assert.ok(/ne rien conclure/i.test(p.texte), p.texte);
});

t('les PIN surveillés sont ceux de la recette, jamais une seconde liste', () => {
  // Contrat de source. Une liste recopiée ici diverge le jour où la recette
  // gagne un profil — et le contrôle se tairait sur le seul PIN nouveau.
  const source = fs.readFileSync(OUTIL, 'utf8');
  // Le défaut par DÉFAUT doit être la recette. L'injection n'existe que pour
  // les épreuves ; si elle devenait la source ordinaire, ce contrôle
  // surveillerait ce qu'on lui dit de surveiller, ce qui ne prouve rien.
  assert.ok(/\(options\.secretsRequis \|\| SECRETS_REQUIS\)\.filter/.test(source),
    'les PIN doivent être dérivés de SECRETS_REQUIS de la recette, l’injection n’étant qu’un repli');
  const { SECRETS_REQUIS } = require(path.join(__dirname, 'outils', 'recette-navigateur-test.js'));
  const g = gestesHumains({ lireSecrets: () => SECRETS_REQUIS
    .filter(n => /_PIN$/.test(n)).map(n => ({ name: n, updatedAt: APRES })) });
  assert.strictEqual(geste(g, 'PIN_RECETTE').fait, true,
    'satisfaire exactement ce que la recette exige doit suffire');
});


console.log(`\n${passes}/${passes} vérifications passées — l’état se calcule, il ne s’autorise pas.`);
