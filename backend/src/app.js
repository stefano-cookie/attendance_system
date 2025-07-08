// backend/src/app.js - VERSIONE CORRETTA CON TUTTE LE ROUTES
const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Configurazione
dotenv.config();

// Importa i modelli
const db = require(path.join(__dirname, 'models/index'));

// Servizi
const fileAnalysisService = require('./services/fileAnalysisService');
const lessonScheduler = require('./services/lessonSchedulerService');

// ========================================
// IMPORTA TUTTE LE ROUTES (COMPLETE!)
// ========================================
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const userCoursesRoutes = require('./routes/userCoursesRoutes'); // ← AGGIUNTO!
const adminRoutes = require('./routes/adminRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const studentSubjectRoutes = require('./routes/studentSubjectRoutes');
const classroomRoutes = require('./routes/classroomRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const screenshotRoutes = require('./routes/screenshotRoutes');
const cameraRoutes = require('./routes/cameraRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const imageRoutes = require('./routes/imageRoutes');
const cameraDiscoveryRoutes = require('./routes/cameraDiscoveryRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware di logging per debug
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length) {
    console.log('Body:', JSON.stringify(req.body));
  }
  next();
});

// ========================================
// REGISTRA TUTTE LE ROUTES (CORRETTE!)
// ========================================
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/users', userCoursesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/student-subjects', studentSubjectRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/screenshots', screenshotRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/cameras', cameraDiscoveryRoutes);

// Static files (mantieni per retrocompatibilità)
app.use('/static/screenshots', express.static(path.join(__dirname, '../../data/reports')));
app.use('/static/photos', express.static(path.join(__dirname, '../../data/user_photos')));

// Gestione errori
app.use((err, req, res, next) => {
  console.error('Errore:', err);
  res.status(500).json({ message: 'Errore interno del server' });
});

// Usa la porta 4321 che sappiamo funzionare
const PORT = process.env.PORT || 4321;
app.listen(PORT, () => {
  console.log(`Server in esecuzione sulla porta ${PORT}`);
  console.log('📋 Route disponibili:');
  console.log('  🔐 AUTH        /api/auth/*           - Autenticazione');
  console.log('  👥 USERS       /api/users/*          - Gestione utenti');
  console.log('  📚 COURSES     /api/users/courses    - ← FIX APPLICATO!');
  console.log('  📖 LESSONS     /api/lessons/*        - Gestione lezioni');
  console.log('  🏫 CLASSROOMS  /api/classrooms/*     - Gestione aule');
  console.log('  📝 SUBJECTS    /api/subjects/*       - Gestione materie');
  console.log('  📊 ATTENDANCE  /api/attendance/*     - Gestione presenze');
  console.log('  📷 SCREENSHOTS /api/screenshots/*    - ← FIX PATH!');
  console.log('  📸 IMAGES      /api/images/*         - Servizio immagini BLOB');
  console.log('  🏫 CAMERAS     /api/cameras/*        - Gestione camere IP');
  console.log('  👨‍🏫 TEACHER     /api/teacher/*        - Dashboard docenti');
  console.log('');
  console.log('🆕 ENDPOINT BLOB ATTIVI:');
  console.log('  GET /api/images/screenshot/:id       - Serve screenshot da BLOB');
  console.log('  GET /api/images/lesson/:id           - Serve immagine lezione da BLOB');
  console.log('  GET /api/users/courses               - ← RISOLTO 404!');
});

// Connessione Database
db.sequelize.authenticate()
.then(() => {
  console.log('✅ Connesso al database PostgreSQL');
  return db.sequelize.sync({ alter: false }); 
})
.then(() => {
  console.log('✅ Database sincronizzato');
  
  // Start lesson scheduler service
  lessonScheduler.start();
  
  console.log('🚀 Sistema BLOB pronto al 100%! 🎉');
  console.log('⏰ Lesson scheduler attivo per auto-completamento lezioni');
  console.log('');
  console.log('💡 ROUTES CORRETTE:');
  console.log('  ✅ /api/users/courses → userCoursesRoutes.js');
  console.log('  ✅ /api/screenshots → screenshotRoutes.js'); 
  console.log('  ✅ /api/admin/screenshots → adminRoutes.js');
})
.catch((err) => console.error('❌ Errore connessione PostgreSQL:', err));

module.exports = app;