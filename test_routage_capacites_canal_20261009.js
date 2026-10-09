// Routage par capacité — une décision juste ne suffit pas, il faut un exécutant.
//
// L'INCIDENT QUE CECI MESURE. Le 09/10/2026, le GO Production G1 était donné.
// Il est revenu par un commentaire d'issue portant `@claude`, donc dans
// `.github/workflows/claude.yml` — le seul canal dont l'enveloppe Supabase est
// Test en lecture seule, et qui ne peut même pas lire un run. Claude s'est
// arrêté sans rien écrire, ce qui était correct, puis a dû publier
// `request-2.md` pour dire pourquoi. Quatre preuves y sont NOT_APPLICABLE, et
// ce sont de vraies mesures : « aucune connexion Supabase depuis ce canal par
// construction », « printenv refusé par le bac à sable, aucune valeur lue ».
// Le contrat, lui, ne nommait qu'un RÔLE (`OWNER_NEXT: Frédéric`). Un rôle dit
// qui tranche. Il ne dit jamais qui PEUT.
//
// Cette épreuve tient huit propriétés, chacune par une mutation qui mord :
//   A. le registre des capacités est sain sur le VRAI dépôt — calibration
//      d'abord : une garde qui rend des faux positifs se fait débrancher, et
//      emporte avec elle les vrais écarts qu'elle aurait trouvés ensuite ;
//   B. le cas exact de l'incident route vers un exécutant réellement capable ;
//   C. les cas d'échec rendent chacun un motif distinct, jamais un silence ;
//   D. sans capacité exigée, la classification d'avant est inchangée ;
//   E. l'enveloppe de `claude.yml` est gardée — un secret ou une permission
//      ajoutés au workflow automatique rendent l'épreuve rouge ;
//   F. un pouvoir sensible déclaré `OUI` exige une preuve nommée ;
//   G. le palier Frédéric passe AVANT la capacité ;
//   H. chaque geste du registre mène à une capacité connue et à un exécutant.
'use strict';
const fs = require('fs');
const assert = require('assert');

const RACINE = __dirname;
const cap = require('./outils/capacites-canal.js');
const { classifier, classifierCapacite } = require('./outils/classification-canal.js');

let reussites = 0;
const echecs = [];
function epreuve(nom, f) {
  try { f(); reussites += 1; console.log(`  ✅ ${nom}`); }
  catch (e) { echecs.push({ nom, e }); console.log(`  ❌ ${nom}\n     ${e && e.stack || e}`); }
}

const registre = () => cap.chargerRegistre(RACINE);
const clone = o => JSON.parse(JSON.stringify(o));

// Le canal de l'incident, le pouvoir qu'il n'a pas, et le geste qui l'exige.
const INCAPABLE = 'github-actions-claude';
const HABILITE = 'session-claude-habilitee';
const POUVOIR = 'SUPABASE_PRODUCTION_ECRITURE';
const WORKFLOW = '.github/workflows/claude.yml';

// Mute le TEXTE que le registre prétend vérifier, sans toucher au dépôt :
// `verifierRegistre` reçoit son lecteur par injection, précisément pour que
// l'épreuve puisse mentir au validateur et voir s'il s'en aperçoit.
function lecteurMute(avant, apres) {
  const vrai = cap.lireAuRef(RACINE, 'origin/main', WORKFLOW);
  assert.ok(vrai, `${WORKFLOW} illisible sur origin/main — l'épreuve ne peut rien mesurer`);
  if (avant === null) return () => null;
  assert.strictEqual(vrai.split(avant).length - 1, 1, `ancre de mutation non unique ou absente dans ${WORKFLOW}`);
  const muté = vrai.replace(avant, apres);
  assert.notStrictEqual(muté, vrai, 'mutation sans effet');
  return () => muté;
}

// ── A. CALIBRATION SUR LE VRAI DÉPÔT ────────────────────────────────────────

epreuve('A — le registre des capacités est sain sur le dépôt réel', () => {
  const ecarts = cap.verifierRegistre(registre(), RACINE);
  assert.deepStrictEqual(ecarts, [], 'écarts sur le vrai dépôt :\n' + ecarts.join('\n'));
});

epreuve('A — tout canal tranche toute capacité, et seulement par OUI ou NON', () => {
  const r = registre();
  for (const canal of cap.canauxConnus(r)) {
    for (const c of cap.capacitesConnues(r)) {
      assert.ok(cap.VALEURS.includes(cap.capacite(r, canal, c)),
        `${canal} ne tranche pas ${c}`);
    }
  }
});

epreuve('A — mutation : une capacité non tranchée est détectée', () => {
  const r = clone(registre());
  delete r.canaux[INCAPABLE].capacites[POUVOIR];
  const ecarts = cap.verifierRegistre(r, RACINE);
  assert.ok(ecarts.some(x => x.includes(POUVOIR)), 'une capacité absente passe inaperçue');
});

// ── B. LE CAS DE L'INCIDENT ─────────────────────────────────────────────────

epreuve('B — le canal de l’incident n’a pas le pouvoir, et le registre le dit', () => {
  assert.strictEqual(cap.capacite(registre(), INCAPABLE, POUVOIR), 'NON');
});

epreuve('B — le geste part vers un exécutant réellement capable', () => {
  const r = registre();
  const v = classifierCapacite({ capaciteRequise: POUVOIR, canalCible: INCAPABLE, registreCapacites: r });
  assert.strictEqual(v.etat, 'CHANNEL_LIMITATION');
  assert.strictEqual(v.motif, 'CAPACITE_CANAL_INSUFFISANTE');
  assert.ok(v.detail.executants.length, 'aucun exécutant nommé : le geste serait orphelin');
  assert.ok(v.detail.executants.includes(HABILITE));
  // Nommer un exécutant qui ne peut pas serait pire que n'en nommer aucun.
  for (const e of v.detail.executants) assert.ok(cap.capable(r, e, POUVOIR), `${e} nommé sans détenir ${POUVOIR}`);
});

epreuve('B — un CHANNEL_LIMITATION n’est pas un BLOCKED_TECHNIQUE', () => {
  const v = classifierCapacite({ capaciteRequise: POUVOIR, canalCible: INCAPABLE, registreCapacites: registre() });
  assert.notStrictEqual(v.etat, 'BLOCKED_TECHNIQUE',
    'classer la limitation en panne ferait reposer une question déjà tranchée');
});

epreuve('B — le canal habilité, lui, laisse passer le geste', () => {
  assert.strictEqual(
    classifierCapacite({ capaciteRequise: POUVOIR, canalCible: HABILITE, registreCapacites: registre() }),
    null, 'un canal capable ne doit pas être arrêté');
});

epreuve('B — la promotion Production ne connaît qu’un exécutant : Frédéric', () => {
  const r = registre();
  assert.deepStrictEqual(cap.canauxCapables(r, 'PRODUCTION_FUSION_DEPLOIEMENT'), ['frederic'],
    'une gate humaine ne se délègue pas par registre');
});

epreuve('B — mutation : un canal rendu capable change l’exécutant désigné', () => {
  const r = clone(registre());
  r.canaux[INCAPABLE].capacites[POUVOIR] = 'OUI';
  assert.strictEqual(
    classifierCapacite({ capaciteRequise: POUVOIR, canalCible: INCAPABLE, registreCapacites: r }),
    null, 'le routage ne lit pas réellement le registre');
});

// ── C. LES CAS D'ÉCHEC ──────────────────────────────────────────────────────

epreuve('C — une capacité inconnue est une panne, pas un relais', () => {
  const v = classifierCapacite({ capaciteRequise: 'POUVOIR_IMAGINAIRE', canalCible: INCAPABLE, registreCapacites: registre() });
  assert.strictEqual(v.etat, 'BLOCKED_TECHNIQUE');
  assert.strictEqual(v.motif, 'CAPACITE_INCONNUE');
});

epreuve('C — sans canal cible, on ne devine pas', () => {
  const v = classifierCapacite({ capaciteRequise: POUVOIR, registreCapacites: registre() });
  assert.strictEqual(v.motif, 'CANAL_CIBLE_NON_DESIGNE');
});

epreuve('C — un canal hors registre est nommé comme tel', () => {
  const v = classifierCapacite({ capaciteRequise: POUVOIR, canalCible: 'canal-fantome', registreCapacites: registre() });
  assert.strictEqual(v.motif, 'CANAL_CIBLE_HORS_REGISTRE');
  assert.strictEqual(v.detail, 'canal-fantome');
});

epreuve('C — un pouvoir que personne ne détient est une panne nommée', () => {
  const r = clone(registre());
  for (const c of Object.keys(r.canaux)) r.canaux[c].capacites[POUVOIR] = 'NON';
  const v = classifierCapacite({ capaciteRequise: POUVOIR, canalCible: INCAPABLE, registreCapacites: r });
  assert.strictEqual(v.motif, 'CAPACITE_SANS_EXECUTANT');
});

epreuve('C — registre absent : invérifiable se dit, ne se suppose pas', () => {
  const v = classifierCapacite({ capaciteRequise: POUVOIR, canalCible: INCAPABLE });
  assert.strictEqual(v.motif, 'CAPACITES_INVERIFIABLES');
});

// ── D. RÉTRO-COMPATIBILITÉ ──────────────────────────────────────────────────

epreuve('D — sans capacité exigée, la classification d’avant est inchangée', () => {
  const sans = classifier({ role: 'Claude', motifStop: null });
  const avec = classifier({ role: 'Claude', motifStop: null, registreCapacites: registre() });
  assert.deepStrictEqual(avec, sans, 'la quatrième question parle quand on ne l’interroge pas');
});

// ── E. L'ENVELOPPE DU WORKFLOW AUTOMATIQUE ──────────────────────────────────

epreuve('E — mutation : un secret ajouté au workflow automatique est détecté', () => {
  const lire = lecteurMute('${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}',
    '${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}${{ secrets.SUPABASE_PRODUCTION_SERVICE_ROLE }}');
  const ecarts = cap.verifierRegistre(registre(), RACINE, { lire });
  assert.ok(ecarts.some(x => x.includes('SUPABASE_PRODUCTION_SERVICE_ROLE')),
    'un secret Production pourrait entrer dans le canal automatique sans un mot');
});

epreuve('E — mutation : une permission ajoutée au workflow automatique est détectée', () => {
  const lire = lecteurMute('      issues: write', '      issues: write\n      deployments: write');
  const ecarts = cap.verifierRegistre(registre(), RACINE, { lire });
  assert.ok(ecarts.some(x => x.includes('deployments: write')),
    'une permission élargie passerait inaperçue');
});

epreuve('E — mutation : un workflow illisible est un échec, pas une tolérance', () => {
  const ecarts = cap.verifierRegistre(registre(), RACINE, { lire: lecteurMute(null) });
  assert.ok(ecarts.some(x => /illisible|invérifiable/.test(x)),
    'une enseigne invérifiable serait prise pour une enseigne vérifiée');
});

epreuve('E — le workflow automatique ne référence aucun secret Production', () => {
  const texte = cap.lireAuRef(RACINE, 'origin/main', WORKFLOW);
  assert.ok(texte, `${WORKFLOW} illisible sur origin/main`);
  const trouves = cap.secretsReferences(texte);
  const attendus = registre().canaux[INCAPABLE].preuves[POUVOIR].secrets_autorises;
  assert.deepStrictEqual(trouves, attendus.slice().sort());
});

// ── F. LA CHARGE DE PREUVE ──────────────────────────────────────────────────

epreuve('F — mutation : un pouvoir sensible OUI sans preuve nommée est détecté', () => {
  const r = clone(registre());
  r.canaux[INCAPABLE].capacites[POUVOIR] = 'OUI';
  delete r.canaux[INCAPABLE].preuves[POUVOIR];
  const ecarts = cap.verifierRegistre(r, RACINE);
  assert.ok(ecarts.some(x => x.includes(POUVOIR) && /preuve/.test(x)),
    'un pouvoir sensible se prouve nommément — l’enveloppe par défaut ne le couvre pas');
});

epreuve('F — une preuve EXERCEE nomme sa commande et sa date', () => {
  const r = registre();
  let vues = 0;
  for (const canal of Object.values(r.canaux)) {
    for (const p of Object.values(canal.preuves || {})) {
      if (p.type !== 'EXERCEE') continue;
      vues += 1;
      assert.ok(p.commande, 'une preuve exercée sans commande est une opinion');
      assert.ok(!Number.isNaN(Date.parse(p.date)), 'date illisible : ' + p.date);
      assert.ok(p.source, 'une preuve exercée dit où elle est consignée');
    }
  }
  assert.ok(vues >= 2, `seules ${vues} preuves exercées : la capacité reste déclarative`);
});

// ── G. L'ORDRE DES QUESTIONS ────────────────────────────────────────────────

epreuve('G — le palier Frédéric passe avant la capacité', () => {
  const v = classifier({
    role: 'Claude', motifStop: 'SUPABASE_PRODUCTION_MUTATION',
    capaciteRequise: POUVOIR, canalCible: INCAPABLE, registreCapacites: registre(),
  });
  assert.notStrictEqual(v.etat, 'CHANNEL_LIMITATION',
    'nommer un exécutant avant l’autorisation serait mandater un geste non autorisé');
});

// ── H. LES GESTES ───────────────────────────────────────────────────────────

epreuve('H — chaque geste mène à une capacité connue et à un exécutant', () => {
  const r = registre();
  const gestes = Object.keys(r.gestes || {}).filter(k => !k.startsWith('_'));
  assert.ok(gestes.length, 'aucun geste cartographié : rien ne relie un STOP à un pouvoir');
  for (const g of gestes) {
    const c = cap.capaciteDuGeste(r, g);
    assert.ok(cap.capacitesConnues(r).includes(c), `${g} mène à une capacité inconnue : ${c}`);
    assert.ok(cap.canauxCapables(r, c).length, `${g} exige ${c}, que personne ne détient`);
  }
});

epreuve('H — le geste du GO G1 est bien celui que le canal automatique n’a pas', () => {
  const r = registre();
  const c = cap.capaciteDuGeste(r, 'SUPABASE_PRODUCTION_MUTATION');
  assert.strictEqual(c, POUVOIR);
  assert.ok(!cap.capable(r, INCAPABLE, c));
});

console.log(`\nRoutage par capacité — ${reussites} épreuve(s) passée(s), ${echecs.length} échec(s).`);
if (echecs.length) process.exit(1);
