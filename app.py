import streamlit as st
import os
import datetime
import time
import pandas as pd
import json
import re
import sys
import contextlib
import io

# Import project modules
from src.core.config import Config
from src.utils.file_manager import FileManager
from src.core.analyzer import AnalyzerAgent
from src.core.generator import NewsletterAgent
from src.services.gemini import GeminiService

# -----------------------------------------------------------------------------
# 1. PAGE CONFIG & STYLING
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="Tessra Google Social Agent",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom material-dark inspired theme styling matching the backup and Redis styles
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto:wght@400;500&display=swap');
    
    /* Typography */
    html, body, [class*="css"] {
        font-family: 'Google Sans', 'Roboto', Helvetica, Arial, sans-serif;
    }
    
    /* Headers & Branding */
    .brand-title {
        color: #4285F4;
        font-weight: 700;
        font-size: 2.2rem;
        margin-bottom: 0.2rem;
        letter-spacing: -0.5px;
    }
    .brand-subtitle {
        color: #5F6368;
        font-size: 1.1rem;
        margin-bottom: 2rem;
    }
    
    /* Stat Cards */
    .metric-card {
        background-color: #FFFFFF;
        border: 1px solid #DADCE0;
        border-radius: 12px;
        padding: 1.2rem;
        box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 2px 6px 2px rgba(60,64,67,0.15);
        text-align: center;
        margin-bottom: 1rem;
    }
    .metric-value {
        font-size: 2.2rem;
        font-weight: 700;
        color: #4285F4;
        margin-bottom: 0.2rem;
    }
    .metric-label {
        font-size: 0.85rem;
        color: #5F6368;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    /* Badges */
    .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 50px;
        font-size: 0.85rem;
        font-weight: 500;
    }
    .badge-success { background-color: #E6F4EA; color: #137333; }
    .badge-warning { background-color: #FEF7E0; color: #B06000; }
    .badge-danger { background-color: #FCE8E6; color: #C5221F; }
    .badge-info { background-color: #E8F0FE; color: #1A73E8; }
    
    /* Interactive Workstation */
    .comment-bubble {
        background-color: #F1F3F4;
        border-left: 4px solid #4285F4;
        padding: 1rem;
        border-radius: 0 8px 8px 0;
        margin-bottom: 1.2rem;
    }
    .comment-text {
        font-size: 1.05rem;
        color: #202124;
        line-height: 1.5;
        font-weight: 500;
    }
    .comment-meta {
        font-size: 0.85rem;
        color: #5F6368;
        margin-top: 0.5rem;
        font-family: monospace;
    }
    
    .reply-card {
        border: 1px solid #DADCE0;
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 1rem;
        background-color: #FAFAFA;
        transition: box-shadow 0.2s;
    }
    .reply-card:hover {
        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    }
    .reply-tone {
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #EA4335;
        margin-bottom: 0.4rem;
    }
    .reply-text {
        font-size: 0.95rem;
        color: #202124;
        line-height: 1.4;
    }
    .reply-compliance {
        font-size: 0.8rem;
        color: #137333;
        background-color: #E6F4EA;
        padding: 2px 8px;
        border-radius: 4px;
        display: inline-block;
        margin-top: 0.4rem;
    }
    
    /* Form sections - adapted to stand out beautifully in both light and dark themes */
    .section-header {
        border-bottom: 2px solid #4285F4;
        padding-bottom: 0.5rem;
        margin-top: 1.5rem;
        margin-bottom: 1rem;
        font-weight: 700;
        color: #4285F4;
    }
</style>
""", unsafe_allow_html=True)

# -----------------------------------------------------------------------------
# 2. BRAND TONE OF VOICE (TOV) GUIDELINES DEFINITION
# -----------------------------------------------------------------------------
GOOGLE_BRAND_GUIDELINES = """
GOOGLE FRANCE COMMUNITY MANAGEMENT & TOV GUIDELINES:
1. Core Vision: We are Google. Our vision is to be the most helpful company on the planet.
2. Voice & Tone Sweetspot: Help, delivered with charm. A dash of humanity, humble but confident (with some swagger), specific to the creator or content, and optimistic. 
3. strict Rules:
   - Witty not snarky, candid not tactless, provocative not controversial, expressive not pretentious.
   - Speak in the communal first person plural: use "we", "our", "us".
   - CRITICAL CONSTRAINT: NEVER use the first person singular: "I", "me", "my", "myself" (as a corporation, we do not have a single body or voice).
   - Focus on the person: Use 'you' or 'people', never refer to them as 'users' or 'customers'.
   - NEVER use the word "Google" as a verb (e.g., do not write "Google this", write "Search this" or "Look this up").
   - Emojis: Use sparingly and only when they genuinely add warmth, never to replace words.
   - Character Limit: Keep responses extremely short, ideally 60 to 100 characters max.
   - Do not use Google as superlative or boastful.
4. ABSOLUTE DO NOTS:
   - Never direct-reference competitors (Apple, Amazon, Microsoft, OpenAI, etc.).
   - Never imply brand solves health issues or handles policy/politics/religion/finance.
   - Never express negativity towards Google or touch on active product faults.
   - Avoid implying that products are 'free' (the @google handle is global; avoid the word free).
"""

# -----------------------------------------------------------------------------
# 3. SESSION STATE INITIALIZATION
# -----------------------------------------------------------------------------
if 'logs' not in st.session_state:
    st.session_state.logs = []
if 'parsed_data' not in st.session_state:
    st.session_state.parsed_data = None
if 'selected_file' not in st.session_state:
    st.session_state.selected_file = None
if 'api_key_override' not in st.session_state:
    st.session_state.api_key_override = ""

# Triage & Comment response state machine variables
if 'triage_results' not in st.session_state:
    st.session_state.triage_results = None
if 'selected_comments_replies' not in st.session_state:
    st.session_state.selected_comments_replies = {}
if 'drafted_replies_cache' not in st.session_state:
    st.session_state.drafted_replies_cache = {}
if 'locked_reply_selections' not in st.session_state:
    st.session_state.locked_reply_selections = {}
if 'custom_inputs_cache' not in st.session_state:
    st.session_state.custom_inputs_cache = {}
if 'selected_like_ids' not in st.session_state:
    st.session_state.selected_like_ids = set()
if 'selected_moderation_actions' not in st.session_state:
    st.session_state.selected_moderation_actions = {}

# Target video configurations for the scraping flow
if 'target_video_url' not in st.session_state:
    st.session_state.target_video_url = ""
if 'target_creator_name' not in st.session_state:
    st.session_state.target_creator_name = ""
if 'watchlist_selected_creators' not in st.session_state:
    st.session_state.watchlist_selected_creators = []
if 'watchlist_fetched_videos' not in st.session_state:
    st.session_state.watchlist_fetched_videos = []
if 'global_watchlist_feed' not in st.session_state:
    st.session_state.global_watchlist_feed = None

# Handle environment key overrides
if st.session_state.api_key_override:
    Config.GOOGLE_API_KEY = st.session_state.api_key_override
else:
    st.session_state.api_key_override = Config.GOOGLE_API_KEY or ""

# Ensure directories
os.makedirs(Config.INPUTS_DIR, exist_ok=True)
os.makedirs(Config.OUTPUT_DIR, exist_ok=True)

# -----------------------------------------------------------------------------
# 4. SIDEBAR CONFIGURATION
# -----------------------------------------------------------------------------
with st.sidebar:
    st.markdown("### 🤖 G.E.O. Social Copilot")
    st.image("https://www.gstatic.com/images/branding/product/2x/gemini_64dp.png", width=50)
    st.markdown("##### Powered by `gemini-3-flash-preview`")
    
    st.markdown("---")
    
    # API CONFIGURATION
    st.markdown("🔑 **Google API Key**")
    if Config.GOOGLE_API_KEY:
        masked_key = Config.GOOGLE_API_KEY[:6] + "..." + Config.GOOGLE_API_KEY[-4:] if len(Config.GOOGLE_API_KEY) > 10 else "Configured"
        st.markdown(f'<span class="status-badge badge-success">Active: {masked_key}</span>', unsafe_allow_html=True)
    else:
        st.markdown('<span class="status-badge badge-danger">API Key Missing</span>', unsafe_allow_html=True)
        
    api_key_input = st.text_input(
        "Enter Google API Key override:",
        value=st.session_state.api_key_override,
        type="password",
        key="key_sidebar_u"
    )
    if api_key_input != st.session_state.api_key_override:
        st.session_state.api_key_override = api_key_input
        Config.GOOGLE_API_KEY = api_key_input
        st.rerun()
        
    st.markdown("---")
    
    # FILE LOADER
    st.markdown("📁 **Spreadsheet Source**")
    
    uploaded_file = st.file_uploader("Upload .xlsx or .csv sheet", type=["xlsx", "csv", "xls"], key="sidebar_loader")
    if uploaded_file is not None:
        save_path = os.path.join(Config.INPUTS_DIR, uploaded_file.name)
        with open(save_path, "wb") as f:
            f.write(uploaded_file.getbuffer())
        st.success(f"Uploaded: {uploaded_file.name}")
        st.session_state.selected_file = save_path
        st.session_state.parsed_data = None  # Reset cache
        st.session_state.triage_results = None  # Reset triage
        st.session_state.locked_reply_selections = {}
        st.session_state.drafted_replies_cache = {}
        st.session_state.selected_like_ids = set()
        st.session_state.selected_moderation_actions = {}
        st.rerun()
        
    existing_files = FileManager.list_input_files()
    if existing_files:
        file_options = {f: os.path.join(Config.INPUTS_DIR, f) for f in existing_files}
        
        current_sel = st.session_state.selected_file
        sel_idx = 0
        if current_sel:
            current_name = os.path.basename(current_sel)
            if current_name in file_options:
                sel_idx = list(file_options.keys()).index(current_name)
                
        selected_name = st.selectbox(
            "Select active spreadsheet:",
            options=list(file_options.keys()),
            index=sel_idx,
            key="sidebar_select"
        )
        if selected_name:
            chosen_path = file_options[selected_name]
            if chosen_path != st.session_state.selected_file:
                st.session_state.selected_file = chosen_path
                st.session_state.parsed_data = None  # Reset cache
                st.session_state.triage_results = None  # Reset triage
                st.session_state.locked_reply_selections = {}
                st.session_state.drafted_replies_cache = {}
                st.session_state.selected_like_ids = set()
                st.session_state.selected_moderation_actions = {}
                st.rerun()
                
    st.markdown("---")
    st.caption("🚀 Tessra G.E.O. Social Agent — Version 2.1.0")

# -----------------------------------------------------------------------------
# 5. HEADER BRANDING
# -----------------------------------------------------------------------------
st.markdown('<div class="brand-title">🤖 G.E.O. Social Copilot Dashboard</div>', unsafe_allow_html=True)
st.markdown('<div class="brand-subtitle">Strategic community moderation, automated triage, and Tone of Voice compliant reply generator for Google France.</div>', unsafe_allow_html=True)

# Parsing file caching logic
if st.session_state.selected_file and st.session_state.parsed_data is None:
    with st.spinner("Parsing spreadsheet content..."):
        try:
            parsed = FileManager.parse_file_data(st.session_state.selected_file)
            st.session_state.parsed_data = parsed
        except Exception as e:
            st.error(f"Failed parsing spreadsheet: {e}")

# Determine Active Mode
p_data = st.session_state.parsed_data
is_clist = p_data.get("is_creator_list", False) if p_data else False

# -----------------------------------------------------------------------------
# 6. STATEFUL WORKFLOW NAVIGATION
# -----------------------------------------------------------------------------
if 'active_step' not in st.session_state:
    st.session_state.active_step = 'Step 1'

if is_clist:
    nav_options = {
        'Step 1': '📁 Step 1: Ingest & Overview',
        'Step 2': '🎥 Step 2: Creator Watchlist & Video Slicer',
        'Step 3': '📬 Step 3: Generated Reports Explorer'
    }
else:
    nav_options = {
        'Step 1': '📁 Step 1: Ingest & Overview',
        'Step 2': '💬 Step 2: Social Reply & Moderation Agent',
        'Step 3': '📬 Step 3: Generated Validation Reports'
    }

if st.session_state.active_step not in nav_options:
    st.session_state.active_step = 'Step 1'

col_navs = st.columns(len(nav_options))
for idx, (step_key, step_label) in enumerate(nav_options.items()):
    with col_navs[idx]:
        is_active = (st.session_state.active_step == step_key)
        if st.button(step_label, key=f'nav_btn_stateful_{step_key}', use_container_width=True, type='primary' if is_active else 'secondary'):
            st.session_state.active_step = step_key
            st.rerun()

st.markdown('---')

# -----------------------------------------------------------------------------
# STEP 1: INGEST & OVERVIEW (COMMON TO BOTH MODES)
# -----------------------------------------------------------------------------
if st.session_state.active_step == 'Step 1':
    st.markdown("### 📁 Spreadsheet Normalization & Overview")
    
    if not st.session_state.selected_file:
        st.info("Select or upload a spreadsheet in the sidebar to load the social monitoring dataset!")
    elif p_data:
        col1, col2, col3 = st.columns(3)
        with col1:
            if is_clist:
                val = len(p_data.get("creators", []))
                lbl = "Monitored Partners / Creators"
                badge = '<span class="status-badge badge-success">Type: Creator/Partner List</span>'
            else:
                val = len(p_data.get("mentions_data", []))
                lbl = "Total Brand Mentions Loaded"
                badge = '<span class="status-badge badge-info">Type: Brandwatch Mentions</span>'
            st.markdown(f'<div class="metric-card"><div class="metric-value">{val}</div><div class="metric-label">{lbl}</div><div style="margin-top:0.6rem;">{badge}</div></div>', unsafe_allow_html=True)
            
        with col2:
            if is_clist:
                val = sum(1 for c in p_data.get("creators", []) if c.get("type") == "Partner")
                lbl = "Official Co-Marketing Partners"
            else:
                val = len(p_data.get("youtube_videos", []))
                lbl = "Detected YouTube Video Posts"
            st.markdown(f'<div class="metric-card"><div class="metric-value">{val}</div><div class="metric-label">{lbl}</div></div>', unsafe_allow_html=True)
            
        with col3:
            if is_clist:
                val = sum(1 for c in p_data.get("creators", []) if c.get("type") == "Endorser")
                lbl = "Unpaid Endorsers / Brand Fans"
            else:
                mentions = p_data.get("mentions_data", [])
                val = max([m.get("reach", 0) for m in mentions]) if mentions else 0
                lbl = "Peak Estimated Reach"
            st.markdown(f'<div class="metric-card"><div class="metric-value">{val:,}</div><div class="metric-label">{lbl}</div></div>', unsafe_allow_html=True)

        st.markdown('<div class="section-header">🔍 Ingested Row Preview</div>', unsafe_allow_html=True)
        if is_clist:
            df_creators = pd.DataFrame(p_data.get("creators", []))
            st.dataframe(df_creators, use_container_width=True, hide_index=True)
        else:
            df_mentions = pd.DataFrame(p_data.get("mentions_data", []))
            search_m = st.text_input("Search mentions by keyword:", "")
            if search_m:
                filtered_df = df_mentions[df_mentions['text'].str.lower().str.contains(search_m.lower())]
            else:
                filtered_df = df_mentions
            st.dataframe(filtered_df, use_container_width=True, hide_index=True)

# -----------------------------------------------------------------------------
# STEP 2 (MODE A): CREATOR WATCHLIST & PROACTIVE VIDEO SLICER
# -----------------------------------------------------------------------------
elif st.session_state.active_step == 'Step 2' and is_clist:
    st.markdown('### 🎥 Creator Watchlist G.E.O. Video Slicer')
    st.write('Scan your co-marketing partners, pull their videos uploaded recently, down-sample their speech tracks, and draft French G.E.O. Action Plans.')
    
    # GLOBAL WATCHLIST UPLOAD FEED DISCOVERY BUTTON
    st.markdown('<div class="section-header">📡 Global Watchlist Upload Feed Checker</div>', unsafe_allow_html=True)
    st.write("Check who among all co-marketing partners posted recently. This retrieves the top 5 closest videos to current day across the entire watchlist database.")
    
    if st.button("📡 Check All Creators for Recent Uploads", type="secondary", use_container_width=True):
        st.session_state.global_watchlist_feed = []
        creators_list = p_data.get('creators', [])
        
        if not creators_list:
            st.warning("No creators loaded in watchlist.")
        else:
            with st.spinner("Scraping absolute latest upload details across entire partner list (this may take a few seconds)..."):
                scanned_videos = []
                progress_feed = st.progress(0)
                status_feed = st.empty()
                
                for idx, creator in enumerate(creators_list):
                    c_name = creator["name"]
                    status_feed.write(f"Scraping latest upload for **{c_name}**...")
                    latest_vid = FileManager.get_channel_videos_for_timeframe(creator["url"], "Last Video")
                    if latest_vid:
                        vid_item = latest_vid[0]
                        vid_item["creator_name"] = c_name
                        scanned_videos.append(vid_item)
                    progress_feed.progress((idx + 1) / len(creators_list))
                
                progress_feed.empty()
                status_feed.empty()
                
                # Retrieve the absolute upload dates for accurate sorting
                # Let's fetch details to get exact upload_dates (YYYYMMDD) using yt-dlp where possible
                vids_with_dates = []
                import yt_dlp
                import datetime
                
                status_feed.write("Sorting and filtering top 5 most recent uploads...")
                for vid in scanned_videos:
                    video_url = vid["url"]
                    # Fetch date if YYYYMMDD is not parsed
                    try:
                        ydl_opts_date = {'quiet': True, 'no_warnings': True, 'extract_flat': True}
                        with yt_dlp.YoutubeDL(ydl_opts_date) as ydl_d:
                            s_info = ydl_d.extract_info(video_url, download=False)
                            upload_date_str = s_info.get('upload_date')
                            if upload_date_str:
                                upload_date = datetime.datetime.strptime(upload_date_str, "%Y%m%d").date()
                                vid["date_object"] = upload_date
                                vid["upload_date"] = upload_date.strftime("%Y-%m-%d")
                            else:
                                vid["date_object"] = datetime.date.min
                                vid["upload_date"] = "Unknown"
                    except Exception:
                        vid["date_object"] = datetime.date.min
                        vid["upload_date"] = "Unknown"
                    vids_with_dates.append(vid)
                
                status_feed.empty()
                
                # Sort by date descending (closest to today first)
                vids_with_dates.sort(key=lambda x: x.get("date_object", datetime.date.min), reverse=True)
                st.session_state.global_watchlist_feed = vids_with_dates[:5]
                st.rerun()

    # If results are cached in state, show them beautifully
    g_feed = st.session_state.get("global_watchlist_feed")
    if g_feed:
        st.markdown("##### 📡 Scanned Top 5 Recent Videos (Watchlist Feed):")
        for idx, vid in enumerate(g_feed, 1):
            col_feed_text, col_feed_act = st.columns([4, 1])
            with col_feed_text:
                st.markdown(f"**{idx}. {vid['creator_name']}** — *\"{vid['title']}\"*")
                st.caption(f"📅 Published Date: `{vid['upload_date']}` | Link: {vid['url']}")
            with col_feed_act:
                # Button to quickly add/queue this video
                if st.button("➕ Queue Video", key=f"feed_add_btn_{idx}_{vid['id']}", use_container_width=True):
                    # Check if already added to avoid duplicates
                    if not any(v['url'] == vid['url'] for v in st.session_state.watchlist_fetched_videos):
                        st.session_state.watchlist_fetched_videos.append({
                            "url": vid['url'],
                            "title": vid['title'],
                            "id": vid['id'],
                            "creator_name": vid['creator_name'],
                            "upload_date": vid['upload_date']
                        })
                        # Auto-select creator in multiselect if not present
                        if vid['creator_name'] not in st.session_state.watchlist_selected_creators:
                            st.session_state.watchlist_selected_creators.append(vid['creator_name'])
                        st.success(f"Added to Queue!")
                    else:
                        st.info("Video is already in your Queue!")
        st.markdown("---")
        
    col_setup_left, col_setup_right = st.columns([1.2, 1])
    
    with col_setup_left:
        st.markdown('<div class="section-header">👥 1. Watchlist Target Selection</div>', unsafe_allow_html=True)
        creators = p_data.get('creators', [])
        creator_names = [c['name'] for c in creators]
        
        # Timeframe Selector dropdown
        selected_timeframe = st.selectbox(
            'Select analysis timeframe:',
            options=['Last Week', 'Last Month', 'Last Video'],
            index=0,
            key='watchlist_timeframe_selector'
        )
        
        # Stateful Multiselect of Creators
        selected_creators = st.multiselect(
            f'Choose creators to monitor content ({selected_timeframe.lower()}):',
            options=creator_names,
            default=st.session_state.watchlist_selected_creators
        )
        st.session_state.watchlist_selected_creators = selected_creators
        
        # Action button to fetch all videos from chosen timeframe
        if st.button(f"🔍 Fetch Videos ({selected_timeframe})", type="primary", use_container_width=True):
            if not selected_creators:
                st.warning("⚠️ Please select at least one creator first!")
            else:
                st.session_state.watchlist_fetched_videos = []
                progress_bar = st.progress(0)
                status_text = st.empty()
                
                for idx, c_name in enumerate(selected_creators):
                    creator_info = next((c for c in creators if c['name'] == c_name), None)
                    if creator_info:
                        status_text.write(f"Scraping YouTube videos for **{c_name}** ({selected_timeframe.lower()})...")
                        fetched = FileManager.get_channel_videos_for_timeframe(creator_info["url"], selected_timeframe)
                        for v in fetched:
                            v["creator_name"] = c_name
                            st.session_state.watchlist_fetched_videos.append(v)
                    progress_bar.progress((idx + 1) / len(selected_creators))
                
                progress_bar.empty()
                status_text.empty()
                
                num_found = len(st.session_state.watchlist_fetched_videos)
                time_range_desc = "the past 7 days" if selected_timeframe == "Last Week" else "the past 30 days" if selected_timeframe == "Last Month" else "latest upload"
                if num_found > 0:
                    st.success(f"🎉 Successfully retrieved {num_found} video(s) uploaded in {time_range_desc}!")
                else:
                    st.warning(f"⚠️ No videos were uploaded in {time_range_desc} by the selected creators.")
        
        # Manual Override Add
        st.markdown('<div class="section-header">⚙️ Manual Video Addition</div>', unsafe_allow_html=True)
        col_man1, col_man2 = st.columns([2, 1])
        with col_man1:
            manual_url = st.text_input("YouTube Video URL Override:", key="man_video_url_u")
        with col_man2:
            manual_name = st.text_input("Creator Name:", key="man_creator_name_u")
            
        if st.button("➕ Add Manual Video to Queue", use_container_width=True):
            if not manual_url:
                st.error("Please provide a valid YouTube URL.")
            else:
                st.session_state.watchlist_fetched_videos.append({
                    "url": manual_url,
                    "title": f"Manual Override: {manual_url[:30]}...",
                    "id": manual_url.split("v=")[-1] if "v=" in manual_url else "manual",
                    "creator_name": manual_name or "Custom Target",
                    "upload_date": datetime.date.today().strftime("%Y-%m-%d")
                })
                st.success("Successfully added manual video to queue!")
                st.rerun()

        # CONSOLIDATED: Slicing options moved inside an elegant advanced options expander
        with st.expander('⚙️ Advanced Audio-Slicing & Extraction Settings', expanded=False):
            audio_only = st.checkbox('Extract and Analyze Audio-Only', value=True)
            
            if audio_only:
                st.info('ℹ️ Speech track is down-sampled to mono MP3 to optimize token rates.')
                limit_mode = st.radio('Slicing Limit:', ['Analyze full video/audio stream', 'Analyze specific clipped duration'], index=0)
                
                if limit_mode == 'Analyze specific clipped duration':
                    duration_limit_min = st.slider('Max speech duration (minutes):', min_value=1.0, max_value=60.0, value=5.0, step=1.0)
                    duration_limit_sec = int(duration_limit_min * 60)
                else:
                    duration_limit_sec = None
            else:
                st.warning('⚠️ Visual video analysis is capped at 1.0 minute maximum.')
                duration_limit_sec = 60
    
    with col_setup_right:
        st.markdown('<div class="section-header">🚀 Pipeline Execution Workstation</div>', unsafe_allow_html=True)
        st.write('Ready to trigger the automated scraping and intelligence pipeline. This will locally extract creator audio and analyze segments with Gemini.')
        
        # Display Queued Videos
        queued_videos = st.session_state.watchlist_fetched_videos
        
        if queued_videos:
            st.markdown(f"##### 📊 Queued Targets for Analysis ({len(queued_videos)}):")
            
            # Show in a nice dataframe
            df_queue = pd.DataFrame(queued_videos)
            st.dataframe(df_queue[['creator_name', 'title', 'upload_date']], use_container_width=True, hide_index=True)
            
            if st.button("🧹 Clear Target Video Queue", type="secondary"):
                st.session_state.watchlist_fetched_videos = []
                st.rerun()
        else:
            st.info("💡 Your video queue is empty. Choose creators and fetch their last week's uploads, or add overrides to begin!")
            
        has_target = len(queued_videos) > 0
        
        if not Config.GOOGLE_API_KEY:
            st.error('❌ Google API Key is missing. Set it in the sidebar.')
        elif not has_target:
            st.warning('💡 Select creators and click "Fetch Videos from Last Week" to populate queue!')
        else:
            run_btn = st.button('🚀 EXECUTE GEMINI INTELLIGENCE PIPELINE', type='primary', use_container_width=True)
            
            if run_btn:
                st.session_state.logs = []
                st.session_state.analysis_result = None
                
                st.markdown('<div class="section-header">📝 Real-Time Execution Console Log</div>', unsafe_allow_html=True)
                log_container = st.empty()
                
                def live_logger(message):
                    st.session_state.logs.append(message)
                    log_text = "\n".join(st.session_state.logs)
                    log_container.code(log_text)
                
                stdout_io = io.StringIO()
                with st.spinner('Processing pipeline segments...'):
                    live_logger('🚀 Starting G.E.O. Multi-Modal Watchlist Pipeline...')
                    
                    selected_v_list = [v['url'] for v in queued_videos]
                    
                    # Create the video_to_creator mapping
                    p_data["video_to_creator"] = {v['url']: v['creator_name'] for v in queued_videos}
                    
                    # Set up time ranges for each video
                    time_ranges = {v['url']: (0, duration_limit_sec) if duration_limit_sec else None for v in queued_videos}
                    
                    try:
                        analyzer = AnalyzerAgent(log_callback=live_logger, enable_rich_progress=False)
                        with contextlib.redirect_stdout(stdout_io):
                            analysis_result = analyzer.analyze_mentions(
                                p_data,
                                analyze_videos=True,
                                selected_videos=selected_v_list,
                                audio_only=audio_only,
                                time_ranges=time_ranges
                            )
                        captured_stdout = stdout_io.getvalue()
                        if captured_stdout:
                            for line in captured_stdout.split('\n'):
                                if line.strip(): live_logger(line)
                                
                        st.session_state.analysis_result = analysis_result
                        live_logger('✅ Multi-modal intelligence run completed successfully!')
                    except Exception as ex:
                        captured_stdout = stdout_io.getvalue()
                        if captured_stdout:
                            for line in captured_stdout.split('\n'):
                                if line.strip(): live_logger(line)
                        live_logger(f'❌ PIPELINE ERROR: {ex}')
                        st.error(f'Analysis Failed: {ex}')
                
                if st.session_state.analysis_result:
                    with st.spinner('Compiling G.E.O. HTML Report...'):
                        try:
                            newsletter_agent = NewsletterAgent()
                            html_output = newsletter_agent.generate_html(st.session_state.analysis_result)
                            
                            # Dynamic compiled filename
                            date_str = datetime.datetime.now().strftime('%Y-%m-%d-%H%M')
                            if len(selected_creators) == 1:
                                out_filename = f"GEO-Action-Plan-{selected_creators[0].replace(' ', '_')}-{date_str}.html"
                            else:
                                out_filename = f"GEO-Action-Plan-Batch-{date_str}.html"
                                
                            out_path = os.path.join(Config.OUTPUT_DIR, out_filename)
                            
                            with open(out_path, 'w', encoding='utf-8') as f_out:
                                f_out.write(html_output)
                                
                            st.success(f'📬 Layout compiled to: {out_path}')
                            st.balloons()
                            time.sleep(2)
                            
                            # Auto-redirect to Step 3 reports explorer on compile!
                            st.session_state.active_step = "Step 3"
                            st.rerun()
                        except Exception as gen_ex:
                            st.error(f'Failed to generate layout template: {gen_ex}')
                            st.session_state.logs.append(f'❌ Layout Compiler Error: {gen_ex}')
                    log_container.code("\n".join(st.session_state.logs))

# -----------------------------------------------------------------------------
# STEP 2 (MODE B): BRANDWATCH INTERACTIVE TRIAGE & CO-PILOT RESPONSE GENERATOR
# -----------------------------------------------------------------------------
elif st.session_state.active_step == 'Step 2' and not is_clist:
        st.markdown("### 💬 Brandwatch Interactive Triage & Tone of Voice Copilot")
        st.write("Automatically categorize social comments into distinct moderation levels, and select comments to draft and refine on-brand replies.")
        
        # TRIAGE CONTROLLER PANEL
        if st.session_state.triage_results is None:
            st.info("💡 Trigger the automated triage pipeline to classify the raw text comments. It uses Google's guidelines to separate replies, likes, and moderation actions.")
            
            # Allow limiting mentions to avoid rate limits
            triage_limit = st.slider("Select maximum comments to analyze:", min_value=10, max_value=200, value=30, step=10)
            
            if st.button("🚀 TRIGGER AUTO-TRIAGE ANALYSIS", type="primary"):
                with st.spinner("Running Google-grade triage models on comments..."):
                    try:
                        # Extract the first N mentions
                        mentions_to_triage = p_data.get("mentions_data", [])[:triage_limit]
                        
                        # Generate unique IDs for standard mentions
                        for idx, m in enumerate(mentions_to_triage):
                            if "id" not in m:
                                m["id"] = f"m_{idx}_{int(time.time())}"
                                
                        # Format list for prompt
                        mentions_payload = [{
                            "id": m.get("id"),
                            "mention": m.get("text"),
                            "author": m.get("author", "N/A"),
                            "platform": m.get("platform", "N/A"),
                            "date": m.get("date", "N/A"),
                            "url": m.get("url", ""),
                            "source": m.get("source", "EARNED")
                        } for m in mentions_to_triage]
                        
                        triage_prompt = f"""
                        You are G.E.O., the strategic co-pilot for Google France.
                        Analyze the following mentions according to the Google France Community Guidelines.
                        
                        {GOOGLE_BRAND_GUIDELINES}
                        
                        Your task is to triage the input comments into the exact categories matching the schema below:
                        - 'earnedForResponse' (Action: Respond - requiring creative/helpful written replies)
                        - 'mentionsForLike' (Action: Like Only - simple praise deserving a Like only)
                        - 'mentionsToHide' (Action: Hide - spam, mild trolls, gratuitous insults)
                        - 'mentionsToDelete' (Action: Delete - toxic content, hate speech, severe threats)
                        
                        Input mentions data:
                        ```json
                        {json.dumps(mentions_payload, ensure_ascii=False)}
                        ```
                        """
                        
                        # Use Gemini structured generation
                        triage_schema = {
                            "type": "OBJECT",
                            "properties": {
                                "earnedForResponse": {
                                    "type": "ARRAY",
                                    "items": {
                                        "type": "OBJECT",
                                        "properties": {
                                            "id": {"type": "STRING"},
                                            "tag": {"type": "STRING", "enum": ["Pixel", "Search", "Gemini", "Android", "BrandCulture"]},
                                            "opportunityScore": {"type": "INTEGER"},
                                            "respectsGuidelines": {"type": "BOOLEAN"}
                                        },
                                        "required": ["id", "tag", "opportunityScore", "respectsGuidelines"]
                                    }
                                },
                                "mentionsForLike": {
                                    "type": "ARRAY",
                                    "items": {
                                        "type": "OBJECT",
                                        "properties": {
                                            "id": {"type": "STRING"},
                                            "reason": {"type": "STRING"},
                                            "tag": {"type": "STRING", "enum": ["Pixel", "Search", "Gemini", "Android", "BrandCulture"]}
                                        },
                                        "required": ["id", "reason", "tag"]
                                    }
                                },
                                "mentionsToHide": {
                                    "type": "ARRAY",
                                    "items": {
                                        "type": "OBJECT",
                                        "properties": {
                                            "id": {"type": "STRING"},
                                            "reason": {"type": "STRING"}
                                        },
                                        "required": ["id", "reason"]
                                    }
                                },
                                "mentionsToDelete": {
                                    "type": "ARRAY",
                                    "items": {
                                        "type": "OBJECT",
                                        "properties": {
                                            "id": {"type": "STRING"},
                                            "reason": {"type": "STRING"}
                                        },
                                        "required": ["id", "reason"]
                                    }
                                }
                            },
                            "required": ["earnedForResponse", "mentionsForLike", "mentionsToHide", "mentionsToDelete"]
                        }
                        
                        # Request the structured analysis
                        service = GeminiService()
                        response = service.generate_content_structured(triage_prompt, json_schema=triage_schema)
                        raw_json_text = response.get("text", "{}")
                        
                        triage_result_obj = json.loads(raw_json_text)
                        st.session_state.triage_results = triage_result_obj
                        
                        # Populate caches and locks
                        # 1. Replies auto-select
                        st.session_state.selected_comments_replies = {
                            item["id"]: True for item in triage_result_obj.get("earnedForResponse", [])
                        }
                        # 2. Likes auto-select
                        st.session_state.selected_like_ids = {
                            item["id"] for item in triage_result_obj.get("mentionsForLike", [])
                        }
                        # 3. Hides/Deletes auto-select
                        for item in triage_result_obj.get("mentionsToHide", []):
                            st.session_state.selected_moderation_actions[item["id"]] = "Hide"
                        for item in triage_result_obj.get("mentionsToDelete", []):
                            st.session_state.selected_moderation_actions[item["id"]] = "Delete"
                            
                        st.success("Triage Analysis Complete! View categories below.")
                        st.rerun()
                    except Exception as triage_ex:
                        st.error(f"Triage execution failed: {triage_ex}")
        else:
            # RESET TRIAGE BUTTON
            if st.button("🔄 Restart Moderation / Reset Triage Filters"):
                st.session_state.triage_results = None
                st.session_state.locked_reply_selections = {}
                st.session_state.drafted_replies_cache = {}
                st.session_state.selected_like_ids = set()
                st.session_state.selected_moderation_actions = {}
                st.rerun()
                
            # INTERACTIVE WORKSPACE FOR CLASSIFIED COMMENTS
            t_res = st.session_state.triage_results
            mentions_map = {m.get("id"): m for m in p_data.get("mentions_data", [])}
            
            # Show summary stats of the triage
            replies_count = len(t_res.get("earnedForResponse", []))
            likes_count = len(t_res.get("mentionsForLike", []))
            hides_count = len(t_res.get("mentionsToHide", []))
            deletes_count = len(t_res.get("mentionsToDelete", []))
            
            st.markdown(f"""
            <div style="display:flex; gap:10px; margin-bottom:1.5rem;">
                <span class="status-badge badge-info">💬 Draft Replies: {replies_count}</span>
                <span class="status-badge badge-success">👍 Likes: {likes_count}</span>
                <span class="status-badge badge-warning">🛡️ Masquer/Supprimer: {hides_count + deletes_count}</span>
            </div>
            """, unsafe_allow_html=True)
            
            st.markdown('<div class="section-header">🔍 Triage & Tone of Voice Drafting Terminal</div>', unsafe_allow_html=True)
            
            # Workspace Columns
            col_list, col_draft = st.columns([1, 1.2])
            
            with col_list:
                st.markdown("##### 👥 Click a comment to select & load it in the Drafting Copilot:")
                
                # Setup visual Sub-tabs for the comment selector lists
                triage_tabs = st.tabs(["💬 Replies Needed", "👍 Simple Praise (Likes)", "🛡️ Moderation Actions"])
                
                selected_comment_id = None
                
                with triage_tabs[0]:
                    st.write("These comments were flagged as perfect opportunities for creative written engagement:")
                    for item in t_res.get("earnedForResponse", []):
                        m_id = item["id"]
                        orig = mentions_map.get(m_id)
                        if orig:
                            # Selection checkbox
                            is_checked = st.checkbox("Vetted", value=st.session_state.selected_comments_replies.get(m_id, True), key=f"chk_rep_{m_id}")
                            st.session_state.selected_comments_replies[m_id] = is_checked
                            
                            # Render selectable button for drafting
                            label_txt = f"👤 {orig.get('author', 'Anon')}: \"{orig.get('text')[:40]}...\""
                            
                            if st.button(label_txt, key=f"btn_rep_{m_id}"):
                                st.session_state.active_id = m_id
                                st.rerun()
                                
                with triage_tabs[1]:
                    st.write("These positive comments are simple compliments, scheduled for a 'Like Only':")
                    for item in t_res.get("mentionsForLike", []):
                        m_id = item["id"]
                        orig = mentions_map.get(m_id)
                        if orig:
                            is_liked = m_id in st.session_state.selected_like_ids
                            chk_like = st.checkbox("Like Approved", value=is_liked, key=f"chk_like_{m_id}")
                            if chk_like:
                                st.session_state.selected_like_ids.add(m_id)
                            else:
                                st.session_state.selected_like_ids.discard(m_id)
                            st.write(f"💬 *\"{orig.get('text')}\"*")
                            st.caption(f"💡 Reason: {item.get('reason')} | Product Tag: {item.get('tag')}")
                            st.markdown("---")
                            
                with triage_tabs[2]:
                    st.write("These comments contain mild negativity, spam, or toxic speech and require moderation:")
                    
                    st.markdown("**1. Masquer (Hide):**")
                    for item in t_res.get("mentionsToHide", []):
                        m_id = item["id"]
                        orig = mentions_map.get(m_id)
                        if orig:
                            st.write(f"❌ *\"{orig.get('text')}\"*")
                            st.caption(f"💡 Triage Reason: {item.get('reason')}")
                            # Toggle moderation action
                            current_action = st.session_state.selected_moderation_actions.get(m_id, "Hide")
                            act = st.selectbox("Action:", ["Hide", "Ignore", "Delete"], index=0, key=f"mod_rep_{m_id}")
                            if act != "Ignore":
                                st.session_state.selected_moderation_actions[m_id] = act
                            else:
                                st.session_state.selected_moderation_actions.pop(m_id, None)
                            st.markdown("---")
                            
                    st.markdown("**2. Supprimer (Delete):**")
                    for item in t_res.get("mentionsToDelete", []):
                        m_id = item["id"]
                        orig = mentions_map.get(m_id)
                        if orig:
                            st.write(f"🚨 *\"{orig.get('text')}\"*")
                            st.caption(f"💡 Triage Reason: {item.get('reason')}")
                            current_action = st.session_state.selected_moderation_actions.get(m_id, "Delete")
                            act = st.selectbox("Action:", ["Delete", "Ignore", "Hide"], index=0, key=f"mod_rep_del_{m_id}")
                            if act != "Ignore":
                                st.session_state.selected_moderation_actions[m_id] = act
                            else:
                                st.session_state.selected_moderation_actions.pop(m_id, None)
                            st.markdown("---")
            
            with col_draft:
                active_id = st.session_state.get("active_id")
                
                if not active_id:
                    # Default to first reply candidate
                    replies_list = t_res.get("earnedForResponse", [])
                    if replies_list:
                        active_id = replies_list[0]["id"]
                        st.session_state.active_id = active_id
                
                if active_id:
                    active_comment = mentions_map.get(active_id)
                    
                    if active_comment:
                        st.markdown('<div class="section-header">💬 Active Comment Details</div>', unsafe_allow_html=True)
                        st.markdown(f"""
                        <div class="comment-bubble">
                            <div class="comment-text">« {active_comment.get('text')} »</div>
                            <div class="comment-meta">👤 Sendeur: @{active_comment.get('author', 'Unknown')} | Réseau: {active_comment.get('platform', 'N/A')}</div>
                        </div>
                        """, unsafe_allow_html=True)
                        
                        # Trigger variation generation
                        if active_id not in st.session_state.drafted_replies_cache:
                            st.write("✨ *Google Social Copilot is analyzing Tone of Voice variations...*")
                            
                            with st.spinner("Drafting compliant variations..."):
                                try:
                                    # Create the generation prompt
                                    prompt_variations = f"""
                                    Based on the Google France Guidelines, generate 3 distinct response proposals in French for this social comment.
                                    Keep replies strictly under 100 characters.
                                    
                                    {GOOGLE_BRAND_GUIDELINES}
                                    
                                    Sendeur/Author Name: {active_comment.get('author', 'Anon')}
                                    Social Comment Text: {active_comment.get('text')}
                                    """
                                    
                                    schema_variations = {
                                        "type": "ARRAY",
                                        "items": {
                                            "type": "OBJECT",
                                            "properties": {
                                                "tone": {"type": "STRING", "description": "Single descriptive tone name (e.g. Malin, Clair, Taquin, Expert)"},
                                                "responseText": {"type": "STRING", "description": "Response in French, under 100 chars, no singular first person like I/me/my"},
                                                "guidelinesAdherence": {"type": "BOOLEAN"},
                                                "guidelinesComment": {"type": "STRING"}
                                            },
                                            "required": ["tone", "responseText", "guidelinesAdherence", "guidelinesComment"]
                                        }
                                    }
                                    
                                    service = GeminiService()
                                    v_response = service.generate_content_structured(prompt_variations, json_schema=schema_variations)
                                    v_raw_text = v_response.get("text", "[]")
                                    
                                    st.session_state.drafted_replies_cache[active_id] = json.loads(v_raw_text)
                                except Exception as draft_ex:
                                    st.error(f"Failed drafting variations: {draft_ex}")
                                    
                        # Display cached variations
                        variations = st.session_state.drafted_replies_cache.get(active_id, [])
                        
                        st.markdown("##### 🎨 Approved Tone of Voice Variations:")
                        
                        locked_selection = st.session_state.locked_reply_selections.get(active_id, {})
                        
                        # Loop through generated suggestions
                        for idx, var in enumerate(variations):
                            adherence_badge = '<span class="status-badge badge-success">✓ Guidelines Compliant</span>' if var.get("guidelinesAdherence") else '<span class="status-badge badge-warning">⚠ Check Copy</span>'
                            
                            is_active_selection = (locked_selection.get("type") == "generated" and locked_selection.get("index") == idx)
                            
                            st.markdown(f"""
                            <div class="reply-card" style="border: 2px solid {'#4285F4' if is_active_selection else '#DADCE0'};">
                                <div class="reply-tone">{var.get('tone')}</div>
                                <div class="reply-text">« {var.get('responseText')} »</div>
                                <div style="margin-top:0.4rem;">{adherence_badge} | <span style="font-size:0.8rem; color:#5F6368;">{var.get('guidelinesComment')}</span></div>
                            </div>
                            """, unsafe_allow_html=True)
                            
                            # Custom radio selectors for locking-in
                            if st.button(f"Choose Draft: {var.get('tone')}", key=f"sel_draft_{active_id}_{idx}"):
                                st.session_state.locked_reply_selections[active_id] = {
                                    "type": "generated",
                                    "index": idx,
                                    "content": var.get('responseText')
                                }
                                st.rerun()
                                
                        # CUSTOM WORKSTATION AREA
                        st.markdown('<div class="section-header">✏️ Write Custom Draft or Polish Draft</div>', unsafe_allow_html=True)
                        
                        custom_txt = st.text_area(
                            "Write custom draft or edit chosen copy:",
                            value=st.session_state.custom_inputs_cache.get(active_id, locked_selection.get("content", ""))
                        )
                        st.session_state.custom_inputs_cache[active_id] = custom_txt
                        
                        col_action1, col_action2 = st.columns(2)
                        
                        with col_action1:
                            if st.button("✨ MAGNIFY COPY (Optimize TOV)", use_container_width=True):
                                with st.spinner("Polishing copy to align with Google France guidelines..."):
                                    try:
                                        magnify_prompt = f"""
                                        Improve the following draft response to make it more engaging, humble, helpful, and strictly compliant with Google guidelines.
                                        Keep it under 100 characters. NEVER use first person singular (Je, moi, mon, je me). Use communal first person (Nous, notre).
                                        
                                        Draft Copy: "{custom_txt}"
                                        Guidelines:
                                        {GOOGLE_BRAND_GUIDELINES}
                                        """
                                        
                                        service = GeminiService()
                                        m_resp = service.generate_content(magnify_prompt)
                                        polished_txt = m_resp.get("text", custom_txt).replace('"', '').strip()
                                        
                                        st.session_state.custom_inputs_cache[active_id] = polished_txt
                                        st.session_state.locked_reply_selections[active_id] = {
                                            "type": "custom",
                                            "index": 99,
                                            "content": polished_txt
                                        }
                                        st.success("Draft Polished!")
                                        st.rerun()
                                    except Exception as mag_ex:
                                        st.error(f"Magnification failed: {mag_ex}")
                                        
                        with col_action2:
                            if st.button("🔒 Lock-in Custom Draft", use_container_width=True):
                                st.session_state.locked_reply_selections[active_id] = {
                                    "type": "custom",
                                    "index": 99,
                                    "content": custom_txt
                                }
                                st.success("Custom draft locked!")
                                st.rerun()
                                
                        # SHOW ACTIVE LOCK-IN STATUS
                        if active_id in st.session_state.locked_reply_selections:
                            locked = st.session_state.locked_reply_selections[active_id]
                            st.success(f"🔒 **Locked approved reply:**\n\n« {locked.get('content')} »")
                            
            # -----------------------------------------------------------------
            # CONSOLIDATED COMPLETED MODERATION LIST EXPORT (MATCHING THE BACKUP SPREADSHEET LAYOUT)
            # -----------------------------------------------------------------
            st.markdown('<div class="section-header">💾 Validation & Sheet Action Export</div>', unsafe_allow_html=True)
            st.write("Export your curated comment responses, likes, and hides into a structured CSV matching the Google Social Agent standard layout.")
            
            # Count locked replies
            num_locked_replies = len(st.session_state.locked_reply_selections)
            num_likes = len(st.session_state.selected_like_ids)
            num_moderated = len(st.session_state.selected_moderation_actions)
            
            st.info(f"Summary scheduled for export: **{num_locked_replies} replies**, **{num_likes} likes**, and **{num_moderated} moderation actions**.")
            
            if st.button("💾 GENERATE COMPLETED EXPORT CSV", type="primary", use_container_width=True):
                # Build Validation rows matching the backup logic
                export_rows = []
                today_str = datetime.datetime.now().strftime("%Y-%m-%d")
                
                # 1. Replies
                for m_id, active in st.session_state.selected_comments_replies.items():
                    if active and m_id in st.session_state.locked_reply_selections:
                        orig = mentions_map.get(m_id)
                        locked = st.session_state.locked_reply_selections[m_id]
                        if orig:
                            export_rows.append({
                                "Date": today_str,
                                "Status": "NEW",
                                "Product Area": "BrandCulture",
                                "Platform": orig.get("platform", "N/A").upper(),
                                "Source": "Earned",
                                "User": orig.get("author", "N/A"),
                                "Post": orig.get("text", "").replace("\n", " "),
                                "Interaction": "Reply",
                                "Answer": locked.get("content", ""),
                                "Comment PMM": ""
                            })
                            
                # 2. Likes
                for m_id in st.session_state.selected_like_ids:
                    orig = mentions_map.get(m_id)
                    if orig:
                        export_rows.append({
                            "Date": today_str,
                            "Status": "NEW",
                            "Product Area": "BrandCulture",
                            "Platform": orig.get("platform", "N/A").upper(),
                            "Source": "Earned",
                            "User": orig.get("author", "N/A"),
                            "Post": orig.get("text", "").replace("\n", " "),
                            "Interaction": "Like",
                            "Answer": "",
                            "Comment PMM": ""
                        })
                        
                # 3. Moderation
                for m_id, action in st.session_state.selected_moderation_actions.items():
                    orig = mentions_map.get(m_id)
                    if orig:
                        export_rows.append({
                            "Date": today_str,
                            "Status": "NEW",
                            "Product Area": "",
                            "Platform": orig.get("platform", "N/A").upper(),
                            "Source": "Earned",
                            "User": orig.get("author", "N/A"),
                            "Post": orig.get("text", "").replace("\n", " "),
                            "Interaction": action,
                            "Answer": "",
                            "Comment PMM": f"Flagged by AI triage as {action} candidate"
                        })
                        
                if export_rows:
                    st.session_state.exported_csv_data = export_rows
                    st.success("🎉 Action Sheet compiled successfully! Redirection to Step 3 Validation Desk...")
                    st.balloons()
                    time.sleep(1.5)
                    st.session_state.active_step = "Step 3"
                    st.rerun()
                else:
                    st.warning("No actions locked or vetted yet. Pick variation drafts above to populate your actions!")

# -----------------------------------------------------------------------------
# STEP 3: GENERATED REPORTS PREVIEWER & ACTION PLAN DESK
# -----------------------------------------------------------------------------
elif st.session_state.active_step == 'Step 3':
    if is_clist:
        st.markdown("### 📬 Generated Reports & Live Email Previews")
        st.markdown("Manage, preview, and extract your compiled editorial newsletter files or G.E.O. Community Action Plans locally.")
        
        # Read generated files
        all_outputs = [f for f in os.listdir(Config.OUTPUT_DIR) if os.path.isfile(os.path.join(Config.OUTPUT_DIR, f)) and f.endswith((".html", ".txt"))]
        all_outputs.sort(key=lambda x: os.path.getmtime(os.path.join(Config.OUTPUT_DIR, x)), reverse=True)
        
        if not all_outputs:
            st.info("No generated reports found. Run the Gemini pipeline to compile your first report!")
        else:
            st.markdown('<div class="section-header">📁 Reports Explorer</div>', unsafe_allow_html=True)
            
            # Select active report
            selected_report = st.selectbox("Select report file to preview:", options=all_outputs, key="report_select_tab3")
            
            if selected_report:
                report_path = os.path.join(Config.OUTPUT_DIR, selected_report)
                mod_time = datetime.datetime.fromtimestamp(os.path.getmtime(report_path)).strftime("%Y-%m-%d %H:%M:%S")
                file_size_kb = round(os.path.getsize(report_path) / 1024, 1)
                
                st.markdown(f"""
                💡 **File Details:**  
                - **Name:** `{selected_report}`  
                - **Generated on:** `{mod_time}`  
                - **File size:** `{file_size_kb} KB`
                """ )
                
                # Read content
                with open(report_path, "r", encoding="utf-8") as f:
                    report_content = f.read()
                    
                # Render views in expanders
                col_actions, col_preview_type = st.columns([1, 1])
                with col_actions:
                    # Direct download button
                    st.download_button(
                        label="⬇️ Download HTML File",
                        data=report_content,
                        file_name=selected_report,
                        mime="text/html",
                        use_container_width=True,
                        key="download_report_button"
                    )
                with col_preview_type:
                    st.info("💡 Tip: Copy the raw code below and inject it in Gmail using an email HTML inserter extension to send as a high-fidelity visual layout!")
                    
                # Create sub-tabs for Live Preview vs Raw Code
                prev_tab, code_tab = st.tabs(["👁️ Live Visual Preview (Responsive)", "💻 Raw HTML Code"])
                
                with prev_tab:
                    # Render inside an iframe safely!
                    st.markdown("**Live Email/Plan Iframe Render:**")
                    st.components.v1.html(report_content, height=700, scrolling=True)
                    
                with code_tab:
                    st.markdown("**Raw HTML Markup:**")
                    st.text_area("Copy Code (CTRL+A / CMD+A):", value=report_content, height=500, key="report_markup_text_area")
    else:
        st.markdown("### 🛡️ Active Social Moderation & Action Plan Desk")
        st.write("Review, search, and download your final vetted community actions spreadsheet directly from this dashboard.")
        
        exported_data = st.session_state.get("exported_csv_data")
        
        if not exported_data:
            st.info("💡 No active action sheet found. Please go to Step 2, lock in your desired reply variations, and click 'Generate Completed Export CSV' to load your action plan desk!")
        else:
            df_vetted = pd.DataFrame(exported_data)
            
            # Action Summary Metrics
            replies_count = len(df_vetted[df_vetted["Interaction"] == "Reply"])
            likes_count = len(df_vetted[df_vetted["Interaction"] == "Like"])
            hides_count = len(df_vetted[df_vetted["Interaction"] == "Hide"])
            deletes_count = len(df_vetted[df_vetted["Interaction"] == "Delete"])
            
            col_m1, col_m2, col_m3 = st.columns(3)
            with col_m1:
                st.markdown(f'<div class="metric-card"><div class="metric-value">{replies_count}</div><div class="metric-label">Vetted Written Replies</div></div>', unsafe_allow_html=True)
            with col_m2:
                st.markdown(f'<div class="metric-card"><div class="metric-value">{likes_count}</div><div class="metric-label">Scheduled Likes</div></div>', unsafe_allow_html=True)
            with col_m3:
                st.markdown(f'<div class="metric-card"><div class="metric-value">{hides_count + deletes_count}</div><div class="metric-label">Moderated Comments</div></div>', unsafe_allow_html=True)
            
            st.markdown('<div class="section-header">📥 Vetted Action Plan Download & Preview</div>', unsafe_allow_html=True)
            
            csv_string_vetted = df_vetted.to_csv(index=False, sep=",", encoding="utf-8")
            today_str = datetime.datetime.now().strftime("%Y-%m-%d")
            
            col_dl, col_space = st.columns([1, 2])
            with col_dl:
                st.download_button(
                    label="⬇️ Download Action Plan CSV",
                    data=csv_string_vetted,
                    file_name=f"Google_Social_Vetted_Actions_{today_str}.csv",
                    mime="text/csv",
                    use_container_width=True,
                    key="dl_vetted_actions_tab3"
                )
                
            st.dataframe(df_vetted, use_container_width=True, height=400, hide_index=True)
