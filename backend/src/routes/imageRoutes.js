const express = require('express');
const router = express.Router();
const multer = require('multer');
const { LessonImage, Screenshot, Lesson, User } = require('../models');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file immagine sono permessi'), false);
    }
  }
});

router.get('/lesson/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    
    console.log(`📸 Richiesta immagine lezione ID: ${imageId}`);
    
    const image = await LessonImage.findByPk(imageId);
    
    if (!image) {
      console.log(`❌ LessonImage ${imageId} non trovata nel database`);
      return res.status(404).json({ error: 'Immagine non trovata' });
    }
    
    if (!image.image_data) {
      console.log(`❌ LessonImage ${imageId} trovata ma senza dati BLOB`);
      return res.status(404).json({ error: 'Dati immagine non disponibili' });
    }

    console.log(`✅ Serving LessonImage ${imageId}: ${image.image_data.length} bytes`);

    res.set({
      'Content-Type': image.mime_type || 'image/jpeg',
      'Content-Length': image.image_data.length,
      'Cache-Control': 'public, max-age=3600'
    });

    res.send(image.image_data);
  } catch (error) {
    console.error('❌ Errore nel servire immagine:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

router.get('/screenshot/:screenshotId', async (req, res) => {
  try {
    const { screenshotId } = req.params;
    
    const screenshot = await Screenshot.findByPk(screenshotId);
    
    if (!screenshot || !screenshot.image_data) {
      return res.status(404).json({ error: 'Screenshot non trovato' });
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': screenshot.image_data.length,
      'Cache-Control': 'public, max-age=3600'
    });

    res.send(screenshot.image_data);
  } catch (error) {
    console.error('Errore nel servire screenshot:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

router.get('/profile/:userId', authMiddleware.authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByPk(userId);
    
    if (!user || !user.photoPath) {
      return res.status(404).json({ error: 'Foto profilo non trovata' });
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': user.photoPath.length,
      'Cache-Control': 'public, max-age=3600'
    });

    res.send(user.photoPath);
  } catch (error) {
    console.error('Errore nel servire foto profilo:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

router.post('/lesson/:lessonId/upload', 
  authMiddleware.authenticate, 
  roleMiddleware.requireRole(['admin', 'teacher']),
  upload.single('image'),
  async (req, res) => {
    try {
      const { lessonId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ error: 'Nessun file caricato' });
      }

      const lesson = await Lesson.findByPk(lessonId);
      if (!lesson) {
        return res.status(404).json({ error: 'Lezione non trovata' });
      }

      const newImage = await LessonImage.create({
        lesson_id: lessonId,
        image_data: req.file.buffer,
        source: 'manual',
        captured_at: new Date(),
        is_analyzed: false,
        processing_status: 'pending'
      });

      res.status(201).json({
        success: true,
        imageId: newImage.id,
        message: 'Immagine caricata con successo'
      });

    } catch (error) {
      console.error('Errore nell\'upload immagine:', error);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  }
);

router.post('/profile/:userId/upload',
  authMiddleware.authenticate,
  roleMiddleware.requireRole(['admin', 'technician']),
  upload.single('photo'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ error: 'Nessun file caricato' });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      await user.update({
        photoPath: req.file.buffer
      });

      res.json({
        success: true,
        message: 'Foto profilo aggiornata con successo'
      });

    } catch (error) {
      console.error('Errore nell\'upload foto profilo:', error);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  }
);

router.get('/lesson/:lessonId/list', async (req, res) => {
  try {
    const { lessonId } = req.params;
    
    console.log(`📋 Lista immagini per lezione ${lessonId}`);
    
    const images = await LessonImage.findAll({
      where: { lesson_id: lessonId },
      attributes: [
        'id', 
        'source', 
        'captured_at', 
        'is_analyzed', 
        'detected_faces',
        'recognized_faces',
        'analysis_confidence',
        'processing_status',
        'file_size',
        'mime_type',
        'camera_ip'
      ],
      order: [['captured_at', 'DESC']]
    });

    console.log(`✅ Trovate ${images.length} immagini per lezione ${lessonId}`);

    const imagesWithUrls = images.map(img => {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      return {
        id: img.id,
        source: img.source,
        captured_at: img.captured_at,
        is_analyzed: img.is_analyzed,
        detected_faces: img.detected_faces || 0,
        recognized_faces: img.recognized_faces || 0,
        file_size: img.file_size || 0,
        mime_type: img.mime_type || 'image/jpeg',
        url: `${baseUrl}/api/images/lesson/${img.id}`,
        thumbnail_url: `${baseUrl}/api/images/lesson/${img.id}`,
        camera_ip: img.camera_ip,
        processing_status: img.processing_status
      };
    });

    res.json({
      success: true,
      images: imagesWithUrls,
      count: imagesWithUrls.length,
      lesson_id: parseInt(lessonId)
    });

  } catch (error) {
    console.error('❌ Errore nel recuperare lista immagini:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server',
      images: [],
      count: 0
    });
  }
});

router.delete('/lesson/:imageId', 
  authMiddleware.authenticate, 
  roleMiddleware.requireRole(['admin', 'teacher']), 
  async (req, res) => {
    try {
      const { imageId } = req.params;
      
      const image = await LessonImage.findByPk(imageId);
      if (!image) {
        return res.status(404).json({ error: 'Immagine non trovata' });
      }

      await image.destroy();

      res.json({
        success: true,
        message: 'Immagine eliminata con successo'
      });

    } catch (error) {
      console.error('Errore nell\'eliminare immagine:', error);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  }
);

module.exports = router;