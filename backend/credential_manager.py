#!/usr/bin/env python3
"""
Credential Manager

This module provides secure storage and retrieval of API credentials for AI providers.
Credentials can be stored in environment variables or a secure configuration file.
"""

import os
import json
import logging
from typing import Dict, Optional, Any
from pathlib import Path
from cryptography.fernet import Fernet
import base64
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


@dataclass
class ProviderCredentials:
    """Credentials for an AI provider."""
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


class CredentialManager:
    """Manages secure storage and retrieval of AI provider credentials."""
    
    def __init__(self, config_dir: Optional[str] = None):
        """
        Initialize the credential manager.
        
        Args:
            config_dir: Directory to store configuration files. Defaults to backend directory.
        """
        self.config_dir = Path(config_dir) if config_dir else Path(__file__).parent
        self.config_file = self.config_dir / 'ai_credentials.json'
        self.key_file = self.config_dir / '.credential_key'
        
        # Initialize encryption key
        self._encryption_key = self._get_or_create_encryption_key()
        self._cipher = Fernet(self._encryption_key)
        
        # Load existing credentials
        self._credentials: Dict[str, ProviderCredentials] = {}
        self._load_credentials()
    
    def _get_or_create_encryption_key(self) -> bytes:
        """Get existing encryption key or create a new one."""
        if self.key_file.exists():
            try:
                with open(self.key_file, 'rb') as f:
                    return f.read()
            except Exception as e:
                logger.warning(f"Failed to read encryption key: {e}. Creating new key.")
        
        # Create new encryption key
        key = Fernet.generate_key()
        try:
            with open(self.key_file, 'wb') as f:
                f.write(key)
            # Make key file readable only by owner
            os.chmod(self.key_file, 0o600)
        except Exception as e:
            logger.error(f"Failed to save encryption key: {e}")
        
        return key
    
    def _encrypt(self, data: str) -> str:
        """Encrypt sensitive data."""
        if not data:
            return data
        try:
            encrypted = self._cipher.encrypt(data.encode())
            return base64.b64encode(encrypted).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            return data
    
    def _decrypt(self, encrypted_data: str) -> str:
        """Decrypt sensitive data."""
        if not encrypted_data:
            return encrypted_data
        try:
            decoded = base64.b64decode(encrypted_data.encode())
            decrypted = self._cipher.decrypt(decoded)
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            return encrypted_data
    
    def _load_credentials(self):
        """Load credentials from configuration file."""
        if not self.config_file.exists():
            logger.info("No existing credentials file found")
            return
        
        try:
            with open(self.config_file, 'r') as f:
                data = json.load(f)
            
            for provider_id, cred_data in data.items():
                # Decrypt sensitive fields
                if cred_data.get('api_key'):
                    cred_data['api_key'] = self._decrypt(cred_data['api_key'])
                if cred_data.get('secret_access_key'):
                    cred_data['secret_access_key'] = self._decrypt(cred_data['secret_access_key'])
                if cred_data.get('service_account_json'):
                    cred_data['service_account_json'] = self._decrypt(cred_data['service_account_json'])
                
                self._credentials[provider_id] = ProviderCredentials(**cred_data)
            
            logger.info(f"Loaded credentials for {len(self._credentials)} providers")
        except Exception as e:
            logger.error(f"Failed to load credentials: {e}")
    
    def _save_credentials(self):
        """Save credentials to configuration file."""
        try:
            data = {}
            for provider_id, creds in self._credentials.items():
                cred_dict = asdict(creds)
                
                # Encrypt sensitive fields
                if cred_dict.get('api_key'):
                    cred_dict['api_key'] = self._encrypt(cred_dict['api_key'])
                if cred_dict.get('secret_access_key'):
                    cred_dict['secret_access_key'] = self._encrypt(cred_dict['secret_access_key'])
                if cred_dict.get('service_account_json'):
                    cred_dict['service_account_json'] = self._encrypt(cred_dict['service_account_json'])
                
                data[provider_id] = cred_dict
            
            with open(self.config_file, 'w') as f:
                json.dump(data, f, indent=2)
            
            # Make config file readable only by owner
            os.chmod(self.config_file, 0o600)
            logger.info(f"Saved credentials for {len(self._credentials)} providers")
        except Exception as e:
            logger.error(f"Failed to save credentials: {e}")
            raise
    
    def save_credentials(self, provider_id: str, credentials: Dict[str, Any]) -> bool:
        """
        Save credentials for a provider.

        Args:
            provider_id: Provider identifier (e.g., 'openai', 'azure_openai', 'aws_bedrock')
            credentials: Dictionary containing credential fields

        Returns:
            True if successful, False otherwise
        """
        try:
            # Get existing credentials if any
            existing = self._credentials.get(provider_id)

            # If updating existing credentials, merge with new values
            if existing:
                existing_dict = asdict(existing)
                # Update only provided fields
                for key, value in credentials.items():
                    if value is not None and value != '':
                        existing_dict[key] = value

                creds = ProviderCredentials(**existing_dict)
            else:
                # Create new ProviderCredentials object
                creds = ProviderCredentials(
                    provider_id=provider_id,
                    api_key=credentials.get('api_key'),
                    endpoint=credentials.get('endpoint'),
                    deployment_name=credentials.get('deployment_name'),
                    api_version=credentials.get('api_version'),
                    model_name=credentials.get('model_name'),
                    region=credentials.get('region'),
                    project_id=credentials.get('project_id'),
                    access_key_id=credentials.get('access_key_id'),
                    secret_access_key=credentials.get('secret_access_key'),
                    service_account_json=credentials.get('service_account_json'),
                    custom_params=credentials.get('custom_params')
                )

            self._credentials[provider_id] = creds
            self._save_credentials()
            logger.info(f"Saved credentials for provider: {provider_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to save credentials for {provider_id}: {e}")
            return False
    
    def get_credentials(self, provider_id: str) -> Optional[ProviderCredentials]:
        """
        Get credentials for a provider.

        Args:
            provider_id: Provider identifier

        Returns:
            ProviderCredentials object or None if not found
        """
        # Only return stored credentials - no environment variable fallback
        if provider_id in self._credentials:
            return self._credentials[provider_id]

        return None

    def delete_credentials(self, provider_id: str) -> bool:
        """
        Delete credentials for a provider.
        
        Args:
            provider_id: Provider identifier
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if provider_id in self._credentials:
                del self._credentials[provider_id]
                self._save_credentials()
                logger.info(f"Deleted credentials for provider: {provider_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete credentials for {provider_id}: {e}")
            return False
    
    def list_configured_providers(self) -> list:
        """Get list of providers with configured credentials."""
        return list(self._credentials.keys())
    
    def get_masked_credentials(self, provider_id: str) -> Optional[Dict[str, Any]]:
        """
        Get credentials with sensitive fields masked.
        
        Args:
            provider_id: Provider identifier
            
        Returns:
            Dictionary with masked credentials or None
        """
        creds = self.get_credentials(provider_id)
        if not creds:
            return None
        
        masked = asdict(creds)
        
        # Mask sensitive fields
        if masked.get('api_key'):
            masked['api_key'] = self._mask_value(masked['api_key'])
        if masked.get('secret_access_key'):
            masked['secret_access_key'] = self._mask_value(masked['secret_access_key'])
        if masked.get('service_account_json'):
            masked['service_account_json'] = '***CONFIGURED***'
        
        return masked
    
    def _mask_value(self, value: str, visible_chars: int = 4) -> str:
        """Mask a sensitive value, showing only last few characters."""
        if not value or len(value) <= visible_chars:
            return '***'
        return '*' * (len(value) - visible_chars) + value[-visible_chars:]


# Global credential manager instance
_credential_manager: Optional[CredentialManager] = None


def get_credential_manager() -> CredentialManager:
    """Get the global credential manager instance."""
    global _credential_manager
    if _credential_manager is None:
        _credential_manager = CredentialManager()
    return _credential_manager

