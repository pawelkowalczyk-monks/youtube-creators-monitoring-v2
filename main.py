import sys
import os
import datetime
from src.core.config import Config
from src.utils.file_manager import FileManager
from src.core.analyzer import AnalyzerAgent
from src.core.generator import NewsletterAgent

# Rich UI utilities for terminal formatting
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, Confirm, IntPrompt
from rich.table import Table
from rich import box

console = Console()

# Robust directory resolution based on this file's absolute path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUTS_DIR = os.path.join(BASE_DIR, "inputs")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

def _yes_no(question: str, default: bool = True) -> bool:
    """Ask a yes/no question using Rich Confirm with a clear label."""
    return Confirm.ask(f"[bold]{question}[/]", default=default)

def _choose_file(files) -> str:
    """Display a numbered table of files and let the user pick one."""
    table = Table(show_header=True, header_style="bold magenta", box=box.ROUNDED)
    table.add_column("#", style="cyan", width=4, justify="center")
    table.add_column("Spreadsheet File", style="white")
    table.add_column("Size", style="green", justify="right")
    table.add_column("Last Modified", style="yellow")
    
    for idx, f in enumerate(files, 1):
        file_path = os.path.join(INPUTS_DIR, f)
        size_kb = round(os.path.getsize(file_path) / 1024, 1)
        mod_time = datetime.datetime.fromtimestamp(os.path.getmtime(file_path)).strftime("%Y-%m-%d %H:%M")
        table.add_row(str(idx), f, f"{size_kb} KB", mod_time)
        
    console.print(table)
    while True:
        choice = IntPrompt.ask("Select a spreadsheet file number (or 0 to quit)", default=0)
        if choice == 0:
            return ""
        if 1 <= choice <= len(files):
            return files[choice - 1]
        console.print("[red]Invalid choice – try again.[/]")

def _display_videos(videos):
    """Show videos in a table."""
    table = Table(title="YouTube Videos Detected", show_header=True, header_style="bold magenta", box=box.ROUNDED)
    table.add_column("#", style="cyan", width=4, justify="center")
    table.add_column("Author / Creator", style="green", width=25)
    table.add_column("Subscriber Reach", style="yellow", justify="right", width=16)
    table.add_column("Est. Views", style="blue", justify="right", width=12)
    table.add_column("YouTube URL", style="white", width=45)
    
    for i, v in enumerate(videos, 1):
        reach = f"{v.get('reach', 0):,}"
        views = f"{v.get('views', 0):,}"
        url = v.get('url', '')
        url_display = url if len(url) <= 45 else url[:42] + "..."
        table.add_row(str(i), v.get('author', 'Unknown')[:25], reach, views, url_display)
    console.print(table)

def _select_videos(videos) -> list:
    """Let the user pick numbers or 'all'."""
    while True:
        choice = Prompt.ask("Enter video numbers to analyze (e.g., 1,3) or 'all' to run all", default="all")
        if choice.lower() == "all":
            return [v["url"] for v in videos]
        indices = []
        valid = True
        for part in choice.split(','):
            part = part.strip()
            if not part.isdigit():
                valid = False
                break
            idx = int(part) - 1
            if idx < 0 or idx >= len(videos):
                valid = False
                break
            indices.append(idx)
        if valid:
            return [videos[i]["url"] for i in indices]
        console.print("[red]Invalid input – please use numbers separated by commas or 'all'.[/]")

def _duration_limit(audio_only: bool) -> int:
    """Prompt for a global duration limit in minutes; returns seconds."""
    console.print("\n[bold cyan]⏱️ Set Analysis Duration Limit[/bold cyan]")
    if not audio_only:
        console.print("[bold yellow]⚠️ Multimodal Video Guard Active: Full visual video analysis is capped at a maximum of 1 minute (60 seconds) to safeguard token usage limits.[/bold yellow]\n")
        limit_desc = "Maximum duration (minutes, max 1.0)"
    else:
        console.print("- Enter maximum duration in minutes (e.g., '1' for 1 minute, '5' for 5 minutes)")
        console.print("- The limit applies only if the video is longer than the limit")
        console.print("- Press Enter to analyze full-length audio tracks (saves speech tokens)\n")
        limit_desc = "Maximum duration (minutes, press Enter for full video)"
        
    inp = Prompt.ask(limit_desc, default="")
    if not inp:
        if not audio_only:
            console.print("[yellow]⚠️ Full-video selected, but multimodal analysis is clamped to 1.0 minute (60s) maximum.[/yellow]")
            return 60
        return None
    try:
        minutes = float(inp)
        seconds = int(minutes * 60)
        if not audio_only and seconds > 60:
            console.print("[yellow]⚠️ Clamping multimodal duration limit to 1.0 minute (60s) maximum.[/yellow]")
            return 60
        return seconds
    except ValueError:
        if not audio_only:
            console.print("[yellow]⚠️ Clamping multimodal duration limit to 1.0 minute (60s) maximum.[/yellow]")
            return 60
        console.print("[red]Invalid number – using full video.[/]")
        return None


def main():
    # Mask API key for secure welcome output
    api_key_masked = "Not Configured"
    if Config.GOOGLE_API_KEY:
        api_key_masked = Config.GOOGLE_API_KEY[:6] + "..." + Config.GOOGLE_API_KEY[-4:] if len(Config.GOOGLE_API_KEY) > 10 else "Configured"

    welcome_msg = (
        f"[bold white]Tessra Creators Monitor & Newsletter Compiler[/bold white]\n"
        f"[dim]Version 2.1.0 (CLI Mode - Light Theme Engine)[/dim]\n\n"
        f"• Active Model: [bold green]gemini-3-flash-preview[/bold green]\n"
        f"• Google API Key: [cyan]{api_key_masked}[/cyan]\n"
        f"• Project Path: [dim]{BASE_DIR}[/dim]"
    )
    console.print(Panel(welcome_msg, title="📈 [bold blue]CREATORS MONITOR CLI[/bold blue]", border_style="blue", box=box.ROUNDED))

    # 1. Validate Configuration
    try:
        Config.validate()
    except EnvironmentError as e:
        console.print(f"[red]❌ Configuration Error:[/] {e}")
        console.print("Please verify that your [bold].env[/bold] file contains [green]GOOGLE_API_KEY[/green].")
        sys.exit(1)

    # 2. Resolve & Ensure Directories
    os.makedirs(INPUTS_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    files = [f for f in os.listdir(INPUTS_DIR) if os.path.isfile(os.path.join(INPUTS_DIR, f)) and f.endswith((".xlsx", ".csv"))]
    if not files:
        console.print(f"\n[bold yellow]⚠️ No input spreadsheets found inside folder:[/bold yellow]\n[cyan]{INPUTS_DIR}[/cyan]")
        console.print("Please place your social listening Excel or CSV spreadsheets there and run the tool again.\n")
        sys.exit(0)
        
    console.print("\n[bold cyan]📁 Step 1: Select Spreadsheet Source[/bold cyan]")
    file_name = _choose_file(files)
    if not file_name:
        console.print("[yellow]Exiting tool.[/yellow]")
        sys.exit(0)
        
    file_path = os.path.join(INPUTS_DIR, file_name)

    # 3. Parse and Analyze Data
    console.print("\n[bold cyan]📊 Step 2: Parsing Input File[/bold cyan]")
    
    with console.status("[bold green]Analyzing file structure..."):
        parsed_data = FileManager.parse_file_data(file_path)
    
    if not parsed_data:
        console.print("[red]❌ Error: Could not parse file. Check that the spreadsheet is not empty or corrupted.[/red]")
        sys.exit(1)
    
    is_creator_list = parsed_data.get("is_creator_list", False)
    
    if is_creator_list:
        creators = parsed_data["creators"]
        # Render creator parse summary
        summary_table = Table(show_header=False, box=box.SIMPLE, padding=(0, 2))
        summary_table.add_row("Total Creators & Partners Loaded:", f"[bold green]{len(creators)} accounts[/bold green]")
        console.print(Panel(summary_table, title="👥 [bold]Creator List Summary[/]", border_style="green", box=box.ROUNDED))
        
        # Interactive Menu for G.E.O. Pipeline
        console.print("\n[bold cyan]🎯 Step 3: Select Creator/Video for G.E.O. Proactive Audit[/bold cyan]")
        console.print("1. [bold white]Search/Select Monitored Creator[/bold white] (extracts their latest video automatically)")
        console.print("2. [bold white]Enter a specific YouTube Video URL[/bold white] directly")
        console.print("3. [bold white]Show all loaded channels[/bold white]")
        
        choice = Prompt.ask("Your choice", choices=["1", "2", "3"], default="1")
        
        selected_video_url = ""
        creator_name = ""
        
        if choice == "3":
            # Display creators table
            table = Table(title="Google France Monitored Partners & Creators", show_header=True, header_style="bold magenta", box=box.ROUNDED)
            table.add_column("#", style="cyan", width=4, justify="center")
            table.add_column("Name", style="white", width=25)
            table.add_column("Type", style="green", width=12)
            table.add_column("Vertical/Niche", style="yellow", width=20)
            table.add_column("Channel URL", style="dim", width=45)
            
            for idx, c in enumerate(creators, 1):
                url_disp = c["url"] if len(c["url"]) <= 45 else c["url"][:42] + "..."
                table.add_row(str(idx), c["name"][:25], c["type"], c["vertical"][:20], url_disp)
            console.print(table)
            
            c_idx = IntPrompt.ask("Select a creator number to scan (or 0 to cancel)", default=0)
            if 1 <= c_idx <= len(creators):
                c = creators[c_idx - 1]
                creator_name = c["name"]
                with console.status(f"[bold green]Fetching latest video for {creator_name}..."):
                    video_info = FileManager.get_latest_video(c["url"])
                if video_info:
                    selected_video_url = video_info["url"]
                    console.print(f"[green]✅ Found latest video: [bold]\"{video_info['title']}\"[/bold] ({selected_video_url})[/green]")
                else:
                    console.print("[red]❌ Could not fetch latest video for this channel.[/red]")
                    sys.exit(1)
            else:
                console.print("[yellow]Exiting.[/yellow]")
                sys.exit(0)
                
        elif choice == "1":
            search_query = Prompt.ask("Enter creator name or part of it to search").strip().lower()
            matches = [c for c in creators if search_query in c["name"].lower()]
            
            if not matches:
                console.print("[red]No matching creators found.[/red]")
                sys.exit(0)
                
            table = Table(title="Matching Creators", show_header=True, header_style="bold magenta", box=box.ROUNDED)
            table.add_column("#", style="cyan", justify="center")
            table.add_column("Creator Name", style="white")
            table.add_column("Type", style="green")
            table.add_column("Vertical/Niche", style="yellow")
            
            for idx, c in enumerate(matches, 1):
                table.add_row(str(idx), c["name"], c["type"], c["vertical"])
            console.print(table)
            
            c_idx = IntPrompt.ask("Select a creator number (or 0 to cancel)", default=1)
            if 1 <= c_idx <= len(matches):
                c = matches[c_idx - 1]
                creator_name = c["name"]
                with console.status(f"[bold green]Fetching latest video for {creator_name}..."):
                    video_info = FileManager.get_latest_video(c["url"])
                if video_info:
                    selected_video_url = video_info["url"]
                    console.print(f"[green]✅ Found latest video: [bold]\"{video_info['title']}\"[/bold] ({selected_video_url})[/green]")
                else:
                    console.print("[red]❌ Could not fetch latest video for this channel.[/red]")
                    sys.exit(1)
            else:
                console.print("[yellow]Cancelled.[/yellow]")
                sys.exit(0)
                
        else: # choice == "2"
            selected_video_url = Prompt.ask("Enter YouTube Video URL")
            creator_name = Prompt.ask("Enter Creator Name (optional)", default="the creator")

        # Configuration for scanning
        selected_videos = [selected_video_url]
        analyze_videos = True
        audio_only = _yes_no("Extract & Analyze Audio-Only (highly recommended; saves video tokens)?", default=True)
        max_seconds = _duration_limit(audio_only)
        time_ranges = {selected_video_url: (0, max_seconds) if max_seconds else None}
        
    else:
        mentions = parsed_data.get("mentions_data", [])
        youtube_videos = parsed_data.get("youtube_videos", [])
        
        # Render basic parse summary
        summary_table = Table(show_header=False, box=box.SIMPLE, padding=(0, 2))
        summary_table.add_row("Total Mentions Loaded:", f"[bold green]{len(mentions)} rows[/bold green]")
        summary_table.add_row("YouTube Videos Detected:", f"[bold cyan]{len(youtube_videos)} links[/bold cyan]")
        console.print(Panel(summary_table, title="🔍 [bold]File Parsing Summary[/]", border_style="green", box=box.ROUNDED))

        # Filter mentions if count > 400
        if len(mentions) > 400:
            console.print(f"\n[bold yellow]⚠️ High volume detected: {len(mentions)} mentions found.[/bold yellow]")
            console.print("Processing more than 400 rows may exceed token rates. Highly recommended to select top mentions.")
            limit = IntPrompt.ask("How many mentions to analyze? (Top mentions by Reach will be selected)", default=400)
            
            with console.status("[bold green]Sorting and filtering mentions by Reach..."):
                mentions.sort(key=lambda x: x.get('reach', 0), reverse=True)
                parsed_data["mentions_data"] = mentions[:limit]
            
            console.print(f"[green]✅ Selected top {limit} mentions by Estimated Reach[/]")

        # Video selection
        analyze_videos = False
        selected_videos = []
        audio_only = False
        time_ranges = {}

        if youtube_videos:
            console.print(f"\n[bold cyan]🎥 Step 3: Video Analysis Setup[/bold cyan]")
            _display_videos(youtube_videos)
            
            if _yes_no("\nDo you want to run multi-modal analysis on these YouTube videos?"):
                audio_only = _yes_no("Extract & Analyze Audio-Only (highly recommended; saves video tokens)?", default=True)
                selected_videos = _select_videos(youtube_videos) if len(youtube_videos) > 1 else [youtube_videos[0]["url"]]
                max_seconds = _duration_limit(audio_only)
                for url in selected_videos:
                    time_ranges[url] = (0, max_seconds) if max_seconds else None
                analyze_videos = True
                console.print(f"\n[green]✅ Audio/Video segment extractor queued for {len(selected_videos)} clip(s).[/green]")

    # Run analysis
    console.print(f"\n[bold cyan]🚀 Step 4: Running Multi-Modal Gemini Intelligence Run[/bold cyan]")
    console.print("[dim]Downloading segments, converting codecs, and querying Gemini-3-Flash...[/dim]\n")
    
    try:
        analyzer = AnalyzerAgent()
        analysis_result = analyzer.analyze_mentions(
            parsed_data,
            analyze_videos=analyze_videos,
            selected_videos=selected_videos,
            audio_only=audio_only,
            time_ranges=time_ranges,
        )
    except KeyboardInterrupt:
        console.print("\n[red]❌ Operation cancelled by user.[/red]")
        sys.exit(0)
    except Exception as run_err:
        console.print(f"\n[bold red]❌ Analysis Pipeline Crashed:[/bold red] {run_err}")
        sys.exit(1)

    console.print("\n[bold green]✅ Multi-Modal Intelligence Run Complete![/bold green]")
    
    # Print preview
    if is_creator_list:
        console.print(Panel(f"[bold green]Structured G.E.O. Analysis Generated successfully![/bold green]\n\n{analysis_result[:1000]}...", title="⚡ [bold green]G.E.O. STRUCTURED JSON PREVIEW[/bold green]", border_style="green", box=box.ROUNDED))
    else:
        console.print(Panel(analysis_result, title="⚡ [bold green]RAW GEMINI INSIGHTS PREVIEW[/bold green]", border_style="green", box=box.ROUNDED))

    # --- Step 5: Layout Generation ---
    if is_creator_list:
        console.print("\n[bold blue]📧 Step 5: Generating G.E.O. Action Plan Layout[/bold blue]")
        
        with console.status("[bold green]Generating HTML G.E.O. Action Plan..."):
            newsletter_agent = NewsletterAgent()
            html_content = newsletter_agent.generate_html(analysis_result)
            
        # Generate filename
        date_str = datetime.datetime.now().strftime("%Y-%m-%d")
        filename = f"GEO-Action-Plan-{date_str}.html"
        file_path = os.path.join(OUTPUT_DIR, filename)
        
        # Save file
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html_content)
            
        success_panel = (
            f"🎉 [bold green]G.E.O. Action Plan Compiled Successfully![/bold green]\n\n"
            f"• Out File: [cyan]{file_path}[/cyan]\n"
            f"• Status: [bold]Ready to Deploy / Comment[/bold]\n\n"
            f"[dim]The HTML report has been generated at the file path above. Open it in any browser to review, copy the suggested comments, and post them on YouTube![/dim]"
        )
        console.print(Panel(success_panel, title="📬 [bold]G.E.O. COMPILATION SUCCESS[/bold]", border_style="green", box=box.ROUNDED))
    else:
        console.print("\n[bold blue]📧 Step 5: Generating Editorial Newsletter Layout[/bold blue]")
        
        with console.status("[bold green]Generating HTML Editorial Newsletter..."):
            newsletter_agent = NewsletterAgent()
            html_content = newsletter_agent.generate_html(analysis_result)
            
        # Generate filename
        date_str = datetime.datetime.now().strftime("%Y-%m-%d")
        filename = f"Gemini-Creators-NL-{date_str}.txt"
        file_path = os.path.join(OUTPUT_DIR, filename)
        
        # Save file
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html_content)
            
        success_panel = (
            f"🎉 [bold green]Newsletter Compiled Successfully![/bold green]\n\n"
            f"• Out File: [cyan]{file_path}[/cyan]\n"
            f"• Status: [bold]Ready to Deploy / Send[/bold]\n\n"
            f"[dim]The HTML payload is saved to the file above. You can copy its contents directly into any newsletter mail client.[/dim]"
        )
        console.print(Panel(success_panel, title="📬 [bold]COMPILATION SUCCESS[/bold]", border_style="green", box=box.ROUNDED))

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[red]Program terminated by user.[/]")
        sys.exit(0)
