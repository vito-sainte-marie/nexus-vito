// S-4 — un seul « service courant », une seule définition.
//
// Avant ce lot : neuf lectures de `shifts`, quatre définitions concurrentes,
// et un seul lecteur sur neuf qui regardait `statut`. Tant que rien ne
// clôturait, elles convergeaient par accident. Depuis S-2 et S-3, les huit
// autres renverraient un service TERMINÉ comme s'il était actif.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCommentaires = t => t.split('\n').filter(l => !/^\s*(\/\/|\*|<!--)/.test(l)).join('\n');
const APPLICATIF = fs.readdirSync(RACINE).filter(f => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(f));

// Le corps d'une fonction, borné à la fonction SUIVANTE — une fenêtre en
// nombre de caractères déborderait sur la voisine et ferait échouer des
// assertions sur du code qui n'est pas celui qu'on examine.
function corpsDe(code, nom) {
  const i = code.indexOf('async function ' + nom);
  assert.ok(i !== -1, nom + ' introuvable');
  const j = code.indexOf('async function ', i + 10);
  return code.slice(i, j === -1 ? code.length : j);
}

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

verifier('la primitive existe et porte le contrat complet', () => {
  const code = sansCommentaires(lire('nexus-auth.js'));
  const corps = corpsDe(code, 'nexusServiceCourant');
  assert.ok(/\.eq\('employee_id', employee\.id\)/.test(corps), 'employé exigé');
  assert.ok(/\.eq\('site_id', employee\.site_id\)/.test(corps), 'site exigé');
  assert.ok(/\.eq\('statut', 'en_cours'\)/.test(corps), 'statut exigé');
  assert.ok(/order\('heure_debut', \{ ascending: false \}\)/.test(corps), 'tri sur le plus récent conservé');
});

verifier('la primitive ne contient AUCUN repli', () => {
  const code = sansCommentaires(lire('nexus-auth.js'));
  const corps = corpsDe(code, 'nexusServiceCourant');
  assert.ok(!/24 \* 60 \* 60 \* 1000/.test(corps), 'aucune fenêtre de 24 h');
  assert.ok(!/toISOString\(\)\.slice\(0, 10\)/.test(corps), 'aucune borne de journée');
  assert.ok(!/employee\.role/.test(corps), 'jamais le rôle habituel de la fiche');
  assert.ok(/return \{ aucun: true \}/.test(corps), 'l’absence est un état explicite');
});

verifier('plusieurs services ouverts sont signalés, jamais masqués', () => {
  const code = sansCommentaires(lire('nexus-auth.js'));
  const corps = corpsDe(code, 'nexusServiceCourant');
  assert.ok(/services\.length > 1/.test(corps), 'le cas multiple doit être détecté');
  assert.ok(/console\.error/.test(corps.slice(corps.indexOf('services.length > 1'))),
    'il doit être journalisé comme anomalie technique');
});

verifier('une seule lecture de `shifts` subsiste hors insertion et historique', () => {
  const lectures = [];
  for (const f of APPLICATIF) {
    lire(f).split('\n').forEach((ligne, i) => {
      if (/^\s*(\/\/|\*)/.test(ligne)) return;
      if (/from\('shifts'\)/.test(ligne)) lectures.push(`${f}:${i + 1}`);
    });
  }
  // Trois accès légitimes et trois seulement :
  //   nexus-auth.js                  → la primitive
  //   NEXUS-Prise-De-Poste-v1.html   → l'unique insert
  //   NEXUS-Missions-v1.html         → l'historique comparable, jamais le service courant
  assert.strictEqual(lectures.length, 3,
    'Neuf lectures devaient converger vers une primitive :\n  ' + lectures.join('\n  '));
  assert.ok(lectures.some(l => l.startsWith('nexus-auth.js')));
  assert.ok(lectures.some(l => l.startsWith('NEXUS-Prise-De-Poste-v1.html')));
  assert.ok(lectures.some(l => l.startsWith('NEXUS-Missions-v1.html')));
});

verifier('les sept consommateurs passent par la primitive', () => {
  for (const f of ['NEXUS-Pointage-v1.html', 'NEXUS-Missions-v1.html', 'NEXUS-Cockpit-v2.html',
                   'NEXUS-Brief-v1.html', 'NEXUS-Inventaire-v1.html', 'NEXUS-App-v1.html',
                   'nexus-auth.js']) {
    assert.ok(/nexusServiceCourant\(/.test(lire(f)), f + ' n’utilise pas la primitive');
  }
});

verifier('aucun repli temporel ne subsiste dans le chemin du service courant', () => {
  const coupables = [];
  for (const f of APPLICATIF) {
    const code = sansCommentaires(lire(f));
    // La fenêtre de 24 h a disparu partout où elle servait à décider du
    // service courant. Missions:397 est un historique, il n'en avait pas.
    if (/const il24h/.test(code)) coupables.push(`${f} : fenêtre de 24 h`);
  }
  assert.deepStrictEqual(coupables, [],
    'Un repli temporel ne doit plus décider du service courant :\n  ' + coupables.join('\n  '));
});

verifier('l’historique comparable de Missions est nommé comme tel', () => {
  const src = lire('NEXUS-Missions-v1.html');
  const i = src.indexOf('async function chargerDernierServiceComparable');
  // Le commentaire est réparti sur plusieurs lignes : on normalise les
  // marqueurs et les retours avant de chercher la phrase.
  const entete = src.slice(Math.max(0, i - 900), i).replace(/\s*\/\/\s*/g, ' ').replace(/\s+/g, ' ');
  assert.ok(/NE DÉTERMINE PAS LE SERVICE COURANT/.test(entete),
    'son rôle doit être explicite dans le code');
  assert.ok(/ni à autoriser une action, ni à rattacher une coche/.test(entete),
    'son interdiction d’usage doit être écrite');
});

verifier('la porte d’accès s’aligne sur le service réellement actif', () => {
  const code = sansCommentaires(lire('nexus-auth.js'));
  const corps = corpsDe(code, 'nexusPriseDePosteManquante');
  assert.ok(/nexusServiceCourant\(employee\)/.test(corps), 'la porte doit utiliser la primitive');
  assert.ok(!/gte\('heure_debut'/.test(corps), 'plus de borne de journée dans la porte');
  assert.ok(/if\(r\.erreur\)return false/.test(corps),
    'une panne de lecture ne doit pas enfermer l’employé hors de l’application');
});

console.log(`\n${passes} vérifications passées — le service courant a une seule définition.`);
