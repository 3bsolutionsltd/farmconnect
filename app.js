const STORAGE_KEY = "farmconnect-mvp-v1";

const seedData = {
  role: "buyer",
  demands: [
    { id: "D-1042", crop: "Fresh tomatoes", quantity: 1200, unit: "kg", price: 2400, location: "Kampala", delivery: "2026-10-18", buyer: "Green Basket Foods", status: "Open", offers: [{ id: "O-1", farmer: "Amina Farm", quantity: 1200, price: 2350, note: "Ready to plant this week." }, { id: "O-2", farmer: "Kato Growers", quantity: 800, price: 2400, note: "Can deliver in two batches." }, { id: "O-3", farmer: "Wakiso Fields", quantity: 600, price: 2300, note: "Inspected irrigation available." }] },
    { id: "D-1041", crop: "Irish potatoes", quantity: 800, unit: "kg", price: 1800, location: "Mbarara", delivery: "2026-10-30", buyer: "Nile Fresh Processors", status: "Open", offers: [{ id: "O-4", farmer: "Mbarara Co-op", quantity: 800, price: 1750, note: "Grade A supply." }] },
    { id: "D-1039", crop: "Cooking bananas", quantity: 500, unit: "bunches", price: 9500, location: "Wakiso", delivery: "2026-11-06", buyer: "Kawa Market", status: "In contract", offers: [] }
  ],
  contracts: [
    { id: "FC-2026-008", demand: "Fresh tomatoes", farmer: "Amina Farm", buyer: "Green Basket Foods", quantity: "1,200 kg", value: "UGX 2,880,000", status: "Production", step: 2, updated: "Crop planted and first inspection passed." }
  ],
  nurseries: [
    { id: "N-001", name: "Lira Greenlife Nursery", location: "Lira City", district: "Lira", operator: "Betty Acan", crops: "Coffee, avocado, mango", varieties: "Arabica · Hass · Tommy Atkins", price: 1800, stock: 12000, verified: true, description: "Healthy grafted fruit seedlings and coffee plantlets prepared for the Lira planting season." },
    { id: "N-002", name: "Northern Seedling Centre", location: "Ojwina", district: "Lira", operator: "Patrick Okwir", crops: "Coffee, eucalyptus, citrus", varieties: "Robusta · Eucalyptus grandis · Valencia", price: 900, stock: 8500, verified: true, description: "Commercial and community nursery supplying established seedlings for smallholder farmers and programmes." },
    { id: "N-003", name: "Adekokwok Growers Hub", location: "Adekokwok", district: "Lira", operator: "Grace Anyango", crops: "Avocado, mango, cocoa", varieties: "Fuerte · Kent · Local cocoa", price: 1500, stock: 4200, verified: false, description: "A growing local nursery currently completing FarmConnect verification." }
  ],
  orders: []
};

const demoMode = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const storedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
const state = demoMode ? (storedState || seedData) : { role: "buyer", demands: [], contracts: [], nurseries: [], orders: [] };
state.demands.forEach(demand => {
  if (!Array.isArray(demand.offers)) {
    demand.offers = Array.from({ length: Number(demand.offers) || 0 }, (_, index) => ({ id: `O-${index + 10}`, farmer: "Network farmer", quantity: demand.quantity, price: demand.price, note: "Offer submitted through FarmConnect." }));
  }
});
if (!Array.isArray(state.nurseries)) state.nurseries = seedData.nurseries;
if (!Array.isArray(state.orders)) state.orders = [];
if (!Array.isArray(state.apiNurseries)) state.apiNurseries = null;
if (!state.apiNurseryStats || typeof state.apiNurseryStats !== "object") state.apiNurseryStats = null;
if (!Array.isArray(state.apiOrders)) state.apiOrders = null;
if (!Array.isArray(state.adminVerifications)) state.adminVerifications = null;
if (!Array.isArray(state.adminOrganisations)) state.adminOrganisations = null;
if (!Array.isArray(state.adminListings)) state.adminListings = null;
if (!Array.isArray(state.adminProducts)) state.adminProducts = null;
if (!Array.isArray(state.adminProductCategories)) state.adminProductCategories = null;
if (!Array.isArray(state.supplierProducts)) state.supplierProducts = null;
if (!Array.isArray(state.supplierLocations)) state.supplierLocations = null;
if (!Array.isArray(state.supplierListings)) state.supplierListings = null;
if (!Array.isArray(state.supplierOrganisations)) state.supplierOrganisations = null;
if (!state.supplierMovementHistory || typeof state.supplierMovementHistory !== "object") state.supplierMovementHistory = {};
if (!Object.prototype.hasOwnProperty.call(state, "catalogueDialog")) state.catalogueDialog = null;
if (!Object.prototype.hasOwnProperty.call(state, "user")) state.user = null;
if (!state.userContext || typeof state.userContext !== "object") state.userContext = { capabilities: [], organisations: [] };
if (!Object.prototype.hasOwnProperty.call(state, "authNotice")) state.authNotice = null;
if (!Object.prototype.hasOwnProperty.call(state, "landingAuthModal")) state.landingAuthModal = false;
if (!Object.prototype.hasOwnProperty.call(state, "assistantOpen")) state.assistantOpen = true;
if (!Array.isArray(state.assistantMessages)) state.assistantMessages = [{ from: "assistant", text: "Hello. I am Farmy, your FarmConnect assistant. How can I help today?" }];
const app = document.querySelector("#app");

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function money(value) { return `UGX ${Number(value).toLocaleString()}`; }
function esc(value) { return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
function nurseryRecords() { return Array.isArray(state.apiNurseries) ? state.apiNurseries : state.nurseries; }
function hasCapability(capability) {
  if (Array.isArray(state.userContext?.capabilities) && state.userContext.capabilities.length) return state.userContext.capabilities.includes(capability);
  if (capability.startsWith("supplier.")) return state.user?.role === "farmer" || state.role === "farmer";
  if (capability.startsWith("buyer.")) return state.user?.role === "buyer" || state.role === "buyer";
  return state.user?.role === "admin";
}

async function hydrateNurseries() {
  try {
    const response = await fetch("/api/v1/nurseries");
    if (!response.ok) return;
    const payload = await response.json();
    if (!Array.isArray(payload.nurseries)) return;
    state.apiNurseryStats = payload.stats || null;
    state.apiNurseries = payload.nurseries.map(nursery => ({
      id: `API-${nursery.id}`,
      apiId: nursery.id,
      listingId: Number(nursery.order_listing_id || 0),
      name: nursery.nursery_name,
      location: nursery.location_name || nursery.administrative_location || "Lira",
      district: nursery.administrative_location || "Lira",
      operator: nursery.operator_name,
      crops: nursery.products || "Catalogue products",
      varieties: nursery.products || "",
      price: Number(nursery.starting_price || 0),
      stock: Number(nursery.available_quantity || 0),
      verified: nursery.verification_status === "verified",
      description: nursery.description || "Verified FarmConnect nursery supplier."
    }));
    save();
    if (location.hash === "#nursery-network" || location.hash.startsWith("#order-API-")) render();
  } catch (error) {
    // The local demo remains usable when the API or database is unavailable.
  }
}

async function hydrateNurseryDetails(nursery) {
  if (!nursery?.apiId || Array.isArray(nursery.listings)) return;
  try {
    const response = await fetch(`/api/v1/nurseries/${nursery.apiId}`, { credentials: "same-origin" });
    if (!response.ok) return;
    const payload = await response.json();
    nursery.listings = Array.isArray(payload.nursery?.listings) ? payload.nursery.listings : [];
    save();
    if (location.hash === `#order-${nursery.id}` || location.hash === `#nursery-${nursery.id}`) render();
  } catch (error) {
    // Keep the summary view usable when listing details are unavailable.
  }
}

async function hydrateSession() {
  try {
    const response = await fetch("/api/v1/auth/me", { credentials: "same-origin" });
    const payload = await response.json();
    state.user = payload.user || null;
    state.userContext = payload.context || { capabilities: [], organisations: [] };
    state.authNotice = payload.notice || null;
    if (state.user?.role) state.role = state.user.role;
    save();
    render();
    if (state.user) {
      hydrateOrders();
      hydrateContracts();
    }
    if (hasCapability("supplier.catalogue")) hydrateSupplierCatalogue();
    if (state.user?.role === "admin") { hydrateAdminVerifications(); hydrateAdminOrganisations(); hydrateAdminListings(); hydrateAdminProducts(); }
  } catch (error) {
    // Keep the local demo usable when the API is unavailable.
  }
}

async function hydrateAdminVerifications() {
  try {
    const response = await fetch("/api/v1/admin/verification-submissions", { credentials: "same-origin" });
    if (!response.ok) return;
    const payload = await response.json();
    if (!Array.isArray(payload.submissions)) return;
    state.adminVerifications = payload.submissions;
    save();
    if (location.hash === "#admin-verifications") render();
  } catch (error) {
    // Keep the rest of the workspace usable when the admin service is unavailable.
  }
}

async function hydrateAdminOrganisations() {
  try {
    const response = await fetch("/api/v1/admin/organisations", { credentials: "same-origin" });
    if (!response.ok) return;
    const payload = await response.json();
    if (!Array.isArray(payload.organisations)) return;
    state.adminOrganisations = payload.organisations;
    save();
    if (location.hash === "#admin-suppliers") render();
  } catch (error) {
    // Keep the review queue usable when the supplier directory is unavailable.
  }
}

async function hydrateAdminListings() {
  try {
    const response = await fetch("/api/v1/admin/listings", { credentials: "same-origin" });
    if (!response.ok) return;
    const payload = await response.json();
    if (!Array.isArray(payload.listings)) return;
    state.adminListings = payload.listings;
    save();
    if (location.hash === "#admin-listings") render();
  } catch (error) {
    // Keep the supplier directory usable when listing moderation is unavailable.
  }
}

async function hydrateAdminProducts() {
  try {
    const [productsResponse, categoriesResponse] = await Promise.all([
      fetch("/api/v1/admin/products", { credentials: "same-origin" }),
      fetch("/api/v1/admin/product-categories", { credentials: "same-origin" })
    ]);
    if (!productsResponse.ok || !categoriesResponse.ok) return;
    const productsPayload = await productsResponse.json();
    const categoriesPayload = await categoriesResponse.json();
    if (!Array.isArray(productsPayload.products) || !Array.isArray(categoriesPayload.categories)) return;
    state.adminProducts = productsPayload.products;
    state.adminProductCategories = categoriesPayload.categories;
    save();
    if (location.hash === "#admin-products") render();
  } catch (error) {
    // Keep the admin workspace usable when catalogue management is unavailable.
  }
}

async function hydrateSupplierCatalogue() {
  try {
    const [productsResponse, locationsResponse, listingsResponse, organisationsResponse] = await Promise.all([
      fetch("/api/v1/products", { credentials: "same-origin" }),
      fetch("/api/v1/supplier/locations", { credentials: "same-origin" }),
      fetch("/api/v1/supplier/listings", { credentials: "same-origin" }),
      fetch("/api/v1/supplier/organisations", { credentials: "same-origin" })
    ]);
    if (!productsResponse.ok || !locationsResponse.ok || !listingsResponse.ok || !organisationsResponse.ok) return;
    const productsPayload = await productsResponse.json();
    const locationsPayload = await locationsResponse.json();
    const listingsPayload = await listingsResponse.json();
    const organisationsPayload = await organisationsResponse.json();
    if (!Array.isArray(productsPayload.products) || !Array.isArray(locationsPayload.locations) || !Array.isArray(listingsPayload.listings) || !Array.isArray(organisationsPayload.organisations)) return;
    state.supplierProducts = productsPayload.products;
    state.supplierLocations = locationsPayload.locations;
    state.supplierListings = listingsPayload.listings;
    state.supplierOrganisations = organisationsPayload.organisations;
    save();
    if (location.hash === "#supplier-catalogue") render();
  } catch (error) {
    // Keep the main workspace usable when supplier catalogue data is unavailable.
  }
}

async function hydrateInventoryHistory(listingId) {
  try {
    const response = await fetch(`/api/v1/listings/${listingId}/inventory-movements`, { credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload.movements)) { window.alert(payload.error || "Unable to load inventory history."); return; }
    state.supplierMovementHistory[listingId] = payload.movements;
    save();
    if (location.hash === "#supplier-catalogue") render();
  } catch (error) {
    window.alert("The inventory history service is unavailable. Try again shortly.");
  }
}

async function hydrateOrders() {
  try {
    const response = await fetch("/api/v1/orders", { credentials: "same-origin" });
    if (!response.ok) return;
    const payload = await response.json();
    if (!Array.isArray(payload.orders)) return;
    state.apiOrders = payload.orders;
    if (location.hash === "#orders") render();
  } catch (error) {
    // Keep local demo orders available when the API is unavailable.
  }
}

async function hydrateDemands() {
  try {
    const response = await fetch("/api/v1/demands", { credentials: "same-origin" });
    if (!response.ok) return;
    const payload = await response.json();
    if (!Array.isArray(payload.demands)) return;
    state.demands = payload.demands.map(demand => ({
      id: String(demand.id),
      crop: demand.crop,
      quantity: Number(demand.quantity),
      unit: demand.unit,
      price: Number(demand.target_price),
      location: demand.location,
      delivery: demand.delivery_date,
      buyer: demand.buyer,
      status: demand.status === "in_contract" ? "In contract" : "Open",
      offers: []
    }));
    save();
    if (location.hash === "#marketplace" || location.hash === "#dashboard") render();
  } catch (error) {
    // Production shows an empty state when the live demand service is unavailable.
  }
}

async function hydrateContracts() {
  try {
    const response = await fetch("/api/v1/contracts", { credentials: "same-origin" });
    if (!response.ok) return;
    const payload = await response.json();
    if (!Array.isArray(payload.contracts)) return;
    state.contracts = payload.contracts.map(contract => {
      const stepByStatus = { accepted: 0, funded: 1, production: 2, delivery: 3, complete: 4 };
      const status = String(contract.status || "accepted");
      return {
        id: String(contract.id),
        demand: contract.crop,
        farmer: contract.farmer,
        buyer: contract.buyer,
        quantity: `${Number(contract.quantity).toLocaleString()} ${contract.unit}`,
        value: money(Number(contract.quantity) * Number(contract.target_price)),
        status: status.charAt(0).toUpperCase() + status.slice(1),
        step: stepByStatus[status] ?? 0,
        updated: contract.updated_at || contract.created_at
      };
    });
    save();
    if (location.hash === "#contracts" || location.hash === "#dashboard") render();
  } catch (error) {
    // Production shows an empty state when the live contract service is unavailable.
  }
}

function render() {
  const route = location.hash.slice(1) || (state.user ? "dashboard" : "home");
  if (route === "home" && !state.user) {
    app.innerHTML = landingView();
  } else {
    app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#dashboard"><span class="brand-mark">+</span><span>Farm<span>Connect</span></span></a>
      <nav class="nav" aria-label="Main navigation">
        <a href="#dashboard">Dashboard</a><a href="#marketplace">Marketplace</a><a href="#nursery-network">Nursery Network</a><a href="#orders">${hasCapability("supplier.orders") ? "Supplier orders" : "My orders"}</a><a href="#contracts">My contracts</a>${hasCapability("supplier.catalogue") ? '<a href="#supplier-catalogue">Catalogue</a><a href="#add-nursery-location">Add nursery</a>' : ""}${state.user?.role === "admin" ? '<a href="#admin-verifications">Review queue</a><a href="#admin-suppliers">Suppliers</a><a href="#admin-listings">Listings</a><a href="#admin-products">Products</a>' : ""}
      </nav>
      <div class="top-actions"><span class="currency">UGX</span><span class="role-label">${state.user ? esc(state.user.name) : state.role === "buyer" ? "Buyer workspace" : "Farmer workspace"}</span><button class="role-switch" data-action="switch-role">Switch role</button><a class="avatar" aria-label="Account menu" href="#auth">${state.user ? esc(state.user.name.slice(0, 2).toUpperCase()) : "JD"}</a></div>
    </header>
    <main id="main-content" tabindex="-1">${viewFor(route)}</main>
    ${catalogueDialogView()}
    `;
  }
  const activeRoute = `#${location.hash.slice(1) || "dashboard"}`;
  document.querySelectorAll(".nav a").forEach(link => {
    const isActive = link.getAttribute("href") === activeRoute;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.querySelectorAll("[data-action]").forEach(element => element.addEventListener("click", handleAction));
  document.querySelectorAll("form:not([data-offer-form])").forEach(form => form.addEventListener("submit", handleSubmit));
  document.querySelectorAll("[data-offer-form]").forEach(form => form.addEventListener("submit", handleOfferSubmit));
  const authForm = document.querySelector(".auth-form");
  if (authForm) {
    const modeInputs = authForm.querySelectorAll("[name=auth_mode]");
    const activityInputs = authForm.querySelectorAll("[name=activities]");
    const supplierField = authForm.querySelector(".auth-supplier-toggle");
    const nameField = authForm.querySelector(".auth-name");
    const authTitle = document.querySelector(".auth-title");
    const authCopy = document.querySelector(".auth-copy");
    const submitButton = authForm.querySelector("button[type=submit]");
    const updateAuthMode = () => {
      const registering = authForm.querySelector("[name=auth_mode]:checked")?.value === "register";
      nameField.hidden = !registering;
      supplierField.hidden = !registering;
      nameField.querySelector("input").required = registering;
      if (authTitle) authTitle.textContent = registering ? "Create your FarmConnect account." : "Sign in to your workspace.";
      if (authCopy) authCopy.textContent = registering ? "Choose how you will use the nursery network. You can change your workspace later." : "Access your orders, contracts, and nursery network activity.";
      if (submitButton) submitButton.textContent = registering ? "Create account" : "Continue";
    };
    modeInputs.forEach(input => input.addEventListener("change", updateAuthMode));
    activityInputs.forEach(input => input.addEventListener("change", updateAuthMode));
    updateAuthMode();
  }
  const search = document.querySelector("#search");
  const statusFilter = document.querySelector("#status-filter");
  if (search && statusFilter) {
    const filterCards = () => {
      const query = search.value.trim().toLowerCase();
      const status = statusFilter.value;
      document.querySelectorAll(".market-grid .demand-card").forEach((card, index) => {
        const demand = state.demands[index];
        const matchesQuery = !query || `${demand.crop} ${demand.location}`.toLowerCase().includes(query);
        const matchesStatus = status === "All statuses" || demand.status === status;
        card.hidden = !(matchesQuery && matchesStatus);
      });
    };
    search.addEventListener("input", filterCards);
    statusFilter.addEventListener("change", filterCards);
  }
  const nurserySearch = document.querySelector("#nursery-search");
  const nurseryVerification = document.querySelector("#nursery-verification");
  const nurseryAvailability = document.querySelector("#nursery-availability");
  if (nurserySearch && nurseryVerification && nurseryAvailability) {
    const filterNurseries = () => {
      const query = nurserySearch.value.trim().toLowerCase();
      const verification = nurseryVerification.value;
      const availability = nurseryAvailability.value;
      let visibleCount = 0;
      document.querySelectorAll(".nursery-card").forEach(card => {
        const matchesQuery = !query || card.dataset.nurserySearch.includes(query);
        const matchesVerification = verification === "all" || card.dataset.verified === "true";
        const matchesAvailability = availability === "all" || Number(card.dataset.stock) > 0;
        card.hidden = !(matchesQuery && matchesVerification && matchesAvailability);
        if (!card.hidden) visibleCount += 1;
      });
      const emptyState = document.querySelector("#nursery-filter-empty");
      if (emptyState) emptyState.hidden = visibleCount > 0;
    };
    nurserySearch.addEventListener("input", filterNurseries);
    nurseryVerification.addEventListener("change", filterNurseries);
    nurseryAvailability.addEventListener("change", filterNurseries);
  }
  const nurseryOrderForm = document.querySelector(".nursery-order-form");
  if (nurseryOrderForm) {
    const quantityInput = nurseryOrderForm.querySelector("[name=quantity]");
    const listingSelect = nurseryOrderForm.querySelector("[name=listing_id]");
    const stockSummary = nurseryOrderForm.querySelector("#order-stock-value");
    const total = document.querySelector("#order-total-value");
    const nursery = nurseryRecords().find(item => item.id === nurseryOrderForm.dataset.nurseryOrder);
    if (quantityInput && total && nursery) {
      const updateOrderFields = () => {
        const listing = Array.isArray(nursery.listings) ? nursery.listings.find(item => String(item.id) === listingSelect?.value) : nursery;
        const price = Number(listing?.price || nursery.price || 0);
        const stock = Number(listing?.available_quantity ?? nursery.stock);
        const minimum = Number(listing?.minimum_quantity || 1);
        quantityInput.min = String(minimum);
        quantityInput.max = String(stock);
        if (stockSummary) stockSummary.textContent = `${stock.toLocaleString()} ${listing?.unit || "seedlings"}`;
        if (Number(quantityInput.value) < minimum) quantityInput.value = String(minimum);
        if (Number(quantityInput.value) > stock) quantityInput.value = String(stock);
        total.textContent = money(Number(quantityInput.value || 0) * price);
      };
      quantityInput.addEventListener("input", updateOrderFields);
      listingSelect?.addEventListener("change", updateOrderFields);
      updateOrderFields();
    }
  }
}

function viewFor(route) {
  if (route === "home") return landingView();
  if (route === "marketplace") return marketplaceView();
  if (route === "nursery-network") return nurseryNetworkView();
  if (route.startsWith("nursery-")) return nurseryDetailView(route.slice(8));
  if (route === "register-nursery") return nurseryRegistrationView();
  if (route === "auth") return authView();
  if (route === "orders") return ordersLifecycleView();
  if (route === "admin-verifications") return adminVerificationsView();
  if (route === "admin-suppliers") return adminSuppliersView();
  if (route === "admin-listings") return adminListingsView();
  if (route === "admin-products") return adminProductsView();
  if (route === "add-nursery-location") return addNurseryLocationView();
  if (route === "supplier-catalogue") return supplierCatalogueViewWithHistory();
  if (route.startsWith("order-")) return orderFormView(route.slice(6));
  if (route === "contracts") return contractsView();
  if (route === "new-demand") return demandFormView();
  if (route.startsWith("offers-")) return offersView(route.slice(7));
  return dashboardView();
}

function landingView() {
  const assistantOpen = state.assistantOpen !== false;
  return `<div class="landing-shell">
    <header class="landing-topbar">
      <a class="landing-brand" href="#home" aria-label="FarmConnect home"><span class="landing-mark">&#127793;</span><span>Farm<span>Connect</span></span></a>
      <nav class="landing-nav" aria-label="Public navigation"><a class="active" href="#home">Home</a><button type="button" data-action="scroll-home-section" data-target="landing-platform">Explore Platform</button><button type="button" data-action="scroll-home-section" data-target="landing-how">How it Works</button></nav>
      <div class="landing-actions"><span class="landing-currency">UGX <span aria-hidden="true">&#9662;</span></span><button class="button primary landing-signin" type="button" data-action="open-signup">Sign in / Register</button></div>
    </header>
    <main class="landing-main" id="main-content" tabindex="-1">
      <section class="landing-hero" aria-labelledby="landing-title"><div class="hero-orbit hero-orbit-one"></div><div class="hero-orbit hero-orbit-two"></div><div class="hero-content"><div class="hero-mark">&#127793;</div><p class="eyebrow landing-eyebrow">AGRICULTURAL DIGITAL INFRASTRUCTURE</p><h1 id="landing-title">Empowering agriculture, together.</h1><p>FarmConnect connects producers, enterprises, sites, buyers, and trusted partners so agricultural work can grow with clarity and evidence.</p><button class="button landing-hero-button" type="button" data-action="open-signup">Join FarmConnect today <span aria-hidden="true">&#8594;</span></button></div></section>
      <section class="landing-section" id="landing-platform" aria-labelledby="platform-title"><div class="landing-section-heading"><p class="eyebrow">ONE CONNECTED PLATFORM</p><h2 id="platform-title">Everything your agricultural business needs to move with confidence.</h2><p>From a first order to a funded produce contract, keep the important work visible and moving.</p></div><div class="landing-feature-grid"><article class="landing-feature"><span class="feature-icon feature-icon-green">&#9678;</span><h3>Dynamic marketplace</h3><p>Discover demand, compare supply, and make decisions with the details that matter.</p><button type="button" data-action="open-signup">Explore marketplace <span aria-hidden="true">&#8594;</span></button></article><article class="landing-feature"><span class="feature-icon feature-icon-lime">&#10022;</span><h3>Trusted nursery network</h3><p>Find verified local nurseries, live availability, and products ready for your next season.</p><button type="button" data-action="open-signup">Find nursery stock <span aria-hidden="true">&#8594;</span></button></article><article class="landing-feature"><span class="feature-icon feature-icon-orange">&#9829;</span><h3>Secure contracts</h3><p>Turn serious offers into trackable commitments with clear milestones from production to delivery.</p><button type="button" data-action="open-signup">See how it works <span aria-hidden="true">&#8594;</span></button></article></div></section>
      <section class="landing-story" id="landing-how" aria-labelledby="how-title"><div><p class="eyebrow">BUILT FOR REAL AGRICULTURAL WORK</p><h2 id="how-title">Less chasing. More growing.</h2><p>FarmConnect gives every participant a shared view of demand, supply, stock, fulfilment, and trust. Choose what you do today and add more capabilities as your business grows.</p><button class="button secondary" type="button" data-action="open-signup">Create your workspace</button></div><div class="story-steps"><div><span>01</span><strong>Connect</strong><p>Choose buyer, supplier, or contract activities.</p></div><div><span>02</span><strong>Trade clearly</strong><p>Compare listings, orders, and offers in one place.</p></div><div><span>03</span><strong>Deliver with trust</strong><p>Track every commitment through fulfilment.</p></div></div></section>
      <section class="landing-cta"><p class="eyebrow">READY WHEN YOU ARE</p><h2>Bring your next agricultural move into focus.</h2><button class="button landing-hero-button" type="button" data-action="open-signup">Join FarmConnect today <span aria-hidden="true">&#8594;</span></button></section>
    </main>
    <footer class="landing-footer"><div><a class="landing-brand" href="#home"><span class="landing-mark">&#127793;</span><span>Farm<span>Connect</span></span></a><p>Agricultural digital infrastructure for producers, enterprises, markets, and trusted partners.</p></div><div><strong>Explore</strong><a href="#home">Home</a><a href="#marketplace">Marketplace</a><a href="#nursery-network">Nursery Network</a></div><div><strong>Support</strong><a href="#auth">Sign in</a><a href="mailto:support@farmconnect.3bs.ltd">Contact support</a><span>UGX</span></div></footer>
    ${assistantOpen ? farmyAssistantView() : `<button class="assistant-launcher" type="button" aria-label="Open Farmy Assistant" data-action="open-assistant"><span>&#10024;</span></button>`}
    ${state.landingAuthModal ? signupModalView() : ""}
  </div>`;
}

function farmyAssistantView() {
  const messages = state.assistantMessages.slice(-4);
  return `<aside class="farmy-assistant" aria-label="Farmy Assistant"><div class="assistant-header"><div><span class="assistant-avatar">&#10024;</span><div><strong>Farmy Assistant</strong><small>Online guidance</small></div></div><button type="button" class="assistant-close" aria-label="Minimize Farmy Assistant" data-action="close-assistant">&times;</button></div><div class="assistant-messages">${messages.map(message => `<div class="assistant-message ${message.from === "user" ? "is-user" : ""}">${esc(message.text)}</div>`).join("")}</div><div class="assistant-prompts"><button type="button" data-action="assistant-suggestion" data-question="How do I improve my soil?">How do I improve my soil?</button><button type="button" data-action="assistant-suggestion" data-question="What is crop rotation?">What is crop rotation?</button><button type="button" data-action="assistant-suggestion" data-question="How do contracts work?">How do contracts work?</button></div><div class="assistant-footer"><button type="button" data-action="assistant-suggestion" data-question="Connect me with an expert">Connect with an expert</button><button type="button" data-action="assistant-suggestion" data-question="Talk to a human">Talk to a human</button><div class="assistant-input"><input aria-label="Ask Farmy a question" placeholder="Ask Farmy anything" data-assistant-input /><button type="button" aria-label="Send question" data-action="assistant-send">&#8593;</button></div></div></aside>`;
}

function signupModalView() {
  return `<div class="landing-modal-backdrop" role="presentation"><section class="landing-modal" role="dialog" aria-modal="true" aria-labelledby="landing-signup-title"><button class="landing-modal-close" type="button" aria-label="Close sign up" data-action="close-signup">&times;</button><div class="landing-modal-mark">&#127793;</div><h2 id="landing-signup-title">Join FarmConnect</h2><p class="landing-modal-copy">Create an account or sign in to continue.</p><form class="panel form-panel auth-form landing-auth-form"><fieldset class="auth-mode"><legend>Account access</legend><label><input name="auth_mode" type="radio" value="login" /> Sign in</label><label><input name="auth_mode" type="radio" value="register" checked /> Create account</label></fieldset><label>Email address<input name="email" type="email" required autocomplete="email" placeholder="you@example.com" /></label><label>Password<input name="password" type="password" required minlength="10" autocomplete="new-password" placeholder="At least 10 characters" /></label><label class="auth-name">Your name<input name="name" required autocomplete="name" placeholder="Your full name" /></label><fieldset class="auth-supplier-toggle"><legend>How will you use FarmConnect?</legend><label><input name="activities" type="checkbox" value="buyer.orders" checked /> Buy seedlings and agricultural inputs</label><label><input name="activities" type="checkbox" value="supplier.catalogue" /> Supply seedlings or agricultural products</label><label><input name="activities" type="checkbox" value="buyer.contracts" checked /> Participate in produce contracts</label><small>Select more than one. You can change these choices later.</small></fieldset><p class="form-error" role="alert" hidden></p><button class="button primary" type="submit">Create account</button><div class="auth-provider-divider"><span>or</span></div><a class="button secondary auth-provider-button" href="/api/v1/auth/oidc/start">Continue with another sign-in option</a><p class="auth-provider-help">Choose Google, Microsoft, or another available provider next.</p></form></section></div>`;
}

function adminVerificationsView() {
  if (state.user?.role !== "admin") return `<div class="page-shell narrow"><section class="panel">${emptyState("Administrator access required.", "Sign in with an administrator account to review supplier verification.")}<a class="text-link" href="#auth">Go to account</a></section></div>`;
  const submissions = Array.isArray(state.adminVerifications) ? state.adminVerifications : [];
  return `<div class="page-shell"><section class="page-title"><div><p class="eyebrow">ADMINISTRATION</p><h1>Supplier verification queue.</h1><p class="muted">Review nursery operators before they appear in the public Nursery Network.</p></div><a class="button ghost" href="#dashboard">Back to workspace</a></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">PENDING REVIEW</p><h2>${submissions.length} submission${submissions.length === 1 ? "" : "s"}</h2></div><button class="button secondary" data-action="refresh-verifications">Refresh</button></div>${submissions.length ? `<div class="order-list">${submissions.map(verification => `<article class="order-row"><div class="order-id">#${verification.id}<span class="status contract">${esc(verification.status)}</span></div><div><h3>${esc(verification.organisation_name)}</h3><p>${esc(verification.location_name || "Location pending")} · Operated by ${esc(verification.operator_name || "Not provided")}</p><p>${esc(verification.submitted_by_name)} · ${esc(verification.submitted_by_email)}</p></div><div><small>Submitted</small><strong>${esc(new Date(verification.created_at).toLocaleDateString("en-GB"))}</strong></div><div class="order-actions"><button class="button secondary" data-action="decide-verification" data-verification-id="${verification.id}" data-decision="reject">Reject</button><button class="button primary" data-action="decide-verification" data-verification-id="${verification.id}" data-decision="approve">Approve</button></div></article>`).join("")}</div>` : emptyState("No submissions waiting for review.", "New supplier verification requests will appear here.")}</section></div>`;
}

function adminSuppliersView() {
  if (state.user?.role !== "admin") return `<div class="page-shell narrow"><section class="panel">${emptyState("Administrator access required.", "Sign in with an administrator account to review suppliers.")}<a class="text-link" href="#auth">Go to account</a></section></div>`;
  const organisations = Array.isArray(state.adminOrganisations) ? state.adminOrganisations : [];
  return `<div class="page-shell"><section class="page-title"><div><p class="eyebrow">ADMINISTRATION</p><h1>Supplier directory.</h1><p class="muted">Monitor supplier organisations, members, locations, nurseries, and catalogue readiness.</p></div><a class="button ghost" href="#admin-verifications">Review queue</a></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">SUPPLIER OPERATIONS</p><h2>${organisations.length} organisation${organisations.length === 1 ? "" : "s"}</h2></div><button class="button secondary" data-action="refresh-suppliers">Refresh</button></div>${organisations.length ? `<div class="order-list">${organisations.map(organisation => `<article class="order-row"><div class="order-id">#${organisation.id}<span class="status ${organisation.status === "active" ? "open" : "contract"}">${esc(organisation.status)}</span></div><div><h3>${esc(organisation.display_name)}</h3><p>${esc(organisation.legal_name)} · ${esc(organisation.type)}</p><p>${esc(organisation.email || "No email recorded")} · ${esc(organisation.phone || "No phone recorded")}</p></div><div><small>Network footprint</small><strong>${organisation.location_count} location${Number(organisation.location_count) === 1 ? "" : "s"} · ${organisation.nursery_count} nursery${Number(organisation.nursery_count) === 1 ? "" : "ies"}</strong><small>${organisation.verified_nursery_count} verified · ${organisation.listing_count} listings</small></div><div><small>Members</small>${(organisation.members || []).map(member => `<div><span class="status ${member.status === "active" ? "open" : "contract"}">${esc(member.status)}</span> ${esc(member.name)} · ${esc(member.role)}</div><button class="button ghost" data-action="update-member-status" data-organisation-id="${organisation.id}" data-user-id="${member.user_id}" data-status="${member.status === "active" ? "suspended" : "active"}">${member.status === "active" ? "Suspend member" : "Reactivate member"}</button>`).join("")}</div><div class="order-actions">${organisation.status === "active" ? `<button class="button secondary" data-action="update-supplier-status" data-organisation-id="${organisation.id}" data-status="suspended">Suspend</button>` : organisation.status === "suspended" ? `<button class="button primary" data-action="update-supplier-status" data-organisation-id="${organisation.id}" data-status="active">Reactivate</button>` : ""}</div></article>`).join("")}</div>` : emptyState("No supplier organisations yet.", "Approved supplier organisations will appear here.")}</section></div>`;
}

function adminListingsView() {
  if (state.user?.role !== "admin") return `<div class="page-shell narrow"><section class="panel">${emptyState("Administrator access required.", "Sign in with an administrator account to moderate supplier listings.")}<a class="text-link" href="#auth">Go to account</a></section></div>`;
  const listings = Array.isArray(state.adminListings) ? state.adminListings : [];
  return `<div class="page-shell"><section class="page-title"><div><p class="eyebrow">ADMINISTRATION</p><h1>Listing moderation.</h1><p class="muted">Control which supplier catalogue items are visible to the public Nursery Network.</p></div><a class="button ghost" href="#admin-suppliers">Suppliers</a></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">SUPPLIER CATALOGUE</p><h2>${listings.length} listing${listings.length === 1 ? "" : "s"}</h2></div><button class="button secondary" data-action="refresh-listings">Refresh</button></div>${listings.length ? `<div class="order-list">${listings.map(listing => `<article class="order-row"><div class="order-id">#${listing.id}<span class="status ${listing.status === "published" ? "open" : "contract"}">${esc(listing.status)}</span></div><div><h3>${esc(listing.product)}${listing.variety ? ` · ${esc(listing.variety)}` : ""}</h3><p>${esc(listing.organisation_name)} · ${esc(listing.location_name)}</p><p>${money(listing.price)} / ${esc(listing.unit || "unit")} · ${Number(listing.available_quantity).toLocaleString()} available</p></div><div><small>Minimum order</small><strong>${Number(listing.minimum_quantity || 0).toLocaleString()} ${esc(listing.unit || "unit")}</strong><small>Updated ${esc(new Date(listing.updated_at).toLocaleDateString("en-GB"))}</small></div><div class="order-actions">${listing.status !== "published" && listing.status !== "archived" ? `<button class="button primary" data-action="update-admin-listing-status" data-listing-id="${listing.id}" data-status="published">Publish</button>` : ""}${listing.status === "published" ? `<button class="button secondary" data-action="update-admin-listing-status" data-listing-id="${listing.id}" data-status="paused">Pause</button>` : ""}${listing.status !== "archived" ? `<button class="button ghost" data-action="update-admin-listing-status" data-listing-id="${listing.id}" data-status="archived">Archive</button>` : ""}</div></article>`).join("")}</div>` : emptyState("No supplier listings found.", "Supplier catalogue items will appear here for moderation.")}</section></div>`;
}

function adminProductsView() {
  if (state.user?.role !== "admin") return `<div class="page-shell narrow"><section class="panel">${emptyState("Administrator access required.", "Sign in with an administrator account to manage catalogue products.")}<a class="text-link" href="#auth">Go to account</a></section></div>`;
  const products = Array.isArray(state.adminProducts) ? state.adminProducts : [];
  const categories = Array.isArray(state.adminProductCategories) ? state.adminProductCategories : [];
  const categoryOptions = categories.map(category => `<option value="${category.id}">${esc(category.name)}</option>`).join("");
  return `<div class="page-shell"><section class="page-title"><div><p class="eyebrow">ADMINISTRATION</p><h1>Catalogue products.</h1><p class="muted">Create the shared products and varieties suppliers can publish in their nursery catalogues.</p></div><a class="button ghost" href="#admin-listings">Listings</a></section><div class="content-grid"><form class="panel form-panel admin-product-form"><div class="panel-heading"><div><p class="eyebrow">NEW PRODUCT</p><h2>Add catalogue product</h2></div></div>${categories.length ? `<label>Category<select name="category_id" required>${categoryOptions}</select></label><label>Product name<input name="name" maxlength="200" required placeholder="e.g. Mango seedlings" /></label><label>Unit<input name="unit" maxlength="32" required placeholder="seedlings" /></label><label>Description <span class="optional">Optional</span><textarea name="description" rows="3"></textarea></label><p class="form-error" role="alert" hidden></p><div class="form-actions"><button class="button primary" type="submit">Create product</button></div>` : emptyState("No active categories.", "Seed product categories before creating catalogue products.")}</form><section class="panel"><div class="panel-heading"><div><p class="eyebrow">SHARED CATALOGUE</p><h2>${products.length} product${products.length === 1 ? "" : "s"}</h2></div><button class="button secondary" data-action="refresh-products">Refresh</button></div>${products.length ? `<div class="order-list">${products.map(product => `<article class="order-row"><div class="order-id">#${product.id}<span class="status open">${esc(product.status)}</span></div><div><h3>${esc(product.name)}</h3><p>${esc(product.category)} · ${esc(product.unit)}</p><p>${esc(product.description || "No description")}</p></div><div><small>Varieties</small><strong>${(product.varieties || []).length}</strong></div><form class="inline-variety-form" data-product-id="${product.id}"><input name="name" maxlength="160" required placeholder="New variety" /><button class="button ghost" type="submit">Add variety</button></form></article>`).join("")}</div>` : emptyState("No products yet.", "Create the first shared product for suppliers to use.")}</section></div></div>`;
}

function addNurseryLocationView() {
  if (!hasCapability("supplier.catalogue")) return `<div class="page-shell narrow"><section class="panel">${emptyState("Supplier access required.", "Sign in with a supplier account to add another nursery.")}<a class="text-link" href="#auth">Go to account</a></section></div>`;
  const organisations = Array.isArray(state.supplierOrganisations) ? state.supplierOrganisations : [];
  const options = organisations.map(organisation => `<option value="${organisation.id}">${esc(organisation.display_name)}</option>`).join("");
  return `<div class="page-shell narrow"><section class="page-title"><div><p class="eyebrow">SUPPLIER WORKSPACE</p><h1>Add another nursery.</h1><p class="muted">Create a second location under an organisation you already manage.</p></div><a class="button ghost" href="#supplier-catalogue">Catalogue</a></section><form class="panel form-panel nursery-location-form">${organisations.length ? `<label>Organisation<select name="organisation_id" required>${options}</select></label><div class="form-row"><label>Location name<input name="location_name" required placeholder="e.g. Patongo branch" /></label><label>Operator name<input name="operator_name" required /></label></div><label>Address or landmark<input name="address" required /></label><div class="form-row"><label>Phone or WhatsApp<input name="phone" required /></label><label>Years operating<input name="years_operating" type="number" min="0" /></label></div><label>Description<textarea name="description" rows="4" required></textarea><p class="form-error" role="alert" hidden></p><div class="form-actions"><a class="button ghost" href="#supplier-catalogue">Cancel</a><button class="button primary" type="submit">Submit nursery for review</button></div>` : emptyState("No supplier organisation found.", "Create a supplier profile before adding another nursery location.")}</form></div>`;
}

function supplierCatalogueView() {
  if (!hasCapability("supplier.catalogue")) return `<div class="page-shell narrow"><section class="panel">${emptyState("Supplier access required.", "Sign in with a supplier account to manage your catalogue.")}<a class="text-link" href="#auth">Go to account</a></section></div>`;
  const products = Array.isArray(state.supplierProducts) ? state.supplierProducts : [];
  const locations = Array.isArray(state.supplierLocations) ? state.supplierLocations : [];
  const listings = Array.isArray(state.supplierListings) ? state.supplierListings : [];
  return `<div class="page-shell"><section class="page-title"><div><p class="eyebrow">SUPPLIER WORKSPACE</p><h1>Your catalogue.</h1><p class="muted">Publish what you have available, then keep stock accurate as orders and deliveries move.</p></div><a class="button ghost" href="#orders">Incoming orders</a></section><div class="content-grid"><form class="panel form-panel supplier-listing-form"><div class="panel-heading"><div><p class="eyebrow">NEW LISTING</p><h2>Add a product</h2></div></div>${products.length && locations.length ? `<label>Supplier location<select name="supplier_location_id" required>${locations.map(location => `<option value="${location.id}">${esc(location.organisation_name)} · ${esc(location.name)}</option>`).join("")}</select></label><label>Product<select name="product_id" required>${products.map(product => `<option value="${product.id}">${esc(product.name)} · ${esc(product.unit)}</option>`).join("")}</select></label><label>Variety <span class="optional">Optional</span><select name="variety_id"><option value="0">All varieties</option>${products.flatMap(product => (product.varieties || []).map(variety => `<option value="${variety.id}">${esc(product.name)} · ${esc(variety.name)}</option>`)).join("")}</select></label><div class="form-row"><label>Price per unit<input name="price" type="number" min="0.01" step="0.01" required /></label><label>Unit<input name="unit" maxlength="32" required placeholder="seedlings" /></label></div><div class="form-row"><label>Opening stock<input name="available_quantity" type="number" min="0" step="0.01" required value="0" /></label><label>Minimum order<input name="minimum_quantity" type="number" min="1" step="0.01" required value="1" /></label></div><label>Start as<select name="status"><option value="draft">Draft</option><option value="published">Published</option></select></label><p class="form-error" role="alert" hidden></p><div class="form-actions"><button class="button primary" type="submit">Save listing</button></div>` : emptyState("Finish supplier setup first.", "An active supplier location and catalogue product are required before you can add listings.")}</form><section class="panel"><div class="panel-heading"><div><p class="eyebrow">LIVE CATALOGUE</p><h2>${listings.length} listing${listings.length === 1 ? "" : "s"}</h2></div><button class="button secondary" data-action="refresh-supplier-catalogue">Refresh</button></div>${listings.length ? `<div class="order-list">${listings.map(listing => `<article class="order-row"><div class="order-id">#${listing.id}<span class="status ${listing.status === "published" ? "open" : "contract"}">${esc(listing.status)}</span></div><div><h3>${esc(listing.product)}${listing.variety ? ` · ${esc(listing.variety)}` : ""}</h3><p>${esc(listing.location_name)} · ${money(listing.price)} / ${esc(listing.unit)}</p></div><div><small>Available stock</small><strong>${Number(listing.available_quantity).toLocaleString()} ${esc(listing.unit)}</strong><small>Minimum ${Number(listing.minimum_quantity).toLocaleString()}</small></div><div class="order-actions"><button class="button ghost" data-action="record-inventory" data-listing-id="${listing.id}" data-movement="received">Receive stock</button>${listing.status === "published" ? `<button class="button secondary" data-action="update-supplier-listing-status" data-listing-id="${listing.id}" data-status="paused">Pause</button>` : listing.status !== "archived" ? `<button class="button primary" data-action="update-supplier-listing-status" data-listing-id="${listing.id}" data-status="published">Publish</button>` : ""}</div></article>`).join("")}</div>` : emptyState("No listings yet.", "Add your first product to start building the supplier catalogue.")}</section></div></div>`;
}

function supplierCatalogueViewWithHistory() {
  if (!hasCapability("supplier.catalogue")) return `<div class="page-shell narrow"><section class="panel">${emptyState("Supplier access required.", "Sign in with a supplier account to manage your catalogue.")}<a class="text-link" href="#auth">Go to account</a></section></div>`;
  const products = Array.isArray(state.supplierProducts) ? state.supplierProducts : [];
  const locations = Array.isArray(state.supplierLocations) ? state.supplierLocations : [];
  const listings = Array.isArray(state.supplierListings) ? state.supplierListings : [];
  const productOptions = products.map(product => `<option value="${product.id}">${esc(product.name)} · ${esc(product.unit)}</option>`).join("");
  const locationOptions = locations.map(location => `<option value="${location.id}">${esc(location.organisation_name)} · ${esc(location.name)}</option>`).join("");
  const organisationOptions = (Array.isArray(state.supplierOrganisations) ? state.supplierOrganisations : []).map(organisation => `<option value="${organisation.id}">${esc(organisation.display_name)}</option>`).join("");
  const varietyOptions = products.flatMap(product => (product.varieties || []).map(variety => `<option value="${variety.id}">${esc(product.name)} · ${esc(variety.name)}</option>`)).join("");
  const listingRows = listings.map(listing => {
    const history = state.supplierMovementHistory[listing.id];
    const statusAction = listing.status === "published"
      ? `<button class="button secondary" data-action="update-supplier-listing-status" data-listing-id="${listing.id}" data-status="paused">Pause</button>`
      : listing.status !== "archived" ? `<button class="button primary" data-action="update-supplier-listing-status" data-listing-id="${listing.id}" data-status="published">Publish</button>` : "";
    const historyView = history ? `<div class="inventory-history"><small>Movement history</small>${history.length ? history.map(movement => `<div><span class="status ${movement.movement_type === "received" || movement.movement_type === "opening" ? "open" : "contract"}">${esc(movement.movement_type)}</span> ${Number(movement.quantity).toLocaleString()} · ${esc(movement.note || "No note")} · ${esc(movement.created_by_name)}</div>`).join("") : "<div>No movements recorded.</div>"}</div>` : "";
      return `<article class="order-row"><div class="order-id">#${listing.id}<span class="status ${listing.status === "published" ? "open" : "contract"}">${esc(listing.status)}</span></div><div><h3>${esc(listing.product)}${listing.variety ? ` · ${esc(listing.variety)}` : ""}</h3><p>${esc(listing.location_name)} · ${money(listing.price)} / ${esc(listing.unit)}</p></div><div><small>Available stock</small><strong>${Number(listing.available_quantity).toLocaleString()} ${esc(listing.unit)}</strong><small>Minimum ${Number(listing.minimum_quantity).toLocaleString()}</small></div><div class="order-actions"><button class="button ghost" data-action="edit-supplier-listing" data-listing-id="${listing.id}" data-price="${listing.price}" data-unit="${esc(listing.unit)}" data-minimum="${listing.minimum_quantity}">Edit</button><button class="button ghost" data-action="record-inventory" data-listing-id="${listing.id}" data-movement="received">Receive</button><button class="button ghost" data-action="record-inventory" data-listing-id="${listing.id}" data-movement="released">Release</button><button class="button ghost" data-action="record-inventory" data-listing-id="${listing.id}" data-movement="adjusted">Adjust</button>${statusAction}<button class="button ghost" data-action="show-inventory-history" data-listing-id="${listing.id}">History</button></div>${historyView}</article>`;
  }).join("");
  return `<div class="page-shell"><section class="page-title"><div><p class="eyebrow">SUPPLIER WORKSPACE</p><h1>Your catalogue.</h1><p class="muted">Publish products and keep every stock change traceable.</p></div><a class="button ghost" href="#orders">Incoming orders</a></section><div class="content-grid"><form class="panel form-panel supplier-listing-form"><div class="panel-heading"><div><p class="eyebrow">NEW LISTING</p><h2>Add a product</h2></div></div>${products.length && locations.length ? `<label>Supplier location<select name="supplier_location_id" required>${locationOptions}</select></label><label>Product<select name="product_id" required>${productOptions}</select></label><label>Variety <span class="optional">Optional</span><select name="variety_id"><option value="0">All varieties</option>${varietyOptions}</select></label><div class="form-row"><label>Price per unit<input name="price" type="number" min="0.01" step="0.01" required /></label><label>Unit<input name="unit" maxlength="32" required placeholder="seedlings" /></label></div><div class="form-row"><label>Opening stock<input name="available_quantity" type="number" min="0" step="0.01" required value="0" /></label><label>Minimum order<input name="minimum_quantity" type="number" min="1" step="0.01" required value="1" /></label></div><label>Start as<select name="status"><option value="draft">Draft</option><option value="published">Published</option></select></label><p class="form-error" role="alert" hidden></p><div class="form-actions"><button class="button primary" type="submit">Save listing</button></div>` : emptyState("Finish supplier setup first.", "An active supplier location and catalogue product are required before you can add listings.")}</form><section class="panel"><div class="panel-heading"><div><p class="eyebrow">LIVE CATALOGUE</p><h2>${listings.length} listing${listings.length === 1 ? "" : "s"}</h2></div><button class="button secondary" data-action="refresh-supplier-catalogue">Refresh</button></div>${listings.length ? `<div class="order-list">${listingRows}</div>` : emptyState("No listings yet.", "Add your first product to start building the supplier catalogue.")}</section></div></div>`;
}

function catalogueDialogView() {
  const dialog = state.catalogueDialog;
  if (!dialog) return "";
  const inventory = dialog.type === "inventory";
  const title = inventory ? `${dialog.actionLabel} stock` : "Edit listing";
  const description = inventory ? `${dialog.product} · ${dialog.location}` : "Update the price, selling unit, or minimum order quantity for this listing.";
  const field = inventory
    ? `<label>${dialog.action === "adjusted" ? "New total available quantity" : "Quantity"}<input name="quantity" type="number" min="0.01" step="0.01" required value="${dialog.quantity || ""}" autofocus /><small>${dialog.action === "received" ? "This amount will be added to available stock." : dialog.action === "released" ? "This amount will be returned to available stock." : "This replaces the current available stock total."}</small></label><label>Stock note <span class="optional">Optional</span><textarea name="note" rows="3" placeholder="Why did this stock change?"></textarea></label>`
    : `<label>Price per unit<input name="price" type="number" min="0.01" step="0.01" required value="${esc(dialog.price)}" autofocus /></label><label>Unit<input name="unit" maxlength="32" required value="${esc(dialog.unit)}" /></label><label>Minimum order quantity<input name="minimum_quantity" type="number" min="0.01" step="0.01" required value="${esc(dialog.minimumQuantity)}" /></label>`;
  return `<div class="dialog-backdrop"><section class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="catalogue-dialog-title"><div class="panel-heading"><div><p class="eyebrow">CATALOGUE</p><h2 id="catalogue-dialog-title">${title}</h2><p class="muted">${esc(description)}</p></div><button class="icon-button" type="button" aria-label="Close" data-action="close-catalogue-dialog">&times;</button></div><form class="catalogue-dialog-form" data-dialog-type="${inventory ? "inventory" : "listing"}">${field}<p class="form-error" role="alert" hidden></p><div class="form-actions"><button class="button ghost" type="button" data-action="close-catalogue-dialog">Cancel</button><button class="button primary" type="submit">${inventory ? "Record stock change" : "Save listing"}</button></div></form></section></div>`;
}

function authView() {
  if (state.user) {
    return `<div class="page-shell narrow"><section class="page-title"><div><p class="eyebrow">ACCOUNT</p><h1>${esc(state.user.name)}</h1><p class="muted">${esc(state.user.email)} · ${esc(state.user.role)}</p></div></section><section class="panel form-panel"><p>Your FarmConnect web session is active.</p><div class="form-actions"><a class="button ghost" href="#dashboard">Back to workspace</a><a class="button secondary" href="/api/v1/auth/oidc/start?mode=link">Link an external sign-in</a><button class="button ghost" data-action="switch-account">Switch account</button><button class="button primary" data-action="logout">Sign out</button></div></section></div>`;
  }
  return `<div class="page-shell narrow"><section class="page-title"><div><p class="eyebrow">FARMCONNECT ACCOUNT</p><h1 class="auth-title">Sign in to your workspace.</h1><p class="muted auth-copy">Access your orders, contracts, and nursery network activity.</p></div></section><form class="panel form-panel auth-form">${state.authNotice ? `<p class="form-notice" role="status">${esc(state.authNotice)}</p>` : ""}<fieldset class="auth-mode"><legend>Account access</legend><label><input name="auth_mode" type="radio" value="login" checked /> Sign in</label><label><input name="auth_mode" type="radio" value="register" /> Create account</label></fieldset><label>Email<input name="email" type="email" required autocomplete="email" /></label><label>Password<input name="password" type="password" required minlength="10" autocomplete="current-password" /></label><label class="auth-name" hidden>Your name<input name="name" autocomplete="name" /></label><fieldset class="auth-supplier-toggle" hidden><legend>What would you like to do?</legend><label><input name="activities" type="checkbox" value="buyer.orders" /> Buy seedlings and agricultural inputs</label><label><input name="activities" type="checkbox" value="supplier.catalogue" /> Supply seedlings or agricultural products</label><label><input name="activities" type="checkbox" value="buyer.contracts" /> Participate in produce contracts</label><small>You can select more than one and change these choices later.</small></fieldset><p class="form-error" role="alert" hidden></p><div class="form-actions"><a class="button ghost" href="#dashboard">Cancel</a><button class="button primary" type="submit">Continue</button></div><div class="auth-provider-divider"><span>or</span></div><a class="button secondary auth-provider-button" href="/api/v1/auth/oidc/start">Continue with another sign-in option</a><p class="auth-provider-help">Choose Google, Microsoft, or another available provider on the next screen, then return to FarmConnect.</p></form></div>`;
}

function dashboardView() {
  const open = state.demands.filter(item => item.status === "Open").length;
  const activeContract = state.contracts[0];
  return `<div class="page-shell">
    <section class="welcome"><div><p class="eyebrow">YOUR ${state.role === "buyer" ? "BUYER" : "FARMER"} WORKSPACE</p><h1>${state.role === "buyer" ? "Good morning, James." : "Your farm network, at a glance."}</h1><p class="muted">${state.role === "buyer" ? "Turn clear demand into reliable supply commitments." : "Find serious buyers and make offers you can deliver."}</p></div>${state.role === "buyer" ? '<a class="button primary" href="#new-demand">+ Post crop demand</a>' : '<a class="button primary" href="#marketplace">Find demand</a>'}</section>
    <section class="stats"><div><span>Open demand</span><strong>${open}</strong><small>Buyer requests waiting for offers</small></div><div><span>Active contracts</span><strong>${state.contracts.length}</strong><small>Across your network</small></div><div><span>Funds in progress</span><strong>UGX 2.88m</strong><small>Held until delivery confirmation</small></div></section>
    <div class="content-grid"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">YOUR NETWORK</p><h2>${state.role === "buyer" ? "Demand needing farmers" : "Demand you can fulfil"}</h2></div><a class="text-link" href="#marketplace">View marketplace</a></div>${state.demands.slice(0, 3).map(demandCard).join("")}</section>
      <section class="panel progress-panel"><div class="panel-heading"><div><p class="eyebrow">ACTIVE CONTRACT</p><h2>Production pulse</h2></div><a class="text-link" href="#contracts">View contract</a></div>${activeContract ? contractProgress(activeContract) : emptyState("No active contracts yet.", "Accepted offers will appear here.")}</section></div>
  </div>`;
}

function marketplaceView() {
  return `<div class="page-shell"><section class="page-title"><div><p class="eyebrow">MARKETPLACE</p><h1>Find funded crop demand</h1><p class="muted">Browse buyer commitments and offer what your farm can deliver.</p></div><a class="button secondary" href="#new-demand">Post demand</a></section><div class="filter-row"><input id="search" placeholder="Search crops or locations" /><select id="status-filter"><option>All statuses</option><option>Open</option><option>In contract</option></select></div><section class="market-grid">${state.demands.map(demandCard).join("")}</section></div>`;
}

function nurseryNetworkView() {
  const nurseries = nurseryRecords();
  const stats = state.apiNurseryStats;
  const verifiedCount = stats ? Number(stats.verified_nurseries) : nurseries.filter(nursery => nursery.verified).length;
  const availableSeedlings = stats ? Number(stats.available_seedlings) : nurseries.reduce((total, nursery) => total + nursery.stock, 0);
  const locationLevels = stats ? Number(stats.location_levels) : 0;
  return `<div class="page-shell"><section class="page-title"><div><p class="eyebrow">NURSERY NETWORK · LIRA PILOT</p><h1>Find seedlings you can trust.</h1><p class="muted">Discover verified nurseries, compare local availability, and prepare your next planting season.</p></div><a class="button secondary" href="#register-nursery">Register a nursery</a></section><div class="nursery-intro"><div><strong>${verifiedCount.toLocaleString()}</strong><span>verified nurseries in the pilot</span></div><div><strong>${availableSeedlings.toLocaleString()}</strong><span>seedlings currently listed</span></div><div><strong>${locationLevels.toLocaleString()}</strong><span>location levels represented</span></div></div><div class="filter-row nursery-filters"><input id="nursery-search" placeholder="Search nurseries, crops, or varieties" /><select id="nursery-verification"><option value="all">All verification</option><option value="verified">Verified only</option></select><select id="nursery-availability"><option value="all">All availability</option><option value="available">In stock</option></select></div><section class="nursery-grid">${nurseries.map(nurseryCard).join("")}</section><div id="nursery-filter-empty" class="panel" hidden>${emptyState("No nurseries match these filters.", "Try a different crop, location, verification, or availability filter.")}</div></div>`;
}

function nurseryCard(nursery) {
  const catalogueLabel = nursery.price ? `from ${money(nursery.price)}` : "No published listing";
  return `<article class="nursery-card" data-nursery-search="${esc(`${nursery.name} ${nursery.location} ${nursery.crops} ${nursery.varieties}`.toLowerCase())}" data-verified="${nursery.verified}" data-stock="${nursery.stock}"><div class="nursery-image"><span>${esc(nursery.name.slice(0, 1))}</span><small>${nursery.verified ? "Verified supplier" : "Verification in progress"}</small></div><div class="nursery-card-body"><div class="card-top"><span class="location-tag">${esc(nursery.location)}, ${esc(nursery.district)}</span><span class="status ${nursery.verified ? "open" : "contract"}">${nursery.verified ? "Verified" : "Pending"}</span></div><h3>${esc(nursery.name)}</h3><p class="nursery-copy">${esc(nursery.description)}</p><p class="nursery-meta"><strong>Available:</strong> ${Number(nursery.stock).toLocaleString()} seedlings · ${catalogueLabel}</p><p class="nursery-crops">${esc(nursery.crops)}</p><div class="nursery-footer"><span>Operated by ${esc(nursery.operator)}</span>${nursery.verified && nursery.stock > 0 && state.role === "buyer" ? `<a class="button primary small-button" href="#order-${esc(nursery.id)}">Order seedlings</a>` : `<a class="text-link" href="#nursery-${esc(nursery.id)}">View profile</a>`}</div></div></article>`;
}

function nurseryDetailView(nurseryId) {
  const nursery = nurseryRecords().find(item => item.id === nurseryId);
  if (!nursery) return `<div class="page-shell"><section class="panel">${emptyState("Nursery not found.", "Return to the directory and choose another supplier.")}<a class="text-link" href="#nursery-network">Back to Nursery Network</a></section></div>`;
  if (nursery.apiId && !Array.isArray(nursery.listings)) {
    hydrateNurseryDetails(nursery);
    return `<div class="page-shell narrow"><section class="panel">${emptyState("Loading nursery profile.", "Reading current products and availability from the nursery catalogue.")}</section></div>`;
  }
  const listings = Array.isArray(nursery.listings) ? nursery.listings : [];
  const listingRows = listings.length ? listings.map(listing => `<article class="list-card"><div><h3>${esc(listing.product || "Seedlings")}${listing.variety ? ` · ${esc(listing.variety)}` : ""}</h3><p>${money(listing.price)} / ${esc(listing.unit || "seedlings")} · ${Number(listing.available_quantity || 0).toLocaleString()} available</p></div>${state.role === "buyer" && Number(listing.available_quantity) > 0 ? `<a class="button primary small-button" href="#order-${esc(nursery.id)}">Order</a>` : ""}</article>`).join("") : emptyState("No published listings yet.", "This nursery profile is visible, but it has not published orderable stock.");
  return `<div class="page-shell narrow"><section class="page-title"><div><p class="eyebrow">NURSERY PROFILE</p><h1>${esc(nursery.name)}</h1><p class="muted">${esc(nursery.location)}, ${esc(nursery.district)} · Operated by ${esc(nursery.operator)}</p></div><a class="button ghost" href="#nursery-network">Back to directory</a></section><section class="panel"><div class="card-top"><span class="status ${nursery.verified ? "open" : "contract"}">${nursery.verified ? "Verified supplier" : "Verification in progress"}</span></div><p>${esc(nursery.description)}</p><p class="nursery-crops"><strong>Known for:</strong> ${esc(nursery.crops)}</p></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">PUBLISHED CATALOGUE</p><h2>${listings.length} listing${listings.length === 1 ? "" : "s"}</h2></div></div><div class="stack-list">${listingRows}</div></section></div>`;
}

function nurseryRegistrationView() {
  if (!state.user) return `<div class="page-shell narrow"><section class="panel"><p class="eyebrow">SUPPLIER ONBOARDING</p><h1>Sign in to register a nursery.</h1><p class="muted">Create a FarmConnect account first, then return here to submit your nursery for verification.</p><a class="button primary" href="#auth">Create account or sign in</a></section></div>`;
  return `<div class="page-shell narrow"><section class="page-title"><div><p class="eyebrow">SUPPLIER ONBOARDING</p><h1>Register your nursery.</h1><p class="muted">Create a FarmConnect supplier profile. Your nursery will be reviewed before it appears as verified in the network.</p></div><a class="button ghost" href="#nursery-network">Back to directory</a></section><form class="panel form-panel nursery-form"><div class="form-section-title"><span>01</span><div><strong>Organisation</strong><small>The business or group operating the nursery.</small></div></div><label>Organisation name<input name="organisation" required placeholder="e.g. Lira Greenlife Nursery" /></label><div class="form-row"><label>Operator name<input name="operator" required placeholder="Full name" /></label><label>Phone or WhatsApp<input name="phone" required placeholder="+256 ..." /></label></div><div class="form-section-title"><span>02</span><div><strong>Nursery location</strong><small>Help farmers find and collect from you.</small></div></div><div class="form-row"><label>District<select name="district"><option>Lira</option><option>Dokolo</option><option>Oyam</option><option>Other</option></select></label><label>Town, subcounty, or parish<input name="location" required placeholder="e.g. Lira City East" /></label></div><label>Address or landmark<textarea name="address" rows="3" required placeholder="Describe where farmers should find the nursery"></textarea></label><div class="form-section-title"><span>03</span><div><strong>What you supply</strong><small>Start with the crops farmers know you for.</small></div></div><label>Crops and varieties<input name="crops" required placeholder="e.g. Coffee, Hass avocado, mango" /></label><label>About the nursery<textarea name="description" rows="4" required placeholder="Tell farmers about your experience, stock, and growing practices"></textarea></label><div class="form-actions"><a class="button ghost" href="#nursery-network">Cancel</a><button class="button primary" type="submit">Submit for review</button></div></form></div>`;
}

function orderFormView(nurseryId) {
  const nursery = nurseryRecords().find(item => item.id === nurseryId);
  if (!nursery) return `<div class="page-shell"><section class="panel">${emptyState("Nursery not found.", "Return to the directory and choose another supplier.")}<a class="text-link" href="#nursery-network">Back to Nursery Network</a></section></div>`;
  if (nursery.apiId && !Array.isArray(nursery.listings)) {
    hydrateNurseryDetails(nursery);
    return `<div class="page-shell narrow"><section class="panel">${emptyState("Loading published listings.", "Reading current products and availability from the nursery catalogue.")}</section></div>`;
  }
  const listings = Array.isArray(nursery.listings) ? nursery.listings : [{ id: nursery.listingId, product: nursery.crops, price: nursery.price, available_quantity: nursery.stock, minimum_quantity: 1, unit: "seedlings" }];
  if (!listings.length) return `<div class="page-shell narrow"><section class="panel">${emptyState("No published listings.", "This verified nursery has no products available to order yet.")}<a class="text-link" href="#nursery-network">Back to Nursery Network</a></section></div>`;
  const firstListing = listings[0];
  const listingOptions = listings.map(listing => `<option value="${esc(listing.id)}">${esc(`${listing.product || "Seedlings"}${listing.variety ? ` · ${listing.variety}` : ""}`)} · ${money(listing.price)} / ${esc(listing.unit || "seedlings")} · ${Number(listing.available_quantity).toLocaleString()} available</option>`).join("");
  return `<div class="page-shell narrow"><section class="page-title"><div><p class="eyebrow">DIRECT ORDER</p><h1>Order from ${esc(nursery.name)}.</h1><p class="muted">Choose a published product. The nursery confirms availability before fulfilment.</p></div><a class="button ghost" href="#nursery-network">Back</a></section><form class="panel form-panel nursery-order-form" data-nursery-order="${esc(nursery.id)}"><div class="order-summary"><div><span>Selected stock</span><strong id="order-stock-value">${Number(firstListing.available_quantity).toLocaleString()} ${esc(firstListing.unit || "seedlings")}</strong></div><div><span>Location</span><strong>${esc(nursery.location)}, ${esc(nursery.district)}</strong></div></div><label>Product<select name="listing_id" required>${listingOptions}</select></label><label>Quantity<input name="quantity" type="number" min="${Number(firstListing.minimum_quantity || 1)}" max="${Number(firstListing.available_quantity)}" required value="${Math.max(100, Number(firstListing.minimum_quantity || 1))}" /></label><label>Fulfilment method<select name="fulfilment"><option value="collection">I will collect from the nursery</option><option value="delivery">Request delivery</option></select></label><label>Delivery address <span class="optional">Required for delivery</span><textarea name="address" rows="3" placeholder="Village, parish, landmarks, and phone contact"></textarea></label><div class="order-total"><span>Estimated total</span><strong id="order-total-value">${money(Number(firstListing.price) * Math.max(100, Number(firstListing.minimum_quantity || 1)))}</strong></div><p class="form-error" role="alert" hidden></p><div class="form-actions"><a class="button ghost" href="#nursery-network">Cancel</a><button class="button primary" type="submit">Submit order</button></div></form></div>`;
}

function ordersLifecycleView() {
  const orders = state.apiOrders || state.orders || [];
  const isSupplier = hasCapability("supplier.orders");
  const isBuyer = state.user?.role === "buyer";
  const action = (label, actionName, orderId, tone = "secondary") => `<button class="button ${tone}" data-action="${actionName}" data-order-id="${orderId}">${label}</button>`;

  return `
    <div class="page-shell">
    <section class="page-section">
      <div class="section-heading"><div><p class="eyebrow">Procurement</p><h1>Orders</h1></div><a class="button primary" href="#nursery-network">Add nursery order</a></div>
      <div class="stack-list">
        ${orders.length ? orders.map(order => {
          const supplierSide = isSupplier;
          const buyerSide = isBuyer;
          const buttons = [];
          if (supplierSide && order.status === "pending_supplier") {
            buttons.push(action("Confirm", "confirm-order", order.id, "primary"), action("Reject", "reject-order", order.id, "secondary"));
          }
          if (supplierSide && order.status === "confirmed") {
            buttons.push(order.fulfilment_method === "delivery" ? action("Dispatch", "dispatch-order", order.id, "primary") : action("Ready for collection", "ready-order", order.id, "primary"));
          }
          if (buyerSide && ["pending_supplier", "confirmed"].includes(order.status)) buttons.push(action("Cancel", "cancel-order", order.id, "secondary"));
          if (buyerSide && ["ready_for_collection", "out_for_delivery"].includes(order.status)) buttons.push(action("Mark received", "receive-order", order.id, "primary"), action("Dispute", "dispute-order", order.id, "secondary"));
          buttons.push(action("View history", "show-order-events", order.id, "secondary"));
          return `<article class="list-card"><div><p class="eyebrow">Order #${order.id}</p><h3>${order.status.replaceAll("_", " ")}</h3><p>${Number(order.quantity || 0).toLocaleString()} seedlings · ${esc(order.products || "Seedlings")} · ${esc(order.supplier || "Nursery")} · ${esc(order.location_name || "Location pending")}</p><p>${order.fulfilment_method || "collection"} · ${money(order.total || 0)}</p><div id="order-events-${order.id}" class="order-events" hidden></div></div><div class="button-row">${buttons.join("")}</div></article>`;
        }).join("") : `<div class="empty-state"><h3>No orders yet</h3><p>Your orders will appear here as procurement activity begins.</p></div>`}
      </div>
    </section>
    </div>`;
}

function ordersView() {
  const isSupplier = hasCapability("supplier.orders");
  const apiOrders = Array.isArray(state.apiOrders) ? state.apiOrders : null;
  const orders = apiOrders || state.orders.filter(order => isSupplier ? order.supplier === "Your nursery" : order.buyer === "You");
  const emptyTitle = isSupplier ? "No incoming orders." : "No nursery orders yet.";
  const emptyCopy = isSupplier ? "New farmer orders will appear here." : "Choose a verified nursery to start your next planting order.";
  const displayStatus = status => ({ pending_supplier: "Pending supplier", confirmed: "Confirmed", rejected: "Rejected", ready_for_collection: "Ready for collection", received: "Received" }[status] || status);
    return `<div class="page-shell"><section class="page-title"><div><p class="eyebrow">${isSupplier ? "SUPPLIER WORKSPACE" : "PROCUREMENT"}</p><h1>${isSupplier ? "Incoming nursery orders." : "Your nursery orders."}</h1><p class="muted">${isSupplier ? "Confirm orders and keep fulfilment moving." : "Track supplier confirmation and collection or delivery."}</p></div><a class="button secondary" href="#nursery-network">Browse nurseries</a></section>${orders.length ? `<section class="order-list">${orders.map(order => { const status = apiOrders ? displayStatus(order.status) : order.status; const id = apiOrders ? `API-${order.id}` : order.id; const nursery = apiOrders ? order.supplier : order.nursery; const quantity = apiOrders ? order.quantity : order.quantity; const fulfilment = apiOrders ? (order.fulfilment_method === "delivery" ? "Delivery" : "Collection") : order.fulfilment; const total = apiOrders ? Number(order.total) : order.total; const action = isSupplier && order.status === "pending_supplier" ? `<div class="order-actions"><button class="button secondary" data-action="reject-order" data-order-id="${order.id}">Reject</button><button class="button primary" data-action="confirm-order" data-order-id="${order.id}">Confirm</button></div>` : isSupplier && order.status === "confirmed" ? `<button class="button primary" data-action="advance-order" data-order-id="${order.id}">Mark ready</button>` : !isSupplier && order.status === "ready_for_collection" ? `<button class="button primary" data-action="advance-order" data-order-id="${order.id}">Mark received</button>` : `<span class="text-link">View order</span>`; return `<article class="order-row"><div class="order-id">${esc(id)}<span class="status ${status === "Received" ? "open" : "contract"}">${esc(status)}</span></div><div><h3>${esc(nursery)}</h3><p>${Number(quantity).toLocaleString()} seedlings · ${esc(fulfilment)}</p></div><div><small>Estimated total</small><strong>${money(total)}</strong></div>${action}</article>`; }).join("")}</section>` : `<section class="panel">${emptyState(emptyTitle, emptyCopy)}</section>`}</div>`;
}

function demandCard(demand) {
  return `<article class="demand-card"><div class="card-top"><span class="crop-icon">${esc(demand.crop.slice(0, 1))}</span><span class="status ${demand.status === "Open" ? "open" : "contract"}">${esc(demand.status)}</span></div><h3>${esc(demand.crop)}</h3><p class="buyer">${esc(demand.buyer)} <span>in ${esc(demand.location)}</span></p><div class="details"><div><small>Quantity</small><strong>${Number(demand.quantity).toLocaleString()} ${esc(demand.unit)}</strong></div><div><small>Target price</small><strong>${money(demand.price)} / ${esc(demand.unit.replace(/s$/, ""))}</strong></div></div><div class="card-footer"><span>Deliver by <b>${new Date(demand.delivery).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</b></span><span>${demand.offers.length} offers</span></div>${state.role === "farmer" && demand.status === "Open" ? `<button class="offer-button" data-action="show-offer" data-id="${demand.id}">Make an offer</button><div class="inline-offer" id="offer-${demand.id}" hidden><form data-offer-form="${demand.id}"><label>Supply quantity<input name="quantity" type="number" min="1" required value="${demand.quantity}" /></label><label>Your price per ${esc(demand.unit.replace(/s$/, ""))}<input name="price" type="number" min="1" required value="${demand.price}" /></label><label>Note <textarea name="note" rows="2" placeholder="Tell the buyer why this offer works"></textarea></label><button class="button primary" type="submit">Submit offer</button></form></div>` : state.role === "buyer" && demand.offers.length ? `<button class="offer-button" data-action="review" data-id="${demand.id}">Review offers</button>` : ""}</article>`;
}

function emptyState(title, copy) { return `<div class="empty-state"><strong>${esc(title)}</strong><p>${esc(copy)}</p></div>`; }

function offersView(demandId) {
  const demand = state.demands.find(item => item.id === demandId);
  if (!demand) return `<div class="page-shell"><section class="panel"><h2>Demand not found</h2><a class="text-link" href="#marketplace">Back to marketplace</a></section></div>`;
  return `<div class="page-shell narrow"><section class="page-title"><div><p class="eyebrow">OFFER REVIEW</p><h1>${esc(demand.crop)}</h1><p class="muted">${Number(demand.quantity).toLocaleString()} ${esc(demand.unit)} needed in ${esc(demand.location)} by ${new Date(demand.delivery).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}.</p></div><a class="button ghost" href="#marketplace">Back</a></section><section class="offer-list">${demand.offers.length ? demand.offers.map(offer => `<article class="offer-row"><div class="offer-avatar">${esc(offer.farmer.slice(0, 1))}</div><div><h3>${esc(offer.farmer)}</h3><p>${esc(offer.note)}</p></div><div><small>Supply</small><strong>${Number(offer.quantity).toLocaleString()} ${esc(demand.unit)}</strong></div><div><small>Offer price</small><strong>${money(offer.price)} / ${esc(demand.unit.replace(/s$/, ""))}</strong></div><button class="button primary" data-action="accept" data-demand-id="${demand.id}" data-offer-id="${offer.id}">Accept offer</button></article>`).join("") : emptyState("No offers yet.", "Share this demand with farmers in your network.")}</section></div>`;
}

function contractsView() {
  return `<div class="page-shell"><section class="page-title"><div><p class="eyebrow">CONTRACTS</p><h1>Commitments in motion</h1><p class="muted">Track production, money, and delivery from one place.</p></div></section>${state.contracts.length ? `<section class="contract-list">${state.contracts.map(contract => `<article class="contract-row"><div class="contract-id">${esc(contract.id)}<span class="status production">${esc(contract.status)}</span></div><div><h3>${esc(contract.demand)}</h3><p>${esc(contract.farmer)} to ${esc(contract.buyer)} &middot; ${esc(contract.quantity)}</p></div><div><small>Contract value</small><strong>${esc(contract.value)}</strong></div><a class="text-link" href="#contracts">Open</a></article>`).join("")}</section><section class="panel contract-detail"><div class="panel-heading"><div><p class="eyebrow">${esc(state.contracts[0].id)}</p><h2>${esc(state.contracts[0].demand)} contract</h2></div><button class="button primary" data-action="advance">Advance milestone</button></div>${contractProgress(state.contracts[0])}</section>` : `<section class="panel">${emptyState("No contracts yet.", "Accept an offer to start tracking a funded production commitment.")}</section>`}</div>`;
}

function contractProgress(contract) {
  const steps = ["Offer accepted", "Funds secured", "Production", "Delivery", "Complete"];
  return `<div class="timeline">${steps.map((step, index) => `<div class="timeline-step ${index < contract.step ? "done" : index === contract.step ? "current" : ""}"><span>${index < contract.step ? "&#10003;" : index + 1}</span><div><strong>${step}</strong>${index === contract.step ? `<p>${esc(contract.updated)}</p>` : ""}</div></div>`).join("")}</div>`;
}

function demandFormView() {
  return `<div class="page-shell narrow"><section class="page-title"><div><p class="eyebrow">NEW BUYER REQUEST</p><h1>Post a crop demand</h1><p class="muted">Tell farmers exactly what you need. You can review offers before committing funds.</p></div></section><form class="panel form-panel"><label>Crop or produce<input name="crop" required placeholder="e.g. Fresh tomatoes" /></label><div class="form-row"><label>Quantity<input name="quantity" type="number" required placeholder="1200" /></label><label>Unit<select name="unit"><option>kg</option><option>tonnes</option><option>bunches</option><option>crates</option></select></label></div><div class="form-row"><label>Target price per unit<input name="price" type="number" required placeholder="2400" /></label><label>Delivery date<input name="delivery" type="date" required /></label></div><label>Delivery location<input name="location" required placeholder="Kampala" /></label><label>Notes for farmers<textarea name="notes" rows="4" placeholder="Quality, packaging, or inspection requirements"></textarea></label><div class="form-actions"><a class="button ghost" href="#dashboard">Cancel</a><button class="button primary" type="submit">Publish demand</button></div></form></div>`;
}

function handleAction(event) {
  const action = event.currentTarget.dataset.action;
  if (action === "open-signup") { state.landingAuthModal = true; save(); render(); document.querySelector(".landing-modal input[name=email]")?.focus(); return; }
  if (action === "close-signup") { state.landingAuthModal = false; save(); render(); return; }
  if (action === "scroll-home-section") { document.getElementById(event.currentTarget.dataset.target)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (action === "open-assistant") { state.assistantOpen = true; save(); render(); return; }
  if (action === "close-assistant") { state.assistantOpen = false; save(); render(); return; }
  if (action === "assistant-suggestion") { addAssistantMessage(event.currentTarget.dataset.question); return; }
  if (action === "assistant-send") { const input = document.querySelector("[data-assistant-input]"); if (input?.value.trim()) addAssistantMessage(input.value.trim()); return; }
  if (action === "switch-role") { state.role = state.role === "buyer" ? "farmer" : "buyer"; save(); render(); return; }
  if (action === "logout") {
    fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => { state.user = null; state.adminVerifications = null; save(); location.hash = "dashboard"; render(); });
    return;
  }
  if (action === "switch-account") {
    fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => { state.user = null; state.apiOrders = null; state.adminVerifications = null; save(); location.hash = "auth"; render(); });
    return;
  }
  if (action === "refresh-verifications") {
    hydrateAdminVerifications();
    return;
  }
  if (action === "refresh-suppliers") {
    hydrateAdminOrganisations();
    return;
  }
  if (action === "refresh-listings") {
    hydrateAdminListings();
    return;
  }
  if (action === "refresh-products") {
    hydrateAdminProducts();
    return;
  }
  if (action === "refresh-supplier-catalogue") {
    hydrateSupplierCatalogue();
    return;
  }
  if (action === "update-supplier-status") {
    updateSupplierStatus(event.currentTarget.dataset.organisationId, event.currentTarget.dataset.status);
    return;
  }
  if (action === "update-member-status") {
    updateMemberStatus(event.currentTarget.dataset.organisationId, event.currentTarget.dataset.userId, event.currentTarget.dataset.status);
    return;
  }
  if (action === "update-admin-listing-status") {
    updateAdminListingStatus(event.currentTarget.dataset.listingId, event.currentTarget.dataset.status);
    return;
  }
  if (action === "update-supplier-listing-status") {
    updateSupplierListingStatus(event.currentTarget.dataset.listingId, event.currentTarget.dataset.status);
    return;
  }
  if (action === "edit-supplier-listing") {
    editSupplierListing(event.currentTarget.dataset.listingId, event.currentTarget.dataset.price, event.currentTarget.dataset.unit, event.currentTarget.dataset.minimum);
    return;
  }
  if (action === "record-inventory") {
    recordInventoryMovement(event.currentTarget.dataset.listingId, event.currentTarget.dataset.movement);
    return;
  }
  if (action === "close-catalogue-dialog") {
    state.catalogueDialog = null;
    render();
    return;
  }
  if (action === "show-inventory-history") {
    hydrateInventoryHistory(event.currentTarget.dataset.listingId);
    return;
  }
  if (action === "decide-verification") {
    const decision = event.currentTarget.dataset.decision;
    const notes = window.prompt(`${decision === "approve" ? "Approval" : "Rejection"} notes (optional):`, "");
    if (notes === null) return;
    updateVerification(event.currentTarget.dataset.verificationId, decision, notes);
    return;
  }
  if (action === "show-offer") { const form = document.querySelector(`#offer-${event.currentTarget.dataset.id}`); if (form) { form.hidden = false; event.currentTarget.hidden = true; form.querySelector("input")?.focus(); } return; }
  if (action === "review") { location.hash = `offers-${event.currentTarget.dataset.id}`; render(); return; }
  if (action === "accept") {
    const demand = state.demands.find(item => item.id === event.currentTarget.dataset.demandId);
    const offer = demand?.offers.find(item => item.id === event.currentTarget.dataset.offerId);
    if (!demand || !offer) return;
    demand.status = "In contract";
    state.contracts.unshift({ id: `FC-2026-${String(state.contracts.length + 9).padStart(3, "0")}`, demand: demand.crop, farmer: offer.farmer, buyer: demand.buyer, quantity: `${Number(offer.quantity).toLocaleString()} ${demand.unit}`, value: money(offer.quantity * offer.price), status: "Accepted", step: 0, updated: "Offer accepted. Waiting for buyer funding." });
    save(); location.hash = "contracts"; render(); return;
  }
  if (action === "advance" && state.contracts[0]) { state.contracts[0].step = Math.min(state.contracts[0].step + 1, 4); state.contracts[0].status = state.contracts[0].step >= 4 ? "Complete" : ["Accepted", "Funded", "Production", "Delivery"][state.contracts[0].step]; state.contracts[0].updated = "Milestone updated just now."; save(); render(); }
  if (action === "confirm-order") {
    if (Array.isArray(state.apiOrders)) {
      updateApiOrder(event.currentTarget.dataset.orderId, "confirm");
      return;
    }
    const order = state.orders.find(item => item.id === event.currentTarget.dataset.orderId);
    if (!order) return;
    order.status = "Confirmed";
    save();
    render();
    return;
  }
  if (action === "reject-order" && Array.isArray(state.apiOrders)) {
    updateApiOrder(event.currentTarget.dataset.orderId, "reject");
    return;
  }
  if (["cancel-order", "dispatch-order", "ready-order", "receive-order", "dispute-order"].includes(action) && Array.isArray(state.apiOrders)) {
    const statusByAction = { "dispatch-order": "out_for_delivery", "ready-order": "ready_for_collection", "receive-order": "received", "dispute-order": "disputed" };
    updateApiOrder(event.currentTarget.dataset.orderId, action === "cancel-order" ? "cancel" : "status", statusByAction[action] || null);
    return;
  }
  if (action === "show-order-events" && Array.isArray(state.apiOrders)) {
    showOrderEvents(event.currentTarget.dataset.orderId);
    return;
  }
  if (action === "advance-order") {
    if (Array.isArray(state.apiOrders)) {
      const order = state.apiOrders.find(item => String(item.id) === event.currentTarget.dataset.orderId);
      if (order) updateApiOrder(order.id, "status", order.status === "confirmed" ? "ready_for_collection" : "received");
      return;
    }
    const order = state.orders.find(item => item.id === event.currentTarget.dataset.orderId);
    if (!order) return;
    order.status = order.status === "Confirmed" ? "Ready for collection" : "Received";
    save();
    render();
  }
}

function addAssistantMessage(question) {
  const answers = {
    "How do I improve my soil?": "Start with a soil test, add organic matter, and avoid working wet soil. A local agronomist can help turn the result into a practical plan.",
    "What is crop rotation?": "Crop rotation means changing what you plant in a field across seasons. It can reduce pest pressure, protect soil nutrients, and improve resilience.",
    "How do contracts work?": "A buyer posts a demand, a farmer makes an offer, and the buyer accepts the best fit. FarmConnect then tracks production and delivery milestones.",
    "Connect me with an expert": "I can help you find the right next step. Sign in to FarmConnect and use Expert Help when that service is enabled for your network.",
    "Talk to a human": "A human partner can help with account and marketplace questions. Contact support@farmconnect.3bs.ltd and include your district and preferred contact method."
  };
  state.assistantMessages.push({ from: "user", text: question }, { from: "assistant", text: answers[question] || "That is a good question. Sign in to your FarmConnect workspace so I can guide you using your marketplace and nursery context." });
  state.assistantOpen = true;
  save();
  render();
}

async function updateVerification(submissionId, decision, notes) {
  try {
    const response = await fetch(`/api/v1/admin/verification-submissions/${submissionId}/${decision}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ notes }) });
    const payload = await response.json();
    if (!response.ok) { window.alert(payload.error || "Unable to update this verification."); return; }
    await hydrateAdminVerifications();
  } catch (error) {
    window.alert("The verification service is unavailable. Try again shortly.");
  }
}

async function updateSupplierStatus(organisationId, status) {
  const action = status === "suspended" ? "suspend" : "reactivate";
  if (!window.confirm(`Are you sure you want to ${action} this supplier organisation?`)) return;
  try {
    const response = await fetch(`/api/v1/admin/organisations/${organisationId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ status }) });
    const payload = await response.json();
    if (!response.ok) { window.alert(payload.error || "Unable to update this supplier."); return; }
    await hydrateAdminOrganisations();
    await hydrateNurseries();
  } catch (error) {
    window.alert("The supplier service is unavailable. Try again shortly.");
  }
}

async function updateMemberStatus(organisationId, userId, status) {
  const action = status === "suspended" ? "suspend" : "reactivate";
  if (!window.confirm(`Are you sure you want to ${action} this organisation member?`)) return;
  try {
    const response = await fetch(`/api/v1/admin/organisations/${organisationId}/members/${userId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ status }) });
    const payload = await response.json();
    if (!response.ok) { window.alert(payload.error || "Unable to update this member."); return; }
    await hydrateAdminOrganisations();
  } catch (error) {
    window.alert("The member service is unavailable. Try again shortly.");
  }
}

async function updateAdminListingStatus(listingId, status) {
  const action = status === "published" ? "publish" : status === "paused" ? "pause" : status === "archived" ? "archive" : "return to draft";
  if (!window.confirm(`Are you sure you want to ${action} this listing?`)) return;
  try {
    const response = await fetch(`/api/v1/admin/listings/${listingId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ status }) });
    const payload = await response.json();
    if (!response.ok) { window.alert(payload.error || "Unable to update this listing."); return; }
    await hydrateAdminListings();
    await hydrateNurseries();
  } catch (error) {
    window.alert("The listing service is unavailable. Try again shortly.");
  }
}

async function updateSupplierListingStatus(listingId, status) {
  try {
    const response = await fetch(`/api/v1/listings/${listingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ status }) });
    const payload = await response.json();
    if (!response.ok) { window.alert(payload.error || "Unable to update this listing."); return; }
    await hydrateSupplierCatalogue();
  } catch (error) {
    window.alert("The listing service is unavailable. Try again shortly.");
  }
}

async function editSupplierListing(listingId, currentPrice, currentUnit, currentMinimum) {
  state.catalogueDialog = { type: "listing", listingId, price: currentPrice, unit: currentUnit, minimumQuantity: currentMinimum };
  render();
}

function recordInventoryMovement(listingId, movementType) {
  const listing = (state.supplierListings || []).find(item => String(item.id) === String(listingId));
  const actionLabels = { received: "Receive", released: "Release", adjusted: "Adjust" };
  state.catalogueDialog = { type: "inventory", listingId, movementType, action: movementType, actionLabel: actionLabels[movementType] || "Update", product: listing?.product || "Catalogue item", location: listing?.location_name || "Supplier location", quantity: "" };
  render();
}

async function updateApiOrder(orderId, action, status = null) {
  const endpoint = action === "confirm" || action === "reject" || action === "cancel" ? `/api/v1/orders/${orderId}/${action}` : `/api/v1/orders/${orderId}/status`;
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: action === "status" ? JSON.stringify({ status }) : "{}" });
    const payload = await response.json();
    if (!response.ok) { window.alert(payload.error || "Unable to update this order."); return; }
    await hydrateOrders();
  } catch (error) {
    window.alert("The order service is unavailable. Try again shortly.");
  }
}

async function showOrderEvents(orderId) {
  const container = document.querySelector(`#order-events-${orderId}`);
  if (!container) return;
  container.hidden = false;
  container.textContent = "Loading order history...";
  try {
    const response = await fetch(`/api/v1/orders/${orderId}/events`, { credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) { container.textContent = payload.error || "Unable to load order history."; return; }
    container.innerHTML = payload.events.length
      ? payload.events.map(event => `<p><strong>${event.to_status.replaceAll("_", " ")}</strong> · ${event.note || event.event_type} · ${event.created_at}</p>`).join("")
      : "<p>No order history is available.</p>";
  } catch (error) {
    container.textContent = "The order history service is unavailable.";
  }
}

function handleOfferSubmit(event) {
  event.preventDefault();
  const demand = state.demands.find(item => item.id === event.currentTarget.dataset.offerForm);
  if (!demand) return;
  const form = new FormData(event.currentTarget);
  const quantity = Number(form.get("quantity"));
  const price = Number(form.get("price"));
  if (quantity <= 0 || price <= 0) return;
  demand.offers.push({ id: `O-${Date.now()}`, farmer: "Amina Farm", quantity, price, note: String(form.get("note") || "Offer submitted through FarmConnect.") });
  save();
  location.hash = "marketplace";
  render();
}

async function handleCatalogueDialogSubmit(event) {
  const dialog = state.catalogueDialog;
  if (!dialog) return;
  const form = new FormData(event.currentTarget);
  const error = event.currentTarget.querySelector(".form-error");
  const setError = message => { if (error) { error.textContent = message; error.hidden = false; } };
  try {
    let response;
    if (dialog.type === "inventory") {
      const quantity = Number(form.get("quantity"));
      if (!Number.isFinite(quantity) || quantity <= 0) { setError("Enter a quantity greater than zero."); return; }
      response = await fetch(`/api/v1/listings/${dialog.listingId}/inventory-movements`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ movement_type: dialog.movementType, quantity, note: String(form.get("note") || "").trim() }) });
    } else {
      const price = Number(form.get("price"));
      const minimumQuantity = Number(form.get("minimum_quantity"));
      const unit = String(form.get("unit") || "").trim();
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(minimumQuantity) || minimumQuantity <= 0 || !unit) { setError("Enter a positive price, unit, and minimum order quantity."); return; }
      response = await fetch(`/api/v1/listings/${dialog.listingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ price, unit, minimum_quantity: minimumQuantity }) });
    }
    const payload = await response.json();
    if (!response.ok) { setError(payload.error || "Unable to save this catalogue change."); return; }
    state.catalogueDialog = null;
    await hydrateSupplierCatalogue();
  } catch (requestError) {
    setError("The catalogue service is unavailable. Try again shortly.");
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  if (event.currentTarget.classList.contains("catalogue-dialog-form")) {
    await handleCatalogueDialogSubmit(event);
    return;
  }
  const form = new FormData(event.currentTarget);
  if (event.currentTarget.classList.contains("admin-product-form")) {
    const error = event.currentTarget.querySelector(".form-error");
    try {
      const response = await fetch("/api/v1/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ category_id: Number(form.get("category_id")), name: String(form.get("name") || "").trim(), unit: String(form.get("unit") || "").trim(), description: String(form.get("description") || "").trim() }) });
      const payload = await response.json();
      if (!response.ok) { if (error) { error.textContent = payload.error || "Unable to create this product."; error.hidden = false; } return; }
      await hydrateAdminProducts();
      event.currentTarget.reset();
    } catch (requestError) {
      if (error) { error.textContent = "The product service is unavailable. Try again shortly."; error.hidden = false; }
    }
    return;
  }
  if (event.currentTarget.classList.contains("nursery-location-form")) {
    const error = event.currentTarget.querySelector(".form-error");
    try {
      const locationLookup = await fetch("/api/v1/locations?level=subcounty", { credentials: "same-origin" });
      const locations = locationLookup.ok ? (await locationLookup.json()).locations || [] : [];
      const locationName = String(form.get("location_name") || "").trim();
      const locationMatch = locations.find(item => item.name.toLowerCase() === locationName.toLowerCase());
      const organisationId = Number(form.get("organisation_id"));
      const locationResponse = await fetch(`/api/v1/organisations/${organisationId}/locations`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ name: locationName, location_id: locationMatch?.id || 0, address: String(form.get("address") || "").trim(), phone: String(form.get("phone") || "").trim() }) });
      const locationPayload = await locationResponse.json();
      if (!locationResponse.ok) throw new Error(locationPayload.error || "Unable to create the nursery location.");
      const nurseryResponse = await fetch("/api/v1/nurseries", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ organisation_id: organisationId, supplier_location_id: locationPayload.id, operator_name: String(form.get("operator_name") || "").trim(), whatsapp: String(form.get("phone") || "").trim(), years_operating: Number(form.get("years_operating") || 0) || null, description: String(form.get("description") || "").trim() }) });
      const nurseryPayload = await nurseryResponse.json();
      if (!nurseryResponse.ok) throw new Error(nurseryPayload.error || "Unable to create the nursery profile.");
      const verificationResponse = await fetch(`/api/v1/nurseries/${nurseryPayload.id}/verification-submissions`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ notes: "Submitted through the existing supplier location flow." }) });
      const verificationPayload = await verificationResponse.json();
      if (!verificationResponse.ok) throw new Error(verificationPayload.error || "Unable to submit verification.");
      window.alert("Nursery submitted for verification.");
      await hydrateSupplierCatalogue();
      location.hash = "supplier-catalogue";
      render();
    } catch (requestError) {
      if (error) { error.textContent = requestError.message || "Unable to submit nursery location."; error.hidden = false; }
    }
    return;
  }
  if (event.currentTarget.classList.contains("inline-variety-form")) {
    try {
      const response = await fetch(`/api/v1/admin/products/${event.currentTarget.dataset.productId}/varieties`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ name: String(form.get("name") || "").trim() }) });
      const payload = await response.json();
      if (!response.ok) { window.alert(payload.error || "Unable to create this variety."); return; }
      await hydrateAdminProducts();
      event.currentTarget.reset();
    } catch (requestError) {
      window.alert("The variety service is unavailable. Try again shortly.");
    }
    return;
  }
  if (event.currentTarget.classList.contains("auth-form")) {
    const register = form.get("auth_mode") === "register";
    const activities = form.getAll("activities");
    const supplier = activities.includes("supplier.catalogue");
    const error = event.currentTarget.querySelector(".form-error");
    const endpoint = register ? "register" : "login";
    const body = { email: String(form.get("email") || ""), password: String(form.get("password") || "") };
    if (register) { body.name = String(form.get("name") || ""); body.role = supplier ? "farmer" : "buyer"; body.activities = activities; }
    try {
      const response = await fetch(`/api/v1/auth/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) { if (error) { error.textContent = payload.error || "Unable to authenticate."; error.hidden = false; } return; }
      state.user = payload.user;
      state.userContext = payload.context || { capabilities: [], organisations: [] };
      state.authNotice = null;
      if (state.user?.role) state.role = state.user.role;
      save();
      location.hash = register && supplier ? "register-nursery" : "dashboard";
      render();
      if (hasCapability("supplier.catalogue")) hydrateSupplierCatalogue();
      if (state.user?.role === "admin") { hydrateAdminVerifications(); hydrateAdminOrganisations(); hydrateAdminListings(); }
    } catch (requestError) {
      if (error) { error.textContent = "The account service is unavailable. Try again shortly."; error.hidden = false; }
    }
    return;
  }
  if (event.currentTarget.classList.contains("nursery-order-form")) {
    const nursery = nurseryRecords().find(item => item.id === event.currentTarget.dataset.nurseryOrder);
    const listingId = Number(form.get("listing_id") || nursery?.listingId || 0);
    const listing = Array.isArray(nursery?.listings) ? nursery.listings.find(item => Number(item.id) === listingId) : nursery;
    const quantity = Number(form.get("quantity"));
    const fulfilment = form.get("fulfilment");
    const address = String(form.get("address") || "").trim();
    const availableQuantity = Number(listing?.available_quantity ?? nursery?.stock ?? 0);
    const minimumQuantity = Number(listing?.minimum_quantity || 1);
    if (!nursery || (nursery.apiId && (!listingId || !listing)) || quantity < minimumQuantity || quantity > availableQuantity || (fulfilment === "delivery" && !address)) return;
    if (nursery.apiId && listingId) {
      const error = event.currentTarget.querySelector(".form-error");
      try {
        const response = await fetch("/api/v1/orders", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ listing_id: listingId, quantity, fulfilment_method: fulfilment, delivery_address: address }) });
        const payload = await response.json();
        if (!response.ok) {
          if (error) { error.textContent = payload.error || "Sign in to place a live nursery order."; error.hidden = false; }
          return;
        }
        state.orders.unshift({ id: `API-${payload.id}`, nursery: nursery.name, supplier: nursery.name, buyer: "You", quantity, fulfilment: fulfilment === "delivery" ? "Delivery" : "Collection", address, total: Number(payload.total), status: "Pending supplier" });
        save();
        location.hash = "orders";
        render();
        return;
      } catch (requestError) {
        if (error) { error.textContent = "The live ordering service is unavailable. Try again shortly."; error.hidden = false; }
        return;
      }
    }
    state.orders.unshift({ id: `ORD-${String(state.orders.length + 1).padStart(4, "0")}`, nursery: nursery.name, supplier: "Your nursery", buyer: "You", quantity, fulfilment: fulfilment === "delivery" ? "Delivery" : "Collection", address, total: quantity * nursery.price, status: "Pending supplier" });
    nursery.stock -= quantity;
    save();
    location.hash = "orders";
    render();
    return;
  }
  if (event.currentTarget.classList.contains("nursery-form")) {
    if (!state.user) { location.hash = "auth"; render(); return; }
    try {
      const locationResponse = await fetch(`/api/v1/locations?level=subcounty`, { credentials: "same-origin" });
      const locations = locationResponse.ok ? (await locationResponse.json()).locations || [] : [];
      const locationName = String(form.get("location") || "").trim().toLowerCase();
      const locationMatch = locations.find(item => item.name.toLowerCase() === locationName);
      const organisationResponse = await fetch("/api/v1/organisations", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ display_name: form.get("organisation"), legal_name: form.get("organisation"), type: "supplier", phone: form.get("phone"), email: state.user.email }) });
      const organisationPayload = await organisationResponse.json();
      if (!organisationResponse.ok) throw new Error(organisationPayload.error || "Unable to create the supplier organisation.");
      const locationResponse2 = await fetch(`/api/v1/organisations/${organisationPayload.id}/locations`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ name: form.get("location"), location_id: locationMatch?.id || 0, address: form.get("address"), phone: form.get("phone") }) });
      const supplierLocationPayload = await locationResponse2.json();
      if (!locationResponse2.ok) throw new Error(supplierLocationPayload.error || "Unable to create the nursery location.");
      const nurseryResponse = await fetch("/api/v1/nurseries", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ organisation_id: organisationPayload.id, supplier_location_id: supplierLocationPayload.id, operator_name: form.get("operator"), whatsapp: form.get("phone"), years_operating: null, description: `${form.get("description")} Products: ${form.get("crops")}.` }) });
      const nurseryPayload = await nurseryResponse.json();
      if (!nurseryResponse.ok) throw new Error(nurseryPayload.error || "Unable to create the nursery profile.");
      const verificationResponse = await fetch(`/api/v1/nurseries/${nurseryPayload.id}/verification-submissions`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ notes: "Submitted through the FarmConnect nursery operator onboarding flow." }) });
      const verificationPayload = await verificationResponse.json();
      if (!verificationResponse.ok) throw new Error(verificationPayload.error || "Unable to submit verification.");
      window.alert("Nursery submitted for verification.");
      location.hash = "dashboard";
      render();
    } catch (requestError) {
      const error = event.currentTarget.querySelector(".form-error");
      if (error) { error.textContent = requestError.message || "Unable to submit nursery registration."; error.hidden = false; }
      else window.alert(requestError.message || "Unable to submit nursery registration.");
    }
    return;
  }
  if (event.currentTarget.classList.contains("supplier-listing-form")) {
    const error = event.currentTarget.querySelector(".form-error");
    const body = {
      supplier_location_id: Number(form.get("supplier_location_id")),
      product_id: Number(form.get("product_id")),
      variety_id: Number(form.get("variety_id") || 0),
      price: Number(form.get("price")),
      unit: String(form.get("unit") || "").trim(),
      available_quantity: Number(form.get("available_quantity")),
      minimum_quantity: Number(form.get("minimum_quantity")),
      status: String(form.get("status") || "draft")
    };
    try {
      const response = await fetch("/api/v1/listings", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) { if (error) { error.textContent = payload.error || "Unable to create this listing."; error.hidden = false; } return; }
      await hydrateSupplierCatalogue();
    } catch (requestError) {
      if (error) { error.textContent = "The listing service is unavailable. Try again shortly."; error.hidden = false; }
    }
    return;
  }
  if (!demoMode) {
    const error = event.currentTarget.querySelector(".form-error");
    try {
      const response = await fetch("/api/v1/demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          crop: String(form.get("crop") || "").trim(),
          quantity: Number(form.get("quantity")),
          unit: String(form.get("unit") || "").trim(),
          target_price: Number(form.get("price")),
          location: String(form.get("location") || "").trim(),
          delivery_date: String(form.get("delivery") || ""),
          notes: String(form.get("notes") || "").trim()
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        if (error) { error.textContent = payload.error || "Unable to post demand."; error.hidden = false; }
        return;
      }
      await hydrateDemands();
      location.hash = "marketplace";
      render();
    } catch (requestError) {
      if (error) { error.textContent = "The demand service is unavailable. Try again shortly."; error.hidden = false; }
    }
    return;
  }
  state.demands.unshift({ id: `D-${1043 + state.demands.length}`, crop: form.get("crop"), quantity: Number(form.get("quantity")), unit: form.get("unit"), price: Number(form.get("price")), location: form.get("location"), delivery: form.get("delivery"), buyer: "James' Produce Co.", status: "Open", offers: [] });
  save(); location.hash = "marketplace"; render();
}

window.addEventListener("hashchange", render);
render();
hydrateNurseries();
hydrateDemands();
hydrateSession();