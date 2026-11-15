#!/usr/bin/env python3
"""Publie un Short sur YouTube via l'API officielle YouTube Data v3.

Préparation (une seule fois, 10 min, à faire par toi, connecté au compte de la chaîne @leflashfr) :
  1. https://console.cloud.google.com -> nouveau projet "qg-neon"
  2. "API et services" -> activer "YouTube Data API v3"
  3. "Écran de consentement OAuth" -> type Externe, ajoute ton adresse en utilisateur test
  4. "Identifiants" -> Créer -> ID client OAuth -> Application de bureau
     -> télécharge le JSON et renomme-le client_secret.json à côté de ce script
  5. pip install google-api-python-client google-auth-oauthlib

Usage :
  python upload_youtube.py sorties/001.mp4 scripts/001.json [--publier-a 2026-11-19T18:00:00+01:00]
Par défaut la vidéo part en "privé" (tu vérifies puis tu passes en public),
ou programmée si --publier-a est donné.
Quota gratuit : ~6 uploads par jour (10 000 unités, 1 600 par upload).
"""
import argparse, json, os
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/youtube"]  # upload + ajout aux playlists
ICI = os.path.dirname(os.path.abspath(__file__))


def service():
    tok = os.path.join(ICI, "token.json")
    creds = Credentials.from_authorized_user_file(tok, SCOPES) if os.path.exists(tok) else None
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                os.path.join(ICI, "client_secret.json"), SCOPES)
            creds = flow.run_local_server(port=0)
        open(tok, "w").write(creds.to_json())
    return build("youtube", "v3", credentials=creds)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("script")
    ap.add_argument("--publier-a", help="date ISO 8601 de mise en ligne programmée")
    ap.add_argument("--id-file", help="écrit l'ID de la vidéo publiée dans ce fichier")
    ap.add_argument("--visibilite", default=os.environ.get("PUBLICATION", "private"),
                    choices=["private", "unlisted", "public"])
    a = ap.parse_args()
    s = json.load(open(a.script, encoding="utf-8"))
    cp = os.path.join(ICI, "marque", "charte.json")
    c = json.load(open(cp, encoding="utf-8")) if os.path.exists(cp) else {}
    desc = s.get("description", "")
    if s.get("sources"):
        desc += "\n\nSources :\n" + "\n".join(f"- {x}" for x in s["sources"])
    if c.get("pied_description"):
        desc += "\n\n" + c["pied_description"]
    status = {"privacyStatus": a.visibilite, "selfDeclaredMadeForKids": False,
              "containsSyntheticMedia": True}  # voix IA : à déclarer
    if a.publier_a:
        status["publishAt"] = a.publier_a
    body = {"snippet": {"title": s["titre"][:100], "description": desc[:4900],
                        "tags": s.get("tags", []), "categoryId": "20", "defaultLanguage": "fr-FR",
                        "defaultAudioLanguage": "fr-FR"},
            "status": status}
    yt = service()
    req = yt.videos().insert(part="snippet,status", body=body,
                                    media_body=MediaFileUpload(a.video, resumable=True))
    rep = None
    while rep is None:
        _, rep = req.next_chunk()
    print("Publié :", "https://youtube.com/shorts/" + rep["id"])
    if a.id_file:
        open(a.id_file, "w").write(rep["id"] + "\n")
    # playlist : champ "playlist" du script (flash_du_jour, recap, decryptage),
    # sinon Flash du jour pour un Short à segments, Décryptage pour une vidéo longue
    cle = s.get("playlist") or ("decryptage" if s.get("format") == "long"
                                else "flash_du_jour" if s.get("segments") else None)
    pl = c.get("playlists", {}).get(cle) if cle else None
    if pl:
        def ajouter(pid):
            yt.playlistItems().insert(part="snippet", body={"snippet": {
                "playlistId": pid, "resourceId": {"kind": "youtube#video", "videoId": rep["id"]}}}).execute()
        try:
            ajouter(pl)
        except Exception as e:  # ID refusé : on retrouve la playlist par son titre
            print("Playlist refusée, recherche par titre…", e)
            mots = {"flash_du_jour": "flash du jour", "recap": "récap", "decryptage": "décryptage"}[cle]
            items = yt.playlists().list(part="snippet", mine=True, maxResults=50).execute()["items"]
            pl = next(i["id"] for i in items if mots in i["snippet"]["title"].lower())
            ajouter(pl)
        print("Ajouté à la playlist", cle, pl)


if __name__ == "__main__":
    main()
