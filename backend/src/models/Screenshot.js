module.exports = (sequelize, DataTypes) => {
  const Screenshot = sequelize.define('Screenshot', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    path: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Percorso file (legacy) - ora opzionale'
    },
    image_data: {
      type: DataTypes.BLOB('long'),
      allowNull: true,
      comment: 'Dati immagine in formato BLOB'
    },
    lessonId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID della lezione associata'
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Data e ora dell\'acquisizione'
    },
    detectedFaces: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Numero di volti rilevati'
    },
    source: {
      type: DataTypes.ENUM('filesystem', 'camera_capture', 'manual_upload', 'report_generated'),
      defaultValue: 'filesystem',
      allowNull: false,
      comment: 'Origine dell\'immagine'
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Dimensione file in bytes'
    },
    mime_type: {
      type: DataTypes.STRING,
      defaultValue: 'image/jpeg',
      allowNull: false,
      comment: 'Tipo MIME dell\'immagine'
    },
    original_filename: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Nome file originale se disponibile'
    }
  }, {
    tableName: 'Screenshots',
    timestamps: true,
    indexes: [
      {
        fields: ['lessonId']
      },
      {
        fields: ['source']
      },
      {
        fields: ['timestamp']
      },
      {
        fields: ['mime_type']
      }
    ]
  });

  Screenshot.associate = (models) => {
    if (models.Lesson) {
      Screenshot.belongsTo(models.Lesson, {
        foreignKey: 'lessonId',
        as: 'Lesson'
      });
    }
    
    if (models.Attendance) {
      Screenshot.hasMany(models.Attendance, {
        foreignKey: 'screenshotId',
        as: 'Attendances'
      });
    }
  };

  Screenshot.prototype.hasImageData = function() {
    return !!(this.image_data && this.image_data.length > 0);
  };

  Screenshot.prototype.hasFilePath = function() {
    return !!(this.path && typeof this.path === 'string');
  };

  Screenshot.prototype.getImageSource = function() {
    if (this.hasImageData()) {
      return 'blob';
    } else if (this.hasFilePath()) {
      return 'filesystem';
    }
    return 'none';
  };

  Screenshot.prototype.getDisplayUrl = function(baseUrl = '') {
    const imageSource = this.getImageSource();
    
    if (imageSource === 'blob') {
      return `${baseUrl}/api/images/screenshot/${this.id}`;
    } else if (imageSource === 'filesystem') {
      const relativePath = this.path.includes('/data/reports/') 
        ? this.path.split('/data/reports/')[1] 
        : this.path.split('/').pop();
      return `${baseUrl}/static/screenshots/${relativePath}`;
    }
    
    return null;
  };

  Screenshot.createFromBlob = async function(imageBuffer, metadata = {}) {
    const defaultMetadata = {
      lessonId: null,
      detectedFaces: 0,
      source: 'manual_upload',
      mime_type: 'image/jpeg',
      original_filename: null
    };
    
    const finalMetadata = { ...defaultMetadata, ...metadata };
    
    return await this.create({
      image_data: imageBuffer,
      file_size: imageBuffer.length,
      timestamp: new Date(),
      ...finalMetadata
    });
  };

  Screenshot.createFromCameraCapture = async function(imageBuffer, lessonId, cameraMetadata = {}) {
    return await this.createFromBlob(imageBuffer, {
      lessonId: lessonId,
      source: 'camera_capture',
      mime_type: 'image/jpeg',
      original_filename: `camera_capture_lesson_${lessonId}_${Date.now()}.jpg`,
      ...cameraMetadata
    });
  };

  Screenshot.createFromReport = async function(imageBuffer, lessonId, reportMetadata = {}) {
    return await this.createFromBlob(imageBuffer, {
      lessonId: lessonId,
      source: 'report_generated',
      mime_type: 'image/jpeg',
      original_filename: `analysis_report_lesson_${lessonId}_${Date.now()}.jpg`,
      ...reportMetadata
    });
  };

  Screenshot.findByLesson = function(lessonId, options = {}) {
    return this.findAll({
      where: { lessonId },
      order: [['timestamp', 'DESC']],
      ...options
    });
  };

  Screenshot.findBlobScreenshots = function(options = {}) {
    return this.findAll({
      where: {
        image_data: {
          [sequelize.Sequelize.Op.ne]: null
        }
      },
      order: [['timestamp', 'DESC']],
      ...options
    });
  };

  Screenshot.findFilesystemScreenshots = function(options = {}) {
    return this.findAll({
      where: {
        path: {
          [sequelize.Sequelize.Op.ne]: null
        },
        image_data: {
          [sequelize.Sequelize.Op.is]: null
        }
      },
      order: [['timestamp', 'DESC']],
      ...options
    });
  };

  return Screenshot;
};