'use strict';
module.exports = (sequelize, DataTypes) => {
  var Access_Levels = sequelize.define('access_levels', {
    name: DataTypes.STRING,
    status: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
      }
    }
  });
  return Access_Levels;
};