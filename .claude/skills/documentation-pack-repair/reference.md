# Pack Repair Reference

## 1. Standard File Order

Create or normalize in this order:

1. `README.md`
2. `current_status.md`
3. `progress_summary.md`
4. `development_plan.md`
5. `developer_guide.md`
6. `user_guide.md`
7. `testing_guide_and_scenarios.md`
8. `deploy_guide.md`
9. `developer_guide_mermaid.md`
10. `user_guide_mermaid.md`
11. `CHANGELOG.md`
12. `version.txt`

## 2. Fastest High-Value Files

If the task is constrained, prioritize:

- `README.md`
- `current_status.md`
- `progress_summary.md`
- `testing_guide_and_scenarios.md`

## 3. Consistency Checks

- `README.md` links to the other pack docs
- `current_status.md` matches `progress_summary.md`
- `developer_guide.md` and `user_guide.md` describe the same feature boundaries
- testing guide covers the main workflows claimed elsewhere
