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

// Découvert le 25/09/2026 — et découvert par une PANNE, pas par cette garde,
// qui est précisément le défaut à corriger ici. Le durcissement du 05/09 a
// nommé l'HEURE (`getHours`/`getMinutes`) et s'est arrêté là. La DATE lue sur
// l'horloge de la machine est pourtant le même défaut de famille, et il est
// PIRE : une heure fausse décale un affichage, une date fausse change le jour
// de la semaine — donc la fenêtre de livraison, donc `estFinDeMois`, donc le
// mode de volume. Toute la recommandation bascule.
//
// MESURÉ, pas déduit : `dateISOAujourdhui()` lisait la date du navigateur
// pendant que sa voisine `heureHHMMAujourdhui(timezone)` lisait l'heure de la
// station. Le couple formé désignait un instant qui n'a jamais existé. Sur un
// runner en UTC, entre 20 h et minuit heure de Fort-de-France, la recette
// navigateur recommandait 6 000 L de sp95 seul au lieu du camion complet de
// 36 000 L (runs 35939904156, 35943611183, 35948647676) — et restait verte
// aux mêmes heures la veille et le lendemain, ce qui a fait chercher ailleurs
// pendant trois semaines.
//
// Le MOTIF visé n'est pas l'accesseur de calendrier : `d.setDate(d.getDate()
// - fenetre)` sur une date DONNÉE est de l'arithmétique symétrique, sans
// défaut. Le motif est l'horloge machine lue en calendrier : `new Date()`
// SANS argument, dont on lit ensuite l'année, le mois ou le jour.
// VIDE depuis le 26/09/2026. Les deux derniers — `nexus-carburants-p0-
// coherence-ui.js` et `nexus-carburants-mobile-polish-v2.js` — sont réparés.
// Le motif invoqué pour les avoir consignés (« aucun des deux n'a de fuseau
// en portée ») était faux : les deux résolvent déjà `siteCourant()`, et
// `NexusStation.dateLocaleStation` est exporté et chargé par la page. Il n'y
// avait rien à faire descendre. Une liste « reste à traiter » survit surtout
// à la raison qui l'a remplie.
const CALENDRIER_MACHINE_A_TRAITER = new Set([]);

verifier('aucune date de calendrier lue sur l’horloge de la machine', () => {
  const t = [];
  const vus = new Set();
  for (const f of APPLICATIF.filter(x => /^nexus-carburant/.test(x))) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8')
      .split('\n').map(l => /^\s*(\/\/|\*|--)/.test(l) ? '' : l).join('\n');
    const naissance = /(?:var|const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*new Date\(\s*\)/g;
    let m;
    while ((m = naissance.exec(src))) {
      const v = m[1];
      const calendrier = new RegExp('\\b' + v + '\\.(getFullYear|getMonth|getDate|getDay)\\s*\\(\\s*\\)');
      if (!calendrier.test(src.slice(m.index, m.index + 400))) continue;
      vus.add(f);
      if (!CALENDRIER_MACHINE_A_TRAITER.has(f)) {
        t.push(`${f}:${src.slice(0, m.index).split('\n').length}  ${v} = new Date() puis lecture du calendrier`);
      }
    }
  }
  assert.strictEqual(t.length, 0,
    'La date de l’appareil n’est pas celle de la station : entre 20 h et minuit à ' +
    'Fort-de-France, elle désigne DÉJÀ le lendemain. Le jour de semaine commande la ' +
    'fenêtre de livraison, qui commande le mode de volume — toute la recommandation ' +
    'bascule. Prenez le fuseau et passez par Intl :\n  ' + t.join('\n  '));
  const reglés = [...CALENDRIER_MACHINE_A_TRAITER].filter(f => !vus.has(f));
  assert.deepStrictEqual(reglés, [],
    'Ces fichiers ne lisent plus le calendrier machine : retirez-les de ' +
    'CALENDRIER_MACHINE_A_TRAITER.\n  ' + reglés.join('\n  '));
});

// ── La source, et non plus le symptôme ────────────────────────────────────
// 25/09/2026. Troisième durcissement de la même famille en vingt jours, et
// c'est le motif de récurrence qu'on corrige ici, pas une occurrence de plus.
//
// Les deux gardes ci-dessus nomment des ACCESSEURS : `getHours|getMinutes`
// le 05/09, puis `getFullYear|getMonth|getDate|getDay` le 25/09 — ajouté
// après une panne, jamais par la garde. Chaque nouvelle façon de lire
// l'horloge machine ouvre donc un angle mort neuf, et il y aura une
// quatrième fois. Mesuré le 25/09 : la plus grosse famille du dépôt —
// `new Date().toISOString().slice(0, 10)`, 46 occurrences — n'était vue par
// AUCUNE des deux, alors que c'est exactement le même défaut, en pire : elle
// rend le calendrier UTC, donc à Fort-de-France elle désigne déjà le
// lendemain à partir de 20 h, tous les jours.
//
// Et leur PORTÉE est `/^nexus-carburant/` — la trace de l'endroit où la
// panne a été trouvée, pas une règle de l'application. Sur les 47 fichiers
// qui lisent l'horloge machine en termes locaux, elles en regardent 4.
//
// Cette garde-ci vise donc la SOURCE, unique : `new Date()` sans argument,
// dont la valeur est ensuite lue en termes locaux ou de calendrier. Sur tout
// l'applicatif. Ce qu'elle ne vise PAS, et c'est délibéré : `new Date()`
// gardé comme INSTANT (horodatage envoyé en base, `toISOString()` entier,
// mesure de durée) n'a pas de défaut — un instant n'a pas de fuseau. Le
// défaut naît au moment où l'on en tire une heure, un jour ou une date.
//
// Le registre est une DETTE CHIFFRÉE, à cliquet : il porte le nombre
// d'occurrences par fichier, et la garde rougit dans les TROIS sens — un
// fichier qui n'y est pas, un fichier qui en gagne, et un fichier qui en
// perd sans que le chiffre soit abaissé. C'est ce qui manquait aux deux
// listes ci-dessus : un `Set` tolère qu'un fichier déjà consigné en gagne
// dix de plus, ce qui est précisément la façon dont ce défaut s'est répandu.
// Une dette qui ne peut que descendre finit par atteindre zéro ; une liste
// « reste à traiter » ne se vide jamais.
const DETTE_HORLOGE_MACHINE = {
  'NEXUS-Missions-v1.html': 20,
  'NEXUS-Brief-v1.html': 8,
  'NEXUS-Cockpit-v2.html': 8,
  'NEXUS-Centre-Intelligence-v1.html': 7,
  'NEXUS-Evaluation-Employe-v1.html': 6,
  'NEXUS-Capital-v1.html': 5,
  'NEXUS-Inventaire-Manager-v1.html': 5,
  'NEXUS-Inventaire-v1.html': 5,
  'NEXUS-Verify-v1.html': 4,
  'NEXUS-Carburant-Reception-v1.html': 3,
  'NEXUS-FDJ-v1.html': 3,
  'NEXUS-Progression-v1.html': 3,
  'nexus-brief-donnees.js': 3,
  'NEXUS-App-v1.html': 2,
  'NEXUS-FDJ-Manager-v1.html': 2,
  'NEXUS-Mon-Evolution-v1.html': 2,
  'NEXUS-Parametres-Station-v1.html': 2,
  'NEXUS-Pointage-v1.html': 2,
  'NEXUS-Produits-v1.html': 2,
  'NEXUS-Rapport-v1.html': 2,
  'NEXUS-Scanner-v1.html': 2,
  'NEXUS-Tempo-v1.html': 2,
  'nexus-coach-fdj-donnees.js': 2,
  'nexus-conseiller.js': 2,
  'NEXUS-Boite-Reception-v1.html': 1,
  'NEXUS-Carburants-Pilotage-v1.html': 1,
  'NEXUS-Carburants-v1.html': 1,
  'NEXUS-FDJ-Analyse-v1.html': 1,
  'NEXUS-Journal-v1.html': 1,
  'NEXUS-Parametres-Inventaire-v1.html': 1,
  'NEXUS-Planning-v1.html': 1,
  'NEXUS-Resultats-Equipe-v1.html': 1,
  'NEXUS-Tracabilite-v1.html': 1,
  'nexus-app-donnees.js': 1,
  'nexus-auth.js': 1,
  'nexus-carburant-commande-donnees-core.js': 1,
  'nexus-carburant-donnees.js': 1,
  'nexus-coach-fdj-moteur.js': 1,
  'nexus-conseiller-donnees.js': 1,
  'nexus-inventaire-moteur.js': 1,
  'nexus-inventaire-stock-transfert-v2.js': 1,
  'nexus-inventaire-transferts-internes.js': 1,
  'nexus-risques-donnees.js': 1,
  'nexus-secteurs-moteur.js': 1,
  'nexus-tempo.js': 1,
};

// L'horloge machine lue en termes LOCAUX. Retourne les occurrences d'un
// fichier, source déjà purgée de ses commentaires.
function lecturesLocalesDeLHorloge(src) {
  const trouves = [];
  const DIRECT = [
    [/new Date\(\s*\)\s*\.\s*(?:getFullYear|getMonth|getDate|getDay|getHours|getMinutes)/g,
      'new Date().getX() — calendrier de la machine'],
    [/new Date\(\s*\)\s*\.\s*toISOString\(\s*\)\s*\.\s*(?:slice|substring|substr|split)/g,
      'new Date().toISOString().slice() — calendrier UTC, pas celui de la station'],
    [/new Date\(\s*\)\s*\.\s*toTimeString\(\s*\)/g,
      'new Date().toTimeString() — heure de la machine'],
  ];
  for (const [motif, quoi] of DIRECT) {
    let m;
    while ((m = motif.exec(src))) trouves.push({ i: m.index, quoi });
  }
  // `toLocaleDateString()` / `toLocaleTimeString()` SANS `timeZone` rendent le
  // fuseau de la machine. Avec `timeZone`, la question est posée : pas un défaut.
  const locale = /new Date\(\s*\)\s*\.\s*toLocale\w*String\(([^)]*)\)/g;
  let m;
  while ((m = locale.exec(src))) {
    if (!/timeZone/.test(m[1])) {
      trouves.push({ i: m.index, quoi: 'toLocale…String() sans timeZone — fuseau de la machine' });
    }
  }
  // La forme indirecte : on nomme l'instant, puis on le lit en calendrier.
  const naissance = /(?:var|const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*new Date\(\s*\)/g;
  while ((m = naissance.exec(src))) {
    const v = m[1];
    const lu = new RegExp('\\b' + v + '\\.(?:getFullYear|getMonth|getDate|getDay|getHours|getMinutes)\\s*\\(');
    if (lu.test(src.slice(m.index, m.index + 400))) {
      trouves.push({ i: m.index, quoi: v + ' = new Date() puis lecture locale' });
    }
  }
  return trouves;
}

verifier('l’horloge de la machine n’est lue localement que dans la dette inscrite', () => {
  const nouveaux = [];
  const aggraves = [];
  const allegés = [];
  const compte = {};
  for (const f of APPLICATIF) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8')
      .split('\n').map(l => /^\s*(\/\/|\*|--)/.test(l) ? '' : l).join('\n');
    const trouves = lecturesLocalesDeLHorloge(src);
    if (!trouves.length) continue;
    compte[f] = trouves.length;
    const inscrit = DETTE_HORLOGE_MACHINE[f];
    if (inscrit === undefined) {
      const ou = trouves.slice(0, 3)
        .map(t => `${f}:${src.slice(0, t.i).split('\n').length}  ${t.quoi}`);
      nouveaux.push(ou.join('\n  ') + (trouves.length > 3 ? `\n  … et ${trouves.length - 3} autres` : ''));
    } else if (trouves.length > inscrit) {
      aggraves.push(`${f} : ${inscrit} inscrites, ${trouves.length} trouvées`);
    } else if (trouves.length < inscrit) {
      allegés.push(`${f} : ${inscrit} inscrites, ${trouves.length} restantes`);
    }
  }

  assert.deepStrictEqual(nouveaux, [],
    'L’horloge de l’appareil n’est pas celle de la station. Entre 20 h et minuit à ' +
    'Fort-de-France elle désigne DÉJÀ le lendemain, et `toISOString().slice(0, 10)` ' +
    'le fait TOUTE L’ANNÉE puisqu’il rend le calendrier UTC.\n' +
    'La primitive existe : `NexusStation.dateLocaleStation(timezone)`, le fuseau venant ' +
    'de `NexusStation.fuseauDeLaStation(siteId)`.\n' +
    'Et n’écrivez pas `param || new Date()…` : un défaut qui retombe sur l’horloge ' +
    'machine rend un mauvais jour EN SILENCE. Une absence de date se REFUSE, comme ' +
    'une absence de fuseau — c’est la règle déjà écrite sous `heureHHMMAujourdhui`.\n' +
    'Un instant gardé comme instant (`toISOString()` entier en `updated_at`) n’est ' +
    'PAS visé : un instant n’a pas de fuseau.\n  ' + nouveaux.join('\n  '));

  assert.deepStrictEqual(aggraves, [],
    'Ces fichiers portaient déjà la dette et l’ont AGGRAVÉE. Être inscrit au registre ' +
    'n’autorise pas à en ajouter : la dette ne peut que descendre.\n  ' + aggraves.join('\n  '));

  assert.deepStrictEqual(allegés, [],
    'Bonne nouvelle, et elle doit être ENREGISTRÉE : abaissez le chiffre dans ' +
    'DETTE_HORLOGE_MACHINE, sinon la dette cesse d’être mesurée et redevient une ' +
    'liste que plus personne ne lit.\n  ' + allegés.join('\n  '));

  const éteints = Object.keys(DETTE_HORLOGE_MACHINE).filter(f => !compte[f]);
  assert.deepStrictEqual(éteints, [],
    'Ces fichiers ne lisent plus l’horloge machine : retirez-les du registre.\n  ' +
    éteints.join('\n  '));
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
    // Ajoutée le 25/09/2026. Sa voisine était sous contrat depuis le 05/09 ;
    // elle, non — et c'est par là que le défaut est passé.
    ['nexus-carburant-commande-donnees-core.js', 'dateISOAujourdhui'],
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
