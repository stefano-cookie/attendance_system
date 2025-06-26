const axios = require('axios');
const { Classroom } = require('../models');

class EnhancedCameraService {
  constructor() {
    this.cameraCache = new Map();
    this.connectionTimeout = 10000;
  }

  /**
   * Metodo principale: Scatta foto da camera
   */
  async captureImage(classroomId) {
    try {
      console.log(`📸 Richiesta scatto per aula ${classroomId}`);
      
      // 1. Trova configurazione camera
      const cameraConfig = await this.getCameraConfig(classroomId);
      
      // 2. Test connessione camera
      const isOnline = await this.testCameraConnection(cameraConfig.ip);
      if (!isOnline) {
        throw new Error(`Camera ${cameraConfig.ip} non raggiungibile`);
      }
      
      // 3. Tenta scatto con metodi multipli
      let imageBuffer = null;
      let method = 'unknown';
      
      // Metodo 1: ONVIF (se supportato)
      if (cameraConfig.supportsONVIF) {
        try {
          const result = await this.captureViaONVIF(cameraConfig);
          imageBuffer = result.imageBuffer;
          method = 'onvif';
          console.log(`✅ Scatto ONVIF riuscito`);
        } catch (onvifError) {
          console.warn(`⚠️ ONVIF fallito: ${onvifError.message}`);
        }
      }
      
      // Metodo 2: HTTP fallback
      if (!imageBuffer) {
        const result = await this.captureViaHTTP(cameraConfig);
        imageBuffer = result.imageBuffer;
        method = result.endpoint;
        console.log(`✅ Scatto HTTP riuscito con ${method}`);
      }
      
      // 4. Valida immagine
      if (!this.isValidJPEG(imageBuffer)) {
        throw new Error('Immagine ricevuta non è JPEG valida');
      }
      
      // 5. Aggiorna cache e statistiche
      await this.updateCameraStats(classroomId, true, method);
      
      return {
        success: true,
        imageData: imageBuffer,
        metadata: {
          cameraIP: cameraConfig.ip,
          method: method,
          timestamp: new Date(),
          fileSize: imageBuffer.length,
          resolution: await this.detectImageResolution(imageBuffer)
        }
      };
      
    } catch (error) {
      console.error(`❌ Errore scatto camera:`, error);
      
      // Aggiorna statistiche errore
      await this.updateCameraStats(classroomId, false, 'error');
      
      return {
        success: false,
        error: error.message,
        metadata: {
          timestamp: new Date(),
          attempted_methods: ['onvif', 'http_fallback']
        }
      };
    }
  }

  /**
   * Ottieni configurazione camera per aula
   */
  async getCameraConfig(classroomId) {
    // Prima controlla cache
    if (this.cameraCache.has(classroomId)) {
      const cached = this.cameraCache.get(classroomId);
      const age = Date.now() - cached.timestamp;
      
      // Cache valida per 5 minuti
      if (age < 5 * 60 * 1000) {
        return cached.config;
      }
    }
    
    // Carica dal database
    const classroom = await Classroom.findByPk(classroomId);
    if (!classroom || !classroom.camera_ip) {
      throw new Error(`Nessuna camera configurata per aula ${classroomId}`);
    }
    
    const config = {
      ip: classroom.camera_ip,
      username: classroom.camera_username || 'admin',
      password: classroom.camera_password || 'admin123',
      model: classroom.camera_model || 'Unknown',
      supportsONVIF: true, // Default, sarà testato
      preferredEndpoint: null
    };
    
    // Salva in cache
    this.cameraCache.set(classroomId, {
      config,
      timestamp: Date.now()
    });
    
    return config;
  }

  /**
   * Test connessione base camera
   */
  async testCameraConnection(ip) {
    try {
      const response = await axios({
        method: 'GET',
        url: `http://${ip}/`,
        timeout: 3000,
        validateStatus: () => true // Accetta qualsiasi status
      });
      
      return response.status < 500;
    } catch (error) {
      return false;
    }
  }

  /**
   * Scatto via protocollo ONVIF
   */
  async captureViaONVIF(cameraConfig) {
    try {
      // Per semplicità, simula ONVIF con chiamata diretta
      // In produzione useresti libreria node-onvif
      
      const response = await axios({
        method: 'GET',
        url: `http://${cameraConfig.ip}/onvif/snapshot`,
        auth: {
          username: cameraConfig.username,
          password: cameraConfig.password
        },
        responseType: 'arraybuffer',
        timeout: this.connectionTimeout,
        headers: {
          'User-Agent': 'AttendanceSystem/1.0 ONVIF-Client'
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`ONVIF HTTP ${response.status}`);
      }
      
      return {
        imageBuffer: Buffer.from(response.data),
        method: 'onvif'
      };
      
    } catch (error) {
      throw new Error(`ONVIF capture failed: ${error.message}`);
    }
  }

  /**
   * Scatto via HTTP endpoints tradizionali
   */
  async captureViaHTTP(cameraConfig) {
    const endpoints = [
      { path: '/tmpfs/snap.jpg', name: 'imou_dahua' },
      { path: '/cgi-bin/snapshot.cgi', name: 'generic' },
      { path: '/axis-cgi/jpg/image.cgi', name: 'axis' },
      { path: '/videostream.cgi?command=snapshot', name: 'tplink' },
      { path: '/snapshot.jpg', name: 'basic' }
    ];
    
    // Se c'è un endpoint preferito, provalo per primo
    if (cameraConfig.preferredEndpoint) {
      endpoints.unshift({
        path: cameraConfig.preferredEndpoint,
        name: 'preferred'
      });
    }
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Tentativo ${endpoint.name}: ${endpoint.path}`);
        
        const response = await axios({
          method: 'GET',
          url: `http://${cameraConfig.ip}${endpoint.path}`,
          auth: {
            username: cameraConfig.username,
            password: cameraConfig.password
          },
          responseType: 'arraybuffer',
          timeout: this.connectionTimeout,
          headers: {
            'User-Agent': 'AttendanceSystem/1.0 HTTP-Client'
          }
        });
        
        if (response.status === 200 && response.data.length > 1000) {
          // Salva endpoint funzionante per prossime volte
          cameraConfig.preferredEndpoint = endpoint.path;
          
          return {
            imageBuffer: Buffer.from(response.data),
            endpoint: endpoint.name
          };
        }
        
      } catch (error) {
        console.warn(`❌ ${endpoint.name} fallito: ${error.message}`);
        continue;
      }
    }
    
    throw new Error('Nessun endpoint HTTP funzionante');
  }

  /**
   * Valida che l'immagine sia JPEG valida
   */
  isValidJPEG(buffer) {
    if (!buffer || buffer.length < 10) return false;
    
    // Controlla magic bytes JPEG
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }

  /**
   * Rileva risoluzione immagine (semplificato)
   */
  async detectImageResolution(buffer) {
    try {
      // In produzione useresti libreria come sharp o jimp
      // Per ora ritorna risoluzione stimata basata su dimensione file
      const sizeKB = buffer.length / 1024;
      
      if (sizeKB > 2000) return '1920x1080'; // HD
      if (sizeKB > 1000) return '1280x720';  // HD Ready
      if (sizeKB > 500) return '640x480';    // VGA
      return 'Unknown';
      
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Aggiorna statistiche camera
   */
  async updateCameraStats(classroomId, success, method) {
    try {
      const updateData = {
        camera_last_check: new Date(),
        camera_status: success ? 'online' : 'error'
      };
      
      if (success) {
        updateData.camera_last_success = new Date();
        updateData.camera_preferred_method = method;
      }
      
      await Classroom.update(updateData, {
        where: { id: classroomId }
      });
      
    } catch (error) {
      console.error('Errore aggiornamento stats camera:', error);
    }
  }

  /**
   * Discovery automatico camere sulla rete
   */
  async discoverCameras(networkRange = '192.168.1') {
    console.log(`🔍 Discovery camere sulla rete ${networkRange}.x`);
    
    const cameras = [];
    const promises = [];
    
    // Scansiona range IP
    for (let i = 1; i <= 254; i++) {
      const ip = `${networkRange}.${i}`;
      
      promises.push(
        this.testCameraAtIP(ip).then(result => {
          if (result.isCamera) {
            cameras.push(result);
            console.log(`📷 Camera trovata: ${ip} (${result.model})`);
          }
        }).catch(() => {
          // Ignora errori (IP non raggiungibili)
        })
      );
    }
    
    // Attendi tutti i test (con timeout)
    await Promise.allSettled(promises);
    
    console.log(`✅ Discovery completato: ${cameras.length} camere trovate`);
    return cameras;
  }

  /**
   * Testa se IP specifico è una camera
   */
  async testCameraAtIP(ip) {
    try {
      // Test 1: Risposta HTTP base
      const response = await axios({
        method: 'GET',
        url: `http://${ip}/`,
        timeout: 2000,
        validateStatus: () => true
      });
      
      if (response.status >= 500) {
        return { isCamera: false };
      }
      
      // Test 2: Tenta endpoint snapshot
      const testEndpoints = ['/tmpfs/snap.jpg', '/cgi-bin/snapshot.cgi'];
      
      for (const endpoint of testEndpoints) {
        try {
          const snapResponse = await axios({
            method: 'GET',
            url: `http://${ip}${endpoint}`,
            auth: { username: 'admin', password: 'admin123' },
            timeout: 3000,
            responseType: 'arraybuffer'
          });
          
          if (snapResponse.status === 200) {
            const buffer = Buffer.from(snapResponse.data);
            if (this.isValidJPEG(buffer)) {
              return {
                isCamera: true,
                ip,
                model: this.detectCameraModel(response.headers),
                workingEndpoint: endpoint,
                imageSize: buffer.length
              };
            }
          }
        } catch (endpointError) {
          // Continua con prossimo endpoint
        }
      }
      
      return { isCamera: false };
      
    } catch (error) {
      return { isCamera: false };
    }
  }

  /**
   * Rileva modello camera da headers HTTP
   */
  detectCameraModel(headers) {
    const server = (headers.server || '').toLowerCase();
    const userAgent = (headers['user-agent'] || '').toLowerCase();
    
    if (server.includes('hikvision')) return 'Hikvision Camera';
    if (server.includes('dahua') || server.includes('imou')) return 'Dahua/IMOU Camera';
    if (server.includes('axis')) return 'Axis Camera';
    if (server.includes('simulator')) return 'Test Simulator';
    
    return 'Generic IP Camera';
  }

  /**
   * Test completo sistema camere
   */
  async testAllConfiguredCameras() {
    console.log('🧪 Test di tutte le camere configurate...');
    
    const classrooms = await Classroom.findAll({
      where: {
        camera_ip: { [require('sequelize').Op.ne]: null }
      }
    });
    
    const results = [];
    
    for (const classroom of classrooms) {
      try {
        const startTime = Date.now();
        
        const result = await this.captureImage(classroom.id);
        const duration = Date.now() - startTime;
        
        results.push({
          classroomId: classroom.id,
          classroomName: classroom.name,
          cameraIP: classroom.camera_ip,
          success: result.success,
          method: result.metadata?.method || 'unknown',
          duration: `${duration}ms`,
          imageSize: result.metadata?.fileSize || 0,
          error: result.error || null
        });
        
      } catch (error) {
        results.push({
          classroomId: classroom.id,
          classroomName: classroom.name,
          cameraIP: classroom.camera_ip,
          success: false,
          error: error.message
        });
      }
    }
    
    // Stampa risultati
    console.log('\n📊 RISULTATI TEST CAMERE:');
    console.log('='.repeat(60));
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.classroomName} (${result.cameraIP})`);
      
      if (result.success) {
        console.log(`   Metodo: ${result.method}, Durata: ${result.duration}`);
        console.log(`   Dimensione: ${(result.imageSize / 1024).toFixed(1)}KB`);
      } else {
        console.log(`   Errore: ${result.error}`);
      }
    });
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\n📈 Risultato: ${successCount}/${results.length} camere operative`);
    
    return results;
  }
}

module.exports = new EnhancedCameraService();