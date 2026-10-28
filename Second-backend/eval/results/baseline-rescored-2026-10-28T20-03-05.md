# Citation evaluation: baseline-rescored

Model: gemini/gemini-flash-lite-latest · 2026-10-28T20:03:05.751Z · 18 questions, 0 errors

| Metric | Value |
|---|---|
| Section precision, in-paper questions | 82.8% |
| Section precision, comparison questions | 78.6% |
| Named-citation accuracy (25 citations) | 88.0% |
| Comparison answers citing a downloaded paper | 83.3% |

## Per question

| ID | Sections | Named | External | Time |
|---|---|---|---|---|
| Q01 | 100.0% |  |  | 66s |
| Q02 | 100.0% |  |  | 69s |
| Q03 | 100.0% |  |  | 64s |
| Q04 | 100.0% |  |  | 54s |
| Q05 | 100.0% |  |  | 52s |
| Q06 | 50.0% |  |  | 57s |
| Q07 | 100.0% |  |  | 53s |
| Q08 | 100.0% |  |  | 55s |
| Q09 | 25.0% |  |  | 51s |
| Q10 | 100.0% |  |  | 58s |
| Q11 | 100.0% |  |  | 52s |
| Q12 | 100.0% |  |  | 59s |
| C01 | 100.0% | 100.0% | yes | 94s |
| C02 | 100.0% | 100.0% | no | 71s |
| C03 | 60.0% | 100.0% | yes | 78s |
| C04 | 100.0% | 100.0% | yes | 97s |
| C05 | 100.0% | 100.0% | yes | 87s |
| C06 | 42.9% | 57.1% | yes | 82s |

## Wrong citations

- Q06 [3] → main paper › Abstract
- Q06 [4] → main paper › Introduction
- Q09 [2] → main paper › Introduction
- Q09 [3] → main paper › Multi-stage processing pipeline
- Q09 [4] → main paper › Experiments on the Cityscapes dataset
- C03 [3] → main paper › Experiments
- C03 [4] → main paper › Content Resolution No.classes
- C06 [4] after "RefineNet" → main paper › grade lesions on ultra-high-resolution images.
- C06 [4] after "FPN" → main paper › grade lesions on ultra-high-resolution images.
- C06 [4] after "ICNet" → main paper › grade lesions on ultra-high-resolution images.
- C06 [4] → main paper › grade lesions on ultra-high-resolution images.
- C06 [5] → main paper › Experiments on the Cityscapes dataset
- C06 [6] → main paper › Benefits of multiple scale levels
- C06 [7] → main paper › Ablation study: point selection
