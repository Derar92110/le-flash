#!/usr/bin/env python3
"""Passe en public les vidéos dont l'ID est listé dans a_rendre_public.txt (une par ligne)."""
import os, upload_youtube
f = os.path.join(upload_youtube.ICI, "a_rendre_public.txt")
ids = [l.strip() for l in open(f, encoding="utf-8") if l.strip() and not l.startswith("#")] if os.path.exists(f) else []
if ids:
    yt = upload_youtube.service()
    for vid in ids:
        st = yt.videos().list(part="status", id=vid).execute()["items"][0]["status"]
        st["privacyStatus"] = "public"
        body = {"id": vid, "status": {k: st[k] for k in ("privacyStatus", "embeddable", "license",
                "publicStatsViewable", "selfDeclaredMadeForKids", "containsSyntheticMedia") if k in st}}
        yt.videos().update(part="status", body=body).execute()
        print("Public :", vid)
    os.remove(f)
