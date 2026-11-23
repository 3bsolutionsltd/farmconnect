# FarmConnect Nursery Network Integration Specification

## 1. Purpose

FarmConnect Nursery Network is the first ecosystem module of FarmConnect. It extends the existing produce-contract MVP into a broader agricultural operating system without creating a separate marketplace, account system, or API.

The initial pilot is focused on nursery discovery and seedling procurement in Lira. The design must support later agricultural suppliers, products, locations, orders, fulfilment, payments, messaging, and Nexus Agriculture Workforce services.

## 2. Current baseline

The current repository is a small PHP/MySQL application with a plain HTML/CSS/JavaScript client.

| Area | Current implementation | Integration implication |
| --- | --- | --- |
| Web client | `index.html`, `app.js`, `app.css` with localStorage demo state | Add a Nursery Network workspace and migrate production workflows to the API incrementally |
| API | PHP 8.2, PDO, `/api/v1`, bearer tokens and sessions | Extend the existing versioned API; do not create a second service for nursery operations |
| Identity | `users` with `buyer`, `farmer`, `admin` roles | Preserve existing roles and add supplier capabilities through organisations/memberships |
| Marketplace core | `demands`, `offers`, `contracts` | Keep this flow intact for produce contracts; do not overload it with nursery orders |
| Database | MySQL schema with no organisations, catalogue, locations, or inventory | Add shared platform tables through additive migrations |
| Local hosting | Apache rewrite plus `router.php` for PHP built-in server | Keep the same `/api/v1` URL contract locally and in production |
| Mobile contract | `openapi.yaml` | Add Nursery Network paths and schemas to the same API document |

### Architectural conclusion

The existing `farmer` role is a participant in the produce-contract workflow, not a sufficient supplier model. A nursery operator may manage several locations and may later sell inputs, equipment, or livestock. Nursery Network therefore needs a first-class `organisations` and `supplier_locations` model, with users granted capabilities through memberships rather than replacing the current user role immediately.

## 3. Product boundary

### Shared FarmConnect platform

These capabilities are shared by all future modules:

- Identity and authentication
- Organisations and memberships
- Roles, permissions, and verification
- Administrative locations and GPS coordinates
- Agricultural product catalogue
- Supplier listings and stock
- Orders, quotations, and fulfilment
- Payments and ledger integration
- Messaging, notifications, documents, and audit events
- Reporting and analytics

### Nursery Network module

The module owns the nursery-specific experience and rules:

- Nursery registration and profile
- Nursery verification submissions
- Seedling and variety listings
- Availability and pricing
- Farmer discovery and comparison
- Nursery orders and quotation requests
- Collection and delivery preferences
- Nursery fulfilment status

A nursery is a supplier type. It is not a separate user database or separate marketplace.

## 4. Users and access

| Actor | Initial capability |
| --- | --- |
| Farmer | Search nurseries and listings, view profiles, create orders or quotation requests, track purchases, review completed orders |
| Nursery operator | Register an organisation, add one or more nursery locations, submit verification, manage listings and stock, confirm orders, update fulfilment |
| FarmConnect administrator | Review supplier verification, manage catalogue taxonomy, moderate listings, manage disputes, view reports |
| Cooperative or institution | Later: purchase in bulk, request quotations, manage delivery groups and approval workflows |
| Nexus worker | Later: assist discovery, onboarding, order coordination, and advisory workflows under explicit permissions and audit logging |

For backward compatibility, existing `buyer` and `farmer` accounts continue to work. Supplier operations should require an organisation membership with a supplier capability; a farmer account can also operate a nursery without becoming a different person or losing access to contracts.

## 5. Domain model

### 5.1 Shared entities

#### `organisations`

Represents a supplier, cooperative, institution, buyer business, or FarmConnect partner.

Key fields: `id`, `type`, `legal_name`, `display_name`, `phone`, `email`, `status`, `created_at`, `updated_at`.

Initial `type` values: `supplier`, `cooperative`, `institution`, `buyer_business`, `platform_partner`.

#### `organisation_members`

Connects users to organisations.

Key fields: `organisation_id`, `user_id`, `role`, `status`, `created_at`.

Initial roles: `owner`, `manager`, `staff`, `viewer`.

#### `locations`

Stores reusable administrative and geographic location data.

Key fields: `id`, `parent_id`, `level`, `name`, `code`, `latitude`, `longitude`.

Initial levels: `district`, `subcounty`, `parish`, `village`.

#### `supplier_locations`

Connects an organisation to a physical operating location.

Key fields: `id`, `organisation_id`, `name`, `location_id`, `address`, `latitude`, `longitude`, `phone`, `status`.

#### `supplier_verifications`

Stores an auditable verification workflow rather than a single boolean.

Key fields: `id`, `organisation_id`, `supplier_location_id`, `status`, `submitted_by`, `reviewed_by`, `notes`, `reviewed_at`, `created_at`.

Statuses: `draft`, `submitted`, `under_review`, `verified`, `rejected`, `suspended`.

#### `product_categories`

Defines the shared catalogue hierarchy.

Examples: `tree seedlings`, `crop seeds`, `farm inputs`, `equipment`, `livestock`.

#### `agricultural_products`

Describes the product independently of any supplier.

Key fields: `id`, `category_id`, `name`, `description`, `unit`, `status`.

#### `product_varieties`

Describes a crop or product variety where relevant.

Key fields: `id`, `product_id`, `name`, `description`, `attributes`, `status`.

#### `supplier_listings`

States who offers which catalogue item, where, at what price, and with what availability.

Key fields: `id`, `supplier_location_id`, `product_id`, `variety_id`, `sku`, `price`, `currency`, `unit`, `available_quantity`, `minimum_quantity`, `status`, `published_at`.

#### `inventory_movements`

Provides an auditable stock history.

Key fields: `id`, `listing_id`, `movement_type`, `quantity`, `reference_type`, `reference_id`, `note`, `created_by`, `created_at`.

Movement types: `opening`, `received`, `reserved`, `released`, `adjusted`, `sold`.

### 5.2 Nursery module entities

#### `nurseries`

Stores nursery-specific profile information for an organisation and location.

Key fields: `id`, `organisation_id`, `supplier_location_id`, `operator_name`, `description`, `years_operating`, `contact_phone`, `whatsapp`, `verification_status`, `created_at`, `updated_at`.

A single organisation may own multiple nursery records at different locations.

#### `nursery_media`

Stores references to nursery and product photos. Media should use managed storage in production; the database stores metadata and URLs, not binary files.

#### `nursery_certifications`

Stores certification name, issuer, identifier, issue date, expiry date, document reference, and verification status.

### 5.3 Ordering entities

Nursery procurement should not reuse `demands`, `offers`, or `contracts`. Those entities represent funded crop production commitments and have different lifecycle rules.

#### `orders`

Key fields: `id`, `buyer_id`, `supplier_organisation_id`, `supplier_location_id`, `status`, `fulfilment_method`, `delivery_location_id`, `delivery_address`, `requested_at`, `confirmed_at`, `completed_at`.

Initial statuses: `pending_supplier`, `confirmed`, `rejected`, `ready_for_collection`, `out_for_delivery`, `received`, `cancelled`, `disputed`.

Initial fulfilment methods: `collection`, `delivery`.

#### `order_items`

Key fields: `id`, `order_id`, `listing_id`, `product_id`, `variety_id`, `quantity`, `unit_price`, `currency`, `line_total`.

The order item stores the agreed price snapshot so later listing changes do not rewrite order history.

#### `quotation_requests` and `quotations`

Quotation requests support bulk, cooperative, and institutional procurement. They should reference catalogue products and optional supplier locations while allowing quantity, delivery, and quality requirements to be negotiated.

#### `deliveries`

Tracks collection or delivery assignments, handover evidence, timestamps, and receipt confirmation. Logistics providers can be added later without changing the order contract.

#### `reviews`

Reviews attach to a completed order and supplier/listing, with moderation state and optional media references.

## 6. Release plan

### R1: Discovery and supplier registration

Outcome: farmers can find credible nursery operators in Lira.

- Add organisations, memberships, locations, supplier locations, nurseries, verification submissions, and nursery media.
- Add supplier registration and verification review flows.
- Add public nursery directory and nursery profile pages.
- Add filters for district, subcounty, parish, village, crop, variety, verification status, and availability.
- Seed Lira administrative locations and a small set of verified pilot nurseries.
- Keep ordering disabled or marked as coming soon until listings and stock are reliable.

### R2: Product repository and inventory

Outcome: suppliers can publish structured products and maintain stock.

- Add categories, agricultural products, varieties, listings, and inventory movements.
- Add supplier dashboard for listing and stock management.
- Add product detail and supplier comparison views.
- Add stock reservation rules without accepting money.

### R3: Orders and quotations

Outcome: farmers and institutions can request and confirm procurement.

- Add direct orders using published listing prices.
- Add quotation requests for bulk procurement.
- Add supplier confirmation/rejection and fulfilment milestones.
- Add collection and delivery details.
- Add receipt confirmation, cancellation, dispute, and review flows.

### R4: Payments, logistics, and Nexus assistance

Outcome: the workflow can support trusted transactions at scale.

- Integrate MTN MoMo, Airtel Money, or another approved provider through shared payment infrastructure.
- Add immutable payment ledger and verified webhooks.
- Add logistics assignment and delivery tracking.
- Add Nexus workers for discovery, supplier onboarding, and order coordination.
- Add analytics, notifications, and operational monitoring.

## 7. API integration

The API remains under `/api/v1`. Nursery paths are additive and use the same session and bearer-token authentication as the current marketplace.

### Public discovery

- `GET /api/v1/nurseries`
  - Filters: `district`, `subcounty`, `parish`, `village`, `crop`, `variety`, `verified`, `available`, `min_price`, `max_price`, `page`.
- `GET /api/v1/nurseries/{nurseryId}`
- `GET /api/v1/nurseries/{nurseryId}/listings`
- `GET /api/v1/products`
- `GET /api/v1/products/{productId}`
- `GET /api/v1/locations?level=district&parent_id=...`

### Supplier operations

- `POST /api/v1/organisations`
- `GET /api/v1/organisations/mine`
- `POST /api/v1/organisations/{organisationId}/locations`
- `POST /api/v1/nurseries`
- `PATCH /api/v1/nurseries/{nurseryId}`
- `POST /api/v1/nurseries/{nurseryId}/verification-submissions`
- `POST /api/v1/listings`
- `PATCH /api/v1/listings/{listingId}`
- `POST /api/v1/listings/{listingId}/inventory-movements`
- `GET /api/v1/supplier/orders`
- `POST /api/v1/orders/{orderId}/confirm`
- `POST /api/v1/orders/{orderId}/reject`
- `POST /api/v1/orders/{orderId}/fulfilment`

### Farmer procurement

- `POST /api/v1/orders`
- `GET /api/v1/orders`
- `GET /api/v1/orders/{orderId}`
- `POST /api/v1/orders/{orderId}/cancel`
- `POST /api/v1/orders/{orderId}/receipt`
- `POST /api/v1/quotation-requests`
- `GET /api/v1/quotation-requests`

### Administration

- `GET /api/v1/admin/verification-submissions`
- `POST /api/v1/admin/verification-submissions/{submissionId}/approve`
- `POST /api/v1/admin/verification-submissions/{submissionId}/reject`
- `POST /api/v1/admin/products`
- `PATCH /api/v1/admin/products/{productId}`
- `GET /api/v1/admin/reports/nursery-network`

All protected mutations must enforce organisation membership, role, ownership, and status transitions on the server. The browser must never be treated as the authority for stock, price, verification, or order state.

## 8. Web and mobile experience

### Web navigation

Keep the current FarmConnect shell and add a module entry rather than replacing the marketplace:

- Dashboard
- Produce marketplace
- Nursery Network
- My orders
- My contracts
- Messages

The current localStorage demo can remain available as a development fallback, but production nursery views must use the API and show loading, empty, authentication, and error states.

### Farmer journey

1. Open Nursery Network.
2. Select location and crop filters.
3. Compare verified nursery profiles and listings.
4. Open a listing and choose quantity.
5. Select collection or delivery.
6. Submit an order or quotation request.
7. Track supplier confirmation and fulfilment.
8. Confirm receipt and optionally review the supplier.

### Supplier journey

1. Register or join an organisation.
2. Add nursery location and profile.
3. Submit verification details.
4. Add products, varieties, prices, and stock.
5. Receive and confirm orders.
6. Prepare collection or delivery.
7. Mark fulfilment and respond to receipt or dispute events.

### Mobile readiness

Mobile apps consume the same OpenAPI contract. They should not depend on browser localStorage or duplicate business rules. Add the Nursery Network paths and schemas to `openapi.yaml` as each release becomes available.

## 9. Database migration strategy

1. Preserve all current tables and existing API routes.
2. Add shared identity and catalogue tables before adding orders.
3. Introduce foreign keys and indexes with explicit migration scripts rather than editing production tables manually.
4. Seed only stable catalogue categories and Lira locations; keep supplier data operationally editable.
5. Backfill no supplier records automatically from existing farmers until each operator has consented and completed onboarding.
6. Add audit events for verification, price changes, stock movements, order state changes, and administrative actions.
7. Use status transition checks in application code and, where practical, database constraints.

Recommended migration files:

- `migrations/001_platform_organisations.sql`
- `migrations/002_platform_locations.sql`
- `migrations/003_catalogue_and_listings.sql`
- `migrations/004_nursery_network.sql`
- `migrations/005_orders_and_quotations.sql`
- `migrations/006_audit_and_reviews.sql`

## 10. Verification and trust rules

- A nursery can be listed publicly before verification only if the product policy explicitly allows an `unverified` state; verified filtering must be the default for the pilot.
- Verification is an auditable workflow with reviewer, timestamp, evidence, and decision notes.
- Stock is never decremented from a browser action; reservation and sale movements happen transactionally in the API.
- Prices and quantities are snapshotted on orders.
- Supplier contact details should be protected from scraping where appropriate, with platform messaging and consent-based phone/WhatsApp display.
- Payment claims remain informational until provider webhooks are verified.
- Nexus workers may recommend, remind, or coordinate, but may not certify suppliers, approve payments, or make unsupported agronomic claims.

## 11. Acceptance criteria for the Lira pilot

R1 is ready for pilot testing when:

- A farmer can search nurseries by at least district, crop, availability, and verification status.
- A nursery operator can register one organisation with multiple nursery locations.
- An operator can submit verification evidence and an administrator can approve or reject it.
- A verified nursery has a public profile with location, contact, photos, products, and status.
- The API returns the same results to web and mobile clients.
- Existing buyer/farmer authentication and produce-contract workflows still pass regression tests.
- No payment is represented as completed without an actual payment integration.
- Lira pilot data can be exported for operational review.

## 12. Immediate implementation sequence

1. Create migration framework and add `organisations`, memberships, locations, supplier locations, nurseries, and verification tables.
2. Add server-side organisation and nursery authorization helpers.
3. Add public nursery discovery API with pagination and filters.
4. Extend `openapi.yaml` with R1 endpoints and schemas.
5. Add Nursery Network navigation and discovery views to the web client.
6. Add supplier registration and verification screens.
7. Seed Lira location data and onboard pilot nursery records.
8. Add automated API tests for discovery, authorization, verification, and regression of existing demands/offers/contracts.
9. Only then implement catalogue listings, inventory, and orders in R2.

## 13. Explicit non-goals for R1

- Online payments or escrow
- Blockchain settlement
- Full logistics marketplace
- Automated supplier certification
- Open-ended AI agricultural advice
- Replacing the existing produce-contract marketplace
- Creating a second frontend, identity store, or API
