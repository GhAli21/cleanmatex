# One-pager: Special Request Management for Laundry Items

## 1. TL;DR
A special request feature for our multi-tenant laundry/dry-clean SAAS platform that enables clients to capture and manage customer preferences for item handling (steam pressing, hanging, folding, etc.). This ensures accurate order fulfillment, reduces processing errors, and improves customer satisfaction by delivering items exactly as requested.

## 2. Goals

### Business Goals
* Reduce order rework and customer complaints by 40% through accurate preference capture
* Increase customer retention by 25% through personalized service delivery
* Improve operational efficiency by streamlining the handoff between order intake and processing teams
* Create upsell opportunities through premium handling options
* Differentiate our platform from competitors with robust customization capabilities

### User Goals
* Quickly capture customer preferences at order creation time
* Easily view special requests during order processing and packing
* Ensure customers receive their items handled according to their preferences
* Minimize back-and-forth communication about item handling
* Build customer loyalty through consistent, personalized service

### Non-Goals
* Building a full CRM or customer profile management system (we'll focus on order-level preferences)
* Creating complex pricing rules for different handling types (pricing remains separate)
* Automating the physical handling processes themselves (this is about information capture and display)
* Supporting custom instructions beyond predefined handling options in the initial release

## 3. User stories

**Persona: Front Desk Staff / Order Entry Team**
* As a front desk associate, I need to quickly select from common handling preferences so I can process orders efficiently during busy periods
* As an order entry person, I need to see a customer's previous preferences so I can suggest the same options for new orders
* As a staff member, I need to add special notes for unusual requests so the processing team has complete information

**Persona: Processing Team / Production Staff**
* As a garment processor, I need to see special requests prominently on work orders so I don't miss critical handling instructions
* As a quality checker, I need to verify items are handled according to requests before packing so we meet customer expectations
* As a production lead, I need to filter orders by handling type so I can batch similar processing tasks

**Persona: Delivery/Packing Team**
* As a packer, I need to confirm the handling method (hanging, folding, etc.) before bagging items so customers receive properly prepared orders
* As a delivery person, I need to see any delivery-specific requests so I can fulfill customer expectations at drop-off

**Persona: Store Owner / Manager**
* As a store owner, I need to define which handling options are available so my team offers consistent services
* As a manager, I need to track which special requests are most popular so I can optimize operations and pricing

## 4. Functional requirements

### Must-Have (P0)
* Special request selection interface during order creation with predefined options: steam pressing, hanging, folding, on hangers in garment bag, boxed, no starch, light starch, heavy starch
* Order-level request assignment (applies to entire order by default)
* Item-level request override capability (specific items can have different handling)
* Visual indicators on order processing screens showing special requests
* Special request display on printed work orders and packing slips
* Basic reporting: count of orders by request type
* Tenant-level configuration to enable/disable specific request types

### Should-Have (P1)
* Customer preference memory: auto-suggest based on previous orders
* Batch filtering and sorting by request type for production efficiency
* Request templates for common combinations (e.g., "Executive Package" = steam press + hang + garment bag)
* Mobile-optimized view for warehouse/processing team
* Request completion checkboxes in processing workflow
* Photo attachment capability for unusual requests

### Could-Have (P2)
* Customer-facing portal where end customers can specify preferences directly
* AI-suggested requests based on item type and fabric
* Request change tracking and audit log
* Integration with pricing engine for premium handling fees
* Multi-language support for request labels
* Request analytics dashboard showing processing time impact by type

## 5. User experience

### Primary User Journey: Adding Special Requests to New Order
* Staff creates new order and enters customer information
* System displays special request section with common options as checkboxes/buttons
* Staff selects appropriate requests (e.g., "Steam Pressing", "Hanging")
* If customer has order history, system shows their previous preferences with "Use Previous" quick-action
* Staff can add item-level overrides by clicking on specific items and selecting different handling
* Staff can add free-text notes for unusual requests
* Special requests appear in order summary before confirmation
* Order is saved with all request metadata attached

### Processing Team Journey
* Processing team member scans order barcode or opens order on tablet
* Special requests appear in highlighted banner at top of screen with icons
* Team member completes processing according to specifications
* System requires checkbox confirmation that each request was fulfilled before order can proceed to packing
* Any unfulfilled requests generate a flag for manager review

### Edge Cases & UI Notes
* **Conflicting requests**: System warns if incompatible options are selected together (e.g., "hanging" and "folded")
* **Missing request data**: Orders without special requests show "Standard handling" default to avoid confusion
* **Multi-item orders with different requests**: Item list view shows mini-icons next to each item indicating its specific handling
* **Mobile view**: Request display uses icon system with tooltips rather than full text to save screen space
* **Print optimization**: Work orders use bold, large fonts for special requests to ensure visibility in production environment
* **Color coding**: Critical requests (e.g., "Rush") use red highlights; premium requests use gold/premium styling

## 6. Narrative

Maria owns Prestige Cleaners, a busy dry-cleaning business serving professionals in downtown. Tuesday morning starts with a rush of customers dropping off their weekly cleaning. A regular customer, James, drops off five dress shirts and reminds Maria he needs them steam pressed and on hangers like always.

Maria opens the order screen and starts entering James's items. As soon as she types his name, the system displays a small notification: "Previous preferences: Steam pressing, Hanging." She clicks "Apply Previous" and both options are instantly selected. For this order, James also mentions he's traveling and needs everything in a garment bag. Maria clicks the "Garment Bag" option, adds all five shirts, and confirms the order. The whole process takes 30 seconds.

In the back room, processing supervisor Carlos reviews the day's orders on his tablet. He filters by "Steam Pressing" to batch similar work together for efficiency. James's order appears with clear visual indicators: a steam iron icon and a hanger icon right at the top. Carlos assigns it to his steam pressing station.

Later, when packer Sandra prepares James's order for pickup, her screen shows the same clear indicators: steam pressed, on hangers, in garment bag. She verifies each item, checks the completion boxes, and packages everything accordingly. When James picks up his order that evening, everything is exactly as he requested—no surprises, no disappointments, just consistent, personalized service.

The next week, James returns. This time, Maria's system automatically suggests his usual preferences. James feels valued, the team processes his order efficiently, and Prestige Cleaners has turned a simple transaction into a personalized experience that keeps customers coming back.

## 7. Success metrics

### Primary Metrics
* **Error Reduction**: Decrease in order rework due to incorrect handling (target: 40% reduction within 3 months)
* **Customer Satisfaction**: CSAT score specifically for "items prepared as requested" (target: 4.5/5.0)
* **Feature Adoption**: Percentage of orders with special requests captured (target: 60% adoption within 2 months)

### Secondary Metrics
* **Processing Efficiency**: Average time from order intake to processing start (target: maintain current baseline despite added data entry)
* **Request Accuracy**: Orders fulfilled correctly on first attempt (target: 95% accuracy)
* **Repeat Customer Behavior**: Percentage of customers with consistent preferences across orders (indicates loyalty)
* **Premium Option Uptake**: Adoption rate of premium handling options, if priced separately

### Operational Metrics
* Feature usage by tenant to identify success patterns and support needs
* Most popular request combinations to inform template creation
* Mobile vs. desktop usage patterns to optimize interface design

## 8. Milestones & sequencing

### Phase 1: MVP Foundation (Weeks 1-4)
* **Week 1-2**: Design and implement special request data model and basic UI for order creation
* **Week 3**: Add request display to processing and packing screens
* **Week 4**: Basic reporting and tenant configuration settings
* **Deliverable**: Core special request capture and display functionality live for pilot tenants

### Phase 2: Workflow Integration (Weeks 5-7)
* **Week 5**: Implement customer preference memory and auto-suggestion
* **Week 6**: Add batch filtering, item-level overrides, and mobile optimization
* **Week 7**: Completion checkboxes and processing workflow integration
* **Deliverable**: Fully integrated special request workflow with efficiency tools

### Phase 3: Scale & Refine (Weeks 8-10)
* **Week 8**: Request templates and common combinations
* **Week 9**: Photo attachments and enhanced reporting
* **Week 10**: Performance optimization, bug fixes, and general availability launch
* **Deliverable**: Production-ready feature rolled out to all tenants

### Phase 4: Enhancement (Weeks 11-12+)
* Customer-facing portal for direct preference submission
* Advanced analytics and AI-based suggestions
* Integration with pricing engine
* Collect feedback and prioritize next iteration based on usage data

**Team**: 1 product manager, 2 engineers (1 backend, 1 frontend), 1 designer (part-time), QA support  
**Risk Mitigation**: Start with pilot tenants for early feedback; maintain weekly check-ins with processing teams to catch UX issues early 