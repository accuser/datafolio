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
"may force-push to `main`, rewrite history, delete every file, and alter CI".

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

function readRole(data: { permission?: string; role_name?: string }): RepoRole {
  const known = ["none", "read", "triage", "write", "maintain", "admin"];
  if (data.role_name && known.includes(data.role_name)) {
    return data.role_name as RepoRole;
  }
  // Custom role, or an older response shape: fall back to the coarse field.
  // This deliberately under-privileges rather than over-privileges.
  return (data.permission as RepoRole) ?? "none";
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
- **Free, if you already read the file.** This codebase already fetches
  `datafolio.yml` on every request to resolve the occupational standard.

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

const canRead   = (a: Actor) => a.role !== "none";
const canReview = (a: Actor) => ["triage", "write", "maintain", "admin"].includes(a.role);
```

Note that `canRead` and `canReview` are functions of the GitHub role alone,
while everything the subject owns is a function of `isSubject` alone. The two
axes are independent, and that is what makes the table below expressible.

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
  highest GitHub role on their own repo.** Self-review is the rule most likely
  to be quietly lost in a refactor, because the GitHub permission says yes and
  only policy says no. It wants a test that survives the mechanism changing.
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

### 2.2 Two pre-existing gaps this surfaces

Independent of the org migration, and worth fixing either way:

1. **`POST /api/evidence` has no subject check.** It gates on `canWrite` only,
   so a reviewer can create evidence in a learner's portfolio. Deleting is
   blocked (`canDeleteEvidence`) and cards are blocked (`canWriteCards`), but
   creating is not. Under the looser role gate this model introduces, that gap
   widens, so it needs `canCreateEvidence(isSubject)`.
2. **`validateEvidencePatch` is asymmetric.** It stops a learner writing
   `feedback` (`lib/data/validation.ts:170`) but nothing stops a reviewer
   patching `title`, `url`, `note` or `ksbIds`. The learner-side rule exists; its
   mirror does not.

Also cosmetic but telling: `canWrite` tests for `"maintain"` in the `permission`
field, a value that field never returns (§1.5). Dead branch today; a real bug
the moment Maintain is granted to anyone.

### 2.3 Changes by file

| File | Change |
| --- | --- |
| `lib/github/app.ts` | Replace `canRead`/`canWrite` with one `resolveRole()` returning a `RepoRole` from `role_name`. |
| `lib/standards/manifest.ts` | Parse `learner:` alongside `standard:`. Return it unresolved-but-present so the caller can fail closed; do **not** give it the standard's forgiving fallback. |
| `lib/github/request-context.ts` | `isOwner` → `isSubject`, from the manifest. Carry `role` on `RepoContext`. Refuse writes when the subject is unresolvable. |
| `lib/data/authz.ts` | Rename `isOwner` → `isSubject` throughout. Add `canCreateEvidence`, `canEditEvidenceContent`, `canReview`. One test per cell of §1.7. |
| `lib/data/validation.ts` | Take `isSubject`; add the reviewer-cannot-edit-content mirror to the existing learner-cannot-write-feedback rule. |
| `app/api/evidence/route.ts`, `app/api/evidence/[id]/route.ts` | Drop the three `canWrite` calls; apply the authz rules instead. |
| `lib/github/portfolios.ts` | Filter on org + name prefix rather than exact repo name. Label roles from the name convention, documented as cosmetic. |
| `lib/github/config.ts` | `DATAFOLIO_REPO_NAME` → `DATAFOLIO_ORG` + `DATAFOLIO_REPO_PREFIX`. |
| `lib/session.ts` | No logic change, but re-check the `MAX_PORTFOLIOS` budget: names grow from a shared constant to `portfolio-<login>`, so entries get bigger. `fitToCookie` already measures rather than guesses, so this degrades safely. |
| `docs/github-app.md` | Rewrite §3 and §4 for org onboarding and Triage reviewers. |

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
  : login.toLowerCase() === owner.toLowerCase();
```

This keeps both models working simultaneously, which is what lets the migration
proceed repo by repo instead of as one cutover. It also, deliberately, is not
fail-closed — so it is a temporary state to leave behind, and the comment should
say so.

### 2.5 Migration order

The sequence is constrained at two points; the rest is flexible.

1. Create the org. Base permission `None`, member repo deletion off.
2. Install the App on the org.
3. Transfer each learner repo in. History, issues and stars survive, and GitHub
   redirects the old URL. **Verify the learner's resulting role explicitly** —
   do not assume the transfer left them where you want them.
4. Rename to `portfolio-<login>`.
5. Add `learner:` to each `datafolio.yml`.
6. **Deploy the code.** Must come after (5): the new code resolves the subject
   from the manifest, so deploying first would leave every portfolio without a
   subject.
7. **Downgrade reviewers** from collaborator-write to Triage. Must come after
   (6): the new code accepts Triage, the old code does not, so downgrading first
   locks every reviewer out until the deploy lands.

Steps 1–5 are per-repo and can run incrementally with the transitional fallback
from §2.4 in place. Steps 6 and 7 are the ordered pair.

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

If learner ownership is a hard requirement, this model is the wrong one, and the
alternative is to drop collaborators entirely and hold the reviewer roster in
the repo itself — stronger protection and personal ownership preserved, at the
cost of rebuilding discovery and making the application the only boundary.

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
