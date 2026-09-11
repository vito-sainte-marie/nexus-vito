// Épreuves de la garde LANG-003 (outils/garde-langage-nexus.js).
//
// Ce que ces épreuves défendent : une garde de langage échoue de deux façons
// symétriques. Elle échoue en accusant du commentaire de développement — et on
// la désactive dans la semaine. Elle échoue en laissant passer une phrase
// réellement affichée — et elle ne sert à rien. La portée arbitrée par
// Frédéric le 08/09/2026 (portée 1 : ce que NEXUS DIT) trace exactement cette
// frontière, et c'est elle qui est éprouvée ici.
'use strict';
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const G = require(path.join(__dirname, 'outils', 'garde-langage-nexus.js'));

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

// ── Ce qui est DANS la portée, et ce qui n'y est pas ──────────────────

t('une phrase affichée avec un tiret cadratin est comptée', () => {
  assert.strictEqual(G.mesurerFichier(`const m = 'Écart validé — aucune action nécessaire.';`), 1);
});

t('un commentaire JS n’est PAS compté — il n’est lu par aucun utilisateur', () => {
  assert.strictEqual(G.mesurerFichier(`// Ceci est un commentaire — et il reste permis.\nconst x = 1;`), 0);
  assert.strictEqual(G.mesurerFichier(`/* bloc — encore un commentaire */\nconst x = 1;`), 0);
});

t('un commentaire HTML n’est PAS compté', () => {
  // La première version de cette mesure ne retirait que les commentaires JS.
  // Elle comptait 1 485 occurrences ; deux cents vivaient dans les grands
  // en-têtes HTML des écrans, que personne n'affiche jamais.
  assert.strictEqual(G.mesurerFichier(`<!-- Historique de l'écran — refonte du 14/08 -->\n<div>ok</div>`), 0);
});

t('un « // » dans une chaîne n’est pas un commentaire', () => {
  // Sinon la moitié d'un fichier disparaîtrait à la première URL rencontrée.
  assert.strictEqual(G.mesurerFichier(`const u = 'https://x.test/a'; const m = 'Stock bas — à contrôler.';`), 1);
});

t('le tiret SEUL, marqueur de valeur absente, est compté lui aussi', () => {
  // Frédéric, 08/09/2026 : « un tiret ne dit pas s'il n'y a rien, ou si
  // personne n'a regardé ». Il est affiché, donc il est dans la portée.
  assert.strictEqual(G.mesurerFichier(`const v = x || '—';`), 1);
});

t('seuls les écrans et les moteurs sont en portée', () => {
  assert.ok(G.EN_PORTEE.test('NEXUS-Brief-v1.html'));
  assert.ok(G.EN_PORTEE.test('nexus-carburant-moteur.js'));
  // Hors portée par décision : doctrine, gouvernance, Handoff, outillage.
  assert.ok(!G.EN_PORTEE.test('BIBLE.md'));
  assert.ok(!G.EN_PORTEE.test('garde-langage-nexus.js'));
  assert.ok(!G.EN_PORTEE.test('test_garde_langage_nexus_20260908.js'));
});

// ── Le cliquet ────────────────────────────────────────────────────────

const PLAFONDS = { plafonds: { 'NEXUS-A-v1.html': 3, 'nexus-b.js': 1 } };

t('à mesure égale, la garde est silencieuse', () => {
  const r = G.controler({ compte: { 'NEXUS-A-v1.html': 3, 'nexus-b.js': 1 }, plafonds: PLAFONDS });
  assert.deepStrictEqual(r.ecarts, []);
  assert.strictEqual(r.total, 4);
});

t('un tiret AJOUTÉ est une régression, et le fichier est nommé', () => {
  const r = G.controler({ compte: { 'NEXUS-A-v1.html': 4, 'nexus-b.js': 1 }, plafonds: PLAFONDS });
  assert.strictEqual(r.ecarts.length, 1, JSON.stringify(r.ecarts));
  assert.strictEqual(r.ecarts[0].type, 'AJOUT');
  assert.strictEqual(r.ecarts[0].fichier, 'NEXUS-A-v1.html');
  assert.strictEqual(r.ecarts[0].delta, 1);
});

t('un fichier NEUF n’a droit à aucun tiret', () => {
  // Le plafond est une dette constatée, pas un budget distribué à qui arrive.
  const r = G.controler({ compte: { 'NEXUS-A-v1.html': 3, 'nexus-b.js': 1, 'NEXUS-Neuf-v1.html': 1 },
    plafonds: PLAFONDS });
  assert.strictEqual(r.ecarts.length, 1);
  assert.strictEqual(r.ecarts[0].fichier, 'NEXUS-Neuf-v1.html');
  assert.strictEqual(r.ecarts[0].plafond, 0, 'un fichier inconnu part de zéro');
});

t('un progrès fait ÉCHOUER la garde, et c’est voulu', () => {
  // Un plafond laissé au-dessus de la mesure autorise silencieusement à
  // réintroduire des tirets jusqu'à l'ancien niveau : le compteur dirait
  // « conforme » pendant que la situation se dégrade.
  const r = G.controler({ compte: { 'NEXUS-A-v1.html': 1, 'nexus-b.js': 1 }, plafonds: PLAFONDS });
  assert.strictEqual(r.ecarts.length, 1);
  assert.strictEqual(r.ecarts[0].type, 'PLAFOND_PERIME');
  assert.strictEqual(r.ecarts[0].delta, 2, 'le progrès est chiffré, pas seulement signalé');
});

t('AJOUT et PLAFOND_PÉRIMÉ ne sont pas le même écart', () => {
  // Les confondre laisserait croire qu'on a commis une faute en corrigeant
  // une phrase — et découragerait exactement ce que la règle cherche.
  const r = G.controler({ compte: { 'NEXUS-A-v1.html': 5, 'nexus-b.js': 0 }, plafonds: PLAFONDS });
  const types = r.ecarts.map(e => e.type).sort();
  assert.deepStrictEqual(types, ['AJOUT', 'PLAFOND_PERIME']);
});

t('sans plafonds, la garde se tait au lieu de conclure', () => {
  const r = G.controler({ compte: { 'x.html': 1 }, plafonds: null, cheminPlafonds: '/introuvable.json' });
  assert.ok(r.indisponible, 'ne pas savoir n’est pas « conforme »');
  assert.strictEqual(r.ecarts, undefined);
});

// ── Sur le dépôt réel ─────────────────────────────────────────────────

t('CALIBRAGE — sur ce dépôt, la garde est conforme et ne crie pas', () => {
  // QA-002 : une garde se mesure sur le dépôt réel avant d'être câblée. Celle
  // qui hurle au premier run est désactivée dans la semaine, et emporte ses
  // vraies trouvailles avec elle.
  const r = G.controler();
  assert.strictEqual(r.indisponible, null, 'les plafonds doivent être lisibles');
  assert.deepStrictEqual(r.ecarts, [],
    'écarts sur le dépôt : ' + JSON.stringify(r.ecarts && r.ecarts.slice(0, 5)));
  assert.ok(r.total > 0, 'un total nul signifierait que la mesure ne mesure rien');
});

t('CALIBRAGE — la garde DÉTECTE un tiret ajouté à un VRAI écran', () => {
  // Une garde conforme qui ne peut pas échouer ne prouve rien (QA-004). On
  // mesure donc un écran réel, puis le même écran augmenté d'une phrase telle
  // qu'on l'écrirait vraiment — sans jamais toucher au fichier sur disque.
  const cible = 'NEXUS-Live-Developpement-v1.html';
  const source = fs.readFileSync(path.join(__dirname, cible), 'utf8');
  const avant = G.mesurerFichier(source);
  const augmente = source + "\nconst phrase = 'Commande transmise — en attente de confirmation.';\n";
  assert.strictEqual(G.mesurerFichier(augmente), avant + 1,
    'une phrase affichée de plus doit être vue, exactement une fois');

  // Et la même phrase mise en COMMENTAIRE ne doit rien changer.
  const commentee = source + "\n// Commande transmise — en attente de confirmation.\n";
  assert.strictEqual(G.mesurerFichier(commentee), avant,
    'un commentaire ne s’affiche pas : il ne doit pas être accusé');

  const r = G.controler({ compte: Object.assign(G.mesurer(), { [cible]: avant + 1 }) });
  assert.ok(r.ecarts.some(e => e.type === 'AJOUT' && e.fichier === cible),
    'et le cliquet doit le refuser : ' + JSON.stringify(r.ecarts));
});

console.log(`\n${n}/${n} vérifications passées — LANG-003 vise ce que NEXUS dit, pas ce qu’il contient.`);
