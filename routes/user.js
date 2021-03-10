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

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

// 用户注册
router.post('/sign_up', (req, res) => {
  const { headers: { host }, body: { phone, password, gender, role } } = req
  const avatar = `http://${host}/images/default.jpg`
  const user_arr = [role, phone, md5(password), gender, avatar]
  const sqlSelectStr = `SELECT * from user WHERE user_phone = ${phone}`
  const sqlInsertStr = `INSERT INTO user(user_role, user_phone, user_password, user_gender, user_avatar) VALUES (?, ?, ?, ?, ?)`
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
  console.log('req.body', req.body)
  const { body: { phone, password } } = req
  const sqlSelectStr = `SELECT * from user WHERE user_phone = '${phone}' AND user_password = '${md5(password)}'`
  conn.query(sqlSelectStr, (error, results, fields) => {
    if (error) {
      res.json({ code: 0, message: '账号或密码错误！' })
    } else {
      req.body.password = md5(password)
      const token = jwt.sign(req.body, token_key, { expiresIn: '2h' })
      if (!isEmpty(results)) {
        res.json({ code: 200, message: '登录成功！', token })
      } else {
        res.json({ code: 0, message: '账号或密码错误！' })
      }
    }
  })
})

// 用户验证
router.post('/sign_check', (req, res) => {
  console.log('req.headers', req.headers)
  const { headers: { authorization } } = req
  jwt.verify(authorization, token_key, (error, decoded) => {
    if (error) {
      switch (error.name) {
        case 'JsonWebTokenError': res.json({ code: 0, message: 'token无效' }); break;
        case 'TokenExpireError': res.json({ code: 0, message: 'token过期' }); break;
        default: res.json({ code: 0, message: 'token无效' })
      }
    } else {
      const { phone, password } = decoded
      const sqlSelectStr = `SELECT * from user WHERE user_phone = '${phone}' AND user_password = '${password}'`
      conn.query(sqlSelectStr, (error, results, fields) => {
        if (error) {
          res.json({ code: 0, message: '登录状态错误！' })
        } else {
          if (!isEmpty(results)) {
            res.json({ code: 200, message: '登录状态！', user: results[0] })
          } else {
            res.json({ code: 0, message: '登录状态错误！' })
          }
        }
      })
    }
  })
})

// 用户更改头像
router.post('/avatar', function (req, res) {
  const userDirPath = cacheFolder + "avatar";
  if (!fs.existsSync(userDirPath)) {
    fs.mkdirSync(userDirPath);
  }
  const form = new formidable.IncomingForm(); //创建上传表单
  form.encoding = 'utf-8'; //设置编辑
  form.uploadDir = userDirPath; //设置上传目录
  form.keepExtensions = true; //保留后缀
  form.maxFieldsSize = 2 * 1024 * 1024; //文件大小
  form.type = true;
  form.parse(req, function (err, fields, files) {
    if (err) {
      return res.json({ code: 0, error: err });
    }
    let extName = ''; //后缀名
    switch (files.avatar.type) {
      case 'image/pjpeg': extName = 'jpg'; break;
      case 'image/jpeg': extName = 'jpg'; break;
      case 'image/png': extName = 'png'; break;
      case 'image/x-png': extName = 'png'; break;
    }
    const { headers: { host, authorization }, query: { flag } } = req
    jwt.verify(authorization, token_key, (error, decoded) => {
      if (error) {
        switch (error.name) {
          case 'JsonWebTokenError': res.json({ code: 0, message: 'token无效' }); break;
          case 'TokenExpireError': res.json({ code: 0, message: 'token过期' }); break;
          default: res.json({ code: 0, message: 'token无效' })
        }
      } else {
        const { phone } = decoded
        const avatarName = `/${phone}${Date.now()}.${extName}`
        const newPath = form.uploadDir + avatarName;
        const path = newPath.replace('public', '')
        if (isEmpty(flag)) {
          fs.renameSync(files.avatar.path, newPath) // 新建图片
        } else {
          fs.unlinkSync(`${form.uploadDir}/${flag}`)
          fs.renameSync(files.avatar.path, newPath) //重命名
        }
        res.json({ code: 200, avatarUrl: `http://${host}${path}` });
      }
    })
  });
})

// 修改个人信息
router.post('/modify_personal_information', (req, res) => {
  const { body: { nickName, name, idcard, phone, password, newpassword, gender, avatar } } = req
  console.log(!isEmpty(avatar))
  let sqlUpdateStr
  if (!password && !newpassword) {
    sqlUpdateStr = `UPDATE user SET ${nickName ? `user_nickname='${nickName}',` : ''} ${name ? `user_name='${name}',` : ''} ${idcard ? `user_idcard='${idcard}',` : ''} ${gender ? `user_gender=${gender},` : ''} ${!isEmpty(avatar) ? `user_avatar='${avatar}'` : ''} WHERE user_phone = ${phone}`
  } else {
    sqlUpdateStr = `UPDATE user SET ${nickName ? `user_nickname='${nickName}',` : ''} ${name ? `user_name='${name}',` : ''} ${idcard ? `user_idcard='${idcard}',` : ''} ${gender ? `user_gender=${gender},` : ''} ${newpassword ? `user_newpassword=${newpassword},` : ''} ${!isEmpty(avatar) ? `user_avatar='${avatar}'` : ''} WHERE user_phone = ${phone} AND user_password = ${password}`
  }
  console.log('sqlUpdateStr', sqlUpdateStr)
  conn.query(sqlUpdateStr, (error, results, fields) => {
    if (error) {
      res.json({ code: 0, message: '很遗憾，修改个人信息失败！' })
    } else {
      const sqlSelectStr = `SELECT * from user WHERE user_phone = '${phone}'`
      conn.query(sqlSelectStr, (error, results, fields) => {
        if (error) {
          res.json({ code: 0, message: '很遗憾，查询失败！' })
        } else {
          res.json({ code: 200, message: '修改个人信息成功！',user: results[0] })
        }
      })
    }
  })
})

// 查询房屋
router.post('/homestay', function (req, res) {
  const { headers } = req
  console.log('headers', headers)
  // const avatar = `http://${host}/images/default.jpg`
  // const user_arr = [role, phone, md5(password), gender, avatar]
  const sqlSelectStr = `SELECT * from homestay`
  // const sqlInsertStr = `INSERT INTO user(user_role, user_phone, user_password, user_gender, user_avatar) VALUES (?, ?, ?, ?, ?)`
  conn.query(sqlSelectStr, (error, results, fields) => {
    if (error) {
      res.json({ code: 0, homestay: [] })
    } else {
      res.send({ code: 200, homestay: results })
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
