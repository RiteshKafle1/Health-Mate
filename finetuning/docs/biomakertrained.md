# Biomarkers Trained On — DeepSeek-R1-Distill-Qwen-1.5B

The fine-tuned model is trained to interpret **99 biomarkers** across **15 categories**, sourced from [biomarkers.json](file:///Users/sainacomputer/Desktop/8thsem/cuty-main/backend_fastapi/data/biomarkers.json). All reference ranges are validated against the [ABIM Laboratory Reference Ranges PDF](file:///Users/sainacomputer/Desktop/8thsem/cuty-main/backend_fastapi/data/laboratory-reference-ranges.pdf) (Revised January 2026).

**Training dataset:** 3,600 train + 400 eval examples covering all 99 biomarkers with Normal, Low, High, and Critical values (where applicable).

> [!NOTE]
> PSA (Prostate-Specific Antigen) is excluded from training because the ABIM states "no specific normal or abnormal level."

---

## Blood Chemistry (22)
| # | ID | Name | Unit |
|---|-----|------|------|
| 1 | `glucose_fasting` | Glucose, Fasting | mg/dL |
| 2 | `glucose_random` | Glucose, Random | mg/dL |
| 3 | `hba1c` | Hemoglobin A1c | % |
| 4 | `bun` | Blood Urea Nitrogen | mg/dL |
| 5 | `creatinine` | Creatinine | mg/dL |
| 6 | `uric_acid` | Uric Acid | mg/dL |
| 7 | `total_protein` | Total Protein | g/dL |
| 8 | `albumin` | Albumin | g/dL |
| 9 | `globulin` | Globulin | g/dL |
| 10 | `iron` | Iron, Serum | μg/dL |
| 11 | `tibc` | Total Iron Binding Capacity | μg/dL |
| 12 | `ferritin` | Ferritin | ng/mL |
| 13 | `ammonia` | Ammonia | μg/dL |
| 14 | `ldh` | Lactate Dehydrogenase | U/L |
| 15 | `c_peptide` | C-Peptide | ng/mL |
| 16 | `ceruloplasmin` | Ceruloplasmin | mg/dL |
| 17 | `prealbumin` | Prealbumin | mg/dL |
| 18 | `transferrin` | Transferrin | mg/dL |
| 19 | `transferrin_saturation` | Transferrin Saturation | % |
| 20 | `osmolality_serum` | Osmolality, Serum | mOsm/kg |
| 21 | `copper` | Copper, Serum | μg/dL |
| 22 | `zinc` | Zinc, Serum | μg/dL |

## Hematology (12)
| # | ID | Name | Unit |
|---|-----|------|------|
| 23 | `hemoglobin` | Hemoglobin | g/dL |
| 24 | `hematocrit` | Hematocrit | % |
| 25 | `rbc_count` | Red Blood Cell Count | million/μL |
| 26 | `wbc_count` | White Blood Cell Count | ×10³/μL |
| 27 | `platelet_count` | Platelet Count | ×10³/μL |
| 28 | `mcv` | Mean Corpuscular Volume | fL |
| 29 | `mch` | Mean Corpuscular Hemoglobin | pg |
| 30 | `mchc` | Mean Corpuscular Hemoglobin Concentration | g/dL |
| 31 | `rdw` | Red Cell Distribution Width | % |
| 32 | `reticulocyte_count` | Reticulocyte Count | % |
| 33 | `haptoglobin` | Haptoglobin | mg/dL |
| 34 | `erythropoietin` | Erythropoietin | mU/mL |

## Hormones (8)
| # | ID | Name | Unit |
|---|-----|------|------|
| 35 | `cortisol_am` | Cortisol, Morning | μg/dL |
| 36 | `testosterone` | Testosterone | ng/dL |
| 37 | `estradiol` | Estradiol | pg/mL |
| 38 | `prolactin` | Prolactin | ng/mL |
| 39 | `pth` | Parathyroid Hormone | pg/mL |
| 40 | `calcitonin` | Calcitonin | pg/mL |
| 41 | `fsh` | Follicle-Stimulating Hormone | mIU/mL |
| 42 | `dhea_s` | DHEA-Sulfate | μg/dL |

## Electrolytes (8)
| # | ID | Name | Unit |
|---|-----|------|------|
| 43 | `sodium` | Sodium | mEq/L |
| 44 | `potassium` | Potassium | mEq/L |
| 45 | `chloride` | Chloride | mEq/L |
| 46 | `bicarbonate` | Bicarbonate | mEq/L |
| 47 | `calcium` | Calcium | mg/dL |
| 48 | `magnesium` | Magnesium | mg/dL |
| 49 | `phosphorus` | Phosphorus | mg/dL |
| 50 | `ionized_calcium` | Calcium, Ionized | mmol/L |

## Liver Function (7)
| # | ID | Name | Unit |
|---|-----|------|------|
| 51 | `bilirubin_total` | Bilirubin, Total | mg/dL |
| 52 | `bilirubin_direct` | Bilirubin, Direct | mg/dL |
| 53 | `bilirubin_indirect` | Bilirubin, Indirect | mg/dL |
| 54 | `ast` | Aspartate Aminotransferase | U/L |
| 55 | `alt` | Alanine Aminotransferase | U/L |
| 56 | `alp` | Alkaline Phosphatase | U/L |
| 57 | `ggt` | Gamma-Glutamyl Transferase | U/L |

## Lipid Panel (6)
| # | ID | Name | Unit |
|---|-----|------|------|
| 58 | `cholesterol_total` | Cholesterol, Total | mg/dL |
| 59 | `hdl` | HDL Cholesterol | mg/dL |
| 60 | `ldl` | LDL Cholesterol | mg/dL |
| 61 | `ldl_direct` | LDL Cholesterol, Direct | mg/dL |
| 62 | `vldl` | VLDL Cholesterol | mg/dL |
| 63 | `triglycerides` | Triglycerides | mg/dL |

## Coagulation (6)
| # | ID | Name | Unit |
|---|-----|------|------|
| 64 | `pt` | Prothrombin Time | seconds |
| 65 | `inr` | International Normalized Ratio | — |
| 66 | `aptt` | Activated Partial Thromboplastin Time | seconds |
| 67 | `fibrinogen` | Fibrinogen | mg/dL |
| 68 | `d_dimer` | D-Dimer | μg/mL |
| 69 | `thrombin_time` | Thrombin Time | seconds |

## Inflammatory Markers (6)
| # | ID | Name | Unit |
|---|-----|------|------|
| 70 | `esr` | Erythrocyte Sedimentation Rate | mm/hr |
| 71 | `crp` | C-Reactive Protein | mg/dL |
| 72 | `procalcitonin` | Procalcitonin | ng/mL |
| 73 | `complement_c3` | Complement C3 | mg/dL |
| 74 | `complement_c4` | Complement C4 | mg/dL |
| 75 | `rheumatoid_factor` | Rheumatoid Factor | IU/mL |

## Thyroid (5)
| # | ID | Name | Unit |
|---|-----|------|------|
| 76 | `tsh` | Thyroid Stimulating Hormone | μU/mL |
| 77 | `t4_total` | Thyroxine, Total | μg/dL |
| 78 | `t4_free` | Thyroxine, Free | ng/dL |
| 79 | `t3_total` | Triiodothyronine, Total | ng/dL |
| 80 | `t3_free` | Triiodothyronine, Free | pg/mL |

## Cardiac (4)
| # | ID | Name | Unit |
|---|-----|------|------|
| 81 | `bnp` | B-Type Natriuretic Peptide | pg/mL |
| 82 | `troponin_i` | Troponin I | ng/mL |
| 83 | `troponin_t` | Troponin T | ng/mL |
| 84 | `creatine_kinase` | Creatine Kinase | U/L |

## Tumor Markers (4)
| # | ID | Name | Unit |
|---|-----|------|------|
| 85 | `beta2_microglobulin` | Beta-2 Microglobulin | mg/L |
| 86 | `cea` | Carcinoembryonic Antigen | ng/mL |
| 87 | `ca_125` | CA 125 | U/mL |
| 88 | `ca_19_9` | CA 19-9 | U/mL |

## Urinalysis (4)
| # | ID | Name | Unit |
|---|-----|------|------|
| 89 | `urine_protein` | Urine Protein | mg/24hr |
| 90 | `urine_glucose` | Urine Glucose | mg/dL |
| 91 | `urine_specific_gravity` | Specific Gravity, Urine | — |
| 92 | `urine_ph` | Urine pH | — |

## Vitamins (3)
| # | ID | Name | Unit |
|---|-----|------|------|
| 93 | `vitamin_b12` | Vitamin B12 | pg/mL |
| 94 | `vitamin_d` | 25-Hydroxyvitamin D | ng/mL |
| 95 | `folate` | Folate | ng/mL |

## Kidney Function (2)
| # | ID | Name | Unit |
|---|-----|------|------|
| 96 | `egfr` | Estimated Glomerular Filtration Rate | mL/min/1.73m² |
| 97 | `creatinine_clearance` | Creatinine Clearance | mL/min/1.73m² |

## Pancreatic (2)
| # | ID | Name | Unit |
|---|-----|------|------|
| 98 | `amylase` | Amylase | U/L |
| 99 | `lipase` | Lipase | U/L |

---

## Validation Chain
```
ABIM PDF (Jan 2026) → biomarkers.json (100 entries, 113 ranges) → generate_dataset.py → 4000 examples
                       ✅ 0 mismatches                                                    ✅ 0 errors
```

## Reference
- Source: `backend_fastapi/data/biomarkers.json` — ABIM reference ranges
- PDF: `backend_fastapi/data/laboratory-reference-ranges.pdf` — Revised January 2026
- Training: `scripts/train_dataset.jsonl` (3,600 examples)
- Eval: `scripts/train_dataset_eval.jsonl` (400 examples)
