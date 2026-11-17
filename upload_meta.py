#!/usr/bin/env python3
"""Publie un Short en Reel sur Instagram et sur la Page Facebook « Le Flash ».

API officielle Meta (Graph API), gratuite. La vidéo est envoyée directement depuis
le fichier (envoi « resumable »), pas besoin de l'héberger quelque part.

Variables d'environnement (secrets GitHub) :
  META_PAGE_TOKEN   jeton de Page permanent (donné par obtenir_jeton_meta.py)
  META_PAGE_ID      identifiant de la Page Facebook   -> Facebook Reels
  META_IG_USER_ID   identifiant du compte Instagram pro relié à la Page -> Instagram Reels
Si META_PAGE_ID ou META_IG_USER_ID manque, le réseau correspondant est simplement sauté.

Usage :
  python upload_meta.py sorties/005.mp4 scripts/005.json --marque publies/005
  (écrit publies/005-instagram.txt et publies/005-facebook.txt, et ne republie
   jamais un réseau déjà noté)
"""
import argparse, json, os, sys, time, urllib.error, urllib.parse, urllib.request

ICI = os.path.dirname(os.path.abspath(__file__))
VERSION = os.environ.get("META_API_VERSION", "v23.0")
GRAPH = f"https://graph.facebook.com/{VERSION}"


def appel(methode, url, params=None, data=None, entetes=None, timeout=120):
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, data=data, method=methode, headers=entetes or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{methode} {url.split('?')[0]} -> {e.code} {e.read()[:500]!r}")


def legende(s, charte, limite):
    """Titre + description + hashtags, sans le pied YouTube (« abonne-toi »)."""
    tags = []
    for h in ["#GTA6", "#GTAVI"] + s.get("hashtags", []) + ["#LeFlash"]:
        h = "#" + h.lstrip("#")
        if h.lower() not in [t.lower() for t in tags]:
            tags.append(h)
    import re
    titre = re.sub(r"\s*#shorts\b", "", s["titre"], flags=re.I).strip()  # #shorts = YouTube seulement
    morceaux = [titre]
    if s.get("description"):
        morceaux.append(s["description"].strip())
    morceaux.append(" ".join(tags[:5]))
    morceaux.append("Toute l'actu GTA 6 en français, chaque jour. "
                    "Chaîne de fans non affiliée à Rockstar Games ni à Take-Two Interactive.")
    return "\n\n".join(morceaux)[:limite]


def envoyer_octets(url, chemin, jeton):
    taille = os.path.getsize(chemin)
    with open(chemin, "rb") as f:
        return appel("POST", url, data=f.read(), timeout=600, entetes={
            "Authorization": f"OAuth {jeton}", "offset": "0", "file_size": str(taille),
            "Content-Type": "application/octet-stream"})


def instagram(video, texte, ig_id, jeton):
    # 1. conteneur Reel en envoi « resumable »
    c = appel("POST", f"{GRAPH}/{ig_id}/media", params={
        "media_type": "REELS", "upload_type": "resumable", "caption": texte,
        "share_to_feed": "true", "access_token": jeton})
    # 2. envoi du fichier
    envoyer_octets(c.get("uri") or f"https://rupload.facebook.com/ig-api-upload/{VERSION}/{c['id']}",
                   video, jeton)
    # 3. attendre la fin du traitement (jusqu'à ~10 min)
    for _ in range(60):
        st = appel("GET", f"{GRAPH}/{c['id']}", params={"fields": "status_code,status",
                                                         "access_token": jeton})
        if st.get("status_code") == "FINISHED":
            break
        if st.get("status_code") in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Instagram a refusé la vidéo : {st}")
        time.sleep(10)
    else:
        raise RuntimeError("Instagram : traitement trop long")
    # 4. publication (publique)
    p = appel("POST", f"{GRAPH}/{ig_id}/media_publish",
              params={"creation_id": c["id"], "access_token": jeton})
    return p["id"]


def facebook(video, texte, page_id, jeton):
    d = appel("POST", f"{GRAPH}/{page_id}/video_reels",
              params={"upload_phase": "start", "access_token": jeton})
    envoyer_octets(d.get("upload_url") or f"https://rupload.facebook.com/video-upload/{VERSION}/{d['video_id']}",
                   video, jeton)
    appel("POST", f"{GRAPH}/{page_id}/video_reels", params={
        "upload_phase": "finish", "video_id": d["video_id"], "video_state": "PUBLISHED",
        "description": texte, "access_token": jeton})
    return d["video_id"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("script")
    ap.add_argument("--marque", required=True, help="préfixe des fichiers témoins, ex. publies/005")
    a = ap.parse_args()
    jeton = os.environ.get("META_PAGE_TOKEN")
    if not jeton:
        print("META_PAGE_TOKEN absent : Instagram/Facebook sautés."); return
    s = json.load(open(a.script, encoding="utf-8"))
    cp = os.path.join(ICI, "marque", "charte.json")
    charte = json.load(open(cp, encoding="utf-8")) if os.path.exists(cp) else {}
    reseaux = [("instagram", os.environ.get("META_IG_USER_ID"), instagram, 2200),
               ("facebook", os.environ.get("META_PAGE_ID"), facebook, 5000)]
    echec = False
    for nom, cible, fonction, limite in reseaux:
        temoin = f"{a.marque}-{nom}.txt"
        if not cible or os.path.exists(temoin):
            continue
        try:
            pid = fonction(a.video, legende(s, charte, limite), cible, jeton)
            open(temoin, "w").write(pid + "\n")
            print(f"Publié sur {nom} :", pid)
        except Exception as e:  # un réseau en panne ne bloque pas les autres
            echec = True
            print(f"ÉCHEC {nom} :", e, file=sys.stderr)
    sys.exit(1 if echec else 0)


if __name__ == "__main__":
    main()
