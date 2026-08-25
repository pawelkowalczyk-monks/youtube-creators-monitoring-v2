# 🎥 YouTube Downloader (yt-dlp) Rules & Best Practices Guide

This document outlines the core technical rules, parameter choices, and audio-slicing configurations employed by our downloader integration to ensure fast, robust, and token-optimized YouTube media ingestion.

---

## ⚙️ Core Technical Rules & Configurations

### 1. SSL/Certificate Bypass
* **Rule**: Always set `'nocheckcertificate': True`.
* **Rationale**: Some local corporate routers, firewalls, or customized developer machines block standard SSL certificates. Setting this to `True` bypasses security blocks, ensuring zero connection failures.

### 2. Format Optimization (Audio-Only Focus)
* **Rule**: Use `'format': 'bestaudio/best'` and the `'FFmpegExtractAudio'` postprocessor.
* **Rationale**: Sourcing raw audio tracks instead of full high-definition video files dramatically reduces downloading bandwidth, speeds up execution, and prevents disk space bloat.

### 3. Speech-to-Text Audio Profile Alignment
* **Rule**: Down-sample all extracted audio to a standard **mono speech AI format**:
  - **Sample Rate**: `16000 Hz` (16kHz - standard for Gemini speech parsing)
  - **Channels**: `1` (mono)
  - **Bitrate**: `32 kbps`
* **Implementation** (`yt-dlp` postprocessor arguments):
  ```python
  'postprocessor_args': [
      '-ac', '1',      # Mono channels
      '-ar', '16000',  # 16kHz
      '-b:a', '32k',   # 32kbps bitrate
  ]
  ```
* **Rationale**: Minimizes the output file size (reducing 5MB downloads down to under 500KB) while maintaining extreme vocal clarity. This ensures rapid uploads to the Gemini API and saves massive token overhead.

### 4. Direct Interval Trimming
* **Rule**: Crop the media file boundary using FFmpeg clipping parameters (`-ss <start>`, `-t <duration>`) as postprocessor arguments rather than downloading the entire multi-hour YouTube stream.
* **Rationale**: Crucial for token conservation. If a video is hours long, slicing only the relevant 1-minute segment ensures we stay within strict API token limit safe-guards.

### 5. Console output Control
* **Rule**: Suppress verbose download progress loops (`'quiet': True`, `'no_warnings': True`) to avoid polluting the terminal console with raw carriage-returns (`\r`) or messy progress percent streams.
* **Practice**: Print clear, custom human-readable progress checkpoints instead (e.g., `🎬 Downloading YouTube video source...`).

---

## 💡 Troubleshooting & Network Tips

- **Age Gate Blocks**: If yt-dlp fails with `"Sign in to confirm your age"`, configure cookies using Netscape-format cookie files from a browser session by adding `'cookiefile': 'cookies.txt'` to your configuration options.
- **Geoblocks / Rate Limits**: YouTube sometimes rate-limits continuous requests. If downloads freeze or time out, use residential proxy configurations via the `'proxy'` parameter, or space video runs using execution pauses (the CLI automatically spaces multiple video downloads by 50 seconds to respect API limits).
