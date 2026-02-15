# Dataset Generation and Validation Audit

Audit date: 2026-02-11
Scope:
- `finetuning/scripts/generate_dataset.py`
- `finetuning/scripts/validate_dataset.py`
- `backend_fastapi/data/biomarkers.json`
- `finetuning/datasets/train_dataset.jsonl`
- `finetuning/datasets/train_dataset_eval.jsonl`

This document explains how the dataset is generated, what rule-based logic is applied, whether the generated train/eval files match `biomarkers.json`, and how clinically realistic the rules are for real health reports.

---

## 1) Executive Summary

- The generation pipeline is strongly rule-based and mostly consistent with `biomarkers.json`.
- Structural validation passed: 3600 train rows + 400 eval rows, valid JSONL format.
- Strict semantic audit found 2 real label/value inconsistencies caused by rounding:
  - `finetuning/datasets/train_dataset.jsonl:588`
  - `finetuning/datasets/train_dataset_eval.jsonl:325`
  Both are `urine_specific_gravity` examples labeled `Normal` at value `1.00`, which is below low bound `1.002`.
- No train/eval exact overlap (good), but 4 duplicate rows exist inside train split.
- Key modeling limitation: age is generated but not used for reference-range selection.
- One condition in `biomarkers.json` is ignored by generator logic (`triglycerides` has `{"state": "fasting"}`).
- Web cross-check indicates many ranges are reasonable for general adults, but some are oversimplified for age/assay-specific interpretation (notably TSH, D-dimer, eGFR, PSA).

---

## 2) How `generate_dataset.py` Works (Step by Step)

## 2.1 Configuration and Inputs
- `INPUT_FILE` points to `../backend_fastapi/data/biomarkers.json`.
- `NUM_EXAMPLES = 4000`.
- `SKIP_BIOMARKERS = {"psa"}` because PSA has no fixed normal/abnormal threshold in the source file.
- The script uses a recommendation dictionary plus a biomarker-to-category map.

Important detail:
- The path is relative to working directory, not script location. Running from a different directory can break file loading.

## 2.2 Rule Engine Overview
The generator applies deterministic rules with random sampling:

1. Choose a random biomarker.
2. Generate random patient profile:
   - sex: male/female
   - age: 18 to 85
3. Select first applicable reference range:
   - checks only `conditions.sex`
   - ignores other condition keys
4. Generate a value from weighted status:
   - base weights: Normal 40%, Low 25%, High 25%
   - adds Critical High 7% and/or Critical Low 3% if thresholds exist
5. Format the output using fixed markdown template:
   - Analysis (result, reference range, status)
   - Interpretation
   - Recommendations for abnormal cases
   - Critical warning text for critical labels
6. Shuffle all rows and split into:
   - train: 90% (3600)
   - eval: 10% (400)

## 2.3 How Status and Value Are Generated
Function: `generate_value_for_range(...)`

Rules by range type:
- Two-sided range (`low` and `high`):
  - Normal sampled inside range with padding.
  - Low sampled below low.
  - High sampled above high.
  - Critical sampled by critical thresholds (if defined).
- Upper-only range (`< high`):
  - High possible.
  - Low falls back to Normal.
- Lower-only range (`> low`):
  - Low possible.
  - High falls back to Normal.

Formatting:
- Values are rounded to 0/1/2/3 decimals based on magnitude.
- Post-rounding correction only checks:
  - Low crossing up into normal.
  - High crossing down into normal.
- It does not re-validate `Normal` after rounding, which caused the two mislabels found.

## 2.4 Prompt/Output Template Rules
Every row has:
- `instruction`: fixed task sentence.
- `input`:
  - Patient sex+age
  - Test canonical name + biomarker id
  - Result value + reference unit
- `output`:
  - Result
  - Reference range line
  - Status
  - Interpretation text
  - Recommendations (if abnormal)

This consistency is good for SFT training.

## 2.5 Train/Eval Split Logic
- Script first writes full dataset to `train_dataset.jsonl`.
- Then rewrites `train_dataset.jsonl` with only train subset.
- Eval is written to `train_dataset_eval.jsonl`.

This works, but the first write is unnecessary.

---

## 3) Rule-Based Logic Actually Applied

Rules observed in code and data:

- Sex-specific range selection:
  - Applied.
- Age-specific range selection:
  - Not applied (no age condition handling in code).
- Non-sex conditions:
  - Not applied. Example: triglycerides has `{"state":"fasting"}` but generator ignores it.
- Status logic:
  - Mostly consistent with thresholds.
- Critical labels:
  - Only generated if biomarker defines critical thresholds.
- Recommendations:
  - Abnormal statuses get 2 sampled recommendations.
  - Normal gets none.
- Interpretation fallback:
  - If range has no interpretation text, default generic phrases are used.

---

## 4) Deep Validation Performed

Two levels of checks were run:

1. Built-in validator (`validate_dataset.py`)
- Train: pass (3600 rows)
- Eval: pass format-wise (400 rows, warning only because size < 1000)

2. Strict semantic validator (custom audit)
- Parsed every row in train and eval.
- Verified:
  - biomarker id exists in `biomarkers.json`
  - canonical name matches id
  - units in input/output match source unit
  - output value equals input value
  - output reference range matches selected range for patient sex
  - status agrees with numeric value and range
  - abnormal rows include recommendations
  - critical rows include critical warning
  - duplicate rows and split overlap

---

## 5) Validation Results Against `biomarkers.json`

## 5.1 What is Correct
- Train/eval formats are valid JSONL.
- No unknown biomarker IDs.
- Reference ranges in outputs match source ranges (after whitespace normalization).
- No exact record leakage between train and eval (0 overlap).
- Critical statuses only appear for biomarkers with critical thresholds.
- Status label set is valid: `Normal/Low/High/Critical Low/Critical High`.

## 5.2 Issues Found

1) Rounding-induced mislabels (real errors)
- `finetuning/datasets/train_dataset.jsonl:588`
- `finetuning/datasets/train_dataset_eval.jsonl:325`

Problem:
- `urine_specific_gravity` low bound is `1.002`.
- Value rendered as `1.00`, status labeled `Normal`.
- By rule, `1.00 < 1.002`, so status should be low/abnormal.

Root cause in code:
- `generate_value_for_range(...)` only post-corrects `Low` and `High` after rounding.
- It does not re-check rounded `Normal` values against bounds.

2) Empty units for 3 biomarkers in source file
- `inr`, `urine_specific_gravity`, `urine_ph` have empty `reference_unit` in `biomarkers.json`.
- This leads to awkward trailing spaces and unitless result lines.

3) Non-sex condition ignored
- `triglycerides` range has condition `{"state":"fasting"}` in source.
- Generator checks only `sex`, so fasting context is not enforced in generated examples.

4) Train duplicates
- 4 duplicate rows inside train file.
- Eval has no duplicates.
- Not a critical failure, but avoidable and can increase memorization risk.

5) Coverage
- Total biomarkers in source: 100.
- `psa` is intentionally skipped.
- Train includes 99 IDs (all non-PSA).
- Eval includes 98 IDs (`d_dimer` absent by random chance in this split).

## 5.3 Distribution Snapshot
- Train status distribution:
  - Normal 1849 (51.4%)
  - High 953 (26.5%)
  - Low 756 (21.0%)
  - Critical High 27 (0.8%)
  - Critical Low 15 (0.4%)

---

## 6) Real-World Applicability to Health Reports

## 6.1 What translates well
- Strong structured outputs.
- Sex-specific ranges where provided.
- Clear abnormal/critical signaling.
- Reproducible rule-based synthetic generation.

## 6.2 Clinical realism limitations
- No panel-level reasoning:
  - Each row is usually one test, while real reports often require multi-test interpretation.
- Limited patient context:
  - No symptoms, medication list, diagnosis history, pregnancy, comorbidities.
- Age mostly cosmetic:
  - Age is printed but generally not used for selecting reference ranges.
- Lab/assay variation not modeled:
  - Real ranges differ by lab method and instrument.
- Unit conversion not modeled:
  - Important for tests reported in different unit systems.
- Triglycerides fasting condition not enforced.

Conclusion:
- Good for supervised style-learning and baseline domain adaptation.
- Not sufficient alone for production-grade clinical interpretation without additional constraints and validation.

---

## 7) Web Cross-Check (Age/Value Sanity)

Notes:
- Reference ranges vary by lab, assay, and population.
- Comparison below is "general adult range sanity", not a regulatory validation.

| Biomarker | In `biomarkers.json` | External reference snapshot | Audit note |
| --- | --- | --- | --- |
| Hemoglobin | F 12-16, M 14-18 g/dL | MedlinePlus: F 12.1-15.1, M 13.8-17.2 | Close; slightly broader on upper side |
| Fasting glucose | 70-99 mg/dL | CDC/NIDDK: normal <=99 | Matches |
| HbA1c | 4.0-5.6% | CDC/NIDDK: normal <5.7% | Matches diagnostic convention |
| Total chol / LDL / HDL / TG | <200, <100, >40 M >50 F, TG <150 | CDC/AHA uses same general cutoffs | Good alignment for adult screening |
| Creatinine | F 0.5-1.1, M 0.7-1.3 mg/dL | MedlinePlus: F 0.5-0.95, M 0.7-1.3 | Female upper bound slightly high vs some labs |
| INR | 0.8-1.2 | MedlinePlus: INR 0.8-1.1 (non-warfarin) | Slightly broader upper bound |
| Urine specific gravity | 1.002-1.03 | MedlinePlus: 1.005-1.030 general | Lower bound is permissive; rounding bug seen |
| TSH | 0.5-4.0 | ATA notes upper normal can rise with age | Fixed range may overcall older adults |
| D-dimer | <0.5 ug/mL | JAMA/ACEP: age-adjusted cutoffs often used >50 | Fixed cutoff may overcall older adults |
| PSA | no fixed range (skipped) | NCI: no single normal threshold; age-dependent interpretation | Skipping PSA is appropriate |

Key age-related takeaway:
- Real clinical interpretation for TSH, D-dimer, eGFR, and PSA is age/context sensitive.
- Current rules are mostly adult-generic and do not encode these age-adaptive interpretations.

---

## 8) Detailed Script Findings (Code-Level)

From `finetuning/scripts/generate_dataset.py`:

- `INPUT_FILE` is relative-path fragile when script is not run from expected cwd.
- `EVAL_FILE` constant is defined but not used.
- `create_example(...)` range selection checks only `sex` and ignores other condition keys.
- Post-rounding correction does not validate rounded `Normal` values.
- Dataset is written twice to train file (full then split), first write unnecessary.
- Category map is incomplete for 5 non-skipped biomarkers:
  - `mch`, `mchc`, `mcv`, `platelet_count`, `rdw`
  These fall back to `general` recommendations.

From `backend_fastapi/data/biomarkers.json`:
- 3 biomarkers have empty unit string:
  - `inr`, `urine_specific_gravity`, `urine_ph`
- 26 biomarkers have at least one range without explicit interpretation text.
- 1 biomarker (`triglycerides`) has non-sex condition (`state=fasting`) that generator currently ignores.

---

## 9) Recommended Fixes Before Next Dataset Regeneration

1. Fix rounded normal status bug
- After rounding, recompute status from rounded value and bounds for all statuses.

2. Enforce all conditions in range selection
- Extend range matching to handle additional condition keys (`state`, future `age_min/age_max`, pregnancy).

3. Normalize/define units
- Use explicit unit labels for currently empty-unit biomarkers (for example `ratio`, `unitless`, or standard notation).

4. Deduplicate before split
- Remove exact duplicate rows before writing train/eval.

5. Improve realism for age-sensitive biomarkers
- Add optional age-aware logic for TSH, eGFR interpretation banding, and age-adjusted D-dimer guidance.

6. Keep PSA excluded unless policy is defined
- If added later, encode age-stratified and context-specific rule set.

---

## 10) Source Links Used for External Sanity Check

- CDC diabetes testing: https://www.cdc.gov/diabetes/diabetes-testing/index.html
- NIDDK A1C: https://www.niddk.nih.gov/health-information/diagnostic-tests/a1c-test
- ADA diagnosis criteria: https://diabetes.org/about-diabetes/diagnosis
- MedlinePlus hemoglobin: https://medlineplus.gov/ency/article/003645.htm
- CDC cholesterol overview: https://www.cdc.gov/cholesterol/about/index.html
- AHA cholesterol targets: https://www.heart.org/en/health-topics/cholesterol/about-cholesterol/what-your-cholesterol-levels-mean
- MedlinePlus creatinine: https://medlineplus.gov/ency/article/003475.htm
- NKF CKD/eGFR staging: https://www.kidney.org/atoz/content/stages-chronic-kidney-disease-ckd
- MedlinePlus PT/INR: https://medlineplus.gov/ency/article/003652.htm
- MedlinePlus urine concentration/specific gravity: https://medlineplus.gov/ency/article/003608.htm
- MedlinePlus urine specific gravity test: https://medlineplus.gov/ency/article/003587.htm
- NCI PSA fact sheet: https://www.cancer.gov/types/prostate/psa-fact-sheet
- ACEP PE policy (age-adjusted D-dimer): https://www.acep.org/patient-care/clinical-policies/acute-venous-thromboembolic-disease/
- JAMA ADJUST-PE study: https://jamanetwork.com/journals/jama/fullarticle/1841967
- ATA patient summary on age-specific thyroid ranges: https://www.thyroid.org/patient-thyroid-information/ct-for-patients/february-2025/vol-18-issue-2-p-7-8/

---

## 11) Final Verdict

- Dataset generation is rule-based, reproducible, and largely consistent with source biomarker definitions.
- The dataset is usable for fine-tuning with caveats.
- There are a few concrete correctness defects (2 mislabels from rounding) plus several realism gaps that should be fixed for stronger clinical reliability.
