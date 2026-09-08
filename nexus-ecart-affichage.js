// NEXUS — Affichage d'un écart de caisse (08/09/2026, lot DEBUG-001).
//
// CE QUE CE FICHIER EMPÊCHE. `NEXUS-Debug-v1.html` affichait :
//
//   couleur : (a.ecart_total || 0) === 0 ? vert : rouge
//   texte   : (a.ecart_total || 0) >= 0 ? '+' : '' , Math.round(a.ecart_total || 0), ' €'
//
// Un écart JAMAIS MESURÉ (null) devenait donc « +0 € » — et peint en VERT,
// c'est-à-dire dans la couleur de la conformité parfaite. Trois signaux
// mentaient ensemble : la couleur, le signe et la valeur. C'est le contraire
// exact du principe de la Bible : « une anomalie ne doit jamais être masquée
// par un affichage rassurant ». Ici l'absence de contrôle se présentait comme
// un contrôle réussi.
//
// Trouvé par le Guardian Bible le 07/09/2026 ; arbitré par `decision-1.md`
// (Q74) : « Une mesure absente ne peut jamais s'afficher comme +0 € vert ;
// état neutre distinct exigé. »
//
// LES DEUX SENS. Un écart de ZÉRO réellement mesuré reste « 0 € » en vert :
// c'est un contrôle réussi, et l'effacer priverait le manager d'une bonne
// nouvelle vérifiée. Seule l'ABSENCE devient neutre.

(function (global) {
  'use strict';

  const NON_MESURE = 'Non mesuré';
  const mesure = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./nexus-mesure.js')
    : global.NexusMesure;

  // Texte de l'écart : « +12 € », « -8 € », « 0 € », « ≈ 0 € », ou l'état
  // neutre.
  //
  // Le « ≈ » traite un défaut de l'original qu'on aurait pu recopier sans le
  // voir : un écart de 0,40 € s'affichait « +0 € » tout en étant peint en
  // ROUGE. Le texte niait ce que la couleur signalait. Arrondir à zéro un
  // écart qui n'est pas nul EFFACE un écart réel ; le colorer en vert
  // l'effacerait deux fois. On dit donc « ≈ 0 € », et la couleur reste celle
  // de l'anomalie.
  function libelleEcart(valeur) {
    const v = mesure.valeurMesuree(valeur);
    if (v === null) return NON_MESURE;
    const arrondi = Math.round(v);
    if (arrondi === 0) return v === 0 ? '0 €' : '≈ 0 €';
    return `${arrondi > 0 ? '+' : ''}${arrondi} €`;
  }

  // Classe de couleur, décidée sur la valeur RÉELLE et non sur l'arrondi :
  // 0,40 € est un écart, même s'il s'écrit court.
  //
  // `neutre` n'est ni le vert de la conformité ni le rouge de l'anomalie :
  // c'est l'absence, qui n'est ni l'une ni l'autre.
  function classeEcart(valeur) {
    const v = mesure.valeurMesuree(valeur);
    if (v === null) return 'neutre';
    return v === 0 ? 'conforme' : 'anomalie';
  }

  // Ligne secondaire « Piste … · Boutique … », qui souffrait du même défaut.
  function libelleDetail(ecartPiste, ecartBoutique) {
    return `Piste ${libelleEcart(ecartPiste)} · Boutique ${libelleEcart(ecartBoutique)}`;
  }

  const api = { libelleEcart, classeEcart, libelleDetail, NON_MESURE };
  global.NexusEcartAffichage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
