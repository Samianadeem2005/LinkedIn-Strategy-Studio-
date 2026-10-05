import { getDb, getEligibleAnatomiesForIntent, selectAnatomyLRU, updateAnatomyLastUsed } from '../lib/db';
import { resolveContentIntent } from '../lib/intentResolver';

const db = getDb();
const authPt = db.prepare("SELECT id, name FROM post_types WHERE name = 'Authority'").get() as { id: string; name: string };
const intent = resolveContentIntent('I noticed Pakistani startups are starting to shift', authPt.id, authPt.name);

console.log('Resolved Intent:', intent.intentName, `(${intent.displayName})`);

const eligible = getEligibleAnatomiesForIntent(authPt.id, intent.intentId);
console.log('Eligible anatomies count:', eligible.length);
console.log('Eligible anatomies:', eligible.map(a => `${a.name} (last_used_at: ${a.last_used_at || 'NEVER'})`));

const selected1 = selectAnatomyLRU(eligible);
console.log('\nSelection 1:', selected1?.name);
if (selected1) {
  updateAnatomyLastUsed(selected1.id);
}

const eligibleAfter1 = getEligibleAnatomiesForIntent(authPt.id, intent.intentId);
console.log('\nEligible after 1st use:', eligibleAfter1.map(a => `${a.name} (last_used_at: ${a.last_used_at || 'NEVER'})`));
const selected2 = selectAnatomyLRU(eligibleAfter1);
console.log('Selection 2:', selected2?.name);

console.log('Rotated successfully:', selected1?.name !== selected2?.name || eligible.length === 1);
