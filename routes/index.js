const express = require('express');
const conn = require('./../db')
const md5 = require('blueimp-md5');
const { isEmpty } = require('lodash')
const jwt = require('jsonwebtoken')
const router = express.Router();
const token_key = "Little_Dragon"

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
})

// 用户注册
router.post('/sign_up', (req, res) => {
  const { body: { phone, password, gender, role } } = req
  const user_arr = [role, phone, md5(password), gender]
  const sqlSelectStr = `SELECT * from user WHERE user_phone = ${phone}`
  const sqlInsertStr = `INSERT INTO user(user_role, user_phone, user_password, user_gender) VALUES (?, ?, ?, ?)`
  conn.query(sqlSelectStr, (error, results, fields) => {
    if (error) {
      res.json({ code: 0, message: '很遗憾，注册失败！' });
    } else {
      if (!isEmpty(results)) {
        res.json({ code: 304, message: '此用户名已存在！' })
      } else {
        conn.query(sqlInsertStr, user_arr, (error, results, fields) => {
          if (error) {
            res.json({ code: 0, message: '很遗憾，注册失败！' });
          } else {
            res.json({ code: 200, message: '恭喜你，注册成功！' });
          }
        })
      }
    }
  })
})

// 用户登录
router.post('/sign_in', (req, res) => {
  const { body: { phone, password } } = req
  const sqlSelectStr = `SELECT * from user WHERE user_phone = '${phone}'`
  conn.query(sqlSelectStr, (error, results, fields) => {
    if (error) {
      res.json({ code: 0, message: '账号或密码错误！' })
    } else {
      const user_password = results[0]['user_password']
      req.body.password = md5(password)
      const token = jwt.sign(req.body, token_key)
      if (md5(password) === user_password) {
        res.json({ code: 200, message: '登录成功！', user: results[0], token })
      } else {
        res.json({ code: 0, message: '账号或密码错误！' })
      }
    }
  })
})

// 用户注销
router.get('/sign_out', (req, res) => {

})

module.exports = router;

