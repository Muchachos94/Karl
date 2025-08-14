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
// @ts-ignore
import CardJS from "../components/card";
import {
  EngineEvent,
  PlayingCard,
  PresidentEngine,
  RANK_ORDER,
} from "../lib/presidentRules";

const Card = CardJS as React.ComponentType<any>;

/** table = utilisateur en premier + bots */
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

const ACTION_DELAY_MS = 1400; // ⏱️ plus lent entre chaque action

// ligne simple “française”
function formatLine(evt: EngineEvent): string {
  switch (evt.kind) {
    case "startTrick":
      return `Nouveau pli — ${evt.starter} commence`;
    case "endTrick":
      return `Pli terminé — ${evt.nextStarter} commencera`;
    case "play": {
      const n = evt.cards.length;
      const v = evt.cards[0].value;
      const qty =
        n === 1 ? "un" : n === 2 ? "deux" : n === 3 ? "trois" : "quatre";
      return `${evt.player} joue ${qty} ${v}`;
    }
    case "pass":
      return evt.reason === "lock"
        ? `${evt.player} passe (verrou)`
        : `${evt.player} passe l'ouverture`;
    case "fold":
      return `${evt.player} se couche`;
    case "lockSet":
      return `Verrou : ${evt.target} doit jouer ${evt.value}`;
    case "lockClear":
      return `Verrou levé`;
    case "cut":
      return `Carré de ${evt.value} — tas coupé`;
    case "two":
      return `${evt.player} joue un 2 — fin du pli`;
    case "forcedLast":
      return `${evt.player} perd (seul un 2 pour ouvrir)`;
    case "president":
      return `🎖️ ${evt.player} devient Président — partie terminée`;
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

  // Pile affichée (mise à jour via events)
  const [displayPile, setDisplayPile] = useState<PlayingCard[]>([]);
  // Une seule ligne de log
  const [lastLine, setLastLine] = useState<string>("");

  const [selectedIdxs, setSelectedIdxs] = useState<number[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false); // bloque les actions pendant la “relecture”

  // Overlay “carte jouée” / “passe” / “couché”
  const [overlay, setOverlay] = useState<{
    text: string;
    cards?: PlayingCard[];
  } | null>(null);
  const ovOpacity = useRef(new Animated.Value(0)).current;
  const ovScale = useRef(new Animated.Value(0.96)).current;

  // init/reinit
  useEffect(() => {
    const engine = new PresidentEngine(playerNames);
    engineRef.current = engine;

    engine.advanceUntilHuman(humanNames);
    const s = engine.getSnapshot();
    setSnap(s);
    setDisplayPile(s.trick.pile);
    const initEvents = engine.popEvents();
    const lastEvt = initEvents.slice(-1)[0];
    if (lastEvt) setLastLine(formatLine(lastEvt));

    setSelectedIdxs([]);
    setErrorMsg(null);
    setIsReplaying(false);
    setOverlay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerNames, humanNames]);

  const meIndex = useMemo(
    () =>
      !snap ? -1 : snap.players.findIndex((p) => p.name === playerNames[0]),
    [snap, playerNames]
  );
  const myTurn = useMemo(
    () =>
      !!snap &&
      !snap.ended &&
      meIndex >= 0 &&
      snap.trick.currentIndex === meIndex &&
      !isReplaying,
    [snap, meIndex, isReplaying]
  );
  const myHand = useMemo<PlayingCard[]>(
    () => (!snap || meIndex < 0 ? [] : snap.players[meIndex].hand),
    [snap, meIndex]
  );

  // ✅ myHandSorted est déclaré UNE SEULE fois
  const myHandSorted: PlayingCard[] = useMemo(
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

  // pile condensée : 5 dernières cartes
  const visiblePile = useMemo(() => displayPile.slice(-5), [displayPile]);

  // --- Helpers d’interface ---
  function toggleSelect(idxSorted: number) {
    if (!myTurn) return;
    setErrorMsg(null);
    setSelectedIdxs((prev) =>
      prev.includes(idxSorted)
        ? prev.filter((i) => i !== idxSorted)
        : [...prev, idxSorted]
    );
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

  // Overlay helpers
  function showOverlay(text: string, cards?: PlayingCard[]) {
    setOverlay({ text, cards });
    ovOpacity.setValue(0);
    ovScale.setValue(0.96);
    Animated.parallel([
      Animated.timing(ovOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ovScale, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(() => {
      Animated.timing(ovOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setOverlay(null));
    }, Math.max(600, ACTION_DELAY_MS - 300));
  }

  // --- Rejoue des évènements avec intervalle (et overlay lisible) ---
  function replayEventsWithDelay(events: EngineEvent[], done?: () => void) {
    if (!events.length) {
      done?.();
      return;
    }
    setIsReplaying(true);

    let i = 0;
    const step = () => {
      const e = events[i];
      const line = formatLine(e);
      setLastLine(line);

      if (e.kind === "play") {
        showOverlay(`${e.player} a joué`, e.cards);
        setDisplayPile((prev) => [...prev, ...e.cards]);
      } else if (e.kind === "pass") {
        showOverlay(`${e.player} a passé son tour`);
      } else if (e.kind === "fold") {
        showOverlay(`${e.player} s'est couché`);
      } else if (e.kind === "two" || e.kind === "cut") {
        showOverlay(line);
      } else if (e.kind === "endTrick") {
        setDisplayPile([]); // on vide à la fin du pli
      } else if (e.kind === "president") {
        showOverlay(`🎖️ ${e.player} est Président !`);
      }

      i++;
      if (i < events.length) {
        setTimeout(step, ACTION_DELAY_MS);
      } else {
        setIsReplaying(false);
        if (engineRef.current) setSnap(engineRef.current.getSnapshot());
        done?.();
      }
    };
    step();
  }

  // --- Actions humaines ---
  function onPlay() {
    const engine = engineRef.current;
    if (!engine || !snap || snap.ended || meIndex < 0 || !myTurn) return;

    const indicesReal = selectedIdxs
      .map((i) => sortedToOriginalIndex[i])
      .sort((a, b) => a - b);
    if (!indicesReal.length) {
      setErrorMsg("Sélection vide.");
      return;
    }

    const res = engine.humanPlay(indicesReal);
    let events = engine.popEvents();
    if (!res.ok) {
      setErrorMsg(res.error || "Coup invalide.");
      return;
    }
    setSelectedIdxs([]);

    engine.advanceUntilHuman(humanNames);
    events = events.concat(engine.popEvents());
    replayEventsWithDelay(events);
  }

  function onPass() {
    const engine = engineRef.current;
    if (!engine || !snap || snap.ended || meIndex < 0 || !myTurn) return;
    const res = engine.humanPass();
    let events = engine.popEvents();
    if (!res.ok) {
      setErrorMsg(res.error || "Action impossible.");
      return;
    }

    engine.advanceUntilHuman(humanNames);
    events = events.concat(engine.popEvents());
    replayEventsWithDelay(events);
  }

  function onFold() {
    const engine = engineRef.current;
    if (!engine || !snap || snap.ended || meIndex < 0 || !myTurn) return;
    const res = engine.humanFold();
    let events = engine.popEvents();
    if (!res.ok) {
      setErrorMsg(res.error || "Action impossible.");
      return;
    }

    engine.advanceUntilHuman(humanNames);
    events = events.concat(engine.popEvents());
    replayEventsWithDelay(events);
  }

  const currentPlayerName =
    snap?.players[snap?.trick.currentIndex || 0]?.name ?? "";

  return (
    <View style={{ flex: 1, backgroundColor: "#021020" }}>
      {/* Bandeau compact : dernière info + tour */}
      <View style={styles.topBar}>
        <Text style={styles.histText} numberOfLines={1} ellipsizeMode="tail">
          {lastLine || "Prêt"}
        </Text>
        <View style={styles.turnPill}>
          <Text style={styles.turnText}>
            {snap?.ended ? (
              "Partie terminée"
            ) : (
              <>
                À <Text style={styles.turnStrong}>{currentPlayerName}</Text> de
                jouer
              </>
            )}
          </Text>
        </View>
      </View>

      {/* Centre de table : pile épurée (5 dernières cartes), sans contour */}
      <View style={styles.tableCenter} pointerEvents="none">
        <View style={styles.compactPile}>
          {visiblePile.map((c, idx, arr) => {
            const offset = (idx - (arr.length - 1)) * 8; // petit éventail
            return (
              <View
                key={`${c.suit}-${c.value}-${idx}-${displayPile.length}`}
                style={[
                  styles.compactCardWrap,
                  { top: -offset, left: -offset },
                ]}
              >
                <Card value={c.value} suit={c.suit} />
              </View>
            );
          })}
        </View>
      </View>

      {/* Overlay “gros visuel” action en cours */}
      {overlay && (
        <Animated.View
          style={[
            styles.overlay,
            { opacity: ovOpacity, transform: [{ scale: ovScale }] },
          ]}
        >
          <Text style={styles.overlayText}>{overlay.text}</Text>
          {overlay.cards && (
            <View style={styles.overlayCards}>
              {overlay.cards.map((c, i) => (
                <View
                  key={`${c.suit}-${c.value}-ov-${i}`}
                  style={{ marginHorizontal: 6 }}
                >
                  <Card value={c.value} suit={c.suit} />
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      )}

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
            style={[styles.btn, (!myTurn || snap?.ended) && styles.btnDisabled]}
            onPress={onPlay}
            disabled={!myTurn || !!snap?.ended}
          >
            <Text style={styles.btnText}>Jouer</Text>
          </Pressable>

          {/* Passer (verrou) */}
          <Pressable
            style={[
              styles.btnOutline,
              (!myTurn || !isPassEnabled() || !!snap?.ended) &&
                styles.btnDisabled,
            ]}
            onPress={onPass}
            disabled={!myTurn || !isPassEnabled() || !!snap?.ended}
          >
            <Text style={styles.btnOutlineText}>Passer (verrou)</Text>
          </Pressable>

          {/* Se coucher */}
          <Pressable
            style={[
              styles.btnDanger,
              (!myTurn || !isFoldEnabled() || !!snap?.ended) &&
                styles.btnDisabled,
            ]}
            onPress={onFold}
            disabled={!myTurn || !isFoldEnabled() || !!snap?.ended}
          >
            <Text style={styles.btnText}>Se coucher</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
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
  histText: { color: "#cde2ff", fontSize: 13, flex: 1, marginRight: 10 },
  turnPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
  },
  turnText: { color: "#cde2ff", fontSize: 12 },
  turnStrong: { fontWeight: "800", color: "#fff" },

  // centre de table — épuré (pas de fond ni bordure visibles)
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
  },
  compactCardWrap: {
    position: "absolute",
    width: 130,
    height: 180,
    borderRadius: 8,
  },

  // overlay
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 140,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: 16,
  },
  overlayText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  overlayCards: { flexDirection: "row", alignItems: "center" },

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
