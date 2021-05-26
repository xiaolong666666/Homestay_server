const express = require('express')
const jwt = require('jsonwebtoken')
const { isEmpty } = require('lodash')
const conn = require('./../db')
const router = express.Router();
const token_key = "Little_Dragon"

router.get('/fetch_review', (req, res) => {
    let flag = 0
    const sqlSelectTenantStr = `SELECT * from review WHERE user_role=3`
    const handle = (results) => res.send(results)
    let reviewTenant = []
    conn.query(sqlSelectTenantStr, (error, t_results) => {
        if (error) {
            res.json({ code: 0, reviewSource: [] })
        } else {
            const Tenant_arr = t_results.reverse().slice(0, 5)
            let t_length = Tenant_arr.length;
            Tenant_arr.forEach(({
                user_id,
                review_content,
                review_date,
            }) => {
                const sqlSelectTStr = `SELECT * from user WHERE user_id=${user_id}`
                const objTenant = { review_content, review_date }
                conn.query(sqlSelectTStr, (error, t_result) => {
                    if (error) {
                        res.json({ code: 0, reviewSource: [] })
                    } else {
                        const phoneTenant = t_result[0]['user_phone'] && t_result[0]['user_phone'].replace(t_result[0]['user_phone'].substr(2, 7), '****')
                        Object.assign(objTenant, { face: t_result[0]['user_avatar'], nickname: t_result[0]['user_nickname'] || phoneTenant })
                        reviewTenant.push(objTenant)
                        t_length--;
                        const sqlSelectLandlordStr = `SELECT * from review WHERE user_role=2`
                        let reviewLandlord = []
                        conn.query(sqlSelectLandlordStr, (error, t_results) => {
                            if (error) {
                                res.json({ code: 0, reviewSource: [] })
                            } else {
                                const Landlord_arr = t_results.reverse().slice(0, 5)
                                let l_length = Landlord_arr.length;
                                Landlord_arr.forEach(({
                                    user_id,
                                    review_content,
                                    review_date,
                                }) => {
                                    const sqlSelectLStr = `SELECT * from user WHERE user_id=${user_id}`
                                    const objLandlord = { review_content, review_date }
                                    conn.query(sqlSelectLStr, (error, l_result) => {
                                        if (error) {
                                            res.json({ code: 0, reviewSource: [] })
                                        } else {
                                            const phoneLandlord = l_result[0]['user_phone'] && l_result[0]['user_phone'].replace(l_result[0]['user_phone'].substr(2, 7), '****')
                                            Object.assign(objLandlord, { face: l_result[0]['user_avatar'], nickname: l_result[0]['user_nickname'] || phoneLandlord })
                                            reviewLandlord.push(objLandlord)
                                            l_length--;
                                            if (t_length === 0 && l_length === 0) {
                                                flag++
                                                flag === 5 && handle({ code: 200, reviewSource: [{ title: '房客点评', dataSource: reviewTenant }, { title: '房东日记', dataSource: reviewLandlord }] })
                                            }
                                        }
                                    })
                                })
                            }
                        })
                    }
                })
            })
        }
    })
})

router.post('/publish_review', (req, res) => {
    const {
        headers: { authorization },
        body: { review_content, review_date }
    } = req
    jwt.verify(authorization, token_key, (error, decoded) => {
        if (error) {
            switch (error.name) {
                case 'JsonWebTokenError': res.json({ code: 0, message: 'token无效' }); break;
                case 'TokenExpireError': res.json({ code: 0, message: 'token过期' }); break;
                default: res.json({ code: 0, message: 'token无效' })
            }
        } else {
            const { user_id } = decoded
            const sqlSelectStr = `SELECT * from user WHERE user_id = ${user_id}`
            conn.query(sqlSelectStr, (error, results) => {
                if (error) {
                    res.json({ code: 0, message: error.message })
                } else {
                    const sqlInsertStr = `INSERT INTO review(user_id, user_role, review_content, review_date) VALUES(?, ?, ?, ?)`
                    const review_arr = [user_id, results[0]['user_role'], review_content, review_date]
                    conn.query(sqlInsertStr, review_arr, (error, result, fields) => {
                    if (error) {
                        res.json({ code: 0, message: error.message })
                    } else {
                        if (!isEmpty(result)) {
                            res.json({ code: 200, message: '发布点评成功！' })
                        } else {
                            res.json({ code: 0, message: '发布点评失败！' })
                        }
                    }
                })
                }
            })
        }
    })
})

module.exports = router