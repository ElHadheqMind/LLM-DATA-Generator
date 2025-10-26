#!/usr/bin/env python3
"""
OpenAI Service Implementation

This module provides the OpenAI service implementation for the AI service manager.
It handles communication with OpenAI's API for question generation and text processing.
"""

import os
import time
import logging
import asyncio
from typing import List, Optional, Tuple, Dict, Any
from openai import AsyncOpenAI
from ai_service_base import (
    BaseAIService,
    AIServiceConfig,
    AIResponse,
    AIServiceStatus,
    ModelInfo,
    AIProviderType,
    get_current_system_prompt
)

logger = logging.getLogger(__name__)


class OpenAIService(BaseAIService):
    """OpenAI AI service implementation."""

    def __init__(self, config: AIServiceConfig):
        """Initialize OpenAI service with configuration."""
        super().__init__(config)
        self._client = None
        self._available_models = []

    def _get_token_param(self, max_tokens_value: int) -> dict:
        """
        Get the appropriate token parameter for OpenAI models.

        As of 2025, all current OpenAI models use max_completion_tokens.
        See: https://platform.openai.com/docs/models
        """
        # All current OpenAI models use max_completion_tokens
        return {"max_completion_tokens": max_tokens_value}
    
    async def initialize(self) -> bool:
        """Initialize the OpenAI client."""
        try:
            # Validate configuration
            is_valid, error = self.validate_config()
            if not is_valid:
                self._last_error = error
                self._status = AIServiceStatus.ERROR
                return False

            # Initialize OpenAI client
            # Note: We don't pass proxies parameter as it's not supported in newer versions
            # The client will use system proxy settings automatically if needed
            try:
                self._client = AsyncOpenAI(
                    api_key=self.config.api_key,
                    base_url=self.config.endpoint or "https://api.openai.com/v1",
                    timeout=self.config.timeout,
                    max_retries=self.config.max_retries
                )
            except TypeError as te:
                # Handle the case where unexpected parameters are passed
                logger.error(f"Failed to initialize OpenAI client with error: {te}")
                self._last_error = f"OpenAI client initialization failed: {str(te)}"
                self._status = AIServiceStatus.ERROR
                return False

            # OpenAI models change frequently, so we don't provide a static list
            # Users should enter the model name manually
            # See: https://platform.openai.com/docs/models
            self._available_models = []

            # Test connection
            test_response = await self.test_connection()
            if test_response.success:
                self._status = AIServiceStatus.AVAILABLE
                logger.info(f"OpenAI service initialized successfully with model {self.config.model_name}")
                return True
            else:
                self._last_error = test_response.error
                self._status = AIServiceStatus.ERROR
                return False

        except Exception as e:
            self._last_error = str(e)
            self._status = AIServiceStatus.ERROR
            logger.error(f"Failed to initialize OpenAI service: {e}")
            return False
    
    async def test_connection(self) -> AIResponse:
        """Test connection to OpenAI service."""
        if not self._client:
            return AIResponse(
                success=False,
                error="Client not initialized",
                provider=self.provider_type
            )

        try:
            start_time = time.time()

            # Get the appropriate token parameter for this model
            token_param = self._get_token_param(10)

            # Make a simple test call
            response = await self._client.chat.completions.create(
                model=self.config.model_name or "gpt-4o",
                messages=[
                    {"role": "user", "content": "Say 'test' if you can hear me."}
                ],
                temperature=0.7,
                **token_param
            )
            response_time = time.time() - start_time
            
            if response.choices and response.choices[0].message.content:
                return AIResponse(
                    success=True,
                    content=response.choices[0].message.content.strip(),
                    provider=self.provider_type,
                    model_used=self.config.model_name or "gpt-4o",
                    response_time=response_time,
                    metadata={"usage": response.usage.model_dump() if response.usage else None}
                )
            else:
                return AIResponse(
                    success=False,
                    error="No response content received",
                    provider=self.provider_type
                )
                
        except Exception as e:
            logger.error(f"OpenAI connection test failed: {e}")
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
        if not self._client:
            return AIResponse(
                success=False,
                error="Client not initialized",
                provider=self.provider_type
            )

        content_length = len(content.strip()) if content else 0
        if not content or content_length < 10:
            logger.warning(f"Content too short for OpenAI question generation: {content_length} characters (minimum 10 required)")
            return AIResponse(
                success=False,
                error=f"Content too short for question generation (minimum 10 characters required, got {content_length})",
                provider=self.provider_type
            )

        try:
            # Use the configured model
            model_name = self.config.model_name or "gpt-4o"

            # Create prompt using the provided system_prompt parameter
            prompt = self._create_prompt(content, context, system_prompt, generation_mode)
            start_time = time.time()

            # Make API call with retries
            for attempt in range(self.config.max_retries):
                try:
                    # OpenAI supports separate system and user messages
                    # However, _create_prompt already includes the system prompt, so we use it as user content
                    messages = [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ]

                    # Get the appropriate token parameter for this model
                    token_param = self._get_token_param(self.config.max_tokens)

                    response = await self._client.chat.completions.create(
                        model=model_name,
                        messages=messages,
                        temperature=self.config.temperature,
                        top_p=self.config.top_p,
                        **token_param
                    )
                    response_time = time.time() - start_time

                    if not response.choices or not response.choices[0].message.content:
                        if attempt < self.config.max_retries - 1:
                            logger.warning(f"No response content received, retrying (attempt {attempt + 1})")
                            await asyncio.sleep(2 ** attempt)
                            continue
                        else:
                            return AIResponse(
                                success=False,
                                error="No response content received from OpenAI",
                                provider=self.provider_type
                            )

                    response_content = response.choices[0].message.content.strip()

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
                                metadata={"usage": response.usage.model_dump() if response.usage else None}
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
                            metadata={"usage": response.usage.model_dump() if response.usage else None}
                        )

                except Exception as e:
                    if attempt < self.config.max_retries - 1:
                        logger.warning(f"API call failed, retrying (attempt {attempt + 1}): {e}")
                        await asyncio.sleep(2 ** attempt)
                    else:
                        raise e

        except Exception as e:
            logger.error(f"Error generating question-answer pair with OpenAI: {e}")
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
        system_prompt = get_current_system_prompt()

        # Use the new implementation
        return await self.generate_question_answer_pair(content, context, system_prompt, 'qa_pair')
    
    async def generate_text(self, prompt: str, system_instruction: Optional[str] = None) -> AIResponse:
        """Generate text using OpenAI."""
        if not self._client:
            return AIResponse(
                success=False,
                error="Model not initialized",
                provider=self.provider_type
            )

        try:
            start_time = time.time()

            messages = []
            if system_instruction:
                messages.append({"role": "system", "content": system_instruction})
            messages.append({"role": "user", "content": prompt})

            # Get the appropriate token parameter for this model
            token_param = self._get_token_param(self.config.max_tokens)

            response = await self._client.chat.completions.create(
                model=self.config.model_name or "gpt-4o",
                messages=messages,
                temperature=self.config.temperature,
                top_p=self.config.top_p,
                **token_param
            )
            response_time = time.time() - start_time

            if not response.choices or not response.choices[0].message.content:
                return AIResponse(
                    success=False,
                    error="No response content received from OpenAI",
                    provider=self.provider_type
                )

            return AIResponse(
                success=True,
                content=response.choices[0].message.content.strip(),
                provider=self.provider_type,
                model_used=self.config.model_name or "gpt-4o",
                response_time=response_time,
                metadata={"usage": response.usage.model_dump() if response.usage else None}
            )

        except Exception as e:
            logger.error(f"Error generating text with OpenAI: {e}")
            return AIResponse(
                success=False,
                error=str(e),
                provider=self.provider_type
            )

    async def generate_text_direct(self, prompt: str, system_instruction: Optional[str] = None) -> AIResponse:
        """
        Alias for generate_text - for compatibility with other services.
        Generate text directly without system prompt requirements.
        """
        return await self.generate_text(prompt, system_instruction)
    
    async def get_available_models(self) -> List[ModelInfo]:
        """Get list of available OpenAI models."""
        return self._available_models.copy()
    
    def validate_config(self) -> Tuple[bool, Optional[str]]:
        """Validate the OpenAI configuration."""
        if not self.config.api_key:
            return False, "OpenAI API key is required"
        
        if not self.config.model_name:
            # Set default model if not specified
            self.config.model_name = "gpt-4o"
        
        return True, None
    
    async def cleanup(self):
        """Clean up resources."""
        if self._client:
            try:
                # Check if the client has a close method and is properly initialized
                if hasattr(self._client, 'close') and callable(self._client.close):
                    await self._client.close()
            except (Exception, RuntimeError) as e:
                # Ignore "Event loop is closed" errors during cleanup
                if "Event loop is closed" not in str(e):
                    logger.warning(f"Error closing OpenAI client: {e}")
            finally:
                self._client = None
        await super().cleanup()

