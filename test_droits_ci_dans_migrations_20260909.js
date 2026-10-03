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
  // PORTÉE RESSERRÉE LE 03/10/2026, ET C'EST UNE CORRECTION DE GARDE.
  // `m` est UNE migration — celle qui contient `lecture_recette_station_test`,
  // c'est-à-dire `20260909110000`. Le message disait pourtant « aucune écriture
  // ... sur station_config », une propriété de TOUTE la table. Il affirmait donc
  // plus que ce que la ligne mesure : SEC-023 a depuis ouvert une écriture
  // bornée dans un AUTRE fichier, et cette assertion est restée verte sans
  // jamais la regarder. Une garde qui ne mord pas est pire qu'une garde absente :
  // elle fait croire la question tranchée. Le libellé dit maintenant ce que la
  // ligne mesure, et le bornage de SEC-023 est mesuré par l'assertion dédiée
  // ci-dessous, qui balaie TOUTES les migrations.
  assert.ok(!/grant (insert|update|delete|all)/i.test(m.sql),
    'SEC-018 est une migration de LECTURE : ce fichier-ci ne doit accorder aucune écriture. '
    + 'L’écriture de recette bornée vit dans SEC-023, mesurée séparément.');
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


// SEC-023 — L'ÉCRITURE DE RECETTE SUR station_config, ET LA PREUVE DE SON BORNAGE.
//
// Le 03/10/2026, l'épreuve request-20 était refusée en `42501 permission denied
// for table station_config` : le rôle `nexus_ci_recette` ne portait AUCUN droit
// de table, seulement quatre colonnes en lecture (SEC-018). Frédéric a autorisé
// « une capacité d'écriture TEST strictement minimale », bornée aux deux
// identifiants synthétiques de l'épreuve — et rien de plus.
//
// POURQUOI UNE ASSERTION DÉDIÉE, ET NON UNE ENTRÉE DANS `TABLES_ECRITES_PAR_LA_CI`.
// Cette liste est parcourue avec `migrations.find(...)` : le PREMIER fichier qui
// matche gagne. Y ajouter `station_config` aurait résolu vers `20260909110000`,
// dont le `grant select (...)` matche `grant [^;]*on public.station_config` — la
// boucle serait passée au vert SANS JAMAIS OUVRIR le nouveau fichier. Vérifié
// avant d'écrire, pas supposé. D'où un `filter` sur TOUTES les migrations.
//
// POURQUOI LES COMMENTAIRES SONT RETIRÉS D'ABORD. En JavaScript `[^;]` matche
// aussi les sauts de ligne, et un commentaire SQL `--` ne contient jamais de
// `;` : une sonde `grant[^;]*on public.station_config` matcherait la PROSE d'un
// en-tête qui décrit le droit sans l'accorder. Mesuré comme risque, écarté ici.
const sansCommentaires = sql => sql.replace(/--[^\n]*/g, '');
const IDS_SYNTHETIQUES_23502 = ['nexus-test-repro-23502-neuf', 'nexus-test-repro-23502-existant'];
const ECRITURE_STATION_CONFIG =
  /grant\s+(insert|update|delete|truncate|references|trigger|all)[^;']*on\s+public\.station_config\s+to\s+nexus_ci_recette/i;

t('une seule migration ouvre une écriture sur station_config, et elle est bornée', () => {
  const porteuses = migrations.filter(m => ECRITURE_STATION_CONFIG.test(sansCommentaires(m.sql)));
  assert.strictEqual(porteuses.length, 1,
    'exactement UNE migration doit ouvrir une écriture de recette sur station_config ; '
    + `trouvé ${porteuses.length} : ${porteuses.map(m => m.nom).join(', ') || '(aucune)'}. `
    + 'Plus d’une, et le bornage ne se lit plus en un seul endroit.');
  const m = porteuses[0];
  const sql = sansCommentaires(m.sql);

  // BORNAGE EN COLONNES — l'axe que seul le GRANT peut tenir.
  assert.ok(/grant insert \(site, prix_carburants, horaires, fuseau_horaire, updated_at\)/i.test(sql),
    `${m.nom} : l’INSERT doit rester borné aux cinq colonnes que l’épreuve renseigne`);
  assert.ok(/grant update \(prix_carburants, horaires, updated_at\)/i.test(sql),
    `${m.nom} : l’UPDATE doit rester borné aux colonnes que l’\`on conflict\` touche — jamais \`site\`, qui est la clé de conflit`);
  for (const interdit of ['delete', 'truncate', 'references', 'trigger', 'all']) {
    assert.ok(!new RegExp(`grant\\s+[^;']*\\b${interdit}\\b[^;']*on\\s+public\\.station_config`, 'i').test(sql),
      `${m.nom} : \`${interdit}\` n’est pas nécessaire à INSERT + ON CONFLICT, donc il est interdit`);
  }

  // BORNAGE EN LIGNES — l'axe qu'un GRANT ne sait PAS tenir. Un privilège
  // s'accorde sur une table et des colonnes, jamais sur des valeurs de lignes :
  // sans politique, le droit ci-dessus écrirait n'importe quelle ligne de la
  // table, y compris celles du site de recette réel.
  const politiques = sql.match(/create policy\s+(\w+)\s+on\s+public\.station_config[\s\S]*?\$pol\$/gi) || [];
  assert.ok(politiques.length >= 3,
    `${m.nom} : INSERT, UPDATE et SELECT doivent chacun porter leur politique bornée (trouvé ${politiques.length})`);
  for (const p of politiques) {
    for (const id of IDS_SYNTHETIQUES_23502) {
      assert.ok(p.includes(`'${id}'`),
        `${m.nom} : une politique d’écriture de recette ne cite pas « ${id} » — elle n’est pas bornée aux deux identifiants autorisés`);
    }
    assert.ok(!/nexus-station-test/.test(p),
      `${m.nom} : aucune politique d’ÉCRITURE ne doit désigner « nexus-station-test » — l’autorisation exclut tout droit d’écriture sur un site réel`);
  }
});

t('SEC-023 porte son autorisation, sa limite et sa rejouabilité', () => {
  const m = migrations.filter(x => ECRITURE_STATION_CONFIG.test(sansCommentaires(x.sql)))[0];
  assert.ok(/AUTORISATION HUMAINE : Frédéric Bragance/.test(m.sql),
    'une écriture accordée sans trace de qui l’a accordée ne se distingue pas d’une écriture qu’on s’est donnée');
  assert.ok(/à ne PAS appliquer en Production/i.test(m.sql),
    'cette autorisation ne concerne que nexus-test : la migration doit le dire');
  assert.ok(/pg_roles where rolname = 'nexus_ci_recette'/.test(m.sql),
    'le rôle peut ne pas exister : la migration doit le constater, pas le supposer');
  const drops = (sansCommentaires(m.sql).match(/drop policy if exists/gi) || []).length;
  assert.ok(drops >= 3,
    `chaque politique doit être précédée de son \`drop policy if exists\` (trouvé ${drops}) : sans quoi un second passage échoue`);
});

// CE QU'UNE GARDE STATIQUE NE PEUT PAS PROUVER, ET QUI DOIT DONC ÊTRE CÂBLÉ.
// Tout ce qui précède lit du TEXTE. Qu'une écriture hors des deux identifiants
// soit RÉELLEMENT refusée ne s'observe qu'en base, sous `nexus_ci_recette` — et
// seulement là : mesuré le 03/10/2026, `set role nexus_ci_recette` est refusé
// depuis un poste (`permission denied to set role`), et sous `postgres`, qui
// porte `rolbypassrls`, chaque écriture passerait et le vert dirait l'inverse de
// ce qu'il affirme. Le runner est le seul maillon qui s'y connecte nativement.
// Une épreuve non câblée ne prouve rien : c'est ce que mesure l'assertion
// ci-dessous — pas que l'épreuve est juste, mais que quelqu'un la lance.
t('l’épreuve de bornage SEC-023 existe ET est câblée dans la CI', () => {
  const EPREUVE = 'outils/epreuve-bornage-ecriture-recette-station-config-20261003.sql';
  assert.ok(fs.existsSync(path.join(__dirname, EPREUVE)),
    `${EPREUVE} est désigné par l’en-tête de SEC-023 comme sa seule preuve de bornage : il doit exister`);
  const wf = path.join(__dirname, '.github', 'workflows', 'tests.yml');
  const yml = fs.readFileSync(wf, 'utf8');
  assert.ok(yml.includes(EPREUVE),
    `tests.yml ne lance pas ${EPREUVE} : le bornage resterait affirmé par un en-tête et mesuré par personne`);
  assert.ok(/BORNAGE-000/.test(fs.readFileSync(path.join(__dirname, EPREUVE), 'utf8')),
    'l’épreuve doit REFUSER DE CONCLURE sous une autre identité (BORNAGE-000) : '
    + 'sous un rôle qui contourne la RLS, un vert signifierait l’inverse de ce qu’il affirme');
});

console.log(`\n${n}/${n} vérifications passées — un droit accordé en base existe aussi dans le dépôt.`);
