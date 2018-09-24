var models = require('../models');
var Sequelize = require('sequelize');
const Op = Sequelize.Op;
var jwt = require('jsonwebtoken');
var config = require('./../config/config.json')['system'];
var utils = require('./../helpers/utils');
var crypto = require('crypto');
var multer = require('multer')
var async = require('async');
var md5 = require('md5');
var fs = require('fs');
var db = require('./../models/index');

exports.Login = function (req, res, next) {
    // find the user
    models.users.hasOne(models.user_profile);
    models.users.findOne({
        where: {
            email: req.body.email
        },
        include: [
            {
                model: models.user_profile,
                attributes: ['profile_pic']
            }
        ]
    }).then(function (user) {
        if (!user) {
            res.status(201).json({ success: false, message: 'Incorrect login credentials.' });
        } else if (user) {
            if (user._modelOptions.instanceMethods.validPassword(req.body.password, user)) {

                var token = jwt.sign(user.toJSON(), config.jwt_secretkey, {
                    expiresIn: config.jwt_expire
                });
                res.status(201).json({
                    success: true,
                    data: {
                        'userid': user.id,
                        'email': user.email,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                        'access_level': user.access_level,
                        'status': user.status,
                        'registerdAt': user.createdAt,
                        'profile_pic': ((user.user_profile)
                            && fs.existsSync(req.app.locals.appUploads + user.user_profile.profile_pic))
                            ? user.user_profile.profile_pic : null
                    },
                    token: token
                });
            }
            else {
                res.status(201).json({ success: false, message: 'Incorrect login credentials.' });
            }
        }
    });
}

exports.authenticate = function (req, res, next) {
    // check header or url parameters or post parameters for token
    var token = req.body.token || req.query.token || req.headers['authorization'] || req.headers['Authorization'];
    if (token) {
        jwt.verify(token, config.jwt_secretkey, function (err, decoded) {
            if (err) {
                return res.status(201).json({ success: false, message: 'Authenticate token expired, please login again.', errcode: 'exp-token' });
            } else {
                req.decoded = decoded;
                req.app.locals.decodedData = decoded;
                next();
            }
        });
    } else {
        return res.status(201).json({
            success: false,
            message: 'Fatal error, Authenticate token not available.',
            errcode: 'no-token'
        });
    }
}

exports.checkuserlevel = function (req, res, next) {
    // check header or url parameters or post parameters for token
    var token = req.body.token || req.query.token || req.headers['authorization'];
    if (token) {
        jwt.verify(token, config.jwt_secretkey, function (err, decoded) {
            if (err) {
                return res.status(201).json({ success: false, message: 'Authenticate token expired, please login again.', errcode: 'exp-token' });
            } else {

                req.app.locals.decodedData = decoded;
                return res.status(201).json({
                    success: true,
                    data: {
                        'userid': decoded.id,
                        'email': decoded.email,
                        'first_name': decoded.first_name,
                        'last_name': decoded.last_name,
                        'status': decoded.status,
                        'access_level': decoded.access_level,
                        'registerdAt': decoded.createdAt
                    }
                });
            }
        });
    } else {
        return res.status(201).json({
            success: false,
            message: 'Fatal error, Authenticate token not available.',
            errcode: 'no-token'
        });
    }
}


//Get all users Method:GET
exports.Users = function (request, response) {
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
                models.users.findAll(condition).then(projects => {
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

//delete the user based on id
exports.DeleteUser = function (request, response) {
    let id = request.params.id;
    let result = {};
    if (request.params.id != undefined) {
        models.users.destroy({ where: { 'id': id }, individualHooks: true }).then((rowDeleted) => {
            result.success = true;
            result.message = (rowDeleted === 1) ? 'User deleted successfully' : 'Unable to delete user';
            response.json(result);
        }, (err) => {
            result.success = false;
            result.message = 'Something went wrong';
            response.json(result);
        })
    }
    else {
        result.success = false;
        result.message = 'Not selected any user';
        response.json(result);
    }
};

var Iuploads = multer({ storage: utils.assestDest('user-about-files') }).array('userphoto');
exports.UploadImage = function (request, response) {
    Iuploads(request, response, function (err) {
        let json_data = {};
        json_data.success = false;
        if (request.files) {
            json_data['data'] = [];
            (request.files).forEach(file => {
                json_data['data'].push('user-about-files/' + file.filename);
            })
            json_data['success'] = true;
        }
        else {
            json_data.message = err.message;
        }
        response.json(json_data);
    });
}

//var currentUser; 
var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return callback(new Error('Only image files are allowed!'));
        }
        callback(null, 'uploads/profile_pics');
    },
    filename: function (req, file, callback) {

        callback(null, md5((Date.now()) + file.originalname) + req.app.locals.path.extname(file.originalname));
    }
});
var upload = multer({ storage: storage }).single('profile_pic');

//upload the user images
exports.Upload = function (request, response) {
    upload(request, response, function (err) {
        let json_data = {};
        json_data.success = false;
        if (request.file) {
            request.body.profile_pic = 'profile_pics/' + request.file.filename;
            models.user_profile.findOne({ where: { userId: request.body.id } }).then(user_profile => {
                if (fs.existsSync('uploads/' + user_profile.profile_pic)) {
                    fs.unlinkSync('uploads/' + user_profile.profile_pic);
                }
                if (user_profile) {
                    user_profile.updateAttributes({ profile_pic: request.body.profile_pic }).then((updatedUserProfile) => {
                        if (!updatedUserProfile) {
                            json_data.message = 'Unable to upload';
                        }
                        else {
                            json_data.success = true;
                            json_data.message = 'Successfully uploaded';
                            json_data.data = { 'profile_pic': request.body.profile_pic };
                        }
                        response.json(json_data);
                    })
                }
                else {
                    createUserProfile({ profile_pic: request.body.profile_pic, userId: request.body.id }, userProfile => {
                        if (!userProfile) {
                            json_data.message = 'Unable to upload';
                        }
                        else {
                            json_data.success = true;
                            json_data.message = 'Successfully uploaded';
                            json_data.data = {
                                'profile_pic': request.body.profile_pic,
                                'first_name': request.body.first_name,
                                'last_name': request.body.last_name
                            };
                        }
                        response.json(json_data);
                    });
                }
            });
        }
        else {
            json_data.message = err.message;
            response.json(json_data);
        }
    });
}

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return callback(new Error('Only image files are allowed!'));
        }
        callback(null, 'uploads/analyst_comp_logo');
    },
    filename: function (req, file, callback) {

        callback(null, md5((Date.now()) + file.originalname) + req.app.locals.path.extname(file.originalname));
    }
});
var compUpload = multer({ storage: storage }).single('analyst_logo');
exports.UploadCompLogo = function (request, response) {
    compUpload(request, response, function (err) {
        let json_data = {};
        json_data.success = false;
        if (request.file) {
            json_data['data'] = ['analyst_comp_logo/' + request.file.filename];
            json_data['success'] = true;
        }
        else {
            json_data.message = err.message;
        }
        response.json(json_data);
    });
}

//create privillages
exports.CreatePrivillage = function (request, response) {
    let postData = request.body;
    let input = {};
    input.userId = postData.userId;
    delete postData.userId;
    models.privillages.destroy({
        where: { userId: input.userId }
    }).then(re => {
        for (let i in postData) {
            if (postData[i]) {
                Object.assign(input, { privillege: i, updated_by: request.app.locals.decodedData.id });
                models.privillages.create(input).then(privillages => {
                    if (privillages) {
                    }
                    else {
                    }
                });
            }
        }
        let result = {};
        result.success = true;
        result.message = 'privillages successfully created';
        response.json(result);

    });

};

//get the privillages
exports.GetPrivillages = (req, res) => {
    models.privillages.findAll({
        where: { userId: req.params.id }
    }).then(privillages => {
        let response = {};
        if (privillages) {
            response.success = true;
            response.data = privillages;
        }
        else {
            response.success = false;
            response.message = 'No privillages found';
        }
        res.json(response);
    });
}

//create users
exports.CreateUser = function (request, response) {
    compUpload(request, response, function (err) {
        let postData = JSON.parse(request.body.data);
        delete postData.id;
        models.users.findOne({ where: { email: postData.email } }).then(user => {

            let result = {};
            if (user) {
                result.success = false;
                result.message = 'User already existed.';
                response.json(result);
            }
            else {
                getAccessLevel(postData.access_level, access_level => {
                    if (!access_level) {
                        noResults(result, response);
                    }
                    else {
                        if (postData.password !== null) {
                            postData.password_hash = models.users.generateHash(postData.password);
                        }

                        postData.access_level = access_level.id;
                        if (request.file !== undefined)
                            postData.company_logo = 'analyst_comp_logo/' + request.file.filename;

                        postData = utils.DeepTrim(postData)
                        models.users.create(postData).then(user1 => {
                            if (user1) {
                                postData.userId = user1.id;
                                createUserProfile(postData, userProfile => {
                                    if (userProfile) {
                                        result.success = true;
                                        result.message = 'User successfully created';
                                    }
                                    else {
                                        result.success = true;
                                        result.message = 'User successfully created';
                                        result.message2 = 'User Profile Not created';
                                    }
                                    response.json(result);
                                });
                            }
                            else {
                                noResults(result, response)
                            }
                        });
                    }
                });
            }
        });
    });
};
noResults = (result, response) => {
    result.success = 'failure';
    result.message = 'Something went wrong';
    response.json(result);
}

//get the active user  access level
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

//get the active user role
exports.GetRole = (request, response) => {
    models.access_levels
        .findOne({
            where: {
                id: request.body.acessLevel,
                status: 'active'
            }
        }).then(user => {
            let result = {};
            if (user) {
                result.success = true;
                result.data = user;
                response.json(result);
            }
            else {
                noResults(result, response)
            }
        })
}
createUserProfile = (postData, cb) => {
    models.user_profile.create(postData).then(userProfile => {
        cb(userProfile);
    });
}

//get the user details
exports.GetUser = (req, res) => {
    models.users.hasOne(models.user_profile);
    models.user_profile.belongsTo(models.sectors);
    models.user_profile.belongsTo(models.company_details, { foreignKey: 'company_id' });
    models.user_profile.belongsTo(models.subsectors);
    models.user_profile.belongsTo(models.countries);
    models.user_profile.belongsTo(models.states);
    models.users.findOne({
        where: { id: req.params.id },
        include: [
            {
                model: models.user_profile,
                attributes: ['company_url', 'company_logo', 'company_name', 'company_id',
                    'sector_id', 'subsector_id', 'country_id', 'state_id', 'city', 'zip_code', 'profile_pic', 'about'
                ],
                include: [
                    {
                        model: models.sectors,
                        attributes: ['id', 'name']
                    },
                    {
                        model: models.company_details,
                        attributes: ['id', 'name']
                    },
                    {
                        model: models.subsectors,
                        attributes: ['id', 'name']
                    },
                    {
                        model: models.countries,
                        attributes: ['id', 'name']
                    },
                    {
                        model: models.states,
                        attributes: ['id', 'name']
                    }
                ],
            }
        ],
    }).then(user => {
        let json_res = {};
        if (user) {
            let json_res = {};
            json_res['success'] = true;
            json_res['data'] =
                {
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'email': user.email,
                    'contact_number': user.contact_number,
                    'password': null,
                    'confirm_password': null,
                    'status': user.status,
                    // 'country_id': user.user_profile.country ? user.user_profile.country.id : null,
                    // 'state_id': user.user_profile.state ? user.user_profile.state.id : null,
                    // 'sectorName': user.user_profile.sector ? user.user_profile.sector.name : null,
                    // 'subsectorName': user.user_profile.subsector ? user.user_profile.subsector.name : null,
                    // 'countryName': user.user_profile.country ? user.user_profile.country.name : null,
                    // 'stateName': user.user_profile.state ? user.user_profile.state.name : null,
                    // 'city': user.user_profile ? user.user_profile.city : null,
                    // 'zip_code': user.user_profile ? user.user_profile.zip_code : null,
                    'access_level': user.access_level,
                    'profile_pic': user.user_profile ? user.user_profile.profile_pic : null,
                    'about': user.user_profile ? user.user_profile.about : null,
                    'id': user.id
                };
            res.json(json_res);
        } else {
            json_res['success'] = false;
            json_res['data'] = 'No user found';
            res.json(json_res);
        }
    })
}

//filter clients
exports.FilterClients = (req, res) => {
    getAccessLevel('Client', access_level => {
        filterUsers(req, res, access_level.id, (records) => {
            return res.json(records);
        });
    })
}
//filter analysts
exports.FilterAnalysts = (req, res) => {
    getAccessLevel('Analyst', access_level => {
        filterUsers(req, res, access_level.id, (records) => {
            return res.json(records);
        });
    })
}

//filter admins
exports.FilterAdmins = (req, res) => {
    getAccessLevel('Admin', access_level => {
        filterUsers(req, res, access_level.id, (records) => {
            return res.json(records);
        });
    })
}
//filter editoriers
exports.FilterEditoriers = (req, res) => {
    getAccessLevel('Editorier', access_level => {
        filterUsers(req, res, access_level.id, (records) => {
            return res.json(records);
        });
    })
}
//global search all the users
exports.AutoSearchEditorier = function (request, response) {
    let term = request.query.p;
    models.users.findAll({
        where: {
            $and: [
                { first_name: { like: '%' + term + '%' } },
                { access_level: 4 },
                { status: 'active' }
            ],
        },
        attributes: ['id', [Sequelize.literal('concat(`users`.`first_name`," ",`users`.`last_name`)'), 'sku']],
        required: false
    }).then(users => {
        if (users) response.json(users);
    }).catch(function (err) {
        response.json([]);
    });
};
exports.UserList = (req, res) => {
    models.users.findAll({
        where: {
            $and: [
                { access_level: req.body.acceslevel },
                { status: 'active' }
            ]
        },
        attributes: ['id', 'first_name']
    }).then(user => {
        let result = {};
        if (user) {
            result.success = true;
            result.data = user;
            res.json(result);
        }
        else {
            noResults(result, res)
        }
    })
}
filterUsers = (req, res, userType, cb) => {
    models.users.belongsTo(models.users, { foreignKey: 'createdBy' });
    pData = req.body;
    where = sort = {};
    where = { 'access_level': userType };
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

    let orderBy = [pData.columns[pData.order[0].column].data, pData.order[0].dir];

    async.parallel([
        (callback) => {
            models.users.findAll({
                where: where, attributes: ['id'],
                include: [{
                    model: models.users,
                    attributes: [[Sequelize.literal('concat(`user`.`first_name`," ",`user`.`last_name`)'), 'Name']]
                }],
                raw: true
            }).then(projects => {
                callback(null, projects.length);
            }).catch(function (err) {
                callback(err);
            });
        },
        (callback) => {
            models.users.findAll({
                where: where,
                attributes: [
                    'id',
                    'first_name',
                    'last_name',
                    'email',
                    'contact_number',
                ],
                order: [
                    orderBy
                ],
                include: [{
                    model: models.users,
                    attributes: [[Sequelize.literal('concat(`user`.`first_name`," ",`user`.`last_name`)'), 'Name']]
                }],
                limit: pData.length,
                offset: pData.start,
                logging: console.log,
                raw: true
            }).then(users => {
                callback(null, users);
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
}

//update the user profile
exports.UpdateUser = function (request, response) {
    compUpload(request, response, function (err) {
        let postData = JSON.parse(request.body.data);
        models.users.hasOne(models.user_profile);
        models.users.findOne({
            where: { id: postData.id }, include: [{
                model: models.user_profile,
                attributes: ['company_url', 'company_logo', 'company_name', 'company_id', 'sector_id', 'subsector_id', 'country_id',
                    'state_id', 'city', 'zip_code'], required: false
            }]
        }).then(user => {
            let result = {};
            if (user) {
                if (postData.password !== null && postData.password !== undefined) {
                    postData.password_hash = models.users.generateHash(postData.password);
                }
                if (request.file !== undefined) {
                    if (user.company_logo) {
                        files = user.company_logo;
                        fs.unlinkSync('uploads/' + files)
                    }
                    postData.company_logo = 'analyst_comp_logo/' + request.file.filename;
                }
                postData = utils.DeepTrim(postData)
                user.updateAttributes(postData).then((updatedUser) => {
                    if (updatedUser) {
                        models.user_profile.findOne({ where: { userId: postData.id } }).then(user_profile => {
                            result.success = true;
                            result.message = 'User updated successfully.';
                            result.data = updatedUser;
                            if (user_profile) {
                                user_profile.updateAttributes(postData).then((updatedUserProfile) => {
                                    if (!updatedUserProfile) result.message2 = 'User Profile Not updated';
                                    response.json(result);
                                })
                            }
                            else {
                                postData.userId = user.id;
                                createUserProfile(postData, userProfile => {
                                    if (!userProfile) result.message2 = 'User Profile Not updated';
                                    response.json(result);
                                });
                            }
                        })
                    }
                    else {
                        noResults(result, response);
                    }
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
                result.message = 'User not existed.';
                response.json(result);
            }
        });
    });
};


exports.ForgotPwd = (req, res) => {
    async.waterfall([
        (done) => {
            models.users.findOne({
                where: {
                    email: req.body.email
                }
            }).then(user => {
                if (user) {
                    done(null, user);
                } else {
                    done('User not found.');
                }
            });
        },
        (user, done) => {
            // create the random token
            crypto.randomBytes(20, function (err, buffer) {
                var token = buffer.toString('hex');
                done(null, user, token);
            });
        },
        (user, token, done) => {
            user.updateAttributes({
                password_reset_token: token,
            }).then(updatedUser => {
                done(null, token, updatedUser);
            });
        },
        (token, user, done) => {
            var data = {
                to: user.email,
                from: config.revere_support_email,
                template: 'forgot-password-email',
                subject: 'Password help has arrived!',
                context: {
                    url: config.frontend_url + 'auth/reset-password?token=' + token,
                    name: user.first_name
                }
            };
            req.app.locals.smtpTransport.sendMail(data, function (err) {
                if (!err) {
                    return res.json({ success: true, message: 'Kindly check your email for further instructions' });
                } else {
                    return done(err);
                }
            });
        }
    ], (err) => {
        return res.json({ success: false, message: err });
    });
}

exports.ResetPwd = (req, res) => {
    models.users.findOne({
        password_reset_token: req.body.token
    }).then(user => {
        if (user) {
            if (req.body.password === req.body.confirm_password) {
                let updateData = {};
                updateData.password_hash = models.users.generateHash(req.body.password);
                updateData.password_reset_token = null;
                user.updateAttributes(updateData).then(updatedUser => {
                    var data = {
                        to: updatedUser.email,
                        from: config.revere_support_email,
                        template: 'reset-password-email',
                        subject: 'Password Reset Confirmation',
                        context: {
                            name: updatedUser.first_name
                        }
                    };
                    req.app.locals.smtpTransport.sendMail(data, function (err) {
                        if (!err) {
                            return res.json({ success: true, message: 'Password reset' });
                        } else {
                            return done(err);
                        }
                    });
                });
            } else {
                return res.status(422).json({
                    success: false,
                    message: 'Passwords do not match'
                });
            }
        } else {
            return res.json({
                success: false,
                message: 'Password reset token is invalid or has expired.'
            });
        }
    });
}

exports.ChangePwd = (req, res) => {
    models.users.findOne({
        where: { id: req.app.locals.decodedData.id }
    }).then(user => {
        if (user) {
            if (req.body.password === req.body.confirm_password) {
                let updateData = {};
                updateData.password_hash = models.users.generateHash(req.body.password);
                updateData.password_reset_token = null;
                user.updateAttributes(updateData).then(updatedUser => {
                    if (updatedUser) {
                        return res.json({ success: true, message: 'Password changed successfully' });
                    }
                    else {
                        return done(err);
                    }
                });
            } else {
                return res.status(422).json({
                    success: false,
                    message: 'Passwords do not match'
                });
            }
        } else {
            return res.json({
                success: false,
                message: 'Password Not changed.'
            });
        }
    });
}

exports.test = (req, res) => {
    let esC = require('./elastic/EUserController');
    esC.getResults(req.query.term, (err, response) => {
        let result = {};
        if (response.hits !== undefined) {
            if (response.hits.total !== undefined && (response.hits.total)) {
                esC.seperteByKey(response.hits.hits, finalData => {
                    result.success = true;
                    result.data = finalData;
                    res.status(201).json(result);
                });
            }
            else {
                result.success = false;
                result.message = 'No Results Found';
                res.json(result);
            }
        }
        else {
            result.success = false;
            result.message = 'No Results Found';
            res.json(result);
        }

    });
}

exports.UsersByCompany = (req, res) => {
    models.users.hasOne(models.user_profile);
    models.users.findAll({
        attributes: ['first_name', 'last_name', 'id'],
        include: [
            {
                model: models.user_profile,
                where: { company_id: req.params.companyId },
                attributes: ['company_url', 'company_name', 'profile_pic'],
            }
        ],
    }).then(user => {
        let json_res = {};
        if (user) {
            let json_res = {};
            json_res['success'] = true;
            json_res['data'] = user;
            res.json(json_res);
        } else {
            json_res['success'] = false;
            json_res['data'] = 'No user found';
            res.json(json_res);
        }
    })
}

//create the contactus for the users
exports.CreateContactUs = function (request, response) {
    let postData = request.body;
    models.contact_us.create(postData).then(contactUs => {
        let result = {};
        if (contactUs) {
            result.success = true;
            result.message = 'contactUs successfully created';
        }
        else {
            result.success = true;
            result.message = 'contactUs not successfully created';
        }
        response.json(result);
    });
};


//create the analystfollowers
exports.CreateAnalystFollower = function (request, response) {
    let postData = request.body;
    models.analysts_followers.findOne({
        where: {
            $and: [
                { 'analyst_id': postData.analyst_id },
                { 'followedBy': postData.followedBy }
            ]
        }
    }).then(followers => {
        let result = {};
        if (followers) {
            result.success = false;
            result.message = 'You are already followed the analyst';
            response.json(result);
        } else {
            models.analysts_followers.create(postData).then(analysts_followers => {
                if (analysts_followers) {
                    result.success = true;
                    result.message = 'You are successfully followed the analyst';
                } else {
                    result.success = true;
                    result.message = 'You are fail to follow the analyst';
                }
                response.json(result);
            })
        }
    })
}

