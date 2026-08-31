# JCLG Initial Login

Initial-login-only implementation for JCLG: Google Identity Services sign-in, direct Twilio SMS OTP, session creation, and database-backed role selection.

## Local setup

1. Create a dedicated PostgreSQL database for this module named `jclg_initial_login_local` on your local machine. Do not reuse or point this module at the AI Student Analysis database. For AWS RDS, set `DATABASE_URL` to the RDS PostgreSQL endpoint for this module only, for example `postgresql+psycopg://USER:PASSWORD@RDS_ENDPOINT:5432/jclg_initial_login_local?sslmode=require`. The endpoint, username, password, and security-group access are deployment secrets and are not available to embed in this project.
2. In `backend`, create `.env` from `.env.example` and set the database URL, Google Client ID, Twilio Account SID/Auth Token/sender phone number, and a random `SESSION_SECRET`.
3. In Google Cloud, create a **Web application** OAuth Client ID. Add `http://127.0.0.1:15000` and `http://localhost:15000` under Authorized JavaScript origins, configure the OAuth consent screen, and add your Google account as a test user. Google Identity Services uses the Client ID in the browser; no Google Client Secret is required.
4. Confirm the Client ID in `backend/.env` belongs to that Web application. If Google shows `Error 401: invalid_client` or `The given client ID is not found`, the ID must be replaced by the Google project administrator; code changes cannot repair a deleted or wrong-project Client ID.

4. Install and start the API:

   ```powershell
   cd backend
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn main:app --host 127.0.0.1 --port 16000
   ```

   Startup creates the eight required login tables and seeds roles/modules.

5. Copy `frontend/config.js.example` to `frontend/config.js` only when changing the API URL. Start the frontend in a second terminal:

   ```powershell
   cd frontend
   python -m http.server 15000 --bind 127.0.0.1
   ```

6. Open `http://127.0.0.1:15000`.

Google and Twilio secrets are never stored in the frontend or committed to Git. The supplied personal email and mobile number are test inputs only; enter them at runtime when testing. Direct SMS OTP uses `TWILIO_PHONE_NUMBER` as the approved sender and stores only a hash of the OTP in `jclg_login_otp`. For deployment, set `DATABASE_URL` to the RDS endpoint with `sslmode=require`, allow the deployment host in the RDS security group, set `FRONTEND_PUBLIC_URL` to the deployed HTTPS URL, and run the API on `16000` and frontend on `15000`.
