// app/theme.tsx
import React, { createContext, useContext, useState } from "react";

const light = {
  bg: "#ffffff",
  text: "#0b1220",
  sub: "#4b5563",
  card: "#ffffff",
  border: "#e5e9f5",
  shadow: "#000000",
  iconBg: "#f6f8ff",
  iconBgPressed: "#eef3ff",
  outlineSurface: "#ffffff",
};

const dark = {
  bg: "#0b1220",
  text: "#ffffff",
  sub: "#a0a0a0",
  card: "#1a1a1a",
  border: "#333333",
  shadow: "#000000",
  iconBg: "#1f2937",
  iconBgPressed: "#374151",
  outlineSurface: "#1a1a1a",
};

type ThemeCtx = {
  name: "light" | "dark";
  T: typeof light;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx>({
  name: "light",
  T: light,
  toggle: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [name, setName] = useState<"light" | "dark">("light");
  const toggle = () => setName((p) => (p === "light" ? "dark" : "light"));

  return <Ctx.Provider value={{ name, T: name === "light" ? light : dark, toggle }}>{children}</Ctx.Provider>;
};

export const useTheme = () => useContext(Ctx);
