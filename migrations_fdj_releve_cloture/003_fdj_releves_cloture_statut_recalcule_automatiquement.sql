-- Migration : fdj_releves_cloture_statut_recalcule_automatiquement (16/08/2026)
-- Sécurisation structurelle demandée par Frédéric, point 1 : "Ne plus
-- déduire `regularise` simplement de `version_num > 1`. Une version
-- `recalcul_automatique_chaine` n'est pas une régularisation manager."
--
-- Avant cette migration, NexusFdjMoteur.statutRelevecloture(versionNum, ecart)
-- posait `statut='regularise'` pour TOUTE version > 1, y compris un simple
-- recalcul système déclenché par le rétablissement de la chaîne — aucune
-- intervention manager n'a pourtant eu lieu dans ce cas. Le statut doit
-- refléter QUI/QUOI a produit la version, jamais seulement sa position dans
-- la séquence : voir nexus-fdj-moteur.js::statutRelevecloture(versionNum,
-- ecart, typeVersion), désormais informé par `type_version`.

alter table fdj_releves_cloture
  drop constraint if exists fdj_releves_cloture_statut_check;
alter table fdj_releves_cloture
  add constraint fdj_releves_cloture_statut_check
    check (statut in ('conforme', 'valide_avec_ecart', 'regularise', 'recalcule_automatiquement'));
