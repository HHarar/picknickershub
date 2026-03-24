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
  apiKey:            'REPLACE_ME',
  authDomain:        'REPLACE_ME.firebaseapp.com',
  databaseURL:       'https://REPLACE_ME-default-rtdb.firebaseio.com',
  projectId:         'REPLACE_ME',
  storageBucket:     'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId:             'REPLACE_ME',
};
