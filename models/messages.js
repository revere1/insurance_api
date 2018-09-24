'use strict';
module.exports = (sequelize, DataTypes) => {
  var messages = sequelize.define('messages', {
    sent_from: DataTypes.INTEGER,
    subject: DataTypes.TEXT,
    message: DataTypes.TEXT,
    parent: DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function(models) {
        messages.belongsTo(models.users, {
          foreignKey: 'sent_from',
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        });
        messages.belongsTo(models.messages, {
          foreignKey: 'parent',
          onUpdate: 'CASCADE',
          onDelete: 'NO ACTION'
        });
      }
    }
  });
  return messages;
};