# Brancher Instagram et Facebook (une seule fois, ~20 min)

Après ça, chaque Short publié sur YouTube part aussi **en public** en Reel sur Instagram et sur la Page Facebook, automatiquement et gratuitement (API officielle de Meta).

## 1. Créer les comptes (c'est toi qui le fais)

1. **Instagram** : crée le compte « Le Flash » (essaie le pseudo `leflashfr` pour coller à YouTube). Photo de profil : `leflash-avatar.png`. Bio : « Toute l'actu GTA 6 en français, chaque jour 🔴 » + lien de la chaîne YouTube.
2. Dans Instagram : **Paramètres > Type de compte et outils > Passer à un compte professionnel > Créateur**, catégorie « Créateur de contenu numérique » (ou « Jeu vidéo »).
3. **Facebook** : depuis ton profil Facebook perso (Meta l'exige, il reste invisible pour le public), **Pages > Créer une Page** « Le Flash », catégorie « Site web de médias/actualités ». Même photo, bannière `leflash-banner.png`.
4. **Relier Instagram à la Page** : sur la Page, **Paramètres > Comptes liés > Instagram > Connecter**.

## 2. Créer l'appli Meta (gratuit)

1. Va sur <https://developers.facebook.com>, connecte-toi avec ton Facebook, **Mes applis > Créer une appli**.
2. Cas d'usage : **Autre**, puis type **Entreprise**. Nom : « Le Flash publication ».
3. Dans l'appli, ajoute les produits **Instagram** (« API Instagram avec connexion Facebook ») et **Connexion Facebook Entreprise**.
4. **Paramètres de l'appli > Général** : colle l'URL de confidentialité `https://derar92110.github.io/le-flash/confidentialite.html`, note **l'ID de l'appli** et **la clé secrète**.
5. En haut, bascule l'appli en mode **Live / En ligne** (sinon les Reels Facebook ne sont visibles que par toi).

## 3. Récupérer le jeton permanent

1. **Outils > Explorateur de l'API Graph** (<https://developers.facebook.com/tools/explorer>). Choisis ton appli, « Jeton d'utilisateur ».
2. Ajoute ces autorisations : `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`.
3. **Generate Access Token**, accepte, et **coche la Page Le Flash et le compte Instagram**. Copie le jeton.
4. Sur ton PC, dans le dossier Le Flash : `python obtenir_jeton_meta.py`. Il te demande l'ID, la clé secrète et le jeton, puis affiche 3 valeurs.

## 4. Les mettre dans GitHub

Dépôt **le-flash > Settings > Secrets and variables > Actions > New repository secret**, trois fois :

| Nom | Valeur |
|---|---|
| `META_PAGE_TOKEN` | le jeton de Page affiché |
| `META_PAGE_ID` | l'ID de la Page |
| `META_IG_USER_ID` | l'ID Instagram |

Ne colle jamais ces valeurs dans le chat. C'est fini : le prochain Flash part sur les 3 réseaux. Chaque envoi est noté dans `publies/NNN-instagram.txt` et `publies/NNN-facebook.txt`, donc jamais de doublon.

Si Instagram ou Facebook échoue, YouTube publie quand même et l'erreur apparaît dans le journal du workflow.
