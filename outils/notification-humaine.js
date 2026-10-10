#!/usr/bin/env node
'use strict';
// NEXUS — notification humaine vérifiable (préparation Fast Track, 10/10/2026).
//
// Le GO de préparation exige un mécanisme « réellement délivré et
// vérifiable, sans confondre commentaire GitHub et réception ». Ce module
// pose donc trois états distincts plutôt qu'un booléen « notifié » :
//
//   PUBLIE   — un commentaire/commit a été déposé sur le canal GitHub.
//              Toujours atteignable depuis ce dépôt ; ne prouve RIEN sur la
//              réception par Frédéric.
//   LIVRE    — un accusé de transport existe (ex. l'API GitHub confirme la
//              création du commentaire). Prouve que GitHub a reçu l'écriture,
//              pas que Frédéric l'a vue.
//   CONFIRME — une réaction humaine explicite et postérieure a été retrouvée
//              (réponse, mention du jeton-témoin du STOP). C'est le seul état
//              qui équivaut à une réception réelle.
//
// Par construction, ce module ne peut PRODUIRE que PUBLIE/LIVRE lui-même : il
// n'a accès à aucun canal poussé (SMS, e-mail, notification mobile) depuis cet
// environnement. Toute confirmation de réception doit être vérifiée après
// coup, jamais supposée au moment de l'envoi — fail closed : par défaut,
// `receptionConfirmee` est `false`.
//
// Ce que ce module ne fait PAS : il ne choisit pas le canal réel de
// notification humaine (push mobile, SMS, autre). Ce choix reste une question
// pour Frédéric (capacité manquante explicitement déclarée, jamais fabriquée
// — voir `rapportCapacite`).

const CHAMPS_CONTRAT = ['LOT', 'MOTIF', 'HORODATE', 'JETON_TEMOIN'];

const ETATS = Object.freeze({
  PUBLIE: 'PUBLIE',
  LIVRE: 'LIVRE',
  CONFIRME: 'CONFIRME',
});

// Construit le corps d'une notification STOP humain. Ne poste rien : c'est à
// l'appelant (le relais GitHub existant) d'écrire ce corps sur le canal
// autorisé. Un contrat explicite, pas une prose libre, pour que la recherche
// de confirmation (ci-dessous) ait quelque chose de précis à chercher.
function construireNotificationStop({ lot, motif, horodate, jetonTemoin }) {
  if (!lot || !motif || !horodate || !jetonTemoin) {
    throw new Error('construireNotificationStop exige lot, motif, horodate et jetonTemoin.');
  }
  const lignes = [
    'STOP_HUMAIN_REQUIS',
    `LOT: ${lot}`,
    `MOTIF: ${motif}`,
    `HORODATE: ${horodate}`,
    `JETON_TEMOIN: ${jetonTemoin}`,
  ];
  return { etat: ETATS.PUBLIE, corps: lignes.join('\n'), champs: { lot, motif, horodate, jetonTemoin } };
}

// Vérifie, à partir d'une liste de commentaires déjà récupérés par l'appelant
// (jamais un appel réseau fait ici — ce module reste pur et testable), si une
// réponse humaine postérieure à `depuisISO` constitue une confirmation de
// réception : elle doit venir du compte désigné et citer le jeton-témoin de
// CETTE notification précise. Citer seulement le lot ne suffit pas : un
// commentaire antérieur sans rapport pourrait sinon être confondu avec un
// accusé de réception.
function verifierConfirmation({ commentaires, compteAttendu, jetonTemoin, depuisISO }) {
  if (!Array.isArray(commentaires)) throw new Error('commentaires doit être un tableau.');
  if (!compteAttendu || !jetonTemoin) throw new Error('compteAttendu et jetonTemoin sont requis.');
  const depuis = depuisISO ? new Date(depuisISO).getTime() : -Infinity;
  const trouve = commentaires.find(c =>
    c && c.auteur === compteAttendu &&
    new Date(c.horodate).getTime() >= depuis &&
    typeof c.corps === 'string' && c.corps.includes(jetonTemoin)
  );
  if (!trouve) return { etat: ETATS.PUBLIE, receptionConfirmee: false, preuve: null };
  return { etat: ETATS.CONFIRME, receptionConfirmee: true, preuve: { auteur: trouve.auteur, horodate: trouve.horodate } };
}

// Déclare explicitement ce que ce canal ne peut pas prouver, au lieu de le
// passer sous silence. Classe de preuve au sens de docs/handoff/PROTOCOL.md :
// jamais VERIFIED pour la réception elle-même.
function rapportCapacite() {
  return {
    publication: 'VERIFIED — ce dépôt peut toujours publier PUBLIE sur le canal GitHub existant (commentaire d\'issue).',
    livraison: 'DECLARED — un accusé de création de commentaire par l\'API GitHub est disponible, mais non branché par ce module.',
    reception: 'HUMAN — aucune preuve de lecture par Frédéric n\'est obtenable depuis cet environnement ; seule une réponse explicite ultérieure (verifierConfirmation) compte comme CONFIRME.',
    capacite_manquante: 'Un canal poussé (SMS, e-mail, notification mobile) n\'existe pas encore pour NEXUS ; son choix est une décision de Frédéric, non prise ici.',
  };
}

module.exports = {
  ETATS,
  CHAMPS_CONTRAT,
  construireNotificationStop,
  verifierConfirmation,
  rapportCapacite,
};
