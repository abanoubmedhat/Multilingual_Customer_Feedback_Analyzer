# list_models.py

import google.generativeai as genai
import os
from dotenv import load_dotenv

# --- SETUP ---
# Load the .env file to get the API key
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("Error: GOOGLE_API_KEY not found in your .env file.")
else:
    try:
        # Configure the genai library with your key
        genai.configure(api_key=api_key)

        print("Fetching available models from the Google AI API...")
        print("--------------------------------------------------")

        # --- LIST MODELS ---
        # Iterate through the available models and print their details
        for m in genai.list_models():
            # We only care about models that support the 'generateContent' method
            if 'generateContent' in m.supported_generation_methods:
                print(f"Model Name: {m.name}")
                # The line below is also useful for seeing the human-friendly name
                # print(f"  > Display Name: {m.display_name}")
                # print("-" * 20)

        print("--------------------------------------------------")
        print("\nACTION: Copy one of the 'Model Name' values from the list above (e.g., 'models/gemini-pro')")
        print("and paste it into your main.py file as the model name.")

    except Exception as e:
        print(f"\nAn error occurred while trying to list the models: {e}")
        print("This could be due to an invalid API key, network problems, or permission issues in your Google Cloud project.")