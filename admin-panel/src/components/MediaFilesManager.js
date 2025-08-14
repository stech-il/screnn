import React, { useState, useEffect } from 'react';
import axios from '../utils/axios';
import './MediaFilesManager.css';

const MediaFilesManager = () => {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchMediaFiles();
  }, []);

  const fetchMediaFiles = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/media-files');
      setMediaFiles(response.data);
      setError(null);
    } catch (err) {
      setError('שגיאה בטעינת קבצי מדיה: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelection = (contentId) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(contentId)) {
      newSelected.delete(contentId);
    } else {
      newSelected.add(contentId);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map(file => file.content_id)));
    }
  };

  const deleteFile = async (contentId) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק קובץ זה?')) {
      return;
    }

    try {
      setDeleteLoading(true);
      await axios.delete(`/api/admin/media-files/${contentId}`);
      await fetchMediaFiles();
      setSelectedFiles(new Set());
    } catch (err) {
      setError('שגיאה במחיקת הקובץ: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeleteLoading(false);
    }
  };

  const deleteSelectedFiles = async () => {
    if (selectedFiles.size === 0) return;
    
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק ${selectedFiles.size} קבצים נבחרים?`)) {
      return;
    }

    try {
      setDeleteLoading(true);
      await axios.delete('/api/admin/media-files', {
        data: { contentIds: Array.from(selectedFiles) }
      });
      await fetchMediaFiles();
      setSelectedFiles(new Set());
    } catch (err) {
      setError('שגיאה במחיקת הקבצים: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeleteLoading(false);
    }
  };

  const getFileIcon = (type) => {
    if (type === 'image') return '🖼️';
    if (type === 'video') return '🎥';
    return '📁';
  };

  const getFileType = (filePath) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return 'image';
    if (['mp4', 'avi', 'mov', 'wmv', 'webm'].includes(ext)) return 'video';
    return 'unknown';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'לא ידוע';
    return new Date(dateString).toLocaleString('he-IL');
  };

  const filteredFiles = mediaFiles.filter(file => {
    const matchesSearch = file.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         file.screen_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         file.file_path?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || getFileType(file.file_path) === filterType;
    
    return matchesSearch && matchesType;
  });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    if (sortBy === 'file_size') {
      aValue = a.file_size || 0;
      bValue = b.file_size || 0;
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  if (loading) {
    return (
      <div className="media-files-manager">
        <div className="loading">טוען קבצי מדיה...</div>
      </div>
    );
  }

  return (
    <div className="media-files-manager">
      <div className="header">
        <h2>ניהול קבצי מדיה</h2>
        <div className="header-actions">
          <button 
            className="refresh-btn"
            onClick={fetchMediaFiles}
            disabled={loading}
          >
            🔄 רענן
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="controls">
        <div className="search-filter">
          <input
            type="text"
            placeholder="חיפוש בקבצים..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">כל הסוגים</option>
            <option value="image">תמונות</option>
            <option value="video">סרטונים</option>
          </select>
        </div>

        <div className="sort-controls">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="created_at">תאריך יצירה</option>
            <option value="updated_at">תאריך עדכון</option>
            <option value="title">שם</option>
            <option value="screen_name">שם מסך</option>
            <option value="file_size">גודל קובץ</option>
          </select>
          
          <button 
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="sort-order-btn"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className="bulk-actions">
        <label className="select-all-label">
          <input
            type="checkbox"
            checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
            onChange={handleSelectAll}
            className="select-all-checkbox"
          />
          בחר הכל
        </label>
        
        {selectedFiles.size > 0 && (
          <button 
            onClick={deleteSelectedFiles}
            disabled={deleteLoading}
            className="delete-selected-btn"
          >
            <span className="delete-icon">🗑️</span>
            מחק נבחרים ({selectedFiles.size})
          </button>
        )}
      </div>

      <div className="stats">
        <span>סה"כ קבצים: {filteredFiles.length}</span>
        <span>סה"כ גודל: {formatFileSize(filteredFiles.reduce((sum, file) => sum + (file.file_size || 0), 0))}</span>
      </div>

      <div className="media-files-list">
        {sortedFiles.length === 0 ? (
          <div className="no-files">
            {searchTerm || filterType !== 'all' ? 'לא נמצאו קבצים מתאימים' : 'אין קבצי מדיה'}
          </div>
        ) : (
          sortedFiles.map(file => (
            <div key={file.content_id} className="media-file-item">
              <div className="file-checkbox">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.content_id)}
                  onChange={() => handleFileSelection(file.content_id)}
                />
              </div>
              
              <div className="file-icon">
                {getFileIcon(getFileType(file.file_path))}
              </div>
              
              <div className="file-info">
                <div className="file-title">{file.title || 'ללא כותרת'}</div>
                <div className="file-details">
                  <span className="screen-name">מסך: {file.screen_name}</span>
                  <span className="file-path">{file.file_path}</span>
                </div>
                <div className="file-meta">
                  <span>גודל: {file.file_size_formatted}</span>
                  <span>נוצר: {formatDate(file.created_at)}</span>
                  {file.updated_at !== file.created_at && (
                    <span>עודכן: {formatDate(file.updated_at)}</span>
                  )}
                </div>
              </div>
              
              <div className="file-actions">
                <button 
                  onClick={() => deleteFile(file.content_id)}
                  disabled={deleteLoading}
                  className="delete-btn"
                  title="מחק קובץ"
                >
                  <span className="delete-icon">🗑️</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default MediaFilesManager;
