/**
 * Portable, account-independent export of the whole Firestore database.
 *
 * Writes one JSON file per collection (plus subcollections) outside the
 * repository, with Firestore types encoded so the companion import script can
 * restore them into any project. This is deliberately not the managed GCS
 * export: that stays inside one Google account, and the point here is to be
 * able to leave.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv(path.join(__dirname, '..', '.env.local'));
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();

const OUT_ROOT = path.join('C:', 'Users', 'garre', 'firestore-backups');

/** Encodes Firestore-specific types so they survive JSON and can be rebuilt. */
function encode(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof admin.firestore.Timestamp) {
    return { __type: 'timestamp', iso: value.toDate().toISOString() };
  }
  if (value instanceof admin.firestore.GeoPoint) {
    return { __type: 'geopoint', lat: value.latitude, lng: value.longitude };
  }
  if (value instanceof admin.firestore.DocumentReference) {
    return { __type: 'ref', path: value.path };
  }
  if (Buffer.isBuffer(value)) {
    return { __type: 'bytes', base64: value.toString('base64') };
  }
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = encode(v);
    return out;
  }
  return value;
}

async function exportCollection(ref, depth = 0) {
  const snapshot = await ref.get();
  const documents = [];
  for (const doc of snapshot.docs) {
    const record = { id: doc.id, data: encode(doc.data()), subcollections: {} };
    if (depth < 3) {
      const subs = await doc.ref.listCollections();
      for (const sub of subs) {
        record.subcollections[sub.id] = await exportCollection(sub, depth + 1);
      }
    }
    documents.push(record);
  }
  return documents;
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(OUT_ROOT, `firestore-export-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const collections = await db.listCollections();
  console.log(`project: ${env.FIREBASE_PROJECT_ID}`);
  console.log(`writing to: ${outDir}\n`);

  const manifest = { project: env.FIREBASE_PROJECT_ID, exportedAt: new Date().toISOString(), collections: {} };
  let grandTotal = 0;

  for (const collection of collections) {
    process.stdout.write(`  ${collection.id} ... `);
    const documents = await exportCollection(collection);
    const file = path.join(outDir, `${collection.id}.json`);
    fs.writeFileSync(file, JSON.stringify(documents, null, 2));

    const subTotal = documents.reduce(
      (sum, d) => sum + Object.values(d.subcollections).reduce((s, arr) => s + arr.length, 0),
      0
    );
    manifest.collections[collection.id] = { documents: documents.length, subcollectionDocuments: subTotal };
    grandTotal += documents.length + subTotal;
    console.log(`${documents.length} docs${subTotal ? ` (+${subTotal} in subcollections)` : ''}`);
  }

  // Auth accounts matter as much as the data: without them, profiles keyed by
  // uid point at nobody in the new project.
  process.stdout.write('  [auth accounts] ... ');
  const authUsers = [];
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    page.users.forEach((u) =>
      authUsers.push({
        uid: u.uid,
        email: u.email,
        emailVerified: u.emailVerified,
        displayName: u.displayName,
        disabled: u.disabled,
        providers: u.providerData.map((p) => p.providerId),
        createdAt: u.metadata.creationTime,
      })
    );
    pageToken = page.pageToken;
  } while (pageToken);
  fs.writeFileSync(path.join(outDir, '_auth-users.json'), JSON.stringify(authUsers, null, 2));
  console.log(`${authUsers.length} accounts`);

  manifest.authAccounts = authUsers.length;
  manifest.totalDocuments = grandTotal;
  fs.writeFileSync(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2));

  const bytes = fs
    .readdirSync(outDir)
    .reduce((sum, f) => sum + fs.statSync(path.join(outDir, f)).size, 0);

  console.log(`\ntotal documents: ${grandTotal}`);
  console.log(`auth accounts  : ${authUsers.length}`);
  console.log(`size on disk   : ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\nexport complete: ${outDir}`);
}

main().then(() => setTimeout(() => process.exit(0), 300), (e) => {
  console.error('EXPORT FAILED:', e.message);
  setTimeout(() => process.exit(1), 300);
});
