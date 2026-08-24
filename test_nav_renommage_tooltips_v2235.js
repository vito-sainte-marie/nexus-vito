// Test — Renommage FDJ Opérations/Performance + Carburants Performance,
// et micro-tooltips au survol du menu latéral (Vue bureau)
// (24/08/2026, v2.235, demande de Frédéric : "'Contrôle FDJ' et 'FDJ
// Pilotage' sont trop proches lexicalement alors que leurs fonctions sont
// très différentes [...] Contrôle FDJ → FDJ Opérations, FDJ Pilotage →
// FDJ Performance [...] Je ferais un micro-tooltip au survol, très court,
// en 1 phrase maximum.")
//
// nexus-desktop.js (NEXUS_SIDEBAR_GROUPES) est la SEULE source du menu
// latéral en vue bureau (Article 11) — ce test charge le fichier réel via
// vm (top-level const ne s'attachent pas au contexte vm par défaut, d'où
// le petit pont __probe ci-dessous) plutôt que de dupliquer les libellés
// attendus en dur, pour ne jamais tester une copie qui pourrait diverger
// du fichier livré.

const fs = require('path');
const path = require('path');
const vmMod = require('vm');
const fsMod = require('fs');
const assert = require('assert');

const code = fsMod.readFileSync(path.join(__dirname, 'nexus-desktop.js'), 'utf8');

function chargerSandbox(pathname) {
  const sandbox = {
    document: { addEventListener: () => {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    console,
    window: { location: { pathname: pathname || '/NEXUS-App-v1.html' } },
  };
  vmMod.createContext(sandbox);
  const probe = code + '\nthis.__groups = NEXUS_SIDEBAR_GROUPES; this.__html = nexusConstruireSidebarHTML(); this.__esc = nexusEchapperAttribut;';
  vmMod.runInContext(probe, sandbox);
  return sandbox;
}

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

const sandbox = chargerSandbox();
const groups = sandbox.__groups;
const flat = groups.flatMap(g => g.items);
const parLabel = {};
flat.forEach(i => { parLabel[i.label] = i; });

// ------------------------------------------------------------
// 1) Les 3 anciens libellés ambigus ont disparu, les 3 nouveaux existent,
//    avec le même href qu'avant (aucun écran renommé côté fichier).
// ------------------------------------------------------------
{
  assert.ok(!parLabel['Contrôle FDJ'], '"Contrôle FDJ" ne doit plus exister dans le menu');
  assert.ok(!parLabel['FDJ Pilotage'], '"FDJ Pilotage" ne doit plus exister dans le menu');
  assert.ok(!parLabel['Carburants Pilotage'], '"Carburants Pilotage" ne doit plus exister dans le menu');
  assert.strictEqual(parLabel['FDJ Opérations'].href, 'NEXUS-FDJ-Manager-v1.html');
  assert.strictEqual(parLabel['FDJ Performance'].href, 'NEXUS-FDJ-Analyse-v1.html');
  assert.strictEqual(parLabel['Carburants Performance'].href, 'NEXUS-Carburants-Pilotage-v1.html');
  ok('renommage — anciens libellés absents, nouveaux libellés présents avec le bon href (fichier inchangé)');
}

// ------------------------------------------------------------
// 2) Chaque item du menu a une description de tooltip (aucun oubli), et
//    chaque description est bien une SEULE phrase courte (contrainte
//    explicite de Frédéric : "très court, une phrase maximum").
// ------------------------------------------------------------
{
  const sansDesc = flat.filter(i => !i.desc);
  assert.strictEqual(sansDesc.length, 0, `items sans description de tooltip : ${sansDesc.map(i => i.label).join(', ')}`);
  const troisPhrasesOuPlus = flat.filter(i => (i.desc.match(/[.!?]/g) || []).length > 1);
  assert.strictEqual(troisPhrasesOuPlus.length, 0, `descriptions de plus d'une phrase : ${troisPhrasesOuPlus.map(i => i.label).join(', ')}`);
  ok('tooltips — chaque item du menu a une description, toutes tiennent en une seule phrase');
}

// ------------------------------------------------------------
// 3) Les descriptions fournies littéralement par Frédéric sont reprises
//    telles quelles (pas reformulées), pour les items qu'il a cités.
// ------------------------------------------------------------
{
  const attendues = {
    'Brief NEXUS': 'Synthèse des priorités et décisions du moment.',
    'Cockpit': 'Votre plan d’action opérationnel du jour.',
    'Journal': 'Historique des faits, actions et événements NEXUS.',
    'Capital NEXUS': 'Valeur économique générée ou sécurisée par vos décisions.',
    'Scanner NEXUS': 'Détecte les anomalies, écarts et opportunités commerciales.',
    'Radar du Manager': 'Vue rapide des zones qui nécessitent votre attention.',
    'Produits': 'Analyse les ventes, rotations et performances produits.',
    'Tempo': 'Repère les jours et périodes à renforcer.',
    'Campagnes': 'Suit la performance de vos actions commerciales.',
    'Scanner Stock': 'Repère les écarts et références à recompter.',
    'Verify': 'Contrôle les caisses et rapproche les moyens de paiement.',
    'Carburants': 'Saisie et suivi des jaugeages carburant.',
    'Réception carburant': 'Contrôle les livraisons et les volumes réellement reçus.',
    'Carburants Performance': 'Analyse volumes, autonomie, écarts et tendances carburant.',
    'Inventaire': 'Guide les comptages terrain de l’équipe.',
    'Contrôle inventaire': 'Analyse les écarts, anomalies et comptages à traiter.',
    'FDJ Opérations': 'Gère quarts, caisse, carnets et mouvements FDJ.',
    'FDJ Performance': 'Analyse ventes, jeux, écarts et tendances FDJ.',
    'Coach FDJ': 'Donne à l’employé une priorité FDJ claire et contextualisée.',
    'Missions': 'Crée et suit les tâches opérationnelles.',
    'Assignations': 'Répartit les actions entre les membres de l’équipe.',
    'Planning': 'Organise la présence et les horaires de l’équipe.',
    'Évaluations': 'Évalue la réalisation et la qualité du travail.',
    'Résultats': 'Suit la progression et les performances de l’équipe.',
  };
  Object.entries(attendues).forEach(([label, desc]) => {
    assert.strictEqual(parLabel[label].desc, desc, `description de "${label}" divergente du texte fourni par Frédéric`);
  });
  ok('tooltips — les 24 descriptions fournies par Frédéric sont reprises littéralement, sans reformulation');
}

// ------------------------------------------------------------
// 4) Le HTML généré porte bien les attributs data-tooltip/data-tooltip-desc
//    sur chaque lien concerné, avec échappement des guillemets/esperluettes
//    (aucune donnée utilisateur ici, mais robustesse si un texte évolue).
// ------------------------------------------------------------
{
  const html = sandbox.__html;
  assert.ok(html.includes('data-tooltip="FDJ Opérations" data-tooltip-desc="Gère quarts, caisse, carnets et mouvements FDJ."'));
  assert.ok(html.includes('data-tooltip="FDJ Performance" data-tooltip-desc="Analyse ventes, jeux, écarts et tendances FDJ."'));
  assert.ok(html.includes('data-tooltip="Carburants Performance"'));
  assert.ok(!html.includes('Contrôle FDJ'));
  assert.ok(!html.includes('FDJ Pilotage'));
  assert.ok(!html.includes('Carburants Pilotage'));
  assert.strictEqual(sandbox.__esc('a "b" & c'), 'a &quot;b&quot; &amp; c');
  ok('HTML généré — data-tooltip/data-tooltip-desc présents et corrects, échappement OK, aucun ancien libellé résiduel');
}

// ------------------------------------------------------------
// 5) Le lien actif (page courante) est toujours correctement marqué même
//    après renommage — la comparaison se fait sur `href`, jamais sur le
//    libellé, donc le renommage ne doit rien casser ici.
// ------------------------------------------------------------
{
  const sandboxFdjOps = chargerSandbox('/NEXUS-FDJ-Manager-v1.html');
  assert.ok(sandboxFdjOps.__html.includes('nexus-sidebar-link active" href="NEXUS-FDJ-Manager-v1.html"'), 'FDJ Opérations doit être marqué actif quand on est sur NEXUS-FDJ-Manager-v1.html');
  ok('lien actif — toujours déterminé par href, insensible au renommage du libellé');
}

// ------------------------------------------------------------
// 6) nexusInstallerTooltipsSidebar existe et ne plante jamais si le DOM
//    ne contient aucun lien avec data-tooltip (garde-fou early return).
// ------------------------------------------------------------
{
  const sandbox2 = {
    document: { addEventListener: () => {}, querySelectorAll: () => [], createElement: () => ({ classList: { add: () => {}, remove: () => {} }, querySelector: () => ({}) }) },
    localStorage: { getItem: () => null, setItem: () => {} },
    console,
    window: { location: { pathname: '/x' } },
  };
  vmMod.createContext(sandbox2);
  vmMod.runInContext(code + '\nthis.__run = () => nexusInstallerTooltipsSidebar();', sandbox2);
  assert.doesNotThrow(() => sandbox2.__run());
  ok('nexusInstallerTooltipsSidebar — ne plante jamais quand aucun lien avec tooltip n\'est présent dans le DOM');
}

console.log(`\n${n}/${n} tests passés — Renommage FDJ/Carburants + tooltips menu (v2.235).`);
