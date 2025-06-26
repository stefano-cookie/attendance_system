module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('📚 Creazione tabella Courses completa...');
    
    await queryInterface.createTable('Courses', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Nome del corso'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Descrizione dettagliata del corso'
      },
      code: {
        type: Sequelize.STRING(20),
        allowNull: true,
        unique: true,
        comment: 'Codice corso univoco (es. MED2025)'
      },
      color: {
        type: Sequelize.STRING(7),
        allowNull: true,
        defaultValue: '#3B82F6',
        comment: 'Colore hex per UI (es. #3B82F6)'
      },
      icon: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Nome icona per UI'
      },
      academic_year: {
        type: Sequelize.STRING(9),
        allowNull: true,
        comment: 'Anno accademico (es. 2024-2025)'
      },
      semester: {
        type: Sequelize.ENUM('first', 'second', 'annual'),
        allowNull: true,
        comment: 'Semestre del corso'
      },
      credits: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Crediti formativi CFU'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Corso attivo per iscrizioni'
      },
      max_students: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Numero massimo studenti'
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

    await queryInterface.addIndex('Courses', ['name'], {
      name: 'courses_name_idx'
    });

    await queryInterface.addIndex('Courses', ['code'], {
      unique: true,
      name: 'courses_code_unique_idx'
    });

    await queryInterface.addIndex('Courses', ['is_active'], {
      name: 'courses_is_active_idx'
    });

    await queryInterface.addIndex('Courses', ['academic_year'], {
      name: 'courses_academic_year_idx'
    });

    console.log('✅ Tabella Courses creata con metadati completi');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Eliminazione tabella Courses...');
    await queryInterface.dropTable('Courses');
    console.log('✅ Tabella Courses eliminata');
  }
};