var models = require('../models');
var Sequelize = require('sequelize');
var jwt = require('jsonwebtoken');
var config = require('./../config/config.json')['system'];
var utils = require('./../helpers/utils.js');
const Op = Sequelize.Op;
var async = require('async');

exports.RegionsorCurrency = (req, res) => {
    if (req.body.tblName === 'currency') {
        records = models.currency.findAll()
    } else {
        records = models.regions.findAll()
    }
    records.then(data => {
        let result = {};
        result.success = true;
        result.data = [];
        if (data) {
            result.data = data;
        }
        res.json(result);
    })
}


// create region or currency
exports.CreateRegionorCurrency = function (request, response) {
    let postData = request.body.event;
    if (request.body.tblName === 'currency') {
        createRecords = models.currency.findOne({ where: { name: postData.name } })
    } else {
        createRecords = models.regions.findOne({ where: { name: postData.name } })
    }
    createRecords.then(createResults => {
        let result = {};
        if (createResults) {
            result.success = false;
            result.message = request.body.tblName + ' already existed.';
            response.json(result);
        } else {
            if (request.body.tblName === 'currency') {
                createRecords = models.currency.create(postData)
            } else {
                createRecords = models.regions.create(postData)
            }
            createRecords.then(createResult => {
                if (createResult) {
                    result.success = true;
                    result.message = request.body.tblName + ' Successfully created';
                    result.data = createResult;
                }
                else {
                    result.success = true;
                    result.message = request.body.tblName + ' Not Successfully created';

                }
                response.json(result);
            });
        }

    });
};

//deleting the region or currency
exports.DeleteRegionorCurrency = function (request, response) {
    let result = {};
    if (request.params.id != undefined) {
        if (request.params.tblName === 'currency') {
            deleteRecord = models.currency.destroy({ where: { id: request.params.id } })
        } else {
            deleteRecord = models.regions.destroy({ where: { id: request.params.id } })
        }
        deleteRecord.then((rowDeleted) => {
            result.success = true;
            result.message = (rowDeleted === 1) ? request.params.tblName + ' deleted successfully' : 'Unable to delete ' + request.params.tblName;
            response.json(result);
        })
    }
    else {
        result.success = false;
        result.message = 'Not selected any ' + request.params.tblName;
        response.json(result);
    }
};


//fetch the regions or currencies
exports.GetRegionorCurrency = (req, res) => {
    if (req.body.tblName === 'currency') {
        getRecords = models.currency.findOne({
            where: { id: req.params.id }
        })
    } else {
        getRecords = models.regions.findOne({
            where: { id: req.params.id }
        })
    }
    getRecords.then(getResults => {
        let response = {};
        if (getResults) {
            response.success = true;
            response.data = getResults;
        }
        else {
            response.success = false;
            response.message = 'No ' + req.body.tblName + ' found';
        }
        res.json(response);
    });
}

// update the regions or currency update with database
exports.UpdateRegionorCurrency = function (request, response) {
    let postData = request.body.event;
    if (request.body.tblName === 'currency') {
        updateRecord = models.currency.findOne({ where: { id: request.params.id }, required: false })
    } else {
        updateRecord = models.regions.findOne({ where: { id: request.params.id }, required: false })
    }
    updateRecord.then(records => {
        let result = {};
        if (records) {
            records.updateAttributes(postData).then((update) => {
                if (update) {
                    result.success = true;
                    result.message = request.body.tblName + ' Updated successfully ';
                } else {
                    result.success = true;
                    result.message = request.body.tblName + ' Not Updated successfully ';
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
            result.message = request.body.tblName + 'not existed.';
            response.json(result);
        }
    });
};

exports.FilterRegions = (req, res) => {
    filterRegionsorCurrency(req, res, (records) => {
        return res.json(records);
    });
}
exports.FilterCurrency = (req, res) => {
    filterRegionsorCurrency(req, res, (records) => {
        return res.json(records);
    });
}

//filering the region or currency
filterRegionsorCurrency = (req, res, cb) => {
    pData = req.body.filterInput;
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
            if (req.body.tblName === 'currency') {
                filterRecords = models.currency.findAll({
                    where: where, attributes: ['id']
                })
            } else {
                filterRecords = models.regions.findAll({
                    where: where, attributes: ['id']
                })
            }
            filterRecords.then(projects => {
                callback(null, projects.length);
            }).catch(function (err) {
                callback(err);
            });
        },
        (callback) => {
            if (req.body.tblName === 'currency') {
                filterRecord = models.currency.findAll({
                    where: where,
                    attributes: ['id', 'name'],
                    order: [
                        orderBy
                    ],
                    limit: pData.length, offset: pData.start
                })
            } else {
                filterRecord = models.regions.findAll({
                    where: where,
                    attributes: ['id', 'name'],
                    order: [
                        orderBy
                    ],
                    limit: pData.length, offset: pData.start
                })
            }
            filterRecord.then(filterResult => {
                callback(null, filterResult);
            }).catch(function (err) {
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

