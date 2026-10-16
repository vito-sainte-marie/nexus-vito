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
// LA RÈGLE ARBITRÉE (15/10/2026, remplace celle du 18/09) — tous les employés
// opérationnels sont polyvalents ; employees.role n'est qu'un rôle HABITUEL :
//     fiche non manager        → pompiste, caissiere, renfort
//     fiche manager/gerant     → tous les rôles existants
//     fiche inconnue / absente → pompiste, caissiere, renfort + anomalie
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

  const OPS = ['pompiste', 'caissiere', 'renfort'];
  const memesTrois = v => v.length === 3 && OPS.every(r => v.includes(r));

  // ── 1. Toute fiche non manager voit les trois fonctions opérationnelles ─
  for (const fiche of ['renfort', 'pompiste', 'caissier', 'caissiere']) {
    const vus = rolesPour(fiche);
    verifier(`une fiche « ${fiche} » voit exactement pompiste, caissière et renfort (${vus.join(', ')})`,
      memesTrois(vus));
    verifier(`une fiche « ${fiche} » ne se voit jamais proposer manager`,
      !vus.includes('manager'));
  }

  // MUTATIONS INVERSÉES — les règles d'avant, rejouées telles quelles, doivent
  // échouer sur les mêmes cas. Sans cela, ce test ne prouverait pas qu'il mord.
  const ancienFiltre = new Function('sien',
    TXT_ROLES + ";\nreturn ROLES.filter(r => r.value === sien || r.value === 'renfort').map(r => r.value);");
  verifier('MUTATION : l’ancien filtre enfermait le renfort sur un seul poste',
    ancienFiltre('renfort').length === 1 && !memesTrois(ancienFiltre('renfort')));
  verifier('MUTATION : l’ancien filtre fermait la caisse au pompiste',
    !ancienFiltre('pompiste').includes('caissiere') && !memesTrois(ancienFiltre('pompiste')));
  verifier('MUTATION : l’ancien filtre fermait la piste à la caissière',
    !ancienFiltre('caissiere').includes('pompiste') && !memesTrois(ancienFiltre('caissiere')));

  // ── 2. Manager et gérant gardent tout ──────────────────────────────────
  for (const fiche of ['manager', 'gerant']) {
    const vus = rolesPour(fiche);
    verifier(`une fiche « ${fiche} » conserve tous les rôles existants (${vus.join(', ')})`,
      TOUS.every(v => vus.includes(v)) && vus.length === TOUS.length);
  }

  // ── 3. Le poste de manager ne s'ouvre à personne d'autre ───────────────
  // Fiches limites comprises : casse, vide, absente, valeurs voisines.
  const silence = console.error;
  console.error = () => {};
  try {
    for (const fiche of ['renfort', 'pompiste', 'caissier', 'caissiere', 'vacataire', 'polyvalent',
      'Manager', 'MANAGER', 'Gerant', ' manager', 'manager ', 'managers', 'admin', '', null, undefined, 'zzz-inconnu']) {
      verifier(`fiche ${JSON.stringify(fiche)} : jamais le poste manager`,
        !rolesPour(fiche).includes('manager'));
    }
  } finally { console.error = silence; }

  // MUTATION — une fonction qui rendrait ROLES en entier aux non-managers doit
  // être détectée par le contrôle ci-dessus.
  const ouvreTout = new Function(TXT_ROLES + ";\nreturn ROLES.map(r => r.value);")();
  verifier('MUTATION : ouvrir tout le catalogue donnerait le poste manager',
    ouvreTout.includes('manager'));

  // ── 4. Un rôle de fiche inconnu : trois fonctions, sans manager, tracé ──
  const erreursConsole = [];
  const vraiErreur = console.error;
  console.error = (...a) => erreursConsole.push(a.join(' '));
  let inconnu, absent;
  try { inconnu = rolesPour('zzz-inconnu'); absent = rolesPour(null); } finally { console.error = vraiErreur; }
  verifier('une fiche inconnue reçoit exactement les trois fonctions opérationnelles',
    memesTrois(inconnu));
  verifier('une fiche absente reçoit exactement les trois fonctions opérationnelles',
    memesTrois(absent));
  verifier('une fiche inconnue est signalée, jamais ignorée en silence',
    erreursConsole.some(m => /rôle administratif/.test(m)));

  // Les fiches connues ne polluent pas le journal.
  const bruit = [];
  console.error = (...a) => bruit.push(a.join(' '));
  try { for (const f of ['renfort', 'pompiste', 'caissier', 'caissiere', 'manager', 'gerant']) rolesPour(f); }
  finally { console.error = vraiErreur; }
  verifier('une fiche connue n’émet aucune anomalie', bruit.length === 0);

  // ── 6. Le poste le plus fréquent reste une information VISUELLE ──────────────────
  verifier('le rôle choisi part de rien : aucune présélection',
    /let roleChoisi = null;/.test(SRC));
  verifier('le badge vient du poste le plus fréquent (lot B), jamais de la fiche',
    /const pf = posteFrequent && posteFrequent\.etat === 'dominant' \? posteFrequent : null;/.test(TXT_RENDER)
    && !/employeeCourant\.role/.test(TXT_RENDER)
    && !/Rôle habituel/.test(TXT_RENDER));
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
  // Changement de quart (16/10/2026) : l'écran envoie SEULEMENT le rôle du
  // jour choisi (p_role). Le rôle prévu n'est plus écrit par le client : la
  // fonction SQL le lit sur la fiche de l'employé (employees.role), de sorte
  // qu'il ne peut ni être forgé ni se confondre avec le rôle du jour. La
  // RLS (SECURITY INVOKER) continue de refuser Manager à qui n'y est pas
  // habilité.
  const MIGRATION_QUART = fs.readFileSync(path.join(RACINE,
    'supabase/migrations/20261016090000_changement_de_quart_atomique.sql'), 'utf8');
  const TXT_APPEL = extraire('async function appelerChangementDeQart(', '{', '}');
  verifier('l’écran n’envoie que le rôle du jour, jamais le rôle prévu',
    /p_role: roleChoisi,/.test(TXT_APPEL) && !/role_prevu/.test(TXT_APPEL)
    && !/role_prevu/.test(TXT_CONFIRM));
  verifier('la fonction écrit le rôle du jour et le rôle prévu (fiche) séparément',
    /values \(v_uid, p_role, v_emp\.role,/.test(MIGRATION_QUART)
    && /select e\.role, e\.site_id into v_emp from public\.employees e where e\.id = v_uid/.test(MIGRATION_QUART));
  verifier('rolesDisponibles reste le seul endroit qui filtre le catalogue',
    (SRC.match(/ROLES\.filter\(/g) || []).length === (TXT_FN.match(/ROLES\.filter\(/g) || []).length);

  console.log(`\n${ok} vérifications passées.`);
})();
