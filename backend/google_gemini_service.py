#!/usr/bin/env python3
"""
Google Gemini AI Service

This service provides Google Gemini API integration for question generation.
"""

import os
import logging
import asyncio
import time
from typing import List, Dict, Optional, Tuple

try:
    import google.generativeai as genai
    from google.generativeai.types import HarmCategory, HarmBlockThreshold
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    genai = None

from ai_service_base import (
    BaseAIService, AIProviderType, AIServiceStatus, AIServiceConfig, 
    AIResponse, ModelInfo
)

logger = logging.getLogger(__name__)


class GoogleGeminiService(BaseAIService):
    """Google Gemini AI service implementation."""
    
    def __init__(self, config: AIServiceConfig):
        """Initialize Google Gemini service with configuration."""
        super().__init__(config)
        self._model = None
        
        if not GEMINI_AVAILABLE:
            self._last_error = "Google Generative AI library not available. Install with: pip install google-generativeai"
            self._status = AIServiceStatus.ERROR
    
    async def initialize(self) -> bool:
        """Initialize the Google Gemini client."""
        if not GEMINI_AVAILABLE:
            return False
        
        try:
            # Validate configuration
            is_valid, error = self.validate_config()
            if not is_valid:
                self._last_error = error
                self._status = AIServiceStatus.ERROR
                return False
            
            # Configure the API
            genai.configure(api_key=self.config.api_key)
            
            # Initialize model
            model_name = self.config.model_name or "gemini-1.5-flash"
            
            generation_config = {
                "temperature": self.config.temperature,
                "top_p": self.config.top_p,
                "max_output_tokens": self.config.max_tokens,
            }
            
            safety_settings = [
                {
                    "category": HarmCategory.HARM_CATEGORY_HARASSMENT,
                    "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                },
                {
                    "category": HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                },
                {
                    "category": HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                },
                {
                    "category": HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                },
            ]
            
            self._model = genai.GenerativeModel(
                model_name=model_name,
                generation_config=generation_config,
                safety_settings=safety_settings
            )
            
            # Test connection
            test_response = await self.test_connection()
            if test_response.success:
                self._status = AIServiceStatus.AVAILABLE
                logger.info("Google Gemini service initialized successfully")
                return True
            else:
                self._last_error = test_response.error
                self._status = AIServiceStatus.ERROR
                return False
                
        except Exception as e:
            self._last_error = str(e)
            self._status = AIServiceStatus.ERROR
            logger.error(f"Failed to initialize Google Gemini service: {e}")
            return False
    
    async def test_connection(self) -> AIResponse:
        """Test connection to Google Gemini service."""
        if not self._model:
            return AIResponse(
                success=False,
                error="Model not initialized",
                provider=self.provider_type
            )
        
        try:
            start_time = time.time()
            
            # Make a simple test call
            response = self._model.generate_content("Say 'test' if you can hear me.")
            response_time = time.time() - start_time
            
            if response.text:
                return AIResponse(
                    success=True,
                    content=response.text.strip(),
                    provider=self.provider_type,
                    model_used=self.config.model_name or "gemini-1.5-flash",
                    response_time=response_time,
                    metadata={"usage": getattr(response, 'usage_metadata', None)}
                )
            else:
                return AIResponse(
                    success=False,
                    error="No response text received",
                    provider=self.provider_type
                )
            
        except Exception as e:
            logger.error(f"Google Gemini connection test failed: {e}")
            return AIResponse(
                success=False,
                error=str(e),
                provider=self.provider_type
            )
    
    async def generate_question_answer_pair(self, content: str, context: Optional[Dict[str, str]] = None,
                                           system_prompt: Optional[str] = None,
                                           generation_mode: str = 'qa_pair') -> AIResponse:
        """
        Generate a question-answer pair for the given content with JSON output.

        Args:
            content: Content to generate question-answer pair for
            context: Optional hierarchical context
            system_prompt: Custom system prompt (required)
            generation_mode: Mode for generation ('qa_pair' or 'question_only')

        Returns:
            AIResponse: Generated question-answer pair as JSON or error
        """
        if not self._model:
            return AIResponse(
                success=False,
                error="Model not initialized",
                provider=self.provider_type
            )

        content_length = len(content.strip()) if content else 0
        if not content or content_length < 10:
            logger.warning(f"Content too short for Google Gemini question generation: {content_length} characters (minimum 10 required)")
            return AIResponse(
                success=False,
                error=f"Content too short for question generation (minimum 10 characters required, got {content_length})",
                provider=self.provider_type
            )

        try:
            # Use the configured model
            model_name = self.config.model_name or "gemini-1.5-flash"

            # Create prompt using the provided system_prompt parameter
            prompt = self._create_prompt(content, context, system_prompt, generation_mode)
            start_time = time.time()

            # Make API call with retries
            for attempt in range(self.config.max_retries):
                try:
                    response = self._model.generate_content(prompt)
                    response_time = time.time() - start_time

                    if not response.text:
                        if attempt < self.config.max_retries - 1:
                            logger.warning(f"No response text received, retrying (attempt {attempt + 1})")
                            await asyncio.sleep(2 ** attempt)
                            continue
                        else:
                            return AIResponse(
                                success=False,
                                error="No response text received from Gemini",
                                provider=self.provider_type
                            )

                    response_content = response.text.strip()

                    # For Q&A pair mode, try to parse as JSON
                    # For question-only mode, return the response as-is
                    if generation_mode == 'qa_pair':
                        # Try to parse JSON response
                        try:
                            import json
                            # Try direct JSON parsing
                            if response_content.startswith('{'):
                                qa_data = json.loads(response_content)
                            else:
                                # Extract JSON from markdown or other formatting
                                import re
                                json_match = re.search(r'\{[^{}]*"question"[^{}]*"answer"[^{}]*\}', response_content, re.DOTALL)
                                if json_match:
                                    qa_data = json.loads(json_match.group(0))
                                else:
                                    raise ValueError("No valid JSON found in response")

                            # Validate JSON has required fields
                            if 'question' not in qa_data or 'answer' not in qa_data:
                                raise ValueError("JSON missing required 'question' or 'answer' fields")

                            # Return the parsed JSON
                            return AIResponse(
                                success=True,
                                content=qa_data,  # Return as dict for Q&A pair mode
                                provider=self.provider_type,
                                model_used=model_name,
                                response_time=response_time,
                                metadata={"usage": getattr(response, 'usage_metadata', None)}
                            )
                        except (json.JSONDecodeError, ValueError) as e:
                            if attempt < self.config.max_retries - 1:
                                logger.warning(f"Failed to parse JSON response, retrying (attempt {attempt + 1}): {e}")
                                await asyncio.sleep(2 ** attempt)
                                continue
                            else:
                                return AIResponse(
                                    success=False,
                                    error=f"Failed to parse JSON response: {e}. Response: {response_content[:200]}",
                                    provider=self.provider_type
                                )
                    else:
                        # Question-only mode: return as string (no validation)
                        return AIResponse(
                            success=True,
                            content=response_content,  # Return as string for question-only mode
                            provider=self.provider_type,
                            model_used=model_name,
                            response_time=response_time,
                            metadata={"usage": getattr(response, 'usage_metadata', None)}
                        )

                except Exception as e:
                    if attempt < self.config.max_retries - 1:
                        logger.warning(f"API call failed, retrying (attempt {attempt + 1}): {e}")
                        await asyncio.sleep(2 ** attempt)
                    else:
                        raise e

        except Exception as e:
            logger.error(f"Error generating question-answer pair with Google Gemini: {e}")
            return AIResponse(
                success=False,
                error=str(e),
                provider=self.provider_type
            )

    async def generate_question(self, content: str, context: Optional[Dict[str, str]] = None) -> AIResponse:
        """
        Generate a training question for the given content.
        This is a backward-compatible method that uses generate_question_answer_pair.

        Note: This method gets the system prompt from environment variable for backward compatibility.
        New code should use generate_question_answer_pair with explicit system_prompt parameter.
        """
        # Get current system prompt from environment for backward compatibility
        from ai_service_base import get_current_system_prompt
        system_prompt = get_current_system_prompt()

        # Use the new implementation
        return await self.generate_question_answer_pair(content, context, system_prompt, 'qa_pair')
    
    async def generate_text_direct(self, prompt: str, system_instruction: Optional[str] = None) -> AIResponse:
        """
        Generate text directly without system prompt requirements.
        This is useful for meta-tasks like generating system prompts.

        Args:
            prompt: The user prompt
            system_instruction: Optional system instruction for the AI

        Returns:
            AIResponse: Generated text or error
        """
        if not self._model:
            return AIResponse(
                success=False,
                error="Model not initialized",
                provider=self.provider_type
            )

        try:
            start_time = time.time()

            # Create a simple prompt with optional system instruction
            full_prompt = prompt
            if system_instruction:
                full_prompt = f"{system_instruction}\n\n{prompt}"

            # Make API call
            response = self._model.generate_content(full_prompt)
            response_time = time.time() - start_time

            if not response.text:
                return AIResponse(
                    success=False,
                    error="No response text received from Gemini",
                    provider=self.provider_type
                )

            return AIResponse(
                success=True,
                content=response.text.strip(),
                provider=self.provider_type,
                model_used=self.config.model_name or "gemini-1.5-flash",
                response_time=response_time,
                metadata={"usage": getattr(response, 'usage_metadata', None)}
            )

        except Exception as e:
            logger.error(f"Error generating text with Google Gemini: {e}")
            return AIResponse(
                success=False,
                error=str(e),
                provider=self.provider_type
            )

    async def get_available_models(self) -> List[ModelInfo]:
        """Get list of available Gemini models.

        Note: Gemini models change frequently, so we don't provide a static list.
        Users should enter the model name manually.
        See: https://ai.google.dev/gemini-api/docs/models/gemini
        """
        if not GEMINI_AVAILABLE:
            return []

        # Return empty list - users will enter model names manually
        return []
    
    def validate_config(self) -> Tuple[bool, Optional[str]]:
        """Validate the Google Gemini configuration."""
        if not GEMINI_AVAILABLE:
            return False, "Google Generative AI library not installed"
        
        if not self.config.api_key:
            return False, "Google Gemini API key is required"
        
        return True, None


def create_gemini_config_from_env() -> AIServiceConfig:
    """Create Google Gemini configuration from environment variables."""
    return AIServiceConfig(
        provider_type=AIProviderType.GOOGLE_GEMINI,
        api_key=os.getenv('GOOGLE_GEMINI_API_KEY'),
        model_name=os.getenv('GOOGLE_GEMINI_MODEL', 'gemini-1.5-flash'),
        max_retries=int(os.getenv('GOOGLE_GEMINI_MAX_RETRIES', '3')),
        timeout=int(os.getenv('GOOGLE_GEMINI_TIMEOUT', '30')),
        temperature=float(os.getenv('GOOGLE_GEMINI_TEMPERATURE', '0.7')),
        max_tokens=int(os.getenv('GOOGLE_GEMINI_MAX_TOKENS', '200')),
        top_p=float(os.getenv('GOOGLE_GEMINI_TOP_P', '0.9'))
    )
