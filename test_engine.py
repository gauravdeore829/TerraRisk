from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_full_platform():
    # 1. Homepage
    r = client.get("/")
    assert r.status_code == 200, f"Index failed: {r.status_code}"
    assert "World Bank Financial Stability Platform" in r.text
    print("[OK] 1. Homepage OK (status 200)")

    # 2. Simulation API
    sim_payload = {
        "preset_name": "ngfs_disorderly",
        "flood_severity": 0.50,
        "heat_days": 35,
        "carbon_tax_shock": 0.20,
        "cascade_multiplier": 1.18
    }
    r2 = client.post("/api/simulate", json=sim_payload)
    assert r2.status_code == 200, f"Simulation failed: {r2.status_code}"
    data = r2.json()
    k = data["kpis"]
    print(f"[OK] 2. Simulation OK: Exposure = ${k['total_portfolio_ead_millions']}M, Stressed EL = ${k['stressed_expected_loss_millions']}M, CAR = {k['stressed_car_pct']}%, Hash = {k['audit_hash']}")

    # 3. Scenario Comparison Studio
    r3 = client.get("/api/scenarios-compare")
    assert r3.status_code == 200, f"Scenarios compare failed: {r3.status_code}"
    sc_data = r3.json()["comparison"]
    assert len(sc_data) == 4
    print(f"[OK] 3. Scenario Comparison Studio OK (4 NGFS scenarios computed)")

    # 4. Supply Chain Contagion Network
    r4 = client.get("/api/supply-chain-network?flood_severity=0.5&heat_days=35")
    assert r4.status_code == 200, f"Supply chain failed: {r4.status_code}"
    net = r4.json()
    print(f"[OK] 4. Supply Chain Contagion OK: {len(net['nodes'])} Nodes, {len(net['edges'])} Transmission Links")

    # 5. Multi-Year Horizon Projections
    r5 = client.get("/api/time-horizon?horizon_year=2030&pathway=SSP2-4.5 (Middle of the Road)")
    assert r5.status_code == 200, f"Time horizon failed: {r5.status_code}"
    traj = r5.json()["trajectory"]
    print(f"[OK] 5. Multi-Year Horizon OK (Projections for {', '.join(str(t['year']) for t in traj)})")

    # 6. Live Weather / Satellite API Feed
    r6 = client.get("/api/live-weather?lat=19.076&lng=72.877")
    assert r6.status_code == 200, f"Live weather failed: {r6.status_code}"
    sat = r6.json()
    print(f"[OK] 6. Live Weather Feed OK: {sat['temperature_c']}C, {sat['precipitation_mm']}mm, {sat['thermal_status']}")

    # 7. Dataset Switcher (Switch to Kaggle Loan Dataset)
    r7 = client.post("/api/switch-dataset", data={"dataset_key": "kaggle_loan"})
    assert r7.status_code == 200, f"Dataset switch failed: {r7.status_code}"
    print(f"[OK] 7. Dataset Switch OK: Switched to Kaggle Loan Default Dataset ({r7.json()['facility_count']} facilities)")

    # 8. Onboard Facility
    facility_payload = {
        "borrower": "Test Hydro-Chemicals Corp",
        "sector": "Heavy Manufacturing & Chemicals",
        "corridor": "Mumbai-Thane Industrial & Coastal Basin",
        "collateral_type": "Refinery Complex",
        "ead_millions": 30.0,
        "collateral_value_millions": 45.0,
        "lat": 19.12,
        "lng": 72.89,
        "elevation_m": 3.0,
        "flood_hazard_zone": "High (Coastal/Tidal)",
        "heat_hazard_zone": "High"
    }
    r8 = client.post("/api/add-facility", json=facility_payload)
    assert r8.status_code == 200, f"Add facility failed: {r8.status_code}"
    print(f"[OK] 8. Add Facility OK: Registered {r8.json()['facility_id']}")

    # 9. CSV Audit Export
    r9 = client.get("/api/export-csv")
    assert r9.status_code == 200, f"CSV export failed: {r9.status_code}"
    assert "Facility Reference,Borrower Entity" in r9.text
    print(f"[OK] 9. CSV Audit Export OK ({len(r9.text.splitlines())} rows)")

    print("\n" + "="*70)
    print("ALL PRODUCTION PLATFORM ENDPOINTS & APIS PASSED 100% SUCCESSFULLY!")
    print("="*70)

if __name__ == "__main__":
    test_full_platform()
