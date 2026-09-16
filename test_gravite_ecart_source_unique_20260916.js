/*
 * La gravité d'un écart de caisse n'a qu'une seule échelle dans NEXUS.
 * ============================================================================
 * LE DÉFAUT, relevé par l'audit ARCH-003 du 06/09/2026 (finding 3b) et resté
 * ouvert après le lot 7 : NEXUS-Mon-Evolution-v1.html redisait les seuils de
 * gravité en dur, à TROIS paliers au lieu de quatre.
 *
 *     écran  : <= 2 vert     · <= 20 ambre      · au-delà rouge
 *     moteur : <= 2 conforme · <= 5 surveiller  · <= 20 ANOMALIE · critique
 *
 * L'audit décrivait la conséquence comme « un écart de 3 à 5 € s'affiche vert
 * ici ». La mesure du §5 le dément : à 3 €, les deux versions disent ambre.
 * La divergence réelle est ailleurs, et elle est plus grave — elle porte sur
 * la tranche 5,01 à 20 € :
 *
 *     12,00 € · écran  : AMBRE, le ton du « à surveiller »
 *     12,00 € · partout : ANOMALIE, donc rouge — Verify, Rapport de Direction,
 *                         Cockpit, Brief, Pilotage Carburants.
 *
 * L'écran qui regarde l'employée était donc le seul de NEXUS à peindre une
 * anomalie de caisse aux couleurs d'une simple surveillance. Le palier le plus
 * sévère avant « critique » n'y existait pas.
 *
 * L'INVARIANT ÉPROUVÉ ICI :
 *   TANT QUE CET ÉCRAN COLORE UN MONTANT, CETTE COULEUR DOIT ÊTRE DÉRIVÉE DE
 *   `NexusVerifyMoteur.classifierEcart`, ET NON RECALCULÉE SUR PLACE.
 *
 * Le §4 est ce qui distingue cette épreuve d'une tautologie : il MUTE les
 * seuils du moteur en mémoire et exige que la couleur de l'écran change. Un
 * écran qui redirait les seuils en dur passerait tous les autres paragraphes
 * et échouerait celui-là.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ECRAN = path.join(__dirname, 'NEXUS-Mon-Evolution-v1.html');
const MOTEUR = path.join(__dirname, 'nexus-verify-moteur.js');
const SOURCE = fs.readFileSync(ECRAN, 'utf8');
const SOURCE_MOTEUR = fs.readFileSync(MOTEUR, 'utf8');

let reussites = 0, echecs = 0;
function verifier(nom, condition, detail) {
  if (condition) { reussites++; console.log(`  ✓ ${nom}`); }
  else { echecs++; console.log(`  ✗ ${nom}${detail ? '\n      ' + detail : ''}`); }
}

// ── Compose l'écran sur un moteur donné, exactement comme le navigateur ─────
// `sourceMoteur` est un paramètre : le §4 y injecte une version mutée.
function composer(sourceMoteur) {
  const contexte = { console };
  contexte.window = contexte;
  contexte.globalThis = contexte;
  vm.createContext(contexte);
  vm.runInContext(sourceMoteur, contexte, { filename: 'nexus-verify-moteur.js' });

  const table = SOURCE.match(/const COULEUR_GRAVITE = \{[\s\S]*?\};/);
  const fonction = SOURCE.match(/function classifierEcart\(montantAbs\) \{[\s\S]*?\n  \}/);
  if (!table || !fonction) return null;
  vm.runInContext(`${table[0]}\n${fonction[0]}\nthis.classifierEcart = classifierEcart;`,
    contexte, { filename: 'NEXUS-Mon-Evolution-v1.html' });
  return contexte.classifierEcart;
}

console.log('\n── 1 · L’écran charge la source canonique ──');
verifier('nexus-verify-moteur.js est inclus par la page',
  /<script src="nexus-verify-moteur\.js\?v=[0-9-]+"><\/script>/.test(SOURCE));
verifier('il est chargé avant le bloc qui l’utilise',
  SOURCE.indexOf('src="nexus-verify-moteur.js') < SOURCE.indexOf('const COULEUR_GRAVITE'));
verifier('il porte la même épingle de cache que les autres moteurs de la page',
  (SOURCE.match(/nexus-verify-moteur\.js\?v=([0-9-]+)/) || [])[1]
  === (SOURCE.match(/nexus-ecarts-moteur\.js\?v=([0-9-]+)/) || [])[1]);

console.log('\n── 2 · L’écran ne redit plus aucun seuil ──');
const fonction = (SOURCE.match(/function classifierEcart\(montantAbs\) \{[\s\S]*?\n  \}/) || [''])[0];
verifier('classifierEcart existe toujours (les deux appelants en dépendent)', !!fonction);
verifier('elle délègue au moteur',
  /NexusVerifyMoteur\.classifierEcart\(montantAbs\)/.test(fonction));
verifier('elle ne compare plus aucun montant à un seuil',
  !/montantAbs\s*[<>]=?/.test(fonction),
  'un seul `montantAbs <= N` suffit à recréer la divergence');
// Les seuils ne doivent revenir nulle part dans la page, pas seulement dans
// cette fonction : le défaut d'origine était exactement un seuil recopié.
const bloc = SOURCE.slice(SOURCE.indexOf('<script>', SOURCE.indexOf('nexus-caisse-source.js')));
verifier('aucun autre seuil de gravité en dur dans le script de la page',
  !/(<=|>=|<|>)\s*(2|5|20)\s*\)\s*return\s*'var\(--/.test(bloc));
verifier('aucun repli qui réécrirait l’échelle',
  !/NexusVerifyMoteur\s*(\?\.|&&|\|\|)/.test(fonction),
  'un repli est un second endroit où la règle peut dériver');

console.log('\n── 3 · Ce que l’employée voit désormais ──');
const couleur = composer(SOURCE_MOTEUR);
verifier('la composition écran + moteur s’évalue', typeof couleur === 'function');
verifier('0,50 € : vert', couleur(0.5) === 'var(--green)');
verifier('2,00 € : vert (borne incluse)', couleur(2) === 'var(--green)');
verifier('3,00 € : ambre — à surveiller', couleur(3) === 'var(--amber)');
verifier('5,00 € : ambre (borne incluse)', couleur(5) === 'var(--amber)');
verifier('LE DÉFAUT — 5,01 € n’est plus ambre', couleur(5.01) !== 'var(--amber)');
verifier('5,01 € : rouge, c’est une anomalie', couleur(5.01) === 'var(--rouge)');
verifier('LE DÉFAUT — 12,00 € n’est plus ambre', couleur(12) !== 'var(--amber)');
verifier('12,00 € : rouge', couleur(12) === 'var(--rouge)');
verifier('20,00 € : rouge (borne incluse)', couleur(20) === 'var(--rouge)');
verifier('36,65 € : rouge (critique)', couleur(36.65) === 'var(--rouge)');
verifier('les quatre gravités du moteur ont toutes une couleur',
  ['conforme', 'surveiller', 'anomalie', 'critique']
    .every(g => /var\(--/.test((SOURCE.match(new RegExp(`${g}:\\s*('[^']+')`)) || [])[1] || '')));
// --rouge de cet écran EST le --red de Verify : même teinte, autre nom.
const teinteEcran = (SOURCE.match(/--rouge:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
const teinteVerify = (fs.readFileSync(path.join(__dirname, 'NEXUS-Verify-v1.html'), 'utf8')
  .match(/--red:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
verifier('le rouge de cet écran est celui de NEXUS Verify',
  !!teinteEcran && teinteEcran === teinteVerify,
  `--rouge=${teinteEcran} vs --red=${teinteVerify}`);

console.log('\n── 4 · La couleur SUIT le moteur — preuve de dérivation ──');
// Si l'écran recalculait les seuils, ces mutations ne changeraient rien chez
// lui. C'est le seul paragraphe qu'un écran divergent ne peut pas passer.
const moteurResserre = SOURCE_MOTEUR.replace(
  "if (montantAbs <= 5) return 'surveiller';", "if (montantAbs <= 4) return 'surveiller';");
verifier('mutation « surveiller descend à 4 € » : la source est bien celle-là',
  moteurResserre !== SOURCE_MOTEUR);
const couleurResserre = composer(moteurResserre);
verifier('4,50 € était ambre, il devient rouge : l’écran a suivi',
  couleur(4.5) === 'var(--amber)' && couleurResserre(4.5) === 'var(--rouge)',
  `avant=${couleur(4.5)} après=${couleurResserre(4.5)}`);

const moteurElargi = SOURCE_MOTEUR.replace(
  "if (montantAbs <= 2) return 'conforme';", "if (montantAbs <= 10) return 'conforme';");
const couleurElargi = composer(moteurElargi);
verifier('mutation « conforme monte à 10 € » : 3 € redevient vert',
  moteurElargi !== SOURCE_MOTEUR && couleur(3) === 'var(--amber)'
  && couleurElargi(3) === 'var(--green)',
  `avant=${couleur(3)} après=${couleurElargi(3)}`);

console.log('\n── 5 · La garde mord sur la version d’avant ──');
// Le code exact retiré aujourd'hui, rejoué en mémoire : les mesures du §2 et
// du §3 doivent tomber. Une garde qui reste verte ici ne prouverait rien.
const AVANT = `function classifierEcart(montantAbs) {
    if (montantAbs <= 2) return 'var(--green)';
    if (montantAbs <= 20) return 'var(--amber)';
    return 'var(--rouge)';
  }`;
verifier('la version d’avant comparait bien des montants', /montantAbs\s*<=/.test(AVANT));
verifier('la version d’avant ne déléguait pas',
  !/NexusVerifyMoteur/.test(AVANT));
const avantFn = new Function(`${AVANT}; return classifierEcart;`)();
// Ce que l'audit annonçait — et qui n'était pas vrai. La mesure prime.
verifier('à 3 €, avant et après disent la même chose : le défaut n’était pas là',
  avantFn(3) === 'var(--amber)' && couleur(3) === 'var(--amber)');
verifier('LE DÉFAUT — 5,01 € : ambre avant, rouge maintenant',
  avantFn(5.01) === 'var(--amber)' && couleur(5.01) === 'var(--rouge)');
verifier('LE DÉFAUT — 12,00 € : une anomalie peinte en surveillance',
  avantFn(12) === 'var(--amber)' && couleur(12) === 'var(--rouge)');
verifier('toute la tranche 5,01–20 € était minimisée, sans exception',
  [5.01, 7, 9.99, 12, 15, 19.99, 20].every(m =>
    avantFn(m) === 'var(--amber)' && couleur(m) === 'var(--rouge)'));
verifier('au-delà de 20 €, les deux versions se rejoignaient',
  avantFn(36.65) === 'var(--rouge)' && couleur(36.65) === 'var(--rouge)');

console.log(`\n${echecs === 0 ? '✓' : '✗'} ${reussites} réussite(s), ${echecs} échec(s)\n`);
if (echecs > 0) process.exit(1);
