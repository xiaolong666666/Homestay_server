const express = require('express')
const jwt = require('jsonwebtoken')
const { isEmpty, result } = require('lodash')
const conn = require('./../db')
const { isHomestay_type, isPrice_type } = require('./../utils/homestay')
const router = express.Router();
const token_key = "Little_Dragon"

/* GET homestay listing. */
router.post('/', (req, res) => {
    const {
        body: { homestay_type, county, price, facility, count }
    } = req
    const priceStr = isPrice_type(price)
    const type = isHomestay_type(homestay_type)
    const sqlSelectStr = county !== undefined
        ? `SELECT * from homestay WHERE homestay_type=${type} AND homestay_area=${county} AND ${priceStr}`
        : `SELECT * from homestay WHERE homestay_type=${type}`
    const homestayDataSource = []
    conn.query(sqlSelectStr, (error, results) => {
        if (error) {
            console.log('error', error)
            res.json({ code: 0, message: '很遗憾，获取房屋失败！' })
        } else {
            results = !isEmpty(facility)
                ? results.filter(({ homestay_facility }) => facility.every(val => JSON.parse(homestay_facility).includes(val)))
                : results
            if (!!count) {
                results = results.slice(15 * count, 15 * (count + 1))
            } else {
                results = results.slice(0, 15)
            }
            console.log('results', results)
            let length = results.length;
            if (length === 0) { res.json({ code: 200, homestayDataSource: [] }) }
            results.forEach(({
                homestay_id,
                homestay_picture,
                homestay_price,
                homestay_name,
                homestay_recommend,
                landlord_id,
            }) => {
                const homestay = {
                    homestay_id,
                    propagandaPicture: JSON.parse(homestay_picture)[0],
                    price: homestay_price,
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
                        length === 0 && res.json({ code: 200, homestayDataSource, count: count ? count + 1 : 1 })
                    }
                })
            })
        }
    })
})

// 获取房源详情
router.get('/homestay_detail', (req, res) => {
    const { query: { homestay_id, user_id } } = req
    // 查询此房源信息
    const sqlSelectStr = `SELECT * from homestay WHERE homestay_id=${homestay_id}`
    conn.query(sqlSelectStr, (error, results) => {
        if (error) {
            res.send({ code: 0, message: error.message })
        } else {
            const like = !!results[0]['homestay_like'] && JSON.parse(results[0]['homestay_like']).includes(Number(user_id))
            const homestay_detail = {
                picDataSource: JSON.parse(results[0]['homestay_picture']),
                price: results[0]['homestay_price'],
                like,
                like_count: results[0]['homestay_like_count'],
            }
            const landlord_id = results[0]['landlord_id']
            // 查询用户信息
            const sqlUserSelectStr = `SELECT * from user WHERE user_id=${user_id}`
            conn.query(sqlUserSelectStr, (error, user_result) => {
                if (error) {
                    res.send({ code: 0, ...homestay_detail })
                } else {
                    const favorites = !isEmpty(user_result) ? (!!user_result[0]['user_favorites'] && JSON.parse(user_result[0]['user_favorites']).includes(homestay_id)) : false
                    // 查询房东信息
                    const sqlLandlordSelectStr = `SELECT * FROM user WHERE user_id=${landlord_id}`
                    conn.query(sqlLandlordSelectStr, (error, result) => {
                        if (error) {
                            res.send({ code: 200, message: error.message })
                        } else {
                            const phone = result[0]['user_phone'] && result[0]['user_phone'].replace(result[0]['user_phone'].substr(2, 7), '****')
                            const landlord_info = {
                                landlord_id: result[0]['user_id'],
                                nickname: result[0]['user_nickname'] || phone,
                                face: result[0]['user_avatar'],
                                gender: result[0]['user_gender'],
                                isVerified: !!result[0]['user_idcard'],
                            }
                            // 查询房东其他房源信息
                            const sqlLandlordHomestayStr = `SELECT * FROM homestay WHERE landlord_id=${landlord_id}`
                            conn.query(sqlLandlordHomestayStr, (error, homestaySource, fields) => {
                                if (error) {
                                    res.send({ code: 0, message: error.message })
                                } else {
                                    const landlord_house = homestaySource.map(item => ({
                                        homestay_id: item['homestay_id'],
                                        homestay_type: item['homestay_type'],
                                        homestay_picture: JSON.parse(item['homestay_picture'])[0],
                                        homestay_price: item['homestay_price'],
                                    }))
                                    Object.assign(homestay_detail, { favorites, landlord_info, landlord_house })
                                    res.send({ code: 200, ...homestay_detail })
                                }
                            })
                        }
                    })
                }
            })
        }
    })
})

// 点赞或取赞
router.post('/homestay_detail/submit_like', (req, res) => {
    const {
        headers: { authorization },
        body: { homestay_id, behavior }
    } = req
    jwt.verify(authorization, token_key, (error, decoded) => {
        if (error) {
            res.json({ code: 0, message: error.message })
        } else {
            const { user_id } = decoded
            // 查询房源信息
            const sqlHomestaySelectStr = `SELECT homestay_like,homestay_like_count from homestay WHERE homestay_id=${homestay_id}`
            conn.query(sqlHomestaySelectStr, (error, results) => {
                if (error) {
                    res.json({ code: 0, message: error.message })
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
                            res.send({ code: 0, message: error.message })
                        } else {
                            // 查询用户信息
                            const sqlUserSelectStr = `SELECT user_like from user WHERE user_id = ${user_id}`
                            conn.query(sqlUserSelectStr, (error, user_results) => {
                                if (error) {
                                    res.send({ code: 0, message: error.message })
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
                                            res.send({ code: 0, message: error.message })
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
router.post('/homestay_detail/submit_favorites', (req, res) => {
    const {
        headers: { authorization },
        body: { homestay_id, behavior }
    } = req
    jwt.verify(authorization, token_key, (error, decoded) => {
        if (error) {
            res.json({ code: 0, message: error.message })
        } else {
            const { user_id } = decoded
            // 查询用户信息
            const sqlSelectStr = `SELECT * from user WHERE user_id=${user_id}`
            conn.query(sqlSelectStr, (error, results) => {
                if (error) {
                    res.json({ code: 0, message: error.message })
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
                            res.send({ code: 0, message: error.message })
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
router.get('/homestay_comment', (req, res) => {
    const { query: { homestay_id } } = req
    const sqlSelectStr = `SELECT * from comment WHERE homestay_id=${homestay_id}`
    const commentSource = []
    conn.query(sqlSelectStr, (error, results) => {
        if (error) {
            res.send({ code: 0, message: error.message })
        } else {
            let length = results.length;
            if (length === 0) { res.json({ code: 200, commentSource: [] }) }
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
router.post('/homestay_comment/submit_comment', (req, res) => {
    const {
        headers: { authorization },
        body: { homestay_id, comment_content }
    } = req
    jwt.verify(authorization, token_key, (error, decoded) => {
        if (error) {
            res.json({ code: 0, message: error.message })
        } else {
            const { user_id } = decoded
            const date = new Date()
            const comment_time = `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`
            const sqlInsertStr = `INSERT INTO comment(homestay_id, user_id, comment_time, comment_content) VALUES(?, ?, ?, ?)`
            const comment_arr = [homestay_id, user_id, comment_time, comment_content ]
            conn.query(sqlInsertStr, comment_arr, (error, results, fields) => {
                if (error) {
                    res.send({ code: 0, message: error.message })
                } else {
                    res.send({ code: 200, message: '发表评论成功!' })
                }
            })
        }
    })
})

// 房东房源评论回复
router.post('/homestay_comment/submit_reply', (req, res) => {
    const {
        headers: { authorization },
        body: { homestay_id, comment_reply }
    } = req
    jwt.verify(authorization, token_key, (error) => {
        if (error) {
            res.json({ code: 0, message: error.message })
        } else {
            const sqlUpdateStr = `UPDATE comment SET comment_reply='${comment_reply}' WHERE homestay_id=${homestay_id}`
            conn.query(sqlUpdateStr, (error) => {
                if (error) {
                    res.send({ code: 0, message: error.message })
                } else {
                    res.send({ code: 200, message: '回复评论成功!' })
                }
            })
        }
    })
})

// 新增房源预约
router.post('/homestay_detail/submit_reserve', (req, res) => {
    const {
        headers: { authorization },
        body: { homestay_id, reserve_check_time, reserve_stay_time, reserve_note },
    } = req
    jwt.verify(authorization, token_key, (error, decoded) => {
        if (error) {
            res.json({ code: 0, message: error.message })
        } else {
            const { user_id } = decoded
            const sqlSelectStr = `SELECT landlord_id FROM homestay WHERE homestay_id=${homestay_id}`
            conn.query(sqlSelectStr, (error, result) => {
                if (error) {
                    res.send({ code: 0, message: error.message })
                } else {
                    const landlord_id = result[0]['landlord_id']
                    const sqlInsertStr = `INSERT INTO reserve(homestay_id, landlord_id, user_id, reserve_check_time, reserve_stay_time, reserve_note) VALUES(?, ?, ?, ?, ?, ?)`
                    const reserve_arr = [homestay_id, landlord_id, user_id, reserve_check_time, reserve_stay_time, reserve_note]
                    conn.query(sqlInsertStr, reserve_arr, (error) => {
                        if (error) {
                            res.send({ code: 0, message: error.message })
                        } else {
                            res.send({ code: 200, message: '房源预约成功!' })
                        }
                    })
                }
            })
        }
    })
})

module.exports = router