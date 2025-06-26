module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('📸 Creazione tabella LessonImages con sistema BLOB...');
    
    await queryInterface.createTable('LessonImages', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      lesson_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Lessons',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Lezione di appartenenza'
      },
      image_data: {
        type: Sequelize.BLOB('long'),
        allowNull: false,
        comment: 'Dati immagine in formato BLOB (ottimizzati)'
      },
      file_size: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Dimensione file in bytes'
      },
      mime_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'image/jpeg',
        comment: 'Tipo MIME (image/jpeg, image/png, etc.)'
      },
      image_hash: {
        type: Sequelize.STRING(64),
        allowNull: true,
        comment: 'Hash SHA-256 per deduplicazione'
      },
      source: {
        type: Sequelize.ENUM('manual', 'camera', 'report', 'generated'),
        allowNull: false,
        defaultValue: 'manual',
        comment: 'Origine: manual=upload, camera=scatto, report=generato'
      },
      original_filename: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Nome file originale se upload manuale'
      },
      captured_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'Data e ora acquisizione/creazione'
      },
      camera_ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: 'IP camera se scatto automatico'
      },
      camera_method: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Metodo cattura (http, onvif, rtsp)'
      },
      camera_metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Metadati camera (risoluzione, fps, device info)'
      },
      is_analyzed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Indica se immagine è stata analizzata per face detection'
      },
      detected_faces: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Numero volti rilevati nell\'immagine'
      },
      recognized_faces: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Numero volti riconosciuti (con match studenti)'
      },
      analysis_confidence: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        comment: 'Confidence media dell\'analisi face detection'
      },
      analysis_duration_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Durata analisi in millisecondi'
      },
      analysis_metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Metadati analisi face detection (modelli, versioni, dettagli)'
      },
      image_quality: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'excellent'),
        allowNull: true,
        comment: 'Qualità stimata immagine per face detection'
      },
      resolution_width: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Larghezza immagine in pixel'
      },
      resolution_height: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Altezza immagine in pixel'
      },
      is_optimized: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Immagine ottimizzata (resize, compress)'
      },
      optimization_applied: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Ottimizzazioni applicate (resize, quality, format)'
      },
      processing_status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed', 'skipped'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Stato elaborazione immagine'
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Messaggio errore se processing_status = failed'
      },
      retry_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Numero tentativi elaborazione'
      },
      image_category: {
        type: Sequelize.ENUM('lesson_start', 'lesson_middle', 'lesson_end', 'manual_capture', 'quality_check'),
        allowNull: true,
        comment: 'Categoria temporale/funzionale immagine'
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Immagine principale per la lezione'
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Ordine visualizzazione nell\'interfaccia'
      },
      contains_faces: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Contiene volti umani (privacy flag)'
      },
      privacy_level: {
        type: Sequelize.ENUM('public', 'internal', 'restricted', 'confidential'),
        allowNull: false,
        defaultValue: 'internal',
        comment: 'Livello privacy immagine'
      },
      gdpr_compliant: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Conforme GDPR'
      },
      analyzed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Data e ora completamento analisi'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('LessonImages', ['lesson_id'], {
      name: 'lessonimages_lesson_id_idx'
    });

    await queryInterface.addIndex('LessonImages', ['source'], {
      name: 'lessonimages_source_idx'
    });

    await queryInterface.addIndex('LessonImages', ['captured_at'], {
      name: 'lessonimages_captured_at_idx'
    });

    await queryInterface.addIndex('LessonImages', ['is_analyzed'], {
      name: 'lessonimages_is_analyzed_idx'
    });

    await queryInterface.addIndex('LessonImages', ['processing_status'], {
      name: 'lessonimages_processing_status_idx'
    });

    await queryInterface.addIndex('LessonImages', ['detected_faces'], {
      name: 'lessonimages_detected_faces_idx'
    });

    await queryInterface.addIndex('LessonImages', ['lesson_id', 'source'], {
      name: 'lessonimages_lesson_source_idx'
    });

    await queryInterface.addIndex('LessonImages', ['lesson_id', 'captured_at'], {
      name: 'lessonimages_lesson_date_idx'
    });

    await queryInterface.addIndex('LessonImages', ['is_analyzed', 'processing_status'], {
      name: 'lessonimages_analysis_status_idx'
    });

    await queryInterface.addIndex('LessonImages', ['camera_ip'], {
      name: 'lessonimages_camera_ip_idx'
    });

    await queryInterface.addIndex('LessonImages', ['image_hash'], {
      name: 'lessonimages_hash_idx'
    });

    await queryInterface.addIndex('LessonImages', ['privacy_level'], {
      name: 'lessonimages_privacy_level_idx'
    });

    console.log('✅ Tabella LessonImages creata con sistema BLOB completo');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Eliminazione tabella LessonImages...');
    await queryInterface.dropTable('LessonImages');
    console.log('✅ Tabella LessonImages eliminata');
  }
};