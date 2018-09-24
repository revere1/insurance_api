var models = require('../models');
var Sequelize = require('sequelize');
var jwt = require('jsonwebtoken');
var config = require('./../config/config.json')['system'];
var utils = require('./../helpers/utils.js');
const Op = Sequelize.Op;
var async = require('async');


//get accesslevel to the database
getAccessLevel = (access_level_name, cb) => {
    models.access_levels
        .findOne({
            where: {
                name: access_level_name,
                status: 'active'
            }
        }).then(access_level => {
            cb(access_level);
        })
}

//get the count of clients/analyst/editorier/admins/tickers
exports.GetchCounts = (req, res) => {
    let json_res = {};
    async.parallel([
        (callback) => {
            getAccessLevel('Client', access_level => {
                models.users.count({ where: { status: 'active', access_level: access_level.id } }).then(cnt => {
                    let res = { 'clients': cnt };
                    json_res['data'] = {...json_res['data'], ...res};
                    callback(null, { 'clients': cnt });
                }).catch(function (err) {
                    callback(err);
                });
            });
        },
        (callback) => {
            getAccessLevel('Analyst', access_level => {
                models.users.count({ where: { status: 'active', access_level: access_level.id } }).then(cnt => {
                    let res = { 'analysts': cnt };
                    json_res['data'] = {...json_res['data'], ...res};
                    callback(null, { 'analysts': cnt });
                }).catch(function (err) {
                    callback(err);
                });
            });
        },
        (callback) => {
        models.tickers.count().then(cnt => {
                    let res = { 'tickers': cnt };
                    json_res['data'] = {...json_res['data'], ...res};
                    callback(null, { 'tickers': cnt });
                }).catch(function (err) {
                    callback(err);
                });  
        }
    ], (err, results) => {
        
        if (err) {
            json_res['success'] = false;
            json_res['message'] = err;
        }
        else {
            json_res['success'] = true;
        }
        res.json(json_res);
    })
};


// Chart Start
exports.DayWiseCounts = (req, res) => {
    let json_resday = {};
    async.parallel([
        (callback) => {
            getAccessLevel('Client', access_level => {
                models.users.findAll({
                    where: { status: 'active', access_level: access_level.id },
                    attributes: [[models.sequelize.fn('DATE', models.sequelize.col('createdAt')), 'name'], [models.sequelize.fn('COUNT', 'createdAt'), 'value']],
                    group: [models.sequelize.fn('DATE', models.sequelize.col('createdAt'))]

                }).then(daycnt => {
                    json_resday['datacount'] = { 'dayclients': daycnt };
                    callback(null, { 'clients': daycnt });
                }).catch(function (err) {
                    callback(err);
                });
            });

        },
        (callback) => {
            getAccessLevel('Analyst', access_level => {
                models.users.findAll({
                    where: { status: 'active', access_level: access_level.id },


                    attributes: [[models.sequelize.fn('DATE', models.sequelize.col('createdAt')), 'name'], [models.sequelize.fn('COUNT', 'createdAt'), 'value']],
                    group: [models.sequelize.fn('DATE', models.sequelize.col('createdAt'))]


                }).then(daycnt => {
                    Object.assign(json_resday['datacount'], { 'dayanalysts': daycnt });
                    callback(null, { 'analysts': daycnt });
                }).catch(function (err) {
                    callback(err);
                });
            });
        },
    ], (err, results) => {
        if (err) {
            json_resday['success'] = false;
            json_resday['message'] = err;
        }
        else {
            json_resday['success'] = true;
        }
        res.json(json_resday);
    })
};
// For Chart Line graph End

