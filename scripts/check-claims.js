require('dotenv').config();
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

async function main() {
  const uid = '2x12PaemeTTnFuo9ovcc64Kq4e32';
  const user = await admin.auth().getUser(uid);
  console.log('Firebase user:', user.email, user.phoneNumber);
  console.log('Custom claims:', JSON.stringify(user.customClaims, null, 2));
}

main().catch(console.error).finally(() => process.exit());
