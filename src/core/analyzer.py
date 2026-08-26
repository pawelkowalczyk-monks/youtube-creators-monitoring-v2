from src.services.gemini import GeminiService
from src.utils.file_manager import FileManager
from src.utils.audio_extractor import AudioExtractor
from src.prompts import ANALYSIS_PROMPT, YOUTUBE_ANALYSIS_PROMPT, YOUTUBE_AUDIO_ANALYSIS_PROMPT, GEO_YOUTUBE_PROMPT
import re
from google import genai
from google.genai import types
import os
import time

GEO_SCHEMA = {
  "type": "OBJECT",
  "properties": {
    "mention_id": {"type": "STRING", "description": "Unique identifier, e.g. the video ID"},
    "analyse_opportunite": {
      "type": "OBJECT",
      "properties": {
        "domaine_recommande": {
          "type": "STRING",
          "enum": ["Pixel", "Search", "Gemini", "Brand", "Éducation"]
        },
        "review_humaine": {"type": "BOOLEAN"},
        "analyse_de_la_mention": {
          "type": "OBJECT",
          "properties": {
            "sujet_reel": {"type": "STRING", "description": "De quoi parle vraiment l'utilisateur ?"},
            "emotion_detectee": {"type": "STRING", "description": "Quelle émotion est détectée ?"},
            "point_d_accroche": {"type": "STRING", "description": "Quel détail spécifique pour rebondir ?"}
          },
          "required": ["sujet_reel", "emotion_detectee", "point_d_accroche"]
        }
      },
      "required": ["domaine_recommande", "review_humaine", "analyse_de_la_mention"]
    },
    "action_recommandee": {
      "type": "STRING",
      "enum": ["Like Only", "Respond", "Review", "null"]
    },
    "persona_appliquee": {
      "type": "STRING",
      "enum": ["Pixel", "Search", "Gemini", "Brand", "Éducation"]
    },
    "propositions_de_reponse": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "niveau_de_risk": {"type": "STRING", "description": "Malin/Taquin/Audacieux ou pour Éducation: Clair/Incitatif/Expert"},
          "texte_reponse": {"type": "STRING", "description": "La réponse suggérée en français, STRICTEMENT maximum 100 caractères, emojis inclus!"},
          "justification_mot_a_mot": {"type": "STRING", "description": "Justification ultra-courte du choix des mots."}
        },
        "required": ["niveau_de_risk", "texte_reponse", "justification_mot_a_mot"]
      }
    }
  },
  "required": ["mention_id", "analyse_opportunite", "action_recommandee", "persona_appliquee", "propositions_de_reponse"]
}

class AnalyzerAgent:
    def __init__(self, log_callback=None, enable_rich_progress=True):
        self.gemini_service = GeminiService()
        self.audio_extractor = AudioExtractor()
        self.log_callback = log_callback
        self.enable_rich_progress = enable_rich_progress
        
        # Rate limiting: track API calls
        self.api_call_times = []  # List of timestamps
        self.max_calls_per_window = 4  # Max 4 calls
        self.window_seconds = 300  # Per 5 minutes (300 seconds)

    def _log(self, message: str):
        """Logs a message to the callback if available, otherwise prints it."""
        if self.log_callback:
            self.log_callback(message)
        else:
            print(message)

    def analyze_mentions(self, parsed_data: dict, analyze_videos: bool = True, selected_videos: list = None, audio_only: bool = False, time_ranges: dict = None) -> str:
        """
        Analyzes the mentions in the given file using Gemini.
        
        Args:
            parsed_data (dict): The parsed data containing mentions and videos.
            analyze_videos (bool): Whether to analyze YouTube videos found in the file.
            selected_videos (list): Optional list of specific video URLs to analyze (subset of found ones).
            audio_only (bool): Whether to analyze only audio (saves tokens).
            time_ranges (dict): Dict mapping video URLs to (start, end) tuples in seconds.
            
        Returns:
            str: The analysis result from Gemini.
        """
        if not parsed_data:
            return "Error: No parsed data provided."

        # If this is the G.E.O. community management list
        if parsed_data.get("is_creator_list"):
            print("🚀 Executing Proactive Community Management G.E.O. Pipeline...")
            import datetime
            import json
            
            geo_results = {
                "is_community_management": True,
                "date": datetime.datetime.now().strftime("%d %B %Y"),
                "videos": []
            }
            
            if selected_videos:
                import time
                for i, link in enumerate(selected_videos, 1):
                    if i > 1:
                        print("  - ⏳ Pausing for 10 seconds to avoid model overload...")
                        time.sleep(10)
                        
                    # Find creator name
                    creator_name = "Unknown Creator"
                    if "video_to_creator" in parsed_data and link in parsed_data["video_to_creator"]:
                        creator_name = parsed_data["video_to_creator"][link]
                    else:
                        # Try to find in the creators list
                        for c in parsed_data.get("creators", []):
                            if c.get("url") == link or link == c.get("video_url"):
                                creator_name = c["name"]
                                break
                    
                    time_range = time_ranges.get(link, None) if time_ranges else None
                    print(f"  - ▶️ Processing video {i}/{len(selected_videos)}: {link}")
                    
                    geo_analysis = self._analyze_youtube_video_geo(link, audio_only, time_range, creator_name)
                    if geo_analysis:
                        geo_results["videos"].append({
                            "creator_name": creator_name,
                            "video_link": link,
                            "geo_analysis": geo_analysis
                        })
            
            # Return serialized JSON string of G.E.O. results
            return json.dumps(geo_results, ensure_ascii=False)

        mentions_data = parsed_data.get("mentions_data", [])
        youtube_videos = parsed_data.get("youtube_videos", [])
        # Extract just the URLs from the video metadata
        found_youtube_urls = [v["url"] for v in youtube_videos]
        
        # --- Step 1: Text Analysis ---
        print("📝 Starting Step 1: Text Analysis of Mentions...")
        text_analysis = ""
        if mentions_data:
            # Format data for the prompt
            formatted_data = []
            for item in mentions_data:
                text = item.get("text", "").replace("\n", " ").strip()
                url = item.get("url", "")
                if text:
                    formatted_data.append(f"Text: {text} | URL: {url}")
            
            data_str = "\n".join(formatted_data)
            
            final_prompt = ANALYSIS_PROMPT.format(data=data_str)
            print("  - 🚀 Sending text data to Gemini...")
            response = self.gemini_service.generate_content(final_prompt)
            text_analysis = response.get("text", "")
            self._print_usage("Text Analysis", response.get("usage"))
        else:
            print("  - ⚠️ No text found in 'Full Text' column.")
            text_analysis = "No text mentions found to analyze."

        # --- Step 2: YouTube Analysis ---
        youtube_analysis = ""
        videos_to_analyze = []
        
        if analyze_videos:
            if found_youtube_urls:
                # If user provided specific selection, filter the found ones (or just use selection)
                if selected_videos:
                    videos_to_analyze = [url for url in selected_videos if url in found_youtube_urls]
                    if not videos_to_analyze:
                        print("  - ⚠️ Warning: Selected videos not found in the filtered file list. Using selection anyway.")
                        videos_to_analyze = selected_videos
                else:
                    videos_to_analyze = found_youtube_urls
                
                print(f"🎥 Starting Step 2: YouTube Analysis ({len(videos_to_analyze)} videos)...")
                
                import time
                
                for i, link in enumerate(videos_to_analyze, 1):
                    if i > 1:
                        print("  - ⏳ Pausing for 50 seconds to avoid model overload...")
                        time.sleep(50)
                        
                    print(f"  - ▶️ Processing video {i}/{len(videos_to_analyze)}: {link}")
                    
                    # Find creator name from youtube_videos data
                    creator_name = "Unknown Creator"
                    for video in youtube_videos:
                        if video.get("url") == link:
                            creator_name = video.get("author", "Unknown Creator")
                            break
                    
                    # Determine time range (default to full video if not specified)
                    time_range = time_ranges.get(link, None)
                    
                    analysis_output = self._analyze_youtube_video(link, audio_only, time_range, creator_name)
                    youtube_analysis += f"Creator: {creator_name}\nVideo URL: {link}\n{analysis_output}\n\n"
            else:
                print("  - ⚠️ No YouTube videos found matching the criteria (Page Type='youtube', Thread Entry Type='post').")
        
        # --- Combine Results ---
        result = f"=== TEXT ANALYSIS ===\n{text_analysis}\n"
        
        if youtube_analysis:
            result += f"\n=== VIDEO ANALYSIS ===\n{youtube_analysis}"
        
        return result

    def _print_usage(self, step_name: str, usage):
        """Prints token usage statistics."""
        if usage:
            # Handle both object and dict access for usage metadata
            input_tokens = getattr(usage, 'prompt_token_count', usage.get('prompt_token_count', 0) if isinstance(usage, dict) else 0)
            output_tokens = getattr(usage, 'candidates_token_count', usage.get('candidates_token_count', 0) if isinstance(usage, dict) else 0)
            total_tokens = getattr(usage, 'total_token_count', usage.get('total_token_count', 0) if isinstance(usage, dict) else 0)
            print(f"  [Token Usage - {step_name}] Input: {input_tokens}, Output: {output_tokens}, Total: {total_tokens}")

    def _check_rate_limit(self):
        """Check if we're approaching rate limits and pause if needed."""
        current_time = time.time()
        
        # Remove old entries outside the time window
        self.api_call_times = [t for t in self.api_call_times if current_time - t < self.window_seconds]
        
        # Check if we've hit the limit
        if len(self.api_call_times) >= self.max_calls_per_window:
            # Calculate how long to wait
            oldest_call = self.api_call_times[0]
            wait_time = self.window_seconds - (current_time - oldest_call)
            
            if wait_time > 0:
                print(f"⏳ Rate limit: Pausing for {int(wait_time)} seconds to avoid API overload...")
                time.sleep(wait_time)
                # Clean up after waiting
                current_time = time.time()
                self.api_call_times = [t for t in self.api_call_times if current_time - t < self.window_seconds]
        
        # Record this API call
        self.api_call_times.append(current_time)


    def _analyze_youtube_video(self, video_url: str, audio_only: bool = False, time_range: tuple = None, creator_name: str = "the creator") -> str:
        """
        Analyzes a single YouTube video using Gemini.
        
        Args:
            video_url: YouTube URL
            audio_only: If True, extract and analyze audio only
            time_range: Tuple of (start_seconds, end_seconds) or None for full video
        """
        try:
            if audio_only:
                if self.enable_rich_progress:
                    from rich.progress import Progress, SpinnerColumn, TextColumn
                    
                    with Progress(
                        SpinnerColumn(),
                        TextColumn("[progress.description]{task.description}"),
                        transient=True
                    ) as progress:
                        # Extraction Task
                        task_extract = progress.add_task(f"[cyan]🎵 Extracting audio...", total=None)
                        if time_range:
                            start_time, end_time = time_range
                        else:
                            start_time, end_time = 0, None
                        
                        audio_path = self.audio_extractor.extract_audio(video_url, start_time, end_time)
                        progress.update(task_extract, completed=100)

                        # Verify file
                        if not audio_path or not os.path.isfile(audio_path) or os.path.getsize(audio_path) == 0:
                            print(f"    - ⚠️ Extracted audio file is missing or empty for {video_url}. Skipping analysis.")
                            return f"[Error extracting audio from {video_url}]"
                        
                        print(f"    - ✅ Audio extracted to {audio_path} (size: {os.path.getsize(audio_path)} bytes)")

                        # Check rate limit before API call
                        self._check_rate_limit()

                        # Upload Task
                        task_upload = progress.add_task(f"[green]☁️ Uploading to Gemini...", total=None)
                        uploaded_file = self.gemini_service.upload_file(audio_path)
                        progress.update(task_upload, completed=100)
                else:
                    # TUI Mode / No Rich Progress
                    if time_range:
                        start_time, end_time = time_range
                    else:
                        start_time, end_time = 0, None
                    
                    self._log(f"    -> 🎵 Extracting audio...")
                    audio_path = self.audio_extractor.extract_audio(video_url, start_time, end_time)
                    
                    if not audio_path or not os.path.isfile(audio_path) or os.path.getsize(audio_path) == 0:
                        self._log(f"    - ⚠️ Extracted audio file is missing or empty for {video_url}.")
                        return f"[Error extracting audio from {video_url}]"
                    
                    self._log(f"    - ✅ Audio extracted (size: {os.path.getsize(audio_path)} bytes)")
                    
                    # Check rate limit before API call
                    self._check_rate_limit()
                    
                    self._log(f"    - → ☁️ Uploading audio to Gemini...")
                    uploaded_file = self.gemini_service.upload_file(audio_path)
                
                contents = [
                    f"Creator Name: {creator_name}\n\n{YOUTUBE_AUDIO_ANALYSIS_PROMPT}",
                    uploaded_file
                ]
                
                # Generate content with built-in retry in gemini_service
                print(f"    - 🤖 Analyzing audio with Gemini...")
                response = self.gemini_service.generate_content(contents)
                text = response.get("text", "")
                
                # Check if we got an error message back
                if "⚠️" in text or "overloaded" in text.lower():
                    print(f"    - ⚠️ Analysis could not be completed: {text}")
                elif not text:
                    print("    - ❌ No response received from Gemini.")
                    text = "⚠️ Analysis failed - no response from Gemini."
                
                self._print_usage(f"Audio Analysis ({video_url[:20]}...)", response.get("usage"))
                result = text
                
                # Cleanup commented out to verify audio files
                # self.audio_extractor.cleanup(audio_path)
                return result
            else:
                # Video analysis with time range
                if time_range:
                    start_time, end_time = time_range
                    print(f"    -> Sending video to Gemini ({start_time}s-{end_time}s)...")
                    video_metadata = types.VideoMetadata(
                        start_offset=f'{start_time}s',
                        end_offset=f'{end_time}s'
                    )
                else:
                    print(f"    -> Sending video to Gemini (Full Video)...")
                    video_metadata = None

                content = types.Content(
                    parts=[
                        types.Part(
                            file_data=types.FileData(file_uri=video_url),
                            video_metadata=video_metadata
                        ),
                        types.Part(text=f"Creator Name: {creator_name}\n\n{YOUTUBE_ANALYSIS_PROMPT}")
                    ]
                )
                response = self.gemini_service.generate_content(content)
                self._print_usage(f"Video Analysis ({video_url[:20]}...)", response.get("usage"))
                return response.get("text", "")
        except Exception as e:
            print(f"    -> Error analyzing {video_url}: {e}")
            return f"[Error analyzing YouTube video {video_url}: {e}]"

    def _analyze_youtube_video_geo(self, video_url: str, audio_only: bool = True, time_range: tuple = None, creator_name: str = "the creator") -> dict:
        """
        Analyzes a single YouTube video using Gemini and returns structured GEO JSON.
        """
        try:
            if time_range:
                start_time, end_time = time_range
            else:
                start_time, end_time = 0, None
                
            if self.enable_rich_progress:
                from rich.progress import Progress, SpinnerColumn, TextColumn
                with Progress(
                    SpinnerColumn(),
                    TextColumn("[progress.description]{task.description}"),
                    transient=True
                ) as progress:
                    task_extract = progress.add_task(f"[cyan]🎵 Extraction de l'audio pour {creator_name}...", total=None)
                    audio_path = self.audio_extractor.extract_audio(video_url, start_time, end_time)
                    progress.update(task_extract, completed=100)
                    
                    if not audio_path or not os.path.isfile(audio_path) or os.path.getsize(audio_path) == 0:
                        print(f"    - ⚠️ Fichier audio manquant ou vide pour {video_url}.")
                        return None
                        
                    self._check_rate_limit()
                    task_upload = progress.add_task(f"[green]☁️ Chargement sur Gemini...", total=None)
                    uploaded_file = self.gemini_service.upload_file(audio_path)
                    progress.update(task_upload, completed=100)
            else:
                print(f"    -> 🎵 Extraction de l'audio pour {creator_name}...")
                audio_path = self.audio_extractor.extract_audio(video_url, start_time, end_time)
                if not audio_path or not os.path.isfile(audio_path) or os.path.getsize(audio_path) == 0:
                    print(f"    - ⚠️ Fichier audio manquant ou vide.")
                    return None
                    
                self._check_rate_limit()
                print(f"    - → ☁️ Chargement de l'audio sur Gemini...")
                uploaded_file = self.gemini_service.upload_file(audio_path)
                
            contents = [
                f"Creator Name: {creator_name}\nVideo URL: {video_url}\n\n{GEO_YOUTUBE_PROMPT}",
                uploaded_file
            ]
            
            print(f"    - 🤖 Analyse G.E.O. structurée en cours...")
            response = self.gemini_service.generate_content_structured(contents, json_schema=GEO_SCHEMA)
            text = response.get("text", "{}")
            
            self._print_usage(f"G.E.O. Analysis ({creator_name})", response.get("usage"))
            
            # Cleanup commented out to verify audio files
            # self.audio_extractor.cleanup(audio_path)
            
            import json
            try:
                result_json = json.loads(text)
                return result_json
            except Exception as parse_err:
                print(f"❌ Erreur lors de la lecture du JSON G.E.O. : {parse_err}")
                print(f"Brut : {text}")
                return None
        except Exception as e:
            print(f"❌ Erreur lors de l'analyse G.E.O. de {video_url} : {e}")
            return None