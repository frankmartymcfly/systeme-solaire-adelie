# 🚀 Le Système Solaire d'Adélie

Une petite appli web pour découvrir le système solaire, faite pour les enfants (en français ✨).

Clique sur le Soleil ou une planète pour lire une description et des faits amusants, active la **voix** pour te faire lire les textes à voix haute, ou passe en mode **Quiz** pour tester tes connaissances avec un quiz de 12 questions tirées au hasard.

## Fonctionnalités

- **Mode Explorer** — le Soleil et les 8 planètes, avec descriptions, faits amusants et statistiques. Les tailles des planètes sont proportionnelles entre elles.
- **Mode Quiz** — 12 questions aléatoires parmi plus de 50, avec score en étoiles et célébration à la fin. Ton meilleur score est mémorisé sur l'appareil.
- **Lecture à voix haute** (synthèse vocale française du navigateur).
- **Accessible** — navigation au clavier (Tab + Entrée/Espace), lecteurs d'écran, et respect de `prefers-reduced-motion`.
- **Fonctionne hors ligne** — installable sur l'écran d'accueil d'une tablette et utilisable sans wifi.

## Utilisation

Ouvre simplement `index.html` dans un navigateur, ou visite la version en ligne :

**https://frankmartymcfly.github.io/systeme-solaire-adelie/**

> Pour l'installation hors ligne et la synthèse vocale, il faut la version en ligne (ou tout serveur `https`/`localhost`) : les *service workers* ne fonctionnent pas depuis un fichier ouvert directement (`file://`).

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Toute l'appli — HTML, CSS et JavaScript dans un seul fichier. |
| `manifest.webmanifest` | Métadonnées d'installation (nom, couleurs, icône). |
| `sw.js` | Service worker : met l'appli en cache pour le hors ligne. |
| `icon.svg` | Icône de l'appli / favicon. |

## Développement

Aucune dépendance, aucune étape de build. Pour tester le hors ligne en local, sers le dossier sur `localhost`, par exemple :

```bash
python -m http.server 8000
# puis ouvre http://localhost:8000
```

Après une modification de `index.html` ou des assets, incrémente `CACHE_VERSION` dans `sw.js` pour que les appareils déjà installés reçoivent la mise à jour.
