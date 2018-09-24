'use strict';
module.exports = (sequelize, DataTypes) => {
  var Tickers = sequelize.define('tickers', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isUnique: function (value, next) {
          var self = this;
          Tickers.find({
            where: { name: value },
            attributes: ['id']
          }).done(function (tickers, error) {
            if (error) {
              return next(error);
            }
            else if (tickers) {
              if (tickers && self.id !== tickers.id) {
                return next('Email already in use!');
              }
            }
            next();
          });
        }
      }
    },
    company: DataTypes.STRING,
    industry: DataTypes.STRING,
    sectorId: DataTypes.INTEGER,
    companyId :DataTypes.INTEGER,
    company_url: DataTypes.STRING,
    company_logo: DataTypes.STRING,
    countryId: DataTypes.INTEGER,
    listing_exchange: DataTypes.STRING,
    currency: DataTypes.STRING,
    market_cap: DataTypes.FLOAT,
    share_in_issue: DataTypes.FLOAT,
    fiftytwo_week_high: DataTypes.FLOAT,
    fiftytwo_week_low: DataTypes.FLOAT,
    avg_volume: DataTypes.FLOAT,
    about: DataTypes.STRING,
    createdBy: DataTypes.INTEGER,
    updatedBy: DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function(models) {
        Tickers.belongsTo(models.users, {
          foreignKey: 'createdBy',
          onUpdate: 'CASCADE',
          onDelete: 'NO ACTION'
        });
        Tickers.belongsTo(models.users, {
          foreignKey: 'updatedBy',
          onUpdate: 'CASCADE',
          onDelete: 'NO ACTION'
        });
        Tickers.belongsTo(models.countries, {
          foreignKey: 'countryId',
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        });
        Tickers.belongsTo(models.sectors, {
          foreignKey: 'sectorId',
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        });
      }
    }
  });

  Tickers.afterCreate(ticker => {
    //Update Elastic search user    
    let esC = require('../controllers/elastic/EUserController');
    esC.createUpdateTicker(ticker.id,result=>{
      if(result.success)console.log('Ticker loaded into elastic server');
      else console.log(result.message);
    }); 
  });

  Tickers.afterUpdate(ticker => {
    //Update Elastic search user
    let esC = require('../controllers/elastic/EUserController');
    esC.createUpdateTicker(ticker.id,result=>{
      if(result.success)console.log('Ticker loaded into elastic server');
      else console.log(result.message);
    });
  });

  Tickers.afterDestroy(instance => {
    let esC = require('../controllers/elastic/EUserController');    
    esC.deleteTicker(instance.id, (res)=>{
      console.log(res);
    });
  });

  return Tickers;
};