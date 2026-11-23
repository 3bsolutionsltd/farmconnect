# FarmConnect production setup

This project now has a Hostinger-compatible PHP 8.2 and MySQL backend boundary. The browser demo remains available while the API is configured. The API is same-origin for the web client and exposes a versioned bearer-token contract for future Android, iOS, Flutter, or React Native clients.

## 1. Create the database

In Hostinger hPanel:

1. Create a MySQL database, database user, and strong password.
2. Grant the user full privileges on that database.
3. Open phpMyAdmin for the new database.
4. Import `schema.sql` from this project.
5. Import `migrations/001_nursery_network.sql` to enable the Nursery Network R1 tables.
6. Import `migrations/002_lira_pilot_seed.sql` to add initial Lira locations and catalogue categories.
7. Import `migrations/003_orders_and_quotations.sql` before enabling procurement workflows.
8. Import `migrations/004_order_events.sql` before enabling order history and lifecycle actions.
9. Import `migrations/005_identity_and_capabilities.sql` before enabling multi-function accounts or external identity providers.

If the database was already created from an earlier version, run the `api_tokens` table addition from `schema.sql` before enabling mobile clients.

For local browser testing, create `config.local.php` from `config.local.php.example`, import `schema.sql` into MySQL, and run:

```powershell
php -S 127.0.0.1:8080 router.php
```

The local router preserves the production URL shape, including `/api/v1/health`.

## 2. Configure the server

Set these PHP environment variables if Hostinger exposes them:

```text
FC_APP_ENV=production
FC_APP_URL=https://farmconnect.3bs.ltd
FC_DB_HOST=localhost
FC_DB_PORT=3306
FC_DB_NAME=your_database_name
FC_DB_USER=your_database_user
FC_DB_PASSWORD=your_database_password
FC_SESSION_NAME=farmconnect_session
# Configure these only after selecting and registering an OIDC provider:
FC_OIDC_ISSUER=https://your-identity-provider.example
FC_OIDC_CLIENT_ID=your-client-id
FC_OIDC_CLIENT_SECRET=your-client-secret
FC_OIDC_REDIRECT_URI=https://farmconnect.3bs.ltd/api/v1/auth/oidc/callback
```

Prefer server environment variables. Otherwise, create `config.local.php` in the application root from `config.local.php.example`, replace every placeholder, and keep the file blocked by `.htaccess`. The API reads this file from the application root; do not assume it will find a file placed elsewhere. Never upload the example file as live configuration.

## 3. Upload the application

Upload these runtime files to the domain document root:

- `index.html`
- `app.js`
- `app.css`
- `api/`
- `.htaccess`

Import `schema.sql` and the numbered migration files through phpMyAdmin, then keep those SQL files off the public web root. The `.htaccess` rules deny requests for `config.local.php` and SQL files as a fallback; server environment variables are preferred for production secrets.

## Identity providers and multi-function accounts

FarmConnect keeps local email/password authentication while adding external identities as links to an existing user. An external identity is identified by its provider and immutable subject, not by email alone. Account linking must be an authenticated, explicit action; do not silently merge accounts based only on matching email addresses.

The `external_identities` table is the persistence boundary for an OpenID Connect integration. The callback implementation must validate state, nonce, redirect URI, issuer, signature, audience, and token expiry before linking or signing in a user. Provider secrets belong in environment variables and must never be committed.

### Auth0 configuration

Create an Auth0 Regular Web Application and register the exact callback URL configured below. Set these server-side environment variables:

```text
FC_OIDC_ISSUER=https://your-tenant.eu.auth0.com
FC_OIDC_CLIENT_ID=your-auth0-client-id
FC_OIDC_CLIENT_SECRET=your-auth0-client-secret
FC_OIDC_REDIRECT_URI=https://your-domain.example/api/v1/auth/oidc/callback
FC_APP_URL=https://your-domain.example
```

Auth0 discovery and JWKS endpoints are obtained from the issuer at runtime. The callback creates a buyer account with the default buyer capability for a new Auth0 identity; the user can then add supplier or produce-contract activities through the normal account onboarding. If the email already belongs to a local account, sign-in is rejected until an explicit account-linking flow is added.

The `user_capabilities` table allows one person to hold several capabilities at once, while `organisation_members` continues to scope supplier actions to a specific organisation. Existing `buyer`, `farmer`, and `admin` roles remain as compatibility projections during migration. The `/api/v1/auth/me` response exposes `context.capabilities` and `context.organisations`.

## 4. Smoke-test the API

From a browser or PowerShell, confirm the health endpoint:

```powershell
Invoke-RestMethod https://farmconnect.3bs.ltd/api/v1/health
```

Expected response:

```json
{"ok":true,"service":"farmconnect-api"}
```

## 5. Automated deployment from GitHub

The repository includes two GitHub Actions workflows:

- `.github/workflows/deploy.yml` validates PHP and JavaScript, uploads the runtime application over SSH after every push to `main`, and verifies the production health endpoint.
- `.github/workflows/migrate.yml` is manual-only and applies the base schema plus numbered migrations over SSH. It records completed files in a `farmconnect_migrations` table, so rerunning it skips completed files. Review the SQL and take a database backup before running it.

The deploy workflow uploads to:

```text
/home/u266222025/domains/3bs.ltd/public_html/farmconnect
```

It intentionally does not upload `config.local.php`, `.env`, SQL files, migrations, or `vendor/`. The production configuration remains on the server.

### GitHub setup

1. Push this project to the private repository `3bsolutionsltd/farmconnect`.
2. In **Settings > Secrets and variables > Actions**, add:
   - `HOSTINGER_SSH_HOST`: Hostinger SSH hostname.
   - `HOSTINGER_SSH_USER`: SSH username.
   - `HOSTINGER_SSH_PRIVATE_KEY`: the complete private key used by GitHub Actions.
   - `HOSTINGER_SSH_KNOWN_HOSTS`: the pinned SSH host key line for the Hostinger server.
   - `HOSTINGER_SSH_PORT`: optional; Hostinger commonly uses `65002`.
3. Create a GitHub **production** environment for code deployment. Require reviewers if desired.
4. Create a **production-migrations** environment and require approval. Keep it separate from normal deployments.
5. Add the public SSH key to Hostinger’s SSH access configuration.
6. Confirm `config.local.php` on the server contains the production database credentials and is not tracked by Git.
7. Run **Run FarmConnect migrations** once from the Actions tab. Approve the `production-migrations` environment, then confirm the migration job succeeds.
8. Push to `main` and inspect the Actions run. The deployment is successful only if the final health check returns the FarmConnect API JSON response.

Do not use FTP passwords in GitHub secrets when SSH is available. Do not put database credentials, Auth0 secrets, or private keys in repository files.

Generate the pinned host-key value from a trusted connection, then store the output as the `HOSTINGER_SSH_KNOWN_HOSTS` secret:

```powershell
ssh-keyscan -p 65002 <hostinger-ssh-host>
```

Register a test account only after the database is configured:

```powershell
Invoke-RestMethod -Method Post `
  -Uri https://farmconnect.3bs.ltd/api/v1/auth/register `
  -ContentType 'application/json' `
  -Body '{"name":"Test Buyer","email":"buyer@example.com","password":"ChangeThisPassword123","role":"buyer"}'
```

## Local workflow test accounts

For local verification and supplier-order testing, provision repeatable admin and supplier accounts without storing passwords in the repository:

```powershell
$env:FC_LOCAL_ADMIN_PASSWORD = "<local-admin-password>"
$env:FC_LOCAL_SUPPLIER_PASSWORD = "<local-supplier-password>"
$env:FC_LOCAL_BUYER_PASSWORD = "<local-buyer-password>"
$env:FC_LOCAL_SUPPLIER_ORGANISATION_ID = "1"
php tools/provision-local-accounts.php
```

The script is local-only and idempotent. It creates or updates `admin@farmconnect.local`, `supplier@farmconnect.local`, and `buyer@farmconnect.local`, then links the supplier account to the selected organisation. Replace the placeholder passwords locally and never use these accounts in production.

For a persistent local setup, put the same values in the git-ignored `config.local.php` under `local_accounts`. The script reads that section automatically, so the PowerShell variables are optional overrides rather than a requirement.

To recover a local supplier account when its password is unknown, use the operator-only reset utility. Set the values in the current shell; do not put them in a tracked file:

```powershell
$env:FC_RESET_EMAIL = "supplier@example.com"
$env:FC_RESET_PASSWORD = "<new-password>"
php tools/reset-account-password.php
```

## Supplier catalogue workflow

After a supplier signs in:

1. Open **Catalogue** and choose the supplier location.
2. Select a shared product, enter price, unit, opening stock, and minimum order quantity.
3. Choose **Published** to make the listing visible in the verified Nursery Network, or save it as a draft.
4. Use the inventory actions to receive, adjust, release, or review stock movements.

Administrators create shared products and varieties from **Products**. Suppliers can only list products already present in the shared catalogue.

To add another nursery under an existing supplier organisation, use **Add nursery** from the supplier navigation. Submit the new location and profile for verification, then wait for an administrator to approve it before publishing public listings for that location.

## Mobile client integration

Use [openapi.yaml](openapi.yaml) as the contract for native or cross-platform clients. Mobile clients should:

1. Register or log in through `/api/v1/auth/register` or `/api/v1/auth/login`.
2. Store the returned `access_token` in the platform secure storage, such as Android Keystore or iOS Keychain. Do not store it in plain preferences.
3. Send `Authorization: Bearer <access_token>` on protected requests.
4. Treat `401` as an expired or revoked token and require sign-in again.
5. Use the API as the source of truth; do not duplicate marketplace or contract state locally beyond an offline cache.

The server accepts the legacy `/api/...` paths during migration, but all new clients must use `/api/v1/...`.

## Current API surface

- `GET /api/v1/health`
- `GET /api/v1/auth/me`, `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`
- `GET /api/v1/nurseries` and `GET /api/v1/nurseries/{id}` for public discovery
- `GET /api/v1/products` and `GET /api/v1/locations`
- `POST /api/v1/organisations` and `POST /api/v1/organisations/{id}/locations`
- `POST /api/v1/nurseries` and `POST /api/v1/nurseries/{id}/verification-submissions`
- `GET /api/v1/supplier/organisations`, `GET /api/v1/supplier/locations`, and `GET /api/v1/supplier/listings`
- `POST /api/v1/listings`, `PATCH /api/v1/listings/{id}`, and `POST /api/v1/listings/{id}/inventory-movements`
- `POST /api/v1/orders`, `GET /api/v1/orders`, and order lifecycle endpoints under `/api/v1/orders/{id}`
- `GET /api/v1/admin/products`, `POST /api/v1/admin/products`, and `POST /api/v1/admin/products/{id}/varieties`
- `GET /api/v1/admin/verification-submissions`, `GET /api/v1/admin/organisations`, and `GET /api/v1/admin/listings`

The legacy `/api/...` paths may remain available during migration, but all new clients and documentation should use `/api/v1/...`.

## Before accepting real money

The API currently records demand, offers, and contracts. It does not yet move or hold money. Before launch with real funds, add:

1. A regulated payment provider and webhook verification.
2. An immutable payment ledger linked to contracts.
3. Admin-only dispute and release actions.
4. Identity verification and role approval.
5. Rate limiting, login attempt protection, and error monitoring.
6. Automated database backups with a tested restore procedure.
7. HTTPS enforcement and a production monitoring alert.

Blockchain should remain an audit or settlement extension until the basic contract workflow and payment rules have been validated with real users.