module.exports = (sequelize, DataTypes) => {
  const LessonImage = sequelize.define('LessonImage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    lesson_id: { 
      type: DataTypes.INTEGER, 
      allowNull: true,
      references: { 
        model: 'Lessons', 
        key: 'id' 
      }
    },
    image_data: { 
      type: DataTypes.BLOB('long'), 
      allowNull: false,
      comment: 'Dati immagine in formato BLOB'
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Dimensione file in bytes'
    },
    mime_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'image/jpeg',
      comment: 'Tipo MIME'
    },
    source: { 
      type: DataTypes.ENUM('manual', 'camera', 'report', 'generated'),
      defaultValue: 'manual',
      comment: 'Origine immagine'
    },
    captured_at: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW,
      comment: 'Data e ora acquisizione'
    },
    original_filename: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Nome file originale'
    },
    camera_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IP camera se scatto automatico'
    },
    camera_method: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Metodo cattura (http, onvif, rtsp)'
    },
    camera_metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Metadati camera'
    },
    is_analyzed: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: false,
      comment: 'Immagine analizzata per face detection'
    },
    detected_faces: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Numero volti rilevati'
    },
    recognized_faces: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Numero volti riconosciuti (con match studenti)'
    },
    analysis_confidence: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
      comment: 'Confidence media analisi face detection'
    },
    analysis_duration_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Durata analisi in millisecondi'
    },
    analysis_metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Metadati analisi face detection'
    },
    processing_status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'skipped'),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'Stato elaborazione immagine'
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Messaggio errore se processing_status = failed'
    },
    privacy_level: {
      type: DataTypes.ENUM('public', 'internal', 'restricted', 'confidential'),
      allowNull: false,
      defaultValue: 'internal',
      comment: 'Livello privacy immagine'
    },
    analyzed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Data completamento analisi'
    }
  }, {
    tableName: 'LessonImages',
    timestamps: true,
    indexes: [
      { fields: ['lesson_id'] },
      { fields: ['source'] },
      { fields: ['captured_at'] },
      { fields: ['is_analyzed'] },
      { fields: ['processing_status'] }
    ]
  });
  
  LessonImage.associate = (models) => {
    if (models.Lesson) {
      LessonImage.belongsTo(models.Lesson, {
        foreignKey: 'lesson_id',
        as: 'lesson'
      });
    }
    
    if (models.Attendance) {
      LessonImage.hasMany(models.Attendance, {
        foreignKey: 'imageId',
        as: 'attendances'
      });
    }
  };
  
  return LessonImage;
};