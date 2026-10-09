// Un droit accordé en base doit exister dans le dépôt.
//
// Le 08/09/2026, la politique `lecture_recette_station_test` (SEC-018) a été
// posée à la main sur nexus-test : l'outillage refusait alors d'écrire un
// fichier accordant des privilèges. Elle vivait donc en base et NULLE PART
// dans le dépôt.
//
// Le défaut ne s'est vu que le 09/09, en reconstruisant Test depuis les
// migrations : la politique ne revenait pas, le rôle CI perdait un droit
// accordé, et l'étape de dérive — rendue bloquante la veille — serait passée
// au rouge à juste titre. C'est exactement ce qu'une répétition sert à
// trouver ; sans elle, l'écart se découvrait en Production.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DIR = path.join(__dirname, 'supabase', 'migrations');
const migrations = fs.readdirSync(DIR).filter(f => f.endsWith('.sql'))
  .map(f => ({ nom: f, sql: fs.readFileSync(path.join(DIR, f), 'utf8') }));

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

// Ce que la CI exige de pouvoir faire sur Test. Chaque entrée doit avoir sa
// migration : c'est le contrat entre ce que le rail attend et ce que le dépôt
// sait reconstruire.
const DROITS_ATTENDUS = [
  { nom: 'lecture_recette_station_test', table: 'station_config',
    pourquoi: 'SEC-018 — la CI constate la dérive de l’instantané de recette' },
  { nom: 'publication_ci', table: 'nexus_live_events',
    pourquoi: 'SEC-019 — la CI publie le journal Live' },
  { nom: 'recette_ci_site_test', table: 'audits_caisse',
    pourquoi: 'SEC-019 — la CI sème le scénario Carburants' },
];

// UNE POLITIQUE SANS DROIT DE TABLE NE S'APPLIQUE À RIEN. Le rôle ne voit même
// pas la table, et PostgreSQL répond « relation does not exist » — un message
// qui fait chercher une table manquante là où le problème est un privilège
// absent. C'est ce qui a fait échouer la CI le 09/09/2026 après reconstruction.
const TABLES_ECRITES_PAR_LA_CI = ['audits_caisse', 'carburant_releves', 'nexus_live_events'];

// EN AMONT DE TOUT : sans `usage` sur le schéma, un droit de table est inerte
// et une politique RLS ne s'applique à rien. La reconstruction du 09/09/2026 a
// recréé le schéma en n'accordant `usage` qu'aux rôles que Supabase pose à la
// création d'un projet — jamais à `nexus_ci_recette`, créé plus tard.
const DROIT_RACINE = /grant usage on schema public to nexus_ci_recette/i;

t('chaque droit attendu par la CI est créé par une migration', () => {
  for (const d of DROITS_ATTENDUS) {
    const trouvees = migrations.filter(m => m.sql.includes(d.nom));
    assert.ok(trouvees.length > 0,
      `aucune migration ne crée « ${d.nom} » (${d.pourquoi}) : une reconstruction ne le recréerait pas`);
  }
});

t('le droit d’ENTRER dans le schéma existe dans une migration', () => {
  assert.ok(migrations.some(m => DROIT_RACINE.test(m.sql)),
    'sans `usage` sur public, PostgreSQL répond « relation does not exist » — '
    + 'un message qui fait chercher une table manquante là où manque un privilège');
});

t('toute table que la CI ÉCRIT reçoit aussi un droit de table', () => {
  for (const table of TABLES_ECRITES_PAR_LA_CI) {
    const m = migrations.find(x =>
      new RegExp(`grant [^;]*on public\\.${table} to nexus_ci_recette`, 'i').test(x.sql));
    assert.ok(m, `aucune migration n’accorde de droit de table sur ${table} : `
      + 'la politique RLS existe mais ne s’applique à rien, et PostgreSQL dira « relation does not exist »');
    assert.ok(!/grant [^;]*delete[^;]*on public\.(audits_caisse|carburant_releves)/i.test(m.sql),
      `${table} : la CI ne doit pas pouvoir supprimer`);
  }
});

t('ces droits restent bornés — en lignes ET en colonnes', () => {
  // Un droit reproductible mais trop large serait pire qu'un droit absent :
  // il se rejouerait à chaque reconstruction, sans que personne n'y revienne.
  const m = migrations.find(x => x.sql.includes('lecture_recette_station_test'));
  assert.ok(/site = 'nexus-station-test'/.test(m.sql),
    'la politique doit rester bornée à la station de recette');
  assert.ok(/grant select \(site, fuseau_horaire, cuves_carburants, carburant_commande_config\)/.test(m.sql),
    'le grant doit rester borné aux colonnes comparées');
  assert.ok(!/grant (insert|update|delete|all)/i.test(m.sql),
    'aucune écriture ne doit être accordée au rôle CI sur station_config');
});

t('la migration Test/CI porte son autorisation humaine et sa limite', () => {
  const m = migrations.find(x => x.sql.includes('lecture_recette_station_test'));
  assert.ok(/AUTORISATION HUMAINE : Frédéric Bragance/.test(m.sql),
    'un droit sans trace de qui l’a accordé ne se distingue pas d’un droit qu’on s’est donné');
  assert.ok(/à ne PAS appliquer en Production/i.test(m.sql),
    'une migration Test/CI doit dire qu’elle ne va pas en Production');
});

t('elle est REJOUABLE — une reconstruction la repasse sans échouer', () => {
  const m = migrations.find(x => x.sql.includes('lecture_recette_station_test'));
  assert.ok(/drop policy if exists lecture_recette_station_test/.test(m.sql),
    'sans le drop préalable, un second passage échouerait sur une politique existante');
  assert.ok(/pg_roles where rolname = 'nexus_ci_recette'/.test(m.sql),
    'le rôle peut ne pas exister : la migration doit le constater, pas le supposer');
});

t('la CI ne peut pas signer au nom d’un humain', () => {
  // `publication_ci` a REFUSÉ une vraie usurpation le 08/09/2026. La
  // reproduire sans sa clause rendrait le journal incapable de prouver ce
  // qu'il raconte.
  const m = migrations.find(x => /create policy publication_ci/.test(x.sql));
  assert.ok(m, 'la politique de publication doit vivre dans une migration');
  assert.ok(/array\['ci', 'guardian'\]/.test(m.sql),
    'la limite aux acteurs ci et guardian doit être reproduite à l’identique');
  assert.ok(!/grant [^;]*select[^;]*on public\.nexus_live_events to nexus_ci_recette/i.test(m.sql),
    'le rôle CI publie, il ne lit pas (SEC-003)');
});

console.log(`\n${n}/${n} vérifications passées — un droit accordé en base existe aussi dans le dépôt.`);
