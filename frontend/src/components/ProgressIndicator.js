import React, { useEffect, useState } from 'react';
import '../styles/ProgressIndicator.css';
import { formatErrorForDisplay } from '../utils/errorHandler';
import { motion, AnimatePresence } from 'framer-motion';

function ProgressIndicator({ progress, isVisible = true }) {
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (progress && progress.progress_percent !== undefined) {
      // Smooth animation of progress bar
      const timer = setTimeout(() => {
        setAnimatedPercent(progress.progress_percent);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [progress?.progress_percent]);

  useEffect(() => {
    if (progress && progress.event === 'all_completed') {
      const timer1 = setTimeout(() => {
        setShowSuccess(true);
      }, 800); // Wait a bit at 100% before showing success screen
      
      const timer2 = setTimeout(() => {
        setClosed(true);
      }, 6000); // Auto close after 6 seconds
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      setShowSuccess(false);
      setClosed(false);
    }
  }, [progress?.event]);

  if (!isVisible || !progress || closed) {
    return null;
  }

  const statusMessages = {
    'uploading': 'Uploading files to server...',
    'processing': 'Extracting text and running AI scoring...',
    'started': 'Parsing Resume...',
    'completed': 'Updating Dashboard...',
    'all_completed': 'Completed Successfully...',
    'error': `Error: ${formatErrorForDisplay(progress.error, 'Unknown error')}`,
  };

  const getAverageScore = () => {
    if (!progress.results || !progress.results.length) return 0;
    const total = progress.results.reduce((acc, curr) => acc + (curr.score || curr.final_score || 0), 0);
    return Math.round(total / progress.results.length);
  };

  const getShortlistedCount = () => {
    if (!progress.results || !progress.results.length) return 0;
    return progress.results.filter(r => {
      const s = r.score || r.final_score || 0;
      return s >= 75;
    }).length;
  };

  if (showSuccess) {
    return (
      <div className="progress-indicator-container">
        <motion.div 
          className="progress-card success-card"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          style={{ padding: '30px', textAlign: 'center', borderColor: '#22c55e', boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)' }}
        >
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            style={{ fontSize: '4rem', marginBottom: '10px' }}
          >
            ✅
          </motion.div>
          <h2 style={{ color: '#22c55e', marginTop: 0, marginBottom: '20px' }}>Resume Upload & AI Analysis Completed Successfully</h2>
          
          <div style={{ textAlign: 'left', background: 'rgba(15, 23, 42, 0.5)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
            <p style={{ marginTop: 0, fontWeight: 'bold', color: '#e2e8f0' }}>The resume(s) have been:</p>
            <ul style={{ color: '#94a3b8', lineHeight: '1.6', marginBottom: 0 }}>
              <li>Uploaded successfully</li>
              <li>Parsed using AI/NLP</li>
              <li>Analyzed for ATS compatibility</li>
              <li>Matched with the Job Description</li>
              <li>Ranked and added to dashboard analytics</li>
            </ul>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '25px' }}>
            <div style={{ flex: 1, background: 'rgba(15, 23, 42, 0.5)', padding: '15px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Avg ATS Score</div>
              <div style={{ fontSize: '1.5rem', color: '#38bdf8', fontWeight: 'bold' }}>{getAverageScore()}%</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(15, 23, 42, 0.5)', padding: '15px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Shortlisted</div>
              <div style={{ fontSize: '1.5rem', color: '#22c55e', fontWeight: 'bold' }}>{getShortlistedCount()}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(15, 23, 42, 0.5)', padding: '15px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Processed</div>
              <div style={{ fontSize: '1.5rem', color: '#e2e8f0', fontWeight: 'bold' }}>{progress.total_files}</div>
            </div>
          </div>

          <button 
            className="primary-btn" 
            style={{ width: '100%', padding: '12px', background: '#22c55e', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => setClosed(true)}
          >
            View Detailed Analysis
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="progress-indicator-container">
      <div className="progress-card">
        <div className="progress-header">
          <h3>Real-time Scoring Progress</h3>
          <p className="progress-status-text">
            {statusMessages[progress.event] || progress.event || 'Processing...'}
          </p>
        </div>

        <div className="progress-bar-wrapper">
          <div className="progress-bar-background">
            <div
              className="progress-bar-fill"
              style={{
                width: `${animatedPercent || 0}%`,
                transition: 'width 0.3s ease-out'
              }}
            />
          </div>
          <span className="progress-percent">{Math.round(animatedPercent || 0)}%</span>
        </div>

        <div className="progress-details">
          {progress.total_files > 0 && (
            <div className="detail-row">
              <span className="detail-label">Files Completed:</span>
              <span className="detail-value">
                {progress.completed_files} / {progress.total_files}
              </span>
            </div>
          )}
          
          {progress.current_resume && (
            <div className="detail-row">
              <span className="detail-label">Current Resume:</span>
              <span className="detail-value detail-ellipsis">{progress.current_resume}</span>
            </div>
          )}
          
          {progress.current_jd && (
            <div className="detail-row">
              <span className="detail-label">Current JD:</span>
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
