const express = require('express')
const jwt = require('jsonwebtoken')
const conn = require('./../db')
const { isHomestay_type } = require('./../utils/homestay')
const router = express.Router();
const token_key = "Little_Dragon"

/* GET homestay listing. */
router.post('/', function (req, res) {
    const { body: { homestay_type } } = req
    const type = isHomestay_type(homestay_type)
    const sqlSelectStr = `SELECT * from homestay WHERE homestay_type=${type}`
    const homestayDataSource = []
    conn.query(sqlSelectStr, (error, results, fields) => {
        let length = results.length;
        if (error) {
            res.json({ code: 0, message: '很遗憾，获取房屋失败！' })
        } else {
            results.forEach(({
                homestay_id,
                homestay_picture,
                homestay_pirce,
                homestay_name,
                homestay_recommend,
                landlord_id,
            }) => {
                const homestay = {
                    homestay_id,
                    propagandaPicture: JSON.parse(homestay_picture)[0],
                    pirce: homestay_pirce,
                    homestayName: homestay_name,
                    homestayRecommend: homestay_recommend,
                }
                const sqlAvatarSelectStr = `SELECT user_avatar from user WHERE user_id='${landlord_id}'`
                conn.query(sqlAvatarSelectStr, (error, result, fields) => {
                    if (error) {
                        res.json({ code: 200, message: '很遗憾，获取房屋失败！' })
                    } else {
                        Object.assign(homestay, {
                            landlordAvatar: result[0].user_avatar
                        })
                        homestayDataSource.push(homestay)
                        length--;
                        length === 0 && res.json({ code: 200, homestayDataSource })
                    }
                })
            })
        }
    })
})

// 获取房源详情
router.get('/homestay_detail', function (req, res) {
    const { query: { homestay_id, user_id } } = req
    // 查询此房源信息
    const sqlSelectStr = `SELECT * from homestay WHERE homestay_id=${homestay_id}`
    conn.query(sqlSelectStr, (error, results, fields) => {
        if (error) {
            res.send({ code: 0, message: error.code })
        } else {
            const like = !!results[0]['homestay_like'] && JSON.parse(results[0]['homestay_like']).includes(Number(user_id))
            const homestay_detail = {
                picDataSource: JSON.parse(results[0]['homestay_picture']),
                like,
                like_count: results[0]['homestay_like_count'],
            }
            const landlord_id = results[0]['landlord_id']
            // 查询房东信息
            const sqlFavoritesSelectStr = `SELECT * from user WHERE user_id=${landlord_id}`
            conn.query(sqlFavoritesSelectStr, (error, result, fields) => {
                if (error) {
                    res.send({ code: 200, message: error.code })
                } else {
                    const favorites = !!result[0]['user_favorites'] && JSON.parse(result[0]['user_favorites']).includes(homestay_id)
                    const landlord_info = {
                        nickname: result[0]['user_nickname'] || result[0]['user_phone'],
                        face: result[0]['user_avatar'],
                        gender: result[0]['user_gender'],
                        isVerified: !!result[0]['user_idcard'],
                    }
                    Object.assign(homestay_detail, { favorites, landlord_info })
                    // 查询房东其他房源信息
                    const sqlLandlordHomestayStr = `SELECT * from homestay WHERE landlord_id=${landlord_id}`
                    conn.query(sqlLandlordHomestayStr, (error, homestaySource, fields) => {
                        if (error) {
                            res.send({ code: 0, message: error.code })
                        } else {
                            const landlord_house = homestaySource.map(item => ({
                                pic: JSON.parse(item['homestay_picture'])[0],
                                price: item['homestay_pirce']
                            }))
                            Object.assign(homestay_detail, { favorites, landlord_info, landlord_house })
                            res.send({ code: 200, ...homestay_detail })
                        }
                    })
                }
            })
        }
    })
})

// 点赞或取赞
router.post('/homestay_detail/submit_like', function (req, res) {
    const {
        headers: { authorization },
        body: { homestay_id, behavior }
    } = req
    jwt.verify(authorization, token_key, (error, decoded) => {
        if (error) {
            res.json({ code: 0, message: error.code })
        } else {
            const { user_id } = decoded
            // 查询房源信息
            const sqlHomestaySelectStr = `SELECT homestay_like,homestay_like_count from homestay WHERE homestay_id=${homestay_id}`
            conn.query(sqlHomestaySelectStr, (error, results) => {
                if (error) {
                    res.json({ code: 0, message: error.code })
                } else {
                    let homestay_like = JSON.parse(results[0]['homestay_like'])
                    if (behavior === 'add') {
                        homestay_like.push(user_id)
                    } else {
                        homestay_like = homestay_like.filter(item => item !== user_id)
                    }
                    const homestay_like_next = JSON.stringify(homestay_like)
                    const like_count = results[0]['homestay_like_count'] + (behavior === 'add' ? 1 : -1)
                    // 更新房源信息
                    const sqlUpdateStr = `UPDATE homestay SET homestay_like='${homestay_like_next}', homestay_like_count=${like_count} WHERE homestay_id=${homestay_id}`
                    conn.query(sqlUpdateStr, (error, result) => {
                        if (error) {
                            res.send({ code: 0, message: error.code })
                        } else {
                            // 查询用户信息
                            const sqlUserSelectStr = `SELECT user_like from user WHERE user_id = ${user_id}`
                            conn.query(sqlUserSelectStr, (error, user_results) => {
                                if (error) {
                                    console.log('error', error)
                                } else {
                                    let user_like = JSON.parse(user_results[0]['user_like'])
                                    if (behavior === 'add') {
                                        user_like.push(homestay_id)
                                    } else {
                                        user_like = user_like.filter(item => item !== homestay_id)
                                    }
                                    const user_like_next = JSON.stringify(user_like)
                                    // 更新用户信息
                                    const sqlUserUpdateStr = `UPDATE user SET user_like='${user_like_next}' WHERE user_id=${user_id}`
                                    conn.query(sqlUserUpdateStr, (error, user_result) => {
                                        if (error) {
                                            res.send({ code: 0, message: error.code })
                                        } else {
                                            res.send({ code: 200, message: behavior === 'add' ? '点赞成功' : '取赞成功' })
                                        }
                                    })
                                }
                            })
                            
                        }
                    })
                }
            })
        }
    })
})

// 收藏或取藏
router.post('/homestay_detail/submit_favorites', function (req, res) {
    const {
        headers: { authorization },
        body: { homestay_id, behavior }
    } = req
    jwt.verify(authorization, token_key, (error, decoded) => {
        if (error) {
            res.json({ code: 0, message: error.code })
        } else {
            const { user_id } = decoded
            // 查询用户信息
            const sqlSelectStr = `SELECT * from user WHERE user_id=${user_id}`
            conn.query(sqlSelectStr, (error, results) => {
                if (error) {
                    res.json({ code: 0, message: error.code })
                } else {
                    let user_favorites = JSON.parse(results[0]['user_favorites'])
                    if (behavior === 'add') {
                        user_favorites.push(homestay_id)
                    } else {
                        user_favorites = user_favorites.filter(item => item !== homestay_id)
                    }
                    const user_favorites_next = JSON.stringify(user_favorites)
                    // 更新用户信息
                    const sqlUpdateStr = `UPDATE user SET user_favorites='${user_favorites_next}' WHERE user_id=${user_id}`
                    conn.query(sqlUpdateStr, (error, result) => {
                        if (error) {
                            res.send({ code: 0, message: error.code })
                        } else {
                            res.send({ code: 200, message: behavior === 'add' ? '收藏成功' : '取消收藏成功' })
                        }
                    })
                }
            })
        }
    })
})

// 获取房源评论
router.get('/homestay_comment', function (req, res) {
    const { query: { homestay_id } } = req
    const sqlSelectStr = `SELECT * from comment WHERE homestay_id=${homestay_id}`
    const commentSource = []
    conn.query(sqlSelectStr, (error, results) => {
        let length = results.length;
        if (error) {
            res.send({ code: 0, message: error.code })
        } else {
            results.forEach(({
                user_id,
                comment_time,
                comment_content,
                comment_reply,
            }) => {
                const comment = {
                    time: comment_time,
                    content: comment_content,
                    reply: comment_reply || ''
                }
                const sqlReviewersSelectStr = `SELECT * from user WHERE user_id=${user_id}`
                conn.query(sqlReviewersSelectStr, (error, result) => {
                    if (error) {
                        res.send({ code: 0, commentSource: [] })
                    } else {
                        const user_phone = result[0]['user_phone'].replace(result[0]['user_phone'].substr(2, 7), '****')
                        Object.assign(comment, { 
                            face: result[0]['user_avatar'],
                            nickName: result[0]['user_nickname'] || user_phone,
                        })
                        commentSource.unshift(comment)
                        length--;
                        length === 0 && res.send({ code: 200, commentSource })
                    }
                })
            })
        }
    })
})

// 新增房源评论
router.post('/homestay_comment/submit_comment', function (req, res) {
    const {
        headers: { authorization },
        body: { homestay_id, comment_content }
    } = req
    jwt.verify(authorization, token_key, (error, decoded) => {
        if (error) {
            res.json({ code: 0, message: error.code })
        } else {
            const { user_id } = decoded
            const date = new Date()
            const comment_time = `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`
            const sqlInsertStr = `INSERT INTO comment(homestay_id, user_id, comment_time, comment_content) VALUES(?, ?, ?, ?)`
            const comment_arr = [homestay_id, user_id, comment_time, comment_content ]
            conn.query(sqlInsertStr, comment_arr, (error, results, fields) => {
                if (error) {
                    res.send({ code: 0, message: error.code })
                } else {
                    res.send({ code: 200, message: '发表评论成功!' })
                }
            })
        }
    })
})

module.exports = router