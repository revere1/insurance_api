var models = require('../models');
var jwt = require('jsonwebtoken');
var Sequelize = require('sequelize');
var config = require('./../config/config.json')['system'];
var utils = require('./../helpers/utils.js');
const Op = Sequelize.Op;
var async = require('async');

//get the active subsector
exports.Subsector = function (req, res, next) {
    let where = {};
    where['status'] = 'active';
    if (utils.objLen(req.params)) Object.assign(where, req.params);
    if (utils.objLen(req.query)) Object.assign(where, req.query);
    // find subsector
    models.subsectors.findAll({
        attributes: ['id', 'name'],
        where: where
    }).then(function (subsectors) {
        if (!subsectors) {
            res.status(201).json({ success: false, message: 'Subsectors Not Found.' });
        } else if (subsectors) {
            res.status(201).json({
                success: true,
                data: subsectors
            });
        }
    });
}

//creating the subsector
exports.CreateSubSector = function (request, response) {
    let postData = utils.DeepTrim(request.body);
    models.subsectors.findOne({ where: { name: postData.name, sector_id: postData.sector_id }, required: false }).then(subsectors => {
        let result = {};
        if (subsectors) {
            result.success = false;
            result.message = 'SubSector already existed.';
            response.json(result);
        } else {
            models.subsectors.create(postData).then(subsectors => {
                if (subsectors) {
                    result.success = true;
                    result.message = 'Sector Successfully created';
                }
                else {
                    result.success = true;
                    result.message = 'Sector Not Successfully created';
                }
                response.json(result);
            });
        }

    });
};
//Get State based on Id
exports.GetSubsector = (req, res) => {
    models.subsectors.findOne({
        where: { id: req.params.id }
    }).then(subsectors => {
        let response = {};
        if (subsectors) {
            response.success = true;
            response.data = {
                'name': subsectors.name,
                'status': subsectors.status,
                'sector_id': subsectors.sector_id,
                'id': subsectors.id
            };
        }
        else {
            response.success = false;
            response.message = 'No State found';
        }
        res.json(response);
    });
}


//update the subsector with database
exports.UpdateSubSector = function (request, response) {
    let postData = utils.DeepTrim(request.body);
    models.subsectors.findOne({ where: { id: postData.id }, required: false }).then(subsectors => {
        let result = {};
        if (subsectors) {
            subsectors.updateAttributes(postData).then((updateSubSector) => {
                if (updateSubSector) {
                    result.success = true;
                    result.message = 'SubSector Updated successfully ';
                } else {
                    result.success = true;
                    result.message = 'SubSector Not Updated successfully ';
                }
                response.json(result);
            }).catch(Sequelize.ValidationError, function (err) {
                // respond with validation errors
                return response.status(200).json({
                    success: false,
                    message: err.message
                });
            }).catch(function (err) {
                // every other error                
                return response.status(400).json({
                    success: false,
                    message: err
                });
            });
        }
        else {
            result.success = false;
            result.message = 'SubSector not existed.';
            response.json(result);
        }
    });
};
exports.FilterSubSectors = (req, res) => {
    filterSubSector(req, res, (records) => {
        return res.json(records);
    });
}

//filtering the subsectors
filterSubSector = (req, res, cb) => {
    pData = req.body;
    where = sort = {};
    if (pData.columns.length) {
        (pData.columns).forEach(col => {
            if ((col.search.value).length) {
                let cond = {};
                cond[col.data] = col.search.value;
                Object.assign(where, cond);
            }
        });
        if ((pData.search.value).length) {
            let likeCond = [];
            (pData.columns).forEach(col => {
                let item = {
                    [col.data]: {
                        [Op.like]: `%${pData.search.value}%`
                    }
                }
                likeCond.push(item);
            });
            where = { [Op.or]: likeCond };
        }
    }

    let orderBy = [pData.columns[pData.order[0].column].data, pData.order[0].dir];

    async.parallel([
        (callback) => {
            models.subsectors.findAll({ where: where, attributes: ['id'] }).then(projects => {
                callback(null, projects.length);
            }).catch(function (err) {
                callback(err);
            });
        },
        (callback) => {
            models.subsectors.findAll({
                where: where,
                order: [
                    orderBy
                ],
                limit: pData.length, offset: pData.start
            })
                .then(subsectors => {
                    callback(null, subsectors);
                })
                .catch(function (err) {
                    callback(err);
                });
        }
    ], (err, results) => {
        let json_res = {};
        json_res['draw'] = pData.draw;
        if (err) {
            json_res['success'] = false;
            json_res['recordsTotal'] = 0;
            json_res['recordsFiltered'] = 0;
            json_res['message'] = err;
            json_res['data'] = [];
        }
        else {
            json_res['success'] = true;
            json_res['recordsTotal'] = results[0];
            json_res['recordsFiltered'] = results[0];
            json_res['data'] = results[1];
        }
        cb(json_res);
    })
};


//deleting subsectors
exports.DeleteSubSector = function (request, response) {
    let result = {};
    if (request.params.id != undefined) {
        models.subsectors.destroy({ where: { id: request.params.id } }).then((rowDeleted) => {
            result.success = true;
            result.message = (rowDeleted === 1) ? 'subsector deleted successfully' : 'Unable to delete subsector';
            response.json(result);
        }).catch(function (err) {
            result.message = err,
                response.json(result);
        })
    }
    else {
        result.success = false;
        result.message = 'Not selected any subsectors';
        response.json(result);
    }
};
