from datetime import datetime, timedelta, timezone
import hashlib
import os
import secrets
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import Cookie, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from itsdangerous import BadSignature, URLSafeTimedSerializer
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import create_engine, text
from twilio.rest import Client as TwilioClient

load_dotenv(Path(__file__).with_name(".env"))
DATABASE_URL = os.getenv("DATABASE_URL", "")
BACKEND_PUBLIC_URL = os.getenv("BACKEND_PUBLIC_URL", "http://127.0.0.1:16000").rstrip("/")
FRONTEND_PUBLIC_URL = os.getenv("FRONTEND_PUBLIC_URL", "http://127.0.0.1:15000").rstrip("/")
SESSION_SECRET = os.getenv("SESSION_SECRET", "")
SESSION_DURATION_MINUTES = int(os.getenv("SESSION_DURATION_MINUTES", "30"))
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_SCOPES = os.getenv("GOOGLE_SCOPES", "openid email profile")
AUTO_ASSIGN_ROLE_CODES = [code.strip().upper() for code in os.getenv("AUTO_ASSIGN_ROLE_CODES", "ADMIN,PRINCIPAL,FACULTY,STUDENT,PARENT").split(",") if code.strip()]
ALLOWED_FRONTEND_ORIGINS = [FRONTEND_PUBLIC_URL]
if FRONTEND_PUBLIC_URL == "http://127.0.0.1:15000":
    ALLOWED_FRONTEND_ORIGINS.append("http://localhost:15000")
elif FRONTEND_PUBLIC_URL == "http://localhost:15000":
    ALLOWED_FRONTEND_ORIGINS.append("http://127.0.0.1:15000")
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=2, max_overflow=3) if DATABASE_URL else None
serializer = URLSafeTimedSerializer(SESSION_SECRET) if SESSION_SECRET else None
schema_path = Path(__file__).with_name("schema.sql")
app = FastAPI(title="JCLG Initial Login API")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_FRONTEND_ORIGINS, allow_credentials=True, allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type"])

class PhoneRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=16)

    @field_validator("phone")
    @classmethod
    def validate_indian_phone(cls, value):
        if not value.isascii() or not value.isdigit() or len(value) != 10 or value[0] not in "6789":
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return f"+91{value}"
class CodeRequest(BaseModel):
    code: str = Field(min_length=4, max_length=10)
class RoleRequest(BaseModel):
    role_id: int
class ModuleRequest(BaseModel):
    module_code: str = Field(min_length=1, max_length=50)

def require_db():
    if engine is None:
        raise HTTPException(503, "DATABASE_URL is not configured")
    try:
        with engine.connect() as db:
            db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(503, "Database service unavailable. Check the PostgreSQL connection and security settings.") from exc
    return engine

def hash_token(value):
    return hashlib.sha256(value.encode()).hexdigest()

def session_from_cookie(token):
    if not token:
        raise HTTPException(401, "Login required")
    with require_db().begin() as db:
        session = db.execute(text("""
            SELECT session_id, user_id, selected_role_id, phone_verified_at
            FROM jclg_login_session
            WHERE session_token_hash=:token_hash AND is_active=TRUE
              AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP
        """), {"token_hash": hash_token(token)}).mappings().first()
        if not session:
            raise HTTPException(401, "Session expired")
        db.execute(text("UPDATE jclg_login_session SET last_activity_at=CURRENT_TIMESTAMP WHERE session_id=:session_id"), session)
    return session

def set_cookie(response, token):
    response.set_cookie("jclg_session", token, httponly=True, secure=False, samesite="lax", max_age=SESSION_DURATION_MINUTES * 60)

def client_ip(request):
    return request.client.host if request.client else None

def otp_hash(session_id, code):
    return hashlib.sha256(f"{SESSION_SECRET}:{session_id}:{code}".encode()).hexdigest()

@app.on_event("startup")
def initialize_schema():
    if not engine:
        return
    try:
        with engine.begin() as db:
            db.exec_driver_sql(schema_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Database initialization skipped at startup: {exc}")

@app.get("/")
def root():
    return {"service": "JCLG Initial Login API", "status": "running"}

@app.get("/health")
def health():
    try:
        with require_db().connect() as db:
            db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except HTTPException as exc:
        return JSONResponse(status_code=503, content={"status": "unhealthy", "database": "disconnected", "error": exc.detail})
    except Exception as exc:
        return JSONResponse(status_code=503, content={"status": "unhealthy", "database": "disconnected", "error": str(exc)})

@app.get("/api/config")
def public_config():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google Client ID is not configured")
    return {"google_client_id": GOOGLE_CLIENT_ID}

class GoogleCredential(BaseModel):
    credential: str = Field(min_length=20)

@app.post("/api/auth/google/token")
async def google_token(request: Request, payload: GoogleCredential):
    if not SESSION_SECRET:
        raise HTTPException(503, "SESSION_SECRET is not configured")
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google Client ID is not configured")
    async with httpx.AsyncClient(timeout=15) as client:
        profile_response = await client.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": payload.credential})
    if profile_response.status_code != 200:
        raise HTTPException(401, "Google credential could not be verified")
    profile = profile_response.json()
    if profile.get("aud") != GOOGLE_CLIENT_ID or profile.get("email_verified") != "true":
        raise HTTPException(401, "Google account is not verified for this application")
    raw_token = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(minutes=SESSION_DURATION_MINUTES)
    with require_db().begin() as db:
        provider_id = db.execute(text("SELECT auth_provider_id FROM jclg_auth_provider WHERE provider_code='GOOGLE'")).scalar_one()
        user_id = db.execute(text("SELECT user_id FROM jclg_user WHERE email=:email"), {"email": profile["email"]}).scalar_one_or_none()
        if user_id is None:
            first_name = profile.get("given_name", "User")
            last_name = profile.get("family_name")
            db.execute(text("INSERT INTO jclg_user(username,first_name,last_name,email,profile_photo,last_login) VALUES(:username,:first,:last,:email,:photo,CURRENT_TIMESTAMP)"), {"username": profile["email"].split("@", 1)[0], "first": first_name, "last": last_name, "email": profile["email"], "photo": profile.get("picture")})
            user_id = db.execute(text("SELECT user_id FROM jclg_user WHERE email=:email"), {"email": profile["email"]}).scalar_one()
        db.execute(text("""INSERT INTO jclg_user_auth(user_id,auth_provider_id,provider_user_id,provider_email,email_verified,last_authenticated_at) VALUES(:user,:provider,:subject,:email,:verified,CURRENT_TIMESTAMP) ON CONFLICT(auth_provider_id,provider_user_id) DO UPDATE SET user_id=EXCLUDED.user_id,provider_email=EXCLUDED.provider_email,email_verified=EXCLUDED.email_verified,last_authenticated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP"""), {"user": user_id, "provider": provider_id, "subject": profile["sub"], "email": profile["email"], "verified": profile.get("email_verified", False)})
        session_id = db.execute(text("""INSERT INTO jclg_login_session(user_id,session_token_hash,ip_address,user_agent,last_activity_at,expires_at) VALUES(:user,:hash,CAST(:ip AS INET),:agent,CURRENT_TIMESTAMP,:expires) RETURNING session_id"""), {"user": user_id, "hash": hash_token(raw_token), "ip": client_ip(request), "agent": request.headers.get("user-agent"), "expires": expires}).scalar_one()
        for role_code in AUTO_ASSIGN_ROLE_CODES:
            db.execute(text("""INSERT INTO jclg_user_role(user_id,role_id,is_primary) SELECT :user_id,role_id,:is_primary FROM jclg_role WHERE role_code=:role_code ON CONFLICT(user_id,role_id) DO NOTHING"""), {"user_id": user_id, "role_code": role_code, "is_primary": role_code == AUTO_ASSIGN_ROLE_CODES[0]})
        db.execute(text("INSERT INTO jclg_login_audit(user_id,auth_provider_id,session_id,event_type,ip_address,user_agent) VALUES(:user,:provider,:session,'GOOGLE_LOGIN',CAST(:ip AS INET),:agent)"), {"user": user_id, "provider": provider_id, "session": session_id, "ip": client_ip(request), "agent": request.headers.get("user-agent")})
    response = JSONResponse({"next": f"{FRONTEND_PUBLIC_URL}/?step=phone"})
    set_cookie(response, raw_token)
    return response

@app.post("/api/auth/otp/request")
def request_otp(payload: PhoneRequest, jclg_session: str | None = Cookie(default=None)):
    session = session_from_cookie(jclg_session)
    account_sid, auth_token, from_number = os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"), os.getenv("TWILIO_PHONE_NUMBER")
    if not all((account_sid, auth_token, from_number)):
        raise HTTPException(503, "Twilio Account SID, Auth Token, and phone number are not configured")
    code = f"{secrets.randbelow(1000000):06d}"
    expiry = datetime.now(timezone.utc) + timedelta(minutes=int(os.getenv("OTP_EXPIRY_MINUTES", "5")))
    try:
        TwilioClient(account_sid, auth_token).messages.create(to=payload.phone, from_=from_number, body=f"JCLG verification code: {code}. It expires in {os.getenv('OTP_EXPIRY_MINUTES', '5')} minutes.")
    except Exception as exc:
        raise HTTPException(502, "Unable to send OTP") from exc
    with require_db().begin() as db:
        db.execute(text("UPDATE jclg_user SET phone=:phone,updated_at=CURRENT_TIMESTAMP WHERE user_id=:user_id"), {"phone": payload.phone, "user_id": session["user_id"]})
        db.execute(text("UPDATE jclg_login_otp SET consumed_at=CURRENT_TIMESTAMP WHERE session_id=:session_id AND consumed_at IS NULL"), session)
        db.execute(text("INSERT INTO jclg_login_otp(session_id,phone,code_hash,expires_at) VALUES(:session_id,:phone,:code_hash,:expires_at)"), {"session_id": session["session_id"], "phone": payload.phone, "code_hash": otp_hash(session["session_id"], code), "expires_at": expiry})
    return {"status": "pending"}

@app.post("/api/auth/otp/verify")
def verify_otp(payload: CodeRequest, jclg_session: str | None = Cookie(default=None)):
    session = session_from_cookie(jclg_session)
    with require_db().begin() as db:
        challenge = db.execute(text("SELECT otp_id,code_hash FROM jclg_login_otp WHERE session_id=:session_id AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1"), session).mappings().first()
        if not challenge or not secrets.compare_digest(challenge["code_hash"], otp_hash(session["session_id"], payload.code)):
            if challenge:
                db.execute(text("UPDATE jclg_login_otp SET attempts=attempts+1 WHERE otp_id=:otp_id"), challenge)
            raise HTTPException(400, "Invalid or expired verification code")
        db.execute(text("UPDATE jclg_login_otp SET consumed_at=CURRENT_TIMESTAMP WHERE otp_id=:otp_id"), challenge)
    if not challenge:
        raise HTTPException(400, "Invalid verification code")
    with require_db().begin() as db:
        db.execute(text("UPDATE jclg_login_session SET phone_verified_at=CURRENT_TIMESTAMP WHERE session_id=:session_id"), session)
    return {"status": "verified"}

@app.get("/api/auth/roles")
def roles(jclg_session: str | None = Cookie(default=None)):
    session = session_from_cookie(jclg_session)
    if not session["phone_verified_at"]:
        raise HTTPException(403, "Verify your phone number first")
    with require_db().connect() as db:
        rows = db.execute(text("SELECT role_id, role_code, role_name FROM jclg_role WHERE status=TRUE ORDER BY role_name")).mappings().all()
    return {"roles": [dict(row) for row in rows]}

@app.post("/api/auth/role")
def select_role(payload: RoleRequest, jclg_session: str | None = Cookie(default=None)):
    session = session_from_cookie(jclg_session)
    with require_db().begin() as db:
        allowed = db.execute(text("SELECT 1 FROM jclg_role WHERE role_id=:role_id AND status=TRUE"), {"role_id": payload.role_id}).scalar_one_or_none()
        if not allowed:
            raise HTTPException(403, "Role is not available for this account")
        db.execute(text("UPDATE jclg_login_session SET selected_role_id=:role_id WHERE session_id=:session_id"), {"role_id": payload.role_id, "session_id": session["session_id"]})
        role = db.execute(text("SELECT role_code, role_name FROM jclg_role WHERE role_id=:role_id"), {"role_id": payload.role_id}).mappings().one()
    return {"status": "selected", "role": dict(role), "landing_path": f"/role/{role['role_code'].lower()}"}

@app.post("/api/auth/logout")
def logout(jclg_session: str | None = Cookie(default=None)):
    if jclg_session and engine:
        with engine.begin() as db:
            db.execute(text("UPDATE jclg_login_session SET is_active=FALSE,revoked_at=CURRENT_TIMESTAMP WHERE session_token_hash=:hash"), {"hash": hash_token(jclg_session)})
    response = RedirectResponse(FRONTEND_PUBLIC_URL)
    response.delete_cookie("jclg_session")
    return response
