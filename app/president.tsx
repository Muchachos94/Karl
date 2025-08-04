import Card from '@/components/card';
import { StyleSheet, Text, View } from 'react-native';


export default function PartieScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Jeu du Président 🃏</Text>
      <Card value="5" suit="spade" style={styles.card} />
      {/* On ajoutera ici les composants : cartes, joueurs, etc. */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#021020',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },

  card: {
    marginTop: 30,
  }
});