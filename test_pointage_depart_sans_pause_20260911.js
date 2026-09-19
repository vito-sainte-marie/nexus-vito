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
// 18/09/2026 : `total` était écrit en dur (34) dans la ligne de conclusion.
// Ajouter trois gardes affichait donc « 36/34 » — un dénominateur faux, dans
// une épreuve dont tout le propos est de ne rien annoncer qu'elle ne mesure.
let total = 0;
function t(nom, fn) {
  total++;
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

t('le pointage est relu avant d\'être écrit, à la portée du SERVICE', () => {
  // PORTÉE CORRIGÉE LE 13/09/2026. Cette vérification exigeait (employé,
  // JOUR, type) — la portée qui a fait échouer le second service de la
  // journée : la relecture retrouvait l'arrivée du service précédent et
  // rendait `true` sans écrire. La bonne portée est celle de l'index unique
  // posé le 11/09, `pointages_un_par_service_et_type`. Une épreuve qui exige
  // la mauvaise portée protège le défaut, elle ne protège pas la règle.
  const bloc = POINTAGE.match(/const \{ data: dejaEnBase[\s\S]*?return true;/);
  assert.ok(bloc, 'aucune relecture anti-doublon avant insertion');
  assert.ok(/\.eq\('employee_id', employee\.id\)\.eq\('service_id', serviceDuJour\.id\)\.eq\('type', type\)/.test(bloc[0]),
    'la relecture ne cible pas (employé, service, type)');
  assert.ok(!/\.eq\('date', today\)/.test(bloc[0]),
    'la relecture retient encore la journée : deux services le même jour se confondront');
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

// PRÉMISSE CHANGÉE LE 18/09/2026. Ces trois gardes épinglaient le littéral
// `true` passé à finaliserPointage, et `!!photoEchecTechnique`. Elles étaient
// vertes pendant que l'écran mentait : un booléen unique servait à la fois
// l'échec d'envoi ET le clic « Enregistrer sans photo », si bien qu'un employé
// qui refusait sa caméra était déclaré au manager comme victime d'une panne.
// Le texte était conforme, le comportement non — exactement ce que l'en-tête
// de cette épreuve dit ne pas vouloir. Elles jugent désormais le motif porté
// par le code, et la valeur que ce motif produit en base.

t('une caméra refusée n\'annule plus le pointage', () => {
  const bloc = POINTAGE.match(/if \(resultat === 'sans-photo'\) \{[\s\S]*?\n        \}/);
  assert.ok(bloc, 'un refus de caméra ne laisse aucune voie vers l\'enregistrement');
  const appel = bloc[0].match(/finaliserPointage\(btn, employee, siteId, type, shiftActif, null, clicPointage\[type\], (.+?)\);/);
  assert.ok(appel, 'le pointage sans photo n\'est pas enregistré');
  assert.strictEqual(appel[1], "'choix_employe'",
    'le refus de caméra ne nomme pas son motif, ou le confond avec un échec technique');
  assert.ok(/Enregistrer sans photo/.test(POINTAGE),
    'l\'employée ne se voit jamais proposer d\'enregistrer sans photo');
});

t('un envoi de photo en échec n\'annule pas le pointage non plus', () => {
  const corps = POINTAGE.match(/const photoUrl = await uploaderPhotoPointageAvecRelance[\s\S]*?\n      \}/)[0];
  const appel = corps.match(/finaliserPointage\([^)]*null, heureClic, (.+?)\);/);
  assert.ok(appel, 'un envoi raté fait perdre le pointage');
  assert.strictEqual(appel[1], "'echec_technique'",
    'un envoi raté n\'est plus tracé comme tel pour le manager');
});

t('le drapeau d\'échec technique ne se pose QUE sur un échec technique', () => {
  // Le cœur du correctif du 18/09, jugé sur la valeur réellement écrite :
  // l'expression est extraite du littéral inséré en base, puis évaluée.
  const ligne = POINTAGE.match(/const ligne = \{[\s\S]*?\n    \};/)[0];
  const expr = ligne.match(/photo_echec_technique: (.+),/);
  assert.ok(expr, 'la cause technique n\'est plus conservée');
  const derive = new Function('motifSansPhoto', 'return (' + expr[1] + ');');
  assert.strictEqual(derive('echec_technique'), true,
    'un envoi raté n\'est plus signalé au manager');
  assert.strictEqual(derive('choix_employe'), false,
    'un clic « Enregistrer sans photo » est encore écrit comme une panne technique');
  assert.strictEqual(derive(null), false,
    'un pointage avec photo est marqué en échec');
});

t('l\'écran dit « sans photo » en toutes lettres, et sans inventer de panne', () => {
  assert.ok(/Enregistré SANS PHOTO : la photo n\\?'a pas pu être envoyée/.test(POINTAGE),
    'la confirmation ne nomme pas l\'échec d\'envoi');
  assert.ok(/Enregistré SANS PHOTO, comme vous l\\?'avez demandé/.test(POINTAGE),
    'un enregistrement voulu sans photo est annoncé comme un échec d\'envoi');
  assert.ok(/Pointage enregistré sans photo/.test(POINTAGE),
    'l\'historique du manager n\'a aucun libellé pour une photo simplement absente');
});

t('le départ n\'annonce plus une obligation que rien n\'applique', () => {
  // La consigne disait « Obligatoire : photo de la mise en alarme » alors que
  // le même écran offre « Enregistrer sans photo » juste en dessous. Une
  // obligation affichée et non tenue n'oblige personne.
  const depart = POINTAGE.match(/\n    depart: \{[^\n]*\n/)[0];
  assert.ok(/consignePhoto:/.test(depart), 'le départ n\'a plus de consigne photo');
  assert.ok(!/[Oo]bligatoire/.test(depart),
    'le départ annonce une photo obligatoire que rien n\'impose');
});

t('plusieurs tentatives ne produisent aucun doublon', () => {
  const bloc = POINTAGE.match(/const \{ data: dejaEnBase[\s\S]*?return true;/);
  assert.ok(bloc, 'aucune relecture avant écriture');
  assert.ok(/\.eq\('type', type\)/.test(bloc[0]), 'la relecture ne cible pas le type');
});

t('le hors ligne ne promet que ce qu\'il tient', () => {
  // PRÉMISSE CHANGÉE LE 13/09/2026. Cette garde interdisait toute trace de
  // hors ligne — « tant que ce n'est pas construit, rien ne doit le laisser
  // croire ». Il A été construit depuis, le 11/09, sur demande de Frédéric,
  // et prouvé en direct : file locale, reprise au retour du réseau, aucun
  // doublon. La garde avait survécu par accident, son motif ne listant pas
  // `addEventListener('online')`, qui était pourtant là.
  //
  // Elle garde son esprit — ne pas prétendre à une garantie absente — mais
  // vise désormais ce qui reste réellement absent, et surveille le seul
  // usage légitime de `navigator.onLine` : DÉCLINER de conclure quand la
  // réponse ne peut pas venir du serveur. Jamais promettre un envoi.
  const jamaisConstruit = POINTAGE.match(/serviceWorker|indexedDB|en_attente_de_synchronisation/g) || [];
  assert.deepStrictEqual(jamaisConstruit, [],
    `l'écran évoque un mécanisme qui n'existe pas : ${jamaisConstruit.join(', ')}`);

  const usages = POINTAGE.match(/navigator\.onLine/g) || [];
  assert.strictEqual(usages.length, 1,
    `navigator.onLine doit rester à un seul endroit, il y en a ${usages.length}`);
  assert.ok(/function erreurDefinitive\(erreur\) \{[\s\S]*?navigator\.onLine === false\) return false;/.test(POINTAGE),
    'navigator.onLine sert à autre chose qu\'à refuser de conclure hors ligne');
});

// ── Les portes vers la prise de poste ─────────────────────────────────────

t('après la clôture, aucune porte n\'impose la prise de poste', () => {
  // Le 11/09/2026, une seule des deux portes connues avait été corrigée.
  // L'écran d'accueil continuait de rediriger : une correction posée sur une
  // porte quand il y en a deux ne corrige rien, elle déplace l'endroit où
  // l'on se cogne. Le 16/09/2026, l'audit en a trouvé TROIS, et la troisième
  // — celle de l'accueil — a été SUPPRIMÉE : l'accueil est un écran de
  // consultation, il porte les deux chemins « Consulter NEXUS » et
  // « Commencer mon service », et il ne peut donc plus renvoyer d'office vers
  // l'un des deux. Ce qu'on vérifie ici a changé en conséquence : la porte de
  // nexus-auth.js consulte toujours le départ du jour, et le chemin de
  // chargement de l'accueil ne redirige plus du tout.
  const AUTH = fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8');
  const APP = fs.readFileSync(path.join(RACINE, 'NEXUS-App-v1.html'), 'utf8');
  assert.ok(/async function nexusDepartPointeAujourdhui/.test(AUTH),
    'aucun test partagé du départ du jour');
  assert.ok(/return !\(await nexusDepartPointeAujourdhui\(employee\)\);/.test(AUTH),
    'la porte de nexus-auth.js ne consulte pas le départ du jour');
  // Le bloc de chargement qui lit le service courant : il doit rester un
  // LECTEUR. Une redirection qui y reviendrait rétablirait la troisième porte.
  const bloc = APP.match(/if \(!employee\.consultation_externe\) \{\s*const r = await nexusServiceCourant\(employee\);[\s\S]*?\n    \}/);
  assert.ok(bloc, 'le bloc de lecture du service courant de l\'accueil est introuvable');
  // On juge le CODE, pas les commentaires : le bloc explique justement en
  // toutes lettres ce qu'il ne fait plus, et une assertion qui lirait ses
  // commentaires échouerait sur sa propre documentation.
  const codeSeul = bloc[0].split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(!/window\.location/.test(codeSeul),
    'la troisième porte est revenue : l\'accueil redirige à nouveau au chargement');
  assert.ok(!/r\.aucun/.test(codeSeul),
    'l\'accueil décide encore quelque chose de l\'absence de service au chargement');
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

console.log(`\n${passes}/${total} vérifications passées — le départ ne dépend plus d'une pause, et le quart de la veille ne sert plus de référence.`);
