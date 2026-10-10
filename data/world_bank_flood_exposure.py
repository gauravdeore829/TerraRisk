"""
World Bank - Global Flood Exposure Dataset Simulator & Ingestion
Based on: Rentschler, Salhab, & Jafino (2022), Nature Communications.
Dataset: 'Global flood exposure: gridded exposure headcounts by country' (World Bank Data Catalog #0062763).
Provides gridded 1-in-100 year (RP100) and 1-in-500 year (RP500) inundation depths,
vulnerability indices, and exposed asset headcount by coordinate bounding boxes.
"""

import json

WORLD_BANK_FLOOD_GRIDS = [
    {
        "grid_id": "WB-FLD-IND-01",
        "corridor": "Mumbai-Thane Industrial & Coastal Basin",
        "bbox": [[18.85, 72.75], [19.35, 73.15]],
        "center": [19.0760, 72.8777],
        "rp100_inundation_depth_m": 2.45,
        "rp500_inundation_depth_m": 3.80,
        "exposure_headcount": 4850000,
        "asset_exposure_usd_m": 14200.0,
        "vulnerability_tier": "VERY HIGH",
        "primary_hazard_type": "Coastal Storm Surge & Riverine Tidal Wash"
    },
    {
        "grid_id": "WB-FLD-IND-02",
        "corridor": "Surat-Tapi Delta Corridor",
        "bbox": [[21.05, 72.70], [21.35, 73.05]],
        "center": [21.1702, 72.8311],
        "rp100_inundation_depth_m": 3.10,
        "rp500_inundation_depth_m": 4.50,
        "exposure_headcount": 3120000,
        "asset_exposure_usd_m": 8900.0,
        "vulnerability_tier": "CRITICAL",
        "primary_hazard_type": "Upstream Reservoir Discharge & Riverine Delta Inundation"
    },
    {
        "grid_id": "WB-FLD-IND-03",
        "corridor": "Kolkata-Hooghly Estuary & Sundarbans Basin",
        "bbox": [[22.35, 88.20], [22.75, 88.55]],
        "center": [22.5726, 88.3639],
        "rp100_inundation_depth_m": 2.80,
        "rp500_inundation_depth_m": 4.10,
        "exposure_headcount": 5200000,
        "asset_exposure_usd_m": 11400.0,
        "vulnerability_tier": "CRITICAL",
        "primary_hazard_type": "Cyclonic Surge & Tidal Estuary Overflow"
    },
    {
        "grid_id": "WB-FLD-IND-04",
        "corridor": "Chennai-Ennore Logistics & Coastal Corridor",
        "bbox": [[13.00, 80.15], [13.35, 80.35]],
        "center": [13.0827, 80.2707],
        "rp100_inundation_depth_m": 1.95,
        "rp500_inundation_depth_m": 3.20,
        "exposure_headcount": 2750000,
        "asset_exposure_usd_m": 7600.0,
        "vulnerability_tier": "HIGH",
        "primary_hazard_type": "Monsoon Urban Flash Flood & Coastal Inundation"
    },
    {
        "grid_id": "WB-FLD-IND-05",
        "corridor": "Ahmedabad-Sanand Industrial Plain",
        "bbox": [[22.85, 72.40], [23.15, 72.70]],
        "center": [23.0225, 72.5714],
        "rp100_inundation_depth_m": 1.20,
        "rp500_inundation_depth_m": 2.10,
        "exposure_headcount": 1650000,
        "asset_exposure_usd_m": 5400.0,
        "vulnerability_tier": "MODERATE",
        "primary_hazard_type": "Flash Flood & Sabarmati River Spate"
    },
    {
        "grid_id": "WB-FLD-IND-06",
        "corridor": "Punjab Agro-Industrial Basin",
        "bbox": [[30.70, 75.60], [31.10, 76.10]],
        "center": [30.9010, 75.8573],
        "rp100_inundation_depth_m": 1.40,
        "rp500_inundation_depth_m": 2.30,
        "exposure_headcount": 1100000,
        "asset_exposure_usd_m": 3800.0,
        "vulnerability_tier": "MODERATE",
        "primary_hazard_type": "Canal Overflow & Agricultural Waterlogging"
    },
    {
        "grid_id": "WB-FLD-IND-07",
        "corridor": "Hyderabad Industrial & Tech Plateau",
        "bbox": [[17.25, 78.30], [17.55, 78.65]],
        "center": [17.3850, 78.4867],
        "rp100_inundation_depth_m": 0.45,
        "rp500_inundation_depth_m": 0.90,
        "exposure_headcount": 450000,
        "asset_exposure_usd_m": 1900.0,
        "vulnerability_tier": "LOW",
        "primary_hazard_type": "Localized Urban Drainage Surcharge"
    },
    {
        "grid_id": "WB-FLD-IND-08",
        "corridor": "Bengaluru Electronic City Upland",
        "bbox": [[12.80, 77.45], [13.15, 77.75]],
        "center": [12.9716, 77.5946],
        "rp100_inundation_depth_m": 0.30,
        "rp500_inundation_depth_m": 0.65,
        "exposure_headcount": 320000,
        "asset_exposure_usd_m": 1400.0,
        "vulnerability_tier": "LOW",
        "primary_hazard_type": "Lake System Overflow"
    }
]

def save_wb_flood_grids():
    with open("data/world_bank_flood_grids.json", "w") as f:
        json.dump(WORLD_BANK_FLOOD_GRIDS, f, indent=2)
    print(f"Saved {len(WORLD_BANK_FLOOD_GRIDS)} World Bank Flood Exposure Grids.")

if __name__ == "__main__":
    save_wb_flood_grids()
