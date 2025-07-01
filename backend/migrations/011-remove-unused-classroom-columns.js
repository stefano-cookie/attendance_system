'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🧹 Rimozione colonne inutilizzate dalla tabella Classrooms...');
    
    // Rimuovi le colonne capacity, floor, building
    await queryInterface.removeColumn('Classrooms', 'capacity');
    console.log('✅ Rimossa colonna capacity');
    
    await queryInterface.removeColumn('Classrooms', 'floor');
    console.log('✅ Rimossa colonna floor');
    
    await queryInterface.removeColumn('Classrooms', 'building');
    console.log('✅ Rimossa colonna building');
    
    console.log('🎉 Cleanup colonne Classrooms completato!');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Ripristino colonne Classrooms...');
    
    // Ripristina le colonne in ordine inverso
    await queryInterface.addColumn('Classrooms', 'building', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Edificio dell\'aula'
    });
    
    await queryInterface.addColumn('Classrooms', 'floor', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Piano dell\'aula'
    });
    
    await queryInterface.addColumn('Classrooms', 'capacity', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Capacità massima studenti'
    });
    
    console.log('✅ Colonne Classrooms ripristinate');
  }
};