/**
 * World Bank - Climate Stress Testing of Bank Loan Portfolios (FIN-01)
 * Production-Grade Client Controller & Quantitative Analytics Engine
 */

// Application State
let activeTab = "dashboard";
let currentScenario = {
    preset_name: "ngfs_disorderly",
    flood_severity: 0.50,
    heat_days: 35,
    carbon_tax_shock: 0.20,
    cascade_multiplier: 1.18
};

let simulationResults = null;
let portfolioData = [];
let floodGridsData = [];

// Leaflet Map & Charts
let map = null;
let streetLayer = null;
let satLayer = null;
let currentBaseLayer = "street";
let markersLayer = null;
let hazardLayer = null;
let sectorChart = null;
let scenarioCompareChart = null;
let horizonChart = null;
let selectedMapCorridor = "ALL";
let selectedMapSector = "ALL";
let currentDossierLoan = null;

// Presets Definition
const PRESETS = {
    "baseline": {
        name: "Baseline (Historical Norm)",
        flood_severity: 0.05,
        heat_days: 5,
        carbon_tax_shock: 0.00,
        cascade_multiplier: 1.00,
        desc: "Historical climatological baseline; stable weather patterns with zero transition carbon costs."
    },
    "ngfs_orderly": {
        name: "NGFS Orderly Net-Zero (+1.5°C)",
        flood_severity: 0.25,
        heat_days: 18,
        carbon_tax_shock: 0.30,
        cascade_multiplier: 1.05,
        desc: "Early climate transition policy; moderate physical hazards balanced by planned carbon pricing."
    },
    "ngfs_disorderly": {
        name: "NGFS Disorderly (+2.0°C Delayed Shock)",
        flood_severity: 0.50,
        heat_days: 35,
        carbon_tax_shock: 0.20,
        cascade_multiplier: 1.18,
        desc: "Delayed policy action followed by sudden carbon tax shock and unmitigated coastal flood plain inundation."
    },
    "ngfs_hothouse": {
        name: "NGFS Hot House World (+3.5°C Catastrophic)",
        flood_severity: 0.85,
        heat_days: 55,
        carbon_tax_shock: 0.05,
        cascade_multiplier: 1.35,
        desc: "Runaway global warming; catastrophic sea-level rises, chronic heatwaves, and severe riverine delta washouts."
    }
};

// Bootstrap
document.addEventListener("DOMContentLoaded", () => {
    initClock();
    initMap();
    initEventListeners();
    fetchFloodGrids();
    applyPreset("ngfs_disorderly", false);
    runSimulation();
});

// Real-time Clock
function initClock() {
    const clockEl = document.getElementById("header-clock");
    const updateTime = () => {
        const now = new Date();
        if (clockEl) clockEl.innerText = now.toUTCString().replace("GMT", "UTC");
    };
    updateTime();
    setInterval(updateTime, 1000);
}

// Navigation Tabs
function switchTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabId);
    });

    document.querySelectorAll(".tab-pane").forEach(pane => {
        pane.classList.toggle("hidden", pane.id !== `tab-${tabId}`);
    });

    // Lazy load tab contents
    if (tabId === "scenarios") loadScenarioComparison();
    else if (tabId === "supply-chain") loadSupplyChainNetwork();
    else if (tabId === "horizons") loadTimeHorizon();
    else if (tabId === "carbon-liquidity") loadCarbonAndLiquidity();
    else if (tabId === "dashboard") {
        setTimeout(() => { if (map) map.invalidateSize(); }, 150);
    }
}

// Map Initialization — OpenStreetMap tiles & Esri Satellite Imagery
function initMap() {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconUrl: "/static/images/marker-icon.png",
        iconRetinaUrl: "/static/images/marker-icon-2x.png",
        shadowUrl: "/static/images/marker-shadow.png"
    });

    map = L.map("risk-map", {
        center: [20.5937, 78.9629],  // Center of India
        zoom: 5,
        zoomControl: true,
        attributionControl: true
    });

    // Street Layer: OpenStreetMap
    streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors | World Bank FIN-01'
    });

    // Satellite Layer: Esri World Imagery (High-res true color satellite photographs)
    satLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community'
    });

    streetLayer.addTo(map);

    markersLayer = L.layerGroup().addTo(map);
    hazardLayer = L.layerGroup().addTo(map);

    setTimeout(() => { map.invalidateSize(true); }, 400);
}

function switchBaseLayer(layerType) {
    currentBaseLayer = layerType;
    const btnStreet = document.getElementById("btn-map-street");
    const btnSat = document.getElementById("btn-map-sat");

    if (layerType === "sat") {
        if (map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
        if (!map.hasLayer(satLayer)) satLayer.addTo(map);
        if (btnSat) { btnSat.className = "px-2 py-0.5 bg-slate-900 text-white transition"; }
        if (btnStreet) { btnStreet.className = "px-2 py-0.5 bg-white text-slate-700 hover:bg-slate-100 transition"; }
    } else {
        if (map.hasLayer(satLayer)) map.removeLayer(satLayer);
        if (!map.hasLayer(streetLayer)) streetLayer.addTo(map);
        if (btnStreet) { btnStreet.className = "px-2 py-0.5 bg-slate-900 text-white transition"; }
        if (btnSat) { btnSat.className = "px-2 py-0.5 bg-white text-slate-700 hover:bg-slate-100 transition"; }
    }
}



async function fetchFloodGrids() {
    try {
        const res = await fetch("/api/flood-grids");
        if (res.ok) {
            floodGridsData = await res.json();
            renderFloodHazardGrids(floodGridsData);
        }
    } catch (e) {
        console.warn("Flood grids fallback:", e);
    }
}

function renderFloodHazardGrids(grids) {
    hazardLayer.clearLayers();
    grids.forEach(g => {
        const poly = L.polygon(g.bbox, {
            color: "#0284c7",
            weight: 1.5,
            fillColor: "#38bdf8",
            fillOpacity: 0.18,
            dashArray: "3, 3"
        }).addTo(hazardLayer);

        poly.bindTooltip(`
            <div class="font-sans text-xs">
                <b>${g.corridor}</b><br>
                <span class="text-slate-500 font-mono">100-Yr Depth: ${g.rp100_inundation_depth_m}m | 500-Yr: ${g.rp500_inundation_depth_m}m</span><br>
                <span class="text-rose-600 font-semibold">Asset Exposure: $${g.asset_exposure_usd_m}M (${g.vulnerability_tier})</span>
            </div>
        `, { sticky: true });
    });
}

function toggleHazardOverlay() {
    const isChecked = document.getElementById("toggle-hazard-layer").checked;
    if (isChecked) {
        if (!map.hasLayer(hazardLayer)) map.addLayer(hazardLayer);
    } else {
        if (map.hasLayer(hazardLayer)) map.removeLayer(hazardLayer);
    }
}

// Event Listeners
function initEventListeners() {
    // Tabs
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Preset selector
    document.getElementById("scenario-preset").addEventListener("change", (e) => {
        applyPreset(e.target.value, true);
    });

    // Sliders
    const sliders = ["flood_severity", "heat_days", "carbon_tax_shock", "cascade_multiplier"];
    sliders.forEach(key => {
        const el = document.getElementById(`slider-${key}`);
        if (el) {
            el.addEventListener("input", (e) => {
                currentScenario[key] = parseFloat(e.target.value);
                updateSliderDisplay(key, e.target.value);
                document.getElementById("scenario-preset").value = "custom";
                document.getElementById("preset-desc").innerText = "Custom configuration: Parameters adjusted manually.";
            });
            el.addEventListener("change", () => runSimulation());
        }
    });

    document.getElementById("btn-run-simulation").addEventListener("click", () => runSimulation());
    document.getElementById("btn-reset-baseline").addEventListener("click", () => applyPreset("baseline", true));

    // Table Filters
    document.getElementById("table-search").addEventListener("input", filterTable);
    document.getElementById("table-sector-filter").addEventListener("change", filterTable);
    document.getElementById("table-risk-filter").addEventListener("change", filterTable);
    document.getElementById("toggle-hazard-layer").addEventListener("change", toggleHazardOverlay);

    // Export & Board Briefing Buttons
    document.getElementById("btn-export-csv").addEventListener("click", exportAuditCSV);
    document.getElementById("btn-board-briefing").addEventListener("click", openBoardBriefing);

    // Dataset Switcher Dropdown
    document.getElementById("active-dataset-select").addEventListener("change", async (e) => {
        await switchDataset(e.target.value);
    });

    // Onboarding Form
    const onboardForm = document.getElementById("form-add-facility");
    if (onboardForm) {
        onboardForm.addEventListener("submit", handleAddFacility);
    }

    // CSV Upload Form
    const uploadInput = document.getElementById("csv-file-upload");
    if (uploadInput) {
        uploadInput.addEventListener("change", handleCSVUpload);
    }

    // Satellite / Street Map Toggle
    const btnStreet = document.getElementById("btn-map-street");
    if (btnStreet) btnStreet.addEventListener("click", () => switchBaseLayer("street"));
    const btnSat = document.getElementById("btn-map-sat");
    if (btnSat) btnSat.addEventListener("click", () => switchBaseLayer("sat"));

    // Map Corridor & Sector Filters
    const mapCorridor = document.getElementById("map-filter-corridor");
    if (mapCorridor) {
        mapCorridor.addEventListener("change", (e) => {
            selectedMapCorridor = e.target.value;
            if (simulationResults) updateMapMarkers(simulationResults.loans);
        });
    }
    const mapSector = document.getElementById("map-filter-sector");
    if (mapSector) {
        mapSector.addEventListener("change", (e) => {
            selectedMapSector = e.target.value;
            if (simulationResults) updateMapMarkers(simulationResults.loans);
        });
    }

    // Reverse Stress Test & Certificate Buttons
    const btnRevStress = document.getElementById("btn-open-reverse-stress");
    if (btnRevStress) btnRevStress.addEventListener("click", openReverseStressModal);
    const btnCert = document.getElementById("btn-open-certificate");
    if (btnCert) btnCert.addEventListener("click", openBoardBriefing);

    // Green Adaptation Button inside Borrower Dossier Modal
    const btnAdap = document.getElementById("btn-toggle-adaptation");
    if (btnAdap) btnAdap.addEventListener("click", toggleGreenAdaptation);

    // 3D Topography Surge Slider
    const surgeSlider = document.getElementById("slider-map-surge");
    if (surgeSlider) {
        surgeSlider.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value);
            document.getElementById("val-map-surge").innerText = `+${val.toFixed(1)}m`;
            updateSurgeInundation(val);
        });
    }

    // PCAF Carbon Price Slider
    const carbonSlider = document.getElementById("slider-carbon-price");
    if (carbonSlider) {
        carbonSlider.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value);
            document.getElementById("val-carbon-price").innerText = `$${val.toFixed(0)} / tCO2e`;
            fetchPCAFEmissions(val);
        });
    }

    // Basel III Liquidity Shock Slider
    const lcrSlider = document.getElementById("slider-lcr-flood-shock");
    if (lcrSlider) {
        lcrSlider.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value);
            document.getElementById("val-lcr-flood-shock").innerText = `${Math.round(val * 100)}% Inundation`;
            fetchLiquidityStress(val);
        });
    }

    // Initialize AI Risk Copilot
    initAICopilot();

    // Modals Keydown
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeBorrowerModal();
            closeBoardBriefingModal();
            closeReverseStressModal();
            const aiPanel = document.getElementById("ai-copilot-panel");
            if (aiPanel) aiPanel.classList.add("hidden");
        }
    });
}

function applyPreset(key, triggerSim = true) {
    if (!PRESETS[key]) return;
    const p = PRESETS[key];
    currentScenario.preset_name = key;
    currentScenario.flood_severity = p.flood_severity;
    currentScenario.heat_days = p.heat_days;
    currentScenario.carbon_tax_shock = p.carbon_tax_shock;
    currentScenario.cascade_multiplier = p.cascade_multiplier;

    document.getElementById("slider-flood_severity").value = p.flood_severity;
    document.getElementById("slider-heat_days").value = p.heat_days;
    document.getElementById("slider-carbon_tax_shock").value = p.carbon_tax_shock;
    document.getElementById("slider-cascade_multiplier").value = p.cascade_multiplier;

    updateSliderDisplay("flood_severity", p.flood_severity);
    updateSliderDisplay("heat_days", p.heat_days);
    updateSliderDisplay("carbon_tax_shock", p.carbon_tax_shock);
    updateSliderDisplay("cascade_multiplier", p.cascade_multiplier);

    document.getElementById("preset-desc").innerText = p.desc;
    if (triggerSim) runSimulation();
}

function updateSliderDisplay(key, val) {
    const disp = document.getElementById(`val-${key}`);
    if (!disp) return;
    if (key === "flood_severity") disp.innerText = `${Math.round(val * 100)}% Severity`;
    else if (key === "heat_days") disp.innerText = `${val} Days`;
    else if (key === "carbon_tax_shock") disp.innerText = `${Math.round(val * 100)}% Cost Shock`;
    else if (key === "cascade_multiplier") disp.innerText = `${parseFloat(val).toFixed(2)}x Spillover`;
}

// Core Simulation Run
async function runSimulation() {
    setLoadingState(true);
    try {
        const response = await fetch("/api/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(currentScenario)
        });

        if (!response.ok) throw new Error("Stress simulation failed");

        simulationResults = await response.json();
        portfolioData = simulationResults.loans;

        updateKPICards(simulationResults.kpis);
        if (simulationResults.ifrs9) updateIFRS9Cards(simulationResults.ifrs9);
        updateMapMarkers(simulationResults.loans);
        updateSectorChart(simulationResults.sectors);
        updateRatingMatrix(simulationResults.rating_migration);
        renderTable(simulationResults.loans);

    } catch (err) {
        console.error("Simulation error:", err);
        alert("Failed to compute stress test: " + err.message);
    } finally {
        setLoadingState(false);
    }
}

function setLoadingState(isLoading) {
    const btn = document.getElementById("btn-run-simulation");
    if (isLoading) {
        btn.innerHTML = `<span class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span> Processing...`;
        btn.disabled = true;
    } else {
        btn.innerHTML = `<span>Re-Calculate Risk</span>`;
        btn.disabled = false;
    }
}

function updateKPICards(kpis) {
    document.getElementById("kpi-total-ead").innerText = `$${kpis.total_portfolio_ead_millions.toLocaleString()}M`;
    document.getElementById("kpi-base-el").innerText = `$${kpis.baseline_expected_loss_millions.toFixed(2)}M`;
    document.getElementById("kpi-stressed-el").innerText = `$${kpis.stressed_expected_loss_millions.toFixed(2)}M`;

    const elDeltaBadge = document.getElementById("kpi-el-surge-badge");
    elDeltaBadge.innerText = `+${kpis.expected_loss_surge_pct}% (+$${kpis.expected_loss_surge_millions.toFixed(1)}M)`;

    document.getElementById("kpi-stressed-car").innerText = `${kpis.stressed_car_pct.toFixed(2)}%`;

    const carBadge = document.getElementById("kpi-car-status-badge");
    const carDepletionEl = document.getElementById("kpi-car-depletion");
    carDepletionEl.innerText = `-${kpis.car_depletion_bps} bps (Base: ${kpis.baseline_car_pct}%)`;

    if (kpis.is_car_breached) {
        carBadge.className = "badge-reg badge-critical";
        carBadge.innerText = "REGULATORY BREACH (<10.5%)";
    } else if (kpis.stressed_car_pct < 12.0) {
        carBadge.className = "badge-reg badge-elevated";
        carBadge.innerText = "CAPITAL BUFFER WARNING";
    } else {
        carBadge.className = "badge-reg badge-stable";
        carBadge.innerText = "BASEL III COMPLIANT";
    }

    document.getElementById("kpi-critical-loans").innerText = `${kpis.critical_loans}`;
    document.getElementById("kpi-elevated-loans").innerText = `${kpis.elevated_loans}`;
    document.getElementById("kpi-stable-loans").innerText = `${kpis.stable_loans}`;
    document.getElementById("kpi-var-99").innerText = `$${kpis.var_99_stressed_millions.toFixed(1)}M`;
    document.getElementById("kpi-audit-hash-badge").innerText = kpis.audit_hash;
}

function updateIFRS9Cards(ifrs9) {
    if (!ifrs9) return;
    const badge = document.getElementById("ifrs9-total-provision-badge");
    if (badge) badge.innerText = `$${ifrs9.total_ecl_provision_millions.toFixed(2)}M Required`;

    const s1sub = document.getElementById("ifrs9-stage1-sub");
    if (s1sub) s1sub.innerText = `${ifrs9.stage_1.count} Facilities • $${ifrs9.stage_1.ead_millions}M EAD`;
    const s1prov = document.getElementById("ifrs9-stage1-prov");
    if (s1prov) s1prov.innerText = `$${ifrs9.stage_1.provision_millions.toFixed(2)}M`;

    const s2sub = document.getElementById("ifrs9-stage2-sub");
    if (s2sub) s2sub.innerText = `${ifrs9.stage_2.count} Facilities • Lifetime ECL`;
    const s2prov = document.getElementById("ifrs9-stage2-prov");
    if (s2prov) s2prov.innerText = `$${ifrs9.stage_2.provision_millions.toFixed(2)}M`;

    const s3sub = document.getElementById("ifrs9-stage3-sub");
    if (s3sub) s3sub.innerText = `${ifrs9.stage_3.count} Facilities • Severe Physical Impairment`;
    const s3prov = document.getElementById("ifrs9-stage3-prov");
    if (s3prov) s3prov.innerText = `$${ifrs9.stage_3.provision_millions.toFixed(2)}M`;

    const migPct = document.getElementById("ifrs9-migration-pct");
    if (migPct) migPct.innerText = `${ifrs9.stage_2_3_ratio_pct}% Distressed (Stage 2 & 3)`;

    const total = ifrs9.stage_1.count + ifrs9.stage_2.count + ifrs9.stage_3.count;
    if (total > 0) {
        const p1 = (ifrs9.stage_1.count / total) * 100;
        const p2 = (ifrs9.stage_2.count / total) * 100;
        const p3 = (ifrs9.stage_3.count / total) * 100;
        const b1 = document.getElementById("ifrs9-bar-stage1");
        const b2 = document.getElementById("ifrs9-bar-stage2");
        const b3 = document.getElementById("ifrs9-bar-stage3");
        if (b1) b1.style.width = `${p1}%`;
        if (b2) b2.style.width = `${p2}%`;
        if (b3) b3.style.width = `${p3}%`;
    }
}

function populateMapFilterDropdowns(loans) {
    const corridorSelect = document.getElementById("map-filter-corridor");
    const sectorSelect = document.getElementById("map-filter-sector");
    if (!corridorSelect || !sectorSelect) return;

    if (corridorSelect.options.length <= 1) {
        const corridors = [...new Set(loans.map(l => l.corridor).filter(Boolean))].sort();
        corridors.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            corridorSelect.appendChild(opt);
        });
    }

    if (sectorSelect.options.length <= 1) {
        const sectors = [...new Set(loans.map(l => l.sector).filter(Boolean))].sort();
        sectors.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s;
            opt.textContent = s;
            sectorSelect.appendChild(opt);
        });
    }
}

function updateMapMarkers(loans) {
    markersLayer.clearLayers();
    populateMapFilterDropdowns(loans);

    const surgeLevel = parseFloat(document.getElementById("slider-map-surge")?.value || 0.0);

    const filtered = loans.filter(loan => {
        const matchCorridor = selectedMapCorridor === "ALL" || loan.corridor === selectedMapCorridor;
        const matchSector = selectedMapSector === "ALL" || loan.sector === selectedMapSector;
        return matchCorridor && matchSector;
    });

    const markerBounds = [];

    filtered.forEach(loan => {
        const elev = parseFloat(loan.elevation_m || 15.0);
        const isSubmerged = surgeLevel > 0 && elev <= surgeLevel;
        const inundationDepth = isSubmerged ? (surgeLevel - elev).toFixed(1) : 0;

        // Color by risk category or submerged
        const colors = {
            CRITICAL: { pin: "#dc2626", ring: "#fca5a5", text: "#dc2626" },
            ELEVATED: { pin: "#d97706", ring: "#fcd34d", text: "#d97706" },
            STABLE:   { pin: "#16a34a", ring: "#86efac", text: "#16a34a" }
        };
        const c = colors[loan.risk_category] || colors.STABLE;

        // Google Maps-style teardrop SVG pin icon with wave badge if submerged
        const svgPin = isSubmerged ? `
            <div style="position:relative;cursor:pointer;">
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 28 38">
                  <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 24 14 24S28 24.5 28 14C28 6.27 21.73 0 14 0z"
                        fill="#2563eb" stroke="#bfdbfe" stroke-width="2"/>
                  <circle cx="14" cy="14" r="6" fill="#eff6ff"/>
                </svg>
                <span style="position:absolute;top:-6px;right:-8px;background:#1d4ed8;color:white;font-size:9px;font-weight:bold;padding:1px 4px;border-radius:999px;border:1px solid white;">🌊</span>
            </div>` : `
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
              <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 24 14 24S28 24.5 28 14C28 6.27 21.73 0 14 0z"
                    fill="${c.pin}" stroke="white" stroke-width="1.5"/>
              <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
            </svg>`;

        const customIcon = L.divIcon({
            html: svgPin,
            className: "",
            iconSize:   isSubmerged ? [30, 40] : [28, 38],
            iconAnchor: [14, 38],
            popupAnchor: [0, -40]
        });

        const marker = L.marker([loan.lat, loan.lng], { icon: customIcon });

        const riskBadgeStyle = isSubmerged 
            ? "background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd;" 
            : ({
                CRITICAL: "background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;",
                ELEVATED: "background:#fffbeb;color:#d97706;border:1px solid #fcd34d;",
                STABLE:   "background:#f0fdf4;color:#16a34a;border:1px solid #86efac;"
            }[loan.risk_category] || "");

        const badgeLabel = isSubmerged ? "SUBMERGED" : loan.risk_category;

        const popupContent = `
            <div style="font-family:sans-serif;font-size:12px;min-width:230px;padding:4px 2px;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:6px;margin-bottom:6px;border-bottom:1px solid #e2e8f0;">
                    <span style="font-weight:700;color:#1e293b;font-size:13px;">${loan.borrower}</span>
                    <span style="padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:700;${riskBadgeStyle}">${badgeLabel}</span>
                </div>
                <table style="width:100%;border-collapse:collapse;color:#475569;line-height:1.7;">
                    <tr><td style="font-weight:600;padding-right:8px;">📍 Location</td><td>${loan.city || loan.corridor || "—"}</td></tr>
                    <tr><td style="font-weight:600;">💰 Exposure (EAD)</td><td style="font-weight:700;color:#1e293b;">$${loan.ead_millions}M</td></tr>
                    <tr><td style="font-weight:600;">🏭 Sector</td><td>${loan.sector}</td></tr>
                    <tr><td style="font-weight:600;">📊 Rating</td><td style="font-family:monospace;font-weight:700;">${loan.base_rating} → <span style="color:${c.text}">${loan.stressed_rating}</span></td></tr>
                    ${isSubmerged ? `
                    <tr style="background:#eff6ff;"><td style="font-weight:700;color:#1d4ed8;">🌊 Inundation Depth</td><td style="font-weight:800;color:#1d4ed8;">+${inundationDepth}m (Elev: ${elev}m)</td></tr>
                    ` : `
                    <tr><td style="font-weight:600;">⛰️ Ground Elevation</td><td style="color:#475569;">${elev}m AMSL</td></tr>
                    `}
                    <tr><td style="font-weight:600;">🌊 Flood Damage</td><td style="color:#dc2626;font-weight:700;">${loan.physical_damage_pct}%</td></tr>
                    <tr><td style="font-weight:600;">⚠️ Stressed EL</td><td style="color:#dc2626;font-weight:700;">$${loan.stressed_el_millions}M</td></tr>
                </table>
                <div style="display:flex;gap:6px;margin-top:8px;">
                    <button onclick="openBorrowerModal('${loan.id}')" style="flex:1;padding:5px 0;background:#0f172a;color:white;border:none;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;">
                        📋 Dossier & PDF
                    </button>
                    <button onclick="fetchLiveWeather(${loan.lat}, ${loan.lng}, '${loan.borrower}')" style="padding:5px 10px;background:#1d4ed8;color:white;border:none;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;">
                        🛰 Live Sat.
                    </button>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 280 });
        markersLayer.addLayer(marker);
        markerBounds.push([loan.lat, loan.lng]);
    });

    if (markerBounds.length > 0 && (selectedMapCorridor !== "ALL" || selectedMapSector !== "ALL")) {
        map.fitBounds(L.latLngBounds(markerBounds), { padding: [40, 40], maxZoom: 9 });
    }
}


function updateSectorChart(sectors) {
    const ctx = document.getElementById("sector-risk-chart").getContext("2d");
    const labels = sectors.map(s => s.sector.length > 20 ? s.sector.substring(0, 20) + "..." : s.sector);
    const baseEL = sectors.map(s => s.base_el);
    const stressedEL = sectors.map(s => s.stressed_el);

    if (sectorChart) sectorChart.destroy();

    sectorChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Baseline EL ($M)",
                    data: baseEL,
                    backgroundColor: "#94a3b8",
                    borderColor: "#64748b",
                    borderWidth: 1,
                    barPercentage: 0.6
                },
                {
                    label: "Stressed EL ($M)",
                    data: stressedEL,
                    backgroundColor: "#b91c1c",
                    borderColor: "#991b1b",
                    borderWidth: 1,
                    barPercentage: 0.6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}M` } }
            },
            scales: {
                x: { ticks: { font: { size: 10 }, maxRotation: 25 } },
                y: { title: { display: true, text: "Expected Loss ($M)" }, grid: { color: "#f1f5f9" } }
            }
        }
    });
}

function updateRatingMatrix(migrationData) {
    const container = document.getElementById("rating-matrix-container");
    container.innerHTML = "";
    const ratingsOrder = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC / Default"];

    let html = `
        <table class="w-full text-xs border-collapse">
            <thead>
                <tr class="bg-slate-100 text-slate-600 border-b border-slate-200">
                    <th class="p-2 text-left font-semibold">Base Rating</th>
                    <th class="p-2 text-center font-semibold">Facilities</th>
                    <th class="p-2 text-center font-semibold text-rose-700">Downgraded To</th>
                    <th class="p-2 text-right font-semibold">Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    ratingsOrder.forEach(baseGrade => {
        if (!migrationData[baseGrade]) return;
        const originalCount = Object.values(migrationData[baseGrade]).reduce((a, b) => a + b, 0);
        const downgradedGrades = Object.entries(migrationData[baseGrade])
            .filter(([sGrade, count]) => sGrade !== baseGrade && count > 0)
            .map(([sGrade, count]) => `${sGrade} (${count})`)
            .join(", ") || "No notch downgrade";

        const unchangedCount = migrationData[baseGrade][baseGrade] || 0;
        const downgradeRatio = Math.round(((originalCount - unchangedCount) / originalCount) * 100);

        html += `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="p-2 font-mono font-bold text-slate-800">${baseGrade}</td>
                <td class="p-2 text-center font-mono">${originalCount}</td>
                <td class="p-2 text-center font-mono ${downgradeRatio > 0 ? 'text-amber-800 font-bold' : 'text-slate-400'}">${downgradedGrades}</td>
                <td class="p-2 text-right">
                    ${downgradeRatio > 0 
                        ? `<span class="badge-reg badge-elevated">${downgradeRatio}% downgraded</span>` 
                        : `<span class="badge-reg badge-stable">Affirmed</span>`}
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function renderTable(loans) {
    const tbody = document.getElementById("portfolio-table-body");
    tbody.innerHTML = "";

    loans.forEach(loan => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition-colors";

        let riskBadge = `<span class="badge-reg badge-stable">STABLE</span>`;
        if (loan.risk_category === "CRITICAL") riskBadge = `<span class="badge-reg badge-critical">CRITICAL</span>`;
        else if (loan.risk_category === "ELEVATED") riskBadge = `<span class="badge-reg badge-elevated">ELEVATED</span>`;

        const isDowngraded = loan.base_rating !== loan.stressed_rating;
        const ratingDisplay = isDowngraded 
            ? `<span class="font-mono text-slate-500">${loan.base_rating}</span> → <span class="font-mono font-bold text-rose-700">${loan.stressed_rating}</span>`
            : `<span class="font-mono text-slate-700">${loan.base_rating}</span>`;

        tr.innerHTML = `
            <td class="num-mono font-semibold text-slate-800">${loan.id}</td>
            <td class="font-medium text-slate-900">${loan.borrower}</td>
            <td class="text-slate-600">${loan.sector}</td>
            <td class="text-slate-500 text-xs">${loan.corridor}</td>
            <td class="num-mono font-semibold text-right">$${loan.ead_millions.toFixed(1)}M</td>
            <td class="text-center">${ratingDisplay}</td>
            <td class="num-mono text-right">${(loan.stressed_pd * 100).toFixed(2)}%</td>
            <td class="num-mono text-right">${(loan.stressed_lgd * 100).toFixed(1)}%</td>
            <td class="num-mono font-bold text-right text-rose-700">$${loan.stressed_el_millions.toFixed(2)}M</td>
            <td class="num-mono text-right ${loan.physical_damage_pct > 25 ? 'text-rose-600 font-bold' : 'text-slate-600'}">${loan.physical_damage_pct}%</td>
            <td class="text-center">${riskBadge}</td>
            <td class="text-right">
                <div class="flex items-center justify-end gap-1.5">
                    <button onclick="openBorrowerModal('${loan.id}')" class="px-2.5 py-1 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded shadow-xs transition flex items-center gap-1">
                        📋 Dossier & PDF
                    </button>
                    <button onclick="fetchLiveWeather(${loan.lat}, ${loan.lng}, '${loan.borrower}')" title="Fetch Real-Time Satellite Feed" class="px-2 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded shadow-xs transition">
                        🛰️ Live
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById("table-record-count").innerText = `Showing ${loans.length} Facility Records`;
}

function filterTable() {
    if (!simulationResults) return;
    const searchTerm = document.getElementById("table-search").value.toLowerCase();
    const sectorFilter = document.getElementById("table-sector-filter").value;
    const riskFilter = document.getElementById("table-risk-filter").value;

    const filtered = simulationResults.loans.filter(loan => {
        const matchesSearch = loan.borrower.toLowerCase().includes(searchTerm) || 
                              loan.corridor.toLowerCase().includes(searchTerm) ||
                              loan.id.toLowerCase().includes(searchTerm);
        const matchesSector = sectorFilter === "ALL" || loan.sector === sectorFilter;
        const matchesRisk = riskFilter === "ALL" || loan.risk_category === riskFilter;
        return matchesSearch && matchesSector && matchesRisk;
    });

    renderTable(filtered);
}

// ==================== LIVE SATELLITE WEATHER INTEGRATION ====================
async function fetchLiveWeather(lat, lng, entityName) {
    const modalEl = document.getElementById("satellite-weather-modal");
    document.getElementById("sat-entity-name").innerText = entityName;
    document.getElementById("sat-coords").innerText = `GPS: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
    document.getElementById("sat-loading-indicator").classList.remove("hidden");
    document.getElementById("sat-data-content").classList.add("hidden");
    modalEl.classList.remove("hidden");

    try {
        const res = await fetch(`/api/live-weather?lat=${lat}&lng=${lng}`);
        const data = await res.json();

        document.getElementById("sat-loading-indicator").classList.add("hidden");
        document.getElementById("sat-data-content").classList.remove("hidden");

        document.getElementById("sat-temperature").innerText = `${data.temperature_c}°C`;
        document.getElementById("sat-precipitation").innerText = `${data.precipitation_mm} mm`;
        document.getElementById("sat-humidity").innerText = `${data.humidity_pct}%`;
        document.getElementById("sat-wind").innerText = `${data.wind_speed_kmh} km/h`;
        document.getElementById("sat-thermal-badge").innerText = data.thermal_status;
        document.getElementById("sat-precip-badge").innerText = data.precipitation_status;
        document.getElementById("sat-timestamp").innerText = `Telemetry: ${data.timestamp} | Source: Open-Meteo Satellite Feed`;

    } catch (e) {
        document.getElementById("sat-loading-indicator").innerText = "Failed to pull live telemetry feed: " + e.message;
    }
}

function closeSatelliteModal() {
    document.getElementById("satellite-weather-modal").classList.add("hidden");
}

// ==================== TAB 2: SCENARIO COMPARISON STUDIO ====================
async function loadScenarioComparison() {
    const container = document.getElementById("scenarios-table-body");
    container.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-slate-500">Computing NGFS multi-scenario simulations...</td></tr>`;

    try {
        const res = await fetch("/api/scenarios-compare");
        const data = await res.json();
        const scList = data.comparison;

        container.innerHTML = "";
        const scNames = [];
        const elLosses = [];
        const carValues = [];

        scList.forEach(sc => {
            scNames.push(sc.scenario);
            elLosses.push(sc.stressed_el_millions);
            carValues.push(sc.stressed_car_pct);

            const tr = document.createElement("tr");
            tr.className = "hover:bg-slate-50 border-b border-slate-200";

            let carStatusPill = `<span class="badge-reg badge-stable">COMPLIANT</span>`;
            if (sc.is_breached) carStatusPill = `<span class="badge-reg badge-critical">BREACHED</span>`;
            else if (sc.stressed_car_pct < 12.0) carStatusPill = `<span class="badge-reg badge-elevated">BUFFER DRAIN</span>`;

            tr.innerHTML = `
                <td class="p-3 font-bold text-slate-800">${sc.scenario}</td>
                <td class="p-3 num-mono text-right">$${sc.stressed_el_millions.toFixed(2)}M</td>
                <td class="p-3 num-mono text-right font-bold text-rose-700">+${sc.el_surge_pct}%</td>
                <td class="p-3 num-mono text-right font-bold text-blue-900">${sc.stressed_car_pct.toFixed(2)}%</td>
                <td class="p-3 num-mono text-right text-slate-500">-${sc.car_depletion_bps} bps</td>
                <td class="p-3 text-center num-mono font-bold text-rose-700">${sc.critical_loans}</td>
                <td class="p-3 text-center">${carStatusPill}</td>
            `;
            container.appendChild(tr);
        });

        // Scenario comparison chart
        const ctx = document.getElementById("scenario-compare-chart").getContext("2d");
        if (scenarioCompareChart) scenarioCompareChart.destroy();
        scenarioCompareChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: scNames,
                datasets: [
                    {
                        label: "Stressed Expected Loss ($M)",
                        data: elLosses,
                        backgroundColor: "#b91c1c",
                        yAxisID: "y"
                    },
                    {
                        label: "Capital Adequacy Ratio (CAR %)",
                        data: carValues,
                        type: "line",
                        borderColor: "#1e3a8a",
                        backgroundColor: "#1e3a8a",
                        borderWidth: 2,
                        yAxisID: "y1"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { title: { display: true, text: "Expected Loss ($M)" } },
                    y1: { position: "right", title: { display: true, text: "CAR (%)" }, min: 8, max: 16 }
                }
            }
        });

    } catch (e) {
        console.error("Scenario compare error:", e);
    }
}

// ==================== TAB 3: SUPPLY CHAIN & CONTAGION NETWORK ====================
async function loadSupplyChainNetwork() {
    const nodesContainer = document.getElementById("contagion-nodes-grid");
    const edgesContainer = document.getElementById("contagion-edges-list");
    nodesContainer.innerHTML = "<p class='p-3 text-slate-400'>Loading intersectoral contagion matrix...</p>";

    try {
        const res = await fetch(`/api/supply-chain-network?flood_severity=${currentScenario.flood_severity}&heat_days=${currentScenario.heat_days}`);
        const data = await res.json();

        nodesContainer.innerHTML = "";
        data.nodes.forEach(n => {
            const card = document.createElement("div");
            card.className = `p-3 rounded border ${n.is_contagion_origin ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'}`;
            card.innerHTML = `
                <div class="flex items-center justify-between">
                    <b class="text-xs text-slate-900">${n.name}</b>
                    <span class="badge-reg ${n.is_contagion_origin ? 'badge-critical' : 'badge-neutral'}">${n.status}</span>
                </div>
                <div class="mt-2 text-[11px] space-y-1 text-slate-600">
                    <div>Direct Exposure: <span class="font-mono font-bold">$${n.total_ead}M</span></div>
                    <div>Stressed Loss: <span class="font-mono font-bold text-rose-700">$${n.stressed_el}M</span> (+${n.surge_pct}%)</div>
                    <div>Critical Facilities: <span class="font-mono font-bold">${n.high_risk_count}</span></div>
                </div>
            `;
            nodesContainer.appendChild(card);
        });

        edgesContainer.innerHTML = "";
        data.edges.forEach(e => {
            const row = document.createElement("div");
            row.className = "p-2 rounded bg-white border border-slate-200 text-xs flex items-center justify-between";
            row.innerHTML = `
                <div>
                    <span class="font-bold text-slate-800">${e.source}</span>
                    <span class="text-slate-400 mx-1.5">➔</span>
                    <span class="font-bold text-slate-800">${e.target}</span>
                    <span class="text-[10px] text-slate-500 block">Linkage: ${e.dependency} (Elasticity: ${e.strength})</span>
                </div>
                <div class="text-right">
                    <span class="font-mono font-bold text-rose-700 text-xs">+${e.transmitted_shock_pct}%</span>
                    <span class="text-[10px] text-slate-500 block">Transmitted Shock</span>
                </div>
            `;
            edgesContainer.appendChild(row);
        });

    } catch (err) {
        console.error("Supply chain error:", err);
    }
}

// ==================== TAB 4: MULTI-YEAR HORIZON PROJECTIONS ====================
async function loadTimeHorizon() {
    const pathway = document.getElementById("horizon-pathway-select").value;
    const tbody = document.getElementById("horizon-table-body");
    tbody.innerHTML = "<tr><td colspan='6' class='p-3 text-center text-slate-400'>Calculating multi-year trajectory...</td></tr>";

    try {
        const res = await fetch(`/api/time-horizon?horizon_year=2030&pathway=${encodeURIComponent(pathway)}`);
        const data = await res.json();

        tbody.innerHTML = "";
        const years = [];
        const cars = [];
        const losses = [];

        data.trajectory.forEach(pt => {
            years.push(pt.year);
            cars.push(pt.projected_car_pct);
            losses.push(pt.stressed_el_millions);

            const tr = document.createElement("tr");
            tr.className = "hover:bg-slate-50 border-b border-slate-200";
            tr.innerHTML = `
                <td class="p-3 font-bold font-mono text-slate-900">${pt.year}</td>
                <td class="p-3 num-mono text-right">$${pt.stressed_el_millions.toFixed(2)}M</td>
                <td class="p-3 num-mono text-right font-bold text-blue-900">${pt.projected_car_pct.toFixed(2)}%</td>
                <td class="p-3 num-mono text-center">${pt.critical_facilities}</td>
                <td class="p-3 num-mono text-right">${pt.cumulative_damage_index} Index</td>
                <td class="p-3 text-center">${pt.is_breached ? '<span class="badge-reg badge-critical">BREACHED</span>' : '<span class="badge-reg badge-stable">MAINTAINED</span>'}</td>
            `;
            tbody.appendChild(tr);
        });

        const ctx = document.getElementById("horizon-trajectory-chart").getContext("2d");
        if (horizonChart) horizonChart.destroy();
        horizonChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: years,
                datasets: [
                    {
                        label: "Projected Capital Adequacy (CAR %)",
                        data: cars,
                        borderColor: "#1e3a8a",
                        backgroundColor: "rgba(30, 58, 138, 0.1)",
                        fill: true,
                        tension: 0.2
                    },
                    {
                        label: "Cumulative Stressed Loss ($M)",
                        data: losses,
                        borderColor: "#b91c1c",
                        backgroundColor: "transparent",
                        borderDash: [5, 5],
                        yAxisID: "y1"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { title: { display: true, text: "CAR (%)" }, min: 8, max: 16 },
                    y1: { position: "right", title: { display: true, text: "Expected Loss ($M)" } }
                }
            }
        });

    } catch (e) {
        console.error("Time horizon error:", e);
    }
}

// ==================== TAB 5 & 6: DATASET SWITCH & CSV UPLOAD & ONBOARDING ====================
async function switchDataset(key) {
    try {
        const formData = new FormData();
        formData.append("dataset_key", key);

        const res = await fetch("/api/switch-dataset", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Dataset switch failed");

        const data = await res.json();
        alert(`Switched active dataset to: ${key.toUpperCase()} (${data.facility_count} facilities loaded)`);
        runSimulation();
    } catch (e) {
        alert("Error switching dataset: " + e.message);
    }
}

async function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const statusEl = document.getElementById("upload-status-indicator");
    statusEl.innerHTML = `<span class="text-blue-700 font-semibold">Ingesting and geocoding ${file.name}...</span>`;

    try {
        const res = await fetch("/api/upload-portfolio", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload parsing failed");

        const data = await res.json();
        statusEl.innerHTML = `<span class="text-emerald-700 font-semibold">✓ Successfully ingested ${data.records_ingested} facilities! Portfolio updated.</span>`;
        document.getElementById("active-dataset-select").value = "custom_uploaded";
        switchTab("dashboard");
        runSimulation();
    } catch (err) {
        statusEl.innerHTML = `<span class="text-rose-700 font-semibold">Error: ${err.message}</span>`;
    }
}

async function handleAddFacility(e) {
    e.preventDefault();
    const payload = {
        borrower: document.getElementById("onboard-borrower").value,
        sector: document.getElementById("onboard-sector").value,
        corridor: document.getElementById("onboard-corridor").value,
        collateral_type: document.getElementById("onboard-collateral-type").value,
        ead_millions: parseFloat(document.getElementById("onboard-ead").value),
        collateral_value_millions: parseFloat(document.getElementById("onboard-collateral-val").value),
        lat: parseFloat(document.getElementById("onboard-lat").value),
        lng: parseFloat(document.getElementById("onboard-lng").value),
        elevation_m: parseFloat(document.getElementById("onboard-elevation").value),
        flood_hazard_zone: document.getElementById("onboard-flood-zone").value,
        heat_hazard_zone: document.getElementById("onboard-heat-zone").value
    };

    try {
        const res = await fetch("/api/add-facility", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to add facility");

        const data = await res.json();
        alert(`Facility successfully registered: ${data.facility_id} | Total Portfolio: ${data.total_facilities} facilities.`);
        document.getElementById("form-add-facility").reset();
        switchTab("dashboard");
        runSimulation();

    } catch (err) {
        alert("Facility registration error: " + err.message);
    }
}

// ==================== BORROWER MODAL & BOARD REPORT ====================
function openBorrowerModal(loanId) {
    const loan = simulationResults.loans.find(l => l.id === loanId);
    if (!loan) return;

    currentDossierLoan = loan;

    // Reset Green Adaptation Panel
    const adapPanel = document.getElementById("adaptation-results-panel");
    if (adapPanel) adapPanel.classList.add("hidden");
    const adapBtn = document.getElementById("btn-toggle-adaptation");
    if (adapBtn) adapBtn.innerText = "Simulate Green Capex";

    document.getElementById("modal-borrower-name").innerText = loan.borrower;
    document.getElementById("modal-loan-id").innerText = `Facility Reference: ${loan.id} | Origin: ${loan.dataset_origin || 'World Bank Book'}`;
    document.getElementById("modal-sector").innerText = loan.sector;
    document.getElementById("modal-corridor").innerText = loan.corridor;
    document.getElementById("modal-collateral-type").innerText = loan.collateral_type;
    document.getElementById("modal-ead").innerText = `$${loan.ead_millions}M`;
    document.getElementById("modal-collateral-base").innerText = `$${loan.collateral_base_millions}M`;
    document.getElementById("modal-collateral-stressed").innerText = `$${loan.stressed_collateral_millions}M`;
    document.getElementById("modal-flood-zone").innerText = loan.flood_hazard_zone;
    document.getElementById("modal-heat-zone").innerText = loan.heat_hazard_zone;
    document.getElementById("modal-physical-damage").innerText = `${loan.physical_damage_pct}%`;
    document.getElementById("modal-revenue-shock").innerText = `-${loan.revenue_shock_pct}%`;
    document.getElementById("modal-base-rating").innerText = loan.base_rating;
    document.getElementById("modal-stressed-rating").innerText = loan.stressed_rating;
    document.getElementById("modal-base-pd").innerText = `${(loan.base_pd * 100).toFixed(2)}%`;
    document.getElementById("modal-stressed-pd").innerText = `${(loan.stressed_pd * 100).toFixed(2)}% (${loan.pd_increase_factor}x)`;
    document.getElementById("modal-base-lgd").innerText = `${(loan.base_lgd * 100).toFixed(1)}%`;
    document.getElementById("modal-stressed-lgd").innerText = `${(loan.stressed_lgd * 100).toFixed(1)}%`;
    document.getElementById("modal-base-el").innerText = `$${loan.base_el_millions.toFixed(2)}M`;
    document.getElementById("modal-stressed-el").innerText = `$${loan.stressed_el_millions.toFixed(2)}M`;
    document.getElementById("modal-el-delta").innerText = `+$${loan.el_delta_millions.toFixed(2)}M`;

    // Live weather test button inside modal
    const liveSatBtn = document.getElementById("modal-btn-live-sat");
    if (liveSatBtn) {
        liveSatBtn.onclick = () => fetchLiveWeather(loan.lat, loan.lng, loan.borrower);
    }

    document.getElementById("borrower-modal").classList.remove("hidden");
}

function closeBorrowerModal() {
    document.getElementById("borrower-modal").classList.add("hidden");
}

async function toggleGreenAdaptation() {
    const panel = document.getElementById("adaptation-results-panel");
    const btn = document.getElementById("btn-toggle-adaptation");
    if (!panel || !currentDossierLoan) return;

    if (!panel.classList.contains("hidden")) {
        panel.classList.add("hidden");
        btn.innerText = "Simulate Green Capex";
        return;
    }

    btn.innerText = "Simulating...";
    btn.disabled = true;

    try {
        const url = `/api/simulate-adaptation/${currentDossierLoan.id}?capex_millions=1.5&flood_severity=${currentScenario.flood_severity}&heat_days=${currentScenario.heat_days}&carbon_tax_shock=${currentScenario.carbon_tax_shock}&cascade_multiplier=${currentScenario.cascade_multiplier}`;
        const res = await fetch(url, { method: "POST" });
        if (!res.ok) throw new Error("Adaptation model failed");
        const data = await res.json();

        document.getElementById("adap-damage-redux").innerText = `-${data.impact.damage_reduction_pct}%`;
        document.getElementById("adap-rating-shift").innerText = data.impact.rating_improvement;
        document.getElementById("adap-5yr-savings").innerText = `$${data.impact.five_year_loss_saved_millions}M`;
        document.getElementById("adap-roi").innerText = `+${data.impact.net_green_roi_pct}%`;

        panel.classList.remove("hidden");
        btn.innerText = "Hide Adaptation Model";
    } catch (e) {
        alert("Adaptation error: " + e.message);
        btn.innerText = "Simulate Green Capex";
    } finally {
        btn.disabled = false;
    }
}

async function openReverseStressModal() {
    const modal = document.getElementById("reverse-stress-modal");
    if (!modal) return;
    modal.classList.remove("hidden");
    
    document.getElementById("rev-recommendation").innerText = "Executing Bisection Root-Finding on Regulatory Capital Tier 1...";

    try {
        const res = await fetch("/api/reverse-stress-test");
        if (!res.ok) throw new Error("Reverse stress calculation failed");
        const data = await res.json();

        document.getElementById("rev-flood-tipping").innerText = `${data.tipping_point_flood_severity_pct}%`;
        document.getElementById("rev-carbon-tipping").innerText = `${data.tipping_point_carbon_tax_pct}%`;
        document.getElementById("rev-loss-buffer").innerText = `$${data.max_absorbable_loss_millions}M`;
        document.getElementById("rev-loss-tipping").innerText = `$${data.loss_at_tipping_point_millions}M`;
        document.getElementById("rev-recommendation").innerText = data.recommendation;
    } catch (e) {
        document.getElementById("rev-recommendation").innerText = "Error: " + e.message;
    }
}

function closeReverseStressModal() {
    const modal = document.getElementById("reverse-stress-modal");
    if (modal) modal.classList.add("hidden");
}

function openBoardBriefing() {
    if (!simulationResults) return;
    const k = simulationResults.kpis;
    document.getElementById("board-audit-hash").innerText = k.audit_hash;
    document.getElementById("board-portfolio-ead").innerText = `$${k.total_portfolio_ead_millions}M`;
    document.getElementById("board-stressed-el").innerText = `$${k.stressed_expected_loss_millions}M`;
    document.getElementById("board-el-surge").innerText = `+${k.expected_loss_surge_pct}%`;
    document.getElementById("board-stressed-car").innerText = `${k.stressed_car_pct}%`;
    document.getElementById("board-critical-count").innerText = `${k.critical_loans} Facilities`;
    document.getElementById("board-compliance-status").innerText = k.is_car_breached ? "STATUTORY BREACH (<10.50%)" : "REGULATORY CAPITAL ADEQUATE";

    const ifrsEl = document.getElementById("board-ifrs9-provision");
    if (ifrsEl) {
        const prov = k.ifrs9 ? k.ifrs9.total_ecl_provision_millions.toFixed(2) : "0.00";
        ifrsEl.innerText = `$${prov}M`;
    }

    const qrEl = document.getElementById("board-qr-hash");
    if (qrEl) qrEl.innerText = k.audit_hash;

    // Populate Itemized Facility Annexure Table (All Loans)
    const scheduleCountEl = document.getElementById("board-schedule-count");
    if (scheduleCountEl) scheduleCountEl.innerText = `${simulationResults.loans.length} Facilities Evaluated`;

    const tbody = document.getElementById("board-facility-table-body");
    if (tbody) {
        tbody.innerHTML = "";
        simulationResults.loans.forEach(loan => {
            const tr = document.createElement("tr");
            tr.className = loan.risk_category === "CRITICAL" ? "bg-rose-50/50" : (loan.risk_category === "ELEVATED" ? "bg-amber-50/40" : "");
            tr.innerHTML = `
                <td class="p-1.5 font-bold font-sans text-slate-900">${loan.borrower}</td>
                <td class="p-1.5 font-sans text-slate-600">${loan.sector}</td>
                <td class="p-1.5 text-right font-bold text-slate-900">$${loan.ead_millions}M</td>
                <td class="p-1.5 text-center">${loan.base_rating} ➔ ${loan.stressed_rating}</td>
                <td class="p-1.5 text-right font-bold ${loan.physical_damage_pct > 30 ? 'text-rose-700' : 'text-slate-700'}">${loan.physical_damage_pct}%</td>
                <td class="p-1.5 text-right font-bold text-rose-700">$${loan.stressed_el_millions}M</td>
                <td class="p-1.5 text-center font-sans font-bold text-[9px] ${loan.risk_category === 'CRITICAL' ? 'text-rose-700' : (loan.risk_category === 'ELEVATED' ? 'text-amber-700' : 'text-emerald-700')}">${loan.risk_category}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById("board-briefing-modal").classList.remove("hidden");
}

function closeBoardBriefingModal() {
    document.getElementById("board-briefing-modal").classList.add("hidden");
}

function printSingleBorrowerMemo() {
    window.print();
}

function exportAuditCSV() {
    const url = `/api/export-csv?flood_severity=${currentScenario.flood_severity}&heat_days=${currentScenario.heat_days}&carbon_tax_shock=${currentScenario.carbon_tax_shock}&cascade_multiplier=${currentScenario.cascade_multiplier}`;
    window.location.href = url;
}

// =====================================================================
// MODULE 1: PCAF FINANCED EMISSIONS & CARBON ACCOUNTING
// =====================================================================

let pcafData = null;

async function loadCarbonAndLiquidity() {
    const carbonPrice = parseFloat(document.getElementById("slider-carbon-price")?.value || 50);
    const floodShock = parseFloat(document.getElementById("slider-lcr-flood-shock")?.value || 0.50);
    await Promise.all([
        fetchPCAFEmissions(carbonPrice),
        fetchLiquidityStress(floodShock)
    ]);
}

async function fetchPCAFEmissions(carbonPrice = 50) {
    try {
        const res = await fetch(`/api/pcaf-emissions?carbon_price=${carbonPrice}`);
        if (!res.ok) throw new Error("PCAF emissions fetch failed");
        pcafData = await res.json();

        // Update KPIs
        const totEl = document.getElementById("pcaf-total-emissions");
        if (totEl) totEl.innerText = `${pcafData.total_financed_emissions_tco2e.toLocaleString()} tCO2e`;

        const s12El = document.getElementById("pcaf-scope12-emissions");
        if (s12El) s12El.innerText = `${(pcafData.financed_scope1_tco2e + pcafData.financed_scope2_tco2e).toLocaleString()} tCO2e`;

        const s3Sub = document.getElementById("pcaf-scope3-sub");
        if (s3Sub) s3Sub.innerText = `Scope 3: ${pcafData.financed_scope3_tco2e.toLocaleString()} tCO2e`;

        const waciEl = document.getElementById("pcaf-waci");
        if (waciEl) waciEl.innerText = `${pcafData.waci_tco2e_per_m_revenue}`;

        const taxEl = document.getElementById("pcaf-tax-liability");
        if (taxEl) taxEl.innerText = `$${pcafData.current_annual_tax_liability_millions.toFixed(2)}M`;

        const tier1Sub = document.getElementById("pcaf-tier1-impact-sub");
        if (tier1Sub) tier1Sub.innerText = `At $${carbonPrice}/t Carbon Price (Score: 2.3/5.0)`;

        // Sensitivity Matrix Table
        const sensTbody = document.getElementById("pcaf-sensitivity-table-body");
        if (sensTbody && pcafData.tax_price_sensitivities) {
            sensTbody.innerHTML = "";
            pcafData.tax_price_sensitivities.forEach(s => {
                const tr = document.createElement("tr");
                const isSelected = Math.abs(s.carbon_price_usd_per_tonne - carbonPrice) < 0.1;
                tr.className = isSelected ? "bg-emerald-50 font-bold" : "hover:bg-slate-50";
                tr.innerHTML = `
                    <td class="py-2 px-2 text-slate-800">$${s.carbon_price_usd_per_tonne.toFixed(0)} / tCO2e ${isSelected ? '●' : ''}</td>
                    <td class="py-2 px-2 font-mono text-rose-700">$${s.portfolio_tax_liability_millions.toFixed(2)}M</td>
                    <td class="py-2 px-2 font-mono text-slate-700">-${s.estimated_tier1_impact_bps.toFixed(1)} bps</td>
                    <td class="py-2 px-2 font-mono text-slate-700">-${s.ebitda_margin_reduction_pct.toFixed(1)}%</td>
                `;
                sensTbody.appendChild(tr);
            });
        }

        // Top 5 Polluters Table
        const topTbody = document.getElementById("pcaf-top-polluters-body");
        if (topTbody && pcafData.top_polluters) {
            topTbody.innerHTML = "";
            pcafData.top_polluters.forEach(p => {
                const tr = document.createElement("tr");
                tr.className = "hover:bg-slate-50";
                tr.innerHTML = `
                    <td class="py-2 px-2 font-semibold text-slate-900">${p.borrower}</td>
                    <td class="py-2 px-2 text-slate-600 text-[11px]">${p.sector}</td>
                    <td class="py-2 px-2 font-mono font-semibold">$${p.ead_millions.toFixed(1)}M</td>
                    <td class="py-2 px-2 font-mono font-bold text-slate-800">${p.total_financed_tco2e.toLocaleString()}</td>
                    <td class="py-2 px-2 font-mono text-rose-700 font-bold">$${p.carbon_tax_liability_millions.toFixed(3)}M</td>
                `;
                topTbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error("PCAF Error:", e);
    }
}

// =====================================================================
// MODULE 2: BASEL III LIQUIDITY STRESS TESTING (LCR)
// =====================================================================

let liquidityData = null;

async function fetchLiquidityStress(floodSeverity = 0.50) {
    try {
        const res = await fetch(`/api/liquidity-stress-test?flood_severity=${floodSeverity}`);
        if (!res.ok) throw new Error("Liquidity stress fetch failed");
        liquidityData = await res.json();

        // Stressed HQLA
        const hqlaEl = document.getElementById("lcr-stressed-hqla");
        if (hqlaEl) hqlaEl.innerText = `$${liquidityData.stressed.total_hqla_millions.toFixed(1)}M`;
        const baseHqlaSub = document.getElementById("lcr-base-hqla-sub");
        if (baseHqlaSub) baseHqlaSub.innerText = `Base: $${liquidityData.baseline.total_hqla_millions.toFixed(1)}M (L1: $${liquidityData.stressed.level1_hqla_millions.toFixed(0)}M, L2: $${liquidityData.stressed.level2_hqla_millions.toFixed(0)}M)`;

        // Net Outflows
        const outEl = document.getElementById("lcr-stressed-outflows");
        if (outEl) outEl.innerText = `$${liquidityData.stressed.net_30d_cash_outflows_millions.toFixed(1)}M`;
        const baseOutSub = document.getElementById("lcr-base-outflows-sub");
        if (baseOutSub) baseOutSub.innerText = `Base: $${liquidityData.baseline.net_30d_cash_outflows_millions.toFixed(1)}M`;

        // LCR Ratio
        const ratioEl = document.getElementById("lcr-stressed-ratio");
        if (ratioEl) {
            ratioEl.innerText = `${liquidityData.stressed.lcr_pct.toFixed(2)}%`;
            ratioEl.className = liquidityData.stressed.is_breached ? "kpi-value font-mono font-bold text-rose-700" : "kpi-value font-mono font-bold text-emerald-700";
        }

        const statusBadge = document.getElementById("lcr-regulatory-status-badge");
        if (statusBadge) {
            if (liquidityData.stressed.is_breached) {
                statusBadge.className = "badge-reg badge-critical text-[10px]";
                statusBadge.innerText = "STATUTORY BREACH (<100%)";
            } else {
                statusBadge.className = "badge-reg badge-stable text-[10px]";
                statusBadge.innerText = "COMPLIANT (>100% Floor)";
            }
        }

        // Survival Horizon & Surplus
        const survEl = document.getElementById("lcr-survival-days");
        if (survEl) survEl.innerText = `${liquidityData.stressed.survival_days} Days`;

        const surplusSub = document.getElementById("lcr-surplus-deficit");
        if (surplusSub) {
            const val = liquidityData.stressed.surplus_deficit_millions;
            surplusSub.innerText = `${val >= 0 ? 'Surplus: +$' : 'Deficit: -$'}${Math.abs(val).toFixed(1)}M`;
            surplusSub.className = val >= 0 ? "kpi-sub text-emerald-700 font-semibold" : "kpi-sub text-rose-700 font-semibold";
        }

        // Drivers
        const d = liquidityData.stress_transmission_drivers;
        const lineEl = document.getElementById("lcr-driver-lines");
        if (lineEl) lineEl.innerText = `+$${d.emergency_credit_line_drawdowns_millions.toFixed(1)}M`;
        const depEl = document.getElementById("lcr-driver-deposits");
        if (depEl) depEl.innerText = `+$${d.deposit_flight_runoff_millions.toFixed(1)}M`;
        const hairEl = document.getElementById("lcr-driver-haircuts");
        if (hairEl) hairEl.innerText = `-$${d.hqla_market_haircut_millions.toFixed(1)}M`;
        const inEl = document.getElementById("lcr-driver-inflows");
        if (inEl) inEl.innerText = `-$${d.inflow_repayment_freeze_millions.toFixed(1)}M`;

        // Recommendation
        const recBox = document.getElementById("lcr-recommendation-box");
        if (recBox) recBox.innerText = liquidityData.regulatory_recommendation;

    } catch (e) {
        console.error("Liquidity Error:", e);
    }
}

function refreshLiquidityStress() {
    const floodShock = parseFloat(document.getElementById("slider-lcr-flood-shock")?.value || 0.50);
    fetchLiquidityStress(floodShock);
}

// =====================================================================
// MODULE 3: 3D TOPOGRAPHY & FLOOD INUNDATION SURGE SIMULATOR
// =====================================================================

async function updateSurgeInundation(surgeLevel) {
    try {
        const res = await fetch(`/api/elevation-inundation?surge_level_m=${surgeLevel}`);
        if (!res.ok) throw new Error("Inundation calculation failed");
        const data = await res.json();

        const badge = document.getElementById("map-inundation-badge");
        if (badge) {
            badge.innerText = `${data.submerged_count} Submerged (+${surgeLevel.toFixed(1)}m Surge)`;
            badge.className = data.submerged_count > 0 
                ? "px-2 py-0.5 rounded bg-blue-600 text-white font-mono text-[10px] font-bold animate-pulse" 
                : "px-2 py-0.5 rounded bg-blue-200 text-blue-950 font-mono text-[10px] font-bold";
        }

        const eadEl = document.getElementById("map-submerged-ead");
        if (eadEl) {
            eadEl.innerText = `$${data.submerged_ead_millions.toFixed(1)}M at Risk`;
            eadEl.style.display = data.submerged_count > 0 ? "inline" : "none";
        }

        if (simulationResults && simulationResults.loans) {
            updateMapMarkers(simulationResults.loans);
        }
    } catch (e) {
        console.error("Surge Inundation Error:", e);
    }
}

// =====================================================================
// MODULE 4: AI CREDIT RISK ANALYST COPILOT
// =====================================================================

function initAICopilot() {
    const toggleBtn = document.getElementById("ai-copilot-toggle-btn");
    const closeBtn = document.getElementById("ai-copilot-close-btn");
    const clearBtn = document.getElementById("ai-copilot-clear-btn");
    const sendBtn = document.getElementById("ai-copilot-send-btn");
    const inputEl = document.getElementById("ai-copilot-input");
    const panel = document.getElementById("ai-copilot-panel");

    if (toggleBtn && panel) {
        toggleBtn.addEventListener("click", () => {
            panel.classList.toggle("hidden");
            if (!panel.classList.contains("hidden")) {
                inputEl?.focus();
            }
        });
    }

    if (closeBtn && panel) {
        closeBtn.addEventListener("click", () => panel.classList.add("hidden"));
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            const msgBox = document.getElementById("ai-copilot-messages");
            if (msgBox) {
                msgBox.innerHTML = `
                    <div class="p-3 rounded-lg bg-white border border-slate-200 shadow-xs text-slate-800 space-y-2">
                        <div class="flex items-center gap-2 font-bold text-slate-900 text-xs">
                            <span class="w-2 h-2 rounded-full bg-blue-600"></span>
                            Institutional Risk Copilot Initialized
                        </div>
                        <p class="text-[11px] text-slate-600 leading-relaxed">
                            Context reset. Ask me about any specific borrower, balance sheet liquidity (LCR), capital adequacy (CAR), reverse stress tipping points, or flood inundation depths.
                        </p>
                    </div>
                `;
            }
        });
    }

    // Quick chips
    document.querySelectorAll(".ai-prompt-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const promptText = chip.getAttribute("data-prompt");
            if (promptText) {
                if (panel && panel.classList.contains("hidden")) {
                    panel.classList.remove("hidden");
                }
                sendCopilotMessage(promptText);
            }
        });
    });

    if (sendBtn) {
        sendBtn.addEventListener("click", () => sendCopilotMessage());
    }

    if (inputEl) {
        inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                sendCopilotMessage();
            }
        });
    }
}

async function sendCopilotMessage(customPrompt = null) {
    const inputEl = document.getElementById("ai-copilot-input");
    const msgBox = document.getElementById("ai-copilot-messages");
    if (!msgBox) return;

    const query = customPrompt || (inputEl ? inputEl.value.trim() : "");
    if (!query) return;

    if (inputEl && !customPrompt) inputEl.value = "";

    // 1. Append User Bubble
    const userDiv = document.createElement("div");
    userDiv.className = "flex justify-end";
    userDiv.innerHTML = `
        <div class="bg-blue-900 text-white px-3.5 py-2 rounded-xl rounded-tr-xs max-w-[85%] text-xs shadow-xs font-sans">
            ${escapeHTML(query)}
        </div>
    `;
    msgBox.appendChild(userDiv);

    // 2. Append Loading Indicator Bubble
    const loadingId = "copilot-loading-" + Date.now();
    const loadDiv = document.createElement("div");
    loadDiv.id = loadingId;
    loadDiv.className = "flex justify-start";
    loadDiv.innerHTML = `
        <div class="bg-white border border-slate-200 text-slate-600 px-3.5 py-2.5 rounded-xl rounded-tl-xs text-xs shadow-xs flex items-center gap-2">
            <span class="inline-block w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
            <span>Evaluating portfolio & regulatory models...</span>
        </div>
    `;
    msgBox.appendChild(loadDiv);
    msgBox.scrollTop = msgBox.scrollHeight;

    try {
        const res = await fetch("/api/ai-copilot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: query })
        });

        if (!res.ok) throw new Error("Copilot response error");
        const data = await res.json();

        // Remove loading
        const loadEl = document.getElementById(loadingId);
        if (loadEl) loadEl.remove();

        // 3. Append Assistant Bubble
        const aiDiv = document.createElement("div");
        aiDiv.className = "flex justify-start";

        const parsedHtml = renderCopilotMarkdown(data.response_markdown || "Assessment generated.");

        let actionsHtml = "";
        if (data.suggested_actions && data.suggested_actions.length > 0) {
            actionsHtml = `
                <div class="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap items-center gap-1.5">
                    <span class="text-[10px] text-slate-500 font-bold uppercase block w-full">Suggested Deep-Dives:</span>
                    ${data.suggested_actions.map(act => `
                        <button onclick="sendCopilotMessage('${escapeHTML(act)}')" class="bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-400 text-slate-700 text-[10px] px-2 py-0.5 rounded border border-slate-300 font-medium transition cursor-pointer">
                            ${escapeHTML(act)} ➔
                        </button>
                    `).join("")}
                </div>
            `;
        }

        aiDiv.innerHTML = `
            <div class="bg-white border border-slate-200 text-slate-800 p-3.5 rounded-xl rounded-tl-xs max-w-[95%] text-xs shadow-sm space-y-2 leading-relaxed">
                <div class="copilot-prose text-slate-800 space-y-1.5">
                    ${parsedHtml}
                </div>
                ${actionsHtml}
            </div>
        `;
        msgBox.appendChild(aiDiv);
        msgBox.scrollTop = msgBox.scrollHeight;

    } catch (e) {
        const loadEl = document.getElementById(loadingId);
        if (loadEl) loadEl.remove();

        const errDiv = document.createElement("div");
        errDiv.className = "flex justify-start";
        errDiv.innerHTML = `
            <div class="bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2.5 rounded-xl rounded-tl-xs text-xs">
                ⚠️ Error analyzing query: ${escapeHTML(e.message)}
            </div>
        `;
        msgBox.appendChild(errDiv);
        msgBox.scrollTop = msgBox.scrollHeight;
    }
}

function renderCopilotMarkdown(md) {
    if (!md) return "";
    let html = md;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h4 class="font-bold text-xs uppercase tracking-wider text-slate-900 mt-2 mb-1 border-b border-slate-100 pb-0.5">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="font-bold text-sm text-slate-900 mt-2 mb-1">$1</h3>');

    // Bold & Italic
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-slate-900">$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em class="italic text-slate-700">$1</em>');

    // Inline Code
    html = html.replace(/`([^`]+)`/gim, '<code class="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono font-semibold text-slate-800">$1</code>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote class="border-l-2 border-blue-600 pl-2 text-slate-600 italic text-[11px] my-1">$1</blockquote>');

    // Lists
    html = html.replace(/^- (.*$)/gim, '<div class="flex items-start gap-1.5 my-0.5"><span class="text-blue-600 font-bold">•</span><span>$1</span></div>');

    // Tables
    const lines = html.split("\n");
    let inTable = false;
    let tableHtml = "";
    let finalLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("|") && line.endsWith("|")) {
            if (!inTable) {
                inTable = true;
                tableHtml = '<div class="overflow-x-auto my-2"><table class="w-full text-[11px] border-collapse border border-slate-200 rounded">';
            }
            if (line.includes("---")) {
                // Header separator, skip
                continue;
            }
            const cells = line.split("|").slice(1, -1).map(c => c.trim());
            const isHeader = !tableHtml.includes("<td");
            if (isHeader) {
                tableHtml += '<tr class="bg-slate-100 font-bold border-b border-slate-200 text-slate-800">';
                cells.forEach(c => { tableHtml += `<th class="py-1 px-2 border-r border-slate-200 text-left">${c}</th>`; });
                tableHtml += '</tr>';
            } else {
                tableHtml += '<tr class="border-b border-slate-100 hover:bg-slate-50">';
                cells.forEach(c => { tableHtml += `<td class="py-1 px-2 border-r border-slate-200">${c}</td>`; });
                tableHtml += '</tr>';
            }
        } else {
            if (inTable) {
                inTable = false;
                tableHtml += '</table></div>';
                finalLines.push(tableHtml);
                tableHtml = "";
            }
            finalLines.push(line);
        }
    }
    if (inTable) {
        tableHtml += '</table></div>';
        finalLines.push(tableHtml);
    }

    html = finalLines.join("<br>");
    html = html.replace(/(<br>){2,}/g, '<br>');
    return html;
}

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

