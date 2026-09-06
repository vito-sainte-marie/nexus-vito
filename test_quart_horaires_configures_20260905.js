// A3 / C2 — un quart ne se détermine que par l'heure locale de la station
// et le seuil configuré du site.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const g = {};
new Function('window', 'document', fs.readFileSync(path.join(RACINE, 'nexus-station.js'), 'utf8'))
  (g, { getElementById: () => null, createElement: () => ({ style: {}, setAttribute() {} }) });
const S = g.NexusStation;

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

verifier('minutesDepuisMinuit ne confond jamais minuit avec « absent »', () => {
  assert.strictEqual(S.minutesDepuisMinuit('00:00'), 0, 'minuit vaut 0, pas null');
  assert.strictEqual(S.minutesDepuisMinuit('12:40'), 760);
  assert.strictEqual(S.minutesDepuisMinuit('13:00'), 780);
  assert.strictEqual(S.minutesDepuisMinuit('23:59'), 1439);
  for (const mauvais of ['', null, undefined, '24:00', '12:60', '12h40', 'midi', 12.4]) {
    assert.strictEqual(S.minutesDepuisMinuit(mauvais), null, 'refusé : ' + String(mauvais));
  }
});

verifier('frontière du seuil : la minute exacte bascule, celle d’avant non', () => {
  const seuil = S.minutesDepuisMinuit('13:00'); // 780
  assert.strictEqual(S.quartDepuisMinutes(seuil - 1, seuil), '1', '12:59 -> quart 1');
  assert.strictEqual(S.quartDepuisMinutes(seuil, seuil), '2', '13:00 -> quart 2');
  assert.strictEqual(S.quartDepuisMinutes(seuil + 1, seuil), '2', '13:01 -> quart 2');
  assert.strictEqual(S.quartDepuisMinutes(0, seuil), '1', 'minuit -> quart 1');
  assert.strictEqual(S.quartDepuisMinutes(1439, seuil), '2', '23:59 -> quart 2');
});

verifier('l’ancien seuil 12:40 et le seuil configuré 13:00 ne donnent pas le même quart', () => {
  // La fenêtre 12:40–12:59 est exactement l'écart entre le repli supprimé et
  // la configuration du site de recette. C'est là que le défaut se voyait.
  const ancien = S.minutesDepuisMinuit('12:40');
  const configure = S.minutesDepuisMinuit('13:00');
  const aTreizeMoinsDix = S.minutesDepuisMinuit('12:50');
  assert.strictEqual(S.quartDepuisMinutes(aTreizeMoinsDix, ancien), '2', 'avec le repli : quart 2');
  assert.strictEqual(S.quartDepuisMinutes(aTreizeMoinsDix, configure), '1', 'avec la config : quart 1');
});

verifier('un seuil absent ne produit aucun quart — refus, pas repli', () => {
  assert.strictEqual(S.quartDepuisMinutes(700, null), null);
  assert.strictEqual(S.quartDepuisMinutes(700, S.minutesDepuisMinuit('')), null);
  assert.strictEqual(S.quartDepuisMinutes(NaN, 780), null);
});

verifier('fuseau de l’appareil ≠ fuseau de la station : c’est la station qui décide', () => {
  // Un instant unique, vu de deux endroits. Jusqu'ici NEXUS prenait l'heure
  // du téléphone : le même moment donnait deux quarts différents selon
  // l'endroit où se trouvait celui qui regardait.
  const instant = new Date('2026-09-05T16:30:00Z'); // 12:30 en Martinique, 18:30 à Paris
  const seuil = S.minutesDepuisMinuit('13:00');

  const station = S.minutesLocalesStation('America/Martinique', instant);
  const appareil = S.minutesLocalesStation('Europe/Paris', instant);
  assert.strictEqual(station, 12 * 60 + 30, 'heure de la station');
  assert.strictEqual(appareil, 18 * 60 + 30, 'heure de l’appareil');

  assert.strictEqual(S.quartDepuisMinutes(station, seuil), '1', 'la station est encore en quart 1');
  assert.strictEqual(S.quartDepuisMinutes(appareil, seuil), '2', 'l’appareil croirait le quart 2');
  assert.notStrictEqual(S.quartDepuisMinutes(station, seuil), S.quartDepuisMinutes(appareil, seuil),
    'le test perdrait tout son sens si les deux coïncidaient');
});

verifier('minutesLocalesStation exige un fuseau, elle n’en invente pas', () => {
  for (const mauvais of [undefined, null, '', '   ', 42]) {
    assert.throws(() => S.minutesLocalesStation(mauvais), TypeError, 'refusé : ' + String(mauvais));
  }
});

verifier('aucun seuil de bascule en dur ne décide plus d’un quart', () => {
  const fichiers = fs.readdirSync(RACINE).filter(f => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(f));
  const coupables = [];
  for (const f of fichiers) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    // On cherche une détermination de quart appuyée sur une constante.
    const i = src.indexOf('function quartDuMoment');
    if (i === -1) continue;
    const corps = src.slice(i, i + 1400);
    const nu = corps.split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    if (/['"]\d{1,2}:\d{2}['"]/.test(nu) || /getHours\(\)\s*<\s*\d/.test(nu)) {
      coupables.push(`${f}  quartDuMoment contient un seuil en dur`);
    }
  }
  assert.deepStrictEqual(coupables, [], coupables.join('\n  '));
});

// C2-3 — le balayage qui remplace la relecture : aucun chemin décidant d'un
// quart ne doit plus lire l'horloge de l'appareil.
verifier('aucune horloge d’appareil ne décide plus d’un quart', () => {
  const CHEMINS = {
    'NEXUS-Inventaire-v1.html': ['quartDuMoment'],
    'NEXUS-Inventaire-Manager-v1.html': ['quartDuMoment', 'libelleEtatQuart'],
    'nexus-inventaire-manager-donnees.js': ['quartDuMoment'],
    'NEXUS-FDJ-v1.html': ['quartDuMoment', 'accesQuart'],
    'NEXUS-Prise-De-Poste-v1.html': ['quartDuMoment'],
    'nexus-horizon-operationnel.js': ['horizonDepuisJours'],
  };
  const coupables = [];
  for (const [fichier, fonctions] of Object.entries(CHEMINS)) {
    const src = fs.readFileSync(path.join(RACINE, fichier), 'utf8');
    for (const fn of fonctions) {
      const i = src.indexOf('function ' + fn);
      assert.ok(i !== -1, fn + ' introuvable dans ' + fichier);
      const corps = src.slice(i, i + 1600).split('\n')
        .filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
      if (/getHours\(\)|getMinutes\(\)/.test(corps)) coupables.push(`${fichier} :: ${fn}`);
      if (/['"]\d{1,2}:\d{2}['"]/.test(corps)) coupables.push(`${fichier} :: ${fn} (seuil en dur)`);
    }
  }
  assert.deepStrictEqual(coupables, [],
    'L’heure de l’appareil ne détermine jamais un quart :\n  ' + coupables.join('\n  '));
});

verifier('tous les chemins passent par l’heure de la station', () => {
  // Mis à jour le 05/09/2026, lot Verify : l'assemblage de la règle a été
  // réuni dans NexusStation.quartConfigureDuMoment. Un écran satisfait donc
  // l'exigence soit en appelant l'heure de la station lui-même, soit en
  // déléguant à la règle commune — mais pas autrement.
  const ADMIS = /minutesLocalesStation\(|quartConfigureDuMoment\(/;
  for (const f of ['NEXUS-Inventaire-v1.html', 'NEXUS-Inventaire-Manager-v1.html',
                   'nexus-inventaire-manager-donnees.js', 'NEXUS-FDJ-v1.html',
                   'NEXUS-Prise-De-Poste-v1.html', 'NEXUS-Verify-v1.html']) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    assert.ok(ADMIS.test(src), f + ' ne passe ni par l’heure de la station ni par la règle commune');
  }
  // Et la règle commune, elle, doit bien s'appuyer sur l'heure de la station :
  // sans cette assertion, déléguer suffirait à satisfaire le test sans que
  // personne ne lise jamais l'heure du bon fuseau.
  const regle = fs.readFileSync(path.join(RACINE, 'nexus-station.js'), 'utf8');
  const i = regle.indexOf('async function quartConfigureDuMoment');
  assert.ok(i !== -1, 'la règle commune doit exister');
  const corps = regle.slice(i);
  assert.ok(/minutesLocalesStation\(timezone, instant\)/.test(corps),
    'la règle commune compare l’heure de la STATION au seuil');
  assert.ok(/from\('station_config'\)\.select\('horaires'\)/.test(corps),
    'la règle commune lit le seuil CONFIGURÉ');
  assert.ok(!/getHours\(\)|getMinutes\(\)|['"]\d{1,2}:\d{2}['"]/.test(corps),
    'ni horloge d’appareil ni seuil en dur dans la règle commune');
});

verifier('la règle du quart n’existe qu’en un seul exemplaire', () => {
  // Verify proposait le premier `<option>` de son DOM faute de règle, et
  // quatre écrans en portaient chacun une copie. Corriger Verify par une
  // cinquième copie aurait ajouté un endroit de plus où la règle peut
  // diverger le jour où le seuil du site change.
  const COPIES = [];
  for (const f of fs.readdirSync(RACINE).filter(x => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(x))) {
    if (f === 'nexus-station.js') continue;
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    // Un assemblage local, c'est lire le seuil configuré ET décider soi-même.
    if (/select\('horaires'\)/.test(src) && /quartDepuisMinutes\(/.test(src)) COPIES.push(f);
  }
  assert.deepStrictEqual(COPIES, [],
    'ces fichiers réassemblent la règle au lieu d’appeler NexusStation :\n  ' + COPIES.join('\n  '));
});

// Ajouté le 05/09/2026 après une régression trouvée sur le déploiement réel :
// la réécriture C2-2 avait remplacé le vocabulaire d'Inventaire ('matin' /
// 'soir') par celui de la primitive ('1' / '2'), et la contrainte
// inventaire_plans_comptage_quart_check rejetait alors tout plan de comptage.
// Aucun test ne gardait ce vocabulaire — d'où celui-ci.
verifier('chaque écran conserve SON vocabulaire de quart', () => {
  // La primitive est neutre : elle rend '1' / '2'. Les écrans qui écrivent en
  // base dans le vocabulaire « matin » / « soir » doivent donc TRADUIRE ;
  // ceux qui parlent déjà '1' / '2' laissent passer.
  const TRADUISENT = ['NEXUS-Inventaire-v1.html', 'nexus-inventaire-manager-donnees.js',
                      'NEXUS-Prise-De-Poste-v1.html'];
  const LAISSENT_PASSER = ['NEXUS-FDJ-v1.html'];
  const corpsDe = (fichier) => {
    const src = fs.readFileSync(path.join(RACINE, fichier), 'utf8');
    const i = src.indexOf('function quartDuMoment');
    assert.ok(i !== -1, 'quartDuMoment introuvable dans ' + fichier);
    return src.slice(i, i + 1800);
  };
  for (const f of TRADUISENT) {
    const corps = corpsDe(f);
    assert.ok(/'matin'/.test(corps) && /'soir'/.test(corps),
      `${f} : quartDuMoment doit traduire en 'matin' / 'soir' — la contrainte en base l’exige`);
    assert.ok(/quart === '1' \? 'matin'/.test(corps),
      `${f} : la traduction doit être explicite depuis la primitive`);
  }
  for (const f of LAISSENT_PASSER) {
    const corps = corpsDe(f);
    assert.ok(!/'matin'|'soir'/.test(corps),
      `${f} : cet écran parle '1' / '2', il ne doit pas traduire`);
    // Depuis le lot Verify, un écran peut décider lui-même avec la primitive
    // pure OU déléguer à la règle commune. Ce qu'il ne peut pas faire, c'est
    // trancher par un moyen à lui — et c'est ce que cette assertion garde.
    assert.ok(/quartDepuisMinutes\(|quartConfigureDuMoment\(/.test(corps),
      `${f} : le quart doit venir de la primitive ou de la règle commune`);
  }
});

// C2-4 — un réglage qu'on retire du code doit disparaître de PARTOUT :
// lecteur, formulaire, écriture. Sinon on a fait du cosmétique.
verifier('les réglages horaires retirés ne sont plus lus, ni affichés, ni écrits', () => {
  const RETIRES = ['horaire_bascule_quart2_repli', 'HORAIRES_DEFAUT_RAPPEL', 'paramHoraireRepli'];
  const survivants = [];
  const APPLICATIF = fs.readdirSync(RACINE)
    .filter(f => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(f));
  for (const f of APPLICATIF) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    src.split('\n').forEach((ligne, i) => {
      // Les commentaires gardent la mémoire du retrait : c'est voulu.
      if (/^\s*(\/\/|\*|<!--)/.test(ligne)) return;
      for (const mot of RETIRES) {
        if (ligne.includes(mot)) survivants.push(`${f}:${i + 1}  ${mot}`);
      }
    });
  }
  assert.deepStrictEqual(survivants, [],
    'Un réglage retiré du code ne doit subsister nulle part :\n  ' + survivants.join('\n  '));
});

console.log(`\n${passes} vérifications passées — le quart vient de la station, pas de l'appareil.`);
