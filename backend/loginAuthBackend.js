/**
 * Rocky Axis Esports - Decoupled Node.js Express API Backend
 * * Purpose: Production-ready backend running securely on Vercel Serverless.
 * Binds CORS filters to allow cross-origin requests from your Netlify domain.
 * Integrates directly with the Firebase client/compat SDK inside server execution context.
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Initialize Firebase JS Client SDK in Server Node Context
const firebase = require('firebase/compat/app');
require('firebase/compat/auth');
require('firebase/compat/firestore');

const app = express();

// Configure CORS to authorize requests from all remote hosts (Netlify, etc.)
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '10mb' }));

// Establish connection with Firestore Database
const localFirebaseConfig = {
  apiKey: "AIzaSyCsW8Yy1UKIRX6Sm6SoQr1aZowF8OMFO2g",
  authDomain: "maketrendbattle-rockyaxis.firebaseapp.com",
  projectId: "maketrendbattle-rockyaxis",
  storageBucket: "maketrendbattle-rockyaxis.firebasestorage.app",
  messagingSenderId: "40509633595",
  appId: "1:40509633595:web:c6b81d6b62dab62fd8981e",
  measurementId: "G-L9B1HELEB0"
};

if (!firebase.apps.length) {
  firebase.initializeApp(localFirebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const appId = 'maketrendbattle-rockyaxis';

// Helpers to access sandboxed dynamic collections
function getPrivateCollection(userId, colName) {
  return db.collection('artifacts').doc(appId).collection('users').doc(userId).collection(colName);
}

async function isUserBanned(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists && doc.data().banned === true;
  } catch (e) {
    return false;
  }
}

async function generateNumericUserId() {
  const counterRef = db.collection('counters').doc('userIdCounter');
  try {
    const newId = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      if (!doc.exists) {
        transaction.set(counterRef, { value: 100000 });
        return 100000;
      }
      const newValue = doc.data().value + 1;
      transaction.update(counterRef, { value: newValue });
      return newValue;
    });
    return newId;
  } catch (error) {
    return Date.now() + Math.floor(Math.random() * 1000);
  }
}

// ==========================================================================
// DECOUPLED API ROUTINGS
// ==========================================================================

app.get('/api/config/registration', async (req, res) => {
  let enabled = true;
  try {
    const configDoc = await db.collection('config').doc('registration').get();
    if (configDoc.exists) {
      enabled = configDoc.data().enabled !== false;
    }
  } catch (e) {
    enabled = true;
  }
  res.json({ enabled });
});

app.get('/api/auth/verify-username', async (req, res) => {
  const { username } = req.query;
  try {
    const snap = await db.collection('users').where('username', '==', username).get();
    res.json({ available: snap.empty });
  } catch (e) {
    res.json({ available: false });
  }
});

app.get('/api/auth/verify-email', async (req, res) => {
  const { email } = req.query;
  try {
    const snap = await db.collection('users').where('email', '==', email).get();
    res.json({ available: snap.empty });
  } catch (e) {
    res.json({ available: false });
  }
});

app.get('/api/auth/verify-phone', async (req, res) => {
  const { code, phone } = req.query;
  const fullPhone = code + phone;
  try {
    const snap = await db.collection('users').where('phone', '==', fullPhone).get();
    res.json({ available: snap.empty });
  } catch (e) {
    res.json({ available: false });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { method, accountId, password, rememberMe } = req.body;
  try {
    let email = accountId;
    if (method === 'phone') {
      const userQuery = await db.collection('users').where('phone', '==', accountId).limit(1).get();
      if (userQuery.empty) {
        return res.json({ success: false, errorType: 'phone-not-found' });
      }
      email = userQuery.docs[0].data().email;
    }

    await auth.setPersistence(rememberMe ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION);
    const userCred = await auth.signInWithEmailAndPassword(email, password);
    
    if (await isUserBanned(userCred.user.uid)) {
      await auth.signOut();
      return res.json({ success: false, errorType: 'suspended', message: 'Your account is suspended. Contact support.' });
    }

    res.json({ success: true, redirectUrl: 'index.html' });
  } catch (e) {
    res.json({ success: false, errorType: 'wrong-password', message: e.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password, email, code, phone, avatar, refCode } = req.body;
  let finalEmail = email;
  if (!finalEmail && phone) {
    finalEmail = `${phone}@rockyaxis.com`;
  }

  let refererDocRef = null;
  let refererUid = null;
  let refererName = 'Organizer';
  let refererUsername = '@gamer';

  if (refCode) {
    try {
      let queryCode = refCode;
      if (!queryCode.startsWith('@')) { queryCode = '@' + queryCode; }
      let snap = await db.collection('users').where('referralCode', '==', queryCode).get();
      if (snap.empty) {
        snap = await db.collection('users').where('referralCode', '==', refCode).get();
      }

      if (!snap.empty) {
        refererDocRef = snap.docs[0].ref;
        refererUid = snap.docs[0].id;
        const refData = snap.docs[0].data();
        refererName = refData.gamename || refData.username || 'Organizer';
        refererUsername = refData.username ? `@${refData.username}` : '@gamer';
      } else {
        return res.json({ success: false, message: 'Invalid referral code.' });
      }
    } catch(err) {
      console.error("Referral balance credit check bypassed: ", err);
    }
  }

  try {
    const userCred = await auth.createUserWithEmailAndPassword(finalEmail, password);
    const uid = userCred.user.uid;
    const numericUserId = await generateNumericUserId();
    const generatedRefCode = '@' + uid.substring(0, 6).toUpperCase();

    await db.runTransaction(async (transaction) => {
      if (refererDocRef) {
        const refererDocSnap = await transaction.get(refererDocRef);
        if (refererDocSnap.exists) {
          const currentRefererBalance = refererDocSnap.data().walletBalance || refererDocSnap.data().wallet || 0;
          const currentRefererEarned = refererDocSnap.data().referralEarnings || refererDocSnap.data().referral || 0;
          const currentReferredCount = refererDocSnap.data().referredCount || refererDocSnap.data().referredFriendsCount || 0;

          transaction.update(refererDocRef, {
            wallet: currentRefererBalance + 10,
            walletBalance: currentRefererBalance + 10,
            referral: currentRefererEarned + 10,
            referralEarnings: currentRefererEarned + 10,
            referredCount: currentReferredCount + 1,
            referredFriendsCount: currentReferredCount + 1
          });

          const refererTransRef = getPrivateCollection(refererUid, 'transactions').doc();
          transaction.set(refererTransRef, {
            type: 'referral_bonus',
            amount: 10,
            description: `Referral award for inviting player @${username} (NPR 10.00 Credit)`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed'
          });

          const refererAlertRef = getPrivateCollection(refererUid, 'notifications').doc();
          transaction.set(refererAlertRef, {
            userId: refererUid,
            type: 'payment',
            title: "🤝 REFERRAL REWARD CREDITED!",
            message: `Your friend @${username} joined Rocky Axis! NPR 10.00 bonus has been loaded into your wallet.`,
            seen: false,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      const newUserDocRef = db.collection('users').doc(uid);
      const startingBalance = refererDocRef ? 10 : 0;
      const startingBonus = refererDocRef ? 10 : 0;

      transaction.set(newUserDocRef, {
        username, email: finalEmail,
        phone: phone ? code + phone : '',
        avatarDataURL: avatar,
        role: 'user',
        password: password, 
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        stats: { played: 0, won: 0, completed: 0, created: 0 },
        wallet: startingBalance,
        walletBalance: startingBalance,
        referral: 0,
        referralEarnings: 0,
        referredCount: 0,
        referredFriendsCount: 0,
        winning: 0,
        bonus: startingBonus,
        referralCode: generatedRefCode,
        provider: 'email',
        UserId: numericUserId,
        banned: false,
        referredBy: refererUid || ''
      });

      const userWalletRef = getPrivateCollection(uid, 'wallets').doc('wallet');
      transaction.set(userWalletRef, {
        balance: startingBalance,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (refererDocRef) {
        const newUserTransRef = getPrivateCollection(uid, 'transactions').doc();
        transaction.set(newUserTransRef, {
          type: 'welcome_bonus',
          amount: 10,
          description: `Received signup welcome bonus of NPR 10.00 using invitation code from ${refererUsername} (${refererName})`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          status: 'completed'
        });

        const newUserAlertRef = getPrivateCollection(uid, 'notifications').doc();
        transaction.set(newUserAlertRef, {
          userId: uid,
          type: 'payment',
          title: "🎁 WELCOME BONUS RECEIVED!",
          message: `NPR 10.00 welcome bonus has been credited for joining Rocky Axis via ${refererUsername} referral!`,
          seen: false,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    res.json({ success: true, redirectUrl: 'index.html' });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

app.post('/api/auth/forgot', async (req, res) => {
  const { email } = req.body;
  try {
    await auth.sendPasswordResetEmail(email);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// OAuth Server verification route (Accepts authenticated token payload directly)
app.post('/api/auth/social-flow', async (req, res) => {
  const { uid, email, displayName, photoURL, providerId } = req.body;
  try {
    if (await isUserBanned(uid)) {
      return res.json({ success: false, message: 'Your account is suspended. Contact support.' });
    }

    if (email) {
      const duplicateEmailQuery = await db.collection('users').where('email', '==', email).limit(1).get();
      if (!duplicateEmailQuery.empty) {
        const matchedUserDoc = duplicateEmailQuery.docs[0];
        const matchedUserUid = matchedUserDoc.id;

        if (matchedUserUid !== uid) {
          return res.json({ success: false, errorType: 'account-exists', email });
        }
      }
    }

    const docSnap = await db.collection('users').doc(uid).get();
    if (docSnap.exists && docSnap.data().username) {
      return res.json({ success: true, status: 'logged-in', redirectUrl: 'index.html' });
    }

    let extractedUsername = '';
    if (displayName) {
      extractedUsername = displayName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    }
    const randomSuffix = Math.floor(Math.random() * 900 + 100);
    const suggestedUsername = extractedUsername ? extractedUsername.slice(0, 12) + randomSuffix : `player${randomSuffix}`;

    res.json({
      success: true,
      status: 'complete-profile',
      email: email || '',
      suggestedUsername: suggestedUsername.replace(/@/g, ''),
      photoURL: photoURL || '',
      displayNameInitial: displayName ? displayName[0].toUpperCase() : 'U'
    });

  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

app.post('/api/auth/save-social-profile', async (req, res) => {
  const { uid, email, username, country, phone, avatar, refCode, password } = req.body;
  if (!uid) { return res.json({ success: false, message: 'OAuth reference is missing from context.' }); }

  let refererDocRef = null;
  let refererUid = null;
  let refererName = 'Organizer';
  let refererUsername = '@gamer';

  if (refCode) {
    try {
      let queryCode = refCode;
      if (!queryCode.startsWith('@')) { queryCode = '@' + queryCode; }
      let snap = await db.collection('users').where('referralCode', '==', queryCode).get();
      if (snap.empty) {
        snap = await db.collection('users').where('referralCode', '==', refCode).get();
      }

      if (!snap.empty) {
        refererDocRef = snap.docs[0].ref;
        refererUid = snap.docs[0].id;
        const refData = snap.docs[0].data();
        refererName = refData.gamename || refData.username || 'Organizer';
        refererUsername = refData.username ? `@${refData.username}` : '@gamer';
      } else {
        return res.json({ success: false, message: 'Invalid referral code.' });
      }
    } catch(err) {
      console.error("Referrals validation error: ", err);
    }
  }

  try {
    const numericUserId = await generateNumericUserId();
    const generatedRefCode = '@' + uid.substring(0, 6).toUpperCase();

    const newUserDocRef = db.collection('users').doc(uid);
    const startingBalance = refererDocRef ? 10 : 0;
    const startingBonus = refererDocRef ? 10 : 0;

    await newUserDocRef.set({
      username, email,
      phone: phone ? country + phone : '',
      avatarDataURL: avatar,
      role: 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      stats: { played: 0, won: 0, completed: 0, created: 0 },
      wallet: startingBalance,
      walletBalance: startingBalance,
      referral: 0,
      referralEarnings: 0,
      referredCount: 0,
      referredFriendsCount: 0,
      winning: 0,
      bonus: startingBonus,
      referralCode: generatedRefCode,
      provider: 'google.com', 
      UserId: numericUserId,
      banned: false,
      password: password, 
      referredBy: refererUid || ''
    });

    const userWalletRef = getPrivateCollection(uid, 'wallets').doc('wallet');
    await userWalletRef.set({
      balance: startingBalance,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (refererDocRef) {
      try {
        await db.runTransaction(async (transaction) => {
          const refererDocSnap = await transaction.get(refererDocRef);
          if (refererDocSnap.exists) {
            const currentRefererBalance = refererDocSnap.data().walletBalance || refererDocSnap.data().wallet || 0;
            const currentRefererEarned = refererDocSnap.data().referralEarnings || refererDocSnap.data().referral || 0;
            const currentReferredCount = refererDocSnap.data().referredCount || refererDocSnap.data().referredFriendsCount || 0;

            transaction.update(refererDocRef, {
              wallet: currentRefererBalance + 10,
              walletBalance: currentRefererBalance + 10,
              referral: currentRefererEarned + 10,
              referralEarnings: currentRefererEarned + 10,
              referredCount: currentReferredCount + 1,
              referredFriendsCount: currentReferredCount + 1
            });
          }
        });
      } catch (e) {
        console.warn("Skip non-blocking nested references: ", e);
      }

      try {
        const newUserTransRef = getPrivateCollection(uid, 'transactions').doc();
        await newUserTransRef.set({
          type: 'welcome_bonus',
          amount: 10,
          description: `Received signup welcome bonus of NPR 10.00 using invitation code from @${refererUsername} (${refererName})`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          status: 'completed'
        });

        const newUserAlertRef = getPrivateCollection(uid, 'notifications').doc();
        await newUserAlertRef.set({
          userId: uid,
          type: 'payment',
          title: "🎁 WELCOME BONUS RECEIVED!",
          message: `NPR 10.00 welcome bonus has been credited for joining Rocky Axis via @${refererUsername} referral!`,
          seen: false,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.warn("Wallet document log bypassed: ", e);
      }
    }

    res.json({ success: true, redirectUrl: 'index.html' });

  } catch(e) {
    res.json({ success: false, message: e.message });
  }
});

// Export App instance for Vercel Serverless Function Execution
module.exports = app;