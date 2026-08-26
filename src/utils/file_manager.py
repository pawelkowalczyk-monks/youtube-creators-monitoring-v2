import os
from src.core.config import Config

class FileManager:
    @staticmethod
    def list_input_files():
        """Lists all files in the inputs directory."""
        if not os.path.exists(Config.INPUTS_DIR):
            os.makedirs(Config.INPUTS_DIR)
            return []
        
        files = [f for f in os.listdir(Config.INPUTS_DIR) if os.path.isfile(os.path.join(Config.INPUTS_DIR, f))]
        # Filter for likely data files
        return [f for f in files if f.endswith(('.csv', '.xlsx', '.xls'))]

    @staticmethod
    def select_file():
        """Interactively allows the user to select a file from the inputs directory."""
        files = FileManager.list_input_files()
        
        if not files:
            print(f"No data files found in {Config.INPUTS_DIR}. Please add a .csv or .xlsx file.")
            return None
        
        print("\nAvailable files:")
        for idx, f in enumerate(files):
            print(f"{idx + 1}. {f}")
            
        while True:
            try:
                selection = input("\nSelect a file number (or 'q' to quit): ")
                if selection.lower() == 'q':
                    return None
                
                idx = int(selection) - 1
                if 0 <= idx < len(files):
                    return os.path.join(Config.INPUTS_DIR, files[idx])
                else:
                    print("Invalid selection. Please try again.")
            except ValueError:
                print("Please enter a valid number.")

    @staticmethod
    def parse_file_data(file_path):
        """
        Parses the file to extract mentions text and YouTube URLs based on specific rules.
        
        Returns:
            dict: {
                "mentions_text": str, # Combined text from "Full Text" column
                "youtube_urls": list  # List of URLs from filtered rows
            }
        """
        import pandas as pd
        
        # Check if this is the new Gemini Partner/Creator List file
        try:
            if file_path.endswith(('.xlsx', '.xls')):
                # Using calamine as it's safe for styled excel files
                xls = pd.ExcelFile(file_path, engine='calamine')
                if 'Gemini Endorsers' in xls.sheet_names or 'Gemini Partners' in xls.sheet_names:
                    print("✨ Detected Google SoMe FR Gemini Partner/Creator List spreadsheet format!")
                    creators = []
                    
                    if 'Gemini Endorsers' in xls.sheet_names:
                        df_endorsers = pd.read_excel(file_path, sheet_name='Gemini Endorsers', header=3, engine='calamine')
                        # Clean columns
                        df_endorsers.columns = [str(c).strip() for c in df_endorsers.columns]
                        for _, row in df_endorsers.iterrows():
                            name = row.get('Gemini endorsers') or row.get('Gemini Endorser')
                            yt_url = row.get('YouTube URL')
                            vertical = row.get('Vertical', 'Unknown')
                            if pd.notna(name) and pd.notna(yt_url):
                                creators.append({
                                    "name": str(name).strip(),
                                    "url": str(yt_url).strip(),
                                    "vertical": str(vertical).strip(),
                                    "type": "Endorser"
                                })
                                
                    if 'Gemini Partners' in xls.sheet_names:
                        df_partners = pd.read_excel(file_path, sheet_name='Gemini Partners', header=3, engine='calamine')
                        df_partners.columns = [str(c).strip() for c in df_partners.columns]
                        for _, row in df_partners.iterrows():
                            name = row.get('Name')
                            yt_url = row.get('YouTube Account')
                            niche = row.get('Niche', 'Unknown')
                            if pd.notna(name) and pd.notna(yt_url):
                                creators.append({
                                    "name": str(name).strip(),
                                    "url": str(yt_url).strip(),
                                    "vertical": str(niche).strip(),
                                    "type": "Partner"
                                })
                                
                    return {
                        "is_creator_list": True,
                        "creators": creators,
                        "mentions_data": [],
                        "youtube_videos": []
                    }
        except Exception as e:
            print(f"Warning: Failed to parse as Creator List, falling back to standard parsing. Error: {e}")

        try:
            # 1. Load file without header to find the structure
            df_raw = None
            
            if file_path.endswith('.csv'):
                # Use calamine for CSV too - it's more robust
                try:
                    df_raw = pd.read_csv(file_path, header=None, engine='python')
                    print("Successfully read CSV file")
                except Exception as e:
                    print(f"Warning: Standard CSV read failed: {str(e)[:80]}")
                    # Try with different encoding
                    try:
                        df_raw = pd.read_csv(file_path, header=None, engine='python', encoding='latin-1')
                        print("Successfully read CSV file with latin-1 encoding")
                    except Exception as e2:
                        print(f"Error: Could not read CSV file: {str(e2)[:80]}")
                        return None
            elif file_path.endswith(('.xlsx', '.xls')):
                # Use calamine engine which is faster and doesn't parse styles
                # This avoids corruption issues with styled Excel files
                try:
                    # Try calamine first (best for .xlsx without style issues)
                    df_raw = pd.read_excel(file_path, header=None, engine='calamine')
                    print("Successfully read Excel file using calamine engine")
                except Exception as e1:
                    print(f"Warning: calamine engine failed, trying openpyxl...")
                    try:
                        # Fallback to openpyxl
                        df_raw = pd.read_excel(file_path, header=None, engine='openpyxl')
                    except Exception as e2:
                        print(f"Error: Could not read Excel file with any method.")
                        print(f"  - calamine error: {str(e1)[:80]}")
                        print(f"  - openpyxl error: {str(e2)[:80]}")
                        print(f"\nPlease try:")
                        print(f"  1. Re-saving the file in Excel")
                        print(f"  2. Exporting as CSV instead")
                        print(f"  3. Using a different Excel file")
                        return None
            else:
                print(f"Error: Unsupported file format. Please use .csv, .xlsx, or .xls files.")
                return None

            if df_raw is None:
                print("Error: Failed to load file.")
                return None

            # Check if file is empty
            if df_raw.empty or len(df_raw.columns) == 0:
                print("Error: File appears to be empty.")
                return None

            # 2. Find the header row
            # Look for the cell which just has "1" as its value in the first column (index 0)
            # The header row is the row above this row.
            
            header_row_idx = -1
            
            # Iterate through the first column
            for idx, value in df_raw[0].items():
                # Check if value is exactly "1" or integer 1
                # Convert to string and strip to be safe, handle potential float 1.0
                val_str = str(value).strip()
                if val_str == "1" or val_str == "1.0":
                    header_row_idx = idx - 1
                    print(f"Found anchor row with '1' at row {idx}. Using row {header_row_idx} as header.")
                    break
            
            if header_row_idx < 0:
                print("Warning: Could not find the anchor row with value '1' in column A. Defaulting to first row as header.")
                header_row_idx = 0
            
            # Ensure header_row_idx is valid
            if header_row_idx < 0:
                print("Error: Invalid header row index. Using row 0.")
                header_row_idx = 0

            # 3. Reload with correct header
            # Reuse df_raw that we already loaded to avoid re-reading the file
            if df_raw is not None and not df_raw.empty:
                # Set the header manually from df_raw
                if header_row_idx < len(df_raw):
                    df = df_raw.copy()
                    df.columns = df.iloc[header_row_idx]
                    df = df.iloc[header_row_idx + 1:].reset_index(drop=True)
                else:
                    print(f"Warning: Header row index {header_row_idx} is out of range. Using row 0.")
                    df = df_raw.copy()
                    df.columns = df.iloc[0]
                    df = df.iloc[1:].reset_index(drop=True)
            else:
                print(f"Error: Could not reload file - no data available.")
                return None

            # 4. Extract Mentions ("Full Text" with fallback to "Title") with URLs
            mentions_data = []  # List of {text, url} dicts
            mentions_column = None
            
            if "Full Text" in df.columns:
                mentions_column = "Full Text"
                print("Using 'Full Text' column for mentions")
            elif "Title" in df.columns:
                mentions_column = "Title"
                print("'Full Text' column not found, using 'Title' column as fallback")
            else:
                print("Warning: Neither 'Full Text' nor 'Title' column found.")
            
            if mentions_column and "Url" in df.columns:
                # Extract mentions with their URLs
                truncated_count = 0
                for idx, row in df.iterrows():
                    mention_text = row.get(mentions_column)
                    mention_url = row.get("Url")
                    
                    # Skip if mention text is null/empty
                    if pd.isna(mention_text) or not str(mention_text).strip():
                        continue
                    
                    mention_text = str(mention_text)
                    
                    # Truncate to 500 characters to manage tokens
                    if len(mention_text) > 500:
                        mention_text = mention_text[:500]
                        truncated_count += 1
                    
                    # Get URL (may be null)
                    url = str(mention_url).strip() if pd.notna(mention_url) else ""
                    
                    # Get Reach
                    reach = row.get("Estimated Reach", 0)
                    try:
                        reach_val = int(float(reach)) if pd.notna(reach) else 0
                    except (ValueError, TypeError):
                        reach_val = 0

                    mentions_data.append({
                        "text": mention_text,
                        "url": url,
                        "reach": reach_val
                    })
                
                print(f"Extracted {len(mentions_data)} mentions from '{mentions_column}' column")
                if truncated_count > 0:
                    print(f"  (Truncated {truncated_count} mentions to 500 characters for token management)")
            elif mentions_column:
                # Fallback: just extract text without URLs
                print("Warning: 'Url' column not found, extracting mentions without URLs")
                mentions = df[mentions_column].dropna().astype(str).tolist()
                truncated_count = 0
                for mention in mentions:
                    if len(mention) > 500:
                        mention = mention[:500]
                        truncated_count += 1
                    mentions_data.append({
                        "text": mention,
                        "url": ""
                    })
                print(f"Extracted {len(mentions_data)} mentions from '{mentions_column}' column")
                if truncated_count > 0:
                    print(f"  (Truncated {truncated_count} mentions to 500 characters for token management)")

            # 5. Extract YouTube URLs with metadata
            # Filter: "Page Type" == "youtube" AND "Thread Entry Type" == "post"
            youtube_videos = []
            if "Page Type" in df.columns and "Thread Entry Type" in df.columns and "Url" in df.columns:
                # Normalize string columns for comparison
                # Use .copy() to avoid SettingWithCopyWarning if it happens
                df_clean = df.copy()
                df_clean["Page Type"] = df_clean["Page Type"].astype(str).str.lower().str.strip()
                df_clean["Thread Entry Type"] = df_clean["Thread Entry Type"].astype(str).str.lower().str.strip()
                
                filtered_df = df_clean[
                    (df_clean["Page Type"] == "youtube") & 
                    (df_clean["Thread Entry Type"] == "post")
                ]
                
                # Extract URLs with metadata
                for idx, row in filtered_df.iterrows():
                    url = row.get("Url", "").strip() if pd.notna(row.get("Url")) else ""
                    if not url:
                        continue
                    
                    # Extract metadata
                    author = row.get("Author", "Unknown") if pd.notna(row.get("Author")) else "Unknown"
                    reach = row.get("Estimated Reach", 0)
                    views = row.get("Youtube Views", 0)
                    
                    # Convert to int safely
                    try:
                        views_int = int(float(views)) if pd.notna(views) else 0
                    except (ValueError, TypeError):
                        views_int = 0
                    
                    youtube_videos.append({
                        "url": url,
                        "author": str(author),
                        "reach": int(reach) if pd.notna(reach) else 0,
                        "views": views_int
                    })
            else:
                print("Warning: Required columns for YouTube filtering ('Page Type', 'Thread Entry Type', 'Url') not found.")

            return {
                "mentions_data": mentions_data,
                "youtube_videos": youtube_videos
            }

        except Exception as e:
            print(f"Error parsing file: {e}")
            return None

    @staticmethod
    def read_file_content(file_path):
        """
        Legacy wrapper. Returns the raw string representation of the parsed data 
        to maintain some backward compatibility if needed, though agents should prefer parse_file_data.
        """
        data = FileManager.parse_file_data(file_path)
        if data:
            return f"Mentions Text Length: {len(data['mentions_text'])}\nYouTube URLs Found: {len(data['youtube_urls'])}"
        return None

    @staticmethod
    def get_latest_video(channel_url):
        """
        Fetches the latest long-form video details from a YouTube channel URL using yt-dlp.
        """
        import yt_dlp
        url = channel_url.rstrip('/')
        if not url.endswith('/videos'):
            url += '/videos'
        
        ydl_opts = {
            'playlist_items': '1',
            'extract_flat': True,
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
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if 'entries' in info and len(info['entries']) > 0:
                    entry = info['entries'][0]
                    return {
                        'url': entry.get('url'),
                        'title': entry.get('title'),
                        'id': entry.get('id')
                    }
        except Exception as e:
            print(f"Error fetching latest video for {channel_url}: {e}")
        return None

    @staticmethod
    def get_videos_last_week(channel_url):
        """
        Fetches all long-form videos uploaded by a YouTube channel in the last 7 days.
        """
        import yt_dlp
        import datetime
        url = channel_url.rstrip('/')
        if not url.endswith('/videos'):
            url += '/videos'
        
        ydl_opts = {
            'playlist_items': '10',
            'extract_flat': True,
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
        
        matching_videos = []
        today = datetime.date.today()
        one_week_ago = today - datetime.timedelta(days=7)
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if 'entries' in info:
                    for entry in info['entries']:
                        upload_date_str = entry.get('upload_date')
                        video_url = entry.get('url') or f"https://www.youtube.com/watch?v={entry.get('id')}"
                        
                        if not upload_date_str:
                            try:
                                single_opts = {
                                    'quiet': True,
                                    'no_warnings': True,
                                    'extract_flat': True,
                                }
                                with yt_dlp.YoutubeDL(single_opts) as s_ydl:
                                    s_info = s_ydl.extract_info(video_url, download=False)
                                    upload_date_str = s_info.get('upload_date')
                            except Exception:
                                pass
                                
                        if upload_date_str:
                            try:
                                upload_date = datetime.datetime.strptime(upload_date_str, "%Y%m%d").date()
                                if one_week_ago <= upload_date <= today:
                                    matching_videos.append({
                                        'url': video_url,
                                        'title': entry.get('title'),
                                        'id': entry.get('id'),
                                        'upload_date': upload_date.strftime("%Y-%m-%d")
                                    })
                            except ValueError:
                                pass
        except Exception as e:
            print(f"Error fetching last week videos for {channel_url}: {e}")
        return matching_videos

    @staticmethod
    def get_channel_videos_for_timeframe(channel_url, timeframe="Last Week"):
        """
        Fetches channel videos based on selected timeframe: 'Last Week', 'Last Month', or 'Last Video'.
        """
        import yt_dlp
        import datetime
        url = channel_url.rstrip('/')
        if not url.endswith('/videos'):
            url += '/videos'
            
        # If last video, we only need 1 item, otherwise up to 30 to scan for date thresholds
        playlist_items_limit = '1' if timeframe == "Last Video" else '30'
        
        ydl_opts = {
            'playlist_items': playlist_items_limit,
            'extract_flat': True,
            'quiet': True,
            'no_warnings': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'web'],
                    'skip': ['webpage', 'hls']
                }
            },
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, http_headers)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            }
        }
        
        matching_videos = []
        today = datetime.date.today()
        
        if timeframe == "Last Week":
            date_limit = today - datetime.timedelta(days=7)
        elif timeframe == "Last Month":
            date_limit = today - datetime.timedelta(days=30)
        else:
            date_limit = None # No date limit needed for 'Last Video'
            
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if 'entries' in info and len(info['entries']) > 0:
                    if timeframe == "Last Video":
                        entry = info['entries'][0]
                        video_url = entry.get('url') or f"https://www.youtube.com/watch?v={entry.get('id')}"
                        matching_videos.append({
                            'url': video_url,
                            'title': entry.get('title'),
                            'id': entry.get('id'),
                            'upload_date': "Latest"
                        })
                    else:
                        for entry in info['entries']:
                            upload_date_str = entry.get('upload_date')
                            video_url = entry.get('url') or f"https://www.youtube.com/watch?v={entry.get('id')}"
                            
                            if not upload_date_str:
                                try:
                                    single_opts = {
                                        'quiet': True,
                                        'no_warnings': True,
                                        'extract_flat': True,
                                    }
                                    with yt_dlp.YoutubeDL(single_opts) as s_ydl:
                                        s_info = s_ydl.extract_info(video_url, download=False)
                                        upload_date_str = s_info.get('upload_date')
                                except Exception:
                                    pass
                                    
                            if upload_date_str:
                                try:
                                    upload_date = datetime.datetime.strptime(upload_date_str, "%Y%m%d").date()
                                    if date_limit <= upload_date <= today:
                                        matching_videos.append({
                                            'url': video_url,
                                            'title': entry.get('title'),
                                            'id': entry.get('id'),
                                            'upload_date': upload_date.strftime("%Y-%m-%d")
                                        })
                                except ValueError:
                                    pass
        except Exception as e:
            print(f"Error fetching channel videos for timeframe {timeframe} from {channel_url}: {e}")
        return matching_videos
