module.exports = (sequelize, DataTypes) => {
  const Classroom = sequelize.define('Classroom', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Nome dell\'aula'
    },
    code: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Codice identificativo dell\'aula'
    },
    
    has_projector: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'Indica se l\'aula ha un proiettore'
    },
    has_whiteboard: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'Indica se l\'aula ha una lavagna'
    },
    
    camera_ip: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Indirizzo IP della camera'
    },
    camera_port: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 80,
      comment: 'Porta della camera IP'
    },
    camera_username: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'admin',
      comment: 'Username per autenticazione camera'
    },
    camera_password: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Password per autenticazione camera'
    },
    camera_model: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Modello della camera IP'
    },
    camera_manufacturer: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Produttore della camera IP'
    },
    camera_status: {
      type: DataTypes.ENUM('unknown', 'online', 'offline', 'error'),
      allowNull: true,
      defaultValue: 'unknown',
      comment: 'Stato attuale della camera'
    },
    camera_last_check: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Ultimo controllo connessione camera'
    },
    camera_last_success: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Ultimo scatto riuscito'
    },
    camera_preferred_method: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Metodo preferito per scatto (onvif, http, etc.)'
    },
    camera_capabilities: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Capacità della camera (JSON)'
    },
    camera_resolution: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Risoluzione supportata dalla camera'
    },
    camera_fps: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Frame per secondo supportati'
    },
    camera_position: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Posizione fisica della camera nell\'aula'
    },
    camera_angle: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Angolazione della camera'
    },
    camera_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Note aggiuntive sulla camera'
    },
    
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Indica se l\'aula è attiva'
    },
    maintenance_mode: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'Indica se l\'aula è in manutenzione'
    }
  }, {
    timestamps: true,
    tableName: 'Classrooms',
    
    indexes: [
      {
        name: 'classroom_camera_ip_idx',
        fields: ['camera_ip']
      },
      {
        name: 'classroom_status_idx', 
        fields: ['camera_status']
      },
      {
        name: 'classroom_active_idx',
        fields: ['is_active']
      },
      {
        name: 'classroom_code_idx',
        fields: ['code']
      }
    ]
  });
  
  Classroom.prototype.hasCamera = function() {
    return !!(this.camera_ip);
  };
  
  Classroom.prototype.getCameraConfig = function() {
    if (!this.hasCamera()) return null;
    
    return {
      ip: this.camera_ip,
      port: this.camera_port || 80,
      username: this.camera_username || 'admin',
      password: this.camera_password,
      model: this.camera_model || 'Unknown',
      manufacturer: this.camera_manufacturer,
      status: this.camera_status || 'unknown',
      capabilities: this.camera_capabilities || {},
      resolution: this.camera_resolution,
      fps: this.camera_fps,
      position: this.camera_position,
      angle: this.camera_angle,
      notes: this.camera_notes
    };
  };
  
  Classroom.prototype.updateCameraStatus = async function(status, metadata = {}) {
    const updateData = {
      camera_status: status,
      camera_last_check: new Date()
    };
    
    if (status === 'online') {
      updateData.camera_last_success = new Date();
    }
    
    if (metadata.method) {
      updateData.camera_preferred_method = metadata.method;
    }
    
    if (metadata.capabilities) {
      updateData.camera_capabilities = metadata.capabilities;
    }
    
    if (metadata.resolution) {
      updateData.camera_resolution = metadata.resolution;
    }
    
    if (metadata.fps) {
      updateData.camera_fps = metadata.fps;
    }
    
    return await this.update(updateData);
  };
  
  Classroom.associate = function(models) {
    Classroom.hasMany(models.Lesson, {
      foreignKey: 'classroom_id',
      as: 'lessons'
    });
  };

  return Classroom;
};