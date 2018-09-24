'use strict';
module.exports = (sequelize, DataTypes) => {
  var Sectors = sequelize.define('sectors', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isUnique: function (value, next) {
          var self = this;
          Sectors.find({
            where: { name: value },
            attributes: ['id']
          }).done(function (sectors, error) {
            if (error) {
              return next(error);
            }
            else if (sectors) {
              if(sectors && self.id !== sectors.id)
              return next('Sector already in use!');
            }
            next();
          });
        }
      }
    },
    status: DataTypes.STRING,
    createdBy: DataTypes.INTEGER,
    updatedBy: DataTypes.INTEGER
  }, {
      classMethods: {
        associate: function (models) {
          Sectors.belongsTo(models.users, {
            foreignKey: 'createdBy',
            onUpdate: 'CASCADE',
            onDelete: 'NO ACTION'
          });
          Sectors.belongsTo(models.users, {
            foreignKey: 'updatedBy',
            onUpdate: 'CASCADE',
            onDelete: 'NO ACTION'
          });
        }
      }
    });
  return Sectors;
};