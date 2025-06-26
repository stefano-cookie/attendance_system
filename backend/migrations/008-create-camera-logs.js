module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('📹 Creazione tabella CameraLogs per monitoring...');
    
    await queryInterface.createTable('CameraLogs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      classroom_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Classrooms',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Aula con la camera'
      },
      event_type: {
        type: Sequelize.ENUM(
          'connection_test', 
          'capture_attempt', 
          'capture_success', 
          'capture_failure', 
          'discovery', 
          'health_check',
          'configuration_change'
        ),
        allowNull: false,
        comment: 'Tipo di evento camera'
      },
      camera_ip: {
        type: Sequelize.STRING(45),
        allowNull: false,
        comment: 'IP camera al momento dell\'evento'
      },
      method_used: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Metodo usato (onvif, http, rtsp, etc.)'
      },
      success: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Successo/fallimento operazione'
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Messaggio errore dettagliato se fallimento'
      },
      error_code: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Codice errore specifico'
      },
      response_time_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Tempo di risposta in millisecondi'
      },
      image_size_bytes: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Dimensione immagine se scatto riuscito'
      },
      image_resolution: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Risoluzione immagine catturata'
      },
      request_headers: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Headers HTTP della richiesta'
      },
      response_headers: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Headers HTTP della risposta'
      },
      network_latency_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Latenza di rete misurata'
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Metadati aggiuntivi specifici evento'
      },
      camera_metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Info tecniche camera (firmware, capabilities, etc.)'
      },
      lesson_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Lessons',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Lezione in corso durante evento (se applicable)'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Utente che ha generato evento (se manuale)'
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User agent del client'
      },
      server_version: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Versione server al momento evento'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'Timestamp preciso evento'
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    const indexesToCreate = [
      { fields: ['classroom_id'], name: 'camera_logs_classroom_id_idx' },
      { fields: ['event_type'], name: 'camera_logs_event_type_idx' },
      { fields: ['success'], name: 'camera_logs_success_idx' },
      { fields: ['created_at'], name: 'camera_logs_created_at_idx' },
      { fields: ['classroom_id', 'created_at'], name: 'camera_logs_classroom_date_idx' },
      { fields: ['event_type', 'success'], name: 'camera_logs_event_success_idx' },
      { fields: ['camera_ip', 'created_at'], name: 'camera_logs_ip_date_idx' },
      { fields: ['success', 'created_at'], name: 'camera_logs_success_date_idx' },
      { fields: ['response_time_ms'], name: 'camera_logs_response_time_idx' }
    ];

    for (const indexConfig of indexesToCreate) {
      try {
        await queryInterface.addIndex('CameraLogs', indexConfig.fields, {
          name: indexConfig.name
        });
        console.log(`✅ Indice ${indexConfig.name} creato`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️ Indice ${indexConfig.name} già esistente, skip...`);
        } else {
          console.error(`❌ Errore creazione indice ${indexConfig.name}:`, error.message);
          throw error;
        }
      }
    }

    console.log('✅ Tabella CameraLogs creata per debugging e monitoring camera');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Eliminazione tabella CameraLogs...');
    await queryInterface.dropTable('CameraLogs');
    console.log('✅ Tabella CameraLogs eliminata');
  }
};