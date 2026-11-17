#!/usr/bin/env python3
"""Une seule fois : transforme le jeton temporaire de l'Explorateur Graph API
en jeton de Page PERMANENT, et affiche les 3 valeurs à coller dans les secrets GitHub.

Lance :  python obtenir_jeton_meta.py
Il te demande : l'ID de l'appli, la clé secrète de l'appli, le jeton de l'Explorateur.
Rien n'est enregistré sur le disque.
"""
import getpass, json, urllib.parse, urllib.request

GRAPH = "https://graph.facebook.com/v23.0"


def get(chemin, **params):
    url = f"{GRAPH}/{chemin}?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read())


app_id = input("ID de l'appli Meta : ").strip()
secret = getpass.getpass("Clé secrète de l'appli (invisible) : ").strip()
court = getpass.getpass("Jeton de l'Explorateur Graph API (invisible) : ").strip()

long = get("oauth/access_token", grant_type="fb_exchange_token", client_id=app_id,
           client_secret=secret, fb_exchange_token=court)["access_token"]
pages = get("me/accounts", fields="id,name,access_token,instagram_business_account",
            access_token=long)["data"]
if not pages:
    raise SystemExit("Aucune Page trouvée : coche bien ta Page « Le Flash » quand Facebook te le demande.")
for p in pages:
    ig = (p.get("instagram_business_account") or {}).get("id", "(aucun Instagram relié)")
    print(f"\n=== Page : {p['name']} ===")
    print("META_PAGE_ID     =", p["id"])
    print("META_IG_USER_ID  =", ig)
    print("META_PAGE_TOKEN  =", p["access_token"])
print("\nColle ces 3 valeurs dans GitHub > le-flash > Settings > Secrets and variables > Actions.")
print("Ne les partage avec personne (ni dans le chat).")
