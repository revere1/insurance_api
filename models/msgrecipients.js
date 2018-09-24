'use strict';
module.exports = (sequelize, DataTypes) => {
  var msgrecipients = sequelize.define('msgrecipients', {
    messageId: DataTypes.INTEGER,
    sent_to: DataTypes.INTEGER,
    is_read: DataTypes.BOOLEAN
  }, {
    classMethods: {
      associate: function(models) {
        msgrecipients.belongsTo(models.messages, {
          foreignKey: 'messageId',
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        });
        msgrecipients.belongsTo(models.users, {
          foreignKey: 'sent_to',
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        });
      }
    }
  });
  return msgrecipients;
};