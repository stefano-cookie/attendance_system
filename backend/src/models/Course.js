module.exports = (sequelize, DataTypes) => {
  const Course = sequelize.define('Course', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Nome del corso'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descrizione del corso'
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
      comment: 'Codice corso univoco'
    },
    color: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '#3498db',
      comment: 'Colore identificativo del corso'
    },
    icon: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Icona del corso'
    },
    academic_year: {
      type: DataTypes.STRING(9),
      allowNull: true,
      comment: 'Anno accademico (es. 2024-2025)'
    },
    semester: {
      type: DataTypes.ENUM('first', 'second', 'annual'),
      allowNull: true,
      comment: 'Semestre del corso'
    },
    credits: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Crediti formativi CFU'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Corso attivo'
    },
    max_students: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Numero massimo di studenti'
    }
  }, {
    tableName: 'Courses',
    timestamps: true,
    
    indexes: [
      {
        name: 'course_code_idx',
        fields: ['code']
      },
      {
        name: 'course_active_idx',
        fields: ['is_active']
      },
      {
        name: 'course_academic_year_idx',
        fields: ['academic_year']
      }
    ]
  });

  Course.prototype.getDisplayName = function() {
    return this.code ? `${this.code} - ${this.name}` : this.name;
  };

  Course.prototype.isCurrentYear = function() {
    if (!this.academic_year) return false;
    const currentYear = new Date().getFullYear();
    return this.academic_year.includes(currentYear.toString());
  };

  Course.prototype.getStudentCount = async function() {
    const { User } = require('./');
    return await User.count({
      where: { 
        courseId: this.id,
        role: 'student',
        is_active: true
      }
    });
  };

  Course.associate = function(models) {
    if (models.Lesson) {
      Course.hasMany(models.Lesson, {
        foreignKey: 'course_id',
        as: 'lessons'
      });
    }
    
    if (models.User) {
      Course.hasMany(models.User, {
        foreignKey: 'courseId',
        as: 'students'
      });
    }

    if (models.Subject) {
      Course.hasMany(models.Subject, {
        foreignKey: 'course_id',
        as: 'subjects'
      });
    }
  };

  return Course;
};