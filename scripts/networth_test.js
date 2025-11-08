// Simple net-worth calculation test to mirror UI logic
// Run with: node scripts/networth_test.js

function formatCurrency(num, currency) {
  return `${num.toFixed(2)} ${currency}`;
}

function computeDisplay(assetsNum, liabilitiesNum, currency) {
  // liabilities display is absolute magnitude
  const liabilitiesDisplay = Math.abs(liabilitiesNum);
  // liabilities effective sign for calculation: multiply by -1
  const liabilitiesEffective = liabilitiesNum * -1;
  const netWorthNum = assetsNum - liabilitiesEffective;
  return {
    assets: formatCurrency(assetsNum, currency),
    liabilities: formatCurrency(liabilitiesDisplay, currency),
    netWorth: formatCurrency(netWorthNum, currency),
  };
}

function runCases() {
  const cases = [
    { assets: 1000, liabilities: -200, cur: 'USD' }, // normal liability stored negative
    { assets: 1000, liabilities: 50, cur: 'USD' },   // overpaid liability stored positive
    { assets: 0, liabilities: -500, cur: 'EUR' },    // zero assets
    { assets: 500, liabilities: 0, cur: 'USD' },     // no liabilities
  ];

  for (const c of cases) {
    const res = computeDisplay(c.assets, c.liabilities, c.cur);
    console.log(`Input: assets=${c.assets}, liabilities=${c.liabilities}`);
    console.log(` -> Assets:   ${res.assets}`);
    console.log(` -> Liabilities:${res.liabilities}`);
    console.log(` -> Net worth: ${res.netWorth}`);
    console.log('');
  }
}

runCases();
