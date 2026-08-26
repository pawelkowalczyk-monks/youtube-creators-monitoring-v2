import os
import json
import gspread
from google.oauth2.service_account import Credentials

def sync_rows_to_google_sheets(rows_to_append, credentials_json_str=None):
    """
    Appends the given list of dictionaries to the Google Sheet.
    
    Spreadsheet ID: 1LWrWCj3Jm-ZdbpQCZw5dkgXreL1Rj0DvmVUTXSRlRv8
    Sheet structure columns:
    Creator Name | Link | Hook / Starting Point | Timestamp (rough) | Proposed Response 1 | Proposed Response 2 | Proposed Response 3 | CM Validation | Client Validation
    """
    SPREADSHEET_ID = "1LWrWCj3Jm-ZdbpQCZw5dkgXreL1Rj0DvmVUTXSRlRv8"
    
    # 1. Resolve Credentials
    credentials = None
    
    if credentials_json_str:
        try:
            creds_info = json.loads(credentials_json_str)
            scopes = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
            credentials = Credentials.from_service_account_info(creds_info, scopes=scopes)
            print("✓ Loaded credentials from sidebar JSON override.")
        except Exception as e:
            raise ValueError(f"Failed parsing credentials JSON override: {e}")
            
    if not credentials:
        # Look for local files in the root folder
        search_files = ['service_account.json', 'credentials.json']
        for file in search_files:
            if os.path.exists(file):
                try:
                    scopes = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
                    credentials = Credentials.from_service_account_file(file, scopes=scopes)
                    print(f"✓ Loaded credentials from local file: '{file}'")
                    break
                except Exception as e:
                    print(f"Error loading credentials from '{file}': {e}")
                    
    if not credentials:
        raise FileNotFoundError("Google Sheets Credentials not found. Please upload or paste your 'service_account.json' key in the sidebar, or place it in the project root.")
        
    # 2. Authorize client
    client = gspread.authorize(credentials)
    
    # 3. Open spreadsheet
    try:
        sh = client.open_by_key(SPREADSHEET_ID)
        sheet = sh.get_worksheet(0) # Get the first sheet
    except Exception as e:
        raise ValueError(
            f"Failed to open Google Sheet. Please ensure that:\n"
            f"1. The sheet ID is correct.\n"
            f"2. You have SHARED the Google Sheet with your service account email as an 'Editor'!\n"
            f"Service Account Email: {credentials.service_account_email}\n"
            f"Error details: {e}"
        )
        
    # 4. Format rows to match the exact column layout
    raw_sheet_rows = []
    for r in rows_to_append:
        raw_sheet_rows.append([
            r.get("creator_name", ""),
            r.get("link", ""),
            r.get("hook", ""),
            r.get("timestamp", ""),
            r.get("prop1", ""),
            r.get("prop2", ""),
            r.get("prop3", ""),
            r.get("cm_validation", ""),
            r.get("client_validation", "")
        ])
        
    # 5. Append to sheet
    try:
        sheet.append_rows(raw_sheet_rows, value_input_option='USER_ENTERED')
        return len(raw_sheet_rows), credentials.service_account_email
    except Exception as e:
        raise ValueError(f"Failed writing rows to sheet: {e}")
