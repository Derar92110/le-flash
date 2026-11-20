import React from "react";
import { Composition, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";
import { Flash } from "./Flash";
import type { FlashProps } from "./types";
import demo from "./demo.json";

const FPS = 30;

loadFont({ family: "Plus Jakarta Sans", url: staticFile("fonts/PlusJakartaSans.ttf"), weight: "200 800" });

export const Root: React.FC = () => (
  <Composition
    id="Flash"
    component={Flash}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={Math.ceil((demo as unknown as FlashProps).duree * FPS)}
    defaultProps={demo as unknown as FlashProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(30, Math.ceil(props.duree * FPS)),
    })}
  />
);
