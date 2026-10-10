"""
Portfolio Data Generator for World Bank Climate Stress Testing Platform
Generates realistic commercial and corporate loan portfolios mapped to geographic coordinates
and hazard-exposed economic corridors.
"""

import json
import random

CORRIDORS = [
    {"name": "Mumbai-Thane Industrial Belt", "lat_center": 19.0760, "lng_center": 72.8777, "flood_prone": "High (Coastal/Tidal)", "heat_prone": "Medium"},
    {"name": "Surat-Tapi Delta Corridor", "lat_center": 21.1702, "lng_center": 72.8311, "flood_prone": "High (Riverine Delta)", "heat_prone": "High"},
    {"name": "Kolkata-Hooghly Port Basin", "lat_center": 22.5726, "lng_center": 88.3639, "flood_prone": "High (Cyclonic/Estuary)", "heat_prone": "High"},
    {"name": "Chennai-Ennore Logistics Belt", "lat_center": 13.0827, "lng_center": 80.2707, "flood_prone": "High (Urban Floodplain)", "heat_prone": "Medium"},
    {"name": "Hyderabad Tech & Industrial Hub", "lat_center": 17.3850, "lng_center": 78.4867, "flood_prone": "Low (Plateau)", "heat_prone": "High"},
    {"name": "Bengaluru Electronic City & Hosur", "lat_center": 12.9716, "lng_center": 77.5946, "flood_prone": "Low (Inland Upland)", "heat_prone": "Low"},
    {"name": "Ahmedabad-Sanand Auto Belt", "lat_center": 23.0225, "lng_center": 72.5714, "flood_prone": "Moderate (Monsoon Wash)", "heat_prone": "Extreme"},
    {"name": "Punjab Agro-Processing Cluster", "lat_center": 30.9010, "lng_center": 75.8573, "flood_prone": "Moderate (Canal Overflow)", "heat_prone": "High"},
]

SECTORS = [
    {"name": "Heavy Manufacturing & Chemicals", "collateral": "Industrial Refinery & Plant", "vulnerability": 1.45, "base_lgd": 0.42},
    {"name": "Commercial Real Estate & Warehouses", "collateral": "Logistics Park / Waterfront Warehouse", "vulnerability": 1.60, "base_lgd": 0.38},
    {"name": "Agriculture & Agro-Processing", "collateral": "Grain Silos & Farmland Estate", "vulnerability": 1.85, "base_lgd": 0.45},
    {"name": "Renewable & Thermal Energy", "collateral": "Substation & Solar Array Yard", "vulnerability": 1.30, "base_lgd": 0.40},
    {"name": "Ports, Maritime & Freight", "collateral": "Drydock & Container Depot", "vulnerability": 1.70, "base_lgd": 0.48},
    {"name": "Textiles & Light Manufacturing", "collateral": "Factory Compound & Equipment", "vulnerability": 1.25, "base_lgd": 0.35},
    {"name": "Retail & Urban Commercial Hubs", "collateral": "Retail Complex & Assets", "vulnerability": 1.15, "base_lgd": 0.30},
]

COMPANIES = [
    "Apex Global Logistics Ltd", "Kalyan Heavy Alloys Corp", "Vanguard Maritime Terminals",
    "Delta Grain Mills & Silos", "Surat Polymer Processing Ltd", "Hooghly Riverine Cold Storage",
    "Coastal Petrochem Refinery", "Coromandel Agro Nutrients", "Sahyadri Auto Components",
    "Sundarbans Aqua Processing", "Deccan Heavy Forgings Ltd", "Ennore Bulk Freight Depot",
    "Bengal Textiles & Weaving Ltd", "Sanand Precision Castings", "Indus Solar Generation Park",
    "Tapi Valley Sugar Cooperatives", "Konkan Portside Warehouses", "Punjab Agro Storage Trust",
    "Godavari Fertilizer Plants", "Malabar Spices & Warehousing", "Thane Chemical Processing",
    "Kurnool Photovoltaic Hub", "Ganga Basin Food Processing", "Rourkela Steel Fabrication",
    "Bharuch Industrial Synthetics", "Haldia Petro Storage Terminals", "Tirupur Garment Estates",
    "Pune Precision Engineering", "Narmada Heavy Valves Ltd", "Kutch Mineral Extraction Co",
    "Visakhapatnam Ship Repair Yard", "Ludhiana Tractor Spares Corp", "Kandla Marine Logistics",
    "Jamshedpur Heavy Structurals", "Bhiwandi E-Commerce Hub", "Nashik Viticulture Agrotech",
    "Coimbatore Textile Machineries", "Raigad Aluminium Extrusion", "Mangalore Fertilizer Port",
    "Nagpur Agro Refrigerated Hub"
]

RATINGS = [
    {"grade": "AAA", "pd": 0.003},
    {"grade": "AA", "pd": 0.006},
    {"grade": "A", "pd": 0.012},
    {"grade": "BBB", "pd": 0.024},
    {"grade": "BB", "pd": 0.048},
    {"grade": "B", "pd": 0.085},
    {"grade": "CCC", "pd": 0.145},
]

def generate_portfolio(n=40):
    random.seed(42)
    portfolio = []
    
    for i in range(n):
        loan_id = f"WB-CR-{2024}-{1001 + i}"
        borrower = COMPANIES[i % len(COMPANIES)]
        corridor = random.choice(CORRIDORS)
        sector_info = random.choice(SECTORS)
        rating_info = random.choices(RATINGS, weights=[0.1, 0.15, 0.25, 0.25, 0.15, 0.07, 0.03])[0]
        
        # Loan size between $5M and $85M USD
        ead = round(random.uniform(8.5, 75.0), 2)
        # Collateral coverage usually 110% to 160% of loan
        collateral_coverage = random.uniform(1.15, 1.65)
        collateral_value = round(ead * collateral_coverage, 2)
        
        # Coordinates with slight random offset from corridor center
        lat = corridor["lat_center"] + random.uniform(-0.12, 0.12)
        lng = corridor["lng_center"] + random.uniform(-0.12, 0.12)
        
        # Elevation
        is_coastal_delta = "High" in corridor["flood_prone"]
        elevation = round(random.uniform(1.2, 8.5) if is_coastal_delta else random.uniform(15.0, 180.0), 1)
        
        # Insurance coverage
        insurance = round(random.uniform(0.10, 0.40) if is_coastal_delta else random.uniform(0.20, 0.60), 2)
        
        loan = {
            "id": loan_id,
            "borrower": borrower,
            "corridor": corridor["name"],
            "sector": sector_info["name"],
            "collateral_type": sector_info["collateral"],
            "ead_millions": ead,
            "collateral_value_millions": collateral_value,
            "ltv_ratio": round(ead / collateral_value, 3),
            "lat": round(lat, 5),
            "lng": round(lng, 5),
            "elevation_m": elevation,
            "flood_hazard_zone": corridor["flood_prone"],
            "heat_hazard_zone": corridor["heat_prone"],
            "sector_vulnerability": sector_info["vulnerability"],
            "base_rating": rating_info["grade"],
            "base_pd": rating_info["pd"],
            "base_lgd": sector_info["base_lgd"],
            "base_el_millions": round(ead * rating_info["pd"] * sector_info["base_lgd"], 4),
            "insurance_coverage_ratio": insurance,
            "tenor_years": random.choice([3, 5, 7, 10]),
            "annual_revenue_millions": round(ead * random.uniform(1.8, 4.2), 2)
        }
        portfolio.append(loan)
        
    return portfolio

if __name__ == "__main__":
    loans = generate_portfolio(40)
    with open("data/portfolio_data.json", "w") as f:
        json.dump(loans, f, indent=2)
    print(f"Generated {len(loans)} institutional bank loan records.")
