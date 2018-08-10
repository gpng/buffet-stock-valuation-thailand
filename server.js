const express = require('express');
const bodyParser = require('body-parser');
const to = require('await-to-js').default;
const axios = require('axios');
const cheerio = require('cheerio');
const _ = require('lodash');

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.send("Welcome to Mookualofa's Buffet valuation API");
});

app.get('/data', async (req, res) => {
  const ticker = req.query.ticker;
  const cashflowPromise = getCashFlow(ticker);
  const financialsPromise = getFinancials(ticker);
  const keyRatiosPromise = getKeyRatios(ticker);
  const performancePromise = getPerformance(ticker);
  const [financials, keyRatios, cashFlow, performance] = await Promise.all([
    financialsPromise,
    keyRatiosPromise,
    cashflowPromise,
    performancePromise
  ]);
  // res.send(keyRatios);
  res.send({ financials, keyRatios, cashFlow, performance });
});

const getFinancials = async ticker => {
  const url = `http://financials.morningstar.com/finan/financials/getFinancePart.html?&t=XBKK:${ticker}&region=tha&culture=en-US&cur=&order=asc`;
  const [err, res] = await to(axios.get(url));

  if (err) {
    console.log(err);
    return null;
  }
  if (res.status === 200) {
    const columns = 11; // Y
    const rows = [
      [2, 'operatingIncome'], // operating income
      [4, 'netIncome'], // net income
      [5, 'earningsPerShare'], // earnings per share
      [6, 'dividends'], // dividends
      [7, 'shares'], // shares,
      [8, 'bookValuePerShare'], // book value per share
      [11, 'freeCashFlow'] // free cash flow
    ]; // i
    const $ = cheerio.load(res.data.componentData);
    const financials = {};
    for (const row of rows) {
      let objRow = {};
      for (const col of _.range(columns)) {
        objRow[`Y${col}`] = parseFloat(
          $(`[headers="Y${col} i${row[0]}"]`)
            .html()
            .split(',')
            .join('')
        );
      }
      financials[row[1]] = objRow;
    }
    return financials;
  }
  return null;
};

const getKeyRatios = async ticker => {
  const url = `http://financials.morningstar.com/finan/financials/getKeyStatPart.html?t=XBKK:${ticker}&region=tha&culture=en-US&cur=&order=asc`;
  const [err, res] = await to(axios.get(url));

  if (err) {
    console.log(err);
    return null;
  }
  if (res.status === 200) {
    const columns = 11; // Y
    const $ = cheerio.load(res.data.componentData);
    const keyRatios = { returnOnEquity: {}, currentRatio: {}, debtEquity: {} };
    for (const col of _.range(columns)) {
      keyRatios.returnOnEquity[`Y${col}`] = parseFloat(
        $(`[headers="pr-pro-Y${col} pr-profit i26"]`)
          .html()
          .split(',')
          .join('')
      );
      keyRatios.currentRatio[`Y${col}`] = parseFloat(
        $(`[headers="lfh-Y${col} lfh-liquidity i65"]`)
          .html()
          .split(',')
          .join('')
      );
      keyRatios.debtEquity[`Y${col}`] = parseFloat(
        $(`[headers="lfh-Y${col} lfh-liquidity i68"]`)
          .html()
          .split(',')
          .join('')
      );
    }
    return keyRatios;
  }
  return null;
};

const getCashFlow = async ticker => {
  const url = `http://financials.morningstar.com/ajax/ReportProcess4HtmlAjax.html?&t=XBKK:${ticker}&region=tha&culture=en-US&cur=&reportType=cf&period=12&dataType=A&order=asc&columnYear=5&curYearPart=1st5year&rounding=3&view=raw&r=218267`;
  const [err, res] = await to(axios.get(url));

  if (err) {
    console.log(err);
    return null;
  }
  if (res.status === 200) {
    const $ = cheerio.load(res.data.result);
    const cashFlow = { operating: {}, investment: {}, financing: {} };
    $('#data_tts1 > div').each((i, el) => {
      cashFlow.operating[`Y${i}`] = parseFloat(
        el.children[0].data
          .replace(/[()]/g, '')
          .split(',')
          .join('')
      );
    });
    $('#data_tts2 > div').each((i, el) => {
      cashFlow.investment[`Y${i}`] = parseFloat(
        el.children[0].data
          .replace(/[()]/g, '')
          .split(',')
          .join('')
      );
    });
    $('#data_tts3 > div').each((i, el) => {
      cashFlow.financing[`Y${i}`] = parseFloat(
        el.children[0].data
          .replace(/[()]/g, '')
          .split(',')
          .join('')
      );
    });
    return cashFlow;
  }
  return null;
};

const getPerformance = async ticker => {
  const url = `http://performance.morningstar.com/perform/Performance/stock/performance-history-1.action?&t=XBKK:${ticker}&region=tha&culture=en-US&cur=&ops=clear&s=&ndec=2&ep=true&align=m&y=10&type=growth`;
  const [err, res] = await to(axios.get(url));

  if (err) {
    console.log(err);
    return null;
  }
  if (res.status === 200) {
    const $ = cheerio.load(res.data);
    const action = $('.action').get(3);
    const dividendYield = {};
    $(action)
      .find('td')
      .each((i, el) => {
        dividendYield[`Y${i}`] = parseFloat(el.children[0].data);
      });
    return { dividendYield };
  }
  return null;
};

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
