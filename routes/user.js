const express = require('express')
const fs = require('fs')
const md5 = require('blueimp-md5')
const jwt = require('jsonwebtoken')
const formidable = require('formidable')
const { isEmpty } = require('lodash')
const conn = require('./../db')
const { isHomestay_area } = require('./../utils/homestay')
const router = express.Router();
const token_key = "Little_Dragon"
const cacheFolder = 'public/images/'

/* GET users listing. */
router.get('/', (req, res) => {
  res.send('respond with a resource')
})

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
  const { body: { phone, password } } = req
  const sqlSelectStr = `SELECT * from user WHERE user_phone = '${phone}' AND user_password = '${md5(password)}'`
  conn.query(sqlSelectStr, (error, results, fields) => {
    if (error) {
      res.json({ code: 0, message: '账号或密码错误！' })
    } else {
      const ssh = { user_id: results[0]["user_id"] }
      const token = jwt.sign(ssh, token_key, { expiresIn: '2h' })
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
  const { headers: { authorization } } = req
  jwt.verify(authorization, token_key, (error, decoded) => {
    if (error) {
      switch (error.name) {
        case 'JsonWebTokenError': res.json({ code: 0, message: 'token无效' }); break;
        case 'TokenExpireError': res.json({ code: 0, message: 'token过期' }); break;
        default: res.json({ code: 0, message: 'token无效' })
      }
    } else {
      const { user_id } = decoded
      const sqlSelectStr = `SELECT * from user WHERE user_id = '${user_id}'`
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

// 用户通知中房源预约
router.post('/system_inform', (req, res) => {
  const { headers: { authorization } } = req
  jwt.verify(authorization, token_key, (error, decoded) => {
    if (error) {
      res.json({ code: 0, message: error.message })
    } else {
      const { user_id } = decoded
      const sqlSelectStr = `SELECT * from reserve WHERE landlord_id=${user_id} ORDER BY reserve_check_time ASC`
      const informSource = []
      conn.query(sqlSelectStr, (error, results) => {
        if (error) {
          res.json({ code: 0, informSource: [] })
        } else {
          let length = results.length
          results.map(({
            homestay_id,
            user_id,
            reserve_id,
            reserve_check_time,
            reserve_stay_time,
            reserve_note,
          }) => {
            const inform = { homestay_id, user_id, reserve_id, reserve_check_time, reserve_stay_time, reserve_note }
            const sqlSelectHomestay = `SELECT * from homestay WHERE homestay_id=${homestay_id}`
            const sqlSelectUser = `SELECT * from user WHERE user_id=${user_id}`
            conn.query(sqlSelectHomestay, (error_homestay, result_homestay) => {
              if (error_homestay) {
                res.json({ code: 0, informSource: [] })
              } else {
                Object.assign(inform, {
                  homestay_name: result_homestay[0]['homestay_name'],
                  homestay_type: result_homestay[0]['homestay_type'],
                })
                conn.query(sqlSelectUser, (error_user, result_user) => {
                  if (error_user) {
                    res.json({ code: 0, informSource: [] })
                  } else {
                    Object.assign(inform, {
                      user_role: result_user[0]['user_role'],
                      user_phone: result_user[0]['user_phone'],
                      user_avatar: result_user[0]['user_avatar'],
                    })
                    informSource.push(inform)
                    length--;
                    length === 0 && res.send({ code: 200, informSource })
                  }
                })
              }
            })
          })
        }
      })
    }
  })
})

// 用户更改头像
router.post('/avatar', (req, res) => {
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
      case 'image/gif': extName = 'gif'; break;
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
        const { user_id } = decoded
        const avatarName = `/${user_id}${Date.now()}.${extName}`
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
  let sqlUpdateStr
  if (!password && !newpassword) {
    sqlUpdateStr = `UPDATE user SET ${nickName ? `user_nickname='${nickName}',` : ''} ${name ? `user_name='${name}',` : ''} ${idcard ? `user_idcard='${idcard}',` : ''} ${gender ? `user_gender=${gender}${!isEmpty(avatar) ? ',' : ''}` : ''} ${!isEmpty(avatar) ? `user_avatar='${avatar}'` : ''} WHERE user_phone = '${phone}'`
  } else {
    sqlUpdateStr = `UPDATE user SET ${nickName ? `user_nickname='${nickName}',` : ''} ${name ? `user_name='${name}',` : ''} ${idcard ? `user_idcard='${idcard}',` : ''} ${gender ? `user_gender=${gender},` : ''} ${newpassword ? `user_password='${md5(newpassword)}'` : ''} ${!isEmpty(avatar) ? `user_avatar='${avatar}'` : ''} WHERE user_phone='${phone}' AND user_password='${md5(password)}'`
  }
  conn.query(sqlUpdateStr, (error, results) => {
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
router.post('/homestay', (req, res) => {
  const { headers: { authorization } } = req
  jwt.verify(authorization, token_key, (error, decoded) => {
    if (error) {
      res.json({ code: 0, message: error.message })
    } else {
      const { user_id } = decoded
      const sqlSelectStr = `SELECT * from homestay WHERE landlord_id=${user_id}`
      conn.query(sqlSelectStr, (error, results) => {
        if (error) {
          res.json({ code: 0, homestay: [] })
        } else {
          results = results.map(item => ({
            ...item,
            homestay_facility: JSON.parse(item.homestay_facility),
            homestay_picture: JSON.parse(item.homestay_picture),
          }))
          res.send({ code: 200, homestay: results })
        }
      })
    }
  })
})

// 添加房源图片
router.post('/homestay/picture', (req, res) => {
  const userDirPath = cacheFolder + "homestay_picture";
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
    switch (files.picture.type) {
      case 'image/pjpeg': extName = 'jpg'; break;
      case 'image/jpeg': extName = 'jpg'; break;
      case 'image/png': extName = 'png'; break;
      case 'image/x-png': extName = 'png'; break;
      case 'image/gif': extName = 'gif'; break;
    }
    const { headers: { host, authorization } } = req
    jwt.verify(authorization, token_key, (error, decoded) => {
      if (error) {
        switch (error.name) {
          case 'JsonWebTokenError': res.json({ code: 0, message: 'token无效' }); break;
          case 'TokenExpireError': res.json({ code: 0, message: 'token过期' }); break;
          default: res.json({ code: 0, message: 'token无效' })
        }
      } else {
        const { user_id } = decoded
        const pictureName = `/${user_id}${Date.now()}.${extName}`
        const newPath = form.uploadDir + pictureName;
        const path = newPath.replace('public', '')
        fs.renameSync(files.picture.path, newPath) // 新建图片
        res.json({ code: 200, pictureUrl: `http://${host}${path}` });
      }
    })
  });
})

// 添加房源
router.post('/homestay/issue', (req, res) => {
  const {
    headers: { authorization },
    body: { homestay_name, homestay_type, homestay_price, homestay_address, homestay_facility, homestay_recommend, homestay_picture }
  } = req
  const homestay_area = isHomestay_area(homestay_address)
  const facilityToJSON = JSON.stringify(homestay_facility)
  const pictureToJSON = JSON.stringify(homestay_picture)
  const homestay_arr = [homestay_name, homestay_type, Number(homestay_price), homestay_area, homestay_address, facilityToJSON, homestay_recommend, pictureToJSON]
  jwt.verify(authorization, token_key, (error, decoded) => {
    if (error) {
      switch (error.name) {
        case 'JsonWebTokenError': res.json({ code: 0, message: 'token无效' }); break;
        case 'TokenExpireError': res.json({ code: 0, message: 'token过期' }); break;
        default: res.json({ code: 0, message: 'token无效' })
      }
    } else {
      const { user_id } = decoded
      const sqlInsertStr = `INSERT INTO homestay(landlord_id, homestay_name, homestay_type, homestay_price, homestay_area, homestay_address, homestay_facility, homestay_recommend, homestay_picture) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`
      homestay_arr.unshift(user_id)
      conn.query(sqlInsertStr, homestay_arr, (error, results, fields) => {
        if (error) {
          res.json({ code: 0, message: error.message })
        } else {
          if (!isEmpty(results)) {
            res.json({ code: 200, message: '发布房源成功！' })
          } else {
            res.json({ code: 0, message: '发布房源失败！' })
          }
        }
      })
    }
  })
})

// 获取房源详情
router.get('/homestay/detail', (req, res) => {
  const { headers: { authorization }, query: { homestay_id } } = req
  const id = Number(homestay_id)
  jwt.verify(authorization, token_key, (error) => {
    if (error) {
      res.json({ code: 0, message: error.message })
    } else {
      const sqlSelectStr = `SELECT * from homestay WHERE homestay_id = ${id}`
      conn.query(sqlSelectStr, (error, results) => {
        if (error) {
          res.json({ code: 0, homestay_detail: {} })
        } else {
          results = results.map(item => ({
            ...item,
            homestay_facility: JSON.parse(item.homestay_facility),
            homestay_picture: JSON.parse(item.homestay_picture),
          }))
          res.send({ code: 200, homestay_detail: results[0] })
        }
      })
    }
  })
})

// 修改房源
router.post('/homestay/modify', (req, res) => {
  const {
    headers: { authorization },
    body: { homestay_id, homestay_name, homestay_type, homestay_price, homestay_address, homestay_facility, homestay_recommend, homestay_picture }
  } = req
  const homestay_area = isHomestay_area(homestay_address)
  const facilityToJSON = JSON.stringify(homestay_facility)
  const pictureToJSON = JSON.stringify(homestay_picture)
  jwt.verify(authorization, token_key, (error) => {
    if (error) {
      switch (error.name) {
        case 'JsonWebTokenError': res.json({ code: 0, message: 'token无效' }); break;
        case 'TokenExpireError': res.json({ code: 0, message: 'token过期' }); break;
        default: res.json({ code: 0, message: 'token无效' })
      }
    } else {
      const sqlUpdateStr = `UPDATE homestay SET homestay_name = '${homestay_name}', homestay_type = ${homestay_type}, homestay_price = ${homestay_price}, homestay_area = ${homestay_area}, homestay_address = '${homestay_address}', homestay_facility = '${facilityToJSON}', homestay_recommend = '${homestay_recommend}', homestay_picture = '${pictureToJSON}' WHERE homestay_id = ${homestay_id}`
      conn.query(sqlUpdateStr, (error, results) => {
        if (error) {
          res.json({ code: 0, message: error.message })
        } else {
          if (!isEmpty(results)) {
            res.json({ code: 200, message: '编辑房源成功！' })
          } else {
            res.json({ code: 0, message: '编辑房源失败！' })
          }
        }
      })
    }
  })
})

// 删除房源
router.get('/homestay/delete', (req, res) => {
  const { headers: { authorization }, query: { homestay_id } } = req
  jwt.verify(authorization, token_key, (error) => {
    if (error) {
      switch (error.name) {
        case 'JsonWebTokenError': res.json({ code: 0, message: 'token无效' }); break;
        case 'TokenExpireError': res.json({ code: 0, message: 'token过期' }); break;
        default: res.json({ code: 0, message: 'token无效' })
      }
    } else {
      const sqlDeleteStr = `DELETE FROM homestay WHERE homestay_id = ${homestay_id}`
      conn.query(sqlDeleteStr, (error, results, fields) => {
        if (error) {
          res.json({ code: 0, message: error.message })
        } else {
          if (!isEmpty(results)) {
            res.json({ code: 200, message: '删除房源成功！' })
          } else {
            res.json({ code: 0, message: '删除房源失败！' })
          }
        }
      })
    }
  })
})

// 查询我的点赞房源
router.post('/homestay_like', (req, res) => {
  const { headers: { authorization } } = req
  jwt.verify(authorization, token_key, (error, decoded) => {
    if (error) {
      res.json({ code: 0, message: error.message })
    } else {
      const { user_id } = decoded
      const sqlSelectStr = `SELECT user_like from user WHERE user_id = ${user_id}`
      conn.query(sqlSelectStr, (error, results) => {
        if (error) {
          res.json({ code: 0, homestay_like: [] })
        } else {
          results = JSON.parse(results[0]['user_like'])
          const homestay_like = []
          isEmpty(results) && res.send({ code: 200, homestay_like })
          let length = results.length;
          results.forEach(item => {
            const sqlHomestaySelectStr = `SELECT * from homestay WHERE homestay_id=${item}`
            conn.query(sqlHomestaySelectStr, (error, result) => {
              homestay_like.push({
                ...result[0],
                homestay_facility: JSON.parse(result[0].homestay_facility),
                homestay_picture: JSON.parse(result[0].homestay_picture),
              })
              length--;
              length === 0 && res.send({ code: 200, homestay_like })
            })
          })
        }
      })
    }
  })
})

// 查询我的收藏房源
router.post('/homestay_favorites', (req, res) => {
  const { headers: { authorization } } = req
  jwt.verify(authorization, token_key, (error, decoded) => {
    if (error) {
      res.json({ code: 0, message: error.message })
    } else {
      const { user_id } = decoded
      const sqlSelectStr = `SELECT user_favorites from user WHERE user_id = ${user_id}`
      conn.query(sqlSelectStr, (error, results) => {
        if (error) {
          res.json({ code: 0, homestay_favorites: [] })
        } else {
          results = JSON.parse(results[0]['user_favorites'])
          const homestay_favorites = []
          isEmpty(results) && res.send({ code: 200, homestay_favorites })
          let length = results.length;
          results.forEach(item => {
            const sqlHomestaySelectStr = `SELECT * from homestay WHERE homestay_id=${item}`
            conn.query(sqlHomestaySelectStr, (error, result) => {
              if (error) {
                res.json({ code: 0, homestay_favorites: [] })
              } else {
                homestay_favorites.push({
                  ...result[0],
                  homestay_facility: JSON.parse(result[0].homestay_facility),
                  homestay_picture: JSON.parse(result[0].homestay_picture),
                })
                length--;
                length === 0 && res.send({ code: 200, homestay_favorites })
              }
            })
          })
        }
      })
    }
  })
})

// 查询我的预约房源
router.post('/homestay_reserve', (req, res) => {
  const { headers: { authorization } } = req
  jwt.verify(authorization, token_key, (error, decoded) => {
    if (error) {
      res.json({ code: 0, message: error.message })
    } else {
      const { user_id } = decoded
      const sqlSelectStr = `SELECT * from reserve WHERE user_id = ${user_id}`
      conn.query(sqlSelectStr, (error, results) => {
        if (error) {
          res.json({ code: 0, homestay_favorites: [] })
        } else {
          const homestay_reserve = []
          isEmpty(results) && res.send({ code: 200, homestay_reserve })
          let length = results.length;
          results.forEach(({
            homestay_id,
            reserve_id,
            reserve_check_time,
            reserve_stay_time,
            reserve_note,
          }) => {
            const sqlHomestaySelectStr = `SELECT * from homestay WHERE homestay_id=${homestay_id}`
            conn.query(sqlHomestaySelectStr, (error, result) => {
              if (error) {
                res.json({ code: 0, homestay_favorites: [] })
              } else {
                homestay_reserve.push({
                  homestay_name: result[0]['homestay_name'],
                  homestay_id,
                  reserve_id,
                  reserve_check_time,
                  reserve_stay_time,
                  reserve_note,
                })
                length--;
                length === 0 && res.send({ code: 200, homestay_reserve })
              }
            })
          })
        }
      })
    }
  })
})

// 取消我的预约房源
router.get('/homestay/reserve/delete', (req, res) => {
  const { headers: { authorization }, query: { reserve_id } } = req
  jwt.verify(authorization, token_key, (error) => {
    if (error) {
      switch (error.name) {
        case 'JsonWebTokenError': res.json({ code: 0, message: 'token无效' }); break;
        case 'TokenExpireError': res.json({ code: 0, message: 'token过期' }); break;
        default: res.json({ code: 0, message: 'token无效' })
      }
    } else {
      const sqlDeleteStr = `DELETE FROM reserve WHERE reserve_id = ${reserve_id}`
      conn.query(sqlDeleteStr, (error, results) => {
        if (error) {
          res.json({ code: 0, message: error.message })
        } else {
          if (!isEmpty(results)) {
            res.json({ code: 200, message: '删除评价成功！' })
          } else {
            res.json({ code: 0, message: '删除评价失败！' })
          }
        }
      })
    }
  })
})

// 查询我的评价
router.post('/homestay_appraisal', (req, res) => {
  const { headers: { authorization } } = req
  jwt.verify(authorization, token_key, (error, decoded) => {
    if (error) {
      res.json({ code: 0, message: error.message })
    } else {
      const { user_id } = decoded
      // 查询用户评论
      const sqlSelectStr = `SELECT * from comment WHERE user_id=${user_id}`
      conn.query(sqlSelectStr, (error, results) => {
        if (error) {
          res.json({ code: 0, homestay_appraisal: [] })
        } else {
          const homestay_appraisal = []
          isEmpty(results) && res.send({ code: 200, homestay_appraisal })         
          let length = results.length;
          results.forEach(({
            comment_id,
            homestay_id,
            comment_time,
            comment_content,
            comment_reply,
          }) => {
            let appraisal = {
              comment_id,
              homestay_id,
              comment_time,
              comment_content,
              comment_reply,
            }
            // 查询对应房源信息
            const sqlHomestaySelectStr = `SELECT homestay_name from homestay WHERE homestay_id=${homestay_id}`
            conn.query(sqlHomestaySelectStr, (error, result) => {
              Object.assign(appraisal, { homestay_name: result[0]['homestay_name'] })
              homestay_appraisal.push(appraisal)
              length--;
              length === 0 && res.send({ code: 200, homestay_appraisal })
            })
          })
        }
      })
    }
  })
})

// 删除我的评论
router.get('/homestay/comment/delete', (req, res) => {
  const { headers: { authorization }, query: { comment_id } } = req
  jwt.verify(authorization, token_key, (error) => {
    if (error) {
      switch (error.name) {
        case 'JsonWebTokenError': res.json({ code: 0, message: 'token无效' }); break;
        case 'TokenExpireError': res.json({ code: 0, message: 'token过期' }); break;
        default: res.json({ code: 0, message: 'token无效' })
      }
    } else {
      const sqlDeleteStr = `DELETE FROM comment WHERE comment_id = ${comment_id}`
      conn.query(sqlDeleteStr, (error, results) => {
        if (error) {
          res.json({ code: 0, message: error.message })
        } else {
          if (!isEmpty(results)) {
            res.json({ code: 200, message: '删除评价成功！' })
          } else {
            res.json({ code: 0, message: '删除评价失败！' })
          }
        }
      })
    }
  })
})

module.exports = router
