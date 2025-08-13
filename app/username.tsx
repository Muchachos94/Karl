import LogoKarleta from '@/components/LogoKarleta';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

export default function UsernameScreen() {
  const [username, setUsername] = useState('');
  const router = useRouter();

  const handleStart = () => {
    if (username.trim() !== '') {
      router.push(`/president?username=${encodeURIComponent(username)}`);
    }
  };

  return (
    <View style={styles.container}>

     <LogoKarleta style={styles.logo} />

    <Image
        source={require('@/assets/images/karlname.png')}
        style={styles.playerImage}
        resizeMode="contain"
      />

     <View style={styles.inputContainer}>
      <TextInput
        placeholder="Ton pseudo*"
        placeholderTextColor="white"
        value={username}
        onChangeText={setUsername}
        style={styles.input}
      />
      <Pressable style={styles.button} onPress={handleStart}>
        <MaterialIcons name="arrow-forward-ios" size={32} color="black" />
      </Pressable>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#051934',
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 120, 
  },
  logo: {
    marginBottom: 40,
  },
  playerImage: {
    width: 301,
    height: 301,
    marginBottom: -40, // 👉 chevauche le conteneur en-dessous
    zIndex: 0,
    right: 0,

  },
  inputContainer: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap : 15,
  },
  input: {
    backgroundColor: "#364B66",
    paddingHorizontal: 20,
    paddingVertical: 10,
    width: 272,
    height: 68,
    borderRadius: 20,
    color: 'white',
    letterSpacing: 1.2,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: "#364B66",
    height: 68,
    width: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
});