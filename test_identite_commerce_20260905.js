// A3 / B1 — le nom d'un commerce ne sert jamais de valeur de secours à un autre.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const APPLICATIF = fs.readdirSync(RACINE).filter(f => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(f));
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// Découvert le 05/09/2026 EN ÉCRIVANT CE TEST, après la présentation du
// diagnostic B1 : mon balayage cherchait « Vito » et « VITO ». Ce troisième
// chemin s'écrit « ViTO ». Il n'est pas décoratif — c'est le nom d'entreprise
// imprimé sur la page de garde du DOSSIER COMPTABLE PDF, un document qui
// quitte l'application et part chez une comptable.
//
//   NEXUS-Paye-v1.html:402      nomEntreprise: 'ViTO Sainte-Marie'  (passé en dur)
//   nexus-paye-dossier-pdf.js:153  opts.nomEntreprise || 'ViTO Sainte-Marie'
//
// Nommé ici en attente d'arbitrage, jamais exempté en silence. Ce test
// échouera aussi le jour où ces fichiers cesseront d'en contenir : la liste
// doit se vider, pas être oubliée.
// Corrigé le 05/09/2026 : ces deux fichiers ont été traités en B1-c. La liste
// est vide, et le test échoue si un fichier vient l'y rejoindre.
const B1_EN_ATTENTE_ARBITRAGE = [];

// Le diagnostic cherchait « Vito » et « VITO » ; le défaut s'écrivait « ViTO ».
// Le garde-fou NORMALISE au lieu d'énumérer : le prochain « vItO » ne passera
// pas entre les mailles.
const NOM_COMMERCE_INTERDIT = /v\s*i\s*t\s*o[\s-]*sainte[\s-]*marie/i;

verifier('aucune identité de site n’est initialisée avec un nom de commerce', () => {
  const coupables = [];
  const enAttenteVus = new Set();
  for (const f of APPLICATIF) {
    const lignes = lire(f).split('\n');
    for (let i = 0; i < lignes.length; i++) {
      const ligne = lignes[i];
      if (/^\s*(\/\/|\*|<!--)/.test(ligne)) continue;
      // Une variable ou un élément d'identité de site qui naît avec un nom propre.
      if (/(station_nom|id="stationTitle"|nomEntreprise)\s*[:=>]/.test(ligne)
          && NOM_COMMERCE_INTERDIT.test(ligne)) {
        if (B1_EN_ATTENTE_ARBITRAGE.includes(f)) { enAttenteVus.add(f); continue; }
        coupables.push(`${f}:${i + 1}  ${ligne.trim().slice(0, 110)}`);
      }
    }
  }
  assert.deepStrictEqual(coupables, [],
    'Un client ne doit jamais voir le nom d’un autre :\n  ' + coupables.join('\n  '));
  const regles = B1_EN_ATTENTE_ARBITRAGE.filter(f => !enAttenteVus.has(f));
  assert.deepStrictEqual(regles, [],
    'Ces fichiers ne portent plus de nom en dur : retirez-les de B1_EN_ATTENTE_ARBITRAGE.\n  ' + regles.join('\n  '));
});

verifier('les deux chemins distinguent panne technique et configuration absente', () => {
  for (const [f, ancre] of [['NEXUS-App-v1.html', 'async function chargerMarqueSite'],
                            ['NEXUS-Cockpit-v2.html', "select('nom_entreprise, logo_url')"]]) {
    const src = lire(f);
    const i = src.indexOf(ancre);
    assert.ok(i !== -1, ancre + ' introuvable dans ' + f);
    const bloc = src.slice(i, i + 1800);
    assert.ok(/console\.error\('Lecture identité du commerce :'/.test(bloc),
      f + ' : l’échec de la requête est une panne technique (error)');
    assert.ok(/console\.warn\('Identité du commerce non configurée/.test(bloc),
      f + ' : une lecture réussie sans nom est une configuration incomplète (warn)');
    assert.ok(/Commerce non identifié/.test(bloc), f + ' : ultime repli neutre attendu');
  }
});

verifier('le repli est l’identifiant du commerce COURANT', () => {
  const app = lire('NEXUS-App-v1.html');
  assert.ok(/titre\.textContent = siteId \|\| 'Commerce non identifié'/.test(app));
  const cockpit = lire('NEXUS-Cockpit-v2.html');
  assert.ok(/STATION_CONFIG\.station_nom = SITE_ACTUEL \|\| 'Commerce non identifié'/.test(cockpit));
});

verifier('Cockpit observe désormais l’erreur de lecture', () => {
  const src = lire('NEXUS-Cockpit-v2.html');
  assert.ok(/const \{ data: siteActuel, error: erreurSite \}/.test(src),
    'l’erreur n’était même pas capturée : la requête pouvait échouer en silence');
});

verifier('B1 ne touche ni aux identifiants, ni aux pieds de page, ni aux exemples', () => {
  // Périmètre volontairement étroit : ce test échoue si un lot ultérieur
  // aspire ces trois familles dans B1 sans arbitrage.
  const pieds = APPLICATIF.filter(f => /<footer>[^<]*Vito Sainte-Marie/.test(lire(f)));
  assert.strictEqual(pieds.length, 30, 'les 30 pieds de page relèvent d’A3-6, pas de B1');
  const comptes = lire('NEXUS-Parametres-Comptes-Clients-v1.html');
  assert.ok(/placeholder="Ex : Vito Sainte Marie Usine"/.test(comptes),
    'le placeholder est un exemple de saisie, il doit le rester');
  const app = lire('NEXUS-App-v1.html');
  assert.ok(!/site_id\s*=\s*['"]/.test(app.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')),
    'aucun identifiant de site ne doit être écrit en dur');
});

console.log(`\n${passes} vérifications passées — l'identité affichée est celle du commerce, ou rien.`);
