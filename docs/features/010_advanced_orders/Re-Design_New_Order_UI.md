
## 💻 AI Coding Prompt: Re-design Order/new Order Screen Interface

Re-Design and Re-build the Order/new Order alike single-page Point-of-Sale (POS) interface. 
The design must be modern, clean, and highly functional for rapid order entry.

### 1. General Layout and Structure

The interface must be divided into three main columns:

| Area | Width/Weight | Content |
| :--- | :--- | :--- |
| **Header/Navigation** | Full Width | Top bar with main application links and utility icons. |
| **Left/Center Panel** | Primary Content | Service tabs, Item selection area, and Stain/Condition toggles. |
| **Right Sidebar** | Fixed/Narrow | Customer details, Order Summary list, Notes, and Submission button. |

### 2. Header and Navigation Bar

* **Main Navigation Tabs:** Include prominent links for the application workflow: **New Order** (highlighted/active), **Detail**, **Cleaning**, **Ready**, and **Pickups**.
* **Utility Icons (Right):** Include icons for **Search** (magnifying glass), **Help** (question mark), **User Profile** (circle with an initial, e.g., 'A'), and a CTA button (e.g., "JOIN NOW").

### 3. Left/Center Panel: Item Selection

#### A. Service Category Tabs
* Implement a row of tabs below the header for major service categories: **Dry Cleaning** (must be active by default), **Laundry**, **Pressed / Ironed**, **Repairs**, and **Alterations**.

#### B. Item Grid
* Display items as a **grid of visual cards/thumbnails**.
* **Default View (Dry Cleaning):** Include items like Blouse, Dress, Jacket, Jeans, Sweater, Tie, etc.
* **Interaction:** Clicking an item card should immediately add it to the order list in the Right Sidebar.
    * An **overlaying blue circle counter** must appear on the card to indicate the current quantity added (e.g., `1`, `2`).
* **Custom Item Entry:** Include two large, square buttons in the grid:
    * **Item:** A button with a `+` icon that triggers a **"Describe an Item" modal** (see Section 5).
    * **Photo:** A button for adding a photo to a custom item.

#### C. Stain/Condition Toggles
* Implement a visually distinct section below the item grid containing toggle buttons for item conditions, repairs, or stains.
* **Grouping:** Organize these in 2-3 scrollable rows.
* **Examples:** Bubble, Button Broken, Collar Torn, Coffee, Ink, Grease, Bleach, etc.
* **Behavior:** When a toggle is clicked, it should highlight and apply the condition to the most recently added or currently selected line item in the order list.

### 4. Right Sidebar: Order Summary and Submission

* **Customer Header:** A field labeled **"Customer"** with a **Plus/Add** button (for adding a new customer) and **Edit/Remove** icons (pen, trash can).
* **Express Toggle:** A prominent **"Express"** toggle switch below the customer field.
* **Order List:** A dynamic list displaying line items:
    * Format: **Item #**, **Item Name**, **Quantity**, **Price** (e.g., `1 Jacket 6.00`).
    * Each line item must have a **small edit/delete icon** (e.g., a pencil or trash can).
* **Notes Section:** A collapsible or fixed text area labeled **"Notes"** with a **Save** button.
* **Footer Toggles:** Include simple toggle switches for **Quick Drop** and **Retail**.
* **Submission Bar (Sticky Footer):** A persistent green button at the very bottom:
    * Text: **Submit** followed by the **Ready Date and Time** (e.g., "Mon 8 Sep").
    * Total Price: Display the running total (e.g., **OMR20.50**) clearly formatted.
    * **Interaction:** Clicking the date/time should trigger the **Pickup/Ready Date Selector modal**. Clicking the "Submit/Total Price" button should trigger the **Payment modal**.

### 5. Required Modals (Pop-ups)

Implement the following modals that appear centered over the main interface:

#### A. Describe an Item Modal
* **Title:** "Describe an Item"
* **Fields:** **Name** (Text), **Quantity** (Number), **Price (per item)** (Currency), **Pieces (per item)** (Number, default 1), **Section** (Dropdown, e.g., Laundry), **Tax Exempt** (Checkbox).
* **Action Button:** **Submit** (Green).

#### B. Pickup/Ready Date Selector Modal
* **Title:** (Implicit, often tied to the "In-Store" or "Ready" context)
* **Content:** A full, standard **calendar view** allowing day selection, and a **time selector** next to it (e.g., 5 PM).
* **Action Buttons:** **Cancel** and **Apply** (Green).

#### C. Payment Modal
* **Title:** "Payment"
* **Total Display:** Large, central display of the final total (e.g., **OMR20.50**).
* **Payment Options (Buttons):** Prominent buttons for **Cash** and **Card**, with smaller buttons for **Pay on Collection** (default highlight), **Check**, and **Invoice**.
* **Discount/Promo Section:** Fields for applying **% discount**, **OMR discount**, **Add Promo**, and **Gift Card**.
* **Action Button:** **Submit** (Green).

---

The design must prioritize **speed and touch-friendliness**, with sufficient spacing between large interactive elements.
