// NEXUS — contrat de résolution pré-auth (prénom → identifiant technique)
//
// Contexte : la recette candidate #65 (`rebuild/carburants-65-20260922`)
// échouait à « Recette navigateur authentifiée » avec « Prénom non reconnu »
// pour Manager Test. Cause vérifiée dans cette session : le fichier candidat
// interroge encore `employees_public` en anonyme par `ilike`, alors que
// `supabase/migrations/20260904175747_login_non_enumerable.sql` a
// délibérément révoqué ce SELECT le 04/09/2026 et fourni à la place une
// fonction dédiée (`nexus_identifiant_de_connexion`). L'ACL Test n'est donc
// PAS accidentelle : c'est le candidat qui porte une version pré-correctif,
// jamais mise à jour depuis la reconstruction sur la base de `production`
// (merge-base 501c0c7).
//
// Ce fichier prouve trois choses, sans aucun réseau ni secret :
//   1. le contrat SQL déjà déployé (lu dans la migration) ne peut renvoyer
//      qu'un identifiant unique ou rien — jamais une liste, jamais une autre
//      colonne ;
//   2. un vérificateur statique du script de connexion détecte la violation
//      réelle du candidat (SHA cité par l'issue) et valide le fichier
//      corrigé livré dans ce lot ;
//   3. ce vérificateur mord réellement : une mutation qui réintroduit le
//      motif vulnérable est détectée (preuve négative).
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

// ── 1. Le contrat SQL déjà déployé — lu, pas supposé ────────────────────
const SQL_MIGRATION = fs.readFileSync(
  path.join(RACINE, 'supabase/migrations/20260904175747_login_non_enumerable.sql'),
  'utf8'
);

verifier(
  "la migration définit nexus_identifiant_de_connexion(p_prenom text) returns text",
  /create or replace function public\.nexus_identifiant_de_connexion\(p_prenom text\)\s*\nreturns text/.test(SQL_MIGRATION)
);

verifier(
  "la fonction est SECURITY DEFINER (seule façon de traverser RLS pour une question aussi étroite)",
  /security definer/.test(SQL_MIGRATION)
);

verifier(
  "le corps ne renvoie JAMAIS plus d'une ligne : garde count(*) = 1 avant tout retour",
  /case when count\(\*\) = 1 then min\(e\.username\) end/.test(SQL_MIGRATION)
);

// On isole le CORPS de la fonction (entre les deux `$$`), pas le fichier
// entier : le commentaire de la migration mentionne lui-même « pas de
// select * » en prose, ce qui ferait échouer une recherche sur tout le
// fichier sans rien prouver sur le code réellement exécuté.
const CORPS_FONCTION_MATCH = SQL_MIGRATION.match(/as \$\$([\s\S]*?)\$\$;/);
verifier(
  "le corps de la fonction a bien été isolé pour l'inspection (délimiteurs $$ trouvés)",
  !!CORPS_FONCTION_MATCH
);
const CORPS_FONCTION = CORPS_FONCTION_MATCH ? CORPS_FONCTION_MATCH[1] : '';

verifier(
  "le corps ne sélectionne que le username — jamais nom, id, ou select *",
  /min\(e\.username\)/.test(CORPS_FONCTION) && !/select\s+\*/i.test(CORPS_FONCTION)
);

verifier(
  "EXECUTE est révoqué de PUBLIC avant d'être ré-accordé nommément",
  /revoke all on function public\.nexus_identifiant_de_connexion\(text\) from public/.test(SQL_MIGRATION)
);

verifier(
  "EXECUTE est accordé nommément à anon (c'est la seule porte pré-auth voulue)",
  /grant execute on function public\.nexus_identifiant_de_connexion\(text\) to anon/.test(SQL_MIGRATION)
);

verifier(
  "la même migration referme employees_public à anon (SELECT révoqué)",
  /revoke select on public\.employees_public from anon/.test(SQL_MIGRATION)
);

verifier(
  "et repasse la vue sous RLS (security_invoker = true) — elle n'est pas supprimée, elle cesse d'être une porte anonyme",
  /alter view public\.employees_public set \(security_invoker = true\)/.test(SQL_MIGRATION)
);

// ── 2. Vérificateur statique du script de connexion ─────────────────────
//
// Fonction PURE : elle ne lit que le texte passé en argument, jamais un
// fichier elle-même. Séparée de la lecture pour pouvoir être rejouée contre
// une variante mutée sans toucher le disque (leçon du 08/09/2026 : un
// vérificateur qui n'accepte que le fichier réel ne peut pas prouver qu'il
// mord).
function verifierContratLoginPreAuth(source) {
  const urlCodeeEnDur = /const\s+SUPABASE_URL\s*=\s*["']https?:\/\//.test(source);
  const utiliseConfigPartage = /window\.NEXUS_CONFIG/.test(source);

  const interrogeEmployeesPublicEnAnonyme = /\.from\(\s*["']employees_public["']\s*\)/.test(source);
  const appelleRpcDedie = /\.rpc\(\s*["']nexus_identifiant_de_connexion["']\s*,\s*\{\s*p_prenom\s*:/.test(source);

  // Un appel pré-auth qui accepterait un joker (ilike/like) ou un filtre
  // libre (or(...)) redeviendrait un oracle d'énumération, même s'il visait
  // une fonction : on vérifie donc l'ABSENCE de ces motifs sur la ligne
  // d'appel pré-auth, pas seulement la présence du bon nom de fonction.
  const utiliseOperateurJoker = /\.ilike\(|\.like\(|\.or\(/.test(source);

  // Deux messages de refus distincts pour "prénom inconnu" et "PIN
  // incorrect" transforment l'écran en oracle : un visiteur sans PIN
  // apprend qu'un prénom donné existe. Exigence posée par
  // .github/recettes/CADRAGE-nexus-test.md, déjà respectée sur canonique.
  const messagesRefusDistincts =
    /non reconnu/i.test(source) && /pin incorrect/i.test(source) &&
    !/const\s+REFUS\s*=/.test(source);

  const conforme =
    !urlCodeeEnDur &&
    utiliseConfigPartage &&
    !interrogeEmployeesPublicEnAnonyme &&
    appelleRpcDedie &&
    !utiliseOperateurJoker &&
    !messagesRefusDistincts;

  return {
    conforme,
    urlCodeeEnDur,
    utiliseConfigPartage,
    interrogeEmployeesPublicEnAnonyme,
    appelleRpcDedie,
    utiliseOperateurJoker,
    messagesRefusDistincts,
  };
}

// ── 3. Le fichier canonique (déjà correctif, en service sur ce rail) ────
const CANONIQUE = fs.readFileSync(path.join(RACINE, 'NEXUS-Login-v1.html'), 'utf8');
const verdictCanonique = verifierContratLoginPreAuth(CANONIQUE);

verifier(
  "NEXUS-Login-v1.html canonique (handoff-continuite-20260920) est conforme au contrat pré-auth non énumérable",
  verdictCanonique.conforme
);

// ── 4. Le fichier corrigé livré pour le candidat #65 dans ce lot ───────
const CORRIGE_65 = path.join(
  RACINE,
  'docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-login-corrige-65-20260928.html'
);
const contenuCorrige65 = fs.readFileSync(CORRIGE_65, 'utf8');
const verdictCorrige65 = verifierContratLoginPreAuth(contenuCorrige65);

verifier(
  "le fichier corrigé livré pour rebuild/carburants-65-20260922 est conforme au contrat pré-auth",
  verdictCorrige65.conforme
);

verifier(
  "le fichier corrigé livré est byte pour byte identique au fichier canonique en service (aucune divergence inventée)",
  contenuCorrige65 === CANONIQUE
);

// ── 5. Le candidat AVANT correctif — le vérificateur doit voir le vrai défaut ─
//
// Lu depuis l'objet git réel du SHA cité par l'issue, pas retapé à la main :
// si ce SHA n'est pas résolvable dans cet environnement (dépôt partiel), le
// test le dit explicitement plutôt que de fabriquer un résultat.
const SHA_CANDIDAT_CITE = '20af9f6fbfa435465c05245528ba112880b7be4b';
let contenuCandidatOriginal = null;
try {
  contenuCandidatOriginal = execFileSync(
    'git', ['show', `${SHA_CANDIDAT_CITE}:NEXUS-Login-v1.html`],
    { cwd: RACINE, encoding: 'utf8' }
  );
} catch (e) {
  contenuCandidatOriginal = null;
}

if (contenuCandidatOriginal === null) {
  console.log('AVERTISSEMENT — SHA candidat non résolvable dans cet environnement : vérification §5 non exécutée (pas fabriquée).');
} else {
  const verdictCandidatOriginal = verifierContratLoginPreAuth(contenuCandidatOriginal);

  verifier(
    "le candidat AVANT correctif (SHA cité par l'issue) code en dur l'URL Supabase — c'est le défaut réel, pas une supposition",
    verdictCandidatOriginal.urlCodeeEnDur
  );

  verifier(
    "…et cette URL codée en dur désigne le projet PRODUCTION (uzhjpqpctpvxytxpxoqz), jamais Test",
    /uzhjpqpctpvxytxpxoqz/.test(contenuCandidatOriginal)
  );

  verifier(
    "le candidat AVANT correctif interroge employees_public par ilike (motif d'énumération déjà fermé le 04/09/2026)",
    verdictCandidatOriginal.interrogeEmployeesPublicEnAnonyme && verdictCandidatOriginal.utiliseOperateurJoker
  );

  verifier(
    "le candidat AVANT correctif porte deux messages de refus distincts (oracle d'énumération)",
    verdictCandidatOriginal.messagesRefusDistincts
  );

  verifier(
    "le vérificateur classe donc le candidat AVANT correctif comme NON conforme",
    !verdictCandidatOriginal.conforme
  );
}

// ── 6. Preuve négative — le vérificateur mord, il n'est pas vert par construction ─
//
// On réintroduit dans le fichier CORRIGÉ le motif vulnérable exact du
// candidat original, puis on vérifie que le même vérificateur (fonction
// pure, pas une seconde copie) le détecte. Sans cette mutation, un
// vérificateur qui renverrait toujours `true` passerait aussi les tests
// précédents.
const MUTATION_REINTRODUIT_ILIKE = CANONIQUE.replace(
  /\.rpc\(\s*["']nexus_identifiant_de_connexion["']\s*,\s*\{\s*p_prenom\s*:\s*prenom\s*\}\)/,
  '.from("employees_public").select("username").ilike("nom", prenom)'
);
assert.notStrictEqual(
  MUTATION_REINTRODUIT_ILIKE, CANONIQUE,
  'la mutation doit réellement modifier le texte, sinon elle ne prouve rien'
);
const verdictMutationIlike = verifierContratLoginPreAuth(MUTATION_REINTRODUIT_ILIKE);
verifier(
  "MUTATION — réintroduire l'appel employees_public/ilike est détecté comme non conforme",
  !verdictMutationIlike.conforme && verdictMutationIlike.interrogeEmployeesPublicEnAnonyme
);

const MUTATION_URL_EN_DUR = CANONIQUE.replace(
  /const SUPABASE_URL = window\.NEXUS_CONFIG\.supabaseUrl;/,
  'const SUPABASE_URL = "https://uzhjpqpctpvxytxpxoqz.supabase.co";'
);
assert.notStrictEqual(MUTATION_URL_EN_DUR, CANONIQUE, 'la mutation URL doit réellement modifier le texte');
const verdictMutationUrl = verifierContratLoginPreAuth(MUTATION_URL_EN_DUR);
verifier(
  "MUTATION — coder l'URL Supabase en dur est détecté comme non conforme",
  !verdictMutationUrl.conforme && verdictMutationUrl.urlCodeeEnDur
);

// Contre-témoin : le fichier canonique restauré (non muté) doit redevenir vert.
verifier(
  "contre-témoin — le fichier canonique non muté reste conforme après les deux mutations ci-dessus (aucun état partagé)",
  verifierContratLoginPreAuth(CANONIQUE).conforme
);

// ── 7. Bornage non-divulgation — ce que CE test prouve, et ce qu'il NE prouve PAS ─
//
// Ceci est une preuve STATIQUE de forme (le fichier ne demande jamais plus
// que le contrat), pas une preuve d'exécution contre une vraie base : aucune
// connexion réseau n'est ouverte ici. La preuve d'application réelle de l'ACL
// (SELECT effectivement révoqué à anon, RPC effectivement déployée sur le
// projet Test udljdqxerrbbbajxubfn) reste hors de portée de ce canal — elle
// est nommée comme limite, pas fabriquée.
verifier(
  "aucun appel pré-auth du fichier corrigé ne demande plus d'une valeur scalaire (pas de select('*'), pas de deuxième colonne)",
  !/\.select\(\s*["']\*["']\s*\)/.test(contenuCorrige65) &&
  !/\.select\(\s*["']username\s*,/.test(contenuCorrige65)
);

console.log(`\n${ok} vérification(s) passées.`);
