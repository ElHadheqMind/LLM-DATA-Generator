#!/usr/bin/env python3
"""
LM Studio AI Service

This service provides LM Studio local API integration for question generation.
LM Studio provides a local OpenAI-compatible API for running open source models.
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


class LMStudioService(BaseAIService):
    """LM Studio local AI service implementation."""

    def __init__(self, config: AIServiceConfig):
        """Initialize LM Studio service with configuration."""
        super().__init__(config)
        self._session = None
        self._session_loop = None  # Track which event loop the session belongs to

        # Get endpoint from config or use default
        endpoint = config.endpoint or "http://localhost:1234/v1"

        # Ensure endpoint ends with /v1 (LM Studio OpenAI-compatible API requirement)
        if endpoint and not endpoint.endswith('/v1'):
            logger.warning(f"⚠️ LM Studio endpoint missing /v1 suffix: {endpoint}")
            # Add /v1 if it's missing
            if endpoint.endswith('/'):
                endpoint = endpoint + 'v1'
            else:
                endpoint = endpoint + '/v1'
            logger.info(f"✅ Corrected endpoint to: {endpoint}")

        # Normalize endpoint to use 127.0.0.1 instead of localhost for offline compatibility
        # This prevents DNS resolution failures when there's no internet connection
        logger.debug(f"🔍 Original endpoint before normalization: '{endpoint}'")
        original_endpoint = endpoint
        endpoint = endpoint.replace("localhost", "127.0.0.1")
        logger.debug(f"🔍 Endpoint after normalization: '{endpoint}'")

        if original_endpoint != endpoint:
            logger.info(f"🔧 Normalized endpoint from {original_endpoint} to {endpoint} for offline compatibility")
        else:
            logger.debug(f"🔍 No normalization needed (endpoint doesn't contain 'localhost')")

        self._base_url = endpoint
        self._available_models = []
        logger.info(f"🔧 LMStudioService initialized with base_url: {self._base_url}")

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
        """Initialize the LM Studio client."""
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
            logger.info(f"🧪 Testing LM Studio connection...")
            test_response = await self.test_connection()
            if test_response.success:
                self._status = AIServiceStatus.AVAILABLE
                logger.info(f"✅ LM Studio service initialized successfully with {len(self._available_models)} models")
                return True
            else:
                self._last_error = test_response.error
                self._status = AIServiceStatus.ERROR
                logger.error(f"❌ LM Studio test connection failed: {test_response.error}")
                # Close session on failure
                await self.cleanup()
                return False

        except Exception as e:
            self._last_error = str(e)
            self._status = AIServiceStatus.ERROR
            logger.error(f"Failed to initialize LM Studio service: {e}")
            # Close session on exception
            await self.cleanup()
            return False
    
    async def _discover_models(self):
        """Discover available models from LM Studio."""
        try:
            logger.info(f"🔍 Discovering models from LM Studio at: {self._base_url}/models")
            async with self._session.get(f"{self._base_url}/models") as response:
                logger.info(f"📡 LM Studio /models response status: {response.status}")

                if response.status == 200:
                    data = await response.json()
                    logger.info(f"📦 LM Studio /models response data: {data}")

                    models_data = data.get("data", [])
                    logger.info(f"📋 Models data array length: {len(models_data)}")

                    if not models_data:
                        logger.warning(f"⚠️ LM Studio returned empty models list. Full response: {data}")

                    self._available_models = []
                    for model_data in models_data:
                        logger.info(f"   Processing model: {model_data.get('id', 'unknown')}")
                        model_info = ModelInfo(
                            name=model_data.get("id", "unknown"),
                            display_name=model_data.get("id", "Unknown Model"),
                            description=f"Local model via LM Studio: {model_data.get('id', 'unknown')}",
                            max_tokens=model_data.get("context_length", 4096),
                            supports_streaming=True
                        )
                        self._available_models.append(model_info)

                    logger.info(f"✅ Discovered {len(self._available_models)} models in LM Studio")
                else:
                    response_text = await response.text()
                    logger.warning(f"❌ Failed to discover models: HTTP {response.status}, Response: {response_text}")
                    
        except Exception as e:
            logger.warning(f"Error discovering LM Studio models: {e}")
            # Create a default model entry if discovery fails
            self._available_models = [
                ModelInfo(
                    name="local-model",
                    display_name="Local Model",
                    description="Local model running in LM Studio",
                    max_tokens=4096,
                    supports_streaming=True
                )
            ]
    
    async def test_connection(self) -> AIResponse:
        """Test connection to LM Studio service."""
        # Ensure session is valid for current event loop
        await self._ensure_session()

        if not self._session:
            logger.error("❌ Test connection failed: Session not initialized")
            return AIResponse(
                success=False,
                error="Session not initialized",
                provider=self.provider_type
            )

        try:
            start_time = time.time()

            # Use the first available model or a default
            model_name = self.config.model_name
            if not model_name and self._available_models:
                model_name = self._available_models[0].name
            elif not model_name:
                model_name = "local-model"

            logger.info(f"🧪 Testing with model: {model_name}")

            # Make a simple test call
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Say 'test' if you can hear me."}
                ],
                "max_tokens": 10,
                "temperature": 0.1
            }

            logger.info(f"📡 Sending test request to: {self._base_url}/chat/completions")
            async with self._session.post(f"{self._base_url}/chat/completions", json=payload) as response:
                response_time = time.time() - start_time
                logger.info(f"📡 Test response status: {response.status}")

                if response.status == 200:
                    data = await response.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                    logger.info(f"✅ Test connection successful! Response: {content}")

                    return AIResponse(
                        success=True,
                        content=content,
                        provider=self.provider_type,
                        model_used=model_name,
                        tokens_used=data.get("usage", {}).get("total_tokens"),
                        response_time=response_time
                    )
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Test connection failed: HTTP {response.status}: {error_text}")
                    return AIResponse(
                        success=False,
                        error=f"HTTP {response.status}: {error_text}",
                        provider=self.provider_type
                    )

        except aiohttp.ClientConnectorError as e:
            logger.error(f"❌ Cannot connect to LM Studio: {e}")
            return AIResponse(
                success=False,
                error="Cannot connect to LM Studio. Please ensure LM Studio is running and the local server is started.",
                provider=self.provider_type
            )
        except Exception as e:
            logger.error(f"❌ LM Studio connection test failed: {e}")
            logger.exception("Full traceback:")
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
        # Ensure session is valid for current event loop
        await self._ensure_session()

        if not self._session:
            return AIResponse(
                success=False,
                error="Session not initialized",
                provider=self.provider_type
            )

        content_length = len(content.strip()) if content else 0
        if not content or content_length < 10:
            logger.warning(f"Content too short for LM Studio question generation: {content_length} characters (minimum 10 required)")
            return AIResponse(
                success=False,
                error=f"Content too short for question generation (minimum 10 characters required, got {content_length})",
                provider=self.provider_type
            )

        try:
            # Use the configured model or the first available model
            model_name = self.config.model_name
            if not model_name and self._available_models:
                model_name = self._available_models[0].name
            elif not model_name:
                model_name = "local-model"

            # Create prompt using the provided system_prompt parameter
            prompt = self._create_prompt(content, context, system_prompt, generation_mode)
            start_time = time.time()

            # Make API call with retries
            for attempt in range(self.config.max_retries):
                try:
                    # LM Studio supports OpenAI-compatible chat API with separate system message
                    # We pass an empty system message and include everything in the user prompt
                    # since _create_prompt already includes the system prompt
                    payload = {
                        "model": model_name,
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "max_tokens": self.config.max_tokens,
                        "temperature": self.config.temperature,
                        "top_p": self.config.top_p
                    }
                    
                    async with self._session.post(f"{self._base_url}/chat/completions", json=payload) as response:
                        response_time = time.time() - start_time

                        if response.status == 200:
                            data = await response.json()
                            response_content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

                            if not response_content:
                                if attempt < self.config.max_retries - 1:
                                    logger.warning(f"No response content received, retrying (attempt {attempt + 1})")
                                    await asyncio.sleep(2 ** attempt)
                                    continue
                                else:
                                    return AIResponse(
                                        success=False,
                                        error="No response content received from LM Studio",
                                        provider=self.provider_type
                                    )

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
                                        tokens_used=data.get("usage", {}).get("total_tokens"),
                                        response_time=response_time
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
                                    tokens_used=data.get("usage", {}).get("total_tokens"),
                                    response_time=response_time
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
            logger.error(f"Error generating question with LM Studio: {e}")
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
        # Ensure session is valid for current event loop
        await self._ensure_session()

        if not self._session:
            return AIResponse(
                success=False,
                error="LM Studio session not initialized",
                provider=self.provider_type
            )

        try:
            start_time = time.time()

            # Use the configured model or the first available model
            model_name = self.config.model_name
            if not model_name and self._available_models:
                model_name = self._available_models[0].name
            elif not model_name:
                model_name = "local-model"

            # Prepare messages
            messages = []
            if system_instruction:
                messages.append({"role": "system", "content": system_instruction})
            messages.append({"role": "user", "content": prompt})

            # Prepare the request payload
            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": self.config.temperature,
                "max_tokens": self.config.max_tokens,
                "top_p": self.config.top_p,
                "stream": False
            }

            # Make API call using async session
            async with self._session.post(f"{self._base_url}/chat/completions", json=payload) as response:
                response_time = time.time() - start_time

                if response.status != 200:
                    error_text = await response.text()
                    return AIResponse(
                        success=False,
                        error=f"LM Studio API error: {response.status} - {error_text}",
                        provider=self.provider_type
                    )

                result = await response.json()

                if 'choices' not in result or not result['choices']:
                    return AIResponse(
                        success=False,
                        error="No response choices received from LM Studio",
                        provider=self.provider_type
                    )

                generated_text = result['choices'][0]['message']['content'].strip()

                if not generated_text:
                    return AIResponse(
                        success=False,
                        error="No response text received from LM Studio",
                        provider=self.provider_type
                    )

                return AIResponse(
                    success=True,
                    content=generated_text,
                    provider=self.provider_type,
                    model_used=model_name,
                    response_time=response_time,
                    tokens_used=result.get('usage', {}).get('total_tokens'),
                    metadata=result
                )

        except aiohttp.ClientConnectorError:
            return AIResponse(
                success=False,
                error="Cannot connect to LM Studio. Please ensure LM Studio is running and the local server is started.",
                provider=self.provider_type
            )
        except Exception as e:
            logger.error(f"Error generating text with LM Studio: {e}")
            return AIResponse(
                success=False,
                error=str(e),
                provider=self.provider_type
            )

    async def get_available_models(self) -> List[ModelInfo]:
        """Get list of available models from LM Studio."""
        return self._available_models.copy()

    def validate_config(self) -> Tuple[bool, Optional[str]]:
        """Validate the LM Studio configuration."""
        # LM Studio doesn't require API keys, just a valid endpoint
        if not self.config.endpoint and not self._base_url:
            return False, "LM Studio endpoint is required"
        
        return True, None
    
    async def cleanup(self):
        """Clean up resources."""
        if self._session:
            try:
                if not self._session.closed:
                    await self._session.close()
            except Exception as e:
                logger.warning(f"Error closing LM Studio session: {e}")
            finally:
                self._session = None
        await super().cleanup()


def create_lm_studio_config_from_env() -> AIServiceConfig:
    """Create LM Studio configuration from environment variables."""
    return AIServiceConfig(
        provider_type=AIProviderType.LM_STUDIO,
        endpoint=os.getenv('LM_STUDIO_ENDPOINT', 'http://localhost:1234/v1'),
        model_name=os.getenv('LM_STUDIO_MODEL'),  # Optional, will auto-discover
        max_retries=int(os.getenv('LM_STUDIO_MAX_RETRIES', '3')),
        timeout=int(os.getenv('LM_STUDIO_TIMEOUT', '60')),  # Longer timeout for local models
        temperature=float(os.getenv('LM_STUDIO_TEMPERATURE', '0.7')),
        max_tokens=int(os.getenv('LM_STUDIO_MAX_TOKENS', '200')),
        top_p=float(os.getenv('LM_STUDIO_TOP_P', '0.9'))
    )
