// Test — Interrupteur global "Pointage des employés" (station_config.pointage_actif)
// (16/08/2026, demande de Frédéric : "mets une option dans les paramètres
// station pour activer ou non le pointage des employés").
//
// Extrait la fonction réelle nexusPointageArriveeManquant de nexus-auth.js
// via regex (jamais réécrite à la main), comme tous les tests de ce module.
// C'est LA fonction qui décide si un employé/manager est bloqué en attente
// d'un pointage d'arrivée — le vrai verrou d'accès, distinct des simples
// masquages visuels (mini-carte accueil, recherche NEXUS).

const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const src = fs.readFileSync('/sessions/dazzling-compassionate-ride/mnt/image nexus project/nexus-auth.js', 'utf8');

function extraire(nomFonction) {
  let debut = src.indexOf(`async function ${nomFonction}(`);
  if (debut === -1) debut = src.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  let i = src.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (src[j] === '{') profondeur++;
    else if (src[j] === '}') profondeur--;
    j++;
  }
  return src.slice(debut, j);
}

// Construit un faux nexusClient dont le comportement de .maybeSingle()
// dépend de la table interrogée (station_config vs pointages) — chaque
// scénario fournit les deux réponses attendues, dans l'ordre où le code
// réel les demande.
function fauxClient({ config, arrivee }) {
  function chain(table) {
    return {
      select: () => chain(table),
      eq: () => chain(table),
      maybeSingle: async () => {
        if (table === 'station_config') return { data: config };
        if (table === 'pointages') return { data: arrivee, error: null };
        throw new Error('table inattendue: ' + table);
      },
    };
  }
  return { from: (table) => chain(table) };
}

async function executer(scenario, employee, pageActuelle = 'NEXUS-App-v1.html') {
  const code = [
    extraire('nexusPointageArriveeManquant'),
    "globalThis.__test = nexusPointageArriveeManquant;",
  ].join('\n\n');
  // NEXUS_PAGES_SEQUENCE_OBLIGATOIRE est une const définie juste avant la
  // fonction dans le fichier réel — on la réinjecte ici pour rester fidèle
  // à ce que le vrai fichier exécute (jamais réécrite, seulement portée).
  const constSeq = src.slice(src.indexOf('const NEXUS_PAGES_SEQUENCE_OBLIGATOIRE'), src.indexOf(';', src.indexOf('const NEXUS_PAGES_SEQUENCE_OBLIGATOIRE')) + 1);
  const ctx = {
    globalThis: {},
    console,
    window: { location: { pathname: '/' + pageActuelle } },
    nexusClient: fauxClient(scenario),
  };
  ctx.globalThis = ctx;
  vm.runInNewContext(constSeq + '\n\n' + code, ctx);
  return ctx.__test(employee);
}

(async () => {
  // 1) pointage_actif = false → PERSONNE n'est bloqué, employé ou manager,
  //    même si l'employé n'a pas encore pointé son arrivée.
  const bloqueEmploye = await executer(
    { config: { pointage_actif: false, manager_pointage_requis: false }, arrivee: null },
    { id: 'e1', site_id: 's1', role: 'employe', consultation_externe: false }
  );
  assert.strictEqual(bloqueEmploye, false, 'pointage_actif=false doit dispenser un employé, même sans arrivée pointée');
  console.log('OK — pointage_actif=false dispense un employé sans pointage d\'arrivée.');

  const bloqueManager = await executer(
    { config: { pointage_actif: false, manager_pointage_requis: true }, arrivee: null },
    { id: 'm1', site_id: 's1', role: 'manager', consultation_externe: false }
  );
  assert.strictEqual(bloqueManager, false, 'pointage_actif=false doit dispenser un manager même si manager_pointage_requis=true');
  console.log('OK — pointage_actif=false dispense un manager, même avec manager_pointage_requis=true (interrupteur maître prioritaire).');

  // 2) pointage_actif = true (ou colonne absente) + manager_pointage_requis
  //    = false → comportement historique inchangé : le manager n'est pas
  //    bloqué, mais Pointage reste actif pour les employés (testé ensuite).
  const managerDispense = await executer(
    { config: { pointage_actif: true, manager_pointage_requis: false }, arrivee: null },
    { id: 'm2', site_id: 's1', role: 'manager', consultation_externe: false }
  );
  assert.strictEqual(managerDispense, false, 'manager_pointage_requis=false doit toujours dispenser le manager (comportement historique)');
  console.log('OK — comportement historique préservé : manager_pointage_requis=false dispense toujours le manager.');

  // 3) pointage_actif = true, employé, pas encore pointé arrivée → bloqué
  //    (comportement historique, jamais cassé par le nouvel interrupteur).
  const employeBloqueNormal = await executer(
    { config: { pointage_actif: true, manager_pointage_requis: false }, arrivee: null },
    { id: 'e2', site_id: 's1', role: 'employe', consultation_externe: false }
  );
  assert.strictEqual(employeBloqueNormal, true, 'un employé sans arrivée pointée doit rester bloqué quand pointage_actif=true');
  console.log('OK — un employé sans arrivée pointée reste bloqué quand le pointage est actif (comportement historique).');

  // 4) Colonne absente / config null (site jamais configuré) → traité comme
  //    pointage_actif=true implicite (défaut TRUE en base, mais on vérifie
  //    aussi la résilience si maybeSingle() renvoie data:null).
  const configAbsente = await executer(
    { config: null, arrivee: null },
    { id: 'e3', site_id: 's1', role: 'employe', consultation_externe: false }
  );
  assert.strictEqual(configAbsente, true, 'config absente doit se comporter comme avant (pointage actif par défaut) et bloquer un employé sans arrivée');
  console.log('OK — config absente (site non configuré) : comportement par défaut inchangé, pointage actif.');

  // 5) Employé qui a déjà pointé son arrivée aujourd'hui → jamais bloqué,
  //    quel que soit pointage_actif (régression simple).
  const employeDejaPointe = await executer(
    { config: { pointage_actif: true, manager_pointage_requis: false }, arrivee: { id: 'p1' } },
    { id: 'e4', site_id: 's1', role: 'employe', consultation_externe: false }
  );
  assert.strictEqual(employeDejaPointe, false, 'un employé ayant déjà pointé son arrivée ne doit jamais être bloqué');
  console.log('OK — un employé ayant déjà pointé son arrivée n\'est jamais bloqué (régression).');

  // 6) Pages-portes (Pointage/Prise de poste) et consultation externe créateur
  //    restent jamais bloquées, peu importe pointage_actif (régression).
  const pagePorte = await executer(
    { config: { pointage_actif: false }, arrivee: null },
    { id: 'e5', site_id: 's1', role: 'employe', consultation_externe: false },
    'NEXUS-Pointage-v1.html'
  );
  assert.strictEqual(pagePorte, false, 'la page Pointage elle-même ne doit jamais se bloquer elle-même');
  console.log('OK — pages-portes (Pointage/Prise de poste) jamais auto-bloquées (régression).');

  const consultationExterne = await executer(
    { config: { pointage_actif: true, manager_pointage_requis: false }, arrivee: null },
    { id: 'c1', site_id: 's1', role: 'employe', consultation_externe: true }
  );
  assert.strictEqual(consultationExterne, false, 'un créateur en consultation externe ne doit jamais être bloqué');
  console.log('OK — consultation externe créateur jamais bloquée (régression).');

  console.log('\nTous les tests "interrupteur global Pointage" passent.');
})().catch(err => { console.error(err); process.exit(1); });
