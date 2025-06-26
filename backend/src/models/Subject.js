module.exports = (sequelize, DataTypes) => {
  const Subject = sequelize.define('Subject', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Courses',
        key: 'id'
      },
      field: 'course_id'
    }
  }, {
    tableName: 'Subjects'
  });

  Subject.associate = function(models) {
    if (models.Course) {
      Subject.belongsTo(models.Course, {
        foreignKey: 'course_id',
        as: 'course'
      });
    }
  };

  return Subject;
};