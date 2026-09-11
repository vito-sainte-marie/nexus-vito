#!/usr/bin/env node
// Une employée qui ne prend pas de pause doit pouvoir partir.
//
// LE DÉFAUT, relevé le 11/09/2026 en parcourant NEXUS en caissière, et
// mesuré ensuite sur Production. L'écran de pointage n'ouvrait QUE l'étape
// suivante de ORDRE_TYPES :
//
//     const prochainType = ORDRE_TYPES.find(t => !dejaFait[t]);
//     const bloque = !fait && !estProchain;
//
// Après l'arrivée, le seul bouton actif était « Début pause ». « Départ »
// restait désactivé. Une employée qui ne prend pas de pause — ou qui oublie
// de la pointer — ne pouvait PAS pointer son départ, et son quart restait
// ouvert jusqu'à ce qu'une migration le ferme en clos_sans_pointage.
//
// Ce que Production dit de ce mécanisme, sur ses 92 pointages : 48 journées
// arrêtées sur la seule arrivée, contre 11 menées jusqu'au départ, et plus
// aucun pointage depuis le 30/08/2026.
//
// CETTE ÉPREUVE JUGE LE COMPORTEMENT, pas le texte : elle évalue les
// fonctions réellement embarquées dans la page, extraites de son source, et
// rejoue l'ANCIENNE règle en mutation pour prouver qu'elle mordait.

'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passes = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
}

const RACINE = __dirname;
const POINTAGE = fs.readFileSync(path.join(RACINE, 'NEXUS-Pointage-v1.html'), 'utf8');
const PRISE = fs.readFileSync(path.join(RACINE, 'NEXUS-Prise-De-Poste-v1.html'), 'utf8');

/** Extrait une fonction du source de la page et la rend appelable. */
function fonctionDeLaPage(source, nom, prelude = '') {
  const m = source.match(new RegExp(`function ${nom}\\([\\s\\S]*?\\n  \\}`));
  assert.ok(m, `fonction ${nom} introuvable — l'épreuve ne juge plus rien`);
  return new Function(`${prelude}\n${m[0]}\nreturn ${nom};`)();
}

const pointageDisponible = fonctionDeLaPage(POINTAGE, 'pointageDisponible');
const pauseEnCours = fonctionDeLaPage(POINTAGE, 'pauseEnCours');
const dateISOLocaleSrc = POINTAGE.match(/function dateISOLocale\([\s\S]*?\n  \}/)[0];
const serviceDuJourSeulement = fonctionDeLaPage(POINTAGE, 'serviceDuJourSeulement', dateISOLocaleSrc);

// ── Le cœur : partir sans pause ────────────────────────────────────────────

t('après l\'arrivée seule, le DÉPART est possible', () => {
  assert.strictEqual(pointageDisponible('depart', { arrivee: {} }), true,
    'le départ reste inatteignable sans pause — le défaut est intact');
});

t('MUTATION : l\'ancienne règle, elle, l\'interdisait', () => {
  // Sans ce témoin, l'épreuve ci-dessus passerait aussi sur un écran qui
  // n'aurait jamais eu le défaut — elle ne prouverait pas qu'on l'a réparé.
  const ORDRE = ['arrivee', 'pause_debut', 'pause_fin', 'depart'];
  const ancienneRegle = (type, dejaFait) => {
    const prochain = ORDRE.find(x => !dejaFait[x]);
    return !(!dejaFait[type] && type !== prochain) && !dejaFait[type];
  };
  assert.strictEqual(ancienneRegle('depart', { arrivee: {} }), false,
    'la mutation ne reproduit pas le défaut : elle ne prouve rien');
  assert.notStrictEqual(pointageDisponible('depart', { arrivee: {} }),
    ancienneRegle('depart', { arrivee: {} }),
    'la règle actuelle se comporte comme l\'ancienne');
});

t('la pause garde sa séquence : pas de fin sans début', () => {
  assert.strictEqual(pointageDisponible('pause_fin', { arrivee: {} }), false);
  assert.strictEqual(pointageDisponible('pause_fin', { arrivee: {}, pause_debut: {} }), true);
});

t('on ne pointe rien avant d\'être arrivée', () => {
  assert.strictEqual(pointageDisponible('depart', {}), false);
  assert.strictEqual(pointageDisponible('pause_debut', {}), false);
  assert.strictEqual(pointageDisponible('arrivee', {}), true);
});

t('rien ne se pointe deux fois le même jour', () => {
  for (const type of ['arrivee', 'pause_debut', 'pause_fin', 'depart']) {
    assert.strictEqual(pointageDisponible(type, { [type]: {} }), false, `${type} repointable`);
  }
});

t('une fois partie, la journée est close — plus aucune pause', () => {
  const partie = { arrivee: {}, depart: {} };
  assert.strictEqual(pointageDisponible('pause_debut', partie), false);
  assert.strictEqual(pointageDisponible('pause_fin', partie), false);
});

t('partir avec une pause ouverte reste POSSIBLE, et détectable', () => {
  // Possible : on ne bloque pas. Détectable : l'écran doit pouvoir le dire.
  const pauseOuverte = { arrivee: {}, pause_debut: { heure: '10:43:33' } };
  assert.strictEqual(pointageDisponible('depart', pauseOuverte), true);
  assert.strictEqual(pauseEnCours(pauseOuverte), true);
  assert.strictEqual(pauseEnCours({ arrivee: {}, pause_debut: {}, pause_fin: {} }), false);
  assert.strictEqual(pauseEnCours({ arrivee: {} }), false);
});

t('l\'écran avertit avant un départ sur pause ouverte, sans l\'empêcher', () => {
  const bloc = POINTAGE.match(/if \(type === 'depart' && pauseEnCours\(dejaFait\)\) \{[\s\S]*?\n        \}/);
  assert.ok(bloc, 'aucune consigne avant le départ sur pause ouverte');
  assert.ok(/window\.confirm/.test(bloc[0]), 'la consigne ne demande rien à l\'employée');
  assert.ok(/if \(!window\.confirm\(message\)\) return;/.test(bloc[0]),
    'la consigne n\'offre pas de renoncer');
  assert.ok(!/disabled|return false/.test(bloc[0].replace(/window\.confirm[\s\S]*/, '')),
    'la consigne bloque au lieu d\'avertir');
});

t('aucune durée minimale de pause n\'est introduite', () => {
  // Règle métier et de paie : elle appartient à Frédéric Bragance. Ce lot
  // n'a pas à la deviner, et une valeur glissée ici passerait inaperçue.
  const suspects = POINTAGE.match(/DUREE_MIN[A-Z_]*\s*=|pauseMinimale|dureeMinimale|minutesMinimum/g) || [];
  assert.deepStrictEqual(suspects, [], `durée de pause fixée dans le code : ${suspects.join(', ')}`);
});

// ── Les six parcours canoniques (arbitrage Frédéric Bragance, 11/09/2026) ──

t('parcours : arrivée → départ, autorisé', () => {
  assert.strictEqual(pointageDisponible('depart', { arrivee: {} }), true);
});

t('parcours : arrivée → début → fin → départ, autorisé', () => {
  assert.strictEqual(pointageDisponible('pause_debut', { arrivee: {} }), true);
  assert.strictEqual(pointageDisponible('pause_fin', { arrivee: {}, pause_debut: {} }), true);
  assert.strictEqual(pointageDisponible('depart', { arrivee: {}, pause_debut: {}, pause_fin: {} }), true);
});

t('parcours : départ sur pause ouverte → fin de pause ET départ, séparément', () => {
  // Règle 6 : la pause est terminée à l'heure du départ, puis le départ est
  // enregistré. Deux lignes, pas une. Et l'heure de fin est celle du départ,
  // jamais une estimation (règle 7).
  const bloc = POINTAGE.match(/if \(type === 'depart' && cloturerPauseAuDepart\) \{[\s\S]*?\n    \}/);
  assert.ok(bloc, 'aucune clôture de pause à l\'heure du départ');
  assert.ok(/type: 'pause_fin', heure,/.test(bloc[0]),
    'la fin de pause n\'est pas écrite à l\'heure du départ');
  assert.ok(POINTAGE.indexOf("type: 'pause_fin', heure,") < POINTAGE.indexOf("const ligne = {"),
    'la fin de pause n\'est pas écrite AVANT le départ');
  assert.ok(/photo_url: null/.test(bloc[0]), 'la fin de pause emporte une photo');
});

t('parcours : départ sans arrivée, refusé', () => {
  assert.strictEqual(pointageDisponible('depart', {}), false);
});

t('parcours : fin de pause sans début, refusée', () => {
  assert.strictEqual(pointageDisponible('pause_fin', {}), false);
  assert.strictEqual(pointageDisponible('pause_fin', { arrivee: {} }), false);
});

t('aucune pause fictive n\'est créée lors d\'un départ direct', () => {
  // Le témoin qui compte pour la règle 4 : l'absence de pause n'est ni une
  // erreur ni une donnée manquante. Rien ne doit être écrit pour la combler.
  const corps = POINTAGE.match(/async function enregistrerPointage\([\s\S]*?\n  \}\n/)[0];
  const ecrituresPause = corps.match(/type: 'pause_(debut|fin)'/g) || [];
  assert.deepStrictEqual(ecrituresPause, ["type: 'pause_fin'"],
    `écritures de pause dans l'enregistrement : ${ecrituresPause.join(', ')} — une seule est attendue, et sous confirmation`);
  assert.ok(/if \(type === 'depart' && cloturerPauseAuDepart\)/.test(corps),
    'la seule écriture de pause n\'est pas conditionnée à la confirmation de l\'employée');
  assert.ok(!/pause_debut'[,)]?\s*$/m.test(corps.replace(/\/\/.*$/gm, '')),
    'un début de pause peut être écrit rétroactivement');
});

t('le drapeau de clôture ne survit jamais d\'un pointage au suivant', () => {
  const corps = POINTAGE.match(/async function enregistrerPointage\([\s\S]*?\n  \}\n/)[0];
  const remises = (corps.match(/cloturerPauseAuDepart = false/g) || []).length;
  assert.ok(remises >= 2,
    `le drapeau n'est remis à faux que ${remises} fois : il peut fuir vers le pointage suivant`);
});

// ── Le service de référence ────────────────────────────────────────────────

t('un quart ouvert la VEILLE n\'est plus le service du jour', () => {
  const hier = { heure_debut: '2026-09-10T21:25:41Z', quart: 'soir' };
  assert.strictEqual(serviceDuJourSeulement(hier, '2026-09-11'), null,
    'le quart de la veille sert encore de référence — le retard de 1028 min revient');
});

t('un quart ouvert le jour même reste la référence', () => {
  const aujourdhui = { heure_debut: new Date().toISOString(), quart: 'matin' };
  const jour = new Date().toISOString().slice(0, 10);
  const rendu = serviceDuJourSeulement(aujourdhui, jour);
  // La date locale peut différer de la date UTC en soirée : on ne juge que
  // la cohérence avec ce que la page calcule elle-même.
  if (rendu !== null) assert.strictEqual(rendu, aujourdhui);
});

t('sans service ouvert, aucune référence n\'est inventée', () => {
  assert.strictEqual(serviceDuJourSeulement(null, '2026-09-11'), null);
  assert.strictEqual(serviceDuJourSeulement({ quart: 'soir' }, '2026-09-11'), null);
});

t('le retard et le quart écrits en base suivent le service DU JOUR', () => {
  // On juge le CORPS de la fonction qui écrit, pas le fichier entier : les
  // autres écrans lisent légitimement retard_min ailleurs, et un grep global
  // mélangerait les deux.
  const corps = POINTAGE.match(/async function enregistrerPointage\([\s\S]*?\n  \}\n/);
  assert.ok(corps, 'enregistrerPointage introuvable — l\'épreuve ne juge plus rien');
  const apres = corps[0].split('const serviceDuJour =');
  assert.strictEqual(apres.length, 2, 'le service du jour n\'est plus résolu avant l\'écriture');
  // La ligne de résolution elle-même a le droit de nommer shiftActif : c'est
  // son argument. Ce qui suit, non.
  const suite = apres[1].split('\n').slice(1).join('\n');
  assert.ok(!/shiftActif/.test(suite),
    'shiftActif est encore lu APRÈS la résolution du service du jour : le quart de la veille peut revenir');
  // On vise l'écriture du pointage DEMANDÉ, pas celle de la clôture de pause
  // qui la précède et porte, elle, des valeurs littérales assumées.
  const principal = suite.slice(suite.indexOf("const ligne = {"));
  for (const champ of ['retard_min:', 'quart:', 'heure_debut_quart:']) {
    const ligne = principal.split('\n').find(l => l.trim().startsWith(champ));
    assert.ok(ligne, `${champ} n'est plus écrit`);
    assert.ok(/serviceDuJour|retardMin/.test(ligne), `${champ} ne suit pas le service du jour`);
  }
});

// ── Réconciliation et doublons ────────────────────────────────────────────

t('aucun voile de caméra ne survit à un enregistrement', () => {
  assert.ok(/document\.querySelectorAll\('\.camera-overlay'\)\.forEach\(o => o\.remove\(\)\);/.test(POINTAGE),
    'l\'écran peut rester couvert alors que le pointage est écrit en base');
});

t('le pointage est relu avant d\'être écrit', () => {
  const bloc = POINTAGE.match(/const \{ data: dejaEnBase[\s\S]*?return true;/);
  assert.ok(bloc, 'aucune relecture anti-doublon avant insertion');
  assert.ok(/\.eq\('employee_id', employee\.id\)\.eq\('date', today\)\.eq\('type', type\)/.test(bloc[0]),
    'la relecture ne cible pas (employé, jour, type)');
});

// ── Rôles proposés à la prise de poste ────────────────────────────────────

function rolesPour(role) {
  const ROLES = PRISE.match(/const ROLES = \[[\s\S]*?\n  \];/)[0];
  const MAP = PRISE.match(/const ROLE_ADMIN_VERS_JOUR = \{[^}]*\};/)[0];
  const FN = PRISE.match(/function rolesDisponibles\(\) \{[\s\S]*?\n  \}/)[0];
  return new Function('role',
    `${ROLES}\n${MAP}\n${FN}\nconst employeeCourant = { role };\nreturn rolesDisponibles().map(r => r.value);`)(role);
}

t('une caissière ne peut pas se déclarer pompiste', () => {
  const offerts = rolesPour('caissier');
  assert.ok(!offerts.includes('pompiste'),
    `rôles offerts à une caissière : ${offerts.join(', ')} — elle peut s'attribuer la piste`);
  assert.ok(offerts.includes('caissiere'), 'son propre rôle ne lui est plus proposé');
});

t('MUTATION : l\'ancien filtre, lui, ne retirait rien', () => {
  const ROLES = PRISE.match(/const ROLES = \[[\s\S]*?\n  \];/)[0];
  const ancien = new Function(`${ROLES}\nreturn ROLES.filter(r => r.value !== 'manager').map(r => r.value);`)();
  assert.ok(ancien.includes('pompiste') && ancien.includes('caissiere'),
    'la mutation ne reproduit pas l\'ancien comportement : elle ne prouve rien');
});

t('un manager garde l\'accès à tous les rôles', () => {
  const offerts = rolesPour('manager');
  assert.ok(offerts.includes('pompiste') && offerts.includes('caissiere'),
    'le manager ne peut plus remplacer au pied levé');
});

t('un rôle administratif inconnu ne bloque pas la prise de poste', () => {
  // Fail-open assumé ET tracé : mieux vaut une liste large qu'une employée
  // incapable de prendre son poste parce que son rôle a été mal saisi.
  const offerts = rolesPour('zzz-inconnu');
  assert.ok(offerts.length > 0, 'un rôle inconnu empêche toute prise de poste');
  assert.ok(/console\.error\('Prise de poste : rôle administratif/.test(PRISE),
    'le rôle inconnu est ignoré en silence');
});

t('aucun fichier ne survit à son pointage', () => {
  // Arbitrage E : ni fichier précédemment sélectionné, ni objet File, ni
  // état de formulaire réutilisé d'un pointage au suivant.
  const bloc = POINTAGE.match(/input\.addEventListener\('change', async \(\) => \{[\s\S]{0,700}/)[0];
  const iLecture = bloc.indexOf('input.files && input.files[0]');
  const iVidage = bloc.indexOf("input.value = ''");
  assert.ok(iVidage > -1, 'l\'input fichier n\'est jamais vidé : un File reste dans le DOM');
  assert.ok(iVidage > iLecture && iVidage - iLecture < 600,
    'l\'input est vidé trop loin de sa lecture, ou avant elle');
});

// ── La photo est complémentaire, jamais une condition ─────────────────────

t('une caméra refusée n\'annule plus le pointage', () => {
  const bloc = POINTAGE.match(/if \(resultat === 'sans-photo'\) \{[\s\S]*?\n        \}/);
  assert.ok(bloc, 'un refus de caméra ne laisse aucune voie vers l\'enregistrement');
  assert.ok(/finaliserPointage\(btn, employee, siteId, type, shiftActif, null, clicPointage\[type\], true\)/.test(bloc[0]),
    'le pointage sans photo n\'est pas enregistré, ou ne trace pas sa cause');
  assert.ok(/Enregistrer sans photo/.test(POINTAGE),
    'l\'employée ne se voit jamais proposer d\'enregistrer sans photo');
});

t('un envoi de photo en échec n\'annule pas le pointage non plus', () => {
  const corps = POINTAGE.match(/const photoUrl = await uploaderPhotoPointageAvecRelance[\s\S]*?\n      \}/)[0];
  assert.ok(/finaliserPointage\([^)]*null, heureClic, true\)/.test(corps),
    'un envoi raté fait perdre le pointage');
});

t('l\'écran dit « sans photo » en toutes lettres, et garde la cause', () => {
  assert.ok(/Enregistré SANS PHOTO/.test(POINTAGE),
    'la confirmation ne nomme pas l\'état réel du pointage');
  assert.ok(/photo_echec_technique: !!photoEchecTechnique/.test(POINTAGE),
    'la cause technique n\'est plus conservée');
});

t('plusieurs tentatives ne produisent aucun doublon', () => {
  const bloc = POINTAGE.match(/const \{ data: dejaEnBase[\s\S]*?return true;/);
  assert.ok(bloc, 'aucune relecture avant écriture');
  assert.ok(/\.eq\('type', type\)/.test(bloc[0]), 'la relecture ne cible pas le type');
});

t('le hors ligne n\'est PAS simulé', () => {
  // Arbitrage 3 : ne pas prétendre à une garantie absente. Aucune file
  // d'attente, aucun état « en attente de synchronisation », aucun
  // service worker dans cet écran. Tant que ce n'est pas construit, rien
  // ne doit le laisser croire.
  const promesses = POINTAGE.match(/en_attente_de_synchronisation|navigator\.onLine|serviceWorker|indexedDB/g) || [];
  assert.deepStrictEqual(promesses, [],
    `l'écran laisse croire à un fonctionnement hors ligne : ${promesses.join(', ')}`);
});

// ── Les DEUX portes vers la prise de poste ────────────────────────────────

t('après la clôture, aucune des deux portes n\'impose la prise de poste', () => {
  // Le 11/09/2026, une seule des deux avait été corrigée. L'écran d'accueil
  // continuait de rediriger : une correction posée sur une porte quand il y
  // en a deux ne corrige rien, elle déplace l'endroit où l'on se cogne.
  const AUTH = fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8');
  const APP = fs.readFileSync(path.join(RACINE, 'NEXUS-App-v1.html'), 'utf8');
  assert.ok(/async function nexusDepartPointeAujourdhui/.test(AUTH),
    'aucun test partagé du départ du jour');
  assert.ok(/return !\(await nexusDepartPointeAujourdhui\(employee\)\);/.test(AUTH),
    'la porte de nexus-auth.js ne consulte pas le départ du jour');
  const redirections = APP.match(/window\.location\.href = 'NEXUS-Prise-De-Poste-v1\.html';/g) || [];
  assert.strictEqual(redirections.length, 1, `${redirections.length} redirections dans l'accueil`);
  const bloc = APP.match(/if \(r\.aucun\) \{[\s\S]*?NEXUS-Prise-De-Poste-v1\.html';/)[0];
  assert.ok(/nexusDepartPointeAujourdhui/.test(bloc),
    'la porte de l\'accueil redirige sans consulter le départ du jour');
});

t('une lecture impossible ne relâche pas la porte', () => {
  const AUTH = fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8');
  const fn = AUTH.match(/async function nexusDepartPointeAujourdhui[\s\S]*?data\.length\);\}/);
  assert.ok(fn, 'nexusDepartPointeAujourdhui introuvable — l\'épreuve ne juge plus rien');
  const surErreur = fn[0].match(/if\(error\)\{[\s\S]*?return (\w+);/);
  assert.ok(surErreur, 'aucun traitement de l\'erreur de lecture');
  assert.strictEqual(surErreur[1], 'false',
    'une lecture ratée est prise pour un départ pointé : la porte s\'ouvre sur une panne');
});

console.log(`\n${passes}/34 vérifications passées — le départ ne dépend plus d'une pause, et le quart de la veille ne sert plus de référence.`);
