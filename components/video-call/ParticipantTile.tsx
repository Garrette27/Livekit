import React from 'react';
import { useVideoCallStore } from '../../stores';
import { RemoteParticipant, Track } from 'livekit-client';

interface ParticipantTileProps {
  participant: RemoteParticipant;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
  onToggleAudio?: () => void;
  onToggleVideo?: () => void;
}

export const ParticipantTile: React.FC<ParticipantTileProps> = ({
  participant,
  isLocal = false,
  isMuted = false,
  isVideoEnabled = true,
  onToggleAudio,
  onToggleVideo,
}) => {
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  React.useEffect(() => {
    if (participant.isMicrophoneEnabled !== undefined) {
      setIsSpeaking(participant.isMicrophoneEnabled);
    }
  }, [participant]);

  const participantName = participant.name || participant.identity || 'Unknown';
  const isAudioMuted = !participant.isMicrophoneEnabled;
  const isVideoMuted = !participant.isCameraEnabled;

  return (
    <div className="participant-tile">
      <div className="participant-video">
        {isVideoEnabled ? (
          <video
            ref={(el) => {
              if (el) {
                // Attach the video element to the participant
                // This will be handled by the LiveKit room component
              }
            }}
            autoPlay
            playsInline
            muted={isLocal}
            className="video-element"
          />
        ) : (
          <div className="video-placeholder">
            <div className="participant-avatar">
              {participantName.charAt(0).toUpperCase()}
            </div>
            {isVideoMuted && (
              <div className="video-muted-indicator">
                🎥
              </div>
            )}
          </div>
        )}
        
        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="speaking-indicator">
            🎤
          </div>
        )}
      </div>
      
      <div className="participant-info">
        <div className="participant-name">
          {participantName}
          {isLocal && <span className="local-indicator"> (You)</span>}
        </div>
        
        <div className="participant-controls">
          <button
            onClick={onToggleAudio}
            className={`control-button ${isAudioMuted ? 'muted' : ''}`}
            title={isAudioMuted ? 'Unmute' : 'Mute'}
          >
            {isAudioMuted ? '🔇' : '🎤'}
          </button>
          
          <button
            onClick={onToggleVideo}
            className={`control-button ${isVideoMuted ? 'muted' : ''}`}
            title={isVideoMuted ? 'Start Video' : 'Stop Video'}
          >
            {isVideoMuted ? '🎥' : '📹'}
          </button>
        </div>
      </div>
      
      <style jsx>{`
        .participant-tile {
          position: relative;
          background: #1a1a1a;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          width: 300px;
          height: 200px;
        }
        
        .participant-video {
          position: relative;
          flex: 1;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .video-element {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .video-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #2a2a2a;
          position: relative;
        }
        
        .participant-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: #3b82f6;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
        }
        
        .video-muted-indicator {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.7);
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }
        
        .speaking-indicator {
          position: absolute;
          bottom: 10px;
          left: 10px;
          background: #10b981;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }
        
        .participant-info {
          padding: 12px;
          background: #2a2a2a;
        }
        
        .participant-name {
          font-size: 14px;
          font-weight: 600;
          color: white;
          margin-bottom: 8px;
        }
        
        .local-indicator {
          color: #3b82f6;
          font-size: 12px;
        }
        
        .participant-controls {
          display: flex;
          gap: 8px;
        }
        
        .control-button {
          background: #374151;
          border: none;
          border-radius: 6px;
          padding: 6px 10px;
          color: white;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }
        
        .control-button:hover {
          background: #4b5563;
        }
        
        .control-button.muted {
          background: #dc2626;
        }
        
        .control-button.muted:hover {
          background: #b91c1c;
        }
      `}</style>
    </div>
  );
};
