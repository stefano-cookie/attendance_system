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
      
      // Test connessione prioritario per RTSP cameras
      const isRTSPCamera = cameraConfig.model?.includes('RTSP') || 
                          cameraConfig.manufacturer === 'Generic' ||
                          cameraConfig.capabilities?.rtsp;
      
      if (!bypassHTTPTest && !isRTSPCamera) {
        // Test connessione HTTP solo per camere non-RTSP
        const isOnline = await this.testCameraConnection(cameraConfig.ip);
        if (!isOnline) {
          throw new Error(`Camera ${cameraConfig.ip} non raggiungibile`);
        }
        console.log(`✅ Camera ${cameraConfig.ip} raggiungibile`);
      } else if (isRTSPCamera) {
        console.log(`📺 Camera RTSP rilevata (${cameraConfig.model}), salto test HTTP e vado diretto ad RTSP`);
      }
      
      // 4. Tenta scatto con metodi multipli
      let imageBuffer = null;
      let method = 'unknown';
      let lastError = null;
      
      // Metodo 1: RTSP PRIORITARIO per camere RTSP
      // Prova RTSP per primo se è una camera RTSP nota
      if (isRTSPCamera || bypassHTTPTest || cameraConfig.capabilities?.rtsp) {
        try {
          console.log(`📺 Tentativo scatto RTSP...`);
          const result = await this.captureViaRTSP(cameraConfig);
          imageBuffer = result.imageBuffer;
          method = result.method;
          console.log(`✅ Scatto RTSP riuscito - saltando HTTP/ONVIF`);
          // RTSP ha avuto successo, non provare altri metodi
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
   * Test connessione base camera - VERSIONE CON RTSP FALLBACK
   */
  async testCameraConnection(ip) {
    // ESCLUDI il MacBook dell'utente e altri IP noti
    if (this.excludedIPs.includes(ip)) {
      console.log(`⏭️ Saltando ${ip} (IP escluso)`);
      return false;
    }
    
    console.log(`🔍 Test connessione camera: ${ip}`);
    
    // FASE 1: Test HTTP
    const testPaths = [
      '/',
      '/tmpfs/snap.jpg',
      '/cgi-bin/snapshot.cgi',
      '/snapshot.jpg',
      '/index.html'
    ];
    
    for (const testPath of testPaths) {
      try {
        console.log(`📡 Test HTTP ${ip}${testPath}...`);
        
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
          console.log(`✅ Camera ${ip} raggiungibile via HTTP (${testPath})`);
          return true;
        }
        
      } catch (error) {
        console.log(`❌ HTTP ${testPath}: ${error.message}`);
        continue;
      }
    }
    
    // FASE 2: Se HTTP fallisce, prova RTSP
    console.log(`⚠️ HTTP fallito per ${ip}, test RTSP fallback...`);
    
    try {
      const rtspResult = await this.testRTSPConnection(ip, 'admin', 'Mannoli2025');
      if (rtspResult.success) {
        console.log(`✅ Camera ${ip} raggiungibile via RTSP`);
        return true;
      }
    } catch (rtspError) {
      console.log(`❌ RTSP fallito: ${rtspError.message}`);
    }
    
    // FASE 3: Test con credenziali alternative
    try {
      const rtspResult2 = await this.testRTSPConnection(ip, 'admin', 'admin123');
      if (rtspResult2.success) {
        console.log(`✅ Camera ${ip} raggiungibile via RTSP (credenziali alternative)`);
        return true;
      }
    } catch (rtspError) {
      console.log(`❌ RTSP con credenziali alternative fallito`);
    }
    
    console.log(`❌ Camera ${ip} NON raggiungibile (HTTP e RTSP falliti)`);
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
   * Discovery INTELLIGENTE camere sulla rete - AUTO-TEST CREDENZIALI
   */
  async discoverCameras(networkRange = null) {
    // Auto-detect network se non specificato
    if (!networkRange) {
      networkRange = await this.detectLocalNetwork();
    }
    
    console.log(`🚀 Discovery INTELLIGENTE sulla rete ${networkRange}.x`);
    console.log(`🔐 Con auto-test credenziali comuni`);
    
    const detectedDevices = [];
    
    // FASE 1: Scan rapido dispositivi attivi con concorrenza limitata
    console.log('📡 FASE 1: Scan completo rete con concorrenza ottimizzata...');
    
    // Batch processing per evitare sovraccarico di rete
    const BATCH_SIZE = 20; // Massimo 20 IP simultanei
    const allIPs = [];
    for (let i = 1; i <= 254; i++) {
      allIPs.push(`${networkRange}.${i}`);
    }
    
    // Processa in batch
    for (let i = 0; i < allIPs.length; i += BATCH_SIZE) {
      const batch = allIPs.slice(i, i + BATCH_SIZE);
      console.log(`📡 Scansione batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allIPs.length/BATCH_SIZE)}: ${batch[0]} - ${batch[batch.length-1]}`);
      
      const batchPromises = batch.map(ip => 
        this.quickDeviceScan(ip).then(result => {
          if (result.isActive) {
            detectedDevices.push(result);
            console.log(`📍 TROVATO: ${ip} - Porte: ${result.openPorts.join(',') || 'nessuna'}`);
          }
        }).catch(() => {
          // Ignora errori
        })
      );
      
      await Promise.allSettled(batchPromises);
      
      // Pausa ridotta tra batch per velocità
      if (i + BATCH_SIZE < allIPs.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log(`✅ FASE 1 completata: ${detectedDevices.length} dispositivi attivi trovati`);
    
    // FASE 2: Identifica potenziali camere
    const potentialCameras = detectedDevices.filter(device => 
      device.openPorts.some(port => [80, 443, 554, 8080, 8000, 8888, 9000].includes(port))
    );
    
    console.log(`📷 ${potentialCameras.length} possibili camere rilevate`);
    
    // FASE 3: AUTO-TEST con credenziali comuni (NUOVO!)
    console.log('🔐 FASE 3: Auto-test credenziali comuni...');
    const confirmedCameras = [];
    const remainingPotential = [];
    
    const commonCredentials = [
      { username: 'admin', password: 'Mannoli2025' }, // Credenziali user (priorità massima)
      { username: 'admin', password: 'admin123' }     // Solo le più comuni per velocità
    ];
    
    // Test ogni potenziale camera con credenziali comuni
    for (const device of potentialCameras) {
      console.log(`🎯 Auto-test camera: ${device.ip}`);
      
      let cameraConfirmed = false;
      
      for (const creds of commonCredentials) {
        try {
          console.log(`  🔑 Provo ${creds.username}:${creds.password || 'empty'}`);
          
          const testResult = await this.testCameraWithCredentials(
            device.ip, 
            creds.username, 
            creds.password
          );
          
          if (testResult.success) {
            console.log(`  ✅ SUCCESSO! Camera confermata con ${creds.username}:${creds.password}`);
            
            // Aggiungi alle confermate
            confirmedCameras.push({
              ip: device.ip,
              model: testResult.model || this.detectCameraModelFromPorts(device.openPorts),
              openPorts: device.openPorts,
              isCamera: true,
              isPotentialCamera: false,
              workingCredentials: creds,
              protocol: testResult.protocol,
              method: testResult.method,
              workingEndpoint: testResult.endpoint,
              imageSize: testResult.imageSize,
              responseTime: testResult.responseTime,
              supportedProtocols: this.getSupportedProtocols(device.openPorts),
              reason: `Camera confermata automaticamente con ${testResult.protocol}`,
              autoConfirmed: true
            });
            
            cameraConfirmed = true;
            break; // Stop testing altri credenziali
          }
          
        } catch (error) {
          console.log(`  ❌ Fallito: ${error.message}`);
        }
      }
      
      // Se non confermata, lascia come potenziale
      if (!cameraConfirmed) {
        console.log(`  ⚠️ Nessuna credenziale funziona - lasciata come potenziale`);
        remainingPotential.push({
          ip: device.ip,
          model: this.detectCameraModelFromPorts(device.openPorts),
          openPorts: device.openPorts,
          isCamera: false,
          isPotentialCamera: true,
          reason: this.getCameraReason(device.openPorts),
          suggestion: 'Credenziali comuni non funzionano - inserisci quelle corrette',
          requiresCredentials: true,
          supportedProtocols: this.getSupportedProtocols(device.openPorts)
        });
      }
    }
    
    // Riepilogo finale
    console.log('\n📊 RIEPILOGO DISCOVERY INTELLIGENTE:');
    console.log('='.repeat(60));
    console.log(`✅ CAMERE CONFERMATE: ${confirmedCameras.length}`);
    confirmedCameras.forEach(cam => {
      console.log(`  📷 ${cam.ip.padEnd(15)} | ${cam.protocol.padEnd(8)} | ${cam.workingCredentials.username}:${cam.workingCredentials.password}`);
    });
    
    console.log(`⚠️ CAMERE POTENZIALI: ${remainingPotential.length}`);
    remainingPotential.forEach(cam => {
      console.log(`  📷 ${cam.ip.padEnd(15)} | ${cam.supportedProtocols.join(',').padEnd(8)} | Richiede credenziali`);
    });
    
    const totalCameras = confirmedCameras.length + remainingPotential.length;
    
    return {
      confirmed: confirmedCameras,
      potential: remainingPotential,
      total: totalCameras,
      scanTime: Date.now(),
      message: totalCameras > 0 ? 
        `Trovate ${confirmedCameras.length} camere funzionanti e ${remainingPotential.length} da configurare.` :
        'Nessuna camera trovata. Verifica che siano accese e sulla stessa rete.'
    };
  }

  /**
   * Discovery EXPRESS per API veloce - Senza auto-test credenziali
   */
  async discoverCamerasExpress(networkRange = null) {
    // Auto-detect network se non specificato
    if (!networkRange) {
      networkRange = await this.detectLocalNetwork();
    }
    
    console.log(`⚡ Discovery EXPRESS sulla rete ${networkRange}.x`);
    console.log(`🚀 SENZA auto-test credenziali per massima velocità`);
    
    const detectedDevices = [];
    
    // FASE 1: Scan rapido dispositivi attivi
    console.log('📡 FASE 1: Scan veloce rete...');
    
    const BATCH_SIZE = 30; // Più grande per velocità
    const allIPs = [];
    for (let i = 1; i <= 254; i++) {
      allIPs.push(`${networkRange}.${i}`);
    }
    
    // Processa in batch più grandi
    for (let i = 0; i < allIPs.length; i += BATCH_SIZE) {
      const batch = allIPs.slice(i, i + BATCH_SIZE);
      console.log(`📡 Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allIPs.length/BATCH_SIZE)}: ${batch[0]} - ${batch[batch.length-1]}`);
      
      const batchPromises = batch.map(ip => 
        this.quickDeviceScan(ip).then(result => {
          if (result.isActive) {
            detectedDevices.push(result);
            console.log(`📍 TROVATO: ${ip} - Porte: ${result.openPorts.join(',') || 'nessuna'}`);
          }
        }).catch(() => {
          // Ignora errori
        })
      );
      
      await Promise.allSettled(batchPromises);
      
      // Nessuna pausa per massima velocità
    }
    
    console.log(`✅ FASE 1 completata: ${detectedDevices.length} dispositivi attivi trovati`);
    
    // FASE 2: Identifica potenziali camere (SOLO IDENTIFICAZIONE)
    const potentialCameras = detectedDevices.filter(device => 
      device.openPorts.some(port => [80, 443, 554, 8080, 8000, 8888, 9000].includes(port))
    );
    
    console.log(`📷 ${potentialCameras.length} possibili camere rilevate`);
    
    // SALTA FASE 3 per velocità - solo categorizza
    const cameraResults = potentialCameras.map(device => ({
      ip: device.ip,
      model: this.detectCameraModelFromPorts(device.openPorts),
      openPorts: device.openPorts,
      isCamera: false,
      isPotentialCamera: true,
      reason: this.getCameraReason(device.openPorts),
      suggestion: 'Inserisci credenziali per testare e confermare',
      requiresCredentials: true,
      supportedProtocols: this.getSupportedProtocols(device.openPorts)
    }));
    
    // Riepilogo finale
    console.log('\n📊 RIEPILOGO DISCOVERY EXPRESS:');
    console.log('='.repeat(50));
    console.log(`⚠️ CAMERE POTENZIALI: ${cameraResults.length} (test credenziali richiesto)`);
    
    return {
      confirmed: [], // Nessuna confermata senza test
      potential: cameraResults,
      total: cameraResults.length,
      scanTime: Date.now(),
      scannedRange: `${networkRange}.1-254`,
      message: cameraResults.length > 0 ? 
        `Trovate ${cameraResults.length} possibili camere. Testa le credenziali per confermarle.` :
        'Nessuna camera potenziale trovata. Verifica che siano accese e sulla stessa rete.',
      expressMode: true
    };
  }

  /**
   * Discovery LIMITATO per API veloce - Solo range specifico
   */
  async discoverCamerasLimited(networkRange, startIP = 1, endIP = 50) {
    console.log(`⚡ Discovery LIMITATO sulla rete ${networkRange}.${startIP}-${endIP}`);
    console.log(`🔐 Con auto-test credenziali comuni`);
    
    const detectedDevices = [];
    
    // FASE 1: Scan rapido dispositivi attivi - RANGE LIMITATO
    console.log('📡 FASE 1: Scan rapido range limitato...');
    
    // Batch processing più piccolo per velocità
    const BATCH_SIZE = 10; // Massimo 10 IP simultanei
    const allIPs = [];
    for (let i = startIP; i <= endIP; i++) {
      allIPs.push(`${networkRange}.${i}`);
    }
    
    // Processa in batch
    for (let i = 0; i < allIPs.length; i += BATCH_SIZE) {
      const batch = allIPs.slice(i, i + BATCH_SIZE);
      console.log(`📡 Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allIPs.length/BATCH_SIZE)}: ${batch[0]} - ${batch[batch.length-1]}`);
      
      const batchPromises = batch.map(ip => 
        this.quickDeviceScan(ip).then(result => {
          if (result.isActive) {
            detectedDevices.push(result);
            console.log(`📍 TROVATO: ${ip} - Porte: ${result.openPorts.join(',') || 'nessuna'}`);
          }
        }).catch(() => {
          // Ignora errori
        })
      );
      
      await Promise.allSettled(batchPromises);
      
      // Piccola pausa tra batch
      if (i + BATCH_SIZE < allIPs.length) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Pausa più breve
      }
    }
    
    console.log(`✅ FASE 1 completata: ${detectedDevices.length} dispositivi attivi trovati`);
    
    // FASE 2: Identifica potenziali camere
    const potentialCameras = detectedDevices.filter(device => 
      device.openPorts.some(port => [80, 443, 554, 8080, 8000, 8888, 9000].includes(port))
    );
    
    console.log(`📷 ${potentialCameras.length} possibili camere rilevate`);
    
    // FASE 3: AUTO-TEST limitato (solo prime 2 credenziali per velocità)
    console.log('🔐 FASE 3: Auto-test veloce credenziali...');
    const confirmedCameras = [];
    const remainingPotential = [];
    
    const quickCredentials = [
      { username: 'admin', password: 'Mannoli2025' }, // Credenziali user
      { username: 'admin', password: 'admin123' }     // Solo le più comuni
    ];
    
    // Test ogni potenziale camera con credenziali limitate
    for (const device of potentialCameras) {
      console.log(`🎯 Auto-test veloce: ${device.ip}`);
      
      let cameraConfirmed = false;
      
      for (const creds of quickCredentials) {
        try {
          console.log(`  🔑 Provo ${creds.username}:${creds.password}`);
          
          const testResult = await this.testCameraWithCredentials(
            device.ip, 
            creds.username, 
            creds.password
          );
          
          if (testResult.success) {
            console.log(`  ✅ SUCCESSO! Camera confermata`);
            
            // Aggiungi alle confermate
            confirmedCameras.push({
              ip: device.ip,
              model: testResult.model || this.detectCameraModelFromPorts(device.openPorts),
              openPorts: device.openPorts,
              isCamera: true,
              isPotentialCamera: false,
              workingCredentials: creds,
              protocol: testResult.protocol,
              method: testResult.method,
              workingEndpoint: testResult.endpoint,
              imageSize: testResult.imageSize,
              responseTime: testResult.responseTime,
              supportedProtocols: this.getSupportedProtocols(device.openPorts),
              reason: `Camera confermata automaticamente con ${testResult.protocol}`,
              autoConfirmed: true
            });
            
            cameraConfirmed = true;
            break; // Stop testing altri credenziali
          }
          
        } catch (error) {
          console.log(`  ❌ Fallito: ${error.message}`);
        }
      }
      
      // Se non confermata, lascia come potenziale
      if (!cameraConfirmed) {
        console.log(`  ⚠️ Credenziali quick non funzionano - lasciata come potenziale`);
        remainingPotential.push({
          ip: device.ip,
          model: this.detectCameraModelFromPorts(device.openPorts),
          openPorts: device.openPorts,
          isCamera: false,
          isPotentialCamera: true,
          reason: this.getCameraReason(device.openPorts),
          suggestion: 'Test credenziali per confermare',
          requiresCredentials: true,
          supportedProtocols: this.getSupportedProtocols(device.openPorts)
        });
      }
    }
    
    // Riepilogo finale
    console.log('\n📊 RIEPILOGO DISCOVERY LIMITATO:');
    console.log('='.repeat(50));
    console.log(`✅ CAMERE CONFERMATE: ${confirmedCameras.length}`);
    console.log(`⚠️ CAMERE POTENZIALI: ${remainingPotential.length}`);
    
    const totalCameras = confirmedCameras.length + remainingPotential.length;
    
    return {
      confirmed: confirmedCameras,
      potential: remainingPotential,
      total: totalCameras,
      scanTime: Date.now(),
      scannedRange: `${networkRange}.${startIP}-${endIP}`,
      message: totalCameras > 0 ? 
        `Trovate ${confirmedCameras.length} camere funzionanti e ${remainingPotential.length} da configurare (scan limitato).` :
        'Nessuna camera trovata nel range limitato. Usa scan completo se necessario.'
    };
  }

  /**
   * Test se IP specifico è una camera - VERSIONE MIGLIORATA
   */
  async testCameraAtIP(ip) {
    // ESCLUDI il MacBook dell'utente e altri IP noti
    if (this.excludedIPs.includes(ip)) {
      console.log(`⏭️ Saltando ${ip} (IP escluso)`);
      return { isCamera: false, reason: 'excluded_ip' };
    }
    
    try {
      console.log(`🔍 Test camera: ${ip}`);
      
      // Prima controlla se l'IP risponde a ping
      const isReachable = await this.pingTest(ip);
      if (!isReachable) {
        return { isCamera: false, reason: 'not_reachable' };
      }
      
      // Test porte comuni delle camere
      const openPorts = await this.checkCameraPorts(ip);
      
      // Test rapido connessione base HTTP
      let baseResponse;
      let httpResponds = false;
      try {
        baseResponse = await axios({
          method: 'GET',
          url: `http://${ip}/`,
          timeout: 2000,
          validateStatus: () => true
        });
        
        httpResponds = true;
        
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
      
      // Se nessun endpoint HTTP funziona ma abbiamo porte camera aperte,
      // potrebbe essere una camera con HTTP disabilitato
      if (openPorts.some(port => [80, 554, 8080, 8000].includes(port))) {
        console.log(`🔍 ${ip}: Possibile camera - porte camera aperte ma HTTP non risponde`);
        return {
          isCamera: false,
          isPotentialCamera: true,
          ip,
          reason: 'HTTP service disabled - camera ports open',
          openPorts,
          model: 'Unknown Camera (HTTP disabled)',
          suggestion: 'Enable HTTP Service in camera settings'
        };
      }
      
      console.log(`❌ ${ip}: Non è una camera (nessun endpoint funzionante)`);
      return { isCamera: false, reason: 'no_working_endpoints' };
      
    } catch (error) {
      return { isCamera: false, reason: error.message };
    }
  }

  /**
   * Test ping per verificare se IP è raggiungibile
   */
  async pingTest(ip) {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync(`ping -c 1 -W 1000 ${ip}`, { timeout: 2000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Scan RAPIDO di un singolo dispositivo - solo ping + porte principali
   */
  async quickDeviceScan(ip) {
    try {
      // Test ping rapido (500ms timeout)
      const isReachable = await this.fastPing(ip);
      if (!isReachable) {
        return { isActive: false, ip };
      }
      
      // Test porte camera principali (timeout ridotto)
      const openPorts = await this.fastPortScan(ip);
      
      return {
        isActive: openPorts.length > 0,
        ip,
        openPorts,
        timestamp: Date.now()
      };
      
    } catch (error) {
      return { isActive: false, ip };
    }
  }

  /**
   * Ping velocissimo - VERSIONE MIGLIORATA
   */
  async fastPing(ip) {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // Ping singolo con timeout aumentato per macOS - alcuni dispositivi rispondono lentamente
      await execAsync(`ping -c 1 -W 2000 ${ip}`, { timeout: 4000 });
      return true;
    } catch (error) {
      // Se ping fallisce, prova una connessione TCP diretta su porta 80 o 554
      return await this.fallbackConnectivityTest(ip);
    }
  }

  /**
   * Test di connettività alternativo se ping fallisce
   */
  async fallbackConnectivityTest(ip) {
    const net = require('net');
    const testPorts = [80, 554, 8080]; // Porte comuni per camere
    
    for (const port of testPorts) {
      try {
        await new Promise((resolve, reject) => {
          const socket = new net.Socket();
          const timeout = setTimeout(() => {
            socket.destroy();
            reject(new Error('timeout'));
          }, 1000);
          
          socket.connect(port, ip, () => {
            clearTimeout(timeout);
            socket.destroy();
            resolve(true);
          });
          
          socket.on('error', () => {
            clearTimeout(timeout);
            reject(new Error('connection failed'));
          });
        });
        
        // Se raggiungiamo qui, la connessione è riuscita
        console.log(`📡 ${ip} raggiungibile via TCP ${port} (ping fallito ma porta aperta)`);
        return true;
        
      } catch (error) {
        // Continua con la prossima porta
        continue;
      }
    }
    
    return false;
  }

  /**
   * Scan porte veloce - solo porte camera principali
   */
  async fastPortScan(ip) {
    const net = require('net');
    const cameraPorts = [80, 554, 8080, 8000]; // Solo porte principali
    const openPorts = [];
    
    const portPromises = cameraPorts.map(port => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        const timeout = setTimeout(() => {
          socket.destroy();
          resolve(null);
        }, 500); // Timeout ridotto a 500ms
        
        socket.connect(port, ip, () => {
          clearTimeout(timeout);
          socket.destroy();
          resolve(port);
        });
        
        socket.on('error', () => {
          clearTimeout(timeout);
          resolve(null);
        });
      });
    });
    
    const results = await Promise.all(portPromises);
    results.forEach(port => {
      if (port !== null) {
        openPorts.push(port);
      }
    });
    
    return openPorts;
  }

  /**
   * Rileva tipo camera dalle porte aperte
   */
  detectCameraModelFromPorts(openPorts) {
    if (openPorts.includes(554)) {
      if (openPorts.includes(80)) {
        return 'Camera IP (HTTP + RTSP)';
      }
      return 'Camera IP (Solo RTSP)';
    }
    
    if (openPorts.includes(80) || openPorts.includes(8080)) {
      return 'Camera IP (HTTP)';
    }
    
    return 'Dispositivo Camera';
  }

  /**
   * Determina protocolli supportati
   */
  getSupportedProtocols(openPorts) {
    const protocols = [];
    
    if (openPorts.includes(554)) {
      protocols.push('RTSP');
    }
    
    if (openPorts.includes(80) || openPorts.includes(8080)) {
      protocols.push('HTTP');
    }
    
    if (openPorts.includes(443)) {
      protocols.push('HTTPS');
    }
    
    return protocols.length > 0 ? protocols : ['Unknown'];
  }

  /**
   * Genera motivo rilevamento camera
   */
  getCameraReason(openPorts) {
    if (openPorts.includes(554) && openPorts.includes(80)) {
      return 'Porte camera complete (HTTP + RTSP) - Pronto per test';
    }
    
    if (openPorts.includes(554)) {
      return 'Porta RTSP aperta - Camera streaming supportata';
    }
    
    if (openPorts.includes(80) || openPorts.includes(8080)) {
      return 'Porta HTTP aperta - Possibile camera web';
    }
    
    return 'Porte camera rilevate';
  }

  /**
   * Controlla porte comuni delle camere (metodo originale per compatibilità)
   */
  async checkCameraPorts(ip) {
    const net = require('net');
    const ports = [80, 443, 554, 8080, 8000, 8888, 9000];
    const openPorts = [];
    
    const portPromises = ports.map(port => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        const timeout = setTimeout(() => {
          socket.destroy();
          resolve(null);
        }, 1000);
        
        socket.connect(port, ip, () => {
          clearTimeout(timeout);
          socket.destroy();
          resolve(port);
        });
        
        socket.on('error', () => {
          clearTimeout(timeout);
          resolve(null);
        });
      });
    });
    
    const results = await Promise.all(portPromises);
    results.forEach(port => {
      if (port !== null) {
        openPorts.push(port);
      }
    });
    
    return openPorts;
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
   * Test camera con credenziali - PRIORITA' RTSP
   */
  async testCameraWithCredentials(ip, username, password) {
    console.log(`🎯 Test camera ${ip} con credenziali ${username}:${password}`);
    
    try {
      // Prima controlla se è raggiungibile
      const isReachable = await this.fastPing(ip);
      if (!isReachable) {
        return {
          success: false,
          error: 'Camera non raggiungibile sulla rete',
          ip
        };
      }
      
      // Controlla porte disponibili
      const openPorts = await this.fastPortScan(ip);
      console.log(`📊 Porte aperte: ${openPorts.join(', ')}`);
      
      // Se non trova porte con fast scan, prova scan completo
      if (openPorts.length === 0) {
        console.log('⚠️ Nessuna porta trovata con fast scan, provo scan completo...');
        const allPorts = await this.checkCameraPorts(ip);
        openPorts.push(...allPorts);
        console.log(`📊 Porte trovate (scan completo): ${openPorts.join(', ')}`);
      }
      
      let testResults = [];
      let bestMethod = null;
      
      // PRIORITA' 1: RTSP (se porta 554 aperta)
      if (openPorts.includes(554)) {
        console.log('📺 Test RTSP (priorità alta)...');
        
        const rtspResult = await this.testRTSPConnection(ip, username, password);
        testResults.push(rtspResult);
        
        if (rtspResult.success) {
          bestMethod = rtspResult;
          console.log('✅ RTSP funziona! Usato come metodo principale.');
        }
      }
      
      // PRIORITA' 2: HTTP (se non funziona RTSP o come backup)
      if (!bestMethod && (openPorts.includes(80) || openPorts.includes(8080))) {
        console.log('🌐 Test HTTP...');
        
        const httpResult = await this.testHTTPConnection(ip, username, password);
        testResults.push(httpResult);
        
        if (httpResult.success) {
          bestMethod = httpResult;
          console.log('✅ HTTP funziona!');
        }
      }
      
      if (bestMethod) {
        return {
          success: true,
          ip,
          method: bestMethod.method,
          protocol: bestMethod.protocol,
          endpoint: bestMethod.endpoint,
          credentials: { username, password },
          imageSize: bestMethod.imageSize || 0,
          responseTime: bestMethod.responseTime,
          model: this.detectCameraModelFromPorts(openPorts),
          openPorts,
          supportedProtocols: this.getSupportedProtocols(openPorts),
          testResults
        };
      } else {
        return {
          success: false,
          error: 'Nessun protocollo funzionante con le credenziali fornite',
          ip,
          openPorts,
          testResults,
          suggestions: [
            'Verifica username e password',
            'Controlla che i servizi camera siano abilitati',
            'Prova credenziali diverse (admin/admin, admin/123456)',
            openPorts.includes(554) ? 'Camera supporta RTSP - verifica configurazione stream' : null,
            openPorts.includes(80) ? 'Camera supporta HTTP - verifica servizio web abilitato' : null
          ].filter(Boolean)
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        ip
      };
    }
  }

  /**
   * Test connessione RTSP con FFmpeg
   */
  async testRTSPConnection(ip, username, password) {
    try {
      console.log(`📺 Test RTSP: ${ip}:554`);
      
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
      
      const outputFile = path.join(tempDir, `rtsp_test_${ip}_${Date.now()}.jpg`);
      
      // URL RTSP comuni per camere IP
      const rtspUrls = [
        `rtsp://${username}:${password}@${ip}:554/cam/realmonitor?channel=1&subtype=0`, // Dahua/IMOU principale
        `rtsp://${username}:${password}@${ip}:554/cam/realmonitor?channel=1&subtype=1`, // Dahua/IMOU secondario
        `rtsp://${username}:${password}@${ip}:554/`,                                    // Generico
        `rtsp://${username}:${password}@${ip}:554/live`,                               // Live stream
        `rtsp://${username}:${password}@${ip}:554/stream1`,                            // Stream 1
        `rtsp://${username}:${password}@${ip}:554/h264`                                // H264 stream
      ];
      
      const startTime = Date.now();
      
      for (const rtspUrl of rtspUrls) {
        try {
          console.log(`🔗 Provo URL: ${rtspUrl.replace(password, '***')}`);
          
          // Comando FFmpeg ottimizzato per test rapido
          const ffmpegCmd = [
            'ffmpeg',
            '-rtsp_transport tcp',
            '-i', `"${rtspUrl}"`,
            '-vframes 1',
            '-f image2',
            '-q:v 2',
            '-y',
            `"${outputFile}"`
          ].join(' ');

          await execAsync(ffmpegCmd, { timeout: 8000 }); // Timeout di 8 secondi
          
          if (fs.existsSync(outputFile)) {
            const imageBuffer = fs.readFileSync(outputFile);
            
            // Cleanup
            fs.unlinkSync(outputFile);
            
            if (imageBuffer.length > 1000 && this.isValidJPEG(imageBuffer)) {
              const responseTime = Date.now() - startTime;
              console.log(`✅ RTSP SUCCESS: ${(imageBuffer.length / 1024).toFixed(1)}KB in ${responseTime}ms`);
              
              return {
                success: true,
                method: 'rtsp_ffmpeg',
                protocol: 'RTSP',
                endpoint: rtspUrl.split('@')[1], // Remove credentials from logged URL
                imageSize: imageBuffer.length,
                responseTime,
                imageBuffer
              };
            }
          }
          
        } catch (urlError) {
          console.log(`❌ URL fallito: ${urlError.message.substring(0, 100)}`);
          continue;
        }
      }
      
      throw new Error('Nessun URL RTSP funzionante');
      
    } catch (error) {
      return {
        success: false,
        method: 'rtsp_ffmpeg',
        protocol: 'RTSP',
        error: error.message
      };
    }
  }

  /**
   * Test connessione HTTP veloce
   */
  async testHTTPConnection(ip, username, password) {
    try {
      console.log(`🌐 Test HTTP: ${ip}:80`);
      
      const httpEndpoints = [
        '/tmpfs/snap.jpg',      // IMOU/Dahua
        '/cgi-bin/snapshot.cgi', // Generico
        '/snapshot.jpg',         // Semplice
        '/image.jpg'            // Alternativo
      ];
      
      const startTime = Date.now();
      
      for (const endpoint of httpEndpoints) {
        try {
          console.log(`🔗 Test endpoint: ${endpoint}`);
          
          const response = await axios({
            method: 'GET',
            url: `http://${ip}${endpoint}`,
            auth: { username, password },
            timeout: 3000,
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'AttendanceSystem/1.0 Fast-Test'
            }
          });
          
          if (response.status === 200 && response.data.length > 1000) {
            const buffer = Buffer.from(response.data);
            
            if (this.isValidJPEG(buffer)) {
              const responseTime = Date.now() - startTime;
              console.log(`✅ HTTP SUCCESS: ${(buffer.length / 1024).toFixed(1)}KB in ${responseTime}ms`);
              
              return {
                success: true,
                method: 'http',
                protocol: 'HTTP',
                endpoint,
                imageSize: buffer.length,
                responseTime,
                imageBuffer: buffer
              };
            }
          }
          
        } catch (endpointError) {
          console.log(`❌ Endpoint ${endpoint} fallito: ${endpointError.message}`);
          continue;
        }
      }
      
      throw new Error('Nessun endpoint HTTP funzionante');
      
    } catch (error) {
      return {
        success: false,
        method: 'http',
        protocol: 'HTTP',
        error: error.message
      };
    }
  }

  /**
   * Rileva automaticamente la rete locale
   */
  async detectLocalNetwork() {
    try {
      const os = require('os');
      const interfaces = os.networkInterfaces();
      
      // Cerca interfacce di rete attive
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          // Cerca IPv4 non loopback
          if (iface.family === 'IPv4' && !iface.internal) {
            // Estrai i primi 3 ottetti dell'IP
            const parts = iface.address.split('.');
            const network = parts.slice(0, 3).join('.');
            console.log(`🌐 Rete rilevata automaticamente: ${network}.x (da ${iface.address})`);
            return network;
          }
        }
      }
      
      // Fallback se non trova nulla
      console.log('⚠️ Rete non rilevata, uso default 192.168.1');
      return '192.168.1';
      
    } catch (error) {
      console.error('❌ Errore rilevamento rete:', error);
      return '192.168.1';
    }
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