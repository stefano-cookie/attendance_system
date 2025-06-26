const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { discoverCamerasOnNetwork } = require('../../scripts/camera_discovery');

const router = express.Router();

let discoveryCache = {
  isRunning: false,
  lastRun: null,
  results: null
};
router.post('/discover', authenticate, async (req, res) => {
  try {
    const { network, forceRefresh } = req.body;
    
    if (discoveryCache.isRunning) {
      return res.status(409).json({
        success: false,
        message: 'Discovery già in corso, attendere...',
        isRunning: true
      });
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (!forceRefresh && discoveryCache.lastRun && discoveryCache.lastRun > fiveMinutesAgo && discoveryCache.results) {
      console.log('📋 Uso risultati discovery dalla cache');
      return res.json({
        success: true,
        data: discoveryCache.results,
        fromCache: true,
        message: 'Risultati dalla cache (< 5 min)'
      });
    }

    console.log('🚀 Avvio discovery camere IP...');
    discoveryCache.isRunning = true;

    const results = await discoverCamerasOnNetwork(network);
    
    discoveryCache = {
      isRunning: false,
      lastRun: new Date(),
      results: results
    };

    console.log(`✅ Discovery completato: ${results.totalFound} camere trovate`);

    res.json({
      success: true,
      data: results,
      fromCache: false,
      message: `Discovery completato: ${results.totalFound} camere trovate`
    });

  } catch (error) {
    console.error('❌ Errore discovery camere:', error);
    discoveryCache.isRunning = false;
    
    res.status(500).json({
      success: false,
      message: 'Errore durante il discovery delle camere',
      error: error.message
    });
  }
});

router.get('/discover/status', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      isRunning: discoveryCache.isRunning,
      lastRun: discoveryCache.lastRun,
      hasResults: !!discoveryCache.results,
      totalFound: discoveryCache.results?.totalFound || 0
    }
  });
});

router.get('/discover/results', authenticate, (req, res) => {
  if (!discoveryCache.results) {
    return res.status(404).json({
      success: false,
      message: 'Nessun risultato disponibile. Esegui prima un discovery.'
    });
  }

  res.json({
    success: true,
    data: discoveryCache.results,
    fromCache: true
  });
});

router.post('/quick-add', authenticate, async (req, res) => {
  try {
    const { cameraData, classroomId } = req.body;
    
    if (!cameraData || !classroomId) {
      return res.status(400).json({
        success: false,
        message: 'cameraData e classroomId sono obbligatori'
      });
    }

    const newCamera = {
      name: cameraData.suggested_name || `Camera ${cameraData.ip}`,
      ip_address: cameraData.ip,
      port: cameraData.port || 80,
      username: cameraData.suggested_username || 'admin',
      classroom_id: classroomId,
      is_active: true,
      manufacturer: cameraData.manufacturer,
      model: cameraData.model,
      onvif_support: cameraData.onvifSupport,
      auth_required: cameraData.authRequired
    };

    const createResponse = await fetch('http://localhost:4321/api/cameras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization
      },
      body: JSON.stringify(newCamera)
    });

    if (!createResponse.ok) {
      throw new Error('Errore nella creazione della camera');
    }

    const createdCamera = await createResponse.json();

    res.status(201).json({
      success: true,
      data: createdCamera,
      message: 'Camera aggiunta con successo dal discovery'
    });

  } catch (error) {
    console.error('❌ Errore quick-add camera:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nell\'aggiunta rapida della camera',
      error: error.message
    });
  }
});

module.exports = router;