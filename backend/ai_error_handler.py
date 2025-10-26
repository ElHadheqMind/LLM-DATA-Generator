#!/usr/bin/env python3
"""
AI Error Handler

This module provides error handling and health tracking for AI service providers.
It tracks provider health scores, handles errors, and determines fallback strategies.
"""

import time
import logging
from enum import Enum
from typing import Dict, Optional, Any
from dataclasses import dataclass
from ai_service_base import AIProviderType

logger = logging.getLogger(__name__)


class ErrorSeverity(Enum):
    """Severity levels for AI service errors."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ErrorInfo:
    """Information about an error and how to handle it."""
    severity: ErrorSeverity
    should_fallback: bool
    retry_delay: float = 0.0
    message: str = ""


class AIErrorHandler:
    """Handles errors and tracks health for AI service providers."""
    
    def __init__(self):
        """Initialize the error handler."""
        self.provider_health: Dict[AIProviderType, float] = {}
        self.error_counts: Dict[AIProviderType, int] = {}
        self.last_error_time: Dict[AIProviderType, float] = {}
        self.consecutive_failures: Dict[AIProviderType, int] = {}
        
        # Health thresholds
        self.min_health_threshold = 0.3
        self.health_decay_rate = 0.1
        self.health_recovery_rate = 0.2
        self.max_consecutive_failures = 5
        
    def handle_error(self, error: Exception, provider: AIProviderType) -> ErrorInfo:
        """
        Handle an error from an AI provider and return error information.
        
        Args:
            error: The exception that occurred
            provider: The AI provider that generated the error
            
        Returns:
            ErrorInfo: Information about how to handle the error
        """
        error_msg = str(error).lower()
        current_time = time.time()
        
        # Update error tracking
        self.error_counts[provider] = self.error_counts.get(provider, 0) + 1
        self.last_error_time[provider] = current_time
        self.consecutive_failures[provider] = self.consecutive_failures.get(provider, 0) + 1
        
        # Determine error severity and handling
        if '429' in error_msg or 'rate limit' in error_msg:
            # Rate limiting error
            self._update_health(provider, -0.1)
            return ErrorInfo(
                severity=ErrorSeverity.MEDIUM,
                should_fallback=True,
                retry_delay=30.0,
                message="Rate limit exceeded"
            )
        
        elif 'timeout' in error_msg or 'connection' in error_msg:
            # Connection/timeout error
            self._update_health(provider, -0.2)
            return ErrorInfo(
                severity=ErrorSeverity.HIGH,
                should_fallback=True,
                retry_delay=5.0,
                message="Connection or timeout error"
            )
        
        elif 'authentication' in error_msg or 'unauthorized' in error_msg or '401' in error_msg:
            # Authentication error
            self._update_health(provider, -0.5)
            return ErrorInfo(
                severity=ErrorSeverity.CRITICAL,
                should_fallback=True,
                retry_delay=0.0,
                message="Authentication error"
            )
        
        elif 'quota' in error_msg or 'billing' in error_msg:
            # Quota/billing error
            self._update_health(provider, -0.8)
            return ErrorInfo(
                severity=ErrorSeverity.CRITICAL,
                should_fallback=True,
                retry_delay=0.0,
                message="Quota or billing error"
            )
        
        elif self.consecutive_failures.get(provider, 0) >= self.max_consecutive_failures:
            # Too many consecutive failures
            self._update_health(provider, -0.3)
            return ErrorInfo(
                severity=ErrorSeverity.CRITICAL,
                should_fallback=True,
                retry_delay=0.0,
                message="Too many consecutive failures"
            )
        
        else:
            # Generic error
            self._update_health(provider, -0.15)
            return ErrorInfo(
                severity=ErrorSeverity.MEDIUM,
                should_fallback=True,
                retry_delay=2.0,
                message="Generic error"
            )
    
    def handle_success(self, provider: AIProviderType):
        """
        Handle a successful operation from an AI provider.
        
        Args:
            provider: The AI provider that succeeded
        """
        # Reset consecutive failures
        self.consecutive_failures[provider] = 0
        
        # Improve health score
        self._update_health(provider, self.health_recovery_rate)
        
        logger.debug(f"Success recorded for {provider.value}, health: {self.get_provider_health(provider):.2f}")
    
    def _update_health(self, provider: AIProviderType, delta: float):
        """
        Update the health score for a provider.
        
        Args:
            provider: The AI provider
            delta: Change in health score (positive for improvement, negative for degradation)
        """
        current_health = self.provider_health.get(provider, 1.0)
        new_health = max(0.0, min(1.0, current_health + delta))
        self.provider_health[provider] = new_health
        
        logger.debug(f"Health updated for {provider.value}: {current_health:.2f} -> {new_health:.2f}")
    
    def get_provider_health(self, provider: AIProviderType) -> float:
        """
        Get the current health score for a provider.
        
        Args:
            provider: The AI provider
            
        Returns:
            float: Health score between 0.0 and 1.0
        """
        return self.provider_health.get(provider, 1.0)
    
    def should_use_provider(self, provider: AIProviderType) -> bool:
        """
        Determine if a provider should be used based on its health.
        
        Args:
            provider: The AI provider
            
        Returns:
            bool: True if the provider should be used, False otherwise
        """
        health = self.get_provider_health(provider)
        consecutive_failures = self.consecutive_failures.get(provider, 0)
        
        # Don't use if health is too low
        if health < self.min_health_threshold:
            return False
        
        # Don't use if too many consecutive failures
        if consecutive_failures >= self.max_consecutive_failures:
            return False
        
        # Check if enough time has passed since last error for recovery
        last_error = self.last_error_time.get(provider)
        if last_error:
            time_since_error = time.time() - last_error
            # Allow recovery after some time based on health
            recovery_time = (1.0 - health) * 300  # Up to 5 minutes for full recovery
            if time_since_error < recovery_time:
                return False
        
        return True
    
    def get_error_summary(self) -> Dict[str, Any]:
        """
        Get a summary of errors and health for all providers.
        
        Returns:
            Dict[str, Any]: Summary of error information
        """
        summary = {
            'provider_health': {
                provider.value: self.get_provider_health(provider)
                for provider in AIProviderType
            },
            'error_counts': {
                provider.value: self.error_counts.get(provider, 0)
                for provider in AIProviderType
            },
            'consecutive_failures': {
                provider.value: self.consecutive_failures.get(provider, 0)
                for provider in AIProviderType
            },
            'healthy_providers': [
                provider.value for provider in AIProviderType
                if self.should_use_provider(provider)
            ],
            'unhealthy_providers': [
                provider.value for provider in AIProviderType
                if not self.should_use_provider(provider)
            ]
        }
        
        return summary
    
    def reset_provider_health(self, provider: Optional[AIProviderType] = None):
        """
        Reset health and error tracking for a provider or all providers.
        
        Args:
            provider: The provider to reset, or None to reset all
        """
        if provider:
            self.provider_health[provider] = 1.0
            self.error_counts[provider] = 0
            self.consecutive_failures[provider] = 0
            if provider in self.last_error_time:
                del self.last_error_time[provider]
            logger.info(f"Reset health tracking for {provider.value}")
        else:
            self.provider_health.clear()
            self.error_counts.clear()
            self.consecutive_failures.clear()
            self.last_error_time.clear()
            logger.info("Reset health tracking for all providers")
    
    def decay_health_over_time(self):
        """
        Gradually decay health scores over time for inactive providers.
        This should be called periodically to prevent stale health scores.
        """
        current_time = time.time()
        
        for provider in list(self.provider_health.keys()):
            last_error = self.last_error_time.get(provider, 0)
            time_since_activity = current_time - last_error
            
            # Decay health if provider has been inactive for a while
            if time_since_activity > 3600:  # 1 hour
                decay_amount = self.health_decay_rate * (time_since_activity / 3600)
                self._update_health(provider, -decay_amount)


# Global error handler instance
error_handler = AIErrorHandler()
