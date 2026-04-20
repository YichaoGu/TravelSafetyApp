import React, { useState, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [history, setHistory] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editNote, setEditNote] = useState('');
  const [lastSuccessTime, setLastSuccessTime] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const normalIntervalRef = useRef(null);
  const retryIntervalRef = useRef(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    loadHistory();
    loadLastSuccessTime();
  }, []);

  useEffect(() => {
    return () => {
      if (normalIntervalRef.current) clearInterval(normalIntervalRef.current);
      if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
      stopCamera();
    };
  }, []);

  const loadLastSuccessTime = () => {
    const saved = localStorage.getItem('lastSuccessTime');
    if (saved) setLastSuccessTime(parseInt(saved));
  };

  const saveLastSuccessTime = (time) => {
    localStorage.setItem('lastSuccessTime', time.toString());
    setLastSuccessTime(time);
  };

  const loadHistory = () => {
    const saved = localStorage.getItem('locationHistory');
    if (saved) setHistory(JSON.parse(saved));
  };

  const saveHistory = (newHistory) => {
    localStorage.setItem('locationHistory', JSON.stringify(newHistory));
    setHistory(newHistory);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // 后置摄像头
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: "environment" } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Camera error:', error);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        alert('Cannot access camera: ' + err.message);
      }
    }
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoUri = canvas.toDataURL('image/jpeg');
      setCapturedImage(photoUri);
      setShowCamera(false);
      stopCamera();
      alert('Photo captured!');
    }
  };

  const openCamera = async () => {
    setShowCamera(true);
    await startCamera();
  };

  const closeCamera = () => {
    setShowCamera(false);
    stopCamera();
  };

  const savePhotoWithLocation = () => {
    if (!capturedImage) {
      alert('Please take a photo first!');
      return;
    }
    if (!location) {
      alert('Please get your location first!');
      return;
    }
    const photoRecord = {
      id: Date.now().toString(),
      type: 'photo',
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      timestamp: new Date().toISOString(),
      photoUri: capturedImage,
      note: '',
    };
    const updatedHistory = [photoRecord, ...history];
    saveHistory(updatedHistory);
    setCapturedImage(null);
    alert('Photo saved with location!');
  };

  const sendToServer = async (latitude, longitude, timestamp) => {
    try {
      const serverUrl = 'http://10.26.10.244:3001/api/location';
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude,
          longitude,
          timestamp: new Date(timestamp).toISOString(),
          deviceId: 'TravelSafetyPWA',
        }),
      });
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Failed to send to server:', error);
      return false;
    }
  };

  const sendLocationViaSMS = (latitude, longitude) => {
    const message = `My location: https://maps.google.com/?q=${latitude},${longitude}`;
    alert(`[SMS SIMULATION]\nTo: +44 123456789\nMessage: ${message}\n\nIn production, this would send an actual SMS.`);
    return true;
  };

  const saveToHistory = (latitude, longitude, accuracy) => {
    const newRecord = {
      id: Date.now().toString(),
      type: 'location',
      latitude,
      longitude,
      accuracy,
      timestamp: new Date().toISOString(),
      note: '',
    };
    const updatedHistory = [newRecord, ...history];
    saveHistory(updatedHistory);
    return newRecord;
  };

  const captureAndSendLocation = async (isRetry = false) => {
    if (isSendingRef.current) return false;
    isSendingRef.current = true;

    try {
      if (!navigator.geolocation) {
        setErrorMsg('Geolocation not supported');
        isSendingRef.current = false;
        return false;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const acc = position.coords.accuracy;
          const time = Date.now();

          setLocation(position.coords);

          let success = await sendToServer(lat, lng, time);

          if (!success) {
            success = sendLocationViaSMS(lat, lng);
          }

          saveToHistory(lat, lng, acc);

          if (success) {
            saveLastSuccessTime(time);
            setRetryCount(0);
            if (!isRetry) alert('Location sent and saved successfully!');
          } else {
            if (!isRetry) alert('Location saved but sending failed. Will retry...');
          }
          isSendingRef.current = false;
          return success;
        },
        (error) => {
          setErrorMsg('Error getting location: ' + error.message);
          isSendingRef.current = false;
        }
      );
    } catch (error) {
      setErrorMsg('Error: ' + error.message);
      isSendingRef.current = false;
      return false;
    }
  };

  const startNormalTracking = () => {
    if (normalIntervalRef.current) clearInterval(normalIntervalRef.current);
    normalIntervalRef.current = setInterval(() => {
      captureAndSendLocation(false);
    }, 30 * 60 * 1000);
  };

  const startRetryTracking = () => {
    if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
    retryIntervalRef.current = setInterval(async () => {
      const success = await captureAndSendLocation(true);
      if (success) {
        stopRetryTracking();
        startNormalTracking();
        alert('Retry successful! Back to normal 30-min interval.');
      } else {
        setRetryCount(prev => prev + 1);
      }
    }, 3 * 60 * 1000);
  };

  const stopRetryTracking = () => {
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
    setRetryCount(0);
  };

  const stopAllTracking = () => {
    if (normalIntervalRef.current) {
      clearInterval(normalIntervalRef.current);
      normalIntervalRef.current = null;
    }
    stopRetryTracking();
  };

  const startTracking = async () => {
    setIsTracking(true);
    const now = Date.now();
    const needRetry = lastSuccessTime && (now - lastSuccessTime) > 30 * 60 * 1000;
    const success = await captureAndSendLocation(false);

    if (!success && needRetry) {
      startRetryTracking();
      alert('Tracking started. Entering retry mode (every 3 min) due to previous failure.');
    } else {
      startNormalTracking();
      alert('Tracking started. Location will be sent every 30 minutes.');
    }
  };

  const stopTracking = () => {
    stopAllTracking();
    setIsTracking(false);
    alert('Tracking stopped.');
  };

  const getCurrentLocation = () => {
    captureAndSendLocation(false);
  };

  const deleteRecord = (id) => {
    const confirmed = window.confirm('Delete this record?');
    if (confirmed) {
      const updatedHistory = history.filter(item => item.id !== id);
      saveHistory(updatedHistory);
      alert('Record deleted.');
    }
  };

  const startEdit = (record) => {
    setEditingId(record.id);
    setEditNote(record.note || '');
  };

  const saveEdit = (id) => {
    const updatedHistory = history.map(item =>
      item.id === id ? { ...item, note: editNote } : item
    );
    saveHistory(updatedHistory);
    setEditingId(null);
    setEditNote('');
    alert('Note saved!');
  };

  const clearAllHistory = () => {
    const confirmed = window.confirm('Delete ALL history?');
    if (confirmed) {
      saveHistory([]);
      setCapturedImage(null);
      alert('All history cleared.');
    }
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const getTimeSinceLastSuccess = () => {
    if (!lastSuccessTime) return 'Never';
    const diff = Date.now() - lastSuccessTime;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hours ago`;
  };

  return (
    <div className="container py-4">
      <h1 className="text-center">🚗 Travel Safety Monitor</h1>
      <p className="text-center text-muted">Location Tracking & SMS Alert + Camera (PWA)</p>

      {/* Camera Modal */}
      {showCamera && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content bg-dark">
              <div className="modal-body p-0">
                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: 'auto' }} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-danger" onClick={closeCamera}>Close</button>
                <button className="btn btn-primary" onClick={takePhoto}>Take Photo</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Card */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">📊 Status</h5>
          <p>Last successful send: {getTimeSinceLastSuccess()}</p>
          {isTracking && retryCount > 0 && <p className="text-warning">🔄 Retry attempts: {retryCount}</p>}
          <p>{isTracking ? "🔴 Tracking ACTIVE" : "⚫ Tracking INACTIVE"}</p>
          {isTracking && retryCount === 0 && lastSuccessTime && (Date.now() - lastSuccessTime) < 30 * 60 * 1000 && (
            <p className="text-success">✅ Normal mode: every 30 min</p>
          )}
          {isTracking && retryCount > 0 && (
            <p className="text-warning">⚠️ Retry mode: every 3 min</p>
          )}
        </div>
      </div>

      {/* Location Card */}
      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">📍 Current Location</h5>
          {location ? (
            <>
              <p>Lat: {location.latitude?.toFixed(6)}</p>
              <p>Lng: {location.longitude?.toFixed(6)}</p>
              <p>Accuracy: ±{location.accuracy}m</p>
            </>
          ) : (
            <p className="text-muted">No location yet</p>
          )}
          {errorMsg && <p className="text-danger">{errorMsg}</p>}
        </div>
      </div>

      {/* Buttons */}
      <div className="d-grid gap-2 mb-2">
        <button className="btn btn-primary" onClick={getCurrentLocation}>📍 Get & Send Location</button>
        <button className="btn btn-warning" onClick={() => {
          if (location) {
            sendLocationViaSMS(location.latitude, location.longitude);
          } else {
            alert('Please get location first');
          }
        }}>📱 Share via SMS</button>
        <button className="btn btn-info" onClick={openCamera}>📷 Take Photo</button>
        {capturedImage && (
          <>
            <button className="btn btn-success" onClick={savePhotoWithLocation}>💾 Save Photo with Location</button>
            <img src={capturedImage} alt="Preview" style={{ width: 100, height: 100, marginTop: 10 }} />
          </>
        )}
        {!isTracking ? (
          <button className="btn btn-success" onClick={startTracking}>▶ Start Auto-Tracking</button>
        ) : (
          <button className="btn btn-danger" onClick={stopTracking}>⏹ Stop Tracking</button>
        )}
      </div>

      {/* History */}
      <div className="d-flex justify-content-between align-items-center mt-3 mb-2">
        <h5>📋 History ({history.length} records)</h5>
        {history.length > 0 && (
          <button className="btn btn-sm btn-danger" onClick={clearAllHistory}>Clear All</button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-muted">No records yet.</p>
      ) : (
        history.map((item) => (
          <div key={item.id} className="card mb-2">
            <div className="card-body">
              <small className="text-muted">{item.type === 'photo' ? '📷' : '📍'} {formatTime(item.timestamp)}</small>
              <p className="mb-1">{item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}</p>
              <small>Accuracy: ±{item.accuracy}m</small>
              {/* 新增的 View on Map 按钮 */}
              <button 
                className="btn btn-sm btn-outline-info mt-1 me-1"
                onClick={() => window.open(`https://maps.google.com/?q=${item.latitude},${item.longitude}`, '_blank')}
              >
                🗺 View on Map
              </button>
              {item.type === 'photo' && item.photoUri && (
                <img src={item.photoUri} alt="Thumb" style={{ width: 80, height: 80, marginTop: 10 }} />
              )}
              {editingId === item.id ? (
                <div className="mt-2">
                  <textarea className="form-control" value={editNote} onChange={(e) => setEditNote(e.target.value)} rows="2" />
                  <button className="btn btn-sm btn-success mt-1 me-1" onClick={() => saveEdit(item.id)}>Save</button>
                  <button className="btn btn-sm btn-secondary mt-1" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              ) : (
                <>
                  <p className="mt-2 mb-1">📝 Note: {item.note || '(No note)'}</p>
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => startEdit(item)}>✏️ Edit Note</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteRecord(item.id)}>🗑 Delete</button>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default App;