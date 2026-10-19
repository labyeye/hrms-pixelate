import { StyleSheet } from 'react-native';

/** Shared look for form modals: a card centred on a dimmed screen (instead of sliding up from the bottom). */
export const CENTER = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 14,
  },
  card: {
    height: '88%',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
  },
});
