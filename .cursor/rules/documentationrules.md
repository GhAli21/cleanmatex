# Software Documentation Rules

## Overview
Comprehensive rules for creating, maintaining, and managing software feature documentation.

## Rules

### Folder and Lookup File Structure
- Each feature must have dedicated folder under `docs/features/`
- Each component/service/screen must have its own folder
- Root lookup file: `docs/folders_lookup.md` indexes all top-level feature folders
- Feature-level lookup: `{Feature_Name}_lookup.md` indexes sub-components
- Sub-component lookup: `{ComponentName}_lookup.md` for deeper nesting

### Documentation Folder Structure
Each feature/component folder must include:
- `README.md` - High-level overview, purpose, scope, navigation
- `development_plan.md` - Roadmaps, milestones, tasks
- `progress_summary.md` - Completed work log, outstanding items
- `current_status.md` - Current implementation state, blockers
- `developer_guide.md` - Code structure, services, API calls, code flow
- `developer_guide_mermaid.md` - Flowchart showing code flow
- `user_guide.md` - User workflows, tutorials, UI walkthroughs, FAQs
- `user_guide_mermaid.md` - Flowchart showing workflows
- `testing_scenarios.md` - Test cases, edge cases, acceptance criteria
- `CHANGELOG.md` - Detailed changelog with semantic versioning
- `version.txt` - Current version string (e.g., `v1.2.0`)
- `technical_docs/` - Technical documentation (architecture, API specs, data models, flowcharts)

### Content and Metadata Standards
- Every markdown file must start with metadata header:
  - `version: v1.2.0`
  - `last_updated: YYYY-MM-DD`
  - `author: Author Name`
- Documentation must be clear, concise, and language consistent
- Include visual aids (diagrams, screenshots) where useful
- Cross-link related documents

### Versioning and Change Management
- Follow Semantic Versioning (MAJOR.MINOR.PATCH)
- Update CHANGELOG.md with every session or release
- Include: Added, Fixed, Changed, Deprecated, Removed, Security
- Mirror version tags in VCS

### User Guide Documentation
- Describe how to use the feature/component
- Provide step-by-step workflows
- Include FAQs and troubleshooting
- Provide support or escalation contacts
- Generate flowchart files using mermaid.js

### Developer Guide Documentation
- Describe code structure, services, API calls, execution flow
- Explain key functions, modules, interactions
- Include troubleshooting and debugging tips
- Generate flowchart files using mermaid.js

### Testing Scenarios
- Document functional test cases
- Include integration and edge cases
- Provide test environment setup instructions
- Define expected results for acceptance

### Regular Updates
- Update documentation frequently during development sessions
- Update docs before end or pause of work session
- Prevent loss of context or progress

### Automated Validation
- Verify folder and file names conform to standards
- Check presence of all mandatory documents
- Validate metadata header fields
- Verify changelog correctness and version congruence

### Versioning Enforcement
- Use strictly semantic versioning
- Ensure version tags mirrored across documentation and VCS
- Block merges/releases missing valid version or changelog updates

## Conventions
- Always create unique feature folders
- Always maintain hierarchical lookup files
- Always use standardized file naming
- Always include all required files per folder
- Always follow semantic versioning
- Always update documentation regularly
