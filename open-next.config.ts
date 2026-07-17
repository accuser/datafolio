import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config: the app has no ISR / on-demand revalidation, so no cache
// binding (KV/R2) is needed. Add one here later if that changes.
export default defineCloudflareConfig();
