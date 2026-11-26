/**
 * Administrator tool: the only supported way to make someone a doctor.
 *
 *   node scripts/admin/provision-role.mjs audit
 *   node scripts/admin/provision-role.mjs grant  doctor someone@clinic.example [--apply]
 *   node scripts/admin/provision-role.mjs revoke someone@clinic.example        [--apply]
 *
 * Without --apply it prints what it would do (dry run). Credentials come from
 * the standard Firebase Admin environment (GOOGLE_APPLICATION_CREDENTIALS or
 * the project's existing service-account variables); nothing is hard-coded.
 *
 * grant: sets the custom claim role=<role> and, if missing, the matching
 *        users/{uid} profile; then revokes refresh tokens so the next sign-in
 *        carries the claim.
 * revoke: removes privileged claims and revokes refresh tokens. The profile
 *        is kept (history stays attributable); request-auth no longer treats
 *        it as a clinician because only claims grant clinician roles.
 * audit: read-only list of profiles whose role is privileged but whose
 *        account has no matching claim (they cannot act as clinicians now).
 *        Prints counts and masked emails only.
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PRIVILEGED = new Set(['doctor', 'faculty_reviewer', 'admin']);
const [command, ...rest] = process.argv.slice(2);
const apply = rest.includes('--apply');
const args = rest.filter((value) => value !== '--apply');

function mask(email) {
  const [user, domain] = String(email || '').split('@');
  return user ? `${user.slice(0, 2)}***@${domain || '?'}` : '(none)';
}

function init() {
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT });
  }
  return { auth: getAuth(), db: getFirestore() };
}

async function grant(role, email) {
  if (!PRIVILEGED.has(role) || !email) throw new Error('usage: grant <doctor|faculty_reviewer|admin> <email> [--apply]');
  const { auth, db } = init();
  const user = await auth.getUserByEmail(email.trim().toLowerCase());
  const claims = { ...(user.customClaims || {}), role, ...(role === 'admin' ? { admin: true } : {}) };
  console.log(`${apply ? 'Granting' : '[dry run] Would grant'} role=${role} to ${mask(user.email)} (uid ${user.uid.slice(0, 6)}…)`);
  if (!apply) return;
  await auth.setCustomUserClaims(user.uid, claims);
  const profileRef = db.collection('users').doc(user.uid);
  const profile = await profileRef.get();
  if (!profile.exists) {
    await profileRef.set({ email: user.email, role, registeredAt: FieldValue.serverTimestamp(), provisionedAt: FieldValue.serverTimestamp() });
  } else if (profile.data()?.role !== role) {
    console.warn(`Profile role is "${profile.data()?.role}"; left unchanged. Resolve the conflicting profile deliberately.`);
  }
  await auth.revokeRefreshTokens(user.uid);
  console.log('Done. The user must sign out and sign in again.');
}

async function revoke(email) {
  if (!email) throw new Error('usage: revoke <email> [--apply]');
  const { auth } = init();
  const user = await auth.getUserByEmail(email.trim().toLowerCase());
  const others = { ...(user.customClaims || {}) };
  const role = others.role;
  delete others.role;
  delete others.admin;
  console.log(`${apply ? 'Revoking' : '[dry run] Would revoke'} role=${role || '(none)'} from ${mask(user.email)}`);
  if (!apply) return;
  await auth.setCustomUserClaims(user.uid, others);
  await auth.revokeRefreshTokens(user.uid);
  console.log('Done.');
}

async function audit() {
  const { auth, db } = init();
  const snapshot = await db.collection('users').where('role', 'in', [...PRIVILEGED]).select('role', 'email').get();
  let unprovisioned = 0;
  for (const doc of snapshot.docs) {
    const user = await auth.getUser(doc.id).catch(() => null);
    const claim = user?.customClaims?.role;
    if (claim !== doc.data().role) {
      unprovisioned += 1;
      console.log(`unprovisioned ${doc.data().role}: ${mask(doc.data().email)} (claim: ${claim || 'none'})`);
    }
  }
  console.log(`${snapshot.size} privileged profile(s); ${unprovisioned} without a matching claim.`);
}

try {
  if (command === 'grant') await grant(args[0], args[1]);
  else if (command === 'revoke') await revoke(args[0]);
  else if (command === 'audit') await audit();
  else throw new Error('usage: audit | grant <role> <email> [--apply] | revoke <email> [--apply]');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
