export type Mot = {
  w: string; // le mot tel qu'affiché
  start: number; // secondes
  end: number;
  cle: boolean; // mot entre *étoiles* dans le script
  seg: number; // index du segment
};

// Widget affiché sous le texte. Si le script n'en donne pas, il est déduit du texte.
export type Visuel =
  | { type: "carte"; titre?: string; sous?: string }
  | { type: "compteur"; valeur: number; unite?: string; prefixe?: string; suffixe?: string }
  | { type: "calendrier"; jour: number; mois: string; legende?: string }
  | { type: "classement"; titre?: string; cible: string; de?: number; a?: number; note?: string }
  | { type: "jauge"; valeur: number; legende?: string }
  | { type: "liste"; titre?: string; items: string[] }
  | { type: "post"; auteur: string; texte: string; reseau?: string }
  | { type: "prix"; montant: string; legende?: string }
  | { type: "image"; src: string; legende?: string; cherche?: string }
  | { type: "question"; texte?: string }
  | { type: "video"; src: string; legende?: string };

export type Fond = { type: "image" | "video"; src: string };

export type Segment = {
  titre?: string;
  texte: string;
  etiquette?: string;
  visuel?: Visuel;
  fond?: Fond | null;
  start: number;
  end: number;
};

export type FlashProps = {
  hook: string;
  segments: Segment[];
  mots: Mot[];
  duree: number; // secondes, outro comprise
  finVoix: number; // secondes : début de l'outro
  voix?: string; // fichier dans public/
  musique?: string; // fichier dans public/
  volumeMusique?: number;
};

export type Theme = {
  fond: string;
  texte: string;
  texteDoux: string;
  cle: string;
  carte: string;
  carteBord: string;
  carteTexte: string;
  carteDoux: string;
  ombre: string;
  deco: string;
};

export const THEMES: Record<"bleu" | "nuit" | "clair", Theme> = {
  bleu: {
    fond: "radial-gradient(120% 80% at 50% 42%, #4069ff 0%, #2346dc 42%, #142687 100%)",
    texte: "#ffffff", texteDoux: "rgba(255,255,255,0.55)", cle: "#c4d3ff",
    carte: "linear-gradient(160deg, rgba(14,22,70,0.92), rgba(8,13,44,0.92))",
    carteBord: "rgba(160,185,255,0.28)", carteTexte: "#ffffff", carteDoux: "rgba(255,255,255,0.45)",
    ombre: "0 40px 90px rgba(5,10,50,0.55)", deco: "#7f9cff",
  },
  nuit: {
    fond: "radial-gradient(110% 75% at 50% 40%, #1d2f8c 0%, #0b1238 52%, #04061a 100%)",
    texte: "#ffffff", texteDoux: "rgba(255,255,255,0.5)", cle: "#8eacff",
    carte: "linear-gradient(160deg, rgba(40,62,170,0.55), rgba(16,24,80,0.75))",
    carteBord: "rgba(140,170,255,0.35)", carteTexte: "#ffffff", carteDoux: "rgba(255,255,255,0.5)",
    ombre: "0 40px 100px rgba(0,0,0,0.6)", deco: "#3d64ff",
  },
  clair: {
    fond: "radial-gradient(120% 80% at 50% 38%, #ffffff 0%, #eef1fb 48%, #d6dcf3 100%)",
    texte: "#0b1440", texteDoux: "rgba(11,20,64,0.45)", cle: "#2547e8",
    carte: "linear-gradient(170deg, #ffffff, #f3f5fc)",
    carteBord: "rgba(37,71,232,0.10)", carteTexte: "#0b1440", carteDoux: "rgba(11,20,64,0.4)",
    ombre: "0 40px 80px rgba(30,50,140,0.18)", deco: "#2547e8",
  },
};

export const ROUGE = "#ff2d3d";
export const BLEU = "#1f6bff";

export const ETIQ: Record<string, { fond: string; texte: string }> = {
  OFFICIEL: { fond: "#ffffff", texte: "#0b1440" },
  RUMEUR: { fond: "#1f6bff", texte: "#ffffff" },
  LEAK: { fond: "#ff2d3d", texte: "#ffffff" },
};
