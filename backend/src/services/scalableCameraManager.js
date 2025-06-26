// backend/src/services/scalableCameraManager.js
// Sistema ottimizzato per gestire decine di telecamere in parallelo

const axios = require('axios');
const EventEmitter = require('events');
const { Classroom } = require('../models');

class ScalableCameraManager extends EventEmitter {
  constructor() {
    super();
    
    // Configurazione scalabilità
    this.maxConcurrentCaptures = 10; // Max scatti simultanei
    this.connectionPool = new Map(); // Pool connessioni per IP
    this.captureQueue = []; // Coda scatti in attesa
    this.activeCapturesCount = 0;
    
    // Cache avanzata
    this.cameraConfigCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minuti
    
    // Health monitoring
    this.healthStats = new Map();
    this.healthCheckInterval = 30000; // 30 secondi
    
    // Performance tracking
    this.performanceMetrics = {
      totalCaptures: 0,
      successfulCaptures: 0,
      failedCaptures: 0,
      averageResponseTime: 0,
      responseTimes: []
    };
    
    // Avvia monitoring
    this.startHealthMonitoring();
    this.startMetricsCleanup();
    
    console.log('🚀 Scalable Camera Manager inizializzato');
  }

  /**
   * Cattura immagini da multiple telecamere in parallelo
   */
  async captureMultiple(classroomIds, options = {}) {
    const startTime = Date.now();
    
    console.log(`📸 Richiesta scatto multiplo: ${classroomIds.length} telecamere`);
    
    const {
      maxConcurrent = this.maxConcurrentCaptures,
      timeout = 15000,
      retryFailed = true
    } = options;
    
    // Prepara batch con priorità
    const batches = this.createBatches(classroomIds, maxConcurrent);
    const results = [];
    
    for (const batch of batches) {
      console.log(`⚡ Elaborazione batch di ${batch.length} telecamere...`);
      
      const batchPromises = batch.map(async (classroomId) => {
        try {
          const result = await this.captureWithQueue(classroomId, timeout);
          return { classroomId, ...result };
        } catch (error) {
          return {
            classroomId,
            success: false,
            error: error.message,
            timestamp: new Date()
          };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            classroomId: 'unknown',
            success: false,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
      
      // Pausa tra batch per non sovraccaricare la rete
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.sleep(500);
      }
    }
    
    // Retry per telecamere fallite
    if (retryFailed) {
      const failedIds = results
        .filter(r => !r.success)
        .map(r => r.classroomId)
        .filter(id => id !== 'unknown');
      
      if (failedIds.length > 0) {
        console.log(`🔄 Retry ${failedIds.length} telecamere fallite...`);
        
        for (const classroomId of failedIds) {
          try {
            const retryResult = await this.captureWithQueue(classroomId, timeout);
            
            // Aggiorna risultato se retry riuscito
            const originalIndex = results.findIndex(r => r.classroomId === classroomId);
            if (originalIndex !== -1 && retryResult.success) {
              results[originalIndex] = { classroomId, ...retryResult };
            }
          } catch (error) {
            // Retry fallito, mantieni errore originale
          }
        }
      }
    }
    
    // Statistiche finali
    const totalTime = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    console.log(`📊 Scatto multiplo completato in ${totalTime}ms:`);
    console.log(`   ✅ Riusciti: ${successful}/${results.length}`);
    console.log(`   ❌ Falliti: ${failed}/${results.length}`);
    console.log(`   📈 Success rate: ${Math.round((successful / results.length) * 100)}%`);
    
    // Aggiorna metriche globali
    this.updateGlobalMetrics(results, totalTime);
    
    // Emetti evento per monitoring
    this.emit('multipleCapture', {
      total: results.length,
      successful,
      failed,
      duration: totalTime,
      results
    });
    
    return {
      success: successful > 0,
      summary: {
        total: results.length,
        successful,
        failed,
        successRate: Math.round((successful / results.length) * 100),
        totalTime: `${totalTime}ms`,
        averageTime: `${Math.round(totalTime / results.length)}ms`
      },
      results
    };
  }

  /**
   * Cattura con sistema di coda per gestire concorrenza
   */
  async captureWithQueue(classroomId, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        classroomId,
        timeout,
        resolve,
        reject,
        queuedAt: Date.now()
      };
      
      this.captureQueue.push(queueItem);
      this.processQueue();
    });
  }

  /**
   * Elabora coda scatti
   */
  async processQueue() {
    // Non elaborare se siamo al limite di concorrenza
    if (this.activeCapturesCount >= this.maxConcurrentCaptures || this.captureQueue.length === 0) {
      return;
    }
    
    const queueItem = this.captureQueue.shift();
    this.activeCapturesCount++;
    
    try {
      const result = await this.captureSingle(queueItem.classroomId, queueItem.timeout);
      queueItem.resolve(result);
    } catch (error) {
      queueItem.reject(error);
    } finally {
      this.activeCapturesCount--;
      
      // Elabora prossimo item in coda
      if (this.captureQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  /**
   * Cattura singola con ottimizzazioni
   */
  async captureSingle(classroomId, timeout = 15000) {
    const startTime = Date.now();
    
    try {
      // 1. Ottieni configurazione camera (con cache)
      const cameraConfig = await this.getCachedCameraConfig(classroomId);
      
      // 2. Verifica health status
      const health = this.getHealthStatus(cameraConfig.ip);
      if (health && health.consecutiveFailures > 5) {
        throw new Error(`Camera ${cameraConfig.ip} temporarily disabled (health check)`);
      }
      
      // 3. Ottieni connessione dal pool
      const connection = this.getPooledConnection(cameraConfig.ip);
      
      // 4. Esegui scatto con connection pooling
      const result = await this.captureWithConnection(connection, cameraConfig, timeout);
      
      // 5. Aggiorna health stats
      this.updateHealthStats(cameraConfig.ip, true, Date.now() - startTime);
      
      // 6. Aggiorna cache preferenze
      if (result.success) {
        await this.updatePreferredMethod(classroomId, result.metadata.method);
      }
      
      return result;
      
    } catch (error) {
      // Aggiorna health stats per errore
      const cameraConfig = await this.getCachedCameraConfig(classroomId);
      this.updateHealthStats(cameraConfig.ip, false, Date.now() - startTime);
      
      throw error;
    }
  }

  /**
   * Configurazione camera con cache avanzata
   */
  async getCachedCameraConfig(classroomId) {
    const cacheKey = `config_${classroomId}`;
    
    if (this.cameraConfigCache.has(cacheKey)) {
      const cached = this.cameraConfigCache.get(cacheKey);
      const age = Date.now() - cached.timestamp;
      
      if (age < this.cacheTimeout) {
        return cached.config;
      }
    }
    
    // Carica dal database
    const classroom = await Classroom.findByPk(classroomId);
    if (!classroom || !classroom.camera_ip) {
      throw new Error(`Camera non configurata per aula ${classroomId}`);
    }
    
    const config = {
      id: classroomId,
      ip: classroom.camera_ip,
      username: classroom.camera_username || 'admin',
      password: classroom.camera_password || 'admin123',
      model: classroom.camera_model || 'Unknown',
      preferredMethod: classroom.camera_preferred_method,
      capabilities: classroom.camera_capabilities || {}
    };
    
    // Salva in cache
    this.cameraConfigCache.set(cacheKey, {
      config,
      timestamp: Date.now()
    });
    
    return config;
  }

  /**
   * Connection pooling per riutilizzare connessioni HTTP
   */
  getPooledConnection(ip) {
    if (!this.connectionPool.has(ip)) {
      const agent = new (require('http').Agent)({
        keepAlive: true,
        maxSockets: 3, // Max 3 connessioni per IP
        maxFreeSockets: 1,
        timeout: 15000
      });
      
      this.connectionPool.set(ip, {
        agent,
        lastUsed: Date.now(),
        totalRequests: 0
      });
    }
    
    const connection = this.connectionPool.get(ip);
    connection.lastUsed = Date.now();
    connection.totalRequests++;
    
    return connection;
  }

  /**
   * Scatto con connection pooling
   */
  async captureWithConnection(connection, cameraConfig, timeout) {
    const endpoints = [
      { path: '/tmpfs/snap.jpg', name: 'imou_standard' },
      { path: '/cgi-bin/snapshot.cgi', name: 'cgi_standard' },
      { path: '/onvif/snapshot', name: 'onvif' },
      { path: '/snapshot.jpg', name: 'generic' }
    ];
    
    // Prova prima metodo preferito se disponibile
    if (cameraConfig.preferredMethod) {
      const preferredEndpoint = endpoints.find(e => e.name === cameraConfig.preferredMethod);
      if (preferredEndpoint) {
        endpoints.unshift(preferredEndpoint);
      }
    }
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios({
          method: 'GET',
          url: `http://${cameraConfig.ip}${endpoint.path}`,
          auth: {
            username: cameraConfig.username,
            password: cameraConfig.password
          },
          responseType: 'arraybuffer',
          timeout: timeout,
          httpAgent: connection.agent,
          headers: {
            'User-Agent': 'AttendanceSystem/2.0 Scalable',
            'Accept': 'image/jpeg,image/*,*/*',
            'Connection': 'keep-alive'
          }
        });
        
        if (response.status === 200 && response.data.length > 1000) {
          const buffer = Buffer.from(response.data);
          
          if (this.isValidJPEG(buffer)) {
            return {
              success: true,
              imageData: buffer,
              metadata: {
                cameraIP: cameraConfig.ip,
                method: endpoint.name,
                timestamp: new Date(),
                fileSize: buffer.length,
                resolution: this.detectImageResolution(buffer)
              }
            };
          }
        }
        
      } catch (error) {
        // Prova prossimo endpoint
        continue;
      }
    }
    
    throw new Error('Nessun endpoint funzionante');
  }

  /**
   * Health monitoring automatico
   */
  startHealthMonitoring() {
    setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        console.error('Errore health monitoring:', error);
      }
    }, this.healthCheckInterval);
  }

  async performHealthChecks() {
    const classrooms = await Classroom.findAll({
      where: {
        camera_ip: { [require('sequelize').Op.ne]: null },
        camera_status: { [require('sequelize').Op.notIn]: ['disabled', 'unknown'] }
      }
    });
    
    console.log(`🏥 Health check di ${classrooms.length} telecamere...`);
    
    const healthPromises = classrooms.map(async (classroom) => {
      try {
        const startTime = Date.now();
        
        const response = await axios({
          method: 'GET',
          url: `http://${classroom.camera_ip}/`,
          timeout: 5000,
          validateStatus: () => true
        });
        
        const responseTime = Date.now() - startTime;
        const isHealthy = response.status < 500;
        
        this.updateHealthStats(classroom.camera_ip, isHealthy, responseTime);
        
        // Aggiorna status nel database se necessario
        const newStatus = isHealthy ? 'online' : 'offline';
        if (classroom.camera_status !== newStatus) {
          await classroom.update({
            camera_status: newStatus,
            camera_last_check: new Date()
          });
        }
        
      } catch (error) {
        this.updateHealthStats(classroom.camera_ip, false, 5000);
        
        await classroom.update({
          camera_status: 'error',
          camera_last_check: new Date()
        });
      }
    });
    
    await Promise.allSettled(healthPromises);
  }

  /**
   * Aggiorna statistiche health per IP
   */
  updateHealthStats(ip, success, responseTime) {
    if (!this.healthStats.has(ip)) {
      this.healthStats.set(ip, {
        consecutiveFailures: 0,
        totalRequests: 0,
        successfulRequests: 0,
        averageResponseTime: 0,
        lastCheck: new Date(),
        status: 'unknown'
      });
    }
    
    const stats = this.healthStats.get(ip);
    
    stats.totalRequests++;
    stats.lastCheck = new Date();
    
    if (success) {
      stats.consecutiveFailures = 0;
      stats.successfulRequests++;
      stats.status = 'healthy';
    } else {
      stats.consecutiveFailures++;
      stats.status = stats.consecutiveFailures > 3 ? 'unhealthy' : 'degraded';
    }
    
    // Aggiorna tempo risposta medio
    const totalResponseTime = (stats.averageResponseTime * (stats.totalRequests - 1)) + responseTime;
    stats.averageResponseTime = Math.round(totalResponseTime / stats.totalRequests);
    
    this.healthStats.set(ip, stats);
  }

  getHealthStatus(ip) {
    return this.healthStats.get(ip) || null;
  }

  /**
   * Crea batch ottimizzati per elaborazione parallela
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Pulizia metriche e connessioni
   */
  startMetricsCleanup() {
    setInterval(() => {
      this.cleanupConnectionPool();
      this.cleanupMetrics();
    }, 10 * 60 * 1000); // Ogni 10 minuti
  }

  cleanupConnectionPool() {
    const now = Date.now();
    const maxIdleTime = 5 * 60 * 1000; // 5 minuti
    
    for (const [ip, connection] of this.connectionPool) {
      if (now - connection.lastUsed > maxIdleTime) {
        connection.agent.destroy();
        this.connectionPool.delete(ip);
        console.log(`🧹 Connection pool cleanup: ${ip}`);
      }
    }
  }

  cleanupMetrics() {
    // Mantieni solo ultimi 1000 response times per calcolo media
    if (this.performanceMetrics.responseTimes.length > 1000) {
      this.performanceMetrics.responseTimes = this.performanceMetrics.responseTimes.slice(-1000);
    }
  }

  /**
   * Aggiorna metriche globali performance
   */
  updateGlobalMetrics(results, totalTime) {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    this.performanceMetrics.totalCaptures += results.length;
    this.performanceMetrics.successfulCaptures += successful;
    this.performanceMetrics.failedCaptures += failed;
    
    // Aggiorna tempo medio
    this.performanceMetrics.responseTimes.push(totalTime);
    
    const avgTime = this.performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / 
                   this.performanceMetrics.responseTimes.length;
    this.performanceMetrics.averageResponseTime = Math.round(avgTime);
  }

  /**
   * Utility methods
   */
  isValidJPEG(buffer) {
    return buffer && buffer.length > 10 && 
           buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }

  detectImageResolution(buffer) {
    const sizeKB = buffer.length / 1024;
    if (sizeKB > 2000) return '1920x1080';
    if (sizeKB > 1000) return '1280x720';
    if (sizeKB > 500) return '640x480';
    return 'Unknown';
  }

  async updatePreferredMethod(classroomId, method) {
    try {
      await Classroom.update({
        camera_preferred_method: method,
        camera_last_success: new Date()
      }, {
        where: { id: classroomId }
      });
    } catch (error) {
      // Ignora errori di aggiornamento preferenze
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * API per ottenere statistiche complete
   */
  getSystemStats() {
    const healthSummary = {};
    let totalCameras = 0;
    let healthyCameras = 0;
    
    for (const [ip, stats] of this.healthStats) {
      totalCameras++;
      if (stats.status === 'healthy') healthyCameras++;
      
      healthSummary[ip] = {
        status: stats.status,
        successRate: Math.round((stats.successfulRequests / stats.totalRequests) * 100),
        avgResponseTime: stats.averageResponseTime,
        consecutiveFailures: stats.consecutiveFailures
      };
    }
    
    return {
      performance: this.performanceMetrics,
      health: {
        totalCameras,
        healthyCameras,
        healthRate: Math.round((healthyCameras / totalCameras) * 100),
        cameraDetails: healthSummary
      },
      system: {
        activeCapturesCount: this.activeCapturesCount,
        queueLength: this.captureQueue.length,
        maxConcurrent: this.maxConcurrentCaptures,
        connectionPoolSize: this.connectionPool.size
      }
    };
  }
}

module.exports = new ScalableCameraManager();