


***

💻 **AI Coding Prompt: Re-design and Re-build the Processing/Cleaning Queue Screen**

**Goal:**  
Build a single-page responsive view representing the "Processing" queue of a POS system. This view is a dense, sortable, filterable data table for managing multiple cleaning orders simultaneously with clear status indicators and key metrics.

***

### 1. Header and Controls (Top Row)

- The top row is split into **two groups**:

| Element          | Type           | Purpose                                                                                         |
|------------------|----------------|-------------------------------------------------------------------------------------------------|
| Title            | Text           | "Processing" (Large, bold text aligned left)                                                     |
| Filters          | Dropdowns      | Filtering dropdowns: Reports, Sections, Order Type, Date                                       |
| Status Aggregates | Metrics Display| Row of cards/labels showing real-time statistics for displayed orders (separate from table headers): e.g. Orders 3, Pieces 23, Weight 0kg, Value OMR90, Unpaid OMR52 |
| Action Button    | Button         | Primary blue button labeled "Update Order"                                                    |
| Refresh Icon     | Icon           | Circular arrow icon (e.g., Lucide's RefreshCw) for reloading data                              |

***

### 2. Main Data Table (Queue)

- Use a **standard horizontal table layout** with taller rows for multi-line order details.

#### A. Column Headers (Fixed, Sortable)

| Column Label  | Description                          | Sorting Indicator           |
|---------------|------------------------------------|----------------------------|
| ID            | Order Number                       | Sortable (e.g., ArrowUpDown icon) |
| READY BY      | Date and time (format: 12/09/25 5pm) | Sortable                   |
| CUSTOMER      | Customer name (e.g., CustomerNm)  | Sortable                   |
| ORDER         | Multi-line list of line items     | Sortable                   |
| PCS           | Total pieces                      | Sortable                   |
| NOTES         | Order notes                      | Sortable                   |
| TOTAL         | Total order value (e.g., OMR31.00) | Sortable                   |
| (Status)      | Unlabeled status column           | Sortable                   |

- **Status Filter:** Input field labeled "Filter" positioned above the Status column.

#### B. Data Rows (Each row = one order)

- **Row Highlight:** Colored dot or subtle highlight on the left edge indicating urgency/status (e.g., pink for row 1, faint blue/gray for others).
- **ORDER column:** Multi-line text describing items with quantities, e.g.,  
  `Jacket x 1, Jeans x 2, Sweater x 1, Tie x 1`  
- Below the items, a small blue "Details" link/button to expand/edit/order details modal.

#### C. Status Indicators (Right side of row)

- **Payment/Priority Tag:** If unpaid, small colored tag indicating status, e.g., "1st" in yellow/orange box.
- **Action Icons:** Two distinct icons:  
  - Edit/Process icon (e.g., Lucide's SquarePen) for editing or marking as being worked on  
  - Status toggle icon (e.g., Lucide's CheckCircle with line/arrow) for toggling status to "Cleaned"/"Completed"  
- **Completion Status Tag:** Fixed text showing current state (e.g., "Cleaned" in light blue text).

***

### 3. Implementation Details

- **Responsive Design:** Table handles overflow with horizontal scrolling on smaller screens.
- **Data Structure:**  
  - Front-end receives one Master record (Order)  
  - Each order contains an array of Detail records (line items) for the ORDER column.
- **Visual Consistency:**  
  - Use OMR currency prefix uniformly (e.g., OMR31.00)  
  - Align all numerical fields (Total, Pieces) clearly and consistently.

***

This prompt provides a complete visual and functional specification for developing the Processing/Cleaning Queue screen as a data-intensive, responsive table with interactive filtering, sorting, and status management.

***
