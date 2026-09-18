// NEXUS — matrice des rôles du jour à la prise de poste (18/09/2026).
//
// CE QUE CE TEST GARDE, ET POURQUOI IL EXISTE
// -------------------------------------------
// Le 18/09/2026, une employée de fiche « renfort » n'a pas pu prendre son
// poste en piste : l'écran de prise de poste ne lui proposait plus que
// « Renfort opérationnel ». Son compte n'était pas en panne — le filtre des
// rôles l'était. Il gardait « son » rôle plus le renfort ; pour un renfort,
// les deux se confondent, et la liste se refermait sur un seul poste.
//
// LA RÈGLE ARBITRÉE — employees.role est le rôle HABITUEL, préférentiel,
// jamais l'unique poste possible :
//     fiche renfort            → renfort, pompiste, caissiere
//     fiche pompiste           → pompiste, renfort
//     fiche caissier/caissiere → caissiere, renfort
//     fiche manager/gerant     → tous les rôles existants
// et le poste de manager n'est JAMAIS proposé à qui n'est ni manager ni
// gérant : c'est la seule ligne de la matrice qui touche aux permissions.
//
// Ce test n'inspecte pas des libellés : il EXTRAIT `rolesDisponibles` de
// l'écran et l'EXÉCUTE, fiche par fiche.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RACINE = __dirname;
const ECRAN = 'NEXUS-Prise-De-Poste-v1.html';
const SRC = fs.readFileSync(path.join(RACINE, ECRAN), 'utf8');

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

// Extrait une déclaration de l'écran par équilibrage du délimiteur : plus
// robuste qu'une expression régulière, qui se fait piéger par la première
// accolade fermante venue.
function extraire(entete, ouvrant, fermant) {
  const debut = SRC.indexOf(entete);
  assert.ok(debut !== -1, `« ${entete} » introuvable dans ${ECRAN}`);
  let i = SRC.indexOf(ouvrant, debut), p = 1, j = i + 1;
  while (p > 0 && j < SRC.length) {
    if (SRC[j] === ouvrant) p++;
    else if (SRC[j] === fermant) p--;
    j++;
  }
  assert.ok(p === 0, `« ${entete} » n'est pas refermée`);
  return SRC.slice(debut, j);
}

const TXT_ROLES = extraire('const ROLES = [', '[', ']');
const TXT_MAP = extraire('const ROLE_ADMIN_VERS_JOUR = {', '{', '}');
const TXT_FN = extraire('function rolesDisponibles()', '{', '}');
const TXT_RENDER = extraire('function renderChoixRole()', '{', '}');
const TXT_CONFIRM = extraire('async function confirmerPriseDePoste()', '{', '}');

// Exécute la vraie fonction de l'écran pour une fiche donnée.
function rolesPour(fiche) {
  const bac = [
    TXT_ROLES + ';',
    TXT_MAP + ';',
    TXT_FN,
    'const employeeCourant = { role: fiche, nom: "Essai", id: "id-essai" };',
    'return rolesDisponibles().map(r => r.value);',
  ].join('\n');
  return new Function('fiche', bac)(fiche);
}

const TOUS = new Function(TXT_ROLES + ';\nreturn ROLES.map(r => r.value);')();

(function () {
  console.log(`\n— Matrice des rôles du jour (${ECRAN}) —\n`);

  // ── 1. Le cas qui a bloqué la Production : la fiche « renfort » ────────
  const renfort = rolesPour('renfort');
  verifier(`une fiche « renfort » peut se déclarer renfort (${renfort.join(', ')})`,
    renfort.includes('renfort'));
  verifier('une fiche « renfort » peut se déclarer pompiste',
    renfort.includes('pompiste'));
  verifier('une fiche « renfort » peut se déclarer caissière',
    renfort.includes('caissiere'));
  verifier('une fiche « renfort » ne se voit jamais proposer manager',
    !renfort.includes('manager'));
  verifier('une fiche « renfort » voit exactement trois postes',
    renfort.length === 3);

  // MUTATION — la règle d'avant, rejouée telle quelle, doit échouer sur ce
  // même cas. Sans cela, ce test ne prouverait pas qu'il mord.
  const ancienFiltre = new Function('sien',
    TXT_ROLES + ";\nreturn ROLES.filter(r => r.value === sien || r.value === 'renfort').map(r => r.value);");
  verifier('MUTATION : l’ancien filtre, lui, enfermait le renfort sur un seul poste',
    ancienFiltre('renfort').length === 1 && ancienFiltre('renfort')[0] === 'renfort');

  // ── 2. La fiche « pompiste » ───────────────────────────────────────────
  const pompiste = rolesPour('pompiste');
  verifier(`une fiche « pompiste » voit pompiste et renfort (${pompiste.join(', ')})`,
    pompiste.includes('pompiste') && pompiste.includes('renfort'));
  verifier('une fiche « pompiste » ne se voit jamais proposer caissière',
    !pompiste.includes('caissiere'));
  verifier('une fiche « pompiste » ne se voit jamais proposer manager',
    !pompiste.includes('manager'));
  verifier('une fiche « pompiste » voit exactement deux postes',
    pompiste.length === 2);

  // ── 3. Les fiches « caissier » et « caissiere » ────────────────────────
  // La base écrit le masculin, l'écran propose le féminin : les deux entrées
  // doivent mener au même résultat. C'est la dette de vocabulaire assumée.
  for (const fiche of ['caissier', 'caissiere']) {
    const vus = rolesPour(fiche);
    verifier(`une fiche « ${fiche} » voit caissière et renfort (${vus.join(', ')})`,
      vus.includes('caissiere') && vus.includes('renfort'));
    verifier(`une fiche « ${fiche} » ne se voit jamais proposer pompiste`,
      !vus.includes('pompiste'));
    verifier(`une fiche « ${fiche} » ne se voit jamais proposer manager`,
      !vus.includes('manager'));
    verifier(`une fiche « ${fiche} » voit exactement deux postes`,
      vus.length === 2);
  }

  // ── 4. Manager et gérant gardent tout ──────────────────────────────────
  for (const fiche of ['manager', 'gerant']) {
    const vus = rolesPour(fiche);
    verifier(`une fiche « ${fiche} » conserve tous les rôles existants (${vus.join(', ')})`,
      TOUS.every(v => vus.includes(v)) && vus.length === TOUS.length);
  }
  verifier('le poste de manager n’est proposé qu’au manager et au gérant',
    ['renfort', 'pompiste', 'caissier', 'caissiere', 'zzz-inconnu']
      .every(f => !rolesPour(f).includes('manager')));

  // ── 5. Un rôle de fiche inconnu ne bloque toujours pas la prise de poste ─
  // Fail-open assumé ET tracé : mieux vaut une liste large qu'une employée
  // incapable de prendre son poste parce que sa fiche a été mal saisie.
  const erreursConsole = [];
  const vraiErreur = console.error;
  console.error = (...a) => erreursConsole.push(a.join(' '));
  let inconnu;
  try { inconnu = rolesPour('zzz-inconnu'); } finally { console.error = vraiErreur; }
  verifier('une fiche inconnue n’empêche pas de prendre son poste',
    inconnu.length > 0);
  verifier('une fiche inconnue est signalée, jamais ignorée en silence',
    erreursConsole.some(m => /rôle administratif/.test(m)));

  // ── 6. Le rôle habituel reste une suggestion VISUELLE ──────────────────
  verifier('le rôle choisi part de rien : aucune présélection',
    /let roleChoisi = null;/.test(SRC));
  verifier('la fiche n’alimente que le badge « Rôle habituel »',
    /const suggestion = employeeCourant\.role;/.test(TXT_RENDER)
    && /r\.value === suggestion \? '<div class="role-suggestion">Rôle habituel<\/div>' : ''/.test(TXT_RENDER));
  verifier('le rôle du jour ne peut venir que d’un clic de l’employée',
    (TXT_RENDER.match(/roleChoisi\s*=/g) || []).length === 1
    && /roleChoisi = el\.dataset\.role;/.test(TXT_RENDER));
  verifier('sans choix explicite, on ne peut pas continuer',
    /\$\{roleChoisi\?'':'disabled'\}/.test(TXT_RENDER)
    && /if \(roleChoisi\) renderResume\(\);/.test(TXT_RENDER));

  // ── 7. Aucune autre logique de prise de poste n’a bougé ────────────────
  verifier('le catalogue des rôles reste celui des quatre postes connus',
    TOUS.length === 4
    && ['pompiste', 'caissiere', 'renfort', 'manager'].every((v, i) => TOUS[i] === v));
  verifier('la table fiche → rôle du jour est inchangée',
    /pompiste: 'pompiste'/.test(TXT_MAP) && /caissier: 'caissiere'/.test(TXT_MAP)
    && /caissiere: 'caissiere'/.test(TXT_MAP) && /renfort: 'renfort'/.test(TXT_MAP)
    && (TXT_MAP.match(/:/g) || []).length === 4);
  verifier('le contrôle manager/gérant de la fiche est intact',
    /const estManager = employeeCourant\.role === 'manager' \|\| employeeCourant\.role === 'gerant';/.test(TXT_FN));
  verifier('l’écriture du quart garde le rôle du jour et le rôle prévu séparés',
    /role: roleChoisi,/.test(TXT_CONFIRM) && /role_prevu: employeeCourant\.role,/.test(TXT_CONFIRM));
  verifier('rolesDisponibles reste le seul endroit qui filtre le catalogue',
    (SRC.match(/ROLES\.filter\(/g) || []).length === (TXT_FN.match(/ROLES\.filter\(/g) || []).length);

  console.log(`\n${ok} vérifications passées.`);
})();
