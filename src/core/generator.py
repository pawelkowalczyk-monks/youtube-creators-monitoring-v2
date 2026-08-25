from src.services.gemini import GeminiService
from src.prompts import NEWSLETTER_DATA_PROMPT
from src.utils.templates import TemplateFiller
import json
import re

class NewsletterAgent:
    def __init__(self):
        """
        Initialize the newsletter agent.
        Uses the template-based approach for consistent HTML generation.
        """
        self.gemini_service = GeminiService()
        self.template_filler = TemplateFiller()
    
    def generate_html(self, analysis_output: str) -> str:
        """
        Generate HTML newsletter or community management content.
        
        Args:
            analysis_output (str): The raw analysis from the AnalyzerAgent.
            
        Returns:
            str: Complete HTML content
        """
        # Check if this is the new G.E.O. community management structure
        try:
            import json
            data = json.loads(analysis_output)
            if isinstance(data, dict) and data.get("is_community_management"):
                print("✨ Filling HTML template for G.E.O. Community Management Action Plan...")
                html_content = self.template_filler.fill_community_management(data)
                return html_content
        except Exception:
            # Not a G.E.O. JSON structure, proceed with standard newsletter format
            pass

        print("Generating structured data for newsletter template...")
        # Use replace() instead of format() to avoid issues with curly braces in analysis_output
        prompt = NEWSLETTER_DATA_PROMPT.replace("{analysis_output}", analysis_output)
        
        response = self.gemini_service.generate_content(prompt)
        json_content = response.get("text", "")
        
        # Print token usage
        self._print_usage("Newsletter Data Generation", response.get("usage"))
        
        # Clean up potential markdown formatting
        json_content = self._clean_json_response(json_content)
        
        # Parse JSON
        try:
            data = json.loads(json_content)
        except json.JSONDecodeError as e:
            print(f"❌ Error: Failed to parse JSON response: {e}")
            print(f"Raw response: {json_content[:500]}...")
            raise ValueError("Failed to generate newsletter - invalid JSON response from Gemini")
        
        # Fill template
        print(f"Filling HTML template with structured data (Highlights: {len(data.get('highlights', []))}, Opportunities: {len(data.get('engagement_opportunities', []))})...")
        html_content = self.template_filler.fill_template(data)
        
        return html_content
    
    def _clean_json_response(self, json_str: str) -> str:
        """
        Clean up JSON response by removing markdown code blocks and extra text.
        
        Args:
            json_str: Raw response from Gemini
            
        Returns:
            Cleaned JSON string
        """
        # Remove markdown code blocks
        json_str = re.sub(r'^```json\s*', '', json_str, flags=re.MULTILINE)
        json_str = re.sub(r'^```\s*', '', json_str, flags=re.MULTILINE)
        json_str = json_str.strip()
        
        # Try to find JSON object boundaries
        start = json_str.find('{')
        end = json_str.rfind('}')
        
        if start != -1 and end != -1:
            json_str = json_str[start:end+1]
        
        return json_str
    
    def _print_usage(self, step_name: str, usage):
        """Prints token usage statistics."""
        if usage:
            # Handle both object and dict access for usage metadata
            input_tokens = getattr(usage, 'prompt_token_count', usage.get('prompt_token_count', 0) if isinstance(usage, dict) else 0)
            output_tokens = getattr(usage, 'candidates_token_count', usage.get('candidates_token_count', 0) if isinstance(usage, dict) else 0)
            total_tokens = getattr(usage, 'total_token_count', usage.get('total_token_count', 0) if isinstance(usage, dict) else 0)
            print(f"  [Token Usage - {step_name}] Input: {input_tokens}, Output: {output_tokens}, Total: {total_tokens}")

