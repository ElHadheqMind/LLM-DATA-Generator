#!/usr/bin/env python3
"""
Request Credentials Extractor

This module extracts API credentials from HTTP request headers.
Credentials are sent per-request from the client's browser localStorage
and are NEVER stored on the server.

This ensures complete user isolation - each user's browser maintains
their own credentials, and the backend operates in a stateless manner.
"""

from flask import Request
from typing import Dict, Optional, Any
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class ProviderCredentials:
    """Credentials for an AI provider extracted from request headers."""
    provider_id: str
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    deployment_name: Optional[str] = None
    api_version: Optional[str] = None
    model_name: Optional[str] = None
    region: Optional[str] = None
    project_id: Optional[str] = None
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None
    service_account_json: Optional[str] = None
    custom_params: Optional[Dict[str, Any]] = None


def extract_credentials_from_headers(request: Request, provider_id: str) -> Optional[ProviderCredentials]:
    """
    Extract credentials for a specific provider from request headers.

    ⚠️ IMPORTANT: Headers are sent from the client's IN-MEMORY storage (not localStorage)
    Credentials are stored in JavaScript memory only and sent with each request.
    Format: X-API-Key-{provider-id}, X-Endpoint-{provider-id}, etc.

    Args:
        request: Flask request object
        provider_id: Provider identifier (e.g., 'openai', 'google_gemini')

    Returns:
        ProviderCredentials object or None if no credentials found
    """
    # Normalize provider_id for header matching (replace underscores with hyphens)
    header_provider_id = provider_id.replace('_', '-')

    # Extract credentials from headers
    api_key = request.headers.get(f'X-API-Key-{header_provider_id}')
    endpoint = request.headers.get(f'X-Endpoint-{header_provider_id}')
    deployment_name = request.headers.get(f'X-Deployment-{header_provider_id}')
    api_version = request.headers.get(f'X-API-Version-{header_provider_id}')
    model_name = request.headers.get(f'X-Model-{header_provider_id}')
    region = request.headers.get(f'X-Region-{header_provider_id}')
    project_id = request.headers.get(f'X-Project-{header_provider_id}')
    access_key_id = request.headers.get(f'X-Access-Key-{header_provider_id}')
    secret_access_key = request.headers.get(f'X-Secret-Key-{header_provider_id}')

    # Check if any credentials were provided
    has_credentials = any([
        api_key, endpoint, deployment_name, api_version, model_name,
        region, project_id, access_key_id, secret_access_key
    ])

    if not has_credentials:
        return None

    return ProviderCredentials(
        provider_id=provider_id,
        api_key=api_key,
        endpoint=endpoint,
        deployment_name=deployment_name,
        api_version=api_version,
        model_name=model_name,
        region=region,
        project_id=project_id,
        access_key_id=access_key_id,
        secret_access_key=secret_access_key
    )


def extract_all_credentials_from_headers(request: Request) -> Dict[str, ProviderCredentials]:
    """
    Extract credentials for all providers from request headers.

    Args:
        request: Flask request object

    Returns:
        Dictionary mapping provider_id to ProviderCredentials
    """
    # Only check for providers currently in use
    all_provider_ids = ['openai', 'google_gemini', 'lm_studio', 'ollama']
    credentials = {}

    for provider_id in all_provider_ids:
        creds = extract_credentials_from_headers(request, provider_id)
        if creds:
            credentials[provider_id] = creds
            logger.debug(f"✅ Extracted credentials from request headers for provider: {provider_id}")

    if not credentials:
        logger.debug("ℹ️ No credentials found in request headers (client-side in-memory storage)")

    return credentials


def get_provider_credential(request: Request, provider_id: str) -> Optional[ProviderCredentials]:
    """
    Get credentials for a specific provider from request headers.
    
    This is the main function to use in endpoints that need provider credentials.
    
    Args:
        request: Flask request object
        provider_id: Provider identifier
        
    Returns:
        ProviderCredentials object or None
    """
    return extract_credentials_from_headers(request, provider_id)


def has_provider_credentials(request: Request, provider_id: str) -> bool:
    """
    Check if credentials exist for a provider in request headers.
    
    Args:
        request: Flask request object
        provider_id: Provider identifier
        
    Returns:
        True if credentials found, False otherwise
    """
    creds = extract_credentials_from_headers(request, provider_id)
    return creds is not None and creds.api_key is not None


def log_credential_headers(request: Request, mask: bool = True):
    """
    Log credential headers for debugging (with masking).

    Args:
        request: Flask request object
        mask: Whether to mask sensitive values
    """
    credential_headers = {
        key: ('***' + value[-4:] if mask and len(value) > 4 else value)
        for key, value in request.headers.items()
        if key.startswith('X-API-Key-') or key.startswith('X-Secret-')
    }

    if credential_headers:
        logger.debug(f"Credential headers received: {credential_headers}")
    else:
        logger.debug("No credential headers found in request")


def sync_request_credentials_to_manager(request: Request):
    """
    Sync credentials from request headers to credential manager (in-memory only).
    This allows the existing AI service manager to work with client-side credentials.

    IMPORTANT: Credentials are NOT saved to disk - only stored in memory temporarily.

    Args:
        request: Flask request object
    """
    try:
        from credential_manager import get_credential_manager

        # Get credentials from request headers
        request_creds = extract_all_credentials_from_headers(request)

        if not request_creds:
            logger.debug("No credentials in request headers to sync")
            return

        # Get credential manager
        credential_manager = get_credential_manager()

        # Sync each provider's credentials to memory (NOT disk)
        for provider_id, creds in request_creds.items():
            # Convert to dict format expected by credential manager
            cred_dict = {
                'api_key': creds.api_key,
                'endpoint': creds.endpoint,
                'deployment_name': creds.deployment_name,
                'api_version': creds.api_version,
                'model_name': creds.model_name,
                'region': creds.region,
                'project_id': creds.project_id,
                'access_key_id': creds.access_key_id,
                'secret_access_key': creds.secret_access_key,
            }

            # Remove None values
            cred_dict = {k: v for k, v in cred_dict.items() if v is not None}

            # Update in-memory credentials (this modifies _credentials dict but doesn't call _save_credentials)
            from dataclasses import asdict
            from credential_manager import ProviderCredentials as CMProviderCredentials

            credential_manager._credentials[provider_id] = CMProviderCredentials(
                provider_id=provider_id,
                **cred_dict
            )

            logger.debug(f"✅ Synced request credentials to memory for provider: {provider_id}")

    except Exception as e:
        logger.error(f"Failed to sync request credentials to manager: {e}")

