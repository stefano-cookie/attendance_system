// backend/src/services/enhancedCameraService.js - VERSIONE COMPLETA CORRETTA
const axios = require('axios');
const { Classroom } = require('../models');

class EnhancedCameraService {
  constructor() {
    this.cameraCache = new Map(); // Cache info camere
    this.connectionTimeout = 15000; // 15 secondi per IMOU
    this.excludedIPs = ['192.168.1.4', '192.168.1.1']; // MacBook e Router
  }

  /**
   * Metodo principale: Scatta foto da camera - VERSIONE CORRETTA
   */
  async captureImage(classroomId) {
    try {
      console.log(`📸 Richiesta scatto per aula ${classroomId}`);
      
      // 1. Trova configurazione camera
      const cameraConfig = await this.getCameraConfig(classroomId);
      console.log(`🔧 Config camera: IP=${cameraConfig.ip}, Model=${cameraConfig.model}`);
      
      // 2. Verifica IP non sia escluso
      if (this.excludedIPs.includes(cameraConfig.ip)) {
        throw new Error(`IP ${cameraConfig.ip} è nella lista esclusi (probabilmente server locale)`);
      }
      
      // 3. Test connessione camera (solo se non RTSP-only)
      let bypassHTTPTest = false;
      try {
        if (cameraConfig.capabilities && cameraConfig.capabilities.bypassHTTPTest) {
          bypassHTTPTest = true;
          console.log(`📺 Camera configurata per RTSP-only - saltando test HTTP`);
        }
      } catch (error) {
        // Ignora errori parsing capabilities
      }
      
      if (!bypassHTTPTest) {
        const isOnline = await this.testCameraConnection(cameraConfig.ip);
        if (!isOnline) {
          throw new Error(`Camera ${cameraConfig.ip} non raggiungibile`);
        }
        console.log(`✅ Camera ${cameraConfig.ip} raggiungibile`);
      }
      
      // 4. Tenta scatto con metodi multipli
      let imageBuffer = null;
      let method = 'unknown';
      let lastError = null;
      
      // Metodo 1: RTSP se disponibile (priorità per RTSP cameras)
      if (cameraConfig.capabilities?.rtsp || bypassHTTPTest) {
        try {
          console.log(`📺 Tentativo scatto RTSP...`);
          const result = await this.captureViaRTSP(cameraConfig);
          imageBuffer = result.imageBuffer;
          method = result.method;
          console.log(`✅ Scatto RTSP riuscito`);
        } catch (rtspError) {
          lastError = rtspError;
          console.warn(`⚠️ RTSP fallito: ${rtspError.message}`);
          
          // Se è RTSP-only e fallisce, non tentare altro
          if (bypassHTTPTest) {
            throw new Error(`RTSP fallito per camera RTSP-only: ${rtspError.message}`);
          }
        }
      }
      
      // Metodo 2: ONVIF (se supportato e RTSP non riuscito)
      if (!imageBuffer && cameraConfig.supportsONVIF && !bypassHTTPTest) {
        try {
          console.log(`🔌 Tentativo scatto ONVIF...`);
          const result = await this.captureViaONVIF(cameraConfig);
          imageBuffer = result.imageBuffer;
          method = 'onvif';
          console.log(`✅ Scatto ONVIF riuscito`);
        } catch (onvifError) {
          lastError = onvifError;
          console.warn(`⚠️ ONVIF fallito: ${onvifError.message}`);
        }
      }
      
      // Metodo 3: HTTP (metodo principale per IMOU)
      if (!imageBuffer && !bypassHTTPTest) {
        try {
          console.log(`🌐 Tentativo scatto HTTP...`);
          const result = await this.captureViaHTTP(cameraConfig);
          imageBuffer = result.imageBuffer;
          method = result.endpoint;
          console.log(`✅ Scatto HTTP riuscito con ${method}`);
        } catch (httpError) {
          lastError = httpError;
          console.warn(`⚠️ HTTP fallito: ${httpError.message}`);
        }
      }
      
      // 5. Valida immagine
      if (!imageBuffer || !this.isValidJPEG(imageBuffer)) {
        const errorMsg = lastError ? 
          `Nessun metodo ha prodotto immagine valida. Ultimo errore: ${lastError.message}` :
          'Nessun metodo ha prodotto immagine JPEG valida';
        throw new Error(errorMsg);
      }
      
      console.log(`✅ Immagine valida ottenuta: ${(imageBuffer.length/1024).toFixed(1)}KB via ${method}`);
      
      // 6. Aggiorna cache e statistiche
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
      console.error(`❌ Errore scatto camera aula ${classroomId}:`, error);
      
      // Aggiorna statistiche errore
      await this.updateCameraStats(classroomId, false, 'error');
      
      return {
        success: false,
        error: error.message,
        metadata: {
          timestamp: new Date(),
          attempted_methods: ['rtsp', 'onvif', 'http'],
          classroomId: classroomId
        }
      };
    }
  }

  /**
   * Ottieni configurazione camera per aula - VERSIONE AGGIORNATA
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
    
    // Parse capabilities se presenti
    let capabilities = {};
    try {
      if (classroom.camera_capabilities) {
        capabilities = typeof classroom.camera_capabilities === 'string' ? 
          JSON.parse(classroom.camera_capabilities) : 
          classroom.camera_capabilities;
      }
    } catch (error) {
      console.warn('Errore parsing camera_capabilities:', error);
    }
    
    const config = {
      ip: classroom.camera_ip,
      port: classroom.camera_port || 80,
      username: classroom.camera_username || 'admin',
      password: classroom.camera_password || 'Mannoli2025',
      model: classroom.camera_model || 'Unknown',
      manufacturer: classroom.camera_manufacturer || 'Unknown',
      supportsONVIF: capabilities.onvif || false,
      preferredEndpoint: classroom.camera_preferred_method || null,
      capabilities: capabilities
    };
    
    // Salva in cache
    this.cameraCache.set(classroomId, {
      config,
      timestamp: Date.now()
    });
    
    return config;
  }

  /**
   * Test connessione base camera - VERSIONE CORRETTA
   */
  async testCameraConnection(ip) {
    // ESCLUDI il MacBook dell'utente e altri IP noti
    if (this.excludedIPs.includes(ip)) {
      console.log(`⏭️ Saltando ${ip} (IP escluso)`);
      return false;
    }
    
    console.log(`🔍 Test connessione camera: ${ip}`);
    
    const testPaths = [
      '/',
      '/tmpfs/snap.jpg',
      '/cgi-bin/snapshot.cgi',
      '/snapshot.jpg',
      '/index.html'
    ];
    
    for (const testPath of testPaths) {
      try {
        console.log(`📡 Test ${ip}${testPath}...`);
        
        const response = await axios({
          method: 'GET',
          url: `http://${ip}${testPath}`,
          timeout: 3000,
          validateStatus: () => true,
          headers: {
            'User-Agent': 'AttendanceSystem/1.0 Connection-Test'
          }
        });
        
        console.log(`📋 ${testPath}: HTTP ${response.status}`);
        
        // Camera raggiungibile se risponde con status < 500
        if (response.status < 500) {
          console.log(`✅ Camera ${ip} raggiungibile (via ${testPath})`);
          return true;
        }
        
      } catch (error) {
        console.log(`❌ ${testPath}: ${error.message}`);
        continue;
      }
    }
    
    console.log(`❌ Camera ${ip} NON raggiungibile`);
    return false;
  }

  /**
   * Scatto via HTTP endpoints - VERSIONE MIGLIORATA PER IMOU
   */
  async captureViaHTTP(cameraConfig) {
    console.log(`📸 Tentativo scatto HTTP da camera: ${cameraConfig.ip}`);
    
    // Endpoint specifici per IMOU e altri in ordine di priorità
    const endpoints = [
      // IMOU endpoints primari
      { path: '/tmpfs/snap.jpg', name: 'imou_main', timeout: 20000 },
      { path: '/tmpfs/snapshot.jpg', name: 'imou_alt', timeout: 15000 },
      
      // Generic camera endpoints
      { path: '/cgi-bin/snapshot.cgi', name: 'generic_cgi', timeout: 15000 },
      { path: '/snapshot.jpg', name: 'generic_snap', timeout: 10000 },
      { path: '/cgi-bin/currentpic.cgi', name: 'dahua', timeout: 15000 },
      { path: '/image/jpeg.cgi', name: 'foscam', timeout: 10000 },
      
      // Senza autenticazione (a volte IMOU funziona così)
      { path: '/tmpfs/snap.jpg', name: 'imou_no_auth', timeout: 15000, noAuth: true },
      { path: '/snapshot.jpg', name: 'generic_no_auth', timeout: 10000, noAuth: true }
    ];
    
    // Se c'è un endpoint preferito, provalo per primo
    if (cameraConfig.preferredEndpoint) {
      endpoints.unshift({
        path: cameraConfig.preferredEndpoint,
        name: 'preferred',
        timeout: 10000
      });
    }
    
    console.log(`🎯 Test ${endpoints.length} endpoint per camera ${cameraConfig.ip}`);
    
    const testResults = [];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Tentativo ${endpoint.name}: ${endpoint.path}`);
        
        const requestConfig = {
          method: 'GET',
          url: `http://${cameraConfig.ip}${endpoint.path}`,
          responseType: 'arraybuffer',
          timeout: endpoint.timeout,
          headers: {
            'User-Agent': 'AttendanceSystem/1.0 IMOU-Client',
            'Accept': 'image/jpeg,image/*,*/*',
            'Connection': 'close',
            'Cache-Control': 'no-cache'
          },
          maxRedirects: 2
        };
        
        // Aggiungi autenticazione se non esclusa
        if (!endpoint.noAuth) {
          requestConfig.auth = {
            username: cameraConfig.username,
            password: cameraConfig.password
          };
        }
        
        const startTime = Date.now();
        const response = await axios(requestConfig);
        const duration = Date.now() - startTime;
        
        console.log(`📊 ${endpoint.name}: HTTP ${response.status}, Size: ${response.data.length} bytes, Time: ${duration}ms`);
        
        const result = {
          endpoint: endpoint.name,
          path: endpoint.path,
          status: response.status,
          size: response.data.length,
          duration: `${duration}ms`,
          success: false,
          error: null
        };
        
        testResults.push(result);
        
        // Valida risposta
        if (response.status === 200 && response.data.length > 1000) {
          const buffer = Buffer.from(response.data);
          
          if (this.isValidJPEG(buffer)) {
            console.log(`✅ ${endpoint.name} SUCCESS! JPEG valido ricevuto - ${(buffer.length/1024).toFixed(1)}KB`);
            
            result.success = true;
            
            // Salva endpoint funzionante per prossime volte
            cameraConfig.preferredEndpoint = endpoint.path;
            
            return {
              imageBuffer: buffer,
              endpoint: endpoint.name,
              testResults: testResults
            };
          } else {
            console.warn(`⚠️ ${endpoint.name}: Dati ricevuti ma non è JPEG valido`);
            result.error = 'Invalid JPEG format';
          }
        } else if (response.status === 401) {
          console.warn(`🔐 ${endpoint.name}: Autenticazione richiesta`);
          result.error = 'Authentication required';
        } else if (response.status === 404) {
          console.warn(`📭 ${endpoint.name}: Endpoint non trovato`);
          result.error = 'Endpoint not found';
        } else {
          console.warn(`⚠️ ${endpoint.name}: HTTP ${response.status}, Size troppo piccolo: ${response.data.length}`);
          result.error = `HTTP ${response.status}, size too small`;
        }
        
      } catch (error) {
        const errorMsg = error.response ? 
          `HTTP ${error.response.status}: ${error.response.statusText}` : 
          error.message;
        
        console.warn(`❌ ${endpoint.name} fallito: ${errorMsg}`);
        
        testResults.push({
          endpoint: endpoint.name,
          path: endpoint.path,
          status: error.response?.status || 0,
          size: 0,
          duration: '0ms',
          success: false,
          error: errorMsg
        });
      }
    }
    
    // Stampa riepilogo test
    console.log('\n📋 RIEPILOGO TEST ENDPOINTS:');
    console.log('='.repeat(70));
    testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.endpoint.padEnd(20)} | ${result.path.padEnd(25)} | ${result.error || 'OK'}`);
    });
    console.log('='.repeat(70));
    
    const error = new Error(`Nessun endpoint HTTP funzionante dopo ${endpoints.length} tentativi`);
    error.testResults = testResults;
    error.cameraIP = cameraConfig.ip;
    error.suggestions = [
      'Verifica che HTTP Service sia abilitato nell\'app IMOU Life',
      'Controlla credenziali admin/password nell\'app',
      'Prova a resettare la camera e riconfigurarla',
      'Verifica che la camera sia sulla stessa rete',
      'Controlla se la camera è in modalità sleep/risparmio energetico'
    ];
    
    throw error;
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
   * Scatto via RTSP usando FFmpeg
   */
  async captureViaRTSP(cameraConfig) {
    try {
      console.log(`📺 Cattura RTSP da ${cameraConfig.ip}...`);
      
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const fs = require('fs');
      const path = require('path');
      
      const execAsync = promisify(exec);
      
      // Assicura che temp directory esista
      const tempDir = path.join(__dirname, '../../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const outputFile = path.join(tempDir, `rtsp_${Date.now()}.jpg`);
      
      // URL RTSP - prova diversi formati
      let rtspUrls = [];
      
      // Se capabilities ha rtspUrl specifico, usalo
      if (cameraConfig.capabilities && cameraConfig.capabilities.rtspUrl) {
        rtspUrls.push(cameraConfig.capabilities.rtspUrl);
      }
      
      // Aggiungi URL standard IMOU/Dahua
      rtspUrls.push(`rtsp://${cameraConfig.username}:${cameraConfig.password}@${cameraConfig.ip}:554/cam/realmonitor?channel=1&subtype=0`);
      rtspUrls.push(`rtsp://${cameraConfig.username}:${cameraConfig.password}@${cameraConfig.ip}:554/cam/realmonitor?channel=1&subtype=1`);
      rtspUrls.push(`rtsp://${cameraConfig.username}:${cameraConfig.password}@${cameraConfig.ip}:554/`);
      
      let lastError = null;
      
      for (const rtspUrl of rtspUrls) {
        try {
          console.log(`📡 Provo RTSP URL: ${rtspUrl.replace(cameraConfig.password, '***')}`);
          
          // Comando FFmpeg ottimizzato
          const ffmpegCmd = [
            'ffmpeg',
            '-rtsp_transport tcp',
            '-i', `"${rtspUrl}"`,
            '-vframes 1',
            '-f image2',
            '-q:v 2',
            '-update 1',
            '-y',
            `"${outputFile}"`
          ].join(' ');

          await execAsync(ffmpegCmd, { timeout: 15000 });

          if (fs.existsSync(outputFile)) {
            const imageBuffer = fs.readFileSync(outputFile);
            
            // Cleanup file temporaneo
            fs.unlinkSync(outputFile);
            
            if (imageBuffer.length > 1000 && this.isValidJPEG(imageBuffer)) {
              console.log(`✅ RTSP cattura riuscita: ${(imageBuffer.length / 1024).toFixed(1)}KB`);
              
              return {
                imageBuffer: imageBuffer,
                method: 'rtsp_ffmpeg'
              };
            }
          }
          
        } catch (urlError) {
          lastError = urlError;
          console.warn(`⚠️ URL RTSP fallito: ${urlError.message}`);
          continue;
        }
      }
      
      throw new Error(`RTSP capture failed dopo ${rtspUrls.length} tentativi: ${lastError?.message}`);
      
    } catch (error) {
      throw new Error(`RTSP capture failed: ${error.message}`);
    }
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
      
      console.log(`📊 Stats aggiornate per aula ${classroomId}: ${success ? 'online' : 'error'}`);
      
    } catch (error) {
      console.error('Errore aggiornamento stats camera:', error);
    }
  }

  /**
   * Discovery automatico camere sulla rete - VERSIONE CORRETTA
   */
  async discoverCameras(networkRange = '192.168.1') {
    console.log(`🔍 Discovery camere sulla rete ${networkRange}.x`);
    console.log(`⏭️ IP esclusi: ${this.excludedIPs.join(', ')}`);
    
    const cameras = [];
    const promises = [];
    
    // Scansiona range IP (salto gli esclusi)
    for (let i = 1; i <= 254; i++) {
      const ip = `${networkRange}.${i}`;
      
      if (this.excludedIPs.includes(ip)) {
        console.log(`⏭️ Saltando IP escluso: ${ip}`);
        continue;
      }
      
      promises.push(
        this.testCameraAtIP(ip).then(result => {
          if (result.isCamera) {
            cameras.push(result);
            console.log(`📷 Camera confermata: ${ip} (${result.model}) - Endpoint: ${result.workingEndpoint}`);
          }
        }).catch(() => {
          // Ignora errori (IP non raggiungibili)
        })
      );
    }
    
    // Attendi tutti i test con timeout globale
    await Promise.allSettled(promises);
    
    console.log(`✅ Discovery completato: ${cameras.length} camere VERE trovate`);
    
    // Stampa riepilogo dettagliato
    if (cameras.length > 0) {
      console.log('\n📋 CAMERE TROVATE:');
      console.log('='.repeat(70));
      cameras.forEach(cam => {
        console.log(`📷 ${cam.ip.padEnd(15)} | ${cam.model.padEnd(20)} | ${cam.workingEndpoint}`);
        console.log(`   Credenziali: ${cam.workingCredentials.username}:${cam.workingCredentials.password || 'empty'}`);
        console.log(`   Dimensione test: ${(cam.imageSize / 1024).toFixed(1)}KB`);
      });
    } else {
      console.log('\n⚠️ Nessuna camera trovata. Suggerimenti:');
      console.log('   - Verifica che le camere siano accese e connesse');
      console.log('   - Controlla che HTTP Service sia abilitato');
      console.log('   - Verifica credenziali admin/password');
    }
    
    return cameras;
  }

  /**
   * Test se IP specifico è una camera - VERSIONE CORRETTA
   */
  async testCameraAtIP(ip) {
    // ESCLUDI il MacBook dell'utente e altri IP noti
    if (this.excludedIPs.includes(ip)) {
      console.log(`⏭️ Saltando ${ip} (IP escluso)`);
      return { isCamera: false, reason: 'excluded_ip' };
    }
    
    try {
      console.log(`🔍 Test camera: ${ip}`);
      
      // Test rapido connessione base
      let baseResponse;
      try {
        baseResponse = await axios({
          method: 'GET',
          url: `http://${ip}/`,
          timeout: 2000,
          validateStatus: () => true
        });
        
        // Se non risponde o errore server, non è camera
        if (baseResponse.status >= 500) {
          return { isCamera: false, reason: `HTTP ${baseResponse.status}` };
        }
        
      } catch (error) {
        // Se non risponde affatto, prova direttamente gli endpoint camera
        console.log(`📡 ${ip} non risponde su /, testando endpoint camera...`);
      }
      
      // Test endpoint camera specifici
      const cameraEndpoints = [
        { path: '/tmpfs/snap.jpg', name: 'imou_dahua' },
        { path: '/cgi-bin/snapshot.cgi', name: 'generic' },
        { path: '/snapshot.jpg', name: 'basic' },
        { path: '/axis-cgi/jpg/image.cgi', name: 'axis' }
      ];
      
      const credentials = [
        { username: 'admin', password: 'Mannoli2025' },
        { username: 'admin', password: 'admin123' },
        { username: 'admin', password: 'admin' },
        { username: 'admin', password: '' }
      ];
      
      for (const endpoint of cameraEndpoints) {
        for (const cred of credentials) {
          try {
            console.log(`🎯 Test ${ip}${endpoint.path} con ${cred.username}:${cred.password || 'empty'}`);
            
            const snapResponse = await axios({
              method: 'GET',
              url: `http://${ip}${endpoint.path}`,
              auth: cred,
              timeout: 5000,
              responseType: 'arraybuffer',
              headers: {
                'User-Agent': 'AttendanceSystem/1.0 Camera-Discovery'
              }
            });
            
            if (snapResponse.status === 200 && snapResponse.data.length > 1000) {
              const buffer = Buffer.from(snapResponse.data);
              
              // VERIFICA CRITICA: Deve essere JPEG valido
              if (this.isValidJPEG(buffer)) {
                console.log(`✅ CAMERA TROVATA: ${ip} - Endpoint: ${endpoint.path} - Credenziali: ${cred.username}:${cred.password || 'empty'}`);
                
                return {
                  isCamera: true,
                  ip,
                  model: this.detectCameraModel(baseResponse?.headers || {}),
                  workingEndpoint: endpoint.path,
                  workingCredentials: cred,
                  imageSize: buffer.length,
                  testSuccess: true
                };
              } else {
                console.log(`⚠️ ${ip}${endpoint.path}: Dati ricevuti ma non JPEG (probabilmente HTML)`);
              }
            }
            
          } catch (endpointError) {
            // Log solo errori interessanti
            if (!endpointError.message.includes('timeout') && 
                !endpointError.message.includes('ECONNREFUSED') &&
                !endpointError.message.includes('ETIMEDOUT')) {
              console.log(`❌ ${ip}${endpoint.path}: ${endpointError.message}`);
            }
          }
        }
      }
      
      console.log(`❌ ${ip}: Non è una camera (nessun endpoint funzionante)`);
      return { isCamera: false, reason: 'no_working_endpoints' };
      
    } catch (error) {
      return { isCamera: false, reason: error.message };
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
    if (server.includes('nginx') || server.includes('apache')) return 'Generic IP Camera';
    
    return 'Generic IP Camera';
  }

  /**
   * Test completo sistema camere
   */
  async testAllConfiguredCameras() {
    console.log('🧪 Test di tutte le camere configurate...');
    
    const { Op } = require('sequelize');
    const classrooms = await Classroom.findAll({
      where: {
        camera_ip: { [Op.ne]: null }
      }
    });
    
    console.log(`📋 Trovate ${classrooms.length} aule con camera configurata`);
    
    const results = [];
    
    for (const classroom of classrooms) {
      try {
        console.log(`\n🔍 Test camera aula: ${classroom.name} (${classroom.camera_ip})`);
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
    console.log('='.repeat(80));
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.classroomName.padEnd(20)} (${result.cameraIP.padEnd(15)})`);
      
      if (result.success) {
        console.log(`   Metodo: ${result.method.padEnd(15)} | Durata: ${result.duration.padEnd(10)} | Size: ${(result.imageSize / 1024).toFixed(1)}KB`);
      } else {
        console.log(`   Errore: ${result.error}`);
      }
    });
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\n📈 Risultato finale: ${successCount}/${results.length} camere operative`);
    
    if (successCount === 0) {
      console.log('\n⚠️ NESSUNA CAMERA FUNZIONANTE. Verifica:');
      console.log('   1. IP cameras corretti nel database');
      console.log('   2. HTTP Service abilitato nelle camere');
      console.log('   3. Credenziali corrette');
      console.log('   4. Rete camera raggiungibile');
    }
    
    return results;
  }

  /**
   * Clear cache (per debug)
   */
  clearCache() {
    this.cameraCache.clear();
    console.log('🧹 Cache camera svuotata');
  }
}

module.exports = new EnhancedCameraService();