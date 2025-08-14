import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.mainText}>KARL</Text>
      <Text style={styles.subText}>ETA STUDIO</Text>

      <Image
        source={require("../assets/images/KARLOGO.png")}
        style={styles.logoImage}
        resizeMode="contain"
      />

      <Pressable style={styles.button} onPress={() => router.push("/username")}>
        <Text style={styles.buttonText}>Lancer une partie</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#051934",
    alignItems: "center",
    justifyContent: "center",
  },
  mainText: {
    fontSize: 120,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 6,
    marginTop: 160,
    textShadowColor: "rgba(0, 0, 0, 0.7)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
  subText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 40,
    textShadowColor: "black",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  logo: {
    marginBottom: 10,
  },
  logoImage: {
    width: 180,
    height: 180,
    marginBottom: 80,
  },
  button: {
    backgroundColor: "black",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
