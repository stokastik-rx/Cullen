"""
Auth endpoint tests - signup, login, and /me
"""
import pytest
from fastapi.testclient import TestClient


class TestAuthSignup:
    """Tests for POST /api/v1/auth/signup"""

    def test_signup_success(self, client: TestClient, test_user_data: dict):
        """Test successful user registration"""
        response = client.post("/api/v1/auth/signup", json=test_user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == test_user_data["email"]
        assert data["username"] == test_user_data["username"]
        assert "id" in data
        assert "hashed_password" not in data  # Password should not be exposed
        assert "password" not in data

    def test_signup_duplicate_email(self, client: TestClient, test_user_data: dict):
        """Test signup with duplicate email fails"""
        # First signup
        client.post("/api/v1/auth/signup", json=test_user_data)
        
        # Second signup with same email
        duplicate_data = {
            "email": test_user_data["email"],
            "username": "differentuser",
            "password": "differentpassword123"
        }
        response = client.post("/api/v1/auth/signup", json=duplicate_data)
        
        assert response.status_code == 400
        data = response.json()
        error_msg = data.get("detail") or data.get("message", "")
        assert "Email already registered" in error_msg

    def test_signup_duplicate_username(self, client: TestClient, test_user_data: dict):
        """Test signup with duplicate username fails"""
        # First signup
        client.post("/api/v1/auth/signup", json=test_user_data)
        
        # Second signup with same username
        duplicate_data = {
            "email": "different@example.com",
            "username": test_user_data["username"],
            "password": "differentpassword123"
        }
        response = client.post("/api/v1/auth/signup", json=duplicate_data)
        
        assert response.status_code == 400
        data = response.json()
        error_msg = data.get("detail") or data.get("message", "")
        assert "Username already taken" in error_msg

    def test_signup_invalid_email(self, client: TestClient):
        """Test signup with invalid email fails"""
        response = client.post("/api/v1/auth/signup", json={
            "email": "notanemail",
            "username": "testuser",
            "password": "testpassword123"
        })
        
        assert response.status_code == 422  # Validation error

    def test_signup_short_password(self, client: TestClient):
        """Test signup with short password fails"""
        response = client.post("/api/v1/auth/signup", json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "short"
        })
        
        assert response.status_code == 422  # Validation error


class TestAuthLogin:
    """Tests for POST /api/v1/auth/login"""

    def test_login_success_with_username(self, client: TestClient, test_user_data: dict):
        """Test successful login with username"""
        # Create user first
        client.post("/api/v1/auth/signup", json=test_user_data)
        
        # Login with username
        response = client.post("/api/v1/auth/login", data={
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_success_with_email(self, client: TestClient, test_user_data: dict):
        """Test successful login with email"""
        # Create user first
        client.post("/api/v1/auth/signup", json=test_user_data)
        
        # Login with email
        response = client.post("/api/v1/auth/login", data={
            "username": test_user_data["email"],
            "password": test_user_data["password"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client: TestClient, test_user_data: dict):
        """Test login with wrong password fails"""
        # Create user first
        client.post("/api/v1/auth/signup", json=test_user_data)
        
        # Login with wrong password
        response = client.post("/api/v1/auth/login", data={
            "username": test_user_data["username"],
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client: TestClient):
        """Test login with nonexistent user fails"""
        response = client.post("/api/v1/auth/login", data={
            "username": "nonexistent",
            "password": "somepassword"
        })
        
        assert response.status_code == 401


class TestAuthMe:
    """Tests for GET /api/v1/auth/me"""

    def test_me_authenticated(self, client: TestClient, test_user_data: dict):
        """Test /me returns user profile when authenticated"""
        # Create user and login
        client.post("/api/v1/auth/signup", json=test_user_data)
        login_response = client.post("/api/v1/auth/login", data={
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        })
        token = login_response.json()["access_token"]
        
        # Get profile
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == test_user_data["username"]
        assert "subscription_tier" in data

    def test_me_unauthenticated(self, client: TestClient):
        """Test /me fails without authentication"""
        response = client.get("/api/v1/auth/me")
        
        assert response.status_code == 401

    def test_me_invalid_token(self, client: TestClient):
        """Test /me fails with invalid token"""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalidtoken"}
        )
        
        assert response.status_code == 401


class TestAuthRegisterAlias:
    """Tests for POST /api/v1/auth/register (alias of signup)"""

    def test_register_success(self, client: TestClient, test_user_data: dict):
        response = client.post("/api/v1/auth/register", json=test_user_data)
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == test_user_data["email"]
        assert data["username"] == test_user_data["username"]