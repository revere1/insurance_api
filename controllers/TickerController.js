var models = require('../models');
var Sequelize = require('sequelize');
const Op = Sequelize.Op;
var jwt = require('jsonwebtoken');
var config = require('./../config/config.json')['system'];
var utils = require('./../helpers/utils');
var async = require('async');


//Get all tickers Method:GET
exports.Tickers = function (request, response) {
    let $where = {}, not_consider = ['token', 'pageIndex', 'pageSize', 'sortField', 'sortOrder'];
    Object.keys(request.body).forEach(function (item) {
        if (!inArray(item, not_consider) && (request.body[item] != '' && request.body[item] != null && request.body[item] != undefined)) {
            $where[item] = { $like: '%' + request.body[item] + '%' }
        }
    }, this);
    let condition = { where: $where };
    condition['order'] = (request.body.sortField != undefined) ? [[request.body.sortField, request.body.sortOrder]] : [['createdAt', 'Desc']];
    if (request.body.pageSize) {
        var limit = parseInt(request.body.pageSize);
        condition['limit'] = limit + 1;
        var offset = (request.body.pageIndex) ? (limit * parseInt(request.body.pageIndex)) - limit : 0;
        condition['offset'] = offset;
    }
    let json_res = {};
    async.parallel(
        [
            (callback) => {
                Ticker.findAll(condition).then(projects => {
                    if ((projects.length === limit + 1)) {
                        json_res.itemsCount = offset + limit + 1;
                        projects.splice(-1, 1);
                    }
                    else {
                        json_res.itemsCount = offset + 1;
                    }
                    json_res.data = projects;
                    callback(null);
                });
            }
        ],
        (err, results) => {
            if (err) {
                json_res['status'] = 'failure';
                json_res['itemsCount'] = 0;
                json_res['data'] = {};
            }
            else {
                json_res['status'] = 'success';
            }
            response.json(json_res);
        }
    )
}

//deleting ticker based on tickerid
exports.DeleteTicker = function (request, response) {
    let id = request.params.id;
    let result = {};
    if (request.params.id != undefined) {
        models.tickers.destroy({ where: { 'id': id } }).then((rowDeleted) => {
            result.success = true;
            result.message = (rowDeleted === 1) ? 'Ticker deleted successfully' : 'Unable to delete Ticker';
            response.json(result);
        }, (err) => {
            result.success = false;
            result.message = 'Something went wrong';
            response.json(result);
        })
    }
    else {
        result.success = false;
        result.message = 'Not selected any Ticker';
        response.json(result);
    }
};

//create ticker
exports.CreateTicker = function (request, response) {
    let postData = request.body;
    models.tickers.findOne({ where: { name: postData.name } }).then(ticker => {
        let result = {};
        if (ticker) {
            result.success = false;
            result.message = 'Ticker already existed.';
            response.json(result);
        }
        else {
            trimPostData = utils.DeepTrim(postData)
            models.tickers.create(trimPostData).then(ticker => {
                if (ticker) {
                    result.success = true;
                    result.message = 'Ticker successfully created';
                }
                else {
                    result.success = true;
                    result.message = 'Ticker Not  successfully created';
                }
                response.json(result);
            });
        }
    });
};

noResults = (result, response) => {
    result.success = 'failure';
    result.message = 'Something went wrong';
    response.json(result);
}


//get the tickers
exports.GetTicker = (req, res) => {
    models.tickers.findOne({
        where: { id: req.params.id },
    }).then(ticker => {
        let response = {};
        if (ticker) {
            response.success = true;
            response.data = {
                'name': ticker.name,
                'company': ticker.company,
                'industry': ticker.industry,
                'sectorId': ticker.sectorId,
                'countryId': ticker.countryId,
                'company_url': ticker.company_url,
                'listing_exchange': ticker.listing_exchange,
                'currency': ticker.currency,
                'market_cap': ticker.market_cap,
                'share_in_issue': ticker.share_in_issue,
                'fiftytwo_week_high': ticker.fiftytwo_week_high,
                'fiftytwo_week_low': ticker.fiftytwo_week_low,
                'avg_volume': ticker.avg_volume,
                'about':ticker.about,
                'id': ticker.id
            };
        }
        else {
            response.success = false;
            response.message = 'No  found';
        }
        res.json(response);
    });
}


//find the tickers based on ticker name
exports.Tickers = function (req, res, next) {
    if (utils.objLen(req.query)) Object.assign(where, req.query);
    models.tickers.findAll({
        attributes: ['id', 'name'],
        where: where
    }).then(function (tickers) {
        if (!tickers) {
            res.status(201).json({ success: false, message: 'Tickers Not Found.' });
        } else if (tickers) {
            res.status(201).json({
                success: true,
                data: tickers
            });
        }
    });
}
exports.FilterTickers = (req, res) => {
    filterTickers(req, res, (records) => {
        return res.json(records);
    });
}

// filtering tickers
filterTickers = (req, res, cb) => {
    models.tickers = models.tickers;
    models.tickers.belongsTo(models.sectors);
    models.tickers.belongsTo(models.countries);
    models.tickers.belongsTo(models.users, { foreignKey: 'createdBy' });
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
            likeCond.push(Sequelize.where(Sequelize.fn('concat', Sequelize.col(`user.first_name`), ' ', Sequelize.col(`user.last_name`)), {
                like: '%' + pData.search.value + '%'
            }));
            likeCond.push(Sequelize.where(Sequelize.col(`country.name`), {
                like: '%' + pData.search.value + '%'
            }));
            likeCond.push(Sequelize.where(Sequelize.col(`sector.name`), {
                like: '%' + pData.search.value + '%'
            }));
            where = { [Op.or]: likeCond };
        }
    }
    let orderBy = [pData.columns[pData.order[0].column].data, pData.order[0].dir];

    let options = {
        where: where,
        attributes: ['id', 'name', 'company', 'industry', 'market_cap'],
        include: [
            {
                model: models.sectors,
                attributes: ['name']
            },
            {
                model: models.countries,
                attributes: ['name']
            },
            {
                model: models.users,
                attributes: [[Sequelize.literal('concat(`user`.`first_name`," ",`user`.`last_name`)'), 'Name']]
            },
        ],
        raw: true
    };
    async.parallel([
        (callback) => {
            models.tickers.findAll(options).then(projects => {
                callback(null, projects.length);
            }).catch(function (err) {
                callback(err);
            });
        },
        (callback) => {
            Object.assign(options, { order: [orderBy], limit: pData.length, offset: pData.start });
            models.tickers.findAll(options).then(tickers => {
                callback(null, tickers);
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
            json_res['recordsTotal'] = results[0];
            json_res['recordsFiltered'] = results[0];
            json_res['data'] = results[1];
        }
        cb(json_res);
    })
}


//global search ticker names
exports.AutoSearchTickers = function (request, response) {
    let term = request.query.p;
    models.tickers.findAll({
        where: {
            name: {
                $like: '%' + term + '%'
            }
        },
        attributes: ['id', ['name', 'sku']],
        required: false
    }).then(tickers => {
        $result = [];
        if (tickers) $result.push(tickers);
        response.json($result);
    }).catch(function (err) {
        response.json([]);
    });
};


//update the ticker basedo id with database
exports.UpdateTicker = function (request, response) {
    let postData = request.body;
    models.tickers.findOne({ where: { id: postData.id }, required: false }).then(tickers => {
        let result = {};
        if (tickers) {
            trimPostData = utils.DeepTrim(postData)
            tickers.updateAttributes(trimPostData).then((updateTickers) => {
                if (updateTickers) {
                    result.success = true;
                    result.message = 'Ticker Updated successfully ';
                } else {
                    result.success = true;
                    result.message = 'Ticker not Updated successfully ';
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
            result.message = 'Ticker not existed.';
            response.json(result);
        }
    });
};