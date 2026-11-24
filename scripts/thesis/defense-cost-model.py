"""Reproduce bounded planning arithmetic; never treat it as a measured invoice.

All assumptions are explicit. The only network read retrieves public regional
pricing, not a clinic database or billing account. No cloud workload is run.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
url = "https://cloud.google.com/firestore/pricing?hl=en"
html = urllib.request.urlopen(url, timeout=40).read()
text = html.decode("utf-8")
location = '"Singapore (asia-southeast1)"'
end = text.rfind(location)
if end < 0:
    raise ValueError("Singapore pricing data absent")
start = text.rfind("Document Reads", 0, end)
section = text[start:end]
rates = {}
for label, key in [("Document Reads", "read_per_100k"), ("Document Writes", "write_per_100k"),
                   ("Document Deletes", "delete_per_100k"), ("Stored Data", "storage_per_gib_month")]:
    match = re.search(re.escape(label) + r'.*?\$(\d+(?:\.\d+)?)', section, flags=re.S)
    if not match:
        raise ValueError(f"Regional price not found: {label}")
    rates[key] = float(match[1])
if not .1 < rates["storage_per_gib_month"] < 1:
    raise ValueError("Expected monthly, not hourly, storage rates")

scenarios = []
for visits, operating_days in [(80, 20), (440, 22), (1000, 20)]:
    minutes, bitrate = 20, 1.7
    participant_minutes = visits * minutes * 2
    downstream_gb = participant_minutes * 60 * bitrate / 8000
    ship = 50 + max(0, participant_minutes - 150000) * .0005 + max(0, downstream_gb - 250) * .12
    # These per-encounter operation budgets are illustrative, not instrumented.
    daily_reads, daily_writes = visits / operating_days * 2000, visits / operating_days * 1000
    operation_cost = operating_days * (max(0, daily_reads - 50000) / 100000 * rates["read_per_100k"]
                                      + max(0, daily_writes - 20000) / 100000 * rates["write_per_100k"])
    scenarios.append({"visits": visits, "operating_days": operating_days,
        "minutes_per_visit": minutes, "participants_per_visit": 2,
        "downstream_mbps_per_receiver": bitrate, "participant_minutes": participant_minutes,
        "downstream_gb_decimal": round(downstream_gb, 3), "livekit_ship_usd": round(ship, 4),
        "firestore_ops_usd": round(operation_cost, 4), "vercel_one_deployer_base_usd": 20,
        "modeled_subtotal_before_ai_and_exclusions_usd": round(ship + operation_cost + 20, 4),
        "reads_per_visit_assumed": 2000, "writes_per_visit_assumed": 1000})
assert scenarios[1]["participant_minutes"] == 17600
assert scenarios[1]["downstream_gb_decimal"] == 224.4
assert scenarios[2]["livekit_ship_usd"] == 81.2
assert scenarios[2]["firestore_ops_usd"] == 1.0332
report = {"status": "PLANNING ESTIMATE - NOT A BILL OR CAPACITY RESULT", "date": "2026-11-25",
    "retrieved_utc": datetime.now(timezone.utc).isoformat(), "pricing_region": "asia-southeast1",
    "public_source": url, "source_html_sha256": hashlib.sha256(html).hexdigest(), "usd_rates": rates,
    "livekit_source": "https://livekit.com/pricing", "vercel_source": "https://vercel.com/docs/plans/pro-plan",
    "scenarios": scenarios,
    "record_capacity_assumptions": [{"kib_per_encounter_including_overhead": size,
        "encounters_in_1_gib_before_other_data": 1048576 // size} for size in [50, 100, 1024]],
    "free_20_minute_visit_limit_from_minutes_only": 5000 // 40,
    "free_20_minute_visit_limit_from_transfer_at_1_7_mbps_only": int(50 // .51),
    "proposed_3_repeat_1_3_5_pair_trial_including_2_minute_warmups": {
        "participant_minutes": 2 * (1 + 3 + 5) * 3 * 12,
        "estimated_downstream_gb_at_1_7_mbps": 2 * (1 + 3 + 5) * 3 * 12 * 60 * 1.7 / 8000,
        "status": "NOT RUN"},
    "excludes": ["Existing traffic and balances", "Stored-data overage and index growth", "Network egress and backups",
        "TTL operations", "Cloud Functions / Cloud Run / Scheduler / Artifact Registry / Logging",
        "Authentication charges if applicable", "AI and transcription", "Vercel usage above credit and extra seats",
        "LiveKit rounding, idle connections and plan-specific account overrides", "Taxes and FX",
        "Domain, internet, devices, staff support, privacy/compliance work and contingency"]}
destination = ROOT / "docs" / "testing" / "evidence" / "2026-11-25-defense-planning"
destination.mkdir(parents=True, exist_ok=True)
(destination / "cost-model.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
