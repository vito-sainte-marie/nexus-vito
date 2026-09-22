// ÉPREUVE DU FUSEAU DANS PARAMÈTRES STATION — LE FUSEAU EST UN PARAMÈTRE
// STRUCTUREL, PAS UN RÉGLAGE DE STATION. 20/09/2026.
//
// CE QUI A ÉTÉ MESURÉ. Du 24/08 au 20/09/2026, Paramètres Station portait un
// `<select id="fuseau_horaire">` qui lisait et écrivait
// `station_config.fuseau_horaire`. Cette colonne est DÉPRÉCIÉE depuis la
// migration 20260905131500_fuseau_horaire_par_site.sql, qui a porté
// l'autorité sur `sites.timezone` et l'a inscrit dans le commentaire du
// schéma. Plus aucune fonction SQL du jour métier ne la lit, et le code
// client a été corrigé le 19/09. Le manager réglait donc un fuseau que rien
// n'appliquait — et l'écran lui en accusait réception. Un réglage sans effet,
// confirmé à l'utilisateur, est pire qu'un réglage absent : il produit une
// certitude fausse.
//
// L'ARBITRAGE (20/09/2026, option a). L'autorité reste `sites.timezone`. Le
// fuseau devient un paramètre STRUCTUREL réservé au créateur, comme le nom du
// site et le forfait. AUCUNE nouvelle voie d'écriture n'est ouverte au
// manager : ni policy RLS, ni RPC `SECURITY DEFINER`. L'écran l'AFFICHE, en
// lecture seule, et dit où il se modifie.
//
// CE QUE CETTE ÉPREUVE PEUT, ET CE QU'ELLE NE PEUT PAS. Elle n'ouvre aucune
// connexion et ne rend aucun DOM : elle lit les sources livrées. Elle ne dit
// donc pas que l'écran fonctionne. Elle dit qu'il n'existe, dans ce qui est
// livré, ni second lecteur du fuseau, ni chemin d'écriture depuis cet écran,
// ni valeur de repli — et que la RLS de `sites` n'a pas été élargie pour
// compenser. La RLS réelle, elle, se mesure en base ; c'est fait ailleurs.
//
// PRÉCAUTION. Les commentaires de ces fichiers CITENT les anciens noms pour
// expliquer ce qui a été corrigé. Une garde qui balaierait les fichiers
// entiers se déclencherait sur son propre récit. On ne lit ici que les lignes
// de code : commentaires HTML et lignes `//` retirés.
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = process.env.NEXUS_RACINE || __dirname;
const MIGRATIONS = path.join(RACINE, 'supabase', 'migrations');

let ok = 0;
const echecs = [];
function verifierQue(libelle, condition, pourquoi) {
  if (condition) { ok++; console.log(`  ✓ ${libelle}`); }
  else { echecs.push(`${libelle}\n      → ${pourquoi}`); console.log(`  ✗ ${libelle}`); }
}

function codeSeul(fichier) {
  const brut = fs.readFileSync(path.join(RACINE, fichier), 'utf8');
  return brut
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
}

const BRUT_PARAM = fs.readFileSync(path.join(RACINE, 'NEXUS-Parametres-Station-v1.html'), 'utf8');
const PARAM = codeSeul('NEXUS-Parametres-Station-v1.html');
const AUTH = codeSeul('nexus-auth.js');
const STATION = codeSeul('nexus-station.js');
const POINTAGE = codeSeul('NEXUS-Pointage-v1.html');
const PDP = codeSeul('NEXUS-Prise-De-Poste-v1.html');

console.log('Fuseau — Paramètres Station affiche l’autorité, il ne la fabrique pas\n');

// ─── 1. L'ÉCRAN LIT `sites.timezone`, ET DANS LA REQUÊTE QUI EXISTE DÉJÀ ────
// Article 11 : pas un second appel réseau pour un champ de la même ligne de la
// même table. La requête `sites` de cet écran lisait déjà forfait et
// nom_entreprise ; `timezone` s'y ajoute.
console.log('1. L’écran lit sites.timezone');
verifierQue('La requête `sites` de l’écran lit `timezone` avec forfait et nom_entreprise',
  /\.from\('sites'\)\.select\('forfait, nom_entreprise, timezone'\)/.test(PARAM),
  'un second appel réseau pour le fuseau recréerait, en plus cher, le lecteur concurrent qu’on supprime (Article 11)');
verifierQue('La valeur affichée vient de `data.timezone`',
  /data\.timezone/.test(PARAM) && /fuseauStation/.test(PARAM),
  'afficher un fuseau qui ne vient pas de la colonne, c’est afficher autre chose que l’autorité');
verifierQue('Le fuseau a un porteur d’affichage dédié dans le HTML',
  /id="fuseauStation"/.test(BRUT_PARAM),
  'sans élément nommé, la lecture n’arrive jamais à l’écran');

// ─── 2. IL NE LIT PLUS LA COLONNE DÉPRÉCIÉE ────────────────────────────────
console.log('\n2. L’écran ne lit plus station_config.fuseau_horaire');
verifierQue('Aucune occurrence de `fuseau_horaire` ne subsiste dans le code de l’écran',
  !/fuseau_horaire/.test(PARAM),
  'deux lecteurs ne peuvent pas rester autorités concurrentes du jour métier');
verifierQue('`chargerConfig()` ne demande plus que les horaires à `station_config`',
  /\.from\('station_config'\)\.select\('horaires'\)\.eq\('site', employee\.site_id\)/.test(PARAM),
  'station_config reste la table des HORAIRES ; le fuseau n’y est plus lu');

// ─── 3. UN MANAGER NE PEUT PAS MODIFIER LE FUSEAU DEPUIS CET ÉCRAN ─────────
// Trois portes à fermer : le champ, l'écriture de la colonne dépréciée, et
// toute écriture vers `sites` depuis cet écran.
console.log('\n3. Le manager ne peut pas modifier le fuseau depuis cet écran');
verifierQue('Le `<select id="fuseau_horaire">` n’existe plus dans le HTML livré',
  !/id="fuseau_horaire"/.test(BRUT_PARAM),
  'un champ de saisie EST la capacité de modifier, quoi qu’en dise la note à côté');
verifierQue('Aucun champ éditable ne porte le fuseau',
  !/<(input|select|textarea)[^>]*fuseau/i.test(BRUT_PARAM)
  && !/contenteditable[^>]*fuseauStation|fuseauStation[^>]*contenteditable/i.test(BRUT_PARAM),
  'la lecture seule se démontre par l’absence de porte, pas par une intention');
const ecrituresSites = PARAM.split('\n').filter((l) => /\.from\('sites'\)/.test(l)
  && /\.(update|upsert|insert|delete)\(/.test(l));
verifierQue('Aucune ligne de cet écran n’écrit dans la table `sites`',
  ecrituresSites.length === 0,
  `la RLS réserve toute écriture de sites au créateur : une telle ligne échouerait pour un manager (${ecrituresSites.length} trouvée(s))`);
verifierQue('L’upsert des horaires ne porte plus le fuseau',
  /\{ site: employee\.site_id, horaires: config, updated_at:/.test(PARAM)
  && !/timezone\s*:/.test(PARAM),
  'écrire une colonne que rien ne lit produit un accusé de réception mensonger');

// ─── 4. AUCUN REPLI SILENCIEUX ─────────────────────────────────────────────
// Un repli est une TROISIÈME source de vérité : une valeur qu'aucune base ne
// porte, et que l'appelant ne peut pas distinguer d'une valeur lue.
console.log('\n4. Aucun fallback America/Martinique n’est introduit');
for (const [nom, src] of [['Paramètres Station', PARAM], ['nexus-auth.js', AUTH], ['nexus-station.js', STATION]]) {
  verifierQue(`Aucune constante \`America/Martinique\` dans le code de ${nom}`,
    !/America\/Martinique/.test(src),
    'un repli codé en dur est une troisième source de vérité, et une source muette');
}
verifierQue('Aucun identifiant IANA n’est utilisé comme valeur de repli dans l’écran',
  !/\|\|\s*'[A-Za-z]+\/[A-Za-z_]+'/.test(PARAM),
  'la forme `x || \'Zone/Ville\'` est exactement celle du repli qu’on retire');
verifierQue('`data.timezone` n’est replié sur aucune valeur',
  !/data\.timezone\s*\|\|\s*'/.test(PARAM),
  'sites.timezone est NOT NULL et gardée par un trigger IANA : il n’y a rien à substituer');
verifierQue('Le cas non lisible est NOMMÉ à l’écran',
  /non déclaré/.test(PARAM) && /indisponible pour le moment/.test(PARAM),
  'ne pas pouvoir lire doit se voir ; un blanc se confond avec une valeur');
verifierQue('Aucune constante de repli ne subsiste dans `nexus-auth.js`',
  !/NEXUS_FUSEAU_DEFAUT/.test(fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8')),
  'la correction du 19/09/2026 avait supprimé cette constante ; elle ne doit pas revenir');

// ─── 5. LES DROITS RLS DE `sites` NE SONT PAS ÉLARGIS ──────────────────────
// C'est la borne explicite de l'arbitrage : le fuseau devient un paramètre de
// créateur, et AUCUNE compensation n'est offerte au manager.
console.log('\n5. Les droits RLS de sites ne sont pas élargis');
const fichiersSql = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
const policiesSites = [];
const definerEcrivantSites = [];
const grantsSites = [];
for (const f of fichiersSql) {
  const sql = fs.readFileSync(path.join(MIGRATIONS, f), 'utf8');
  const sansCommentaires = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  for (const m of sansCommentaires.matchAll(/create\s+policy\s+([a-z0-9_]+)\s+on\s+(?:public\.)?sites\b/gi)) {
    policiesSites.push({ f, nom: m[1] });
  }
  // Un UPDATE de migration n'est pas une voie d'écriture : il s'exécute une
  // fois, sous le rôle du déploiement. Ce qui est interdit, c'est une
  // FONCTION qui écrirait le fuseau — elle, le manager pourrait l'appeler.
  // Un corps de fonction vit entre deux délimiteurs `$…$` : une occurrence
  // précédée d'un nombre IMPAIR de délimiteurs est dans un corps.
  for (const m of sansCommentaires.matchAll(/update\s+(?:only\s+)?(?:public\.)?sites\b[\s\S]{0,400}?\btimezone\b/gi)) {
    const delimiteursAvant = (sansCommentaires.slice(0, m.index).match(/\$[a-z_]*\$/gi) || []).length;
    if (delimiteursAvant % 2 === 1) definerEcrivantSites.push({ f, extrait: m[0].slice(0, 60) });
  }
  for (const m of sansCommentaires.matchAll(/grant\s+[^;]*\b(update|insert|all)\b[^;]*\bon\s+(?:table\s+)?(?:public\.)?sites\b[^;]*/gi)) {
    grantsSites.push({ f, extrait: m[0].slice(0, 80) });
  }
}
// Les quatre policies connues, et leurs noms exacts. `select_sites` ouvre la
// lecture aux authentifiés ; les trois autres sont gardées par le créateur.
const ATTENDUES = ['createur_delete_sites', 'createur_insert_sites', 'createur_update_sites', 'select_sites'];
const nomsTrouves = [...new Set(policiesSites.map((p) => p.nom))].sort();
verifierQue('Les migrations ne déclarent que les quatre policies connues sur `sites`',
  JSON.stringify(nomsTrouves) === JSON.stringify(ATTENDUES),
  `attendu ${ATTENDUES.join(', ')} — trouvé ${nomsTrouves.join(', ') || '(aucune)'}`);
const migCreateur = fs.readFileSync(path.join(MIGRATIONS, '20260728140338_rls_cleanup_merge_duplicate_policies_and_initplan.sql'), 'utf8');
verifierQue('`createur_update_sites` reste gardée par `je_suis_createur()` des deux côtés',
  /create policy createur_update_sites on public\.sites for update to authenticated\s*\n\s*using \(\(select je_suis_createur\(\)\)\)\s*\n\s*with check \(\(select je_suis_createur\(\)\)\)/.test(migCreateur),
  'c’est cette policy qui fait du fuseau un paramètre structurel ; l’assouplir annulerait l’arbitrage');
verifierQue('Aucune fonction SQL n’écrit `sites.timezone`',
  definerEcrivantSites.length === 0,
  `une RPC SECURITY DEFINER écrivant le fuseau rouvrirait au manager la porte que la RLS ferme (${definerEcrivantSites.map((d) => d.f).join(', ')})`);
verifierQue('Aucun GRANT d’écriture sur `sites` n’est accordé à un rôle',
  grantsSites.length === 0,
  `la RLS ne protège rien si le privilège de table est donné ailleurs (${grantsSites.map((g) => g.f).join(', ')})`);

// ─── 6. LE JOUR MÉTIER CONTINUE DE VENIR DE `sites.timezone` ───────────────
// Cette épreuve retire un lecteur ; elle ne doit pas déplacer les autres.
console.log('\n6. Pointage, Prise de poste et le jour métier lisent toujours sites.timezone');
const corpsFuseauSite = (AUTH.match(/async function nexusFuseauSite\([\s\S]*?\n  \}/) || [])[0] || '';
verifierQue('`nexusFuseauSite` (nexus-auth.js) lit `sites.timezone`',
  /\.from\('sites'\)/.test(corpsFuseauSite) && /select\('timezone'\)/.test(corpsFuseauSite),
  'c’est le lecteur de jour métier chargé par TOUS les écrans');
verifierQue('`fuseauDeLaStation` (nexus-station.js) lit `sites.timezone`',
  /\.from\('sites'\)\.select\('timezone'\)/.test(STATION),
  'c’est la référence stricte, celle que Prise de poste appelle');
verifierQue('Pointage ne lit aucun fuseau hors de ces lecteurs',
  !/fuseau_horaire/.test(POINTAGE) && /nexusFuseauSite/.test(POINTAGE),
  'un lecteur local rendrait le jour métier dépendant de l’écran qui le pose');
verifierQue('Prise de poste passe par `NexusStation.fuseauDeLaStation`',
  !/fuseau_horaire/.test(PDP) && /NexusStation\.fuseauDeLaStation/.test(PDP),
  'la prise de poste date des services : elle ne peut pas deviner le fuseau');
// Les fonctions SQL du jour métier. Elles lisent `sites.timezone` depuis le
// 05/09/2026 ; aucune ne doit être revenue à la colonne dépréciée.
const SQL_JOUR_METIER = [
  '20260905170000_reprise_et_unicite_shifts_en_cours.sql',
  '20260905180000_cloture_shift_au_pointage_depart.sql',
  '20260906120000_pompiste_du_jour_fuseau_station.sql',
  '20260911180500_depart_ferme_son_propre_service.sql',
  '20260916193000_prise_de_poste_ninvente_plus_la_fin.sql',
];
for (const f of SQL_JOUR_METIER) {
  const sql = fs.readFileSync(path.join(MIGRATIONS, f), 'utf8');
  const code = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  verifierQue(`${f.slice(0, 30)}… lit sites.timezone, pas la colonne dépréciée`,
    /\btimezone\b/.test(code) && !/station_config[\s\S]{0,40}fuseau_horaire|fuseau_horaire/.test(code),
    'une seule autorité du jour métier, en base comme dans le code');
}

console.log('');
if (echecs.length) {
  echecs.forEach((e) => console.log(`  ✗ ${e}`));
  console.log(`\n${ok} contrôles verts, ${echecs.length} rouges`);
  process.exit(1);
}
console.log(`${ok} contrôles verts, 0 rouges`);
