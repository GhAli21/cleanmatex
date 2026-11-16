CLEANMATEX LEGAL PACK
Document: Read me
Version: legal-pack-2026-11-17
Language: English
Arabic pair: 00_README_ar.txt. That file is the legal translation of this text.
Folder: docs/pending_to_production/16_11_2026/Lawyer_docs
Status: Complete operative draft for Phase 3 engineering and for counsel review
Pilot markets: Oman, United Arab Emirates, Bahrain
Out of this pack: Saudi Arabia (no Saudi addendum; do not onboard Saudi organizations on this pack)

PAIRING RULE
Every document in this folder is two files with the same name.
One ends in _en.txt. The other ends in _ar.txt.
The _ar file is the legal translation of the _en file.
Clause numbers match.
Version codes, database field names, enum values, vendor names, and square-bracket tokens stay in Latin in both files.
Do not publish one language alone.

WHAT THIS PACK IS
This folder is the legal text for Phase 3 of the 16 Nov 2026 production roadmap.
It is written so that engineering can publish it and store acceptance against fixed version codes.
It covers:
- B4 Terms of Service, Privacy Policy, Data Processing Agreement, public data-processing page, cookie notice, acceptable-use policy, and the sign-up checkbox
- B5 a data-residency sentence that stays unpublished until the real hosting region is filled in
- N4 the order-intake opt-in rule, already decided in this pack
- U4 the anonymize-customer rule, which keeps order and finance records

WHAT THIS PACK IS NOT
These texts were prepared as a full drafting pack in the form used for a GCC business-to-business software contract and for Oman, UAE, and Bahrain personal-data law.
The Arabic file of each pair is a legal translation of the English file.
They become customer-facing law between CleanMateX and a laundry only after all of the following are true:
1. Every bracketed item in 18_SUBPROCESSORS_AND_VERSIONS_en.txt and 18_SUBPROCESSORS_AND_VERSIONS_ar.txt is replaced with the same real fact.
2. A lawyer admitted to practise in the Provider's country of incorporation, and able to cover Oman, the UAE, and Bahrain data-protection duties, signs the approval block at the end of this file.
3. The Owner adopts the N4 rule and the liability cap by signing the decision block in 01_COUNSEL_MEMO_AND_DECISIONS_en.txt.
4. No published page still contains a square bracket.

Until that sign-off, engineering may build the pages, the checkbox, the stored version fields, the order-intake consent record, and the anonymize action against this pack.
Engineering must not present the pages to a real laundry as approved counsel text, and must not go live, while a square bracket remains.

HOW TO READ THE FILES
Each row is one document. Read the _en file and the _ar file together.

00  This read-me. Publication gate and approval block.
01  Counsel memo. Roles, the decisions, and what engineering implements.
02  Terms of Service. Contract with the laundry (the Organization).
04  Privacy Policy. CleanMateX as controller of platform data, and as processor of laundry-customer data.
06  Data Processing Agreement. Signed by the same sign-up checkbox as the Terms.
08  Public data-processing page. The page the roadmap calls the data-processing page.
10  Cookie and tracking notice.
12  Acceptable Use Policy.
14  Sign-up checkbox wording and the acceptance record engineering must store (B4).
15  Order-intake opt-in rule, counter script, and the consent record (N4). Decided.
16  Anonymize-customer specification (U4). Decided. Keeps finance and issued tax documents.
17  Short notice the laundry shows its own customer at the counter.
18  Version codes, subprocessors, and every fact the Owner must fill before publication.
19  Pilot order form for manual invoices and bank transfer.

LANGUAGE
English and Arabic are both issued.
The precedence rule is Terms clause 21 in 02_TERMS_OF_SERVICE_en.txt and 02_TERMS_OF_SERVICE_ar.txt.

VERSION CODES ENGINEERING MUST STORE
See 18_SUBPROCESSORS_AND_VERSIONS_en.txt.
Changing a published sentence means a new version code and a new acceptance in both languages.
Do not edit a version string that any user has already accepted. Issue a new file version.

SQUARE-BRACKET GATE
A token in square brackets is a missing fact, not optional prose.
The publication checklist is in 01, section 8.
Release is blocked while any published file contains "[" or "]".

PILOT SHAPE THIS PACK ASSUMES
- The buyer is a business: a laundry or dry-cleaner (the Organization). This pack is not a consumer subscription contract.
- Sign-up creates a 14-day trial and does not collect a card.
- Pilot fees are invoiced by hand and paid by bank transfer. There is no card gateway in this pack.
- The Service is not offered to organizations established in Saudi Arabia until a separate Saudi pack exists.
- WhatsApp and SMS are optional and are off until the Organization connects an approved sender.
- Each laundry keeps its own customer records. There is no cross-laundry customer identity in this pack.

APPROVAL BLOCK
Complete in ink or by a signed PDF. Do not delete this block.

Local counsel
Name:
Firm:
Jurisdictions covered:
Date:
Statement: I have reviewed legal-pack-2026-11-17 for use with organizations in Oman, the UAE, and Bahrain, after the brackets in file 18 were filled, and I approve the English and Arabic texts identified by the version codes in file 18 for publication.
Signature:

Owner
Name:
Date:
Statement: I adopt the N4 rule, the U4 rule, the liability cap, and the governing-law choice written in file 01 and file 18.
Signature:
