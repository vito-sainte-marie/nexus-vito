// NEXUS — rôle habituel, rôle du jour, permissions (05/09/2026).
//
// Trois notions que NEXUS confondait implicitement, et que l'audit A11 a
// séparées :
//
//   rôle habituel  = employees.role  — ce que l'employé EST administrativement
//   rôle du jour   = shifts.role     — ce qu'il FAIT aujourd'hui
//   permissions    = dérivées de la FICHE, jamais du rôle du jour
//
// Le cas révélateur : Employé Test B, caissier sur sa fiche, pompiste pour le
// service du jour. L'Accueil et Missions disaient « pompiste » ; le Cockpit
// affichait « CAISSIER » ; et l'Inventaire, en cas de panne réseau, retombait
// sur la fiche et faisait compter la BOUTIQUE à un pompiste.
//
// Ces tests gardent la séparation. Ils ne vérifient pas des libellés : ils
// exécutent les fonctions extraites des écrans.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RACINE = __dirname;
let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCommentaires = s => s.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

// Extrait une fonction nommée d'un écran, accolades équilibrées.
function extraire(source, nom) {
  const debut = source.indexOf(`async function ${nom}(`) >= 0
    ? source.indexOf(`async function ${nom}(`)
    : source.indexOf(`function ${nom}(`);
  assert.ok(debut !== -1, `fonction ${nom} introuvable`);
  let i = source.indexOf('{', debut), p = 1, j = i + 1;
  while (p > 0 && j < source.length) { if (source[j] === '{') p++; else if (source[j] === '}') p--; j++; }
  return source.slice(debut, j);
}

// ── 1. L'Inventaire n'invente jamais le poste du jour ────────────────────
const INV = lire('NEXUS-Inventaire-v1.html');
const INV_CODE = sansCommentaires(INV);

async function resoudreRole(reponse) {
  const client = { from: () => ({ select: () => ({ eq: () => ({ gte: () => ({ order: () => ({
    limit: () => ({ maybeSingle: async () => reponse }) }) }) }) }) }) };
  const contexte = {
    nexusClient: client,
    employeeCourant: { id: 'emp-1', role: 'caissier' },   // fiche : caissier
    dateISO: () => '2026-09-05',
    console: { error: () => {}, info: () => {} },
  };
  const src = extraire(INV, 'chargerRoleDuJour');
  const fn = new Function('nexusClient', 'employeeCourant', 'dateISO', 'console',
    `${src}; return chargerRoleDuJour();`);
  return fn(contexte.nexusClient, contexte.employeeCourant, contexte.dateISO, contexte.console);
}

const erreurReseau = { data: null, error: { message: 'network failure' } };
const aucunService = { data: null, error: null };
const servicePompiste = { data: { role: 'pompiste' }, error: null };

(async () => {
  const surErreur = await resoudreRole(erreurReseau);
  verifier('erreur réseau : le poste du jour est déclaré INDÉTERMINÉ',
    surErreur.indetermine === 'reseau');
  verifier('erreur réseau : la fiche employé n’est JAMAIS renvoyée',
    surErreur.role === undefined && !JSON.stringify(surErreur).includes('caissier'));

  const sansService = await resoudreRole(aucunService);
  verifier('aucun service : le poste du jour est déclaré INDÉTERMINÉ',
    sansService.indetermine === 'absent');
  verifier('aucun service : aucun rôle opérationnel n’est inventé',
    sansService.role === undefined && !JSON.stringify(sansService).includes('caissier'));

  const avecService = await resoudreRole(servicePompiste);
  verifier('service pompiste : c’est le poste du SERVICE qui est retenu',
    avecService.role === 'pompiste' && !avecService.indetermine);

  // ── 2. Et il bloque proprement plutôt que de continuer ─────────────────
  verifier('un poste indéterminé arrête le workflow au lieu de choisir une zone',
    /if \(resolution\.indetermine\) \{ bloquerFauteDeRoleDuJour\(resolution\.indetermine\); return; \}/.test(INV_CODE));
  const bloc = extraire(INV, 'bloquerFauteDeRoleDuJour');
  verifier('l’arrêt explique ce qui manque', /Poste du jour indéterminé/.test(bloc));
  verifier('l’arrêt distingue panne réseau et absence de prise de poste',
    /connexion au serveur a échoué/.test(bloc) && /Aucune prise de poste/.test(bloc));
  verifier('l’arrêt permet de réessayer', /reessayerRoleDuJour/.test(bloc) && /reload\(\)/.test(bloc));
  verifier('l’erreur technique est journalisée', /console\.error\('Rôle du jour/.test(INV_CODE));
  verifier('aucun repli vers la fiche ne subsiste dans la résolution du poste',
    !/return employeeCourant\.role/.test(INV_CODE));

  // ── 3. Cockpit et Brief : le badge décrit l'activité, pas le statut ─────
  for (const f of ['NEXUS-Cockpit-v2.html', 'NEXUS-Brief-v1.html']) {
    const code = sansCommentaires(lire(f));
    verifier(`${f} : le badge lit le poste du jour`,
      /manager_role = await lirePosteDuJour\(employee\.id\) \|\| ''/.test(code));
    verifier(`${f} : le badge ne lit plus la fiche`,
      !/manager_role = employee\.role/.test(code));
    verifier(`${f} : sans service, le badge reste vide plutôt qu’inventé`,
      /return \(data && data\.role\) \|\| null/.test(code));
  }

  // ── 4. Les permissions n'ont pas bougé ─────────────────────────────────
  // L'audit A11 a dénombré 57 contrôles applicatifs sur la fiche employé
  // (manager/gerant). Ce lot ne devait en toucher AUCUN.
  const RE_SOURCE = /\b(employee|employeCourant|employeeCourant|emp|e)\.role\b(?!_)/;
  let permissions = 0;
  for (const f of fs.readdirSync(RACINE)) {
    if (!/\.(js|html)$/.test(f) || f.startsWith('test_')) continue;
    for (const l of lire(f).split('\n')) {
      if (l.trim().startsWith('//') || !RE_SOURCE.test(l)) continue;
      if (/'(manager|gerant)'/.test(l)) permissions++;
    }
  }
  verifier(`les contrôles de permission sur la fiche sont intacts (${permissions})`, permissions === 55);
  verifier('les ensembles de rôles autorisés restent sur la fiche employé',
    /ROLES_AUTORISES = new Set\(\['manager', 'gerant'\]\)/.test(lire('nexus-inventaire-transferts-internes.js'))
    && /ROLES = new Set\(\['manager', 'gerant'\]\)/.test(lire('nexus-inventaire-stock-controle-cible-v2.js')));

  // ── 5. Missions et modules restent sur le poste du jour ────────────────
  const MISSIONS = sansCommentaires(lire('NEXUS-Missions-v1.html'));
  const APP = sansCommentaires(lire('NEXUS-App-v1.html'));
  verifier('Missions filtre le catalogue sur le poste du jour',
    /role_required\.includes\(roleDuJour\)/.test(MISSIONS));
  verifier('Missions ne filtre jamais sur la fiche employé',
    !/role_required\.includes\(employee\w*\.role\)/.test(MISSIONS));
  verifier('l’Accueil décide de l’accès aux modules sur le poste du jour',
    /function roleADroitModule\(module, roleDuJour\)/.test(APP));
  // Le comportement, pas le commentaire : hors de la matrice, on ne masque pas.
  const droitModule = extraire(APP, 'roleADroitModule');
  verifier('l’Accueil ne masque rien quand le poste est inconnu',
    /if \(roleDuJour in table\) return table\[roleDuJour\];[\s\S]{0,120}return true;/.test(droitModule));

  // ── 6. Le vocabulaire divergent est assumé, pas corrigé ici ────────────
  verifier('la dette `caissier` / `caissiere` est documentée là où elle mord',
    /dette de vocabulaire/.test(INV));

  console.log(`\n${ok} vérifications passées.`);
})();
