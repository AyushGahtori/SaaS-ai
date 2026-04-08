import os
from dotenv import load_dotenv
load_dotenv()
print("GEMINI_API_KEY:", repr(os.getenv("GEMINI_API_KEY")))
print("GEMINI_MODEL:", repr(os.getenv("GEMINI_MODEL")))
print("PORT:", repr(os.getenv("PORT")))
