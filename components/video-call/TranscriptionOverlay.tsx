import React from 'react';
import { useSelector } from 'react-redux';
import { selectTranscription } from '../../store';
import { transcriptionActions } from '../../store';

interface TranscriptionOverlayProps {
  isVisible?: boolean;
  onAddManualNote?: (note: string) => void;
}

export const TranscriptionOverlay: React.FC<TranscriptionOverlayProps> = ({
  isVisible = true,
  onAddManualNote,
}) => {
  const transcriptionState = useSelector(selectTranscription);
  const [manualNoteInput, setManualNoteInput] = React.useState('');

  const handleAddNote = () => {
    if (manualNoteInput.trim() && onAddManualNote) {
      onAddManualNote(manualNoteInput.trim());
      setManualNoteInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleAddNote();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="transcription-overlay">
      <div className="transcription-header">
        <h3>📝 Live Transcription</h3>
        <div className="transcription-status">
          Status: {transcriptionState.speechRecognitionStatus}
          {transcriptionState.isThrottled && (
            <span className="throttled-warning">⚠️ Throttled</span>
          )}
        </div>
      </div>
      
      <div className="transcription-content">
        <div className="transcription-entries">
          {transcriptionState.transcription.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎤</div>
              <p>Listening for speech...</p>
            </div>
          ) : (
            <div className="entries-list">
              {transcriptionState.transcription.map((entry, index) => (
                <div key={index} className="transcription-entry">
                  <span className="entry-text">{entry}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="manual-note-input">
          <input
            type="text"
            value={manualNoteInput}
            onChange={(e) => setManualNoteInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Add a manual note..."
            className="note-input"
            disabled={transcriptionState.isThrottled}
          />
          <button
            onClick={handleAddNote}
            disabled={!manualNoteInput.trim() || transcriptionState.isThrottled}
            className="add-note-button"
          >
            ➕ Add Note
          </button>
        </div>
      </div>
      
      <div className="transcription-footer">
        <div className="stats">
          <span>📊 Entries: {transcriptionState.transcription.length}</span>
          <span>🔄 Restarts: {transcriptionState.restartCount}</span>
          {transcriptionState.lastTranscriptionUpdate && (
            <span>🕒 Last: {transcriptionState.lastTranscriptionUpdate.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .transcription-overlay {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 350px;
          max-height: 400px;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          border: 1px solid #374151;
          overflow: hidden;
          z-index: 999;
          display: flex;
          flex-direction: column;
        }
        
        .transcription-header {
          padding: 16px;
          background: #1f2937;
          border-bottom: 1px solid #374151;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .transcription-header h3 {
          margin: 0;
          color: white;
          font-size: 16px;
          font-weight: 600;
        }
        
        .transcription-status {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #9ca3af;
          font-size: 12px;
        }
        
        .throttled-warning {
          color: #f59e0b;
          font-weight: 600;
        }
        
        .transcription-content {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          max-height: 250px;
        }
        
        .empty-state {
          text-align: center;
          color: #9ca3af;
          padding: 20px;
        }
        
        .empty-icon {
          font-size: 24px;
          margin-bottom: 8px;
        }
        
        .entries-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .transcription-entry {
          background: #374151;
          padding: 8px 12px;
          border-radius: 6px;
          border-left: 3px solid #3b82f6;
        }
        
        .entry-text {
          color: #e5e7eb;
          font-size: 13px;
          line-height: 1.4;
          word-wrap: break-word;
        }
        
        .manual-note-input {
          padding: 12px;
          background: #111827;
          border-top: 1px solid #374151;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        
        .note-input {
          flex: 1;
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 6px;
          color: white;
          padding: 8px 12px;
          font-size: 14px;
          outline: none;
        }
        
        .note-input:focus {
          border-color: #3b82f6;
        }
        
        .note-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .add-note-button {
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          color: white;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .add-note-button:hover:not(:disabled) {
          background: #2563eb;
        }
        
        .add-note-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .transcription-footer {
          padding: 12px 16px;
          background: #1f2937;
          border-top: 1px solid #374151;
          font-size: 11px;
          color: #9ca3af;
        }
        
        .stats {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }
        
        @media (max-width: 768px) {
          .transcription-overlay {
            width: 90%;
            right: 5%;
            left: 5%;
            top: auto;
            bottom: 80px;
            max-height: 300px;
          }
        }
      `}</style>
    </div>
  );
};
