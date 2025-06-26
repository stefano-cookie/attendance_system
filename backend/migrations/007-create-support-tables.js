module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔑 Creazione tabelle di supporto UserTokens e StudentSubjects...');
    
    await queryInterface.createTable('UserTokens', {
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
        comment: 'Utente proprietario del token'
      },
      token: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Token JWT'
      },
      token_type: {
        type: Sequelize.ENUM('login', 'refresh', 'reset_password', 'email_verification'),
        allowNull: false,
        defaultValue: 'login',
        comment: 'Tipo di token'
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Data scadenza token'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Token attivo'
      },
      device_info: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Informazioni device (user-agent, IP, etc.)'
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Ultimo utilizzo token'
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Data revoca token'
      },
      revoked_reason: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Motivo revoca (logout, security, expired, etc.)'
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

    await queryInterface.createTable('StudentSubjects', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'ID studente'
      },
      subject_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Subjects',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'ID materia'
      },
      enrollment_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'Data iscrizione alla materia'
      },
      status: {
        type: Sequelize.ENUM('enrolled', 'completed', 'dropped', 'suspended'),
        allowNull: false,
        defaultValue: 'enrolled',
        comment: 'Stato iscrizione'
      },
      grade: {
        type: Sequelize.DECIMAL(4, 2),
        allowNull: true,
        comment: 'Voto finale (se completato)'
      },
      grade_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Data assegnazione voto'
      },
      total_lessons: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Numero totale lezioni della materia'
      },
      attended_lessons: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Numero lezioni frequentate'
      },
      attendance_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Percentuale presenza calcolata'
      },
      special_needs: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Necessità speciali (disabilità, DSA, etc.)'
      },
      face_detection_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Face detection abilitato per questo studente'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Note specifiche per questo studente/materia'
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

    await queryInterface.addIndex('UserTokens', ['userId'], {
      name: 'user_tokens_user_id_idx'
    });

    await queryInterface.addIndex('UserTokens', ['token_type'], {
      name: 'user_tokens_type_idx'
    });

    await queryInterface.addIndex('UserTokens', ['is_active'], {
      name: 'user_tokens_is_active_idx'
    });

    await queryInterface.addIndex('UserTokens', ['expires_at'], {
      name: 'user_tokens_expires_at_idx'
    });

    await queryInterface.addIndex('UserTokens', ['userId', 'token_type', 'is_active'], {
      name: 'user_tokens_user_type_active_idx'
    });

    await queryInterface.addIndex('StudentSubjects', ['student_id'], {
      name: 'student_subjects_student_id_idx'
    });

    await queryInterface.addIndex('StudentSubjects', ['subject_id'], {
      name: 'student_subjects_subject_id_idx'
    });

    await queryInterface.addIndex('StudentSubjects', ['status'], {
      name: 'student_subjects_status_idx'
    });

    await queryInterface.addIndex('StudentSubjects', ['face_detection_enabled'], {
      name: 'student_subjects_face_detection_idx'
    });

    await queryInterface.addIndex('StudentSubjects', ['student_id', 'subject_id'], {
      unique: true,
      name: 'student_subjects_unique_idx'
    });

    await queryInterface.addIndex('StudentSubjects', ['attendance_percentage'], {
      name: 'student_subjects_attendance_perc_idx'
    });

    console.log('✅ Tabelle di supporto UserTokens e StudentSubjects create');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Eliminazione tabelle di supporto...');
    await queryInterface.dropTable('StudentSubjects');
    await queryInterface.dropTable('UserTokens');
    console.log('✅ Tabelle di supporto eliminate');
  }
};