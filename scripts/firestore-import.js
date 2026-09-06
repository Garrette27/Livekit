/**
 * Restores an export produced by firestore-export.js into a Firestore project.
 *
 * The target project is taken from a separate credentials file so a restore
 * can never be aimed at the source project by forgetting to change an
 * environment variable. Dry run by default.
 *
 *   node scripts/firestore-import.js --from <exportDir> --creds <serviceAccount.json>
 *   node scripts/firestore-import.js --from <exportDir> --creds <serviceAccount.json> --apply
 *
 * Auth accounts are listed but not recreated: passwords cannot be exported, so
 * they are re-established by the new project's own sign-in flow. See
 * docs/cost-control-and-migration.md.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const EXPORT_DIR = arg('--from');
const CREDS_PATH = arg('--creds');
const APPLY = process.argv.includes('--apply');
// Inspect an export without any credentials, so its contents can be reviewed
// before a target project exists.
const PLAN_ONLY = process.argv.includes('--plan-only');
const ONLY = arg('--only');

if (!EXPORT_DIR || (!CREDS_PATH && !PLAN_ONLY)) {
  console.error('usage: node scripts/firestore-import.js --from <exportDir> (--creds <serviceAccount.json> | --plan-only) [--only <collection>] [--apply]');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, '_manifest.json'), 'utf8'));
const serviceAccount = PLAN_ONLY ? null : JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));

// Checked before the SDK is initialised: restoring an export over the project
// it came from is the mistake worth catching, and it must be caught whether or
// not the credentials happen to parse.
if (serviceAccount && manifest.project === serviceAccount.project_id) {
  console.error(
    `Refusing to run: the export came from "${manifest.project}" and the credentials point at the same project.\n`
    + 'Pass a service account for the project you are restoring into.'
  );
  process.exit(1);
}

let db = null;
if (serviceAccount) {
  try {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
  } catch (error) {
    console.error(
      `Could not use the credentials at ${CREDS_PATH}: ${error.message}\n`
      + 'Expected the JSON key downloaded from Firebase console → Project settings → Service accounts.'
    );
    process.exit(1);
  }
}

/** Rebuilds the Firestore types that the export encoded as tagged objects. */
function decode(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(decode);

  switch (value.__type) {
    case 'timestamp':
      return admin.firestore.Timestamp.fromDate(new Date(value.iso));
    case 'geopoint':
      return new admin.firestore.GeoPoint(value.lat, value.lng);
    case 'ref':
      return db.doc(value.path);
    case 'bytes':
      return Buffer.from(value.base64, 'base64');
    default: {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = decode(v);
      return out;
    }
  }
}

/** Writes in batches; Firestore caps a batch at 500 operations. */
async function writeDocuments(collectionRef, documents, counters, depth = 0) {
  let batch = db.batch();
  let pending = 0;

  for (const record of documents) {
    const docRef = collectionRef.doc(record.id);
    batch.set(docRef, decode(record.data));
    counters.written += 1;
    pending += 1;

    if (pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }

    for (const [subName, subDocs] of Object.entries(record.subcollections || {})) {
      if (pending > 0) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
      await writeDocuments(docRef.collection(subName), subDocs, counters, depth + 1);
    }
  }

  if (pending > 0) {
    await batch.commit();
  }
}

async function main() {
  console.log(PLAN_ONLY ? '=== PLAN ONLY (no credentials used) ===' : APPLY ? '=== APPLY ===' : '=== DRY RUN (nothing written) ===');
  console.log(`source project : ${manifest.project}`);
  console.log(`exported at    : ${manifest.exportedAt}`);
  console.log(`target project : ${serviceAccount ? serviceAccount.project_id : '(none — plan only)'}`);

  const files = fs
    .readdirSync(EXPORT_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .filter((f) => !ONLY || f === `${ONLY}.json`);

  console.log('\nplan:');
  let planned = 0;
  const parsed = {};
  for (const file of files) {
    const documents = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, file), 'utf8'));
    const name = file.replace(/\.json$/, '');
    parsed[name] = documents;
    const subTotal = documents.reduce(
      (sum, d) => sum + Object.values(d.subcollections || {}).reduce((s, arr) => s + arr.length, 0),
      0
    );
    planned += documents.length + subTotal;
    console.log(`  ${String(documents.length).padStart(6)} docs${subTotal ? ` (+${subTotal} sub)` : ''}  ${name}`);
  }
  console.log(`  total: ${planned}`);

  const authPath = path.join(EXPORT_DIR, '_auth-users.json');
  if (fs.existsSync(authPath)) {
    const accounts = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    console.log(`\n${accounts.length} auth accounts are recorded in the export but are NOT recreated here.`);
    console.log('Passwords cannot be exported. Recreate them in the new project, keeping the same uid,');
    console.log('or let each person sign in again — see docs/cost-control-and-migration.md.');
  }

  if (PLAN_ONLY || !APPLY) {
    console.log(
      PLAN_ONLY
        ? '\nRe-run with --creds <serviceAccount.json> to check it against a target project.'
        : '\nRe-run with --apply to write.'
    );
    return;
  }

  console.log('\nwriting:');
  const counters = { written: 0 };
  for (const [name, documents] of Object.entries(parsed)) {
    process.stdout.write(`  ${name} ... `);
    await writeDocuments(db.collection(name), documents, counters);
    console.log('done');
  }
  console.log(`\nrestored ${counters.written} documents into ${serviceAccount.project_id}.`);
}

main().then(() => setTimeout(() => process.exit(0), 300), (e) => {
  console.error('IMPORT FAILED:', e.message);
  setTimeout(() => process.exit(1), 300);
});
