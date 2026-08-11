export const Theme = {
  colors: {
    bgPrimary: '#0D0E12',
    bgSurface: '#161820',
    borderSketch: '#2A2D3A',
    textPrimary: '#F4F5F7',
    textMuted: '#6E758A',
    accentGlow: '#00FFCC', // Cyber Cyan
    accentRed: '#FF007F', // Electric Sakura (for negative/absent actions)
  },
  typography: {
    fontFamily: {
      display: 'Syne_700Bold',
      body: 'JetBrainsMono_400Regular',
      mono: 'JetBrainsMono_400Regular',
    },
    sizes: {
      micro: 10,
      small: 12,
      base: 14,
      large: 18,
      h2: 24,
      h1: 32,
    },
    letterSpacing: {
      tight: -1,
      normal: 0,
      widest: 2,
    },
  },
  paperStack: {
    shadowColor: '#2A2D3A',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0, // React Native Android shadow
    borderWidth: 1.5,
    borderColor: '#2A2D3A',
    borderRadius: 2,
    backgroundColor: '#161820',
  },
  animation: {
    animeSnap: {
      duration: 300,
    },
  },
};
