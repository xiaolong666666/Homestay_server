const isHomestay_area = address => {
    const next = address.includes('区') ? '区' : '县'
    const area = address.substring(address.indexOf('市') + 1, address.indexOf(next) + 1)
    let area_code
    switch (area) {
        case '海港区': area_code = 1; break;
        case '开发区': area_code = 2; break;
        case '山海关区': area_code = 3; break;
        case '北戴河区': area_code = 4; break;
        case '抚宁县': area_code = 5; break;
        case '昌黎县': area_code = 6; break;
        case '卢龙县': area_code = 7; break;
        case '青龙县':  area_code = 8; break;
    }
    return area_code
}

const isHomestay_type = type => {
    let homestay_type = 1
    switch (type) {
        case 'solo': homestay_type = 1; break;
        case 'double': homestay_type = 2; break;
        case 'multiplayer': homestay_type = 3; break;
    }
    return homestay_type
}

const isPrice_type = type => {
    let price_range = 'homestay_price <= 1000'
    switch (type) {
        case 1: price_range = 'homestay_price < 1000'; break;
        case 2: price_range = 'homestay_price >= 1000 AND homestay_price < 1500'; break;
        case 3: price_range = 'homestay_price >= 1500 AND homestay_price < 2000'; break;
        case 4: price_range = 'homestay_price >= 2000'; break;
    }
    return price_range
}

module.exports = {
    isHomestay_area,
    isHomestay_type,
    isPrice_type,
}