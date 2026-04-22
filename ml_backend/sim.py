import requests
import json

res = requests.post(
    "http://127.0.0.1:8000/analyze",
    files={"file": ("test.csv", "Symbol,Quantity,Buy_Price\nRELIANCE,10,2000\nINFY,10,1500\n", "text/csv")},
    data={"new_cash": 10000, "age": 30, "goal": "Growth"},
    headers={} # No JWT required if we disable it locally or just pass dummy? Wait, JWT is required!
)
print(res.status_code)
print(res.text)
