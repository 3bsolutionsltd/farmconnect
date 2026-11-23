# FarmConnect Test Plan

## Test environment

- Local URL: `http://127.0.0.1:8080`
- API base: `http://127.0.0.1:8080/api/v1`
- Database: local MySQL configured by `config.local.php`
- Required migrations: `001` through `005`
- Browser tests must use `127.0.0.1` consistently; do not switch to `localhost` during an authentication flow.
- Use disposable test accounts and never place passwords or tokens in this document.

## Status legend

- PASS: executed successfully in the current environment
- READY: test is defined but requires a specific authenticated account or business action
- BLOCKED: prerequisite is missing

## Automated and API checks

| ID | Area | Test | Expected result | Status |
| --- | --- | --- | --- | --- |
| API-001 | Runtime | Run PHP lint on `api/bootstrap.php`, `api/index.php`, and `config.local.php` | No syntax errors | PASS |
| API-002 | Runtime | Run `node --check app.js` | JavaScript parses successfully | PASS |
| API-003 | Contract | Parse `openapi.yaml` with PyYAML | YAML parses successfully | PASS |
| API-004 | Health | `GET /api/v1/health` | HTTP 200 and `ok=true` | PASS |
| API-005 | Catalogue | `GET /api/v1/products` | HTTP 200 and active products are returned | PASS |
| API-006 | Nursery network | `GET /api/v1/nurseries` | HTTP 200 and nursery records are returned | PASS |
| API-007 | Session | `GET /api/v1/auth/me` without credentials | HTTP 200 with `user=null` and empty context | PASS |
| API-008 | Auth protection | Request `/orders`, `/supplier/listings`, and `/admin/products` without credentials | HTTP 401 or 403; no protected data returned | PASS |
| API-009 | Validation | Register with invalid email or password shorter than 10 characters | HTTP 422 with validation error | PASS |
| API-010 | OIDC start | `GET /api/v1/auth/oidc/start` with Auth0 configured | HTTP 302 to the configured issuer authorization endpoint with state and nonce | PASS in browser |

## Account and identity tests

| ID | Test steps | Expected result | Status |
| --- | --- | --- | --- |
| AUTH-001 | Open `#auth`; verify sign-in mode | Email and password are visible; registration-only fields are hidden | PASS |
| AUTH-002 | Select `Create account` | Name and activity choices appear; heading and button update | PASS |
| AUTH-003 | Select buyer, supplier, and produce-contract activities together | All three checkboxes remain selected at the same time | PASS |
| AUTH-004 | Submit a valid local registration with multiple activities | Account is created; response contains user, token, and capability context | READY: end-to-end registration still needed |
| AUTH-005 | Sign in with local email/password | Session is created and `/auth/me` returns the user | PASS in browser |
| AUTH-006 | Select the external sign-in option | User is sent to the configured identity-provider page | PASS |
| AUTH-007 | Complete first-time external sign-in for a new email | FarmConnect creates one user and one external identity | READY |
| AUTH-008 | External sign-in for an email already used locally | User returns to FarmConnect and is told to sign in locally and link explicitly | PASS |
| AUTH-009 | Sign in locally, choose `Link an external sign-in`, and approve | External identity is linked to the current user; user returns to the local dashboard | PASS |
| AUTH-010 | Attempt to link an identity already owned by another user | Request is rejected with HTTP 409; no account switch occurs | READY |
| AUTH-011 | Reuse an expired or altered OIDC state | Request is rejected; no session is created | READY |
| AUTH-012 | Sign out, then use the external sign-in option again | Existing linked identity signs into the same local user | READY |

## Buyer workflow tests

| ID | Test steps | Expected result | Status |
| --- | --- | --- | --- |
| BUY-001 | Sign in as a buyer and open Marketplace | Demand list loads and buyer navigation is visible | READY |
| BUY-002 | Filter Marketplace by crop, location, and status | Results update without layout errors | READY |
| BUY-003 | Open a nursery profile with published stock | Profile and listing details load | READY |
| BUY-004 | Place an order within available stock and above minimum quantity | Order is created; stock decreases; order appears in My orders | PASS |
| BUY-005 | Place an order above available stock or below minimum quantity | Request is rejected; stock and order history remain unchanged | PASS |
| BUY-006 | Attempt buyer-only actions as an unauthenticated user | Request is rejected with HTTP 401 | PASS for route protection |
| BUY-007 | Create a crop demand with valid fields | Demand is created and visible in Marketplace | READY |
| BUY-008 | Submit invalid demand data | HTTP 422; no partial demand is created | READY |

## Supplier workflow tests

Use an account with `supplier.catalogue` and an active organisation membership.

| ID | Test steps | Expected result | Status |
| --- | --- | --- | --- |
| SUP-001 | Open Supplier Catalogue | Supplier catalogue, locations, organisations, and listings load | PASS |
| SUP-002 | Create a second supplier location | Location is created under the selected organisation | READY |
| SUP-003 | Submit a nursery profile for review | Nursery and verification submission are created | READY |
| SUP-004 | Create a draft listing | Listing is saved as draft and is not public | PASS |
| SUP-005 | Publish a listing with valid price and stock | Listing becomes visible in the public nursery view | PASS |
| SUP-006 | Edit price, unit, and minimum order | Listing values update without changing ownership | READY |
| SUP-007 | Receive stock | Available stock increases and a movement event is recorded | PASS |
| SUP-008 | Release stock | Available stock increases according to the corrected release semantics | PASS |
| SUP-009 | Adjust stock | Available stock becomes the supplied total and an adjustment event is recorded | PASS |
| SUP-010 | Pause and republish a listing | Public visibility follows listing status | READY |
| SUP-011 | View inventory history | Movement types, quantities, notes, actor, and timestamps are shown | READY |
| SUP-012 | Access supplier routes without supplier capability | HTTP 403; no supplier data is returned | PASS for route protection |

## Order and fulfilment tests

| ID | Test steps | Expected result | Status |
| --- | --- | --- | --- |
| ORD-001 | Supplier views incoming orders | Orders for supplier listings are visible | PASS |
| ORD-002 | Supplier confirms an order | Status changes and an order event is recorded | PASS |
| ORD-003 | Supplier rejects an order | Status changes and stock is handled according to the business rule | PASS |
| ORD-004 | Buyer cancels an eligible order | Cancellation is recorded and stock is restored where applicable | PASS |
| ORD-005 | Read order event history | Events are returned in chronological order with actor and status transition | PASS |
| ORD-006 | Submit two orders competing for the last stock concurrently | Only valid quantities are accepted; stock never becomes negative | PASS |

## Produce-contract tests

| ID | Test steps | Expected result | Status |
| --- | --- | --- | --- |
| CON-001 | Buyer creates a demand | Demand has open status and buyer ownership | READY |
| CON-002 | Farmer submits an offer | Offer is associated with the demand and farmer | READY |
| CON-003 | Buyer accepts one offer | Selected offer is accepted, other offers are rejected, and a contract is created | READY |
| CON-004 | Non-owner attempts to view or accept an offer | HTTP 403 or 404; no contract changes | READY |
| CON-005 | Buyer and farmer open Contracts | Each participant sees only their own contracts | READY |
| CON-006 | User with multiple capabilities uses both order and contract flows | Both workflows are available in the same session | READY |

## Administrator tests

Use an account with `admin` compatibility role and admin capabilities.

| ID | Test steps | Expected result | Status |
| --- | --- | --- | --- |
| ADM-001 | Open verification queue | Pending submissions are listed | PASS |
| ADM-002 | Approve and reject verification submissions | Status changes once and duplicate decisions are rejected | PASS |
| ADM-003 | Change organisation status | Only valid transitions are accepted | PASS |
| ADM-004 | Suspend and reactivate an organisation member | Membership status changes and access follows it | PASS |
| ADM-005 | Publish, pause, and archive supplier listings | Public catalogue visibility follows moderation status | PASS |
| ADM-006 | Create a product and variety | Product appears in supplier catalogue choices | PASS |
| ADM-007 | Access admin routes as buyer or supplier | HTTP 403; no admin data is returned | PASS for route protection |

## Security and deployment checks

| ID | Test | Expected result | Status |
| --- | --- | --- | --- |
| SEC-001 | Verify `config.local.php` is not committed or publicly downloadable | Credentials remain server-side | READY |
| SEC-002 | Verify Auth0 callback URL exactly matches the local or production URL | No callback mismatch | PASS locally |
| SEC-003 | Alter OIDC state, nonce, issuer, audience, expiry, or signature | Callback rejects the token | READY: procedure below |
| SEC-004 | Verify bearer tokens work for mobile API requests | Valid token authenticates; expired or altered token is rejected | PASS |
| SEC-005 | Verify logout removes the web session and bearer token | Both access paths stop working | PASS |
| SEC-006 | Submit unexpected capability codes during registration | Unknown or admin capabilities are ignored | READY |
| SEC-007 | Repeat requests after permission removal | Access is denied immediately | READY |
| SEC-008 | Confirm database backups include migrations and operational data | Restore procedure is documented and tested | READY: procedure below |

## How to run the remaining uncertain checks

### API and syntax checks

From the repository root, run:

```powershell
php -l api/bootstrap.php
php -l api/index.php
php -l config.local.php
node --check app.js
python -c "import yaml; yaml.safe_load(open('openapi.yaml', encoding='utf-8')); print('OpenAPI valid')"
```

Then verify the public API:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/v1/health
Invoke-RestMethod http://127.0.0.1:8080/api/v1/products
Invoke-RestMethod http://127.0.0.1:8080/api/v1/nurseries
Invoke-RestMethod http://127.0.0.1:8080/api/v1/auth/me
```

Expected results are syntax success, valid OpenAPI, HTTP 200 for each endpoint, and an unauthenticated `user: null` response from `auth/me`.

### Local and external authentication

For local authentication, use a disposable account in the FarmConnect form, sign in, then call `GET /api/v1/auth/me` in the browser or inspect the account page. Confirm the returned user email, role, capabilities, and organisations match the account.

For external authentication, select **Continue with another sign-in option**, complete the provider login, approve access, and confirm the browser returns to the local dashboard. Repeat after signing out to confirm the linked identity signs into the same user.

### OIDC security validation

Start a sign-in attempt, then change one character in the callback URL `state` value before loading it. The API must return HTTP 400 and must not create a session. Do not manually forge ID tokens in the browser. Issuer, audience, nonce, expiry, and signature checks should be covered with a controlled automated fixture before production deployment.

### Deployment and backup recovery

1. Export the production MySQL database from phpMyAdmin or the hosting backup tool.
2. Restore it into a separate empty test database.
3. Point a non-public test copy of `config.local.php` at the restored database.
4. Run the health, products, nurseries, and auth/me checks.
5. Confirm `migrations/005_identity_and_capabilities.sql` tables exist and linked external identities remain present.
6. Confirm `config.local.php` cannot be downloaded through the web server.
7. Record the backup date, restore duration, database version, and test result.

## Recommended execution order

1. Run API-001 through API-010 after every backend change.
2. Complete AUTH-004 through AUTH-012 with disposable buyer and supplier accounts.
3. Run BUY tests using existing published nursery stock.
4. Run SUP tests with one supplier organisation and at least two locations.
5. Run ORD and CON tests with separate buyer and supplier accounts.
6. Run ADM tests with a separate administrator account.
7. Finish SEC tests before production deployment.

Record the date, account type, test ID, result, and any created record IDs for every READY test. Do not record passwords, client secrets, bearer tokens, or authorization codes.
