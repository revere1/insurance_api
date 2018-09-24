'use strict';
module.exports = (sequelize, DataTypes) => {
  var insights_views = sequelize.define('insights_views', {
    insightId: {
      type: DataTypes.INTEGER,
      field: 'insight_id'
    },
    viewedBy: DataTypes.INTEGER
  }, {
  
    });
  return insights_views;
};