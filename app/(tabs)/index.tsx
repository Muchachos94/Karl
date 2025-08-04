import LogoKarleta from '@/components/logokarleta'; // <-- on importe ton composant
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LogoKarleta style={styles.logo} /> {/* <-- on remplace le titre KARL */}

      <Image
        source={require('@/assets/images/KARLOGO.png')}
        style={styles.logoImage}
        resizeMode="contain"
      />
      
      <Pressable style={styles.button} onPress={() => router.push('/president')}>
        <Text style={styles.buttonText}>Lancer une partie</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#051934',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    marginBottom: 10,
  },
  logoImage: {
    width: 180,
    height: 180,
    marginBottom: 30,
  },
  button: {
    backgroundColor: 'black',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});