# User Guide — Mermaid

## Customer tracking experience

```mermaid
flowchart TD
  Receipt[Receipt QR / copied public link] --> Link{0441 applied?}
  Link -->|Yes| Token[/track/{token}/]
  Link -->|No or fallback| Legacy[/public/orders/{tenantId}/{orderNo}/]
  Legacy --> Redirect{token exists?}
  Redirect -->|Yes| Token
  Redirect -->|No| LegacyPage[Readable tracking page]
  Token --> TrackPage[Customer sees status + totals + timeline]
  LegacyPage --> TrackPage
  TrackPage --> PayNotice{PAY_ON_COLLECTION + balance?}
  PayNotice -->|Yes| Due[Show remaining amount notice]
  PayNotice -->|No| Continue[Show normal status card]
  Due --> Confirm{Status ready/OFD?}
  Continue --> Confirm
  Confirm -->|Yes| Click[Customer clicks confirm]
  Confirm -->|Delivered| Disabled[Button disabled]
  Click --> Delivered[Order marked delivered]
  Delivered --> Disabled
```

## Home collection vs branch drop-off

```mermaid
flowchart TD
  Book[Customer books remotely] --> Type{Fulfilment type}
  Type -->|pickup / bring_in| Draft[draft + awaiting drop-off at branch]
  Type -->|home_collection / C and D| Await[awaiting_collection]
  Draft --> Branch[Staff confirm physical intake at branch]
  Await --> Floor[/dashboard/home-collection]
  Floor --> Assign[Assign]
  Assign --> Confirm{Confirm or Fail}
  Confirm -->|Confirm| Intake[intake + received stamps]
  Confirm -->|Fail| Await
```
