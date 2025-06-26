module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🏫 Creazione tabella Classrooms con sistema camera...');
    
    await queryInterface.createTable('Classrooms', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Nome dell\'aula (es. Aula Magna, Lab1)'
      },
      code: {
        type: Sequelize.STRING(20),
        allowNull: true,
        unique: true,
        comment: 'Codice aula univoco'
      },
      capacity: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Capacità massima studenti'
      },
      floor: {
        type: Sequelize.STRING(10),
        allowNull: true,
        comment: 'Piano (es. PT, 1, 2, -1)'
      },
      building: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Edificio di appartenenza'
      },
      has_projector: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Dotata di proiettore'
      },
      has_whiteboard: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Dotata di lavagna'
      },
      camera_ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: 'Indirizzo IP camera (IPv4 o IPv6)'
      },
      camera_port: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 80,
        comment: 'Porta HTTP camera (default 80)'
      },
      camera_username: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Username autenticazione camera'
      },
      camera_password: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Password autenticazione camera (encrypted)'
      },
      camera_model: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Modello camera (es. IMOU IPC-T22AP)'
      },
      camera_manufacturer: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Produttore camera (es. IMOU, Hikvision)'
      },
      camera_status: {
        type: Sequelize.ENUM('unknown', 'online', 'offline', 'error', 'disabled'),
        allowNull: false,
        defaultValue: 'unknown',
        comment: 'Stato corrente camera'
      },
      camera_last_check: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Ultimo controllo stato camera'
      },
      camera_last_success: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Ultimo scatto riuscito'
      },
      camera_preferred_method: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Metodo di cattura preferito (http, onvif, rtsp)'
      },
      camera_capabilities: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Capacità camera (ONVIF, RTSP, endpoints, etc.)'
      },
      camera_resolution: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Risoluzione immagine (es. 1920x1080)'
      },
      camera_fps: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Frame per secondo'
      },
      camera_position: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Posizione camera (front, back, side, ceiling)'
      },
      camera_angle: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Angolo camera in gradi'
      },
      camera_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Note tecniche sulla camera'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Aula attiva per prenotazioni'
      },
      maintenance_mode: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Aula in manutenzione'
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

    await queryInterface.addIndex('Classrooms', ['name'], {
      name: 'classrooms_name_idx'
    });

    await queryInterface.addIndex('Classrooms', ['code'], {
      unique: true,
      name: 'classrooms_code_unique_idx'
    });

    await queryInterface.addIndex('Classrooms', ['camera_ip'], {
      name: 'classrooms_camera_ip_idx'
    });

    await queryInterface.addIndex('Classrooms', ['camera_status'], {
      name: 'classrooms_camera_status_idx'
    });

    await queryInterface.addIndex('Classrooms', ['is_active'], {
      name: 'classrooms_is_active_idx'
    });

    await queryInterface.addIndex('Classrooms', ['building', 'floor'], {
      name: 'classrooms_building_floor_idx'
    });

    console.log('✅ Tabella Classrooms creata con sistema camera completo');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Eliminazione tabella Classrooms...');
    await queryInterface.dropTable('Classrooms');
    console.log('✅ Tabella Classrooms eliminata');
  }
};