// Les deux principes ajoutés à la Bible le 08/09/2026 sont-ils TENUS ?
//
// Frédéric a fait ajouter deux lignes à la section « Philosophie » sur
// proposition de l'audit du même jour. Une ligne de doctrine que rien ne
// mécanise n'est pas une règle : c'est une décoration, et elle se met à mentir
// le jour où le code s'en écarte sans que personne ne le voie.
//
// Ces épreuves ne jugent donc pas la BEAUTÉ des phrases. Elles vérifient deux
// choses : que la Bible les porte réellement, et que chacune a un mécanisme
// vivant derrière elle. Si l'un des deux disparaît, la ligne devient un vœu et
// cette épreuve le dit.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const BIBLE = path.join(__dirname, 'docs', 'nexus', 'BIBLE.md');
const WORKFLOW = path.join(__dirname, '.github', 'workflows', 'tests.yml');
const mesure = require(path.join(__dirname, 'nexus-mesure.js'));

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

const ABSENCE = "Une donnée absente n'est jamais transformée en zéro, conformité ou conclusion positive ; une donnée réellement mesurée à zéro reste dite comme telle.";
const JUGEMENT = "Une décision humaine sensible envers un individu (évaluation, sanction, jugement de performance) n'est jamais déduite automatiquement d'une absence de donnée.";

t('la Bible porte les deux principes, dans sa section Philosophie', () => {
  const src = fs.readFileSync(BIBLE, 'utf8');
  const philo = src.slice(src.indexOf('## Philosophie'), src.indexOf('## Architecture'));
  assert.ok(philo.includes(ABSENCE), 'principe « absence ≠ zéro » absent de la Philosophie');
  assert.ok(philo.includes(JUGEMENT), 'principe « pas de jugement déduit d’une absence » absent');
});

t('MÉCANISME — « absente » et « nulle » ne sont pas la même chose', () => {
  // `nexus-mesure.js` est le propriétaire unique de cette distinction. Sans
  // lui, la ligne de Bible ne serait tenue par rien.
  assert.strictEqual(mesure.estAbsente(undefined), true);
  assert.strictEqual(mesure.estAbsente(null), true);
  assert.strictEqual(mesure.estAbsente(''), true, 'une saisie vide est une absence');
  assert.strictEqual(mesure.estAbsente([]), true,
    'le tableau vide était la porte dérobée : Number([]) vaut 0');
  assert.strictEqual(mesure.estAbsente(0), false, 'un zéro MESURÉ reste un zéro');
  assert.strictEqual(mesure.estAbsente('0'), false);

  assert.strictEqual(mesure.valeurMesuree(undefined), null, 'une absence ne devient pas 0');
  assert.strictEqual(mesure.valeurMesuree(0), 0, 'et un zéro mesuré ne devient pas une absence');
});

t('MÉCANISME — un repli silencieux vers zéro reste surveillé en CI', () => {
  // `guardian-bible.js` cherche les `|| 0` sur des montants affichés. Il est
  // consultatif : ce qui compte ici est qu'il TOURNE, pas qu'il soit vert.
  // Le jour où il sort du workflow, la première ligne n'est plus tenue par
  // rien d'automatique — et personne ne s'en apercevrait.
  const wf = fs.readFileSync(WORKFLOW, 'utf8');
  assert.ok(/node outils\/guardian-bible\.js/.test(wf),
    'le Guardian Bible doit rester exécuté par la CI');
  assert.ok(fs.existsSync(path.join(__dirname, 'outils', 'guardian-bible.js')));
});

t('MÉCANISME — aucune évaluation d’une personne n’est déduite d’une absence', () => {
  // Le second principe protège quelqu'un, pas un chiffre. Son mécanisme est
  // `nexus-evaluation-affichage.js` (EVAL-001) : sans mesure, il REFUSE de
  // rendre un verdict plutôt que d'en rendre un mauvais. Constater que le
  // module existe ne prouverait rien — c'est son comportement qui tient la
  // ligne de Bible.
  const ev = require(path.join(__dirname, 'nexus-evaluation-affichage.js'));

  // Une évaluation sans note ne devient pas un zéro sur cinq.
  assert.strictEqual(ev.libelleScore({ kind: 'Évaluation Renfort', total: null }), ev.NON_EVALUE);
  assert.strictEqual(ev.libelleScore({ kind: 'Contrôle tenue', points: undefined }), ev.NON_EVALUE);
  assert.strictEqual(ev.libelleScore({ kind: 'Contrôle tenue', points: '' }), ev.NON_EVALUE);
  assert.strictEqual(ev.estNonEvalue({ kind: 'Contrôle tenue' }), true);

  // Un type inconnu ne produit pas davantage un verdict fabriqué.
  assert.strictEqual(ev.libelleScore({ kind: 'Type jamais vu' }), ev.NON_EVALUE);
  assert.strictEqual(ev.libelleScore(null), ev.NON_EVALUE, 'aucun événement : aucun jugement');

  // Mais un ZÉRO RÉELLEMENT MESURÉ reste dit — c'est la seconde moitié de la
  // ligne de Bible, et l'oublier serait taire une vraie mauvaise note.
  assert.strictEqual(ev.libelleScore({ kind: 'Contrôle tenue', points: 0 }), '0 pts');
  assert.strictEqual(ev.estNonEvalue({ kind: 'Contrôle tenue', points: 0 }), false);
  assert.strictEqual(ev.libelleScore({ kind: 'Évaluation Renfort', total: 0 }), '0.0 / 5');
});

// ── La note de révision de la Constitution (08/09/2026) ──────────────
// Même exigence : une note qui déclare deux articles partiellement historiques
// affirme trois choses. Que la scission a bien eu lieu ailleurs, que la note
// existe, et que la dette qu'elle annonce est réellement suivie. Une note qui
// renvoie à un Backlog où rien n'est inscrit est un classement sans suite.

const CONSTITUTION = path.join(__dirname, 'NEXUS-Constitution-v1.md');
const BACKLOG = path.join(__dirname, 'docs', 'nexus', 'BACKLOG.md');

t('la Constitution marque les articles 12 et 13 comme partiellement historiques', () => {
  const src = fs.readFileSync(CONSTITUTION, 'utf8');
  const i = src.indexOf('## Note de révision (08/09/2026)');
  assert.ok(i > 0, 'la note de révision du 08/09/2026 doit exister');
  const note = src.slice(i);
  assert.ok(/Articles 12 et 13/.test(note), 'elle doit nommer les articles visés');
  assert.ok(/Directeur d’Exploitation|Directeur d'Exploitation/.test(note));
  assert.ok(/Coach Terrain/.test(note));

  // Les articles eux-mêmes ne sont PAS réécrits : réécrire un texte fondateur
  // pour le faire coïncider avec le présent efface la trace de la décision qui
  // a changé les choses.
  // Chaque article est vérifié SÉPARÉMENT. Les balayer ensemble laissait passer
  // la réécriture de l'un, masquée par l'autre : la mutation survivait.
  const art12 = src.slice(src.indexOf('## Article 12'), src.indexOf('## Article 13'));
  const art13 = src.slice(src.indexOf('## Article 13'), src.indexOf('## Article 14'));
  assert.ok(/Le Conseiller NEXUS possède un langage unique/.test(art12),
    'l’article 12 garde son texte d’origine : la note marque, elle ne corrige pas');
  assert.ok(/Le Conseiller NEXUS peut-il expliquer sa valeur/.test(art13),
    'l’article 13 aussi');
});

t('la scission que la note invoque existe VRAIMENT dans la Bible', () => {
  // Sans cela, la note renverrait à une décision qui n'a pas été prise.
  const bible = fs.readFileSync(BIBLE, 'utf8');
  const agents = bible.slice(bible.indexOf('## Agents NEXUS'), bible.indexOf('## Gouvernance'));
  assert.ok(/NEXUS Directeur d’Exploitation|NEXUS Directeur d'Exploitation/.test(agents));
  assert.ok(/NEXUS Coach Terrain/.test(agents));
  assert.ok(/distincts/.test(agents), 'la Bible doit poser les deux agents comme distincts');
});

t('la dette de propagation annoncée par la note est réellement suivie', () => {
  // La note dit que le renommage « se traite au Backlog ». Un renvoi vers un
  // Backlog où rien n'est inscrit serait un classement sans suite.
  const b = fs.readFileSync(BACKLOG, 'utf8');
  assert.ok(/\| LANG-004 \|/.test(b), 'LANG-004 doit exister au Backlog');
  const ligne = b.split('\n').find(l => l.includes('| LANG-004 |'));
  assert.ok(/Conseiller NEXUS/.test(ligne), 'l’item doit nommer le terme à propager');
  assert.ok(/Coach Terrain/.test(ligne) && /Directeur d/.test(ligne),
    'et les DEUX agents : un remplacement global par un seul serait pire que la dette');
});

t('aucun renvoi de la Bible ne pointe dans le vide', () => {
  // Le renvoi vers la doctrine du langage a été REFUSÉ deux fois avant d'être
  // ajouté, parce que sa cible n'existait pas encore : un renvoi vers un
  // fichier absent donne l'apparence d'une doctrine adossée à un texte, et une
  // lecture rapide ne voit pas ce vide. La règle vaut pour tous les renvois,
  // pas seulement celui-là.
  const src = fs.readFileSync(BIBLE, 'utf8');
  const cibles = [...src.matchAll(/`(docs\/[A-Za-z0-9\/_.-]+\.(?:md|json))`/g)].map(m => m[1])
    .concat([...src.matchAll(/`([A-Za-z0-9_.-]+\.js)`/g)].map(m => m[1]));
  assert.ok(cibles.length > 0, 'la Bible doit citer au moins une cible');
  for (const c of new Set(cibles)) {
    assert.ok(fs.existsSync(path.join(__dirname, c)), `renvoi de la Bible vers un fichier absent : ${c}`);
  }

  // Et celui-ci en particulier, puisqu'il a été arbitré.
  const agents = src.slice(src.indexOf('## Agents NEXUS'), src.indexOf('### NEXUS Guardian'));
  assert.ok(/DOCTRINE-LANGAGE-VOCABULAIRE\.md/.test(agents),
    'le renvoi vers la doctrine du langage doit vivre dans la section « Agents NEXUS »');
});

console.log(`\n${n}/${n} vérifications passées — une ligne de Bible que rien ne tient n’est pas une règle.`);
