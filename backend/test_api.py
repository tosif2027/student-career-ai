import os
import requests

url = os.getenv("API_URL", "http://127.0.0.1:5000/api/login")
data = {
    "email": os.getenv("TEST_EMAIL", ""),
    "password": os.getenv("TEST_PASSWORD", ""),
}

if not data["email"] or not data["password"]:
    raise SystemExit("Set TEST_EMAIL and TEST_PASSWORD before running this test.")

response = requests.post(url, json=data, timeout=10)
print("Status Code:", response.status_code)
print("Response:", response.json())
