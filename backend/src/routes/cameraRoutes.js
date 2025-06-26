const express = require('express');
const router = express.Router();
const enhancedCameraService = require('../services/enhancedCameraService');
const imageStorageService = require('../services/imageStorageService');

const { Op } = require('sequelize');

const { authenticate } = require('../middleware/authMiddleware');

const { Classroom, Lesson } = require('../models');

const EXCLUDED_IPS = ['192.168.1.4', '192.168.1.1'];

function isValidCameraIP(ip) {
  if (!ip) return false;
  
  const cleanIP = ip.split(':')[0];
  
  if (EXCLUDED_IPS.includes(cleanIP)) {
    return false;
  }
  
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  return ipPattern.test(cleanIP);
}

function formatCameraForFrontend(classroom) {
  return {
    id: classroom.id,
    name: `Camera ${classroom.name}`,
    ip_address: classroom.camera_ip ? classroom.camera_ip.split(':')[0] : null,
    port: classroom.camera_ip && classroom.camera_ip.includes(':') 
      ? parseInt(classroom.camera_ip.split(':')[1]) 
      : 80,
    username: classroom.camera_username || 'admin',
    classroom_id: classroom.id,
    classroom_name: classroom.name,
    status: classroom.camera_status || 'unknown',
    last_check: classroom.camera_last_check,
    last_success: classroom.camera_last_success,
    preferred_method: classroom.camera_preferred_method,
    model: classroom.camera_model,
    manufacturer: classroom.camera_manufacturer,
    is_active: classroom.camera_status !== 'disabled'
  };
}

// ==========================================
// API CRUD FRONTEND
// ==========================================

router.get('/', authenticate, async (req, res) => {
  try {
    console.log('📋 Richiesta lista camere configurate');
    
    const classrooms = await Classroom.findAll({
      where: {
        camera_ip: { [Op.ne]: null }
      },
      attributes: [
        'id', 'name', 'camera_ip', 'camera_username', 'camera_model', 
        'camera_manufacturer', 'camera_status', 'camera_last_check', 
        'camera_last_success', 'camera_preferred_method'
      ],
      order: [['name', 'ASC']]
    });
    
    console.log(`📊 Trovate ${classrooms.length} aule con camera configurata`);
    
    const cameras = classrooms
      .filter(classroom => isValidCameraIP(classroom.camera_ip))
      .map(formatCameraForFrontend);
    
    const excludedCount = classrooms.length - cameras.length;
    if (excludedCount > 0) {
      console.log(`⚠️ ${excludedCount} camere escluse (IP non validi o esclusi)`);
    }
    
    res.json({
      success: true,
      cameras: cameras,
      total: cameras.length,
      excluded: excludedCount
    });
    
  } catch (error) {
    console.error('❌ Errore lista camere:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel caricamento delle camere',
      details: error.message
    });
  }
});

/**
 * POST /api/cameras
 * Crea nuova camera (associata a classroom)
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, ip_address, port, username, password, classroom_id, is_active } = req.body;
    
    console.log('➕ Creazione nuova camera:', { name, ip_address, classroom_id });
    
    if (!name || !ip_address || !classroom_id) {
      return res.status(400).json({
        success: false,
        error: 'Nome, IP e aula sono obbligatori'
      });
    }
    
    if (!isValidCameraIP(ip_address)) {
      return res.status(400).json({
        success: false,
        error: `IP ${ip_address} non valido o nella lista esclusi`
      });
    }
    
    const classroom = await Classroom.findByPk(classroom_id);
    if (!classroom) {
      return res.status(404).json({
        success: false,
        error: 'Aula non trovata'
      });
    }
    
    if (classroom.camera_ip) {
      return res.status(400).json({
        success: false,
        error: 'Aula ha già una camera configurata'
      });
    }
    
    const fullIP = port && port !== 80 ? `${ip_address}:${port}` : ip_address;
    
    console.log(`🔍 Test connessione nuova camera: ${fullIP}`);
    const isOnline = await enhancedCameraService.testCameraConnection(fullIP);
    
    const updateData = {
      camera_ip: fullIP,
      camera_username: username || 'admin',
      camera_password: password || 'Mannoli2025',
      camera_model: name,
      camera_manufacturer: 'IMOU',
      camera_status: isOnline ? 'online' : 'offline',
      camera_last_check: new Date()
    };
    
    await classroom.update(updateData);
    console.log(`✅ Camera creata per aula ${classroom.name}: ${isOnline ? 'online' : 'offline'}`);
    
    const updatedClassroom = await Classroom.findByPk(classroom_id);
    const cameraResponse = formatCameraForFrontend(updatedClassroom);
    
    res.status(201).json({
      success: true,
      message: 'Camera creata con successo',
      camera: cameraResponse,
      test_result: {
        connection: isOnline,
        tested_at: new Date()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore creazione camera:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante la creazione della camera',
      details: error.message
    });
  }
});

/**
 * PUT /api/cameras/:id
 * Aggiorna camera esistente
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, ip_address, port, username, password, is_active } = req.body;
    
    console.log(`✏️ Aggiornamento camera ${id}:`, { name, ip_address });
    
    const classroom = await Classroom.findByPk(id);
    if (!classroom || !classroom.camera_ip) {
      return res.status(404).json({
        success: false,
        error: 'Camera non trovata'
      });
    }
    
    const updateData = {};
    
    if (name) updateData.camera_model = name;
    if (username) updateData.camera_username = username;
    if (password) updateData.camera_password = password;
    
    if (ip_address) {
      if (!isValidCameraIP(ip_address)) {
        return res.status(400).json({
          success: false,
          error: `IP ${ip_address} non valido o nella lista esclusi`
        });
      }
      
      const fullIP = port && port !== 80 ? `${ip_address}:${port}` : ip_address;
      updateData.camera_ip = fullIP;
      
      console.log(`🔍 Test nuova connessione: ${fullIP}`);
      const isOnline = await enhancedCameraService.testCameraConnection(fullIP);
      updateData.camera_status = isOnline ? 'online' : 'offline';
      updateData.camera_last_check = new Date();
      
      console.log(`📊 Risultato test nuovo IP: ${isOnline ? 'online' : 'offline'}`);
    }
    
    if (is_active !== undefined) {
      updateData.camera_status = is_active ? 'online' : 'disabled';
    }
    
    await classroom.update(updateData);
    
    const updatedClassroom = await Classroom.findByPk(id);
    const cameraResponse = formatCameraForFrontend(updatedClassroom);
    
    res.json({
      success: true,
      message: 'Camera aggiornata con successo',
      camera: cameraResponse
    });
    
  } catch (error) {
    console.error('❌ Errore aggiornamento camera:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante l\'aggiornamento della camera',
      details: error.message
    });
  }
});

/**
 * DELETE /api/cameras/:id
 * Elimina camera (rimuove configurazione da classroom)
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Eliminazione camera ${id}`);
    
    const classroom = await Classroom.findByPk(id);
    if (!classroom || !classroom.camera_ip) {
      return res.status(404).json({
        success: false,
        error: 'Camera non trovata'
      });
    }
    
    const cameraIP = classroom.camera_ip;
    
    await classroom.update({
      camera_ip: null,
      camera_username: null,
      camera_password: null,
      camera_model: null,
      camera_manufacturer: null,
      camera_status: 'unknown',
      camera_last_check: null,
      camera_last_success: null,
      camera_preferred_method: null
    });
    
    console.log(`✅ Camera ${cameraIP} rimossa da aula ${classroom.name}`);
    
    res.json({
      success: true,
      message: 'Camera eliminata con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore eliminazione camera:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante l\'eliminazione della camera',
      details: error.message
    });
  }
});

/**
 * POST /api/cameras/:id/test
 * Testa connessione camera specifica
 */
router.post('/:id/test', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Test camera ${id}`);
    
    const classroom = await Classroom.findByPk(id);
    if (!classroom || !classroom.camera_ip) {
      return res.status(404).json({
        success: false,
        error: 'Camera non trovata'
      });
    }
    
    if (!isValidCameraIP(classroom.camera_ip)) {
      return res.status(400).json({
        success: false,
        error: `IP camera ${classroom.camera_ip} non valido o escluso`,
        data: {
          ip: classroom.camera_ip,
          status: 'invalid_ip',
          testedAt: new Date()
        }
      });
    }
    
    console.log(`🧪 Test connessione camera: ${classroom.camera_ip}`);
    
    const startTime = Date.now();
    const isOnline = await enhancedCameraService.testCameraConnection(classroom.camera_ip);
    const testDuration = Date.now() - startTime;
    
    await classroom.update({
      camera_status: isOnline ? 'online' : 'offline',
      camera_last_check: new Date()
    });
    
    console.log(`📊 Risultato test camera ${classroom.name}: ${isOnline ? 'online' : 'offline'} (${testDuration}ms)`);
    
    res.json({
      success: isOnline,
      message: isOnline ? 'Camera online e funzionante' : 'Camera non raggiungibile',
      data: {
        ip: classroom.camera_ip,
        status: isOnline ? 'online' : 'offline',
        testedAt: new Date(),
        testDuration: `${testDuration}ms`,
        classroom: classroom.name
      }
    });
    
  } catch (error) {
    console.error('❌ Errore test camera:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante il test della camera',
      details: error.message
    });
  }
});

/**
 * POST /api/cameras/:id/capture
 * Scatta foto da camera specifica
 */
router.post('/:id/capture', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📸 Richiesta scatto camera ${id}`);
    
    const classroom = await Classroom.findByPk(id);
    if (!classroom || !classroom.camera_ip) {
      return res.status(404).json({
        success: false,
        error: 'Camera non trovata'
      });
    }
    
    if (!isValidCameraIP(classroom.camera_ip)) {
      return res.status(400).json({
        success: false,
        error: `IP camera ${classroom.camera_ip} non valido o escluso`
      });
    }
    
    console.log(`📷 Scatto da camera: ${classroom.name} (${classroom.camera_ip})`);
    
    const startTime = Date.now();
    const result = await enhancedCameraService.captureImage(classroom.id);
    const captureDuration = Date.now() - startTime;
    
    if (result.success) {
      console.log(`✅ Scatto riuscito: ${(result.metadata.fileSize/1024).toFixed(1)}KB via ${result.metadata.method}`);
      
      res.json({
        success: true,
        message: 'Scatto riuscito',
        data: {
          imageSize: result.metadata.fileSize,
          method: result.metadata.method,
          resolution: result.metadata.resolution,
          capturedAt: result.metadata.timestamp,
          captureDuration: `${captureDuration}ms`,
          classroom: classroom.name
        }
      });
    } else {
      console.log(`❌ Scatto fallito: ${result.error}`);
      
      res.status(400).json({
        success: false,
        error: 'Scatto fallito',
        details: result.error,
        metadata: result.metadata
      });
    }
    
  } catch (error) {
    console.error('❌ Errore scatto camera:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante lo scatto',
      details: error.message
    });
  }
});

/**
 * POST /api/cameras/discover
 * Discovery automatico camere sulla rete (nuovo endpoint per frontend)
 */
router.post('/discover', authenticate, async (req, res) => {
  try {
    const { networkRange } = req.body;
    
    console.log(`🔍 Frontend discovery VELOCE richiesto`);
    
    // Per l'API usiamo un range limitato per velocità
    // Rileva automaticamente la rete locale ma limita il range
    let detectedNetwork;
    try {
      detectedNetwork = await enhancedCameraService.detectLocalNetwork();
      console.log(`🌐 Rete rilevata: ${detectedNetwork}.x`);
    } catch (error) {
      detectedNetwork = '192.168.1'; // Fallback
      console.log(`🌐 Uso rete fallback: ${detectedNetwork}.x`);
    }
    
    // Discovery LIMITATO per API (range 1-50 per velocità)
    const startTime = Date.now();
    const result = await enhancedCameraService.discoverCamerasLimited(detectedNetwork, 1, 50);
    const discoveryDuration = Date.now() - startTime;
    
    console.log(`✅ Discovery LIMITATO completato in ${discoveryDuration}ms:`);
    console.log(`   - Totale: ${result.total}`);
    console.log(`   - Confermate: ${result.confirmed?.length || 0}`);
    console.log(`   - Potenziali: ${result.potential?.length || 0}`);
    
    // Formato corretto per il frontend
    res.json({
      total: result.total,
      confirmed: result.confirmed || [],
      potential: result.potential || [],
      discoveryDuration,
      timestamp: new Date(),
      scannedRange: result.scannedRange || `${detectedNetwork}.1-50`,
      note: "Discovery veloce range limitato con auto-test credenziali comuni."
    });
    
  } catch (error) {
    console.error('❌ Errore discovery frontend:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante la ricerca delle camere',
      details: error.message
    });
  }
});

/**
 * POST /api/cameras/test
 * Test connessione camera specifica tramite IP
 */
router.post('/test', authenticate, async (req, res) => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP richiesto'
      });
    }
    
    console.log(`🔍 Test connessione IP: ${ip}`);
    
    const startTime = Date.now();
    const isOnline = await enhancedCameraService.testCameraConnection(ip);
    const testDuration = Date.now() - startTime;
    
    res.json({
      success: isOnline,
      message: isOnline ? 'Camera raggiungibile' : 'Camera non raggiungibile',
      ip,
      status: isOnline ? 'online' : 'offline',
      testDuration,
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Errore test IP:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante il test della camera',
      details: error.message
    });
  }
});

/**
 * POST /api/cameras/test-credentials
 * Test camera con credenziali specifiche - PRIORITA' RTSP
 */
router.post('/test-credentials', authenticate, async (req, res) => {
  try {
    const { ip, username, password } = req.body;
    
    if (!ip || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'IP, username e password sono obbligatori'
      });
    }
    
    console.log(`🎯 Test camera con credenziali: ${ip} (${username}:***)`);
    
    const startTime = Date.now();
    const result = await enhancedCameraService.testCameraWithCredentials(ip, username, password);
    const testDuration = Date.now() - startTime;
    
    if (result.success) {
      console.log(`✅ Test SUCCESS: ${result.protocol} funziona! Metodo: ${result.method}`);
      
      res.json({
        success: true,
        message: `Camera funzionante con protocollo ${result.protocol}`,
        data: {
          ip: result.ip,
          protocol: result.protocol,
          method: result.method,
          endpoint: result.endpoint,
          model: result.model,
          imageSize: result.imageSize,
          responseTime: result.responseTime,
          openPorts: result.openPorts,
          supportedProtocols: result.supportedProtocols,
          credentials: {
            username: result.credentials.username,
            passwordSet: !!result.credentials.password
          },
          testDuration,
          testedAt: new Date()
        }
      });
    } else {
      console.log(`❌ Test FAILED: ${result.error}`);
      
      res.status(400).json({
        success: false,
        message: result.error,
        data: {
          ip: result.ip,
          error: result.error,
          openPorts: result.openPorts,
          testResults: result.testResults,
          suggestions: result.suggestions,
          testDuration,
          testedAt: new Date()
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Errore test credenziali:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante il test delle credenziali',
      details: error.message
    });
  }
});

/**
 * GET /api/cameras/discovery
 * Discovery automatico camere sulla rete
 */
router.get('/discovery', authenticate, async (req, res) => {
  try {
    const { network_range } = req.query;
    const networkRange = network_range || '192.168.1';
    
    console.log(`🔍 Avvio discovery camere su rete: ${networkRange}.x`);
    console.log(`⚠️ IP esclusi: ${EXCLUDED_IPS.join(', ')}`);
    
    const startTime = Date.now();
    const cameras = await enhancedCameraService.discoverCameras(networkRange);
    const discoveryDuration = Date.now() - startTime;
    
    console.log(`✅ Discovery completato in ${discoveryDuration}ms: ${cameras.length} camere trovate`);
    
    res.json({
      success: true,
      message: `Discovery completato: ${cameras.length} camere trovate`,
      data: {
        cameras: cameras,
        networkRange: networkRange,
        excludedIPs: EXCLUDED_IPS,
        discoveryDuration: `${discoveryDuration}ms`,
        scannedRange: `${networkRange}.1-254`,
        foundCount: cameras.length
      }
    });
    
  } catch (error) {
    console.error('❌ Errore discovery:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante il discovery',
      details: error.message
    });
  }
});

/**
 * GET /api/cameras/health
 * Health check generale sistema camere
 */
router.get('/health', authenticate, async (req, res) => {
  try {
    console.log('🏥 Health check sistema camere');
    
    const classrooms = await Classroom.findAll({
      where: {
        camera_ip: { [Op.ne]: null }
      }
    });
    
    const validCameras = classrooms.filter(c => isValidCameraIP(c.camera_ip));
    const excludedCameras = classrooms.filter(c => !isValidCameraIP(c.camera_ip));
    
    const health = {
      totalConfigured: classrooms.length,
      validCameras: validCameras.length,
      excludedCameras: excludedCameras.length,
      online: validCameras.filter(c => c.camera_status === 'online').length,
      offline: validCameras.filter(c => c.camera_status === 'offline').length,
      error: validCameras.filter(c => c.camera_status === 'error').length,
      unknown: validCameras.filter(c => c.camera_status === 'unknown').length,
      disabled: validCameras.filter(c => c.camera_status === 'disabled').length,
      excludedIPs: EXCLUDED_IPS,
      lastUpdate: new Date()
    };
    
    const healthyCount = health.online;
    const totalValid = health.validCameras;
    const healthPercentage = totalValid > 0 ? Math.round((healthyCount / totalValid) * 100) : 0;
    
    health.healthPercentage = healthPercentage;
    health.systemStatus = healthPercentage >= 80 ? 'healthy' : healthPercentage >= 50 ? 'warning' : 'critical';
    
    console.log(`📊 Health check: ${healthPercentage}% (${healthyCount}/${totalValid} camere online)`);
    
    res.json({
      success: true,
      data: health
    });
    
  } catch (error) {
    console.error('❌ Errore health check:', error);
    res.status(500).json({
      success: false,
      error: 'Errore health check',
      details: error.message
    });
  }
});

/**
 * POST /api/cameras/test-all
 * Test tutte le camere configurate
 */
router.post('/test-all', authenticate, async (req, res) => {
  try {
    console.log('🧪 Test di tutte le camere configurate');
    
    const startTime = Date.now();
    const results = await enhancedCameraService.testAllConfiguredCameras();
    const testDuration = Date.now() - startTime;
    
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      testDuration: `${testDuration}ms`,
      testedAt: new Date()
    };
    
    console.log(`✅ Test completato: ${summary.successful}/${summary.total} camere operative`);
    
    res.json({
      success: true,
      message: `Test completato: ${summary.successful}/${summary.total} camere operative`,
      data: {
        summary: summary,
        results: results
      }
    });
    
  } catch (error) {
    console.error('❌ Errore test tutte le camere:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante il test delle camere',
      details: error.message
    });
  }
});

/**
 * POST /api/cameras/clear-cache
 * Svuota cache camere (per debug)
 */
router.post('/clear-cache', authenticate, async (req, res) => {
  try {
    enhancedCameraService.clearCache();
    
    res.json({
      success: true,
      message: 'Cache camere svuotata',
      timestamp: new Date()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Errore svuotamento cache',
      details: error.message
    });
  }
});

module.exports = router;