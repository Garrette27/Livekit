import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { videoCallActions, selectVideoCall } from '../../store';
import { RootState } from '../../store';

interface ControlBarProps {
  onToggleAudio?: () => void;
  onToggleVideo?: () => void;
  onToggleScreenShare?: () => void;
  onLeaveRoom?: () => void;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  isScreenSharing?: boolean;
  isConnecting?: boolean;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeaveRoom,
  isAudioEnabled = true,
  isVideoEnabled = true,
  isScreenSharing = false,
  isConnecting = false,
}) => {
  const dispatch = useDispatch();
  const videoCallState = useSelector(selectVideoCall);

  const handleToggleAudio = () => {
    dispatch(videoCallActions.setIsConnecting(true));
    onToggleAudio?.();
  };

  const handleToggleVideo = () => {
    dispatch(videoCallActions.setIsConnecting(true));
    onToggleVideo?.();
  };

  const handleToggleScreenShare = async () => {
    dispatch(videoCallActions.setIsConnecting(true));
    try {
      await onToggleScreenShare?.();
    } catch (error) {
      console.error('Screen share error:', error);
    } finally {
      dispatch(videoCallActions.setIsConnecting(false));
    }
  };

  const handleLeaveRoom = () => {
    dispatch(videoCallActions.resetCallState());
    onLeaveRoom?.();
  };

  return (
    <div className="control-bar">
      <div className="control-group">
        <button
          onClick={handleToggleAudio}
          className={`control-button ${!isAudioEnabled ? 'muted' : ''}`}
          disabled={isConnecting}
          title={isAudioEnabled ? 'Mute' : 'Unmute'}
        >
          {isAudioEnabled ? '🎤' : '🔇'}
        </button>
        
        <button
          onClick={handleToggleVideo}
          className={`control-button ${!isVideoEnabled ? 'muted' : ''}`}
          disabled={isConnecting}
          title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
        >
          {isVideoEnabled ? '📹' : '🎥'}
        </button>
        
        <button
          onClick={handleToggleScreenShare}
          className={`control-button ${isScreenSharing ? 'active' : ''}`}
          disabled={isConnecting}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        >
          {isScreenSharing ? '🖥️' : '🖥️'}
        </button>
      </div>
      
      <div className="control-group">
        <button
          onClick={handleLeaveRoom}
          className="control-button leave-button"
          title="Leave Room"
        >
          📞 Leave Call
        </button>
      </div>
      
      {isConnecting && (
        <div className="connecting-indicator">
          <div className="spinner"></div>
          Connecting...
        </div>
      )}
      
      <style jsx>{`
        .control-bar {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 12px 16px;
          display: flex;
          gap: 16px;
          align-items: center;
          z-index: 1000;
        }
        
        .control-group {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        
        .control-button {
          background: #374151;
          border: none;
          border-radius: 8px;
          color: white;
          padding: 12px 16px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 48px;
          height: 48px;
        }
        
        .control-button:hover:not(:disabled) {
          background: #4b5563;
          transform: scale(1.05);
        }
        
        .control-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .control-button.muted {
          background: #dc2626;
        }
        
        .control-button.muted:hover {
          background: #b91c1c;
        }
        
        .control-button.active {
          background: #10b981;
        }
        
        .control-button.active:hover {
          background: #059669;
        }
        
        .leave-button {
          background: #dc2626;
          font-weight: 600;
        }
        
        .leave-button:hover {
          background: #b91c1c;
        }
        
        .connecting-indicator {
          position: absolute;
          top: -40px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }
        
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #f3f4f6;
          border-top: 2px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
