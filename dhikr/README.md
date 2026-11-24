# Dhikr du jour (@dhikrdujour)

Depuis le 24/11/2026, la chaîne YouTube ex-« Le Flash » (ID UCfq8svwPGsQVU2it5c9GPiQ) publie **un Short de dhikr par jour**, au format « compte avec moi ». Le flux GTA 6 est arrêté (`production.yml` n'a plus de déclenchement automatique).

## Le format
- Intro 3 s : « AVANT DE SCROLLER », le nom de l'invocation, le nombre de répétitions, l'appel.
- Corps : chapelet doré qui avance d'une perle par répétition, compteur « 12 / 100 », l'arabe (police Amiri), la phonétique en capitales, la traduction française, la source toujours affichée en haut, une barre de progression (un tronçon par étape) et « DIS-LE AVEC NOUS ».
- Fin 5,5 s : « QU'ALLAH L'ACCEPTE », la récompense citée par le hadith, la source, « Enregistre la vidéo pour après ta prière, et partage-la à un proche ».
- Son : aucune voix, aucune musique, seulement un petit clic de perle par compte et un tintement doux à la fin.
- Charte : fond noir chaud #050403, or #e7c77a, crème #efe6d2. Polices Amiri (arabe), Cormorant Garamond (titres), Plus Jakarta Sans (texte). Aucun visage, aucune personne, aucune représentation des prophètes.

## Les règles religieuses
- Uniquement le Coran et des hadiths authentiques (Bukhârî, Muslim, ou authentifiés par al-Albânî), avec la référence exacte.
- Le nombre de répétitions suit le hadith quand il en donne un (100, 70, 10, 33+33+33+1). Sinon la vidéo propose 33 sans promettre de récompense liée au nombre.
- La récompense affichée reprend fidèlement le hadith, sans rien ajouter.
- Toute nouvelle invocation est ajoutée dans `invocations.json` avec arabe vocalisé, source et texte du hadith, et relue avant publication.

## Fichiers
- `invocations.json` : les 15 invocations (rotation dans l'ordre, une par jour).
- `charte.json` : nom, hashtags (#dhikr #islam #Shorts), catégorie YouTube (22), pied de description.
- `publies.txt` : une ligne par Short publié (date, id de l'invocation, id YouTube). Le nombre de lignes donne la prochaine invocation.
- `../dhikr.py` : rendu Remotion (composition « Dhikr », `motion/src/Dhikr.tsx`) puis envoi YouTube.
- `../.github/workflows/dhikr.yml` : tous les jours à 16h40 UTC (17h40 à Paris en hiver). Bouton « Run workflow » : choisir une invocation, et décocher « publier » pour un simple aperçu téléchargeable.

Test local sans envoi : `DHIKR_ID=alhamdulillah python dhikr.py` (ajouter `REMOTION_FRAMES=0-150` pour un rendu court).
