import React from 'react';
import { useSelector } from 'react-redux';
import { selectVideoCall } from '../../store';
import { videoCallActions } from '../../store';

interface ParticipantGridProps {
  participants: any[];
  localParticipant: any;
  onToggleAudio?: (participant: any) => void;
  onToggleVideo?: (participant: any) => void;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  participants,
  localParticipant,
  onToggleAudio,
  onToggleVideo,
}) => {
  const videoCallState = useSelector(selectVideoCall);

  const getParticipantName = (participant: any) => {
    return participant.name || participant.identity || 'Unknown';
  };

  const isAudioMuted = (participant: any) => {
    return !participant.isMicrophoneEnabled;
  };

  const isVideoMuted = (participant: any) => {
    return !participant.isCameraEnabled;
  };

  const renderParticipant = (participant: any, isLocal: boolean = false) => {
    const participantName = getParticipantName(participant);
    const audioMuted = isAudioMuted(participant);
    const videoMuted = isVideoMuted(participant);

    return (
      <div className="participant-tile">
        <div className="participant-video">
          {participant.videoTrack && !videoMuted ? (
            <video
              ref={(el) => {
                if (el && participant.videoTrack) {
                  participant.videoTrack.attach(el);
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
              {videoMuted && (
                <div className="video-muted-indicator">
                  🎥
                </div>
              )}
            </div>
          )}
          
          {/* Speaking indicator */}
          {participant.isMicrophoneEnabled && (
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
              onClick={() => onToggleAudio?.(participant)}
              className={`control-button ${audioMuted ? 'muted' : ''}`}
              title={audioMuted ? 'Unmute' : 'Mute'}
            >
              {audioMuted ? '🔇' : '🎤'}
            </button>
            
            <button
              onClick={() => onToggleVideo?.(participant)}
              className={`control-button ${videoMuted ? 'muted' : ''}`}
              title={videoMuted ? 'Start Video' : 'Stop Video'}
            >
              {videoMuted ? '🎥' : '📹'}
            </button>
          </div>
        </div>
        
        <style jsx>{`
          .participant-tile {
            position: relative;
            background: #1a1a1a;
            border-radius: 8px;
            overflow: hidden;
            border: 2px solid #333;
          }
          
          .participant-video {
            position: relative;
            width: 100%;
            height: 200px;
            background: #000;
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
          
          .video-muted-indicator,
          .speaking-indicator {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
          }
          
          .speaking-indicator {
            background: #10b981;
          }
          
          .participant-info {
            padding: 12px;
            background: #2a2a2a;
          }
          
          .participant-name {
            color: white;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 8px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
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
            color: white;
            padding: 8px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s;
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

  const allParticipants = [localParticipant, ...participants].filter(Boolean);

  return (
    <div className="participant-grid">
      {allParticipants.map((participant, index) => 
        renderParticipant(participant, participant === localParticipant)
      )}
      
      <style jsx>{`
        .participant-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
          padding: 16px;
          background: #0f172a;
          min-height: 100vh;
        }
        
        @media (max-width: 768px) {
          .participant-grid {
            grid-template-columns: 1fr;
            gap: 8px;
            padding: 8px;
          }
        }
        
        @media (max-width: 480px) {
          .participant-grid {
            grid-template-columns: 1fr;
            gap: 4px;
            padding: 4px;
          }
        }
      `}</style>
    </div>
  );
};
