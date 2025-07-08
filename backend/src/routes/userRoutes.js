const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/authMiddleware');
const { User, Course } = require('../models');
const { sequelize } = require('../config/database');
const { QueryTypes, Op } = require('sequelize');

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Solo immagini JPG/PNG sono permesse'), false);
    }
    cb(null, true);
  }
});

// ===== PROFILO UTENTE =====

// GET /api/users/profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'surname', 'email', 'role', 'matricola', 'courseId', 'birth_date', 'is_active'],
      include: [{
        model: Course,
        as: 'course',
        attributes: ['id', 'name']
      }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    res.json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Errore caricamento profilo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel caricamento del profilo'
    });
  }
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, surname, email } = req.body;
    
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    await user.update({
      name: name || user.name,
      surname: surname || user.surname,
      email: email || user.email
    });

    res.json({
      success: true,
      message: 'Profilo aggiornato con successo',
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Errore aggiornamento profilo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento del profilo'
    });
  }
});

// ===== GESTIONE STUDENTI =====

// GET /api/users/students (lista studenti per admin)
router.get('/students', authenticate, async (req, res) => {
  try {
    console.log('📋 Caricamento lista studenti...');
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Non autorizzato'
      });
    }

    const { courseId } = req.query;
    
    let whereClause = { 
      role: 'student'
    };
    
    if (courseId) {
      whereClause.courseId = courseId;
    }

    const students = await User.findAll({
      where: whereClause,
      attributes: [
        'id', 'name', 'surname', 'email', 'matricola', 'courseId', 
        'is_active', 'createdAt', 'updatedAt',
        [sequelize.literal('CASE WHEN "photoPath" IS NOT NULL AND LENGTH("photoPath") > 0 THEN true ELSE false END'), 'hasPhoto']
      ],
      include: [{
        model: Course,
        as: 'course',
        attributes: ['id', 'name'],
        required: false
      }],
      order: [['surname', 'ASC'], ['name', 'ASC']]
    });

    console.log(`✅ Trovati ${students.length} studenti`);

    const studentsData = students.map(student => {
      const data = student.toJSON();
      
      data.hasPhoto = !!(student.dataValues.hasPhoto || (student.photoPath && student.photoPath.length > 0));
      
      return data;
    });

    res.json({
      success: true,
      students: studentsData
    });
    
  } catch (error) {
    console.error('❌ Errore caricamento studenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel caricamento degli studenti',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Errore del server'
    });
  }
});

// GET /api/users/students/:id (dettaglio studente)
router.get('/students/:id', authenticate, async (req, res) => {
  try {
    const studentId = req.params.id;
    
    if (req.user.role !== 'admin' && req.user.id !== parseInt(studentId)) {
      return res.status(403).json({
        success: false,
        error: 'Non autorizzato'
      });
    }

    const student = await User.findOne({
      where: {
        id: studentId,
        role: 'student'
      },
      attributes: [
        'id', 'name', 'surname', 'email', 'matricola', 'courseId', 
        'is_active', 'createdAt', 'updatedAt'
      ],
      include: [{
        model: Course,
        as: 'course',
        attributes: ['id', 'name'],
        required: false  // LEFT JOIN invece di INNER JOIN per gestire courseId NULL
      }]
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Studente non trovato'
      });
    }
    
    const hasPhoto = !!(student.photoPath && student.photoPath.length > 0);
    
    const responseData = {
      ...student.toJSON(),
      hasPhoto: hasPhoto
    };

    res.json(responseData);
  } catch (error) {
    console.error('Errore caricamento studente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel caricamento dello studente'
    });
  }
});

// POST /api/users/register-student (registrazione nuovo studente)
router.post('/register-student', authenticate, upload.single('photo'), async (req, res) => {
  console.log('🚀 POST /register-student - Richiesta ricevuta');
  console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'Non autenticato');
  console.log('📁 Body keys:', Object.keys(req.body));
  console.log('📎 File:', req.file ? 'presente' : 'mancante');
  
  try {
    console.log('📝 Registrazione nuovo studente...');
    
    if (!['admin', 'technician'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Non autorizzato a registrare studenti'
      });
    }

    const { name, surname, matricola, email, birthDate, courseId } = req.body;
    const photoFile = req.file;

    console.log('📋 Dati ricevuti:', { name, surname, matricola, email, courseId });
    console.log('📷 Foto ricevuta:', photoFile ? `${photoFile.originalname} (${photoFile.size} bytes)` : 'Nessuna');
    console.log('📝 Controllo campi obbligatori:');
    console.log(`   - name: "${name}" (${typeof name})`);
    console.log(`   - surname: "${surname}" (${typeof surname})`);
    console.log(`   - matricola: "${matricola}" (${typeof matricola})`);
    console.log(`   - email: "${email}" (${typeof email})`);
    console.log(`   - photoFile: ${photoFile ? 'presente' : 'mancante'}`);

    if (!name || !surname || !matricola || !email) {
      console.log('❌ Campi mancanti rilevati');
      return res.status(400).json({
        success: false,
        error: 'Nome, cognome, matricola ed email sono obbligatori',
        details: {
          name: !name ? 'mancante' : 'ok',
          surname: !surname ? 'mancante' : 'ok', 
          matricola: !matricola ? 'mancante' : 'ok',
          email: !email ? 'mancante' : 'ok'
        }
      });
    }

    if (!photoFile) {
      return res.status(400).json({
        success: false,
        error: 'La foto è obbligatoria per il riconoscimento facciale'
      });
    }

    const existingStudent = await User.findOne({
      where: { 
        matricola: matricola.trim()
      }
    });

    if (existingStudent) {
      console.log(`❌ Matricola ${matricola} già esistente per utente ID ${existingStudent.id}`);
      return res.status(400).json({
        success: false,
        error: 'Matricola già esistente',
        details: `Uno studente con matricola ${matricola} è già registrato`
      });
    }

    const existingEmail = await User.findOne({
      where: { email: email.trim().toLowerCase() }
    });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email già registrata'
      });
    }

    if (courseId) {
      const course = await Course.findByPk(courseId);
      if (!course) {
        return res.status(400).json({
          success: false,
          error: 'Corso non valido'
        });
      }
    }

    console.log('✅ Validazione completata, creazione studente...');

    const newStudent = await User.create({
      name: name.trim(),
      surname: surname.trim(),
      matricola: matricola.trim(),
      email: email.trim().toLowerCase(),
      courseId: courseId || null,
      role: 'student',
      password: 'student123',
      is_active: true,
      photoPath: photoFile.buffer
    });

    console.log(`✅ Studente creato con ID: ${newStudent.id}`);

    res.status(201).json({
      success: true,
      message: 'Studente registrato con successo',
      student: {
        id: newStudent.id,
        name: newStudent.name,
        surname: newStudent.surname,
        matricola: newStudent.matricola,
        email: newStudent.email,
        courseId: newStudent.courseId,
        hasPhoto: true,
        createdAt: newStudent.createdAt
      }
    });

    console.log('🎉 Registrazione studente completata!');

  } catch (error) {
    console.error('❌ Errore registrazione studente:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Dati non validi',
        details: error.errors.map(e => e.message)
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        error: 'Matricola o email già esistente'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Errore interno durante la registrazione',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Errore del server'
    });
  }
});

// PUT /api/users/students/:id (aggiorna studente)
router.put('/students/:id', authenticate, async (req, res) => {
  console.log(`🔄 PUT /students/${req.params.id} - Update studente`);
  console.log(`📋 Dati ricevuti:`, req.body);
  
  try {
    if (req.user.role !== 'admin') {
      console.log(`❌ Accesso negato: ruolo ${req.user.role}`);
      return res.status(403).json({
        success: false,
        error: 'Non autorizzato'
      });
    }

    const studentId = req.params.id;
    const { name, surname, email, matricola, courseId, is_active } = req.body;
    
    console.log(`🔍 Aggiornamento studente ID: ${studentId}`);

    const student = await User.findOne({
      where: { 
        id: studentId, 
        role: 'student'
      }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Studente non trovato'
      });
    }

    if (matricola && matricola !== student.matricola) {
      const existingMatricola = await User.findOne({
        where: { 
          matricola: matricola.trim(),
          id: { [Op.ne]: studentId }
        }
      });
      
      if (existingMatricola) {
        return res.status(400).json({
          success: false,
          error: 'Matricola già esistente'
        });
      }
    }

    if (email && email.toLowerCase() !== student.email.toLowerCase()) {
      const existingEmail = await User.findOne({
        where: { 
          email: email.trim().toLowerCase(),
          id: { [Op.ne]: studentId }
        }
      });
      
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email già registrata'
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (surname !== undefined) updateData.surname = surname.trim();
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (matricola !== undefined) updateData.matricola = matricola.trim();
    if (courseId !== undefined) updateData.courseId = courseId;
    if (is_active !== undefined) updateData.is_active = is_active;

    console.log(`💾 Dati da aggiornare:`, updateData);
    await student.update(updateData);
    
    // Ricarica lo studente per ottenere i dati aggiornati
    await student.reload();
    
    const updatedStudent = {
      id: student.id,
      name: student.name,
      surname: student.surname,
      email: student.email,
      matricola: student.matricola,
      courseId: student.courseId,
      is_active: student.is_active
    };
    
    console.log(`✅ Studente aggiornato:`, updatedStudent);

    res.json({
      success: true,
      message: 'Studente aggiornato con successo',
      student: updatedStudent
    });

  } catch (error) {
    console.error('Errore aggiornamento studente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento dello studente'
    });
  }
});

// DELETE /api/users/students/:id (elimina studente)
router.delete('/students/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Non autorizzato'
      });
    }

    const studentId = req.params.id;

    const student = await User.findOne({
      where: { 
        id: studentId, 
        role: 'student'
      }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Studente non trovato'
      });
    }

    // VERA eliminazione dal database
    await student.destroy();

    res.json({
      success: true,
      message: 'Studente eliminato definitivamente dal database'
    });

  } catch (error) {
    console.error('Errore eliminazione studente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione dello studente'
    });
  }
});

// ===== GESTIONE FOTO STUDENTI (BLOB) =====

// GET /api/users/students/:id/photo (recupera foto studente) - PUBLIC ACCESS
router.get('/students/:id/photo', async (req, res) => {
  try {
    const studentId = req.params.id;
    
    const student = await User.findOne({
      where: { id: studentId, role: 'student' },
      attributes: ['id', 'photoPath']
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Studente non trovato'
      });
    }

    if (!student.photoPath) {
      return res.status(404).json({
        success: false,
        error: 'Foto non disponibile'
      });
    }

    // Default values since these fields don't exist in the database
    const mimeType = 'image/jpeg';
    const filename = `student_${studentId}_photo.jpg`;

    res.set({
      'Content-Type': mimeType,
      'Content-Length': student.photoPath.length,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=86400'
    });

    res.send(student.photoPath);

  } catch (error) {
    console.error('Errore recupero foto studente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero della foto'
    });
  }
});

// POST /api/users/students/:id/photo (aggiorna foto studente)
router.post('/students/:id/photo', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Non autorizzato'
      });
    }

    const studentId = req.params.id;
    const photoFile = req.file;

    if (!photoFile) {
      return res.status(400).json({
        success: false,
        error: 'Nessun file foto fornito'
      });
    }

    const student = await User.findOne({
      where: { 
        id: studentId, 
        role: 'student'
      }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Studente non trovato'
      });
    }

    await student.update({
      photoPath: photoFile.buffer
    });

    res.json({
      success: true,
      message: 'Foto aggiornata con successo',
      photoInfo: {
        size: photoFile.size,
        mimeType: photoFile.mimetype,
        originalName: photoFile.originalname
      }
    });

  } catch (error) {
    console.error('Errore aggiornamento foto studente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento della foto'
    });
  }
});

// ===== GESTIONE DOCENTI =====

// GET /api/users/teachers (lista docenti per admin)
router.get('/teachers', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Non autorizzato'
      });
    }

    const teachers = await User.findAll({
      where: { role: 'teacher' },
      attributes: ['id', 'name', 'surname', 'email', 'is_active', 'createdAt'],
      order: [['surname', 'ASC'], ['name', 'ASC']]
    });

    res.json({
      success: true,
      teachers: teachers
    });
  } catch (error) {
    console.error('Errore caricamento docenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel caricamento dei docenti'
    });
  }
});

// ===== GESTIONE CORSI =====

// GET /api/users/courses (lista corsi)
router.get('/courses', authenticate, async (req, res) => {
  try {
    const courses = await Course.findAll({
      attributes: [
        'id', 'name', 'description', 'color', 'years', 
        'is_active', 'createdAt', 'updatedAt'
      ],
      where: { is_active: true },
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      courses: courses
    });
  } catch (error) {
    console.error('Errore caricamento corsi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel caricamento dei corsi'
    });
  }
});

// POST /api/users/courses (crea nuovo corso)
router.post('/courses', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Non autorizzato'
      });
    }

    const { 
      name, description, color, years, is_active 
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Il nome del corso è obbligatorio'
      });
    }

    // Verifica se esiste già un corso con lo stesso nome
    const existingCourse = await Course.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('name'))),
        sequelize.fn('LOWER', sequelize.fn('TRIM', name))
      )
    });

    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message: `Esiste già un corso con il nome "${name}"`,
        error: 'Duplicate course name'
      });
    }

    const newCourse = await Course.create({
      name: name.trim(),
      description: description ? description.trim() : null,
      color: color || '#3498db',
      years: years || 3,
      is_active: is_active !== undefined ? is_active : true
    });

    res.status(201).json({
      success: true,
      message: 'Corso creato con successo',
      course: newCourse
    });

  } catch (error) {
    console.error('Errore creazione corso:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione del corso'
    });
  }
});

// PUT /api/users/courses/:id (aggiorna corso)
router.put('/courses/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Non autorizzato'
      });
    }

    const courseId = req.params.id;
    const { 
      name, description, color, years, is_active 
    } = req.body;

    const course = await Course.findByPk(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Corso non trovato'
      });
    }

    // Se si sta aggiornando il nome, verifica che non sia duplicato
    if (name !== undefined && name.trim().toLowerCase() !== course.name.toLowerCase()) {
      const existingCourse = await Course.findOne({
        where: {
          id: { [Op.ne]: courseId }, // Escludi il corso corrente
          [Op.and]: sequelize.where(
            sequelize.fn('LOWER', sequelize.fn('TRIM', sequelize.col('name'))),
            sequelize.fn('LOWER', sequelize.fn('TRIM', name))
          )
        }
      });

      if (existingCourse) {
        return res.status(400).json({
          success: false,
          message: `Esiste già un altro corso con il nome "${name}"`,
          error: 'Duplicate course name'
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (color !== undefined) updateData.color = color;
    if (years !== undefined) updateData.years = years;
    if (is_active !== undefined) updateData.is_active = is_active;

    await course.update(updateData);

    res.json({
      success: true,
      message: 'Corso aggiornato con successo',
      course: course
    });

  } catch (error) {
    console.error('Errore aggiornamento corso:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento del corso'
    });
  }
});

// DELETE /api/users/courses/:id (elimina corso)
router.delete('/courses/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Non autorizzato'
      });
    }

    const courseId = req.params.id;

    const course = await Course.findByPk(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Corso non trovato'
      });
    }

    // Prima aggiorna gli utenti che hanno questo courseId
    await User.update(
      { courseId: null },
      { where: { courseId: courseId } }
    );

    // Poi elimina il corso (subjects si aggiornano con SET NULL, lessons con CASCADE)
    await course.destroy();

    res.json({
      success: true,
      message: 'Corso eliminato con successo'
    });

  } catch (error) {
    console.error('Errore eliminazione corso:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione del corso'
    });
  }
});

module.exports = router;