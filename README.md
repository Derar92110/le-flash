# Le Flash : chaîne YouTube sans visage sur GTA 6 (pipeline)

Source : vidéo de Yomi Denzel « GTA 6 est la plus grosse opportunité business de 2026 » (18 min, 10 nov. 2026).

## Ce que dit la vidéo (résumé)

Six façons de gagner de l'argent avec les jeux vidéo, de la plus simple à la plus rentable :

1. **Chaîne sans visage** (YouTube/TikTok) : l'IA donne 30 idées de vidéos inspirées de ce qui marche aux US, Claude écrit le script, ElevenLabs fait la voix, on pose des images du jeu par-dessus, montage (CapCut), et on poste **tous les jours, plusieurs fois par jour**. Revenus : pub, sponsors, affiliation, merch.
2. **Jeux Roblox** : copier une mécanique qui marche (ex. jeu de plantation), changer le thème, faire coder le jeu par l'IA dans Roblox Studio, vendre des bonus en Robux.
3. **Serveur roleplay GTA** : monter son propre serveur (métiers, règles), le faire coder par l'IA, s'associer à un streamer contre un pourcentage.
4. **Maps Fortnite** (UEFN) : Epic paie au temps de jeu ; reprendre un format populaire, changer le thème, s'associer à des créateurs.
5. **Jeux mobiles** : repérer dans la Meta Ads Library des jeux dont les pubs tournent, les refaire à sa façon avec l'IA, promo via TikTok.
6. **Streamer GTA en roleplay** (avec visage) : le plus gros potentiel. Plan : créer tous les comptes maintenant, jouer dès la sortie, **veille quotidienne** de ce qui marche (Claude peut faire la liste), stream 1 à 2 h/jour, découper en clips (Opus Clip), priorité aux formats courts, boucle d'amélioration quotidienne.

Les chiffres cités (20 000 €/mois, 2 M€, etc.) sont des exemples choisis par l'auteur, pas des résultats typiques.

**Ce qu'on automatise ici :** la méthode 1, plus la veille quotidienne et la boucle « idée → script → voix → vidéo → publication » de la méthode 6. C'est ce qui colle au budget (100–200 €) et au plan QG Néon.

## La chaîne de production

| Étape | Outil | Automatisé ? |
|---|---|---|
| Veille + idées du jour | Claude (recherche web) | Oui |
| Script 25–45 s | Claude | Oui |
| Voix off FR | ElevenLabs (voix « Hugo – Punchy French Creator ») | Oui |
| Images de jeu | **Tes propres captures** console (bouton Share/Capture) | Non : à toi, dès le 19 nov. |
| Montage vertical + sous-titres | `make_short.py` (ffmpeg) | Oui |
| Publication YouTube | `upload_youtube.py` (API officielle) | Oui après 10 min de config |
| Publication TikTok / Insta | Planificateur natif ou Metricool | Semi |

**Important images :** n'utilise pas les trailers de Rockstar en boucle (Content ID, démonétisation). Tes propres captures de gameplay sont la voie sûre. Avant le 19 nov., le fond néon animé du script suffit pour des Shorts « infos ».

## Utilisation

```
python3 make_short.py scripts/001.json voix/001.mp3 clips/ sorties/001.mp4
python upload_youtube.py sorties/001.mp4 scripts/001.json
```

- `scripts/NNN.json` : titre, hook (texte jaune 3 premières secondes), texte (lu par la voix), description, tags.
- `clips/` : mets-y tes captures .mp4 ; le script en pioche des extraits de 2,5 s.

## 30 idées de Shorts (à valider par la veille)

Avant la sortie
1. 3 choses à faire avant le 19 novembre (fait : `scripts/001.json`)
2. PS5 ou Xbox : où jouer à GTA 6 ?
3. Pourquoi GTA 6 n'est pas sur PC au lancement
4. Lucia et Jason : ce qu'on sait des deux héros
5. Leonida expliquée en 30 secondes
6. Vice City avant / après : ce qui a changé
7. Les détails des trailers que personne n'a vus
8. Quelle édition acheter (sans te faire avoir)
9. À quelle heure le jeu se débloque en France
10. GTA 6 en 10 chiffres

Semaine de sortie (avec tes captures)
11. La première mission sans spoiler : mes 3 conseils
12. Gagner tes premiers 100 000 $ vite
13. La meilleure voiture gratuite du début
14. 5 endroits secrets de la carte
15. Les réglages à changer tout de suite (caméra, sous-titres, HDR)
16. Le meilleur appartement du début
17. Où trouver les armes au début
18. Les PNJ les plus drôles de Vice City
19. Comment semer la police facilement
20. Ce que GTA 6 fait mieux que GTA 5

Formats récurrents
21. « Le secret du jour » (série quotidienne)
22. Recréer une situation de la vie réelle dans GTA
23. Ta ville en vrai vs dans le jeu (Miami)
24. Classement des véhicules par catégorie
25. Les easter eggs références aux anciens GTA
26. Test : peut-on finir une mission sans tirer ?
27. Les meilleures radios du jeu
28. Bugs les plus drôles de la semaine
29. Le météo / cycle jour-nuit qui change tout
30. Question du jour en commentaire (engagement)

## Charte « Le Flash » (validée le 14 nov.)

`marque/charte.json` : fond bleu nuit #070b1a, mot clé et ombres bleu électrique #1f6bff, bandeau rouge #ff2d3d (accroche, compteur), texte blanc, polices Anton (sous-titres) et Bebas Neue (bandeaux), logo Le Flash en haut à droite.
Dans un script :
- un mot clé *entre étoiles* s'affiche en bleu (les étoiles ne sont pas lues par la voix) ;
- `"etiquette": "OFFICIEL" | "RUMEUR" | "LEAK"` affiche l'étiquette de source ;
- format phare « Le Flash du jour » : au lieu de `texte`, une liste `segments` de 3 infos `{texte, etiquette}` ; le montage affiche 1/3, 2/3, 3/3 et l'étiquette de chaque info. Exemple : `scripts/exemple-flash-du-jour.json.txt`.
Lancement sur PC : `installer.bat` une fois, puis `produire.bat` (voix + montage + envoi YouTube si `AUTO_UPLOAD=1`).
