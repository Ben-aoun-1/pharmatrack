# PharmTrack — Agent Windows

Agent de suivi des ventes pour PharmTrack. Il s'exécute discrètement en arrière-plan
sur chaque poste de caisse, détecte les ventes (scan du code-barres puis **F10**)
et les transmet au tableau de bord PharmTrack.

## Prérequis

- Windows 10 ou 11

## Installation

1. Double-cliquez sur **PharmTrack.exe**.

## Première utilisation

1. À la première ouverture, une fenêtre **« PharmTrack — Activation »** apparaît.
2. Saisissez la **clé de licence** fournie par PharmTrack.
3. Cliquez sur **Activer**.

Une fois l'activation réussie, l'application démarre automatiquement et fonctionne
en arrière-plan. Une icône verte apparaît dans la barre des tâches
(**« PharmTrack actif »**).

## Démarrage automatique

L'application se lance automatiquement à chaque démarrage de Windows (enregistrée
dans le registre Windows, clé `HKEY_CURRENT_USER\...\Run`). Aucune action n'est
requise.

## Pour quitter

Faites un **clic droit** sur l'icône PharmTrack dans la barre des tâches, puis
choisissez **« Quitter PharmTrack »**.

## Support

Pour toute assistance : `support@pharmtrack.example` *(à remplacer par l'adresse réelle)*.
