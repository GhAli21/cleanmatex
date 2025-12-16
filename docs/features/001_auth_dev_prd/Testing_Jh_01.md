
Testing PRD-001 - on 17/10/2025 - 001:

In register page:
- Terms of Service and Privacy Policy links not working.

After register:
- in success screen when click on (return to login) it not going to login screen but goes to dashboard screen without verify email
- no email in Mailpit http://localhost:54324
- in supabase (http://127.0.0.1:54323/) i checked org_users_mst no record for the new user but in auth.users there is record for the new user.

- Email and password login - working good
- Show/hide password toggle - working but the cursor should first go outside the text field and back to toggle.
- Remember me checkbox - not working
- Forgot password link - the email received with reset link but when click the link it goes to login screen not to reset screen
http://127.0.0.1:54321/auth/v1/verify?token=pkce_b689b6851019c2f4d55fc6008ca440798c17b334ec44b01c937102c9&type=recovery&redirect_to=http://127.0.0.1:3000
 
- Sign up link - working

