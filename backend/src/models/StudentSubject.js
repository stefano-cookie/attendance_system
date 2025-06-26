module.exports = (sequelize, DataTypes) => {
  const StudentSubject = sequelize.define('StudentSubject', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    studentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    subjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Subjects',
        key: 'id'
      }
    },
    passed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Indica se la materia è stata superata'
    },
    passed_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Data del superamento'
    },
    grade: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Voto ottenuto'
    }
  }, {
    tableName: 'StudentSubjects'
  });

  return StudentSubject;
};