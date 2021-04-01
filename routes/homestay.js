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
    const sqlSelectStr = `SELECT * from homestay`
    conn.query(sqlSelectStr, (error, results, fields) => {
        if (error) {
            res.json({ code: 0, message: '很遗憾，获取房屋失败！' })
        } else {
            res.json({ code: 200, homestay: results })
        }
    })
})

module.exports = router