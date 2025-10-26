#!/usr/bin/env python3
"""
AI Configuration Loader

This module provides functions to load AI service configurations from request headers
(client-side credentials) or environment variables. It creates configurations for all
supported AI providers including Google Gemini, LM Studio, and Ollama.

IMPORTANT: Credentials are now sent per-request from the client's browser localStorage
and are NEVER stored on the server. This ensures complete user isolation.
"""

import os
import logging
from typing import Dict, Optional
from ai_service_base import AIProviderType, AIServiceConfig

logger = logging.getLogger(__name__)


def load_all_ai_configs() -> Dict[AIProviderType, AIServiceConfig]:
    """
    Load all AI service configurations.

    NOTE: This function now returns an empty dict by default.
    All credentials should come from client-side (browser localStorage) via request headers.
    Backend does NOT store any credentials.

    Returns:
        Dict[AIProviderType, AIServiceConfig]: Empty dictionary (credentials come from request headers)
    """
    # Return empty configs - all credentials come from request headers
    logger.info("⚠️ Backend credential storage is disabled - all credentials come from client-side (browser localStorage)")
    logger.info("✅ Credentials are sent per-request via HTTP headers for complete user isolation")
    return {}


def get_enabled_providers() -> Dict[AIProviderType, AIServiceConfig]:
    """
    Get configurations for enabled AI providers only.

    Returns:
        Dict[AIProviderType, AIServiceConfig]: Dictionary of enabled provider configurations
    """
    all_configs = load_all_ai_configs()

    # Filter based on environment variables or availability
    enabled_configs = {}

    for provider_type, config in all_configs.items():
        # Check if provider is explicitly disabled
        env_var = f"{provider_type.value.upper().replace('_', '_')}_ENABLED"
        if os.getenv(env_var, 'true').lower() == 'false':
            logger.info(f"Provider {provider_type.value} is disabled via {env_var}")
            continue

        enabled_configs[provider_type] = config

    return enabled_configs


def create_config_from_request_credentials(provider_id: str, credentials) -> Optional[AIServiceConfig]:
    """
    Create AI service configuration from request credentials.

    This function creates a configuration from credentials sent in request headers
    (from the client's browser localStorage). Credentials are NEVER stored on the server.

    Args:
        provider_id: Provider identifier (e.g., 'openai', 'google_gemini')
        credentials: ProviderCredentials object from request headers

    Returns:
        AIServiceConfig or None if credentials are insufficient
    """
    if not credentials:
        return None

    try:
        # Map provider_id to AIProviderType
        provider_type_map = {
            'openai': AIProviderType.OPENAI,
            'google_gemini': AIProviderType.GOOGLE_GEMINI,
            'lm_studio': AIProviderType.LM_STUDIO,
            'ollama': AIProviderType.OLLAMA,
        }

        provider_type = provider_type_map.get(provider_id)
        if not provider_type:
            logger.warning(f"Unknown provider_id: {provider_id}")
            return None

        # Create configuration based on provider type
        if provider_type == AIProviderType.OPENAI:
            if not credentials.api_key:
                return None
            return AIServiceConfig(
                provider_type=AIProviderType.OPENAI,
                api_key=credentials.api_key,
                endpoint=credentials.endpoint or 'https://api.openai.com/v1',
                model_name=credentials.model_name or 'gpt-4o',
                max_retries=int(os.getenv('DEFAULT_MAX_RETRIES', '3')),
                timeout=int(os.getenv('DEFAULT_TIMEOUT', '30')),
                temperature=float(os.getenv('DEFAULT_TEMPERATURE', '0.7')),
                max_tokens=int(os.getenv('DEFAULT_MAX_TOKENS', '300')),
                top_p=float(os.getenv('DEFAULT_TOP_P', '0.9'))
            )

        elif provider_type == AIProviderType.GOOGLE_GEMINI:
            if not credentials.api_key:
                return None
            return AIServiceConfig(
                provider_type=AIProviderType.GOOGLE_GEMINI,
                api_key=credentials.api_key,
                model_name=credentials.model_name or 'gemini-1.5-flash',
                max_retries=int(os.getenv('DEFAULT_MAX_RETRIES', '3')),
                timeout=int(os.getenv('DEFAULT_TIMEOUT', '30')),
                temperature=float(os.getenv('DEFAULT_TEMPERATURE', '0.7')),
                max_tokens=int(os.getenv('DEFAULT_MAX_TOKENS', '300')),
                top_p=float(os.getenv('DEFAULT_TOP_P', '0.9'))
            )

        elif provider_type == AIProviderType.LM_STUDIO:
            return AIServiceConfig(
                provider_type=AIProviderType.LM_STUDIO,
                endpoint=credentials.endpoint or 'http://localhost:1234/v1',
                model_name=credentials.model_name,
                max_retries=int(os.getenv('DEFAULT_MAX_RETRIES', '3')),
                timeout=int(os.getenv('DEFAULT_TIMEOUT', '60')),
                temperature=float(os.getenv('DEFAULT_TEMPERATURE', '0.7')),
                max_tokens=int(os.getenv('DEFAULT_MAX_TOKENS', '300')),
                top_p=float(os.getenv('DEFAULT_TOP_P', '0.9'))
            )

        elif provider_type == AIProviderType.OLLAMA:
            return AIServiceConfig(
                provider_type=AIProviderType.OLLAMA,
                endpoint=credentials.endpoint or 'http://localhost:11434',
                model_name=credentials.model_name,
                max_retries=int(os.getenv('DEFAULT_MAX_RETRIES', '3')),
                timeout=int(os.getenv('DEFAULT_TIMEOUT', '120')),
                temperature=float(os.getenv('DEFAULT_TEMPERATURE', '0.7')),
                max_tokens=int(os.getenv('DEFAULT_MAX_TOKENS', '300')),
                top_p=float(os.getenv('DEFAULT_TOP_P', '0.9'))
            )

        return None

    except Exception as e:
        logger.error(f"Error creating config from request credentials for {provider_id}: {e}")
        return None


def load_configs_from_request(request_credentials: Dict) -> Dict[AIProviderType, AIServiceConfig]:
    """
    Load AI service configurations from request credentials.

    This function creates configurations from credentials sent in request headers.
    Each user's browser sends their own credentials with each request.

    Args:
        request_credentials: Dictionary of provider_id -> ProviderCredentials

    Returns:
        Dict[AIProviderType, AIServiceConfig]: Dictionary of provider configurations
    """
    configs = {}

    for provider_id, credentials in request_credentials.items():
        config = create_config_from_request_credentials(provider_id, credentials)
        if config:
            configs[config.provider_type] = config
            logger.debug(f"Created config from request credentials for {provider_id}")

    return configs
