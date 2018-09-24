var models = require('../models');
var jwt = require('jsonwebtoken');
var config = require('./../config/config.json')['system'];
var utils = require('./../helpers/utils.js');
var Sequelize = require('sequelize');
const Op = Sequelize.Op;
var async = require('async');


//create the notification for particular user 
exports.CreateNotifications = function (request, response) {
    let postData = request.body;
    let result = {};
    if (postData.to.length) {
        let ToData = [];
        for (let To in postData.to) {
            ToData[To] = { 'to': postData.to[To], 'from': postData.from, 'type': postData.type, 'message': postData.message };
        }
        models.notifications.bulkCreate(ToData).then(notification => {
            let result = {};
            if (notification) {
                result.success = true;
                result.message = 'notification successfully created';
                response.json(result);
            }
            else {
                noResults(result, response)
            }
        });
    } else {
        noResults(result, response)
    }
};

exports.CreateOrgCopy = function (request, response) {
    let postData = request.body;
    let result = {};
    models.org_copies.findOne({
        where: {
            $and: [
                { 'type': postData.type },
                { 'type_id': postData.type_id }
            ]
        }
    }).then(org_copies => {
        if (org_copies) {
            org_copies.updateAttributes(postData).then(updatedCopy => {
                if (updatedCopy) {
                    result.success = true;
                    result.message = 'OrinalCopy Updated  successfully ';
                } else {
                    result.success = true;
                    result.message = 'OrinalCopy not Updated successfully ';
                }
            })
        } else {
            models.org_copies.create(postData).then(orinalCopy => {
                let result = {};
                if (orinalCopy) {
                    result.success = true;
                    result.message = 'OrinalCopy successfully Saved';
                    response.json(result);
                }
                else {
                    noResults(result, response)
                }
            });
        }
    })
}

// fetch the count of notification
exports.FetchCounts = (req, res) => {
    models.notifications.findAll({
        where: {
            $and: [
                {
                    $or: [
                        { is_read: 0 },
                        { is_read: null }
                    ]
                },
                {
                    to: req.params.id
                }
            ]
        }
    }).then(notification => {
        let result = {};
        if (notification) {
            result.count = notification.length;
            result.success = true;
            result.data = notification;
        }
        else {
            result.count = 0;
        }
        return res.json(result);
    });
}


exports.FilterNotifications = (req, res) => {

    filterNotifications(req, res, (records) => {
        return res.json(records);
    });
}

//filering the notifications
filterNotifications = (req, res, cb) => {
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
            Object.assign(where, { [Op.or]: likeCond });
        }
    }
    if (pData.currentUserId) {
        Object.assign(where, { 'to': pData.currentUserId });
    }
    let orderBy = [pData.order[0].column, pData.order[0].dir];
    async.parallel([
        (callback) => {
            models.notifications.belongsTo(models.users, { foreignKey: 'from' });
            models.notifications.findAll({
                where: where, attributes: ['id'],
                include: [{
                    model: models.users,
                    attributes: ['first_name', 'last_name', 'email'],
                }],
                raw: true,
            }).then(projects => {
                callback(null, projects.length);
            }).catch(function (err) {
                callback(err);
            });
        },
        (callback) => {
            models.notifications.belongsTo(models.users, { foreignKey: 'from' });
            models.notifications.findAll({
                where: where,
                include: [{
                    model: models.users,
                    attributes: ['first_name', 'last_name', 'email'],
                }],
                order: [
                    orderBy
                ],
                raw: true,
                limit: pData.length, offset: pData.start
            }).then(notifications => {
                let list = [];
                notifications.forEach(val => {
                    list.push(val.id);
                });
                models.notifications.update(
                    { is_read: '1' },
                    { where: { id: list } },
                ).spread(function (affectedCount, afftectedRows) {
                }).then(function (notifications) {
                })
                callback(null, notifications);
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