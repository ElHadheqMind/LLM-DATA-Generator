#!/usr/bin/env python3
"""
AI Service Manager

This module manages multiple AI service providers and provides a unified interface
for question generation and text processing across different AI services.
"""

import os
import logging
import asyncio
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass
import json

from ai_service_base import (
    BaseAIService, AIProviderType, AIServiceStatus, AIServiceConfig,
    AIResponse, ModelInfo
)
from ai_error_handler import error_handler, ErrorSeverity

logger = logging.getLogger(__name__)


@dataclass
class ProviderStatus:
    """Status information for an AI provider."""
    provider_type: AIProviderType
    status: AIServiceStatus
    available_models: List[ModelInfo]
    last_error: Optional[str] = None
    last_check: Optional[float] = None


class AIServiceManager:
    """Manages multiple AI service providers with fallback capabilities."""
    
    def __init__(self):
        """Initialize the AI service manager."""
        self._services: Dict[AIProviderType, BaseAIService] = {}
        self._primary_provider: Optional[AIProviderType] = None
        self._fallback_order: List[AIProviderType] = []
        self._provider_status: Dict[AIProviderType, ProviderStatus] = {}
        
    async def initialize_providers(self, configs: Dict[AIProviderType, AIServiceConfig]) -> Dict[AIProviderType, bool]:
        """
        Initialize multiple AI service providers.
        
        Args:
            configs: Dictionary mapping provider types to their configurations
            
        Returns:
            Dict[AIProviderType, bool]: Success status for each provider
        """
        results = {}
        
        for provider_type, config in configs.items():
            try:
                service = self._create_service(provider_type, config)
                success = await service.initialize()
                
                if success:
                    self._services[provider_type] = service
                    self._provider_status[provider_type] = ProviderStatus(
                        provider_type=provider_type,
                        status=AIServiceStatus.AVAILABLE,
                        available_models=await service.get_available_models()
                    )
                    logger.info(f"Successfully initialized {provider_type.value}")
                else:
                    self._provider_status[provider_type] = ProviderStatus(
                        provider_type=provider_type,
                        status=AIServiceStatus.ERROR,
                        available_models=[],
                        last_error=service.last_error
                    )
                    logger.error(f"Failed to initialize {provider_type.value}: {service.last_error}")
                
                results[provider_type] = success
                
            except Exception as e:
                logger.error(f"Exception initializing {provider_type.value}: {e}")
                self._provider_status[provider_type] = ProviderStatus(
                    provider_type=provider_type,
                    status=AIServiceStatus.ERROR,
                    available_models=[],
                    last_error=str(e)
                )
                results[provider_type] = False
        
        # Set primary provider and fallback order
        self._set_provider_priority()
        
        return results
    
    def _create_service(self, provider_type: AIProviderType, config: AIServiceConfig) -> BaseAIService:
        """Create a service instance for the given provider type."""
        if provider_type == AIProviderType.OPENAI:
            from openai_service import OpenAIService
            return OpenAIService(config)
        elif provider_type == AIProviderType.GOOGLE_GEMINI:
            from google_gemini_service import GoogleGeminiService
            return GoogleGeminiService(config)
        elif provider_type == AIProviderType.LM_STUDIO:
            from lm_studio_service import LMStudioService
            return LMStudioService(config)
        elif provider_type == AIProviderType.OLLAMA:
            from ollama_service import OllamaService
            return OllamaService(config)
        else:
            raise ValueError(f"Unsupported provider type: {provider_type}")
    
    def _set_provider_priority(self):
        """Set primary provider and fallback order based on availability and health."""
        available_providers = [
            provider for provider, status in self._provider_status.items()
            if status.status == AIServiceStatus.AVAILABLE
        ]

        if not available_providers:
            logger.warning("No AI providers are available")
            return

        # Filter providers by health score
        healthy_providers = [
            provider for provider in available_providers
            if error_handler.should_use_provider(provider)
        ]

        # Use healthy providers if available, otherwise use all available
        providers_to_consider = healthy_providers if healthy_providers else available_providers

        # Priority order: Google Gemini > OpenAI > Local providers
        # Gemini is prioritized as the default provider
        priority_order = [
            AIProviderType.GOOGLE_GEMINI,
            AIProviderType.OPENAI,
            AIProviderType.LM_STUDIO,
            AIProviderType.OLLAMA
        ]

        # Set primary provider to the highest priority healthy provider
        for provider in priority_order:
            if provider in providers_to_consider:
                self._primary_provider = provider
                break

        # Set fallback order based on health and priority
        self._fallback_order = [
            p for p in priority_order
            if p in providers_to_consider and p != self._primary_provider
        ]

        logger.info(f"Primary provider: {self._primary_provider.value if self._primary_provider else 'None'}")
        logger.info(f"Fallback order: {[p.value for p in self._fallback_order]}")
        logger.info(f"Provider health scores: {[(p.value, error_handler.get_provider_health(p)) for p in available_providers]}")
    
    async def generate_question(self, content: str, context: Optional[Dict[str, str]] = None,
                              preferred_provider: Optional[AIProviderType] = None,
                              preferred_model: Optional[str] = None,
                              disable_fallback: bool = False) -> AIResponse:
        """
        Generate a question using the specified or primary provider with fallback.

        Args:
            content: Content to generate question for
            context: Optional hierarchical context
            preferred_provider: Preferred provider to use
            preferred_model: Preferred model to use
            disable_fallback: If True, only try the preferred provider without fallback

        Returns:
            AIResponse: Generated question or error
        """
        providers_to_try = []

        # Determine provider order
        if preferred_provider and preferred_provider in self._services:
            providers_to_try.append(preferred_provider)

        # If fallback is disabled, only use the preferred provider
        if disable_fallback:
            if not providers_to_try:
                return AIResponse(
                    success=False,
                    error="Preferred provider not available and fallback is disabled",
                    provider=None
                )
        else:
            # Add fallback providers
            if self._primary_provider and self._primary_provider not in providers_to_try:
                providers_to_try.append(self._primary_provider)

            providers_to_try.extend([p for p in self._fallback_order if p not in providers_to_try])

        if not providers_to_try:
            return AIResponse(
                success=False,
                error="No AI providers available",
                provider=None
            )
        
        # Try providers in order
        last_error = None
        last_provider = None

        for provider_type in providers_to_try:
            service = self._services.get(provider_type)
            if not service:
                continue

            # Check if provider is healthy enough to use
            if not error_handler.should_use_provider(provider_type):
                logger.warning(f"Skipping unhealthy provider {provider_type.value}")
                continue

            try:
                logger.info(f"Attempting question generation with {provider_type.value}")

                # Temporarily set the preferred model if specified
                original_model = service.config.model_name
                if preferred_model:
                    service.config.model_name = preferred_model
                    logger.info(f"Using model: {preferred_model}")

                try:
                    response = await service.generate_question(content, context)
                finally:
                    # Restore original model
                    service.config.model_name = original_model

                last_provider = provider_type

                if response.success:
                    logger.info(f"Successfully generated question with {provider_type.value}")
                    return response
                else:
                    logger.warning(f"Failed with {provider_type.value}: {response.error}")
                    last_error = response.error

                    # If fallback is disabled, return immediately with provider-specific error
                    if disable_fallback:
                        return AIResponse(
                            success=False,
                            error=response.error,
                            provider=provider_type,
                            metadata={
                                'provider_display_name': self._get_provider_display_name(provider_type),
                                'disable_fallback': True
                            }
                        )

                    # Handle the error through error handler for fallback logic
                    if response.error:
                        error_info = error_handler.handle_error(
                            Exception(response.error), provider_type
                        )
                        if not error_info.should_fallback:
                            break

            except Exception as e:
                logger.error(f"Exception with {provider_type.value}: {e}")
                last_error = str(e)
                last_provider = provider_type

                # If fallback is disabled, return immediately with provider-specific error
                if disable_fallback:
                    return AIResponse(
                        success=False,
                        error=str(e),
                        provider=provider_type,
                        metadata={
                            'provider_display_name': self._get_provider_display_name(provider_type),
                            'disable_fallback': True
                        }
                    )

                # Handle the error through error handler
                error_info = error_handler.handle_error(e, provider_type)

                # Update provider status
                if provider_type in self._provider_status:
                    self._provider_status[provider_type].status = AIServiceStatus.ERROR
                    self._provider_status[provider_type].last_error = str(e)

                # If error is critical or shouldn't fallback, stop trying
                if error_info.severity == ErrorSeverity.CRITICAL or not error_info.should_fallback:
                    break

        # Return error with information about the last failed provider
        return AIResponse(
            success=False,
            error=last_error or "All AI providers failed to generate question",
            provider=last_provider,
            metadata={
                'provider_display_name': self._get_provider_display_name(last_provider) if last_provider else None,
                'all_providers_failed': True
            }
        )

    async def generate_question_answer_pair(self, content: str, context: Optional[Dict[str, str]] = None,
                                          preferred_provider: Optional[AIProviderType] = None,
                                          preferred_model: Optional[str] = None,
                                          disable_fallback: bool = False,
                                          temperature: Optional[float] = None,
                                          max_tokens: Optional[int] = None,
                                          top_p: Optional[float] = None,
                                          system_prompt: Optional[str] = None,
                                          generation_mode: str = 'qa_pair') -> AIResponse:
        """
        Generate a question-answer pair using the specified or primary provider with fallback.

        Args:
            content: Content to generate question-answer pair for
            context: Optional hierarchical context
            preferred_provider: Preferred provider to use
            preferred_model: Preferred model to use
            disable_fallback: If True, only try the preferred provider without fallback
            temperature: Optional temperature override (0.0-2.0)
            max_tokens: Optional max tokens override
            top_p: Optional top_p override (0.0-1.0)
            system_prompt: Optional system prompt override
            generation_mode: Mode for generation ('qa_pair' or 'question_only')

        Returns:
            AIResponse: Generated question-answer pair as JSON or error
        """
        providers_to_try = []

        # Determine provider order
        if preferred_provider and preferred_provider in self._services:
            providers_to_try.append(preferred_provider)

        # If fallback is disabled, only use the preferred provider
        if disable_fallback:
            if not providers_to_try:
                return AIResponse(
                    success=False,
                    error="Preferred provider not available and fallback is disabled",
                    provider=None
                )
        else:
            # Add fallback providers
            if self._primary_provider and self._primary_provider not in providers_to_try:
                providers_to_try.append(self._primary_provider)

            providers_to_try.extend([p for p in self._fallback_order if p not in providers_to_try])

        if not providers_to_try:
            return AIResponse(
                success=False,
                error="No AI providers available",
                provider=None
            )

        # Try providers in order
        last_error = None
        last_provider = None

        for provider_type in providers_to_try:
            service = self._services.get(provider_type)
            if not service:
                continue

            # Check if provider is healthy enough to use
            if not error_handler.should_use_provider(provider_type):
                logger.warning(f"Skipping unhealthy provider {provider_type.value}")
                continue

            try:
                logger.info(f"Attempting Q&A generation with {provider_type.value}")

                # Temporarily override configuration parameters
                original_model = service.config.model_name
                original_temperature = service.config.temperature
                original_max_tokens = service.config.max_tokens
                original_top_p = service.config.top_p

                if preferred_model:
                    service.config.model_name = preferred_model
                    logger.info(f"Using model: {preferred_model}")

                if temperature is not None:
                    service.config.temperature = temperature
                    logger.info(f"Using temperature: {temperature}")

                if max_tokens is not None:
                    service.config.max_tokens = max_tokens
                    logger.info(f"Using max_tokens: {max_tokens}")

                if top_p is not None:
                    service.config.top_p = top_p
                    logger.info(f"Using top_p: {top_p}")

                try:
                    # DEBUG: Print provider and content info
                    print(f"\n🚀 AI SERVICE MANAGER DEBUG:")
                    print(f"   Provider: {provider_type.value}")
                    print(f"   Model: {preferred_model or 'default'}")
                    print(f"   Generation Mode: {generation_mode}")
                    print(f"   Content length: {len(content)}")
                    print(f"   Content preview: {repr(content[:100])}")
                    print(f"   Context: {context}")
                    print("-" * 50)

                    response = await service.generate_question_answer_pair(content, context, system_prompt, generation_mode)

                    # DEBUG: Print response summary
                    print(f"\n📤 AI SERVICE MANAGER RESPONSE:")
                    print(f"   Provider: {provider_type.value}")
                    print(f"   Success: {response.success}")
                    print(f"   Content type: {type(response.content)}")
                    print(f"   Content length: {len(str(response.content)) if response.content else 0}")
                    print(f"   Error: {response.error}")
                    print("=" * 50)

                    last_provider = provider_type

                    if response.success:
                        logger.info(f"✅ Q&A generation successful with {provider_type.value}")
                        return response
                    else:
                        logger.warning(f"❌ Q&A generation failed with {provider_type.value}: {response.error}")
                        last_error = response.error

                        # If fallback is disabled, return immediately with provider-specific error
                        if disable_fallback:
                            return AIResponse(
                                success=False,
                                error=response.error,
                                provider=provider_type,
                                metadata={
                                    'provider_display_name': self._get_provider_display_name(provider_type),
                                    'disable_fallback': True
                                }
                            )

                finally:
                    # Restore original configuration parameters
                    service.config.model_name = original_model
                    service.config.temperature = original_temperature
                    service.config.max_tokens = original_max_tokens
                    service.config.top_p = original_top_p

            except Exception as e:
                error_msg = str(e)
                logger.error(f"❌ Exception with {provider_type.value}: {error_msg}")
                last_error = error_msg
                last_provider = provider_type

                # If fallback is disabled, return immediately with provider-specific error
                if disable_fallback:
                    return AIResponse(
                        success=False,
                        error=error_msg,
                        provider=provider_type,
                        metadata={
                            'provider_display_name': self._get_provider_display_name(provider_type),
                            'disable_fallback': True
                        }
                    )

        # Return error with information about the last failed provider
        return AIResponse(
            success=False,
            error=last_error or "All AI providers failed for Q&A generation",
            provider=last_provider,
            metadata={
                'provider_display_name': self._get_provider_display_name(last_provider) if last_provider else None,
                'all_providers_failed': True
            }
        )

    async def generate_questions_batch(self, content_list: List[Dict],
                                     preferred_provider: Optional[AIProviderType] = None,
                                     preferred_model: Optional[str] = None) -> List[Dict]:
        """
        Generate questions for a batch of content items.

        Args:
            content_list: List of content dictionaries
            preferred_provider: Preferred provider to use
            preferred_model: Preferred model to use

        Returns:
            List[Dict]: Results with generated questions
        """
        if not self._services:
            logger.error("No AI services available for batch processing")
            return content_list
        
        provider_to_use = preferred_provider or self._primary_provider
        if not provider_to_use or provider_to_use not in self._services:
            provider_to_use = next(iter(self._services.keys()))
        
        service = self._services[provider_to_use]
        logger.info(f"Using {provider_to_use.value} for batch question generation")

        # Temporarily set the preferred model if specified
        original_model = service.config.model_name
        if preferred_model:
            service.config.model_name = preferred_model
            logger.info(f"Using model: {preferred_model}")

        try:
            return await service.generate_questions_batch(content_list)
        finally:
            # Restore original model
            service.config.model_name = original_model
    
    def get_provider_status(self) -> Dict[str, Dict]:
        """Get status of all providers including health information."""
        status_dict = {}

        for provider_type, status in self._provider_status.items():
            health_score = error_handler.get_provider_health(provider_type)
            status_dict[provider_type.value] = {
                'status': status.status.value,
                'available_models': [
                    {
                        'name': model.name,
                        'display_name': model.display_name,
                        'description': model.description,
                        'max_tokens': model.max_tokens
                    }
                    for model in status.available_models
                ],
                'last_error': status.last_error,
                'last_check': status.last_check,
                'health_score': health_score,
                'is_healthy': error_handler.should_use_provider(provider_type)
            }

        return status_dict
    
    def get_available_providers(self) -> List[AIProviderType]:
        """Get list of available providers."""
        return [
            provider for provider, status in self._provider_status.items()
            if status.status == AIServiceStatus.AVAILABLE
        ]

    async def ensure_provider_initialized(self, provider_type: AIProviderType, config: AIServiceConfig) -> bool:
        """
        Ensure a provider is initialized with the given config.
        If already initialized, update the config. If not, initialize it.

        Args:
            provider_type: The provider type to initialize
            config: Configuration for the provider

        Returns:
            bool: True if provider is available, False otherwise
        """
        try:
            # Check if service already exists
            if provider_type in self._services:
                # Update existing service config
                service = self._services[provider_type]
                service.config = config
                logger.info(f"Updated config for existing {provider_type.value} service")

                # Update status to available
                if provider_type in self._provider_status:
                    self._provider_status[provider_type].status = AIServiceStatus.AVAILABLE
                else:
                    self._provider_status[provider_type] = ProviderStatus(
                        provider_type=provider_type,
                        status=AIServiceStatus.AVAILABLE,
                        available_models=await service.get_available_models()
                    )
                return True
            else:
                # Create and initialize new service
                service = self._create_service(provider_type, config)
                success = await service.initialize()

                if success:
                    self._services[provider_type] = service
                    self._provider_status[provider_type] = ProviderStatus(
                        provider_type=provider_type,
                        status=AIServiceStatus.AVAILABLE,
                        available_models=await service.get_available_models()
                    )
                    logger.info(f"Successfully initialized {provider_type.value}")
                    return True
                else:
                    self._provider_status[provider_type] = ProviderStatus(
                        provider_type=provider_type,
                        status=AIServiceStatus.ERROR,
                        available_models=[],
                        last_error=service.last_error
                    )
                    logger.error(f"Failed to initialize {provider_type.value}: {service.last_error}")
                    return False

        except Exception as e:
            logger.error(f"Exception ensuring {provider_type.value} initialized: {e}")
            self._provider_status[provider_type] = ProviderStatus(
                provider_type=provider_type,
                status=AIServiceStatus.ERROR,
                available_models=[],
                last_error=str(e)
            )
            return False
    
    async def test_provider(self, provider_type: AIProviderType) -> AIResponse:
        """Test a specific provider."""
        service = self._services.get(provider_type)
        if not service:
            return AIResponse(
                success=False,
                error=f"Provider {provider_type.value} not initialized",
                provider=provider_type
            )
        
        return await service.test_connection()
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get error summary from error handler."""
        return error_handler.get_error_summary()

    def _get_provider_display_name(self, provider_type: AIProviderType) -> str:
        """Get human-readable display name for a provider."""
        display_names = {
            AIProviderType.OPENAI: "OpenAI",
            AIProviderType.GOOGLE_GEMINI: "Google Gemini",
            AIProviderType.LM_STUDIO: "LM Studio",
            AIProviderType.OLLAMA: "Ollama"
        }
        return display_names.get(provider_type, provider_type.value.replace('_', ' ').title())

    def reset_provider_health(self, provider_type: Optional[AIProviderType] = None):
        """Reset health score for a provider or all providers."""
        if provider_type:
            error_handler.provider_health[provider_type] = 1.0
            logger.info(f"Reset health for provider {provider_type.value}")
        else:
            error_handler.provider_health.clear()
            logger.info("Reset health for all providers")

    async def cleanup(self):
        """Clean up all services."""
        for service in self._services.values():
            await service.cleanup()

        self._services.clear()
        self._provider_status.clear()
        self._primary_provider = None
        self._fallback_order.clear()
