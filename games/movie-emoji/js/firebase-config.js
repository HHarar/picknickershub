/**
 * Firebase configuration for Movie Emoji Game
 *
 * Setup (one-time, ~5 minutes):
 * 1. Go to https://console.firebase.google.com
 * 2. Click "Add project" → name it "picknickershub" → Continue
 * 3. Disable Google Analytics (not needed) → Create project
 * 4. Click the </> (Web) icon → register app as "picknickershub" → Continue
 * 5. Copy the firebaseConfig values below
 * 6. In the left sidebar: Build → Realtime Database → Create database
 *    → Choose any region → Start in TEST MODE → Enable
 * 7. In Realtime Database → Rules tab, replace with:
 *      { "rules": { ".read": true, ".write": true } }
 *    then Publish
 *
 * Then deploy this file to Netlify (git push) — done!
 */
window.FIREBASE_CONFIG = {
  apiKey:            'AIzaSyDTHGV8jIioiXJkvei7upMGRfFRe8NQVWs',
  authDomain:        'picknickershub.firebaseapp.com',
  databaseURL:       'https://picknickershub-default-rtdb.firebaseio.com',
  projectId:         'picknickershub',
  storageBucket:     'picknickershub.firebasestorage.app',
  messagingSenderId: '43973006150',
  appId:             '1:43973006150:web:2c6529e5c97dce00fe4b47',
};
