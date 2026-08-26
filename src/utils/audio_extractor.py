import yt_dlp
import os
from pathlib import Path
import static_ffmpeg

class AudioExtractor:
    def __init__(self, output_dir='temp_audio'):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        # Ensure ffmpeg is available in the path
        static_ffmpeg.add_paths()
    
    def extract_audio(self, video_url: str, start_time: int = 0, end_time: int = None) -> str:
        """
        Downloads YouTube video and extracts audio as MP3.
        Returns the path to the audio file.
        
        Args:
            video_url: YouTube URL
            start_time: Start time in seconds (default: 0)
            end_time: End time in seconds (default: None = full video)
        """
        # Configure yt-dlp options
        postprocessor_args = []
        if start_time > 0 or end_time is not None:
            # Use ffmpeg to trim the audio
            if end_time:
                duration = end_time - start_time
                postprocessor_args = ['-ss', str(start_time), '-t', str(duration)]
            else:
                postprocessor_args = ['-ss', str(start_time)]
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'nocheckcertificate': True,  # Bypass SSL verification errors on some networks
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '32',  # Low bitrate for speech
            }],
            'postprocessor_args': [
                '-ac', '1',      # Mono audio (1 channel)
                '-ar', '16000',  # 16kHz sample rate (standard for speech AI)
                '-b:a', '32k',   # 32kbps bitrate (clear speech at low size)
            ] + postprocessor_args,  # Append time trimming args if present
            'outtmpl': str(self.output_dir / '%(id)s.%(ext)s'),
            'quiet': True,
            'no_warnings': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'web'],
                    'skip': ['webpage', 'hls']
                }
            },
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            }
        }
        
        # Check for cookies.txt in the root directory to easily bypass YouTube's anti-bot/sign-in restrictions
        cookies_file = Path('cookies.txt')
        if cookies_file.is_file():
            print(f"🍪 [ytdlp] Loaded 'cookies.txt' from project folder to bypass anti-bot challenges.")
            ydl_opts['cookiefile'] = str(cookies_file)
        else:
            # Fallback to Chrome cookies if supported (may prompt for Keychain access on macOS)
            print(f"⚠️ [ytdlp] 'cookies.txt' not found in project folder. If you experience bot errors, please export your YouTube cookies as a cookies.txt file and place it in the project root.")
        
        # Check for optional proxy configuration from Streamlit session state or environment variable to bypass IP blacklist
        import sys
        if 'streamlit' in sys.modules:
            import streamlit as st
            proxy_url = st.session_state.get('yt_proxy_url', '')
            if proxy_url:
                print(f"📡 [ytdlp] Routing download through custom proxy: {proxy_url}")
                ydl_opts['proxy'] = proxy_url
                
        try:
            print(f"🎬 [ytdlp] Downloading YouTube video source: {video_url}")
            if start_time > 0 or end_time is not None:
                print(f"✂️ [ffmpeg] Clipping audio interval: {start_time}s to {end_time if end_time else 'end'}s")
            else:
                print(f"🎵 [ffmpeg] Extracting full-length audio track...")
                
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_id = info['id']
                audio_path = self.output_dir / f"{video_id}.mp3"
                print(f"✅ [ytdlp] Extraction complete! Saved audio segment to: {audio_path} ({os.path.getsize(audio_path) // 1024} KB)")
                return str(audio_path)
        except Exception as e:
            print(f"❌ Error extracting audio for {video_url}: {e}")
            return None
    
    def cleanup(self, audio_path: str):
        """Delete the temporary audio file."""
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except Exception as e:
                print(f"Error cleaning up audio file: {e}")
