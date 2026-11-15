#!/usr/bin/env python3
"""À lancer UNE fois sur un ordinateur avec navigateur, connecté au compte @leflashfr.
Il ouvre la page de connexion Google, puis affiche le contenu de token.json
à coller dans le secret GitHub YOUTUBE_TOKEN. Ensuite le cloud publie seul."""
import os, upload_youtube
upload_youtube.service()
print("\n=== Copie TOUT le texte ci-dessous dans le secret GitHub YOUTUBE_TOKEN ===\n")
print(open(os.path.join(upload_youtube.ICI, "token.json")).read())
