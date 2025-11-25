#!/usr/bin/env python3
"""
Script to harvest NPC data from Regnum Fandom wiki.
Downloads NPC images from their Fandom pages and extracts metadata.
"""

import requests
from bs4 import BeautifulSoup
import os
import time
import re
import json
from pathlib import Path
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed


# Base paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
RODATA_DIR = PROJECT_ROOT / "rodata"
NPC_IMAGES_DIR = PROJECT_ROOT / "data" / "npc_images"
NPC_DATA_FILE = PROJECT_ROOT / "data" / "npc_fandom_data.json"

# Fandom base URL
FANDOM_BASE = "https://regnum.fandom.com/wiki/"

# NPC text files
NPC_FILES = [
    RODATA_DIR / "alsius_fandom_npcs.txt",
    RODATA_DIR / "ignis_fandom_npcs.txt",
    RODATA_DIR / "syrtis_fandom_npcs.txt"
]


def read_npc_names():
    """Read all NPC names from the text files."""
    npc_names = set()
    
    for file_path in NPC_FILES:
        if not file_path.exists():
            print(f"Warning: {file_path} not found")
            continue
            
        with open(file_path, 'r', encoding='utf-8') as f:
            # Skip header line
            lines = f.readlines()[1:]
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # Split by tab and get the first column (Name)
                parts = line.split('\t')
                if parts:
                    name = parts[0].strip()
                    if name:
                        npc_names.add(name)
    
    return sorted(npc_names)


def url_encode_npc_name(name):
    """
    Convert NPC name to URL-safe format for Fandom wiki.
    Replaces spaces with underscores and handles special characters.
    """
    # Replace spaces with underscores
    url_name = name.replace(' ', '_')
    # URL encode the name (handles apostrophes and other special chars)
    url_name = quote(url_name, safe='')
    return url_name


def fetch_npc_page(npc_name):
    """Fetch the Fandom page for an NPC."""
    url_name = url_encode_npc_name(npc_name)
    url = f"{FANDOM_BASE}{url_name}"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        print(f"Error fetching {npc_name}: {e}")
        return None


def extract_npc_data(html_content, expected_name):
    """
    Extract NPC data from the Fandom page HTML.
    Returns dict with name, image_url, and sex, or None if not found.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Find the NPC info table
    # Look for a table with the NPC name in a th element
    tables = soup.find_all('table')
    
    for table in tables:
        # Look for the name header
        th_elements = table.find_all('th', colspan="2")
        
        for th in th_elements:
            th_text = th.get_text(strip=True)
            
            # Check if this matches the expected NPC name
            if th_text == expected_name:
                # Found the right table, now get the image
                img_tag = table.find('img')
                img_url = None
                
                if img_tag and 'src' in img_tag.attrs:
                    img_url = img_tag['src']
                    
                    # Clean up the URL to get the latest revision
                    # Remove scale-to-width-down parameters and get base URL
                    if 'static.wikia.nocookie.net' in img_url:
                        # Extract base URL up to /revision/latest
                        match = re.search(r'(https://static\.wikia\.nocookie\.net/regnum/images/[^/]+/[^/]+/[^/]+\.jpg)/revision/latest', img_url)
                        if match:
                            img_url = match.group(1) + '/revision/latest'
                        else:
                            # Try to construct it from the URL
                            img_url = re.sub(r'/revision/latest/.*', '/revision/latest', img_url)
                
                # Extract sex/gender from the table
                sex = None
                rows = table.find_all('tr')
                for row in rows:
                    tds = row.find_all('td')
                    if len(tds) >= 2:
                        label = tds[0].get_text(strip=True)
                        if label.lower() == 'sex:':
                            sex = tds[1].get_text(strip=True)
                            break
                
                return {
                    'name': th_text,
                    'image_url': img_url,
                    'sex': sex
                }
    
    return None


def download_image(image_url, npc_name):
    """Download an image from URL and save it with the NPC name."""
    # Create images directory if it doesn't exist
    NPC_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    
    # Sanitize filename (remove special characters and replace spaces with underscores)
    safe_filename = re.sub(r'[<>:"/\\|?*]', '_', npc_name)
    safe_filename = safe_filename.replace(' ', '_')
    file_path = NPC_IMAGES_DIR / f"{safe_filename}.jpg"
    
    # Skip if already exists
    if file_path.exists():
        print(f"  Image already exists: {file_path.name}")
        return True
    
    try:
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        
        with open(file_path, 'wb') as f:
            f.write(response.content)
        
        print(f"  Downloaded: {file_path.name}")
        return True
        
    except requests.RequestException as e:
        print(f"  Error downloading image: {e}")
        return False


def process_npc(npc_name):
    """Process a single NPC: fetch page, extract data, download image."""
    print(f"Processing: {npc_name}")
    
    # Fetch the page
    html_content = fetch_npc_page(npc_name)
    if not html_content:
        print(f"  {npc_name}: Failed to fetch page")
        return npc_name, None
    
    # Extract data
    npc_data = extract_npc_data(html_content, npc_name)
    if not npc_data:
        print(f"  {npc_name}: Could not find NPC data in page")
        return npc_name, None
    
    # Verify name matches
    if npc_data['name'] != npc_name:
        print(f"  {npc_name}: Warning - Name mismatch. Expected '{npc_name}', found '{npc_data['name']}'")
    
    # Display sex if found
    if npc_data.get('sex'):
        print(f"  {npc_name}: Sex: {npc_data['sex']}")
    
    # Download image
    if npc_data['image_url']:
        download_image(npc_data['image_url'], npc_name)
    else:
        print(f"  {npc_name}: No image URL found")
    
    return npc_name, npc_data


def load_npc_database():
    """Load existing NPC database from JSON file."""
    if NPC_DATA_FILE.exists():
        with open(NPC_DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_npc_database(database):
    """Save NPC database to JSON file."""
    with open(NPC_DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(database, f, indent=2, ensure_ascii=False)


def main():
    """Main function to process all NPCs."""
    print("=" * 60)
    print("Regnum Fandom NPC Data Harvester")
    print("=" * 60)
    
    # Load existing database
    print("\nLoading existing NPC database...")
    npc_database = load_npc_database()
    print(f"Loaded {len(npc_database)} existing NPC records")
    
    # Read NPC names
    print("\nReading NPC names from text files...")
    npc_names = read_npc_names()
    print(f"Found {len(npc_names)} unique NPCs")
    
    # Check what needs processing
    needs_processing = []
    for npc_name in npc_names:
        if npc_name not in npc_database or not npc_database[npc_name].get('sex'):
            needs_processing.append(npc_name)
    
    print(f"Already processed: {len(npc_names) - len(needs_processing)}")
    print(f"To process: {len(needs_processing)}")
    
    if not needs_processing:
        print("\nAll NPCs already processed!")
        return
    
    # Process NPCs in parallel (10 at a time)
    success_count = 0
    fail_count = 0
    failed_npcs = []
    
    print(f"\nProcessing with 10 parallel workers...\n")
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        # Submit all tasks
        future_to_npc = {executor.submit(process_npc, npc_name): npc_name 
                         for npc_name in needs_processing}
        
        # Process completed tasks
        completed = 0
        for future in as_completed(future_to_npc):
            npc_name = future_to_npc[future]
            completed += 1
            
            try:
                name, data = future.result()
                if data:
                    npc_database[name] = data
                    success_count += 1
                    print(f"[{completed}/{len(needs_processing)}] ✓ {name}")
                else:
                    fail_count += 1
                    failed_npcs.append(name)
                    print(f"[{completed}/{len(needs_processing)}] ✗ {name}")
            except Exception as e:
                fail_count += 1
                failed_npcs.append(npc_name)
                print(f"[{completed}/{len(needs_processing)}] ✗ {npc_name}: {e}")
            
            # Save every 10 NPCs
            if completed % 10 == 0:
                save_npc_database(npc_database)
                print(f"  → Progress saved ({completed}/{len(needs_processing)})\n")
    
    # Final save
    save_npc_database(npc_database)
    
    # Summary
    print("\n" + "=" * 60)
    print(f"Processing complete!")
    print(f"  Success: {success_count}")
    print(f"  Failed:  {fail_count}")
    print(f"  Total:   {len(needs_processing)}")
    print(f"\nDatabase saved to: {NPC_DATA_FILE}")
    
    if failed_npcs:
        print(f"\nFailed NPCs:")
        for npc in failed_npcs:
            print(f"  - {npc}")
    
    print("=" * 60)


if __name__ == "__main__":
    main()
