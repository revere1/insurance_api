'use strict';
module.exports = (sequelize, DataTypes) => {
  var msgattachments = sequelize.define('msgattachments', {
    messageId: DataTypes.INTEGER,
    path: DataTypes.STRING,
    mime_type: DataTypes.STRING,
    orgName: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        msgattachments.belongsTo(models.messages, {
          foreignKey: 'messageId',
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        });
      }
    }
  });
  return msgattachments;
};