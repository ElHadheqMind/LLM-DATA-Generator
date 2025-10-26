#!/usr/bin/env python3
"""
Abstract Base Class for AI Services

This module defines the interface and common functionality for all AI service providers
including Google Gemini, LM Studio, and Ollama.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Tuple, Any, Union
from enum import Enum
import logging
import asyncio
from dataclasses import dataclass
import time

logger = logging.getLogger(__name__)

# Import system prompt configuration
def get_current_system_prompt():
    """Get the current system prompt from environment variable"""
    import os

    # Get system prompt from environment variable only
    # No hardcoded fallback - must be set via environment variable or UI
    system_prompt = os.getenv('SYSTEM_PROMPT', '')

    return system_prompt


class AIProviderType(Enum):
    """Enumeration of supported AI providers."""
    OPENAI = "openai"
    GOOGLE_GEMINI = "google_gemini"
    LM_STUDIO = "lm_studio"
    OLLAMA = "ollama"


class AIServiceStatus(Enum):
    """Status of AI service availability."""
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    CONNECTING = "connecting"
    ERROR = "error"
    UNKNOWN = "unknown"


@dataclass
class AIServiceConfig:
    """Configuration for AI service providers."""
    provider_type: AIProviderType
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    model_name: Optional[str] = None
    api_version: Optional[str] = None
    deployment_name: Optional[str] = None
    max_retries: int = 3
    timeout: int = 30
    temperature: float = 0.7
    max_tokens: int = 200
    top_p: float = 0.9
    custom_params: Optional[Dict[str, Any]] = None


@dataclass
class AIResponse:
    """Standardized response from AI services."""
    success: bool
    content: Optional[str] = None
    error: Optional[str] = None
    provider: Optional[AIProviderType] = None
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    response_time: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ModelInfo:
    """Information about available models."""
    name: str
    display_name: str
    description: Optional[str] = None
    max_tokens: Optional[int] = None
    supports_streaming: bool = False
    cost_per_token: Optional[float] = None


class BaseAIService(ABC):
    """Abstract base class for all AI service providers."""
    
    def __init__(self, config: AIServiceConfig):
        """Initialize the AI service with configuration."""
        self.config = config
        self.provider_type = config.provider_type
        self._status = AIServiceStatus.UNKNOWN
        self._last_error = None
        self._client = None
        
    @property
    def status(self) -> AIServiceStatus:
        """Get current service status."""
        return self._status
    
    @property
    def last_error(self) -> Optional[str]:
        """Get last error message."""
        return self._last_error
    
    @abstractmethod
    async def initialize(self) -> bool:
        """
        Initialize the AI service client.
        
        Returns:
            bool: True if initialization successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def test_connection(self) -> AIResponse:
        """
        Test connection to the AI service.
        
        Returns:
            AIResponse: Response indicating connection status
        """
        pass
    
    @abstractmethod
    async def generate_question(self, content: str, context: Optional[Dict[str, str]] = None) -> AIResponse:
        """
        Generate a training question for the given content.

        Args:
            content (str): The text content to generate a question for
            context (Dict[str, str], optional): Context including section hierarchy

        Returns:
            AIResponse: Generated question or error
        """
        pass

    async def generate_question_answer_pair(self, content: str, context: Optional[Dict[str, str]] = None,
                                           system_prompt: Optional[str] = None,
                                           generation_mode: str = 'qa_pair') -> AIResponse:
        """
        Generate a question-answer pair for the given content with JSON output.

        Args:
            content (str): Content to generate question-answer pair for
            context (Dict[str, str], optional): Hierarchical context
            system_prompt (str, optional): Custom system prompt to override default
            generation_mode (str): Mode for generation ('qa_pair' or 'question_only')

        Returns:
            AIResponse: Generated question-answer pair as JSON or error
        """
        # Default implementation calls generate_question for backward compatibility
        # Subclasses should override this method for JSON Q&A generation
        return await self.generate_question(content, context)
    
    @abstractmethod
    async def get_available_models(self) -> List[ModelInfo]:
        """
        Get list of available models for this provider.
        
        Returns:
            List[ModelInfo]: List of available models
        """
        pass
    
    @abstractmethod
    def validate_config(self) -> Tuple[bool, Optional[str]]:
        """
        Validate the service configuration.
        
        Returns:
            Tuple[bool, Optional[str]]: (is_valid, error_message)
        """
        pass
    
    async def generate_questions_batch(self, content_list: List[Dict]) -> List[Dict]:
        """
        Generate questions for a batch of content items.
        
        Args:
            content_list (List[Dict]): List of content dictionaries with hierarchy and content
            
        Returns:
            List[Dict]: List of dictionaries with original content plus generated questions
        """
        results = []
        
        for i, item in enumerate(content_list):
            logger.info(f"Generating question for item {i + 1}/{len(content_list)} using {self.provider_type.value}")
            
            content = item.get('content', '')
            context = {
                'section': item.get('section', ''),
                'subsection': item.get('subsection', ''),
                'subsubsection': item.get('subsubsection', ''),
                'subsubsubsection': item.get('subsubsubsection', '')
            }
            
            response = await self.generate_question(content, context)
            
            # Create result item
            result_item = item.copy()
            result_item['question'] = response.content if response.success else None
            result_item['question_generated'] = response.success
            result_item['ai_provider'] = self.provider_type.value
            result_item['ai_model'] = response.model_used
            
            if not response.success:
                logger.warning(f"Failed to generate question for item {i + 1}: {response.error}")
            
            results.append(result_item)
        
        return results
    
    def _create_prompt(self, content: str, context: Optional[Dict[str, str]] = None,
                      system_prompt: Optional[str] = None, generation_mode: str = 'qa_pair') -> str:
        """
        Create a standardized prompt for question-answer pair generation.

        Args:
            content (str): The content to generate a question-answer pair for
            context (Dict[str, str], optional): Hierarchical context
            system_prompt (str, optional): Custom system prompt
            generation_mode (str): Mode for generation ('qa_pair' or 'question_only')

        Returns:
            str: Formatted prompt
        """
        # No validation - just use system prompt if provided, otherwise continue without it

        if generation_mode == 'question_only':
            # Question-only mode: simpler prompt for just generating a question
            if system_prompt and system_prompt.strip():
                prompt = f"{system_prompt}\n\nGenerate a question based on the following content.\n\n"
            else:
                prompt = "Generate a question based on the following content.\n\n"

            if context:
                hierarchy_parts = []
                for level, value in context.items():
                    if value and value.strip():
                        hierarchy_parts.append(f"{level}: {value}")

                if hierarchy_parts:
                    prompt += f"Context: {' > '.join(hierarchy_parts)}\n\n"

            prompt += f"Content: {content}\n\n"
            prompt += "Return ONLY the question text with no additional formatting, explanations, or JSON structure.\n"
        else:
            # Q&A pair mode: full JSON prompt
            if system_prompt and system_prompt.strip():
                prompt = f"{system_prompt}\n\nGenerate a question-answer pair based on the following content.\n\n"
            else:
                prompt = "Generate a question-answer pair based on the following content.\n\n"

            if context:
                hierarchy_parts = []
                for level, value in context.items():
                    if value and value.strip():
                        hierarchy_parts.append(f"{level}: {value}")

                if hierarchy_parts:
                    prompt += f"Context: {' > '.join(hierarchy_parts)}\n\n"

            prompt += f"Content: {content}\n\n"
            prompt += "CRITICAL JSON FORMATTING REQUIREMENTS:\n"
            prompt += "- You MUST respond with ONLY valid JSON - no other text, explanations, or formatting\n"
            prompt += "- Do NOT use markdown code blocks (```json or ```)\n"
            prompt += "- Do NOT include any text before or after the JSON object\n"
            prompt += "- The JSON must contain exactly 2 keys: 'question' and 'answer'\n"
            prompt += "- Properly escape all special characters (quotes, newlines, backslashes) within JSON strings\n"
            prompt += "- Use double quotes for all JSON keys and string values\n"
            prompt += "- Ensure the JSON is valid and parseable\n\n"
            prompt += "CONTENT REQUIREMENTS:\n"
            prompt += "- Question: Create a practical, technical question about industrial automation concepts\n"
            prompt += "- Answer: Use the provided content as the answer, potentially enhanced with context\n"
            prompt += "- Focus on industrial automation, control systems, or related technical domains\n"
            prompt += "- Make the question general and domain-specific (not referencing the source document)\n"
            prompt += "- Ensure the question is practical and applicable to real-world industrial scenarios\n"
            prompt += "- Use clear, professional technical language\n\n"
            prompt += "EXACT FORMAT REQUIRED:\n"
            prompt += "{\"question\": \"Your question here\", \"answer\": \"Your answer here\"}\n\n"
            prompt += "REMEMBER: Return ONLY the JSON object above with no additional text, formatting, or explanations.\n"

        return prompt

    def _extract_json_from_text(self, text: str) -> Optional[str]:
        """
        Extract JSON object from text by finding the first { and matching }.

        Args:
            text (str): Text that may contain JSON

        Returns:
            Optional[str]: Extracted JSON string or None if not found
        """
        # Find the first opening brace
        start_idx = text.find('{')
        if start_idx == -1:
            return None

        # Count braces to find the matching closing brace
        brace_count = 0
        in_string = False
        escape_next = False

        for i, char in enumerate(text[start_idx:], start_idx):
            if escape_next:
                escape_next = False
                continue

            if char == '\\':
                escape_next = True
                continue

            if char == '"' and not escape_next:
                in_string = not in_string
                continue

            if not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        # Found the matching closing brace
                        return text[start_idx:i+1]

        return None

    def _parse_json_response(self, response_text: str) -> Optional[Dict[str, str]]:
        """
        Parse JSON response from AI model for question-answer pairs.

        Args:
            response_text (str): Raw response text from AI model

        Returns:
            Optional[Dict[str, str]]: Parsed JSON with 'question' and 'answer' keys, or None if parsing fails
        """
        import json
        import re

        print(f"\n🔍 BASE AI SERVICE JSON PARSING DEBUG:")
        print(f"   Input text type: {type(response_text)}")
        print(f"   Input text length: {len(response_text)}")
        print(f"   Input text (first 200 chars): {repr(response_text[:200])}")

        try:
            # Try to parse as direct JSON
            print(f"   Attempting direct JSON parsing...")
            stripped_text = response_text.strip()
            print(f"   Stripped text: {repr(stripped_text)}")

            parsed = json.loads(stripped_text)
            print(f"   Direct JSON parse successful: {type(parsed)}")
            print(f"   Parsed content: {repr(parsed)}")

            if isinstance(parsed, dict) and 'question' in parsed and 'answer' in parsed:
                print(f"   ✅ Valid Q&A structure found:")
                print(f"      Question: {repr(parsed['question'])}")
                print(f"      Answer: {repr(parsed['answer'])}")
                return parsed
            else:
                print(f"   ❌ Invalid structure - missing question/answer keys")
                print(f"      Keys found: {list(parsed.keys()) if isinstance(parsed, dict) else 'Not a dict'}")
        except json.JSONDecodeError as e:
            print(f"   ❌ Direct JSON parsing failed: {str(e)}")

        # Try to extract JSON using improved method
        try:
            print(f"   Attempting improved JSON extraction...")
            json_str = self._extract_json_from_text(response_text)
            if json_str:
                print(f"   Extracted JSON: {repr(json_str[:100])}{'...' if len(json_str) > 100 else ''}")

                parsed = json.loads(json_str)
                print(f"   Extracted JSON parse successful: {type(parsed)}")

                if isinstance(parsed, dict) and 'question' in parsed and 'answer' in parsed:
                    print(f"   ✅ Valid Q&A structure found via extraction:")
                    print(f"      Question: {repr(parsed['question'])}")
                    print(f"      Answer: {repr(parsed['answer'])}")
                    return parsed
                else:
                    print(f"   ❌ Invalid structure from extraction - missing question/answer keys")
            else:
                print(f"   ❌ No JSON object found in text")
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"   ❌ Extracted JSON parsing failed: {str(e)}")

        # Fallback: Try old regex method
        try:
            print(f"   Attempting fallback regex JSON extraction...")
            json_match = re.search(r'\{[^{}]*"question"[^{}]*"answer"[^{}]*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                print(f"   Regex found JSON: {repr(json_str)}")

                parsed = json.loads(json_str)
                print(f"   Regex JSON parse successful: {type(parsed)}")

                if isinstance(parsed, dict) and 'question' in parsed and 'answer' in parsed:
                    print(f"   ✅ Valid Q&A structure found via regex:")
                    print(f"      Question: {repr(parsed['question'])}")
                    print(f"      Answer: {repr(parsed['answer'])}")
                    return parsed
                else:
                    print(f"   ❌ Invalid structure from regex - missing question/answer keys")
            else:
                print(f"   ❌ No JSON pattern found with regex")
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"   ❌ Regex JSON parsing failed: {str(e)}")

        # If JSON parsing fails, try to extract question and answer manually
        try:
            lines = response_text.strip().split('\n')
            question = None
            answer = None

            for line in lines:
                line = line.strip()
                if line.lower().startswith('question:'):
                    question = line[9:].strip()
                elif line.lower().startswith('answer:'):
                    answer = line[7:].strip()
                elif '"question"' in line.lower():
                    # Extract from JSON-like format
                    match = re.search(r'"question"\s*:\s*"([^"]*)"', line, re.IGNORECASE)
                    if match:
                        question = match.group(1)
                elif '"answer"' in line.lower():
                    # Extract from JSON-like format
                    match = re.search(r'"answer"\s*:\s*"([^"]*)"', line, re.IGNORECASE)
                    if match:
                        answer = match.group(1)

            if question and answer:
                return {"question": question, "answer": answer}
        except Exception:
            pass

        return None

    async def cleanup(self):
        """Clean up resources when service is no longer needed."""
        if self._client:
            try:
                if hasattr(self._client, 'close'):
                    await self._client.close()
                elif hasattr(self._client, '__aenter__'):
                    # For context managers
                    pass
            except Exception as e:
                logger.warning(f"Error during cleanup for {self.provider_type.value}: {e}")
        
        self._client = None
        self._status = AIServiceStatus.UNKNOWN
