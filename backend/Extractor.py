import PyPDF2
import pymupdf
import re
from pathlib import Path
import pandas as pd
from collections import defaultdict

def extract_document_name_from_pdf(pdf_path):
    """
    Extract document name from PDF.
    First tries to get it from the first page text, then falls back to filename.

    Args:
        pdf_path: Path to the PDF file

    Returns:
        str: Document name
    """
    try:
        doc = pymupdf.open(pdf_path)
        if doc.page_count > 0:
            # Get text from first page
            first_page = doc[0]
            text = first_page.get_text()
            lines = text.split('\n')

            # Look for a title in the first few lines (skip empty lines)
            for line in lines[:10]:
                line = line.strip()
                # Skip very short lines, page numbers, and common headers
                if len(line) > 10 and not line.isdigit() and not line.lower().startswith(('page', 'chapter')):
                    # This is likely the document title
                    doc.close()
                    return clean_text_for_excel(line)

        doc.close()
    except Exception as e:
        print(f"Could not extract document name from first page: {e}")

    # Fallback to filename without extension
    return Path(pdf_path).stem

def extract_toc_pypdf2(pdf_path):
    """Extract TOC using PyPDF2 (reads PDF bookmarks/outlines)"""
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            outlines = reader.outline
            
            if not outlines:
                return None
            
            toc = []
            
            def parse_outline(outline_items, level=1):
                for item in outline_items:
                    if isinstance(item, list):
                        parse_outline(item, level + 1)
                    else:
                        title = item.title if hasattr(item, 'title') else str(item)
                        page = reader.get_destination_page_number(item) + 1 if hasattr(item, 'page') else None
                        toc.append({
                            'title': title,
                            'page': page,
                            'level': level
                        })
            
            parse_outline(outlines)
            return toc
    except Exception as e:
        print(f"PyPDF2 extraction failed: {e}")
        return None

def extract_toc_pymupdf(pdf_path):
    """Extract TOC using PyMuPDF (more reliable for embedded TOC)"""
    try:
        doc = pymupdf.open(pdf_path)
        toc = doc.get_toc()
        doc.close()
        
        if not toc:
            return None
        
        return [{'level': item[0], 'title': item[1], 'page': item[2]} for item in toc]
    except Exception as e:
        print(f"PyMuPDF extraction failed: {e}")
        return None

def calculate_hierarchy_level(numbering):
    """Calculate hierarchy level based on numbering format"""
    numbering = numbering.rstrip('.')
    
    if '.' in numbering:
        level = numbering.count('.') + 1
    else:
        level = 1
    
    return level

def detect_toc_from_text(pdf_path, max_pages=20):
    """Attempt to detect TOC by analyzing text content in first pages"""
    try:
        doc = pymupdf.open(pdf_path)
        
        toc_patterns = [
            (r'^((?:\d+\.)+\d*)\s+(.+?)[\s\.]{3,}(\d+)$', 'numbered'),
            (r'^((?:\d+\.)+)\s+(.+?)[\s\.]{3,}(\d+)$', 'numbered'),
            (r'^(Chapter|CHAPTER)\s+(\d+)[\s:\.]+(.+?)[\s\.]{3,}(\d+)$', 'chapter'),
            (r'^([IVXLCDM]+\.?)\s+(.+?)[\s\.]{3,}(\d+)$', 'roman'),
            (r'^(\d+)\s+(.+?)[\s\.]{3,}(\d+)$', 'simple'),
        ]
        
        toc = []
        
        for page_num in range(min(max_pages, doc.page_count)):
            page = doc[page_num]
            text = page.get_text()
            lines = text.split('\n')
            
            for line in lines:
                line = line.strip()
                if not line or len(line) < 10:
                    continue
                
                for pattern, pattern_type in toc_patterns:
                    match = re.match(pattern, line)
                    if match:
                        groups = match.groups()
                        
                        if pattern_type == 'numbered':
                            numbering = groups[0]
                            title = groups[1].strip()
                            page_no = int(groups[2])
                            level = calculate_hierarchy_level(numbering)
                            
                            toc.append({
                                'level': level,
                                'title': f"{numbering} {title}",
                                'page': page_no,
                                'numbering': numbering
                            })
                            
                        elif pattern_type == 'chapter':
                            toc.append({
                                'level': 1,
                                'title': f"{groups[0]} {groups[1]}: {groups[2]}",
                                'page': int(groups[3]),
                                'numbering': groups[1]
                            })
                            
                        elif pattern_type == 'roman' or pattern_type == 'simple':
                            numbering = groups[0].rstrip('.')
                            title = groups[1].strip()
                            page_no = int(groups[2])
                            
                            toc.append({
                                'level': 1,
                                'title': f"{numbering}. {title}",
                                'page': page_no,
                                'numbering': numbering
                            })
                        
                        break
        
        doc.close()
        return toc if toc else None
    except Exception as e:
        print(f"Text-based detection failed: {e}")
        return None

def extract_pdf_toc(pdf_path):
    """Extract TOC using multiple methods"""
    pdf_path = Path(pdf_path)
    
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
    
    print(f"Analyzing PDF: {pdf_path.name}")
    print("=" * 60)
    
    print("\n[1] Attempting extraction with PyMuPDF...")
    toc = extract_toc_pymupdf(pdf_path)
    if toc:
        print(f"✓ Successfully extracted {len(toc)} TOC entries")
        return toc
    
    print("\n[2] Attempting extraction with PyPDF2...")
    toc = extract_toc_pypdf2(pdf_path)
    if toc:
        print(f"✓ Successfully extracted {len(toc)} TOC entries")
        return toc
    
    print("\n[3] Attempting text-based TOC detection...")
    toc = detect_toc_from_text(pdf_path)
    if toc:
        print(f"✓ Detected {len(toc)} potential TOC entries")
        return toc
    
    print("\n✗ No TOC found in this PDF")
    return []

def clean_text_for_excel(text):
    """Remove illegal characters for Excel compatibility"""
    if not text:
        return ""
    
    # Remove control characters except tab, newline, and carriage return
    # Excel doesn't allow control characters in the range 0x00-0x1F except 0x09, 0x0A, 0x0D
    import unicodedata
    
    cleaned = []
    for char in text:
        code = ord(char)
        # Keep printable characters, tab, newline, carriage return
        if code >= 0x20 or code in (0x09, 0x0A, 0x0D):
            cleaned.append(char)
        # Skip other control characters
    
    result = ''.join(cleaned)
    
    # Also remove null bytes and other problematic characters
    result = result.replace('\x00', '')
    result = result.replace('\x0b', '')  # Vertical tab
    result = result.replace('\x0c', '')  # Form feed
    
    # Replace problematic Unicode characters that might not render
    result = result.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')
    
    return result

def normalize_text_for_matching(text):
    """Normalize text for fuzzy matching by removing extra whitespace and special chars."""
    if not text:
        return ""
    # Remove extra whitespace, normalize to lowercase
    normalized = ' '.join(text.split()).lower()
    # Remove common punctuation that might differ
    normalized = normalized.replace(':', '').replace('.', '').replace(',', '')
    return normalized

def fuzzy_title_match(title, line_text, threshold=0.7):
    """
    Check if title matches line_text using fuzzy matching.

    Args:
        title: The section title to find
        line_text: The line of text to check
        threshold: Similarity threshold (0.0 to 1.0)

    Returns:
        True if there's a match, False otherwise
    """
    # Exact match (case-insensitive)
    if title.lower() in line_text.lower():
        return True

    # Normalize both strings
    norm_title = normalize_text_for_matching(title)
    norm_line = normalize_text_for_matching(line_text)

    # Check normalized match
    if norm_title in norm_line:
        return True

    # Check if significant words from title appear in line
    title_words = [w for w in norm_title.split() if len(w) > 3]
    if not title_words:
        return False

    # Count how many significant words match
    matches = sum(1 for word in title_words if word in norm_line)
    similarity = matches / len(title_words)

    return similarity >= threshold

def extract_section_content(pdf_path, section_title, start_page, end_page, next_section_title=None):
    """
    Extract text content for a specific section with precise boundary detection.

    This method extracts only the content that belongs to the specified section,
    not the entire page content. It uses position-based extraction to identify
    where the section starts and stops.

    Args:
        pdf_path: Path to the PDF file
        section_title: Title of the current section (to find where it starts)
        start_page: Page number where the section starts (1-based)
        end_page: Page number where the section ends (1-based), or None for last section
        next_section_title: Title of the next section (to know where to stop), or None

    Returns:
        Extracted text content for this section only
    """
    try:
        doc = pymupdf.open(pdf_path)
        text_content = []
        section_started = False
        lines_checked = 0
        max_lines_to_check = 50  # Check first 50 lines for title

        # Adjust for 0-based indexing
        start_idx = start_page - 1
        end_idx = min(end_page, doc.page_count) if end_page else doc.page_count

        for page_num in range(start_idx, end_idx):
            page = doc[page_num]

            # Get text blocks with position information
            blocks = page.get_text("dict", flags=11)["blocks"]

            for block in blocks:
                # Skip image blocks
                if block.get("type") != 0:
                    continue

                # Process text blocks
                for line in block.get("lines", []):
                    line_text = ""
                    for span in line.get("spans", []):
                        line_text += span.get("text", "")

                    line_text = line_text.strip()
                    if not line_text:
                        continue

                    # Check if this is the start of our section
                    if not section_started:
                        lines_checked += 1

                        # Use fuzzy matching to find the section title
                        if fuzzy_title_match(section_title, line_text):
                            section_started = True
                            print(f"  ✓ Found section start: '{section_title}' matched '{line_text}'")
                            # Don't include the title itself in the content
                            continue

                        # If we've checked many lines and still haven't found the title,
                        # start extracting anyway (fallback behavior)
                        if lines_checked > max_lines_to_check and page_num == start_idx:
                            print(f"  ⚠️  Could not find exact title match for '{section_title}' on page {start_page}, extracting from start of page")
                            section_started = True
                            # Include this line since we're starting extraction

                    # Check if we've reached the next section
                    if section_started and next_section_title:
                        if fuzzy_title_match(next_section_title, line_text):
                            # We've reached the next section, stop here
                            print(f"  ✓ Found next section: '{next_section_title}' matched '{line_text}'")
                            doc.close()
                            raw_text = "\n".join(text_content)
                            return clean_text_for_excel(raw_text)

                    # Add content if we're in the section
                    if section_started:
                        text_content.append(line_text)

        doc.close()
        raw_text = "\n".join(text_content)

        # Log if we got empty content
        if not raw_text.strip():
            print(f"  ⚠️  Empty content extracted for section '{section_title}' (pages {start_page}-{end_page})")

        # Clean text for Excel compatibility
        return clean_text_for_excel(raw_text)
    except Exception as e:
        print(f"Error extracting section content: {e}")
        return ""


def extract_text_between_pages(pdf_path, start_page, end_page):
    """
    Extract text content between two page numbers (legacy method).

    WARNING: This method extracts entire pages, which may include content
    from multiple sections. Use extract_section_content() for more accurate
    section-based extraction.
    """
    try:
        doc = pymupdf.open(pdf_path)
        text_content = []

        # Adjust for 0-based indexing
        for page_num in range(start_page - 1, min(end_page, doc.page_count)):
            page = doc[page_num]
            text = page.get_text()
            if text.strip():
                text_content.append(text.strip())

        doc.close()
        raw_text = "\n\n".join(text_content)

        # Clean text for Excel compatibility
        return clean_text_for_excel(raw_text)
    except Exception as e:
        print(f"Error extracting text: {e}")
        return ""

def build_hierarchy_structure(toc):
    """Build hierarchical structure with parent tracking"""
    hierarchy = []
    parent_stack = [None, None, None, None, None]  # Track parents for each level
    
    for i, entry in enumerate(toc):
        level = entry['level']
        title = entry['title']
        page = entry['page']
        
        # Determine the next page (end of this section)
        next_page = toc[i + 1]['page'] if i + 1 < len(toc) else None
        
        # Update parent stack
        parent_stack[level - 1] = title
        # Clear deeper levels
        for j in range(level, len(parent_stack)):
            parent_stack[j] = None
        
        hierarchy.append({
            'level': level,
            'chapter': parent_stack[0] if level >= 1 else None,
            'section': parent_stack[1] if level >= 2 else None,
            'subsection': parent_stack[2] if level >= 3 else None,
            'subsubsection': parent_stack[3] if level >= 4 else None,
            'title': title,
            'start_page': page,
            'end_page': next_page
        })
    
    return hierarchy

def create_excel_with_content(pdf_path, toc, output_excel):
    """Create Excel file with TOC hierarchy and extracted content"""
    print("\n" + "=" * 60)
    print("Building hierarchical structure and extracting content...")
    print("=" * 60)

    # Extract document name from PDF
    document_name = extract_document_name_from_pdf(pdf_path)
    print(f"Document Name: {document_name}")

    hierarchy = build_hierarchy_structure(toc)

    # Prepare data for Excel
    excel_data = []

    for i, item in enumerate(hierarchy):
        print(f"\nProcessing [{i+1}/{len(hierarchy)}]: {item['title']}")
        print(f"  Pages: {item['start_page']} to {item['end_page'] or 'end'}")

        # Determine the next section's title for boundary detection
        next_section_title = None
        if i + 1 < len(hierarchy):
            next_section_title = hierarchy[i + 1]['title']

        # Extract content using position-aware method
        if item['end_page']:
            content = extract_section_content(
                pdf_path,
                item['title'],
                item['start_page'],
                item['end_page'],
                next_section_title
            )
        else:
            # Last section - extract to end of document
            doc = pymupdf.open(pdf_path)
            content = extract_section_content(
                pdf_path,
                item['title'],
                item['start_page'],
                doc.page_count + 1,
                next_section_title
            )
            doc.close()

        # Truncate content preview for Excel (keep first 5000 chars)
        content_preview = content[:5000] + "..." if len(content) > 5000 else content

        excel_data.append({
            'Document_Name': document_name,
            'Level': item['level'],
            'Chapter': clean_text_for_excel(item['chapter'] or ''),
            'Section': clean_text_for_excel(item['section'] or ''),
            'Subsection': clean_text_for_excel(item['subsection'] or ''),
            'Subsubsection': clean_text_for_excel(item['subsubsection'] or ''),
            'Full_Title': clean_text_for_excel(item['title']),
            'Start_Page': item['start_page'],
            'End_Page': item['end_page'] or 'END',
            'Content': content_preview,
            'Content_Length': len(content)
        })
    
    # Create DataFrame
    df = pd.DataFrame(excel_data)

    # Save to Excel with formatting
    with pd.ExcelWriter(output_excel, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='TOC_with_Content', index=False)

        # Get workbook and worksheet
        workbook = writer.book
        worksheet = writer.sheets['TOC_with_Content']

        # Adjust column widths
        worksheet.column_dimensions['A'].width = 30  # Document_Name
        worksheet.column_dimensions['B'].width = 8   # Level
        worksheet.column_dimensions['C'].width = 30  # Chapter
        worksheet.column_dimensions['D'].width = 30  # Section
        worksheet.column_dimensions['E'].width = 30  # Subsection
        worksheet.column_dimensions['F'].width = 30  # Subsubsection
        worksheet.column_dimensions['G'].width = 40  # Full_Title
        worksheet.column_dimensions['H'].width = 12  # Start_Page
        worksheet.column_dimensions['I'].width = 12  # End_Page
        worksheet.column_dimensions['J'].width = 80  # Content
        worksheet.column_dimensions['K'].width = 15  # Content_Length

        # Enable text wrapping for content column
        from openpyxl.styles import Alignment
        for row in worksheet.iter_rows(min_row=2, max_row=len(excel_data)+1, min_col=10, max_col=10):
            for cell in row:
                cell.alignment = Alignment(wrap_text=True, vertical='top')
    
    print(f"\n✓ Excel file created: {output_excel}")
    print(f"  Total entries: {len(excel_data)}")
    return df

def print_toc_summary(toc):
    """Print a summary of the TOC"""
    if not toc:
        print("\nNo TOC entries to display")
        return
    
    print("\nTable of Contents Summary:")
    print("=" * 70)
    
    level_names = {1: "CHAPTER", 2: "Section", 3: "Subsection", 4: "Subsubsection"}
    
    for entry in toc:
        level = entry['level']
        indent = "  " * (level - 1)
        page_str = f"Page {entry['page']}" if entry['page'] else "N/A"
        level_name = level_names.get(level, f"Level-{level}")
        
        print(f"{indent}[{level_name}] {entry['title']} ... {page_str}")

# Main execution
if __name__ == "__main__":
    # Replace with your PDF path
    pdf_file = "3.pdf"
    output_excel = "3.xlsx"
    
    try:
        # Extract TOC
        toc = extract_pdf_toc(pdf_file)
        
        if toc:
            # Print summary
            print_toc_summary(toc)
            
            # Create Excel with content
            df = create_excel_with_content(pdf_file, toc, output_excel)
            
            print("\n" + "=" * 60)
            print("DONE! Check the Excel file for complete structure.")
            print("=" * 60)
        else:
            print("\nNo TOC found. Cannot create Excel file.")
            
    except FileNotFoundError as e:
        print(f"Error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()