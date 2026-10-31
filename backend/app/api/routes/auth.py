from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

import jwt

from app.db.session import get_db
from app.models import User
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from app.core.config import settings


router = APIRouter(prefix="/api/auth", tags=["Authentication"])

bearer_scheme = HTTPBearer()


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    email = data.email.lower().strip()

    existing_user = db.query(User).filter(User.email == email).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    user = User(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(data.password),
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    email = data.email.lower().strip()

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled.",
        )

    return TokenResponse(access_token=create_access_token(user.id))


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )

        user_id = int(payload.get("sub"))

    except (jwt.InvalidTokenError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )

    return user


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user