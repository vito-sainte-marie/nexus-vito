// Guardians backend — routeur silencieux (Gouvernance Autonome v2 / ADR-0002).
//
// POURQUOI. La v1 de la gouvernance faisait des Guardians des interlocuteurs
// que Claude ou Orchestrator devaient consulter à la main : cinq relectures
// conversationnelles par lot, alors que la plupart des lots ne violent
// aucune règle. ADR-0002 demande l'inverse : un contrôle backend qui ne
// parle QUE s'il a un finding, déclenché par ce que le diff touche réellement
// (`docs/learning/RULES.json` filtré par scope/module), jamais tout le temps
// sur tout le dépôt.
//
// CE QU'IL N'EST PAS. Il ne remplace pas la revue humaine ni les preuves
// comportementales. Les contrôles ci-dessous sont volontairement bornés à
// ce qui est mécanisable aujourd'hui — un contrôle qui ne sait pas conclure
// dit UNKNOWN/silence, jamais SAFE par défaut.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.resolve(__dirname, '..');
const RULES_PATH = path.join(RACINE, 'docs', 'learning', 'RULES.json');
const BRANCHE_CANONIQUE = 'config-par-environnement';

// ── Diff scope ──────────────────────────────────────────────────────────
// Le routeur ne charge que les fichiers réellement changés entre deux refs.
// Sans base résolvable (premier commit, dépôt superficiel), il retombe sur
// « tout le dépôt versionné » — plus lent, jamais silencieusement incomplet.
function git(args) {
  return execFileSync('git', args, { cwd: RACINE, encoding: 'utf8' }).trim();
}

function fichiersChanges(base, tete) {
  try {
    const sortie = git(['diff', '--name-only', `${base}...${tete}`]);
    return sortie ? sortie.split('\n') : [];
  } catch (err) {
    try {
      return git(['ls-files']).split('\n').filter(Boolean);
    } catch (err2) {
      return [];
    }
  }
}

// ── Scopes déduits du chemin ────────────────────────────────────────────
// Heuristique volontairement simple et déclarée : un chemin peut porter
// plusieurs scopes. Pas d'inférence sémantique — seulement des motifs de
// chemin déjà établis par l'usage réel du dépôt.
const REGLES_SCOPE = [
  { motif: /^supabase\/migrations\//, scopes: ['security', 'supabase', 'architecture'] },
  { motif: /^outils\//, scopes: ['development', 'architecture', 'github'] },
  { motif: /^docs\/gouvernance\//, scopes: ['orchestrator', 'architecture'] },
  { motif: /^docs\/learning\//, scopes: ['orchestrator', 'learning'] },
  { motif: /^docs\/handoff\//, scopes: ['orchestrator', 'handoff'] },
  { motif: /^\.github\/workflows\//, scopes: ['github', 'security'] },
  { motif: /^test_.*\.js$/, scopes: ['qa', 'regression'] },
  { motif: /carburant/i, scopes: ['business_rules'] },
];
const MODULES_PATH = [
  { motif: /carburant/i, module: 'carburants-performance' },
];

function scopesPourFichier(f) {
  const scopes = new Set();
  for (const r of REGLES_SCOPE) if (r.motif.test(f)) for (const s of r.scopes) scopes.add(s);
  return scopes;
}
function modulesPourFichier(f) {
  const modules = new Set();
  for (const m of MODULES_PATH) if (m.motif.test(f)) modules.add(m.module);
  return modules;
}

function calculerScopes(fichiers) {
  const scopes = new Set();
  const modules = new Set();
  for (const f of fichiers) {
    for (const s of scopesPourFichier(f)) scopes.add(s);
    for (const m of modulesPourFichier(f)) modules.add(m);
  }
  return { scopes, modules };
}

function chargerRegles() {
  if (!fs.existsSync(RULES_PATH)) return [];
  const d = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
  return Array.isArray(d.rules) ? d.rules : [];
}

function reglesEnPortee(regles, scopes, modules) {
  return regles.filter(r => {
    const scopeOk = Array.isArray(r.scope) && r.scope.some(s => scopes.has(s));
    const moduleOk = r.module === 'all' || modules.has(r.module);
    return scopeOk && moduleOk;
  });
}

// ── Guardian Architecture & Coherence — préflight HEAD canonique (ENV-001) ─
// « Claude must work from the expected canonical HEAD of config-par-environnement ;
// stale-main derived execution is blocked before coding. » Cette fonction est
// le contrôle mécanique de cette règle — elle est appelée par un lanceur de
// lot (outils/handoff.js ou équivalent futur), pas seulement par ce routeur.
function preflightHeadCanonique({ brancheAttendue = BRANCHE_CANONIQUE } = {}) {
  let branche;
  try { branche = git(['rev-parse', '--abbrev-ref', 'HEAD']); }
  catch (err) { return { ok: false, motif: `HEAD illisible : ${err.message}` }; }
  if (branche === brancheAttendue) return { ok: true, branche };
  let aJourAvecCanonique = false;
  try {
    git(['merge-base', '--is-ancestor', `origin/${brancheAttendue}`, 'HEAD']);
    aJourAvecCanonique = true;
  } catch (err) { aJourAvecCanonique = false; }
  if (aJourAvecCanonique) return { ok: true, branche, ancetreCanonique: true };
  return {
    ok: false,
    branche,
    motif: `HEAD (${branche}) ne descend pas de origin/${brancheAttendue} — exécution bloquée avant codage (ENV-001).`,
  };
}

// ── Guardian Security & Isolation ──────────────────────────────────────
const MOTIFS_SECRET = [
  { nom: 'jwt_litteral', motif: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { nom: 'service_role_assigne', motif: /service_role["'\s]*[:=]\s*["'][^"'\s]{12,}["']/i },
  { nom: 'cle_supabase_assignee', motif: /SUPABASE_(SERVICE_ROLE|SECRET)_KEY\s*[:=]\s*["'][^"'\s]{8,}["']/i },
];

function guardianSecurity(fichiers) {
  const findings = [];
  for (const f of fichiers) {
    const chemin = path.join(RACINE, f);
    if (!fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) continue;
    let contenu;
    try { contenu = fs.readFileSync(chemin, 'utf8'); } catch (err) { continue; }
    for (const { nom, motif } of MOTIFS_SECRET) {
      if (motif.test(contenu)) {
        findings.push({ guardian: 'Security & Isolation', fichier: f, code: nom,
          message: `motif de secret potentiel (${nom}) détecté — vérifier avant tout push.` });
      }
    }
  }
  return findings;
}

// ── Guardian Architecture & Coherence — collision d'identité globale ────
// Généralisation du constat réel `NexusStock` (nexus-stock.js vs
// nexus-stock-moteur.js, audit-1.md du lot GUARDIAN-ARCHITECTURE-COHERENCE) :
// deux fichiers ne doivent jamais déclarer la même identité globale.
const RE_IDENTITE_GLOBALE = /\b(?:window|global)\.([A-Za-z_$][\w$]*)\s*=/g;

function identitesGlobalesDeclarees(racine) {
  const parIdentite = new Map();
  const fichiersJs = fs.readdirSync(racine).filter(f => f.endsWith('.js'));
  for (const f of fichiersJs) {
    let contenu;
    try { contenu = fs.readFileSync(path.join(racine, f), 'utf8'); } catch (err) { continue; }
    let m;
    RE_IDENTITE_GLOBALE.lastIndex = 0;
    while ((m = RE_IDENTITE_GLOBALE.exec(contenu))) {
      const nom = m[1];
      if (!parIdentite.has(nom)) parIdentite.set(nom, new Set());
      parIdentite.get(nom).add(f);
    }
  }
  return parIdentite;
}

function guardianArchitectureCollisions() {
  const findings = [];
  const parIdentite = identitesGlobalesDeclarees(RACINE);
  for (const [nom, fichiers] of parIdentite) {
    if (fichiers.size > 1) {
      findings.push({
        guardian: 'Architecture & Coherence',
        code: 'identite_globale_dupliquee',
        message: `\`${nom}\` est déclarée par ${fichiers.size} fichiers (${[...fichiers].sort().join(', ')}) — collision silencieuse possible si les deux sont un jour inclus ensemble.`,
      });
    }
  }
  return findings;
}

// Aucun fichier applicatif ne doit dépendre de docs/gouvernance, docs/learning
// ou outils (ADR-0002 : « absence de dependance applicative »).
function guardianArchitectureDependances(fichiers) {
  const findings = [];
  const RE_DEP = /docs\/(gouvernance|learning)\/|(?:require\(\s*['"]\.{0,2}\/?outils\/)/;
  for (const f of fichiers) {
    if (f.startsWith('outils/') || f.startsWith('docs/') || f.startsWith('test_') || f.startsWith('.github/')) continue;
    if (!f.endsWith('.js') && !f.endsWith('.html')) continue;
    const chemin = path.join(RACINE, f);
    if (!fs.existsSync(chemin)) continue;
    let contenu;
    try { contenu = fs.readFileSync(chemin, 'utf8'); } catch (err) { continue; }
    if (RE_DEP.test(contenu)) {
      findings.push({
        guardian: 'Architecture & Coherence',
        fichier: f,
        code: 'dependance_applicative_vers_gouvernance',
        message: 'fichier applicatif référençant docs/gouvernance, docs/learning ou outils — la gouvernance ne doit jamais devenir une dépendance d\'exécution du produit.',
      });
    }
  }
  return findings;
}

// ── Assemblage ──────────────────────────────────────────────────────────
function executer({ base, tete, brancheAttendue } = {}) {
  const head = tete || 'HEAD';
  let refBase = base;
  if (!refBase) {
    try { git(['rev-parse', '--verify', 'HEAD~1']); refBase = 'HEAD~1'; }
    catch (err) { refBase = head; }
  }
  const fichiers = fichiersChanges(refBase, head);
  const { scopes, modules } = calculerScopes(fichiers);
  const regles = reglesEnPortee(chargerRegles(), scopes, modules);

  const findings = [];
  if (scopes.has('security') || scopes.has('supabase')) {
    findings.push(...guardianSecurity(fichiers));
  }
  if (scopes.has('architecture') || fichiers.some(f => f.endsWith('.js'))) {
    findings.push(...guardianArchitectureCollisions());
    findings.push(...guardianArchitectureDependances(fichiers));
  }
  return { fichiers, scopes: [...scopes], modules: [...modules], reglesEnPortee: regles.map(r => r.id), findings };
}

module.exports = {
  preflightHeadCanonique,
  guardianSecurity,
  guardianArchitectureCollisions,
  guardianArchitectureDependances,
  identitesGlobalesDeclarees,
  calculerScopes,
  scopesPourFichier,
  reglesEnPortee,
  chargerRegles,
  fichiersChanges,
  executer,
};

if (require.main === module) {
  const base = process.env.NEXUS_GUARDIANS_BASE_REF;
  const tete = process.env.NEXUS_GUARDIANS_HEAD_REF;
  const { findings, fichiers, scopes, reglesEnPortee: rp } = executer({ base, tete });
  if (!findings.length) {
    console.log(`Guardians: OK — ${fichiers.length} fichier(s) changé(s), scopes [${scopes.join(', ') || 'aucun'}], ${rp.length} règle(s) en portée, 0 finding.`);
    process.exit(0);
  }
  console.log(`Guardians: ${findings.length} finding(s).`);
  for (const f of findings) {
    console.log(`  [${f.guardian}] ${f.code}${f.fichier ? ` (${f.fichier})` : ''} — ${f.message}`);
  }
  process.exit(1);
}
