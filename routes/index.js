const express = require('express');
const conn = require('./../db')
const { isEmpty } = require('lodash')
const router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
})

// 房东排名
router.get('/landlord_ranking', (req, res) => {
  let maxCount = 0
  const sqlSelectStr = "SELECT * from user WHERE user_role=2"
  const landlordRanking = []
  conn.query(sqlSelectStr, (error, results) => {
    if (error) {
      res.send({ code: 0, landlordRankSource: [] })
    } else {
      let length = results.length
      results.forEach(({
        user_id,
        user_avatar,
      }) => {
        const objLandlord = { user_id, user_avatar }
        const sqlSelectHomestayStr = `SELECT homestay_like_count from homestay WHERE landlord_id=${user_id}`
        conn.query(sqlSelectHomestayStr, (error, result) => {
          if (error) {
            res.send({ code: 0, landlordRankSource: [] })
          } else {
            let like_count = 0
            result.forEach(({ homestay_like_count }) => {
              like_count += homestay_like_count
            })
            maxCount = like_count > maxCount ? like_count : maxCount
            Object.assign(objLandlord, { like_count })
            landlordRanking.push(objLandlord)
            length--;
            if (length === 0) {
              landlordRanking.sort((a, b) => b["like_count"] - a["like_count"]).splice(5)
              const landlordRankSource = landlordRanking.map(item => ({ ...item, totalCount: maxCount }))
              res.send({ code: 200, landlordRankSource })
            }
          }
        })
      })
    }
  })
})

// 房东公寓
router.get('/landlord_homestay', (req, res) => {
  const { query: { landlord_id } } = req
  const sqlSelectLandlordStr = `SELECT * FROM user WHERE user_id=${landlord_id}`
  const Landlord = {}
  conn.query(sqlSelectLandlordStr, (error, results) => {
    if (error) {
      res.json({ code: 0, Landlord, HomestaySource: [] })
    } else {
      const user_phone = results[0]['user_phone'].replace(results[0]['user_phone'].substr(2, 7), '****')
      Object.assign(Landlord, {
        user_id: results[0]['user_id'],
        user_nickname: results[0]['user_nickname'] || user_phone,
        user_gender: results[0]['user_gender'],
        user_avatar: results[0]['user_avatar'],
        isReal: !isEmpty(results[0]['user_idcard'])
      })
      const sqlSelectHomestayStr = `SELECT * FROM homestay WHERE landlord_id=${landlord_id}`
      conn.query(sqlSelectHomestayStr, (error, result, fields) => {
        if (error) {
          res.json({ code: 0, Landlord, HomestaySource: [] })
        } else {
          result = result.map(item => ({
            ...item,
            homestay_facility: JSON.parse(item.homestay_facility),
            homestay_picture: JSON.parse(item.homestay_picture),
          }))
          res.send({ code: 200, Landlord, HomestaySource: result })
        }
      })
    }
  })
})

module.exports = router;
