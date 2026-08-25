from google import genai
from google.genai import types
from src.core.config import Config
import time

class GeminiService:
    # Centralized model configuration
    MODEL_NAME = 'gemini-3-flash-preview'

    def __init__(self):
        if not Config.GOOGLE_API_KEY:
            raise ValueError("Google API Key is not set in configuration.")
        # Initialize the Gemini Client
        self.client = genai.Client(api_key=Config.GOOGLE_API_KEY)

    def upload_file(self, file_path: str):
        """
        Uploads a file to Gemini and waits for it to be processed.
        """
        try:
            print(f"Uploading file: {file_path}")
            uploaded_file = self.client.files.upload(file=file_path)
            print(f"✓ File uploaded: {uploaded_file.name}")
            
            # Wait for file to be processed
            self.wait_for_file_processing(uploaded_file.name)
            
            return uploaded_file
        except Exception as e:
            print(f"❌ Error uploading file: {e}")
            raise

    def wait_for_file_processing(self, file_name: str, timeout: int = 300):
        """
        Polls the file status until it's ACTIVE or times out.
        
        Args:
            file_name: The name of the uploaded file
            timeout: Maximum time to wait in seconds (default: 300s = 5min)
        """
        import time
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                file = self.client.files.get(name=file_name)
                
                if file.state == 'ACTIVE':
                    print(f"✓ File is ready for processing")
                    return
                elif file.state == 'FAILED':
                    raise Exception(f"File processing failed: {file.error if hasattr(file, 'error') else 'Unknown error'}")
                else:
                    # File is still PROCESSING
                    print(f"⏳ File processing... (state: {file.state})")
                    time.sleep(2)  # Poll every 2 seconds
                    
            except Exception as e:
                if 'not found' in str(e).lower():
                    raise Exception(f"File not found: {file_name}")
                raise
        
        raise TimeoutError(f"File processing timed out after {timeout} seconds")

    def _get_safety_settings(self):
        """Get standard safety settings to block nothing."""
        return [
            types.SafetySetting(
                category="HARM_CATEGORY_HATE_SPEECH",
                threshold="BLOCK_NONE",
            ),
            types.SafetySetting(
                category="HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold="BLOCK_NONE",
            ),
            types.SafetySetting(
                category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold="BLOCK_NONE",
            ),
            types.SafetySetting(
                category="HARM_CATEGORY_HARASSMENT",
                threshold="BLOCK_NONE",
            ),
        ]

    def _generate_with_retry(self, contents, config):
        """Helper to handle generation with detailed error reporting and retries."""
        
        def attempt_generation():
            return self.client.models.generate_content(
                model=self.MODEL_NAME,
                contents=contents,
                config=config
            )

        try:
            return attempt_generation()
        except Exception as e:
            error_str = str(e)
            
            # 503 - Service Unavailable / Overloaded
            if '503' in error_str or 'UNAVAILABLE' in error_str or 'overloaded' in error_str.lower():
                print(f"⚠️ Error 503: Gemini servers are overloaded")
                print(f"   Reason: {error_str[:200]}")
                print(f"   Action: Waiting 60 seconds before retry...")
                time.sleep(60)
                try:
                    print("🔄 Retrying request...")
                    return attempt_generation()
                except Exception as retry_error:
                    print(f"❌ Retry failed: {retry_error}")
                    raise retry_error
            
            # 429 - Rate Limit / Quota Exceeded
            elif '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str or 'quota' in error_str.lower():
                print(f"⚠️ Error 429: Rate limit or quota exceeded")
                print(f"   Reason: {error_str[:300]}")
                print(f"   Action: Check your API quota at https://ai.dev/usage")
                raise e
            
            # 400 - Bad Request (often file not ready)
            elif '400' in error_str or 'INVALID_ARGUMENT' in error_str:
                if 'processing' in error_str.lower() or 'not ready' in error_str.lower():
                    print(f"⚠️ Error 400: File is still processing")
                    print(f"   Reason: {error_str[:200]}")
                    print(f"   Action: Waiting 30 seconds for file to be ready...")
                    time.sleep(30)
                    try:
                        print("🔄 Retrying request...")
                        return attempt_generation()
                    except Exception as retry_error:
                        print(f"❌ Retry failed: {retry_error}")
                        raise retry_error
                else:
                    print(f"⚠️ Error 400: Bad request")
                    print(f"   Reason: {error_str[:300]}")
                    raise e
            
            # Other errors
            else:
                print(f"❌ Unexpected error: {error_str[:300]}")
                raise e

    def generate_content_structured(self, contents, json_schema: dict) -> dict:
        """
        Generates structured content using the Gemini model with JSON schema.
        """
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=json_schema,
            safety_settings=self._get_safety_settings()
        )
        
        try:
            response = self._generate_with_retry(contents, config)
            
            if not getattr(response, 'text', None):
                return {
                    "text": "{}",
                    "usage": getattr(response, 'usage_metadata', None)
                }
            
            return {
                "text": response.text,
                "usage": response.usage_metadata
            }
        except Exception as e:
            print(f"Error generating structured content: {e}")
            return {
                "text": "{}",
                "usage": None
            }

    def generate_content(self, contents) -> dict:
        """
        Generates content using the Gemini model.
        """
        config = types.GenerateContentConfig(
            safety_settings=self._get_safety_settings()
        )

        try:
            response = self._generate_with_retry(contents, config)
            
            if not getattr(response, 'text', None):
                return {
                    "text": "⚠️ Safety filters prevented analysis of this video.",
                    "usage": getattr(response, 'usage_metadata', None)
                }
            return {
                "text": response.text,
                "usage": response.usage_metadata
            }
        except Exception as e:
            error_str = str(e)
            # Check for safety filter blocks
            if 'Safety' in error_str or 'blocked' in error_str.lower():
                return {
                    "text": "⚠️ Safety filters or other reasons have prevented analysis of this video.",
                    "usage": None
                }
            
            print(f"Error generating content with Gemini: {e}")
            return {
                "text": "⚠️ Gemini servers are overloaded. Please try again later.",
                "usage": None
            }
