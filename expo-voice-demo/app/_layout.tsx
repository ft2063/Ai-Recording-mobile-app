// app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { ThemeProvider } from "./(tabs)/theme";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
