'use client';

import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { Firestore } from 'firebase/firestore';
import { FirebaseStorage } from 'firebase/storage';

type Attachment = { url: string; name: string; type: string; size: number };
type ManualNote = { text: string; timestamp: string; attachments?: Attachment[] };

interface NotesPanelProps {
  roomName: string;
  db: Firestore | null;
  storage: FirebaseStorage | null;
}

export default function NotesPanel({ roomName, db, storage }: NotesPanelProps) {
  const [note, setNote] = useState('');
  const [manualNotes, setManualNotes] = useState<ManualNote[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [isUploading, setIsUploading] = useState(false);

  const MAX_FILE_SIZE_IMAGE = 10 * 1024 * 1024; // 10MB
  const MAX_FILE_SIZE_PDF = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Only images (JPEG, PNG, GIF, WebP) and PDFs are allowed.`);
        return;
      }

      const isImage = file.type.startsWith('image/');
      const maxSize = isImage ? MAX_FILE_SIZE_IMAGE : MAX_FILE_SIZE_PDF;
      if (file.size > maxSize) {
        const maxSizeMB = maxSize / (1024 * 1024);
        errors.push(`${file.name}: File too large. Maximum size is ${maxSizeMB}MB.`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      alert('File selection errors:\n' + errors.join('\n'));
    }

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
    }

    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadProgress((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const uploadFile = async (file: File, index: number): Promise<Attachment> => {
    if (!storage || !roomName) throw new Error('Storage not available');

    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const storageRef = ref(storage, `notes/${roomName}/${fileName}`);

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress((prev) => ({ ...prev, [index]: progress }));
        },
        (error) => {
          console.error('File upload error:', error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              url: downloadURL,
              name: file.name,
              type: file.type,
              size: file.size
            });
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  };

  const addNote = async () => {
    if (!note.trim() && selectedFiles.length === 0) return;

    setIsUploading(true);
    const timestamp = new Date().toISOString();
    const attachments: Attachment[] = [];

    if (selectedFiles.length > 0 && storage) {
      try {
        const uploadedFiles = await Promise.all(selectedFiles.map((file, index) => uploadFile(file, index)));
        attachments.push(...uploadedFiles);
      } catch (error) {
        console.error('Error uploading files:', error);
        alert('Error uploading files. Please try again.');
        setIsUploading(false);
        return;
      }
    }

    const newNote: ManualNote = {
      text: note.trim() || '(No text)',
      timestamp,
      ...(attachments.length > 0 && { attachments })
    };

    const updatedNotes = [...manualNotes, newNote];
    setManualNotes(updatedNotes);
    setNote('');
    setSelectedFiles([]);
    setUploadProgress({});
    setIsUploading(false);

    if (db && roomName) {
      const firestoreDb = db; // Store in const so TypeScript knows it's defined
      const callRef = doc(firestoreDb, 'calls', roomName);
      setDoc(
        callRef,
        {
          roomName,
          manualNotes: updatedNotes,
          lastUpdated: new Date(),
          status: 'active'
        },
        { merge: true }
      ).catch((error) => console.error('Error storing manual notes:', error));
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h4
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151'
          }}
        >
          Add Manual Note:
        </h4>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Enter your note..."
            style={{
              flex: 1,
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              pointerEvents: 'auto'
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              e.currentTarget.focus();
            }}
            onFocus={(e) => {
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && !isUploading) {
                e.preventDefault();
                addNote();
              }
            }}
            onKeyPress={(e) => {
              e.stopPropagation();
            }}
            disabled={isUploading}
            autoFocus={false}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              addNote();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
            }}
            disabled={isUploading || (!note.trim() && selectedFiles.length === 0)}
            style={{
              backgroundColor: (note.trim() || selectedFiles.length > 0) && !isUploading ? '#2563eb' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: '500',
              cursor: (note.trim() || selectedFiles.length > 0) && !isUploading ? 'pointer' : 'not-allowed',
              pointerEvents: 'auto'
            }}
          >
            {isUploading ? 'Uploading...' : 'Add'}
          </button>
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <label
            style={{
              display: 'inline-block',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: '500',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              color: isUploading ? '#9ca3af' : '#374151',
              pointerEvents: isUploading ? 'none' : 'auto'
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            📎 Attach File
            <input type="file" multiple accept="image/*,.pdf" onChange={handleFileSelect} style={{ display: 'none' }} disabled={isUploading} />
          </label>
          <span style={{ fontSize: '0.7rem', color: '#6b7280', marginLeft: '0.5rem' }}>(Images: max 10MB, PDFs: max 5MB)</span>
        </div>

        {selectedFiles.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  marginBottom: '0.25rem',
                  fontSize: '0.7rem'
                }}
              >
                <span style={{ flex: 1, color: '#374151', wordBreak: 'break-word' }}>
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
                {uploadProgress[index] !== undefined && (
                  <div style={{ width: '60px', height: '4px', backgroundColor: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${uploadProgress[index]}%`,
                        height: '100%',
                        backgroundColor: '#2563eb',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                )}
                <button
                  onClick={() => removeFile(index)}
                  disabled={isUploading}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#dc2626',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    padding: '0.25rem'
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {manualNotes.length > 0 && (
        <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '0.75rem' }}>
          <h4
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151'
            }}
          >
            Recent Notes:
          </h4>
          {manualNotes.map((note, index) => (
            <div
              key={index}
              style={{
                padding: '0.5rem',
                backgroundColor: '#fef9c3',
                border: '1px solid #fde047',
                borderRadius: '0.375rem',
                marginBottom: '0.5rem',
                fontSize: '0.75rem',
                color: '#78350f',
                wordBreak: 'break-word'
              }}
            >
              <div style={{ marginBottom: note.attachments && note.attachments.length > 0 ? '0.5rem' : '0' }}>
                <strong>{new Date(note.timestamp).toLocaleString()}:</strong> {note.text}
              </div>
              {note.attachments && note.attachments.length > 0 && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #fde047' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.25rem', color: '#92400e' }}>Attachments:</div>
                  {note.attachments.map((attachment, attIndex) => (
                    <div key={attIndex} style={{ marginBottom: '0.25rem' }}>
                      {attachment.type.startsWith('image/') ? (
                        <div>
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '150px',
                              borderRadius: '0.25rem',
                              marginBottom: '0.25rem',
                              cursor: 'pointer'
                            }}
                            onClick={() => window.open(attachment.url, '_blank')}
                          />
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.65rem',
                              color: '#2563eb',
                              textDecoration: 'underline',
                              display: 'block'
                            }}
                          >
                            {attachment.name} ({(attachment.size / 1024).toFixed(1)} KB)
                          </a>
                        </div>
                      ) : (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '0.65rem',
                            color: '#2563eb',
                            textDecoration: 'underline',
                            display: 'block'
                          }}
                        >
                          📄 {attachment.name} ({(attachment.size / 1024).toFixed(1)} KB)
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


