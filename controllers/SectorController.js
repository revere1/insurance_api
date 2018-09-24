var models = require('../models');
var Sequelize = require('sequelize');
var jwt = require('jsonwebtoken');
var config = require('./../config/config.json')['system'];
var utils = require('./../helpers/utils.js');
const Op = Sequelize.Op;
var async = require('async');

//creation of sector
exports.CreateSectors = function (request, response) {
    let postData = utils.DeepTrim(request.body);
    models.sectors.findOne({ where: { name: postData.name } }).then(sectors => {
        let result = {};
        if (sectors) {
            result.success = false;
            result.message = 'sector already existed.';
            response.json(result);
        }
        else {
            models.sectors.create(postData).then(sectors => {
                if (sectors) {
                    result.success = true;
                    result.message = 'Sector successfully created';
                }
                else {
                    result.success = true;
                    result.message = 'Sector not successfully created';
                }
                response.json(result);
            });
        }
    });
};

//Get Sectors values with database update 
exports.GetSectors = (req, res) => {
    models.sectors.findOne({
        where: { id: req.params.id }
    }).then(sectors => {
        let response = {};
        if (sectors) {
            response.success = true;
            response.data = {
                'name': sectors.name,
                'status': sectors.status,
                'id': sectors.id
            };
        }
        else {
            response.success = false;
            response.message = 'No Sectors found';
        }
        res.json(response);
    });
}

// update the  sector with database
exports.UpdateSector = function (request, response) {
    let postData = utils.DeepTrim(request.body);
    models.sectors.findOne({ where: { id: postData.id }, required: false }).then(sectors => {
        let result = {};
        if (sectors) {
            sectors.updateAttributes(postData).then((updateSector) => {
                if (updateSector) {
                    result.success = true;
                    result.message = 'Sector Updated successfully ';
                } else {
                    result.success = true;
                    result.message = 'Sector not Updated successfully ';
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
            result.message = 'Sector not existed.';
            response.json(result);
        }
    });
};

//get the active sectors
exports.Sectors = function (req, res, next) {
    let where = {};
    where['status'] = 'active';
    if (utils.objLen(req.query)) Object.assign(where, req.query);
    // find sectors
    models.sectors.findAll({
        attributes: ['id', 'name'],
        where: where
    }).then(function (sectors) {
        if (!sectors) {
            res.status(201).json({ success: false, message: 'Sectors Not Found.' });
        } else if (sectors) {
            res.status(201).json({
                success: true,
                data: sectors
            });
        }
    });
}

exports.FilterSectors = (req, res) => {
    filterSectors(req, res, (records) => {
        return res.json(records);
    });
}

//filter the sectors
filterSectors = (req, res, cb) => {
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
            models.sectors.findAll({ where: where, attributes: ['id'] }).then(projects => {
                callback(null, projects.length);
            }).catch(function (err) {
                callback(err);
            });
        },
        (callback) => {
            models.sectors.findAll({
                where: where,
                order: [
                    orderBy
                ],
                limit: pData.length, offset: pData.start
            })
                .then(sectors => {
                    callback(null, sectors);
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


exports.FilterContacts = (req, res) => {
    filterContacts(req, res, (records) => {
        return res.json(records);
    });
}


//filtering thet contacts
filterContacts = (req, res, cb) => {
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
            models.contact_us.findAll({ where: where, attributes: ['id'] }).then(projects => {
                callback(null, projects.length);
            }).catch(function (err) {
                callback(err);
            });
        },
        (callback) => {
            models.contact_us.findAll({
                where: where,
                attributes: ['id', 'name', 'mobile', 'email', 'comments'],
                order: [
                    orderBy
                ],
                limit: pData.length, offset: pData.start
            })
                .then(contact_us => {
                    callback(null, contact_us);
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

//Deleting the sector with database
exports.DeleteSector = function (request, response) {
    let result = {};
    if (request.params.id != undefined) {
        models.sectors.destroy({ where: { id: request.params.id } }).then((rowDeleted) => {
            result.success = true;
            result.message = (rowDeleted === 1) ? 'Sector deleted successfully' : 'Unable to delete Sector';
            response.json(result);
        }, (err) => {
            result.success = false;
            result.message = 'you must delete SubSector in this Sector ';
            response.json(result);
        })
    }
    else {
        result.success = false;
        result.message = 'Not selected any Sector';
        response.json(result);
    }
};
