var models = require('../models');
var Sequelize = require('sequelize');
var jwt = require('jsonwebtoken');
var config = require('./../config/config.json')['system'];
var utils = require('./../helpers/utils.js');
const Op = Sequelize.Op;
var async = require('async');
var multer = require('multer');
var md5 = require('md5');
var fs = require('fs');
var db = require('../models/index');

//Create message to other users
exports.CreateMessage = function (request, response) {
    models.messages.hasOne(models.msgrecipients);
    let postData = request.body;
    let result = {};
    models.messages.findOne({
        include: [
            {
                model: models.msgrecipients,
                where: {
                    $and: [
                        { sent_to: request.body.sent_to },
                        { '$messages.sent_from$': request.body.sent_from }
                    ]
                },
                attributes: ['sent_to']
            }
        ]
    }).then(message => {
        if (message) {
            data = {
                body: {
                    parent: message.id,
                    sent_to: request.body.sent_to,
                    is_read: '0',
                    sent_from: request.body.sent_from,
                    message: request.body.message
                }
            }
            createMessageReply(data, response);
        } else {
            models.messages.create(postData).then(messages => {
                if (messages) {
                    if (postData.sent_to.length) {
                        sent_toData = { 'messageId': messages.id, 'sent_to': postData.sent_to };
                        models.msgrecipients.create(sent_toData).then(function (test) {
                            if (test) {
                                if (postData.files.length) {
                                    let filesData = [];
                                    for (let file in postData.files) {
                                        var orgname = postData.files[file].split('-');
                                        var mimetype = postData.files[file].split('.');
                                        filesData[file] = { 'messageId': messages.id, 'path': postData.files[file], 'orgName': orgname[1], 'mime_type': mimetype[mimetype.length - 1] };
                                    }
                                    models.msgattachments.bulkCreate(filesData).then(function (test) {
                                        result.success = true;
                                        result.message = 'message successfully created';
                                        return response.json(result);
                                    }).catch(function (err) {
                                        result.success = false;
                                        result.message = err.message;
                                        return response.json(result);
                                    });
                                }
                                else {
                                    result.success = true;
                                    result.message = 'message successfully created';
                                    return response.json(result);
                                }
                            }
                        }).catch(function (err) {
                            result.success = false;
                            result.message = err.message;
                            return response.json(result);
                        });
                    }
                }
                else {
                    noResults(result, response);
                }
            });
        }
    });
};

//auto search the users
exports.AutoSearchUsers = function (req, res, next) {
    let where = {};
    where['status'] = 'active';
    if (utils.objLen(req.query)) Object.assign(where, req.query);
    let term = req.query.p;
    models.users.findOne({
        where: {
            $and: [
                { first_name: { like: '%' + term + '%' } },
                { id: { [Op.ne]: req.app.locals.decodedData.id } }
            ]
        },
        attributes: ['id', [Sequelize.literal('concat(`users`.`first_name`," ",`users`.`last_name`)'), 'sku']],
        required: false
    }).then(user => {
        $result = [];
        if (user) $result.push(user);
        res.json($result);
    }).catch(function (err) {
        res.json([]);
    });
};


//upload the message attachements with database
var upload = multer({ storage: utils.assestDest('message_files') }).single('file');
exports.Upload = function (request, response) {
    upload(request, response, function (err) {
        let json_data = {};
        json_data.success = false;
        if (request.file) {
            json_data['success'] = true;
            json_data['data'] = 'message_files/' + request.file.filename;
            // json_data['mimetype'] = request.file.mimetype;
            // json_data['name'] = request.file.originalname;
        }
        else {
            json_data.message = err.message;
        }
        response.json(json_data);
    });
}

//deleting the message attachments eith database
exports.RemoveFile = (req, res) => {
    result = {};
    if (req.headers['file'] != undefined) {
        fs.unlink('uploads/' + req.headers['file'], (err) => {
            if (!err) {
                result.success = true;
                result.message = 'Deleted Successfully';
            }
            else {
                result.success = false;
                result.message = err.message;
            }
            return res.json(result);

        });
    }
    else {
        result.success = false;
        result.message = 'Problem with your request';
        return res.json(result);
    }
}

// fetching count of messages
exports.FetchCounts = (req, res) => {
    let result = {};
    models.messages.hasOne(models.msgrecipients);
    $query = `select
    m.id as mid,
    m.subject,
    m.message,
    m.sent_from,
    m.createdAt,
    (SELECT tc.createdAt from messages tc where ( tc.parent=m.id or  (tc.id=m.id and tc.parent IS NULL)) order by tc.createdAt desc LIMIT 0,1) as latest_date,
    (SELECT count(*) as c  FROM messages as msg inner join msgrecipients as mrc on msg.id = mrc.messageId
    where (mrc.sent_to =${req.params.id} and (mrc.is_read=0 or mrc.is_read is null)and msg.sent_from = userId)) as unread,
    IF(sent_from != ${req.params.id}, sent_from,mr.sent_to) AS uid,
    u.first_name,u.last_name,
    u.id as userId,up.profile_pic
    FROM messages  m
    INNER JOIN msgrecipients mr ON m.id= mr.messageId
    INNER JOIN users u
    INNER JOIN user_profile AS up ON u.id = up.userId
    where (m.sent_from = ${req.params.id} OR mr.sent_to = ${req.params.id})
    AND m.parent IS NULL and   (SELECT count(*) as c  FROM messages as msg inner join msgrecipients as mrc on msg.id = mrc.messageId
    where (mrc.sent_to =${req.params.id} and (mrc.is_read=0 or mrc.is_read is null)and msg.sent_from = u.id)) != 0
    HAVING uid = u.id`

    db.sequelize.query($query, { type: Sequelize.QueryTypes.SELECT })
        .then(msgs => {
            let result = {};
            if (msgs) {
                result.count = msgs.length;
                result.success = true;
                result.data = msgs;
            }
            else {
                result.count = 0;
            }
            return res.json(result);
        }).catch(err => {
            result.success = false;
            result.count = 0;
            result.message = err.message;
            return res.json(result);
        });
}

//fetch messages particular user
exports.GetMessageUsersList = (req, res) => {
    models.messages.hasOne(models.msgrecipients);
    $query = `SELECT 
    messages.id, 
    messages.message, 
    messages.sent_from,
    messages.createdAt, 
    IF(sent_from != ${req.params.id}, sent_from,msgRecipient.sent_to) AS uid,
    msgRecipient.id as messageId, msgRecipient.sent_to,
    user.first_name, user.last_name, user.id as userId,
    up.profile_pic
    FROM messages AS messages
    INNER JOIN msgrecipients AS msgRecipient ON messages.id = msgRecipient.messageId
    AND 
    (
        messages.sent_from = ${req.params.id} 
        OR 
        msgRecipient.sent_to = ${req.params.id} 
    )
    AND messages.parent IS NULL
    INNER JOIN users AS user
    inner join user_profile as up on up.userId = user.id
    HAVING uid = user.id
    ORDER BY messages.createdAt DESC;`
    db.sequelize.query($query, { type: Sequelize.QueryTypes.SELECT })
        .then(messageUserlist => {

            let response = {};
            if (messageUserlist) {
                response.success = true;
                response.data = messageUserlist;
            }
            else {
                response.success = false;
                response.message = 'No Messages found';
            }
            res.json(response);
        })
}


// get latest messages particular user
exports.LatestMessage = (req, res) => {
    models.messages.hasOne(models.msgrecipients);
    models.messages.hasMany(models.msgattachments);
    models.messages.findOne({
        where: {
            $or: {
                $and: [
                    { id: req.params.id },
                    { parent: { $eq: null } }
                ],
                parent: req.params.id
            },
        },
        include: [
            {
                model: models.msgrecipients,
                where: {
                    $or: [
                        { sent_to: req.body.userId },
                        { '$messages.sent_from$': req.body.userId }
                    ]
                },
                attributes: ['sent_to']
            }
        ],
        order: [["id", "desc"]]
    }).then(message => {
        let response = {};
        if (message) {
            response.success = true;
            response.data = message;
        }
        else {
            response.success = false;
            response.message = 'No Messages found';
        }
        res.json(response);
    });
}

//get the messages responses
exports.GetMessage = (req, res) => {
    updateMessageRead(req, res)
    $query = `SELECT messages.id , messages.sent_from,messages.message,
     messages.parent, messages.createdAt, messages.updatedAt, 
     msgattachments.id as maId, msgattachments.path ,msgattachments.orgName,
     msgRecipient.id as mrId,  msgRecipient.sent_to ,
     users.first_name,users.last_name,
     up.profile_pic 
     FROM messages AS messages 
     LEFT OUTER JOIN msgattachments AS msgattachments ON messages.id= msgattachments.messageId
     INNER JOIN msgrecipients AS msgRecipient ON messages.id = msgRecipient.messageId
     inner join users as users on messages.sent_from = users.id
     inner join user_profile as up on up.userId = users.id
     AND (msgRecipient.sent_to = ${req.app.locals.decodedData.id} OR messages.sent_from = ${req.app.locals.decodedData.id})
     WHERE ((messages.id = ${req.params.id} AND messages.parent IS NULL) OR messages.parent = ${req.params.id}) 
     ORDER BY messages.id ASC;`
    db.sequelize.query($query, { type: Sequelize.QueryTypes.SELECT })
        .then(message => {
            let response = {};
            if (message) {
                response.success = true;
                response.data = message;
            }
            else {
                response.success = false;
                response.message = 'No Messages found';
            }
            res.json(response);
        });
}


//update unread messages 
updateMessageRead = (req, res) => {
    $query = `SELECT 
     messages.id, 
     messages.sent_from,
     messages.message,
     messages.parent, 
     messages.createdAt,
     messages.updatedAt,
     msgrecipients.sent_to AS sent_to, 
     msgrecipients.id AS mrId, 
     msgrecipients.messageId AS messageId 
     FROM messages AS messages 
     INNER JOIN msgrecipients AS msgrecipients ON messages.id = messageId 
     AND msgrecipients.sent_to = ${req.app.locals.decodedData.id} 
     WHERE (messages.id =  ${req.params.id}  OR messages.parent =  ${req.params.id} ) 
     ORDER BY messages.createdAt DESC `
    db.sequelize.query($query, { type: Sequelize.QueryTypes.SELECT })
        .then(msgRecipient => {
            let list = [];
            msgRecipient.forEach(val => {
                list.push(val.messageId);
            });
            models.msgrecipients.update(
                { is_read: '1' },
                { where: { messageId: list } },
            ).spread(function (affectedCount, afftectedRows) {
            }).then(function (msgrecipients) {
            })
        })
}
exports.UpdateIsRead = (request, response) => {
    updateMessageRead(request, response)
    return response.json()
}
exports.FilterMessages = (req, res) => {

    filterMessages(req, res, (records) => {
        return res.json(records);
    });
}


// filtering the messages
filterMessages = (req, res, cb) => {
    pData = req.body;
    $query = `select
    m.id as mid,
    m.subject,
    m.message,
    m.sent_from,
    m.createdAt,
    (SELECT tc.createdAt from messages tc where ( tc.parent=m.id or  (tc.id=m.id and tc.parent IS NULL)) order by tc.createdAt desc LIMIT 0,1) as latest_date,
    (SELECT count(*) as c  FROM messages as msg inner join msgrecipients as mrc on msg.id = mrc.messageId 
    where (mrc.sent_to =${pData.currentUserId} and (mrc.is_read=0 or mrc.is_read is null)and msg.sent_from = userId)) as unread,
    IF(sent_from != ${pData.currentUserId}, sent_from,mr.sent_to) AS uid,
    u.first_name,u.last_name,
    u.id as userId,up.profile_pic
    FROM messages  m
    INNER JOIN msgrecipients mr ON m.id= mr.messageId
    AND (m.sent_from = ${pData.currentUserId} OR mr.sent_to = ${pData.currentUserId})
    AND m.parent IS NULL
    INNER JOIN users u
    INNER JOIN user_profile AS up ON u.id = up.userId `

    let pCols = ['message', 'subject', 'mid'];
    let uCols = ['first_name', 'last_name', 'userId'];


    where = sort = {};
    let i = false;
    if (pData.columns.length) {

        (pData.columns).forEach(col => {

            if (String(col.search.value).length) {
                let prefix = utils.inArray(col.data, pCols) ? 'm.' : 'u.';
                $query += (!i) ? ' WHERE (' : ' AND ';
                $query += `${prefix + col.data}='${col.search.value}'`;
                i = true;
            }
        });
        if (i) $query += ') ';
        let j = false;
        if ((pData.search.value).length) {
            (pData.columns).forEach(col => {
                let prefix = utils.inArray(col.data, pCols) ? 'm.' : 'u.';
                $query += (!i) ? ' WHERE (' : ((j) ? ' OR ' : 'AND (');
                $query += `${prefix + col.data} LIKE '%${pData.search.value}%' `;
                i = j = true;
            })
        }
        if (j) $query += ') ';
    }
    $query += ' HAVING uid = userId ';

    if (pData.order.length) {
        $query += ' order by ' + pData.order[0].column + ' ' + pData.order[0].dir + ' ';
    }

    async.parallel([
        (callback) => {
            db.sequelize.query($query, { type: Sequelize.QueryTypes.SELECT }).then(projects => {
                callback(null, projects.length);
            }).catch(function (err) {
                callback(err);
            });
        },
        (callback) => {
            $query += ' limit ' + pData.start + ', ' + pData.length + ' ';

            db.sequelize.query($query, { type: Sequelize.QueryTypes.SELECT }).then(messages => {
                callback(null, messages);
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

createMessageReply = function (request, response) {
    let postData = request.body;
    console.log(postData)
    models.messages.findOne({ where: { id: postData.parent } }).then(messages => {
        let result = {};
        if (messages) {
            models.messages.create(postData).then(messages => {
                console.log('hi'+postData)
                models.msgrecipients.findOne({ where: { messageId: postData.parent } }).then(msgrecipients => {
                    if (msgrecipients) {
                        let messageReceiptsData;
                        messageReceiptsData = { 'messageId': messages.id, 'sent_to': postData.sent_to, 'is_read': postData.is_read };
                        models.msgrecipients.create(messageReceiptsData).then(msgrecipients => {
                            if (msgrecipients) {
                                result.success = true;
                                result.data = messages
                                result.message = 'message Reply Successfully Send';
                            }
                            else {
                                result.success = true;
                                result.message = 'messages Reply Not Successfully Send';
                            }
                            response.json(result);
                        }).catch(function (err) {
                            return response.status(400).json({
                                success: false,
                                message: err
                            });
                        });
                    }
                }).catch(function (err) {
                    return response.status(400).json({
                        success: false,
                        message: err
                    });
                });
            }).catch(function (err) {
                return response.status(400).json({
                    success: false,
                    message: err
                });
            });
        }
    });
}

// messages reply creation
exports.CreateMessageReply = function (request, response) {
    createMessageReply(request, response);
};

//upload reply messgaes attchments
var Iuploads = multer({ storage: utils.assestDest('message-summernote-images') }).array('userphoto');
exports.UploadImage = function (request, response) {
    Iuploads(request, response, function (err) {
        let json_data = {};
        json_data.success = false;
        if (request.files) {
            json_data['data'] = [];
            (request.files).forEach(file => {
                json_data['data'].push('message-summernote-images/' + file.filename);
            })
            json_data['success'] = true;
        }
        else {
            json_data.message = err.message;
        }
        response.json(json_data);

    });

}