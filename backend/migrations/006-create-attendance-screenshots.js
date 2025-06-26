module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('📊 Creazione tabelle Screenshots e Attendance...');
    
    await queryInterface.createTable('Screenshots', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      lessonId: {
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
      path: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Percorso file (legacy/filesystem mode)'
      },
      image_data: {
        type: Sequelize.BLOB('long'),
        allowNull: true,
        comment: 'Dati immagine in formato BLOB'
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'Data e ora dell\'acquisizione'
      },
      detectedFaces: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Numero di volti rilevati'
      },
      source: {
        type: Sequelize.ENUM('filesystem', 'camera_capture', 'manual_upload', 'report_generated'),
        allowNull: false,
        defaultValue: 'filesystem',
        comment: 'Origine dell\'immagine'
      },
      file_size: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Dimensione file in bytes'
      },
      mime_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'image/jpeg',
        comment: 'Tipo MIME dell\'immagine'
      },
      original_filename: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Nome file originale se disponibile'
      },
      analysis_metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Metadati analisi completa (studenti riconosciuti, confidence, etc.)'
      },
      processing_status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Stato elaborazione'
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

    await queryInterface.createTable('Attendances', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Studente'
      },
      lessonId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Lessons',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Lezione'
      },
      is_present: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Presente/Assente'
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'Momento rilevamento presenza'
      },
      screenshotId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Screenshots',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Screenshot report collegato'
      },
      imageId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'LessonImages',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'LessonImage sorgente per riconoscimento'
      },
      imageFile: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Path file immagine (legacy/compatibilità)'
      },
      confidence: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        defaultValue: 0,
        comment: 'Confidence riconoscimento face detection (0.0-1.0)'
      },
      detection_method: {
        type: Sequelize.ENUM('manual', 'face_recognition', 'qr_code', 'rfid', 'mixed'),
        allowNull: false,
        defaultValue: 'face_recognition',
        comment: 'Metodo di rilevamento utilizzato'
      },
      face_detection_metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Metadati dettagliati face detection (coordinate, modello, etc.)'
      },
      verified_by_teacher: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Presenza verificata manualmente dal docente'
      },
      manual_override: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Presenza modificata manualmente'
      },
      override_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Motivo modifica manuale'
      },
      arrival_time: {
        type: Sequelize.TIME,
        allowNull: true,
        comment: 'Ora di arrivo specifica'
      },
      is_late: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Arrivo in ritardo'
      },
      late_minutes: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Minuti di ritardo'
      },
      quality_score: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
        comment: 'Score qualità riconoscimento (0.0-1.0)'
      },
      needs_review: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Richiede revisione manuale'
      },
      review_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Note per revisione'
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

    await queryInterface.addIndex('Screenshots', ['lessonId'], {
      name: 'screenshots_lesson_id_idx'
    });

    await queryInterface.addIndex('Screenshots', ['source'], {
      name: 'screenshots_source_idx'
    });

    await queryInterface.addIndex('Screenshots', ['timestamp'], {
      name: 'screenshots_timestamp_idx'
    });

    await queryInterface.addIndex('Screenshots', ['processing_status'], {
      name: 'screenshots_processing_status_idx'
    });

    await queryInterface.addIndex('Attendances', ['userId'], {
      name: 'attendances_user_id_idx'
    });

    await queryInterface.addIndex('Attendances', ['lessonId'], {
      name: 'attendances_lesson_id_idx'
    });

    await queryInterface.addIndex('Attendances', ['timestamp'], {
      name: 'attendances_timestamp_idx'
    });

    await queryInterface.addIndex('Attendances', ['is_present'], {
      name: 'attendances_is_present_idx'
    });

    await queryInterface.addIndex('Attendances', ['detection_method'], {
      name: 'attendances_detection_method_idx'
    });

    await queryInterface.addIndex('Attendances', ['userId', 'lessonId'], {
      unique: true,
      name: 'attendances_user_lesson_unique_idx'
    });

    await queryInterface.addIndex('Attendances', ['lessonId', 'is_present'], {
      name: 'attendances_lesson_presence_idx'
    });

    await queryInterface.addIndex('Attendances', ['screenshotId'], {
      name: 'attendances_screenshot_id_idx'
    });

    await queryInterface.addIndex('Attendances', ['imageId'], {
      name: 'attendances_image_id_idx'
    });

    await queryInterface.addIndex('Attendances', ['needs_review'], {
      name: 'attendances_needs_review_idx'
    });

    await queryInterface.addIndex('Attendances', ['verified_by_teacher'], {
      name: 'attendances_verified_idx'
    });

    console.log('✅ Tabelle Screenshots e Attendance create con sistema completo');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Eliminazione tabelle Attendance e Screenshots...');
    await queryInterface.dropTable('Attendances');
    await queryInterface.dropTable('Screenshots');
    console.log('✅ Tabelle Attendance e Screenshots eliminate');
  }
};