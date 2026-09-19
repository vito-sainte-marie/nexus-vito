#!/usr/bin/env node
// LE JOUR D'UN POINTAGE VIENT DU SITE, PAS DU TÉLÉPHONE (19/09/2026).
//
// LE DÉFAUT. `NEXUS-Pointage-v1.html` datait tout — la colonne `date` des
// deux écritures, la lecture de l'historique, le tableau de l'équipe, le
// rattachement au service — avec `dateISOLocale`, qui lisait
// getFullYear/getMonth/getDate : le calendrier de L'APPAREIL.
//
// Un pointage fait à 21 h à Sainte-Marie depuis un téléphone resté réglé sur
// Paris (ou sur UTC, comme l'est un navigateur en machine virtuelle) était
// écrit au LENDEMAIN. La ligne existait bien en base, mais dans une journée
// que plus personne ne relisait : l'historique du jour ne la montrait plus,
// les boutons se rouvraient comme si rien n'avait été pointé, et le manager
// ne la voyait pas dans son tableau d'équipe. `NEXUS-Missions-v1.html` avait
// subi puis corrigé exactement cela le 18/09 ; Pointage était resté dessus.
//
// CE QUE CETTE ÉPREUVE JUGE. Pas un texte : le COMPORTEMENT des fonctions
// réellement embarquées, extraites du source de la page et de `nexus-auth.js`
// puis exécutées. Chaque garde est doublée d'une MUTATION qui rejoue
// l'ancienne règle et doit, elle, échouer — sans quoi la garde ne prouverait
// rien (voir les quatre gardes vertes et inutiles du 08/09).

'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passes = 0, total = 0;
function t(nom, fn) {
  total++;
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
}

const RACINE = __dirname;
const POINTAGE = fs.readFileSync(path.join(RACINE, 'NEXUS-Pointage-v1.html'), 'utf8');
const AUTH = fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8');

/** Extrait une fonction d'un source et la rend appelable, prélude compris. */
function fonctionDe(source, nom, prelude = '', indent = '  ') {
  const m = source.match(new RegExp(`(?:async )?function ${nom}\\([\\s\\S]*?\\n${indent}\\}`));
  assert.ok(m, `fonction ${nom} introuvable — l'épreuve ne juge plus rien`);
  return new Function(`${prelude}\n${m[0]}\nreturn ${nom};`)();
}

// La primitive canonique, prise dans nexus-auth.js et NON réécrite ici :
// c'est elle que `nexusServiceCourant` emploie déjà pour décider quel service
// est celui du jour. Si Pointage en employait une autre, les deux se
// contrediraient tôt ou tard.
const JOUR_DANS_FUSEAU_SRC = AUTH.match(/function nexusJourDansFuseau\([\s\S]*?\n\}/)[0];
assert.ok(/NEXUS_FUSEAU_DEFAUT/.test(JOUR_DANS_FUSEAU_SRC));
const PRELUDE = `const NEXUS_FUSEAU_DEFAUT = 'America/Martinique';\n${JOUR_DANS_FUSEAU_SRC}`;

// L'INSTANT DU DÉFAUT : 21:25 le 11/09 à Sainte-Marie (GMT-4), donc 01:25 le
// 12/09 en UTC. Un appareil européen ou UTC dit « demain » ; le site, lui,
// est encore au 11.
const CE_SOIR = new Date('2026-09-12T01:25:00Z');
const JOUR_DU_SITE = '2026-09-11';

// LES MESURES ASYNCHRONES SONT PRISES AVANT TOUTE GARDE, ET PAS DANS UNE.
// `t` n'attend pas ce qu'on lui donne : une garde `async` lui rendrait une
// promesse, il compterait la réussite immédiatement, et une assertion rompue
// ne rougirait jamais — une garde verte qui ne juge rien, comme les quatre du
// 08/09. On résout d'abord, on juge ensuite.
//
// `jourStationDe` est extraite du source de la page et jouée pour de vrai, la
// seule dépendance fournie étant le fuseau du site : c'est donc bien le code
// embarqué qui répond ici, pas une reformulation de l'épreuve.
const jourStationDe = fonctionDe(POINTAGE, 'jourStationDe',
  `${PRELUDE}\nasync function nexusFuseauSite(){ return 'America/Martinique'; }`);

const MESURES = {};
async function prendreLesMesures() {
  MESURES.duSoir = await jourStationDe('vito-sainte-marie', CE_SOIR);
  MESURES.avecRepli = await fonctionDe(POINTAGE, 'jourStationDe',
    `${PRELUDE}\nasync function nexusFuseauSite(){ return NEXUS_FUSEAU_DEFAUT; }`
  )('site-sans-config', CE_SOIR);
}

function jouerLesGardes() {
console.log('\n── 1 · Le jour métier se calcule dans le fuseau du site ──');

t('un pointage du soir reste daté du jour du site', () => {
  assert.strictEqual(MESURES.duSoir, JOUR_DU_SITE);
});

t('MUTATION : le calendrier de l\'appareil, lui, le datait du lendemain', () => {
  // `dateISOLocale`, mot pour mot telle qu'elle vivait dans la page avant ce
  // lot. Jouée sous un fuseau européen — le cas relevé — elle bascule.
  const ancienTZ = process.env.TZ;
  process.env.TZ = 'Europe/Paris';
  try {
    const dateISOLocale = (d) => {
      const x = d || new Date();
      const p = n => String(n).padStart(2, '0');
      return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
    };
    assert.notStrictEqual(dateISOLocale(CE_SOIR), JOUR_DU_SITE,
      'l\'ancienne règle rend le même jour que la nouvelle : la garde ne mord pas');
  } finally { process.env.TZ = ancienTZ; }
});

t('un fuseau inconnu ne fait échouer aucun pointage', () => {
  // DATER ne doit bloquer personne : `nexusFuseauSite` replie, et c'est
  // délibéré (là où CALCULER UN RETARD, lui, refuse de replier — §3).
  assert.strictEqual(MESURES.avecRepli, JOUR_DU_SITE);
});

t('sans instant fourni, c\'est l\'horloge qui est relue', () => {
  const src = POINTAGE.match(/async function jourStationDe\([\s\S]*?\n  \}/)[0];
  assert.ok(/instant \|\| new Date\(\)/.test(src),
    'un jour figé au chargement ne changerait pas à minuit sur une session laissée ouverte');
});

console.log('\n── 2 · La page n\'a plus aucun calendrier d\'appareil ──');

t('`dateISOLocale` a disparu du code de la page', () => {
  const sansCommentaires = POINTAGE.replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/dateISOLocale/.test(sansCommentaires),
    'le calendrier de l\'appareil est encore appelé quelque part');
});

t('aucune date n\'est fabriquée à la main dans la page', () => {
  const sansCommentaires = POINTAGE.replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/getFullYear\(\)/.test(sansCommentaires),
    'une conversion locale artisanale a été réintroduite');
  assert.ok(!/new Date\(\)\.toISOString\(\)\.slice\(0, ?10\)/.test(sansCommentaires),
    'un jour UTC est employé comme jour métier — c\'est le même défaut par l\'autre bout');
});

t('chaque `today` de la page vient du site', () => {
  const affectations = POINTAGE.match(/const today = [^\n]*/g) || [];
  assert.ok(affectations.length >= 4,
    `seulement ${affectations.length} jour(s) métier trouvé(s) — l'épreuve ne couvre plus l'écran`);
  affectations.forEach(l => assert.ok(/await jourStationDe\(siteId/.test(l),
    `un jour métier échappe au fuseau du site : ${l.trim()}`));
});

console.log('\n── 3 · Écrire et relire la même journée ──');

const CORPS_ENREGISTRER = POINTAGE.match(/async function enregistrerPointage\([\s\S]*?\n  \}\n/)[0];

t('la colonne `date` écrite est le jour du site à l\'instant retenu', () => {
  assert.ok(/const today = await jourStationDe\(siteId, heureRetenue\)/.test(CORPS_ENREGISTRER),
    'le pointage n\'est plus daté avec l\'heure effectivement retenue');
  const dates = (CORPS_ENREGISTRER.match(/date: today/g) || []).length;
  assert.strictEqual(dates, 2,
    `${dates} écriture(s) portent \`date: today\` — la clôture de pause et le pointage principal en attendent 2`);
});

t('le jour d\'écriture et le jour de relecture sont le même', () => {
  // C'EST LA COHÉRENCE CRUCIALE. Un pointage écrit au jour du site mais relu
  // au jour de l'appareil ferait disparaître l'historique et rouvrirait les
  // boutons : exactement la panne qu'on corrige, déplacée d'un cran.
  ['afficherEquipeManager', 'afficherFormulairePointage', 'chargerActiviteJour']
    .forEach(nom => {
      const corps = POINTAGE.match(new RegExp(`async function ${nom}\\([\\s\\S]*?\\n  \\}\\n`))[0];
      assert.ok(/const today = await jourStationDe\(siteId\)/.test(corps),
        `${nom} relit une autre journée que celle qui a été écrite`);
    });
});

t('l\'historique du jour est bien lu par `date`, et c\'est voulu', () => {
  assert.ok(/\.eq\('date', today\)/.test(POINTAGE),
    'la lecture par journée a disparu — l\'employée ne voit plus son contexte du jour');
});

console.log('\n── 4 · Le service de référence se juge dans le même fuseau ──');

const serviceDuJourSeulement = fonctionDe(POINTAGE, 'serviceDuJourSeulement');
const jourMartinique = d => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Martinique', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(d);

t('le découpeur de jours est INJECTÉ, comme dans le module de règles', () => {
  const src = POINTAGE.match(/function serviceDuJourSeulement\([^)]*\)/)[0];
  assert.ok(/jourDeService/.test(src),
    'la fonction lit de nouveau une horloge — elle n\'est plus comparable au module');
});

t('un service ouvert le soir reste le service du jour', () => {
  const service = { id: 's1', heure_debut: CE_SOIR.toISOString() };
  assert.strictEqual(serviceDuJourSeulement(service, JOUR_DU_SITE, jourMartinique), service);
});

t('MUTATION : converti au fuseau de l\'appareil, il était rejeté', () => {
  const service = { id: 's1', heure_debut: CE_SOIR.toISOString() };
  const jourParis = d => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  assert.strictEqual(serviceDuJourSeulement(service, JOUR_DU_SITE, jourParis), null,
    'les deux découpages rendent le même verdict : la garde ne prouve rien');
});

t('AUCUN appel de la page ne se passe du découpeur', () => {
  // La garde précédente ne surveillait QUE l'écriture. Une mutation l'a
  // prouvé le 19/09 : en retirant `jourDeService` des DEUX appels de
  // lecture, l'épreuve restait verte alors que la page était cassée. On
  // compte donc les appels et on exige que chacun porte ses trois arguments.
  const appels = [];
  const re = /serviceDuJourSeulement\(/g;
  let m;
  while ((m = re.exec(POINTAGE))) {
    if (/function\s*$/.test(POINTAGE.slice(Math.max(0, m.index - 10), m.index))) continue;
    let i = m.index + m[0].length, prof = 1, virgules = 0;
    for (; i < POINTAGE.length && prof > 0; i++) {
      const c = POINTAGE[i];
      if (c === '(') prof++;
      else if (c === ')') prof--;
      else if (c === ',' && prof === 1) virgules++;
    }
    appels.push(virgules + 1);
  }
  assert.ok(appels.length >= 3,
    `seulement ${appels.length} appel(s) trouvé(s) — la garde a perdu sa cible`);
  assert.ok(appels.every(n => n === 3),
    `un appel juge le service sans découpeur : arguments comptés ${appels.join(', ')}`);
});

t('le service écrit en base passe par le même découpeur', () => {
  assert.ok(/serviceDuJourSeulement\(shiftActif, today, await decoupeurDeJours\(siteId\)\)/
    .test(CORPS_ENREGISTRER),
    'l\'écriture rattache le pointage à un service jugé dans un autre fuseau que sa date');
});

console.log('\n── 5 · Dater n\'est pas calculer un retard ──');

const CORPS_RETARD = POINTAGE.match(/async function retardDeLArrivee\([\s\S]*?\n  \}\n/)[0];

t('le retard exige toujours `sites.timezone`, sans repli', () => {
  // Mandat 33 : NEXUS ne doit jamais confondre 0 minute de retard avec un
  // retard impossible à calculer. `fuseauDuSite` passe par NexusStation, qui
  // REFUSE de replier — au contraire de `nexusFuseauSite`, qui date.
  assert.ok(/const fuseau = await fuseauDuSite\(affectation\.site\)/.test(CORPS_RETARD),
    'le calcul du retard s\'appuie sur un fuseau qui peut être deviné');
  assert.ok(!/nexusFuseauSite/.test(CORPS_RETARD),
    'le lecteur à repli s\'est glissé dans le calcul du retard — il y produirait un faux chiffre');
  assert.ok(/if \(!fuseau\) return null;/.test(CORPS_RETARD),
    'un fuseau indéterminé ne fait plus renoncer le calcul');
});

t('deux journées qui divergent font renoncer, et ne concluent pas 0', () => {
  assert.ok(/dateLocaleStation\(fuseau, heureRetenue\) !== jourDuPointage\) return null;/
    .test(CORPS_RETARD),
    'la garde des deux jours a disparu : un transfert de fuseau, ou un désaccord entre ' +
    '`station_config.fuseau_horaire` et `sites.timezone`, produirait un retard faux');
  const avant = CORPS_RETARD.indexOf('dateLocaleStation(fuseau, heureRetenue)');
  const apres = CORPS_RETARD.indexOf('heureDebutDue(');
  assert.ok(avant > 0 && avant < apres,
    'la garde s\'exécute après la lecture de l\'horaire dû : elle ne protège plus la soustraction');
});

t('aucun `return 0` ne se cache dans le calcul', () => {
  assert.ok(!/return 0;/.test(CORPS_RETARD),
    '0 minute de retard est de nouveau affirmé là où rien n\'a été mesuré');
});

}

// ── Conclusion ───────────────────────────────────────────────────────────
// Les deux mesures sont prises AVANT que la moindre garde ne soit jouée, et
// une mesure qui échoue n'est pas une épreuve verte : c'est une épreuve qui
// n'a pas eu lieu, et elle doit rougir.
prendreLesMesures().then(jouerLesGardes).catch(e => {
  console.error(`  ✗ les mesures n'ont pas pu être prises\n    ${e && e.stack}`);
  process.exitCode = 1;
}).finally(() => {
  if (total === 0) process.exitCode = 1;
  console.log(`\n${passes}/${total} vérification(s) passées — le jour d'un pointage vient du site.`);
});
