// backend/simulators/camera_ip_simulator.js
// Simulatore completo di camera IP per sviluppo

const express = require('express');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // npm install sharp

class CameraIPSimulator {
  constructor(port = 8081, cameraIP = '127.0.0.1') {
    this.app = express();
    this.port = port;
    this.cameraIP = cameraIP;
    this.setupMiddleware();
    this.setupRoutes();
    this.createTestImages();
  }

  setupMiddleware() {
    // Simula autenticazione Basic
    this.app.use((req, res, next) => {
      const auth = req.headers.authorization;
      
      if (!auth) {
        res.setHeader('WWW-Authenticate', 'Basic realm="IP Camera"');
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
      const username = credentials[0];
      const password = credentials[1];
      
      // Simula credenziali camera (admin/admin123)
      if (username === 'admin' && password === 'admin123') {
        req.cameraUser = username;
        next();
      } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="IP Camera"');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    });
    
    // CORS per sviluppo
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      next();
    });
  }

  setupRoutes() {
    // Endpoint 1: Snapshot IMOU/Dahua style
    this.app.get('/tmpfs/snap.jpg', (req, res) => {
      console.log('📸 Richiesta snapshot ricevuta (IMOU style)');
      this.sendSimulatedSnapshot(res, 'imou');
    });

    // Endpoint 2: Generic snapshot
    this.app.get('/cgi-bin/snapshot.cgi', (req, res) => {
      console.log('📸 Richiesta snapshot ricevuta (Generic style)');
      this.sendSimulatedSnapshot(res, 'generic');
    });

    // Endpoint 3: Axis style
    this.app.get('/axis-cgi/jpg/image.cgi', (req, res) => {
      console.log('📸 Richiesta snapshot ricevuta (Axis style)');
      this.sendSimulatedSnapshot(res, 'axis');
    });

    // Endpoint 4: ONVIF Device Service
    this.app.all('/onvif/device_service', (req, res) => {
      console.log('🔧 Richiesta ONVIF Device Service');
      this.handleONVIFRequest(req, res);
    });

    // Endpoint 5: ONVIF Media Service  
    this.app.all('/onvif/media_service', (req, res) => {
      console.log('📺 Richiesta ONVIF Media Service');
      this.handleONVIFMediaRequest(req, res);
    });

    // Endpoint 6: ONVIF Snapshot diretto
    this.app.get('/onvif/snapshot', (req, res) => {
      console.log('📸 Richiesta ONVIF Snapshot');
      this.sendSimulatedSnapshot(res, 'onvif');
    });

    // Endpoint 7: Info camera (per discovery)
    this.app.get('/', (req, res) => {
      res.json({
        model: 'SIMULATOR IPC-SIM 3MP',
        manufacturer: 'DevTesting',
        firmware: '1.0.0',
        status: 'online',
        capabilities: ['snapshot', 'onvif', 'rtsp'],
        endpoints: {
          snapshot_imou: '/tmpfs/snap.jpg',
          snapshot_generic: '/cgi-bin/snapshot.cgi',
          snapshot_axis: '/axis-cgi/jpg/image.cgi',
          onvif_device: '/onvif/device_service',
          onvif_media: '/onvif/media_service'
        }
      });
    });

    // Endpoint 8: Status camera
    this.app.get('/status', (req, res) => {
      res.json({
        online: true,
        uptime: process.uptime(),
        last_snapshot: new Date().toISOString(),
        resolution: '1920x1080',
        fps: 25
      });
    });
  }

  async sendSimulatedSnapshot(res, source = 'generic') {
    try {
      // Genera immagine dinamica con informazioni
      const timestamp = new Date().toLocaleString('it-IT');
      const imageBuffer = await this.generateTestImage(source, timestamp);
      
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', imageBuffer.length);
      res.setHeader('Camera-Source', source);
      res.setHeader('Capture-Time', new Date().toISOString());
      
      res.send(imageBuffer);
      
      console.log(`✅ Snapshot inviato: ${imageBuffer.length} bytes (${source})`);
      
    } catch (error) {
      console.error('❌ Errore generazione snapshot:', error);
      res.status(500).json({ error: 'Snapshot generation failed' });
    }
  }

  async generateTestImage(source, timestamp) {
    try {
      // Crea immagine con Sharp (simula foto aula)
      const width = 1920;
      const height = 1080;
      
      // Background
      const background = Buffer.from([
        ...Array(width * height * 3).fill(0).map((_, i) => {
          const pixel = i % 3;
          if (pixel === 0) return 220; // R
          if (pixel === 1) return 230; // G  
          return 240; // B
        })
      ]);

      // Genera immagine con testo
      const image = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 240, g: 248, b: 255 }
        }
      })
      .composite([
        {
          input: Buffer.from(`
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
              <!-- Background -->
              <rect width="100%" height="100%" fill="#f0f8ff"/>
              
              <!-- Header -->
              <rect x="0" y="0" width="100%" height="100" fill="#4a90e2"/>
              <text x="50%" y="60" text-anchor="middle" font-family="Arial" font-size="36" fill="white" font-weight="bold">
                📷 CAMERA IP SIMULATOR
              </text>
              
              <!-- Info Box -->
              <rect x="50" y="150" width="500" height="300" fill="white" stroke="#ccc" stroke-width="2" rx="10"/>
              <text x="70" y="190" font-family="Arial" font-size="24" fill="#333">🕐 ${timestamp}</text>
              <text x="70" y="230" font-family="Arial" font-size="20" fill="#666">📡 Source: ${source}</text>
              <text x="70" y="270" font-family="Arial" font-size="20" fill="#666">📏 Resolution: 1920x1080</text>
              <text x="70" y="310" font-family="Arial" font-size="20" fill="#666">🎯 IP: ${this.cameraIP}:${this.port}</text>
              <text x="70" y="350" font-family="Arial" font-size="20" fill="#666">🔐 Auth: admin/admin123</text>
              <text x="70" y="390" font-family="Arial" font-size="18" fill="#999">✅ Ready for face detection</text>
              
              <!-- Simulated Students -->
              <circle cx="700" cy="300" r="40" fill="#ffcc00" stroke="#ff9900" stroke-width="3"/>
              <text x="700" y="310" text-anchor="middle" font-family="Arial" font-size="16" fill="#333">👤</text>
              
              <circle cx="850" cy="280" r="40" fill="#ffcc00" stroke="#ff9900" stroke-width="3"/>
              <text x="850" y="290" text-anchor="middle" font-family="Arial" font-size="16" fill="#333">👤</text>
              
              <circle cx="1000" cy="320" r="40" fill="#ffcc00" stroke="#ff9900" stroke-width="3"/>
              <text x="1000" y="330" text-anchor="middle" font-family="Arial" font-size="16" fill="#333">👤</text>
              
              <circle cx="1150" cy="290" r="40" fill="#ffcc00" stroke="#ff9900" stroke-width="3"/>
              <text x="1150" y="300" text-anchor="middle" font-family="Arial" font-size="16" fill="#333">👤</text>
              
              <!-- Footer -->
              <text x="50%" y="1040" text-anchor="middle" font-family="Arial" font-size="18" fill="#999">
                Simulated classroom with 4 students for attendance detection testing
              </text>
            </svg>
          `),
          top: 0,
          left: 0
        }
      ])
      .jpeg({ quality: 85 })
      .toBuffer();

      return image;
      
    } catch (error) {
      console.error('Errore generazione immagine:', error);
      
      // Fallback: immagine semplice
      return await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 200, g: 200, b: 200 }
        }
      })
      .jpeg()
      .toBuffer();
    }
  }

  handleONVIFRequest(req, res) {
    // Simula risposta ONVIF SOAP
    const soapResponse = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Body>
    <tds:GetDeviceInformationResponse xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <tds:Manufacturer>DevTesting</tds:Manufacturer>
      <tds:Model>SIMULATOR IPC-SIM 3MP</tds:Model>
      <tds:FirmwareVersion>1.0.0</tds:FirmwareVersion>
      <tds:SerialNumber>SIM001</tds:SerialNumber>
      <tds:HardwareId>SIMULATOR_HW</tds:HardwareId>
    </tds:GetDeviceInformationResponse>
  </s:Body>
</s:Envelope>`;

    res.setHeader('Content-Type', 'application/soap+xml');
    res.send(soapResponse);
  }

  handleONVIFMediaRequest(req, res) {
    // Simula risposta ONVIF Media Service
    const mediaResponse = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Body>
    <trt:GetSnapshotUriResponse xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
      <trt:MediaUri>
        <tt:Uri>http://${this.cameraIP}:${this.port}/onvif/snapshot</tt:Uri>
        <tt:InvalidAfterConnect>false</tt:InvalidAfterConnect>
        <tt:InvalidAfterReboot>false</tt:InvalidAfterReboot>
        <tt:Timeout>PT60S</tt:Timeout>
      </trt:MediaUri>
    </trt:GetSnapshotUriResponse>
  </s:Body>
</s:Envelope>`;

    res.setHeader('Content-Type', 'application/soap+xml');
    res.send(mediaResponse);
  }

  createTestImages() {
    // Crea directory per immagini di test se non esiste
    const testDir = path.join(__dirname, '../test_images');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  }

  start() {
    this.app.listen(this.port, () => {
      console.log('\n🎭 CAMERA IP SIMULATOR AVVIATO');
      console.log('='.repeat(40));
      console.log(`📡 IP: ${this.cameraIP}:${this.port}`);
      console.log(`🔐 Credenziali: admin/admin123`);
      console.log(`🌐 Status: http://${this.cameraIP}:${this.port}/`);
      console.log('\n📸 Endpoint Snapshot:');
      console.log(`  • IMOU: http://${this.cameraIP}:${this.port}/tmpfs/snap.jpg`);
      console.log(`  • Generic: http://${this.cameraIP}:${this.port}/cgi-bin/snapshot.cgi`);
      console.log(`  • Axis: http://${this.cameraIP}:${this.port}/axis-cgi/jpg/image.cgi`);
      console.log(`  • ONVIF: http://${this.cameraIP}:${this.port}/onvif/snapshot`);
      console.log('\n🔧 ONVIF Services:');
      console.log(`  • Device: http://${this.cameraIP}:${this.port}/onvif/device_service`);
      console.log(`  • Media: http://${this.cameraIP}:${this.port}/onvif/media_service`);
      console.log('\n🧪 Test rapido:');
      console.log(`curl --user admin:admin123 http://${this.cameraIP}:${this.port}/tmpfs/snap.jpg --output test.jpg`);
      console.log('='.repeat(40));
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Spegnimento Camera Simulator...');
      process.exit(0);
    });
  }

  // Metodo per cambiare "stato" della camera (per test diversi)
  setSimulationMode(mode) {
    this.simulationMode = mode;
    console.log(`🎯 Modalità simulazione: ${mode}`);
  }
}

// Avvia simulator se chiamato direttamente
if (require.main === module) {
  const port = process.argv[2] || 8081;
  const ip = process.argv[3] || '127.0.0.1';
  
  const simulator = new CameraIPSimulator(port, ip);
  simulator.start();
}

module.exports = CameraIPSimulator;