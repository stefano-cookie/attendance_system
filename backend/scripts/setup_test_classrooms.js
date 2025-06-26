// backend/scripts/setup_test_classrooms.js
const { Classroom, Course, Subject, Lesson } = require('../src/models');

async function setupTestClassrooms() {
  console.log('🏫 Configurazione aule di test...');

  try {
    // 1. Crea/trova corso di test
    const [course] = await Course.findOrCreate({
      where: { name: 'Test Camera Course' },
      defaults: {
        name: 'Test Camera Course',
        description: 'Corso per test sistema camere IP',
        color: '#4a90e2'
      }
    });

    // 2. Crea/trova materia di test
    const [subject] = await Subject.findOrCreate({
      where: { 
        name: 'Test Camera Subject',
        course_id: course.id 
      },
      defaults: {
        name: 'Test Camera Subject',
        description: 'Materia per test riconoscimento facciale',
        course_id: course.id
      }
    });

    // 3. Aule di test con configurazioni diverse
    const testClassrooms = [
      {
        name: 'Aula Simulatore',
        capacity: 30,
        location: 'Piano Terra - Ala Est',
        camera_ip: '127.0.0.1:8080',
        camera_username: 'admin',
        camera_password: 'admin123',
        camera_model: 'Camera IP Simulator',
        camera_status: 'unknown',
        camera_capabilities: {
          onvif: true,
          snapshot: true,
          multipleEndpoints: true,
          simulator: true
        },
        is_active: true
      },
      {
        name: 'Aula Magna',
        capacity: 100,
        location: 'Piano Terra - Centro',
        camera_ip: null, // Nessuna camera configurata
        camera_status: 'unknown',
        is_active: true
      },
      {
        name: 'Laboratorio Informatica',
        capacity: 25,
        location: 'Primo Piano - Ala Ovest',
        camera_ip: null, // Configurabile in futuro
        camera_status: 'unknown',
        is_active: true
      },
      {
        name: 'Aula Camera Reale',
        capacity: 50,
        location: 'Primo Piano - Ala Est',
        camera_ip: null, // Sarà configurata con camera vera
        camera_username: 'admin',
        camera_password: 'admin123',
        camera_model: 'To Be Configured',
        camera_status: 'unknown',
        is_active: true
      }
    ];

    console.log('📝 Creazione aule...');
    const createdClassrooms = [];

    for (const classroomData of testClassrooms) {
      const [classroom, created] = await Classroom.findOrCreate({
        where: { name: classroomData.name },
        defaults: classroomData
      });

      createdClassrooms.push(classroom);

      const status = created ? '✅ Creata' : '🔄 Esistente';
      const cameraInfo = classroom.camera_ip ? `📷 ${classroom.camera_ip}` : '❌ No camera';
      
      console.log(`${status}: ${classroom.name} - ${cameraInfo}`);
    }

    // 4. Crea lezione di test per aula simulatore
    const simulatorClassroom = createdClassrooms.find(c => c.name === 'Aula Simulatore');
    
    if (simulatorClassroom) {
      const [lesson] = await Lesson.findOrCreate({
        where: { 
          name: 'Test Camera Lesson',
          classroom_id: simulatorClassroom.id 
        },
        defaults: {
          name: 'Test Camera Lesson',
          lesson_date: new Date(),
          classroom_id: simulatorClassroom.id,
          course_id: course.id,
          subject_id: subject.id
        }
      });

      console.log(`✅ Lezione test: ${lesson.name} (Aula: ${simulatorClassroom.name})`);
    }

    // 5. Riepilogo configurazione
    console.log('\n📊 RIEPILOGO AULE:');
    console.log('='.repeat(50));

    for (const classroom of createdClassrooms) {
      console.log(`🏫 ${classroom.name}`);
      console.log(`   📍 Posizione: ${classroom.location}`);
      console.log(`   👥 Capacità: ${classroom.capacity} persone`);
      
      if (classroom.camera_ip) {
        console.log(`   📷 Camera: ${classroom.camera_ip}`);
        console.log(`   🔐 Auth: ${classroom.camera_username}/***/`);
        console.log(`   📱 Modello: ${classroom.camera_model}`);
        console.log(`   🟡 Status: ${classroom.camera_status}`);
      } else {
        console.log(`   📷 Camera: Non configurata`);
      }
      console.log('');
    }

    console.log('✅ Setup aule completato!');
    console.log('\n🎯 PROSSIMI PASSI:');
    console.log('1. Testa simulatore: node scripts/setup_camera_system.js setup');
    console.log('2. Avvia backend: npm start');
    console.log('3. Configura camera reale quando disponibile');

    return {
      course,
      subject,
      classrooms: createdClassrooms
    };

  } catch (error) {
    console.error('❌ Errore setup aule:', error);
    throw error;
  }
}

// CLI Usage
if (require.main === module) {
  setupTestClassrooms()
    .then(() => {
      console.log('\n🎉 Setup completato con successo!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Errore:', error.message);
      process.exit(1);
    });
}

module.exports = { setupTestClassrooms };