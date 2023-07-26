const router = require("express").Router();
const axios = require("axios");
const { getStock, stockList } = require("../../helpers/stock");
const { formattedDate } = require("../../helpers/date");
const { authenticator } = require("../../middleware/auth");
const { apiErrorHandler } = require("../../middleware/error-handler");
const { getStockNews } = require("../../helpers/news");

router.get("/stock/index", authenticator, async (req, res, next) => {
  try {
    const url = "https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX";
    let data = await axios.get(url);

    // 最後更新日期
    const headerDate = data.headers["last-modified"];
    // 將日期字串轉換為Date物件
    const dateObj = new Date(headerDate);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    const formattedDate = `${year - 1911}年${month}月${day}日`;
    const title = `${formattedDate} 大盤指數彙總表`;

    // 資料處理
    data = data.data;
    res.json({ data, title });
  } catch (error) {
    next(error);
  }
});

router.get("/stock/userStock", authenticator, async (req, res, next) => {
  try {
    // 取得0050資料
    const { response, timestamp, price } = await getStock("0050");
    const compare = [];

    // 日期轉換
    const date = [];
    timestamp.forEach((e) => {
      date.push(formattedDate(e));
    });

    // 使用者的自選股
    const user = req.user;
    const userStock = user.Stocks;
    const dic = await stockList();
    const stockId = ["0050"];
    const stockName = ["台灣50"];
    // 0050 ratio

    let last = price[0].close[-1] ? 0 : 1;
    if (last) price[0].close.pop();
    const sum0050 = price[0].close.reduce((acc, curr) => {
      return acc + curr;
    }, 0);
    const avg0050 = sum0050 / price[0].close.length;
    const ratio0050 = price[0].close.map((e) => (e / avg0050).toFixed(2));
    compare.push(ratio0050);

    // 使用者的自選股 ratio 計算
    for (const element of userStock) {
      const { timestamp, price } = await getStock(element.stockId);
      stockId.push(element.stockId);
      stockName.push(dic[element.stockId].name);
      if (last) price[0].close.pop();
      const sum = price[0].close.reduce((acc, curr) => {
        return acc + curr;
      }, 0);
      const avg = sum / price[0].close.length;
      const ratio = price[0].close.map((e) => (e / avg).toFixed(4) * 100 - 100);
      compare.push(ratio);
    }
    return res.json({ compare, date, stockId, stockName });
  } catch (error) {
    next(error);
  }
});

router.get("/stock/:id/news", authenticator, async (req, res, next) => {
  try {
    const { id } = req.params;
    // 取得中文名稱
    const dic = await stockList();
    const stockName = dic[id]["name"];
    console.log(stockName);
    // 取得相關新聞
    const news = await getStockNews(stockName);
    return res.json(news);
  } catch (error) {
    next(error);
  }
});

router.get("/stock/:id", authenticator, async (req, res, next) => {
  try {
    // 取得特定id 資料
    const { id } = req.params;
    const { response, timestamp, price } = await getStock(id);

    // 取得繪圖必須資料 date, openEnd, highLow, color, max, min
    const date = [];
    const openEnd = [];
    const highLow = [];
    const high = price[0].high;
    const low = price[0].low;
    const color = [];

    // API bug ETF查詢錯誤
    const last = high[-1] ? 0 : 1;
    let [max, min] = [
      Math.max(...high.slice(0, high.length - last)),
      Math.min(...low.slice(0, low.length - last)),
    ];
    [max, min] = [Math.ceil(max + (max - min)), Math.floor(min - (max - min))];
    // 時間轉換
    timestamp.forEach((e) => {
      date.push(formattedDate(e));
    });
    if (last) date.pop();

    // 處理當 open/close 相同
    for (let i = 0; i < price[0].open.length - last; i++) {
      if (price[0].open[i] === price[0].close[i]) {
        price[0].close[i] -= 0.1;
      }
      let start = price[0].open[i].toFixed(2);
      let end = price[0].close[i].toFixed(2);
      openEnd.push([start, end]);

      // 決定顏色
      if (end > start) {
        color.push("red");
      } else if (end < start) {
        color.push("green");
      } else {
        color.push("black");
      }
    }
    for (let i = 0; i < high.length - last; i++) {
      highLow.push([high[i].toFixed(2), low[i].toFixed(2)]);
    }
    res.json({
      date,
      openEnd,
      highLow,
      max,
      min,
      color,
    });
  } catch (error) {
    next(error);
  }
});

router.use("/", apiErrorHandler);

module.exports = router;
