// A3 / C1 client — le fuseau est une donnée de contexte explicite.
//
// Comme pour C4, ce test cible des MOTIFS, pas des occurrences nommées :
// aucun repli vers un fuseau nommé, aucun repli vers l'heure du navigateur,
// et la frontière résolveur / couche de données / fonction pure.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const APPLICATIF = fs.readdirSync(RACINE)
  .filter(f => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(f));

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

function lignesDe(f) {
  return fs.readFileSync(path.join(RACINE, f), 'utf8')
    .split('\n').map((t, i) => ({ f, n: i + 1, t }))
    // Les commentaires documentent la correction, ils ne la défont pas.
    .filter(l => !/^\s*(\/\/|\*|--)/.test(l.t));
}

// Un fuseau IANA en position de repli : `|| 'X/Y'`, `?? 'X/Y'`, `timeZone: x || 'X/Y'`.
const REPLI_FUSEAU = /(\|\||\?\?)\s*['"][A-Za-z]+\/[A-Za-z_]+['"]/;
// Retomber sur l'horloge de l'appareil.
const REPLI_NAVIGATEUR = /\b(getHours|getMinutes)\s*\(\s*\)/;

// Les replis de fuseau encore en place, NOMMÉS. Ce n'était pas une exemption :
// c'était la liste de ce qui restait à faire, et elle devait se vider.
// C1c-4a, C1c-4b et C1c-5 l'ont vidée le 05/09/2026. Elle reste ici, vide :
// le test échoue si un fichier vient l'y rejoindre.
const RESTE_A_TRAITER = new Set([
]);

verifier('aucun repli de fuseau hors des sous-lots encore ouverts', () => {
  const t = [];
  const vus = new Set();
  for (const f of APPLICATIF) {
    for (const l of lignesDe(f)) {
      if (REPLI_FUSEAU.test(l.t) && /fuseau|timeZone|timezone/i.test(l.t)) {
        vus.add(f);
        if (!RESTE_A_TRAITER.has(f)) t.push(`${f}:${l.n}  ${l.t.trim().slice(0, 110)}`);
      }
    }
  }
  assert.strictEqual(t.length, 0,
    'Le fuseau d’une station ne doit jamais servir de repli à une autre :\n  ' + t.join('\n  '));
  // Et l'inverse : un fichier qui quitte la liste doit en être retiré, pour
  // que « reste à traiter » ne devienne pas une liste que plus personne ne lit.
  const reglés = [...RESTE_A_TRAITER].filter(f => !vus.has(f));
  assert.deepStrictEqual(reglés, [],
    'Ces fichiers n’ont plus de repli : retirez-les de RESTE_A_TRAITER.\n  ' + reglés.join('\n  '));
});

// Découvert le 05/09/2026 en écrivant ce test, hors des huit occurrences C1 :
// nexus-carburant-commande-backtest.js compare un horodatage au cut-off de
// commande avec getHours(), donc dans le fuseau de la MACHINE. C'est le même
// défaut de famille — une décision métier (avant / après 11 h) prise dans le
// mauvais fuseau. Il est LATENT : aucun écran n'appelle ce module, seuls les
// tests le chargent. Consigné, non corrigé, en attente d'arbitrage.
const HORLOGE_MACHINE_A_TRAITER = new Set([
  'nexus-carburant-commande-backtest.js',
]);

verifier('aucun repli vers l’horloge de la machine hors des cas consignés', () => {
  const t = [];
  const vus = new Set();
  for (const f of APPLICATIF.filter(x => /^nexus-carburant/.test(x))) {
    for (const l of lignesDe(f)) {
      if (REPLI_NAVIGATEUR.test(l.t)) {
        vus.add(f);
        if (!HORLOGE_MACHINE_A_TRAITER.has(f)) t.push(`${f}:${l.n}  ${l.t.trim().slice(0, 110)}`);
      }
    }
  }
  assert.strictEqual(t.length, 0,
    'L’heure de l’appareil varie selon l’endroit où se trouve l’utilisateur — ' +
    'c’est un repli pire que Sainte-Marie :\n  ' + t.join('\n  '));
  const reglés = [...HORLOGE_MACHINE_A_TRAITER].filter(f => !vus.has(f));
  assert.deepStrictEqual(reglés, [],
    'Ces fichiers n’utilisent plus l’horloge machine : retirez-les de la liste.\n  ' + reglés.join('\n  '));
});

verifier('le contrat NexusStation est celui arbitré', () => {
  const src = fs.readFileSync(path.join(RACINE, 'nexus-station.js'), 'utf8');
  const code = src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(/async function fuseauDeLaStation\(siteId\)/.test(code),
    'signature attendue : fuseauDeLaStation(siteId), sans paramètre client');
  assert.ok(/return \{ timezone: data\.timezone \}/.test(code), '{ timezone }, jamais { fuseau }');
  assert.ok(/indetermine: 'configuration'/.test(code), "'configuration', jamais 'absent'");
  assert.ok(/indetermine: 'reseau'/.test(code));
  assert.ok(/throw new TypeError/.test(code),
    'un siteId manquant est une erreur de contrat, pas un état métier');
  assert.ok(!/America\//.test(code), 'aucun fuseau nommé dans la primitive');
});

verifier('les fonctions pures exigent timezone au lieu de le deviner', () => {
  for (const [f, fn] of [
    ['nexus-carburant-commande-donnees-core.js', 'heureHHMMAujourdhui'],
    ['nexus-carburants-p0-performance.js', 'dateLocaleISO'],
  ]) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    const i = src.indexOf('function ' + fn + '(');
    assert.ok(i !== -1, fn + ' introuvable dans ' + f);
    const corps = src.slice(i, i + 900);
    assert.ok(/\(timezone\)/.test(corps.slice(0, 60)), fn + ' doit prendre `timezone`');
    assert.ok(/throw new TypeError/.test(corps), fn + ' doit lever si timezone manque');
    assert.ok(!/catch/.test(corps.split('}')[0] + corps.slice(0, 500)),
      fn + ' ne doit plus rattraper l’absence par un repli');
  }
});

verifier('les résolveurs d’écran n’affichent pas d’heure sans fuseau résolu', () => {
  for (const f of ['NEXUS-Verify-v1.html', 'NEXUS-Carburants-Pilotage-v1.html']) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    assert.ok(/let FUSEAU_STATION = null;/.test(src), f + ' : FUSEAU_STATION doit naître null');
    assert.ok(/await NexusStation\.fuseauDeLaStation\(/.test(src),
      f + ' : la résolution doit être attendue, jamais un .then() détaché');
    const formatages = (src.match(/timeZone: FUSEAU_STATION/g) || []).length;
    const gardes = (src.match(/if \(!FUSEAU_STATION\) return '—';/g) || []).length;
    assert.ok(gardes >= 1 && formatages >= 1,
      f + ' : chaque formatage doit être protégé par une garde d’absence');
  }
});

verifier('Verify ne lit plus le fuseau dans un .then() non attendu', () => {
  const src = fs.readFileSync(path.join(RACINE, 'NEXUS-Verify-v1.html'), 'utf8');
  assert.ok(!/select\('fuseau_horaire'\)[\s\S]{0,200}?\.then\(/.test(src),
    'la course au premier rendu doit avoir disparu');
});

verifier('Paramètres Station montre l’absence sans bloquer, et n’écrit plus le fuseau', () => {
  const src = fs.readFileSync(path.join(RACINE, 'NEXUS-Parametres-Station-v1.html'), 'utf8');
  assert.ok(!/const FUSEAU_DEFAUT/.test(src), 'plus de fuseau par défaut');
  assert.ok(/noteFuseauEtat/.test(src) && /Non configuré/.test(src),
    'l’absence doit être visible dans l’écran');
  assert.ok(!/fuseau_horaire: fuseauSelectionne/.test(src),
    'l’écran ne doit plus écrire dans une colonne que plus personne ne lit');
  assert.ok(!/<select id="fuseau_horaire"/.test(src),
    'un select, même désactivé, reste un contrôle de saisie : il suggère qu’on pourrait l’activer');
  assert.ok(/id="fuseauValeur"/.test(src) && /Propriété du site, modifiable par le compte créateur/.test(src),
    'le fuseau doit être affiché comme une propriété du site, pas comme un réglage');
});

// Ajouté le 05/09/2026 APRÈS un défaut trouvé seulement sur le déploiement
// réel : NEXUS-Brief-v1.html appelait chargerCarburantsBriefAvecFallback avec
// trois arguments au lieu de quatre. Aucun test unitaire ne pouvait le voir —
// les tests stubbent ces fonctions, et un stub accepte n'importe quelle arité.
// Ce contrôle lit les APPELS, pas les définitions.
const ARITE_ATTENDUE = {
  chargerControleJour: 4,
  chargerVentesPeriode: 5,
  chargerCarburantsBrief: 4,
  chargerCarburantsBriefAvecFallback: 4,
  chargerCandidatCommandeCarburant: 3,
  chargerStatutCarburantsHome: 3,
};

function argumentsDeNiveau1(texte, iParenthese) {
  let profondeur = 0, courant = '', args = [];
  for (const c of texte.slice(iParenthese)) {
    if ('([{'.includes(c)) profondeur++;
    if (')]}'.includes(c)) { profondeur--; if (profondeur === 0) { args.push(courant); break; } }
    if (profondeur === 1 && c === ',') { args.push(courant); courant = ''; continue; }
    if (profondeur >= 1 && !(profondeur === 1 && c === '(')) courant += c;
  }
  return args.map(a => a.trim()).filter(a => a !== '');
}

verifier('aucun appel ne prive une fonction de son fuseau', () => {
  const t = [];
  for (const f of APPLICATIF) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    for (const [nom, attendu] of Object.entries(ARITE_ATTENDUE)) {
      const motif = new RegExp('(?<![\\w.])(?:[\\w.]+\\.)?' + nom + '\\(', 'g');
      let m;
      while ((m = motif.exec(src))) {
        // la définition elle-même n'est pas un appel
        if (/\s*(async\s+)?function\s*$/.test(src.slice(Math.max(0, m.index - 30), m.index))) continue;
        const i = src.indexOf('(', m.index + nom.length - 1);
        const args = argumentsDeNiveau1(src, i);
        if (args.length > 0 && args.length < attendu) {
          t.push(`${f}:${src.slice(0, m.index).split('\n').length}  ${nom} -> ${args.length} arg(s), ${attendu} attendus`);
        }
      }
    }
  }
  assert.strictEqual(t.length, 0,
    'Un appelant qui omet le fuseau le rend « undefined » : la fonction lève à ' +
    'l’exécution, jamais au test.\n  ' + t.join('\n  '));
});

console.log(`\n${passes} vérifications passées — le fuseau est un contexte explicite.`);
