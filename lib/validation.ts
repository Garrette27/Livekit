/**
 * Security validation utilities for input sanitization and validation
 * Prevents XSS, injection attacks, and ensures data integrity
 */

// Simple HTML sanitization (for basic XSS prevention)
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 1000); // Limit length
}

// Validate room names (alphanumeric, hyphens, underscores only)
export function validateRoomName(roomName: string): boolean {
  if (!roomName || typeof roomName !== 'string') {
    return false;
  }
  
  const sanitized = sanitizeInput(roomName);
  const roomNameRegex = /^[a-zA-Z0-9-_]{3,50}$/;
  
  return roomNameRegex.test(sanitized);
}

// Validate participant names (letters, spaces, basic punctuation)
export function validateParticipantName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  const sanitized = sanitizeInput(name);
  // Allow letters, numbers, spaces, and common punctuation including !, ?, @, #, etc.
  const nameRegex = /^[a-zA-Z0-9\s\-_\.!?@#$%^&*()+={}[\]|\\:";'<>,\/]{2,100}$/;
  
  return nameRegex.test(sanitized) && sanitized.length >= 2 && sanitized.length <= 100;
}

// Validate email addresses
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Validate user ID (Firebase UID format)
export function validateUserId(userId: string): boolean {
  if (!userId || typeof userId !== 'string') {
    return false;
  }
  
  // Firebase UIDs are typically 28 characters, alphanumeric
  const uidRegex = /^[a-zA-Z0-9]{20,30}$/;
  return uidRegex.test(userId);
}

// Validate timestamp
export function validateTimestamp(timestamp: any): boolean {
  if (!timestamp) {
    return false;
  }
  
  // Check if it's a valid Date object or timestamp
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.getTime() > 0;
}

// Validate status values
export function validateStatus(status: string): boolean {
  const validStatuses = ['active', 'completed', 'cancelled', 'pending'];
  return validStatuses.includes(status);
}

// Comprehensive input validation for room creation
export function validateRoomCreationData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Invalid data format');
    return { isValid: false, errors };
  }
  
  // Validate room name
  if (!validateRoomName(data.roomName)) {
    errors.push('Invalid room name. Must be 3-50 characters, alphanumeric with hyphens/underscores only');
  }
  
  // Validate user ID
  if (!validateUserId(data.createdBy)) {
    errors.push('Invalid user ID');
  }
  
  // Validate timestamp
  if (!validateTimestamp(data.createdAt)) {
    errors.push('Invalid creation timestamp');
  }
  
  // Validate status
  if (!validateStatus(data.status)) {
    errors.push('Invalid status. Must be: active, completed, cancelled, or pending');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Comprehensive input validation for call data
export function validateCallData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Invalid data format');
    return { isValid: false, errors };
  }
  
  // Validate room name
  if (!validateRoomName(data.roomName)) {
    errors.push('Invalid room name');
  }
  
  // Validate user ID
  if (!validateUserId(data.createdBy)) {
    errors.push('Invalid user ID');
  }
  
  // Validate timestamp
  if (!validateTimestamp(data.createdAt)) {
    errors.push('Invalid creation timestamp');
  }
  
  // Validate status
  if (!validateStatus(data.status)) {
    errors.push('Invalid status');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Sanitize transcription data
export function sanitizeTranscriptionData(transcription: string[]): string[] {
  if (!Array.isArray(transcription)) {
    return [];
  }
  
  return transcription
    .filter(entry => typeof entry === 'string')
    .map(entry => sanitizeInput(entry))
    .filter(entry => entry.length > 0)
    .slice(0, 1000); // Limit to 1000 entries
}

// Validate and sanitize metadata
export function validateMetadata(metadata: any): any {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  
  const sanitized: any = {};
  
  if (metadata.createdBy && validateUserId(metadata.createdBy)) {
    sanitized.createdBy = metadata.createdBy;
  }
  
  if (metadata.userId && validateUserId(metadata.userId)) {
    sanitized.userId = metadata.userId;
  }
  
  if (metadata.userEmail && validateEmail(metadata.userEmail)) {
    sanitized.userEmail = sanitizeInput(metadata.userEmail);
  }
  
  if (metadata.userName && validateParticipantName(metadata.userName)) {
    sanitized.userName = sanitizeInput(metadata.userName);
  }
  
  return sanitized;
}
