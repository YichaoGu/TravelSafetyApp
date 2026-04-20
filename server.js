const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001; 

app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'locations.json');

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

const readLocations = () => {
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(data);
};

const saveLocations = (locations) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(locations, null, 2));
};

// 接收位置数据
app.post('/api/location', (req, res) => {
  const { latitude, longitude, timestamp, deviceId, note } = req.body;
  
  if (!latitude || !longitude) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: latitude, longitude' 
    });
  }
  
  const newRecord = {
    id: Date.now().toString(),
    latitude,
    longitude,
    timestamp: timestamp || new Date().toISOString(),
    deviceId: deviceId || 'TravelSafetyApp',
    note: note || '',
    receivedAt: new Date().toISOString()
  };
  
  const locations = readLocations();
  locations.push(newRecord);
  saveLocations(locations);
  
  console.log(`📍 Location received: ${latitude}, ${longitude}`);
  res.json({ 
    success: true, 
    message: 'Location saved successfully',
    data: newRecord
  });
});

// 获取所有位置
app.get('/api/locations', (req, res) => {
  const locations = readLocations();
  res.json({
    success: true,
    count: locations.length,
    data: locations
  });
});

// 获取单条记录
app.get('/api/location/:id', (req, res) => {
  const locations = readLocations();
  const record = locations.find(l => l.id === req.params.id);
  
  if (!record) {
    return res.status(404).json({ success: false, error: 'Record not found' });
  }
  
  res.json({ success: true, data: record });
});

// 删除单条记录
app.delete('/api/location/:id', (req, res) => {
  let locations = readLocations();
  const newLocations = locations.filter(l => l.id !== req.params.id);
  
  if (locations.length === newLocations.length) {
    return res.status(404).json({ success: false, error: 'Record not found' });
  }
  
  saveLocations(newLocations);
  res.json({ success: true, message: 'Record deleted' });
});

// 清空所有记录
app.delete('/api/locations', (req, res) => {
  saveLocations([]);
  res.json({ success: true, message: 'All records cleared' });
});

// 网页界面
app.get('/', (req, res) => {
  const locations = readLocations();
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Travel Safety Monitor - Server</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .count { font-size: 18px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; background: white; }
        th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
        th { background: #4CAF50; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        .map-link { color: #2196F3; text-decoration: none; }
      </style>
    </head>
    <body>
      <h1>🚗 Travel Safety Monitor - Server</h1>
      <p class="count">Total locations received: <strong>${locations.length}</strong></p>
      ${locations.length === 0 ? '<p>No locations received yet.</p>' : `
        <table>
          <tr>
            <th>ID</th>
            <th>Latitude</th>
            <th>Longitude</th>
            <th>Timestamp</th>
            <th>Map</th>
          </tr>
          ${locations.map(loc => `
            <tr>
              <td>${loc.id.substring(0, 8)}...</td>
              <td>${loc.latitude}</td>
              <td>${loc.longitude}</td>
              <td>${new Date(loc.timestamp).toLocaleString()}</td>
              <td><a href="https://maps.google.com/?q=${loc.latitude},${loc.longitude}" target="_blank" class="map-link">View Map</a></td>
            </tr>
          `).join('')}
        </table>
      `}
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`
  🚀 Server is running!
  📍 API: http://localhost:${PORT}/api/locations
  🌐 Web: http://localhost:${PORT}
  `);
});