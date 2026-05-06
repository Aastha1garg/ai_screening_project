import React, { useEffect, useState } from 'react';
import '../styles/ProgressIndicator.css';
import { formatErrorForDisplay } from '../utils/errorHandler';

function ProgressIndicator({ progress, isVisible = true }) {
  const [animatedPercent, setAnimatedPercent] = useState(0);

  useEffect(() => {
    if (progress && progress.progress_percent !== undefined) {
      // Smooth animation of progress bar
      const timer = setTimeout(() => {
        setAnimatedPercent(progress.progress_percent);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [progress?.progress_percent]);

  if (!isVisible || !progress) {
    return null;
  }

  const statusMessages = {
    'started': 'Starting scoring process...',
    'processing': `Processing ${progress.current_resume} against ${progress.current_jd}`,
    'completed': `Completed: ${progress.current_resume} vs ${progress.current_jd}`,
    'error': `Error: ${formatErrorForDisplay(progress.error, 'Unknown error')}`,
    'all_completed': 'All scoring completed!'
  };

  return (
    <div className="progress-indicator-container">
      <div className="progress-card">
        <div className="progress-header">
          <h3>Real-time Scoring Progress</h3>
          <p className="progress-status-text">
            {statusMessages[progress.event] || 'Processing...'}
          </p>
        </div>

        <div className="progress-bar-wrapper">
          <div className="progress-bar-background">
            <div
              className="progress-bar-fill"
              style={{
                width: `${animatedPercent}%`,
                transition: 'width 0.3s ease-out'
              }}
            />
          </div>
          <span className="progress-percent">{Math.round(animatedPercent)}%</span>
        </div>

        <div className="progress-details">
          <div className="detail-row">
            <span className="detail-label">Pair:</span>
            <span className="detail-value">
              {progress.current_pair} / {progress.total_pairs}
            </span>
          </div>
          
          {progress.current_resume && (
            <div className="detail-row">
              <span className="detail-label">Resume:</span>
              <span className="detail-value detail-ellipsis">{progress.current_resume}</span>
            </div>
          )}
          
          {progress.current_jd && (
            <div className="detail-row">
              <span className="detail-label">JD:</span>
              <span className="detail-value detail-ellipsis">{progress.current_jd}</span>
            </div>
          )}
        </div>

        {progress.event === 'error' && (
          <div className="error-message">
            <strong>Error:</strong> {formatErrorForDisplay(progress.error, 'Unknown error')}
          </div>
        )}

        <div className="progress-animation">
          <div className="dot dot-1"></div>
          <div className="dot dot-2"></div>
          <div className="dot dot-3"></div>
        </div>
      </div>
    </div>
  );
}

export default ProgressIndicator;
