import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

try:
    models = genai.list_models()
    for m in models:
        # Check if the name starts with 'models/' and matches typical patterns
        print(f"AVAILABLE_MODEL: {m.name}")
except Exception as e:
    print(f"Error: {e}")
