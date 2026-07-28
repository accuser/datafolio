// Feature flags.
//
// A flag here is a hold-back switch, not a permanent configuration knob: it
// exists so a finished feature can be kept out of a release without deleting
// the code that implements it. Each one should carry the reason it is off and
// the condition for turning it on, so a later reader can retire it confidently.

/**
 * Revision cards and the Anki export.
 *
 * Held back for the pilot. The pilot is evaluating one thing — whether learners
 * can capture portfolio evidence against the standard — and a second, unrelated
 * study workflow in the same app would muddy what they are reacting to. The
 * feature is complete and its tests still run; this hides it, it does not
 * remove it.
 *
 * This is the client half: it governs what the UI renders, and nothing else.
 * `NEXT_PUBLIC_*` values are inlined into the browser bundle at build time, so
 * changing it needs a rebuild and redeploy — and, because it ships to the
 * browser, it must never be treated as a security boundary. Use
 * `cardsEnabledServer()` for that.
 *
 * Off unless explicitly enabled, so a deployment that forgets the variable
 * fails closed rather than open.
 *
 * To turn cards back on after the pilot: build with
 * `NEXT_PUBLIC_DATAFOLIO_CARDS=on` and set `DATAFOLIO_CARDS=on` in the runtime
 * environment. Both are needed — the UI and the API are gated separately.
 */
export const CARDS_ENABLED = process.env.NEXT_PUBLIC_DATAFOLIO_CARDS === "on";

/**
 * The server half of {@link CARDS_ENABLED}, for the `/api/cards` routes.
 *
 * Separate on purpose: hiding the UI does not close the API. A learner with
 * their session cookie and a shell could still commit `revision/<KSB>/cards.md`
 * while the buttons were gone, which would leave the repository contract
 * half-frozen during the pilot.
 *
 * Read at call time rather than at module scope so it can be set as a Worker
 * variable without a rebuild.
 *
 * Server-only — never call this from a client component.
 */
export function cardsEnabledServer(): boolean {
  return process.env.DATAFOLIO_CARDS === "on";
}
