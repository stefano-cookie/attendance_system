module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('👤 Creazione tabella Users completa...');
    
    await queryInterface.createTable('Users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Nome utente'
      },
      surname: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Cognome utente'
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Email univoca per login'
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Password hash bcrypt'
      },
      role: {
        type: Sequelize.ENUM('admin', 'student', 'teacher', 'technician'),
        allowNull: false,
        defaultValue: 'student',
        comment: 'Ruolo utente nel sistema'
      },
      matricola: {
        type: Sequelize.STRING(20),
        allowNull: true,
        unique: true,
        comment: 'Matricola studente (univoca)'
      },
      courseId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID corso di appartenenza'
      },
      photoPath: {
        type: Sequelize.BLOB('long'),
        allowNull: true,
        comment: 'Foto utente in formato BLOB per face recognition'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Utente attivo nel sistema'
      },
      reset_token: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Token per reset password'
      },
      reset_token_expiry: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Scadenza token reset password'
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
    
    await queryInterface.addIndex('Users', ['email'], {
      unique: true,
      name: 'users_email_unique_idx'
    });

    await queryInterface.addIndex('Users', ['matricola'], {
      unique: true,
      name: 'users_matricola_unique_idx'
    });

    await queryInterface.addIndex('Users', ['role'], {
      name: 'users_role_idx'
    });

    await queryInterface.addIndex('Users', ['courseId'], {
      name: 'users_course_id_idx'
    });

    await queryInterface.addIndex('Users', ['is_active'], {
      name: 'users_is_active_idx'
    });

    console.log('✅ Tabella Users creata con tutti i campi moderni');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Eliminazione tabella Users...');
    await queryInterface.dropTable('Users');
    console.log('✅ Tabella Users eliminata');
  }
};