# Initial administrator bootstrap

Use this one-time command only after the owner controls the target production database and the mailbox for the administrator account. It does not deploy the application or send an email.

## Preconditions

- Use Node 24 on a trusted maintenance host and a private operator shell.
- Confirm the active production `MONGODB_URI` points to the intended Atlas database. The URI must not be printed or copied into chat, shell history, tickets, or Git.
- Production environment validation must pass, including HTTPS `PUBLIC_WEB_URL`, secure cookies, `CSRF_SECRET`, and the stable `OUTBOX_ENCRYPTION_KEY`.
- Obtain the administrator name, email, and a unique password through the operator's approved secret-handling process. The bootstrap password is read from the process environment and is never printed by the script.
- Confirm that the owner controls the normalized email address. The confirmation is required because the account is created with `emailVerifiedAt` set so it can sign in without public registration or an unverified admin exception.

## Run once

Set these process environment values through the host's secret manager or an interactive shell process. Do not add the one-time password to `.env`, a command argument, `VITE_*`, or a checked-in file:

| Variable | Value |
| --- | --- |
| `BOOTSTRAP_ADMIN_NAME` | Owner-approved administrator display name |
| `BOOTSTRAP_ADMIN_EMAIL` | Administrator email address |
| `BOOTSTRAP_ADMIN_PASSWORD` | Unique password meeting the account's 12–128 character rule |
| `BOOTSTRAP_ADMIN_CONFIRM_EMAIL` | The exact normalized value of `BOOTSTRAP_ADMIN_EMAIL` |
| `BOOTSTRAP_ADMIN_CONFIRM_DATABASE` | The exact database name in `MONGODB_URI` |

Then run from the repository root:

```powershell
node backend/src/scripts/bootstrap-admin.js
```

The script requires `NODE_ENV=production`, checks both confirmations against the connected database and normalized email, creates the declared user/guard/audit indexes, and uses the existing active-admin transaction guard. It refuses to create another admin if any `admin` account already exists, including a blocked account. The created record uses the frozen `admin` role and `active` status, hashes the password with Argon2id, and writes `identity.admin.bootstrap` to the audit log in the same transaction. It never prints the email or password.

After success, remove all five one-time bootstrap environment values from the process/secret manager. Sign in through the normal website, verify the account has the intended owner access, and retain the audit event. Do not rerun the command as a recovery shortcut.

## Failure and recovery

- If the command reports `An administrator account already exists`, use the normal authenticated admin/appeal process. This bootstrap script intentionally cannot promote, unblock, or replace an account.
- If connectivity or transaction outcome is ambiguous, first verify the exact target database's `users` and `audit_logs` state through the approved operator channel. Do not retry until confirming whether the transaction committed.
- If every administrator is inaccessible, stop and follow the project owner's documented break-glass and database recovery process. That process must verify owner identity, preserve audit history, restore access with a controlled operator, and be rehearsed before production readiness. This repository does not automate that exceptional recovery.
- Test this procedure only on a dedicated local replica-set test database before owner execution. The repository test never connects to Atlas and drops only its generated database.
