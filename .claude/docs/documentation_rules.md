# Software Documentation Rules and Guidelines

This document outlines comprehensive, structured, and scalable rules for creating, maintaining, and managing software feature documentation. These guidelines apply across all levels — features and their nested sub-components — ensuring clarity, consistency, and quality.
---

*** Always follow these documentation rules consistently to ensure highly maintainable, navigable, and comprehensive project documentation***

---

## 1. Folder and Lookup File Structure

### 1.1 Dedicated Feature Folders
- Each **feature** must have a dedicated folder under `docs/`, uniquely named after the feature (e.g. `docs/features/Feature_A`).
- Duplicate folders for the same feature are not allowed.
- Each feature folder contains documentation files and subfolders for components, services, screens, etc.

### 1.2 Sub-Component Folders
- Inside each feature folder, every **component**, **service**, **screen**, or other logical subunit must have its own folder.
- Each sub-component folder follows the same documentation structure and content rules as feature folders.

### 1.3 Lookup Files for Consistency
- A **root lookup file** `docs/folders_lookup.md` indexes all top-level feature folders:
  - Format: `Feature Name 
             Folder Path 
			 Description 
			 Version 
			 Last Updated
			 `
- Each feature folder contains a **feature-level lookup file** `{Feature_Name}_lookup.md`, indexing all its immediate sub-component folders.
- Each sub-component folder contains a **sub-component-level lookup file** `{ComponentName}_lookup.md` for any deeper nested sub-sub-components.
- Lookup files prevent duplication and serve as centralized indices ensuring discoverability and consistency.

---

## 2. Documentation Folder Structure and Content

Each feature or sub-component folder must include the following files with regularly updated content:

- `README.md`  
  A high-level overview of the entity (feature or component), purpose, scope, and navigation tips.

- `development_plan.md`  
  Roadmaps, planning details, milestones, and tasks related to the folder scope.

- `progress_summary.md`  
  Log of completed work, dates, and outstanding items with progress metrics.

- `current_status.md`  
  Snapshot of the current implementation state, blockers, or dependencies.

- `developer_guide.md`
  Detailed developers documentation covering the implemented feature, including code structure, services, API calls, and overall code flow for clear understanding and maintainability, relevant at this level.

- `developer_guide_mermaid.md`
  A Flowchart file using mermaid.js that is part of developers documentation covering shows high-level code flow.
  
- `user_guide.md`  
  Step-by-step user workflows, tutorials, UI walkthroughs, FAQs, and troubleshooting information relevant at this level.

- `user_guide_mermaid.md`  
  A Flowchart file using mermaid.js that shows workflows, tutorials, UI walkthroughs, FAQs, and troubleshooting information relevant at this level.

- `testing_scenarios.md`  
  Clear test cases, edge cases, and acceptance criteria scoped to the feature/component.

- `CHANGELOG.md`  
  A detailed changelog tracking additions, fixes, changes, deprecations, removals, and security updates, following semantic versioning.

- `version.txt`  
  Contains the current version string (e.g., `v1.2.0`).

- `technical_docs/` folder for technical documentation files (names such as tech_<TOPIC_NAME>.md ) For this aspects and more:
   1- architecture diagrams, 
   2- API specifications, 
   3- data models, 
   4- A Flowchart files (names end with _mermaid.md) using mermaid.js that is part of developers documentation covering shows Detailed process flow, code flow, call flow, execution flow, API calls, , and overall code flow for clear understanding and maintainability, relevant at this level. You can create more than one file for this.
   5- and deeper technical details.

---

## 3. Content and Metadata Standards

- Every markdown file should start with a metadata header:
version: v1.2.0
last_updated: 2025-10-24
author: Author Name

- Documentation must be clear, concise, and language consistent.
- Visual aids (diagrams, screenshots) should be incorporated where useful.
- Cross-link related documents within and across folder hierarchies.

---

## 4. Versioning and Change Management

- Follow [Semantic Versioning](https://semver.org/) rules for every feature and sub-component independently.
- Version format: `MAJOR.MINOR.PATCH` (e.g., `v2.0.1`).
- `CHANGELOG.md` format example:
Change Log
[v1.2.0] - 2025-10-24
Added
New OAuth service integration.

Fixed
Corrected UI rendering bug.

Security
Updated token encryption.


- `CHANGELOG.md` must be updated with every session or release with meaningful summaries.
- Release tags in VCS must mirror these versions.

---

## 5. User Guide and Workflow Documentation

- Provide user-centric documentation describing:
- How to use the feature/component.
- Step-by-step workflows.
- FAQs and common troubleshooting steps.
- Support or escalation contacts.
- generate a Flowchart file name it <FEATURE_NAME_PROCESS_NAME_user_guide_01xx.md> using mermaid.js that shows what is happening in details.

---

## 6. Developer Guide and Code Flow Documentation
Provide comprehensive developer-centric documentation describing:
- Code structure, services, API calls, and overall code execution flow.
- Detailed explanations of key functions, modules, and interactions.
- Troubleshooting, debugging tips, and escalation contacts for implementation issues.
- Generate a Flowchart file named <FEATURE_NAME_PROCESS_NAME_developer_guide_01xx.md> using mermaid.js illustrating the detailed code flow and service interactions.

---

## 7. Testing Scenarios

- Document testing strategies and scenarios, including:
- Functional test cases.
- Integration and edge cases.
- Instructions for setting up test environments.
- Expected results to validate acceptance.

---

## 8. Regular Updates and Synchronization

- Documentation files must be updated frequently during development sessions.
- Critical to avoid progress and remaining/pending tasks loss by updating docs before the end or pause of any work session such as by Claude code sessions limits.

---

## 9. Automated Validation and Enforcement

- Automated checks must run on start using and on commit the work to verify:
- Folder and file names conform to naming standards referenced by lookup files.
- Presence of all mandatory documents per folder.
- Correct metadata header fields within markdown files.
- Changelog correctness and version congruence.
- Provide actionable reports for any violations.

---

## 10. Versioning and Release Tag Enforcement Rules

- Use strictly semantic versioning for all artifacts.
- Ensure version tags are mirrored across documentation and VCS.
- Block merges/releases missing valid version or changelog updates.

---

## 11. Consolidated Checklist

- [ ] Create and maintain unique feature folders.
- [ ] Ensure sub-component folders replicate feature documentation structure.
- [ ] Populate/maintain hierarchical lookup files.
- [ ] Use standardized file naming and folder conventions.
- [ ] Include all required files per folder with metadata headers.
- [ ] Follow semantic versioning in `version.txt` and changelogs.
- [ ] Maintain comprehensive `user_guide.md` and `testing_scenarios.md`.
- [ ] Update documentation regularly and sync with development.
- [ ] Employ automated checks and block non-compliant changes.
- [ ] Tag releases in VCS consistent with documentation versions.

---

## 12. Sample Folder Tree

docs/
├── folders_lookup.md
├── features/
│ ├── Feature_A/
│ │ ├── Feature_A_lookup.md
│ │ ├── README.md
│ │ ├── development_plan.md
│ │ ├── progress_summary.md
│ │ ├── current_status.md
│ │ ├── developers_guide.md
│ │ ├── user_guide.md
│ │ ├── testing_scenarios.md
│ │ ├── CHANGELOG.md
│ │ ├── version.txt
│ │ ├── components/
│ │ │ ├── Login_Form/
│ │ │ │ ├── Login_Form_lookup.md
│ │ │ │ ├── Purpose_responsibilities.md -- For Purpose & responsibilities
│ │ │ │ ├── Implementation_details.md -- For Implementation details
│ │ │ │ ├── Testing_scenarios.md -- For Testing scenarios (specific to This component)
│ │ │ │ ├── README.md
│ │ │ │ ├── development_plan.md
│ │ │ │ ├── progress_summary.md
│ │ │ │ ├── current_status.md
│ │ │ │ ├── developers_guide.md -- For developers
│ │ │ │ ├── user_guide.md -- For Usage instructions
│ │ │ │ ├── testing_scenarios.md
│ │ │ │ ├── CHANGELOG.md
│ │ │ │ ├── version.txt
│ │ │ │ └── technical_docs/
│ │ │ │ ├── api_specs.md -- For APIs and interfaces
│ │ │ │ └── data_models.md
│ │ │ └── ...
│ │ ├── services/
│ │ │ └── ...
│ │ └── screens/
│ │ └── ...
│ └── Feature_B/
│ └── ...

---




