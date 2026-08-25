# 📈 G.E.O. Social Copilot & Creators Monitor

## 🎯 The Core Brief
The mission of this project is to **monitor creator activity and brand mentions across social media platforms, identifying organic opportunities where Google France can proactively engage with high-value content.**

Instead of forcing you to manually watch hours of creator vlogs or parse thousands of spreadsheet rows, this tool runs locally as a terminal CLI or an interactive visual Web Dashboard. It automatically ingests social spreadsheets, downloads creator videos/audio, runs a deep multi-modal/audio audit with Google's `gemini-3-flash-preview`, and compiles ready-to-mail HTML summaries pinpointing exactly *where* and *how* we can engage.

---

## 🗺️ Dual Spreadsheet Input Routes & Workflows

The application automatically detects the type of spreadsheet loaded based on its sheets and columns, activating one of two tailored operational modes:

### Route A: Creator List & Partner Watchlist Route (`is_creator_list = True`)
This mode is automatically activated when the uploaded Excel workbook (`.xlsx` or `.xls`) contains worksheet names: **`Gemini Endorsers`** or **`Gemini Partners`**.

* **Primary Objective:** Proactively scan official co-marketing partners and brand advocates to find high-value engagement opportunities in their latest videos.
* **Core Workflow Steps:**
  1. **Ingest & Overview:** The system parses the custom Excel worksheets, classifying creators into **Co-Marketing Partners** (from the `Gemini Partners` sheet) and **Unpaid Endorsers / Brand Fans** (from the `Gemini Endorsers` sheet). It displays an overview of the monitored roster.
  2. **G.E.O. Video Slicer:** The operator selects a creator from the watchlist. The pipeline scrapes and retrieves their latest YouTube video automatically using `yt-dlp`. It downloads the video and uses `ffmpeg` to transcode/down-sample speech audio into a lightweight mono MP3 track (with custom duration slicing options to save API tokens).
  3. **G.E.O. Action Plan Generation:** Google's Gemini-3-Flash model is fed the audio segment and analyzes it against Google France Brand Guidelines. It identifies exact timestamps where products/topics are spoken about and drafts highly context-specific, witty, and helpful responses.
  4. **Output Report:** The system compiles a **G.E.O. Action Plan** HTML document (e.g., `output/GEO-Action-Plan-[CreatorName]-*.html`). This interactive page displays video metadata, specific engagement segments with timestamps, and Tone of Voice (TOV) compliant replies ready to copy-paste on YouTube.

### Route B: Brandwatch Mentions & Social Comments Route (`is_creator_list = False`)
This mode is activated when uploading standard CSV or Excel files containing raw social mentions (e.g., exports from Brandwatch social listening dashboards).

* **Primary Objective:** Fast triage of user comments and mentions across the web, identifying what to reply to, what to like, what to moderate, and generating on-brand responses.
* **Core Workflow Steps:**
  1. **Ingest & Normalization:** Ingests raw Brandwatch sheets, aligns columns (using the first-column anchor row with value `1` to locate the table start), and parses total mentions, peak estimated reach, and detected YouTube posts.
  2. **Interactive Triage & TOV Copilot (Web UI):**
     * **Auto-Triage:** Automatically triages raw comments using structured AI schemas into four discrete action categories:
       - **`earnedForResponse`**: Mentions requiring high-quality, helpful written replies.
       - **`mentionsForLike`**: Simple positive remarks that deserve only a "Like" reaction.
       - **`mentionsToHide`**: Mild trolls, spam, or off-topic comments.
       - **`mentionsToDelete`**: Dangerous, hateful, or abusive content.
     * **Interactive Dashboard:** The user can inspect individual comment rows, view recommended Tone of Voice (TOV) compliant replies, edit drafts with persistent custom text, select individual comments to "Like" or moderate, and lock choices.
  3. **CLI Mode Alternative:** If using the command line (`main.py`), high-volume spreadsheets (>400 rows) are automatically filtered by Estimated Reach to manage token usage, and detected YouTube posts can be queued for audio analysis.
  4. **Output Newsletter:** Compiles a beautifully formatted **Editorial Newsletter** HTML report (e.g., `output/Gemini-Creators-NL-*.txt` or HTML) aggregating brand sentiment, vertical topics, creator reach, and the finalized reply drafts.

---

## 💡 Project Context & Sourcing

### 1. Where It Runs & Core Libraries
This tool runs as a local Streamlit Web Dashboard (`app.py`) or command-line script (`main.py`) running on Python 3.8+. It relies on a few key, robust libraries:
- **`pandas` & `python-calamine`**: For high-performance, local spreadsheet parsing and data metric calculations.
- **`yt-dlp` & `static-ffmpeg`**: For downloading YouTube video files and instantly down-sampling/transcoding them to tiny, speech-optimized audio clips.
- **`google-genai`**: Powered by Google's state-of-the-art **`gemini-3-flash-preview`** model, which acts as the analytical brain to extract visual segment brand mentions and draft editorial texts.

### 2. Sourcing Your Spreadsheet Inputs (Brandwatch)
The Excel (`.xlsx`) or CSV (`.csv`) spreadsheets placed inside the `inputs/` folder are **raw data exports from Brandwatch social listening dashboards**. 

To generate these files inside Brandwatch, you must build search queries targeting a tailored list of prominent social creators. The query tracks exact author handles, display names, and common variations across social platforms, while excluding retweets and unrelated automated accounts.

### 3. How to Build Your Brandwatch Search Query
Below is a clean, shortened template showing how to construct a standard Brandwatch query for **3 sample creators** (matching handles, display names, and exclusions):

```sql
((author:@andieella OR @andieella OR "Andie Ella" OR AndieElla OR Andie_Ella)
  OR
  (author:@MarionCameleon OR @MarionCameleon OR "Marion Caméléon" OR MarionCameleon OR "Marion Moretti")
  OR
  (author:@AnnaRvr OR @AnnaRvr OR "Anna RVR" OR AnnaRvr OR "Anna Raverat"))
AND NOT ("RT" OR author:@grok)
```

By expanding this nesting structure to your entire creator roster, Brandwatch will compile all relevant social mentions into a single master sheet. You then export that sheet as an Excel file, drop it into the `inputs/` directory, and run the compiler.

---

## 🏗️ System Architecture Flow

The 4-step compilation pipeline processes raw spreadsheets and media clips into structured engagement recommendations. You can view the complete interactive flowchart of this system directly:

👉 **[View Interactive Vector System Architecture Diagram](system_architecture.html)**

| Step | Component | Action Description |
|---|---|---|
| **Step 1** | **`src/utils/file_manager.py`** | Ingests `.xlsx` or `.csv` files from `inputs/`. Normalizes columns, sorts by Reach, and extracts YouTube video links. |
| **Step 2** | **`src/utils/audio_extractor.py`** | Downloads queued YouTube videos with `yt-dlp` and uses `ffmpeg` to crop and transcode audio to low-bitrate mono MP3s. |
| **Step 3** | **`src/core/analyzer.py`** | Uploads transcode files to Google GenAI, waits for processing, and prompts Gemini to perform segment analysis and identify engagement windows. |
| **Step 4** | **`src/core/generator.py`** | Gathers compiled engagement intelligence and formats it into a standard, light-theme responsive HTML editorial newsletter. |

---

## 🧠 What Gemini Looks For Right Now

Currently, the analysis pipeline evaluates brand social spreadsheets and YouTube video segments through two distinct prompts:

1. **Brand Mention Analysis**: Gemini is fed normalized spreadsheet rows (reach, author, sentiment, full text) and instructed to aggregate key brand trends, sort mentions into core vertical topics, highlight notable creator reach, and surface negative/positive sentiment patterns.
2. **YouTube Video Analysis**: Gemini is fed the extracted mono speech audio segment (with visual video context if selected) and instructed to pinpoint exact time-intervals where the creator speaks about the brand, evaluate their messaging alignment, and outline any call-to-actions.

---

## 🛠️ How to Customize & Adapt This Project

To change the behavior of the AI or adapt this project to another context (e.g., product research, competitive benchmarking, sentiment monitors), follow these direct modification paths:

### 1. How to Change what the AI Looks For (Prompts)
All AI prompts, persona roles, and structured analysis instructions live inside:
👉 **[`src/prompts.py`](src/prompts.py)**

* **To change text brand rules**: Modify the `ANALYSIS_PROMPT` string. Here you can instruct the AI to change how it categorizes topics or what trends it prioritizes.
* **To change video/audio rules**: Modify the `YOUTUBE_ANALYSIS_PROMPT` string. If you want the AI to extract different segment metrics (e.g., transcription snippets, brand positioning score), update the detailed list instructions inside this prompt.

### 2. How to Change the Output Format & Newsletter Design
The final HTML layout and styling components are managed across two core files:
👉 **[`src/core/generator.py`](src/core/generator.py)**  
👉 **[`src/utils/templates.py`](src/utils/templates.py)**

* **To change JSON schema**: If you updated the prompts to return different attributes, update the schema validation dictionary inside `src/services/gemini.py` or `src/core/analyzer.py` to match the exact schema expected by the Gemini API.
* **To change newsletter styling**: The HTML structural templates, light-themed CSS color rules, and font definitions live inside `src/utils/templates.py`. You can modify standard typography, borders, and margins directly there.
* **To change newsletter layout blocks**: Modify `generate_html()` inside `src/core/generator.py` to add new sections, change the order of tables, or output a different format (such as Markdown or raw JSON instead of HTML).

---

## 🚀 Quick Setup & Usage

### 1. Installation
Install all required CLI interactive modules and dependencies:
```bash
python3 -m pip install -r requirements.txt
```

> [!TIP]
> **Environment Workaround:** If your virtual environment is tied to a different system user path, run dependencies and scripts directly targeting your main local python binary:
> `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 main.py`

### 2. Configure Environment Keys
Create a `.env` file in the root project directory:
```env
GOOGLE_API_KEY="AIzaSyYourActualGoogleGeminiAPIKeyHere"
```

### 3. Running the tool
You can choose to run this tool using our brand new **interactive Web Dashboard** or the **traditional Command Line Interface (CLI)**:

#### Option A: Running the Web Dashboard (Recommended)
Our new, modern Streamlit-based web dashboard provides a visual, tab-guided user interface that lets you easily manage your watchlist, preview data files, configure clipping limits, monitor real-time execution logs, and preview the compiled newsletter within a live interactive viewport.

To launch the Web Dashboard:
```bash
streamlit run app.py
```

#### Option B: Running the Command Line Interface (CLI)
If you prefer a lightweight terminal experience:
1. Drop your Excel (`.xlsx`) or CSV (`.csv`) spreadsheets inside the **`inputs/`** folder at the root directory.
2. Launch the terminal:
   ```bash
   python3 main.py
   ```
3. Follow the interactive prompts to select a file, configure audio-only or visual analysis limits, and execute.
4. Curated HTML newsletters are saved directly into the **`output/`** folder.

---

## 📧 How to Send via Gmail (Visual HTML Rendering)

To send your compiled newsletter visually through Gmail:
1. Open the compiled `.txt` file inside the `output/` folder and **copy** the entire HTML code.
2. Install a standard, free Chrome extension for email HTML injection (such as **HTML2Mail**, **Insert HTML by Mailibe**, or **HTML Inserter**).
3. Open Gmail, click **Compose**, and use the extension's compose button to paste the HTML code.
4. The extension will instantly convert the raw code into a gorgeous, high-fidelity visual email layout ready to send!
