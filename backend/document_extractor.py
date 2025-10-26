#!/usr/bin/env python3
"""
PDF Document Content Extractor

This module extracts content from PDF documents and organizes it into
a hierarchical structure (section, subsection, subsubsection, subsubsubsection, content).

Supported formats:
- PDF (.pdf)
"""

import re
import pandas as pd
import PyPDF2
import fitz  # PyMuPDF
from pathlib import Path
import logging
from typing import List, Dict, Tuple, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class DocumentExtractor:
    """Extract content from PDF documents."""

    # Supported file extensions
    SUPPORTED_EXTENSIONS = {
        'pdf': 'PDF Document',
    }

    @staticmethod
    def extract_document_name_from_pdf(pdf_path: str) -> str:
        """
        Extract document name from PDF.
        First tries to get it from the first page text, then falls back to filename.

        Args:
            pdf_path: Path to the PDF file

        Returns:
            str: Document name
        """
        try:
            doc = fitz.open(pdf_path)
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
                        # Clean the text for Excel compatibility
                        cleaned = []
                        for char in line:
                            code = ord(char)
                            if code >= 0x20 or code in (0x09, 0x0A, 0x0D):
                                cleaned.append(char)
                        result = ''.join(cleaned)
                        result = result.replace('\x00', '').replace('\x0b', '').replace('\x0c', '')
                        return result.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')

            doc.close()
        except Exception as e:
            logger.debug(f"Could not extract document name from first page: {e}")

        # Fallback to filename without extension
        return Path(pdf_path).stem
    
    @staticmethod
    def is_roman_numeral(s: str) -> bool:
        """Check if string is a valid Roman numeral."""
        if not s:
            return False
        # Valid Roman numeral pattern
        pattern = r'^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$'
        return bool(re.match(pattern, s.upper()))

    def __init__(self):
        # Patterns to identify different heading levels - CORRECTED for academic documents
        self.heading_patterns = {
            'section': [
                r'^(\d+)\s+(.+)$',  # 1 Chapter Title (single digit for chapters)
                r'^(Chapter\s+\d+)\s*$',  # Chapter 1 (standalone)
                r'^(Chapter\s+\d+)\s*[:\-]?\s*(.+)$',  # Chapter 1: Title
                r'^(CHAPTER\s+\d+)\s*[:\-]?\s*(.+)$',  # CHAPTER 1: Title
            ],
            'subsection': [
                r'^(\d+\.\d+)\s*$',  # 1.1 (standalone number)
                r'^(\d+\.\d+)\s+(.+)$',  # 1.1 Section Title
            ],
            'subsubsection': [
                r'^(\d+\.\d+\.\d+)\s*$',  # 1.1.1 (standalone number)
                r'^(\d+\.\d+\.\d+)\s+(.+)$',  # 1.1.1 Subsection Title
            ],
            'subsubsubsection': [
                r'^(\d+\.\d+\.\d+\.\d+)\s*$',  # 1.1.1.1 (standalone number)
                r'^(\d+\.\d+\.\d+\.\d+)\s+(.+)$',  # 1.1.1.1 Subsubsection Title
            ]
        }
    
    @classmethod
    def get_supported_extensions(cls) -> set:
        """Return set of supported file extensions."""
        return set(cls.SUPPORTED_EXTENSIONS.keys())
    
    @classmethod
    def is_supported(cls, filename: str) -> bool:
        """Check if file format is supported."""
        ext = Path(filename).suffix.lower().lstrip('.')
        return ext in cls.SUPPORTED_EXTENSIONS
    
    def extract_text(self, file_path: str) -> List[str]:
        """
        Extract text from PDF document.
        Returns list of text pages.
        """
        ext = Path(file_path).suffix.lower().lstrip('.')

        logger.info(f"Extracting text from {ext.upper()} file: {file_path}")

        if ext == 'pdf':
            return self._extract_from_pdf(file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}. Only PDF files are supported.")
    
    def _extract_from_pdf(self, pdf_path: str) -> List[str]:
        """Extract text from PDF using PyMuPDF."""
        try:
            doc = fitz.open(pdf_path)
            pages_text = []

            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text = page.get_text()
                pages_text.append(text)
                logger.info(f"Extracted text from PDF page {page_num + 1}")

            doc.close()
            return pages_text

        except Exception as e:
            logger.error(f"Error extracting text with PyMuPDF: {e}")
            # Fallback to PyPDF2
            return self._extract_pdf_with_pypdf2(pdf_path)

    def extract_pdf_toc(self, pdf_path: str) -> List[Dict]:
        """
        Extract PDF Table of Contents using multiple methods.

        Args:
            pdf_path: Path to PDF file

        Returns:
            List of TOC entries with level, title, and page
        """
        try:
            logger.info(f"Analyzing PDF: {Path(pdf_path).name}")

            # Method 1: Try PyMuPDF TOC
            logger.info("[1] Attempting extraction with PyMuPDF...")
            toc = self._extract_toc_pymupdf(pdf_path)
            if toc:
                logger.info(f"✓ Successfully extracted {len(toc)} TOC entries")
                return toc

            # Method 2: Try PyPDF2 Bookmarks
            logger.info("[2] Attempting extraction with PyPDF2...")
            toc = self._extract_toc_pypdf2(pdf_path)
            if toc:
                logger.info(f"✓ Successfully extracted {len(toc)} TOC entries")
                return toc

            # Method 3: Try text-based detection
            logger.info("[3] Attempting text-based TOC detection...")
            toc = self._detect_toc_from_text(pdf_path)
            if toc:
                logger.info(f"✓ Detected {len(toc)} potential TOC entries")
                return toc

            logger.warning("✗ No TOC found in this PDF")
            return []

        except Exception as e:
            logger.error(f"Error extracting PDF TOC: {e}")
            return []

    def _extract_toc_pymupdf(self, pdf_path: str) -> List[Dict]:
        """Extract TOC using PyMuPDF (more reliable for embedded TOC)"""
        try:
            doc = fitz.open(pdf_path)
            toc = doc.get_toc()
            doc.close()

            if not toc:
                return []

            return [{'level': item[0], 'title': item[1], 'page': item[2]} for item in toc]
        except Exception as e:
            logger.debug(f"PyMuPDF extraction failed: {e}")
            return []

    def _extract_toc_pypdf2(self, pdf_path: str) -> List[Dict]:
        """Extract TOC using PyPDF2 (reads PDF bookmarks/outlines)"""
        try:
            with open(pdf_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                outlines = reader.outline

                if not outlines:
                    return []

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
            logger.debug(f"PyPDF2 extraction failed: {e}")
            return []

    def _calculate_hierarchy_level(self, numbering: str) -> int:
        """Calculate hierarchy level based on numbering format"""
        numbering = numbering.rstrip('.')

        if '.' in numbering:
            level = numbering.count('.') + 1
        else:
            level = 1

        return level

    def _detect_toc_from_text(self, pdf_path: str, max_pages: int = 20) -> List[Dict]:
        """Attempt to detect TOC by analyzing text content in first pages"""
        try:
            doc = fitz.open(pdf_path)

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
                                level = self._calculate_hierarchy_level(numbering)

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
            return toc if toc else []
        except Exception as e:
            logger.debug(f"Text-based detection failed: {e}")
            return []

    def _clean_text_for_excel(self, text: str) -> str:
        """Remove illegal characters for Excel compatibility"""
        if not text:
            return ""

        # Remove control characters except tab, newline, and carriage return
        cleaned = []
        for char in text:
            code = ord(char)
            # Keep printable characters, tab, newline, carriage return
            if code >= 0x20 or code in (0x09, 0x0A, 0x0D):
                cleaned.append(char)

        result = ''.join(cleaned)

        # Also remove null bytes and other problematic characters
        result = result.replace('\x00', '')
        result = result.replace('\x0b', '')  # Vertical tab
        result = result.replace('\x0c', '')  # Form feed

        # Replace problematic Unicode characters that might not render
        result = result.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')

        return result

    def _normalize_text_for_matching(self, text: str) -> str:
        """Normalize text for fuzzy matching by removing extra whitespace and special chars."""
        if not text:
            return ""
        # Remove extra whitespace, normalize to lowercase
        normalized = ' '.join(text.split()).lower()
        # Remove common punctuation that might differ
        normalized = normalized.replace(':', '').replace('.', '').replace(',', '')
        return normalized

    def _fuzzy_title_match(self, title: str, line_text: str, threshold: float = 0.7) -> bool:
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
        norm_title = self._normalize_text_for_matching(title)
        norm_line = self._normalize_text_for_matching(line_text)

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

    def _extract_section_content(self, pdf_path: str, section_title: str, start_page: int, end_page: int, next_section_title: Optional[str] = None) -> str:
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
            doc = fitz.open(pdf_path)
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
                            if self._fuzzy_title_match(section_title, line_text):
                                section_started = True
                                logger.debug(f"Found section start: '{section_title}' matched '{line_text}'")
                                # Don't include the title itself in the content
                                continue

                            # If we've checked many lines and still haven't found the title,
                            # start extracting anyway (fallback behavior)
                            if lines_checked > max_lines_to_check and page_num == start_idx:
                                logger.warning(f"Could not find exact title match for '{section_title}' on page {start_page}, extracting from start of page")
                                section_started = True
                                # Include this line since we're starting extraction

                        # Check if we've reached the next section
                        if section_started and next_section_title:
                            if self._fuzzy_title_match(next_section_title, line_text):
                                # We've reached the next section, stop here
                                logger.debug(f"Found next section: '{next_section_title}' matched '{line_text}'")
                                doc.close()
                                raw_text = "\n".join(text_content)
                                return self._clean_text_for_excel(raw_text)

                        # Add content if we're in the section
                        if section_started:
                            text_content.append(line_text)

            doc.close()
            raw_text = "\n".join(text_content)

            # Log if we got empty content
            if not raw_text.strip():
                logger.warning(f"Empty content extracted for section '{section_title}' (pages {start_page}-{end_page})")

            # Clean text for Excel compatibility
            return self._clean_text_for_excel(raw_text)
        except Exception as e:
            logger.error(f"Error extracting section content: {e}")
            return ""

    def _extract_text_between_pages(self, pdf_path: str, start_page: int, end_page: int) -> str:
        """
        Extract text content between two page numbers (legacy method).

        WARNING: This method extracts entire pages, which may include content
        from multiple sections. Use _extract_section_content() for more accurate
        section-based extraction.
        """
        try:
            doc = fitz.open(pdf_path)
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
            return self._clean_text_for_excel(raw_text)
        except Exception as e:
            logger.error(f"Error extracting text: {e}")
            return ""

    def _build_hierarchy_structure(self, toc: List[Dict]) -> List[Dict]:
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

    def _extract_pdf_with_pypdf2(self, pdf_path: str) -> List[str]:
        """Fallback PDF extraction using PyPDF2."""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                pages_text = []
                
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    text = page.extract_text()
                    pages_text.append(text)
                    logger.info(f"Extracted text from PDF page {page_num + 1} (PyPDF2)")
                
                return pages_text
                
        except Exception as e:
            logger.error(f"Error extracting text with PyPDF2: {e}")
            raise

    def identify_heading_level(self, line: str, next_line: str = "") -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Identify the heading level of a line.
        Returns: (level, number, title) or (None, None, None) if not a heading
        """
        line = line.strip()
        if not line:
            return None, None, None

        # Check each heading level in order (most specific first)
        for level, patterns in self.heading_patterns.items():
            for pattern in patterns:
                match = re.match(pattern, line)
                if match:
                    number = match.group(1).strip()

                    # Handle cases where title is on the same line
                    if match.lastindex >= 2:
                        title = match.group(2).strip()
                    else:
                        # Title might be on the next line
                        title = next_line.strip() if next_line else ""

                    # Filter out table of contents entries (contain dots)
                    if '...' in title or title.count('.') > 2:
                        continue

                    # Filter out table data and numeric-only content
                    if re.match(r'^[\d\.\s]+$', title) or 'Table' in title:
                        continue

                    # Filter out figure captions and references
                    if any(word in title.lower() for word in ['figure', 'illustration', 'reward trends']):
                        continue

                    # Filter out very short titles for sections that should have titles
                    if level in ['section', 'subsection', 'subsubsection', 'subsubsubsection'] and len(title) < 3:
                        # For standalone numbers, title will be on next line
                        if not title and next_line:
                            title = next_line.strip()

                    return level, number, title

        return None, None, None

    def process_text_to_hierarchy(self, pages_text: List[str], clean_output: bool = False, document_name: str = "", file_path: str = "", extraction_method: str = "auto") -> List[Dict]:
        """
        Process extracted text into hierarchical structure.

        Args:
            pages_text: List of text pages/sections
            clean_output: If True, exclude entries without content
            document_name: Name of the source document
            file_path: Path to the source file (for PDF TOC extraction)
            extraction_method: Method to use ('auto', 'toc', 'regex')

        Returns:
            List of dictionaries with hierarchical data
        """
        # Try to use PDF TOC first if it's a PDF file
        if file_path and file_path.lower().endswith('.pdf'):
            toc = self.extract_pdf_toc(file_path)
            if toc:
                logger.info(f"Processing PDF with TOC ({len(toc)} entries)")
                return self._process_with_toc_and_content(file_path, toc, clean_output, document_name)

        # Fallback to regex-based detection
        logger.info("Using text-based heading detection (regex patterns)")
        return self._process_with_regex(pages_text, clean_output, document_name, file_path)

    def _process_with_toc_and_content(self, pdf_path: str, toc: List[Dict], clean_output: bool, document_name: str) -> List[Dict]:
        """Process PDF using TOC and extract content for each section"""
        logger.info("Building hierarchical structure and extracting content...")

        # Try to extract document name from first page, fallback to provided name
        extracted_doc_name = self.extract_document_name_from_pdf(pdf_path)
        if extracted_doc_name and extracted_doc_name != Path(pdf_path).stem:
            # Use extracted name if it's different from filename
            document_name = extracted_doc_name
            logger.info(f"Using document name from first page: {document_name}")
        else:
            logger.info(f"Using document name: {document_name}")

        hierarchy = self._build_hierarchy_structure(toc)
        excel_data = []

        for i, item in enumerate(hierarchy):
            logger.info(f"Processing [{i+1}/{len(hierarchy)}]: {item['title']}")
            logger.info(f"  Pages: {item['start_page']} to {item['end_page'] or 'end'}")

            # Determine the next section's title for boundary detection
            next_section_title = None
            if i + 1 < len(hierarchy):
                next_section_title = hierarchy[i + 1]['title']

            # Extract content using position-aware method
            if item['end_page']:
                content = self._extract_section_content(
                    pdf_path,
                    item['title'],
                    item['start_page'],
                    item['end_page'],
                    next_section_title
                )
            else:
                # Last section - extract to end of document
                doc = fitz.open(pdf_path)
                content = self._extract_section_content(
                    pdf_path,
                    item['title'],
                    item['start_page'],
                    doc.page_count + 1,
                    next_section_title
                )
                doc.close()

            # Skip empty content if clean_output is enabled
            if clean_output and not content.strip():
                continue

            # Map to the expected format
            excel_data.append({
                'document_name': document_name,
                'section': self._clean_text_for_excel(item['chapter'] or ''),
                'subsection': self._clean_text_for_excel(item['section'] or ''),
                'subsubsection': self._clean_text_for_excel(item['subsection'] or ''),
                'subsubsubsection': self._clean_text_for_excel(item['subsubsection'] or ''),
                'content': content,
                'level': item['level'],
                'full_title': self._clean_text_for_excel(item['title']),
                'start_page': item['start_page'],
                'end_page': item['end_page'] or 'END',
                'content_length': len(content)
            })

        logger.info(f"✓ Processed {len(excel_data)} sections with content")
        return excel_data

    def _process_with_regex(self, pages_text: List[str], clean_output: bool, document_name: str, file_path: str = "") -> List[Dict]:
        """Process text using regex pattern matching (fallback method)."""
        # Try to extract document name from first page if file_path is provided
        if file_path and file_path.lower().endswith('.pdf'):
            extracted_doc_name = self.extract_document_name_from_pdf(file_path)
            if extracted_doc_name and extracted_doc_name != Path(file_path).stem:
                document_name = extracted_doc_name
                logger.info(f"Using document name from first page: {document_name}")

        hierarchy_data = []
        current_hierarchy = {
            'section': '',
            'subsection': '',
            'subsubsection': '',
            'subsubsubsection': ''
        }
        current_content = []

        # Process each page separately to maintain context
        for page_num, page_text in enumerate(pages_text):
            lines = page_text.split('\n')
            skip_next = False

            for i, line in enumerate(lines):
                # Skip this line if it was used as a title in previous iteration
                if skip_next:
                    skip_next = False
                    continue

                line = line.strip()

                # Skip empty lines, page numbers, headers/footers
                if not line or line.isdigit() or len(line) < 3:
                    continue

                # Skip common academic document elements
                if any(skip_word in line.lower() for skip_word in [
                    'contents', 'list of figures', 'list of tables', 'acknowledgments',
                    'dedication', 'abstract', 'bibliography', 'references', 'acronyms'
                ]):
                    continue

                # Get next line for heading detection
                next_line = lines[i + 1].strip() if i + 1 < len(lines) else ""
                level, number, title = self.identify_heading_level(line, next_line)

                if level:
                    # Save previous content if any
                    if current_content:
                        content_text = ' '.join(current_content).strip()
                        if content_text and len(content_text) > 10:  # Only save substantial content
                            hierarchy_data.append({
                                'document_name': document_name,
                                'section': current_hierarchy['section'],
                                'subsection': current_hierarchy['subsection'],
                                'subsubsection': current_hierarchy['subsubsection'],
                                'subsubsubsection': current_hierarchy['subsubsubsection'],
                                'content': content_text
                            })
                        current_content = []

                    # Update hierarchy based on level
                    if level == 'section':
                        current_hierarchy = {
                            'section': f"{number} {title}",
                            'subsection': '',
                            'subsubsection': '',
                            'subsubsubsection': ''
                        }
                    elif level == 'subsection':
                        current_hierarchy['subsection'] = f"{number} {title}"
                        current_hierarchy['subsubsection'] = ''
                        current_hierarchy['subsubsubsection'] = ''
                    elif level == 'subsubsection':
                        current_hierarchy['subsubsection'] = f"{number} {title}"
                        current_hierarchy['subsubsubsection'] = ''
                    elif level == 'subsubsubsection':
                        current_hierarchy['subsubsubsection'] = f"{number} {title}"

                    logger.info(f"Found {level}: {number} {title}")

                    # If title was on next line, mark to skip it in next iteration
                    if title == next_line.strip():
                        skip_next = True

                else:
                    # Regular content line - only add if we're in a section
                    if current_hierarchy['section'] and len(line) > 10:
                        # Clean up the line
                        cleaned_line = line.replace('\t', ' ').strip()
                        if cleaned_line and not cleaned_line.replace('.', '').replace(' ', '').isdigit():
                            current_content.append(cleaned_line)
                    elif len(line) > 10:
                        # If we don't have a section yet, still collect content for debugging
                        cleaned_line = line.replace('\t', ' ').strip()
                        if cleaned_line and not cleaned_line.replace('.', '').replace(' ', '').isdigit():
                            current_content.append(cleaned_line)

        # Don't forget the last content
        if current_content:
            content_text = ' '.join(current_content).strip()
            if content_text and len(content_text) > 10:
                hierarchy_data.append({
                    'document_name': document_name,
                    'section': current_hierarchy['section'],
                    'subsection': current_hierarchy['subsection'],
                    'subsubsection': current_hierarchy['subsubsection'],
                    'subsubsubsection': current_hierarchy['subsubsubsection'],
                    'content': content_text
                })

        logger.info(f"Processed {len(hierarchy_data)} entries (regex method)")
        return hierarchy_data

    def _process_with_advanced_sections(self, pages_text: List[str], sections: List[Dict], clean_output: bool, document_name: str) -> List[Dict]:
        """
        Process text using sections from Advanced PDF Extractor.
        Converts advanced extractor format to hierarchy format.
        """
        logger.info(f"Processing {len(sections)} sections from advanced extractor")
        hierarchy_data = []

        # Build page-to-text mapping
        page_texts = {i + 1: text for i, text in enumerate(pages_text)}

        # Current hierarchy context
        current_section = ""
        current_subsection = ""
        current_subsubsection = ""
        current_subsubsubsection = ""

        for section in sections:
            level = section.get('level', 1)
            title = section.get('title', '')
            number = section.get('number', '')
            page = section.get('page', 1)

            # Build full section name
            section_name = f"{number} {title}".strip() if number else title

            # Extract content from the page
            content = ""
            if page in page_texts:
                # Try to find content after this section heading
                page_text = page_texts[page]
                lines = page_text.split('\n')

                # Find the heading line
                for i, line in enumerate(lines):
                    if title in line or section_name in line:
                        # Get next few lines as content (up to 5 lines or next heading)
                        content_lines = []
                        for j in range(i + 1, min(i + 6, len(lines))):
                            next_line = lines[j].strip()
                            # Stop if we hit another heading
                            if self.identify_heading_level(next_line)[0]:
                                break
                            if next_line:
                                content_lines.append(next_line)
                        content = ' '.join(content_lines)
                        break

            # Update hierarchy based on level
            if level == 1:
                current_section = section_name
                current_subsection = ""
                current_subsubsection = ""
                current_subsubsubsection = ""
            elif level == 2:
                current_subsection = section_name
                current_subsubsection = ""
                current_subsubsubsection = ""
            elif level == 3:
                current_subsubsection = section_name
                current_subsubsubsection = ""
            elif level >= 4:
                current_subsubsubsection = section_name

            # Add to hierarchy data
            entry = {
                'document_name': document_name,
                'section': current_section,
                'subsection': current_subsection,
                'subsubsection': current_subsubsection,
                'subsubsubsection': current_subsubsubsection,
                'content': content
            }

            # Apply clean output filter
            if not clean_output or content:
                hierarchy_data.append(entry)

        logger.info(f"Processed {len(hierarchy_data)} entries from advanced sections")
        return hierarchy_data

    def _process_with_toc(self, pages_text: List[str], toc: List[Tuple], clean_output: bool, document_name: str) -> List[Dict]:
        """
        Process text using PDF Table of Contents (primary method).
        Supports ALL numbering formats: Roman numerals, letters, numbers, mixed formats.
        """
        logger.info(f"Using PDF TOC-based extraction ({len(toc)} entries)")
        hierarchy_data = []

        # Build a map of page numbers to TOC entries
        page_to_sections = {}
        for entry in toc:
            level, title, page = entry[0], entry[1], entry[2]
            if page not in page_to_sections:
                page_to_sections[page] = []
            page_to_sections[page].append({'level': level, 'title': title})

        # Current hierarchy context
        current_section = ""
        current_subsection = ""
        current_subsubsection = ""
        current_subsubsubsection = ""
        current_content = []

        def save_current_content():
            """Save accumulated content as a single entry."""
            if current_content:
                content_text = ' '.join(current_content).strip()
                if content_text and (not clean_output or len(content_text) > 10):
                    entry = {
                        'document_name': document_name,
                        'section': current_section,
                        'subsection': current_subsection,
                        'subsubsection': current_subsubsection,
                        'subsubsubsection': current_subsubsubsection,
                        'content': content_text
                    }
                    hierarchy_data.append(entry)
                current_content.clear()

        # Process each page
        for page_num, page_text in enumerate(pages_text, 1):
            # Update hierarchy if this page has TOC entries
            if page_num in page_to_sections:
                for section_info in page_to_sections[page_num]:
                    save_current_content()  # Save content before changing hierarchy

                    level = section_info['level']
                    title = section_info['title']

                    # Map TOC levels to our hierarchy (1=section, 2=subsection, etc.)
                    if level == 1:
                        current_section = title
                        current_subsection = ""
                        current_subsubsection = ""
                        current_subsubsubsection = ""
                    elif level == 2:
                        current_subsection = title
                        current_subsubsection = ""
                        current_subsubsubsection = ""
                    elif level == 3:
                        current_subsubsection = title
                        current_subsubsubsection = ""
                    elif level >= 4:
                        current_subsubsubsection = title

            # Collect content from this page
            lines = page_text.split('\n')
            for line in lines:
                line = line.strip()
                if line:
                    # Skip lines that match TOC titles (avoid duplicating headings as content)
                    is_heading = False
                    if page_num in page_to_sections:
                        for section_info in page_to_sections[page_num]:
                            if section_info['title'] in line:
                                is_heading = True
                                break

                    if not is_heading:
                        current_content.append(line)

        # Save final content
        save_current_content()

        logger.info(f"Processed {len(hierarchy_data)} entries from document (TOC method)")
        return hierarchy_data

    def save_to_excel(self, hierarchy_data: List[Dict], output_path: str):
        """Save hierarchical data to Excel file with enhanced formatting."""
        df = pd.DataFrame(hierarchy_data)

        # Check if we have the enhanced format (with level, full_title, etc.)
        has_enhanced_format = 'level' in df.columns and 'full_title' in df.columns

        if has_enhanced_format:
            # Enhanced format with TOC extraction
            columns = ['document_name', 'level', 'section', 'subsection', 'subsubsection', 'subsubsubsection',
                      'full_title', 'start_page', 'end_page', 'content', 'content_length']
            for col in columns:
                if col not in df.columns:
                    df[col] = ''
            df = df[columns]
        else:
            # Standard format
            columns = ['document_name', 'section', 'subsection', 'subsubsection', 'subsubsubsection', 'content']
            for col in columns:
                if col not in df.columns:
                    df[col] = ''
            df = df[columns]

        # Save to Excel with formatting
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Extracted_Data', index=False)

            # Get workbook and worksheet
            workbook = writer.book
            worksheet = writer.sheets['Extracted_Data']

            if has_enhanced_format:
                # Adjust column widths for enhanced format
                worksheet.column_dimensions['A'].width = 30  # document_name
                worksheet.column_dimensions['B'].width = 8   # level
                worksheet.column_dimensions['C'].width = 30  # section
                worksheet.column_dimensions['D'].width = 30  # subsection
                worksheet.column_dimensions['E'].width = 30  # subsubsection
                worksheet.column_dimensions['F'].width = 30  # subsubsubsection
                worksheet.column_dimensions['G'].width = 40  # full_title
                worksheet.column_dimensions['H'].width = 12  # start_page
                worksheet.column_dimensions['I'].width = 12  # end_page
                worksheet.column_dimensions['J'].width = 80  # content
                worksheet.column_dimensions['K'].width = 15  # content_length

                # Enable text wrapping for content column
                from openpyxl.styles import Alignment
                for row in worksheet.iter_rows(min_row=2, max_row=len(df)+1, min_col=10, max_col=10):
                    for cell in row:
                        cell.alignment = Alignment(wrap_text=True, vertical='top')
            else:
                # Standard column widths
                worksheet.column_dimensions['A'].width = 30  # document_name
                worksheet.column_dimensions['B'].width = 30  # section
                worksheet.column_dimensions['C'].width = 30  # subsection
                worksheet.column_dimensions['D'].width = 30  # subsubsection
                worksheet.column_dimensions['E'].width = 30  # subsubsubsection
                worksheet.column_dimensions['F'].width = 80  # content

                # Enable text wrapping for content column
                from openpyxl.styles import Alignment
                for row in worksheet.iter_rows(min_row=2, max_row=len(df)+1, min_col=6, max_col=6):
                    for cell in row:
                        cell.alignment = Alignment(wrap_text=True, vertical='top')

        logger.info(f"Saved {len(df)} entries to {output_path}")

    def extract_document_to_excel(self, file_path: str, output_path: str = None, clean_output: bool = False):
        """
        Main method to extract document content to Excel.

        Args:
            file_path: Path to input document
            output_path: Path to output Excel file (optional)
            clean_output: If True, exclude entries without content

        Returns:
            Path to output Excel file
        """
        if not output_path:
            file_name = Path(file_path).stem
            output_path = f"{file_name}_hierarchy.xlsx"

        logger.info(f"Starting extraction from: {file_path}")

        # Extract document name from path
        document_name = Path(file_path).stem

        # Extract text from document
        pages_text = self.extract_text(file_path)

        # Process text into hierarchy (pass file_path for PDF TOC extraction)
        hierarchy_data = self.process_text_to_hierarchy(
            pages_text,
            clean_output,
            document_name,
            file_path=file_path
        )

        # Save to Excel
        self.save_to_excel(hierarchy_data, output_path)

        return output_path

