# FarmConnect Implementation Plan

## Purpose

This plan turns `NURSERY-NETWORK-INTEGRATION.md` into an executable sequence. Work should move to the next phase only after its acceptance gate passes. Browser exploration is for validating planned behavior, not discovering the product scope during implementation.

## Current Baseline

Implemented and verified locally:

- PHP 8.2 API with PDO and MySQL through WAMP.
- Versioned `/api/v1` routing, browser sessions, and bearer-token support.
- Existing produce demands, offers, and contracts demo flow.
- Nursery organisation, location, verification, catalogue listing, inventory, and order tables.
- Public nursery discovery with live listing availability.
- Buyer registration/login and API-backed nursery order creation.
- Buyer order list and API-backed order status actions.
- OpenAPI documentation for the current API surface.

Known incomplete areas:

- Supplier onboarding is multi-request and needs reliable recovery and completion state.
- Administrator account provisioning, verification review, and a read-only supplier directory are implemented.
- Supplier catalogue screen, listing moderation, and audited stock receipt actions are implemented.
- Supplier order UI has not been tested with a real organisation member account.
- Orders still need a complete rejection, cancellation, delivery, receipt, and audit workflow.
- Supplier listing editing and movement history are implemented; authenticated lifecycle and stock conflict testing remain incomplete.
- API regression tests and browser smoke tests are missing.
- Some frontend fallback behavior is still localStorage-based.

## Delivery Rules

1. Every feature starts with an API contract, data rules, UI states, and acceptance tests.
2. Server-side authorization and state transitions are authoritative.
3. Database changes use additive numbered migrations; no manual production edits.
4. A phase is not complete when the happy path works only in one browser session.
5. LocalStorage remains a demo fallback only; production Nursery Network data uses the API.
6. Payments are never represented as completed until a provider webhook is verified.

## Phase 0: Engineering Foundation

### Scope

- Confirm environment setup for WAMP MySQL, PHP, and the local router.
- Add a repeatable migration runner or documented migration command.
- Establish API test fixtures and isolated test data.
- Add a test account strategy for buyer, supplier member, admin, and unauthenticated requests.
- Add structured API error responses and request correlation/logging conventions.
- Complete OpenAPI coverage for every implemented endpoint.

### Gate

- Fresh local database can be created from `schema.sql` and migrations in order.
- Health, authentication, and one existing produce-contract regression test pass.
- Tests can create and clean buyer, supplier, and admin fixtures without relying on browser localStorage.

## Phase 1: Nursery Discovery and Supplier Registration (R1)

### Scope

- Public nursery directory and profile pages.
- Location, crop, variety, verification, and availability filters.
- Authenticated supplier onboarding: account, organisation, location, nursery, and verification submission.
- Administrator account provisioning and admin-only verification queue.
- Approve/reject actions with notes, reviewer, timestamp, and status history.
- Supplier profile completion and pending-verification status screen.
- Lira pilot seed data and exportable operational report.

### Required API behavior

- Organisation membership is created transactionally with organisation creation.
- Supplier location and nursery creation are recoverable if a later onboarding step fails.
- Verification submission is idempotent or clearly prevents duplicate active submissions.
- Public discovery defaults to verified, active, available suppliers.
- Admin endpoints require `admin` role and record decisions.

### Gate

- A new supplier can complete onboarding from a clean account.
- An admin can see the submission, approve it, and the nursery becomes discoverable.
- A rejected nursery remains hidden and can resubmit according to policy.
- Unauthorized users cannot approve, modify, or view protected supplier records.
- API tests cover registration, membership authorization, verification transitions, and discovery filters.

## Phase 2: Catalogue and Inventory (R2)

### Scope

- Supplier dashboard for listings, prices, varieties, minimum quantities, and stock.
- Product and variety management using shared catalogue entities.
- Inventory movement history: opening, received, reserved, released, adjusted, sold.
- Listing detail and supplier comparison views.
- Transactional reservation and release rules.
- Stock conflict and insufficient-stock handling.

### Gate

- Supplier can publish, edit, pause, and replenish a listing.
- Buyer sees only published listings and current available quantity.
- Concurrent orders cannot reserve more stock than is available.
- Every stock change has an auditable movement record.
- API and browser tests cover listing lifecycle and reservation failure paths.

## Phase 3: Orders and Procurement (R3)

### Scope

- Buyer order history from the API, including detail view.
- Supplier incoming-order dashboard from the API.
- Confirm, reject, cancel, ready-for-collection, out-for-delivery, received, and disputed states.
- Collection and delivery address validation.
- Order and item price snapshots.
- Supplier and buyer notifications or visible activity history.
- Quotation requests for bulk, cooperative, and institutional procurement.
- Audit events for every order state change.

### State rules

```text
pending_supplier -> confirmed | rejected | cancelled
confirmed -> ready_for_collection | out_for_delivery | cancelled
ready_for_collection -> received | disputed
out_for_delivery -> received | disputed
received -> reviewed
```

The API must reject invalid transitions and enforce buyer, supplier-member, and administrator permissions independently of browser state.

### Gate

- Buyer and supplier can complete a collection order using separate authenticated accounts.
- Delivery orders require delivery details and use delivery-specific states.
- Rejected, cancelled, disputed, and received orders have correct ownership and audit records.
- Stock reservation and release behavior matches the order state.
- API contract tests cover every allowed and rejected transition.

## Phase 4: Operations and Trust

### Scope

- Administrator reports for suppliers, listings, orders, stock, and verification.
- Audit log viewer and export.
- Reviews after receipt with moderation state.
- Dispute handling and operational notes.
- Notifications and message/event infrastructure.
- Media metadata and managed storage integration.

### Gate

- Operational staff can investigate a supplier or order from its audit trail.
- Sensitive supplier contact data follows access and consent rules.
- Reports reconcile with source orders, listings, and inventory movements.

## Phase 5: Payments, Logistics, and Mobile Clients

### Scope

- Payment provider integration with verified webhooks.
- Immutable payment ledger and reconciliation.
- Delivery assignment and tracking.
- Mobile clients consuming the same OpenAPI contract.
- Nexus worker permissions, recommendations, and audit controls.

### Gate

- No payment is marked complete without a verified provider event.
- Web and mobile clients observe the same server-side order and stock rules.
- Mobile authentication uses bearer tokens without browser localStorage dependencies.

## Immediate Work Queue

1. Add admin fixture/provisioning and verification queue endpoints/UI.
2. Add API regression test harness and fixtures for buyer, supplier member, and admin.
3. Finish supplier onboarding recovery and pending-status UI.
4. Create a dedicated supplier account linked to the Lira pilot organisation for end-to-end testing.
5. Complete supplier order actions and validate confirm/reject/ready with separate sessions.
6. Add listing and inventory management screens.
7. Expand order state machine, cancellation, delivery, receipt, dispute, and audit events.
8. Replace remaining production nursery localStorage paths with API-backed loading and explicit loading/error states.

## Definition Of Done

A feature is complete only when its migration, API authorization, OpenAPI contract, web states, automated tests, browser smoke path, and failure behavior are all implemented and documented. A successful click in one local browser session is evidence, not completion.