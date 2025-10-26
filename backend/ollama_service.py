#!/usr/bin/env python3
"""
Ollama AI Service

This service provides Ollama local API integration for question generation.
Ollama provides a local API for running open source language models.
"""

import os
import logging
import asyncio
import time
import aiohttp
import json
from typing import List, Dict, Optional, Tuple

from ai_service_base import (
    BaseAIService, AIProviderType, AIServiceStatus, AIServiceConfig, 
    AIResponse, ModelInfo
)

logger = logging.getLogger(__name__)


class OllamaService(BaseAIService):
    """Ollama local AI service implementation."""

    def __init__(self, config: AIServiceConfig):
        """Initialize Ollama service with configuration."""
        super().__init__(config)
        self._session = None
        self._session_loop = None  # Track which event loop the session belongs to

        # Normalize endpoint to use 127.0.0.1 instead of localhost for offline compatibility
        # This prevents DNS resolution failures when there's no internet connection
        endpoint = config.endpoint or "http://localhost:11434"
        self._base_url = endpoint.replace("localhost", "127.0.0.1")

        if endpoint != self._base_url:
            logger.info(f"🔧 Normalized endpoint from {endpoint} to {self._base_url} for offline compatibility")

        self._available_models = []

    async def _ensure_session(self):
        """Ensure the session is valid for the current event loop."""
        try:
            current_loop = asyncio.get_event_loop()

            # Check if session exists and is for the current loop
            if self._session and self._session_loop == current_loop and not self._session.closed:
                return  # Session is valid

            # Close old session if it exists
            if self._session and not self._session.closed:
                try:
                    await self._session.close()
                except Exception as e:
                    logger.debug(f"Error closing old session: {e}")

            # Create new session for current event loop
            # Configure connector for local-only connections (no internet required)
            # Use family=0 to disable IPv6 and use_dns_cache=False to avoid DNS lookups
            connector = aiohttp.TCPConnector(
                limit=10,
                limit_per_host=5,
                enable_cleanup_closed=True,
                force_close=True,  # Don't pool connections for local services
                family=0,  # Use socket.AF_UNSPEC to allow both IPv4 and IPv6
                use_dns_cache=False  # Disable DNS caching to avoid network lookups
            )
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=aiohttp.ClientTimeout(total=self.config.timeout),
                headers={"Content-Type": "application/json"}
            )
            self._session_loop = current_loop
            logger.debug(f"Created new aiohttp session for event loop {id(current_loop)}")

        except Exception as e:
            logger.error(f"Error ensuring session: {e}")
            raise

    async def initialize(self) -> bool:
        """Initialize the Ollama client."""
        try:
            # Validate configuration
            is_valid, error = self.validate_config()
            if not is_valid:
                self._last_error = error
                self._status = AIServiceStatus.ERROR
                return False

            # Ensure session is created for current event loop
            await self._ensure_session()

            # Discover available models
            await self._discover_models()

            # Test connection
            test_response = await self.test_connection()
            if test_response.success:
                self._status = AIServiceStatus.AVAILABLE
                logger.info(f"Ollama service initialized successfully with {len(self._available_models)} models")
                return True
            else:
                self._last_error = test_response.error
                self._status = AIServiceStatus.ERROR
                # Close session on failure
                await self.cleanup()
                return False

        except Exception as e:
            self._last_error = str(e)
            self._status = AIServiceStatus.ERROR
            logger.error(f"Failed to initialize Ollama service: {e}")
            # Close session on exception
            await self.cleanup()
            return False
    
    async def _discover_models(self):
        """Discover available models from Ollama."""
        try:
            async with self._session.get(f"{self._base_url}/api/tags") as response:
                if response.status == 200:
                    data = await response.json()
                    models_data = data.get("models", [])
                    
                    self._available_models = []
                    for model_data in models_data:
                        model_name = model_data.get("name", "unknown")
                        model_size = model_data.get("size", 0)
                        
                        # Extract model family and size info
                        display_name = model_name
                        description = f"Ollama model: {model_name}"
                        
                        if model_size > 0:
                            size_gb = model_size / (1024**3)
                            description += f" ({size_gb:.1f}GB)"
                        
                        model_info = ModelInfo(
                            name=model_name,
                            display_name=display_name,
                            description=description,
                            max_tokens=4096,  # Default, varies by model
                            supports_streaming=True
                        )
                        self._available_models.append(model_info)
                    
                    logger.info(f"Discovered {len(self._available_models)} models in Ollama")
                else:
                    logger.warning(f"Failed to discover models: HTTP {response.status}")
                    
        except Exception as e:
            logger.warning(f"Error discovering Ollama models: {e}")
            # Create a default model entry if discovery fails
            self._available_models = [
                ModelInfo(
                    name="llama2",
                    display_name="Llama 2",
                    description="Default Llama 2 model",
                    max_tokens=4096,
                    supports_streaming=True
                )
            ]
    
    async def test_connection(self) -> AIResponse:
        """Test connection to Ollama service by pinging the server."""
        # Create a fresh session for testing to avoid event loop issues
        session = None
        try:
            start_time = time.time()

            # Create a fresh session for this test
            # Configure connector for local-only connections (no internet required)
            # Use family=0 to disable IPv6 and use_dns_cache=False to avoid DNS lookups
            connector = aiohttp.TCPConnector(
                limit=10,
                limit_per_host=5,
                enable_cleanup_closed=True,
                force_close=True,  # Don't pool connections for local services
                family=0,  # Use socket.AF_UNSPEC to allow both IPv4 and IPv6
                use_dns_cache=False  # Disable DNS caching to avoid network lookups
            )
            session = aiohttp.ClientSession(
                connector=connector,
                timeout=aiohttp.ClientTimeout(total=self.config.timeout),
                headers={"Content-Type": "application/json"}
            )

            # Simply ping Ollama by checking the /api/tags endpoint
            # This doesn't require a model to be loaded
            async with session.get(f"{self._base_url}/api/tags") as response:
                response_time = time.time() - start_time

                if response.status == 200:
                    data = await response.json()
                    models = data.get("models", [])
                    model_count = len(models)

                    # Build a friendly message
                    if model_count > 0:
                        model_names = [m.get("name", "unknown") for m in models[:3]]
                        models_msg = ", ".join(model_names)
                        if model_count > 3:
                            models_msg += f" and {model_count - 3} more"
                        content = f"Ollama is running with {model_count} model(s): {models_msg}"
                    else:
                        content = "Ollama is running but no models are installed. Use 'ollama pull <model>' to install a model."

                    return AIResponse(
                        success=True,
                        content=content,
                        provider=self.provider_type,
                        model_used=None,  # No model needed for connection test
                        response_time=response_time,
                        metadata={
                            "available_models": model_count,
                            "models": [m.get("name") for m in models]
                        }
                    )
                else:
                    error_text = await response.text()
                    return AIResponse(
                        success=False,
                        error=f"HTTP {response.status}: {error_text}",
                        provider=self.provider_type
                    )

        except aiohttp.ClientConnectorError:
            return AIResponse(
                success=False,
                error="Cannot connect to Ollama. Please ensure Ollama is running (try 'ollama serve').",
                provider=self.provider_type
            )
        except Exception as e:
            logger.error(f"Ollama connection test failed: {e}")
            return AIResponse(
                success=False,
                error=str(e),
                provider=self.provider_type
            )
        finally:
            # Always close the session
            if session:
                await session.close()
    
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
        content_length = len(content.strip()) if content else 0
        if not content or content_length < 10:
            logger.warning(f"Content too short for Ollama question generation: {content_length} characters (minimum 10 required)")
            return AIResponse(
                success=False,
                error=f"Content too short for question generation (minimum 10 characters required, got {content_length})",
                provider=self.provider_type
            )

        # Create a fresh session for this generation to avoid event loop issues
        session = None
        try:
            # Use the configured model or the first available model
            model_name = self.config.model_name
            if not model_name and self._available_models:
                model_name = self._available_models[0].name
            elif not model_name:
                model_name = "llama2"

            # Create prompt using the provided system_prompt parameter
            prompt = self._create_prompt(content, context, system_prompt, generation_mode)

            # For Ollama, we combine system prompt with user prompt since it doesn't have separate system message
            # The _create_prompt already includes the system prompt, so we just use it directly
            full_prompt = prompt

            # Create a fresh session for this generation
            # Configure connector for local-only connections (no internet required)
            # Use family=0 to disable IPv6 and use_dns_cache=False to avoid DNS lookups
            connector = aiohttp.TCPConnector(
                limit=10,
                limit_per_host=5,
                enable_cleanup_closed=True,
                force_close=True,  # Don't pool connections for local services
                family=0,  # Use socket.AF_UNSPEC to allow both IPv4 and IPv6
                use_dns_cache=False  # Disable DNS caching to avoid network lookups
            )
            session = aiohttp.ClientSession(
                connector=connector,
                timeout=aiohttp.ClientTimeout(total=self.config.timeout),
                headers={"Content-Type": "application/json"}
            )

            start_time = time.time()

            # Make API call with retries
            for attempt in range(self.config.max_retries):
                try:
                    payload = {
                        "model": model_name,
                        "prompt": full_prompt,
                        "stream": False,
                        "options": {
                            "temperature": self.config.temperature,
                            "top_p": self.config.top_p,
                            "num_predict": self.config.max_tokens
                        }
                    }

                    async with session.post(f"{self._base_url}/api/generate", json=payload) as response:
                        response_time = time.time() - start_time

                        if response.status == 200:
                            data = await response.json()
                            response_content = data.get("response", "").strip()

                            if not response_content:
                                if attempt < self.config.max_retries - 1:
                                    logger.warning(f"No response content received, retrying (attempt {attempt + 1})")
                                    await asyncio.sleep(2 ** attempt)
                                    continue
                                else:
                                    return AIResponse(
                                        success=False,
                                        error="No response content received from Ollama",
                                        provider=self.provider_type
                                    )

                            # For Q&A pair mode, try to parse as JSON
                            # For question-only mode, return the response as-is
                            if generation_mode == 'qa_pair':
                                # Try to parse JSON response
                                try:
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
                                        metadata={
                                            "total_duration": data.get("total_duration"),
                                            "load_duration": data.get("load_duration"),
                                            "prompt_eval_count": data.get("prompt_eval_count"),
                                            "eval_count": data.get("eval_count")
                                        }
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
                                    metadata={
                                        "total_duration": data.get("total_duration"),
                                        "load_duration": data.get("load_duration"),
                                        "prompt_eval_count": data.get("prompt_eval_count"),
                                        "eval_count": data.get("eval_count")
                                    }
                                )
                        else:
                            error_text = await response.text()
                            if attempt < self.config.max_retries - 1:
                                logger.warning(f"API call failed, retrying (attempt {attempt + 1}): HTTP {response.status}")
                                await asyncio.sleep(2 ** attempt)
                            else:
                                return AIResponse(
                                    success=False,
                                    error=f"HTTP {response.status}: {error_text}",
                                    provider=self.provider_type
                                )
                    
                except Exception as e:
                    if attempt < self.config.max_retries - 1:
                        logger.warning(f"API call failed, retrying (attempt {attempt + 1}): {e}")
                        await asyncio.sleep(2 ** attempt)
                    else:
                        raise e
            
        except Exception as e:
            logger.error(f"Error generating question with Ollama: {e}")
            return AIResponse(
                success=False,
                error=str(e),
                provider=self.provider_type
            )
        finally:
            # Always close the session
            if session:
                await session.close()

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
        # Ensure session is valid for current event loop
        await self._ensure_session()

        if not self._session:
            return AIResponse(
                success=False,
                error="Ollama session not initialized",
                provider=self.provider_type
            )

        try:
            start_time = time.time()

            # Prepare the request payload
            payload = {
                "model": self.config.model_name or "llama2",
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": self.config.temperature,
                    "num_predict": self.config.max_tokens,
                    "top_p": self.config.top_p
                }
            }

            # Add system instruction if provided
            if system_instruction:
                payload["system"] = system_instruction

            # Make async API call using aiohttp
            async with self._session.post(
                f"{self._base_url}/api/generate",
                json=payload
            ) as response:
                response_time = time.time() - start_time

                if response.status != 200:
                    error_text = await response.text()
                    return AIResponse(
                        success=False,
                        error=f"Ollama API error: {response.status} - {error_text}",
                        provider=self.provider_type
                    )

                result = await response.json()
                generated_text = result.get('response', '').strip()

                if not generated_text:
                    return AIResponse(
                        success=False,
                        error="No response text received from Ollama",
                        provider=self.provider_type
                    )

                return AIResponse(
                    success=True,
                    content=generated_text,
                    provider=self.provider_type,
                    model_used=self.config.model_name or "llama2",
                    response_time=response_time,
                    metadata=result
                )

        except Exception as e:
            logger.error(f"Error generating text with Ollama: {e}")
            return AIResponse(
                success=False,
                error=str(e),
                provider=self.provider_type
            )

    async def get_available_models(self) -> List[ModelInfo]:
        """Get list of available models from Ollama."""
        return self._available_models.copy()

    def validate_config(self) -> Tuple[bool, Optional[str]]:
        """Validate the Ollama configuration."""
        # Ollama doesn't require API keys, just a valid endpoint
        if not self.config.endpoint and not self._base_url:
            return False, "Ollama endpoint is required"
        
        return True, None
    
    async def cleanup(self):
        """Clean up resources."""
        if self._session:
            try:
                if not self._session.closed:
                    await self._session.close()
            except Exception as e:
                logger.warning(f"Error closing Ollama session: {e}")
            finally:
                self._session = None
        await super().cleanup()


def create_ollama_config_from_env() -> AIServiceConfig:
    """Create Ollama configuration from environment variables."""
    return AIServiceConfig(
        provider_type=AIProviderType.OLLAMA,
        endpoint=os.getenv('OLLAMA_ENDPOINT', 'http://localhost:11434'),
        model_name=os.getenv('OLLAMA_MODEL'),  # Optional, will auto-discover
        max_retries=int(os.getenv('OLLAMA_MAX_RETRIES', '3')),
        timeout=int(os.getenv('OLLAMA_TIMEOUT', '120')),  # Longer timeout for local models
        temperature=float(os.getenv('OLLAMA_TEMPERATURE', '0.7')),
        max_tokens=int(os.getenv('OLLAMA_MAX_TOKENS', '200')),
        top_p=float(os.getenv('OLLAMA_TOP_P', '0.9'))
    )
