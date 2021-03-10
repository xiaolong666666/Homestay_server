const express = require('express')
const fs = require('fs')
const md5 = require('blueimp-md5')
const jwt = require('jsonwebtoken')
const formidable = require('formidable')
const { isEmpty } = require('lodash')
const conn = require('./../db')
const router = express.Router();
const token_key = "Little_Dragon"
const cacheFolder = 'public/images/'

/* GET homestay listing. */
router.get('/', function (req, res, next) {
    // const { headers: { host }, body: { phone, password, gender, role } } = req
    // const avatar = `http://${host}/images/default.jpg`
    // const user_arr = [role, phone, md5(password), gender, avatar]
    const sqlSelectStr = `SELECT * from homestay`
    // const sqlInsertStr = `INSERT INTO user(user_role, user_phone, user_password, user_gender, user_avatar) VALUES (?, ?, ?, ?, ?)`
    conn.query(sqlSelectStr, (error, results, fields) => {
        if (error) {
            res.json({ code: 0, message: '很遗憾，获取房屋失败！' })
        } else {
            res.json({ code: 200, homestay: results })            
            // if (!isEmpty(results)) {
            //     res.json({ code: 304, message: '此用户名已存在！' })
            // } else {
            //     conn.query(sqlInsertStr, user_arr, (error, results, fields) => {
            //         if (error) {
            //             res.json({ code: 0, message: '很遗憾，注册失败！' });
            //         } else {
            //             res.json({ code: 200, message: '恭喜你，注册成功！' });
            //         }
            //     })
            // }
        }
    })
})


module.exports = router
