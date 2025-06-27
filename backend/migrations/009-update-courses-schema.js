'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Remove unused columns
    await queryInterface.removeColumn('Courses', 'semester');
    await queryInterface.removeColumn('Courses', 'credits');
    await queryInterface.removeColumn('Courses', 'code');
    await queryInterface.removeColumn('Courses', 'icon');
    await queryInterface.removeColumn('Courses', 'academic_year');
    await queryInterface.removeColumn('Courses', 'max_students');
    
    // Step 2: Add years column
    await queryInterface.addColumn('Courses', 'years', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 3,
      comment: 'Duration of the course in years'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove years column
    await queryInterface.removeColumn('Courses', 'years');
    
    // Re-add removed columns
    await queryInterface.addColumn('Courses', 'semester', {
      type: Sequelize.INTEGER,
      defaultValue: 1
    });
    
    await queryInterface.addColumn('Courses', 'credits', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    });
    
    await queryInterface.addColumn('Courses', 'code', {
      type: Sequelize.STRING(50),
      unique: true,
      allowNull: true
    });
    
    await queryInterface.addColumn('Courses', 'icon', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('Courses', 'academic_year', {
      type: Sequelize.STRING(9),
      allowNull: true
    });
    
    await queryInterface.addColumn('Courses', 'max_students', {
      type: Sequelize.INTEGER,
      defaultValue: 30
    });
  }
};