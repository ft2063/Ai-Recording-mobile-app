// app/(tabs)/library.tsx
import * as React from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, TextInput, Pressable, Modal
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./theme";

const SERVER = "http://192.168.1.212:3001";

type NoteBase = { id: string; title?: string | null; keyPoints: string; createdAt: string };
type SearchHit = NoteBase & { snippet?: string; score?: number };
type Item = NoteBase;

export default function LibraryScreen() {
  const router = useRouter();
  const { name: theme, T, toggle } = useTheme();

  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [results, setResults] = React.useState<SearchHit[]>([]);
  const [answer, setAnswer] = React.useState<string>("");

  // NEW: selected note for modal
  const [selected, setSelected] = React.useState<SearchHit | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SERVER}/library`);
        if (!res.ok) throw new Error(await res.text());
        setItems(await res.json());
      } catch (e: any) { setError(e?.message || String(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  async function doSearch() {
    if (!q.trim()) return;
    setSearching(true);
    setAnswer("");
    try {
      const res = await fetch(`${SERVER}/search?q=${encodeURIComponent(q)}&k=5`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults((data.results || []).map((r: any) => ({
        id: r.id,
        score: r.score,
        keyPoints: r.keyPoints,
        snippet: r.snippet,
        createdAt: r.createdAt,
        title: r.meta?.title ?? null,
      })));
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setSearching(false); }
  }

  async function doAsk() {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${SERVER}/answer?q=${encodeURIComponent(q)}&k=5`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAnswer(data.answer || "");
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setSearching(false); }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString();

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? T.iconBgPressed : T.iconBg, borderColor: T.border }]}
        >
          <Ionicons name="chevron-back" size={20} color={T.text} />
        </Pressable>

        

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={toggle}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? T.iconBgPressed : T.iconBg, borderColor: T.border }]}
          >
            {theme === "light" ? <Ionicons name="moon-outline" size={18} color={T.text} /> : <Ionicons name="sunny-outline" size={18} color={T.text} />}
          </Pressable>
        </View>
      </View>

      {/* Search / Ask */}
      <View style={{ width: "100%", marginBottom: 12 }}>
        <TextInput
          placeholder="Search or ask a question…"
          placeholderTextColor={T.sub}
          value={q}
          onChangeText={setQ}
          style={[styles.input, { borderColor: T.border, backgroundColor: T.card, color: T.text }]}
        />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <TouchableOpacity onPress={doSearch} style={[styles.btn, { backgroundColor: "#1e90ff", flex: 1 }]}>
            <Text style={styles.btnText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={doAsk} style={[styles.btn, { backgroundColor: "#333", flex: 1 }]}>
            <Text style={styles.btnText}>Ask (RAG)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {searching && <ActivityIndicator size="large" style={{ marginBottom: 12 }} />}

      {!!answer && (
        <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
          <Text style={[styles.cardTitle, { color: T.text }]}>Answer</Text>
          <Text style={{ color: T.text }}>{answer}</Text>
        </View>
      )}

      {!!error && <Text style={{ color: theme === "light" ? "tomato" : "#fca5a5" }}>{error}</Text>}

      <ScrollView style={{ width: "100%" }} contentContainerStyle={{ paddingBottom: 24 }}>
        {!q.trim() ? (
          <>
            <Text style={[styles.sectionTitle, { color: T.text }]}>All Items</Text>
            {loading ? (
              <ActivityIndicator size="large" style={{ marginTop: 16 }} />
            ) : items.length === 0 ? (
              <Text style={{ textAlign: "center", marginTop: 16, color: T.sub }}>No items yet.</Text>
            ) : (
              items.map((it) => (
                <Pressable
                  key={it.id}
                  onPress={() => setSelected({ ...it })}
                  style={({ pressed }) => [
                    styles.itemCard,
                    { backgroundColor: T.card, borderColor: T.border, opacity: pressed ? 0.9 : 1 }
                  ]}
                >
                  <Text style={[styles.itemTitle, { color: T.text }]}>
                    {it.title || "(untitled)"} · {formatDate(it.createdAt)}
                  </Text>
                  <Text style={[styles.itemBody, { color: T.text }]} numberOfLines={3}>
                    {it.keyPoints || "(no key points)"}
                  </Text>
                </Pressable>
              ))
            )}
          </>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Search Results</Text>
            {results.length === 0 ? (
              <Text style={{ textAlign: "center", marginTop: 16, color: T.sub }}>No matches.</Text>
            ) : (
              results.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setSelected(r)}
                  style={({ pressed }) => [
                    styles.itemCard,
                    { backgroundColor: T.card, borderColor: T.border, opacity: pressed ? 0.9 : 1 }
                  ]}
                >
                  <Text style={[styles.itemTitle, { color: T.text }]}>
                    {r.title || "(untitled)"} · {formatDate(r.createdAt)} · Score {r.score?.toFixed(3) ?? "-"}
                  </Text>
                  <Text style={[styles.itemBody, { color: T.text, marginBottom: 6 }]} numberOfLines={3}>
                    {r.keyPoints || "(no key points)"}
                  </Text>
                  {!!r.snippet && <Text style={{ color: T.sub }} numberOfLines={2}>{r.snippet}</Text>}
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Simple Modal Card */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={[styles.backdrop]} onPress={() => setSelected(null)}>
          {/* stop propagation so inner presses don't close */}
          <Pressable style={[styles.modalCard, { backgroundColor: T.card, borderColor: T.border }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>
                {selected?.title || "(untitled)"}
              </Text>
              <Pressable onPress={() => setSelected(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={T.text} />
              </Pressable>
            </View>
            {!!selected?.createdAt && (
              <Text style={{ color: T.sub, marginBottom: 10 }}>{formatDate(selected.createdAt)}</Text>
            )}
            <Text style={{ color: T.text }}>{selected?.keyPoints || "(no key points)"}</Text>
            {!!selected?.snippet && (
              <>
                <View style={{ height: 10 }} />
                <Text style={{ color: T.sub }}>{selected?.snippet}</Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 48 },
  header: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "800" },

  iconBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },

  input: { borderWidth: 1, borderRadius: 10, padding: 10 },

  btn: { paddingVertical: 12, alignItems: "center", borderRadius: 10 },
  btnText: { color: "#fff", fontWeight: "700" },

  sectionTitle: { marginTop: 8, marginBottom: 6, fontWeight: "800" },

  card: { padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 12 },
  cardTitle: { fontWeight: "800", marginBottom: 6 },

  itemCard: { padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 10 },
  itemTitle: { fontWeight: "700" },
  itemBody: { marginTop: 6 },

  // Modal styles
 
  
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  modalTitle: { fontSize: 18, fontWeight: "800", flex: 1, paddingRight: 8 },
  closeBtn: { padding: 6, borderRadius: 8 },
  // Modal styles
backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)", // darker dim (was 0.35)
    justifyContent: "center",
    alignItems: "center", // center card perfectly
    padding: 20,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    maxHeight: "75%",
    width: "100%", // optional: fixed width, or "90%" for breathing room
    maxWidth: 500, // optional for tablets
  },
  
});
