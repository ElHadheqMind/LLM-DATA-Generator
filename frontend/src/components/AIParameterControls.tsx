import React, { useState } from 'react';
import { Thermometer, Hash, Percent, Settings, RotateCcw, Info } from 'lucide-react';

interface AIParameterControlsProps {
  temperature: number;
  maxTokens: number;
  topP: number;
  systemPrompt: string; // Keep for backward compatibility
  onTemperatureChange: (value: number) => void;
  onMaxTokensChange: (value: number) => void;
  onTopPChange: (value: number) => void;
  onSystemPromptChange: (value: string) => void; // Keep for backward compatibility
}

const AIParameterControls: React.FC<AIParameterControlsProps> = ({
  temperature,
  maxTokens,
  topP,
  onTemperatureChange,
  onMaxTokensChange,
  onTopPChange
}) => {
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const getTemperatureColor = (temp: number) => {
    if (temp <= 0.3) return '#3b82f6'; // Blue for focused
    if (temp <= 0.7) return '#10b981'; // Green for balanced
    if (temp <= 1.2) return '#f59e0b'; // Yellow for creative
    return '#ef4444'; // Red for very creative
  };

  const getTokensColor = (tokens: number) => {
    if (tokens <= 1000) return '#10b981'; // Green for short
    if (tokens <= 4000) return '#f59e0b'; // Yellow for medium
    return '#ef4444'; // Red for long
  };

  return (
    <div className="ai-parameter-controls-enhanced">
      <div className="controls-header">
        <div className="header-title">
          <Settings size={18} />
          <span>AI Model Configuration</span>
        </div>
      </div>

      <div className="controls-grid">
        {/* Temperature Control */}
        <div className="parameter-card">
          <div className="parameter-header">
            <div className="parameter-title">
              <Thermometer size={16} style={{ color: getTemperatureColor(temperature) }} />
              <span>Temperature</span>
              <button
                className="info-button"
                onMouseEnter={() => setShowTooltip('temperature')}
                onMouseLeave={() => setShowTooltip(null)}
              >
                <Info size={12} />
              </button>
            </div>
            <div className="parameter-value" style={{ color: getTemperatureColor(temperature) }}>
              {temperature.toFixed(1)}
            </div>
          </div>

          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
              className="parameter-slider-enhanced"
              style={{ '--slider-color': getTemperatureColor(temperature) } as React.CSSProperties}
            />
            <div className="slider-labels">
              <span>Focused</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>

          {showTooltip === 'temperature' && (
            <div className="tooltip">
              Controls randomness in responses. Lower values (0-0.3) produce focused, deterministic outputs.
              Higher values (1.0-2.0) generate more creative and varied responses.
            </div>
          )}
        </div>

        {/* Max Tokens Control */}
        <div className="parameter-card">
          <div className="parameter-header">
            <div className="parameter-title">
              <Hash size={16} style={{ color: getTokensColor(maxTokens) }} />
              <span>Max Tokens</span>
              <button
                className="info-button"
                onMouseEnter={() => setShowTooltip('tokens')}
                onMouseLeave={() => setShowTooltip(null)}
              >
                <Info size={12} />
              </button>
            </div>
            <div className="parameter-value" style={{ color: getTokensColor(maxTokens) }}>
              {maxTokens.toLocaleString()}
            </div>
          </div>

          <div className="slider-container">
            <input
              type="range"
              min="50"
              max="8196"
              step="50"
              value={maxTokens}
              onChange={(e) => onMaxTokensChange(parseInt(e.target.value))}
              className="parameter-slider-enhanced"
              style={{ '--slider-color': getTokensColor(maxTokens) } as React.CSSProperties}
            />
            <div className="slider-labels">
              <span>50</span>
              <span>4K</span>
              <span>8196</span>
            </div>
          </div>

          {showTooltip === 'tokens' && (
            <div className="tooltip">
              Maximum number of tokens in the response. One token ≈ 0.75 words.
              Higher values allow longer responses but may increase cost and latency.
            </div>
          )}
        </div>

        {/* Top P Control */}
        <div className="parameter-card">
          <div className="parameter-header">
            <div className="parameter-title">
              <Percent size={16} style={{ color: topP > 0.8 ? '#ef4444' : topP > 0.5 ? '#f59e0b' : '#10b981' }} />
              <span>Top P</span>
              <button
                className="info-button"
                onMouseEnter={() => setShowTooltip('topP')}
                onMouseLeave={() => setShowTooltip(null)}
              >
                <Info size={12} />
              </button>
            </div>
            <div className="parameter-value" style={{ color: topP > 0.8 ? '#ef4444' : topP > 0.5 ? '#f59e0b' : '#10b981' }}>
              {topP.toFixed(1)}
            </div>
          </div>

          <div className="slider-container">
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={topP}
              onChange={(e) => onTopPChange(parseFloat(e.target.value))}
              className="parameter-slider-enhanced"
              style={{ '--slider-color': topP > 0.8 ? '#ef4444' : topP > 0.5 ? '#f59e0b' : '#10b981' } as React.CSSProperties}
            />
            <div className="slider-labels">
              <span>Focused</span>
              <span>Balanced</span>
              <span>Diverse</span>
            </div>
          </div>

          {showTooltip === 'topP' && (
            <div className="tooltip">
              Nucleus sampling parameter. Controls diversity by considering only the top P% of probability mass.
              Lower values (0.1-0.5) are more focused, higher values (0.8-1.0) are more diverse.
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="parameter-actions-enhanced">
        <button
          onClick={() => {
            onTemperatureChange(0.7);
            onMaxTokensChange(300);
            onTopPChange(0.9);
          }}
          className="reset-button"
        >
          <RotateCcw size={16} />
          Reset to Defaults
        </button>

        <div className="preset-buttons">
          <button
            onClick={() => {
              onTemperatureChange(0.2);
              onMaxTokensChange(150);
              onTopPChange(0.3);
            }}
            className="preset-button focused"
          >
            Focused
          </button>
          <button
            onClick={() => {
              onTemperatureChange(0.7);
              onMaxTokensChange(500);
              onTopPChange(0.9);
            }}
            className="preset-button balanced"
          >
            Balanced
          </button>
          <button
            onClick={() => {
              onTemperatureChange(1.2);
              onMaxTokensChange(1000);
              onTopPChange(0.95);
            }}
            className="preset-button creative"
          >
            Creative
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIParameterControls;
