// ADR-0001 — garde statique de la portée site.
//
// POURQUOI. Six fois, la même faiblesse : « acteur contrôlé, portée oubliée ».
// Les trois premières ont été trouvées par hasard, les trois suivantes parce
// qu'on cherchait le motif. Une ADR dit où regarder ; elle ne regarde pas.
// Cette garde regarde.
//
// CE QU'ELLE N'EST PAS. Elle ne prouve pas « toute la sécurité RLS ». Elle
// protège UN invariant : sur une table à portée site, une policy de mutation
// qui contrôle l'acteur doit aussi contrôler la portée. Les preuves
// comportementales adversariales restent nécessaires ailleurs.
//
// D'OÙ VIENT SA MATIÈRE. Des migrations versionnées, rejouées dans l'ordre —
// pas d'une base vivante. Aucun secret, aucun réseau, reproductible en CI.
// Le prix de ce choix est qu'elle ne comprend qu'une grammaire bornée ; quand
// elle ne comprend pas, elle dit UNKNOWN et ne conclut jamais SAFE.
'use strict';

const fs = require('fs');
const path = require('path');

const CLASSES = ['SAFE', 'VULNERABLE', 'UNKNOWN', 'NOT_APPLICABLE'];

// Q63 (arbitrage SITE-EXPLICITE-1-NAMED-HELPERS-BEHAVIOR-PROOF-20260906) — le
// registre des aides devient une dépendance SÉMANTIQUE de la garde, pas
// seulement documentaire. Une policy ne peut pas être SAFE si l'aide qui la
// couvre est marquée défaillante, ou si elle n'a pas (ou plus) de preuve
// comportementale courante : `est_pompiste_du_jour` s'est révélée limpide à
// la lecture et fausse au comportement, et la garde continuait pourtant de
// classer SAFE les sept policies qui s'appuient sur elle.
const STATUTS_AIDES = ['CONFORME', 'NON_EPROUVEE', 'DEFAILLANTE'];

// ── Formes de contrôle de portée réellement observées ───────────────────
// Deux écritures pour la même chose. Ne reconnaître que la première a déjà
// produit cinq fausses alertes pendant la matrice UPDATE : la garde doit
// connaître les deux, et rester ouverte à en apprendre d'autres — d'où
// `UNKNOWN` plutôt que `VULNERABLE` en cas de doute.
const FORMES_PORTEE = [
  /current_employee_site_id\s*\(/i,                        // via la fonction
  /site(_id)?\s*(=|in)\s*\(?\s*select[\s\S]{0,200}?site_id[\s\S]{0,200}?employees/i, // via sous-requête
  /\b\w+\.site(_id)?\s*=\s*\w+\.site(_id)?/i,               // jointure de portée entre deux tables
];

// Les aides nommées ne sont plus codées en dur : elles vivent dans un registre
// versionné. Une aide inconnue rend UNKNOWN — jamais SAFE — et une aide
// déclarée sans preuve de son contrat ne suffit pas non plus. Sans cette
// règle, chaque refactorisation bien intentionnée rendrait la garde un peu
// plus aveugle.
function aidesDeclarees(racine) {
  const f = path.join(racine, 'docs', 'gouvernance', 'garde-portee-site-aides.json');
  if (!fs.existsSync(f)) return [];
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  return (d.aides || []).filter(a => {
    if (!a.nom) throw new Error('Aide sans nom dans le registre.');
    if (!a.preuve || !String(a.preuve).trim()) {
      throw new Error(`Aide « ${a.nom} » déclarée sans preuve de son contrat : elle ne peut pas rendre une policy SAFE.`);
    }
    if (!STATUTS_AIDES.includes(a.statut)) {
      throw new Error(`Aide « ${a.nom} » — statut ${JSON.stringify(a.statut)} hors vocabulaire (${STATUTS_AIDES.join('|')}) : le câblage Q63 ne peut pas juger si elle couvre une policy.`);
    }
    return true;
  }).map(a => ({ nom: a.nom, statut: a.statut }));
}

// Ce qu'une expression RLS peut appeler sans que ce soit une aide de portée.
const APPELS_NEUTRES = new Set([
  // fonctions et constructions sans rapport avec la portée
  'select','exists','any','all','array','count','coalesce','auth.uid','uid',
  'current_employee_role','je_suis_createur','lower','upper','now','btrim',
  // mots-clés SQL suivis d'une parenthèse — `and (`, `or (` ne sont pas des
  // appels de fonction. Les compter comme des aides inconnues faisait sortir
  // en UNKNOWN une policy parfaitement lisible.
  'and','or','not','in','is','case','when','then','else','end','values',
  'from','where','join','on','as','distinct','order','by','limit','using','check',
]);

// Quatrième forme, apprise au tri des UNKNOWN : `nexus_clients_ecriture_ok(site)`
// est une aide nommée qui vérifie `role IN (manager,gerant) AND site = site du
// compte`. Vingt-deux policies l'utilisaient, et la garde ne voyait qu'un
// appel de fonction inconnu. Une aide bien nommée est plus lisible qu'une
// expression recopiée — mais elle est invisible à qui ne cherche que des
// motifs syntaxiques.
//
// Troisième forme, apprise à la calibration du 06/09/2026 :
// `advisor_message_evidence` contrôlait bien la portée, par une jointure
// `e.site_id = m.site_id` entre l'employé et le message. La garde la
// classait VULNERABLE faute de la connaître. Une garde qui ne connaît pas
// toutes les manières d'écrire une règle produit des accusations, pas des
// constats — et c'est précisément l'erreur qu'elle est censée éviter.

// Contrôles d'ACTEUR — c'est leur présence sans portée qui fait le motif.
const FORMES_ACTEUR = [
  /auth\.uid\s*\(/i,
  /current_employee_role\s*\(/i,
  /e\.role\s*=\s*any/i,
  /employee_id\s*=/i,
  /actor_id\s*=/i,
];

const FORME_CREATEUR = /je_suis_createur\s*\(/i;
const contient = (txt, formes) => !!txt && formes.some(f => f.test(txt));

// ── Rejeu du DDL des policies ───────────────────────────────────────────
// Grammaire volontairement étroite : create / drop / alter policy. Tout ce
// qui n'entre pas dedans est compté comme non compris, et le rapport le dit
// plutôt que de le passer sous silence.
const RE_CREATE = /create\s+policy\s+"?([\w]+)"?\s+on\s+(?:public\.)?"?([\w]+)"?([\s\S]*?);/gi;
const RE_DROP = /drop\s+policy\s+(?:if\s+exists\s+)?"?([\w]+)"?\s+on\s+(?:public\.)?"?([\w]+)"?/gi;
const RE_ALTER = /alter\s+policy\s+"?([\w]+)"?\s+on\s+(?:public\.)?"?([\w]+)"?([\s\S]*?);/gi;

// La clause `TO` est une frontière de confiance, pas un détail : une policy
// réservée à `service_role` n'est jamais empruntée par une identité
// utilisateur. La garde l'ignorait et classait ces policies comme des trous
// potentiels.
function extraireRoles(corps) {
  const m = /\bto\s+([\w,\s]+?)(?:\s+using|\s+with\s+check|$)/i.exec(corps);
  return m ? m[1].split(',').map(r => r.trim().toLowerCase()).filter(Boolean) : [];
}

function extraireCommande(corps) {
  const m = /\bfor\s+(all|select|insert|update|delete)\b/i.exec(corps);
  return m ? m[1].toLowerCase() : 'all';
}

// `using (...)` et `with check (...)` avec appariement de parenthèses : une
// expression RLS en contient presque toujours, une regex paresseuse tronque.
function extraireClause(corps, motCle) {
  const re = new RegExp(motCle + '\\s*\\(', 'i');
  const m = re.exec(corps);
  if (!m) return null;
  let i = m.index + m[0].length, profondeur = 1, debut = i;
  while (i < corps.length && profondeur > 0) {
    if (corps[i] === '(') profondeur++;
    else if (corps[i] === ')') profondeur--;
    i++;
  }
  return profondeur === 0 ? corps.slice(debut, i - 1) : null;
}

function rejouerMigrations(dossier) {
  const etat = new Map();          // "table.policy" -> {table, policy, cmd, using, withCheck, source}
  const colonnesSite = new Set();  // tables où une colonne site/site_id est visible
  let nonCompris = 0;

  for (const f of fs.readdirSync(dossier).filter(x => x.endsWith('.sql')).sort()) {
    // Les guillemets d'un dump — `ON "public"."table"`, `"e"."site_id"` —
    // cassaient à la fois la capture du nom de table (qui rendait « public »)
    // et la reconnaissance des formes de portée. On les retire avant toute
    // analyse. Les identifiants de NEXUS sont tous en minuscules sans espace,
    // donc la normalisation ne perd rien ; si un identifiant exotique
    // apparaissait, il ressortirait en UNKNOWN, jamais en SAFE.
    const sql = fs.readFileSync(path.join(dossier, f), 'utf8')
      .split('\n').filter(l => !/^\s*--/.test(l)).join('\n')
      .replace(/"([a-z_][a-z0-9_]*)"/gi, '$1');

    // Colonnes de portée, telles qu'on peut les voir statiquement.
    for (const m of sql.matchAll(/(?:create\s+table[^;]*?|add\s+column\s+)"?(\w+)"?[^;]*?\b(site|site_id)\b/gi)) {
      colonnesSite.add(m[1]);
    }
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?\s*\(([\s\S]*?)\n\s*\);/gi)) {
      if (/\b(site|site_id)\b\s+(text|uuid|varchar)/i.test(m[2])) colonnesSite.add(m[1]);
    }

    RE_DROP.lastIndex = 0;
    for (const m of sql.matchAll(RE_DROP)) etat.delete(`${m[2]}.${m[1]}`);

    RE_CREATE.lastIndex = 0;
    for (const m of sql.matchAll(RE_CREATE)) {
      const [, policy, table, corps] = m;
      etat.set(`${table}.${policy}`, {
        table, policy, cmd: extraireCommande(corps), roles: extraireRoles(corps),
        using: extraireClause(corps, 'using'),
        withCheck: extraireClause(corps, 'with\\s+check'),
        source: f,
      });
      if (/\bsite(_id)?\b/i.test(corps)) colonnesSite.add(table);
    }

    RE_ALTER.lastIndex = 0;
    for (const m of sql.matchAll(RE_ALTER)) {
      const cle = `${m[2]}.${m[1]}`;
      const p = etat.get(cle);
      if (!p) { nonCompris++; continue; }
      const u = extraireClause(m[3], 'using');
      const w = extraireClause(m[3], 'with\\s+check');
      if (u !== null) p.using = u;
      if (w !== null) p.withCheck = w;
      p.source = f;
    }
  }
  return { policies: [...etat.values()], colonnesSite, nonCompris };
}

// ── Classification ──────────────────────────────────────────────────────
// Le contrôle qui s'applique à la NOUVELLE ligne. Pour un UPDATE sans
// `with check`, PostgreSQL réutilise `using` — l'ignorer aurait fait compter
// 42 faux trous.
function controleEffectif(p) {
  if (p.cmd === 'delete') return p.using;
  if (p.cmd === 'insert') return p.withCheck;
  return p.withCheck !== null ? p.withCheck : p.using;
}

function appelsInconnus(ctrl, aides) {
  const connus = new Set([...APPELS_NEUTRES, ...aides.map(a => a.toLowerCase())]);
  const trouves = [...String(ctrl).matchAll(/([a-z_][a-z0-9_.]*)\s*\(/gi)]
    .map(m => m[1].toLowerCase().replace(/^public\./, ''));
  return [...new Set(trouves.filter(f => !connus.has(f)))];
}

function classer(p, colonnesSite, aides) {
  aides = aides || [];
  if (!['insert', 'update', 'delete', 'all'].includes(p.cmd)) {
    return { classe: 'NOT_APPLICABLE', motif: 'policy de lecture' };
  }
  if (!colonnesSite.has(p.table)) {
    return { classe: 'NOT_APPLICABLE', motif: 'aucune portée site visible sur cette table' };
  }
  // Frontière de confiance explicite : `service_role` n'est pas une identité
  // utilisateur. Ce n'est PAS une absolution — c'est un déplacement du
  // contrôle vers la couche qui détient la clé de service, et le tri doit le
  // documenter comme tel.
  const roles = p.roles || [];
  if (roles.length && roles.every(r => r === 'service_role')) {
    return { classe: 'NOT_APPLICABLE', motif: 'réservée à service_role — hors identité utilisateur' };
  }
  const ctrl = controleEffectif(p);
  if (ctrl === null || ctrl === undefined) {
    return { classe: 'UNKNOWN', motif: 'aucun contrôle lisible pour la nouvelle ligne' };
  }
  const noms = aides.map(a => a.nom);
  const aidesUtilisees = aides.filter(a => new RegExp('\\b' + a.nom + '\\s*\\(', 'i').test(ctrl));
  const parAide = aidesUtilisees.length > 0;
  if (parAide || contient(ctrl, FORMES_PORTEE)) {
    // Même reconnue, une expression qui appelle une aide NON déclarée reste
    // douteuse : on ne sait pas ce que cette aide vérifie.
    const inconnues = appelsInconnus(ctrl, noms);
    if (inconnues.length) {
      return { classe: 'UNKNOWN', motif: 'aide non déclarée au registre : ' + inconnues.join(', ') };
    }
    // Q63 — le registre est une dépendance sémantique, pas un décor. La
    // policy n'est jamais plus sûre que l'aide la plus faible qu'elle
    // combine par OR : une seule branche défaillante suffit à ouvrir l'accès.
    if (parAide) {
      const defaillantes = aidesUtilisees.filter(a => a.statut === 'DEFAILLANTE');
      if (defaillantes.length) {
        return { classe: 'VULNERABLE', motif: 'aide déclarée DEFAILLANTE au registre : ' + defaillantes.map(a => a.nom).join(', ') + ' — le registre dit que son contrat n’est pas tenu, la policy ne peut pas être crue SAFE sur sa seule forme SQL' };
      }
      const nonEprouvees = aidesUtilisees.filter(a => a.statut !== 'CONFORME');
      if (nonEprouvees.length) {
        return { classe: 'UNKNOWN', motif: 'aide sans statut CONFORME courant au registre : ' + nonEprouvees.map(a => a.nom).join(', ') };
      }
    }
    return { classe: 'SAFE', motif: parAide ? 'portée contrôlée par une aide déclarée conforme' : 'la portée est contrôlée' };
  }
  const inconnues = appelsInconnus(ctrl, noms);
  if (inconnues.length) {
    return { classe: 'UNKNOWN', motif: 'aide non déclarée au registre : ' + inconnues.join(', ') };
  }
  if (FORME_CREATEUR.test(ctrl)) {
    // Capacité transverse assumée : ce n'est ni sûr ni vulnérable au sens de
    // l'ADR, c'est une décision métier qui doit être relue.
    return { classe: 'UNKNOWN', motif: 'branche créateur — capacité transverse à relire' };
  }
  if (contient(ctrl, FORMES_ACTEUR)) {
    return { classe: 'VULNERABLE', motif: 'acteur contrôlé, portée oubliée — motif ADR-0001' };
  }
  // Refuser tout n'est PAS une preuve de portée : exigence explicite.
  return { classe: 'UNKNOWN', motif: 'contrôle ni d’acteur ni de portée — à relire' };
}

// ── Cohérence entre faces d'une même table ──────────────────────────────
function incoherences(resultats) {
  const parTable = new Map();
  for (const r of resultats) {
    if (r.classe === 'NOT_APPLICABLE') continue;
    if (!parTable.has(r.table)) parTable.set(r.table, []);
    parTable.get(r.table).push(r);
  }
  const trouvees = [];
  for (const [table, faces] of parTable) {
    const sures = faces.filter(f => f.classe === 'SAFE').map(f => f.cmd);
    const faibles = faces.filter(f => f.classe === 'VULNERABLE').map(f => f.cmd);
    if (sures.length && faibles.length) {
      trouvees.push({ table, sures, faibles,
        motif: 'créer, modifier et supprimer n’obéissent pas au même contrat de portée' });
    }
  }
  return trouvees;
}

function analyser(racine) {
  const { policies, colonnesSite, nonCompris } = rejouerMigrations(path.join(racine, 'supabase', 'migrations'));
  const derogations = lireDerogations(racine);
  const aides = aidesDeclarees(racine);
  const resultats = policies.map(p => {
    const c = classer(p, colonnesSite, aides);
    const d = derogations.find(x => x.table === p.table && x.policy === p.policy);
    // Une dérogation vise une policy nommée sur une table nommée. Elle ne vaut
    // que si la classe observée est bien celle qui a été autorisée : si la
    // policy se dégradait, l'autorisation cesserait de la couvrir.
    return { ...p, ...c,
      derogation: d && d.classe_attendue === c.classe ? d : null,
      classeEffective: (d && d.classe_attendue === c.classe) ? 'SAFE_DEROGE' : c.classe };
  });
  return { resultats, incoherences: incoherences(resultats), nonCompris, tablesPortantes: colonnesSite.size };
}

// Registre d'exceptions EXPLICITE : chaque écart est nommé, motivé, daté,
// attribué. Une exclusion silencieuse serait un contrôle désactivé.
function lireDerogations(racine) {
  const f = path.join(racine, 'docs', 'gouvernance', 'garde-portee-site-derogations.json');
  if (!fs.existsSync(f)) return [];
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const x of d.derogations || []) {
    for (const champ of ['table', 'policy', 'classe_attendue', 'motif', 'autorise_par', 'le']) {
      if (!x[champ]) throw new Error(`Dérogation incomplète : ${champ} manquant sur ${x.policy || '(sans nom)'}`);
    }
  }
  return d.derogations || [];
}

module.exports = { analyser, classer, controleEffectif, rejouerMigrations, extraireClause, extraireRoles, appelsInconnus, aidesDeclarees, CLASSES, STATUTS_AIDES };

if (require.main === module) {
  const { resultats, incoherences: inc, nonCompris, tablesPortantes } = analyser(path.resolve(__dirname, '..'));
  const par = c => resultats.filter(r => r.classeEffective === c);
  for (const r of par('VULNERABLE')) console.log(`  VULNERABLE     ${r.table}.${r.policy} (${r.cmd}) — ${r.motif}`);
  for (const r of par('UNKNOWN')) console.log(`  UNKNOWN        ${r.table}.${r.policy} (${r.cmd}) — ${r.motif}`);
  for (const i of inc) console.log(`  INCOHERENCE    ${i.table} : sûres [${i.sures}] vs faibles [${i.faibles}]`);
  for (const r of par('SAFE_DEROGE')) console.log(`  DÉROGÉE        ${r.table}.${r.policy} — ${r.derogation.motif}`);
  console.log(`\n${resultats.length} policies analysées sur ${tablesPortantes} tables à portée site.`);
  for (const c of ['SAFE', 'VULNERABLE', 'UNKNOWN', 'NOT_APPLICABLE', 'SAFE_DEROGE']) {
    console.log(`  ${c.padEnd(16)} ${par(c).length}`);
  }
  console.log(`  incohérences     ${inc.length}`);
  console.log(`  DDL non compris  ${nonCompris}`);
  process.exit(par('VULNERABLE').length || inc.length ? 1 : 0);
}
