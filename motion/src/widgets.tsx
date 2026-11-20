import React from "react";
import { Easing, Img, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BLEU, ETIQ, ROUGE, type Theme, type Visuel } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const doux = Easing.bezier(0.16, 1, 0.3, 1);
export const POLICE = "Plus Jakarta Sans";

// ---------- briques communes ----------
export const Pastille: React.FC<{ etiquette: string; delai?: number }> = ({ etiquette, delai = 10 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = ETIQ[etiquette];
  if (!e) return null;
  const s = spring({ frame: f - delai, fps, config: { damping: 12, stiffness: 180 } });
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: e.fond, color: e.texte,
      fontFamily: POLICE, fontWeight: 800, fontSize: 30, letterSpacing: 3, padding: "10px 22px", borderRadius: 999,
      transform: `scale(${s})`, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
      <div style={{ width: 12, height: 12, borderRadius: 6, background: e.texte, opacity: 0.4 + 0.6 * Math.abs(Math.sin(f / 9)) }} />
      {etiquette}
    </div>
  );
};

const Carte: React.FC<{ th: Theme; largeur?: number | "auto"; children: React.ReactNode; pad?: number; style?: React.CSSProperties }> = ({ th, largeur = 780, children, pad = 44, style }) => (
  <div style={{ width: largeur === "auto" ? undefined : largeur, background: th.carte, borderRadius: 48, padding: pad, boxShadow: th.ombre,
    border: `2px solid ${th.carteBord}`, color: th.carteTexte, fontFamily: POLICE, position: "relative", overflow: "hidden", ...style }}>
    {children}
  </div>
);

const Ligne: React.FC<{ th: Theme; l: number; o?: number }> = ({ th, l, o = 1 }) => (
  <div style={{ height: 16, width: l, borderRadius: 8, background: th.carteDoux, opacity: 0.35 * o }} />
);

// onde audio qui bouge (rappel « voix off » / direct)
const Onde: React.FC<{ couleur: string; n?: number; h?: number }> = ({ couleur, n = 26, h = 60 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, height: h }}>
      {Array.from({ length: n }).map((_, i) => {
        const a = 0.25 + 0.75 * Math.abs(Math.sin(f / 5 + i * 0.7) * Math.cos(f / 11 + i * 0.3));
        return <div key={i} style={{ width: 6, height: h * a, borderRadius: 3, background: couleur, opacity: 0.85 }} />;
      })}
    </div>
  );
};

// ---------- compteur à rouleaux ----------
const Rouleau: React.FC<{ chiffre: number; delai: number; taille: number; couleur: string }> = ({ chiffre, delai, taille, couleur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tours = 10 + chiffre; // un tour complet + le chiffre
  const p = interpolate(f - delai, [0, fps * 1.1], [0, 1], { ...clamp, easing: doux });
  const pos = p * tours;
  const flou = Math.min(14, Math.abs(1 - p) * 24 * (p > 0 && p < 1 ? 1 : 0));
  return (
    <div style={{ height: taille * 1.1, overflow: "hidden", position: "relative" }}>
      <div style={{ transform: `translateY(${-(pos % 10) * taille * 1.1}px)`, filter: `blur(${flou * 0.4}px)` }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((c, i) => (
          <div key={i} style={{ height: taille * 1.1, lineHeight: `${taille * 1.1}px`, fontSize: taille, fontWeight: 800, color: couleur,
            fontVariantNumeric: "tabular-nums" }}>{c}</div>
        ))}
      </div>
    </div>
  );
};

const Compteur: React.FC<{ v: Extract<Visuel, { type: "compteur" }>; th: Theme }> = ({ v, th }) => {
  const txt = Math.round(v.valeur).toLocaleString("fr-FR").replace(/ | /g, " ");
  const taille = txt.length > 9 ? 104 : txt.length > 6 ? 130 : 170;
  let k = 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
      <Carte th={th} largeur="auto" pad={34} style={{ padding: "26px 46px" }}>
        <div style={{ display: "flex", alignItems: "center", fontFamily: POLICE, fontWeight: 800, fontSize: taille }}>
          {v.prefixe && <span style={{ marginRight: 14 }}>{v.prefixe}</span>}
          {[...txt].map((c, i) => (/\d/.test(c)
            ? <Rouleau key={i} chiffre={+c} delai={6 + (k++) * 2} taille={taille} couleur={th.carteTexte} />
            : <span key={i} style={{ width: taille * 0.28 }}>{c === " " ? "" : c}</span>))}
          {v.suffixe && <span style={{ marginLeft: 10, fontSize: taille * 0.55 }}>{v.suffixe}</span>}
        </div>
      </Carte>
      {v.unite && <Bulle th={th} texte={v.unite} delai={22} />}
    </div>
  );
};

const Bulle: React.FC<{ th: Theme; texte: string; delai?: number; icone?: string }> = ({ th, texte, delai = 14, icone = "◉" }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delai, fps, config: { damping: 13 } });
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 14, background: th.carte, border: `2px solid ${th.carteBord}`,
      borderRadius: 999, padding: "14px 30px", color: th.carteTexte, fontFamily: POLICE, fontWeight: 700, fontSize: 40,
      transform: `translateY(${(1 - s) * 40}px) scale(${0.8 + 0.2 * s})`, opacity: s, boxShadow: th.ombre }}>
      <span style={{ color: BLEU }}>{icone}</span>{texte}
    </div>
  );
};

// ---------- calendrier ----------
const Calendrier: React.FC<{ v: Extract<Visuel, { type: "calendrier" }>; th: Theme }> = ({ v, th }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 4, fps, config: { damping: 14 } });
  const jour = Math.round(interpolate(f, [8, 30], [Math.max(1, v.jour - 9), v.jour], { ...clamp, easing: doux }));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
      <div style={{ width: 380, borderRadius: 64, overflow: "hidden", background: "#ffffff", boxShadow: "0 40px 90px rgba(10,20,80,0.45)",
        transform: `perspective(1400px) rotateY(${(1 - s) * -70}deg)`, fontFamily: POLICE }}>
        <div style={{ background: ROUGE, color: "#fff", fontWeight: 800, fontSize: 52, letterSpacing: 6, textAlign: "center", padding: "18px 0 14px" }}>
          {v.mois.toUpperCase()}
        </div>
        <div style={{ color: "#0b1440", fontWeight: 800, fontSize: 230, lineHeight: 1, textAlign: "center", padding: "24px 0 40px",
          fontVariantNumeric: "tabular-nums" }}>{jour}</div>
      </div>
      {v.legende && <Bulle th={th} texte={v.legende} delai={20} icone="●" />}
    </div>
  );
};

// ---------- classement (la cible grimpe) ----------
const Classement: React.FC<{ v: Extract<Visuel, { type: "classement" }>; th: Theme }> = ({ v, th }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const de = v.de ?? 4, a = v.a ?? 1, H = 104;
  const pos = interpolate(f, [16, 16 + (de - a) * 9], [de, a], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const badge = spring({ frame: f - (20 + (de - a) * 9), fps, config: { damping: 9, stiffness: 220 } });
  return (
    <Carte th={th} largeur={800}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 26 }}>
        <div style={{ fontSize: 44, fontWeight: 800 }}>{v.titre || "Classement"}</div>
      </div>
      <div style={{ position: "relative", height: H * 4 }}>
        {[1, 2, 3, 4].map((r) => (
          <div key={r} style={{ position: "absolute", top: (r - 1) * H, left: 0, right: 0, height: H - 16, display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ width: 30, fontSize: 34, fontWeight: 700, color: th.carteDoux }}>{r}</div>
            <div style={{ width: 54, height: 54, borderRadius: 14, background: th.carteDoux, opacity: 0.2 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Ligne th={th} l={260 - r * 25} /><Ligne th={th} l={150} o={0.6} /></div>
          </div>
        ))}
        <div style={{ position: "absolute", top: (pos - 1) * H - 6, left: -14, right: -14, height: H - 4, borderRadius: 26,
          background: BLEU, display: "flex", alignItems: "center", gap: 22, padding: "0 26px", color: "#fff",
          boxShadow: `0 20px 50px ${BLEU}80`, transform: `scale(${1 + 0.04 * Math.sin(Math.min(1, (f - 16) / ((de - a) * 9 || 1)) * Math.PI)})` }}>
          <div style={{ width: 30, fontSize: 36, fontWeight: 800 }}>{Math.round(pos)}</div>
          <div style={{ fontSize: 44, fontWeight: 800, flex: 1 }}>{v.cible}</div>
          {v.note && <div style={{ fontSize: 26, fontWeight: 700, background: "rgba(255,255,255,0.2)", borderRadius: 999, padding: "8px 18px" }}>{v.note}</div>}
        </div>
      </div>
      {a === 1 && (
        <div style={{ position: "absolute", top: 34, right: 40, background: "#0b1440", color: "#fff", fontWeight: 800, fontSize: 32,
          borderRadius: 999, padding: "8px 20px", transform: `scale(${badge})` }}>N°1</div>
      )}
    </Carte>
  );
};

// ---------- jauge en % ----------
const Jauge: React.FC<{ v: Extract<Visuel, { type: "jauge" }>; th: Theme }> = ({ v, th }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [8, 44], [0, v.valeur], { ...clamp, easing: doux });
  return (
    <Carte th={th} largeur={800}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: 38, fontWeight: 700, color: th.carteDoux, maxWidth: 420 }}>{v.legende || ""}</div>
        <div style={{ fontSize: 150, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{Math.round(p)}<span style={{ fontSize: 70 }}>%</span></div>
      </div>
      <div style={{ marginTop: 34, height: 14, borderRadius: 7, background: `${th.carteDoux}`, opacity: 0.5, position: "relative" }} />
      <div style={{ marginTop: -14, height: 14, width: `${p}%`, borderRadius: 7, background: BLEU, position: "relative", boxShadow: `0 0 24px ${BLEU}` }}>
        <div style={{ position: "absolute", right: -16, top: -9, width: 32, height: 32, borderRadius: 16, background: "#fff", border: `6px solid ${BLEU}` }} />
      </div>
    </Carte>
  );
};

// ---------- liste à interrupteurs ----------
const Liste: React.FC<{ v: Extract<Visuel, { type: "liste" }>; th: Theme; duree: number }> = ({ v, th, duree }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pas = Math.max(8, Math.min(24, (duree * fps - 20) / Math.max(1, v.items.length)));
  return (
    <Carte th={th} largeur={780}>
      {v.titre && <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 20 }}>{v.titre}</div>}
      {v.items.slice(0, 5).map((it, i) => {
        const on = interpolate(f, [12 + i * pas, 18 + i * pas], [0, 1], { ...clamp, easing: doux });
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, padding: "18px 0", borderTop: i ? `2px solid ${th.carteBord}` : undefined }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: th.carteDoux, opacity: 0.25, fontSize: 26, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
            <div style={{ flex: 1, fontSize: 42, fontWeight: 700 }}>{it}</div>
            <div style={{ width: 96, height: 56, borderRadius: 28, background: on > 0.5 ? BLEU : `${th.carteDoux}`, position: "relative",
              opacity: 0.5 + on * 0.5 }}>
              <div style={{ position: "absolute", top: 6, left: 6 + on * 40, width: 44, height: 44, borderRadius: 22, background: "#fff",
                boxShadow: "0 4px 10px rgba(0,0,0,0.25)" }} />
            </div>
          </div>
        );
      })}
    </Carte>
  );
};

// ---------- post de réseau social (insider, annonce) ----------
const Post: React.FC<{ v: Extract<Visuel, { type: "post" }>; th: Theme; duree: number }> = ({ v, th, duree }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.round(interpolate(f, [10, Math.min(duree * fps * 0.7, 10 + v.texte.length * 1.2)], [0, v.texte.length], clamp));
  return (
    <Carte th={th} largeur={800}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
        <div style={{ width: 76, height: 76, borderRadius: 38, background: `linear-gradient(135deg, ${BLEU}, #7aa2ff)`, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 800 }}>{v.auteur[0]?.toUpperCase()}</div>
        <div>
          <div style={{ fontSize: 38, fontWeight: 800 }}>{v.auteur} <span style={{ color: BLEU }}>●</span></div>
          <div style={{ fontSize: 28, color: th.carteDoux, fontWeight: 600 }}>{v.reseau || "sur X"}</div>
        </div>
      </div>
      <div style={{ fontSize: 42, fontWeight: 600, lineHeight: 1.3, minHeight: 120 }}>
        {v.texte.slice(0, n)}<span style={{ opacity: f % 16 < 8 ? 1 : 0, color: BLEU }}>|</span>
      </div>
    </Carte>
  );
};

// ---------- étiquette de prix ----------
const Prix: React.FC<{ v: Extract<Visuel, { type: "prix" }>; th: Theme }> = ({ v, th }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 8, fps, config: { damping: 10, stiffness: 150 } });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
      <Carte th={th} largeur="auto" style={{ padding: "34px 60px", transform: `rotate(${(1 - s) * -8 - 3}deg) scale(${0.6 + 0.4 * s})` }}>
        <div style={{ fontSize: 160, fontWeight: 800, lineHeight: 1 }}>{v.montant}</div>
      </Carte>
      {v.legende && <Bulle th={th} texte={v.legende} delai={18} icone="●" />}
    </div>
  );
};

// ---------- image du jeu dans une carte ----------
const ImageJeu: React.FC<{ v: Extract<Visuel, { type: "image" }>; th: Theme; duree: number }> = ({ v, th, duree }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const z = interpolate(f, [0, duree * fps], [1.08, 1.22], clamp);
  const x = interpolate(f, [0, duree * fps], [-20, 20], clamp);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
      <div style={{ width: 860, height: 560, borderRadius: 48, overflow: "hidden", boxShadow: th.ombre, border: `3px solid ${th.carteBord}`,
        position: "relative", background: "#0b1440" }}>
        <Img src={staticFile(v.src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z}) translateX(${x}px)` }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 55%, rgba(5,8,30,0.55))" }} />
        <div style={{ position: "absolute", left: 30, bottom: 26, display: "flex", alignItems: "center", gap: 14, color: "#fff",
          fontFamily: POLICE, fontWeight: 700, fontSize: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 22 }}>▶</div>
          <div style={{ width: 360, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.3)" }}>
            <div style={{ width: `${interpolate(f, [0, duree * fps], [5, 95], clamp)}%`, height: "100%", borderRadius: 3, background: "#fff" }} />
          </div>
        </div>
      </div>
      {v.legende && <Bulle th={th} texte={v.legende} delai={16} icone="●" />}
    </div>
  );
};

// ---------- extrait vidéo du jeu dans une carte ----------
const VideoJeu: React.FC<{ v: Extract<Visuel, { type: "video" }>; th: Theme; duree: number }> = ({ v, th, duree }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const z = interpolate(f, [0, duree * fps], [1.04, 1.14], clamp);
  const balaie = ((f % 75) / 75) * 260 - 80; // reflet qui traverse la carte
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
      <div style={{ width: 880, height: 495, borderRadius: 48, overflow: "hidden", boxShadow: `${th.ombre}, 0 0 80px ${BLEU}55`,
        border: `3px solid ${th.carteBord}`, position: "relative", background: "#0b1440" }}>
        <OffthreadVideo src={staticFile(v.src)} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})` }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(5,8,30,0.15), transparent 40%, rgba(5,8,30,0.55))" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${balaie}%`, width: "22%", transform: "skewX(-18deg)",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)" }} />
        <div style={{ position: "absolute", top: 24, left: 26, display: "flex", alignItems: "center", gap: 10, background: "rgba(255,45,61,0.92)",
          color: "#fff", fontFamily: POLICE, fontWeight: 800, fontSize: 24, letterSpacing: 2, borderRadius: 999, padding: "6px 16px" }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "#fff", opacity: 0.4 + 0.6 * Math.abs(Math.sin(f / 8)) }} />EN JEU
        </div>
        <div style={{ position: "absolute", left: 26, right: 26, bottom: 22, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.3)" }}>
          <div style={{ width: `${interpolate(f, [0, duree * fps], [3, 97], clamp)}%`, height: "100%", borderRadius: 3, background: "#fff" }} />
        </div>
      </div>
      {v.legende && <Bulle th={th} texte={v.legende} delai={16} icone="●" />}
    </div>
  );
};

// ---------- carte par défaut : titre + onde ----------
const CarteTitre: React.FC<{ titre: string; sous?: string; th: Theme; etiquette?: string }> = ({ titre, sous, th }) => {
  const f = useCurrentFrame();
  return (
    <Carte th={th} largeur={780}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 28, fontWeight: 700, color: th.carteDoux }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: ROUGE, opacity: 0.4 + 0.6 * Math.abs(Math.sin(f / 9)) }} />
          LE FLASH · ACTU
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: th.carteDoux, fontVariantNumeric: "tabular-nums" }}>
          0:{String(Math.floor(f / 30) % 60).padStart(2, "0")}
        </div>
      </div>
      <div style={{ fontSize: titre.length > 22 ? 64 : 80, fontWeight: 800, lineHeight: 1.05, marginBottom: 30 }}>{titre}</div>
      {sous && <div style={{ fontSize: 34, fontWeight: 600, color: th.carteDoux, marginBottom: 26 }}>{sous}</div>}
      <Onde couleur={th.carteTexte === "#ffffff" ? "#9db4ff" : BLEU} />
    </Carte>
  );
};

// ---------- question au public : carte « ? » + commentaire qui s'écrit ----------
const Question: React.FC<{ v: Extract<Visuel, { type: "question" }>; th: Theme }> = ({ v, th }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tuile = spring({ frame: f - 4, fps, config: { damping: 10, stiffness: 140 } });
  const msg = v.texte || "Dis-le en commentaire…";
  const n = Math.round(interpolate(f, [18, 18 + msg.length * 1.4], [0, msg.length], clamp));
  const envoye = f > 24 + msg.length * 1.4;
  const coeurs = Math.round(interpolate(f, [30 + msg.length * 1.4, 80 + msg.length * 1.4], [0, 128], { ...clamp, easing: doux }));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
      <div style={{ width: 300, height: 300, borderRadius: 80, background: `linear-gradient(145deg, #5b85ff, ${BLEU} 45%, #0f2a9e)`,
        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: POLICE, fontWeight: 800, fontSize: 210,
        boxShadow: `0 40px 90px ${BLEU}88, inset 0 4px 0 rgba(255,255,255,0.35)`,
        transform: `scale(${tuile}) rotate(${(1 - tuile) * -25 + Math.sin(f / 20) * 4}deg)` }}>?</div>
      <Carte th={th} largeur={800} pad={28} style={{ display: "flex", alignItems: "center", gap: 22, borderRadius: 999, padding: "20px 22px 20px 34px" }}>
        <div style={{ flex: 1, fontSize: 38, fontWeight: 600, color: n ? th.carteTexte : th.carteDoux, whiteSpace: "nowrap", overflow: "hidden" }}>
          {msg.slice(0, n)}{!envoye && <span style={{ opacity: f % 16 < 8 ? 1 : 0, color: BLEU }}>|</span>}
        </div>
        <div style={{ width: 74, height: 74, borderRadius: 37, background: envoye ? "#0b1440" : BLEU, color: "#fff", fontSize: 38,
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{envoye ? "✓" : "↑"}</div>
      </Carte>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: POLICE, fontWeight: 800, fontSize: 40, color: th.texte,
        opacity: coeurs ? 1 : 0 }}>
        <span style={{ color: ROUGE }}>♥</span>{coeurs}
      </div>
    </div>
  );
};

export const Widget: React.FC<{ v: Visuel; th: Theme; duree: number }> = ({ v, th, duree }) => {
  switch (v.type) {
    case "compteur": return <Compteur v={v} th={th} />;
    case "calendrier": return <Calendrier v={v} th={th} />;
    case "classement": return <Classement v={v} th={th} />;
    case "jauge": return <Jauge v={v} th={th} />;
    case "liste": return <Liste v={v} th={th} duree={duree} />;
    case "post": return <Post v={v} th={th} duree={duree} />;
    case "prix": return <Prix v={v} th={th} />;
    case "image": return <ImageJeu v={v} th={th} duree={duree} />;
    case "question": return <Question v={v} th={th} />;
    case "video": return <VideoJeu v={v} th={th} duree={duree} />;
    default: return <CarteTitre titre={v.titre || ""} sous={v.sous} th={th} />;
  }
};
