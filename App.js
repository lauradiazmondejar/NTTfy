import React, { useState, useContext, createContext, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity,
  TextInput, Image, ActivityIndicator, Modal, Pressable, ScrollView,
  StatusBar, Appearance
} from 'react-native';

// --- DEPENDENCIAS NATIVAS ---
// (Debes instalarlas: npx expo install ...)
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

// --- ICONOS NATIVOS ---
// (Debes instalarlos: npm install lucide-react-native)
import {
  Home, Search, Music, User, Play, Pause, SkipForward, SkipBack, Sun, Moon,
  X, LogIn, CreditCard, ListPlus, Loader2, ChevronLeft, Plus, LogOut,
  Trash2, CheckCircle, FileText
} from 'lucide-react-native';

// --- CONSTANTES DE COLOR (Mapeo de Tailwind) ---
const colors = {
  blue600: '#2563eb',
  blue400: '#60a5fa',
  blue700: '#1d4ed8',
  blue900: '#1e3a8a',
  blue100: '#dbeafe',
  blue200: '#bfdbfe',
  blue300: '#93c5fd',
  blue800: '#1e40af',
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3b0',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  red500: '#ef4444',
  red100: '#fee2e2',
  red600: '#dc2626',
  red900: '#7f1d1d',
  green500: '#22c55e',
  green600: '#16a34a',
  green700: '#15803d',
  transparent: 'transparent',
};

// --- FUNCIÓN HELPER ---
const normalizeSong = (apiTrack) => ({
  id: apiTrack.id,
  title: apiTrack.title_short,
  artist: apiTrack.artist.name,
  albumArtUrl: apiTrack.album.cover_medium,
  audioUrl: apiTrack.preview,
});

const shuffleArray = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

const formatTime = (timeInSeconds) => {
  if (isNaN(timeInSeconds) || timeInSeconds < 0) return '0:00';
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

// --- 1. CONTEXTO DE TEMA ---
const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(Appearance.getColorScheme() || 'light');
  const [isThemeLoading, setIsThemeLoading] = useState(true);

  // Cargar tema guardado
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('nttfy-theme');
        if (savedTheme) {
          setTheme(savedTheme);
        }
      } catch (e) { console.error(e); }
      setIsThemeLoading(false);
    };
    loadTheme();
  }, []);

  // Guardar tema
  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem('nttfy-theme', newTheme);
    } catch (e) { console.error(e); }
  };

  if (isThemeLoading) {
    return null; // O un loader
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const useTheme = () => useContext(ThemeContext);

// --- 2. CONTEXTO DEL REPRODUCTOR (Traducido a expo-av) ---
const PlayerContext = createContext();

const PlayerProvider = ({ children }) => {
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playlist, setPlaylist] = useState([]);
  const soundRef = useRef(new Audio.Sound());

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setProgress(status.positionMillis / 1000);
      setDuration(status.durationMillis / 1000);
      if (status.didJustFinish) {
        playNext();
      }
    }
  };

  const playSong = async (song, newPlaylist) => {
    if (newPlaylist) {
      setPlaylist(newPlaylist);
    }
    
    try {
      if (currentSong && currentSong.id === song.id) {
        togglePlay();
        return;
      }
      
      // Detener y descargar sonido anterior
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      }

      // Cargar y reproducir nuevo sonido
      setCurrentSong(song);
      setIsPlaying(true);
      await soundRef.current.loadAsync({ uri: song.audioUrl }, { shouldPlay: true });
      soundRef.current.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
      
    } catch (error) {
      console.error('Error en playSong:', error);
      setIsPlaying(false);
      setCurrentSong(null);
    }
  };

  const togglePlay = async () => {
    if (!currentSong) return;
    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (error) { console.error('Error en togglePlay:', error); }
  };

  const playNext = () => {
    if (!currentSong || playlist.length === 0) return;
    const currentIndex = playlist.findIndex((s) => s.id === currentSong.id);
    if (currentIndex === -1) { playSong(playlist[0], playlist); return; }
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(playlist[nextIndex]);
  };

  const playPrev = () => {
    if (!currentSong || playlist.length === 0) return;
    const currentIndex = playlist.findIndex((s) => s.id === currentSong.id);
    if (currentIndex === -1) { playSong(playlist[0], playlist); return; }
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[prevIndex]);
  };

  const seekTo = async (time) => {
    if (soundRef.current) {
      try {
        await soundRef.current.setPositionAsync(time * 1000);
        setProgress(time);
      } catch (error) { console.error('Error en seekTo:', error); }
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentSong, isPlaying, playSong, togglePlay,
        playNext, playPrev, progress, duration, formatTime, seekTo,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

const usePlayer = () => useContext(PlayerContext);

// --- 3. CONTEXTO DE PLAYLISTS (Traducido a AsyncStorage) ---
const PlaylistContext = createContext();

const PlaylistProvider = ({ children }) => {
  const [playlists, setPlaylists] = useState(null); // Empezar nulo
  const [modalOpen, setModalOpen] = useState(false);
  const [songToAdd, setSongToAdd] = useState(null);

  // Cargar playlists
  useEffect(() => {
    const loadPlaylists = async () => {
      let savedPlaylists = null;
      try {
        const jsonValue = await AsyncStorage.getItem('nttfy-playlists');
        savedPlaylists = jsonValue != null ? JSON.parse(jsonValue) : null;
      } catch (e) { console.error(e); }

      if (savedPlaylists) {
        setPlaylists(savedPlaylists);
      } else {
        setPlaylists({ 'Mis Favoritas': [], 'Para Entrenar': [] });
      }
    };
    loadPlaylists();
  }, []);
  
  // Guardar playlists
  useEffect(() => {
    const savePlaylists = async () => {
      if (playlists === null) return; // No guardar si aún no se han cargado
      try {
        const jsonValue = JSON.stringify(playlists);
        await AsyncStorage.setItem('nttfy-playlists', jsonValue);
      } catch (e) { console.error(e); }
    };
    savePlaylists();
  }, [playlists]);
  
  const openPlaylistModal = (song) => { setSongToAdd(song); setModalOpen(true); };
  const closePlaylistModal = () => { setModalOpen(false); setSongToAdd(null); };

  const createPlaylist = (name) => {
    if (name && playlists && !playlists[name]) {
      setPlaylists((prev) => ({ ...prev, [name]: [] }));
      return true;
    } return false;
  };

  const addSongToPlaylist = (playlistName, song) => {
    if (!playlists || !playlists[playlistName] || playlists[playlistName].find(s => s.id === song.id)) {
      return;
    }
    setPlaylists((prev) => ({
      ...prev,
      [playlistName]: [...prev[playlistName], song],
    }));
  };
  
  const deletePlaylist = (playlistName) => {
    setPlaylists(prev => {
      const newPlaylists = { ...prev };
      delete newPlaylists[playlistName];
      return newPlaylists;
    });
  };

  const removeSongFromPlaylist = (playlistName, songId) => {
    if (!playlists || !playlists[playlistName]) return;
    setPlaylists(prev => ({
      ...prev,
      [playlistName]: prev[playlistName].filter(song => song.id !== songId)
    }));
  };

  // No renderizar hijos hasta que las playlists se carguen
  if (playlists === null) {
    return null; // O un loader
  }

  return (
    <PlaylistContext.Provider
      value={{
        playlists, createPlaylist, addSongToPlaylist, deletePlaylist,
        removeSongFromPlaylist, modalOpen, songToAdd,
        openPlaylistModal, closePlaylistModal,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  );
};

const usePlaylists = () => useContext(PlaylistContext);

// --- 4. CONTEXTO DE NOTIFICACIONES (TOAST) ---
const ToastContext = createContext();

const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null); // Solo un toast a la vez

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => {
      setToast(null);
    }, 2500);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <CheckCircle size={20} color={colors.white} style={{ marginRight: 8 }} />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
};

const useToast = () => useContext(ToastContext);

// --- 5. CONTEXTO DE LETRAS ---
const LyricsContext = createContext();

const LyricsProvider = ({ children }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSongInfo, setCurrentSongInfo] = useState(null);

  const openLyricsModal = async (song) => {
    if (!song) return;
    setModalOpen(true);
    setCurrentSongInfo(song);
    setIsLoading(true); setLyrics('');
    try {
      const response = await fetch(`https://corsproxy.io/?https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist)}/${encodeURIComponent(song.title)}`);
      if (!response.ok) throw new Error('Letra no encontrada');
      const data = await response.json();
      setLyrics(data.lyrics || 'Letra no encontrada.');
    } catch (err) {
      console.error(err);
      setLyrics('Letra no encontrada o error al cargar.');
    }
    setIsLoading(false);
  };

  const closeLyricsModal = () => {
    setModalOpen(false); setLyrics(''); setCurrentSongInfo(null);
  };

  return (
    <LyricsContext.Provider
      value={{
        modalOpen, lyrics, isLoading,
        currentSongInfo, openLyricsModal, closeLyricsModal,
      }}
    >
      {children}
    </LyricsContext.Provider>
  );
};

const useLyrics = () => useContext(LyricsContext);

// --- 6. PANTALLAS ---

// --- Pantalla de Splash ---
const SplashScreen = () => {
  return (
    <View style={styles.splashContainer}>
      <Text style={[styles.splashText, { fontFamily: 'Poppins_700Bold' }]}>
        NTTfy
      </Text>
    </View>
  );
};

// --- Pantalla de Login ---
const LoginScreen = ({ onLogin }) => {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (email === 'user@test.com' && password === '123456') {
      onLogin();
    } else {
      setError('Email o contraseña incorrectos (Usa: user@test.com / 123456)');
    }
  };

  const dynamic = s(theme); // Estilos dinámicos

  return (
    <View style={[styles.flexGrow, dynamic.bgGray100, styles.center, { padding: 24 }]}>
      <Text style={[styles.loginTitle, dynamic.textBlue600, { fontFamily: 'Poppins_700Bold' }]}>
        NTTfy
      </Text>
      <View style={[styles.loginForm, dynamic.bgWhite]}>
        <Text style={[styles.loginFormTitle, dynamic.textGray800]}>
          Iniciar Sesión
        </Text>
        {error && <Text style={styles.loginError}>{error}</Text>}
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.label, dynamic.textGray700]}>Email</Text>
          <TextInput
            value={email} onChangeText={setEmail}
            style={[styles.input, dynamic.bgWhite, dynamic.textGray900, dynamic.borderGray300]}
            placeholder="user@test.com"
            placeholderTextColor={colors.gray400}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        <View style={{ marginBottom: 24 }}>
          <Text style={[styles.label, dynamic.textGray700]}>Contraseña</Text>
          <TextInput
            value={password} onChangeText={setPassword}
            style={[styles.input, dynamic.bgWhite, dynamic.textGray900, dynamic.borderGray300]}
            placeholder="123456"
            placeholderTextColor={colors.gray400}
            secureTextEntry
          />
        </View>
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <LogIn color={colors.white} size={20} style={{ marginRight: 8 }} />
          <Text style={styles.loginButtonText}>Entrar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// --- Componente de Canción ---
const SongItem = ({ song, playlist, onAddClick, onRemoveClick }) => {
  const { theme } = useTheme();
  const { playSong, currentSong, isPlaying } = usePlayer();
  const isActive = currentSong && currentSong.id === song.id;
  const dynamic = s(theme);

  return (
    <Pressable
      onPress={() => playSong(song, playlist)}
      style={({ pressed }) => [
        styles.songItem,
        isActive ? dynamic.bgBlue100 : (pressed ? dynamic.bgGray100 : dynamic.transparent)
      ]}
    >
      <Image source={{ uri: song.albumArtUrl }} style={styles.songItemImage} />
      <View style={styles.songItemTextContainer}>
        <Text style={[styles.songItemTitle, isActive ? dynamic.textBlue600 : dynamic.textGray900]} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={[styles.songItemArtist, isActive ? dynamic.textBlue500 : dynamic.textGray600]} numberOfLines={1}>
          {song.artist}
        </Text>
      </View>
      
      {onRemoveClick && (
         <TouchableOpacity 
           onPress={(e) => { e.stopPropagation(); onRemoveClick(); }}
           style={styles.songItemButton}
         >
           <Trash2 size={18} color={colors.red500} />
         </TouchableOpacity>
      )}

      {onAddClick && (
         <TouchableOpacity 
           onPress={(e) => { e.stopPropagation(); onAddClick(); }}
           style={styles.songItemButton}
         >
           <ListPlus size={20} color={dynamic.textGray600.color} />
         </TouchableOpacity>
      )}
      
      {isActive && (
        <View style={{ marginLeft: 8 }}>
          {isPlaying ? <Pause size={20} color={colors.blue600} /> : <Play size={20} color={colors.blue600} />}
        </View>
      )}
    </Pressable>
  );
};

// --- Pantalla de Inicio ---
const HomeScreen = ({ onSubscribeClick }) => {
  const { theme } = useTheme();
  const [homeSongs, setHomeSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { openPlaylistModal } = usePlaylists();
  const dynamic = s(theme);

  useEffect(() => {
    const fetchHomeSongs = async () => {
      setIsLoading(true); setError(null);
      try {
        const artists = ['bruno mars', 'the weeknd', 'travis scott', 'coldplay'];
        const fetchPromises = artists.map(artist => 
          fetch(`https://corsproxy.io/?https://api.deezer.com/search?q=${encodeURIComponent(artist)}&limit=4`)
            .then(res => res.ok ? res.json() : Promise.reject(`Error buscando a ${artist}`))
        );
        const results = await Promise.all(fetchPromises);
        const allApiTracks = results.flatMap(result => result.data || []);
        const normalizedSongs = allApiTracks.filter(track => track.preview).map(normalizeSong);
        setHomeSongs(shuffleArray(normalizedSongs));
      } catch (err) { console.error(err); setError(err.message); }
      setIsLoading(false);
    };
    fetchHomeSongs();
  }, []);

  return (
    <ScrollView style={styles.screenContainer}>
      <Text style={[styles.screenTitle, dynamic.textGray900]}>Inicio</Text>
      <TouchableOpacity onPress={onSubscribeClick} style={styles.subscribeButton}>
        <CreditCard color={colors.white} style={{ marginRight: 8 }} />
        <Text style={styles.subscribeButtonText}>¡Suscríbete ahora!</Text>
      </TouchableOpacity>
      <Text style={[styles.screenSubtitle, dynamic.textGray800]}>Artistas Solicitados</Text>
      <View style={{ paddingBottom: 16 }}>
        {isLoading && <ActivityIndicator size="large" color={colors.blue600} style={{ marginTop: 32 }} />}
        {error && <Text style={styles.errorText}>{error}</Text>}
        {!isLoading && !error && homeSongs.map((song) => (
          <SongItem key={song.id} song={song} playlist={homeSongs} onAddClick={() => openPlaylistModal(song)} />
        ))}
      </View>
    </ScrollView>
  );
};

// --- Pantalla de Búsqueda ---
const SearchScreen = () => {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { openPlaylistModal } = usePlaylists();
  const dynamic = s(theme);

  const handleSearch = async () => {
    if (query.trim() === '') return;
    setIsLoading(true); setHasSearched(true); setResults([]);
    try {
      const response = await fetch(`https://corsproxy.io/?https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=15`);
      if (!response.ok) throw new Error('Error en la búsqueda');
      const data = await response.json();
      const songsWithPreview = data.data.filter(track => track.preview);
      setResults(songsWithPreview.map(normalizeSong));
    } catch (err) { console.error(err); }
    setIsLoading(false);
  };

  return (
    <View style={[styles.screenContainer, { flex: 1 }]}>
      <Text style={[styles.screenTitle, dynamic.textGray900]}>Buscar</Text>
      <View style={styles.searchBarContainer}>
        <TextInput
          value={query} onChangeText={setQuery}
          placeholder="Busca canciones o artistas..."
          placeholderTextColor={colors.gray400}
          style={[styles.searchInput, dynamic.bgWhite, dynamic.textGray900, dynamic.borderGray300]}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={handleSearch} style={styles.searchBarButton}>
          <Search size={20} color={colors.gray400} />
        </TouchableOpacity>
      </View>
      
      {isLoading && <ActivityIndicator size="large" color={colors.blue600} style={{ marginTop: 32 }} />}
      
      {!isLoading && hasSearched && results.length === 0 && (
        <Text style={[styles.centerText, dynamic.textGray600]}>No se encontraron resultados para "{query}".</Text>
      )}

      {!isLoading && results.length > 0 && (
        <ScrollView>
          {results.map((song) => (
            <SongItem key={song.id} song={song} playlist={results} onAddClick={() => openPlaylistModal(song)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

// --- Pantalla de Playlists ---
const PlaylistScreen = () => {
  const { theme } = useTheme();
  const { playlists, createPlaylist, deletePlaylist, removeSongFromPlaylist } = usePlaylists();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [view, setView] = useState('list'); 
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const dynamic = s(theme);

  const handleCreate = () => {
    if (newPlaylistName.trim() !== '') {
      if (createPlaylist(newPlaylistName.trim())) {
        setNewPlaylistName('');
      } else { console.error('La lista ya existe'); }
    }
  };

  if (view === 'list') {
    return (
      <View style={styles.screenContainer}>
        <Text style={[styles.screenTitle, dynamic.textGray900]}>Mis Listas</Text>
        <View style={styles.playlistCreateContainer}>
          <TextInput
            value={newPlaylistName} onChangeText={setNewPlaylistName}
            placeholder="Nombre de la nueva lista..."
            placeholderTextColor={colors.gray400}
            style={[styles.input, dynamic.bgWhite, dynamic.textGray900, dynamic.borderGray300, { flex: 1, marginRight: 8 }]}
          />
          <TouchableOpacity onPress={handleCreate} style={styles.playlistCreateButton}>
            <Plus size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
        <ScrollView>
          {Object.keys(playlists).map((name) => (
            <Pressable
              key={name}
              style={({ pressed }) => [
                styles.playlistItem, 
                dynamic.bgGray100, 
                pressed && dynamic.bgGray200
              ]}
              onPress={() => { setSelectedPlaylist(name); setView('songs'); }}
            >
              <View style={styles.flexRow}>
                <Music color={colors.blue600} style={{ marginRight: 12 }} />
                <View>
                  <Text style={[styles.playlistName, dynamic.textGray800]}>{name}</Text>
                  <Text style={[styles.playlistCount, dynamic.textGray500]}>{playlists[name].length} canciones</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); deletePlaylist(name); }}
                style={styles.songItemButton}
              >
                <Trash2 size={18} color={colors.red500} />
              </TouchableOpacity>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }
  
  if (view === 'songs') {
    const songsInPlaylist = playlists[selectedPlaylist] || [];
    return (
      <View style={styles.screenContainer}>
        <TouchableOpacity onPress={() => setView('list')} style={[styles.flexRow, { marginBottom: 12, alignItems: 'center' }]}>
          <ChevronLeft size={20} color={colors.blue600} />
          <Text style={{ color: colors.blue600 }}>Volver a mis listas</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, dynamic.textGray900]}>{selectedPlaylist}</Text>
        <ScrollView>
          {songsInPlaylist.length === 0 ? (
            <Text style={[styles.centerText, dynamic.textGray600]}>Esta lista está vacía.</Text>
          ) : (
            songsInPlaylist.map(song => (
              <SongItem
                key={song.id}
                song={song}
                playlist={songsInPlaylist}
                onRemoveClick={() => removeSongFromPlaylist(selectedPlaylist, song.id)}
              />
            ))
          )}
        </ScrollView>
      </View>
    );
  }
};

// --- Pantalla de Suscripción ---
const SubscribeScreen = ({ onBack }) => {
  const { theme } = useTheme();
  const dynamic = s(theme);

  return (
    <View style={styles.screenContainer}>
      <TouchableOpacity onPress={onBack} style={[styles.flexRow, { marginBottom: 16, alignItems: 'center' }]}>
        <X size={20} color={colors.blue600} style={{ marginRight: 4 }} />
        <Text style={{ color: colors.blue600 }}>Cerrar</Text>
      </TouchableOpacity>
      <View style={[styles.subscribeBox, dynamic.bgWhite]}>
        <Text style={[styles.subscribeTitle, dynamic.textGray900, { fontFamily: 'Poppins_700Bold' }]}>
          NTTfy Premium
        </Text>
        <Text style={[styles.subscribeSubtitle, dynamic.textGray600]}>Acceso ilimitado. Sin anuncios.</Text>
        <View style={[styles.subscribePlan, dynamic.bgGray100]}>
          <View>
            <Text style={[styles.fontSemibold, dynamic.textGray800]}>Plan Anual</Text>
            <Text style={[styles.textSm, dynamic.textGray500]}>(equivale a 4,99 €/mes)</Text>
          </View>
          <Text style={[styles.subscribePrice, dynamic.textBlue600]}>59,99 €</Text>
        </View>
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.label, dynamic.textGray700]}>Email</Text>
          <Text style={[styles.mockInput, dynamic.bgGray100, dynamic.textGray500]}>user@test.com</Text>
          
          <Text style={[styles.label, dynamic.textGray700]}>Información de Tarjeta (Test Mode)</Text>
          <Text style={[styles.mockInput, dynamic.bgWhite, dynamic.textGray700, dynamic.borderGray300]}>**** **** **** 4242</Text>

          <View style={[styles.flexRow, { justifyContent: 'space-between', marginTop: 16 }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.label, dynamic.textGray700]}>MM/AA</Text>
              <Text style={[styles.mockInput, dynamic.bgWhite, dynamic.textGray700, dynamic.borderGray300]}>12/28</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.label, dynamic.textGray700]}>CVC</Text>
              <Text style={[styles.mockInput, dynamic.bgWhite, dynamic.textGray700, dynamic.borderGray300]}>123</Text>
            </View>
          </View>
          
          <TouchableOpacity onPress={onBack} style={styles.subscribePayButton}>
            <Text style={styles.subscribePayButtonText}>Pagar 59,99 € (Simulado)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// --- Pantalla de Perfil ---
const ProfileScreen = ({ onLogout }) => {
  const { theme } = useTheme();
  const dynamic = s(theme);

  return (
    <View style={styles.screenContainer}>
      <Text style={[styles.screenTitle, dynamic.textGray900]}>Perfil</Text>
      <View style={{ alignItems: 'center', marginTop: 32 }}>
        <View style={[styles.profileAvatar, dynamic.bgBlue200]}>
          <User size={48} color={colors.blue600} />
        </View>
        <Text style={[styles.profileEmail, dynamic.textGray800]}>user@test.com</Text>
        <Text style={[styles.profileHandle, dynamic.textGray500]}>Usuario de NTTfy</Text>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <LogOut color={colors.white} size={20} style={{ marginRight: 8 }} />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// --- 7. COMPONENTES DE UI PERSISTENTES ---

// --- Barra de Navegación Inferior ---
const BottomNavBar = ({ activeScreen, setScreen }) => {
  const { theme } = useTheme();
  const dynamic = s(theme);
  const navItems = [
    { name: 'Inicio', screen: 'home', icon: Home },
    { name: 'Buscar', screen: 'search', icon: Search },
    { name: 'Listas', screen: 'playlists', icon: Music },
    { name: 'Perfil', screen: 'profile', icon: User },
  ];

  return (
    <View style={[styles.navBar, dynamic.bgWhite, dynamic.borderTopGray200]}>
      {navItems.map((item) => {
        const isActive = activeScreen === item.screen;
        const color = isActive ? colors.blue600 : (theme === 'dark' ? colors.gray400 : colors.gray500);
        return (
          <TouchableOpacity
            key={item.name}
            onPress={() => setScreen(item.screen)}
            style={styles.navBarItem}
          >
            <item.icon size={24} color={color} />
            <Text style={[styles.navBarLabel, { color: color }]}>{item.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// --- Barra del Reproductor ---
const PlayerBar = () => {
  const { theme } = useTheme();
  const { currentSong, isPlaying, togglePlay, playNext, playPrev, progress, duration, formatTime, seekTo } = usePlayer();
  const { openLyricsModal } = useLyrics();
  const dynamic = s(theme);
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  
  // Ref para la barra de progreso
  const progressRef = useRef(null);
  const [barWidth, setBarWidth] = useState(0);

  if (!currentSong) return null;

  return (
    <View style={[styles.playerBar, dynamic.bgGray50, dynamic.borderTopGray200]}>
      <Pressable
        ref={progressRef}
        onLayout={(event) => {
          setBarWidth(event.nativeEvent.layout.width);
        }}
        onPress={(e) => {
          if (barWidth > 0 && duration > 0) {
            const newTime = (e.nativeEvent.locationX / barWidth) * duration;
            if (isFinite(newTime)) seekTo(newTime);
          }
        }}
        style={[styles.progressBarContainer, dynamic.bgGray200]}
      >
        <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
      </Pressable>
      
      <View style={styles.playerTimeContainer}>
        <Text style={[styles.playerTime, dynamic.textGray500]}>{formatTime(progress)}</Text>
        <Text style={[styles.playerTime, dynamic.textGray500]}>{formatTime(duration)}</Text>
      </View>

      <View style={styles.playerControlsContainer}>
        <Image source={{ uri: currentSong.albumArtUrl }} style={styles.songItemImage} />
        <View style={styles.songItemTextContainer}>
          <Text style={[styles.playerSongTitle, dynamic.textGray900]} numberOfLines={1}>{currentSong.title}</Text>
          <Text style={[styles.playerSongArtist, dynamic.textGray600]} numberOfLines={1}>{currentSong.artist}</Text>
        </View>
        <View style={styles.playerButtons}>
          <TouchableOpacity onPress={() => openLyricsModal(currentSong)} style={{ padding: 4 }}>
            <FileText size={18} color={dynamic.textGray800.color} />
          </TouchableOpacity>
          <TouchableOpacity onPress={playPrev} style={{ padding: 4 }}>
            <SkipBack size={20} color={dynamic.textGray800.color} />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlay} style={styles.playerPlayButton}>
            {isPlaying ? <Pause size={24} color={colors.white} /> : <Play size={24} color={colors.white} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={playNext} style={{ padding: 4 }}>
            <SkipForward size={20} color={dynamic.textGray800.color} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// --- Botón de Tema ---
const ThemeToggleButton = ({ style }) => {
  const { theme, toggleTheme } = useTheme();
  const dynamic = s(theme);
  return (
    <TouchableOpacity
      onPress={toggleTheme}
      style={[styles.themeButton, dynamic.bgGray200, style]}
    >
      {theme === 'light' ? <Moon size={20} color={dynamic.textGray800.color} /> : <Sun size={20} color={dynamic.textGray800.color} />}
    </TouchableOpacity>
  );
};

// --- 8. MODALS ---

// --- Modal para Añadir a Playlist ---
const PlaylistModal = () => {
  const { theme } = useTheme();
  const { modalOpen, songToAdd, playlists, closePlaylistModal, addSongToPlaylist, createPlaylist } = usePlaylists();
  const { showToast } = useToast();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const dynamic = s(theme);
  
  if (!modalOpen || !songToAdd) return null;

  const handleCreateAndAdd = () => {
    if (newPlaylistName.trim() !== '') {
      const success = createPlaylist(newPlaylistName.trim());
      if (success) {
        addSongToPlaylist(newPlaylistName.trim(), songToAdd);
        setNewPlaylistName('');
        showToast(`Añadido a "${newPlaylistName.trim()}"`);
        closePlaylistModal();
      }
    }
  };

  const handleAdd = (playlistName) => {
    addSongToPlaylist(playlistName, songToAdd);
    showToast(`Añadido a "${playlistName}"`);
    closePlaylistModal();
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={modalOpen}
      onRequestClose={closePlaylistModal}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalContent, dynamic.bgWhite]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, dynamic.textGray900]}>Añadir a lista</Text>
            <TouchableOpacity onPress={closePlaylistModal}><X size={24} color={colors.gray500} /></TouchableOpacity>
          </View>
          
          <View style={[styles.modalSongInfo, dynamic.bgGray100]}>
            <Image source={{ uri: songToAdd.albumArtUrl }} style={styles.modalSongImage} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.fontMedium, dynamic.textGray900]} numberOfLines={1}>{songToAdd.title}</Text>
              <Text style={[styles.textSm, dynamic.textGray600]} numberOfLines={1}>{songToAdd.artist}</Text>
            </View>
          </View>

          <View style={[styles.flexRow, { marginBottom: 16 }]}>
            <TextInput
              value={newPlaylistName} onChangeText={setNewPlaylistName}
              placeholder="Nueva lista..."
              placeholderTextColor={colors.gray400}
              style={[styles.input, dynamic.bgWhite, dynamic.textGray900, dynamic.borderGray300, { flex: 1, marginRight: 8, fontSize: 14 }]}
            />
            <TouchableOpacity onPress={handleCreateAndAdd} style={styles.playlistCreateButton}>
              <Plus size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={{ maxHeight: 160 }}>
            {Object.keys(playlists).map(name => (
              <TouchableOpacity
                key={name} onPress={() => handleAdd(name)}
                style={[styles.modalPlaylistItem, dynamic.bgGray50]}
              >
                <Music size={18} color={colors.gray600} style={{ marginRight: 12 }} />
                <Text style={dynamic.textGray800}>{name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// --- Modal de Letras ---
const LyricsModal = () => {
  const { theme } = useTheme();
  const { modalOpen, lyrics, isLoading, currentSongInfo, closeLyricsModal } = useLyrics();
  const dynamic = s(theme);

  if (!modalOpen) return null;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={modalOpen}
      onRequestClose={closeLyricsModal}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalContent, dynamic.bgWhite, { height: '75%' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, dynamic.textGray900]} numberOfLines={1}>
              {currentSongInfo?.title || 'Letra'}
            </Text>
            <TouchableOpacity onPress={closeLyricsModal}><X size={24} color={colors.gray500} /></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, marginTop: 16 }}>
            {isLoading ? (
              <ActivityIndicator size="large" color={colors.blue600} style={{ marginTop: 32 }} />
            ) : (
              <Text style={[dynamic.textGray700, { textAlign: 'center', fontSize: 14, lineHeight: 22 }]}>
                {lyrics}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// --- 9. COMPONENTE PRINCIPAL DE LA APP ---
function AppContent() {
  const { theme } = useTheme();
  const [screen, setScreen] = useState('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const dynamic = s(theme);

  const handleLogin = () => { setIsAuthenticated(true); setScreen('home'); };
  const handleLogout = () => { setIsAuthenticated(false); setScreen('login'); };

  const renderScreen = () => {
    switch (screen) {
      case 'home': return <HomeScreen onSubscribeClick={() => setScreen('subscribe')} />;
      case 'search': return <SearchScreen />;
      case 'playlists': return <PlaylistScreen />;
      case 'subscribe': return <SubscribeScreen onBack={() => setScreen('home')} />;
      case 'profile': return <ProfileScreen onLogout={handleLogout} />;
      default: return <HomeScreen onSubscribeClick={() => setScreen('subscribe')} />;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, dynamic.bgWhite]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {!isAuthenticated ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <>
          <ThemeToggleButton style={{ position: 'absolute', top: 50, right: 16, zIndex: 50 }} />
          <View style={{ flex: 1, paddingTop: 52 }}>
            {renderScreen()}
          </View>
          <PlayerBar />
          <BottomNavBar activeScreen={screen} setScreen={setScreen} />
        </>
      )}
      
      {/* Modales globales */}
      <PlaylistModal /> 
      <LyricsModal /> 
    </SafeAreaView>
  );
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  
  // Cargar fuentes
  let [fontsLoaded] = useFonts({
    Poppins_700Bold,
  });

  // Simular carga de splash
  useEffect(() => {
    if (fontsLoaded) {
      setTimeout(() => {
        setAppIsReady(true);
      }, 2000);
    }
  }, [fontsLoaded]);

  if (!appIsReady || !fontsLoaded) {
    return <SplashScreen />;
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <LyricsProvider>
          <PlaylistProvider> 
            <PlayerProvider>
              <AppContent />
            </PlayerProvider>
          </PlaylistProvider>
        </LyricsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

// --- 10. ESTILOS (StyleSheet) ---
// Función helper para estilos dinámicos de tema
const s = (theme) => ({
  bgWhite: { backgroundColor: theme === 'dark' ? colors.gray800 : colors.white },
  bgGray50: { backgroundColor: theme === 'dark' ? colors.gray900 : colors.gray50 },
  bgGray100: { backgroundColor: theme === 'dark' ? colors.gray700 : colors.gray100 },
  bgGray200: { backgroundColor: theme === 'dark' ? colors.gray700 : colors.gray200 },
  bgBlue100: { backgroundColor: theme === 'dark' ? colors.blue900 : colors.blue100 },
  bgBlue200: { backgroundColor: theme === 'dark' ? colors.blue800 : colors.blue200 },
  textGray900: { color: theme === 'dark' ? colors.white : colors.gray900 },
  textGray800: { color: theme === 'dark' ? colors.gray200 : colors.gray800 },
  textGray700: { color: theme === 'dark' ? colors.gray300 : colors.gray700 },
  textGray600: { color: theme === 'dark' ? colors.gray400 : colors.gray600 },
  textGray500: { color: theme === 'dark' ? colors.gray400 : colors.gray500 },
  textBlue600: { color: theme === 'dark' ? colors.blue300 : colors.blue600 },
  textBlue500: { color: theme === 'dark' ? colors.blue400 : colors.blue500 },
  borderGray300: { borderColor: theme === 'dark' ? colors.gray600 : colors.gray300 },
  borderTopGray200: { borderTopColor: theme === 'dark' ? colors.gray700 : colors.gray200 },
  transparent: { backgroundColor: colors.transparent },
});

const styles = StyleSheet.create({
  // --- Global ---
  flexGrow: { flexGrow: 1 },
  flexRow: { flexDirection: 'row' },
  center: { alignItems: 'center', justifyContent: 'center' },
  safeArea: { flex: 1 },
  fontMedium: { fontWeight: '500' },
  fontSemibold: { fontWeight: '600' },
  textSm: { fontSize: 12 },
  centerText: { textAlign: 'center', marginTop: 32 },
  errorText: { textAlign: 'center', color: colors.red500, marginTop: 32 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  input: {
    height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12,
    fontSize: 16,
  },
  screenContainer: { paddingHorizontal: 16, paddingTop: 16, flex: 1 },
  screenTitle: { fontSize: 30, fontWeight: 'bold', marginBottom: 16 },
  screenSubtitle: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  
  // --- Splash ---
  splashContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blue600 },
  splashText: { fontSize: 50, fontWeight: 'bold', color: colors.white },

  // --- Login ---
  loginTitle: { fontSize: 40, fontWeight: 'bold', marginBottom: 32 },
  loginForm: { width: '100%', padding: 32, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  loginFormTitle: { fontSize: 24, fontWeight: '600', marginBottom: 24, textAlign: 'center' },
  loginError: { color: colors.red500, fontSize: 14, marginBottom: 16, textAlign: 'center' },
  loginButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: colors.blue600, borderRadius: 8, shadowColor: colors.blue600, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 6, elevation: 3 },
  loginButtonText: { color: colors.white, fontSize: 16, fontWeight: '500' },

  // --- SongItem ---
  songItem: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8 },
  songItemImage: { width: 48, height: 48, borderRadius: 8 },
  songItemTextContainer: { marginLeft: 16, flex: 1 },
  songItemTitle: { fontSize: 16, fontWeight: '600' },
  songItemArtist: { fontSize: 14 },
  songItemButton: { padding: 8, marginLeft: 'auto' },

  // --- Home ---
  subscribeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: colors.blue600, borderRadius: 8, marginBottom: 24, shadowColor: colors.blue600, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 6, elevation: 3 },
  subscribeButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },

  // --- Search ---
  searchBarContainer: { position: 'relative', marginBottom: 16 },
  searchInput: { height: 50, borderRadius: 25, paddingLeft: 16, paddingRight: 48, fontSize: 16, borderWidth: 1 },
  searchBarButton: { position: 'absolute', right: 8, top: 8, padding: 8 },
  
  // --- Playlist ---
  playlistCreateContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  playlistCreateButton: { padding: 12, backgroundColor: colors.blue600, borderRadius: 8 },
  playlistItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 8, marginBottom: 12 },
  playlistName: { fontSize: 16, fontWeight: '500' },
  playlistCount: { fontSize: 12 },

  // --- Subscribe ---
  subscribeBox: { borderRadius: 12, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  subscribeTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subscribeSubtitle: { textAlign: 'center', marginBottom: 24 },
  subscribePlan: { padding: 16, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subscribePrice: { fontSize: 24, fontWeight: 'bold' },
  mockInput: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 4, fontSize: 16 },
  subscribePayButton: { marginTop: 24, paddingVertical: 14, backgroundColor: colors.green600, borderRadius: 8 },
  subscribePayButtonText: { color: colors.white, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  
  // --- Profile ---
  profileAvatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  profileEmail: { fontSize: 20, fontWeight: '600' },
  profileHandle: { fontSize: 14, marginBottom: 40 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: colors.red600, borderRadius: 8, width: '80%' },
  logoutButtonText: { color: colors.white, fontSize: 16, fontWeight: '500' },
  
  // --- NavBar ---
  navBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, borderTopWidth: 1 },
  navBarItem: { alignItems: 'center', justifyContent: 'center', width: 70 },
  navBarLabel: { fontSize: 10, marginTop: 4 },

  // --- PlayerBar ---
  playerBar: { padding: 12, borderTopWidth: 1 },
  progressBarContainer: { height: 6, borderRadius: 3, marginBottom: 8 },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: colors.blue600 },
  playerTimeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  playerTime: { fontSize: 10 },
  playerControlsContainer: { flexDirection: 'row', alignItems: 'center' },
  playerSongTitle: { fontSize: 14, fontWeight: '600' },
  playerSongArtist: { fontSize: 12 },
  playerButtons: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 4 },
  playerPlayButton: { padding: 8, backgroundColor: colors.blue600, borderRadius: 24 },

  // --- ThemeButton ---
  themeButton: { padding: 8, borderRadius: 20 },

  // --- Toast ---
  toastContainer: { position: 'absolute', top: 60, right: 16, zIndex: 9999 },
  toast: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: colors.green500, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 3 },
  toastText: { color: colors.white, fontSize: 14, fontWeight: '500' },
  
  // --- Modals ---
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalContent: { width: '100%', maxWidth: 320, borderRadius: 12, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  modalTitle: { fontSize: 18, fontWeight: '600', flex: 1, marginRight: 16 },
  modalSongInfo: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16 },
  modalSongImage: { width: 40, height: 40, borderRadius: 4, marginRight: 12 },
  modalPlaylistItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 8 },
});