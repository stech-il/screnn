import { io } from 'socket.io-client';

console.log('🔧 יוצר Socket.IO connection...');

const baseUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
const socket = io(baseUrl, {
  transports: ['websocket'],
  autoConnect: true,
  withCredentials: true,
  path: '/socket.io'
});

console.log('🔧 Socket.IO instance נוצר:', socket);

// Add connection logging
socket.on('connect', () => {
  console.log('🔌 Socket.IO מחובר:', socket.id);
  console.log('📊 Socket state:', socket.connected);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket.IO מנותק, סיבה:', reason);
  console.log('📊 Socket state:', socket.connected);
});

socket.on('connect_error', (error) => {
  console.error('❌ שגיאת חיבור Socket.IO:', error);
  console.error('📊 פרטי השגיאה:', {
    message: error.message,
    description: error.description,
    context: error.context
  });
});

// Add more detailed logging
socket.on('error', (error) => {
  console.error('❌ Socket.IO error:', error);
});

console.log('🔧 Socket.IO listeners נרשמו');

export default socket; 