# Organisation-scoped access model

How to let someone review content in a repository they must not be able to
write to.

This document specifies the model in two halves. **Part 1** is the portable
pattern — nothing in it is specific to DataFolio, and it is the part to lift
into a new project. **Part 2** is what adopting it in *this* codebase costs,
concretely, file by file.

---

## Part 1 — The pattern

### 1.1 The problem

An app stores each user's content in a Git repository and lets a second party
(a coach, a line manager, an assessor) leave review state on it. The obvious
implementation makes the reviewer a repository collaborator and treats
"has push access" as "is a reviewer".

On a repository owned by a **personal account**, that grant is far larger than
intended. Personal-account repositories have exactly two levels of access:
owner, and collaborator — and collaborator means push. There is no read-only
collaborator, no triage collaborator. So "may leave a review comment" is spelled
"may push to `main`, rewrite history, delete every file, and alter CI".

(Branch protection narrows some of that, and a rule set restricting pushes to
the default branch is worth having regardless. But it is a patch over the grant
rather than a fix for it: the collaborator still holds push on every other
branch, and protection on private repos is plan-dependent. The point stands that
the *grant* is the wrong size.)

The finer-grained roles — Read, Triage, Write, Maintain, Admin — exist only on
repositories owned by an **organisation**. That single fact is the whole reason
this pattern exists.

### 1.2 The principle: separate mechanism, signal, and policy

Three concerns get conflated in the naive design. Pull them apart and the
problem mostly dissolves.

| Concern | Question it answers | Where it lives |
| --- | --- | --- |
| **Mechanism** | Who physically writes to the repo? | Always the App installation token. Never a user's token. |
| **Signal** | What does GitHub say about this user's relationship to this repo? | One API call, read-only input. |
| **Policy** | What is this user permitted to do in the app? | Pure functions in your code. |

The key observation: **the reviewer never writes to the repository.** The App
does, on their behalf, having already decided the write is legitimate. The
reviewer's own GitHub permission is only ever *read as a signal*. It is never
the thing that authorises the write at the Git level.

Once that is true, the permission you grant the reviewer can be the smallest one
that keeps them visible to the API — because it is doing no work beyond
identification. Read or Triage is enough. Write was always overkill; it just
happened to be the only option on personal repos.

### 1.3 Topology

```
<org>/                                    ← one organisation owns everything
├── portfolio-ada-lovelace                ← one repo per subject
├── portfolio-grace-hopper
└── portfolio-alan-turing

App installation: on the org (all repos, or a selected set)
App permissions:  Contents: Read & write. Metadata: Read. Nothing else.
```

Settings that matter, in descending order of "will bite you if wrong":

- **Organisation base permission: `None`.** This is the one that matters most.
  Base permission applies to every member across every repository in the org, so
  anything above `None` silently grants blanket access and defeats per-repo
  review access on day one. Set it explicitly and confirm what it reads —
  GitHub's own documentation is ambiguous about the default for a new
  organisation (there is a long-standing open docs issue asking them to clarify
  it), so this is not a setting to assume. Note that base permissions do not
  apply to outside collaborators, only to members.
- **Disable "Allow members to delete or transfer repositories".** This is what
  makes it safe to give subjects Admin on their own repo (see below).
- **Repository visibility: private**, and restrict members' ability to change
  visibility.
- Consider disabling Issues if you do not want Triage-role reviewers opening
  and commenting on them.

### 1.4 Role grants

| Party | GitHub repo role | Why |
| --- | --- | --- |
| Subject (the person the repo is about) | **Write**, or **Admin** | Write is sufficient — the App does the writing anyway. Admin only if they must invite their own reviewers. |
| Reviewer | **Triage** | No code access at all. Can manage issues/PRs, which is often useful. |
| Read-only observer (external verifier, IQA, auditor) | **Read** | Clone and browse, nothing else. |
| Everyone else | none | Base permission `None` guarantees this. |

**On giving subjects Admin.** Only Admin can manage a repository's
collaborators, so a self-service model — where the subject chooses their own
reviewers — requires it. Admin also permits deleting the repository, which is
why the org-level "allow members to delete repositories" setting must be off:
with it disabled, Admin becomes a reasonable grant. If reviewer assignment is
instead an administrative act (see teams, §1.8), give subjects Write and keep
Admin to org owners.

**On Triage vs Read for reviewers.** Triage grants no more access to *code* than
Read does — the difference is issue and PR management. Prefer Triage if you want
reviewers able to open issues; prefer Read if the repository should be inert to
them. Either works with this model; the code treats both as "may review" or
splits them, your choice (§1.7).

### 1.5 Reading the signal correctly

```
GET /repos/{owner}/{repo}/collaborators/{username}/permission
```

This returns the user's **effective** permission, which is what you want: it
already accounts for organisation base permission, team memberships, and direct
collaborator grants. One call, no need to enumerate teams yourself.

**The trap.** The response has two relevant fields, and the obvious one is
wrong:

```jsonc
{
  "permission": "read",      // legacy, coarse: admin | write | read | none
  "role_name": "triage",     // the actual role
  "user": { }
}
```

`permission` only ever takes four values. **Triage collapses to `read`, and
Maintain collapses to `write`.** A custom repository role (Enterprise) reports
its base level here. So any code that switches on `permission` cannot
distinguish a Triage reviewer from a Read-only observer, and code that tests
`permission === "maintain"` is testing for a value the API never returns.

Read `role_name`, and fall back to `permission` only when `role_name` is absent
or unrecognised:

```ts
type RepoRole = "none" | "read" | "triage" | "write" | "maintain" | "admin";

const KNOWN: readonly RepoRole[] = [
  "none", "read", "triage", "write", "maintain", "admin",
];

function isRepoRole(v: unknown): v is RepoRole {
  return typeof v === "string" && (KNOWN as readonly string[]).includes(v);
}

function readRole(data: { permission?: unknown; role_name?: unknown }): RepoRole {
  if (isRepoRole(data.role_name)) return data.role_name;
  // Custom role, or an older response shape: fall back to the coarse field.
  // Validated, not cast: anything unrecognised — a future API value, a typo in a
  // fixture — must land on "none", because `canRead` is `role !== "none"` and an
  // unchecked cast would turn an unknown string into read access.
  if (isRepoRole(data.permission)) return data.permission;
  return "none";
}
```

A 404 from this endpoint means "not a collaborator" and must map to `none`, not
to an error.

### 1.6 Identity: who is the repo *about*?

This is the part that is easy to get wrong, and getting it wrong inverts every
authorization rule silently.

In a personal-repo model, "is this the subject?" is free:

```ts
const isSubject = user.login === repo.owner;   // ada === ada
```

Move the repos into an organisation and `repo.owner` is the org. That comparison
is now **false for everyone, forever**. Every rule built on it flips: the subject
is treated as a reviewer (and can approve their own work), and no one is treated
as the subject (so no one can edit their own content). Nothing throws. The tests
that mock the owner comparison still pass. It just quietly stops meaning
anything.

Nor can you recover it from permissions. Organisation owners hold implicit Admin
on every repository, so "has Admin" identifies the provider's staff as readily
as the subject.

**Have the repository declare its own subject.** A manifest file at the repo
root, committed like anything else:

```yaml
# datafolio.yml
standard: st0585
learner: ada-lovelace
```

```ts
// `manifest.subject` is the parsed form of the YAML `learner:` key. The generic
// name is deliberate — the pattern's concept is "who is this repo about", and a
// project adopting it should name the key for its own domain (learner, author,
// candidate, owner-of-record) while keeping the field generic in code.
const isSubject =
  manifest.subject != null &&
  user.login.toLowerCase() === manifest.subject.toLowerCase();
```

Why in the repo rather than anywhere else:

- **Immune to permission quirks.** Org owners, team grants, and custom roles
  cannot accidentally satisfy it.
- **Auditable.** Reassigning a portfolio is a commit, with an author and a date,
  reviewable like any other change.
- **Durable.** It survives the subject's access being revoked, the repo being
  archived, and the person leaving the organisation — all cases where you still
  want to know whose portfolio it was.
- **Cheap, once the manifest read is shared.** The file is already fetched on
  every request to resolve the occupational standard, so the *bytes* cost
  nothing extra — but see the caveat below, because in this codebase it is not
  yet free.

On that last point, be precise about what it costs today. `resolveRepoContext`
(`lib/github/request-context.ts:30-72`) builds the whole context, `isOwner`
included, before any manifest is read. The manifest is fetched later, by two
separate paths: `resolveStandard` (`lib/data/github-store.ts:87-103`) makes its
own Contents call, and `standardFromTree` (`lib/data/portfolio-standard.ts:22`)
reads it from a tree snapshot. Moving subject resolution into
`resolveRepoContext` therefore adds a **new round trip per request** unless the
fetch is hoisted and shared between the two. That hoist is a real refactor and
belongs in the change list (§2.3), not in a parenthesis.

Do **not** derive identity from the repository name. Repo names are mutable and
GitHub logins are renameable; the two drift, and the day they drift is the day
someone else becomes the subject of a portfolio. The name is a convention for
humans and for cheap listing (§1.9) — never an input to an authorization
decision.

**Fail closed.** If the manifest is missing, unparseable, or has no `subject`,
the correct behaviour is to refuse *all* writes to that repository and surface a
clear error, not to fall back. Note this is deliberately stricter than the same
file's handling of a missing `standard`, which falls back to a default: a bad
standard degrades the UI, whereas a bad subject line silently redistributes
authority. Two fields in one file, two different failure postures, for good
reason.

### 1.7 Policy: the decision table

Resolve each request to a single actor value, then decide from pure functions:

```ts
interface Actor {
  /** Effective GitHub role, from §1.5. */
  role: RepoRole;
  /** Manifest says this repo is about them, from §1.6. */
  isSubject: boolean;
}

const REVIEW_ROLES: readonly RepoRole[] = ["triage", "write", "maintain", "admin"];

const canRead = (a: Actor) => a.role !== "none";

// The `!isSubject` conjunction is load bearing, not defensive. Per §1.4 the
// subject holds Write or Admin on their own repo, so the role test alone is
// *true* for them — drop the conjunction and the subject can approve their own
// work. This is the one rule where the GitHub permission says yes and only
// policy says no.
const canReview = (a: Actor) => !a.isSubject && REVIEW_ROLES.includes(a.role);
```

`canRead` is a function of the GitHub role alone, and everything the subject
owns is a function of `isSubject` alone. `canReview` is the one rule that reads
both — deliberately, and see the note below the table.

| Action | Subject | Reviewer (Triage+) | Observer (Read) | Non-member |
| --- | :-: | :-: | :-: | :-: |
| Read content | ✓ | ✓ | ✓ | ✗ |
| Create an item | ✓ | ✗ | ✗ | ✗ |
| Edit item content | ✓ | ✗ | ✗ | ✗ |
| Delete an item | ✓ | ✗ | ✗ | ✗ |
| Submit for review | ✓ | ✗ | ✗ | ✗ |
| Approve / request changes | ✗ | ✓ | ✗ | ✗ |
| Leave review feedback | ✗ | ✓ | ✗ | ✗ |
| Edit private working material | ✓ | ✗ | ✗ | ✗ |

Two rows deserve attention:

- **"Approve / request changes" is ✗ for the subject even though they have the
  highest GitHub role on their own repo.** This is why `canReview` above tests
  `!isSubject` as well as the role. Self-review is the rule most likely to be
  quietly lost in a refactor, because the GitHub permission says yes and only
  policy says no — so it wants a test that survives the mechanism changing, and
  the rule wants to live in one function rather than being reconstructed by
  every caller.
- **An org owner holds Admin on every repo and therefore maps to "reviewer"
  everywhere.** For a training provider that is usually correct and desirable.
  Decide it deliberately rather than inheriting it; if you need provider staff
  to be observers rather than reviewers, `canReview` must exclude
  organisation-owner-derived Admin, which means an extra membership call.

### 1.8 Teams

At more than a handful of repositories, stop granting per-repository
collaborator access and use organisation teams:

```
@org/coaches-2026   → Triage on every repo in the 2026 cohort
@org/verifiers      → Read on all portfolios
```

Adding a coach becomes one team membership rather than N invitations, and
revocation becomes one removal rather than N — which matters, because it is the
revocation path that gets missed. No code changes: the permission endpoint in
§1.5 already returns team-derived permission as part of the effective role.

### 1.9 Discovery

Listing which repositories a signed-in user can reach still works — a Read or
Triage collaborator reaches the repository, so `GET
/user/installations/{id}/repositories` returns it. Two things change:

- **Filtering.** Repos can no longer be identified by a shared constant name,
  since they now share one owner. Filter on `owner.login === ORG` plus a name
  prefix (`portfolio-`).
- **Labelling.** The switcher wants to show "your portfolio" vs "someone
  else's", but reading every manifest to find out is one API call per repo on
  the sign-in path. Resolve this by making the distinction **cosmetic**: derive
  the label from the name convention, and re-resolve the real subject from the
  manifest, server-side, on every request that acts. A wrong label is a cosmetic
  bug; it can never become an authorization bug, because no decision reads it.

That preserves the property the current design already has and should keep:
*switching is discovery, not access*. The switcher lists what GitHub already
says you can reach, and every individual request re-checks.

### 1.10 What this does and does not protect

Worth being explicit, because "we moved to an org" can be heard as more than it
is.

**Prevented.** A reviewer cannot push, force-push, rewrite history, delete
files or branches, modify workflows, read Actions secrets, change repository
settings, or add further collaborators. The blast radius of a compromised or
careless reviewer account drops from "total loss of the repository" to
"incorrect review state, recorded in a commit, trivially revertible".

**Not prevented.**

- **Reading.** Read and Triage both include clone. A reviewer sees the entire
  repository, including its history. If reviewers must not see everything, no
  arrangement of roles helps — that needs a different storage split.
- **Organisation owners.** They hold implicit Admin everywhere. This is
  inherent to organisations and cannot be configured away.
- **The App itself.** The installation token is now the *only* thing that
  writes, which concentrates risk in the App's private key: compromise it and
  every repository is writable. Keep the App's permissions minimal (Contents and
  Metadata only — it needs nothing else), store the key in a secret manager, and
  have a rotation procedure written down before you need it.
- **Application bugs.** GitHub's ACL still backstops reads, but every write is
  now the App's, so a policy bug in your code is a real authorization bug. The
  decision table in §1.7 belongs in pure, exhaustively tested functions for
  exactly this reason.

### 1.11 Adoption checklist for a new project

1. Repos live in an organisation from day one. Retrofitting is possible (§2.5)
   but tedious.
2. Base permission `None`. Member repo deletion off.
3. One App, installed on the org, holding the minimum permissions. All writes go
   through its installation token; no user token is ever persisted or used to
   write.
4. Every repo declares its subject in a root manifest. Fail closed when absent.
5. Effective role read from `role_name`, not `permission`.
6. Policy as pure functions over `{ role, isSubject }`, with a test per cell of
   the decision table — including the negative cells, which are the ones that
   regress.
7. Grant reviewers Triage. Grant subjects Write, or Admin if they self-manage
   reviewers.
8. Prefer teams to per-repo grants as soon as there is more than one cohort.

---

## Part 2 — Applying it to DataFolio

### 2.1 Current state

- Every write already goes through the installation token
  (`lib/github/app.ts:28`). The mechanism is already correct; only the signal
  and policy need work.
- `canWrite` (`lib/github/app.ts:45`) gates three routes:
  `app/api/evidence/route.ts:37`, `app/api/evidence/[id]/route.ts:20` and `:63`.
  It is a pure signal read — its result never reaches GitHub.
- `canRead` (`lib/github/app.ts:69`) gates reads in
  `lib/github/request-context.ts:47`.
- `isOwner` (`lib/github/request-context.ts:62`) is `login === target.owner` and
  is the sole input to every rule in `lib/data/authz.ts` and to
  `validateEvidencePatch`.

### 2.2 Three pre-existing gaps this surfaced — all now closed

Independent of the org migration, and worth fixing either way. All three were
fixed ahead of the migration; they are kept here because the *shape* of them is
the point, and the same shape will recur as rules are added.

1. **`POST /api/evidence` had no subject check.** It gated on `canWrite` only,
   so a reviewer could create evidence in a learner's portfolio. Deleting was
   blocked (`canDeleteEvidence`) and cards were blocked (`canWriteCards`), but
   creating was not. Closed by `canCreateEvidence(isOwner)`.
2. **`validateEvidencePatch` was asymmetric.** It stopped a learner writing
   `feedback` but nothing stopped a reviewer patching `title`, `url`, `note` or
   `ksbIds`. The learner-side rule existed; its mirror did not. Closed by
   stating both halves together at the top of the function.
3. **The status handshake was enforced in one direction.** `canSubmitVerdict`
   refused the subject an `Approved`/`Changes` verdict, but nothing refused a
   reviewer a `Draft` or `Submitted` — so a reviewer could revoke an approval or
   push a learner's unfinished draft into review. Closed by `canSetStatus`,
   which is the status half of the §1.7 table in one function.

The three share one failure mode, and it is worth naming because it is not
"someone forgot a check". Each rule was *half* written. A rule stated as one
half reads as complete — the half that exists looks like the whole rule, and
nothing about it advertises the missing mirror. Two of the three additionally
had **tests asserting the missing half's absence as correct behaviour**, which
is how they survived a security review: the suite was green, and green meant
"the rule that exists, works", not "the rule is whole".

The defence is structural rather than diligent: state both halves in one place,
so an absent half is a visible hole rather than an unwritten line.

Also cosmetic but telling: `canWrite` tests for `"maintain"` in the `permission`
field, a value that field never returns (§1.5). Dead branch today; a real bug
the moment Maintain is granted to anyone.

A second pair of soon-to-be-dead branches: both `canWrite` and `canRead`
short-circuit on `username === owner` (`lib/github/app.ts:51` and `:75`). Under
an org that comparison is the same permanently-false one as `isOwner`, so both
short-circuits stop firing and every call falls through to the API request. Both
functions are replaced wholesale by `resolveRole()` in §2.3, so nothing is left
stranded — noted only so the reader doesn't carry a mental model in which the
owner fast-path still saves a round trip.

### 2.3 Changes by file

| File | Change |
| --- | --- |
| `lib/github/app.ts` | Replace `canRead`/`canWrite` with one `resolveRole()` returning a `RepoRole` from `role_name`. |
| `lib/standards/manifest.ts` | Parse `learner:` alongside `standard:`. Return it unresolved-but-present so the caller can fail closed; do **not** give it the standard's forgiving fallback. |
| `lib/github/request-context.ts` | `isOwner` → `isSubject`, from the manifest. Carry `role` on `RepoContext`. Refuse writes when the subject is unresolvable. |
| `lib/data/authz.ts` | Rename `isOwner` → `isSubject` throughout. `canCreateEvidence` and `canSetStatus` (the whole status partition, not just the verdict half) already exist per §2.2 — what remains is the rename and one test per cell of §1.7. The content rule is **not** here; see the `validation.ts` row. |
| `lib/data/validation.ts` | Take `isSubject`. The reviewer-cannot-edit-content mirror already exists alongside the learner-cannot-write-feedback rule. Both live here rather than in `authz.ts` because they are functions of *which fields* a patch touches, not of the action alone — the cost being that `authz.ts` is no longer the single place to read the rule set off, so §1.7 stays the index of record. |
| `app/api/evidence/route.ts`, `app/api/evidence/[id]/route.ts` | Drop the three `canWrite` calls; apply the authz rules instead. |
| `lib/data/github-store.ts` | `resolveStandard` currently makes its own Contents call for the manifest. Hoist it so the subject and the standard come from one read (§1.6). |
| `lib/data/portfolio-standard.ts` | The other manifest reader (`standardFromTree`). Same hoist, so the two paths share one fetch rather than growing a third. |
| `lib/github/portfolios.ts` | Filter on org + name prefix rather than exact repo name. Label roles from the name convention, documented as cosmetic. **Also `pickDefaultTarget`** (`:141-151`), whose no-portfolios fallback returns `{ owner: login, repo: defaultRepo }` — under an org *both* fields are wrong; it needs `{ owner: ORG, repo: PREFIX + login }`. This is the sign-in landing path, so getting it wrong strands a user with no portfolio on a 404. |
| `app/api/auth/login/route.ts` | `:20` defaults the target repo to `cfg.repoName`. Becomes the prefixed name. |
| `app/api/auth/callback/route.ts` | `:82` passes `cfg.repoName` to enumeration, `:94` uses it as the fallback repo. Both follow the config change. |
| `lib/github/config.ts` | `DATAFOLIO_REPO_NAME` → `DATAFOLIO_ORG` + `DATAFOLIO_REPO_PREFIX`. |
| `lib/github/portfolios.ts` (`MAX_PORTFOLIOS`, `:31`) | Re-check the budget: names grow from a shared constant to `portfolio-<login>`, so every roster entry gets bigger. `fitToCookie` (`lib/session.ts`) measures rather than guesses, so this degrades safely — but the constant is mirrored by hand in **`lib/session.test.ts:26`** (with a "must track" comment) and hardcoded as `30` in **`lib/github/portfolios.test.ts:174`**. Three sites, one value. |
| `docs/github-app.md` | Rewrite §3 and §4 for org onboarding and Triage reviewers. |
| `docs/cloudflare.md` | `:32` documents `wrangler secret put DATAFOLIO_REPO_NAME`. Renaming the env var orphans this line. |

### 2.4 The dangerous change

`isOwner` → `isSubject` is the one to be careful with. It is a rename that
changes semantics, applied to the value that every authorization rule in the
codebase reads. Get it half-done — new identity in some paths, `login === owner`
in others — and different rules disagree about who the learner is.

Two things make it safe. First, do the rename mechanically and completely in one
commit, so the compiler flags every site rather than leaving a working-but-wrong
`isOwner` around. Second, keep a transitional fallback while the estate migrates:

```ts
// Transitional: personal repos have no `learner:` in their manifest yet.
// Remove once every portfolio is org-hosted and declares its subject.
const isSubject = manifest.subject
  ? login.toLowerCase() === manifest.subject.toLowerCase()
  // The owner comparison is only meaningful for a repo still on a personal
  // account. Guarding on the org is what stops it from silently answering
  // "nobody" for an org-hosted repo whose manifest hasn't been written yet —
  // which would not fail closed: `canSetStatus` blocks a verdict only for the
  // subject, so an unresolved subject makes everyone a reviewer — and the
  // learner may then approve their own evidence.
  : owner.toLowerCase() !== ORG.toLowerCase() &&
    login.toLowerCase() === owner.toLowerCase();
```

This keeps both models working simultaneously, which is what lets the migration
proceed repo by repo instead of as one cutover.

The org guard matters more than it looks. Without it the fallback reads
`login === owner` on an org-hosted repo, which is false for everyone — precisely
the inversion §1.6 warns about, reintroduced by the very code meant to smooth
the migration. With it, an org-hosted repo lacking a manifest subject resolves
to "no subject" and hits the fail-closed path from §1.6 instead: writes refused,
loudly, rather than authority quietly redistributed.

### 2.5 Migration order

The sequence is constrained at **three** points. Each constraint exists because
reversing it opens a window in which authorization is wrong rather than merely
unavailable — and two of those windows fail *open*.

1. Create the org. Base permission `None`, member repo deletion off.
2. Install the App on the org.
3. **Deploy the transitional code** (§2.4) — the build that understands
   `learner:`, falls back to the owner comparison for still-personal repos, and
   guards that fallback on the org. Nothing has moved yet, so this is a no-op in
   production; that is the point.
4. Then, **per repo, in this order**:
   a. Add `learner:` to `datafolio.yml`.
   b. Transfer the repo into the org. History, issues and stars survive, and
      GitHub redirects the old URL. **Verify the learner's resulting role
      explicitly** — do not assume the transfer left them where you want them.
   c. Rename to `portfolio-<login>`.
5. **Downgrade reviewers** from collaborator-write to Triage, once every repo
   has moved.
6. Remove the fallback and its org guard; `isSubject` becomes manifest-only and
   fail-closed everywhere.

The three constraints, and what each one prevents:

| Constraint | Reversed, you get |
| --- | --- |
| Deploy (3) before any transfer (4b) | The old build resolves `isSubject` as `login === owner`. The moment a repo is org-owned that is false for everyone, so **the learner is treated as a reviewer and can approve their own evidence.** Fails open. |
| Manifest (4a) before transfer (4b) | Same inversion, in the gap between the two. The §2.4 org guard turns this into a refused write rather than a silent one, but ordering it correctly means the window never opens. |
| Deploy (3) before downgrade (5) | The old build requires push access, so every reviewer is locked out until the deploy lands. Fails closed — annoying, not dangerous, but avoidable. |

Only step 4 is per-repo, and it can run incrementally at whatever pace suits —
the fallback is what makes a half-migrated estate safe, which is why it must be
deployed before the first repo moves rather than alongside them.

An earlier draft of this section had step 4a after the transfer and described
steps 1–5 as runnable "with the transitional fallback in place" while the deploy
was itself step 6. That was circular — the fallback is code, and it cannot be in
place before it ships — and it left exactly the fail-open window the table
above describes. Recorded here because the mistake is an easy one to make again.

### 2.6 What the learner loses

Worth stating plainly, because it is the real cost and it is not technical.

Today the learner owns their portfolio outright: it is in their account, under
their name, and they can take it with them when the programme ends. Under this
model the organisation owns it. Org owners can read every portfolio, can revoke
the learner's access, and can delete the repo. The learner keeps a durable claim
on the *content* — the manifest names them, and the commit history is theirs —
but not on the container.

Some of that can be given back: transfer the repository to the learner's
personal account on completion, or have them fork it. Neither is automatic and
both should be a stated part of the programme, agreed at the start rather than
discovered at the end.

### 2.7 The alternative, weighed honestly

If learner ownership is a hard requirement, this model is the wrong one. The
alternative is to keep personal repos, drop collaborators entirely, and hold the
reviewer roster in the repo itself — the App commits a `reviewers:` list, and a
reviewer is authorised by appearing in it rather than by any GitHub grant.

It is worth resisting the instinct to file that as "riskier". Compare the two
honestly, axis by axis:

- **Writes: no change.** Every write already goes through the App installation
  token, and the collaborator check is an *input to the app's own decision*, not
  an independent enforcement point. If the policy code says yes, the token
  writes. So "the application is the only boundary for writes" is not a cost of
  the roster model — it is an accurate description of the system as it stands
  today. Nothing is given up here.
- **Reads: arguably stronger.** Under the org model a reviewer holds Read or
  Triage and can therefore clone the entire repository and its history. Under
  the roster model they are not a collaborator at all and cannot reach the repo
  on github.com by any route. What changes is that the app's read gate is no
  longer backstopped by GitHub's ACL — a genuine trade, but it trades a backstop
  for a smaller attack surface, not for a larger one.
- **Discovery: the real cost.** `fetchUserPortfolios` works by intersecting "what
  this user can reach" with "where the App is installed", and a non-collaborator
  reaches nothing. That path has to be rebuilt on `GET /app/installations` with
  the App JWT, reading each roster — fine at cohort scale, needs caching at
  provider scale. This, not security posture, is what makes the roster model more
  work.
- **Ownership: preserved.** Which was the premise of asking.

So the choice is less lopsided than §1 might suggest. The org model buys
GitHub-enforced boundaries and cheap discovery, and costs the learner their
repository. The roster model keeps the learner's repository and costs a
discovery rewrite. Pick on whether learner ownership matters to the programme,
because on security posture they are closer than they look.

---

## References

The three claims this document rests on, with sources, since each one is load
bearing and each is easy to get wrong from memory:

- [Permission levels for a personal account repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository)
  — "In a private repository, repository owners can only grant write access to
  collaborators. Collaborators can't have read-only access to repositories owned
  by a personal account." This is why the model needs an organisation at all.
- [Repository roles for an organization](https://docs.github.com/organizations/managing-user-access-to-your-organizations-repositories/repository-roles-for-an-organization)
  — Read, Triage, Write, Maintain, Admin.
- [REST API endpoints for collaborators](https://docs.github.com/en/rest/collaborators/collaborators)
  — "The `permission` attribute provides the legacy base roles of `admin`,
  `write`, `read`, and `none`, where the `maintain` role is mapped to `write`
  and the `triage` role is mapped to `read`. The `role_name` attribute provides
  the name of the assigned role, including custom roles." This is §1.5.
- [Setting base permissions for an organization](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/setting-base-permissions-for-an-organization)
  — base permissions apply to all members across all repositories, and not to
  outside collaborators.
