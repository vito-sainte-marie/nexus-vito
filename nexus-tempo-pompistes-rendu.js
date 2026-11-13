// Rendu de la carte « Comment se situent les pompistes ? » (fonction pure : résultat du moteur -> HTML).
// Règle de Frédéric (13/11/2026) : le classement est visible des managers et des gérants ; l'accès à la page
// est déjà refusé aux autres comptes par la page elle-même.
// Aucun mot d'affichage ici : tout vient de NexusVocab.pompistes.
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function ligneClassee(p, V) {
    const lect = p.net ? V.lecture.net : V.lecture.habituelle;
    const sens = p.net && p.sens ? ' · ' + V.sens[p.sens] : '';
    const egal = (p.egalPrecedent || p.egalSuivant) ? '<br><span class="exc">' + esc(V.classement.egalite) + '</span>' : '';
    return '<tr><td>' + p.rang + '</td><td>' + esc(p.nom) + '</td><td>' + esc(V.effectif(p.n)) + '</td><td class="ec">' +
      esc(V.litres(p.ecartMoyen)) + '</td><td>' + esc(lect + sens) + egal + '</td></tr>';
  }

  function tableauClasse(liste, V) {
    const E = V.classement.entetes;
    let t = liste.chaineEgalite ? '<p class="mention" data-chaine="egalite">' + esc(V.classement.chaine) + '</p>' : '';
    t += '<table class="tableau" data-classement="pompistes"><thead><tr>' +
      ['rang', 'pompiste', 'quarts', 'ecart', 'lecture'].map(k => '<th>' + esc(E[k]) + '</th>').join('') + '</tr></thead><tbody>';
    liste.classes.forEach(p => { t += ligneClassee(p, V); });
    return t + '</tbody></table>';
  }

  function nonClasses(liste, V) {
    if (!liste.nonClasses.length) return '';
    let h = '<div class="sous-titre">' + esc(V.classement.nonClassesTitre) + '</div><ul class="preuves-liste">';
    liste.nonClasses.forEach(p => { h += '<li>' + esc(p.nom) + ' : ' + esc(V.classement.nonClasse(p.n)) + '</li>'; });
    return h + '</ul>';
  }

  // res : résultat de NexusTempo.pompistesParQuart ; opts : { V }
  function rendre(res, opts) {
    const V = opts.V;
    let h = '';
    if (!res || !res.nbQuartsAttribuables) {
      h += '<p class="mention">' + esc(V.aucuneDonnee) + '</p>';
    } else {
      const H = V.horsNorme;
      h += '<div class="sous-titre">' + esc(V.classement.titre) + '</div>' + tableauClasse(res.sans, V) + nonClasses(res.sans, V);
      h += '<p class="mention"><strong>' + esc(H.titre) + '</strong><br>' + esc(res.aDesExceptionnels ? H.nombre(res.exceptionnels.length) : H.aucune);
      if (res.aDesExceptionnels) h += '<br>' + esc(res.changeAvecSans ? H.change : H.memeLecture);
      h += '</p>';
      if (res.aDesExceptionnels && res.changeAvecSans) {
        h += '<details class="valeurs"><summary>' + esc(H.avec) + '</summary>' + tableauClasse(res.avec, V) + nonClasses(res.avec, V) + '</details>';
      }
    }
    h += '<p class="mention">' + esc(V.fenetre(res.semaines, res.fenetre.debut, res.fenetre.fin, res.fenetre.borneParLesDonnees)) + '</p>';
    h += '<p class="mention" data-ecartes="pompistes">' + esc(V.exclus(res.exclus)) + '</p>';
    h += '<button type="button" class="indispo" disabled aria-disabled="true" title="' + esc(V.transmettreInactif) + '">' + esc(V.transmettre) + '</button>';
    return h;
  }

  const api = { rendre };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NexusTempoPompistesRendu = api;
})(typeof window !== 'undefined' ? window : globalThis);
