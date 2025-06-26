module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('📖 Creazione tabelle Subjects e Lessons...');
    
    await queryInterface.createTable('Subjects', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Nome materia'
      },
      code: {
        type: Sequelize.STRING(20),
        allowNull: true,
        unique: true,
        comment: 'Codice materia (es. MAT01)'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Descrizione materia'
      },
      course_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Courses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Corso di appartenenza'
      },
      credits: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Crediti CFU materia'
      },
      semester: {
        type: Sequelize.ENUM('first', 'second', 'annual'),
        allowNull: true,
        comment: 'Semestre di erogazione'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Materia attiva'
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

    await queryInterface.createTable('Lessons', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
        comment: 'Nome/titolo della lezione'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Descrizione dettagliata lezione'
      },
      course_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Courses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Corso di appartenenza'
      },
      subject_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Subjects',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Materia specifica'
      },
      classroom_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Classrooms',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Aula di svolgimento'
      },
      teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Docente responsabile'
      },
      lesson_date: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Data e ora programmata lezione'
      },
      duration_minutes: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 90,
        comment: 'Durata lezione in minuti'
      },
      status: {
        type: Sequelize.ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft',
        comment: 'Stato lezione'
      },
      attendance_mode: {
        type: Sequelize.ENUM('manual', 'camera', 'hybrid'),
        allowNull: false,
        defaultValue: 'hybrid',
        comment: 'Modalità rilevamento presenze'
      },
      face_detection_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Face detection attivo per questa lezione'
      },
      auto_capture_interval: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Intervallo auto-scatto in minuti (null = manuale)'
      },
      total_students_expected: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Numero studenti attesi'
      },
      total_students_present: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Numero studenti rilevati presenti'
      },
      attendance_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Percentuale presenza calcolata'
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Momento effettivo inizio lezione'
      },
      ended_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Momento effettivo fine lezione'
      },
      last_capture_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Ultimo scatto camera per questa lezione'
      },
      lesson_config: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Configurazione specifica lezione (face detection settings, etc.)'
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

    await queryInterface.addIndex('Subjects', ['name'], {
      name: 'subjects_name_idx'
    });

    await queryInterface.addIndex('Subjects', ['code'], {
      unique: true,
      name: 'subjects_code_unique_idx'
    });

    await queryInterface.addIndex('Subjects', ['course_id'], {
      name: 'subjects_course_id_idx'
    });

    await queryInterface.addIndex('Lessons', ['name'], {
      name: 'lessons_name_idx'
    });

    await queryInterface.addIndex('Lessons', ['course_id'], {
      name: 'lessons_course_id_idx'
    });

    await queryInterface.addIndex('Lessons', ['subject_id'], {
      name: 'lessons_subject_id_idx'
    });

    await queryInterface.addIndex('Lessons', ['classroom_id'], {
      name: 'lessons_classroom_id_idx'
    });

    await queryInterface.addIndex('Lessons', ['teacher_id'], {
      name: 'lessons_teacher_id_idx'
    });

    await queryInterface.addIndex('Lessons', ['lesson_date'], {
      name: 'lessons_lesson_date_idx'
    });

    await queryInterface.addIndex('Lessons', ['status'], {
      name: 'lessons_status_idx'
    });

    await queryInterface.addIndex('Lessons', ['lesson_date', 'classroom_id'], {
      name: 'lessons_schedule_idx'
    });

    console.log('✅ Tabelle Subjects e Lessons create con funzionalità complete');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Eliminazione tabelle Lessons e Subjects...');
    await queryInterface.dropTable('Lessons');
    await queryInterface.dropTable('Subjects');
    console.log('✅ Tabelle Lessons e Subjects eliminate');
  }
};