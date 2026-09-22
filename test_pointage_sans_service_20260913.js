/*
 * Un pointage sans service n'est ni offert, ni mis en attente, ni promis.
 * ============================================================================
 * LE DÉFAUT, relevé par Frédéric le 13/09/2026 sur Employé Test B : « la
 * sauvegarde hors ligne fonctionne, mais la synchronisation ne s'effectue pas ».
 *
 * Mesuré en base, sonde annulée, témoin négatif dans la même transaction :
 *     sans service : REFUSÉE [23502] service_id est obligatoire
 *     avec service : ACCEPTÉE
 *
 * Ce n'était pas le réseau. Depuis le 11/09 la base exige `service_id` ; B
 * n'avait aucun service. L'écran offrait quand même le pointage, prenait la
 * photo, rangeait la tentative en file et promettait « rien ne sera perdu ».
 * La file rejouait à chaque ouverture, refusée à chaque fois, en silence.
 *
 * Trois règles sont éprouvées ici :
 *   1. sans service ouvert, l'écran ne propose pas de pointer ;
 *   2. un refus du serveur n'est jamais présenté comme une coupure réseau ;
 *   3. une tentative refusée sort de la file et est dite à l'employée.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SOURCE = fs.readFileSync(path.join(__dirname, 'NEXUS-Pointage-v1.html'), 'utf8');
let reussites = 0, echecs = 0;
function verifier(nom, condition, detail) {
  if (condition) { reussites++; console.log(`  ✓ ${nom}`); }
  else { echecs++; console.log(`  ✗ ${nom}${detail ? '\n      ' + detail : ''}`); }
}

// ── La fonction de classement, extraite telle quelle de l'écran ───────────
const extrait = SOURCE.match(/function erreurDefinitive\(erreur\) \{[\s\S]*?\n  \}/);
if (!extrait) { console.error('  ✗ erreurDefinitive introuvable dans la source'); process.exit(1); }
const navigateur = { onLine: true };
const erreurDefinitive = new Function('navigator', `${extrait[0]}; return erreurDefinitive;`)(navigateur);

console.log('\n── 1 · Un refus du serveur se distingue d’une coupure ──');
verifier('violation de contrainte (service_id manquant) : définitive',
  erreurDefinitive({ code: '23502', message: 'service_id est obligatoire' }));
verifier('refus RLS : définitif', erreurDefinitive({ code: '42501' }));
verifier('erreur PostgREST : définitive', erreurDefinitive({ code: 'PGRST204' }));
verifier('échec de transport sans code : temporaire',
  !erreurDefinitive({ message: 'Failed to fetch' }));
verifier('connexion réinitialisée : temporaire', !erreurDefinitive({ code: 'ECONNRESET' }));
verifier('délai dépassé : temporaire', !erreurDefinitive({ code: 'ETIMEDOUT' }));
verifier('aucune erreur : rien de définitif', !erreurDefinitive(null));

console.log('\n── 2 · Hors ligne, aucun refus n’est jamais définitif ──');
navigateur.onLine = false;
verifier('même une violation de contrainte attend le retour du réseau',
  !erreurDefinitive({ code: '23502' }),
  'hors ligne, la réponse ne peut pas venir du serveur : on ne conclut pas');
navigateur.onLine = true;

console.log('\n── 3 · L’écran refuse de pointer sans service ──');
verifier('la garde teste le service AVANT de rendre les boutons',
  /if \(!serviceDuJourSeulement\(shiftActif, today, jourDeService\)\) \{/.test(SOURCE));
// Ce qui compte n'est pas d'être avant la LECTURE — la garde a besoin des
// pointages du jour pour distinguer une journée finie d'une journée absente —
// mais d'être avant toute CAMÉRA et toute écriture. Une lecture n'écrit rien.
verifier('elle est posée avant le rendu des boutons de pointage',
  SOURCE.indexOf('if (!serviceDuJourSeulement(shiftActif, today, jourDeService))')
    < SOURCE.indexOf('<div class="pointage-list">'));
verifier('elle est posée avant tout câblage de la caméra',
  SOURCE.indexOf('if (!serviceDuJourSeulement(shiftActif, today, jourDeService))')
    < SOURCE.indexOf('data-photo-btn'));
verifier('le message exact est affiché',
  SOURCE.includes("Aucun poste n'est ouvert. Prenez d'abord votre poste pour pouvoir pointer."));
verifier('un accès à la prise de poste est proposé',
  /btnAllerPriseDePoste[\s\S]{0,400}NEXUS-Prise-De-Poste-v1\.html/.test(SOURCE));
verifier('la garde se termine par un return, elle ne retombe pas dans le rendu',
  /\n      return;\n    \}\n/.test(SOURCE.slice(SOURCE.indexOf('if (!serviceDuJourSeulement(shiftActif, today, jourDeService))'),
                                          SOURCE.indexOf('<div class="pointage-list">'))));

console.log('\n── 4 · Un refus ne part plus en file, et ne promet rien ──');
verifier('la branche définitive précède la branche réseau',
  SOURCE.indexOf('if (error && erreurDefinitive(error))') > -1
  && SOURCE.indexOf('if (error && erreurDefinitive(error))')
     < SOURCE.indexOf("console.error('Enregistrement pointage, tentative conservée:', error)"));
verifier('la tentative est retirée de la file',
  /erreurDefinitive\(error\)\)[\s\S]{0,900}?fileRetirer\(tentative\.id\)/.test(SOURCE));
verifier('le message dit que ce n’est PAS le réseau',
  SOURCE.includes("NEXUS a refusé ce pointage, et ce n'est pas un problème de réseau."));
verifier('il dit aussi que rien n’est resté en attente',
  SOURCE.includes("Rien n'est resté en attente sur ce téléphone."));
verifier('« rien ne sera perdu » reste réservé au cas réseau',
  (SOURCE.match(/Rien ne sera perdu/g) || []).length === 1);
const blocDefinitif = SOURCE.match(/if \(error && erreurDefinitive\(error\)\) \{[\s\S]*?\n    \}/);
verifier('la branche définitive ne promet aucun renvoi automatique',
  !!blocDefinitif && !/renverra tout seul|envoi en attente/.test(blocDefinitif[0]));

console.log('\n── 5 · La file ne rejoue plus l’irrejouable ──');
verifier('une entrée refusée est retirée de la file',
  /erreurDefinitive\(error\)\) \{[\s\S]{0,400}?fileRetirer\(entree\.id\)/.test(SOURCE));
verifier('elle est comptée pour être rapportée', /rejetees\.push\(/.test(SOURCE));
verifier('une entrée sans réponse reste, elle',
  /console\.error\('Reprise de la file, entrée conservée:', error\);\s*\n\s*continue;/.test(SOURCE));
verifier('le bilan porte les rejets', /return \{ envoyees, restantes: fileLire\(\)\.length, rejetees \};/.test(SOURCE));

console.log('\n── 6 · L’employée est prévenue, pas seulement la console ──');
verifier('les rejets sont rendus à l’écran', /noteRejets/.test(SOURCE));
verifier('la note dit que ce n’est pas le réseau',
  /noteRejets[\s\S]{0,900}ce n'est pas un problème de réseau/.test(SOURCE));
verifier('elle oriente vers le manager',
  /noteRejets[\s\S]{0,1200}Prévenez votre manager/.test(SOURCE));
verifier('elle apparaît aussi quand aucun poste n’est ouvert',
  /\$\{noteRejets\}[\s\S]{0,600}Aucun poste n'est ouvert/.test(SOURCE));

console.log('\n── 7 · Sortir de la garde ne laisse pas le compteur tourner ──');
// Le compteur de l'en-tête vit hors de #app : seul le rendu complet le remet
// à jour. La garde sortait avant, et « Service en cours depuis X » continuait
// de courir après un départ. Relevé par Frédéric le 13/09/2026.
const garde = SOURCE.match(/if \(!serviceDuJourSeulement\(shiftActif, today, jourDeService\)\) \{[\s\S]*?\n    \}/);
verifier('la garde existe et forme un bloc', !!garde);
verifier('elle remet etatCompteur à null', /etatCompteur = null;/.test(garde[0]));
verifier('elle remet referenceCompteur à null', /referenceCompteur = null;/.test(garde[0]));
verifier('elle rafraîchit l’en-tête immédiatement', /majServiceLive\(\);/.test(garde[0]));
verifier('la remise à zéro précède tout rendu',
  garde[0].indexOf('etatCompteur = null') < garde[0].indexOf("getElementById('app').innerHTML"));

console.log('\n── 8 · Une journée finie n’est pas une journée absente ──');
verifier('la garde distingue les deux cas', /const journeeTerminee = \(pointagesJour \|\| \[\]\)\.length > 0;/.test(garde[0]));
const brancheFinie = garde[0].match(/if \(journeeTerminee\) \{[\s\S]*?\n        return;\n      \}/);
verifier('la branche « journée finie » forme un bloc distinct', !!brancheFinie);
// Le contrôle porte sur ce qui est RENDU, pas sur le code : le commentaire
// qui explique pourquoi on n'affiche pas « Prenez d'abord votre poste »
// contient forcément cette phrase.
const rendusFinie = (brancheFinie ? brancheFinie[0] : '').replace(/^\s*\/\/.*$/gm, '');
verifier('journée finie : aucune invitation à reprendre un poste',
  !!brancheFinie && !/Prenez d'abord votre poste|btnAllerPriseDePoste/.test(rendusFinie));
verifier('journée finie : l’historique du jour reste affiché',
  /journeeTerminee[\s\S]{0,1400}?renderTimeline\(pointagesJour/.test(garde[0]));
verifier('journée finie : le message dit que la journée est enregistrée',
  /Votre journée est enregistrée\./.test(garde[0]));
verifier('journée absente : le bouton de prise de poste est là',
  /btnAllerPriseDePoste/.test(garde[0]));
verifier('les pointages du jour sont lus AVANT la garde',
  SOURCE.indexOf("nexusClient.from('pointages').select('id, type, heure, retard_min")
    < SOURCE.indexOf('if (!serviceDuJourSeulement(shiftActif, today, jourDeService))'));

console.log(`\n${echecs === 0 ? '✓' : '✗'} ${reussites} réussite(s), ${echecs} échec(s)\n`);
// Sortie d'échec explicite, pas un ternaire : Guardian QA lit le code sans
// l'exécuter, et il a raison d'exiger qu'un échec soit lisible tel quel.
if (echecs > 0) process.exit(1);
