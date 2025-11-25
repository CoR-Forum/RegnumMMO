#!/usr/bin/env python3
"""
Script to harvest NPC data from Regnum Fandom wiki.
Downloads NPC images from their Fandom pages.
"""

import requests
from bs4 import BeautifulSoup
import os
import time
import re
from pathlib import Path
from urllib.parse import quote


# Base paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
RODATA_DIR = PROJECT_ROOT / "rodata"
NPC_IMAGES_DIR = PROJECT_ROOT / "data" / "npc_images"

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
    Returns dict with name and image_url, or None if not found.
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
                    
                    return {
                        'name': th_text,
                        'image_url': img_url
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
    print(f"\nProcessing: {npc_name}")
    
    # Fetch the page
    html_content = fetch_npc_page(npc_name)
    if not html_content:
        print(f"  Failed to fetch page")
        return False
    
    # Extract data
    npc_data = extract_npc_data(html_content, npc_name)
    if not npc_data:
        print(f"  Could not find NPC data in page")
        return False
    
    # Verify name matches
    if npc_data['name'] != npc_name:
        print(f"  Warning: Name mismatch. Expected '{npc_name}', found '{npc_data['name']}'")
    
    # Download image
    if npc_data['image_url']:
        return download_image(npc_data['image_url'], npc_name)
    else:
        print(f"  No image URL found")
        return False


def main():
    """Main function to process all NPCs."""
    print("=" * 60)
    print("Regnum Fandom NPC Image Harvester")
    print("=" * 60)
    
    # Read NPC names
    print("\nReading NPC names from text files...")
    npc_names = read_npc_names()
    print(f"Found {len(npc_names)} unique NPCs")
    
    # Check how many already exist
    existing = 0
    for npc_name in npc_names:
        safe_filename = re.sub(r'[<>:"/\\|?*]', '_', npc_name)
        safe_filename = safe_filename.replace(' ', '_')
        file_path = NPC_IMAGES_DIR / f"{safe_filename}.jpg"
        if file_path.exists():
            existing += 1
    
    print(f"Already downloaded: {existing}")
    print(f"To download: {len(npc_names) - existing}")
    
    # Process each NPC
    success_count = 0
    fail_count = 0
    skipped_count = 0
    failed_npcs = []
    
    for i, npc_name in enumerate(npc_names, 1):
        print(f"\n[{i}/{len(npc_names)}]", end=" ")
        
        # Check if already exists
        safe_filename = re.sub(r'[<>:"/\\|?*]', '_', npc_name)
        safe_filename = safe_filename.replace(' ', '_')
        file_path = NPC_IMAGES_DIR / f"{safe_filename}.jpg"
        if file_path.exists():
            print(f"{npc_name} - Already exists (skipped)")
            skipped_count += 1
            continue
        
        if process_npc(npc_name):
            success_count += 1
        else:
            fail_count += 1
            failed_npcs.append(npc_name)
        
        # Be nice to the server - add a small delay
        time.sleep(0.5)
    
    # Summary
    print("\n" + "=" * 60)
    print(f"Processing complete!")
    print(f"  Success: {success_count}")
    print(f"  Failed:  {fail_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Total:   {len(npc_names)}")
    
    if failed_npcs:
        print(f"\nFailed NPCs:")
        for npc in failed_npcs:
            print(f"  - {npc}")
    
    print("=" * 60)


if __name__ == "__main__":
    main()
