/**
 * SHAMEEM IPTV - Firebase Client Configuration
 * Replace the placeholder properties below with your actual Firebase Web Config credentials.
 */

const firebaseConfig = {
  apiKey: "PLACEHOLDER_API_KEY",
  authDomain: "shameem-iptv.firebaseapp.com",
  projectId: "shameem-iptv",
  storageBucket: "shameem-iptv.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:1234567890abcdef"
};

// Initialize Firebase App and Firestore securely using traditional compatible imports
let dbInstance = null;

try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    dbInstance = firebase.firestore();
    console.log("Firebase initialized successfully with config parameters.");
  } else {
    console.warn("Firebase SDK is not loaded dynamically. Dynamic notice and banners are in fallback mode.");
  }
} catch (error) {
  console.error("Error setting up Firebase client instance:", error);
}

// Share instance globally safely
window.db = dbInstance;
