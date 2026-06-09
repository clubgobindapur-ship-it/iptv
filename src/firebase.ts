import { Banner } from './types';

// fallback banners when Firestore is not initialized or configured
export const DEFAULT_BANNERS: Banner[] = [
  {
    id: 'sports-1',
    bannerURL: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&h=450&q=80',
    redirection: 'T Sports',
    title: 'Live International Sports',
    description: 'Catch absolute non-stop live action on local and international sports channels.',
  },
  {
    id: 'ayna-premium',
    bannerURL: 'https://images.unsplash.com/photo-1574375927938-d5a98e8edd86?auto=format&fit=crop&w=1200&h=450&q=80',
    redirection: 'Ayna TV',
    title: 'Ayna OTT Premium Shows',
    description: 'Stream premium drama, blockbuster movies, and award-winning local serials.',
  },
  {
    id: 'sports-sony',
    bannerURL: 'https://images.unsplash.com/photo-1540747737956-3787217a9602?auto=format&fit=crop&w=1200&h=450&q=80',
    redirection: 'Sony Sports Ten 1',
    title: 'Exclusive Football & Tennis action',
    description: 'Full-time live coverage, expert panels, and classic replays on Sony Network.',
  },
];

// Lazily load and fetch banners from firestore if possible
export async function loadBanners(): Promise<Banner[]> {
  try {
    // Dynamically try to load firebase-applet-config.json
    // Using import() ensures compile-time optional dependency checks.
    const configResult = await import('./firebase-applet-config.json').catch(() => null);
    
    if (!configResult || !configResult.default) {
      console.log('Firebase configuration not found. Loading curated default pre-sets.');
      return DEFAULT_BANNERS;
    }

    const firebaseConfig = configResult.default;
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, collection, getDocs } = await import('firebase/firestore');

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log('Initializing Firestore to load banners from "banners" collection...');
    const querySnapshot = await getDocs(collection(db, 'banners'));
    
    const firestoreBanners: Banner[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      firestoreBanners.push({
        id: doc.id,
        bannerURL: data.bannerURL || data.imageURL || data.image || data.url || '',
        redirection: data.redirection || data.redirectionURL || data.redirect || '',
        title: data.title || '',
        description: data.description || '',
      });
    });

    if (firestoreBanners.length === 0) {
      console.log('Firestore "banners" collection is empty, falling back to beautiful default banners.');
      return DEFAULT_BANNERS;
    }

    return firestoreBanners;
  } catch (error) {
    console.warn('Unable to load banners from Firestore. Displaying pre-cached default slider banners.', error);
    return DEFAULT_BANNERS;
  }
}
