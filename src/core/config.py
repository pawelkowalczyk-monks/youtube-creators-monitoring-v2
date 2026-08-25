import os
import sys
from dotenv import load_dotenv

# Load environment variables
# Load environment variables
load_dotenv()

class Config:
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    
    # Base paths
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    INPUTS_DIR = os.path.join(BASE_DIR, "inputs")
    OUTPUT_DIR = os.path.join(BASE_DIR, "output")

    @staticmethod
    def validate():
        """Validate that critical environment variables are set."""
        missing = []
        if not Config.GOOGLE_API_KEY:
            missing.append("GOOGLE_API_KEY")
        
        if missing:
            raise EnvironmentError(f"Missing environment variables: {', '.join(missing)}")
