// app/(tabs)/index.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Animated,
  Easing,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "./theme";

const TRANSCRIBE_URL = "http://192.168.1.212:3001/transcribe";
const SERVER = "http://192.168.1.212:3001";

// util
function darken(hex: string, factor = 0.12) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const dr = Math.max(0, Math.floor(r * (1 - factor)));
  const dg = Math.max(0, Math.floor(g * (1 - factor)));
  const db = Math.max(0, Math.floor(b * (1 - factor)));
  return `#${dr.toString(16).padStart(2, "0")}${dg
    .toString(16)
    .padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
}

const brandBlue = "#1e90ff";
const dangerRed = "#ff3b30";
const successGreen = "#1e90ff";

export default function Index() {
  const router = useRouter();
  const { name: theme, T, toggle } = useTheme();

  const [recording, setRecording] = React.useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [lastUri, setLastUri] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");
  const [error, setError] = React.useState("");
  const [savedOnce, setSavedOnce] = React.useState(false);

  // pulse anim
  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isRecording) {
      pulse.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ])
      );
      loop.start();
    }
    return () => { loop?.stop?.(); pulse.setValue(0); };
  }, [isRecording, pulse]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.05] });

  async function startRecording() {
    try {
      setError("");
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { setError("Microphone permission denied"); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
      setTranscript("");
      setSavedOnce(false);
      setLastUri(null);
    } catch (e: any) { setError(String(e?.message ?? e)); }
  }

  async function stopRecording() {
    try {
      setIsRecording(false);
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) throw new Error("No recording URI");
      setLastUri(uri);
      setLoading(true);
      const text = await uploadForTranscription(uri);
      setTranscript(text || "(empty)");
    } catch (e: any) { setError(String(e?.message ?? e)); }
    finally { setLoading(false); }
  }

  async function playLast() {
    if (!lastUri) return;
    try { const { sound } = await Audio.Sound.createAsync({ uri: lastUri }); await sound.playAsync(); }
    catch (e: any) { setError("Playback failed: " + e.message); }
  }

  async function uploadForTranscription(fileUri: string): Promise<string> {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) throw new Error("Recording file missing");
    const form = new FormData();
    form.append("file", { uri: fileUri, name: "audio.m4a", type: "audio/m4a" } as any);
    const res = await fetch(TRANSCRIBE_URL, { method: "POST", body: form }).catch((e) => {
      throw new Error("Fetch failed: " + (e?.message ?? e));
    });
    if (!res.ok) throw new Error(`Transcription failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { text?: string };
    return data.text ?? "";
  }

  async function saveToLibrary(text: string) {
    if (!text || savedOnce) return;
    const res = await fetch(`${SERVER}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, meta: { source: "android", title: "Recording" } }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  const SmallButton = ({
    children, color, onPress, outline = false, textColor, disabled = false,
  }: {
    children: React.ReactNode; color: string; onPress: () => void | Promise<void>;
    outline?: boolean; textColor?: string; disabled?: boolean;
  }) => (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallBtn,
        outline
          ? { backgroundColor: pressed ? T.iconBgPressed : T.outlineSurface, borderColor: color, borderWidth: 2, opacity: disabled ? 0.5 : 1 }
          : { backgroundColor: pressed ? darken(color, 0.12) : color, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Text style={[styles.smallBtnText, { color: outline ? (textColor || color) : (textColor || "#fff") }]}>{children}</Text>
    </Pressable>
  );

  const RecordFAB = () => {
    const base = isRecording ? dangerRed : brandBlue;
    return (
      <View style={styles.fabWrap} pointerEvents="box-none">
        {isRecording && (
          <Animated.View style={[styles.pulseRing, { backgroundColor: dangerRed, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
        )}
        <Pressable
          accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
          onPress={isRecording ? stopRecording : startRecording}
          android_ripple={{ color: darken(base, 0.25), borderless: true }}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: pressed ? darken(base, 0.15) : base, shadowOpacity: isRecording ? 0.45 : 0.25, shadowColor: T.shadow, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          {isRecording ? <Ionicons name="stop" size={28} color="#fff" /> : <Ionicons name="mic" size={28} color="#fff" />}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: T.bg }]}>
      <StatusBar style={theme === "light" ? "dark" : "light"} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.brand, { color: T.text }]}></Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={toggle}
            hitSlop={10}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? T.iconBgPressed : T.iconBg, borderColor: T.border }]}
          >
            {theme === "light" ? <Ionicons name="moon-outline" size={20} color={T.text} /> : <Ionicons name="sunny-outline" size={20} color={T.text} />}
          </Pressable>
          <Pressable
            onPress={() => router.push("/library")}
            hitSlop={10}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? T.iconBgPressed : T.iconBg, borderColor: T.border }]}
          >
            <Ionicons name="albums-outline" size={20} color={T.text} />
          </Pressable>
        </View>
      </View>

      {/* Tagline */}
      {!isRecording && !transcript && (
        <Text style={[styles.tagline, { color: T.sub }]}>Record a thought and get instant transcript.</Text>
      )}

      {loading && <ActivityIndicator size="large" style={{ marginTop: 16 }} />}

      {!!error && <Text style={[styles.error, { color: theme === "light" ? "tomato" : "#fca5a5" }]}>{error}</Text>}

      {/* Transcript + actions */}
      {!!transcript && (
        <>
          <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border, shadowColor: T.shadow }]}>
            <Text style={[styles.cardTitle, { color: T.text }]}>Transcript</Text>
            <Text style={[styles.transcript, { color: T.text }]}>{transcript}</Text>
          </View>

          <View style={styles.actionsRow}>
            <SmallButton color={successGreen} onPress={playLast}>▶︎ Play last</SmallButton>
            <SmallButton
              color={successGreen}
              outline
              textColor={successGreen}
              disabled={!transcript || savedOnce}
              onPress={async () => {
                try {
                  if (!transcript || savedOnce) return;
                  const out = await saveToLibrary(transcript);
                  setSavedOnce(true);
                  alert("Saved.\n\nKey points:\n\n" + (out?.keyPoints || "(none)"));
                } catch (e: any) { alert(String(e?.message || e)); }
              }}
            >
              {savedOnce ? "Saved" : "Save to Library"}
            </SmallButton>
          </View>
        </>
      )}

      <RecordFAB />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 52, paddingHorizontal: 18 },
  header: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  brand: { fontSize: 22, fontWeight: "800", letterSpacing: 0.2 },
  iconBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },

  tagline: { fontSize: 14, marginBottom: 8 },

  card: { borderRadius: 16, padding: 16, borderWidth: 1, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, marginTop: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  transcript: { marginTop: 6, fontSize: 15, lineHeight: 22 },

  actionsRow: { flexDirection: "row", gap: 10 },
  smallBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 12 },
  smallBtnText: { fontWeight: "700" },

  error: { marginTop: 10, textAlign: "center" },

  fabWrap: { position: "absolute", left: 0, right: 0, bottom: 28, alignItems: "center", justifyContent: "center" },
  fab: { width: 76, height: 76, borderRadius: 999, alignItems: "center", justifyContent: "center", elevation: 6 },
  pulseRing: { position: "absolute", width: 110, height: 110, borderRadius: 999 },
});
