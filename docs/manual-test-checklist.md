# Checklist de test manuel

À exécuter sur **Android (Chrome)** et **iPhone (Safari, application installée)**, sur le déploiement <https://jirr.github.io/scratch-world/> (HTTPS requis pour la géolocalisation et l'installation).

Cocher chaque ligne et noter le résultat (appareil, version affichée dans Réglages › À propos, observation).

| Appareil | Navigateur / OS | Version de l'app (`vX.Y.Z (sha)`) | Date | Testeur |
| -------- | --------------- | --------------------------------- | ---- | ------- |
|          |                 |                                   |      |         |

## 1. Installation

- [ ] Android : menu Chrome › « Installer l'application » ; l'icône apparaît, l'app s'ouvre en plein écran (sans barre d'adresse).
- [ ] iPhone : Partager › « Sur l'écran d'accueil » ; l'icône apparaît, l'app s'ouvre en plein écran.
- [ ] L'icône est correcte (pas de coins blancs sur Android : icône « maskable »).

## 2. Carte et géolocalisation

- [ ] La carte s'affiche, nord en haut ; deux doigts ne la font **pas** pivoter ni s'incliner.
- [ ] « Me localiser » → autorisation demandée, la carte vole vers la position, le marqueur apparaît.
- [ ] Refuser la position (puis « Me localiser ») → le message explicatif s'affiche, avec la marche à suivre pour réautoriser.
- [ ] Réautoriser depuis les réglages du système, puis « Me localiser » → fonctionne.

## 3. Enregistrement en direct

- [ ] « Enregistrer » → feuille de démarrage ; l'interrupteur « Garder l'écran allumé » est présent (si le navigateur le permet).
- [ ] Marche de 10 min : la pastille « Enregistrement · hh:mm:ss · +N cellules » progresse, le brouillard se dégage au fil du trajet.
- [ ] L'écran reste allumé si l'option est activée.
- [ ] « Arrêter » → la pastille disparaît ; les zones restent dévoilées après rechargement.
- [ ] Passer l'app en arrière-plan puis revenir : l'enregistrement a bien été interrompu/repris sans crash (limite connue de la PWA : pas de suivi en arrière-plan ; applications natives : section 11).

## 4. Import (chaque format, avec **vos propres** fichiers — ne jamais les commiter)

- [ ] GPX
- [ ] KML
- [ ] Google Timeline Android (`Timeline.json`)
- [ ] Google Timeline iPhone
- [ ] `Records.json` (si disponible)
- [ ] Le sélecteur de fichiers de l'iPhone permet bien de choisir un `.gpx`/`.kml` (pas grisé).
- [ ] Barre de progression visible, carte toujours manipulable pendant l'import, bouton Annuler fonctionnel.
- [ ] Réimport du même fichier → « Déjà importé ».
- [ ] Fichier non reconnu → « Format non reconnu ».

## 5. Statistiques

- [ ] Surface, nombre de cellules, % du monde émergé et liste des pays cohérents avec les trajets importés.
- [ ] Une trace en mer n'ajoute rien au pourcentage.

## 6. Sauvegarde et restauration

- [ ] « Sauvegarder » télécharge `scratch-world-AAAA-MM-JJ.json.gz`.
- [ ] « Tout effacer » : le focus est sur « Annuler » ; après confirmation, la carte est entièrement voilée et les stats vides.
- [ ] « Restaurer une sauvegarde » : le même brouillard réapparaît, mêmes statistiques.
- [ ] **Changement d'appareil** : sauvegarde faite sur un appareil, restaurée sur l'autre → même brouillard.

## 7. Hors ligne

- [ ] Parcourir une zone en ligne, passer en **mode avion**, relancer l'app : le shell, la barre du bas et les zones déjà vues s'affichent.
- [ ] Les cellules dévoilées sont toujours visibles hors ligne.

## 8. Mise à jour de l'application

- [ ] Après un nouveau déploiement (bump `0.1.x`), rouvrir l'app installée : le toast « Nouvelle version disponible » apparaît en ≤ ~10 min (cache GitHub Pages) après retour au premier plan.
- [ ] « Mettre à jour » recharge l'application sur la nouvelle version (vérifier `vX.Y.Z`).
- [ ] Pendant un **enregistrement**, le toast reste caché jusqu'à l'arrêt.
- [ ] Pendant un **import**, le toast reste caché jusqu'à la fin.

## 9. Réglages

- [ ] Thème clair/sombre/automatique appliqué à toute l'interface et au brouillard.
- [ ] Style de carte alternatif appliqué ; une URL de style invalide est signalée.
- [ ] Langue : un appareil en anglais affiche l'app en anglais, en français en français ; « Langue » dans les réglages change toute l'interface sans recharger et reste mémorisée ; « Langue du système » revient à celle de l'appareil.
- [ ] « Stockage persistant » affiché ; « Rechercher une mise à jour » répond.

## 10. Performance (bench 500 000 cellules)

- [ ] Générer une sauvegarde synthétique (`pnpm gen:cells`), la restaurer sur le téléphone, ouvrir `…/?debug=1`.
- [ ] Noter les FPS médians en panoramique et en zoom : **≥ 55 fps** attendus (Android milieu de gamme et iPhone).
- [ ] Aucun hexagone crénelé à zoom 18 ; pas de flash au changement de résolution.

| Appareil | FPS médian (pan) | FPS médian (zoom) | Observations |
| -------- | ---------------- | ----------------- | ------------ |
|          |                  |                   |              |

## 11. Applications natives (Android, iOS)

Build et installation : README, « Applications natives ».

- [ ] Android : après la page d'accueil, la position est demandée (choisir « Précise »), puis les notifications (Android 13+).
- [ ] Android : pendant l'enregistrement, la notification « Scratch World gratte la carte » est affichée ; « Pause » la retire.
- [ ] iPhone : sur un iPhone en français, les demandes d'autorisation sont en français ; l'indicateur de position bleu s'affiche quand l'app enregistre en arrière-plan.
- [ ] **Écran verrouillé** : enregistrement en cours, verrouiller le téléphone, se déplacer 10 min, déverrouiller : tout le trajet est dévoilé (pas une ligne droite entre départ et arrivée).
- [ ] **Arrière-plan** : même trajet en passant à une autre application : même résultat.
- [ ] Refuser la position : la fenêtre « Position refusée » propose « Ouvrir les réglages », qui ouvre les réglages de l'application.
- [ ] Ni fenêtre d'installation, ni bouton « Rechercher une mise à jour ».
