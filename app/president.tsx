import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
// @ts-ignore - composant JS sans définitions de types
import CardJS from "../components/card";
import {
  EngineEvent,
  PlayingCard,
  PresidentEngine,
  RANK_ORDER,
} from "../lib/presidentRules";

const Card = CardJS as React.ComponentType<any>;

/** crée une table avec l'utilisateur en premier, complétée par des bots. */
function makePlayers(
  usernameRaw: string | undefined,
  targetCount = 3
): string[] {
  const username = (usernameRaw || "Joueur").trim() || "Joueur";
  const bots = ["Axel", "Elias", "Tito", "KarlBot"];
  const names: string[] = [username];
  for (const b of bots) {
    if (names.length >= targetCount) break;
    if (!names.includes(b)) names.push(b);
  }
  return names;
}

// libellés “un/deux/trois/quatre”
function qtyLabel(n: number) {
  return n === 1 ? "un" : n === 2 ? "deux" : n === 3 ? "trois" : "quatre";
}
// texte simple pour l’historique (sans couleur ni symbole)
function formatHistoryLine(evt: EngineEvent): string {
  switch (evt.kind) {
    case "startTrick":
      return `— Nouveau pli — ${evt.starter} commence`;
    case "endTrick":
      return `Pli terminé — ${evt.nextStarter} commencera`;
    case "play": {
      const n = evt.cards.length;
      const v = evt.cards[0].value;
      return `${evt.player} joue ${qtyLabel(n)} ${v}`;
    }
    case "pass":
      if (evt.reason === "lock")
        return `${evt.player} passe son tour car il n'a pas cette carte`;
      if (evt.reason === "cantOpen") return `${evt.player} passe l'ouverture`;
      return `${evt.player} passe son tour`;
    case "fold":
      return `${evt.player} se couche`;
    case "lockSet":
      return `🔒 Verrou : ${evt.target} doit jouer ${evt.value}`;
    case "lockClear":
      return `🔓 Verrou levé`;
    case "cut":
      return `🔥 Carré de ${evt.value} — tas coupé`;
    case "two":
      return `🂢 ${evt.player} a joué un 2 — fin du pli`;
    case "forcedLast":
      return `${evt.player} perd (seul un 2 pour ouvrir)`;
  }
}

export default function PresidentScreen() {
  const { username } = useLocalSearchParams();
  const playerName = Array.isArray(username)
    ? username[0]
    : username ?? "Joueur";

  // === Table: utilisateur + IA ===
  const playerNames = useMemo(() => makePlayers(playerName, 3), [playerName]);
  const humanNames = useMemo(
    () => new Set<string>([playerNames[0]]),
    [playerNames]
  );

  // === Moteur ===
  const engineRef = useRef<PresidentEngine | null>(null);
  const [snap, setSnap] = useState(engineRef.current?.getSnapshot());
  const [selectedIdxs, setSelectedIdxs] = useState<number[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Historique “léger” (bandeau en haut)
  const [history, setHistory] = useState<EngineEvent[]>([]);
  // Animation d’arrivée des cartes
  const [animBatch, setAnimBatch] = useState<PlayingCard[]>([]);
  const animOpacity = useRef(new Animated.Value(0)).current;
  const animTranslate = useRef(new Animated.Value(10)).current;

  // init/reinit
  useEffect(() => {
    engineRef.current = new PresidentEngine(playerNames);
    // events initiaux
    const initial = engineRef.current.popEvents();
    setHistory((prev) => clampHistory([...prev, ...initial]));

    engineRef.current.advanceUntilHuman(humanNames);
    setSnap(engineRef.current.getSnapshot());
    enqueueEvents(engineRef.current.popEvents());

    setSelectedIdxs([]);
    setErrorMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerNames, humanNames]);

  const meIndex = useMemo(
    () =>
      !snap ? -1 : snap.players.findIndex((p) => p.name === playerNames[0]),
    [snap, playerNames]
  );
  const myTurn = useMemo(
    () => !!snap && meIndex >= 0 && snap.trick.currentIndex === meIndex,
    [snap, meIndex]
  );
  const myHand = useMemo<PlayingCard[]>(
    () => (!snap || meIndex < 0 ? [] : snap.players[meIndex].hand),
    [snap, meIndex]
  );

  // tri d’affichage (faible -> fort)
  const myHandSorted = useMemo(
    () =>
      myHand
        .slice()
        .sort(
          (a, b) => RANK_ORDER.indexOf(a.value) - RANK_ORDER.indexOf(b.value)
        ),
    [myHand]
  );
  // index trié -> index réel
  const sortedToOriginalIndex = useMemo(() => {
    const pairs = myHand.map((c, i) => ({ i, v: c.value, s: c.suit }));
    const sortedPairs = pairs
      .slice()
      .sort((a, b) => RANK_ORDER.indexOf(a.v) - RANK_ORDER.indexOf(b.v));
    return sortedPairs.map((p) => p.i);
  }, [myHand]);

  // pile condensée : dernières 5 cartes en éventail
  const pile = useMemo<PlayingCard[]>(() => snap?.trick.pile ?? [], [snap]);
  const visiblePile = useMemo(() => pile.slice(-5), [pile]);

  // --- Sélection ---
  function toggleSelect(idxSorted: number) {
    if (!myTurn) return;
    setErrorMsg(null);
    setSelectedIdxs((prev) =>
      prev.includes(idxSorted)
        ? prev.filter((i) => i !== idxSorted)
        : [...prev, idxSorted]
    );
  }

  // --- Actions humaines ---
  function onPlay() {
    const engine = engineRef.current;
    if (!engine || !snap || meIndex < 0 || !myTurn) return;

    const indicesReal = selectedIdxs
      .map((i) => sortedToOriginalIndex[i])
      .sort((a, b) => a - b);
    if (!indicesReal.length) {
      setErrorMsg("Sélection vide.");
      return;
    }

    const res = engine.humanPlay(indicesReal);
    const events = engine.popEvents();
    if (!res.ok) {
      setErrorMsg(res.error || "Coup invalide.");
      return;
    }

    // animer nos cartes
    animatePlaysFromEvents(events);
    setHistory((prev) => clampHistory([...prev, ...events]));
    setSelectedIdxs([]);

    engine.advanceUntilHuman(humanNames);
    setSnap(engine.getSnapshot());
    enqueueEvents(engine.popEvents());
  }

  function onPass() {
    const engine = engineRef.current;
    if (!engine || !snap || meIndex < 0 || !myTurn) return;
    const res = engine.humanPass();
    const events = engine.popEvents();
    if (!res.ok) {
      setErrorMsg(res.error || "Action impossible.");
      return;
    }
    setHistory((prev) => clampHistory([...prev, ...events]));

    engine.advanceUntilHuman(humanNames);
    setSnap(engine.getSnapshot());
    enqueueEvents(engine.popEvents());
  }

  function onFold() {
    const engine = engineRef.current;
    if (!engine || !snap || meIndex < 0 || !myTurn) return;
    const res = engine.humanFold();
    const events = engine.popEvents();
    if (!res.ok) {
      setErrorMsg(res.error || "Action impossible.");
      return;
    }
    setHistory((prev) => clampHistory([...prev, ...events]));

    engine.advanceUntilHuman(humanNames);
    setSnap(engine.getSnapshot());
    enqueueEvents(engine.popEvents());
  }

  // --- Animations & enchaînement d’événements IA ---
  function enqueueEvents(events: EngineEvent[]) {
    if (!events.length) return;
    // intervalle “clair” entre actions
    const base = 1200; // ms
    const jitter = 400;

    let delay = 0;
    events.forEach((e) => {
      setTimeout(() => {
        if (e.kind === "play") animatePlaysFromEvents([e]);
        setHistory((prev) => clampHistory([...prev, e]));
        // rafraîchir l’état pour que la pile reflète la progression
        if (engineRef.current) setSnap(engineRef.current.getSnapshot());
      }, delay);
      delay += base + Math.floor(Math.random() * jitter);
    });
  }

  function animatePlaysFromEvents(events: EngineEvent[]) {
    const batchCards = events
      .filter((e) => e.kind === "play")
      .flatMap((e) => (e as any).cards as PlayingCard[]);
    if (!batchCards.length) return;

    setAnimBatch(batchCards);
    animOpacity.setValue(0);
    animTranslate.setValue(8);
    Animated.parallel([
      Animated.timing(animOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(animTranslate, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setTimeout(() => setAnimBatch([]), 60));
  }

  function isPassEnabled(): boolean {
    if (!snap || meIndex < 0) return false;
    const tr = snap.trick;
    return !!(
      tr.lock?.active &&
      tr.lock.targetIndex === meIndex &&
      tr.patternCount !== null
    );
  }
  function isFoldEnabled(): boolean {
    if (!snap || meIndex < 0) return false;
    const tr = snap.trick;
    return tr.patternCount !== null;
  }

  const currentPlayerName =
    snap?.players[snap?.trick.currentIndex || 0]?.name ?? "";

  // Bandeau : on montre seulement les 3 derniers messages
  const historyLines = useMemo(() => {
    const last3 = history.slice(-3);
    return last3.map(formatHistoryLine);
  }, [history]);

  return (
    <View style={{ flex: 1, backgroundColor: "#021020" }}>
      {/* Bandeau supérieur compact : historique + indicateur de tour */}
      <View style={styles.topBar}>
        <View style={styles.historyCol}>
          {historyLines.map((line, i) => (
            <Text
              key={`h-${i}`}
              style={[
                styles.histText,
                i === historyLines.length - 1 && styles.histTextStrong,
              ]}
            >
              {line}
            </Text>
          ))}
        </View>
        <View style={styles.turnPill}>
          <Text style={styles.turnText}>
            À <Text style={styles.turnStrong}>{currentPlayerName}</Text> de
            jouer
          </Text>
        </View>
      </View>

      {/* Centre de table : pile condensée (5 dernières cartes), en éventail */}
      <View style={styles.tableCenter} pointerEvents="none">
        <View style={styles.compactPile}>
          {visiblePile.map((c, idx, arr) => {
            const offset = (idx - (arr.length - 1)) * 8; // petites translations
            return (
              <View
                key={`${c.suit}-${c.value}-${idx}-${pile.length}`}
                style={[
                  styles.compactCardWrap,
                  { top: -offset, left: -offset },
                ]}
              >
                <Card value={c.value} suit={c.suit} />
              </View>
            );
          })}
          {/* Overlay animé pour la dernière pose */}
          {animBatch.length > 0 && (
            <Animated.View
              style={{
                position: "absolute",
                flexDirection: "row",
                opacity: animOpacity,
                transform: [{ translateY: animTranslate }],
              }}
            >
              {animBatch.map((c, i) => (
                <View
                  key={`${c.suit}-${c.value}-anim-${i}`}
                  style={styles.compactCardWrap}
                >
                  <Card value={c.value} suit={c.suit} />
                </View>
              ))}
            </Animated.View>
          )}
        </View>
      </View>

      {/* Main & actions */}
      <View style={styles.bottom}>
        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <FlatList
          horizontal
          data={myHandSorted}
          keyExtractor={(item: PlayingCard, idx) =>
            `${item.suit}-${item.value}-${idx}`
          }
          contentContainerStyle={styles.handList}
          renderItem={({ item, index }) => {
            const selected = selectedIdxs.includes(index);
            return (
              <Pressable
                onPress={() => toggleSelect(index)}
                style={{ opacity: myTurn ? 1 : 0.7 }}
              >
                <Card
                  value={item.value}
                  suit={item.suit}
                  style={[styles.card, selected && styles.cardSelected]}
                />
              </Pressable>
            );
          }}
          showsHorizontalScrollIndicator={false}
        />

        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, !myTurn && styles.btnDisabled]}
            onPress={onPlay}
            disabled={!myTurn}
          >
            <Text style={styles.btnText}>Jouer</Text>
          </Pressable>

          {/* Passer (verrou) — clair et distinct */}
          <Pressable
            style={[
              styles.btnOutline,
              (!myTurn || !isPassEnabled()) && styles.btnDisabled,
            ]}
            onPress={onPass}
            disabled={!myTurn || !isPassEnabled()}
          >
            <Text style={styles.btnOutlineText}>Passer (verrou)</Text>
          </Pressable>

          {/* Se coucher — distinct visuellement */}
          <Pressable
            style={[
              styles.btnDanger,
              (!myTurn || !isFoldEnabled()) && styles.btnDisabled,
            ]}
            onPress={onFold}
            disabled={!myTurn || !isFoldEnabled()}
          >
            <Text style={styles.btnText}>Se coucher</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function clampHistory(h: EngineEvent[], max = 80) {
  if (h.length <= max) return h;
  return h.slice(h.length - max);
}

const styles = StyleSheet.create({
  // — top bar —
  topBar: {
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "#0b1c33",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyCol: { flex: 1, paddingRight: 8 },
  histText: { color: "#cde2ff", fontSize: 13, marginBottom: 2 },
  histTextStrong: { fontWeight: "700", color: "#ffffff" },
  turnPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
  },
  turnText: { color: "#cde2ff", fontSize: 12 },
  turnStrong: { fontWeight: "800", color: "#fff" },

  // centre de table
  tableCenter: {
    position: "absolute",
    top: "36%",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  compactPile: {
    width: 140,
    height: 190,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2,16,32,0.35)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  compactCardWrap: {
    position: "absolute",
    width: 130,
    height: 180,
    borderRadius: 8,
  },

  // bas
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#021020",
  },
  handList: { paddingVertical: 10, paddingHorizontal: 18 },
  card: { marginRight: 10 },
  cardSelected: {
    transform: [{ translateY: -10 }],
    borderWidth: 3,
    borderColor: "#42b0ff",
  },
  error: { color: "#ff7a7a", paddingHorizontal: 16, paddingTop: 8 },

  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btn: {
    backgroundColor: "#2f6df0",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnDanger: {
    backgroundColor: "#e94c4c",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnOutline: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#2f6df0",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700" },
  btnOutlineText: { color: "#cde2ff", fontWeight: "700" },
});
