---
sidebar_position: 3
---

# Bean Price Support

## Overview

Our plugin supports [bean-price](https://github.com/beancount/beanprice), a tool that fetches market data prices from various sources on the internet and renders them in plain text accounting price syntax.

This feature allows you to keep your Beancount ledger updated with the latest market values for commodities, currencies, and cryptocurrencies.

## Configuration

To fetch the latest prices for your commodities, you need to ensure that they have the appropriate `price` metadata attached to their Beancount directive.

The syntax for the `price` metadata is generally `<CURRENCY>:<module>/<ticker>`.

**Example:**

```beancount
2000-01-01 commodity AAPL
  price: "USD:yahoo/AAPL"
```

## Supported Standard Sources

The plugin supports all the standard price sources provided by `bean-price`. Below is a list of the available modules and what they provide:

| Name                    | Module                    | Provides prices for                                  | Base currency                                | Latest price | Historical price |
|-------------------------|---------------------------|------------------------------------------------------|----------------------------------------------|--------------|------------------|
| [Alphavantage](https://www.alphavantage.co/) | `beanprice.alphavantage`  | Stocks, FX, Crypto                                   | Many currencies                              | ✓            | ✕                |
| [Coinbase](https://www.coinbase.com/)     | `beanprice.coinbase`      | Most common (crypto)currencies                       | Many currencies                              | ✓            | ✓                |
| [Coincap](https://coincap.io/)       | `beanprice.coincap`       | Most common (crypto)currencies                       | USD                                          | ✓            | ✓                |
| [Coinmarketcap](https://coinmarketcap.com/) | `beanprice.coinmarketcap` | Most common (crypto)currencies                       | Many Currencies                              | ✓            | ✕                |
| [European Central Bank API](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html) | `beanprice.ecbrates`      | Many currencies                                      | Many currencies (Derived from EUR rates)     | ✓            | ✓                |
| [OANDA](https://www.oanda.com/)         | `beanprice.oanda`         | Many currencies                                      | Many currencies                              | ✓            | ✓                |
| [Quandl](https://data.nasdaq.com/)        | `beanprice.quandl`        | Various datasets                                     | Various datasets                             | ✓            | ✓                |
| [Rates API](https://ratesapi.io/)     | `beanprice.ratesapi`      | Many currencies                                      | Many currencies                              | ✓            | ✓                |
| [Thrift Savings Plan](https://www.tsp.gov/) | `beanprice.tsp`           | TSP Funds                                            | USD                                          | ✓            | ✓                |
| [Yahoo](https://finance.yahoo.com/)         | `beanprice.yahoo`         | Many currencies                                      | Many currencies                              | ✓            | ✓                |
| [EastMoneyFund(天天基金)](http://fund.eastmoney.com/) | `beanprice.eastmoneyfund` | Chinese Funds                                        | CNY                                          | ✓            | ✓                |
