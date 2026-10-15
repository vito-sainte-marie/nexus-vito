#!/usr/bin/env node
// nexus-lot-reconciler · script de contrôle déterministe, LECTURE SEULE.
//
// Ce script ne ferme, ne fusionne, ne supprime et n'écrit rien dans le dépôt,
// dans GitHub ni dans Supabase. Il lit le rail au SHA demandé (git cat-file /
// ls-tree, jamais l'arbre de travail), un instantané GitHub optionnel, et
// écrit ses résultats dans un dossier de sortie hors du dépôt.
//
// Usage :
//   node reconcilier.js audit-handoff --depot <chemin git> --rail <ref> [--github <instantane.json>] --sortie <dossier>
//   node reconcilier.js registre      --depot <chemin git> --rail <ref> [--github <instantane.json>] --sortie <dossier>
//
// Les fonctions pures sont exportées pour la recette (tests/recette.js).
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ── Vocabulaire fixé (voir references/statuts-et-preuves.md) ───────────────

const STATUTS_CONSTATES = Object.freeze([
  'EN_COURS', 'ATTENTE_DECISION', 'ATTENTE_AUTORISATION', 'LIVRE_TEST', 'DEPLOYE_PRODUCTION',
  'CLOS_PROUVE', 'CLOS_DECLARE', 'ABANDONNE', 'REMPLACE', 'INDETERMINE',
]);

const NIVEAUX = Object.freeze({ A: 'preuve complète', B: 'preuve technique partielle', C: 'indice documentaire', D: 'état inconnu' });

const EXECUTANTS_SPECIAUX = Object.freeze(['aucun', 'frederic']);
const CAPACITES_SPECIALES = Object.freeze(['AUCUNE']);

const CAPACITES_SENSIBLES = Object.freeze([
  'SUPABASE_PRODUCTION_LECTURE', 'SUPABASE_PRODUCTION_READ_ONLY', 'SUPABASE_PRODUCTION_ECRITURE', 'PRODUCTION_FUSION_DEPLOIEMENT',
]);

// Qui autorise quoi. Une autorisation porte sur UNE action, UN objet, UN environnement.
const AUTORITE_PAR_ACTION = Object.freeze({
  FERMER_ISSUE: 'arbitre',
  FERMER_PR: 'arbitre',
  CONSOMMER_DEMANDE: 'arbitre',
  ARCHIVER_DEMANDE: 'arbitre',
  MODIFIER_STATE: 'arbitre',
  MODIFIER_MANIFESTE: 'frederic',
  DEPLACER_FICHIER: 'arbitre',
  SUPPRIMER_FICHIER: 'frederic',
  SUPPRIMER_BRANCHE: 'frederic',
  FUSIONNER_PR: 'frederic',
  MODIFIER_MIGRATION: 'frederic',
  ECRIRE_SUPABASE: 'frederic',
  MODIFIER_WORKFLOW: 'frederic',
  DEPLOYER: 'frederic',
});

// ── Lecture de fichiers markdown du rail ────────────────────────────────────

function frontmatter(texte) {
  const m = String(texte || '').match(/^---\n([\s\S]*?)\n---/);
  const f = {};
  if (m) for (const l of m[1].split('\n')) { const x = l.match(/^([a-z_]+):\s*(.*)$/); if (x) f[x[1]] = x[2].trim(); }
  return f;
}

// Le contrat est le dernier bloc « NEXT_ACTION_CONTRACT » ; ses lignes sont « CLE: valeur ».
function contrat(texte) {
  const t = String(texte || '');
  const i = t.lastIndexOf('NEXT_ACTION_CONTRACT');
  if (i < 0) return null;
  const c = {};
  for (const l of t.slice(i).split('\n').slice(1)) {
    const x = l.match(/^\s*([A-Z_]+):\s*(.*?)\s*$/);
    if (x) c[x[1]] = x[2].replace(/`/g, '').trim();
    else if (l.trim() && Object.keys(c).length && !/^\s*[A-Z_]+:/.test(l)) break;
  }
  return Object.keys(c).length ? c : null;
}

const seqDe = nom => Number((String(nom).match(/-(\d+)\.md$/) || [])[1] || 0);
const net = v => String(v == null ? '' : v).normalize('NFC').trim();
const vide = v => /^(|aucune?s?|aucun|non|none|néant|n\/a|-)$/i.test(net(v));

// ── Analyse d'un lot (pure) ─────────────────────────────────────────────────
// fichiers : { 'request-1.md': texte, 'decision-1.md': texte, ... }
// etat     : entrée STATE.json du lot, ou null
// registre : { canaux: [...], capacites: [...] }

// Dates d'entrée en vigueur des règles : un fichier antérieur n'est pas jugé sur une règle postérieure.
const REGLES_DATEES = Object.freeze({
  CONTRAT_OBLIGATOIRE: '2026-10-08',   // première décision portant NEXT_ACTION_CONTRACT
  SECTION_DE_PREUVE: '2026-10-10',     // juge de relance : preuve des conditions exigée
  REGISTRE_FERME: '2026-10-14',        // P1 : exécutants et capacités fermés au relais
});

const estMaterialisation = a => {
  const t = String(a || '').replace(/\bsans\s+\S+(\s+\S+){0,3}/gi, ' ');   // « sans exécuter la note » n'est pas une action
  return /mat[ée]rialis/i.test(t) && !/\b(cr[ée]er|implémenter|impl[ée]menter|rédiger|r[ée]diger|corriger|ouvrir|déployer|d[ée]ployer|fusionner|exécuter|ex[ée]cuter|écrire|[ée]crire|tester|livrer)\b/i.test(t);
};

function analyserLot(lotId, fichiers, etat, registre, sources, datesFichiers, horsRegistre) {
  const dates = datesFichiers || {};
  const noms = Object.keys(fichiers || {});
  const demandes = noms.filter(n => /^request-\d+\.md$/.test(n)).sort((a, b) => seqDe(a) - seqDe(b));
  const decisions = noms.filter(n => /^decision-\d+\.md$/.test(n)).sort((a, b) => seqDe(a) - seqDe(b));
  const fmDe = n => frontmatter(fichiers[n]);
  const reponse = {};                       // request → [decisions]
  for (const d of decisions) { const r = fmDe(d).in_reply_to || `request-${seqDe(d)}.md`; (reponse[r] ||= []).push(d); }
  const derniereDemande = demandes.at(-1) || null;
  const derniereDecision = decisions.at(-1) || null;
  const repondueMax = Math.max(0, ...decisions.map(d => seqDe(fmDe(d).in_reply_to || `request-${seqDe(d)}.md`)));
  const enVol = demandes.filter(r => seqDe(r) > repondueMax);
  const sansReponseDepassees = demandes.filter(r => seqDe(r) < repondueMax && !reponse[r]);
  const fmD = derniereDemande ? fmDe(derniereDemande) : {};
  const fmC = derniereDecision ? fmDe(derniereDecision) : {};
  const c = derniereDecision ? contrat(fichiers[derniereDecision]) : null;
  const anomalies = [];
  const a = (code, detail, portee) => anomalies.push({ code, lot: lotId, portee: portee || 'a_traiter', detail, preuve: sources || null });

  const closes = net((c && c.CLOSES) || fmC.closes).toLowerCase();
  const verdict = net((c && c.DECISION) || fmC.decision);
  const executant = c ? net(c.EXECUTANT_NEXT) : '';
  const capacite = c ? net(c.CAPACITE_REQUISE) : '';
  const action = c ? net(c.ACTION_NEXT) : '';
  const apres = (f, regle) => (dates[f] || '9999') >= REGLES_DATEES[regle];

  // Statut constaté au seul vu du Handoff (registre brut : aucun verdict de livraison).
  let constate = 'INDETERMINE';
  if (enVol.length) constate = 'ATTENTE_DECISION';
  else if (c && CAPACITES_SENSIBLES.includes(capacite) && closes !== 'true') constate = 'ATTENTE_AUTORISATION';
  else if (closes === 'true' && (vide(action) || estMaterialisation(action))) constate = 'CLOS_DECLARE';
  else if (closes === 'false' || (closes === 'true' && !vide(action))) constate = 'EN_COURS';
  const clos = constate === 'CLOS_DECLARE';

  // Un dossier déclaré `artefacts_hors_registre` (STATE.json) a été créé avant la normalisation
  // des lots Handoff v2 et NE DOIT PAS recevoir d'entrée STATE.json rétroactive — fabriquer un
  // passé qu'il n'a jamais eu est exactement ce que le registre interdit (voir handoff.js). Sans
  // cette lecture, ces dossiers déclenchaient H08 à tort : 3 faux positifs mesurés le 14/10/2026.
  if (!etat && !horsRegistre) a('H08_DOSSIER_SANS_REGISTRE', `dossier docs/handoff/lots/${lotId}/ sans entrée dans STATE.json`);
  if (etat && !noms.length && !etat.legacy_before_v2) a('H09_REGISTRE_SANS_DOSSIER', 'entrée STATE.json sans dossier de lot');
  if (etat && derniereDecision && etat.derniere_decision && etat.derniere_decision !== derniereDecision) {
    a('H02_DECISION_NON_CONSOMMEE', `STATE.json pointe ${etat.derniere_decision}, le dossier contient ${derniereDecision}`);
  }
  if (etat && enVol.length && etat.statut === 'DECISION_CONSOMMEE') {
    a('H10_CONSOMMEE_MAIS_DEMANDE_EN_VOL', `STATE.json dit DECISION_CONSOMMEE ; ${enVol.join(', ')} sans décision en réponse`);
  }
  if (sansReponseDepassees.length) a('H14_DEMANDES_SANS_REPONSE_DEPASSEES', `${sansReponseDepassees.join(', ')} sans décision en réponse, dépassées par une demande plus récente arbitrée`, 'info');
  if (derniereDecision && !c) {
    a('H03_CONTRAT_ABSENT', `${derniereDecision} (auteur : ${fmC.author || '?'}) sans NEXT_ACTION_CONTRACT`, apres(derniereDecision, 'CONTRAT_OBLIGATOIRE') && !clos ? 'a_traiter' : 'historique');
  }
  if (c) {
    const porteeRegistre = !clos ? 'a_traiter' : 'historique';
    if (executant && registre && !registre.canaux.includes(executant) && !EXECUTANTS_SPECIAUX.includes(executant.toLowerCase())) {
      a('H04_EXECUTANT_HORS_REGISTRE', `EXECUTANT_NEXT « ${executant} » absent de CAPACITES-CANAL.json`, porteeRegistre);
    }
    if (capacite && !vide(capacite) && registre && !registre.capacites.includes(capacite) && !CAPACITES_SPECIALES.includes(capacite)) {
      a('H05_CAPACITE_HORS_REGISTRE', `CAPACITE_REQUISE « ${capacite} » absente de CAPACITES-CANAL.json`, porteeRegistre);
    }
    if (closes === 'true' && !vide(action)) {
      if (estMaterialisation(action)) a('H06_CLOTURE_MATERIALISATION', `CLOSES:true, l'action ne fait que matérialiser la décision`, 'info');
      else a('H06_CLOTURE_AVEC_ACTION', `CLOSES:true avec ACTION_NEXT « ${action.slice(0, 140)} »`);
    }
    if (closes === 'false' && vide(action) && !/BLOCKED/i.test(verdict)) a('H11_SUITE_SANS_ACTION', 'CLOSES:false sans ACTION_NEXT');
  }
  // Une demande qui suit une décision à conditions doit porter sa section de preuve (règle du 10/10).
  for (const dem of demandes) {
    const prec = decisions.filter(d => seqDe(fmDe(d).in_reply_to || `request-${seqDe(d)}.md`) < seqDe(dem)).at(-1);
    if (!prec) continue;
    const v = net((contrat(fichiers[prec]) || {}).DECISION || fmDe(prec).decision);
    if (!/APPROVED_WITH_CONDITIONS/i.test(v)) continue;
    const titre = `## Preuve des conditions de ${prec.replace(/\.md$/, '')}`;
    if (String(fichiers[dem]).includes(titre)) continue;
    const portee = !apres(dem, 'SECTION_DE_PREUVE') ? 'historique' : (enVol.includes(dem) ? 'a_traiter' : 'historique');
    a('H12_CONDITIONS_SANS_SECTION_DE_PREUVE', `${dem} ne porte pas « ${titre} »`, portee);
  }
  // Réarbitrages : plusieurs décisions pour une même demande.
  for (const [r, ds] of Object.entries(reponse)) if (ds.length > 1) a('H07_REARBITRAGE', `${r} a reçu ${ds.length} décisions (${ds.join(', ')})`, ds.length > 2 ? 'a_traiter' : 'info');

  return {
    lot: lotId,
    statut_declare: etat ? etat.statut : null,
    statut_constate_handoff: constate,
    niveau_preuve_livraison: 'D',
    demandes: demandes.length,
    decisions: decisions.length,
    demandes_en_vol: enVol,
    derniere_demande: derniereDemande,
    derniere_decision: derniereDecision,
    repond_a: fmC.in_reply_to || null,
    verdict: verdict || null,
    closes: closes || null,
    executant_next: executant || null,
    capacite_requise: capacite || null,
    action_next: action || null,
    branche: fmD.branch || fmC.branch || null,
    references_pr: [...new Set(Object.values(fichiers || {}).join('\n').match(/(?:PR\s*#|pull\/)(\d{1,4})/gi) || [])].map(x => Number(x.replace(/\D/g, ''))).filter(Boolean).filter((v, i, t) => t.indexOf(v) === i).sort((x, y) => x - y),
    anomalies,
  };
}

// ── Niveau de preuve d'une livraison (pur) ─────────────────────────────────
// p : { sourceAccessible, code, tests, integration, environnement, criteres: {total, satisfaits}, declaration, exigeEnvironnement }

function niveauPreuve(p) {
  const x = p || {};
  if (x.sourceAccessible === false) return { niveau: 'D', motif: 'source inaccessible : rien ne peut être conclu' };
  const crit = x.criteres || {};
  const tousCriteres = crit.total > 0 && crit.satisfaits === crit.total;
  const envOk = x.exigeEnvironnement === false ? true : !!x.environnement;
  if (x.code && x.tests && x.integration && envOk && tousCriteres) return { niveau: 'A', motif: 'code, tests, intégration, environnement et critères cohérents' };
  if (x.code && x.tests) return { niveau: 'B', motif: 'code et tests vérifiés ; validation fonctionnelle ou déploiement à confirmer' };
  if (x.declaration) return { niveau: 'C', motif: 'affirmation sans preuve suffisante du résultat' };
  return { niveau: 'D', motif: 'informations insuffisantes' };
}

// ── Rapprochements candidats (pur) : jamais une conclusion ─────────────────

function radical(id) {
  return String(id).replace(/-\d{8}$/, '').replace(/-\d+$/, '').split('-').slice(0, 2).join('-');
}

function rapprocher(lots) {
  const props = [];
  const parRadical = {};
  for (const l of lots) (parRadical[radical(l.lot)] ||= []).push(l);
  for (const [r, groupe] of Object.entries(parRadical)) {
    if (groupe.length < 2) continue;
    props.push({ type: 'MEME_FAMILLE', lots: groupe.map(g => g.lot), motif: `préfixe commun « ${r} »`, conclusion: 'à examiner : un préfixe commun ne prouve ni doublon ni remplacement' });
  }
  const parPr = {};
  for (const l of lots) for (const pr of l.references_pr || []) (parPr[pr] ||= []).push(l.lot);
  for (const [pr, ls] of Object.entries(parPr)) {
    if (ls.length < 2) continue;
    props.push({ type: 'PR_PARTAGEE', lots: ls, motif: `PR #${pr} citée par ${ls.length} lots`, conclusion: 'à examiner : comparer les critères d\'acceptation avant tout rapprochement' });
  }
  return props;
}

// Remplacement : seulement si TOUS les critères de l'ancien lot sont couverts et prouvés.
function evaluerRemplacement(ancien, nouveau) {
  const crit = ancien.criteres || [];
  const couverts = crit.filter(c => (nouveau.criteres_couverts || []).includes(c));
  if (!crit.length) return { proposition: 'AUCUNE', motif: 'critères de l\'ancien lot inconnus : remplacement non démontrable' };
  if (couverts.length === crit.length && nouveau.niveau === 'A') return { proposition: 'PROPOSER_CLOTURE_PAR_REMPLACEMENT', reference: nouveau.id, motif: 'couverture complète et prouvée' };
  return { proposition: 'GARDER_OUVERT', manque: crit.filter(c => !couverts.includes(c)), motif: couverts.length ? 'couverture partielle' : 'aucun critère couvert' };
}

// ── Garde-fous du nettoyage (purs) ──────────────────────────────────────────

const CANAUX_PERMANENTS_PAR_DEFAUT = Object.freeze(['issue#28']);

function proposerNettoyage(objet, contexte) {
  const ctx = contexte || {};
  const permanents = ctx.canauxPermanents || CANAUX_PERMANENTS_PAR_DEFAUT;
  if (objet.actif) return { action: 'AUCUNE', motif: `${objet.ref} est en exécution Handoff : aucune proposition tant qu'il n'est pas stabilisé` };
  if (permanents.includes(objet.ref)) return { action: 'AUCUNE', motif: `${objet.ref} est un canal opérationnel : il reste ouvert` };
  if (objet.niveau !== 'A') return { action: 'AUCUNE', motif: `preuve de niveau ${objet.niveau || 'D'} : aucune clôture proposée` };
  if (objet.criteresRestants && objet.criteresRestants.length) return { action: 'AUCUNE', motif: `critères restants : ${objet.criteresRestants.join(', ')}` };
  const act = objet.type === 'pr' ? 'FERMER_PR' : objet.type === 'issue' ? 'FERMER_ISSUE' : objet.type === 'branche' ? 'SUPPRIMER_BRANCHE' : 'MODIFIER_STATE';
  return { action: act, autorite: AUTORITE_PAR_ACTION[act], motif: 'preuve complète ; proposition soumise à autorisation' };
}

function autoriser(operation, autorisations) {
  const op = operation || {};
  const liste = autorisations || [];
  const ok = liste.find(z => z.action === op.action && z.objet === op.objet && z.environnement === op.environnement && z.par === AUTORITE_PAR_ACTION[op.action]);
  if (!AUTORITE_PAR_ACTION[op.action]) return { autorise: false, motif: `action « ${op.action} » inconnue` };
  if (!ok) return { autorise: false, motif: `aucune autorisation de ${AUTORITE_PAR_ACTION[op.action]} pour ${op.action} sur ${op.objet} (${op.environnement})` };
  return { autorise: true, motif: `autorisé par ${ok.par} le ${ok.date || '?'}` };
}

function verifierAvantEcriture(empreinteAudit, empreinteActuelle) {
  const champs = ['tete', 'etat', 'dependances'];
  const ecarts = champs.filter(k => JSON.stringify((empreinteAudit || {})[k]) !== JSON.stringify((empreinteActuelle || {})[k]));
  return ecarts.length ? { poursuivre: false, motif: `objet modifié depuis l'audit (${ecarts.join(', ')}) : suspendre et redemander l'arbitrage` } : { poursuivre: true, motif: 'objet inchangé' };
}

function comparerMigrations(test, production) {
  const p = new Set(production || []);
  const t = new Set(test || []);
  return {
    seulement_test: [...t].filter(v => !p.has(v)).sort(),
    seulement_production: [...p].filter(v => !t.has(v)).sort(),
  };
}

// ── Lecture du rail par git (au SHA, jamais l'arbre de travail) ────────────

function git(depot, args) {
  return execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

function lireRail(depot, ref) {
  const sha = git(depot, ['rev-parse', ref]).trim();
  const lire = p => { try { return git(depot, ['cat-file', '-p', `${sha}:${p}`]); } catch (e) { return null; } };
  const state = JSON.parse(lire('docs/handoff/STATE.json') || '{"lots":{}}');
  const cap = JSON.parse(lire('docs/handoff/CAPACITES-CANAL.json') || '{"canaux":{},"capacites":{}}');
  const classees = JSON.parse(lire('docs/handoff/BRANCHES-CLASSEES.json') || '{"classees":[]}');
  const arbo = git(depot, ['ls-tree', '-r', '--name-only', sha, 'docs/handoff/lots/']).split('\n').filter(Boolean);
  const lots = {};
  for (const p of arbo) {
    const m = p.match(/^docs\/handoff\/lots\/([^/]+)\/((?:request|decision)-\d+\.md)$/);
    if (m) (lots[m[1]] ||= {})[m[2]] = lire(p);
  }
  for (const p of arbo) { const m = p.match(/^docs\/handoff\/lots\/([^/]+)\//); if (m) lots[m[1]] ||= {}; }
  const datesFichiers = {};
  let courant = null;
  for (const l of git(depot, ['log', '--reverse', '--diff-filter=A', '--name-only', '--format=@%cI', sha, '--', 'docs/handoff/lots/']).split('\n')) {
    if (l.startsWith('@')) courant = l.slice(1, 11);
    else if (l.trim() && courant) datesFichiers[l.trim()] ||= courant;
  }
  const dates = {};
  for (const id of Object.keys(lots)) {
    const l = git(depot, ['log', '--format=%cI', sha, '--', `docs/handoff/lots/${id}/`]).split('\n').filter(Boolean);
    dates[id] = { premiere: l.at(-1) || null, derniere: l.at(0) || null };
  }
  return {
    sha, state, lots, dates, datesFichiers,
    registre: { canaux: Object.keys(cap.canaux || {}), capacites: Object.keys(cap.capacites || {}) },
    branchesClassees: (classees.classees || []).map(c => c.branche),
    lotActif: state.lot_actif || null,
    artefactsHorsRegistre: new Set((state.artefacts_hors_registre || []).map(a => a.lot_id)),
  };
}

function auditer(rail, github) {
  const ids = [...new Set([...Object.keys(rail.lots), ...Object.keys(rail.state.lots || {})])].sort();
  const registre = ids.map(id => {
    const df = {};
    for (const [p, d] of Object.entries(rail.datesFichiers || {})) { const m = p.match(/^docs\/handoff\/lots\/([^/]+)\/(.+)$/); if (m && m[1] === id) df[m[2]] = d; }
    const r = analyserLot(id, rail.lots[id] || {}, (rail.state.lots || {})[id] || null, rail.registre, `rail@${rail.sha.slice(0, 7)}:docs/handoff/lots/${id}/`, df, (rail.artefactsHorsRegistre || new Set()).has(id));
    r.premiere_activite = (rail.dates[id] || {}).premiere || null;
    r.derniere_activite = (rail.dates[id] || {}).derniere || null;
    r.lot_actif = id === rail.lotActif;
    return r;
  });
  // Successeurs : un lot créé APRÈS celui-ci qui cite l'identifiant d'un lot clos avec reliquat.
  for (const r of registre) {
    r.cite_par = registre.filter(o => o.lot !== r.lot && (o.premiere_activite || '') > (r.premiere_activite || '') && Object.values(rail.lots[o.lot] || {}).some(t => String(t).includes(r.lot))).map(o => o.lot);
    for (const an of r.anomalies) {
      if (an.code === 'H06_CLOTURE_AVEC_ACTION' && r.cite_par.length) {
        an.portee = 'info';
        an.detail += ` ; reliquat repris par ${r.cite_par.join(', ')} (à confirmer sur ses critères)`;
      }
    }
  }
  const anomalies = registre.flatMap(r => r.anomalies);
  if (rail.lotActif && !rail.lots[rail.lotActif]) anomalies.push({ code: 'H13_LOT_ACTIF_SANS_DOSSIER', lot: rail.lotActif, detail: 'STATE.json.lot_actif ne correspond à aucun dossier' });

  const gh = github || null;
  const orphelins = [];
  if (gh) {
    const textesLots = registre.map(r => r.lot);
    for (const pr of gh.pulls_ouvertes || []) {
      const lie = textesLots.find(id => `${pr.title} ${pr.body || ''} ${pr.head}`.includes(id)) || registre.find(r => (r.references_pr || []).includes(pr.number));
      if (!lie) orphelins.push({ type: 'PR_SANS_LOT', ref: `PR #${pr.number}`, detail: `${pr.title} (${pr.head} → ${pr.base})`, conclusion: 'rattachement à vérifier' });
    }
    const fusionnees = new Set([...(gh.branches_fusionnees || []), ...(gh.branches_integrees || [])]);
    const classees = new Set(rail.branchesClassees);
    const prOuvertes = new Set((gh.pulls_ouvertes || []).map(p => p.head));
    const protegees = new Set(['main', 'production', 'handoff-continuite-20260920']);
    for (const b of gh.branches || []) {
      if (protegees.has(b) || fusionnees.has(b) || classees.has(b) || prOuvertes.has(b)) continue;
      orphelins.push({ type: 'BRANCHE_NON_RATTACHEE', ref: b, detail: 'ni fusionnée, ni classée, ni portée par une PR ouverte', conclusion: 'à classer, jamais à supprimer sans autorisation de Frédéric' });
    }
  }
  return { rail_sha: rail.sha, genere_le: new Date().toISOString(), registre, anomalies, rapprochements: rapprocher(registre), orphelins };
}

function principal(argv) {
  const [mode, ...reste] = argv;
  const opt = {};
  for (let i = 0; i < reste.length; i += 2) opt[reste.at(i).replace(/^--/, '')] = reste.at(i + 1);
  if (!['audit-handoff', 'registre'].includes(mode) || !opt.depot || !opt.rail || !opt.sortie) {
    console.error('usage : reconcilier.js audit-handoff|registre --depot <chemin> --rail <ref> [--github <json>] --sortie <dossier>');
    return 2;
  }
  const rail = lireRail(opt.depot, opt.rail);
  const github = opt.github ? JSON.parse(fs.readFileSync(opt.github, 'utf8')) : null;
  const r = auditer(rail, github);
  fs.mkdirSync(opt.sortie, { recursive: true });
  fs.writeFileSync(path.join(opt.sortie, 'registre-brut.json'), JSON.stringify(r, null, 2));
  const cols = ['lot', 'statut_declare', 'statut_constate_handoff', 'niveau_preuve_livraison', 'demandes', 'decisions', 'derniere_demande', 'derniere_decision', 'verdict', 'closes', 'executant_next', 'capacite_requise', 'branche', 'premiere_activite', 'derniere_activite'];
  const csv = [cols.join(';'), ...r.registre.map(l => cols.map(c => String(l[c] == null ? '' : l[c]).replace(/[;\n]/g, ' ')).join(';'))].join('\n');
  fs.writeFileSync(path.join(opt.sortie, 'registre-brut.csv'), csv);
  const parCode = {};
  for (const a of r.anomalies) parCode[`${a.code} [${a.portee}]`] = (parCode[`${a.code} [${a.portee}]`] || 0) + 1;
  console.log(JSON.stringify({ rail: r.rail_sha, lots: r.registre.length, anomalies: parCode, rapprochements: r.rapprochements.length, orphelins: r.orphelins.length }, null, 2));
  return 0;
}

module.exports = {
  REGLES_DATEES, estMaterialisation, STATUTS_CONSTATES, NIVEAUX, CAPACITES_SENSIBLES, AUTORITE_PAR_ACTION,
  frontmatter, contrat, analyserLot, niveauPreuve, rapprocher, evaluerRemplacement,
  proposerNettoyage, autoriser, verifierAvantEcriture, comparerMigrations, auditer,
};

if (require.main === module) process.exitCode = principal(process.argv.slice(2));
