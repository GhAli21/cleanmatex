JWT Test UI Component - Complete
Files Created:
JWT Viewer Component - web-admin/components/jhtest/JwtViewerJhTest.tsx
Fully functional JWT decoder and viewer
Decodes Supabase authentication tokens
Displays all JWT claims in organized sections
Test Page - web-admin/app/dashboard/jhtestui/page.tsx
Simple wrapper page using the JWT viewer component
Follows existing dashboard page patterns
Navigation Menu Entry - Updated web-admin/config/navigation.ts
Added "JWT Test" menu item at the bottom of the sidebar
Only visible to admin users
Uses Bug icon for easy identification
Features Implemented:
🔍 Token Overview Section
Issuer information
Subject (User ID)
Issued At timestamp
Expiration timestamp
Live countdown timer showing time remaining
👤 User Claims Section
Email address
User role (with badge styling)
Email confirmation status
Phone number
🏢 Tenant Context Section
Tenant Organization ID
App metadata (if available)
User metadata (if available)
📋 Full Payload Section
JWT Header (algorithm, type)
Complete payload with all claims
Signature
All displayed as formatted JSON
🔐 Raw Token Section
Show/hide toggle for security
Copy-to-clipboard functionality
Full raw JWT string
⚡ Additional Features
Refresh button to reload current session
Real-time token expiration countdown
Visual indicators for expired tokens
Copy-to-clipboard with success feedback
Responsive design for mobile and desktop
Error handling for missing sessions
Loading states
Security Considerations:
✅ Admin-only access - Only users with 'admin' role can see the menu item
✅ No external API calls - Token data stays client-side
✅ Optional token display - Raw token is hidden by default
✅ No console logging - Sensitive data is not logged
How to Access:
Start the web-admin development server: npm run dev
Log in as an admin user
Look for "JWT Test" at the bottom of the sidebar menu (with Bug icon 🐛)
Click to view your decoded JWT token
TypeScript Validation:
✅ No TypeScript errors in the new components
✅ Properly typed with Supabase Database types
✅ Compatible with existing codebase patterns The implementation follows all the project conventions including:
Tailwind CSS styling
Client component pattern
Supabase auth helpers
Lucide React icons
Responsive design patterns
You can now use this page to debug authentication issues, inspect JWT claims, verify tenant context, and monitor token expiration during development!
