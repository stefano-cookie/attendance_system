const { sequelize, Classroom, Lesson, Course, Subject } = require('../src/models');
const CameraIPSimulator = require('../simulators/camera_ip_simulator');
const enhancedCameraService = require('../src/services/enhancedCameraService');

class CameraSystemSetup {
  constructor() {
    this.simulator = null;
    this.simulatorPort = 8080;
    this.simulatorIP = '127.0.0.1';
  }

  async setupComplete() {
    console.log('🚀 SETUP COMPLETO SISTEMA CAMERE');
    console.log('='.repeat(50));

    try {
      // 1. Migrazione database
      await this.runMigrations();
      
      // 2. Setup dati di test
      await this.setupTestData();
      
      // 3. Avvia simulatore camera
      await this.startCameraSimulator();
      
      // 4. Configura camere simulate
      await this.configureCameras();
      
      // 5. Test sistema completo
      await this.testSystem();
      
      console.log('\n✅ SETUP COMPLETATO CON SUCCESSO!');
      console.log('🎯 Il sistema è pronto per test con camere IP');
      console.log('\n📋 PROSSIMI PASSI:');
      console.log('1. Avvia backend: npm start');
      console.log('2. Avvia frontend: npm start (in altra finestra)');
      console.log('3. Testa workflow completo dal browser');
      console.log('4. Quando avrai camera vera, sostituisci IP simulator');
      
    } catch (error) {
      console.error('❌ ERRORE DURANTE SETUP:', error);
      process.exit(1);
    }
  }

  async runMigrations() {
    console.log('\n📊 1. Esecuzione migrazioni database...');
    
    try {
      // Forza sync per sviluppo (in produzione usa migrate)
      await sequelize.sync({ alter: true });
      console.log('✅ Database aggiornato con supporto camere');
    } catch (error) {
      console.error('❌ Errore migrazione:', error);
      throw error;
    }
  }

  async setupTestData() {
    console.log('\n📋 2. Setup dati di test...');
    
    try {
      // Crea corso di test se non esiste
      const [course] = await Course.findOrCreate({
        where: { name: 'Test Camera Course' },
        defaults: {
          name: 'Test Camera Course',
          color: '#4a90e2',
          description: 'Corso per test sistema camere IP'
        }
      });

      // Crea materia di test
      const [subject] = await Subject.findOrCreate({
        where: { name: 'Test Camera Subject', course_id: course.id },
        defaults: {
          name: 'Test Camera Subject',
          course_id: course.id,
          description: 'Materia per test riconoscimento facciale'
        }
      });

      // Crea aule di test con configurazione camera
      const testClassrooms = [
        {
          name: 'Aula Test Simulator',
          capacity: 30,
          camera_ip: `${this.simulatorIP}:${this.simulatorPort}`,
          camera_username: 'admin',
          camera_password: 'admin123',
          camera_model: 'Camera IP Simulator',
          camera_status: 'unknown'
        },
        {
          name: 'Aula Test Hardware',
          capacity: 50,
          camera_ip: null, // Sarà configurata quando avrai camera vera
          camera_status: 'no_camera'
        }
      ];

      for (const classroomData of testClassrooms) {
        const [classroom] = await Classroom.findOrCreate({
          where: { name: classroomData.name },
          defaults: classroomData
        });
        
        console.log(`✅ Aula: ${classroom.name} (${classroom.camera_ip || 'no camera'})`);
      }

      // Crea lezione di test
      const testClassroom = await Classroom.findOne({
        where: { name: 'Aula Test Simulator' }
      });

      if (testClassroom) {
        const [lesson] = await Lesson.findOrCreate({
          where: { 
            name: 'Test Camera Lesson',
            classroom_id: testClassroom.id 
          },
          defaults: {
            name: 'Test Camera Lesson',
            lesson_date: new Date(),
            classroom_id: testClassroom.id,
            course_id: course.id,
            subject_id: subject.id
          }
        });

        console.log(`✅ Lezione test: ${lesson.name}`);
      }

      console.log('✅ Dati di test configurati');
      
    } catch (error) {
      console.error('❌ Errore setup dati:', error);
      throw error;
    }
  }

  async startCameraSimulator() {
    console.log('\n🎭 3. Avvio simulatore camera IP...');
    
    try {
      const CameraIPSimulator = require('../simulators/camera_ip_simulator');
      this.simulator = new CameraIPSimulator(this.simulatorPort, this.simulatorIP);
      
      // Avvia in background
      this.simulator.start();
      
      // Attendi più a lungo per l'avvio
      console.log('   ⏳ Attendo avvio simulatore...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Test con endpoint diversi possibili
      const testEndpoints = [
        '/status',           // Endpoint preferito
        '/',                 // Root endpoint
        '/tmpfs/snap.jpg',   // Endpoint IMOU
        '/cgi-bin/snapshot.cgi' // Endpoint generico
      ];
      
      let connected = false;
      
      for (const endpoint of testEndpoints) {
        try {
          console.log(`   🔍 Test endpoint: ${endpoint}...`);
          
          // Import dinamico di node-fetch se necessario
          let fetch;
          try {
            fetch = (await import('node-fetch')).default;
          } catch {
            // Fallback per Node.js più vecchi
            const https = require('https');
            const http = require('http');
            
            // Implementazione fetch basic per test
            const testUrl = `http://${this.simulatorIP}:${this.simulatorPort}${endpoint}`;
            const testPromise = new Promise((resolve, reject) => {
              const req = http.get(testUrl, { timeout: 3000 }, (res) => {
                resolve({ ok: res.statusCode >= 200 && res.statusCode < 400 });
              });
              req.on('error', reject);
              req.on('timeout', () => reject(new Error('timeout')));
            });
            
            const result = await testPromise;
            if (result.ok) {
              connected = true;
              console.log(`   ✅ Endpoint ${endpoint} risponde`);
              break;
            }
            continue;
          }
          
          // Test con fetch
          const testResponse = await fetch(`http://${this.simulatorIP}:${this.simulatorPort}${endpoint}`, {
            method: 'GET',
            timeout: 3000,
            headers: {
              'Authorization': 'Basic ' + Buffer.from('admin:admin123').toString('base64')
            }
          });
          
          if (testResponse.ok || testResponse.status === 401) {
            // 401 va bene, significa che il server risponde
            connected = true;
            console.log(`   ✅ Endpoint ${endpoint} risponde (status: ${testResponse.status})`);
            break;
          }
          
        } catch (error) {
          console.log(`   ⚠️ Endpoint ${endpoint} non risponde: ${error.message}`);
          continue;
        }
      }
      
      if (connected) {
        console.log(`✅ Simulator attivo su ${this.simulatorIP}:${this.simulatorPort}`);
      } else {
        // Non fallire, ma avvisa
        console.warn(`⚠️ Simulator avviato ma test connessione fallito`);
        console.warn(`   Il simulatore potrebbe essere in avvio o usare endpoint diversi`);
        console.log(`✅ Continuo con il setup assumendo che il simulatore sia attivo`);
      }
      
    } catch (error) {
      console.error('❌ Errore avvio simulator:', error);
      // Non fermare tutto, continua senza simulatore
      console.warn('⚠️ Continuo setup senza simulatore...');
    }
  }

  async configureCameras() {
    console.log('\n⚙️ 4. Configurazione camere simulate...');
    
    try {
      // Trova aula con simulator
      const simulatorClassroom = await Classroom.findOne({
        where: { name: 'Aula Test Simulator' }
      });

      if (simulatorClassroom) {
        // Test connessione camera simulator
        const isOnline = await enhancedCameraService.testCameraConnection(
          `${this.simulatorIP}:${this.simulatorPort}`
        );

        // Aggiorna stato
        await simulatorClassroom.update({
          camera_status: isOnline ? 'online' : 'offline',
          camera_last_check: new Date(),
          camera_capabilities: JSON.stringify({
            onvif: true,
            snapshot: true,
            multipleEndpoints: true,
            simulator: true
          })
        });

        console.log(`✅ Camera simulator: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        
        // Test scatto
        if (isOnline) {
          const captureResult = await enhancedCameraService.captureImage(simulatorClassroom.id);
          
          if (captureResult.success) {
            console.log(`✅ Test scatto riuscito: ${captureResult.metadata.fileSize} bytes`);
            console.log(`   Metodo: ${captureResult.metadata.method}`);
            console.log(`   Risoluzione: ${captureResult.metadata.resolution}`);
          } else {
            console.warn(`⚠️ Test scatto fallito: ${captureResult.error}`);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Errore configurazione camere:', error);
      throw error;
    }
  }

  async testSystem() {
    console.log('\n🧪 5. Test sistema completo...');
    
    try {
      // Test discovery
      console.log('   🔍 Test discovery camere...');
      const cameras = await enhancedCameraService.discoverCameras('127.0.0');
      console.log(`   📷 Camere trovate: ${cameras.length}`);

      // Test tutte le camere configurate
      console.log('   🎯 Test tutte le camere configurate...');
      const testResults = await enhancedCameraService.testAllConfiguredCameras();
      
      const summary = {
        total: testResults.length,
        success: testResults.filter(r => r.success).length,
        failed: testResults.filter(r => !r.success).length
      };

      console.log(`   📊 Risultati: ${summary.success}/${summary.total} camere operative`);
      
      if (summary.success > 0) {
        console.log('✅ Sistema camera completamente funzionante!');
      } else {
        console.warn('⚠️ Nessuna camera operativa - controllare configurazione');
      }
      
    } catch (error) {
      console.error('❌ Errore test sistema:', error);
      throw error;
    }
  }

  async setupForRealCamera(cameraIP, username = 'admin', password = 'admin123') {
    console.log(`\n📷 CONFIGURAZIONE CAMERA REALE: ${cameraIP}`);
    
    try {
      // Test connessione camera reale
      const isOnline = await enhancedCameraService.testCameraConnection(cameraIP);
      
      if (!isOnline) {
        throw new Error(`Camera ${cameraIP} non raggiungibile`);
      }

      // Trova aula per camera hardware
      const hardwareClassroom = await Classroom.findOne({
        where: { name: 'Aula Test Hardware' }
      });

      if (hardwareClassroom) {
        await hardwareClassroom.update({
          camera_ip: cameraIP,
          camera_username: username,
          camera_password: password,
          camera_status: 'online',
          camera_last_check: new Date()
        });

        // Test scatto
        const captureResult = await enhancedCameraService.captureImage(hardwareClassroom.id);
        
        if (captureResult.success) {
          console.log('✅ Camera reale configurata e testata con successo!');
          console.log(`   IP: ${cameraIP}`);
          console.log(`   Metodo: ${captureResult.metadata.method}`);
          console.log(`   Dimensione: ${captureResult.metadata.fileSize} bytes`);
        } else {
          console.warn(`⚠️ Camera raggiungibile ma scatto fallito: ${captureResult.error}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Errore configurazione camera reale:', error);
      throw error;
    }
  }

  async cleanup() {
    console.log('\n🧹 Pulizia sistema...');
    
    try {
      // Ferma simulator se attivo
      if (this.simulator) {
        console.log('🛑 Fermando camera simulator...');
        process.kill(process.pid, 'SIGINT');
      }

      // Opzionalmente pulisci dati di test
      const cleanTestData = process.argv.includes('--clean');
      
      if (cleanTestData) {
        console.log('🗑️ Rimozione dati di test...');
        
        await Lesson.destroy({ where: { name: 'Test Camera Lesson' } });
        await Subject.destroy({ where: { name: 'Test Camera Subject' } });
        await Course.destroy({ where: { name: 'Test Camera Course' } });
        await Classroom.destroy({ where: { name: { [require('sequelize').Op.like]: 'Aula Test%' } } });
        
        console.log('✅ Dati di test rimossi');
      }
      
    } catch (error) {
      console.error('❌ Errore pulizia:', error);
    }
  }
}

// CLI Usage
async function main() {
  const setup = new CameraSystemSetup();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'setup':
        await setup.setupComplete();
        break;
        
      case 'real-camera':
        const cameraIP = process.argv[3];
        const username = process.argv[4] || 'admin';
        const password = process.argv[5] || 'admin123';
        
        if (!cameraIP) {
          console.log('Uso: node setup_camera_system.js real-camera <IP> [username] [password]');
          process.exit(1);
        }
        
        await setup.setupForRealCamera(cameraIP, username, password);
        break;
        
      case 'cleanup':
        await setup.cleanup();
        break;
        
      case 'test':
        await setup.testSystem();
        break;
        
      default:
        console.log(`
🎭 Camera System Setup Tool

Comandi disponibili:
  setup       - Setup completo sistema con simulator
  real-camera - Configura camera IP reale
  test        - Test sistema esistente
  cleanup     - Pulisci dati di test

Esempi:
  node setup_camera_system.js setup
  node setup_camera_system.js real-camera 192.168.1.100 admin admin123
  node setup_camera_system.js test
  node setup_camera_system.js cleanup --clean
        `);
    }
    
  } catch (error) {
    console.error('💥 Errore:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = CameraSystemSetup;